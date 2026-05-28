// platform/accounting/ifrs9-staging.ts
//
// IFRS 9 impairment staging engine — pure functions, no side effects.
//
// Implements the simplified build-phase three-stage classification under
// IFRS 9 §5.5 (Expected Credit Loss model). The full PD/LGD/EAD model is
// a licence-day deliverable; build-phase rates are conservative placeholders
// consistent with the bank's pre-licence risk appetite.
//
// Stage rules (build-phase):
//   Stage 3 (credit-impaired):   dpd ≥ 90, defaultIndicator, or restructured
//   Stage 2 (SICR):              dpd ≥ 30 or manualSicr (analyst-flagged)
//   Stage 1 (performing):        all other instruments
//
// ECL rates by stage + product family:
//   Stage 1 — government / money-market / high-grade (bond, repo, money-market):  5 bps
//   Stage 1 — trading book (equity, irs, fx-swap):                               15 bps
//   Stage 2 — all families:                                                      100 bps
//   Stage 3 — all families:                                                     5000 bps
//
// computeEcl(notionalMinor, eclBps) = round(notionalMinor × eclBps / 10000)
//
// Regulatory chain:
//   IFRS-9-§5.5 → FIN-ACCT-01 (IFRS accounting policy) → PROC-IFRS9-STAGE-01
//   → assessIfrs9Stage()
//
// Authority:
//   - D-IFRS9-STAGING-V1 (CEO-approved 2026-05-28)
//   - D-IFRS-THRESHOLDS-V13 (SICR thresholds, 2026-05-27)
//   - IFRS 9 §5.5.1–§5.5.17
//   - Regulations Relating to Banks Reg 23 (default definition)
//
// Author: Atlas (Core banking platform architect, engineering)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for an IFRS 9 stage assessment on a single instrument.
 * All credit-quality indicators default to "performing" in the build phase.
 */
export interface IfrsAssessmentParams {
  /** Days past due (0 for performing instruments). */
  dpd: number;
  /** Credit analyst has flagged a Significant Increase in Credit Risk (SICR). */
  manualSicr: boolean;
  /** Loan / instrument has been restructured. */
  restructured: boolean;
  /** Formal default per Regulations Relating to Banks Reg 23. */
  defaultIndicator: boolean;
  /**
   * Product family — used to select the Stage-1 ECL rate bucket.
   * "bond" | "repo" | "money-market" → low-risk bucket (5 bps Stage 1)
   * "equity" | "irs" | "fx-swap"     → trading-book bucket (15 bps Stage 1)
   */
  productFamily: string;
  /** Notional amount in minor currency units (e.g. ZAR cents). */
  notionalMinor: number;
  /** ISO 4217 currency code (e.g. "ZAR"). */
  currency: string;
}

/**
 * Output of an IFRS 9 stage assessment.
 */
export interface Ifrs9StageResult {
  /** IFRS 9 impairment stage (1, 2, or 3). */
  stage: 1 | 2 | 3;
  /** ECL rate in basis points (e.g. 5 = 0.05%). */
  eclBasisPoints: number;
  /** ECL provision amount in minor currency units. */
  eclAmountMinor: number;
  /**
   * Machine-readable trigger reason.
   * Stage 1: "initial-recognition"
   * Stage 2: "30-dpd" | "manual-sicr"
   * Stage 3: "90-dpd" | "restructured" | "default"
   */
  triggerReason: string;
}

// ---------------------------------------------------------------------------
// ECL rate table
// ---------------------------------------------------------------------------

/**
 * Low-risk product families: government-adjacent, money-market, and secured
 * lending. Conservative Stage-1 ECL rate: 5 bps.
 */
const LOW_RISK_FAMILIES = new Set(["bond", "repo", "money-market"]);

/**
 * Stage-1 ECL rate in basis points by product-family risk bucket.
 */
function stage1BasisPoints(productFamily: string): number {
  return LOW_RISK_FAMILIES.has(productFamily) ? 5 : 15;
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

/**
 * Compute the ECL provision amount.
 *
 * @param notionalMinor  Notional in minor units (e.g. ZAR cents).
 * @param eclBps         ECL rate in basis points (1 bps = 0.01%).
 * @returns              Provision in minor units, rounded to nearest integer.
 */
export function computeEcl(notionalMinor: number, eclBps: number): number {
  return Math.round((notionalMinor * eclBps) / 10_000);
}

/**
 * Assess an instrument's IFRS 9 impairment stage.
 *
 * Stage priority (highest risk first):
 *   Stage 3: dpd ≥ 90 OR defaultIndicator OR restructured
 *   Stage 2: dpd ≥ 30 OR manualSicr
 *   Stage 1: everything else (performing)
 *
 * Authority: D-IFRS9-STAGING-V1; IFRS 9 §5.5.
 */
export function assessIfrs9Stage(params: IfrsAssessmentParams): Ifrs9StageResult {
  const { dpd, manualSicr, restructured, defaultIndicator, productFamily, notionalMinor } = params;

  // Stage 3 — credit-impaired (highest priority, checked first)
  if (dpd >= 90) {
    const eclBasisPoints = 5_000;
    return {
      stage: 3,
      eclBasisPoints,
      eclAmountMinor: computeEcl(notionalMinor, eclBasisPoints),
      triggerReason: "90-dpd",
    };
  }
  if (defaultIndicator) {
    const eclBasisPoints = 5_000;
    return {
      stage: 3,
      eclBasisPoints,
      eclAmountMinor: computeEcl(notionalMinor, eclBasisPoints),
      triggerReason: "default",
    };
  }
  if (restructured) {
    const eclBasisPoints = 5_000;
    return {
      stage: 3,
      eclBasisPoints,
      eclAmountMinor: computeEcl(notionalMinor, eclBasisPoints),
      triggerReason: "restructured",
    };
  }

  // Stage 2 — significant increase in credit risk
  if (dpd >= 30) {
    const eclBasisPoints = 100;
    return {
      stage: 2,
      eclBasisPoints,
      eclAmountMinor: computeEcl(notionalMinor, eclBasisPoints),
      triggerReason: "30-dpd",
    };
  }
  if (manualSicr) {
    const eclBasisPoints = 100;
    return {
      stage: 2,
      eclBasisPoints,
      eclAmountMinor: computeEcl(notionalMinor, eclBasisPoints),
      triggerReason: "manual-sicr",
    };
  }

  // Stage 1 — performing
  const eclBasisPoints = stage1BasisPoints(productFamily);
  return {
    stage: 1,
    eclBasisPoints,
    eclAmountMinor: computeEcl(notionalMinor, eclBasisPoints),
    triggerReason: "initial-recognition",
  };
}
