// platform/reporting/ba-320-ir-maturity-bands.ts
//
// Shared BA 320 interest-rate general-risk maturity-band table (Reg 28(3)(a)
// Table A — standardised maturity method) and band-slotting helpers.
//
// ─── WHY THIS MODULE EXISTS (WS-BA-RETURNS-FOLLOWON G1) ─────────────────────
// The BA 320 IR general-risk maturity ladder is fed by two adapters:
//   - ba-320-bond-events-adapter.ts (BondTradeExecuted → notional × bandWeight)
//   - ba-320-irs-events-adapter.ts  (IRS maturity-method notional legs)
// Both must slot positions into the SAME 13 maturity bands at the SAME risk
// weights and produce rows in the SAME unit (`notionalMinor × bandRiskWeight`).
// Keeping two private copies of the band table risked silent divergence (the
// original G1 defect was that the IRS adapter fed raw DV01 — a completely
// different unit — into the same accumulators). This module is the single
// source of the band vocabulary, the risk weights, and the slotting rules so
// the two adapters are structurally guaranteed to be commensurate.
//
// THE WEIGHTING BASIS is named explicitly (`MATURITY_METHOD_WEIGHTED_NOMINAL`)
// and stamped onto every row both adapters emit, so the combiner
// (`combineIrGeneralLadders`) can REFUSE to merge a row carrying a foreign /
// missing basis. A raw-DV01 row reintroduced into the ladder would carry no
// (or a different) basis tag and be rejected at runtime — and the
// `recon:ba320-ir-general-weighting-basis` guard fails statically if a foreign
// basis is ever fed.
//
// Authority:
//   - Regulations Relating to Banks Reg 28(3)(a) Table A (maturity method)
//   - Reg 28(5)(b) (standardised maturity bands)
//   - BCBS D352 §718(b) (general market risk — maturity method)
//   - BCBS d368 §21 (standardised tenor bands)
//   - D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (CEO-approved 2026-06-09)
//   - D-IRS-DV01-BUCKETING-CALIBRATION (G1 weighting-basis unification)
//   - Principles/2-single-graph-discipline.md (single source, no orphan copies)
//
// Author: Mira (Regulatory reporting engineer, engineering)

import type { BaselMaturityBand } from "../types/basel";

// ---------------------------------------------------------------------------
// Weighting basis discriminator
// ---------------------------------------------------------------------------

/**
 * The single weighting basis every row feeding `combineIrGeneralLadders` MUST
 * carry. Both the bond adapter (`notionalMinor × bandRiskWeight`) and the IRS
 * adapter (maturity-method notional legs, also `notionalMinor × bandRiskWeight`)
 * produce rows on this basis. Any row carrying a different — or absent — basis
 * (e.g. a reintroduced raw-DV01 row, rand-per-bp) is dimensionally
 * incommensurate and is rejected by the combiner.
 *
 * Authority: D-IRS-DV01-BUCKETING-CALIBRATION; Reg 28(3)(a) Table A.
 */
export const MATURITY_METHOD_WEIGHTED_NOMINAL = "maturity-method-weighted-nominal" as const;

export type IrGeneralWeightingBasis = typeof MATURITY_METHOD_WEIGHTED_NOMINAL;

// ---------------------------------------------------------------------------
// Reg 28(3)(a) maturity band definitions — standardised maturity method
// ---------------------------------------------------------------------------

/**
 * Single maturity band entry for Reg 28(3)(a) Table A.
 * Residual years (or time-to-next-reset, for floating legs) from periodEnd
 * determines the band. Risk weight is for coupon >= 3% positions.
 */
export interface MaturityBandDef {
  /** Band identifier used in IrMaturityBandRow.band. */
  readonly band: BaselMaturityBand;
  /** Upper bound in years (inclusive). */
  readonly upperYears: number;
  /** Risk weight (fraction, e.g. 0.002 = 0.20%). */
  readonly riskWeight: number;
}

/**
 * Reg 28(3)(a) Table A — 13 maturity bands, coupon ≥ 3%.
 * Ordered shortest to longest. Match is first band where residualYears ≤ upperYears.
 *
 * Risk weights per Reg 28(3)(a) Table A (coupon ≥ 3%):
 *   ≤1M=0.00%, 1-3M=0.20%, 3-6M=0.40%, 6-12M=0.70%, 1-2Y=1.25%,
 *   2-3Y=1.75%, 3-4Y=2.25%, 4-5Y=2.75%, 5-7Y=3.25%, 7-10Y=3.75%,
 *   10-15Y=4.50%, 15-20Y=5.25%, >20Y=6.00%
 */
export const MATURITY_BANDS: readonly MaturityBandDef[] = [
  { band: "0-1m", upperYears: 1 / 12, riskWeight: 0.0 },
  { band: "1-3m", upperYears: 3 / 12, riskWeight: 0.002 },
  { band: "3-6m", upperYears: 6 / 12, riskWeight: 0.004 },
  { band: "6-12m", upperYears: 12 / 12, riskWeight: 0.007 },
  { band: "1-2y", upperYears: 2, riskWeight: 0.0125 },
  { band: "2-3y", upperYears: 3, riskWeight: 0.0175 },
  { band: "3-4y", upperYears: 4, riskWeight: 0.0225 },
  { band: "4-5y", upperYears: 5, riskWeight: 0.0275 },
  { band: "5-7y", upperYears: 7, riskWeight: 0.0325 },
  { band: "7-10y", upperYears: 10, riskWeight: 0.0375 },
  { band: "10-15y", upperYears: 15, riskWeight: 0.045 },
  { band: "15-20y", upperYears: 20, riskWeight: 0.0525 },
  { band: ">20y", upperYears: Number.POSITIVE_INFINITY, riskWeight: 0.06 },
] as const;

/** Stable band order for emitting / iterating rows (shortest → longest). */
export const BA320_BAND_ORDER: readonly BaselMaturityBand[] = MATURITY_BANDS.map((b) => b.band);

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365;

/**
 * Residual term in years from `periodEnd` to `targetDate` (a maturity date or a
 * next-reset date). Returns 0 if the target is on / before periodEnd.
 */
export function residualYears(periodEnd: string, targetDate: string): number {
  const endMs = Date.parse(`${periodEnd.slice(0, 10)}T00:00:00Z`);
  const tgtMs = Date.parse(`${targetDate.slice(0, 10)}T00:00:00Z`);
  const diffMs = tgtMs - endMs;
  if (diffMs <= 0) return 0; // already matured / already reset
  return diffMs / (MS_PER_DAY * DAYS_PER_YEAR);
}

/**
 * Find the Reg 28(3)(a) maturity band for a position with the given residual
 * term (years). Returns undefined if the term is ≤ 0 (already matured / reset).
 */
export function assignMaturityBand(years: number): MaturityBandDef | undefined {
  if (years <= 0) return undefined;
  for (const band of MATURITY_BANDS) {
    if (years <= band.upperYears) return band;
  }
  // Safety: should never reach here (last band is +∞).
  return MATURITY_BANDS[MATURITY_BANDS.length - 1];
}
