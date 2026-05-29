// tests/financial-input.test.ts
//
// Unit tests for the Trusted-Figures Phase B "no silent zero" substrate
// (objective 4 of D-TRUSTED-FIGURES-PROGRAM-V1):
//   - FinancialInput<T> present/absent constructors + guards.
//   - requireValue() reads a present value and throws (loud) on absence.
//   - requireWeight() throws on an unknown weight-table category rather than
//     silently defaulting to 0/100%.
//   - computeLCR / computeNSFR fail loudly (throw) when handed a position whose
//     category is absent from the rate table (registry/union drift), never
//     producing a wrong figure from a silent default.
//   - recon:calc-no-silent-zero run() passes against the live calc engines.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { type FundingPosition, type HQLAPosition, computeLCR } from "../platform/liquidity/lcr";
import { type ASFItem, type RSFItem, computeNSFR } from "../platform/liquidity/nsfr";
import { run as runCalcNoSilentZero } from "../platform/recon/calc-no-silent-zero";
import {
  absent,
  isPresent,
  present,
  requireValue,
  requireWeight,
} from "../platform/types/financial-input";

describe("FinancialInput<T> constructors and guards", () => {
  it("present() carries value + lineage and reads as present", () => {
    const input = present(42, "TradeBooked.notionalZar");
    expect(input.present).toBe(true);
    expect(isPresent(input)).toBe(true);
    if (isPresent(input)) {
      expect(input.value).toBe(42);
      expect(input.lineage).toBe("TradeBooked.notionalZar");
    }
  });

  it("absent() carries reason + expectedFrom and reads as not present", () => {
    const input = absent("no mark snapshot", "MarkSnapshotted");
    expect(input.present).toBe(false);
    expect(isPresent(input)).toBe(false);
    if (!isPresent(input)) {
      expect(input.reason).toBe("no mark snapshot");
      expect(input.expectedFrom).toBe("MarkSnapshotted");
    }
  });

  it("requireValue() returns a present value", () => {
    expect(requireValue(present(7, "x"))).toBe(7);
  });

  it("requireValue() throws loudly on an absent input", () => {
    expect(() => requireValue(absent("missing", "SomeEvent"))).toThrow(/required value absent/);
  });
});

describe("requireWeight() — loud weight-table lookup", () => {
  const TABLE: Record<string, number> = { "retail-stable": 0.05, "wholesale-non-operational": 1.0 };

  it("returns the weight for a known category (including 0)", () => {
    expect(requireWeight(TABLE, "retail-stable", "test.table")).toBe(0.05);
    expect(requireWeight({ zero: 0 }, "zero", "test.zero")).toBe(0);
  });

  it("throws naming the offending key and table on an unknown category", () => {
    expect(() => requireWeight(TABLE, "mystery-category", "test.table")).toThrow(
      /test\.table: no weight for category "mystery-category"/,
    );
  });
});

describe("computeLCR fails loudly on an unknown funding category", () => {
  it("throws rather than silently weighting an unknown category at 0", () => {
    const hqla: HQLAPosition[] = [{ amountZar: 1_000_000, tier: "L1" }];
    // Simulate registry/union drift: a category not present in RUNOFF_RATES.
    const funding = [
      { amountZar: 500_000, category: "drifted-unknown-category" },
    ] as unknown as FundingPosition[];
    expect(() => computeLCR(hqla, funding)).toThrow(/lcr\.runoff: no weight for category/);
  });

  it("throws on an unknown HQLA tier", () => {
    const hqla = [{ amountZar: 1_000_000, tier: "L9" }] as unknown as HQLAPosition[];
    expect(() => computeLCR(hqla, [])).toThrow(/lcr\.haircut: no weight for category/);
  });
});

describe("computeNSFR fails loudly on an unknown category", () => {
  it("throws on an unknown ASF category", () => {
    const asf = [{ amountZar: 1_000_000, category: "drifted-asf" }] as unknown as ASFItem[];
    expect(() => computeNSFR(asf, [])).toThrow(/nsfr\.asf: no weight for category/);
  });

  it("throws on an unknown RSF category", () => {
    const asf: ASFItem[] = [{ amountZar: 1_000_000, category: "tier1-capital" }];
    const rsf = [{ amountZar: 500_000, category: "drifted-rsf" }] as unknown as RSFItem[];
    expect(() => computeNSFR(asf, rsf)).toThrow(/nsfr\.rsf: no weight for category/);
  });
});

describe("recon:calc-no-silent-zero", () => {
  it("passes — calc engines use loud weight lookups, no silent-zero collapse", () => {
    const result = runCalcNoSilentZero();
    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });
});
