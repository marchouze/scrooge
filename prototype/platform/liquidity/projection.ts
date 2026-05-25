// platform/liquidity/projection.ts
//
// Liquidity projection engine — runs LCR + NSFR for multiple time horizons.
//
// Horizons: T+0, T+7, T+14, T+30, T+90.
//
// The default provider is `makeEventStoreLiquidityInputProvider` backed by
// the composition event store singleton. Tests pass an isolated store via
// `makeEventStoreLiquidityInputProvider(isolatedStore)` explicitly.
//
// Authority: D-TREASURY-GAPS-WAVE1; BANKS-ACT-94-1990; BA 325; BA 326.
// Author: Anya (Liquidity & projections engineer, engineering)

import { eventStore as compositionEventStore } from "../composition";
import type { EventStore } from "../event-store/store";
import { getALMPositionSnapshot } from "../projections/alm-positions";
import { type FundingPosition, type HQLAPosition, type LCRResult, computeLCR } from "./lcr";
import { type ASFItem, type NSFRResult, type RSFItem, computeNSFR } from "./nsfr";

// ---------------------------------------------------------------------------
// Horizon types
// ---------------------------------------------------------------------------

export const PROJECTION_HORIZONS = [0, 7, 14, 30, 90] as const;
export type ProjectionHorizonDays = (typeof PROJECTION_HORIZONS)[number];

/** LCR + NSFR result at a single projection horizon. */
export interface HorizonResult {
  horizonDays: ProjectionHorizonDays;
  lcr: LCRResult;
  nsfr: NSFRResult;
}

/** Full projection result across all five horizons. */
export interface LiquidityProjectionResult {
  /** ISO 8601 date string for the as-of date of this projection run. */
  asOf: string;
  /** Results keyed by horizon day count. */
  horizons: HorizonResult[];
  /** Summary: worst LCR status across horizons. */
  worstLCRStatus: LCRResult["status"];
  /** Summary: worst NSFR status across horizons. */
  worstNSFRStatus: NSFRResult["status"];
}

// ---------------------------------------------------------------------------
// Input provider interface (filled by collateral inventory + position substrates)
// ---------------------------------------------------------------------------

/**
 * Provides HQLA and funding positions for a given horizon.
 * Fulfilled by `makeEventStoreLiquidityInputProvider` in production;
 * tests pass an isolated-store variant.
 */
export interface LiquidityInputProvider {
  getHQLAPositions(asOf: string, horizonDays: ProjectionHorizonDays): HQLAPosition[];
  getFundingPositions(asOf: string, horizonDays: ProjectionHorizonDays): FundingPosition[];
  getASFItems(asOf: string, horizonDays: ProjectionHorizonDays): ASFItem[];
  getRSFItems(asOf: string, horizonDays: ProjectionHorizonDays): RSFItem[];
}

/**
 * Create a `LiquidityInputProvider` backed by the given event store.
 *
 * Calls `getALMPositionSnapshot` once per (asOf, horizonDays) pair and
 * caches the result so the four getters for the same pair share one replay.
 * Pass the composition singleton (`eventStore`) for production; pass an
 * isolated `EventStore` for tests.
 */
export function makeEventStoreLiquidityInputProvider(store: EventStore): LiquidityInputProvider {
  const cache = new Map<string, ReturnType<typeof getALMPositionSnapshot>>();

  function snap(asOf: string, horizonDays: number) {
    const key = `${asOf}:${horizonDays}`;
    let entry = cache.get(key);
    if (entry === undefined) {
      entry = getALMPositionSnapshot(store, asOf, horizonDays);
      cache.set(key, entry);
    }
    return entry;
  }

  return {
    getHQLAPositions: (asOf, h) => [...snap(asOf, h).hqlaPositions],
    getFundingPositions: (asOf, h) => [...snap(asOf, h).fundingPositions],
    getASFItems: (asOf, h) => [...snap(asOf, h).asfItems],
    getRSFItems: (asOf, h) => [...snap(asOf, h).rsfItems],
  };
}

// ---------------------------------------------------------------------------
// Status severity ordering (for worst-case aggregation)
// ---------------------------------------------------------------------------

const STATUS_SEVERITY: Record<string, number> = {
  "above-minimum": 0,
  "no-positions": 1,
  "at-minimum": 2,
  "below-minimum": 3,
};

function worseLCRStatus(a: LCRResult["status"], b: LCRResult["status"]): LCRResult["status"] {
  return (STATUS_SEVERITY[a] ?? 0) >= (STATUS_SEVERITY[b] ?? 0) ? a : b;
}

function worseNSFRStatus(a: NSFRResult["status"], b: NSFRResult["status"]): NSFRResult["status"] {
  return (STATUS_SEVERITY[a] ?? 0) >= (STATUS_SEVERITY[b] ?? 0) ? a : b;
}

// ---------------------------------------------------------------------------
// Main projection runner
// ---------------------------------------------------------------------------

/**
 * Run the full liquidity projection for all five horizons.
 *
 * @param asOf      ISO 8601 date string (e.g. "2026-05-19").
 * @param provider  Input provider. Defaults to the live event-store provider
 *                  backed by the composition singleton. Pass
 *                  `makeEventStoreLiquidityInputProvider(isolatedStore)` in
 *                  tests to avoid touching the shared store.
 * @returns LiquidityProjectionResult across T+0, T+7, T+14, T+30, T+90.
 */
export function runLiquidityProjection(
  asOf: string,
  provider: LiquidityInputProvider = makeEventStoreLiquidityInputProvider(compositionEventStore),
): LiquidityProjectionResult {
  const horizons: HorizonResult[] = [];

  let worstLCR: LCRResult["status"] = "above-minimum";
  let worstNSFR: NSFRResult["status"] = "above-minimum";

  for (const horizonDays of PROJECTION_HORIZONS) {
    const hqlaPositions = provider.getHQLAPositions(asOf, horizonDays);
    const fundingPositions = provider.getFundingPositions(asOf, horizonDays);
    const asfItems = provider.getASFItems(asOf, horizonDays);
    const rsfItems = provider.getRSFItems(asOf, horizonDays);

    const lcr = computeLCR(hqlaPositions, fundingPositions);
    const nsfr = computeNSFR(asfItems, rsfItems);

    horizons.push({ horizonDays, lcr, nsfr });
    worstLCR = worseLCRStatus(worstLCR, lcr.status);
    worstNSFR = worseNSFRStatus(worstNSFR, nsfr.status);
  }

  return {
    asOf,
    horizons,
    worstLCRStatus: worstLCR,
    worstNSFRStatus: worstNSFR,
  };
}
