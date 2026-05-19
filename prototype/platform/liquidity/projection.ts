// platform/liquidity/projection.ts
//
// Liquidity projection engine — runs LCR + NSFR for multiple time horizons.
//
// Horizons: T+0, T+7, T+14, T+30, T+90.
//
// In the build phase, HQLA positions and funding positions are read from the
// event store. With no positions, each horizon returns the "no-positions"
// baseline result. As the collateral inventory and position projection
// substrates land (Tomas + Ravi), the inputs will be populated from live
// events rather than this stub.
//
// Authority: D-TREASURY-GAPS-WAVE1; BANKS-ACT-94-1990; BA 325; BA 326.
// Author: Anya (Liquidity & projections engineer, engineering)

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
 *
 * In build phase the default implementation returns empty arrays.
 * Once Tomas's collateral inventory and Ravi's ALM substrate land,
 * this interface will be fulfilled by an event-store query.
 */
export interface LiquidityInputProvider {
  getHQLAPositions(asOf: string, horizonDays: ProjectionHorizonDays): HQLAPosition[];
  getFundingPositions(asOf: string, horizonDays: ProjectionHorizonDays): FundingPosition[];
  getASFItems(asOf: string, horizonDays: ProjectionHorizonDays): ASFItem[];
  getRSFItems(asOf: string, horizonDays: ProjectionHorizonDays): RSFItem[];
}

/** Build-phase no-op provider — returns empty positions for all horizons. */
const buildPhaseProvider: LiquidityInputProvider = {
  getHQLAPositions: () => [],
  getFundingPositions: () => [],
  getASFItems: () => [],
  getRSFItems: () => [],
};

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
 * @param asOf  ISO 8601 date string (e.g. "2026-05-19").
 * @param provider  Input provider (defaults to build-phase no-op).
 * @returns LiquidityProjectionResult across T+0, T+7, T+14, T+30, T+90.
 */
export function runLiquidityProjection(
  asOf: string,
  provider: LiquidityInputProvider = buildPhaseProvider,
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
