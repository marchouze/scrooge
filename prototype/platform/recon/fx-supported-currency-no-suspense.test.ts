// platform/recon/fx-supported-currency-no-suspense.test.ts
//
// Tests for recon:fx-supported-currency-no-suspense.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import { deriveSupportedCurrencies, main } from "./fx-supported-currency-no-suspense.ts";

describe("recon:fx-supported-currency-no-suspense", () => {
  it("derives the supported FX currency set from the live feed + sim seed pairs", () => {
    const currencies = deriveSupportedCurrencies();
    // The TwelveData target pairs + sim seed pairs cover ZAR + the six majors.
    for (const ccy of ["ZAR", "USD", "EUR", "GBP", "JPY", "CHF", "AUD"]) {
      expect(currencies).toContain(ccy);
    }
    // Sorted, de-duplicated.
    expect([...currencies].sort()).toEqual(currencies);
    expect(new Set(currencies).size).toBe(currencies.length);
  });

  it("passes: no supported currency routes any per-currency FX logical to suspense", () => {
    const { violations, asserted } = main();
    expect(violations).toEqual([]);
    // 7 supported currencies × 4 per-currency logicals = 28 assertions.
    expect(asserted).toBe(deriveSupportedCurrencies().length * 4);
    expect(asserted).toBeGreaterThanOrEqual(28);
  });
});
