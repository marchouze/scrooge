// platform/conduct/fx-conduct-surveillance-sweep.ts
//
// Store-scanning FX conduct surveillance sweep — the reliable dispatch path
// for best-execution + FAIS-suitability + conflict surveillance over the live
// FX book.
//
// ## Why a sweep (not event-driven fan-out)
//
// The event-driven handler `rohan:conduct-risk-events` only fires when an
// `FxTradeExecuted` is appended *inside an agent run* (the run-coupled bus tick
// in `runtime/run.ts` walks only that run's sequence window). FX trades are
// booked by the operator / pre-trade-gateway path (`dashboard/markets-fx-
// trade.ts → store.append`), which is not an agent run — so the surveillance
// never fired on the live book. This sweep scans the store for every
// `FxTradeExecuted` lacking a surveillance outcome and evaluates it, exactly as
// the BA310/BA300 period-close handlers scan for closed periods. Registered on
// a daily scheduled cadence (`rohan:conduct-surveillance-sweep`), it gives
// forward coverage without depending on bus timing; the one-shot backfill
// driver (`scripts/run-fx-conduct-surveillance-backfill.ts`) reuses it to cover
// history.
//
// Idempotent: the per-trade evaluator (`evaluateFxTradeConduct`) skips any check
// whose typed output already exists for the trade, so re-running the sweep (or
// re-processing the same trade after the event-driven handler already ran) never
// double-emits.
//
// Authority: D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH (CEO session-
//   delegation 2026-06-11); D-MARKET-CONDUCT; FAIS Act 37/2002 §§16–17, §8D, §4;
//   Principle 1; Principle 6.
// Author: Zara (Chief Compliance Officer, governance) on Rohan's (Markets
//   risk/quant engineer, engineering) conduct-risk logic.

import type { EventStore } from "../event-store/store";
import type { Event } from "../event-store/types";
import { evaluateFxTradeConduct } from "./fx-trade-conduct-evaluation";

export interface ConductSweepResult {
  readonly tradesScanned: number;
  readonly tradesProcessed: number;
  readonly tradesAlreadyCovered: number;
  readonly eventsEmitted: number;
  /** Trade IDs whose FAIS-suitability check could not fire (counterparty
   *  unclassified). Surfaced so the residual is visible, never hidden. */
  readonly faisUnclassifiedTradeIds: readonly string[];
}

export interface SweepOptions {
  readonly asOf: string;
  readonly dryRun: boolean;
  /** Optional cap on the number of trades processed in one sweep (forward
   *  cadence keeps this unset; tests may bound it). */
  readonly limit?: number;
}

/**
 * Sweep every `FxTradeExecuted` in `store` and run conduct surveillance over it.
 * Returns the tallies; appends surveillance events for any trade missing them
 * (unless `dryRun`).
 */
export function sweepFxConductSurveillance(
  store: EventStore,
  opts: SweepOptions,
): ConductSweepResult {
  const trades: Event[] = [];
  for (const e of store.replay({ type: "FxTradeExecuted" })) {
    trades.push(e);
    if (opts.limit !== undefined && trades.length >= opts.limit) break;
  }

  let tradesProcessed = 0;
  let tradesAlreadyCovered = 0;
  let eventsEmitted = 0;
  const faisUnclassifiedTradeIds: string[] = [];

  for (const trade of trades) {
    const result = evaluateFxTradeConduct(store, trade, {
      asOf: opts.asOf,
      dryRun: opts.dryRun,
    });
    eventsEmitted += result.eventsEmitted;
    if (result.eventsEmitted > 0) {
      tradesProcessed += 1;
    } else {
      tradesAlreadyCovered += 1;
    }
    if (result.faisSkippedUnclassified) {
      faisUnclassifiedTradeIds.push(result.tradeId);
    }
  }

  return {
    tradesScanned: trades.length,
    tradesProcessed,
    tradesAlreadyCovered,
    eventsEmitted,
    faisUnclassifiedTradeIds,
  };
}
