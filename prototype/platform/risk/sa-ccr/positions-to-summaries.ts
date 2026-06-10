// platform/risk/sa-ccr/positions-to-summaries.ts
//
// Drives SA-CCR over the bank's LIVE FX positions: maps open FxTradeExecuted
// trades to SA-CCR `TradeSummary` rows (CRE52 asset-class / direction / maturity),
// groups them per netting set (NS-<counterpartyId>-ZAR), and calls
// `computeAndEmitFor` to emit `CcrReplacementCostComputed` + `CcrEadComputed`.
//
// This is the production driver that was missing — SA-CCR computed but never ran.
// Build-phase: netting sets are registered as build-phase-fixture ISDA/CSA
// assessments (scripts/register-sim-fx-netting-sets.ts); real ISDA/CSA execution +
// netting-enforceability opinions replace them at licence-day. `computeAndEmitFor`
// returns null for a counterparty with no registered netting set (no emission).
//
// FX netting sets are ZAR-denominated (the FX MTM is ZAR — FxPositionRevalued.
// unrealisedPnlZarMinor), so the emitted EAD is ZAR and flows into CreditRWA via
// rwa-from-positions (D-FX-CCR-INTERIM-CONSERVATIVE-RWA). FX pairs without a ZAR
// leg (crosses, e.g. EUR/USD) are still skipped HERE — not because the consumer
// can't handle non-ZAR EAD (rwa-from-positions now converts any non-ZAR EAD to
// ZAR via buildRateMap/convertMinor, D-FX-EAD-FX-CONVERSION) but because forming
// a non-ZAR netting set requires a registered ISDA/CSA in that currency
// (computeAndEmitFor returns null otherwise). Cross-pair netting-set formation
// lands once non-ZAR sim netting sets are registered (follow-up).
//
// Authority: D-FX-OTC-NPA-SCOPE-EXPANSION; D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL;
//            BCBS-SA-CCR-CRE52; D-CREDIT-LIMIT-ENGINE-BUILD Phase 5.
// Author: Rohan (counterparty-risk engineer) · Scrooge-coordinated session.

import { type Money, minor } from "../../core/money";
import { ZAR } from "../../core/types";
import type { CcrEadComputedPayload } from "../../event-store/event-types/counterparty-credit-risk";
import type { EventStore } from "../../event-store/store";
import { isLiveInstance, resolveTradeLifecycle } from "../../lifecycle/trade-lifecycle-state";
import type { FxTradeExecutedPayload } from "../../markets/cdm/fx";
import { computeAndEmitFor } from "./compute-and-emit";
import type { TradeSummary } from "./types";

const FX_CLOSURE_TYPES = ["SettlementConfirmed", "TradeMatured", "FxTradeCancelled"] as const;

/** Remaining tenor in years from `asOf` to the leg settlement date (≥ 0). */
function remainingYears(settlementIso: string, asOf: string): number {
  const ms = new Date(settlementIso).getTime() - new Date(asOf).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

interface NettingSetGroup {
  readonly counterpartyId: string;
  readonly currency: string;
  readonly trades: TradeSummary[];
}

/**
 * Build SA-CCR TradeSummary rows from the live FX book, grouped by ZAR netting
 * set (NS-<counterpartyId>-ZAR). Closed/cancelled/settled trades are excluded.
 */
export function buildFxSaCcrTradeSummaries(
  eventStore: Pick<EventStore, "replay">,
  asOf: string,
): Map<string, NettingSetGroup> {
  const lifecycleIdx = resolveTradeLifecycle([
    ...eventStore.replay({ type: "FxTradeExecuted", asOf }),
    ...FX_CLOSURE_TYPES.flatMap((t) => [...eventStore.replay({ type: t, asOf })]),
  ]);

  const groups = new Map<string, NettingSetGroup>();

  for (const ev of eventStore.replay({ type: "FxTradeExecuted", asOf })) {
    const p = ev.payload as unknown as FxTradeExecutedPayload;
    const tradeId = typeof p.tradeId === "object" ? p.tradeId.value : String(p.tradeId);
    if (!isLiveInstance(lifecycleIdx.get(tradeId))) continue;

    const counterpartyId = p.counterparty?.partyId;
    if (!counterpartyId) continue;

    const near = p.legs?.find((l) => l.legKind === "near") ?? p.legs?.[0];
    if (!near) continue;

    // ZAR notional: pick the leg side denominated in ZAR (FX netting set is ZAR).
    let zarMinor: number | null = null;
    if (near.notional.currency === "ZAR") zarMinor = near.notional.amountMinor;
    else if (near.counterNotional.currency === "ZAR") zarMinor = near.counterNotional.amountMinor;
    if (zarMinor === null || zarMinor === 0) continue; // cross pair (no ZAR leg) — skip; or zero

    const base = p.currencyPair?.base ?? "";
    const quote = p.currencyPair?.quote ?? "";
    const notional: Money = minor(BigInt(Math.abs(zarMinor)), ZAR);

    const summary: TradeSummary = {
      tradeId,
      counterpartyId,
      nettingSetId: `NS-${counterpartyId}-ZAR`,
      assetClass: "fx",
      notional,
      direction: p.side === "sell" ? "short" : "long",
      remainingYears: remainingYears(near.settlementDate.iso, asOf),
      currency: "ZAR",
      hedgingSetTag: base && quote ? `${base}/${quote}` : "FX",
    };

    const key = summary.nettingSetId;
    const grp = groups.get(key);
    if (grp) grp.trades.push(summary);
    else groups.set(key, { counterpartyId, currency: "ZAR", trades: [summary] });
  }

  return groups;
}

export interface SaCcrRunResult {
  readonly emitted: string[]; // nettingSetIds that emitted CcrEadComputed
  readonly skippedNoNettingSet: string[]; // counterparties with no registered netting set
  readonly skippedAlreadyComputed: string[]; // already computed for the asOf date
}

/**
 * Run SA-CCR for every live FX netting set and emit CcrEadComputed.
 * Idempotent per (nettingSetId, computationDate): skips a netting set already
 * computed for the asOf date. Returns a per-netting-set outcome summary.
 */
export function runSaCcrForFxPositions(eventStore: EventStore, asOf: string): SaCcrRunResult {
  const groups = buildFxSaCcrTradeSummaries(eventStore, asOf);
  const computationDate = asOf.slice(0, 10);

  // Idempotency: netting sets already EAD-computed for this date.
  const alreadyComputed = new Set<string>();
  for (const ev of eventStore.replay({ type: "CcrEadComputed" })) {
    const p = ev.payload as CcrEadComputedPayload;
    if (p.computationDate === computationDate) alreadyComputed.add(p.nettingSetId);
  }

  const emitted: string[] = [];
  const skippedNoNettingSet: string[] = [];
  const skippedAlreadyComputed: string[] = [];

  for (const [nettingSetId, grp] of groups) {
    if (alreadyComputed.has(nettingSetId)) {
      skippedAlreadyComputed.push(nettingSetId);
      continue;
    }
    const result = computeAndEmitFor({
      counterpartyId: grp.counterpartyId,
      currency: grp.currency,
      trades: grp.trades,
      asOf,
    });
    if (result === null) skippedNoNettingSet.push(nettingSetId);
    else emitted.push(nettingSetId);
  }

  return { emitted, skippedNoNettingSet, skippedAlreadyComputed };
}
