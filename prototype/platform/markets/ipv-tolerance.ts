// platform/markets/ipv-tolerance.ts
//
// IPV (Independent Price Verification) tolerance engine.
//
// Checks whether a position's primary rate diverges from a secondary
// independent source beyond the configured tolerance thresholds:
//
//   Threshold 1 (relative): |primary - secondary| / primary > 0.0025 (0.25%)
//   Threshold 2 (absolute): |primary - secondary| * (notionalMinor / 100) > 50_000 ZAR
//
// Either breach triggers an IpvExceptionRaised event (emitted by the
// mtm-run.ts orchestrator — this module only calculates, does not emit).
//
// The 0.25% / ZAR 50k thresholds come from pricing-policy-v1.md §5.2.
// The absolute threshold converts notionalMinor (cents) to rand by dividing
// by 100 before multiplying by the rate spread — this gives a ZAR exposure.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - pricing-policy-v1.md §5.2 (IPV tolerance table)
//   - BCBS 239 (risk-data aggregation — independent price verification)
//
// Author: Rohan (Market risk engineer, engineering)

// ---------------------------------------------------------------------------
// Thresholds (sourced from pricing-policy-v1.md §5.2)
// ---------------------------------------------------------------------------

/** Relative tolerance: 0.25%. Breach if |delta| / primary > this. */
const IPV_PCT_THRESHOLD = 0.0025;

/** Absolute ZAR threshold. Breach if absolute ZAR exposure > this. */
const IPV_ZAR_THRESHOLD = 50_000;

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface IpvCheckResult {
  /** true = within tolerance; false = at least one threshold breached. */
  pass: boolean;
  /**
   * Percentage divergence as a fraction (not %). E.g. 0.0027 = 0.27%.
   * Positive when secondary > primary; negative when secondary < primary.
   */
  divergencePct: number;
  /**
   * Absolute ZAR impact of the divergence on the notional.
   * = |primary - secondary| × (notionalMinor / 100)
   * Always non-negative.
   */
  divergenceZar: number;
  /**
   * Which threshold was first breached ("pct" | "zar"), or null if no breach.
   * When both are breached simultaneously, "pct" is reported (first check).
   */
  breachThreshold: "pct" | "zar" | null;
}

/**
 * Check whether a position's primary rate is within IPV tolerance.
 *
 * @param primaryRate      The rate used for mark-to-market (e.g. 18.50 for ZAR/USD).
 * @param secondaryRate    The rate from the independent secondary source.
 * @param notionalMinor    Notional in minor currency units (cents, pence, etc.).
 *                         The ZAR exposure = |delta| × (notionalMinor / 100).
 *
 * @returns IpvCheckResult with pass/fail, divergence metrics, and breach label.
 *
 * @throws Error if primaryRate is zero (division by zero guard).
 */
export function checkIpvTolerance(
  primaryRate: number,
  secondaryRate: number,
  notionalMinor: number,
): IpvCheckResult {
  if (primaryRate === 0) {
    throw new Error("checkIpvTolerance: primaryRate must not be zero");
  }

  const delta = Math.abs(primaryRate - secondaryRate);
  const divergencePct = delta / primaryRate; // fraction (0.0027 = 0.27%)
  const divergenceZar = delta * (notionalMinor / 100);

  // Check relative threshold first.
  if (divergencePct > IPV_PCT_THRESHOLD) {
    return { pass: false, divergencePct, divergenceZar, breachThreshold: "pct" };
  }

  // Check absolute ZAR threshold.
  if (divergenceZar > IPV_ZAR_THRESHOLD) {
    return { pass: false, divergencePct, divergenceZar, breachThreshold: "zar" };
  }

  return { pass: true, divergencePct, divergenceZar, breachThreshold: null };
}
