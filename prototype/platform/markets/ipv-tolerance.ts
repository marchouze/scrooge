// platform/markets/ipv-tolerance.ts
//
// IPV (Independent Price Verification) tolerance engine.
//
// Checks whether a position's primary rate diverges from a secondary
// independent source beyond the configured tolerance thresholds:
//
//   Threshold 1 (relative): |primary - secondary| / primary > <bpsThreshold>
//   Threshold 2 (absolute): |primary - secondary| * (notionalMinor / 100) > <absoluteZarMinor>
//
// Either breach triggers an IpvExceptionRaised event (or IpvBreachShadow in
// shadow mode) — emitted by the mtm-run.ts orchestrator. This module only
// calculates, does not emit.
//
// Per-pair tolerance surface (D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21):
//
//   - USD/ZAR (+ ZAR/USD mirror, resolved via canonical pair): 0.55%
//   - GBP/ZAR, EUR/ZAR, ZAR/EUR, ZAR/GBP, default fallback:   0.40%
//   - Absolute ZAR threshold: ZAR 50,000 (unchanged)
//
// Canonical pair lookup uses Bea's `toCanonicalPair` utility — input pairs
// are normalised so ZAR/USD inputs hit the USD/ZAR config row by inversion.
//
// Shadow-mode support (D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21):
//   The IPV run carries a `mode: "live" | "shadow"` flag. In shadow mode,
//   breaches against the new per-pair thresholds emit on a separate event
//   channel (`IpvBreachShadow`) and do NOT lift into the live appetite-watch
//   surface. After 10 trading days of shadow-channel observation without
//   adverse findings, the cutover flips shadow → live.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21 (CEO-approved 2026-05-21)
//   - PR #695 (Helena (Chief Risk Officer, governance) — recalibration analysis)
//   - pricing-policy-v1.md §5.2 (legacy IPV tolerance table — superseded by
//     D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21 for FX-spot scope)
//   - BCBS 239 (risk-data aggregation — independent price verification)
//
// Author: Rohan (Market risk engineer, engineering)

import { toCanonicalPair } from "../market-data/canonical-pair";

// ---------------------------------------------------------------------------
// Configuration schema
// ---------------------------------------------------------------------------

/** Per-pair IPV tolerance row. */
export interface IpvTolerancePair {
  /**
   * Canonical pair key per `toCanonicalPair(base, quote).pairKey`. For ZAR
   * pairs this is `<FOREIGN>/ZAR` (e.g. `USD/ZAR`); ZAR/USD inputs resolve
   * to this row by canonical inversion.
   */
  readonly canonicalPair: string;
  /**
   * Relative tolerance threshold (fraction, NOT percent). 0.0055 = 0.55%.
   * Breach if |delta| / primary > this.
   */
  readonly bpsThreshold: number;
  /**
   * Absolute ZAR threshold in MINOR units (cents). 5_000_000 = ZAR 50,000.
   * Breach if absolute ZAR exposure (in cents) > this.
   */
  readonly absoluteZarMinor: number;
}

/** Operating mode for an IPV run. */
export type IpvMode = "live" | "shadow";

/**
 * IPV tolerance configuration — per-pair entries plus default fallback.
 *
 * Lookup order:
 *   1. Canonicalise input pair via `toCanonicalPair(base, quote).pairKey`.
 *   2. If a `pairs[]` row matches `canonicalPair`, use that row's thresholds.
 *   3. Otherwise, fall back to `defaultBpsThreshold` + `defaultAbsoluteZarMinor`.
 */
export interface IpvToleranceConfig {
  /** Per-pair rows. */
  readonly pairs: readonly IpvTolerancePair[];
  /** Fallback bps threshold (fraction) when canonical pair not in `pairs`. */
  readonly defaultBpsThreshold: number;
  /** Fallback absolute ZAR threshold (minor units) when canonical pair not in `pairs`. */
  readonly defaultAbsoluteZarMinor: number;
  /**
   * Mode this config governs. `"shadow"` means breaches emit on the shadow
   * channel and do NOT lift into the live appetite surface. `"live"` is the
   * binding production state.
   */
  readonly mode: IpvMode;
  /**
   * Cutover criterion — when shadow flips to live. Expressed as a target date
   * (YYYY-MM-DD) computed as "10 trading days after shadow window opened".
   * Once `mode === "live"`, this is the historical record of when the
   * cutover happened.
   */
  readonly cutoverDate: string;
}

// ---------------------------------------------------------------------------
// CEO-approved seed config (D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21)
// ---------------------------------------------------------------------------

/** Absolute ZAR threshold in minor units (cents). ZAR 50,000 = 5,000,000 cents. */
const ABS_ZAR_MINOR_DEFAULT = 5_000_000;

/**
 * Default IPV tolerance config — CEO-approved values per
 * D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21.
 *
 * Mode is `"shadow"` from cutover-open (2026-05-21) for 10 trading days; the
 * binding cutover date is 2026-06-04 (= 2026-05-21 + 10 weekdays, no SA
 * public holidays in window). Production runs flip `mode` to `"live"` after
 * Helena (Chief Risk Officer, governance) attests shadow-window completion.
 */
export const DEFAULT_IPV_TOLERANCE_CONFIG: IpvToleranceConfig = {
  pairs: [
    // USD/ZAR + ZAR/USD mirror (canonical: USD/ZAR) — 0.55%.
    { canonicalPair: "USD/ZAR", bpsThreshold: 0.0055, absoluteZarMinor: ABS_ZAR_MINOR_DEFAULT },
    // GBP/ZAR + ZAR/GBP mirror (canonical: GBP/ZAR) — 0.40%.
    { canonicalPair: "GBP/ZAR", bpsThreshold: 0.004, absoluteZarMinor: ABS_ZAR_MINOR_DEFAULT },
    // EUR/ZAR + ZAR/EUR mirror (canonical: EUR/ZAR) — 0.40%.
    { canonicalPair: "EUR/ZAR", bpsThreshold: 0.004, absoluteZarMinor: ABS_ZAR_MINOR_DEFAULT },
  ],
  defaultBpsThreshold: 0.004,
  defaultAbsoluteZarMinor: ABS_ZAR_MINOR_DEFAULT,
  mode: "shadow",
  cutoverDate: "2026-06-04",
};

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
   * Always non-negative. In ZAR major units (not minor).
   */
  divergenceZar: number;
  /**
   * Which threshold was first breached ("pct" | "zar"), or null if no breach.
   * When both are breached simultaneously, "pct" is reported (first check).
   */
  breachThreshold: "pct" | "zar" | null;
  /**
   * The bps threshold actually applied to this check (fraction). Reflects
   * the per-pair lookup result. Useful for downstream events and recon.
   */
  bpsThresholdApplied: number;
  /**
   * The absolute ZAR threshold actually applied to this check (minor units).
   * Useful for downstream events and recon.
   */
  absoluteZarMinorApplied: number;
  /**
   * Canonical pair key used for the lookup (e.g. `USD/ZAR` for either
   * `USD/ZAR` or `ZAR/USD` input).
   */
  canonicalPair: string;
  /**
   * Did the lookup hit a `pairs[]` row (`"per-pair"`) or fall through to
   * the defaults (`"default"`)?
   */
  source: "per-pair" | "default";
}

/**
 * Look up the per-pair (or default) tolerance for a currency pair.
 *
 * @param base   ISO 4217 base currency (e.g. "USD").
 * @param quote  ISO 4217 quote currency (e.g. "ZAR").
 * @param config Optional config override (default: DEFAULT_IPV_TOLERANCE_CONFIG).
 *
 * @returns An object with the resolved thresholds + canonical pair key + source.
 */
export function lookupIpvTolerance(
  base: string,
  quote: string,
  config: IpvToleranceConfig = DEFAULT_IPV_TOLERANCE_CONFIG,
): {
  bpsThreshold: number;
  absoluteZarMinor: number;
  canonicalPair: string;
  source: "per-pair" | "default";
} {
  const canonical = toCanonicalPair(base, quote);
  const row = config.pairs.find((p) => p.canonicalPair === canonical.pairKey);
  if (row !== undefined) {
    return {
      bpsThreshold: row.bpsThreshold,
      absoluteZarMinor: row.absoluteZarMinor,
      canonicalPair: canonical.pairKey,
      source: "per-pair",
    };
  }
  return {
    bpsThreshold: config.defaultBpsThreshold,
    absoluteZarMinor: config.defaultAbsoluteZarMinor,
    canonicalPair: canonical.pairKey,
    source: "default",
  };
}

/**
 * Check whether a position's primary rate is within IPV tolerance.
 *
 * Per-pair thresholds resolved via `lookupIpvTolerance(base, quote, config)`.
 *
 * @param primaryRate      The rate used for mark-to-market (e.g. 18.50 for USD/ZAR).
 * @param secondaryRate    The rate from the independent secondary source.
 * @param notionalMinor    Notional in minor currency units (cents, pence, etc.).
 *                         The ZAR exposure = |delta| × (notionalMinor / 100).
 * @param base             Base currency of the pair (for tolerance lookup).
 * @param quote            Quote currency of the pair (for tolerance lookup).
 * @param config           Optional tolerance config (default: DEFAULT).
 *
 * @returns IpvCheckResult with pass/fail, divergence metrics, applied
 *          thresholds, canonical pair, and lookup source.
 *
 * @throws Error if primaryRate is zero (division by zero guard).
 */
export function checkIpvTolerance(
  primaryRate: number,
  secondaryRate: number,
  notionalMinor: number,
  base: string,
  quote: string,
  config: IpvToleranceConfig = DEFAULT_IPV_TOLERANCE_CONFIG,
): IpvCheckResult {
  if (primaryRate === 0) {
    throw new Error("checkIpvTolerance: primaryRate must not be zero");
  }

  const tolerance = lookupIpvTolerance(base, quote, config);

  const delta = Math.abs(primaryRate - secondaryRate);
  const divergencePct = delta / primaryRate; // fraction
  const divergenceZar = delta * (notionalMinor / 100);
  // Compare ZAR exposure on the same scale as the threshold (cents).
  const divergenceZarMinor = divergenceZar * 100;

  // Check relative threshold first.
  if (divergencePct > tolerance.bpsThreshold) {
    return {
      pass: false,
      divergencePct,
      divergenceZar,
      breachThreshold: "pct",
      bpsThresholdApplied: tolerance.bpsThreshold,
      absoluteZarMinorApplied: tolerance.absoluteZarMinor,
      canonicalPair: tolerance.canonicalPair,
      source: tolerance.source,
    };
  }

  // Check absolute ZAR threshold.
  if (divergenceZarMinor > tolerance.absoluteZarMinor) {
    return {
      pass: false,
      divergencePct,
      divergenceZar,
      breachThreshold: "zar",
      bpsThresholdApplied: tolerance.bpsThreshold,
      absoluteZarMinorApplied: tolerance.absoluteZarMinor,
      canonicalPair: tolerance.canonicalPair,
      source: tolerance.source,
    };
  }

  return {
    pass: true,
    divergencePct,
    divergenceZar,
    breachThreshold: null,
    bpsThresholdApplied: tolerance.bpsThreshold,
    absoluteZarMinorApplied: tolerance.absoluteZarMinor,
    canonicalPair: tolerance.canonicalPair,
    source: tolerance.source,
  };
}
