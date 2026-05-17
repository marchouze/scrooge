// platform/markets/eod/jibar-curve-seed.ts
//
// Static JIBAR / ZAR yield curve seed for IRS mark-to-market revaluation.
//
// Provides:
//   - JIBAR_FORWARD_CURVE:   build-phase rehearsal curve (discount factors + par rates).
//   - IrsRateSource interface: injectable rate source (discount factor + forward JIBAR).
//   - StaticJibarRateSource: default implementation backed by this static seed.
//
// Substrate gaps (v0):
//   [GAP-IRS-1] Curve is a static seed. Real production integration:
//               Ravi's IRRBB / yield-curve substrate (FtpCurvePublished →
//               live discount factors from the live ZARONIA/JIBAR OIS strip).
//   [GAP-IRS-2] Interpolation uses linear-in-log-discount-factor (log-linear)
//               for discount factors; log-linear is the market standard for
//               bootstrapped ZAR swap curves. Production: full cubic spline.
//   [GAP-IRS-3] No convexity adjustment; no basis spread; no SABR vol surface.
//   [GAP-IRS-4] Calendar-adjusted tenor calculation not implemented; uses raw
//               calendar days (JIHCAL integration deferred to M6).
//
// Authority:
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   BCBS-D365-IRRBB              (IRRBB shock scenarios — JIBAR sensitivity)
//   IFRS-9-§4.1                  (classification and measurement)
//   ORG-PR-11                    (derivatives trading authority)
//
// Authors: Eitan (IRRBB / derivatives engineer, engineering)

// ---------------------------------------------------------------------------
// Forward curve table — rehearsal values as at 2026-05-17
// ---------------------------------------------------------------------------

/**
 * JIBAR forward curve snapshot — REHEARSAL VALUES ONLY.
 *
 * Source: SARB MPC guidance + ZAR swap market mid-rates (approximate
 * figures for build-phase testing; not real market data).
 *
 * tenors:           annualised par JIBAR rates by tenor.
 * discountFactors:  risk-free discount factors P(0,T) for the curve date.
 *                   Used as the OIS discount approximation for build phase.
 */
export const JIBAR_FORWARD_CURVE = {
  curveDate: "2026-05-17",
  tenors: {
    "3M": 0.0815,
    "6M": 0.0820,
    "1Y": 0.0830,
    "2Y": 0.0840,
    "3Y": 0.0848,
    "5Y": 0.0855,
    "7Y": 0.0858,
    "10Y": 0.0860,
  },
  /** Discount factors P(0,T): present value of 1 ZAR received at tenor T. */
  discountFactors: {
    "3M": 0.9798,
    "6M": 0.9601,
    "1Y": 0.9220,
    "2Y": 0.8499,
    "3Y": 0.7840,
    "5Y": 0.6693,
    "7Y": 0.5721,
    "10Y": 0.4491,
  },
} as const;

// ---------------------------------------------------------------------------
// Tenor → days mapping (standard JIBAR tenors)
// ---------------------------------------------------------------------------

/** Calendar days corresponding to each curve tenor node. */
export const JIBAR_TENOR_DAYS: Record<string, number> = {
  "3M": 91,
  "6M": 182,
  "1Y": 365,
  "2Y": 730,
  "3Y": 1095,
  "5Y": 1825,
  "7Y": 2555,
  "10Y": 3650,
};

// ---------------------------------------------------------------------------
// IrsRateSource — injectable interface
// ---------------------------------------------------------------------------

/**
 * Injectable rate source for IRS revaluation.
 * Allows tests to supply deterministic values and production to plug in
 * a live yield-curve feed ([GAP-IRS-1]).
 */
export interface IrsRateSource {
  /**
   * Get the discount factor P(0, T) for `tenorDays` calendar days from today.
   * Uses linear interpolation between curve nodes.
   *
   * @param tenorDays  Calendar days from valuation date to the cash flow date.
   * @returns          Discount factor in (0, 1].
   */
  getDiscountFactor(tenorDays: number): number;

  /**
   * Get the simply-compounded JIBAR forward rate for the period
   * [periodStartDays, periodEndDays] (calendar days from valuation date).
   *
   * Derived from adjacent discount factors:
   *   L(s, e) = (P(s) / P(e) − 1) / dcf
   * where dcf = (e − s) / 365.
   *
   * @param periodStartDays  Start of the accrual period in calendar days.
   * @param periodEndDays    End of the accrual period in calendar days.
   * @returns                Annualised forward JIBAR rate as a decimal.
   */
  getForwardJibar(periodStartDays: number, periodEndDays: number): number;
}

// ---------------------------------------------------------------------------
// Log-linear interpolation helpers
// ---------------------------------------------------------------------------

/**
 * The standard curve nodes in ascending tenor-day order.
 */
const CURVE_NODES: Array<{ days: number; df: number }> = Object.entries(JIBAR_TENOR_DAYS)
  .map(([tenor, days]) => ({
    days,
    df: JIBAR_FORWARD_CURVE.discountFactors[tenor as keyof typeof JIBAR_FORWARD_CURVE.discountFactors] ?? 1,
  }))
  .sort((a, b) => a.days - b.days);

/**
 * Linear-in-log-discount interpolation between two curve nodes.
 *
 * log(P(t)) = log(P(t0)) + (t - t0)/(t1 - t0) × (log(P(t1)) - log(P(t0)))
 *
 * This ensures discount factors are always positive and monotonically
 * decreasing with tenor (no negative rates artifact from naive linear interp).
 */
function interpolateDiscountFactor(days: number): number {
  // Before first node — clamp to 3M.
  if (days <= 0) return 1.0;
  const first = CURVE_NODES[0];
  if (first && days <= first.days) {
    // Linear between 0 (df=1) and 3M node.
    const t = days / first.days;
    return Math.exp(t * Math.log(first.df));
  }

  // After last node — flat extrapolation (conservative build-phase only).
  const last = CURVE_NODES[CURVE_NODES.length - 1];
  if (last && days >= last.days) return last.df;

  // Find bracketing nodes.
  for (let i = 0; i < CURVE_NODES.length - 1; i++) {
    const n0 = CURVE_NODES[i];
    const n1 = CURVE_NODES[i + 1];
    if (!n0 || !n1) continue;
    if (days >= n0.days && days <= n1.days) {
      const t = (days - n0.days) / (n1.days - n0.days);
      return Math.exp(Math.log(n0.df) + t * (Math.log(n1.df) - Math.log(n0.df)));
    }
  }

  // Fallback — should not reach.
  return last?.df ?? 0.5;
}

// ---------------------------------------------------------------------------
// StaticJibarRateSource — default implementation
// ---------------------------------------------------------------------------

/**
 * Build-phase static JIBAR rate source backed by JIBAR_FORWARD_CURVE.
 *
 * Production replacement: live ZAR swap-curve feed from Ravi's IRRBB
 * substrate ([GAP-IRS-1]). Swap this class for a live-rate connector once
 * the substrate lands; the IrsRateSource interface stays stable.
 */
export class StaticJibarRateSource implements IrsRateSource {
  getDiscountFactor(tenorDays: number): number {
    return interpolateDiscountFactor(tenorDays);
  }

  getForwardJibar(periodStartDays: number, periodEndDays: number): number {
    if (periodEndDays <= periodStartDays) {
      throw new Error(
        `StaticJibarRateSource: periodEndDays (${periodEndDays}) must exceed periodStartDays (${periodStartDays})`,
      );
    }
    const dfStart = this.getDiscountFactor(periodStartDays);
    const dfEnd = this.getDiscountFactor(periodEndDays);
    if (dfEnd <= 0) {
      throw new Error(
        `StaticJibarRateSource: dfEnd must be positive (got ${dfEnd} at tenorDays=${periodEndDays})`,
      );
    }
    // Simply-compounded forward rate: L(s,e) = (P(s)/P(e) − 1) / dcf
    // where dcf = (e − s) / 365.
    const dcf = (periodEndDays - periodStartDays) / 365;
    return (dfStart / dfEnd - 1) / dcf;
  }
}

/** Singleton default instance — use in production revaluation runs. */
export const staticJibarRateSource = new StaticJibarRateSource();
