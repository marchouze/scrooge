// platform/markets/cdm/fx-helpers.test.ts
//
// Unit tests for the `baseAmountMinor(leg, pair)` helper introduced in
// D-FX-QUOTING-CONVENTION Slice 2 (Bea, 2026-05-21). The helper resolves
// the base-currency notional amount in minor units side-correctly —
// reading `notional.amountMinor` when the leg sits on the base side and
// `counterNotional.amountMinor` when the leg sits on the quote side.
//
// Authority:
//   - D-FX-QUOTING-CONVENTION (CEO-approved 2026-05-21)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import type { FxLeg } from "./fx";
import { baseAmountMinor } from "./fx-helpers";

const USD_ZAR = { base: "USD", quote: "ZAR" };

// BUY on a major-first pair (USD/ZAR): pay quote (ZAR), receive base (USD).
// Base-amount lives on counterNotional.
const BUY_LEG: FxLeg = {
  legKind: "near",
  payCurrency: "ZAR",
  receiveCurrency: "USD",
  notional: { currency: "ZAR", amountMinor: 9_250_000_000 },
  counterNotional: { currency: "USD", amountMinor: 500_000_000 },
  rate: { currency: "ZAR", amount: 18.5 },
  settlementDate: { iso: "2026-05-22", calendar: "JIHCAL" },
};

// SELL on a major-first pair (USD/ZAR): pay base (USD), receive quote (ZAR).
// Base-amount lives on notional.
const SELL_LEG: FxLeg = {
  legKind: "near",
  payCurrency: "USD",
  receiveCurrency: "ZAR",
  notional: { currency: "USD", amountMinor: 500_000_000 },
  counterNotional: { currency: "ZAR", amountMinor: 9_250_000_000 },
  rate: { currency: "ZAR", amount: 18.5 },
  settlementDate: { iso: "2026-05-22", calendar: "JIHCAL" },
};

describe("baseAmountMinor", () => {
  it("BUY leg — base is on counterNotional, helper returns 500_000_000", () => {
    expect(baseAmountMinor(BUY_LEG, USD_ZAR)).toBe(500_000_000);
  });

  it("SELL leg — base is on notional, helper returns 500_000_000", () => {
    expect(baseAmountMinor(SELL_LEG, USD_ZAR)).toBe(500_000_000);
  });

  it("BUY and SELL legs of the same economic size return the same base amount", () => {
    expect(baseAmountMinor(BUY_LEG, USD_ZAR)).toBe(baseAmountMinor(SELL_LEG, USD_ZAR));
  });

  it("FX-swap far leg with inverted direction — base correctly resolved on counterNotional", () => {
    // Typical swap: near = SELL USD/ZAR (pay USD, receive ZAR); far = BUY (opposite).
    // Far leg notional sits in ZAR (quote); counterNotional in USD (base).
    const farLeg: FxLeg = {
      legKind: "far",
      payCurrency: "ZAR",
      receiveCurrency: "USD",
      notional: { currency: "ZAR", amountMinor: 9_300_000_000 }, // ZAR 93m
      counterNotional: { currency: "USD", amountMinor: 500_000_000 }, // USD 5m
      rate: { currency: "ZAR", amount: 18.6 },
      settlementDate: { iso: "2026-08-22", calendar: "JIHCAL" },
    };
    expect(baseAmountMinor(farLeg, USD_ZAR)).toBe(500_000_000);
  });

  it("falls back to notional when neither side matches the base (defensive)", () => {
    // Synthetic — would never pass `fxTradeExecutedPayloadSchema` but the
    // helper must not throw on legacy / unvalidated callers.
    const malformed = {
      ...SELL_LEG,
      notional: { currency: "EUR", amountMinor: 12345 },
      counterNotional: { currency: "GBP", amountMinor: 67890 },
    } as FxLeg;
    expect(baseAmountMinor(malformed, USD_ZAR)).toBe(12345);
  });
});
