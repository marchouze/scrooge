// platform/liquidity/__tests__/nsfr.test.ts
//
// Unit tests for the NSFR computation engine.
//
// Authority: D-TREASURY-GAPS-WAVE1; BA 326; Basel III.
// Author: Anya (Liquidity & projections engineer, engineering)

import { describe, expect, it } from "bun:test";
import { computeNSFR } from "../nsfr";

describe("computeNSFR", () => {
  // -------------------------------------------------------------------------
  // Zero-position baseline (build phase)
  // -------------------------------------------------------------------------
  describe("zero-position baseline", () => {
    it("returns no-positions status when both inputs are empty", () => {
      const result = computeNSFR([], []);
      expect(result.status).toBe("no-positions");
      expect(result.nsfrRatioPct).toBeNull();
      expect(result.asfZar).toBe(0);
      expect(result.rsfZar).toBe(0);
    });

    it("returns no-positions when all amounts are zero", () => {
      const result = computeNSFR(
        [{ amountZar: 0, category: "tier1-capital" }],
        [{ amountZar: 0, category: "hqla-l1" }],
      );
      expect(result.status).toBe("no-positions");
      expect(result.nsfrRatioPct).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Well-funded synthetic: stable funding > RSF
  // -------------------------------------------------------------------------
  describe("well-funded synthetic", () => {
    it("returns above-minimum status when ASF exceeds RSF", () => {
      const result = computeNSFR(
        [
          // R200m Tier 1 capital — 100% ASF weight
          { amountZar: 200_000_000, category: "tier1-capital" },
          // R100m retail stable deposits — 95% ASF weight
          { amountZar: 100_000_000, category: "retail-stable-lt1y" },
        ],
        [
          // R100m L1 HQLA — 5% RSF weight
          { amountZar: 100_000_000, category: "hqla-l1" },
          // R50m standard loan > 1Y — 65% RSF weight
          { amountZar: 50_000_000, category: "loan-gt1y-standard" },
        ],
      );
      // ASF = 200m × 100% + 100m × 95% = 200m + 95m = R295m
      // RSF = 100m × 5% + 50m × 65% = 5m + 32.5m = R37.5m
      // NSFR = 295m / 37.5m ≈ 786.7%
      expect(result.status).toBe("above-minimum");
      expect(result.nsfrRatioPct).not.toBeNull();
      expect(result.nsfrRatioPct as number).toBeGreaterThan(100);
      expect(result.asfZar).toBeCloseTo(295_000_000, 0);
      expect(result.rsfZar).toBeCloseTo(37_500_000, 0);
    });

    it("applies correct ASF weights for each category", () => {
      const result = computeNSFR(
        [
          { amountZar: 100_000_000, category: "tier1-capital" }, // 100%
          { amountZar: 100_000_000, category: "tier2-capital-gt1y" }, // 100%
          { amountZar: 100_000_000, category: "retail-stable-lt1y" }, // 95%
          { amountZar: 100_000_000, category: "retail-less-stable-lt1y" }, // 90%
          { amountZar: 100_000_000, category: "wholesale-gt1y" }, // 100%
          { amountZar: 100_000_000, category: "wholesale-lt1y-operational" }, // 50%
          { amountZar: 100_000_000, category: "wholesale-lt1y-non-operational" }, // 0%
        ],
        [{ amountZar: 1_000_000, category: "hqla-l1" }], // 5% = R50k RSF
      );
      // ASF = 100m + 100m + 95m + 90m + 100m + 50m + 0m = R535m
      expect(result.asfZar).toBeCloseTo(535_000_000, 0);
      expect(result.status).toBe("above-minimum");
    });

    it("applies correct RSF weights for each category", () => {
      const result = computeNSFR(
        [{ amountZar: 1_000_000_000, category: "tier1-capital" }], // R1bn ASF
        [
          { amountZar: 100_000_000, category: "hqla-l1" }, // 5%
          { amountZar: 100_000_000, category: "hqla-l2a" }, // 15%
          { amountZar: 100_000_000, category: "hqla-l2b" }, // 50%
          { amountZar: 100_000_000, category: "loan-lt6m" }, // 10%
          { amountZar: 100_000_000, category: "loan-6m-1y" }, // 50%
          { amountZar: 100_000_000, category: "loan-gt1y-standard" }, // 65%
          { amountZar: 100_000_000, category: "loan-gt1y-residential" }, // 85%
          { amountZar: 100_000_000, category: "security-lt1y" }, // 10%
          { amountZar: 100_000_000, category: "security-gt1y-non-hqla" }, // 85%
        ],
      );
      // RSF = 5m + 15m + 50m + 10m + 50m + 65m + 85m + 10m + 85m = R375m
      expect(result.rsfZar).toBeCloseTo(375_000_000, 0);
    });
  });

  // -------------------------------------------------------------------------
  // Short-funded synthetic: ASF < RSF
  // -------------------------------------------------------------------------
  describe("short-funded synthetic", () => {
    it("returns below-minimum status when RSF exceeds ASF", () => {
      const result = computeNSFR(
        [
          // R20m wholesale non-operational < 1Y — 0% ASF weight → zero ASF contribution
          { amountZar: 20_000_000, category: "wholesale-lt1y-non-operational" },
          // R10m retail stable — 95% → R9.5m ASF
          { amountZar: 10_000_000, category: "retail-stable-lt1y" },
        ],
        [
          // R100m residential loans > 1Y — 85% RSF weight → R85m RSF
          { amountZar: 100_000_000, category: "loan-gt1y-residential" },
        ],
      );
      // ASF = 0 + 9.5m = R9.5m
      // RSF = 85m
      // NSFR = 9.5m / 85m ≈ 11.2%
      expect(result.status).toBe("below-minimum");
      expect(result.nsfrRatioPct).not.toBeNull();
      expect(result.nsfrRatioPct as number).toBeLessThan(100);
    });

    it("returns correct NSFR ratio when below minimum", () => {
      const result = computeNSFR(
        [{ amountZar: 50_000_000, category: "tier1-capital" }], // 100% ASF = R50m
        [{ amountZar: 100_000_000, category: "loan-gt1y-standard" }], // 65% RSF = R65m
      );
      // NSFR = 50m / 65m ≈ 76.9%
      expect(result.nsfrRatioPct).toBeCloseTo(76.92, 1);
      expect(result.status).toBe("below-minimum");
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe("edge cases", () => {
    it("handles zero RSF with positive ASF (above-minimum)", () => {
      const result = computeNSFR(
        [{ amountZar: 100_000_000, category: "tier1-capital" }],
        [], // no RSF items
      );
      expect(result.rsfZar).toBe(0);
      expect(result.status).toBe("above-minimum");
      expect(result.nsfrRatioPct).toBeNull(); // effectively infinite
    });

    it("correctly handles at-minimum status (just above 100%, within 5pp band)", () => {
      // NSFR = exactly 102% — should be "at-minimum"
      // Need ASF / RSF = 1.02 → ASF = 102, RSF = 100 units
      const result = computeNSFR(
        [{ amountZar: 102_000_000, category: "tier1-capital" }], // ASF = R102m
        [{ amountZar: 100_000_000, category: "loan-gt1y-standard" }], // RSF = R100m × 65% = R65m
      );
      // ASF = 102m, RSF = 65m → NSFR = 156.9% (above tolerance band)
      // Need to engineer a case where NSFR is in 100-105% band
      // Use: ASF = 102m (tier1), RSF items so RSF total = 100m
      // No straightforward category gives RSF = 100% weight except derivative-net
      const result2 = computeNSFR(
        [{ amountZar: 102_000_000, category: "tier1-capital" }],
        [{ amountZar: 100_000_000, category: "derivative-net" }], // 100% RSF weight
      );
      // ASF = R102m, RSF = R100m → NSFR = 102%
      expect(result2.nsfrRatioPct).toBeCloseTo(102, 1);
      expect(result2.status).toBe("at-minimum");
      void result;
    });
  });
});
