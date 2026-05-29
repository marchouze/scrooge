// tests/financial-constants.test.ts
//
// Unit tests for the Trusted-Figures Phase C financial-constants substrate:
//   - FINANCIAL_CONSTANTS registry is well-formed (unique keys, finite values).
//   - getFinancialConstant() resolves declared keys and throws (loud) on unknown.
//   - The rate-table builders project the registry into the calc engines' shape.
//   - recon:financial-constants-coverage run() asserts registry + calc-file wiring.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import {
  FINANCIAL_CONSTANTS,
  getFinancialConstant,
  lcrHaircutRates,
  lcrRunoffRates,
  nsfrAsfWeights,
  nsfrRsfWeights,
} from "../platform/config/financial-constants";
import { run as runCoverage } from "../platform/recon/financial-constants-coverage";

describe("FINANCIAL_CONSTANTS registry", () => {
  it("has unique keys", () => {
    const keys = FINANCIAL_CONSTANTS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("carries a finite value and complete metadata for every constant", () => {
    for (const c of FINANCIAL_CONSTANTS) {
      expect(Number.isFinite(c.value)).toBe(true);
      expect(c.label.trim().length).toBeGreaterThan(0);
      expect(c.description.trim().length).toBeGreaterThan(0);
      expect(c.owningRole.trim().length).toBeGreaterThan(0);
      expect(c.citation.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("getFinancialConstant", () => {
  it("resolves a declared key to its value", () => {
    expect(getFinancialConstant("lcr.minimum-ratio")).toBe(1.0);
    expect(getFinancialConstant("lcr.runoff.retail-stable")).toBe(0.03);
  });

  it("throws loudly on an unknown key (no silent default)", () => {
    expect(() => getFinancialConstant("lcr.does-not-exist")).toThrow(/unknown constant key/);
  });
});

describe("rate-table builders", () => {
  it("projects LCR run-off rates keyed by funding category", () => {
    const r = lcrRunoffRates();
    expect(r["retail-stable"]).toBe(0.03);
    expect(r["wholesale-non-operational"]).toBe(1.0);
  });

  it("projects LCR haircuts keyed by HQLA tier", () => {
    const h = lcrHaircutRates();
    expect(h.L1).toBe(0.0);
    expect(h.L2a).toBe(0.15);
    expect(h.L2b).toBe(0.25);
  });

  it("projects NSFR ASF/RSF weights keyed by category", () => {
    expect(nsfrAsfWeights()["tier1-capital"]).toBe(1.0);
    expect(nsfrRsfWeights()["hqla-l1"]).toBe(0.05);
  });
});

describe("recon:financial-constants-coverage", () => {
  it("passes against the live registry and calc files", () => {
    const result = runCoverage();
    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    expect(result.asserted).toBe(FINANCIAL_CONSTANTS.length);
  });
});
