// platform/simulation-v2-live/cadence-hooks.ts
//
// Shared SUT cadence-hook factory for the FX V2 EOD bus. Produces the
// end-of-day `EodHook`s the simulator drives at each 17:00 boundary — cohort
// daily P&L + cohort VaR over the FX cohort, and (optionally) the cohort SA-CCR
// EAD. The hooks are SUT entry points: they invoke the bank's compute engines;
// the bus only decides WHEN they run.
//
// One factory, two consumers (port-not-duplicate): the live driver
// (live-driver.ts) registers these on its own EodTriggerBus, and the read-only
// world-simulator view may adopt the same factory. Each consumer supplies its own
// capture callbacks (latest-figure for the live status; date-pinned single-capture
// for the oracle view).
//
// BOUNDARY (recon:fx-v2-sim-boundary Rule A): this file is in a SIMULATOR dir but
// emits NO event type itself — it calls SUT compute functions. P&L + VaR are pure
// reads (no emission). SA-CCR EAD emits an SUT-internal event and is therefore
// OFF by default for the live shared-store driver (a production-tagged risk
// aggregate over a simulated cohort would mix provenance); enable it only for an
// isolated scenario store.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).

import type { EventStore } from "../event-store/store";
import type { MarketDataStore } from "../market-data/store";
import { computeCohortVar } from "../market-risk/eod-cohort-var-v2";
import { computeCohortPnL } from "../product-control/eod-cohort-pnl-v2";
import { computeAndEmitCohortSaCcrEad } from "../risk/sa-ccr/eod-saccr-ead-v2";
import type { EodHook } from "../simulation-v2/eod-bus";

/** The substrate the hooks read/compute over (one run's stores). */
export interface FxCadenceEnv {
  readonly eventStore: EventStore;
  readonly marketDataStore: MarketDataStore;
}

export interface FxCadenceConfig {
  /** Reporting currency (e.g. "ZAR"). */
  readonly reporting: string;
  /**
   * Booked rate per FIL instance URN — the simulator's known input, accumulated
   * by the driver as it books. Passed by reference so newly-booked trades are
   * visible to later EOD boundaries.
   */
  readonly bookedRateByInstance: ReadonlyMap<string, number>;
  /** Called with the cohort P&L result at each EOD boundary. */
  readonly onPnL?: (reportDate: string, result: ReturnType<typeof computeCohortPnL>) => void;
  /** Called with the cohort VaR result at each EOD boundary. */
  readonly onVar?: (reportDate: string, result: ReturnType<typeof computeCohortVar>) => void;
  /**
   * Emit + capture cohort SA-CCR EAD at each EOD. OFF by default — it emits an
   * SUT-internal event; enable only against an isolated scenario store.
   */
  readonly emitSaCcr?: boolean;
  /** Called with the SA-CCR EAD result (only when `emitSaCcr` is true). */
  readonly onSaCcr?: (
    reportDate: string,
    result: ReturnType<typeof computeAndEmitCohortSaCcrEad>,
  ) => void;
}

/**
 * Build the EOD cadence hooks for an FX run. Returns a factory `(env) => hooks`
 * so each consumer binds its own run stores.
 *
 * Hook priorities (mirror the eod-bus convention): daily P&L (20) → VaR (30) →
 * SA-CCR EAD (35).
 */
export function buildFxCadenceHooks(
  config: FxCadenceConfig,
): (env: FxCadenceEnv) => readonly EodHook[] {
  return ({ eventStore, marketDataStore }) => {
    const hooks: EodHook[] = [
      {
        id: "fx-cohort-daily-pnl",
        cadence: "end-of-day",
        priority: 20,
        run: (ctx) => {
          const result = computeCohortPnL({
            eventStore,
            marketDataStore,
            reporting: config.reporting,
            reportDate: ctx.reportDate,
            bookedRateByInstance: config.bookedRateByInstance,
          });
          config.onPnL?.(ctx.reportDate, result);
        },
      },
      {
        id: "fx-cohort-var",
        cadence: "end-of-day",
        priority: 30,
        run: (ctx) => {
          const result = computeCohortVar({
            eventStore,
            marketDataStore,
            reporting: config.reporting,
            reportDate: ctx.reportDate,
            asOf: ctx.boundaryInstant,
          });
          config.onVar?.(ctx.reportDate, result);
        },
      },
    ];

    if (config.emitSaCcr) {
      hooks.push({
        id: "fx-cohort-saccr-ead",
        cadence: "end-of-day",
        priority: 35,
        run: (ctx) => {
          const result = computeAndEmitCohortSaCcrEad({
            eventStore,
            marketDataStore,
            reporting: config.reporting,
            reportDate: ctx.reportDate,
            asOf: ctx.boundaryInstant,
            bookedRateByInstance: config.bookedRateByInstance,
          });
          config.onSaCcr?.(ctx.reportDate, result);
        },
      });
    }

    return hooks;
  };
}
