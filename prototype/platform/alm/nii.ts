// platform/alm/nii.ts
//
// NII (Net Interest Income) sensitivity computation.
//
// Computes NII sensitivity over a 12-month horizon for four parallel
// interest-rate shock scenarios, per BCBS d365 §4:
//
//   Shock 1 — Parallel +200 bps
//   Shock 2 — Parallel +100 bps
//   Shock 3 — Parallel −100 bps
//   Shock 4 — Parallel −200 bps
//
// NII = projected interest income − projected interest expense.
// ΔNII = NII(shocked) − NII(base).
//
// Build-phase posture:
//   No real positions → NII = 0 for all scenarios → ΔNII = 0.
//   With zero rate-sensitive assets and liabilities, there is no interest
//   income or expense to project. The zero posture is auditable and correct
//   (Principle 1 — events are the only source of truth).
//
//   When real positions land (bonds, IRS, deposits, loans), this engine
//   replaces the zero basis with a per-bucket projection:
//     NII_base   = Σ_t (RSA_t × base_rate_t − RSL_t × base_rate_t) × min(T_t, 1Y)
//     NII_shocked = Σ_t (RSA_t × (base_rate_t + shock) − RSL_t × (base_rate_t + shock)) × min(T_t, 1Y)
//   where T_t is the remaining life of the position capped at 12 months.
//
// Authority: D-TREASURY-GAPS-WAVE1; BCBS d365 §4; Banks Act Reg 26/27.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import type { EventStore } from "../event-store/store";
import { type REPRICING_BUCKETS, computeRepricingGap } from "./repricing-gap";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** NII shock scenario labels (parallel only, per BCBS d365). */
export type NIIShockLabel = "parallel+200" | "parallel+100" | "parallel-100" | "parallel-200";

export const NII_SHOCK_LABELS: readonly NIIShockLabel[] = [
  "parallel+200",
  "parallel+100",
  "parallel-100",
  "parallel-200",
];

export const NII_SHOCK_DESCRIPTIONS: Record<NIIShockLabel, string> = {
  "parallel+200": "Parallel shift +200 bps over 12-month NII horizon",
  "parallel+100": "Parallel shift +100 bps over 12-month NII horizon",
  "parallel-100": "Parallel shift −100 bps over 12-month NII horizon",
  "parallel-200": "Parallel shift −200 bps over 12-month NII horizon",
};

/** Decimal shift for each NII scenario. */
const NII_SHOCK_DECIMAL: Record<NIIShockLabel, number> = {
  "parallel+200": 0.02,
  "parallel+100": 0.01,
  "parallel-100": -0.01,
  "parallel-200": -0.02,
};

/** NII sensitivity result for one shock scenario. */
export interface NIIResult {
  shockLabel: NIIShockLabel;
  description: string;
  /** Projected NII over 12 months at base rates (ZAR). */
  baseNiiZar: number;
  /** Projected NII over 12 months at shocked rates (ZAR). */
  shockedNiiZar: number;
  /** ΔNII = shocked − base (ZAR). */
  deltaNiiZar: number;
}

/** Full NII sensitivity report. */
export interface NIIReport {
  asOf: string;
  currency: string;
  /** Horizon over which NII is projected (months). */
  horizonMonths: number;
  status: "computed" | "zero-positions";
  results: NIIResult[];
  /** Worst-case ΔNII across all scenarios (ZAR, most negative). */
  worstCaseDeltaNiiZar: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fraction of the year that each repricing bucket falls within a 12-month
 * NII projection window. Buckets beyond 12 months contribute their full
 * 12-month carry; buckets that reprice before 12 months contribute only until
 * their repricing date (simplified: use bucket midpoint).
 *
 * Production will use actual coupon schedules and reset dates.
 */
const BUCKET_YEAR_FRACTION: Record<(typeof REPRICING_BUCKETS)[number], number> = {
  ON: 1 / 365,
  "1M": 1 / 12,
  "3M": 3 / 12,
  "6M": 6 / 12,
  "1Y": 1,
  "2Y": 1, // capped at 12-month horizon
  "3Y": 1,
  "5Y": 1,
  "7Y": 1,
  "10Y+": 1,
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Compute NII sensitivities for the four BCBS d365 parallel shock scenarios.
 *
 * In build phase (zero positions) all results are zero. When positions land:
 *   Base NII = Σ_bucket [ (RSA_t − RSL_t) × base_rate × year_fraction_t ]
 *   Shocked NII = Σ_bucket [ (RSA_t − RSL_t) × (base_rate + shock) × year_fraction_t ]
 *   ΔNII = shocked NII − base NII
 *
 * Floating-rate positions reprice at their reset date; the rate uplift /
 * reduction applies from that reset date through month 12. Fixed-rate
 * positions do not reprice and are therefore excluded from ΔNII (their NII
 * is unchanged by the shock within the 12-month window). This simplified
 * treatment is conservative: production will separate fixed vs floating
 * and apply the shock only to the floating re-fixing portion.
 */
export function computeNII(eventStore: EventStore, asOf: string): NIIReport {
  const gapSchedule = computeRepricingGap(eventStore, asOf);

  // Base flat rate assumption: SARB repo proxy 8.25% (build phase).
  const BASE_RATE = 0.0825;

  const results: NIIResult[] = [];

  for (const label of NII_SHOCK_LABELS) {
    const shock = NII_SHOCK_DECIMAL[label];
    let baseNii = 0;
    let shockedNii = 0;

    for (const row of gapSchedule.rows) {
      const netGap = row.rsaZar - row.rslZar;
      const yearFrac = BUCKET_YEAR_FRACTION[row.bucket] ?? 1;

      baseNii += netGap * BASE_RATE * yearFrac;
      shockedNii += netGap * (BASE_RATE + shock) * yearFrac;
    }

    const deltaNii = shockedNii - baseNii;

    results.push({
      shockLabel: label,
      description: NII_SHOCK_DESCRIPTIONS[label],
      baseNiiZar: baseNii,
      shockedNiiZar: shockedNii,
      deltaNiiZar: deltaNii,
    });
  }

  const worstCase = results.reduce((min, r) => Math.min(min, r.deltaNiiZar), 0);

  return {
    asOf,
    currency: "ZAR",
    horizonMonths: 12,
    status: gapSchedule.status,
    results,
    worstCaseDeltaNiiZar: worstCase,
  };
}
