// runtime/agents/rohan-conduct-risk-events.ts
//
// Rohan's conduct risk events handler — M3 Slice 9.
//
// Triggers on FxTradeExecuted (and extensible to other trade events).
// For each trade event, evaluates:
//   1. Best execution — was the execution rate within spread tolerance of the
//      reference market rate? Emits BestExecutionVerified or BestExecutionBreached.
//   2. FAIS suitability — checks the counterparty's FAIS classification from
//      CounterpartyFaisClassified events; emits FaisClassificationSuitabilityChecked.
//   3. Conflict of interest — emits ConflictOfInterestDisclosed for principal
//      trades with institutional counterparties (bank acts as risk taker).
//
// Idempotency: each check skips if its typed output event for (tradeId,
// checkKind) already exists in the event store.
//
// Build-phase limitations:
//   - Best-execution tolerance values are fixed constants; production will
//     drive them from a published BestExecutionPolicySchedule event.
//   - FAIS suitability rules are simplified (professional-client and
//     market-counterparty can trade all products; retail-client is not
//     in scope for this bank at licence-day per D-FAIS-SCOPE).
//   - Reference rates default to the FX leg rate when no external benchmark
//     is available (spread = 0 bps when only one price source exists).
//
// Authority:
//   FAIS Act 37/2002 §§16–17 (best execution obligation);
//   FAIS Act 37/2002 §8D (product suitability);
//   Financial Markets Act 19 of 2012 §§78–82 (market abuse);
//   FSRA §131 (FSCA conduct mandate);
//   D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md; Principles/6-autonomous-by-default.md.
//
// Author: Rohan (Quant Risk Engineer, markets)

import { eventStore, logger } from "../../platform/composition";
import {
  makeBestExecutionBreached,
  makeBestExecutionVerified,
  makeConductObligationFlagged,
  makeConflictOfInterestDisclosed,
  makeFaisClassificationSuitabilityChecked,
} from "../../platform/event-store/event-types";
import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";

// ---------------------------------------------------------------------------
// Handler actor + citations
// ---------------------------------------------------------------------------

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "agent:rohan:conduct-risk-events",
};

const CONDUCT_CITATIONS: readonly string[] = [
  "FAIS-ACT-37-2002",
  "D-MARKET-CONDUCT",
  "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
];

const ENTITY = "LE-ZA-HOZ-BANK";

// ---------------------------------------------------------------------------
// Best-execution tolerance schedule (build-phase stub)
//
// Tolerance in basis points (bps) per asset class.
// Production: derive from BestExecutionPolicySchedule event.
//
// 1 bps = 0.0001 of the rate; e.g. for USDZAR at 18.50, 10 bps = 0.0185.
// ---------------------------------------------------------------------------

const BE_TOLERANCE_BY_ASSET_CLASS: Record<string, number> = {
  "FX-spot": 10, // 10 bps for FX spot
  "FX-forward": 15, // 15 bps for FX forward (wider for term risk)
  "FX-swap": 20, // 20 bps for FX swap (near + far legs)
  NDF: 25, // 25 bps for NDF (EM currency basis)
  "ZA-GOV-BOND": 5, // 5 bps for SA government bonds
  "JSE-EQUITY": 15, // 15 bps for JSE equities
  "IRS-ZAR": 20, // 20 bps for ZAR interest-rate swaps
  default: 20, // fallback tolerance for unlisted asset classes
};

function getToleranceBps(assetClass: string): number {
  return BE_TOLERANCE_BY_ASSET_CLASS[assetClass] ?? BE_TOLERANCE_BY_ASSET_CLASS.default ?? 20;
}

// ---------------------------------------------------------------------------
// FAIS suitability rules (build-phase stub)
//
// The bank is an institutional-only venue (D-FAIS-SCOPE).
// "retail-client" trades are flagged as unsuitable — they should never
// appear at this bank; their presence is itself a conduct finding.
// ---------------------------------------------------------------------------

function isSuitableForFaisCategory(
  faisCategory: "professional-client" | "retail-client" | "market-counterparty",
  _productCode: string,
): { suitable: boolean; reason?: string } {
  if (faisCategory === "retail-client") {
    return {
      suitable: false,
      reason:
        "Retail-client counterparty: this bank is an institutional-only venue; " +
        "retail-client trades are not in scope (D-FAIS-SCOPE). " +
        "Trade requires immediate review by Mira (Compliance / RegTech engineer).",
    };
  }
  // professional-client and market-counterparty can trade all in-scope products.
  return { suitable: true };
}

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

/** True if BestExecutionVerified for tradeId already exists. */
function bestExecutionVerifiedExists(tradeId: string): boolean {
  for (const e of eventStore.replay({ type: "BestExecutionVerified" })) {
    const p = e.payload as { tradeId?: unknown };
    if (p.tradeId === tradeId) return true;
  }
  return false;
}

/** True if BestExecutionBreached for tradeId already exists. */
function bestExecutionBreachedExists(tradeId: string): boolean {
  for (const e of eventStore.replay({ type: "BestExecutionBreached" })) {
    const p = e.payload as { tradeId?: unknown };
    if (p.tradeId === tradeId) return true;
  }
  return false;
}

/** True if FaisClassificationSuitabilityChecked for tradeId already exists. */
function faisSuitabilityCheckedExists(tradeId: string): boolean {
  for (const e of eventStore.replay({ type: "FaisClassificationSuitabilityChecked" })) {
    const p = e.payload as { tradeId?: unknown };
    if (p.tradeId === tradeId) return true;
  }
  return false;
}

/** True if ConflictOfInterestDisclosed for tradeId already exists. */
function conflictDisclosedExists(tradeId: string): boolean {
  for (const e of eventStore.replay({ type: "ConflictOfInterestDisclosed" })) {
    const p = e.payload as { tradeId?: unknown };
    if (p.tradeId === tradeId) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// FAIS classification lookup
//
// Looks up the most recent CounterpartyFaisClassified event for a given
// counterparty ID in the event store.
// ---------------------------------------------------------------------------

type FaisCategory = "professional-client" | "retail-client" | "market-counterparty";

function lookupFaisCategory(counterpartyId: string): FaisCategory | null {
  let latest: FaisCategory | null = null;
  for (const e of eventStore.replay({ type: "CounterpartyFaisClassified" })) {
    const p = e.payload as { counterpartyId?: unknown; faisCategory?: unknown };
    if (p.counterpartyId === counterpartyId) {
      const cat = p.faisCategory;
      if (
        cat === "professional-client" ||
        cat === "retail-client" ||
        cat === "market-counterparty"
      ) {
        latest = cat; // last event wins (most recent classification)
      }
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Per-trade conduct risk evaluation
// ---------------------------------------------------------------------------

interface FxTradePayload {
  tradeId?: { id?: unknown };
  counterparty?: { id?: unknown };
  productTaxonomy?: unknown;
  legs?: Array<{ rate?: { amount?: unknown }; notional?: { amountMinor?: unknown }; legKind?: unknown }>;
  bookType?: unknown;
  trader?: unknown;
  venue?: unknown;
}

interface TradeEvaluationResult {
  eventsEmitted: number;
}

async function evaluateFxTrade(
  trade: Event,
  ctx: AgentRunContext,
): Promise<TradeEvaluationResult> {
  let eventsEmitted = 0;
  const p = trade.payload as FxTradePayload;

  const tradeIdRaw = p.tradeId?.id;
  const tradeId = typeof tradeIdRaw === "string" ? tradeIdRaw : trade.event_id;
  const counterpartyId =
    typeof p.counterparty?.id === "string" ? p.counterparty.id : undefined;
  const productTaxonomy =
    typeof p.productTaxonomy === "string" ? p.productTaxonomy : "FX-spot";
  const bookType = typeof p.bookType === "string" ? p.bookType : "trading";

  // Extract near-leg rate for best-execution reference.
  const nearLeg = Array.isArray(p.legs) ? p.legs.find((l) => l.legKind === "near") : undefined;
  const executedRate =
    typeof nearLeg?.rate?.amount === "number" ? nearLeg.rate.amount : null;

  // ---------------------------------------------------------------------------
  // 1. Best-execution check
  // ---------------------------------------------------------------------------

  const beAlreadyDone =
    bestExecutionVerifiedExists(tradeId) || bestExecutionBreachedExists(tradeId);

  if (!beAlreadyDone && executedRate !== null) {
    // Reference rate: in build-phase, use the executed rate as reference
    // (zero spread) unless a synthetic test payload provides a `referenceRate`
    // field on the trade. In production, the reference would come from an
    // FTP curve or benchmark feed.
    const refRateField = (trade.payload as Record<string, unknown>).referenceRate;
    const referenceRate =
      typeof refRateField === "number" ? refRateField : executedRate;

    // Compute spread in bps. For FX: (executed / reference - 1) * 10000.
    // This gives a signed bps delta; positive = client paid more than reference.
    const spreadBps =
      referenceRate !== 0
        ? Math.round(((executedRate - referenceRate) / referenceRate) * 10000 * 100) / 100
        : 0;

    const toleranceBps = getToleranceBps(productTaxonomy);
    const isBreached = Math.abs(spreadBps) > toleranceBps;

    if (!ctx.dryRun) {
      if (isBreached) {
        eventStore.append(
          makeBestExecutionBreached({
            asOf: ctx.asOf,
            entity: ENTITY,
            actor: HANDLER_ACTOR,
            citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S16"],
            payload: {
              tradeId,
              detectedAt: ctx.asOf,
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

        // Also emit a generic obligation flag at "breach" severity.
        eventStore.append(
          makeConductObligationFlagged({
            asOf: ctx.asOf,
            entity: ENTITY,
            actor: HANDLER_ACTOR,
            citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S16"],
            payload: {
              tradeId,
              evaluatedAt: ctx.asOf,
              obligationCode: "best-execution",
              reason: `Best execution breach: spread ${spreadBps.toFixed(2)} bps exceeds tolerance ${toleranceBps} bps for ${productTaxonomy}`,
              severity: Math.abs(spreadBps) > toleranceBps * 2 ? "breach" : "warning",
              ...(counterpartyId ? { counterpartyId } : {}),
            },
          }),
        );
        eventsEmitted += 1;
      } else {
        eventStore.append(
          makeBestExecutionVerified({
            asOf: ctx.asOf,
            entity: ENTITY,
            actor: HANDLER_ACTOR,
            citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S16"],
            payload: {
              tradeId,
              verifiedAt: ctx.asOf,
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
    } else {
      logger.debug(
        { tradeId, spreadBps, toleranceBps, isBreached },
        "rohan:conduct-risk-events — dry-run; would emit best-execution event",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 2. FAIS suitability check
  // ---------------------------------------------------------------------------

  if (!faisSuitabilityCheckedExists(tradeId) && counterpartyId) {
    const faisCategory = lookupFaisCategory(counterpartyId);

    if (faisCategory !== null) {
      const { suitable, reason } = isSuitableForFaisCategory(faisCategory, productTaxonomy);

      if (!ctx.dryRun) {
        eventStore.append(
          makeFaisClassificationSuitabilityChecked({
            asOf: ctx.asOf,
            entity: ENTITY,
            actor: HANDLER_ACTOR,
            citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S8D"],
            payload: {
              tradeId,
              checkedAt: ctx.asOf,
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
          // Flag as a conduct obligation breach.
          eventStore.append(
            makeConductObligationFlagged({
              asOf: ctx.asOf,
              entity: ENTITY,
              actor: HANDLER_ACTOR,
              citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S8D"],
              payload: {
                tradeId,
                evaluatedAt: ctx.asOf,
                obligationCode: "fais-suitability",
                reason: reason ?? "FAIS suitability check failed",
                severity: "breach",
                counterpartyId,
              },
            }),
          );
          eventsEmitted += 1;
        }
      } else {
        logger.debug(
          { tradeId, counterpartyId, faisCategory, suitable },
          "rohan:conduct-risk-events — dry-run; would emit FaisClassificationSuitabilityChecked",
        );
      }
    } else {
      logger.warn(
        { tradeId, counterpartyId },
        "rohan:conduct-risk-events — no CounterpartyFaisClassified found for counterparty; skipping FAIS suitability check",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Conflict-of-interest disclosure (principal trades with counterparties)
  // ---------------------------------------------------------------------------

  if (!conflictDisclosedExists(tradeId) && counterpartyId) {
    // The bank acts as principal on all trading-book positions by default.
    // The conflict exists when the bank has a proprietary interest in the
    // price outcome (trading-book bookType) while acting as the sole
    // liquidity provider to the counterparty.
    const conflictExists = bookType === "trading";

    if (!ctx.dryRun) {
      eventStore.append(
        makeConflictOfInterestDisclosed({
          asOf: ctx.asOf,
          entity: ENTITY,
          actor: HANDLER_ACTOR,
          citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S4"],
          payload: {
            tradeId,
            disclosedAt: ctx.asOf,
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
    } else {
      logger.debug(
        { tradeId, bookType, conflictExists },
        "rohan:conduct-risk-events — dry-run; would emit ConflictOfInterestDisclosed",
      );
    }
  }

  return { eventsEmitted };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];

  const fxTrades = triggering.filter((e): e is Event => e.type === "FxTradeExecuted");

  if (fxTrades.length === 0) {
    return {
      eventsEmitted: 0,
      summary:
        "no FxTradeExecuted events in triggering set; no conduct risk evaluation to perform",
      ok: true,
    };
  }

  let totalEventsEmitted = 0;
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const trade of fxTrades) {
    const p = trade.payload as FxTradePayload;
    const tradeIdRaw = p.tradeId?.id;
    const tradeId = typeof tradeIdRaw === "string" ? tradeIdRaw : trade.event_id;

    try {
      const result = await evaluateFxTrade(trade, ctx);
      totalEventsEmitted += result.eventsEmitted;
      if (result.eventsEmitted > 0 || ctx.dryRun) {
        processed += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      logger.error(
        { tradeId, err: (err as Error).message },
        "rohan:conduct-risk-events — error evaluating trade; continuing",
      );
      errors += 1;
    }
  }

  logger.info(
    {
      fxTrades: fxTrades.length,
      processed,
      skipped,
      errors,
      eventsEmitted: totalEventsEmitted,
    },
    "rohan:conduct-risk-events — done",
  );

  return {
    eventsEmitted: totalEventsEmitted,
    summary:
      `${fxTrades.length} FX trade(s): ${processed} processed, ${skipped} skipped (idempotent), ` +
      `${errors} errors. ${totalEventsEmitted} conduct risk events emitted.`,
    ok: errors === 0,
  };
};

export default handler;
