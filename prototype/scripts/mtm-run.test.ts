// scripts/mtm-run.test.ts
//
// Unit tests for the IPV tolerance engine (checkIpvTolerance).
// No EventStore or MarketDataStore required — pure function tests.
//
// Test cases:
//   TC-1: Breach by percentage (0.27% > 0.25% threshold)
//   TC-2: Pass — identical rates (zero divergence)
//   TC-3: Pass — small divergence below both thresholds
//   TC-4: Breach by ZAR absolute threshold on large notional
//   TC-5: Border case — exactly at the PCT threshold (not breached: strict >)
//   TC-6: Primary rate zero — should throw
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - pricing-policy-v1.md §5.2 (thresholds: 0.25% / ZAR 50k)
//
// Author: Rohan (Market risk engineer, engineering)

import { describe, expect, it } from "bun:test";

import { checkIpvTolerance } from "../platform/markets/ipv-tolerance";

describe("checkIpvTolerance", () => {
  // TC-1: Breach by percentage (0.27% > 0.25%)
  //   delta = |18.50 - 18.55| = 0.05
  //   pct   = 0.05 / 18.50 = 0.002703... ≈ 0.27% > 0.25% → breach "pct"
  //   100_000_00 cents = R100,000 notional
  //   zarImpact = 0.05 × (100_000_00 / 100) = 0.05 × 100_000 = 5_000 ZAR
  //   (pct threshold fires first; ZAR impact = 5_000 < 50_000)
  it("TC-1: breaches pct threshold at 0.27%", () => {
    const result = checkIpvTolerance(18.5, 18.55, 100_000_00);
    expect(result.pass).toBe(false);
    expect(result.breachThreshold).toBe("pct");
    // divergencePct should be the raw fraction ~0.002703
    expect(result.divergencePct).toBeCloseTo(0.05 / 18.5, 8);
    // divergenceZar = 0.05 × (100_000_00 / 100) = 0.05 × 100_000 = 5_000
    expect(result.divergenceZar).toBeCloseTo(5_000, 2);
  });

  // TC-2: Pass — identical rates
  it("TC-2: passes with identical rates (zero divergence)", () => {
    const result = checkIpvTolerance(18.5, 18.5, 100_000_00);
    expect(result.pass).toBe(true);
    expect(result.breachThreshold).toBeNull();
    expect(result.divergencePct).toBe(0);
    expect(result.divergenceZar).toBe(0);
  });

  // TC-3: Pass — small notional, small pct divergence
  //   primary=18.50, secondary=18.53, notional=1_000_00 (1,000 currency units in cents)
  //   delta = 0.03
  //   pct   = 0.03 / 18.50 = 0.001621... ≈ 0.16% < 0.25% → NOT pct breach
  //   zarImpact = 0.03 × (1_000_00 / 100) = 0.03 × 1_000 = 30 ZAR < 50_000 → NOT zar breach
  it("TC-3: passes on both thresholds (0.16% pct, ZAR 30 impact)", () => {
    const result = checkIpvTolerance(18.5, 18.53, 1_000_00);
    expect(result.pass).toBe(true);
    expect(result.breachThreshold).toBeNull();
    expect(result.divergencePct).toBeCloseTo(0.03 / 18.5, 8);
    expect(result.divergenceZar).toBeCloseTo(30, 2);
  });

  // TC-4: Breach by ZAR absolute threshold (large notional, tiny pct)
  //   primary=18.50, secondary=18.501 (very small pct), notional=5_000_000_00 (R50M in cents)
  //   delta = 0.001
  //   pct   = 0.001 / 18.50 ≈ 0.0054% < 0.25% → NOT pct breach
  //   zarImpact = 0.001 × (5_000_000_00 / 100) = 0.001 × 5_000_000 = 5_000 ZAR < 50_000
  //   Let's use delta=0.01 and notional=600_000_000 cents (R6M):
  //   delta = 0.01, notional = 600_000_000 (= R6M in cents)
  //   pct   = 0.01 / 18.50 ≈ 0.054% < 0.25% → NOT pct breach
  //   zarImpact = 0.01 × (600_000_000 / 100) = 0.01 × 6_000_000 = 60_000 > 50_000 → ZAR breach
  it("TC-4: breaches ZAR threshold (small pct but large notional)", () => {
    // secondary = 18.51 (delta = 0.01, pct = 0.054% < 0.25%)
    // notional = 600_000_000 cents = R6 million
    const result = checkIpvTolerance(18.5, 18.51, 600_000_000);
    expect(result.pass).toBe(false);
    expect(result.breachThreshold).toBe("zar");
    expect(result.divergencePct).toBeCloseTo(0.01 / 18.5, 8);
    expect(result.divergenceZar).toBeCloseTo(60_000, 0);
  });

  // TC-5: Strictly below the PCT threshold — should NOT breach
  //   Using 0.24% (< 0.25%) to avoid floating-point boundary ambiguity.
  //   delta = 18.5 × 0.0024 = 0.0444
  //   secondary = 18.5 + 0.0444 = 18.5444
  //   zarImpact = 0.0444 × (1_000_00 / 100) = 0.0444 × 1_000 = 44.4 ZAR < 50_000
  it("TC-5: below pct threshold at 0.24% — does not breach", () => {
    const primary = 18.5;
    const secondary = primary + primary * 0.0024; // 0.24% < 0.25%
    const result = checkIpvTolerance(primary, secondary, 1_000_00);
    expect(result.pass).toBe(true);
    expect(result.breachThreshold).toBeNull();
  });

  // TC-6: Zero primary rate — should throw
  it("TC-6: throws on zero primary rate", () => {
    expect(() => checkIpvTolerance(0, 18.5, 100_000_00)).toThrow("primaryRate must not be zero");
  });
});
