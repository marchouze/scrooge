// platform/markets/ipv-tolerance.ts
//
// IPV (Independent Price Verification) tolerance engine.
//
// Checks whether a position's primary rate diverges from a secondary
// independent source beyond the configured tolerance thresholds.
//
// Two-tier tolerance schedule (per D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22):
//
//   Tier 1 — USD/ZAR, ZAR/USD, EUR/ZAR, ZAR/EUR, GBP/ZAR, ZAR/GBP:
//     Relative: |primary - secondary| / primary > 0.0075 (0.75%)
//     Absolute: |primary - secondary| × (notionalMinor / 100) > 200_000 ZAR
//
//   Tier 2 — all other pairs (default):
//     Relative: |primary - secondary| / primary > 0.0100 (1.00%)
//     Absolute: |primary - secondary| × (notionalMinor / 100) > 200_000 ZAR
//
// Either breach triggers an IpvExceptionRaised event (emitted by the
// mtm-run.ts orchestrator — this module only calculates, does not emit).
//
// The absolute threshold converts notionalMinor (cents) to rand by dividing
// by 100 before multiplying by the rate spread — this gives a ZAR exposure.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - pricing-policy-v1.md §5.2 (IPV tolerance table)
//   - BCBS 239 (risk-data aggregation — independent price verification)
//   - D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22 (CEO-approved 2026-05-22)
//
// Author: Rohan (Market risk engineer, engineering)

// ---------------------------------------------------------------------------
// Thresholds (sourced from pricing-policy-v1.md §5.2, recalibrated per
// D-MR-1-FX-IPV-TOLERANCES-V2 approved by Helena (Chief Risk Officer,
// governance) 2026-05-21 post D-FX-QUOTING-CONVENTION calculator fix;
// two-tier schedule added per D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22
// CEO-approved 2026-05-22)
//
// Recalibration rationale:
//   Build-phase data uses two free-tier FX providers (open-er-api and
//   twelve-data) that naturally diverge 0.20–0.40% due to different quote
//   times, bid/ask mid conventions, and CDN caching. The previous 0.25%
//   relative threshold was calibrated against pre-D-FX-QUOTING-CONVENTION
//   P&L data and fired on every USD/ZAR and GBP/ZAR position in the build-
//   phase environment (4/6 BREACH). The recalibrated thresholds absorb
//   normal inter-provider spread noise while catching genuine mis-marks.
//
//   Tier 1 (liquid ZAR crosses) retains 0.75% — tighter because these pairs
//   have reliable multi-source quotes. Tier 2 (all other pairs) uses 1.00% to
//   accommodate wider spreads from thinner markets and fewer free-tier sources.
//
//   At commencement of trading, switch to a single consolidated WM-Fix /
//   Bloomberg BFIX Level-1 primary rate; IPV then uses the bank's internal
//   model price as secondary. At that point thresholds should be tightened
//   back (Tier 1 → 0.25%, Tier 2 → 0.50%) per the then-active rate-source SLA.
// ---------------------------------------------------------------------------

/**
 * Tier 1 instruments — liquid ZAR crosses with tighter IPV tolerance (0.75%).
 * All other instruments fall into Tier 2 (1.00% relative tolerance).
 * Authority: D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22
 */
export const TIER_1_PAIRS: ReadonlySet<string> = new Set([
  "USD/ZAR",
  "ZAR/USD",
  "EUR/ZAR",
  "ZAR/EUR",
  "GBP/ZAR",
  "ZAR/GBP",
]);

/** Tier 1 relative tolerance: 0.75%. */
const TIER_1_PCT_THRESHOLD = 0.0075;

/** Tier 2 relative tolerance: 1.00%. */
const TIER_2_PCT_THRESHOLD = 0.01;

/** Absolute ZAR threshold (both tiers). Breach if absolute ZAR exposure > this. */
const IPV_ZAR_THRESHOLD = 200_000;

// ---------------------------------------------------------------------------
// Threshold helper
// ---------------------------------------------------------------------------

export interface IpvThresholds {
  pctThreshold: number;
  zarThreshold: number;
}

/**
 * Return the IPV thresholds applicable to the given instrument.
 *
 * Tier 1 (USD/ZAR, ZAR/USD, EUR/ZAR, ZAR/EUR, GBP/ZAR, ZAR/GBP):
 *   pctThreshold = 0.0075, zarThreshold = 200_000
 *
 * Tier 2 (all other / unknown):
 *   pctThreshold = 0.0100, zarThreshold = 200_000
 *
 * Authority: D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22
 */
export function getIpvThresholds(instrument: string): IpvThresholds {
  const isTier1 = TIER_1_PAIRS.has(instrument);
  return {
    pctThreshold: isTier1 ? TIER_1_PCT_THRESHOLD : TIER_2_PCT_THRESHOLD,
    zarThreshold: IPV_ZAR_THRESHOLD,
  };
}

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
 * @param instrument       Optional currency pair (e.g. "USD/ZAR"). Used to select
 *                         the correct tier thresholds. Defaults to Tier 2 if omitted
 *                         or not in TIER_1_PAIRS.
 *
 * @returns IpvCheckResult with pass/fail, divergence metrics, and breach label.
 *
 * @throws Error if primaryRate is zero (division by zero guard).
 */
export function checkIpvTolerance(
  primaryRate: number,
  secondaryRate: number,
  notionalMinor: number,
  instrument?: string,
): IpvCheckResult {
  if (primaryRate === 0) {
    throw new Error("checkIpvTolerance: primaryRate must not be zero");
  }

  const { pctThreshold, zarThreshold } = getIpvThresholds(instrument ?? "");

  const delta = Math.abs(primaryRate - secondaryRate);
  const divergencePct = delta / primaryRate; // fraction (0.0027 = 0.27%)
  const divergenceZar = delta * (notionalMinor / 100);

  // Check relative threshold first.
  if (divergencePct > pctThreshold) {
    return { pass: false, divergencePct, divergenceZar, breachThreshold: "pct" };
  }

  // Check absolute ZAR threshold.
  if (divergenceZar > zarThreshold) {
    return { pass: false, divergencePct, divergenceZar, breachThreshold: "zar" };
  }

  return { pass: true, divergencePct, divergenceZar, breachThreshold: null };
}
