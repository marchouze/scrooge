// scripts/mtm-run.test.ts
//
// Unit tests for the IPV tolerance engine (checkIpvTolerance).
// No EventStore or MarketDataStore required — pure function tests.
//
// Test cases:
//   TC-1: Breach by percentage (0.80% > 0.75% threshold)
//   TC-2: Pass — identical rates (zero divergence)
//   TC-3: Pass — 0.40% inter-provider spread (below new 0.75% threshold)
//   TC-4: Breach by ZAR absolute threshold on large notional (ZAR 210k > ZAR 200k)
//   TC-5: Border case — 0.74% (< 0.75%) — should NOT breach
//   TC-6: Primary rate zero — should throw
//   TC-7: Pass — 0.27% (was a breach under old 0.25% threshold; now within tolerance)
//   TC-8: Pass — ZAR 60k (was a breach under old ZAR 50k threshold; now within tolerance)
//
// Recalibrated per D-MR-1-FX-IPV-TOLERANCES-V2 (Helena, CRO, 2026-05-21):
//   Build-phase thresholds: 0.75% relative, ZAR 200k absolute.
//   Rationale: free-tier FX providers (open-er-api, twelve-data) diverge
//   0.20–0.40% from normal quote-timing / CDN effects; previous 0.25%
//   threshold fired on every USD/ZAR and GBP/ZAR build-phase position.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - pricing-policy-v1.md §5.2 (thresholds: 0.75% / ZAR 200k, build-phase)
//   - D-MR-1-FX-IPV-TOLERANCES-V2 (Helena, CRO, 2026-05-21)
//
// Author: Rohan (Market risk engineer, engineering)

import { describe, expect, it } from "bun:test";

import { checkIpvTolerance } from "../platform/markets/ipv-tolerance";

describe("checkIpvTolerance", () => {
  // TC-1: Breach by percentage (0.80% > 0.75% new threshold)
  //   delta = |18.50 - 18.648| = 0.148
  //   pct   = 0.148 / 18.50 ≈ 0.80% > 0.75% → breach "pct"
  //   notional = 100_000_00 cents = R100,000
  //   zarImpact = 0.148 × (100_000_00 / 100) = 0.148 × 100_000 = 14_800 ZAR < 200_000
  //   (pct threshold fires first)
  it("TC-1: breaches pct threshold at 0.80%", () => {
    const primary = 18.5;
    const secondary = primary + primary * 0.008; // 0.80% > 0.75%
    const delta = Math.abs(primary - secondary);
    const result = checkIpvTolerance(primary, secondary, 100_000_00);
    expect(result.pass).toBe(false);
    expect(result.breachThreshold).toBe("pct");
    expect(result.divergencePct).toBeCloseTo(delta / primary, 8);
    expect(result.divergenceZar).toBeCloseTo(delta * (100_000_00 / 100), 1);
  });

  // TC-2: Pass — identical rates
  it("TC-2: passes with identical rates (zero divergence)", () => {
    const result = checkIpvTolerance(18.5, 18.5, 100_000_00);
    expect(result.pass).toBe(true);
    expect(result.breachThreshold).toBeNull();
    expect(result.divergencePct).toBe(0);
    expect(result.divergenceZar).toBe(0);
  });

  // TC-3: Pass — 0.40% inter-provider spread (typical build-phase noise, below 0.75%)
  //   delta = 18.50 × 0.004 = 0.074
  //   pct   = 0.074 / 18.50 = 0.40% < 0.75% → NOT pct breach
  //   zarImpact = 0.074 × (100_000_00 / 100) = 0.074 × 100_000 = 7_400 ZAR < 200_000
  it("TC-3: passes on both thresholds (0.40% pct, ZAR 7,400 impact)", () => {
    const primary = 18.5;
    const secondary = primary + primary * 0.004; // 0.40% < 0.75%
    const delta = Math.abs(primary - secondary);
    const result = checkIpvTolerance(primary, secondary, 100_000_00);
    expect(result.pass).toBe(true);
    expect(result.breachThreshold).toBeNull();
    expect(result.divergencePct).toBeCloseTo(delta / primary, 8);
    expect(result.divergenceZar).toBeCloseTo(delta * (100_000_00 / 100), 1);
  });

  // TC-4: Breach by ZAR absolute threshold (small pct but very large notional)
  //   delta=0.01, notional=2_100_000_000 cents (R21M)
  //   pct   = 0.01 / 18.50 ≈ 0.054% < 0.75% → NOT pct breach
  //   zarImpact = 0.01 × (2_100_000_000 / 100) = 0.01 × 21_000_000 = 210_000 > 200_000 → ZAR breach
  it("TC-4: breaches ZAR threshold (small pct but large notional)", () => {
    // delta = 0.01, notional = 2_100_000_000 cents = R21 million
    const result = checkIpvTolerance(18.5, 18.51, 2_100_000_000);
    expect(result.pass).toBe(false);
    expect(result.breachThreshold).toBe("zar");
    expect(result.divergencePct).toBeCloseTo(0.01 / 18.5, 8);
    expect(result.divergenceZar).toBeCloseTo(210_000, 0);
  });

  // TC-5: Strictly below PCT threshold at 0.74% — should NOT breach
  //   Using 0.74% (< 0.75%) to avoid floating-point boundary ambiguity.
  //   delta = 18.5 × 0.0074 = 0.1369
  //   zarImpact = 0.1369 × (1_000_00 / 100) = 0.1369 × 1_000 = 136.9 ZAR < 200_000
  it("TC-5: below pct threshold at 0.74% — does not breach", () => {
    const primary = 18.5;
    const secondary = primary + primary * 0.0074; // 0.74% < 0.75%
    const result = checkIpvTolerance(primary, secondary, 1_000_00);
    expect(result.pass).toBe(true);
    expect(result.breachThreshold).toBeNull();
  });

  // TC-6: Zero primary rate — should throw
  it("TC-6: throws on zero primary rate", () => {
    expect(() => checkIpvTolerance(0, 18.5, 100_000_00)).toThrow("primaryRate must not be zero");
  });

  // TC-7: 0.27% divergence — was a breach under old 0.25% threshold; now PASSES
  //   delta = |18.50 - 18.55| = 0.05
  //   pct   = 0.05 / 18.50 ≈ 0.27% < 0.75% → NOT pct breach
  //   zarImpact = 0.05 × (100_000_00 / 100) = 5_000 ZAR < 200_000 → NOT zar breach
  //   This was a build-phase false positive before D-MR-1-FX-IPV-TOLERANCES-V2.
  it("TC-7: 0.27% divergence passes under new 0.75% threshold (was false positive at 0.25%)", () => {
    const result = checkIpvTolerance(18.5, 18.55, 100_000_00);
    expect(result.pass).toBe(true);
    expect(result.breachThreshold).toBeNull();
    expect(result.divergencePct).toBeCloseTo(0.05 / 18.5, 8);
    expect(result.divergenceZar).toBeCloseTo(5_000, 2);
  });

  // TC-8: ZAR 60k on R6M notional — was a breach under old ZAR 50k threshold; now PASSES
  //   delta = 0.01, notional = 600_000_000 cents = R6 million
  //   pct   = 0.01 / 18.50 ≈ 0.054% < 0.75% → NOT pct breach
  //   zarImpact = 0.01 × (600_000_000 / 100) = 60_000 ZAR < 200_000 → NOT zar breach
  //   This was a build-phase false positive before D-MR-1-FX-IPV-TOLERANCES-V2.
  it("TC-8: ZAR 60k impact passes under new ZAR 200k threshold (was false positive at ZAR 50k)", () => {
    const result = checkIpvTolerance(18.5, 18.51, 600_000_000);
    expect(result.pass).toBe(true);
    expect(result.breachThreshold).toBeNull();
    expect(result.divergencePct).toBeCloseTo(0.01 / 18.5, 8);
    expect(result.divergenceZar).toBeCloseTo(60_000, 0);
  });
});
