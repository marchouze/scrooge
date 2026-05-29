// platform/liquidity/nsfr.ts
//
// Net Stable Funding Ratio (NSFR) computation engine.
//
// NSFR = Available Stable Funding (ASF) / Required Stable Funding (RSF)
//
// ASF weights (BA 326 / Basel III):
//   Tier 1/2 capital > 1Y:                          100%
//   Retail deposits stable < 1Y:                     95%
//   Retail deposits less stable < 1Y:                90%
//   Wholesale deposits > 1Y:                        100%
//   Wholesale deposits < 1Y operational:             50%
//   Wholesale deposits < 1Y non-operational:          0%
//
// RSF weights (BA 326 / Basel III):
//   HQLA L1:                                          5%
//   HQLA L2a:                                        15%
//   HQLA L2b:                                        50%
//   Loans < 6M:                                      10%
//   Loans 6M–1Y:                                     50%
//   Loans > 1Y:                                      65%  (standard); 85% for residential
//   Securities < 1Y maturity:                        10%
//   Securities > 1Y non-HQLA:                        85%
//   Operational deposits placed at other FIs:        10%
//   Derivatives (net):                              100%  (simplified; full netting complex)
//
// Authority: D-TREASURY-GAPS-WAVE1; BANKS-ACT-94-1990; BA 326.
// Author: Anya (Liquidity & projections engineer, engineering)
//
// ASF/RSF weights, the regulatory minimum and the tolerance band are owned in
// platform/config/financial-constants.ts (objective 2 of D-TRUSTED-FIGURES-
// PROGRAM-V1). This file reads them; it holds no inline weight tables.

import {
  getFinancialConstant,
  nsfrAsfWeights,
  nsfrRsfWeights,
} from "../config/financial-constants";
import { requireWeight } from "../types/financial-input";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** A single Available Stable Funding source. */
export interface ASFItem {
  /** Amount in ZAR. */
  amountZar: number;
  /** ASF category from the BA 326 table. */
  category:
    | "tier1-capital"
    | "tier2-capital-gt1y"
    | "retail-stable-lt1y"
    | "retail-less-stable-lt1y"
    | "wholesale-gt1y"
    | "wholesale-lt1y-operational"
    | "wholesale-lt1y-non-operational";
}

/** A single Required Stable Funding item. */
export interface RSFItem {
  /** Amount in ZAR (market value or book value as appropriate). */
  amountZar: number;
  /** RSF category from the BA 326 table. */
  category:
    | "hqla-l1"
    | "hqla-l2a"
    | "hqla-l2b"
    | "loan-lt6m"
    | "loan-6m-1y"
    | "loan-gt1y-standard"
    | "loan-gt1y-residential"
    | "security-lt1y"
    | "security-gt1y-non-hqla"
    | "operational-deposit-at-fi"
    | "derivative-net";
}

// ---------------------------------------------------------------------------
// ASF and RSF weight tables (BA 326)
// ---------------------------------------------------------------------------

const ASF_WEIGHTS: Record<string, number> = nsfrAsfWeights();

const RSF_WEIGHTS: Record<string, number> = nsfrRsfWeights();

// ---------------------------------------------------------------------------
// NSFR result type
// ---------------------------------------------------------------------------

export type NSFRStatus = "above-minimum" | "at-minimum" | "below-minimum" | "no-positions";

export interface NSFRResult {
  /** NSFR as a percentage (e.g. 115 = 115%). Null when no positions exist. */
  nsfrRatioPct: number | null;
  /** Status relative to regulatory minimum (100%). */
  status: NSFRStatus;
  /** Total Available Stable Funding in ZAR. */
  asfZar: number;
  /** Total Required Stable Funding in ZAR. */
  rsfZar: number;
  /** Breakdown detail. */
  detail: NSFRDetail;
}

export interface NSFRDetail {
  /** Weighted ASF total. */
  weightedAsf: number;
  /** Weighted RSF total. */
  weightedRsf: number;
  /** ASF item count. */
  asfItemCount: number;
  /** RSF item count. */
  rsfItemCount: number;
}

// ---------------------------------------------------------------------------
// NSFR computation
// ---------------------------------------------------------------------------

/** Regulatory minimum NSFR ratio. */
export const NSFR_MINIMUM_RATIO = getFinancialConstant("nsfr.minimum-ratio");

/** "At-minimum" tolerance band, in percentage points above the minimum. */
const AT_MINIMUM_TOLERANCE_PCT = getFinancialConstant("nsfr.at-minimum-tolerance-pct");

/**
 * Compute the Net Stable Funding Ratio.
 *
 * Build-phase behaviour: when both `asfItems` and `rsfItems` are empty
 * (or sum to zero), returns `status: "no-positions"`.
 *
 * @param asfItems  Available stable funding sources.
 * @param rsfItems  Required stable funding items (assets/obligations needing funding).
 * @returns Computed NSFR result.
 */
export function computeNSFR(asfItems: ASFItem[], rsfItems: RSFItem[]): NSFRResult {
  // -------------------------------------------------------------------------
  // Zero-position early exit (build phase)
  // -------------------------------------------------------------------------
  const totalPositions =
    asfItems.reduce((s, p) => s + p.amountZar, 0) + rsfItems.reduce((s, p) => s + p.amountZar, 0);

  if (totalPositions === 0) {
    return {
      nsfrRatioPct: null,
      status: "no-positions",
      asfZar: 0,
      rsfZar: 0,
      detail: {
        weightedAsf: 0,
        weightedRsf: 0,
        asfItemCount: 0,
        rsfItemCount: 0,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Compute weighted ASF
  // -------------------------------------------------------------------------
  let asf = 0;
  for (const item of asfItems) {
    const weight = requireWeight(ASF_WEIGHTS, item.category, "nsfr.asf");
    asf += item.amountZar * weight;
  }

  // -------------------------------------------------------------------------
  // Compute weighted RSF
  // -------------------------------------------------------------------------
  let rsf = 0;
  for (const item of rsfItems) {
    const weight = requireWeight(RSF_WEIGHTS, item.category, "nsfr.rsf");
    rsf += item.amountZar * weight;
  }

  // -------------------------------------------------------------------------
  // NSFR ratio
  // -------------------------------------------------------------------------
  let nsfrRatioPct: number | null = null;
  let status: NSFRStatus = "no-positions";

  if (rsf > 0) {
    nsfrRatioPct = (asf / rsf) * 100;
    if (nsfrRatioPct < NSFR_MINIMUM_RATIO * 100) {
      status = "below-minimum";
    } else if (nsfrRatioPct <= NSFR_MINIMUM_RATIO * 100 + AT_MINIMUM_TOLERANCE_PCT) {
      status = "at-minimum";
    } else {
      status = "above-minimum";
    }
  } else if (asf > 0) {
    nsfrRatioPct = null; // effectively infinite
    status = "above-minimum";
  }

  return {
    nsfrRatioPct,
    status,
    asfZar: asf,
    rsfZar: rsf,
    detail: {
      weightedAsf: asf,
      weightedRsf: rsf,
      asfItemCount: asfItems.length,
      rsfItemCount: rsfItems.length,
    },
  };
}
