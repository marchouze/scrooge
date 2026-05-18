// platform/simulation/fx-sim-rates.ts
//
// Stateful random-walk FX rate engine for the simulation.
// Seeds approximate 2026 mid-market rates and applies a bounded random walk
// on each tick. Half-spreads are pair-dependent.
//
// Authority: D-FX-SALES-TRADING-FRONTEND; D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

// ---------------------------------------------------------------------------
// Seed mid-rates (approx 2026 values)
// ---------------------------------------------------------------------------

const SEED_MID_RATES: Record<string, number> = {
  "ZAR/USD": 0.0541,
  "ZAR/EUR": 0.05,
  "ZAR/GBP": 0.0435,
  "EUR/USD": 1.08,
  "EUR/ZAR": 20.0,
  "GBP/ZAR": 23.0,
  "USD/EUR": 0.9259,
  "USD/ZAR": 18.5,
  "GBP/USD": 1.265,
  // Derived convenience pairs
  "GBP/EUR": 1.15,
};

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
   */
  tick(pair: string): FxRate {
    const last = this.midRates.get(pair) ?? this.inferMid(pair);
    const bpsChange = ((Math.random() + Math.random()) / 2 - 0.5) * 0.0004;
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
