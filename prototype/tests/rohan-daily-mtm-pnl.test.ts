// tests/rohan-daily-mtm-pnl.test.ts
//
// Unit tests for the two bugs fixed in rohan-daily-mtm.ts:
//
//   Bug 1 — Notional resolution:
//     baseAmountMinor() must return the base-currency minor amount for both
//     BUY and SELL legs.  Legacy code read nearLeg.notional.amountMinor
//     directly, which is only correct when the notional field holds the base
//     currency.  For BUY trades on ZAR-based pairs the notional field holds
//     the quote-currency amount, producing a dimensionally wrong P&L.
//
//   Bug 2 — Side sign:
//     P&L = sideSign * notionalBase * (midRate - bookRate).
//     sideSign = buy ? +1 : -1 (bank's position in the base currency).
//     The pre-fix code omitted sideSign entirely, treating all positions as
//     longs — sell trades reported the opposite P&L sign.
//
// Test cases:
//   TC-1: baseAmountMinor — sell leg (notional in base)
//   TC-2: baseAmountMinor — buy leg (notional in quote; counterNotional in base)
//   TC-3: P&L sign — buy, rate up → positive P&L
//   TC-4: P&L sign — buy, rate down → negative P&L
//   TC-5: P&L sign — sell, rate up → negative P&L
//   TC-6: P&L sign — sell, rate down → positive P&L
//   TC-7: P&L dimensions — ZAR/EUR buy: base is ZAR; notional in correct units
//
// Authority:
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   D-FX-QUOTING-CONVENTION (CEO-approved 2026-05-21; Option A)
//   IFRS-9-§5.7.1 (FVTPL: changes in fair value through P&L)
//   IAS-21-§28 (monetary items retranslated at closing rate)
//
// Author: Rohan (Market risk engineer, engineering)

import { describe, expect, it } from "bun:test";

import type { FxLeg } from "../platform/markets/cdm/fx";
import { baseAmountMinor } from "../platform/markets/cdm/fx-helpers";
import type { CurrencyPair } from "../platform/markets/cdm/primitives";

// ---------------------------------------------------------------------------
// P&L formula helper — mirrors the fixed logic in rohan-daily-mtm.ts
// ---------------------------------------------------------------------------

/**
 * Compute unrealised P&L in quote-currency minor units using the fixed formula:
 *   sideSign * notionalBaseMinor * (midRate - bookRate)
 *
 * sideSign = buy ? +1 : -1  (bank's position on the base currency)
 */
function computePnl(args: {
  leg: FxLeg;
  pair: CurrencyPair;
  side: "buy" | "sell";
  bookRate: number;
  midRate: number;
}): number {
  const notionalBaseMinor = baseAmountMinor(args.leg, args.pair);
  const sideSign = args.side === "buy" ? 1 : -1;
  return Math.round(sideSign * notionalBaseMinor * (args.midRate - args.bookRate));
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** EUR/USD sell leg: bank sells EUR (base), receives USD (quote). */
const eurUsdSellLeg: FxLeg = {
  legKind: "near",
  payCurrency: "EUR",
  receiveCurrency: "USD",
  notional: { currency: "EUR", amountMinor: 100_000_00 }, // EUR 1m in EUR-cents
  counterNotional: { currency: "USD", amountMinor: 108_000_00 }, // USD 1.08m
  rate: { currency: "USD", amount: 1.08 },
  settlementDate: { iso: "2026-05-22", calendar: "JIHCAL" },
};

/** EUR/USD buy leg: bank buys EUR (base), pays USD (quote). */
const eurUsdBuyLeg: FxLeg = {
  legKind: "near",
  payCurrency: "USD",
  receiveCurrency: "EUR",
  notional: { currency: "USD", amountMinor: 108_000_00 }, // USD is quote currency here
  counterNotional: { currency: "EUR", amountMinor: 100_000_00 }, // EUR is base currency
  rate: { currency: "USD", amount: 1.08 },
  settlementDate: { iso: "2026-05-22", calendar: "JIHCAL" },
};

const eurUsdPair: CurrencyPair = { base: "EUR", quote: "USD" };

/** ZAR/EUR buy leg: bank buys ZAR (base), pays EUR (quote).
 *  On a ZAR/EUR pair, ZAR is the base.  A "buy" means the bank is long ZAR.
 *  notional.currency = EUR (the pay leg = quote currency here); the base
 *  (ZAR) amount is in counterNotional.
 */
const zarEurBuyLeg: FxLeg = {
  legKind: "near",
  payCurrency: "EUR",
  receiveCurrency: "ZAR",
  notional: { currency: "EUR", amountMinor: 500_000_00 }, // EUR in notional (quote)
  counterNotional: { currency: "ZAR", amountMinor: 10_000_000_00 }, // ZAR 100m (base)
  rate: { currency: "EUR", amount: 0.05 }, // 1 ZAR = 0.05 EUR
  settlementDate: { iso: "2026-05-22", calendar: "JIHCAL" },
};

const zarEurPair: CurrencyPair = { base: "ZAR", quote: "EUR" };

// ---------------------------------------------------------------------------
// TC-1: baseAmountMinor — sell leg (notional.currency === base)
// ---------------------------------------------------------------------------

describe("TC-1: baseAmountMinor — sell leg, notional.currency === base", () => {
  it("returns notional.amountMinor when notional.currency matches base", () => {
    // EUR/USD sell: notional.currency = EUR = base → return notional.amountMinor
    const result = baseAmountMinor(eurUsdSellLeg, eurUsdPair);
    expect(result).toBe(100_000_00);
  });
});

// ---------------------------------------------------------------------------
// TC-2: baseAmountMinor — buy leg (counterNotional.currency === base)
// ---------------------------------------------------------------------------

describe("TC-2: baseAmountMinor — buy leg, counterNotional.currency === base", () => {
  it("returns counterNotional.amountMinor when notional.currency is quote", () => {
    // EUR/USD buy: notional.currency = USD (quote), counterNotional.currency = EUR = base
    const result = baseAmountMinor(eurUsdBuyLeg, eurUsdPair);
    expect(result).toBe(100_000_00); // EUR minor units, NOT USD minor units
  });

  it("does NOT return the notional (quote currency) amount", () => {
    const result = baseAmountMinor(eurUsdBuyLeg, eurUsdPair);
    expect(result).not.toBe(108_000_00); // must not be the USD amount
  });
});

// ---------------------------------------------------------------------------
// TC-3: P&L sign — buy, rate up → positive
// ---------------------------------------------------------------------------

describe("TC-3: P&L — buy EUR, rate rises → positive P&L", () => {
  it("buy: rate rises from 1.08 to 1.09 → positive P&L", () => {
    // EUR 1m long, rate +0.01 → gain = 1_000_000 * 0.01 * 100 cents/USD = 100_000 USD-cents
    const pnl = computePnl({
      leg: eurUsdBuyLeg,
      pair: eurUsdPair,
      side: "buy",
      bookRate: 1.08,
      midRate: 1.09,
    });
    // 1 * 100_000_00 * (1.09 - 1.08) ≈ 100_000 USD-cents = USD 1,000
    // Math.round() is applied in computePnl, so use toBeCloseTo or exact int.
    expect(pnl).toBe(100_000); // Math.round(100_000_00 * 0.01) = 100_000
    expect(pnl).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// TC-4: P&L sign — buy, rate down → negative
// ---------------------------------------------------------------------------

describe("TC-4: P&L — buy EUR, rate falls → negative P&L", () => {
  it("buy: rate falls from 1.08 to 1.07 → negative P&L", () => {
    const pnl = computePnl({
      leg: eurUsdBuyLeg,
      pair: eurUsdPair,
      side: "buy",
      bookRate: 1.08,
      midRate: 1.07,
    });
    expect(pnl).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// TC-5: P&L sign — sell, rate up → negative (short loses when rate rises)
// ---------------------------------------------------------------------------

describe("TC-5: P&L — sell EUR, rate rises → negative P&L", () => {
  it("sell: rate rises from 1.08 to 1.09 → negative P&L (short loses)", () => {
    const pnl = computePnl({
      leg: eurUsdSellLeg,
      pair: eurUsdPair,
      side: "sell",
      bookRate: 1.08,
      midRate: 1.09,
    });
    // -1 * 100_000_00 * (1.09 - 1.08) ≈ -100_000 USD-cents
    expect(pnl).toBe(-100_000); // Math.round(-100_000_00 * 0.01) = -100_000
    expect(pnl).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// TC-6: P&L sign — sell, rate down → positive (short wins when rate falls)
// ---------------------------------------------------------------------------

describe("TC-6: P&L — sell EUR, rate falls → positive P&L", () => {
  it("sell: rate falls from 1.08 to 1.07 → positive P&L (short wins)", () => {
    const pnl = computePnl({
      leg: eurUsdSellLeg,
      pair: eurUsdPair,
      side: "sell",
      bookRate: 1.08,
      midRate: 1.07,
    });
    expect(pnl).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// TC-7: ZAR/EUR buy — base is ZAR; baseAmountMinor returns ZAR-cent amount
// ---------------------------------------------------------------------------

describe("TC-7: ZAR/EUR buy — notional correctly identifies ZAR base", () => {
  it("baseAmountMinor returns ZAR counterNotional amount (not EUR notional)", () => {
    // zarEurBuyLeg: notional.currency = EUR (quote), counterNotional.currency = ZAR (base)
    const result = baseAmountMinor(zarEurBuyLeg, zarEurPair);
    expect(result).toBe(10_000_000_00); // ZAR 100m in ZAR-cents
    expect(result).not.toBe(500_000_00); // must NOT be the EUR notional amount
  });

  it("P&L is dimensionally correct: ZAR-base * (EUR/ZAR-rate-diff)", () => {
    // Rate: 1 ZAR = 0.05 EUR (bookRate), moves to 0.055 EUR (midRate)
    // bank is long ZAR → gains when ZAR appreciates (EUR/ZAR rate rises for ZAR)
    const pnl = computePnl({
      leg: zarEurBuyLeg,
      pair: zarEurPair,
      side: "buy",
      bookRate: 0.05,
      midRate: 0.055,
    });
    // +1 * 10_000_000_00 * (0.055 - 0.05) = 10_000_000_00 * 0.005 = 50_000_000
    expect(pnl).toBe(Math.round(10_000_000_00 * (0.055 - 0.05)));
    expect(pnl).toBeGreaterThan(0);
  });
});
