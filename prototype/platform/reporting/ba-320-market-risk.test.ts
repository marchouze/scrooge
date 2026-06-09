// platform/reporting/ba-320-market-risk.test.ts
//
// Tests that the BA 320 (market-risk) generator computes the Reg 28(3)(a)
// IR-general vertical/horizontal disallowance charge FROM the signed weighted-
// nominal maturity ladder by default — NOT a caller-supplied zero
// (B-IRS-DISALLOWANCES). Guards against regression to the old
// `irGeneralDisallowancesMinor ?? 0` understatement of the general-market-risk
// capital charge.
//
// Authority: Regulations Relating to Banks Reg 28(3)(a); BCBS D352 §718(iv)–(x);
//   D-IRS-DV01-BUCKETING-CALIBRATION.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, it } from "bun:test";

import { computeIrGeneralDisallowances } from "./ba-320-ir-maturity-bands";
import { type Ba310GeneratorInput, generateBa310MarketRisk } from "./ba-320-market-risk";

const BASE: Omit<Ba310GeneratorInput, "irGeneralMaturityLadder"> = {
  entity: "LE-ZA-HOZ-BANK",
  asOf: "2026-06-30",
  periodId: "period:hoz-bank:month:2026-06",
  functionalCurrency: "ZAR",
  irSpecificRisk: [],
  equity: [],
  fxPositions: [],
  commodity: [],
};

// A ladder with within-band + cross-zone matching → non-zero disallowance.
const LADDER = [
  { band: "1-2y", weightedLongMinor: 1_000_000, weightedShortMinor: 600_000 },
  { band: "3-4y", weightedLongMinor: 0, weightedShortMinor: 800_000 },
  { band: "5-7y", weightedLongMinor: 2_000_000, weightedShortMinor: 0 },
] as const;

describe("generateBa310MarketRisk — IR-general disallowances", () => {
  it("computes disallowances from the ladder by default (NOT zero)", () => {
    const expected = computeIrGeneralDisallowances(LADDER).totalMinor;
    expect(expected).toBe(340_000); // sanity: the algebra is engaged

    const out = generateBa310MarketRisk({ ...BASE, irGeneralMaturityLadder: LADDER });
    expect(out.interestRateGeneral.disallowancesMinor).toBe(340_000);

    // The disallowance is genuinely folded into the IR-general capital charge.
    const weightedSum = out.interestRateGeneral.maturityLadder.reduce(
      (s, l) => s + l.amountMinor,
      0,
    );
    expect(out.interestRateGeneral.capitalMinor).toBe(weightedSum + 340_000);
  });

  it("REGRESSION GUARD: the old caller-supplied-zero path no longer applies — a non-trivially-matched ladder yields a positive disallowance", () => {
    const out = generateBa310MarketRisk({ ...BASE, irGeneralMaturityLadder: LADDER });
    // Before B-IRS-DISALLOWANCES this was silently 0 (caller never supplied it).
    expect(out.interestRateGeneral.disallowancesMinor).toBeGreaterThan(0);
  });

  it("an explicit caller override still wins (back-compat)", () => {
    const out = generateBa310MarketRisk({
      ...BASE,
      irGeneralMaturityLadder: LADDER,
      irGeneralDisallowancesMinor: 12_345,
    });
    expect(out.interestRateGeneral.disallowancesMinor).toBe(12_345);
  });

  it("a non-canonical band is excluded from the algebra and surfaced as a placeholder", () => {
    const out = generateBa310MarketRisk({
      ...BASE,
      irGeneralMaturityLadder: [
        { band: "weird-band", weightedLongMinor: 1_000_000, weightedShortMinor: 900_000 },
      ],
    });
    // Excluded → no disallowance computed from it.
    expect(out.interestRateGeneral.disallowancesMinor).toBe(0);
    expect(out.placeholders.some((p) => p.includes("non-canonical band"))).toBe(true);
  });
});
