// platform/markets/ipv-tolerance.test.ts
//
// Tests for the per-pair IPV tolerance surface + shadow-mode flag
// landed by D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21.
//
// Coverage:
//   1. DEFAULT_IPV_TOLERANCE_CONFIG shape (mode + cutoverDate + per-pair rows).
//   2. lookupIpvTolerance — per-pair hit, default fallback, canonical
//      inversion (ZAR/USD input resolves to USD/ZAR row).
//   3. checkIpvTolerance — per-pair USD/ZAR boundary, default fallback for
//      non-listed pair, canonical-pair integration (ZAR/USD breach uses
//      the USD/ZAR 0.55% threshold).
//
// Authority:
//   - D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21 (CEO-approved 2026-05-21)
//   - PR #695 (Helena (Chief Risk Officer, governance) — recalibration analysis)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - brief:rohan:ipv-per-pair-tolerance-surface-and-shadow-mode-s:2026-05-21
//
// Author: Rohan (Market risk engineer, engineering)

import { describe, expect, it } from "bun:test";

import {
  DEFAULT_IPV_TOLERANCE_CONFIG,
  type IpvToleranceConfig,
  checkIpvTolerance,
  lookupIpvTolerance,
} from "./ipv-tolerance";

describe("DEFAULT_IPV_TOLERANCE_CONFIG (CEO-approved)", () => {
  it("starts in shadow mode (cutover window)", () => {
    expect(DEFAULT_IPV_TOLERANCE_CONFIG.mode).toBe("shadow");
  });

  it("encodes the 10-trading-day cutover date (2026-06-04)", () => {
    expect(DEFAULT_IPV_TOLERANCE_CONFIG.cutoverDate).toBe("2026-06-04");
  });

  it("includes USD/ZAR at 0.55% (CEO-approved value)", () => {
    const usdZar = DEFAULT_IPV_TOLERANCE_CONFIG.pairs.find((p) => p.canonicalPair === "USD/ZAR");
    expect(usdZar).toBeDefined();
    expect(usdZar?.bpsThreshold).toBeCloseTo(0.0055, 6);
    expect(usdZar?.absoluteZarMinor).toBe(5_000_000); // ZAR 50,000 in cents
  });

  it("includes GBP/ZAR at 0.40% (CEO-approved value)", () => {
    const gbpZar = DEFAULT_IPV_TOLERANCE_CONFIG.pairs.find((p) => p.canonicalPair === "GBP/ZAR");
    expect(gbpZar).toBeDefined();
    expect(gbpZar?.bpsThreshold).toBeCloseTo(0.004, 6);
  });

  it("includes EUR/ZAR at 0.40% (CEO-approved value)", () => {
    const eurZar = DEFAULT_IPV_TOLERANCE_CONFIG.pairs.find((p) => p.canonicalPair === "EUR/ZAR");
    expect(eurZar).toBeDefined();
    expect(eurZar?.bpsThreshold).toBeCloseTo(0.004, 6);
  });

  it("default fallback is 0.40% at ZAR 50,000", () => {
    expect(DEFAULT_IPV_TOLERANCE_CONFIG.defaultBpsThreshold).toBeCloseTo(0.004, 6);
    expect(DEFAULT_IPV_TOLERANCE_CONFIG.defaultAbsoluteZarMinor).toBe(5_000_000);
  });
});

describe("lookupIpvTolerance", () => {
  it("returns USD/ZAR per-pair row for USD/ZAR input (direct match)", () => {
    const r = lookupIpvTolerance("USD", "ZAR");
    expect(r.source).toBe("per-pair");
    expect(r.canonicalPair).toBe("USD/ZAR");
    expect(r.bpsThreshold).toBeCloseTo(0.0055, 6);
  });

  it("returns USD/ZAR per-pair row for ZAR/USD input (canonical inversion)", () => {
    const r = lookupIpvTolerance("ZAR", "USD");
    expect(r.source).toBe("per-pair");
    // Canonical pair MUST be USD/ZAR (foreign-base convention for ZAR pairs).
    expect(r.canonicalPair).toBe("USD/ZAR");
    expect(r.bpsThreshold).toBeCloseTo(0.0055, 6);
  });

  it("returns GBP/ZAR per-pair row for ZAR/GBP input (canonical inversion)", () => {
    const r = lookupIpvTolerance("ZAR", "GBP");
    expect(r.source).toBe("per-pair");
    expect(r.canonicalPair).toBe("GBP/ZAR");
    expect(r.bpsThreshold).toBeCloseTo(0.004, 6);
  });

  it("falls back to default for non-listed pair (e.g. EUR/USD)", () => {
    const r = lookupIpvTolerance("EUR", "USD");
    expect(r.source).toBe("default");
    expect(r.canonicalPair).toBe("EUR/USD");
    expect(r.bpsThreshold).toBeCloseTo(0.004, 6);
  });

  it("falls back to default for unlisted ZAR pair (e.g. AUD/ZAR)", () => {
    const r = lookupIpvTolerance("AUD", "ZAR");
    expect(r.source).toBe("default");
    expect(r.canonicalPair).toBe("AUD/ZAR");
    expect(r.bpsThreshold).toBeCloseTo(0.004, 6);
  });
});

describe("checkIpvTolerance per-pair behaviour (DEFAULT config)", () => {
  // USD/ZAR uses 0.55% — a 0.45% divergence does NOT breach (would breach
  // on the legacy 0.25%, would breach on the 0.40% default if pair were
  // unlisted).
  //   primary=18.50, secondary=18.5 * 1.0045 = 18.58325
  //   pct = 0.0045 < 0.0055 → NOT breach
  it("USD/ZAR pair: 0.45% divergence does NOT breach (under 0.55% per-pair)", () => {
    const primary = 18.5;
    const secondary = primary * 1.0045;
    const r = checkIpvTolerance(primary, secondary, 100_000_00, "USD", "ZAR");
    expect(r.pass).toBe(true);
    expect(r.source).toBe("per-pair");
    expect(r.canonicalPair).toBe("USD/ZAR");
    expect(r.bpsThresholdApplied).toBeCloseTo(0.0055, 6);
  });

  // USD/ZAR uses 0.55% — a 0.60% divergence DOES breach.
  it("USD/ZAR pair: 0.60% divergence DOES breach (over 0.55% per-pair)", () => {
    const primary = 18.5;
    const secondary = primary * 1.006;
    const r = checkIpvTolerance(primary, secondary, 100_000_00, "USD", "ZAR");
    expect(r.pass).toBe(false);
    expect(r.breachThreshold).toBe("pct");
    expect(r.source).toBe("per-pair");
    expect(r.canonicalPair).toBe("USD/ZAR");
    expect(r.bpsThresholdApplied).toBeCloseTo(0.0055, 6);
  });

  // Canonical-pair integration: ZAR/USD input must resolve to the USD/ZAR
  // tolerance row. A 0.50% divergence is under the USD/ZAR 0.55% threshold
  // and must NOT breach — proves the lookup goes through canonical-pair.
  it("ZAR/USD input applies USD/ZAR per-pair tolerance via canonical inversion", () => {
    // primaryRate is in ZAR/USD direction (e.g. 1/18.5 ≈ 0.054054).
    // Threshold logic is rate-direction-agnostic since we compare relative %.
    const primary = 1 / 18.5;
    const secondary = primary * 1.005; // 0.50% < 0.55% USD/ZAR threshold
    const r = checkIpvTolerance(primary, secondary, 100_000_00, "ZAR", "USD");
    expect(r.pass).toBe(true);
    expect(r.source).toBe("per-pair");
    expect(r.canonicalPair).toBe("USD/ZAR");
    expect(r.bpsThresholdApplied).toBeCloseTo(0.0055, 6);
  });

  // Default fallback: a non-listed pair (e.g. AUD/USD) uses default 0.40%.
  // A 0.42% divergence DOES breach under the default.
  it("non-listed pair uses default 0.40% threshold (breaches at 0.42%)", () => {
    const primary = 0.65; // AUD/USD-ish
    const secondary = primary * 1.0042;
    const r = checkIpvTolerance(primary, secondary, 100_000_00, "AUD", "USD");
    expect(r.pass).toBe(false);
    expect(r.breachThreshold).toBe("pct");
    expect(r.source).toBe("default");
    expect(r.bpsThresholdApplied).toBeCloseTo(0.004, 6);
  });

  // GBP/ZAR uses 0.40% per-pair. A 0.42% divergence DOES breach.
  it("GBP/ZAR pair: 0.42% divergence DOES breach (over 0.40% per-pair)", () => {
    const primary = 23.0;
    const secondary = primary * 1.0042;
    const r = checkIpvTolerance(primary, secondary, 100_000_00, "GBP", "ZAR");
    expect(r.pass).toBe(false);
    expect(r.breachThreshold).toBe("pct");
    expect(r.source).toBe("per-pair");
    expect(r.canonicalPair).toBe("GBP/ZAR");
    expect(r.bpsThresholdApplied).toBeCloseTo(0.004, 6);
  });

  // Absolute ZAR threshold unchanged (50,000). A tiny pct + huge notional
  // hits the ZAR threshold instead of pct.
  //   USD/ZAR: pct threshold = 0.55%, so we need pct < 0.0055.
  //   delta = 0.01, primary = 18.5 → pct = 0.054% < 0.55% (pct ok)
  //   notional = 600_000_000 cents (R6M)
  //   zarImpact (minor) = 0.01 × 600_000_000 = 6_000_000 minor = ZAR 60,000 > 50,000 → BREACH
  it("USD/ZAR pair: ZAR absolute threshold still binds at ZAR 60k impact", () => {
    const r = checkIpvTolerance(18.5, 18.51, 600_000_000, "USD", "ZAR");
    expect(r.pass).toBe(false);
    expect(r.breachThreshold).toBe("zar");
    expect(r.divergenceZar).toBeCloseTo(60_000, 0);
    expect(r.source).toBe("per-pair");
  });
});

describe("checkIpvTolerance — config override (shadow vs live config separable)", () => {
  it("respects an explicit override config (shadow-window analyst tooling)", () => {
    const tight: IpvToleranceConfig = {
      pairs: [{ canonicalPair: "USD/ZAR", bpsThreshold: 0.001, absoluteZarMinor: 5_000_000 }],
      defaultBpsThreshold: 0.001,
      defaultAbsoluteZarMinor: 5_000_000,
      mode: "shadow",
      cutoverDate: "2026-06-04",
    };
    // 0.20% divergence breaches the tight 0.10% threshold.
    const primary = 18.5;
    const secondary = primary * 1.002;
    const r = checkIpvTolerance(primary, secondary, 100_000_00, "USD", "ZAR", tight);
    expect(r.pass).toBe(false);
    expect(r.breachThreshold).toBe("pct");
    expect(r.bpsThresholdApplied).toBeCloseTo(0.001, 6);
  });
});
