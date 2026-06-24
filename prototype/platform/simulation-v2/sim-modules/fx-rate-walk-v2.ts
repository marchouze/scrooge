// platform/simulation-v2/sim-modules/fx-rate-walk-v2.ts
//
// V2-native bounded random-walk FX rate engine (the live simulator's market
// generator). Produces the per-pair spot mids the simulated outside world's
// market-data feed publishes each tick.
//
// PORT, NOT IMPORT (D-V1-REMOVAL-PHASE-1): the bounded-random-walk algorithm and
// the half-spread table are PORTED from the V1 engine (platform/simulation/
// fx-sim-rates.ts) as re-typed constants. This module imports NOTHING from the V1
// `platform/simulation/` spine — it is born V2.
//
// REPLAY-SAFETY (recon:fx-v2-sim-boundary Rule C): there is no `Math.random` /
// `Date.now` / `new Date()` here. Every walk step draws from an injected
// `SeededRng`, so the same seed reproduces the same path on every run. (The V1
// engine defaulted `rng = Math.random`; that default is deliberately dropped.)
//
// Pair representation: major-first per the ACI Model Code hierarchy
// (EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY > others). The mid is
// quote-per-base — `USD/ZAR: 18.5` means 18.5 ZAR per 1 USD.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   ACI Model Code §2 (currency-pair quotation convention).

import type { SeededRng } from "../prng";

// ---------------------------------------------------------------------------
// Ported constants (re-typed, NOT imported from the V1 engine)
// ---------------------------------------------------------------------------

/**
 * Fallback seed mid-rates (major-first, approx 2026 values). Used when no
 * production tick seeds a pair. The live driver may override these by passing
 * `initialMids` resolved from the production MarketDataStore.
 */
const SEED_MID_RATES: Record<string, number> = {
  "USD/ZAR": 18.5,
  "EUR/ZAR": 20.0,
  "EUR/USD": 1.08,
  "EUR/GBP": 1.15,
  "GBP/ZAR": 23.0,
  "GBP/USD": 1.265,
};

/** The standard FX-spot pair set the live simulator trades (major-first). */
export const STANDARD_SIM_PAIRS: readonly string[] = Object.freeze([
  "USD/ZAR",
  "EUR/ZAR",
  "GBP/ZAR",
  "EUR/USD",
  "GBP/USD",
]);

/** Half-spread in basis points per pair class (ported). */
const HALF_SPREAD_BPS = {
  ZAR_PAIRS: 35, // ZAR/xxx or xxx/ZAR — EM liquidity
  EUR_USD: 10, // G4 major
  GBP_USD: 12, // G4 major
  DEFAULT: 25,
} as const;

/**
 * Tick-step magnitude: bpsChange = ((u1+u2)/2 − 0.5) × WALK_STEP_FACTOR
 * → ≈ ±20 bps per tick, triangular distribution. Ported verbatim.
 */
const WALK_STEP_FACTOR = 0.0004;

function halfSpreadBps(pair: string): number {
  if (pair.startsWith("ZAR/") || pair.endsWith("/ZAR")) return HALF_SPREAD_BPS.ZAR_PAIRS;
  if (pair === "EUR/USD" || pair === "USD/EUR") return HALF_SPREAD_BPS.EUR_USD;
  if (pair === "GBP/USD" || pair === "USD/GBP") return HALF_SPREAD_BPS.GBP_USD;
  return HALF_SPREAD_BPS.DEFAULT;
}

// ---------------------------------------------------------------------------
// FxRateWalkV2
// ---------------------------------------------------------------------------

export interface FxRateV2 {
  readonly mid: number;
  readonly bid: number;
  readonly ask: number;
}

export class FxRateWalkV2 {
  private readonly midRates: Map<string, number>;

  /**
   * @param initialMids starting mids per pair. Defaults to the ported fallback;
   * the live driver seeds real production mids by passing them in.
   */
  constructor(initialMids: Record<string, number> = SEED_MID_RATES) {
    this.midRates = new Map(Object.entries(initialMids));
  }

  /**
   * Advance `pair` by one random-walk step (drawing from the injected SeededRng)
   * and return bid/mid/ask. Deterministic for a given rng sequence.
   */
  tick(pair: string, rng: SeededRng): FxRateV2 {
    const last = this.midRates.get(pair) ?? this.inferMid(pair);
    const bpsChange = ((rng.unit() + rng.unit()) / 2 - 0.5) * WALK_STEP_FACTOR;
    const mid = last * (1 + bpsChange);
    this.midRates.set(pair, mid);
    return this.buildRate(pair, mid);
  }

  /** Current mid without advancing the walk. */
  getMid(pair: string): number {
    return this.midRates.get(pair) ?? this.inferMid(pair);
  }

  private buildRate(pair: string, mid: number): FxRateV2 {
    const half = mid * (halfSpreadBps(pair) / 10_000);
    return { mid, bid: mid - half, ask: mid + half };
  }

  /** Infer a mid for an unknown pair from its inverse; fall back to 1. */
  private inferMid(pair: string): number {
    const parts = pair.split("/");
    if (parts.length === 2) {
      const [base, quote] = parts as [string, string];
      const inv = this.midRates.get(`${quote}/${base}`);
      if (inv && inv > 0) {
        const inferred = 1 / inv;
        this.midRates.set(pair, inferred);
        return inferred;
      }
    }
    this.midRates.set(pair, 1);
    return 1;
  }
}
