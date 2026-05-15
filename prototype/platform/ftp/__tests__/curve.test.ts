// platform/ftp/__tests__/curve.test.ts
//
// Tests for FtpCurve: exact tenor lookup, linear interpolation, edge cases.
//
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { describe, expect, it } from "bun:test";

import type { FtpCurvePublishedPayload } from "../../event-store/event-types/ftp";
import { FtpCurve, tenorToDays } from "../curve";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const STANDARD_CURVE: FtpCurvePublishedPayload = {
  curveId: "FTP-ZAR-2026-05-15",
  currency: "ZAR",
  effectiveDate: "2026-05-15",
  tenors: [
    { tenor: "1D", rate: 0.081, basis: "ZARONIA" },
    { tenor: "1M", rate: 0.082, basis: "JIBAR" },
    { tenor: "3M", rate: 0.0858, basis: "JIBAR" },
    { tenor: "6M", rate: 0.089, basis: "JIBAR" },
    { tenor: "1Y", rate: 0.092, basis: "JIBAR" },
    { tenor: "2Y", rate: 0.095, basis: "SAGB-YIELD" },
    { tenor: "5Y", rate: 0.099, basis: "SAGB-YIELD" },
    { tenor: "10Y", rate: 0.103, basis: "SAGB-YIELD" },
  ],
  methodology: "matched-maturity",
  publishedBy: "ravi",
  publishedAt: "2026-05-15T05:45:00.000Z",
};

// ---------------------------------------------------------------------------
// tenorToDays
// ---------------------------------------------------------------------------

describe("tenorToDays", () => {
  it("resolves canonical tenors from the map", () => {
    expect(tenorToDays("1D")).toBe(1);
    expect(tenorToDays("1W")).toBe(7);
    expect(tenorToDays("1M")).toBe(30);
    expect(tenorToDays("3M")).toBe(91);
    expect(tenorToDays("6M")).toBe(182);
    expect(tenorToDays("1Y")).toBe(365);
    expect(tenorToDays("2Y")).toBe(730);
    expect(tenorToDays("5Y")).toBe(1825);
    expect(tenorToDays("10Y")).toBe(3650);
  });

  it("is case-insensitive", () => {
    expect(tenorToDays("1y")).toBe(365);
    expect(tenorToDays("3m")).toBe(91);
    expect(tenorToDays("1w")).toBe(7);
  });

  it("resolves overnight labels", () => {
    expect(tenorToDays("ON")).toBe(1);
    expect(tenorToDays("O/N")).toBe(1);
  });

  it("falls back to heuristic for unlisted tenors", () => {
    // 4W → 28 days
    expect(tenorToDays("4W")).toBe(28);
    // 18M → 540 days
    expect(tenorToDays("18M")).toBe(540);
    // 7Y → 2555 days (from map)
    expect(tenorToDays("7Y")).toBe(2555);
  });

  it("returns null for unrecognised tenor", () => {
    expect(tenorToDays("FOO")).toBeNull();
    expect(tenorToDays("")).toBeNull();
    expect(tenorToDays("XXXXX")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FtpCurve — exact tenor lookup
// ---------------------------------------------------------------------------

describe("FtpCurve.getRateForTenor — exact lookup", () => {
  const curve = new FtpCurve(STANDARD_CURVE);

  it("returns the exact rate for a tenor present in the curve", () => {
    expect(curve.getRateForTenor("1D")).toBe(0.081);
    expect(curve.getRateForTenor("3M")).toBe(0.0858);
    expect(curve.getRateForTenor("1Y")).toBe(0.092);
    expect(curve.getRateForTenor("10Y")).toBe(0.103);
  });

  it("is case-insensitive for tenor lookup", () => {
    expect(curve.getRateForTenor("1y")).toBe(0.092);
    expect(curve.getRateForTenor("3m")).toBe(0.0858);
  });

  it("throws for an unrecognisable tenor", () => {
    expect(() => curve.getRateForTenor("FOO-BAR")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// FtpCurve — linear interpolation
// ---------------------------------------------------------------------------

describe("FtpCurve.getRateForDays — linear interpolation", () => {
  const curve = new FtpCurve(STANDARD_CURVE);

  it("interpolates between 1M (30d) and 3M (91d)", () => {
    // halfway between 30 and 91 = day 60.5 → ~61 days
    const midDays = Math.round((30 + 91) / 2);
    const rate = curve.getRateForDays(midDays);
    // should be between 0.0820 and 0.0858
    expect(rate).toBeGreaterThan(0.082);
    expect(rate).toBeLessThan(0.0858);
    // at the exact midpoint the interpolated rate should be ~0.0839
    expect(rate).toBeCloseTo((0.082 + 0.0858) / 2, 3);
  });

  it("interpolates between 1Y (365d) and 2Y (730d)", () => {
    // day 547 = midpoint between 365 and 730
    const midDays = Math.round((365 + 730) / 2);
    const rate = curve.getRateForDays(midDays);
    expect(rate).toBeGreaterThan(0.092);
    expect(rate).toBeLessThan(0.095);
    expect(rate).toBeCloseTo((0.092 + 0.095) / 2, 3);
  });

  it("returns exact rate when days matches a tenor exactly", () => {
    expect(curve.getRateForDays(365)).toBe(0.092); // 1Y
    expect(curve.getRateForDays(1825)).toBe(0.099); // 5Y
  });

  it("is monotonically non-decreasing across the standard curve", () => {
    const sampleDays = [1, 7, 30, 60, 91, 130, 182, 270, 365, 547, 730, 1000, 1825, 2500, 3650];
    let prev = Number.NEGATIVE_INFINITY;
    for (const d of sampleDays) {
      const rate = curve.getRateForDays(d);
      expect(rate).toBeGreaterThanOrEqual(prev);
      prev = rate;
    }
  });
});

// ---------------------------------------------------------------------------
// FtpCurve — edge cases
// ---------------------------------------------------------------------------

describe("FtpCurve.getRateForDays — edge cases", () => {
  const curve = new FtpCurve(STANDARD_CURVE);

  it("returns the shortest tenor rate for days below the shortest tenor", () => {
    // Standard curve shortest is 1D (1 day, 0.0810)
    expect(curve.getRateForDays(0)).toBe(0.081);
    expect(curve.getRateForDays(-10)).toBe(0.081);
    expect(curve.getRateForDays(1)).toBe(0.081);
  });

  it("returns the longest tenor rate for days beyond the longest tenor", () => {
    // Standard curve longest is 10Y (3650 days, 0.1030)
    expect(curve.getRateForDays(3650)).toBe(0.103);
    expect(curve.getRateForDays(10000)).toBe(0.103);
    expect(curve.getRateForDays(50000)).toBe(0.103);
  });
});

describe("FtpCurve — constructor edge cases", () => {
  it("throws when no tenor points can be derived", () => {
    const badPayload: FtpCurvePublishedPayload = {
      ...STANDARD_CURVE,
      tenors: [{ tenor: "INVALID-TENOR-XYZ", rate: 0.05, basis: "INTERNAL" }],
    };
    expect(() => new FtpCurve(badPayload)).toThrow();
  });

  it("handles a single-tenor curve (flat extension in both directions)", () => {
    const singleTenorPayload: FtpCurvePublishedPayload = {
      ...STANDARD_CURVE,
      tenors: [{ tenor: "1Y", rate: 0.085, basis: "JIBAR" }],
    };
    const c = new FtpCurve(singleTenorPayload);
    // Below the only tenor
    expect(c.getRateForDays(1)).toBe(0.085);
    // Exact
    expect(c.getRateForDays(365)).toBe(0.085);
    // Above
    expect(c.getRateForDays(10000)).toBe(0.085);
  });
});

// ---------------------------------------------------------------------------
// FtpCurve — getRateForTenor via day-based lookup for off-curve tenors
// ---------------------------------------------------------------------------

describe("FtpCurve.getRateForTenor — off-curve tenors resolved via interpolation", () => {
  const curve = new FtpCurve(STANDARD_CURVE);

  it("resolves a 9M tenor (273 days) by interpolation between 6M and 1Y", () => {
    const rate = curve.getRateForTenor("9M");
    // 9M (273d) falls between 6M (182d, 0.0890) and 1Y (365d, 0.0920)
    expect(rate).toBeGreaterThan(0.089);
    expect(rate).toBeLessThan(0.092);
  });

  it("resolves a 3Y tenor (1095 days) by interpolation between 2Y and 5Y", () => {
    const rate = curve.getRateForTenor("3Y");
    // 3Y (1095d) falls between 2Y (730d, 0.0950) and 5Y (1825d, 0.0990)
    expect(rate).toBeGreaterThan(0.095);
    expect(rate).toBeLessThan(0.099);
  });
});
