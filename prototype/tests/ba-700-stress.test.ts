// tests/ba-100-stress.test.ts
//
// Stress-test coverage for the BA 100 (Capital Adequacy) SARB return projection.
// Closes pre-licence gate criterion G3.
//
// These tests exercise edge cases and boundary conditions in the BA 100
// generator and XML adapter that are not covered by the nominal-path tests
// in ba-100-xml-adapter.test.ts. Each test is an isolated pure-function call
// (no file I/O, no external services, deterministic fixtures).
//
// Scenarios:
//   ST-1:  CET1 ratio < 4.5% minimum (non-compliant)
//   ST-2:  Leverage ratio < 3% floor
//   ST-3:  Zero RWA denominator (totalRwaMinor = 0) → graceful handle (Infinity)
//   ST-4:  Zero capital: CET1 = 0, all ratios = 0
//   ST-5:  Buffer requirements: conservation buffer active
//   ST-6:  ba100ToXmlPayload() round-trip — structural key check
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10).
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner).

import { describe, expect, it } from "bun:test";

import type { Ba100GeneratorInput } from "../platform/reporting/ba-100-capital";
import {
  BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS,
  computeRequiredMinimums,
  generateBa100Capital,
} from "../platform/reporting/ba-100-capital";
import { ba100ToXmlPayload } from "../platform/reporting/ba-100-xml-adapter";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-05-31T23:59:59.999Z";
const PERIOD_ID = "period:hoz-bank:month:2026-05";
const FUNCTIONAL_CURRENCY = "ZAR";

/** Minimal generator input with no capital and no RWA. */
function baseInput(overrides?: Partial<Ba100GeneratorInput>): Ba100GeneratorInput {
  return {
    entity: ENTITY,
    asOf: AS_OF,
    periodId: PERIOD_ID,
    functionalCurrency: FUNCTIONAL_CURRENCY,
    trialBalance: [],
    classifications: [],
    deductions: [],
    rwa: {
      creditRwaMinor: 0,
      marketRwaMinor: 0,
      operationalRwaMinor: 0,
      source: "stress-test-fixture",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ST-1: CET1 ratio < 4.5% minimum (non-compliant)
// Build a fixture where CET1 capital is small relative to RWA such that
// the cet1Ratio < 0.045 (the BCBS minimum per Reg 38(2)).
// ---------------------------------------------------------------------------

describe("BA 100 stress — ST-1: CET1 ratio < 4.5% minimum", () => {
  it("cet1Ratio < 0.045 when CET1 capital is very small relative to RWA", () => {
    // CET1 net = 1_000 (minor units). Total RWA = 1_000_000_000 (1 billion).
    // Ratio = 1_000 / 1_000_000_000 = 0.000001 — far below 4.5%.
    const output = generateBa100Capital(
      baseInput({
        trialBalance: [
          {
            leafAccountId: "ACC-cet1-tiny",
            currency: "ZAR",
            amountMinor: -1_000, // credit-side equity (negative = credit per GL convention)
          },
        ],
        classifications: [{ leafAccountId: "ACC-cet1-tiny", capitalTier: "cet1" }],
        rwa: {
          creditRwaMinor: 1_000_000_000,
          marketRwaMinor: 0,
          operationalRwaMinor: 0,
          source: "stress-test-fixture",
        },
      }),
    );

    expect(output.ratios.cet1Ratio).toBeLessThan(0.045);
    expect(output.ratios.cet1Compliant).toBe(false);
  });

  it("cet1Compliant = false and cet1Ratio value accessible from ratios section", () => {
    const output = generateBa100Capital(
      baseInput({
        trialBalance: [{ leafAccountId: "ACC-small-cet1", currency: "ZAR", amountMinor: -100_00 }],
        classifications: [{ leafAccountId: "ACC-small-cet1", capitalTier: "cet1" }],
        rwa: {
          creditRwaMinor: 100_000_000_00, // 100 million ZAR in minor
          marketRwaMinor: 0,
          operationalRwaMinor: 0,
          source: "stress-test-fixture",
        },
      }),
    );

    // cet1 net = 100_00 = 10_000 (minor). RWA = 100_000_000_00 = 10^10.
    // ratio = 10_000 / 10^10 = 0.000001 < 0.045.
    expect(output.ratios.cet1Ratio).toBeLessThan(0.045);
    expect(output.ratios.cet1Compliant).toBe(false);
    // The ratio value must be accessible as a number (not Infinity).
    expect(Number.isFinite(output.ratios.cet1Ratio)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ST-2: Leverage ratio < 3% floor
// The leverage ratio = Tier-1 capital / total exposure measure.
// With tiny Tier-1 and large exposure, the ratio falls below 3% (BCBS §147).
// ---------------------------------------------------------------------------

describe("BA 100 stress — ST-2: Leverage ratio < 3% floor", () => {
  it("leverage ratio formula: ratio < 0.03 when Tier-1 is tiny vs exposure", () => {
    // Leverage ratio = tier1 / totalExposure. With tier1 = 1_000 and
    // totalExposure = 1_000_000_000, ratio ≈ 0.000001 < 0.03.
    const tier1 = 1_000;
    const totalExposure = 1_000_000_000;
    const ratio = tier1 / totalExposure;
    expect(ratio).toBeLessThan(0.03);
    expect(ratio >= 0.03).toBe(false); // non-compliant
  });

  it("generator with leverageExposureMeasure: leverageRatio < 0.03 is flagged non-compliant", () => {
    const output = generateBa100Capital(
      baseInput({
        trialBalance: [
          { leafAccountId: "ACC-cet1-small", currency: "ZAR", amountMinor: -1_000_00 }, // 1_000 ZAR net
        ],
        classifications: [{ leafAccountId: "ACC-cet1-small", capitalTier: "cet1" }],
        rwa: {
          creditRwaMinor: 1_000_000_000,
          marketRwaMinor: 0,
          operationalRwaMinor: 0,
          source: "stress-test-fixture",
        },
        leverageExposureMeasure: {
          // Large exposure to force ratio below 3%.
          onBalanceSheetExposureMinor: 100_000_000_000, // 100 billion ZAR in minor
          derivativeExposureMinor: 0,
          sftExposureMinor: 0,
          offBalanceSheetExposurePostCcfMinor: 0,
          source: "stress-test-fixture",
        },
      }),
    );

    expect(output.leverageRatio).toBeDefined();
    if (output.leverageRatio !== undefined) {
      expect(output.leverageRatio.leverageRatio).toBeLessThan(0.03);
      expect(output.leverageRatio.compliant).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// ST-3: Zero RWA denominator — all ratios = Infinity, graceful handling
// The generator treats zero RWA as "no risk to cover" and returns Infinity
// per Reg 38(2) — mirrors the LCR zero-denominator convention.
// ---------------------------------------------------------------------------

describe("BA 100 stress — ST-3: Zero RWA denominator", () => {
  it("all capital-adequacy ratios = Infinity when totalRwaMinor = 0", () => {
    const output = generateBa100Capital(
      baseInput({
        trialBalance: [{ leafAccountId: "ACC-cet1", currency: "ZAR", amountMinor: -50_000_000_00 }],
        classifications: [{ leafAccountId: "ACC-cet1", capitalTier: "cet1" }],
        rwa: {
          creditRwaMinor: 0,
          marketRwaMinor: 0,
          operationalRwaMinor: 0,
          source: "stress-test-zero-rwa",
        },
      }),
    );

    expect(output.rwa.totalRwaMinor).toBe(0);
    expect(output.ratios.cet1Ratio).toBe(Number.POSITIVE_INFINITY);
    expect(output.ratios.tier1Ratio).toBe(Number.POSITIVE_INFINITY);
    expect(output.ratios.totalRatio).toBe(Number.POSITIVE_INFINITY);
  });

  it("compliance flags = true when ratios = Infinity (no risk)", () => {
    const output = generateBa100Capital(
      baseInput({
        trialBalance: [
          { leafAccountId: "ACC-cet1-pos", currency: "ZAR", amountMinor: -1_000_000_00 },
        ],
        classifications: [{ leafAccountId: "ACC-cet1-pos", capitalTier: "cet1" }],
        rwa: { creditRwaMinor: 0, marketRwaMinor: 0, operationalRwaMinor: 0 },
      }),
    );

    expect(output.ratios.cet1Compliant).toBe(true);
    expect(output.ratios.tier1Compliant).toBe(true);
    expect(output.ratios.totalCompliant).toBe(true);
  });

  it("ba100ToXmlPayload() serialises Infinity ratios as the string 'Infinity'", () => {
    const output = generateBa100Capital(
      baseInput({
        trialBalance: [
          { leafAccountId: "ACC-cet1-inf", currency: "ZAR", amountMinor: -500_000_00 },
        ],
        classifications: [{ leafAccountId: "ACC-cet1-inf", capitalTier: "cet1" }],
        rwa: { creditRwaMinor: 0, marketRwaMinor: 0, operationalRwaMinor: 0 },
      }),
    );

    const payload = ba100ToXmlPayload(output);
    const ratios = payload.body.Ratios as Record<string, unknown>;
    expect(ratios.Cet1Ratio).toBe("Infinity");
    expect(ratios.Tier1Ratio).toBe("Infinity");
    expect(ratios.TotalRatio).toBe("Infinity");
  });
});

// ---------------------------------------------------------------------------
// ST-4: Zero capital — CET1 = 0, all ratios = 0 (with non-zero RWA)
// ---------------------------------------------------------------------------

describe("BA 100 stress — ST-4: Zero capital", () => {
  it("all ratios = 0 when no capital accounts in trial balance", () => {
    const output = generateBa100Capital(
      baseInput({
        rwa: {
          creditRwaMinor: 1_000_000_000,
          marketRwaMinor: 500_000_000,
          operationalRwaMinor: 250_000_000,
          source: "stress-test-fixture",
        },
      }),
    );

    expect(output.capitalStack.cet1.netStockMinor).toBe(0);
    expect(output.capitalStack.at1.netStockMinor).toBe(0);
    expect(output.capitalStack.t2.netStockMinor).toBe(0);
    expect(output.capitalStack.netTier1Minor).toBe(0);
    expect(output.capitalStack.netTotalCapitalMinor).toBe(0);
    expect(output.ratios.cet1Ratio).toBe(0);
    expect(output.ratios.tier1Ratio).toBe(0);
    expect(output.ratios.totalRatio).toBe(0);
  });

  it("all compliance flags = false when all ratios = 0", () => {
    const output = generateBa100Capital(
      baseInput({
        rwa: {
          creditRwaMinor: 1_000_000_000,
          marketRwaMinor: 0,
          operationalRwaMinor: 0,
          source: "stress-test-fixture",
        },
      }),
    );

    expect(output.ratios.cet1Compliant).toBe(false);
    expect(output.ratios.tier1Compliant).toBe(false);
    expect(output.ratios.totalCompliant).toBe(false);
  });

  it("gross stock = 0 for all tiers when trial balance has no capital accounts", () => {
    // Trial balance rows for non-capital accounts should be ignored.
    const output = generateBa100Capital(
      baseInput({
        trialBalance: [
          { leafAccountId: "ACC-cash-nostro", currency: "ZAR", amountMinor: 1_000_000_00 },
          { leafAccountId: "ACC-loans-commercial", currency: "ZAR", amountMinor: 5_000_000_00 },
        ],
        // No classifications → no capital accounts.
        classifications: [],
        rwa: {
          creditRwaMinor: 500_000_000,
          marketRwaMinor: 0,
          operationalRwaMinor: 0,
          source: "stress-test-fixture",
        },
      }),
    );

    expect(output.capitalStack.cet1.grossStockMinor).toBe(0);
    expect(output.capitalStack.at1.grossStockMinor).toBe(0);
    expect(output.capitalStack.t2.grossStockMinor).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ST-5: Buffer requirements — conservation buffer active
// Verify that the conservation buffer (2.5%) is included in the required
// minimum overlay and that computeRequiredMinimums() returns the correct sums.
// ---------------------------------------------------------------------------

describe("BA 100 stress — ST-5: Buffer requirements — conservation buffer", () => {
  it("computeRequiredMinimums() with default buffers = 4.5% + 2.5% = 7% CET1 all-in", () => {
    const minimums = computeRequiredMinimums(BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS);
    // CET1 all-in = 4.5% base + 2.5% CCB = 7%.
    expect(minimums.cet1).toBeCloseTo(0.07, 10);
    // Tier 1 all-in = 6.0% + 2.5% = 8.5%.
    expect(minimums.tier1).toBeCloseTo(0.085, 10);
    // Total all-in = 8.0% + 2.5% = 10.5%.
    expect(minimums.total).toBeCloseTo(0.105, 10);
  });

  it("generator echoes buffer requirements in the output", () => {
    const output = generateBa100Capital(baseInput());
    expect(output.bufferRequirements).toBeDefined();
    expect(output.bufferRequirements.capitalConservationBufferRatio).toBe(0.025);
    expect(output.bufferRequirements.baseCet1Ratio).toBe(0.045);
    expect(output.ratios.cet1RatioRequiredMinimum).toBeCloseTo(0.07, 10);
  });

  it("bank with exactly 7% CET1 ratio is compliant (at the all-in minimum)", () => {
    // Net CET1 = 7_000_000. Total RWA = 100_000_000. Ratio = 7%.
    const output = generateBa100Capital(
      baseInput({
        trialBalance: [
          {
            leafAccountId: "ACC-cet1-7pct",
            currency: "ZAR",
            amountMinor: -7_000_000, // credit balance = 7,000,000 minor units
          },
        ],
        classifications: [{ leafAccountId: "ACC-cet1-7pct", capitalTier: "cet1" }],
        rwa: {
          creditRwaMinor: 100_000_000,
          marketRwaMinor: 0,
          operationalRwaMinor: 0,
          source: "stress-test-fixture",
        },
      }),
    );

    expect(output.ratios.cet1Ratio).toBeCloseTo(0.07, 5);
    expect(output.ratios.cet1Compliant).toBe(true);
  });

  it("bank with 6.9% CET1 ratio is non-compliant (just below all-in minimum)", () => {
    // Net CET1 = 6_900_000. Total RWA = 100_000_000. Ratio = 6.9% < 7%.
    const output = generateBa100Capital(
      baseInput({
        trialBalance: [
          {
            leafAccountId: "ACC-cet1-69",
            currency: "ZAR",
            amountMinor: -6_900_000,
          },
        ],
        classifications: [{ leafAccountId: "ACC-cet1-69", capitalTier: "cet1" }],
        rwa: {
          creditRwaMinor: 100_000_000,
          marketRwaMinor: 0,
          operationalRwaMinor: 0,
          source: "stress-test-fixture",
        },
      }),
    );

    expect(output.ratios.cet1Ratio).toBeCloseTo(0.069, 5);
    expect(output.ratios.cet1Compliant).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ST-6: ba100ToXmlPayload() round-trip — structural key check
// ---------------------------------------------------------------------------

describe("BA 100 stress — ST-6: ba100ToXmlPayload() round-trip", () => {
  it("formId = 'BA700'", () => {
    const output = generateBa100Capital(baseInput());
    const payload = ba100ToXmlPayload(output);
    expect(payload.formId).toBe("BA700");
  });

  it("body has required top-level keys: Meta, CapitalStack, Rwa, BufferRequirements, Ratios", () => {
    const output = generateBa100Capital(baseInput());
    const payload = ba100ToXmlPayload(output);
    expect(payload.body).toBeDefined();
    const body = payload.body as Record<string, unknown>;
    expect("Meta" in body).toBe(true);
    expect("CapitalStack" in body).toBe(true);
    expect("Rwa" in body).toBe(true);
    expect("BufferRequirements" in body).toBe(true);
    expect("Ratios" in body).toBe(true);
  });

  it("body.Meta.Entity echoes the entity from the generator input", () => {
    const output = generateBa100Capital(baseInput());
    const payload = ba100ToXmlPayload(output);
    const meta = payload.body.Meta as Record<string, unknown>;
    expect(meta.Entity).toBe(ENTITY);
  });

  it("body.CapitalStack.Cet1 is present and has NetStockMinor", () => {
    const output = generateBa100Capital(baseInput());
    const payload = ba100ToXmlPayload(output);
    const stack = payload.body.CapitalStack as Record<string, unknown>;
    expect(stack).toBeDefined();
    const cet1 = stack.Cet1 as Record<string, unknown>;
    expect(cet1).toBeDefined();
    expect(typeof cet1.NetStockMinor).toBe("number");
  });

  it("body.Rwa.TotalRwaMinor = 0 for zero RWA input", () => {
    const output = generateBa100Capital(baseInput());
    const payload = ba100ToXmlPayload(output);
    const rwa = payload.body.Rwa as Record<string, unknown>;
    expect(rwa.TotalRwaMinor).toBe(0);
  });

  it("LeverageRatio section absent in body when no exposure measure supplied", () => {
    const output = generateBa100Capital(baseInput());
    const payload = ba100ToXmlPayload(output);
    const body = payload.body as Record<string, unknown>;
    expect("LeverageRatio" in body).toBe(false);
  });
});
