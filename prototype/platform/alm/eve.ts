// platform/alm/eve.ts
//
// ΔEVE (Economic Value of Equity) sensitivity computation.
//
// Computes ΔEVE for the six standard interest-rate shock scenarios prescribed
// by BCBS d368 (Interest rate risk in the banking book, April 2016) §III / the
// SARB IRRBB framework: the canonical six are parallel up, parallel down,
// steepener, flattener, short-rate up and short-rate down:
//
//   Scenario 1 — Parallel up    +200 bps (all buckets)
//   Scenario 2 — Parallel down  −200 bps (all buckets)
//   Scenario 3 — Steepener      short end −, long end + (rotation)
//   Scenario 4 — Flattener      short end +, long end − (rotation)
//   Scenario 5 — Short-rate up   short end +300 bps, tapering to 0 long
//   Scenario 6 — Short-rate down short end −300 bps, tapering to 0 long
//
// ΔEVE = shocked NPV − base NPV.
//
// GOVERNANCE (D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 3): this engine is a
// surfaced figure bound in CALC_BINDINGS (calcKey `irrbb-eve`,
// model:irrbb-eve-engine-v1, owned by Helena (Chief Risk Officer, governance)).
// It consumes the repricing/behavioural model (model:irrbb-repricing-v1).
//
// NO SILENT ZEROS (objective 4 of D-TRUSTED-FIGURES-PROGRAM-V1): when the
// banking book holds no repricing-sensitive positions the report carries
// `status: "zero-positions"` (a loud, reasoned absence), which the caller maps
// to a `degraded` CalculationPerformed + SubstrateAlert on the /api/data-failures
// banner — never an unexplained 0.
//
//   When real positions land (bonds, IRS, repos), this engine discounts each
//   repricing bucket's net cashflow under shocked rates:
//     NPV = Σ CF_t × discount_factor(r_t + shock_t)
//   where r_t is the base zero rate at tenor t and shock_t is the parallel or
//   slope adjustment for that tenor.
//
// Authority: D-TREASURY-GAPS-WAVE1; D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (Slice 3);
//   BCBS d368 §III; Banks Act Reg 26/27.
// Author: Ravi (Treasury/ALM Engineer, engineering); IRRBB governance Slice 3
//   coordinated by Helena (Chief Risk Officer, governance — methodology
//   accountability) with Eitan (Treasurer — ALM repricing/behavioural inputs),
//   built by Rohan (Risk systems engineer, engineering), validated by Nadia
//   (Independent-validation engineer).

import type { EventStore } from "../event-store/store";
import { computeCapitalMetrics } from "../projections/capital-metrics";
import { requireWeight } from "../types/financial-input";
import { REPRICING_BUCKETS, computeRepricingGap } from "./repricing-gap";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The canonical six BCBS d368 §III interest-rate shock scenarios. */
export type EVEShockLabel =
  | "parallel-up"
  | "parallel-down"
  | "steepener"
  | "flattener"
  | "short-up"
  | "short-down";

export const EVE_SHOCK_LABELS: readonly EVEShockLabel[] = [
  "parallel-up",
  "parallel-down",
  "steepener",
  "flattener",
  "short-up",
  "short-down",
];

/** Human-readable description for each BCBS d368 shock scenario. */
export const EVE_SHOCK_DESCRIPTIONS: Record<EVEShockLabel, string> = {
  "parallel-up": "Parallel up: +200 bps across all repricing buckets",
  "parallel-down": "Parallel down: −200 bps across all repricing buckets",
  steepener: "Steepener: short rates fall, long rates rise (curve rotation)",
  flattener: "Flattener: short rates rise, long rates fall (curve rotation)",
  "short-up": "Short-rate up: +300 bps at the short end, tapering to 0 at the long end",
  "short-down": "Short-rate down: −300 bps at the short end, tapering to 0 at the long end",
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
 * BCBS d368 §III shock scenario. Returns bps as a decimal fraction (e.g.
 * 200bps = 0.02). `position` is the bucket's place on the curve, 0 (shortest)
 * to 1 (longest).
 *
 * - parallel up/down: ±200 bps uniformly across all buckets.
 * - steepener: short rates fall, long rates rise — linear rotation from
 *   −150 bps at the short end to +150 bps at the long end (BCBS rotation form).
 * - flattener: short rates rise, long rates fall — the steepener inverted.
 * - short up/down: ±300 bps at the short end, tapering linearly to 0 at the
 *   long end.
 */
function bucketShift(
  label: EVEShockLabel,
  _bucket: (typeof REPRICING_BUCKETS)[number],
  bucketIndex: number,
): number {
  const n = REPRICING_BUCKETS.length; // 10 buckets
  // Normalised curve position: 0 at the shortest bucket, 1 at the longest.
  const position = n > 1 ? bucketIndex / (n - 1) : 0;

  switch (label) {
    case "parallel-up":
      return 0.02;
    case "parallel-down":
      return -0.02;
    case "steepener": {
      // Short end −150bps → long end +150bps (linear rotation).
      return -0.015 + 0.03 * position;
    }
    case "flattener": {
      // Short end +150bps → long end −150bps (linear rotation).
      return 0.015 - 0.03 * position;
    }
    case "short-up": {
      // +300bps at the short end, tapering linearly to 0 at the long end.
      return 0.03 * (1 - position);
    }
    case "short-down": {
      // −300bps at the short end, tapering linearly to 0 at the long end.
      return -0.03 * (1 - position);
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
export const BUCKET_MID_YEARS: Record<(typeof REPRICING_BUCKETS)[number], number> = {
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

  // Tier 1 capital from computeCapitalMetrics — ICAAP v1 baseline or live CapitalEvent fold.
  const capitalMetrics = computeCapitalMetrics(eventStore, asOf);
  // availableCapitalMinor is in ZAR cents; convert to ZAR major units.
  const tier1Zar = capitalMetrics.availableCapitalMinor / 100;

  for (const label of EVE_SHOCK_LABELS) {
    let baseNpv = 0;
    let shockedNpv = 0;

    for (let i = 0; i < gapSchedule.rows.length; i++) {
      const row = gapSchedule.rows[i];
      if (!row) continue;
      const netCashflow = row.rsaZar - row.rslZar; // Same as gapZar
      const years = requireWeight(
        BUCKET_MID_YEARS as Record<string, number>,
        row.bucket,
        "eve.BUCKET_MID_YEARS",
      );
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
      // ΔEVE as percentage of Tier 1 capital (BCBS d365 §4 / BA 327 IRRBB metric).
      // Null when Tier 1 capital is zero (degenerate case only; ICAAP baseline is R300m).
      deltaEvePctTier1: tier1Zar > 0 ? deltaEve / tier1Zar : null,
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
