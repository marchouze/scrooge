// v2-core/fil-models/ir/bond/bond-model.test.ts
//
// Unit tests for the Phase 3c FVTPL fixed-rate vanilla bond FIL model:
// discounted (PV) Valuable, accrued-coupon Performable, modified-duration
// RiskMeasurable, fail-closed yield + reporting-currency resolution.
//
// Authority: D-V1-REMOVAL-PHASE-3C.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { Instant } from "../../../fil-core/primitives.ts";
import type { EngineId, MarketDataSlice } from "../../../fil-facets/facets.ts";
import {
  bondModifiedDuration,
  bondPerformable,
  bondRiskMeasurable,
  bondValuable,
} from "./bond-model.ts";
import {
  accruedCouponCarry,
  modifiedDuration,
  presentValue,
} from "./performance/bond-methodology.ts";
import { bondYieldKey } from "./shared/bond-observables.ts";
import type { BondPosition } from "./shared/bond-positions.ts";

const ASOF = "2026-06-16T00:00:00.000Z" as Instant;

// A 2-year ZAR bond, R1,000,000 face, 8% annual coupon (annual pay), held long.
// Two remaining coupons of R80,000 at t=1 and t=2; principal R1,000,000 at t=2.
const BOND_ZAR: BondPosition = {
  kind: "bond-fixed-rate-vanilla",
  isin: "ZAG000149037",
  currency: "ZAR",
  faceValue: "1000000.00",
  couponRate: 0.08,
  couponsPerYear: 1,
  remainingCoupons: [
    { amount: "80000.00", timeYears: 1 },
    { amount: "80000.00", timeYears: 2 },
  ],
  maturityYears: 2,
  direction: "long",
  accruedDays: 90,
  fallbackYieldKey: "ZAR:govt-curve:2y",
  reporting: "ZAR",
};

// Market: ISIN yield 8% — at par the PV should equal face (R1,000,000).
const MARKS_AT_PAR: MarketDataSlice = {
  asOf: ASOF,
  observables: { [bondYieldKey(BOND_ZAR.isin)]: 0.08 },
};

// Market: ISIN yield absent; only the fallback curve key present at 10%.
const MARKS_FALLBACK: MarketDataSlice = {
  asOf: ASOF,
  observables: { "ZAR:govt-curve:2y": 0.1 },
};

// Market: neither key present — must fail closed.
const MARKS_EMPTY: MarketDataSlice = { asOf: ASOF, observables: {} };

describe("bond present-value methodology (FVTPL — discounts)", () => {
  test("at-par: yield == coupon → PV equals face value", () => {
    // 80000/1.08 + 80000/1.08^2 + 1000000/1.08^2
    //   = 74074.07 + 68587.11 + 857338.82 = 1,000,000.00
    const v = presentValue({
      faceValue: "1000000.00",
      remainingCoupons: BOND_ZAR.remainingCoupons,
      maturityYears: 2,
      yieldDecimal: 0.08,
      direction: "long",
      currency: "ZAR",
    });
    expect(v.currency).toBe("ZAR");
    expect(v.amount).toBe("1000000");
  });

  test("yield above coupon → bond trades at a discount (PV < face)", () => {
    const v = presentValue({
      faceValue: "1000000.00",
      remainingCoupons: BOND_ZAR.remainingCoupons,
      maturityYears: 2,
      yieldDecimal: 0.1,
      direction: "long",
      currency: "ZAR",
    });
    // 80000/1.1 + 80000/1.21 + 1000000/1.21 = 72727.27 + 66115.70 + 826446.28 = 965289.26
    expect(v.amount).toBe("965289.26");
  });

  test("short position values negative (the bank owes the cash flows)", () => {
    const v = presentValue({
      faceValue: "1000000.00",
      remainingCoupons: BOND_ZAR.remainingCoupons,
      maturityYears: 2,
      yieldDecimal: 0.08,
      direction: "short",
      currency: "ZAR",
    });
    expect(v.amount).toBe("-1000000");
  });
});

describe("modified duration (first-order rate sensitivity)", () => {
  test("modified duration of the 2y 8% bond at par ≈ 1.78 years", () => {
    const md = modifiedDuration({
      faceValue: "1000000.00",
      remainingCoupons: BOND_ZAR.remainingCoupons,
      maturityYears: 2,
      yieldDecimal: 0.08,
      couponsPerYear: 1,
    });
    // Macaulay = (1·74074.07 + 2·(68587.11+857338.82)) / 1,000,000 = 1.9259...
    // Modified = 1.9259 / 1.08 = 1.7833...
    expect(md).toBeGreaterThan(1.78);
    expect(md).toBeLessThan(1.79);
  });

  test("duration is direction-independent (a property of the cash flows)", () => {
    const long = bondModifiedDuration(BOND_ZAR, MARKS_AT_PAR, ASOF);
    const short = bondModifiedDuration({ ...BOND_ZAR, direction: "short" }, MARKS_AT_PAR, ASOF);
    expect(long).toBeCloseTo(short, 10);
  });
});

describe("bond Valuable facet", () => {
  test("values via the mark-to-model method at the ISIN yield", () => {
    const rec = bondValuable(BOND_ZAR).value(MARKS_AT_PAR, ASOF);
    expect(bondValuable(BOND_ZAR).valuationMethod()).toBe("mark-to-model");
    expect(rec.value.amount).toBe("1000000");
    expect(rec.observablesUsed[0]?.observableId).toBe(bondYieldKey(BOND_ZAR.isin));
  });

  test("falls back to the credit-spread curve key when the ISIN key is absent", () => {
    const rec = bondValuable(BOND_ZAR).value(MARKS_FALLBACK, ASOF);
    expect(rec.value.amount).toBe("965289.26");
    expect(rec.observablesUsed[0]?.observableId).toBe("ZAR:govt-curve:2y");
  });

  test("fails closed when NEITHER yield observable resolves", () => {
    expect(() => bondValuable(BOND_ZAR).value(MARKS_EMPTY, ASOF)).toThrow(
      /cannot resolve a market yield/,
    );
  });
});

describe("bond Performable facet", () => {
  test("carry = accrued coupon for the period (ACT/365), signed long", () => {
    // 1,000,000 × 0.08 × 90/365 = 19726.03
    const rec = bondPerformable(BOND_ZAR).unrealisedPnl(MARKS_AT_PAR, ASOF, {
      currency: "ZAR",
      amount: "0",
    });
    expect(rec.carry.amount).toBe("19726.03");
    // unrealised P&L against a zero book cost == the fair value at par.
    expect(rec.unrealisedPnl.amount).toBe("1000000");
    // theta ≈ −daily coupon = −(1,000,000 × 0.08 / 365) = −219.18
    expect(rec.theta.amount).toBe("-219.18");
  });

  test("unrealised P&L = fair value − booked cost", () => {
    const rec = bondPerformable(BOND_ZAR).unrealisedPnl(MARKS_FALLBACK, ASOF, {
      currency: "ZAR",
      amount: "1000000.00",
    });
    // fair value (10% yield) 965289.26 − 1,000,000 = −34710.74
    expect(rec.unrealisedPnl.amount).toBe("-34710.74");
  });

  test("short coupon carry is an expense (negative)", () => {
    const c = accruedCouponCarry({
      faceValue: "1000000.00",
      couponRate: 0.08,
      accruedDays: 90,
      direction: "short",
      currency: "ZAR",
    });
    expect(c.amount).toBe("-19726.03");
  });
});

describe("bond RiskMeasurable facet", () => {
  test("declares ir curve + delta risk factors and a position selector", () => {
    const rm = bondRiskMeasurable(BOND_ZAR);
    expect(rm.riskFactors().map((f) => f.factorId)).toContain("ir:curve");
    const sel = rm.positionContribution("irrbb-engine" as EngineId);
    expect(sel.engine).toBe("irrbb-engine" as EngineId);
    expect(sel.lifecycleEvents.map((e) => String(e))).toContain("BondTradeExecutedV2");
  });
});

describe("fail-closed reporting currency (WS-MULTI-BASE-CURRENCY)", () => {
  test("an empty reporting currency throws (no silent ZAR default)", () => {
    const broken: BondPosition = { ...BOND_ZAR, reporting: "" };
    expect(() => bondValuable(broken)).toThrow(/reporting currency is unresolved/);
  });

  test("a USD bond values in USD, not ZAR", () => {
    const usd: BondPosition = {
      ...BOND_ZAR,
      currency: "USD",
      isin: "US912828YK00",
      fallbackYieldKey: "USD:govt-curve:2y",
      reporting: "USD",
    };
    const marks: MarketDataSlice = { asOf: ASOF, observables: { [bondYieldKey(usd.isin)]: 0.08 } };
    const rec = bondValuable(usd).value(marks, ASOF);
    expect(rec.value.currency).toBe("USD");
    expect(rec.value.amount).toBe("1000000");
  });
});
