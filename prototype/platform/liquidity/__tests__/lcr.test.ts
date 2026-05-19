// platform/liquidity/__tests__/lcr.test.ts
//
// Unit tests for the LCR computation engine.
//
// Authority: D-TREASURY-GAPS-WAVE1; BA 325; Basel III.
// Author: Anya (Liquidity & projections engineer, engineering)

import { describe, expect, it } from "bun:test";
import { computeLCR } from "../lcr";

describe("computeLCR", () => {
  // -------------------------------------------------------------------------
  // Zero-position baseline (build phase)
  // -------------------------------------------------------------------------
  describe("zero-position baseline", () => {
    it("returns no-positions status when both inputs are empty", () => {
      const result = computeLCR([], []);
      expect(result.status).toBe("no-positions");
      expect(result.lcrRatioPct).toBeNull();
      expect(result.hqlaZar).toBe(0);
      expect(result.netCashOutflowsZar).toBe(0);
    });

    it("returns no-positions when all position amounts are zero", () => {
      const result = computeLCR(
        [{ amountZar: 0, tier: "L1" }],
        [{ amountZar: 0, category: "retail-stable" }],
      );
      expect(result.status).toBe("no-positions");
      expect(result.lcrRatioPct).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Well-funded synthetic: R100m L1 HQLA; R50m unstable outflows
  // -------------------------------------------------------------------------
  describe("well-funded synthetic", () => {
    it("returns above-minimum status when HQLA comfortably exceeds outflows", () => {
      const result = computeLCR(
        [{ amountZar: 100_000_000, tier: "L1" }],
        [{ amountZar: 50_000_000, category: "retail-less-stable" }],
      );
      // L1 haircut = 0%, so HQLA = R100m
      // Run-off rate for retail-less-stable = 10%, so stressed outflow = R5m
      // No inflows, so net outflows = R5m
      // LCR = 100m / 5m = 2000%
      expect(result.status).toBe("above-minimum");
      expect(result.lcrRatioPct).not.toBeNull();
      expect(result.lcrRatioPct as number).toBeGreaterThan(100);
      expect(result.hqlaZar).toBe(100_000_000);
      expect(result.netCashOutflowsZar).toBe(5_000_000);
    });

    it("correctly applies L1 zero-haircut", () => {
      const result = computeLCR(
        [{ amountZar: 200_000_000, tier: "L1" }],
        [{ amountZar: 100_000_000, category: "wholesale-non-operational" }],
      );
      // L1 haircut = 0% → HQLA = R200m
      // Wholesale non-operational run-off = 100% → stressed outflow = R100m
      // LCR = 200m / 100m = 200%
      expect(result.hqlaZar).toBe(200_000_000);
      expect(result.netCashOutflowsZar).toBe(100_000_000);
      expect(result.lcrRatioPct).toBeCloseTo(200, 1);
      expect(result.status).toBe("above-minimum");
    });

    it("applies inflow 75% cap correctly", () => {
      const result = computeLCR(
        [{ amountZar: 100_000_000, tier: "L1" }],
        [
          { amountZar: 50_000_000, category: "wholesale-non-operational" }, // outflow
          { amountZar: 60_000_000, category: "inflow-contractual" }, // inflow
        ],
      );
      // Stressed outflow = R50m (100% run-off)
      // Stressed inflow = R60m contractual (100% rate)
      // 75% cap = 75% × R50m = R37.5m
      // Recognised inflows = min(R60m, R37.5m) = R37.5m
      // Net outflows = R50m − R37.5m = R12.5m
      // LCR = R100m / R12.5m = 800%
      expect(result.netCashOutflowsZar).toBeCloseTo(12_500_000, 0);
      expect(result.status).toBe("above-minimum");
    });

    it("applies L2a 15% haircut", () => {
      const result = computeLCR(
        [{ amountZar: 100_000_000, tier: "L2a" }],
        [{ amountZar: 50_000_000, category: "wholesale-non-operational" }],
      );
      // L2a haircut = 15% → post-haircut L2a = R85m
      // L2 cap: L2a ≤ (40/60) × L1. Since L1 = 0, the cap = 0.
      // So effective L2a = 0.
      // HQLA = 0, net outflows = R50m → LCR = 0% (below minimum)
      expect(result.hqlaZar).toBe(0);
      expect(result.status).toBe("below-minimum");
    });

    it("allows L2 when L1 is also present (cap not binding)", () => {
      const result = computeLCR(
        [
          { amountZar: 200_000_000, tier: "L1" },
          { amountZar: 50_000_000, tier: "L2a" },
        ],
        [{ amountZar: 50_000_000, category: "wholesale-non-operational" }],
      );
      // L1 = R200m (haircut 0%)
      // L2a post-haircut = 50m × 0.85 = R42.5m
      // L2 cap = (40/60) × 200m = R133.3m → not binding
      // HQLA = 200m + 42.5m = R242.5m
      // Outflow = R50m
      // LCR = 242.5m / 50m = 485%
      expect(result.hqlaZar).toBeCloseTo(242_500_000, 0);
      expect(result.status).toBe("above-minimum");
    });
  });

  // -------------------------------------------------------------------------
  // Under-funded synthetic: R10m HQLA; R50m outflows
  // -------------------------------------------------------------------------
  describe("under-funded synthetic", () => {
    it("returns below-minimum status when HQLA is insufficient", () => {
      const result = computeLCR(
        [{ amountZar: 10_000_000, tier: "L1" }],
        [{ amountZar: 50_000_000, category: "wholesale-non-operational" }],
      );
      // HQLA = R10m
      // Stressed outflow = R50m (100% run-off)
      // LCR = 10m / 50m = 20% (below 100%)
      expect(result.status).toBe("below-minimum");
      expect(result.lcrRatioPct).not.toBeNull();
      expect(result.lcrRatioPct as number).toBeLessThan(100);
    });

    it("returns correct LCR ratio when below minimum", () => {
      const result = computeLCR(
        [{ amountZar: 30_000_000, tier: "L1" }],
        [{ amountZar: 50_000_000, category: "wholesale-non-operational" }],
      );
      // HQLA = R30m, outflows = R50m → LCR = 60%
      expect(result.lcrRatioPct).toBeCloseTo(60, 1);
      expect(result.status).toBe("below-minimum");
    });

    it("applies secured funding run-off rates correctly", () => {
      const result = computeLCR(
        [{ amountZar: 10_000_000, tier: "L1" }],
        [
          { amountZar: 100_000_000, category: "secured-level1" }, // 0% run-off
          { amountZar: 100_000_000, category: "secured-level2" }, // 15% run-off
        ],
      );
      // Secured L1: R100m × 0% = R0 outflow
      // Secured L2: R100m × 15% = R15m outflow
      // HQLA = R10m
      // LCR = 10m / 15m ≈ 66.7% (below minimum)
      expect(result.netCashOutflowsZar).toBeCloseTo(15_000_000, 0);
      expect(result.status).toBe("below-minimum");
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe("edge cases", () => {
    it("handles zero outflows with positive HQLA (above-minimum)", () => {
      const result = computeLCR(
        [{ amountZar: 100_000_000, tier: "L1" }],
        [{ amountZar: 100_000_000, category: "secured-level1" }], // 0% run-off
      );
      expect(result.netCashOutflowsZar).toBe(0);
      expect(result.status).toBe("above-minimum");
      expect(result.lcrRatioPct).toBeNull(); // effectively infinite
    });

    it("applies L2b cap when L2b exceeds (15/85) × L1", () => {
      const result = computeLCR(
        [
          { amountZar: 100_000_000, tier: "L1" },
          { amountZar: 100_000_000, tier: "L2b" }, // post-haircut = 75m, cap = (15/85)*100m ≈ 17.6m
        ],
        [{ amountZar: 50_000_000, category: "wholesale-non-operational" }],
      );
      // L2b cap = (15/85) × 100m ≈ 17.647m
      // L2b post-haircut = 100m × 0.75 = 75m → capped to 17.647m
      // L2 cap = (40/60) × 100m = 66.7m → L2b_capped (17.647m) < 66.7m → not binding
      // HQLA = 100m + 17.647m ≈ 117.647m
      expect(result.detail.l2bCapBinding).toBe(true);
      expect(result.hqlaZar).toBeCloseTo(100_000_000 + (15 / 85) * 100_000_000, 0);
    });
  });
});
