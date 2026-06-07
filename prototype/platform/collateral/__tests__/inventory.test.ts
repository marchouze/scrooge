// platform/collateral/__tests__/inventory.test.ts
//
// Unit tests for the collateral inventory projection.
// Uses computeInventoryTotals (pure function) to avoid event-store dependency.
// Authority: BA 110 Annex 1; Banks Act Reg 26; D-TREASURY-GAPS-WAVE1.

import { describe, expect, it } from "bun:test";
import { computeInventoryTotals } from "../inventory";
import type { CollateralPosition } from "../inventory";

const AS_OF = "2026-05-19T06:30:00.000Z";

function makePosition(
  overrides: Partial<CollateralPosition> &
    Pick<CollateralPosition, "isin" | "marketValueZar" | "hqlaLevel" | "haircut">,
): CollateralPosition {
  const computedAdjusted = overrides.marketValueZar * (1 - overrides.haircut);
  const haircutAdjustedValueZar = overrides.haircutAdjustedValueZar ?? computedAdjusted;
  return {
    description: overrides.isin,
    faceValue: overrides.marketValueZar,
    currency: "ZAR",
    eligibilityRationale: "test",
    ...overrides,
    haircutAdjustedValueZar,
  };
}

describe("computeInventoryTotals", () => {
  // -----------------------------------------------------------------------
  // Zero-position baseline
  // -----------------------------------------------------------------------

  it("zero positions → all zeros, no cap breaches", () => {
    const result = computeInventoryTotals(AS_OF, []);
    expect(result.positions).toHaveLength(0);
    expect(result.l1Zar).toBe(0);
    expect(result.l2aZar).toBe(0);
    expect(result.l2bZar).toBe(0);
    expect(result.totalHQLAZar).toBe(0);
    expect(result.l2CapBreached).toBe(false);
    expect(result.l2bCapBreached).toBe(false);
    expect(result.currency).toBe("ZAR");
    expect(result.asOf).toBe(AS_OF);
  });

  // -----------------------------------------------------------------------
  // 3 L1 bonds + 1 L2a
  // -----------------------------------------------------------------------

  it("3 L1 bonds + 1 L2a → correct totals + haircuts, no cap breaches", () => {
    // L1 bonds: 0% haircut → adjusted = market value
    const l1a = makePosition({
      isin: "ZAG000001",
      marketValueZar: 10_000_000,
      hqlaLevel: "L1",
      haircut: 0,
    });
    const l1b = makePosition({
      isin: "ZAG000002",
      marketValueZar: 20_000_000,
      hqlaLevel: "L1",
      haircut: 0,
    });
    const l1c = makePosition({
      isin: "ZAG000003",
      marketValueZar: 30_000_000,
      hqlaLevel: "L1",
      haircut: 0,
    });
    // L2a: 15% haircut
    const l2a = makePosition({
      isin: "ZAE000100",
      marketValueZar: 10_000_000,
      hqlaLevel: "L2a",
      haircut: 0.15,
    });

    const result = computeInventoryTotals(AS_OF, [l1a, l1b, l1c, l2a]);

    expect(result.l1Zar).toBeCloseTo(60_000_000, 0); // 10M + 20M + 30M (no haircut)
    expect(result.l2aZar).toBeCloseTo(8_500_000, 0); // 10M × 0.85
    expect(result.l2bZar).toBe(0);
    expect(result.totalHQLAZar).toBeCloseTo(68_500_000, 0);
    expect(result.l2CapBreached).toBe(false); // L2a = 8.5M / 68.5M ≈ 12.4% < 40%
    expect(result.l2bCapBreached).toBe(false);
  });

  // -----------------------------------------------------------------------
  // L2 cap breach test
  // -----------------------------------------------------------------------

  it("L2a > 40% of total HQLA → l2CapBreached: true", () => {
    // L1: 10M (adjusted)
    const l1 = makePosition({
      isin: "ZAG000001",
      marketValueZar: 10_000_000,
      hqlaLevel: "L1",
      haircut: 0,
    });
    // L2a: 8M market value × 0.85 haircut = 6.8M adjusted
    // To breach: L2 > 40% of total. Let L1 = 10M, L2a needs > 40/60 * 10M ≈ 6.67M adjusted.
    // Use market value 10M → adjusted 8.5M. Total = 18.5M. L2a/total = 8.5/18.5 ≈ 45.9% > 40%.
    const l2a = makePosition({
      isin: "ZAE000200",
      marketValueZar: 10_000_000,
      hqlaLevel: "L2a",
      haircut: 0.15,
    });

    const result = computeInventoryTotals(AS_OF, [l1, l2a]);

    expect(result.l1Zar).toBe(10_000_000);
    expect(result.l2aZar).toBeCloseTo(8_500_000, 0);
    expect(result.totalHQLAZar).toBeCloseTo(18_500_000, 0);
    // L2 pct = 8.5 / 18.5 ≈ 45.9% > 40% → breach
    expect(result.l2CapBreached).toBe(true);
    expect(result.l2bCapBreached).toBe(false);
  });

  // -----------------------------------------------------------------------
  // L2b cap breach test
  // -----------------------------------------------------------------------

  it("L2b > 15% of total HQLA → l2bCapBreached: true", () => {
    // L1: 100M (adjusted), L2b: 20M (market) × 0.5 haircut = 10M adjusted.
    // Total = 110M. L2b / total = 10 / 110 ≈ 9.1% → OK.
    // To breach: L1 small enough relative to L2b.
    // L1 = 30M, L2b = 30M × (1-0.5) = 15M adjusted. Total = 45M. L2b/total = 15/45 = 33.3% > 15%.
    const l1 = makePosition({
      isin: "ZAG000001",
      marketValueZar: 30_000_000,
      hqlaLevel: "L1",
      haircut: 0,
    });
    const l2b = makePosition({
      isin: "ZAE000300",
      marketValueZar: 30_000_000,
      hqlaLevel: "L2b",
      haircut: 0.5,
    });

    const result = computeInventoryTotals(AS_OF, [l1, l2b]);

    expect(result.l1Zar).toBe(30_000_000);
    expect(result.l2bZar).toBeCloseTo(15_000_000, 0);
    expect(result.totalHQLAZar).toBeCloseTo(45_000_000, 0);
    // L2b pct = 15 / 45 = 33.3% > 15% → breach
    expect(result.l2bCapBreached).toBe(true);
    // L2 pct = 15 / 45 = 33.3% < 40% → no breach
    expect(result.l2CapBreached).toBe(false);
  });

  // -----------------------------------------------------------------------
  // non-HQLA positions excluded from buffer
  // -----------------------------------------------------------------------

  it("non-HQLA positions are excluded from the HQLA buffer", () => {
    const l1 = makePosition({
      isin: "ZAG000001",
      marketValueZar: 10_000_000,
      hqlaLevel: "L1",
      haircut: 0,
    });
    const nonHQLA = makePosition({
      isin: "ZAE000999",
      marketValueZar: 50_000_000,
      hqlaLevel: "non-HQLA",
      haircut: 1.0,
      haircutAdjustedValueZar: 0, // 50M × (1 - 1.0) = 0
    });

    const result = computeInventoryTotals(AS_OF, [l1, nonHQLA]);

    expect(result.totalHQLAZar).toBe(10_000_000); // only L1 counts
    expect(result.l1Zar).toBe(10_000_000);
    expect(result.positions).toHaveLength(2);
    expect(result.l2CapBreached).toBe(false);
    expect(result.l2bCapBreached).toBe(false);
  });
});
