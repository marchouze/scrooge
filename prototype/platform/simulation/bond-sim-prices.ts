// platform/simulation/bond-sim-prices.ts
//
// Stateful random-walk bond price engine for the bond-trading simulation — the
// bond analogue of FxRateEngine (platform/simulation/fx-sim-rates.ts).
//
// Per Marc's choice (2026-06-07) this is a DIRECT CLEAN-PRICE walk: each bond's
// clean price (% of par) takes a bounded random-walk step each tick. A per-bond
// volatility multiplier makes the long end (R2040) move more than the short end
// (R186) in price terms, and an approximate modified duration lets the engine
// carry an internally-consistent implied yield alongside the walked price (so
// the emitted bond-price tick's yieldToMaturity field tracks the price rather
// than freezing). Half-spreads are per-bond (govt bonds are tight; the long end
// is a touch wider).
//
// Seeding: each bond's starting clean price + yield are seeded from the most
// recent **production** jse-debt reference tick in the MarketDataStore (the
// build-phase fixture, seeds/bond-prices.json), falling back to the documented
// reference approximations in sa-bond-reference.ts when the store has no tick.
// The walk never seeds itself off its own simulated output — it reads the
// jse-debt source only, never the bond-sim source.
//
// Authority: D-NPA-SAGB-BOND-INTERNAL-TEST; D-MARKETS-SCHEMA-FOUNDATION;
//   JSE-RULES-BONDS (clean-price quotation, ACT/365).
// Author: Devon (Chief Operating Officer, engineering)

import type { MarketDataStore } from "../market-data/store";
import { MarketDataSources } from "../market-data/types";
import { SA_BOND_ISINS, SA_BOND_REFERENCE } from "../markets/reference/sa-bond-reference";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Baseline tick-step magnitude on the clean price:
 *   bpsChange = ((r1+r2)/2 − 0.5) × BOND_WALK_STEP_FACTOR × volMultiplier
 * 0.0002 ≈ ±10 bp of price per tick at the baseline vol — government bonds are
 * far less volatile than EM FX, so this is ~half the FX WALK_STEP_FACTOR.
 */
const BOND_WALK_STEP_FACTOR = 0.0002;

/**
 * Per-bond price-volatility multiplier on the walk step. Longer bonds carry more
 * price risk for the same yield move, so the long end walks wider even though
 * the engine drives price directly. Keyed by ISIN; defaults to 1.0.
 */
const BOND_PRICE_VOL: Readonly<Record<string, number>> = {
  ZAG000030108: 0.5, // R186  — short / benchmark
  ZAG000057547: 1.0, // R2030 — mid-curve
  ZAG000074989: 1.6, // R2040 — long end
};

/** Per-bond half-spread in basis points of price. Govt bonds are tight. */
const BOND_HALF_SPREAD_BPS: Readonly<Record<string, number>> = {
  ZAG000030108: 8, // R186
  ZAG000057547: 12, // R2030
  ZAG000074989: 15, // R2040
};
const BOND_DEFAULT_HALF_SPREAD_BPS = 12;

/**
 * Per-bond approximate modified duration (years), used only to carry an implied
 * yield alongside the walked price: %ΔP ≈ −ModDur × Δy ⇒ Δy ≈ −(%ΔP)/ModDur.
 */
const BOND_MOD_DURATION: Readonly<Record<string, number>> = {
  ZAG000030108: 0.6, // R186  — ~7 months residual
  ZAG000057547: 3.2, // R2030
  ZAG000074989: 8.5, // R2040
};
const BOND_DEFAULT_MOD_DURATION = 5;

// ---------------------------------------------------------------------------
// Seed resolution
// ---------------------------------------------------------------------------

export interface BondSeed {
  /** Clean price as % of par. */
  readonly cleanPrice: number;
  /** Yield to maturity (decimal). */
  readonly yield: number;
}

/** Fallback seeds derived from the canonical reference table. */
function referenceSeeds(): Record<string, BondSeed> {
  const seeds: Record<string, BondSeed> = {};
  for (const isin of SA_BOND_ISINS) {
    const ref = SA_BOND_REFERENCE[isin];
    if (ref) seeds[isin] = { cleanPrice: ref.seedCleanPrice, yield: ref.seedYield };
  }
  return seeds;
}

/**
 * Resolve each bond's starting clean price + yield from the most recent
 * **production** jse-debt reference tick, falling back per-bond to the reference
 * approximations. Production-only and jse-debt-source-only so the walk never
 * anchors on its own simulated (`bond-sim`) output.
 */
export function resolveSeedBondPrices(
  store?: MarketDataStore,
  fallback: Record<string, BondSeed> = referenceSeeds(),
): Record<string, BondSeed> {
  const seeds: Record<string, BondSeed> = { ...fallback };
  if (!store) return seeds;
  for (const isin of SA_BOND_ISINS) {
    const tick = store.getLatest(MarketDataSources.JSE_DEBT, isin, undefined, "production");
    if (!tick) continue;
    const cleanPrice = Number(tick.payload.cleanPrice);
    const yieldToMaturity = Number(tick.payload.yieldToMaturity);
    if (Number.isFinite(cleanPrice) && cleanPrice > 0) {
      seeds[isin] = {
        cleanPrice,
        yield:
          Number.isFinite(yieldToMaturity) && yieldToMaturity > 0
            ? yieldToMaturity
            : (seeds[isin]?.yield ?? 0),
      };
    }
  }
  return seeds;
}

// ---------------------------------------------------------------------------
// BondPriceEngine
// ---------------------------------------------------------------------------

export interface BondQuote {
  /** Clean price as % of par. */
  mid: number;
  bid: number;
  ask: number;
  /** Implied yield to maturity (decimal), carried alongside the walked price. */
  yieldToMaturity: number;
}

export class BondPriceEngine {
  private readonly prices: Map<string, number>;
  private readonly yields: Map<string, number>;

  constructor(initial: Record<string, BondSeed> = referenceSeeds()) {
    this.prices = new Map();
    this.yields = new Map();
    for (const [isin, seed] of Object.entries(initial)) {
      this.prices.set(isin, seed.cleanPrice);
      this.yields.set(isin, seed.yield);
    }
  }

  /**
   * Advance the clean price for `isin` by one random-walk step and return
   * bid/mid/ask + the implied yield. The yield is nudged in the opposite
   * direction of the price move via the bond's approximate modified duration.
   */
  tick(isin: string, rng: () => number = Math.random): BondQuote {
    const last = this.prices.get(isin) ?? this.fallbackPrice(isin);
    const lastYield = this.yields.get(isin) ?? this.fallbackYield(isin);
    const vol = BOND_PRICE_VOL[isin] ?? 1;
    const bpsChange = ((rng() + rng()) / 2 - 0.5) * BOND_WALK_STEP_FACTOR * vol;
    const mid = last * (1 + bpsChange);
    this.prices.set(isin, mid);

    // Implied yield: %ΔP ≈ −ModDur × Δy ⇒ Δy ≈ −bpsChange / ModDur.
    const dur = BOND_MOD_DURATION[isin] ?? BOND_DEFAULT_MOD_DURATION;
    const yld = Math.max(0.0001, lastYield - bpsChange / dur);
    this.yields.set(isin, yld);

    return this.buildQuote(isin, mid, yld);
  }

  /** Re-anchor mids + yields from the most recent production jse-debt ticks. */
  reseed(store: MarketDataStore): void {
    const current: Record<string, BondSeed> = {};
    for (const isin of this.prices.keys()) {
      current[isin] = {
        cleanPrice: this.prices.get(isin) ?? this.fallbackPrice(isin),
        yield: this.yields.get(isin) ?? this.fallbackYield(isin),
      };
    }
    const fresh = resolveSeedBondPrices(store, current);
    for (const [isin, seed] of Object.entries(fresh)) {
      this.prices.set(isin, seed.cleanPrice);
      this.yields.set(isin, seed.yield);
    }
  }

  /** Current clean price without advancing the walk. */
  getCleanPrice(isin: string): number {
    return this.prices.get(isin) ?? this.fallbackPrice(isin);
  }

  /** Current implied yield without advancing the walk. */
  getYield(isin: string): number {
    return this.yields.get(isin) ?? this.fallbackYield(isin);
  }

  private buildQuote(isin: string, mid: number, yieldToMaturity: number): BondQuote {
    const halfBps = BOND_HALF_SPREAD_BPS[isin] ?? BOND_DEFAULT_HALF_SPREAD_BPS;
    const half = mid * (halfBps / 10_000);
    return { mid, bid: mid - half, ask: mid + half, yieldToMaturity };
  }

  private fallbackPrice(isin: string): number {
    return SA_BOND_REFERENCE[isin]?.seedCleanPrice ?? 100;
  }

  private fallbackYield(isin: string): number {
    return SA_BOND_REFERENCE[isin]?.seedYield ?? 0.09;
  }
}
