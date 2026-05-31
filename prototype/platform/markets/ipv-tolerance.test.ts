// platform/markets/ipv-tolerance.test.ts
//
// Unit tests for the IPV tolerance engine — FX-spot tiers (preserved) plus the
// all-asset-class per-(IFRS-13 level × parameter type) schedule extension.
//
// Author: Bea (Accounting & financial reporting engineer, engineering) with
//   Rohan (Market risk engineer, engineering) risk inputs.

import { describe, expect, it } from "bun:test";

import {
  IFRS_FAIR_VALUE_LEVELS,
  IPV_PARAMETER_TYPES,
  checkIpvScheduleTolerance,
  checkIpvTolerance,
  getIpvScheduleTolerance,
  getIpvThresholds,
} from "./ipv-tolerance";

describe("ipv-tolerance — FX-spot tiers (preserved, no regression)", () => {
  it("Tier 1 ZAR cross uses 0.75% band", () => {
    expect(getIpvThresholds("USD/ZAR").pctThreshold).toBe(0.0075);
  });
  it("Tier 2 (unknown / thin) uses 1.00% band", () => {
    expect(getIpvThresholds("NOK/SEK").pctThreshold).toBe(0.01);
  });
  it("passes a within-tolerance FX mark", () => {
    const r = checkIpvTolerance(18.5, 18.51, 1_000, "USD/ZAR");
    expect(r.pass).toBe(true);
  });
});

describe("ipv-tolerance — all-asset-class schedule (per IFRS-13 level × parameter)", () => {
  it("covers every (level, parameter) pair with a finite positive band", () => {
    for (const level of IFRS_FAIR_VALUE_LEVELS) {
      for (const param of IPV_PARAMETER_TYPES) {
        const { pctThreshold, zarThreshold } = getIpvScheduleTolerance(level, param);
        expect(Number.isFinite(pctThreshold)).toBe(true);
        expect(pctThreshold).toBeGreaterThan(0);
        expect(zarThreshold).toBeGreaterThan(0);
      }
    }
  });

  it("tightens as the IFRS-13 level improves (L1 price < L2 price < L3 price)", () => {
    expect(getIpvScheduleTolerance("1", "price").pctThreshold).toBeLessThan(
      getIpvScheduleTolerance("2", "price").pctThreshold,
    );
    expect(getIpvScheduleTolerance("2", "price").pctThreshold).toBeLessThan(
      getIpvScheduleTolerance("3", "price").pctThreshold,
    );
  });

  it("widens credit-spread relative to outright price at the same level", () => {
    expect(getIpvScheduleTolerance("3", "credit-spread").pctThreshold).toBeGreaterThan(
      getIpvScheduleTolerance("3", "price").pctThreshold,
    );
  });

  it("breaches a Level-1 price mark diverging beyond 0.25%", () => {
    // 100.0 vs 100.5 = 0.50% > 0.25% L1-price band → breach.
    const r = checkIpvScheduleTolerance(100.0, 100.5, 1_000, "1", "price");
    expect(r.pass).toBe(false);
    expect(r.breachThreshold).toBe("pct");
  });

  it("passes the same divergence at Level 3 (wider band)", () => {
    // 0.50% < 1.00% L3-price band → pass on relative; small ZAR exposure.
    const r = checkIpvScheduleTolerance(100.0, 100.5, 1_000, "3", "price");
    expect(r.pass).toBe(true);
  });

  it("throws on a zero primary rate (division guard)", () => {
    expect(() => checkIpvScheduleTolerance(0, 1, 1_000, "1", "price")).toThrow();
  });
});
