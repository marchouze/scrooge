// platform/markets/ipv-tolerance.ts
//
// IPV (Independent Price Verification) tolerance engine.
//
// Checks whether a position's primary rate diverges from a secondary
// independent source beyond the configured tolerance thresholds.
//
// Two-tier tolerance schedule (per D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22):
//
//   Tier 1 — liquid majors: the ZAR crosses (USD/ZAR, ZAR/USD, EUR/ZAR,
//   ZAR/EUR, GBP/ZAR, ZAR/GBP) plus the two deepest G10 crosses (EUR/USD,
//   USD/EUR, GBP/USD, USD/GBP):
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
// ---------------------------------------------------------------------------
// All-asset-class extension (brief:bea:all-asset-class-p-l-ipv-coverage-mvp)
// ---------------------------------------------------------------------------
//
// The FX-spot two-tier schedule above is preserved EXACTLY (see TIER_1_PAIRS /
// getIpvThresholds). The bank also trades JSE bonds, JSE-listed equities and
// OTC IRD, each priced from a different parameter type (price / curve point /
// vol point / credit spread) and sitting at a different IFRS-13 fair-value
// level. IPV tolerance must therefore vary by BOTH the IFRS-13 level (a Level-1
// quoted print needs a far tighter band than a Level-3 model output) AND the
// parameter type being verified.
//
// `getIpvScheduleTolerance(level, parameterType)` returns the relative band for
// any (IFRS-13 level, parameter type) pair, covering all three levels. The
// FX-spot path is unaffected — FX continues to route through getIpvThresholds /
// checkIpvTolerance with its instrument-tier schedule; the new schedule governs
// bond / equity / IRD IPV.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - pricing-policy-v1.md §5.2 (IPV tolerance table)
//   - valuation-policy-v1 §7.3 (IPV frequency by IFRS-13 level)
//   - accounting-policies-ifrs-v1 §3.3 (IFRS-13 fair-value hierarchy)
//   - BCBS 239 (risk-data aggregation — independent price verification)
//   - D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22 (CEO-approved 2026-05-22)
//   - Camille (CFO, governance) recommendation R3 (all-asset-class P&L + IPV)
//
// Author: Rohan (Market risk engineer, engineering); all-asset-class extension
//   by Bea (Accounting & financial reporting engineer, engineering) with
//   Rohan's risk inputs.

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
 * Tier 1 instruments — liquid majors with tighter IPV tolerance (0.75%).
 * All other instruments fall into Tier 2 (1.00% relative tolerance).
 *
 * The set covers the ZAR crosses the bank quotes against its home currency
 * (both directions) plus EUR/USD and GBP/USD (both directions). EUR/USD and
 * GBP/USD are the two deepest, most-liquid G10 crosses in the market, with
 * the same "reliable multi-source quotes" property that justifies the tighter
 * Tier-1 band — so they belong in Tier 1 rather than the wider Tier-2 default
 * reserved for thinner markets. The absolute ZAR threshold is unchanged and
 * applies to all tiers via the notional-derived divergenceZar.
 *
 * Authority: D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22,
 *   D-FX-CROSS-PAIRS-PRODUCTION-INGEST (EUR/USD + GBP/USD added)
 */
export const TIER_1_PAIRS: ReadonlySet<string> = new Set([
  "USD/ZAR",
  "ZAR/USD",
  "EUR/ZAR",
  "ZAR/EUR",
  "GBP/ZAR",
  "ZAR/GBP",
  "EUR/USD",
  "USD/EUR",
  "GBP/USD",
  "USD/GBP",
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
 * Tier 1 (ZAR crosses both directions + EUR/USD, USD/EUR, GBP/USD, USD/GBP):
 *   pctThreshold = 0.0075, zarThreshold = 200_000
 *
 * Tier 2 (all other / unknown):
 *   pctThreshold = 0.0100, zarThreshold = 200_000
 *
 * Authority: D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22,
 *   D-FX-CROSS-PAIRS-PRODUCTION-INGEST
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

// ===========================================================================
// All-asset-class IPV schedule — per IFRS-13 level + per parameter type
// ===========================================================================
//
// The FX-spot schedule above is instrument-tier driven (TIER_1_PAIRS). For
// bonds, equities and OTC IRD the IPV band is driven instead by (a) the
// IFRS-13 fair-value level of the mark and (b) the parameter type being
// verified. This is the standard product-control approach: a Level-1 quoted
// equity print is verified far more tightly than a Level-3 model-derived
// credit-spread input.

/**
 * IFRS-13 fair-value hierarchy level. Mirrors `FairValueLevel` in
 * event-store/event-types/valuation.ts (kept as a local literal union so this
 * module has no dependency on the event-store layer).
 */
export type IfrsFairValueLevel = "1" | "2" | "3";

/**
 * The parameter type whose mark is being independently verified. Aligned with
 * OfficialMarkAdopted.markType plus `credit-spread` (an IRD/bond input that has
 * no OfficialMarkAdopted markType yet — see substrate gaps).
 *   price         — bond clean price / equity closing print
 *   curve-point   — interest-rate curve point (IRD NPV)
 *   vol-point     — volatility surface point (options; reserved)
 *   credit-spread — issuer / counterparty credit spread (bond / IRD CVA input)
 */
export type IpvParameterType = "price" | "curve-point" | "vol-point" | "credit-spread";

export const IPV_PARAMETER_TYPES: readonly IpvParameterType[] = [
  "price",
  "curve-point",
  "vol-point",
  "credit-spread",
] as const;

export const IFRS_FAIR_VALUE_LEVELS: readonly IfrsFairValueLevel[] = ["1", "2", "3"] as const;

/**
 * Per-(IFRS-13 level × parameter type) relative tolerance band, expressed as a
 * fraction (0.0050 = 0.50%). The grid is intentionally COMPLETE — every level
 * has a band for every parameter type — so the recon can assert full coverage.
 *
 * Calibration rationale (build-phase, conservative — to be retightened at
 * commencement of trading against consolidated production feeds):
 *   - Tighter at Level 1 (observable quoted prices) than Level 3 (model).
 *   - Curve points and vol points carry wider bands than outright prices
 *     because small input moves compound through the pricing model.
 *   - Credit spreads are the widest — thin secondary observability, the
 *     dominant Level-3 driver for bond / IRD CVA.
 * A Level-1 vol-point / Level-1 credit-spread is unusual (these inputs are
 * almost never Level 1) but the grid carries a band so the verification path
 * never hits an undefined lookup; the recon asserts no hole exists.
 *
 * Authority: valuation-policy-v1 §7.3; pricing-policy-v1 §5.2/§5.3;
 *   accounting-policies-ifrs-v1 §3.3; D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22
 *   (FX-spot tiers, preserved separately above).
 */
export const IPV_SCHEDULE_PCT: Readonly<
  Record<IfrsFairValueLevel, Readonly<Record<IpvParameterType, number>>>
> = {
  // Level 1 — quoted prices in active markets.
  "1": {
    price: 0.0025, // 0.25% — JSE-listed equity / liquid bond close
    "curve-point": 0.005, // 0.50%
    "vol-point": 0.0075, // 0.75%
    "credit-spread": 0.0075, // 0.75%
  },
  // Level 2 — observable inputs other than quoted prices.
  "2": {
    price: 0.005, // 0.50% — matrix-priced bond / less-liquid line
    "curve-point": 0.0075, // 0.75% — JSE swap curve point
    "vol-point": 0.01, // 1.00%
    "credit-spread": 0.0125, // 1.25%
  },
  // Level 3 — unobservable / model inputs; widest bands, enhanced IPV.
  "3": {
    price: 0.01, // 1.00%
    "curve-point": 0.0125, // 1.25%
    "vol-point": 0.015, // 1.50%
    "credit-spread": 0.02, // 2.00% — dominant Level-3 driver
  },
} as const;

/**
 * The absolute ZAR exposure threshold for the all-asset-class schedule. Reuses
 * the same `IPV_ZAR_THRESHOLD` as the FX-spot schedule so the absolute leg is
 * consistent across asset classes — a divergence whose ZAR exposure exceeds the
 * band is a breach regardless of how tight the relative band is.
 */
export const IPV_SCHEDULE_ZAR_THRESHOLD = IPV_ZAR_THRESHOLD;

/**
 * Return the IPV thresholds for an (IFRS-13 level, parameter type) pair. The
 * grid is complete by construction; the lookup therefore never returns
 * undefined. Use this for bond / equity / IRD IPV. (FX-spot keeps using
 * `getIpvThresholds(instrument)`.)
 */
export function getIpvScheduleTolerance(
  level: IfrsFairValueLevel,
  parameterType: IpvParameterType,
): IpvThresholds {
  return {
    pctThreshold: IPV_SCHEDULE_PCT[level][parameterType],
    zarThreshold: IPV_SCHEDULE_ZAR_THRESHOLD,
  };
}

/**
 * Check an all-asset-class position's primary mark against an independent
 * secondary, using the (IFRS-13 level × parameter type) schedule. Mirrors
 * `checkIpvTolerance` but selects the band from the schedule grid instead of
 * the FX instrument tier.
 *
 * @throws Error if primaryRate is zero (division-by-zero guard).
 */
export function checkIpvScheduleTolerance(
  primaryRate: number,
  secondaryRate: number,
  notionalMinor: number,
  level: IfrsFairValueLevel,
  parameterType: IpvParameterType,
): IpvCheckResult {
  if (primaryRate === 0) {
    throw new Error("checkIpvScheduleTolerance: primaryRate must not be zero");
  }
  const { pctThreshold, zarThreshold } = getIpvScheduleTolerance(level, parameterType);
  const delta = Math.abs(primaryRate - secondaryRate);
  const divergencePct = delta / primaryRate;
  const divergenceZar = delta * (notionalMinor / 100);
  if (divergencePct > pctThreshold) {
    return { pass: false, divergencePct, divergenceZar, breachThreshold: "pct" };
  }
  if (divergenceZar > zarThreshold) {
    return { pass: false, divergencePct, divergenceZar, breachThreshold: "zar" };
  }
  return { pass: true, divergencePct, divergenceZar, breachThreshold: null };
}
