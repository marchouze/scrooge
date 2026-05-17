// platform/markets/eod/forward-rate-seed.ts
//
// Static forward-rate seed for 7 currency pairs × 6 standard tenors.
//
// Substrate gaps (see fx-forward-revaluation.ts header for full detail):
//   - All values are BUILD-PHASE REHEARSAL figures only. Real forward curves
//     must come from Ravi's IRRBB / yield-curve substrate.
//   - Linear interpolation is used for tenors between standard nodes.
//   - No convexity adjustment; no basis spread; no calendar-adjusted accrual.
//
// Authority:
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
//
// Authors: Bea (Accounting & financial reporting engineer, engineering)
//          Kai (Derivatives & structured products engineer, engineering)

// ---------------------------------------------------------------------------
// Forward rate table
//
// Key:   currencyPair (e.g. "ZAR/USD")
// Value: map of tenorDays → forwardRate in minor units (× 10^6)
//
// REHEARSAL VALUES — annotated with [REHEARSAL] throughout.
// Standard tenors: 7d, 30d, 60d, 90d, 180d, 365d.
//
// ZAR/USD spot reference: ~18.60 as at 2026-05-17.
// Forward points added per rough interest-rate parity (SA repo ~8.25%,
// USD fed-funds ~5.25%):
//   F(T) ≈ S × (1 + r_ZAR × T/365) / (1 + r_USD × T/365)
// These are approximations for build-phase testing only.
// ---------------------------------------------------------------------------

export type ForwardRateSeed = Record<string, Record<number, bigint>>;

/** All rates in minor units (× 10^6). */
export const FORWARD_RATE_SEED: ForwardRateSeed = {
  // [REHEARSAL] ZAR/USD — spot ≈ 18.60
  "ZAR/USD": {
    7: 18_615_000n,
    30: 18_668_000n,
    60: 18_736_000n,
    90: 18_804_000n,
    180: 18_980_000n,
    365: 19_290_000n,
  },
  // [REHEARSAL] ZAR/EUR — spot ≈ 20.10 (EUR/ZAR ≈ 0.0498; expressed as ZAR per EUR)
  "ZAR/EUR": {
    7: 20_118_000n,
    30: 20_181_000n,
    60: 20_262_000n,
    90: 20_343_000n,
    180: 20_535_000n,
    365: 20_880_000n,
  },
  // [REHEARSAL] ZAR/GBP — spot ≈ 23.50
  "ZAR/GBP": {
    7: 23_521_000n,
    30: 23_594_000n,
    60: 23_688_000n,
    90: 23_782_000n,
    180: 24_010_000n,
    365: 24_438_000n,
  },
  // [REHEARSAL] ZAR/JPY — spot ≈ 0.1240 (ZAR per JPY — inverted JPY pair)
  "ZAR/JPY": {
    7: 124_090n,
    30: 124_480n,
    60: 125_040n,
    90: 125_600n,
    180: 126_860n,
    365: 129_200n,
  },
  // [REHEARSAL] ZAR/CHF — spot ≈ 20.80
  "ZAR/CHF": {
    7: 20_820_000n,
    30: 20_885_000n,
    60: 20_970_000n,
    90: 21_055_000n,
    180: 21_260_000n,
    365: 21_640_000n,
  },
  // [REHEARSAL] ZAR/AUD — spot ≈ 12.10
  "ZAR/AUD": {
    7: 12_110_000n,
    30: 12_148_000n,
    60: 12_196_000n,
    90: 12_244_000n,
    180: 12_362_000n,
    365: 12_576_000n,
  },
  // [REHEARSAL] ZAR/CNY — spot ≈ 2.56
  "ZAR/CNY": {
    7: 2_561_000n,
    30: 2_569_000n,
    60: 2_579_000n,
    90: 2_589_000n,
    180: 2_613_000n,
    365: 2_659_000n,
  },
};

/** Standard tenor nodes (days) in ascending order. */
export const STANDARD_TENORS: number[] = [7, 30, 60, 90, 180, 365];

/**
 * Linear interpolation between two forward-rate nodes.
 *
 * Given adjacent tenor nodes (t0, r0) and (t1, r1), returns the rate at
 * `tenorDays` using:
 *   rate = r0 + (r1 - r0) × (tenorDays - t0) / (t1 - t0)
 *
 * BigInt arithmetic: multiply before dividing to preserve precision.
 */
export function interpolateForwardRate(
  tenorDays: number,
  t0: number,
  r0: bigint,
  t1: number,
  r1: bigint,
): bigint {
  if (t0 === t1) return r0;
  const span = BigInt(t1 - t0);
  const delta = r1 - r0;
  const offset = BigInt(tenorDays - t0);
  // Rounding: add span/2 before integer division.
  const half = span / 2n;
  return r0 + (delta * offset + half) / span;
}

/**
 * Look up the forward rate for `currencyPair` at `tenorDays` from the seed.
 *
 * If `tenorDays` exactly matches a seed node, returns the seed value.
 * If `tenorDays` falls between two nodes, linearly interpolates.
 * If `tenorDays` is outside [min, max] of the standard tenors, clamps to
 * the nearest endpoint (flat extrapolation — conservative build-phase only).
 *
 * Throws if the pair is not in the seed table.
 *
 * @returns Forward rate in minor units (× 10^6).
 */
export function seedForwardRate(currencyPair: string, tenorDays: number): bigint {
  const curve = FORWARD_RATE_SEED[currencyPair];
  if (!curve) {
    throw new Error(
      `forwardRateSeed: no curve for pair "${currencyPair}". ` +
        `Available pairs: ${Object.keys(FORWARD_RATE_SEED).join(", ")}`,
    );
  }

  // Direct hit.
  const exact = curve[tenorDays];
  if (exact !== undefined) return exact;

  // Find bracketing nodes.
  const tenors = STANDARD_TENORS;

  // Below minimum — clamp to 7d.
  if (tenorDays < (tenors[0] ?? 7)) {
    return curve[tenors[0] ?? 7] ?? 0n;
  }
  // Above maximum — clamp to 365d.
  const lastTenor = tenors[tenors.length - 1] ?? 365;
  if (tenorDays > lastTenor) {
    return curve[lastTenor] ?? 0n;
  }

  // Find t0 < tenorDays < t1.
  for (let i = 0; i < tenors.length - 1; i++) {
    const t0 = tenors[i] as number;
    const t1 = tenors[i + 1] as number;
    if (tenorDays >= t0 && tenorDays <= t1) {
      const r0 = curve[t0] ?? 0n;
      const r1 = curve[t1] ?? 0n;
      return interpolateForwardRate(tenorDays, t0, r0, t1, r1);
    }
  }

  // Should not reach here.
  throw new Error(
    `forwardRateSeed: failed to interpolate for pair "${currencyPair}" at tenorDays=${tenorDays}`,
  );
}
