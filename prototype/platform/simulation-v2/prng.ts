// platform/simulation-v2/prng.ts
//
// Seeded deterministic PRNG for the FX V2 simulator. Replay-safety (Principle 1)
// REQUIRES every stochastic choice in a scenario be reproducible: the same seed
// MUST produce the same sequence on every run, on every machine. Therefore:
//
//   - NEVER call Math.random()  — non-deterministic; breaks replay.
//   - NEVER call Date.now() / new Date() for scenario logic — wall-clock leaks
//     non-determinism into the event stream. Scenario time comes from the
//     injected SimulatedClock only.
//
// The recon gate recon:fx-v2-sim-boundary scans this package for Math.random /
// Date.now and fails on either.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).
// Author: Atlas (Core banking platform architect, engineering).

// Re-export the canonical mulberry32 from the existing V1 spine so the V2
// simulator and the V1 env-sim share one PRNG implementation (port-not-rebuild).
export { mulberry32 } from "../simulation/env-sim/counterparty-profiles";

import { mulberry32 } from "../simulation/env-sim/counterparty-profiles";

/**
 * A deterministic random source threaded through a scenario run. Wraps a
 * mulberry32 stream and exposes the typed draws the simulator needs. Construct
 * once per scenario from the manifest seed; pass it down to every module.
 */
export class SeededRng {
  private readonly next: () => number;

  constructor(seed: number) {
    if (!Number.isInteger(seed)) {
      throw new Error(`SeededRng: seed must be an integer (got ${seed})`);
    }
    this.next = mulberry32(seed);
  }

  /** Uniform float in [0, 1). */
  unit(): number {
    return this.next();
  }

  /** Uniform integer in [minInclusive, maxInclusive]. */
  intBetween(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) {
      throw new Error(`SeededRng.intBetween: max (${maxInclusive}) < min (${minInclusive})`);
    }
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.unit() * span);
  }

  /** True with probability `p` (clamped to [0, 1]). */
  bernoulli(p: number): boolean {
    const clamped = Math.max(0, Math.min(1, p));
    return this.unit() < clamped;
  }

  /** Deterministically pick one element of a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("SeededRng.pick: cannot pick from an empty array");
    }
    const idx = this.intBetween(0, items.length - 1);
    // idx is bounded to [0, length-1]; the element is therefore defined.
    return items[idx] as T;
  }
}
