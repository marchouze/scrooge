// platform/simulation/env-sim/counterparty-profiles.ts
//
// Counterparty behaviour profiles for the EnvSim module.
// Drives stochastic post-trade branching in post-trade-lifecycle.ts.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Env (External Environment Simulator) / Devon (Chief Operating Officer, engineering)

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32 (no external dep)
// ---------------------------------------------------------------------------

/**
 * Mulberry32 PRNG. Returns a function that produces uniformly distributed
 * floats in [0, 1). Passing the same seed produces the same sequence,
 * enabling fully deterministic replay.
 */
export function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// CounterpartyBehaviorProfile
// ---------------------------------------------------------------------------

export interface CounterpartyBehaviorProfile {
  /** Identifier matching SimCounterparty.partyId. */
  counterpartyId: string;
  /** Probability [0–1] that settlement fails entirely. */
  settlementFailureProbability: number;
  /** Extra calendar days beyond T+2. 0 = on-time. */
  settlementDelayDays: number;
  /** Probability [0–1] that the counterparty rejects the trade confirmation. */
  rejectionProbability: number;
  /** Milliseconds after trade execution before MT300 arrives (simulated). */
  confirmationDelayMs: number;
}

// ---------------------------------------------------------------------------
// Built-in profiles
// ---------------------------------------------------------------------------

/** Gold-standard counterparty: always settles on-time, never rejects. */
export const ALWAYS_SETTLE: CounterpartyBehaviorProfile = {
  counterpartyId: "*",
  settlementFailureProbability: 0,
  settlementDelayDays: 0,
  rejectionProbability: 0,
  confirmationDelayMs: 0,
};

/** Slow but reliable: settles T+3 (one extra day), never fails. */
export const SLOW_SETTLER: CounterpartyBehaviorProfile = {
  counterpartyId: "*",
  settlementFailureProbability: 0,
  settlementDelayDays: 1,
  rejectionProbability: 0,
  confirmationDelayMs: 0,
};

/** Mostly reliable: 5% settlement failure probability, otherwise on-time. */
export const OCCASIONAL_FAIL: CounterpartyBehaviorProfile = {
  counterpartyId: "*",
  settlementFailureProbability: 0.05,
  settlementDelayDays: 0,
  rejectionProbability: 0,
  confirmationDelayMs: 0,
};

/** Unreliable: 10% failure + 1 day delay + 2% rejection. */
export const UNRELIABLE: CounterpartyBehaviorProfile = {
  counterpartyId: "*",
  settlementFailureProbability: 0.1,
  settlementDelayDays: 1,
  rejectionProbability: 0.02,
  confirmationDelayMs: 0,
};
