// platform/scenario-clock/simulated-clock.ts
//
// Deterministic clock for simulated scenarios. Initialised to a baseline
// ISO-8601 instant; advances on demand via `advance(durationMs)` or
// `setTo(asOf)`. `freeze()` blocks mutation until `unfreeze()`.
//
// Use:
//
//   const clock = new SimulatedClock("2026-05-10T08:00:00.000Z");
//   clock.now();                 // → "2026-05-10T08:00:00.000Z"
//   clock.advance(ONE_DAY_MS);
//   clock.now();                 // → "2026-05-11T08:00:00.000Z"
//   clock.setTo("2026-05-31T17:00:00.000Z");  // jump to month-end close
//
// Author: Atlas (Core banking platform architect, engineering)

import type { DurationMs, ScenarioClock } from "./types";

export class SimulatedClock implements ScenarioClock {
  readonly mode = "simulated" as const;

  private currentMs: number;
  private isFrozen = false;

  /**
   * Construct from an ISO-8601 string OR an epoch-ms number. ISO is
   * preferred — scenarios are usually dated in human-readable instants.
   * Throws on an unparseable ISO string.
   */
  constructor(baseline: string | number) {
    if (typeof baseline === "number") {
      if (!Number.isFinite(baseline)) {
        throw new Error(
          `SimulatedClock: numeric baseline must be finite (got ${baseline})`,
        );
      }
      this.currentMs = baseline;
      return;
    }
    const parsed = Date.parse(baseline);
    if (Number.isNaN(parsed)) {
      throw new Error(
        `SimulatedClock: baseline "${baseline}" is not a valid ISO-8601 timestamp`,
      );
    }
    this.currentMs = parsed;
  }

  now(): string {
    return new Date(this.currentMs).toISOString();
  }

  nowMs(): number {
    return this.currentMs;
  }

  advance(duration: DurationMs): void {
    if (this.isFrozen) {
      throw new Error(
        "SimulatedClock.advance: clock is frozen; call unfreeze() first",
      );
    }
    if (!Number.isFinite(duration)) {
      throw new Error(
        `SimulatedClock.advance: duration must be finite (got ${duration})`,
      );
    }
    // Negative durations rewind — explicitly legal (scenarios sometimes
    // reset to an earlier baseline). The store's as-of replay is monotonic
    // in event sequence, not in clock time.
    this.currentMs += duration;
  }

  setTo(asOf: string): void {
    if (this.isFrozen) {
      throw new Error(
        "SimulatedClock.setTo: clock is frozen; call unfreeze() first",
      );
    }
    const parsed = Date.parse(asOf);
    if (Number.isNaN(parsed)) {
      throw new Error(
        `SimulatedClock.setTo: "${asOf}" is not a valid ISO-8601 timestamp`,
      );
    }
    this.currentMs = parsed;
  }

  freeze(): void {
    this.isFrozen = true;
  }

  unfreeze(): void {
    this.isFrozen = false;
  }

  get frozen(): boolean {
    return this.isFrozen;
  }
}
