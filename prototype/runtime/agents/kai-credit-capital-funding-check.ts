// runtime/agents/kai-credit-capital-funding-check.ts
//
// Kai's credit limit, capital impact, and funding headroom check handler for
// the pre-trade gateway (slice 7).
//
// Authority:
//   - RAS-B3 (counterparty credit risk appetite — single-counterparty credit limit)
//   - ORG-PR-01 (ICAAP — Internal Capital Adequacy Assessment Process)
//   - Banks Act 94/1990 Reg 38 (BA 100 capital adequacy — Pillar 1 RWA calculation)
//   - BCBS 238 (LCR — Liquidity Coverage Ratio minimum 100%)
//   - D-CREDIT-LIMIT-ENGINE-BUILD Phase 4 — credit-limit-engine wiring into
//     PROC-MK-PCG-01 Check 1(c). Replaces the prior credit-limit-stub.json
//     baseline with the live engine's `checkHeadroom`.
//   - D-S7-TARGETED-3-5-OPEN-QUESTIONS (gateway envelope v0 slice 7)
//   - Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3
//
// What this handler does:
//   On GatewayCheckRequested[credit-limit]:
//     1. Resolve the OrderProposed to recover counterparty + proposed notional.
//     2. Convert proposed notional into a credit-equivalent exposure (Money):
//          - SA-CCR-tracked products (OTC IRD, FX forwards/swaps): notional ×
//            supervisory factor. Build-phase substrate-gap fallback — replaced
//            by Rohan's @platform/risk/sa-ccr marginal RC + add-on once that
//            lands (also under D-CREDIT-LIMIT-ENGINE-BUILD Phase 4). TODO
//            tracked in pre-deal-check.ts substrate-gap block.
//          - Cash equity / cash bond / FX spot: notional treated as direct
//            credit equivalent (collateral pledging is a future slice).
//     3. Call `checkHeadroom(counterpartyId, proposedExposure)` from
//        @platform/risk/credit-limit-engine.
//     4. Emit GatewayCheckCompleted[credit-limit] approve, or reject with
//        the canonical typed `blockReason` (CounterpartyNotApproved,
//        CreditLimitExhausted, LimitExpired, AnnualReviewStale).
//
//   On GatewayCheckRequested[capital-impact]:
//     1. Compute proposed RWA = notional × RWA weight for instrument class.
//     2. Check current RWA + proposed RWA vs BA 100 RWA limit.
//     3. Emit GatewayCheckCompleted[capital-impact] approve or reject.
//
//   On GatewayCheckRequested[funding]:
//     1. Estimate LCR outflow impact from proposed notional.
//     2. Check estimated LCR post-trade vs minimum 100%.
//     3. Emit GatewayCheckCompleted[funding] approve or reject.
//
// Build-phase limitations:
//   - Capital RWA weights and LCR parameters are read from capital-funding-stub.json.
//     Production: derive from live BA 100 projection (Anya) and Eitan's LCR
//     projection (LCR ratio event, not yet built).
//   - SA-CCR add-on / RC fallback uses supervisory factors only; pivot to
//     Rohan's @platform/risk/sa-ccr once merged.
//
// Non-bypassability: only kai:pre-trade-gateway-aggregator emits
// OrderApprovedAtGateway / OrderRejectedAtGateway. This handler emits only
// GatewayCheckCompleted.
//
// Authors: Kai (Markets platform engineer, engineering) — original handler
//          Saskia (Derivatives trading desk, engineering) — credit-limit-engine wiring
//            under D-CREDIT-LIMIT-ENGINE-BUILD Phase 4

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { minor } from "../../platform/core/money";
import type { Currency } from "../../platform/core/types";
import {
  type GatewayCheckCompletedPayload,
  makeGatewayCheckCompleted,
} from "../../platform/event-store/event-types";
import type { GatewayCreditBlockReason } from "../../platform/event-store/event-types/trading";
import type { Event } from "../../platform/event-store/types";
import { type HeadroomCheckResult, checkHeadroom } from "../../platform/risk/credit-limit-engine";
import type { AgentRunContext, AgentRunOutput } from "../types";

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "agent:kai:credit-capital-funding-check",
};

const CREDIT_CITATIONS: readonly string[] = ["RAS-B3", "ORG-PR-01"];
const CAPITAL_CITATIONS: readonly string[] = ["ORG-PR-01", "RAS-B1"];
const FUNDING_CITATIONS: readonly string[] = ["ORG-PR-01"];

// ---------------------------------------------------------------------------
// SA-CCR supervisory factors — build-phase fallback used when
// @platform/risk/sa-ccr is not yet emitting CcrReplacementCostComputed for
// the counterparty. Once the SA-CCR engine lands its full PFE pipeline, the
// pre-deal-check helper in credit-limit-engine consumes RC events directly
// and these factors become inert.
//
// Factor table per BCBS 279 Table 2 (SA-CCR supervisory factors), expressed
// as fractions of notional. We use the table's most conservative tier per
// asset class so the build-phase add-on never under-states exposure.
// ---------------------------------------------------------------------------

const SA_CCR_SUPERVISORY_FACTOR: Record<string, number> = {
  "OTC-IRD": 0.005, // Interest rate, single-currency
  "FX-fwd": 0.04, // FX forwards / swaps
  "FX-swap": 0.04,
};

// ---------------------------------------------------------------------------
// Stub types — credit-limit branch now consumes the engine; this stub is
// retained only for the capital + funding branches (still pre-Anya / pre-Eitan).
// ---------------------------------------------------------------------------

interface CapitalFundingStub {
  rwa: {
    totalRwaLimitZAR: number;
    currentRwaZAR: number;
    rwaWeightByInstrumentClass: Record<string, number>;
  };
  lcr: {
    minimumLcrPct: number;
    currentLcrPct: number;
    outflowPerMillionNotionalZAR: number;
  };
}

function loadCapitalFundingStub(repoRoot: string): CapitalFundingStub {
  const stubPath = join(
    repoRoot,
    "prototype",
    "platform",
    "markets",
    "regulatory",
    "capital-funding-stub.json",
  );
  return JSON.parse(readFileSync(stubPath, "utf-8")) as CapitalFundingStub;
}

// ---------------------------------------------------------------------------
// Pre-deal exposure helpers
// ---------------------------------------------------------------------------

/**
 * Compute the credit-equivalent exposure of a proposed order in the order's
 * priced currency. Returns Money minor units.
 *
 * Build-phase rule (per D-CREDIT-LIMIT-ENGINE-BUILD Phase 4):
 *   - SA-CCR-tracked products (OTC-IRD, FX forwards/swaps): notional ×
 *     supervisory factor (BCBS 279 Table 2). TODO: pivot to Rohan's
 *     @platform/risk/sa-ccr marginal RC + add-on once that engine emits
 *     CcrReplacementCostComputed for the netting set.
 *   - Cash equity / cash bond / FX spot: notional treated as credit
 *     equivalent (collateral pledging is a future slice).
 */
function proposedCreditExposureMinor(instrument: string, quantity: number, price: number): bigint {
  const notional = quantity * price;
  const cls = instrumentClass(instrument);
  const supervisoryFactor = SA_CCR_SUPERVISORY_FACTOR[cls];
  const exposure = supervisoryFactor !== undefined ? notional * supervisoryFactor : notional;
  // Money stores minor units (cents). Round half-up to avoid silent under-
  // statement when notional × factor produces a fractional minor unit.
  const minorUnits = Math.round(exposure * 100);
  return BigInt(Math.max(0, minorUnits));
}

/**
 * Compute total RWA currently on the books (approximate — from
 * EquityTradeBooked notional × 35% default equity weight).
 * Production: use Anya's BA 100 projection directly.
 */
function computeCurrentRwaZAR(stub: CapitalFundingStub): number {
  // In the build phase, defer to the stub's currentRwaZAR baseline.
  // Production: read from the most recent BA325RwaProjectionPublished event.
  return stub.rwa.currentRwaZAR;
}

/**
 * Determine instrument class from instrument string for RWA weight lookup.
 */
function instrumentClass(instrument: string): string {
  if (
    instrument.startsWith("JSE:") ||
    instrument.startsWith("ZAE") ||
    instrument.startsWith("ZAG")
  ) {
    return "JSE-EQUITY";
  }
  if (instrument.startsWith("ZAG")) return "ZA-GOV-BOND";
  if (instrument.startsWith("FX-")) return "FX-spot";
  if (instrument.startsWith("IRS-")) return "OTC-IRD";
  if (instrument.startsWith("OTC-")) return "OTC-IRD";
  return "default";
}

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

function alreadyChecked(orderId: string, checkKind: string): boolean {
  for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
    const p = e.payload as { orderId?: unknown; checkKind?: unknown };
    if (typeof p.orderId === "string" && p.orderId === orderId && p.checkKind === checkKind) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Resolve OrderProposed from sourceOrderEventId
// ---------------------------------------------------------------------------

interface OrderDetails {
  counterpartyLei: string | null;
  instrument: string | null;
  side: string | null;
  quantity: number | null;
  price: number | null;
  priceCurrency: string | null;
}

function resolveOrder(sourceOrderEventId: string | null): OrderDetails {
  const empty: OrderDetails = {
    counterpartyLei: null,
    instrument: null,
    side: null,
    quantity: null,
    price: null,
    priceCurrency: null,
  };
  if (!sourceOrderEventId) {
    return empty;
  }
  for (const orderEvent of eventStore.replay({ type: "OrderProposed" })) {
    if (orderEvent.event_id === sourceOrderEventId) {
      const op = orderEvent.payload as {
        counterpartyLei?: unknown;
        instrument?: unknown;
        side?: unknown;
        quantity?: unknown;
        price?: unknown;
        priceCurrency?: unknown;
      };
      return {
        counterpartyLei: typeof op.counterpartyLei === "string" ? op.counterpartyLei : null,
        instrument: typeof op.instrument === "string" ? op.instrument : null,
        side: typeof op.side === "string" ? op.side : null,
        quantity: typeof op.quantity === "number" ? op.quantity : null,
        price: typeof op.price === "number" ? op.price : null,
        priceCurrency: typeof op.priceCurrency === "string" ? op.priceCurrency : null,
      };
    }
  }
  return empty;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];

  const creditRequests = triggering.filter((e): e is Event => {
    if (e.type !== "GatewayCheckRequested") return false;
    const p = e.payload as { checkKind?: unknown };
    return p.checkKind === "credit-limit";
  });
  const capitalRequests = triggering.filter((e): e is Event => {
    if (e.type !== "GatewayCheckRequested") return false;
    const p = e.payload as { checkKind?: unknown };
    return p.checkKind === "capital-impact";
  });
  const fundingRequests = triggering.filter((e): e is Event => {
    if (e.type !== "GatewayCheckRequested") return false;
    const p = e.payload as { checkKind?: unknown };
    return p.checkKind === "funding";
  });

  const totalRequests = creditRequests.length + capitalRequests.length + fundingRequests.length;

  if (totalRequests === 0) {
    return {
      eventsEmitted: 0,
      summary:
        "no GatewayCheckRequested[credit-limit|capital-impact|funding] events in triggering set; nothing to check",
      ok: true,
    };
  }

  // Load stubs once.
  const capitalFundingStub = loadCapitalFundingStub(ctx.repoRoot);

  let eventsEmitted = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  // ---------------------------------------------------------------------------
  // Credit-limit checks — wired into @platform/risk/credit-limit-engine per
  // D-CREDIT-LIMIT-ENGINE-BUILD Phase 4 and PROC-MK-PCG-01 Check 1(c).
  // ---------------------------------------------------------------------------

  for (const e of creditRequests) {
    const p = e.payload as {
      orderId?: unknown;
      sourceOrderEventId?: unknown;
      requestedAt?: unknown;
    };

    const orderId = typeof p.orderId === "string" ? p.orderId : "";
    const sourceCheckRequestEventId = e.event_id;

    if (!orderId) {
      logger.warn(
        { eventId: e.event_id },
        "kai:credit-capital-funding-check — GatewayCheckRequested[credit-limit] missing orderId; skipping",
      );
      totalSkipped += 1;
      continue;
    }

    if (alreadyChecked(orderId, "credit-limit")) {
      logger.debug(
        { orderId },
        "kai:credit-capital-funding-check — credit-limit already checked; skipping",
      );
      totalSkipped += 1;
      continue;
    }

    const sourceOrderEventId =
      typeof p.sourceOrderEventId === "string" ? p.sourceOrderEventId : null;
    const order = resolveOrder(sourceOrderEventId);

    const requestedAt = typeof p.requestedAt === "string" ? p.requestedAt : ctx.asOf;
    const durationMs = Math.max(0, new Date(ctx.asOf).getTime() - new Date(requestedAt).getTime());

    let outcome: GatewayCheckCompletedPayload["outcome"] = "approve";
    let rejectionReason: string | undefined;
    let citationToRule: string | undefined;
    let blockReason: GatewayCreditBlockReason | undefined;

    if (
      !order.counterpartyLei ||
      !order.instrument ||
      order.quantity === null ||
      order.price === null
    ) {
      outcome = "reject";
      rejectionReason =
        "Could not resolve counterpartyLei/instrument/quantity/price from OrderProposed; credit-limit check cannot proceed";
      citationToRule = "RAS-B3";
    } else if (order.side === "sell") {
      // Sell orders reduce exposure — engine call is unnecessary; admit.
    } else {
      // Build credit-equivalent exposure in the order's priced currency.
      const priceCurrency = (order.priceCurrency ?? "ZAR") as Currency;
      const proposedMinor = proposedCreditExposureMinor(
        order.instrument,
        order.quantity,
        order.price,
      );
      const proposedExposure = minor(proposedMinor, priceCurrency);

      const headroom: HeadroomCheckResult = checkHeadroom(
        order.counterpartyLei,
        proposedExposure,
        ctx.asOf,
      );

      if (!headroom.ok) {
        outcome = "reject";
        const limitMinor = headroom.limit.amount;
        const currExpMinor = headroom.currentExposure.amount;
        blockReason = headroom.blockReason;
        switch (headroom.blockReason) {
          case "CounterpartyNotApproved":
            rejectionReason = `Counterparty '${order.counterpartyLei}' has no loaded credit limit (credit-limit-engine status: not approved or not yet loaded).`;
            citationToRule = "RAS-B3";
            break;
          case "LimitExpired":
            rejectionReason = `Credit limit for counterparty '${order.counterpartyLei}' has expired (engine returned status=expired).`;
            citationToRule = "RAS-B3";
            break;
          case "AnnualReviewStale":
            rejectionReason = `Counterparty '${order.counterpartyLei}' annual review is stale (> 13 months; Credit Risk Policy §1.3, Banks Act Reg 23).`;
            citationToRule = "RAS-B3";
            break;
          default:
            rejectionReason = `Credit limit exhausted for counterparty '${order.counterpartyLei}': proposed credit-equivalent exposure ${priceCurrency} ${(Number(proposedMinor) / 100).toFixed(2)} would breach limit ${priceCurrency} ${(Number(limitMinor) / 100).toFixed(2)} (current exposure ${priceCurrency} ${(Number(currExpMinor) / 100).toFixed(2)}, utilisation ${headroom.utilisationPct.toFixed(1)}%, traffic ${headroom.traffic}).`;
            citationToRule = "RAS-B3";
            break;
        }
      }
    }

    const completedPayload: GatewayCheckCompletedPayload = {
      orderId,
      checkKind: "credit-limit",
      outcome,
      sourceCheckRequestEventId,
      completedAt: ctx.asOf,
      durationMs,
      ...(rejectionReason && citationToRule ? { rejectionReason, citationToRule } : {}),
      ...(blockReason ? { blockReason } : {}),
    };

    if (ctx.dryRun) {
      logger.debug(
        { orderId, outcome },
        "kai:credit-capital-funding-check — dry-run; would emit GatewayCheckCompleted[credit-limit]",
      );
      continue;
    }

    eventStore.append(
      makeGatewayCheckCompleted({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: HANDLER_ACTOR,
        citations: [...CREDIT_CITATIONS],
        payload: completedPayload,
      }),
    );
    eventsEmitted += 1;
    if (outcome === "reject") {
      totalFailed += 1;
      logger.info(
        { orderId, rejectionReason },
        "kai:credit-capital-funding-check — credit-limit check FAILED",
      );
    } else {
      totalPassed += 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Capital-impact checks
  // ---------------------------------------------------------------------------

  const currentRwaZAR = computeCurrentRwaZAR(capitalFundingStub);

  for (const e of capitalRequests) {
    const p = e.payload as {
      orderId?: unknown;
      sourceOrderEventId?: unknown;
      requestedAt?: unknown;
    };

    const orderId = typeof p.orderId === "string" ? p.orderId : "";
    const sourceCheckRequestEventId = e.event_id;

    if (!orderId) {
      logger.warn(
        { eventId: e.event_id },
        "kai:credit-capital-funding-check — GatewayCheckRequested[capital-impact] missing orderId; skipping",
      );
      totalSkipped += 1;
      continue;
    }

    if (alreadyChecked(orderId, "capital-impact")) {
      logger.debug(
        { orderId },
        "kai:credit-capital-funding-check — capital-impact already checked; skipping",
      );
      totalSkipped += 1;
      continue;
    }

    const sourceOrderEventId =
      typeof p.sourceOrderEventId === "string" ? p.sourceOrderEventId : null;
    const order = resolveOrder(sourceOrderEventId);

    const requestedAt = typeof p.requestedAt === "string" ? p.requestedAt : ctx.asOf;
    const durationMs = Math.max(0, new Date(ctx.asOf).getTime() - new Date(requestedAt).getTime());

    let outcome: GatewayCheckCompletedPayload["outcome"] = "approve";
    let rejectionReason: string | undefined;
    let citationToRule: string | undefined;

    if (!order.instrument || order.quantity === null || order.price === null) {
      outcome = "reject";
      rejectionReason =
        "Could not resolve instrument/quantity/price from OrderProposed; capital-impact check cannot proceed";
      citationToRule = "ORG-PR-01";
    } else if (order.side !== "sell") {
      const proposedNotionalZAR = order.price * order.quantity;
      const instClass = instrumentClass(order.instrument);
      const rwaWeightByClass = capitalFundingStub.rwa.rwaWeightByInstrumentClass;
      const rwaWeight = rwaWeightByClass[instClass] ?? rwaWeightByClass.default ?? 0.35;

      const proposedRwaZAR = proposedNotionalZAR * rwaWeight;
      const proFormaRwaZAR = currentRwaZAR + proposedRwaZAR;

      if (proFormaRwaZAR > capitalFundingStub.rwa.totalRwaLimitZAR) {
        outcome = "reject";
        rejectionReason =
          `Capital RWA limit breached: pro-forma RWA ZAR ${proFormaRwaZAR.toFixed(0)} ` +
          `exceeds BA 100 limit ZAR ${capitalFundingStub.rwa.totalRwaLimitZAR.toFixed(0)} ` +
          `(current RWA ZAR ${currentRwaZAR.toFixed(0)}, ` +
          `proposed add ZAR ${proposedRwaZAR.toFixed(0)} at RWA weight ${rwaWeight} for ${instClass}).`;
        citationToRule = "ORG-PR-01";
      }
    }

    const completedPayload: GatewayCheckCompletedPayload = {
      orderId,
      checkKind: "capital-impact",
      outcome,
      sourceCheckRequestEventId,
      completedAt: ctx.asOf,
      durationMs,
      ...(rejectionReason && citationToRule ? { rejectionReason, citationToRule } : {}),
    };

    if (ctx.dryRun) {
      logger.debug(
        { orderId, outcome },
        "kai:credit-capital-funding-check — dry-run; would emit GatewayCheckCompleted[capital-impact]",
      );
      continue;
    }

    eventStore.append(
      makeGatewayCheckCompleted({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: HANDLER_ACTOR,
        citations: [...CAPITAL_CITATIONS],
        payload: completedPayload,
      }),
    );
    eventsEmitted += 1;
    if (outcome === "reject") {
      totalFailed += 1;
      logger.info(
        { orderId, rejectionReason },
        "kai:credit-capital-funding-check — capital-impact check FAILED",
      );
    } else {
      totalPassed += 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Funding (LCR) checks
  // ---------------------------------------------------------------------------

  for (const e of fundingRequests) {
    const p = e.payload as {
      orderId?: unknown;
      sourceOrderEventId?: unknown;
      requestedAt?: unknown;
    };

    const orderId = typeof p.orderId === "string" ? p.orderId : "";
    const sourceCheckRequestEventId = e.event_id;

    if (!orderId) {
      logger.warn(
        { eventId: e.event_id },
        "kai:credit-capital-funding-check — GatewayCheckRequested[funding] missing orderId; skipping",
      );
      totalSkipped += 1;
      continue;
    }

    if (alreadyChecked(orderId, "funding")) {
      logger.debug(
        { orderId },
        "kai:credit-capital-funding-check — funding already checked; skipping",
      );
      totalSkipped += 1;
      continue;
    }

    const sourceOrderEventId =
      typeof p.sourceOrderEventId === "string" ? p.sourceOrderEventId : null;
    const order = resolveOrder(sourceOrderEventId);

    const requestedAt = typeof p.requestedAt === "string" ? p.requestedAt : ctx.asOf;
    const durationMs = Math.max(0, new Date(ctx.asOf).getTime() - new Date(requestedAt).getTime());

    let outcome: GatewayCheckCompletedPayload["outcome"] = "approve";
    let rejectionReason: string | undefined;
    let citationToRule: string | undefined;

    if (order.quantity === null || order.price === null) {
      outcome = "reject";
      rejectionReason =
        "Could not resolve quantity/price from OrderProposed; funding check cannot proceed";
      citationToRule = "ORG-PR-01";
    } else if (order.side !== "sell") {
      const proposedNotionalZAR = order.price * order.quantity;
      // Estimate LCR outflow: outflowPerMillionNotionalZAR per million of notional.
      const lcrOutflowPct =
        (proposedNotionalZAR / 1_000_000) * capitalFundingStub.lcr.outflowPerMillionNotionalZAR;
      const postTradeLcrPct = capitalFundingStub.lcr.currentLcrPct - lcrOutflowPct;

      if (postTradeLcrPct < capitalFundingStub.lcr.minimumLcrPct) {
        outcome = "reject";
        rejectionReason =
          `LCR headroom insufficient: estimated post-trade LCR ${postTradeLcrPct.toFixed(1)}% ` +
          `falls below minimum ${capitalFundingStub.lcr.minimumLcrPct}% ` +
          `(current LCR ${capitalFundingStub.lcr.currentLcrPct}%, ` +
          `estimated outflow impact ${lcrOutflowPct.toFixed(2)}% for ` +
          `notional ZAR ${proposedNotionalZAR.toFixed(0)}).`;
        citationToRule = "ORG-PR-01";
      }
    }

    const completedPayload: GatewayCheckCompletedPayload = {
      orderId,
      checkKind: "funding",
      outcome,
      sourceCheckRequestEventId,
      completedAt: ctx.asOf,
      durationMs,
      ...(rejectionReason && citationToRule ? { rejectionReason, citationToRule } : {}),
    };

    if (ctx.dryRun) {
      logger.debug(
        { orderId, outcome },
        "kai:credit-capital-funding-check — dry-run; would emit GatewayCheckCompleted[funding]",
      );
      continue;
    }

    eventStore.append(
      makeGatewayCheckCompleted({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: HANDLER_ACTOR,
        citations: [...FUNDING_CITATIONS],
        payload: completedPayload,
      }),
    );
    eventsEmitted += 1;
    if (outcome === "reject") {
      totalFailed += 1;
      logger.info(
        { orderId, rejectionReason },
        "kai:credit-capital-funding-check — funding check FAILED",
      );
    } else {
      totalPassed += 1;
    }
  }

  logger.info(
    {
      creditRequests: creditRequests.length,
      capitalRequests: capitalRequests.length,
      fundingRequests: fundingRequests.length,
      totalPassed,
      totalFailed,
      totalSkipped,
      eventsEmitted,
    },
    "kai:credit-capital-funding-check — done",
  );

  return {
    eventsEmitted,
    summary:
      `${creditRequests.length} credit-limit, ${capitalRequests.length} capital-impact, ` +
      `${fundingRequests.length} funding checks: ` +
      `${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped.`,
    ok: true,
  };
};

export default handler;
