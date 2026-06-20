// v2-core/fil-models/fx-valuation/forward-mtm.test.ts
//
// M1 — present-valued forward MtM retires the flat-discount approximation.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { forwardMtmValue, oisDiscountFactor, oisDiscountObservableId } from "./methodology";

describe("FX forward present-valued MtM (M1)", () => {
  test("DF=1 recovers the undiscounted (flat) figure", () => {
    // Long USD 5,000,000; booked 18.50; current forward 18.70 → +0.20 per USD.
    // Undiscounted MtM = 5_000_000 × 0.20 = 1_000_000 ZAR.
    const r = forwardMtmValue({
      currency: "USD",
      signedNotional: "5000000",
      bookedRate: 18.5,
      currentForwardRate: 18.7,
      discountFactor: 1,
      reporting: "ZAR",
    });
    expect(r.value.currency).toBe("ZAR");
    expect(Number(r.value.amount)).toBe(1000000);
  });

  test("DF<1 present-values the MtM below the flat figure", () => {
    // Same position; 90-day tenor at 7% OIS → DF = exp(-0.07 × 90/365) ≈ 0.98286.
    const df = oisDiscountFactor(0.07, 90);
    expect(df).toBeLessThan(1);
    expect(df).toBeGreaterThan(0.98);

    const r = forwardMtmValue({
      currency: "USD",
      signedNotional: "5000000",
      bookedRate: 18.5,
      currentForwardRate: 18.7,
      discountFactor: df,
      reporting: "ZAR",
    });
    // 1_000_000 × 0.98286 ≈ 982_864.xx — strictly below the flat 1_000_000.
    const pv = Number(r.value.amount);
    expect(pv).toBeLessThan(1_000_000);
    expect(pv).toBeGreaterThan(982_000);
  });

  test("short position flips the sign of the MtM", () => {
    const r = forwardMtmValue({
      currency: "USD",
      signedNotional: "-5000000",
      bookedRate: 18.5,
      currentForwardRate: 18.7,
      discountFactor: 1,
      reporting: "ZAR",
    });
    expect(Number(r.value.amount)).toBe(-1000000);
  });

  test("reporting-currency leg has zero FX MtM", () => {
    const r = forwardMtmValue({
      currency: "ZAR",
      signedNotional: "1000000",
      bookedRate: 1,
      currentForwardRate: 1,
      discountFactor: 0.95,
      reporting: "ZAR",
    });
    expect(Number(r.value.amount)).toBe(0);
  });

  test("fails closed on an out-of-range discount factor (never silently DF=1)", () => {
    expect(() =>
      forwardMtmValue({
        currency: "USD",
        signedNotional: "5000000",
        bookedRate: 18.5,
        currentForwardRate: 18.7,
        discountFactor: 0,
        reporting: "ZAR",
      }),
    ).toThrow(/discountFactor must be in \(0,1\]/);
    expect(() =>
      forwardMtmValue({
        currency: "USD",
        signedNotional: "5000000",
        bookedRate: 18.5,
        currentForwardRate: 18.7,
        discountFactor: 1.2,
        reporting: "ZAR",
      }),
    ).toThrow(/discountFactor must be in \(0,1\]/);
  });

  test("oisDiscountFactor returns 1 for zero/negative tenor (spot)", () => {
    expect(oisDiscountFactor(0.07, 0)).toBe(1);
    expect(oisDiscountFactor(0.07, -5)).toBe(1);
  });

  test("oisDiscountObservableId is the canonical OIS:<ccy>:<days>d key", () => {
    expect(oisDiscountObservableId("ZAR", 90)).toBe("OIS:ZAR:90d");
  });
});
