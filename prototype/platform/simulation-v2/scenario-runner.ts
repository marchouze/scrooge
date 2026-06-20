// platform/simulation-v2/scenario-runner.ts
//
// Deterministic scenario runner (Phase 0).
//
// Wires a fresh, isolated environment for one ScenarioManifest:
//   - a SimulatedClock pinned to the manifest baseline (the only time source);
//   - an in-memory EventStore (the SUT's event log);
//   - an in-memory MarketDataStore (reference-data feed + adopted marks);
//   - an EodTriggerBus over the clock (Phase-0 cadence keystone);
//   - a SeededRng from the manifest seed.
//
// It then replays the manifest day-by-day. For each day it:
//   1. applies that day's market path (simulator → feed; ingestion adapter
//      promotes to the SUT's production mark set — the boundary-respecting seam);
//   2. applies that day's trade actions (external-party emissions);
//   3. advances the EOD bus to that day's close, firing the registered SUT
//      cadence hooks (revaluation / daily P&L / VaR — wired by M1/M4).
//
// Phase 0 ships the spine with NO cadence hooks registered by default (a no-op
// scenario still advances >= 3 days and the bus fires zero hooks deterministically).
// M1/M4 register the real SUT hooks via `cadenceHooks`.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).
// Author: Atlas (Core banking platform architect, engineering).

import { EventStore } from "../event-store/store";
import { MarketDataStore } from "../market-data/store";
import { SimulatedClock } from "../scenario-clock";
import { type EodHook, type EodHookContext, EodTriggerBus, type FiredHookRecord } from "./eod-bus";
import { SeededRng } from "./prng";
import type { ScenarioDay, ScenarioManifest } from "./scenario-manifest";
import { validateManifest } from "./scenario-manifest";

/** A per-day callback the runner invokes — the simulator's external-party emissions. */
export type DayDriver = (args: {
  readonly day: ScenarioDay;
  readonly clock: SimulatedClock;
  readonly eventStore: EventStore;
  readonly marketDataStore: MarketDataStore;
  readonly rng: SeededRng;
  readonly manifest: ScenarioManifest;
}) => void;

/** A factory producing the SUT cadence hooks for a run (M1/M4 supply these). */
export type CadenceHookFactory = (env: {
  readonly eventStore: EventStore;
  readonly marketDataStore: MarketDataStore;
  readonly clock: SimulatedClock;
  readonly manifest: ScenarioManifest;
}) => readonly EodHook[];

export interface ScenarioRunOptions {
  /**
   * Per-day external-party drivers, applied in order at the START of each day
   * (before the EOD bus advances to that day's close). M1+ supply market-path
   * ingestion + trade-confirmation drivers here.
   */
  readonly dayDrivers?: readonly DayDriver[];
  /**
   * Factory for the SUT cadence hooks registered on the EOD bus. Phase-0
   * default is none (no-op scenario). M1/M4 supply revaluation / P&L / VaR.
   */
  readonly cadenceHooks?: CadenceHookFactory;
  /** Optional event-store path (default in-memory). */
  readonly eventDbPath?: string;
  /** Optional market-data-store path (default in-memory). */
  readonly marketDbPath?: string;
}

export interface ScenarioRunResult {
  readonly scenarioId: string;
  /** Number of EOD boundaries fired across the run. */
  readonly boundariesFired: number;
  /** The deterministic fired-hooks log. */
  readonly firedHooks: readonly FiredHookRecord[];
  /** Final clock instant. */
  readonly finalInstant: string;
  /** The live event store (caller asserts over it, then closes via close()). */
  readonly eventStore: EventStore;
  /** The live market-data store. */
  readonly marketDataStore: MarketDataStore;
  /** Release both stores. */
  close(): void;
}

/**
 * Run a scenario manifest deterministically end-to-end. The returned result
 * holds the live stores so the caller can assert over them; call `close()` when
 * done.
 */
export function runScenario(
  manifest: ScenarioManifest,
  opts: ScenarioRunOptions = {},
): ScenarioRunResult {
  validateManifest(manifest);

  const clock = new SimulatedClock(manifest.baselineInstant);
  const eventStore = new EventStore(opts.eventDbPath ?? ":memory:");
  const marketDataStore = new MarketDataStore(opts.marketDbPath ?? ":memory:");
  const rng = new SeededRng(manifest.seed);
  const bus = new EodTriggerBus(clock, { eodHourUtc: manifest.eodHourUtc ?? 17 });

  // Register the SUT cadence hooks (M1/M4). Phase-0 default: none.
  if (opts.cadenceHooks) {
    for (const hook of opts.cadenceHooks({ eventStore, marketDataStore, clock, manifest })) {
      bus.register(hook);
    }
  }

  const dayDrivers = opts.dayDrivers ?? [];

  for (const day of manifest.days) {
    // Pin the clock to the morning of this day (pre-close) so external-party
    // emissions date inside the day, before the EOD boundary.
    const morning = `${day.date}T08:00:00.000Z`;
    if (clock.nowMs() < Date.parse(morning)) {
      clock.setTo(morning);
    }

    // 1+2. Apply the day's external-party drivers (market path + trades).
    for (const drive of dayDrivers) {
      drive({ day, clock, eventStore, marketDataStore, rng, manifest });
    }

    // 3. Advance the EOD bus to this day's close, firing SUT cadence hooks.
    bus.advanceTo(`${day.date}T${pad2(manifest.eodHourUtc ?? 17)}:00:00.000Z`);
  }

  return {
    scenarioId: manifest.scenarioId,
    boundariesFired: bus.boundariesFired(),
    firedHooks: bus.log(),
    finalInstant: clock.now(),
    eventStore,
    marketDataStore,
    close(): void {
      eventStore.close();
      marketDataStore.close();
    },
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Re-export so M1/M4 hook factories can type their context. */
export type { EodHook, EodHookContext };
