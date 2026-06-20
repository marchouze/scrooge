// platform/simulation-v2/eod-bus.ts
//
// EOD / cadence trigger bus over the clean ScenarioClock (Phase 0 keystone).
//
// Today scenarios advance simulated time MANUALLY and fire revaluation /
// snapshot / risk runs by hand. That is the gap this module closes: advancing
// the simulated clock to (or past) an EOD boundary fires every registered
// cadence hook in a DEFINED DETERMINISTIC ORDER.
//
// Design:
//   - The bus owns a SimulatedClock (the only time source). It never reads the
//     wall clock.
//   - Hooks register with a `cadence` (when they fire) and a `priority` (the
//     deterministic order within one boundary). Lower priority runs first.
//   - `advanceTo(asOf)` / `advanceBy(ms)` move the clock forward, detect every
//     EOD boundary crossed, and fire the day's hooks at each boundary in order.
//   - The bus is a SIMULATOR-side orchestrator: it decides WHEN the bank's SUT
//     cadence jobs run, but the hooks themselves are SUT code (revaluation,
//     daily P&L, VaR, snapshots). The bus does not itself emit SUT-internal
//     events — it invokes SUT entry points which do. This keeps the
//     simulator↔SUT boundary intact (the bus is the clock, not the bank).
//
// EOD boundary definition: an EOD boundary for a given UTC calendar day D is the
// instant `D + EOD_TIME_OF_DAY` (default 17:00:00 UTC — the bank's close). When
// the clock advances across one or more such instants, the bus fires the
// "end-of-day" cadence hooks once per crossed boundary, in calendar order.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//            D-SCENARIO-CLOCK (the controlled-time substrate this builds on).
// Author: Atlas (Core banking platform architect, engineering).

import { ONE_DAY_MS, type SimulatedClock } from "../scenario-clock";

// ---------------------------------------------------------------------------
// Cadence + hook contract
// ---------------------------------------------------------------------------

/**
 * Cadence axis a hook fires on. Core-slice set; extensible. Phase 0 ships
 * "end-of-day"; intraday / period-end land as scenarios need them.
 */
export type EodCadence = "end-of-day";

/**
 * Context passed to every hook when it fires. Carries the boundary instant
 * (the EOD `as_of`) and the calendar date so SUT cadence jobs can date their
 * reports deterministically — never from the wall clock.
 */
export interface EodHookContext {
  /** Full ISO-8601 instant of the EOD boundary (e.g. "2026-01-06T17:00:00.000Z"). */
  readonly boundaryInstant: string;
  /** Calendar date of the boundary (YYYY-MM-DD). */
  readonly reportDate: string;
  /** The cadence that fired this hook. */
  readonly cadence: EodCadence;
  /** Monotonic index of this boundary within the run (0-based). */
  readonly boundaryIndex: number;
}

/**
 * A registered cadence hook. `run` is the SUT entry point the bus invokes at the
 * boundary (e.g. "run EOD FX revaluation", "compute daily P&L V2"). Hooks run in
 * ascending `priority`; ties break by registration order (stable).
 */
export interface EodHook {
  /** Stable id for diagnostics + the fired-hooks log. Unique within the bus. */
  readonly id: string;
  /** Which cadence boundary this hook fires on. */
  readonly cadence: EodCadence;
  /**
   * Deterministic ordering key within one boundary. Lower runs first.
   * Convention: revaluation (10) → daily P&L (20) → VaR (30) → snapshots (40)
   * → regulatory summaries (50). Leaves gaps for insertion.
   */
  readonly priority: number;
  /** SUT entry point. Synchronous — the simulator drives a deterministic order. */
  run(ctx: EodHookContext): void;
}

/** One row of the deterministic fired-hooks log (replay assertion surface). */
export interface FiredHookRecord {
  readonly boundaryInstant: string;
  readonly reportDate: string;
  readonly hookId: string;
  readonly priority: number;
  readonly boundaryIndex: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default EOD time-of-day: 17:00 UTC (bank close). */
export const DEFAULT_EOD_HOUR_UTC = 17;

export interface EodBusOptions {
  /**
   * Hour-of-day (UTC) the EOD boundary sits at. Default 17 (17:00 UTC). The
   * minute/second are pinned to 00:00 for determinism.
   */
  readonly eodHourUtc?: number;
}

// ---------------------------------------------------------------------------
// The bus
// ---------------------------------------------------------------------------

export class EodTriggerBus {
  private readonly clock: SimulatedClock;
  private readonly eodHourUtc: number;
  private readonly hooks: EodHook[] = [];
  private readonly hookIds = new Set<string>();
  private readonly firedLog: FiredHookRecord[] = [];
  private boundaryCount = 0;

  constructor(clock: SimulatedClock, opts: EodBusOptions = {}) {
    this.clock = clock;
    const hour = opts.eodHourUtc ?? DEFAULT_EOD_HOUR_UTC;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw new Error(`EodTriggerBus: eodHourUtc must be an integer 0..23 (got ${hour})`);
    }
    this.eodHourUtc = hour;
  }

  /** Register a cadence hook. Throws on duplicate id (deterministic roster). */
  register(hook: EodHook): void {
    if (this.hookIds.has(hook.id)) {
      throw new Error(`EodTriggerBus: duplicate hook id '${hook.id}'`);
    }
    this.hookIds.add(hook.id);
    this.hooks.push(hook);
  }

  /** Hooks for one cadence, sorted by (priority asc, registration order). */
  private hooksFor(cadence: EodCadence): EodHook[] {
    // The push order is the registration order; Array.prototype.sort is stable
    // in modern engines, so equal priorities keep registration order.
    return this.hooks
      .filter((h) => h.cadence === cadence)
      .slice()
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Compute the EOD boundary instant (epoch ms) for the UTC calendar day that
   * contains `instantMs`. The boundary is `that day` at `eodHourUtc:00:00.000Z`.
   */
  private boundaryMsForDayOf(instantMs: number): number {
    const d = new Date(instantMs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), this.eodHourUtc, 0, 0, 0);
  }

  /**
   * Advance the clock to `asOf` (ISO-8601), firing every EOD boundary strictly
   * after the current clock instant and at-or-before `asOf`, in calendar order.
   * Returns the records fired during THIS advance.
   *
   * Boundary rule: a boundary at instant B fires iff `from < B <= to`. The
   * half-open lower bound means re-advancing to the same instant never
   * double-fires (idempotent at the boundary).
   */
  advanceTo(asOf: string): FiredHookRecord[] {
    const fromMs = this.clock.nowMs();
    const toMs = Date.parse(asOf);
    if (Number.isNaN(toMs)) {
      throw new Error(`EodTriggerBus.advanceTo: "${asOf}" is not a valid ISO-8601 timestamp`);
    }
    if (toMs < fromMs) {
      throw new Error(
        `EodTriggerBus.advanceTo: cannot advance backwards (from ${this.clock.now()} to ${asOf})`,
      );
    }
    return this.fireBoundariesBetween(fromMs, toMs, asOf);
  }

  /** Advance the clock by `durationMs`, firing crossed EOD boundaries. */
  advanceBy(durationMs: number): FiredHookRecord[] {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error(
        `EodTriggerBus.advanceBy: durationMs must be a finite >= 0 (got ${durationMs})`,
      );
    }
    const toMs = this.clock.nowMs() + durationMs;
    return this.advanceTo(new Date(toMs).toISOString());
  }

  /** Convenience: advance exactly one calendar day. */
  advanceOneDay(): FiredHookRecord[] {
    return this.advanceBy(ONE_DAY_MS);
  }

  private fireBoundariesBetween(
    fromMs: number,
    toMs: number,
    finalAsOf: string,
  ): FiredHookRecord[] {
    const fired: FiredHookRecord[] = [];

    // The first candidate boundary is the EOD of the day containing `fromMs`.
    // If that boundary is <= fromMs (we are already past today's close), step to
    // the next day's boundary. Then walk day-by-day up to toMs.
    let boundaryMs = this.boundaryMsForDayOf(fromMs);
    if (boundaryMs <= fromMs) {
      boundaryMs = this.boundaryMsForDayOf(fromMs + ONE_DAY_MS);
    }

    const eodHooks = this.hooksFor("end-of-day");

    while (boundaryMs <= toMs) {
      // Move the clock exactly onto the boundary so hooks read the boundary
      // instant as `now` (deterministic dating). The clock is the single time
      // source — hooks never read the wall clock.
      const boundaryInstant = new Date(boundaryMs).toISOString();
      this.clock.setTo(boundaryInstant);
      const reportDate = boundaryInstant.slice(0, 10);
      const boundaryIndex = this.boundaryCount;
      this.boundaryCount += 1;

      const ctx: EodHookContext = {
        boundaryInstant,
        reportDate,
        cadence: "end-of-day",
        boundaryIndex,
      };

      for (const hook of eodHooks) {
        hook.run(ctx);
        const rec: FiredHookRecord = {
          boundaryInstant,
          reportDate,
          hookId: hook.id,
          priority: hook.priority,
          boundaryIndex,
        };
        fired.push(rec);
        this.firedLog.push(rec);
      }

      boundaryMs = this.boundaryMsForDayOf(boundaryMs + ONE_DAY_MS);
    }

    // Settle the clock at the requested final instant (it may be after the last
    // boundary of the run, e.g. advancing to 18:00 after a 17:00 close).
    if (this.clock.nowMs() < toMs) {
      this.clock.setTo(finalAsOf);
    }

    return fired;
  }

  /** Number of EOD boundaries fired across the bus's lifetime. */
  boundariesFired(): number {
    return this.boundaryCount;
  }

  /** Immutable view of the full fired-hooks log (deterministic replay surface). */
  log(): readonly FiredHookRecord[] {
    return this.firedLog.slice();
  }
}
