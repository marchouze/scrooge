// platform/liquidity/lcr.ts
//
// Liquidity Coverage Ratio (LCR) computation engine.
//
// LCR = HQLA / Net Cash Outflows (30-day stress)
//
// where:
//   Net Cash Outflows = stressed outflows − min(stressed inflows, 75% × stressed outflows)
//
// HQLA haircuts (BA 325 Annex 1 / Basel III):
//   L1:  0%  haircut — cash, central bank reserves, 0% RW sovereign bonds
//   L2a: 15% haircut — 20% RW sovereign bonds; qualifying corporate bonds AA- or better
//   L2b: 25–50% haircut — qualifying equities; BBB- to A+ corporate bonds
//
//   L2 cap:  L2 total ≤ 40% of total HQLA (post-haircut)
//   L2b cap: L2b ≤ 15% of total HQLA (post-haircut)
//
// Run-off rates (build phase, SA BA 325 calibration):
//   Retail deposits stable:            3%
//   Retail deposits less stable:      10%
//   Unsecured wholesale operational:  25%
//   Unsecured wholesale non-operational: 100%
//   Secured funding — Level 1 collateral:  0%
//   Secured funding — Level 2 collateral: 15%
//
// Authority: D-TREASURY-GAPS-WAVE1; BANKS-ACT-94-1990; BA 325.
// Author: Anya (Liquidity & projections engineer, engineering)
//
// Calibration constants (run-off / inflow / haircut rates, caps, minimum,
// tolerance) are owned in platform/config/financial-constants.ts — objective 2
// of D-TRUSTED-FIGURES-PROGRAM-V1. This file reads them; it holds no inline
// rate tables.

import {
  getFinancialConstant,
  lcrHaircutRates,
  lcrRunoffRates,
} from "../config/financial-constants";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** A single HQLA position entering the LCR stock calculation. */
export interface HQLAPosition {
  /** Market value in ZAR before haircut. */
  amountZar: number;
  /** HQLA tier as defined in BA 325 Annex 1. */
  tier: "L1" | "L2a" | "L2b";
}

/** A single funding/outflow position contributing to net cash outflows. */
export interface FundingPosition {
  amountZar: number;
  category:
    | "retail-stable"
    | "retail-less-stable"
    | "wholesale-operational"
    | "wholesale-non-operational"
    | "secured-level1"
    | "secured-level2"
    | "inflow-contractual"
    | "inflow-other";
}

// ---------------------------------------------------------------------------
// Run-off rates (BA 325 calibration)
// ---------------------------------------------------------------------------

const RUNOFF_RATES: Record<string, number> = lcrRunoffRates();

const INFLOW_RATE_CONTRACTUAL = getFinancialConstant("lcr.inflow.contractual");
const INFLOW_RATE_OTHER = getFinancialConstant("lcr.inflow.other");

// ---------------------------------------------------------------------------
// HQLA haircut rates (BA 325 Annex 1) — owned in financial-constants
// ---------------------------------------------------------------------------

const HAIRCUT_RATES: Record<string, number> = lcrHaircutRates();

// ---------------------------------------------------------------------------
// LCR result type
// ---------------------------------------------------------------------------

export type LCRStatus = "above-minimum" | "at-minimum" | "below-minimum" | "no-positions";

export interface LCRResult {
  /** LCR as a percentage (e.g. 120 = 120%). Null when no positions exist. */
  lcrRatioPct: number | null;
  /** Status of the LCR relative to the regulatory minimum (100%). */
  status: LCRStatus;
  /** Post-haircut HQLA stock in ZAR. */
  hqlaZar: number;
  /** Net cash outflows over the 30-day stress horizon in ZAR. */
  netCashOutflowsZar: number;
  /** Breakdown detail for audit and dashboard. */
  detail: LCRDetail;
}

export interface LCRDetail {
  /** L1 HQLA post-haircut. */
  l1Zar: number;
  /** L2a HQLA post-haircut (before cap application). */
  l2aZar: number;
  /** L2b HQLA post-haircut (before cap application). */
  l2bZar: number;
  /** Total stressed outflows. */
  stressedOutflowsZar: number;
  /** Total stressed inflows (before 75% cap). */
  stressedInflowsZar: number;
  /** Whether the L2 cap was binding. */
  l2CapBinding: boolean;
  /** Whether the L2b cap was binding. */
  l2bCapBinding: boolean;
}

// ---------------------------------------------------------------------------
// LCR computation
// ---------------------------------------------------------------------------

/** Regulatory minimum LCR as a ratio (1.00 = 100%). */
export const LCR_MINIMUM_RATIO = getFinancialConstant("lcr.minimum-ratio");

/** "At-minimum" tolerance band, in percentage points above the minimum. */
const AT_MINIMUM_TOLERANCE_PCT = getFinancialConstant("lcr.at-minimum-tolerance-pct");

/**
 * Compute the Liquidity Coverage Ratio from positions.
 *
 * Build-phase behaviour: when both `hqlaPositions` and `fundingPositions`
 * are empty (or sum to zero), returns `status: "no-positions"`.
 *
 * @param hqlaPositions  HQLA stock positions (before haircut).
 * @param fundingPositions  Outflow and inflow positions over 30-day horizon.
 * @returns Computed LCR result.
 */
export function computeLCR(
  hqlaPositions: HQLAPosition[],
  fundingPositions: FundingPosition[],
): LCRResult {
  // -------------------------------------------------------------------------
  // Zero-position early exit (build phase)
  // -------------------------------------------------------------------------
  const totalPositions =
    hqlaPositions.reduce((s, p) => s + p.amountZar, 0) +
    fundingPositions.reduce((s, p) => s + p.amountZar, 0);

  if (totalPositions === 0) {
    return {
      lcrRatioPct: null,
      status: "no-positions",
      hqlaZar: 0,
      netCashOutflowsZar: 0,
      detail: {
        l1Zar: 0,
        l2aZar: 0,
        l2bZar: 0,
        stressedOutflowsZar: 0,
        stressedInflowsZar: 0,
        l2CapBinding: false,
        l2bCapBinding: false,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Step 1 — Compute HQLA stock (post-haircut, with caps)
  // -------------------------------------------------------------------------

  let l1Raw = 0;
  let l2aRaw = 0;
  let l2bRaw = 0;

  for (const pos of hqlaPositions) {
    const haircut = HAIRCUT_RATES[pos.tier] ?? 0;
    const postHaircut = pos.amountZar * (1 - haircut);
    if (pos.tier === "L1") l1Raw += postHaircut;
    else if (pos.tier === "L2a") l2aRaw += postHaircut;
    else if (pos.tier === "L2b") l2bRaw += postHaircut;
  }

  // Apply caps iteratively:
  // (a) Uncapped HQLA = L1 + L2a + L2b
  // (b) L2b cap: L2b ≤ 15/85 × L1 (which equals L2b ≤ 15% of total HQLA)
  //     Equivalently: L2b ≤ (15/85) × L1 post-haircut
  // (c) L2 cap: (L2a + L2b_capped) ≤ (40/60) × L1
  //
  // BA 325 §37-40: caps expressed as fractions of total HQLA.
  // Let H = L1 + L2. Then L2 ≤ 0.40 × H → L2 ≤ (40/60) × L1.
  // Similarly L2b ≤ 0.15 × H → L2b ≤ (15/85) × L1.

  // Caps are owned as fractions of total HQLA; converted here to the
  // equivalent L1-relative bound: cap_of_hqla / (1 − cap_of_hqla) × L1.
  const l2bCapOfHqla = getFinancialConstant("lcr.cap.l2b-of-hqla");
  const l2CapOfHqla = getFinancialConstant("lcr.cap.l2-of-hqla");

  const l2bCap = (l2bCapOfHqla / (1 - l2bCapOfHqla)) * l1Raw;
  const l2bCapped = Math.min(l2bRaw, l2bCap);
  const l2bCapBinding = l2bRaw > l2bCap;

  const l2Cap = (l2CapOfHqla / (1 - l2CapOfHqla)) * l1Raw;
  const l2Combined = l2aRaw + l2bCapped;
  let l2CapBinding = false;
  let l2aFinal = l2aRaw;
  let l2bFinal = l2bCapped;

  if (l2Combined > l2Cap) {
    l2CapBinding = true;
    // Scale down proportionally within L2 (pro-rata between L2a and L2b)
    if (l2Combined > 0) {
      const scale = l2Cap / l2Combined;
      l2aFinal = l2aRaw * scale;
      l2bFinal = l2bCapped * scale;
    } else {
      l2aFinal = 0;
      l2bFinal = 0;
    }
  }

  const hqla = l1Raw + l2aFinal + l2bFinal;

  // -------------------------------------------------------------------------
  // Step 2 — Compute stressed outflows and inflows
  // -------------------------------------------------------------------------

  let stressedOutflows = 0;
  let stressedInflows = 0;

  for (const pos of fundingPositions) {
    if (pos.category.startsWith("inflow-")) {
      // Inflows
      const rate =
        pos.category === "inflow-contractual" ? INFLOW_RATE_CONTRACTUAL : INFLOW_RATE_OTHER;
      stressedInflows += pos.amountZar * rate;
    } else {
      // Outflows
      const runoffRate = RUNOFF_RATES[pos.category] ?? 0;
      stressedOutflows += pos.amountZar * runoffRate;
    }
  }

  // -------------------------------------------------------------------------
  // Step 3 — Net cash outflows (BA 325 §19)
  // -------------------------------------------------------------------------
  // Net outflows = stressed outflows − min(stressed inflows, 75% × stressed outflows)
  const inflowCap = getFinancialConstant("lcr.inflow-recognition-cap") * stressedOutflows;
  const recognisedInflows = Math.min(stressedInflows, inflowCap);
  const netCashOutflows = Math.max(stressedOutflows - recognisedInflows, 0);

  // -------------------------------------------------------------------------
  // Step 4 — LCR ratio
  // -------------------------------------------------------------------------
  let lcrRatioPct: number | null = null;
  let status: LCRStatus = "no-positions";

  if (netCashOutflows > 0) {
    lcrRatioPct = (hqla / netCashOutflows) * 100;
    if (lcrRatioPct < LCR_MINIMUM_RATIO * 100) {
      status = "below-minimum";
    } else if (lcrRatioPct <= LCR_MINIMUM_RATIO * 100 + AT_MINIMUM_TOLERANCE_PCT) {
      status = "at-minimum";
    } else {
      status = "above-minimum";
    }
  } else if (hqla > 0) {
    // HQLA present but zero net outflows → effectively infinite LCR
    lcrRatioPct = null; // represent as ∞; caller should handle this
    status = "above-minimum";
  }

  return {
    lcrRatioPct,
    status,
    hqlaZar: hqla,
    netCashOutflowsZar: netCashOutflows,
    detail: {
      l1Zar: l1Raw,
      l2aZar: l2aFinal,
      l2bZar: l2bFinal,
      stressedOutflowsZar: stressedOutflows,
      stressedInflowsZar: stressedInflows,
      l2CapBinding,
      l2bCapBinding,
    },
  };
}
