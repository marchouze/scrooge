// platform/simulation/fx-sim-rates.ts
//
// Stateful random-walk FX rate engine for the simulation.
// Seeds approximate 2026 mid-market rates and applies a bounded random walk
// on each tick. Half-spreads are pair-dependent.
//
// Pair representation: all pairs are stored in **major-first** form per the
// ACI Model Code currency hierarchy:
//
//   EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY > everything else
//
// So `USD/ZAR` (not `ZAR/USD`), `EUR/USD` (not `USD/EUR`), etc. The mid is
// quote-per-base — i.e. `USD/ZAR: 18.5` means 18.5 ZAR per 1 USD. Callers
// requesting an inverse pair go through `inferMid`, which derives the
// reciprocal on demand.
//
// Authority: D-FX-SALES-TRADING-FRONTEND; D-MARKETS-SCHEMA-FOUNDATION;
//   ACI Model Code §2 (currency-pair quotation convention).
// Author: Devon (Chief Operating Officer, engineering)

// ---------------------------------------------------------------------------
// Seed mid-rates (approx 2026 values, major-first per ACI hierarchy)
// ---------------------------------------------------------------------------

const SEED_MID_RATES: Record<string, number> = {
  // USD/* — USD is base only against currencies below it (ZAR and others).
  "USD/ZAR": 18.5,
  // EUR/* — EUR is highest in the hierarchy, so always base.
  "EUR/ZAR": 20.0,
  "EUR/USD": 1.08,
  "EUR/GBP": 1.15,
  // GBP/* — GBP is base against everything except EUR.
  "GBP/ZAR": 23.0,
  "GBP/USD": 1.265,
};

/** Read-only view of the seed mid-rate pair keys (consumed by recon:fx-pair-direction). */
export const SEED_MID_RATES_KEYS: readonly string[] = Object.freeze(Object.keys(SEED_MID_RATES));

// ---------------------------------------------------------------------------
// Half-spread lookup (basis points)
// ---------------------------------------------------------------------------

function halfSpreadBps(pair: string): number {
  if (pair.startsWith("ZAR/") || pair.endsWith("/ZAR")) return 35; // 30–40 bps midpoint
  if (pair === "EUR/USD" || pair === "USD/EUR") return 10;
  if (pair === "GBP/USD" || pair === "USD/GBP") return 12;
  return 25; // default
}

// ---------------------------------------------------------------------------
// FxRateEngine
// ---------------------------------------------------------------------------

export interface FxRate {
  mid: number;
  bid: number;
  ask: number;
}

export class FxRateEngine {
  private midRates: Map<string, number>;

  constructor() {
    this.midRates = new Map(Object.entries(SEED_MID_RATES));
  }

  /**
   * Advance the rate for `pair` by one random-walk step and return bid/mid/ask.
   * bpsChange = ((rand() + rand()) / 2 - 0.5) × 0.0004 → ±20 bps, gaussian-ish.
   *
   * An optional `rng` may be threaded in so callers that need deterministic,
   * seed-reproducible walks (e.g. the front-end param-generator) get a fully
   * repeatable sequence. When omitted it falls back to `Math.random` — the
   * historical behaviour, unchanged for the live market-making loop.
   */
  tick(pair: string, rng: () => number = Math.random): FxRate {
    const last = this.midRates.get(pair) ?? this.inferMid(pair);
    const bpsChange = ((rng() + rng()) / 2 - 0.5) * 0.0004;
    const mid = last * (1 + bpsChange);
    this.midRates.set(pair, mid);
    return this.buildRate(pair, mid);
  }

  /** Get current mid without advancing the random walk. */
  getMid(pair: string): number {
    return this.midRates.get(pair) ?? this.inferMid(pair);
  }

  private buildRate(pair: string, mid: number): FxRate {
    const halfBps = halfSpreadBps(pair);
    const half = mid * (halfBps / 10_000);
    return {
      mid,
      bid: mid - half,
      ask: mid + half,
    };
  }

  /** Infer a mid for an unknown pair from inverses or seeds; fall back to 1. */
  private inferMid(pair: string): number {
    const parts = pair.split("/");
    if (parts.length === 2) {
      const [base, quote] = parts as [string, string];
      const inv = `${quote}/${base}`;
      const invRate = this.midRates.get(inv);
      if (invRate && invRate > 0) {
        const inferred = 1 / invRate;
        this.midRates.set(pair, inferred);
        return inferred;
      }
    }
    this.midRates.set(pair, 1);
    return 1;
  }
}
