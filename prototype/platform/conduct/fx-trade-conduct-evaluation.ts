// platform/conduct/fx-trade-conduct-evaluation.ts
//
// Shared, store-driven FX-trade conduct evaluation core.
//
// ## Why this module exists (FX conduct surveillance wiring, 2026-06-11)
//
// The conduct surveillance logic was previously inlined in the event-driven
// handler `runtime/agents/rohan-conduct-risk-events.ts`. That handler is
// dispatched only when an `FxTradeExecuted` event is appended *during an agent
// run* (the run-coupled bus tick in `runtime/run.ts` only walks events emitted
// in the run's own sequence window), or when the standalone `bus:tick` cursor
// happens to advance over the event. The 44 institutional FX trades on the
// canonical book were emitted by the operator / pre-trade-gateway booking path
// (`dashboard/markets-fx-trade.ts → store.append`), which is NOT an agent run
// and does not tick the bus — so 43 of 44 were never considered, and the one
// that was produced no durable, real-trade surveillance. Net: best-execution
// verification and FAIS-suitability surveillance never fired on the live book.
//
// The fix (matching the BA310/BA300 period-close pattern, which fires reliably
// because its trigger event is emitted *inside* an agent run): a store-scanning
// surveillance sweep that finds every FxTradeExecuted lacking a surveillance
// outcome and evaluates it — decoupling surveillance from bus fan-out timing.
//
// This module holds the PURE per-trade evaluation extracted from the original
// handler. Both the original event-driven handler and the new sweep
// (`fx-conduct-surveillance-sweep.ts`) call it, so the surveillance verdicts
// cannot drift between the two dispatch paths.
//
// Events-first (Principle 1): surveillance outcomes are events-of-record. No
// hardcoded verdicts; idempotent per (tradeId, checkKind).
//
// Conduct posture (CCO, Zara, 2026-06-11): the bank is an institutional /
// professional-only venue (D-FAIS-SCOPE; D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL).
// FAIS appropriateness/suitability is therefore lighter than retail — a
// market-counterparty / professional-client can transact every in-scope FX
// product — BUT the FAIS §16 best-execution / TCF duty still binds on every
// trade, and a retail-client counterparty (which must never appear here) is a
// conduct finding. The surveillance fires the suitability check as a positive,
// recorded control rather than a silent approve-always: the
// FaisClassificationSuitabilityChecked event-of-record IS the discharge of the
// obligation.
//
// Authority:
//   FAIS Act 37/2002 §§16–17 (best execution obligation);
//   FAIS Act 37/2002 §8D (product suitability);
//   FAIS Act 37/2002 §4 (conflict-of-interest disclosure);
//   Financial Markets Act 19 of 2012 §§78–82 (market abuse);
//   FSRA §131 (FSCA conduct mandate);
//   D-MARKET-CONDUCT; D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH;
//   D-FAIS-SCOPE; Principles/1-events-are-truth.md; Principles/6-autonomous-by-default.md.
//
// Author: Zara (Chief Compliance Officer, governance) — conduct posture +
//   surveillance wiring; on Rohan's (Markets risk/quant engineer, engineering)
//   conduct-risk evaluation logic.

import {
  makeBestExecutionBreached,
  makeBestExecutionVerified,
  makeConductObligationFlagged,
  makeConflictOfInterestDisclosed,
  makeFaisClassificationSuitabilityChecked,
} from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Event } from "../event-store/types";

// ---------------------------------------------------------------------------
// Handler actor + citations
// ---------------------------------------------------------------------------

/** Stable surveillance actor id. Kept identical to the original handler so
 *  historical and swept events share one provenance lineage. */
export const CONDUCT_SURVEILLANCE_ACTOR = {
  type: "service" as const,
  id: "agent:rohan:conduct-risk-events",
};

export const CONDUCT_CITATIONS: readonly string[] = [
  "FAIS-ACT-37-2002",
  "D-MARKET-CONDUCT",
  "D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH",
];

const ENTITY = "LE-ZA-HOZ-BANK";

// ---------------------------------------------------------------------------
// Best-execution tolerance schedule (build-phase stub)
//
// Tolerance in basis points (bps) per asset class. Production: derive from a
// published BestExecutionPolicySchedule event (tracked deferred gap
// fx-best-execution-policy-schedule).
// ---------------------------------------------------------------------------

const BE_TOLERANCE_BY_ASSET_CLASS: Record<string, number> = {
  "FX-spot": 10,
  "FX-forward": 15,
  "FX-swap": 20,
  NDF: 25,
  "ZA-GOV-BOND": 5,
  "JSE-EQUITY": 15,
  "IRS-ZAR": 20,
  default: 20,
};

function getToleranceBps(assetClass: string): number {
  return BE_TOLERANCE_BY_ASSET_CLASS[assetClass] ?? BE_TOLERANCE_BY_ASSET_CLASS.default ?? 20;
}

// ---------------------------------------------------------------------------
// FAIS suitability rules (build-phase — D-FAIS-SCOPE)
//
// Institutional / professional-only venue. A retail-client counterparty must
// never appear; its presence is itself a conduct finding.
// ---------------------------------------------------------------------------

export type FaisCategory = "professional-client" | "retail-client" | "market-counterparty";

function isSuitableForFaisCategory(
  faisCategory: FaisCategory,
  _productCode: string,
): { suitable: boolean; reason?: string } {
  if (faisCategory === "retail-client") {
    return {
      suitable: false,
      reason:
        "Retail-client counterparty: this bank is an institutional / professional-only venue; " +
        "retail-client trades are not in scope (D-FAIS-SCOPE). " +
        "Trade requires immediate review by Zara (Chief Compliance Officer, governance).",
    };
  }
  // professional-client and market-counterparty can trade all in-scope products.
  return { suitable: true };
}

// ---------------------------------------------------------------------------
// Idempotency helpers — keyed on (tradeId, output type) against the store.
// ---------------------------------------------------------------------------

function outputExistsForTrade(
  store: EventStore,
  type: string,
  tradeId: string,
): boolean {
  for (const e of store.replay({ type })) {
    const p = e.payload as { tradeId?: unknown };
    if (p.tradeId === tradeId) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// FAIS classification lookup — latest CounterpartyFaisClassified wins.
// ---------------------------------------------------------------------------

export function lookupFaisCategory(
  store: Pick<EventStore, "replay">,
  counterpartyId: string,
): FaisCategory | null {
  let latest: FaisCategory | null = null;
  for (const e of store.replay({ type: "CounterpartyFaisClassified" })) {
    const p = e.payload as { counterpartyId?: unknown; faisCategory?: unknown };
    if (p.counterpartyId === counterpartyId) {
      const cat = p.faisCategory;
      if (
        cat === "professional-client" ||
        cat === "retail-client" ||
        cat === "market-counterparty"
      ) {
        latest = cat;
      }
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Trade payload shape (CDM FX)
// ---------------------------------------------------------------------------

interface FxTradePayload {
  tradeId?: { scheme?: unknown; value?: unknown; id?: unknown };
  counterparty?: { partyId?: unknown; id?: unknown };
  productTaxonomy?: unknown;
  legs?: Array<{
    rate?: { amount?: unknown };
    notional?: { amountMinor?: unknown };
    legKind?: unknown;
  }>;
  bookType?: unknown;
  trader?: unknown;
  venue?: unknown;
}

export interface ConductEvaluationResult {
  readonly eventsEmitted: number;
  readonly faisSkippedUnclassified: boolean;
  readonly tradeId: string;
}

export interface EvaluateOptions {
  /** ISO timestamp recorded on the emitted surveillance events. */
  readonly asOf: string;
  /** When true, compute but do not append. */
  readonly dryRun: boolean;
}

/**
 * Evaluate one FxTradeExecuted event against the store and append the
 * surveillance outcomes (best-execution, FAIS-suitability, conflict-of-interest).
 * Pure of any composition singleton — the store is passed explicitly so the same
 * core runs in the event-driven handler, the scheduled sweep, and tests.
 *
 * Idempotent: each check skips if its typed output for the tradeId already
 * exists in `store`.
 */
export function evaluateFxTradeConduct(
  store: EventStore,
  trade: Event,
  opts: EvaluateOptions,
): ConductEvaluationResult {
  let eventsEmitted = 0;
  let faisSkippedUnclassified = false;
  const p = trade.payload as FxTradePayload;

  const tradeIdFromPayload = p.tradeId?.value ?? p.tradeId?.id;
  const tradeId = typeof tradeIdFromPayload === "string" ? tradeIdFromPayload : trade.event_id;

  const counterpartyIdRaw = p.counterparty?.partyId ?? p.counterparty?.id;
  const counterpartyId = typeof counterpartyIdRaw === "string" ? counterpartyIdRaw : undefined;
  const productTaxonomy = typeof p.productTaxonomy === "string" ? p.productTaxonomy : "FX-spot";
  const bookType: string = typeof p.bookType === "string" ? p.bookType : "trading";

  const nearLeg = Array.isArray(p.legs) ? p.legs.find((l) => l.legKind === "near") : undefined;
  const executedRate = typeof nearLeg?.rate?.amount === "number" ? nearLeg.rate.amount : null;

  // -------------------------------------------------------------------------
  // 1. Best-execution check (FAIS §16 — binds on every trade regardless of
  //    counterparty category; the TCF best-execution duty is scope-invariant).
  // -------------------------------------------------------------------------

  const beAlreadyDone =
    outputExistsForTrade(store, "BestExecutionVerified", tradeId) ||
    outputExistsForTrade(store, "BestExecutionBreached", tradeId);

  if (!beAlreadyDone && executedRate !== null) {
    const refRateField = (trade.payload as Record<string, unknown>).referenceRate;
    const referenceRate = typeof refRateField === "number" ? refRateField : executedRate;

    const spreadBps =
      referenceRate !== 0
        ? Math.round(((executedRate - referenceRate) / referenceRate) * 10000 * 100) / 100
        : 0;

    const toleranceBps = getToleranceBps(productTaxonomy);
    const isBreached = Math.abs(spreadBps) > toleranceBps;

    if (!opts.dryRun) {
      if (isBreached) {
        store.append(
          makeBestExecutionBreached({
            asOf: opts.asOf,
            entity: ENTITY,
            actor: CONDUCT_SURVEILLANCE_ACTOR,
            citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S16"],
            payload: {
              tradeId,
              detectedAt: opts.asOf,
              assetClass: productTaxonomy,
              venue: typeof p.venue === "string" ? p.venue : "OTC",
              executedRate,
              referenceRate,
              spreadBps,
              toleranceBps,
              ...(counterpartyId ? { counterpartyId } : {}),
              remedialCommunicationRequired: Math.abs(spreadBps) > toleranceBps * 2,
            },
          }),
        );
        eventsEmitted += 1;

        store.append(
          makeConductObligationFlagged({
            asOf: opts.asOf,
            entity: ENTITY,
            actor: CONDUCT_SURVEILLANCE_ACTOR,
            citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S16"],
            payload: {
              tradeId,
              evaluatedAt: opts.asOf,
              obligationCode: "best-execution",
              reason: `Best execution breach: spread ${spreadBps.toFixed(2)} bps exceeds tolerance ${toleranceBps} bps for ${productTaxonomy}`,
              severity: Math.abs(spreadBps) > toleranceBps * 2 ? "breach" : "warning",
              ...(counterpartyId ? { counterpartyId } : {}),
            },
          }),
        );
        eventsEmitted += 1;
      } else {
        store.append(
          makeBestExecutionVerified({
            asOf: opts.asOf,
            entity: ENTITY,
            actor: CONDUCT_SURVEILLANCE_ACTOR,
            citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S16"],
            payload: {
              tradeId,
              verifiedAt: opts.asOf,
              assetClass: productTaxonomy,
              venue: typeof p.venue === "string" ? p.venue : "OTC",
              executedRate,
              referenceRate,
              spreadBps,
              toleranceBps,
            },
          }),
        );
        eventsEmitted += 1;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. FAIS suitability check (FAIS §8D). Fires only when the counterparty is
  //    classified; an unclassified counterparty is reported (not silently
  //    approved) so the residual is visible.
  // -------------------------------------------------------------------------

  if (!outputExistsForTrade(store, "FaisClassificationSuitabilityChecked", tradeId) && counterpartyId) {
    const faisCategory = lookupFaisCategory(store, counterpartyId);

    if (faisCategory !== null) {
      const { suitable, reason } = isSuitableForFaisCategory(faisCategory, productTaxonomy);

      if (!opts.dryRun) {
        store.append(
          makeFaisClassificationSuitabilityChecked({
            asOf: opts.asOf,
            entity: ENTITY,
            actor: CONDUCT_SURVEILLANCE_ACTOR,
            citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S8D"],
            payload: {
              tradeId,
              checkedAt: opts.asOf,
              counterpartyFaisCategory: faisCategory,
              productCode: productTaxonomy,
              suitable,
              counterpartyId,
              ...(reason ? { reason } : {}),
            },
          }),
        );
        eventsEmitted += 1;

        if (!suitable) {
          store.append(
            makeConductObligationFlagged({
              asOf: opts.asOf,
              entity: ENTITY,
              actor: CONDUCT_SURVEILLANCE_ACTOR,
              citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S8D"],
              payload: {
                tradeId,
                evaluatedAt: opts.asOf,
                obligationCode: "fais-suitability",
                reason: reason ?? "FAIS suitability check failed",
                severity: "breach",
                counterpartyId,
              },
            }),
          );
          eventsEmitted += 1;
        }
      }
    } else {
      faisSkippedUnclassified = true;
    }
  }

  // -------------------------------------------------------------------------
  // 3. Conflict-of-interest disclosure (principal trades with counterparties).
  // -------------------------------------------------------------------------

  if (!outputExistsForTrade(store, "ConflictOfInterestDisclosed", tradeId) && counterpartyId) {
    const conflictExists = bookType === "trading";

    if (!opts.dryRun) {
      store.append(
        makeConflictOfInterestDisclosed({
          asOf: opts.asOf,
          entity: ENTITY,
          actor: CONDUCT_SURVEILLANCE_ACTOR,
          citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S4"],
          payload: {
            tradeId,
            disclosedAt: opts.asOf,
            bankRole: "principal",
            conflictExists,
            ...(conflictExists
              ? {
                  conflictDescription:
                    "Bank acts as principal (trading-book): proprietary interest in execution price " +
                    "may conflict with duty to counterparty. Best-execution policy applies (FAIS §16).",
                }
              : {}),
            disclosureChannel: "system-generated",
            counterpartyId,
          },
        }),
      );
      eventsEmitted += 1;
    }
  }

  return { eventsEmitted, faisSkippedUnclassified, tradeId };
}
