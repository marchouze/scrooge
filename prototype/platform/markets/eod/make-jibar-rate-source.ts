// platform/markets/eod/make-jibar-rate-source.ts
//
// Factory and live-store implementation for IrsRateSource — closes GAP-IRS-1.
//
// Provides:
//   - MarketDataStoreJibarRateSource: IrsRateSource backed by a live
//     swap-curve-snapshot tick from MarketDataStore. Uses identical
//     log-linear interpolation as StaticJibarRateSource.
//   - makeJibarRateSource(): factory that returns the store-backed source
//     when a snapshot is available, falling back to the static singleton.
//
// Why a separate file
// -------------------
// jibar-curve-seed.ts is a pure-math module (no I/O dependencies). Importing
// MarketDataStore into that file would introduce a dep from
// `platform/markets/eod/` into `platform/market-data/` — and from there
// transitively into bun:sqlite. Keeping this factory in its own file preserves
// the pure-math module's test isolation and avoids circular imports.
//
// Substrate gap closed
// --------------------
// [GAP-IRS-1] in jibar-curve-seed.ts: "Curve is a static seed. Real
// production integration: Ravi's IRRBB / yield-curve substrate."
// This file + the jibar-swap-curve-ingester + the swap-curve fixture seeds
// together close GAP-IRS-1 for the build phase. Post-licence, swapping the
// fixture source for a live SARB/Bloomberg feed is the only remaining step.
//
// Authority
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - Team/Ravi.md — IRS pricing conventions
//
// Author: Ravi (Treasury / ALM engineer, engineering)

import type { MarketDataStore } from "../../market-data/store";
import {
  CURVE_NODES,
  type IrsRateSource,
  JIBAR_TENOR_DAYS,
  interpolateDiscountFactorFromNodes,
  staticJibarRateSource,
} from "./jibar-curve-seed";

// ---------------------------------------------------------------------------
// MarketDataStoreJibarRateSource
// ---------------------------------------------------------------------------

/**
 * IrsRateSource backed by a live swap-curve-snapshot tick in MarketDataStore.
 *
 * On construction, reads the latest tick for source="jibar-swap-sarb",
 * instrument="SWAPJIBAR" (optionally bounded by `asOf`). If no tick is
 * found, falls back to the static CURVE_NODES — callers should prefer
 * `makeJibarRateSource()` to get the right source automatically.
 *
 * Uses identical log-linear interpolation as StaticJibarRateSource
 * (`interpolateDiscountFactorFromNodes`).
 */
export class MarketDataStoreJibarRateSource implements IrsRateSource {
  private readonly nodes: Array<{ days: number; df: number }>;

  constructor(store: MarketDataStore, asOf?: string) {
    const ticks = store.query({
      source: "jibar-swap-sarb",
      instrument: "SWAPJIBAR",
      provenance: "production",
      ...(asOf ? { to: asOf } : {}),
      limit: 1,
    });
    const tick = ticks[0];
    if (!tick) {
      // Fall back to static curve nodes when store has no snapshot.
      this.nodes = [...CURVE_NODES];
      return;
    }
    const payload = tick.payload as unknown as { discountFactors: Record<string, number> };
    this.nodes = Object.entries(JIBAR_TENOR_DAYS)
      .map(([tenor, days]) => ({
        days,
        df: payload.discountFactors[tenor] ?? 1,
      }))
      .sort((a, b) => a.days - b.days);
  }

  getDiscountFactor(tenorDays: number): number {
    return interpolateDiscountFactorFromNodes(this.nodes, tenorDays);
  }

  getForwardJibar(periodStartDays: number, periodEndDays: number): number {
    if (periodEndDays <= periodStartDays) {
      throw new Error("MarketDataStoreJibarRateSource: periodEndDays must exceed periodStartDays");
    }
    const dfStart = this.getDiscountFactor(periodStartDays);
    const dfEnd = this.getDiscountFactor(periodEndDays);
    if (dfEnd <= 0) {
      throw new Error("MarketDataStoreJibarRateSource: dfEnd must be positive");
    }
    const dcf = (periodEndDays - periodStartDays) / 365;
    return (dfStart / dfEnd - 1) / dcf;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Factory: returns `MarketDataStoreJibarRateSource` if a swap-curve-snapshot
 * tick exists in the store for the given `asOf` (or latest), otherwise falls
 * back to the static singleton.
 *
 * Callers should always use this factory — they always get a valid
 * `IrsRateSource` regardless of whether the store has been seeded.
 *
 * @param store  The MarketDataStore to query.
 * @param asOf   Optional ISO 8601 timestamp bounding the tick lookup.
 */
export function makeJibarRateSource(store: MarketDataStore, asOf?: string): IrsRateSource {
  const ticks = store.query({
    source: "jibar-swap-sarb",
    instrument: "SWAPJIBAR",
    provenance: "production",
    ...(asOf ? { to: asOf } : {}),
    limit: 1,
  });
  return ticks[0] ? new MarketDataStoreJibarRateSource(store, asOf) : staticJibarRateSource;
}
