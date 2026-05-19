// platform/alm/eve.ts
//
// ΔEVE (Economic Value of Equity) sensitivity computation.
//
// Computes ΔEVE for the six standard interest-rate shock scenarios defined in
// BCBS d365 (April 2016 / updated June 2019):
//
//   Scenario 1 — Parallel up   +200 bps
//   Scenario 2 — Parallel up   +100 bps
//   Scenario 3 — Parallel down −100 bps
//   Scenario 4 — Parallel down −200 bps
//   Scenario 5 — Steepener     short end +300 bps
//   Scenario 6 — Flattener     short end −300 bps
//
// ΔEVE = shocked NPV − base NPV.
//
// Build-phase posture:
//   No real positions → NPV = 0 for all scenarios → ΔEVE = 0.
//   This is correct: with no interest-rate-sensitive positions, there is no
//   economic value to shock. The zero posture is explicitly documented and
//   auditable (Principle 1).
//
//   When real positions land (bonds, IRS, repos), this engine replaces the
//   zero basis with a proper cashflow-discounting approach:
//     NPV = Σ CF_t × discount_factor(r_t + shock_t)
//   where r_t is the base zero rate at tenor t and shock_t is the parallel or
//   slope adjustment for that tenor.
//
// Authority: D-TREASURY-GAPS-WAVE1; BCBS d365 §4; Banks Act Reg 26/27.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import type { EventStore } from "../event-store/store";
import { REPRICING_BUCKETS, computeRepricingGap } from "./repricing-gap";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Standard BCBS d365 shock scenarios. */
export type EVEShockLabel =
  | "parallel+200"
  | "parallel+100"
  | "parallel-100"
  | "parallel-200"
  | "steepener+300"
  | "flattener-300";

export const EVE_SHOCK_LABELS: readonly EVEShockLabel[] = [
  "parallel+200",
  "parallel+100",
  "parallel-100",
  "parallel-200",
  "steepener+300",
  "flattener-300",
];

/** Human-readable description for each shock scenario. */
export const EVE_SHOCK_DESCRIPTIONS: Record<EVEShockLabel, string> = {
  "parallel+200": "Parallel shift +200 bps (upward shock)",
  "parallel+100": "Parallel shift +100 bps (upward shock)",
  "parallel-100": "Parallel shift −100 bps (downward shock)",
  "parallel-200": "Parallel shift −200 bps (downward shock)",
  "steepener+300": "Steepener: short end +300 bps, long end unchanged",
  "flattener-300": "Flattener: short end −300 bps, long end unchanged",
};

/** ΔEVE sensitivity result for one shock scenario. */
export interface EVEResult {
  shockLabel: EVEShockLabel;
  description: string;
  /** Base NPV (ZAR) — zero in build phase. */
  baseNpvZar: number;
  /** Shocked NPV (ZAR) — zero in build phase. */
  shockedNpvZar: number;
  /** ΔEVE = shocked NPV − base NPV (ZAR). */
  deltaEveZar: number;
  /** ΔEVE as percentage of Tier 1 capital (placeholder; Tier 1 not yet measured). */
  deltaEvePctTier1: number | null;
}

/** Full ΔEVE sensitivity report. */
export interface EVEReport {
  asOf: string;
  currency: string;
  status: "computed" | "zero-positions";
  results: EVEResult[];
  /** Worst-case ΔEVE across all scenarios (ZAR, most negative). */
  worstCaseDeltaEveZar: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute the basis-point shift applied to each repricing bucket under each
 * shock scenario. Returns bps as a decimal fraction (e.g. 200bps = 0.02).
 *
 * Short-end buckets: ON, 1M, 3M.
 * Long-end buckets: 5Y, 7Y, 10Y+.
 * Mid buckets: 6M, 1Y, 2Y, 3Y.
 *
 * Steepener: short end +300bps; long end 0; mid interpolated linearly.
 * Flattener: short end −300bps; long end 0; mid interpolated linearly.
 */
function bucketShift(
  label: EVEShockLabel,
  _bucket: (typeof REPRICING_BUCKETS)[number],
  bucketIndex: number,
): number {
  const n = REPRICING_BUCKETS.length; // 10 buckets

  switch (label) {
    case "parallel+200":
      return 0.02;
    case "parallel+100":
      return 0.01;
    case "parallel-100":
      return -0.01;
    case "parallel-200":
      return -0.02;
    case "steepener+300": {
      // Linear taper from +300bps at bucket 0 to 0bps at bucket n-1.
      const fraction = 1 - bucketIndex / (n - 1);
      return 0.03 * fraction;
    }
    case "flattener-300": {
      // Linear taper from −300bps at bucket 0 to 0bps at bucket n-1.
      const fraction = 1 - bucketIndex / (n - 1);
      return -0.03 * fraction;
    }
  }
}

/**
 * Simplified discount factor for a mid-bucket repricing date.
 *
 * discount(r, t) = 1 / (1 + r × t)   [linear approximation for build phase]
 *
 * Production will use a full zero-coupon curve with act/365 daycount.
 */
function discountFactor(rateDecimal: number, years: number): number {
  return 1 / (1 + rateDecimal * years);
}

/** Mid-year for each BCBS bucket (used as the repricing date proxy). */
const BUCKET_MID_YEARS: Record<(typeof REPRICING_BUCKETS)[number], number> = {
  ON: 1 / 365,
  "1M": 1 / 12,
  "3M": 3 / 12,
  "6M": 6 / 12,
  "1Y": 1,
  "2Y": 2,
  "3Y": 3,
  "5Y": 5,
  "7Y": 7,
  "10Y+": 10,
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Compute ΔEVE sensitivities for the six BCBS d365 shock scenarios.
 *
 * In build phase (zero positions) all results are zero. When positions land,
 * the engine discounts each repricing bucket's gap under shocked rates.
 *
 * Methodology (simplified cashflow approach):
 *   1. Derive per-bucket net cashflow = RSA_t − RSL_t from the repricing gap.
 *   2. Discount at base rate (assumed flat 8.25% repo-proxied) → base NPV.
 *   3. Re-discount at shocked rate → shocked NPV.
 *   4. ΔEVE = Σ(shocked_NPV_t − base_NPV_t).
 */
export function computeEVE(eventStore: EventStore, asOf: string): EVEReport {
  const gapSchedule = computeRepricingGap(eventStore, asOf);

  // Base flat rate assumption: SARB repo proxy 8.25% (build phase).
  const BASE_RATE = 0.0825;

  const results: EVEResult[] = [];

  for (const label of EVE_SHOCK_LABELS) {
    let baseNpv = 0;
    let shockedNpv = 0;

    for (let i = 0; i < gapSchedule.rows.length; i++) {
      const row = gapSchedule.rows[i];
      if (!row) continue;
      const netCashflow = row.rsaZar - row.rslZar; // Same as gapZar
      const years = BUCKET_MID_YEARS[row.bucket] ?? 1;
      const shift = bucketShift(label, row.bucket, i);

      baseNpv += netCashflow * discountFactor(BASE_RATE, years);
      shockedNpv += netCashflow * discountFactor(BASE_RATE + shift, years);
    }

    const deltaEve = shockedNpv - baseNpv;

    results.push({
      shockLabel: label,
      description: EVE_SHOCK_DESCRIPTIONS[label],
      baseNpvZar: baseNpv,
      shockedNpvZar: shockedNpv,
      deltaEveZar: deltaEve,
      // Tier 1 capital not yet measured (build phase); placeholder null.
      deltaEvePctTier1: null,
    });
  }

  const worstCase = results.reduce((min, r) => Math.min(min, r.deltaEveZar), 0);

  return {
    asOf,
    currency: "ZAR",
    status: gapSchedule.status,
    results,
    worstCaseDeltaEveZar: worstCase,
  };
}
