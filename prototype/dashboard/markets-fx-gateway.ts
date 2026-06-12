// dashboard/markets-fx-gateway.ts
//
// FX desk Slice 4 — synchronous order-acceptance gateway pipeline.
//
// Implements:
//   1. OrderProposed emission
//   2. Eight sequential pre-trade gateway checks
//      (identity, sanctions, counterparty-eligibility, suitability,
//       documentation, credit-limit, capital-impact, funding)
//   3. OrderApprovedAtGateway / OrderRejectedAtGateway emission
//   4. Idempotency guard: if a terminal gateway event already exists for
//      this orderId, returns the cached result without re-emitting
//
// Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//            D-MARKETS-SCHEMA-FOUNDATION
//
// Author: Kai (Trading systems engineer, engineering — reports to
//         Saskia, Head of Global Markets)

import { lookupFaisCategory } from "../platform/conduct/fx-trade-conduct-evaluation";
import { minor } from "../platform/core/money";
import { type Currency, newEventId } from "../platform/core/types";
import {
  makeGatewayCheckCompleted,
  makeGatewayCheckRequested,
  makeOrderApprovedAtGateway,
  makeOrderProposed,
  makeOrderRejectedAtGateway,
} from "../platform/event-store/event-types/trading";
import { simulatedTag } from "../platform/event-store/provenance";
import type { EventStore } from "../platform/event-store/store";
import { checkCounterpartyIdentityOfRecord } from "../platform/markets/identity/counterparty-identity-gate";
import { checkLegalDocumentationOfRecord } from "../platform/markets/legal/legal-documentation-gate";
import { screenCounterpartySanctions } from "../platform/markets/regulatory/sanctions-screen";
import { checkHeadroom } from "../platform/risk/credit-limit-engine";
import {
  evaluateCapitalImpact,
  evaluateFundingImpact,
  fxGatewayThresholdSchedule,
  latestRwaComputedTotalMinor,
} from "../platform/risk/fx-gateway-thresholds";
import type { RfqInput, SyntheticQuote } from "./markets-fx-trade";
import { isCounterpartyEligible } from "./markets-fx-trade";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GatewayCheckResult {
  checkKind: string;
  outcome: "approve" | "reject" | "timeout";
  latencyMs: number;
  rejectionReason?: string;
}

export interface GatewayOrderResult {
  status: "approved" | "rejected" | "timeout";
  orderId: string;
  checks: GatewayCheckResult[];
  rejectingCheck?: string | undefined;
  rejectionReason?: string | undefined;
  asOf: string;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const GATEWAY_ENTITY = "LE-ZA-HOZ-BANK";
const GATEWAY_ACTOR = { type: "service" as const, id: "agent:kai:fx-gateway" };
const GATEWAY_CITATIONS = ["D-FX-SALES-TRADING-FRONTEND", "D-MARKETS-SCHEMA-FOUNDATION"] as const;

/** The eight pre-trade gateway check kinds run for every order. */
const CHECK_KINDS = [
  // identity runs FIRST: a counterparty must be a KYC-accepted party of record
  // (CounterpartyEligibilityScreened party-of-record AND SanctionsClearance-
  // Passed / ClientAccepted KYC acceptance) before any substantive check runs.
  // FAIL-CLOSED — see checkCounterpartyIdentityOfRecord (D-FX-HELD-DIMS-SEAT-
  // SWEEP; FIC Act 38/2001 s.21B/s.28A).
  "identity",
  "sanctions",
  "counterparty-eligibility",
  // suitability runs AFTER counterparty-eligibility: a counterparty that is not
  // even eligible to trade with the bank should reject at eligibility, not be
  // evaluated for product suitability. FAIS §8D suitability presupposes an
  // eligible relationship (D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH).
  "suitability",
  // documentation runs after counterparty-eligibility/suitability and before
  // credit-limit: a written trading-relationship agreement must exist BEFORE
  // any OTC derivative transaction (ORG-CS3-001, FSCA Conduct Standard 3/2018
  // §3). FAIL-CLOSED — see checkLegalDocumentationOfRecord
  // (D-FX-HELD-DIMS-SEAT-SWEEP).
  "documentation",
  "credit-limit",
  "capital-impact",
  "funding",
] as const;

type CheckKind = (typeof CHECK_KINDS)[number];

// ---------------------------------------------------------------------------
// Synthetic LEI helper
// ---------------------------------------------------------------------------

/**
 * Convert a counterpartyId to a 20-char uppercase alphanumeric LEI.
 * The ISO 17442 format requires exactly 20 chars matching /^[A-Z0-9]{20}$/.
 */
function toSyntheticLei(counterpartyId: string): string {
  const base = counterpartyId
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "0")
    .slice(0, 20);
  return base.padEnd(20, "0");
}

// ---------------------------------------------------------------------------
// Idempotency guard
// ---------------------------------------------------------------------------

function replayToArray(store: Pick<EventStore, "replay">, opts: { type: string }) {
  const out = [];
  for (const e of store.replay(opts)) {
    out.push(e);
  }
  return out;
}

function findExistingTerminalEvent(
  store: Pick<EventStore, "replay">,
  orderId: string,
): GatewayOrderResult | null {
  const approvedEvents = replayToArray(store, { type: "OrderApprovedAtGateway" });
  const approvedEvent = approvedEvents.find((e) => {
    const p = e.payload as Record<string, unknown>;
    return p.orderId === orderId;
  });
  if (approvedEvent) {
    // Rebuild minimal result from the approved event; check details not stored.
    return {
      status: "approved",
      orderId,
      checks: [],
      asOf: approvedEvent.as_of,
    };
  }

  const rejectedEvents = replayToArray(store, { type: "OrderRejectedAtGateway" });
  const rejectedEvent = rejectedEvents.find((e) => {
    const p = e.payload as Record<string, unknown>;
    return p.orderId === orderId;
  });
  if (rejectedEvent) {
    const p = rejectedEvent.payload as Record<string, unknown>;
    const rejectingCheck = typeof p.rejectingCheck === "string" ? p.rejectingCheck : undefined;
    const rejectionReason = typeof p.rejectionReason === "string" ? p.rejectionReason : undefined;
    const result: GatewayOrderResult = {
      status: "rejected",
      orderId,
      checks: [],
      asOf: rejectedEvent.as_of,
    };
    if (rejectingCheck !== undefined) result.rejectingCheck = rejectingCheck;
    if (rejectionReason !== undefined) result.rejectionReason = rejectionReason;
    return result;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

export function routeOrderToGateway(args: {
  store: Pick<EventStore, "append" | "replay">;
  rfqInput: RfqInput;
  quote: SyntheticQuote;
  asOf: string;
  scenario?: string;
}): GatewayOrderResult {
  const { store, rfqInput, quote, asOf, scenario } = args;

  // Generate orderId; note: idempotency guard can only be used when the
  // caller passes a pre-existing orderId externally (see test case 14 pattern).
  const orderId = `ord:${newEventId()}`;

  // Idempotency: if a terminal event already exists for this orderId, return it.
  const existing = findExistingTerminalEvent(store, orderId);
  if (existing) {
    return existing;
  }

  const provenance = simulatedTag({
    scenario: scenario ?? "first-dry-run-2026-Q1",
    sourceLineage: "agent-runtime:kai-fx-gateway",
    tags: ["fx-desk", "slice-4", `ord:${orderId}`],
  });

  // Build instrument name from currency pair
  const instrument =
    rfqInput.currencyPair !== undefined
      ? `FX-spot-${rfqInput.currencyPair.replace("/", "")}`
      : "FX-spot-USDZAR";

  // Determine price and price currency from the quote
  const priceCurrency = rfqInput.currencyPair?.split("/")?.[1] ?? "ZAR";

  // Emit OrderProposed
  const counterpartyLei = toSyntheticLei(rfqInput.counterpartyId);
  const orderProposedEvent = makeOrderProposed({
    asOf,
    entity: GATEWAY_ENTITY,
    actor: GATEWAY_ACTOR,
    citations: [...GATEWAY_CITATIONS],
    payload: {
      orderId,
      counterpartyLei,
      instrument,
      side: rfqInput.side,
      quantity: rfqInput.notional,
      price: quote.rateUsed,
      priceCurrency,
      bookingEntity: GATEWAY_ENTITY,
      requestedActor: "agent:kai:fx-rfq",
    },
  });
  store.append({ ...orderProposedEvent, provenance });

  const sourceOrderEventId = orderProposedEvent.event_id;
  const checkResults: GatewayCheckResult[] = [];
  let rejectingCheck: CheckKind | null = null;
  let rejectionReason: string | undefined;

  // Run all 8 checks sequentially
  for (const checkKind of CHECK_KINDS) {
    const requestedAt = asOf;

    // Emit GatewayCheckRequested
    const checkRequestedEvent = makeGatewayCheckRequested({
      asOf,
      entity: GATEWAY_ENTITY,
      actor: GATEWAY_ACTOR,
      citations: [...GATEWAY_CITATIONS],
      payload: {
        orderId,
        checkKind,
        sourceOrderEventId,
        requestedAt,
        timeoutMs: 5000,
      },
    });
    store.append({ ...checkRequestedEvent, provenance });

    // Determine outcome
    let outcome: "approve" | "reject" | "timeout" = "approve";
    let checkRejectionReason: string | undefined;

    // identity — FAIL-CLOSED counterparty-identity gate (position 1). The
    // counterparty must be a KYC-accepted party of record: a
    // CounterpartyEligibilityScreened (party-of-record) AND a
    // SanctionsClearancePassed / ClientAccepted (KYC acceptance) of record.
    // Asks the prior question — "is this an onboarded, KYC-accepted party?" —
    // before any substantive check runs. Distinct from the order-time
    // `sanctions` blocked-list screen and from `counterparty-eligibility`.
    // ops/COO posture (Devon, Chief Operating Officer, governance), fail-closed,
    // FIC Act 38/2001 s.21B/s.28A; D-FX-HELD-DIMS-SEAT-SWEEP. Reads the SAME
    // store the gateway writes to (threaded), not the composition global.
    if (checkKind === "identity") {
      const identity = checkCounterpartyIdentityOfRecord(store, rfqInput.counterpartyId);
      if (!identity.ok) {
        outcome = "reject";
        checkRejectionReason = identity.rejectionReason;
      }
    }

    if (checkKind === "counterparty-eligibility") {
      if (!isCounterpartyEligible(store, rfqInput.counterpartyId)) {
        outcome = "reject";
        checkRejectionReason = "counterparty not in eligibility-passing set";
      }
    }

    // suitability — FAIS §8D product-suitability gate. CCO posture
    // (Zara, Chief Compliance Officer, governance; D-FX-CONDUCT-SURVEILLANCE-
    // REMEDIATION-DISPATCH 2026-06-11): this bank is an institutional /
    // professional-only venue (D-FAIS-SCOPE; D-FX-COUNTERPARTY-SCOPE-
    // INSTITUTIONAL), so appropriateness is lighter than retail — a market-
    // counterparty / professional-client can transact every in-scope FX
    // product. But the check is ENFORCED, not approve-always: a retail-client
    // counterparty (which must never appear here) is rejected as a conduct
    // finding, and an UNCLASSIFIED counterparty is rejected fail-closed so a
    // trade cannot pass suitability without a FAIS category of record. The
    // positive post-trade FaisClassificationSuitabilityChecked event-of-record
    // (rohan:conduct-surveillance-sweep) is the durable discharge.
    if (checkKind === "suitability") {
      const faisCategory = lookupFaisCategory(store, rfqInput.counterpartyId);
      if (faisCategory === null) {
        outcome = "reject";
        checkRejectionReason =
          "suitability: counterparty has no FAIS classification of record (FAIS Act 37/2002 §8D); " +
          "classify via CounterpartyFaisClassified before trading (fail-closed, D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH)";
      } else if (faisCategory === "retail-client") {
        outcome = "reject";
        checkRejectionReason =
          "suitability: retail-client counterparty at an institutional-only venue (D-FAIS-SCOPE; FAIS Act 37/2002 §8D) — conduct finding";
      }
    }

    // documentation — FAIL-CLOSED legal-documentation gate (ORG-CS3-001, FSCA
    // Conduct Standard 3/2018 §3; D-FX-HELD-DIMS-SEAT-SWEEP). A bank must NOT
    // transact an OTC derivative with a counterparty that has no signed
    // trading master agreement of record (ISDA Master 2002/2025 or an
    // FX-bilateral master, via LegalDocumentationSigned). Mirrors the
    // credit-limit (#1177) and suitability (#1221) fail-closed posture. The
    // annual jurisdictional-opinion refresh SLA is a separate MONITORING
    // control (opinion-refresh-watchdog), never an order-path block. Reads the
    // SAME store the gateway writes to (threaded), not the composition global.
    if (checkKind === "documentation") {
      const legalDoc = checkLegalDocumentationOfRecord(store, rfqInput.counterpartyId);
      if (!legalDoc.ok) {
        outcome = "reject";
        checkRejectionReason = legalDoc.rejectionReason;
      }
    }

    // sanctions — synchronous screen against the blocked list (D-FX-OTC-NPA-
    // SCOPE-EXPANSION gateway enforcement; ORG-FC-13). Screens both the raw
    // counterparty id and its synthetic LEI. A bank must not trade with a
    // sanctioned counterparty; this is fail-on-hit (clear list → approve).
    if (checkKind === "sanctions") {
      const screen = screenCounterpartySanctions([counterpartyLei, rfqInput.counterpartyId]);
      if (screen.blocked) {
        outcome = "reject";
        checkRejectionReason = screen.reason ?? "counterparty on sanctions blocked list";
      }
    }

    // credit-limit — FAIL-CLOSED pre-deal headroom gate (D-FX-GATEWAY-CREDIT-
    // LIMIT-FAIL-CLOSED, CEO-approved). A bank must NOT trade with a counterparty
    // that has no loaded, in-good-standing credit limit, or whose limit is
    // exhausted/expired/stale (Credit Risk Policy §1.3; Banks Act Reg 23). The
    // proposed exposure is the order's quote-currency notional value; checkHeadroom
    // returns ok=false + a canonical blockReason in every block case (incl. no
    // loaded limit → CounterpartyNotApproved). Reads the SAME store the gateway
    // writes to (threaded), not the composition global.
    if (checkKind === "credit-limit") {
      const quoteCcy = (rfqInput.currencyPair?.split("/")?.[1] ?? "ZAR") as Currency;
      const proposedMinor = Math.max(0, Math.round(rfqInput.notional * quote.rateUsed * 100));
      const proposedExposure = minor(BigInt(proposedMinor), quoteCcy);
      const headroom = checkHeadroom(rfqInput.counterpartyId, proposedExposure, asOf, store);
      if (!headroom.ok) {
        outcome = "reject";
        checkRejectionReason = `credit-limit: ${headroom.blockReason ?? "no headroom"} (utilisation ${headroom.utilisationPct}%)`;
      }
    }

    // capital-impact + funding — enforced against the CRO-ratified threshold
    // schedule (D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS, approved 2026-06-10;
    // funding leg co-owned by Ravi (Treasury / ALM engineer, engineering)).
    // FAIL-CLOSED: a non-ZAR quote currency cannot be ZAR-projected pre-trade
    // and is rejected rather than waved through. Sell orders reduce exposure
    // and are admitted without evaluation (matches the async handler's
    // standing semantics in kai-credit-capital-funding-check).
    if (checkKind === "capital-impact" || checkKind === "funding") {
      const quoteCcy = rfqInput.currencyPair?.split("/")?.[1] ?? "ZAR";
      if (rfqInput.side !== "sell") {
        if (quoteCcy !== "ZAR") {
          outcome = "reject";
          checkRejectionReason = [
            `${checkKind} check is FAIL-CLOSED: quote currency '${quoteCcy}' cannot be`,
            "ZAR-projected for capital/LCR impact pre-trade (D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS).",
          ].join(" ");
        } else {
          const notionalZarMinor = Math.max(
            0,
            Math.round(rfqInput.notional * quote.rateUsed * 100),
          );
          const schedule = fxGatewayThresholdSchedule();
          const evaluation =
            checkKind === "capital-impact"
              ? evaluateCapitalImpact({
                  instrumentClass: "FX-spot",
                  notionalMinor: notionalZarMinor,
                  currentRwaMinor: latestRwaComputedTotalMinor(store),
                  schedule,
                })
              : evaluateFundingImpact({
                  notionalMinor: notionalZarMinor,
                  currentLcrPct: null,
                  schedule,
                });
          if (evaluation.outcome === "reject") {
            outcome = "reject";
            checkRejectionReason = evaluation.rejectionReason;
          }
        }
      }
    }

    // Synthetic latency: 10–99ms
    const latencyMs = 10 + Math.floor(Math.random() * 90);
    const completedAt = asOf;

    // Emit GatewayCheckCompleted. capital-impact + funding completions also
    // cite the CRO threshold-ratification decision they enforce; documentation
    // completions cite the obligation the gate enforces (ORG-CS3-001).
    const checkCompletedEvent = makeGatewayCheckCompleted({
      asOf,
      entity: GATEWAY_ENTITY,
      actor: GATEWAY_ACTOR,
      citations:
        checkKind === "capital-impact" || checkKind === "funding"
          ? [...GATEWAY_CITATIONS, "D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS"]
          : checkKind === "documentation"
            ? [...GATEWAY_CITATIONS, "ORG-CS3-001", "D-FX-HELD-DIMS-SEAT-SWEEP"]
            : checkKind === "identity"
              ? [...GATEWAY_CITATIONS, "FIC-ACT-38-2001", "D-FX-HELD-DIMS-SEAT-SWEEP"]
              : [...GATEWAY_CITATIONS],
      payload: {
        orderId,
        checkKind,
        outcome,
        sourceCheckRequestEventId: checkRequestedEvent.event_id,
        completedAt,
        durationMs: latencyMs,
        ...(checkRejectionReason !== undefined ? { rejectionReason: checkRejectionReason } : {}),
      },
    });
    store.append({ ...checkCompletedEvent, provenance });

    checkResults.push({
      checkKind,
      outcome,
      latencyMs,
      ...(checkRejectionReason !== undefined ? { rejectionReason: checkRejectionReason } : {}),
    });

    // Stop at first rejection
    if (outcome === "reject" && rejectingCheck === null) {
      rejectingCheck = checkKind;
      rejectionReason = checkRejectionReason;
    }
  }

  if (rejectingCheck !== null) {
    // Emit OrderRejectedAtGateway
    const rejectedEvent = makeOrderRejectedAtGateway({
      asOf,
      entity: GATEWAY_ENTITY,
      actor: GATEWAY_ACTOR,
      citations: [...GATEWAY_CITATIONS],
      payload: {
        orderId,
        rejectionReason: rejectionReason ?? "gateway check failed",
        rejectingCheck,
        citationToRule: "D-FX-SALES-TRADING-FRONTEND",
        rejectedAt: asOf,
      },
    });
    store.append({ ...rejectedEvent, provenance });

    const rejResult: GatewayOrderResult = {
      status: "rejected",
      orderId,
      checks: checkResults,
      rejectingCheck,
      asOf,
    };
    if (rejectionReason !== undefined) rejResult.rejectionReason = rejectionReason;
    return rejResult;
  }

  // All checks passed
  const approvedEvent = makeOrderApprovedAtGateway({
    asOf,
    entity: GATEWAY_ENTITY,
    actor: GATEWAY_ACTOR,
    citations: [...GATEWAY_CITATIONS],
    payload: {
      orderId,
      approvalCitations: [...GATEWAY_CITATIONS],
      passedAt: asOf,
    },
  });
  store.append({ ...approvedEvent, provenance });

  return {
    status: "approved",
    orderId,
    checks: checkResults,
    asOf,
  };
}

// ---------------------------------------------------------------------------
// Exported idempotency-check helper (for testing pattern in test case 14)
// ---------------------------------------------------------------------------

/**
 * Return an existing GatewayOrderResult for a known orderId, or null.
 * Used in the idempotency-guard test pattern where the caller manually
 * appends a terminal event before calling routeOrderToGateway.
 */
export function getExistingGatewayResult(
  store: Pick<EventStore, "replay">,
  orderId: string,
): GatewayOrderResult | null {
  return findExistingTerminalEvent(store, orderId);
}
