// platform/event-store/event-types/money-v2-round-trip.test.ts
//
// Round-trip tests for Money Slice 2 encode→decode helpers across every
// money-bearing event-type family. Asserts:
//   1. decode(legacy) produces MoneyWire with string amounts (no floats).
//   2. The MoneyWire amount value represents the correct decimal (minor → major
//      conversion is correct for the currency's ISO 4217 exponent).
//   3. encode(Money) then check fields are MoneyWire with string amounts.
//   4. recon:money-codec-no-float finds 0 violations in the decoded payload.
//
// Authority:
//   - D-MONEY-DECIMAL-BUILD-PROCEED (CEO-approved)
//   - D-MONEY-DECIMAL-REDENOMINATION (CEO-approved)
//   - brief:atlas:money-slice-2-sweep-all-33-transactional-event-s:2026-06-13
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { money } from "../../core/decimal-money";
import { findFloatMoneyViolations, minorFromMoneyWire } from "../../core/money-codec";
import type { Currency } from "../../core/types";
import {
  decodeBondInterestAccrued,
  decodeBondMatured,
  decodeBondPositionRevalued,
  decodeBondSold,
  decodeBondTradeExecuted,
  encodeBondTradeExecuted,
} from "./bond-accounting";
import {
  decodeEquityDividendAccrued,
  decodeEquitySold,
  encodeEquityDividendAccrued,
} from "./equity-accounting";
import {
  decodeFxPositionRevalued,
  decodeRealisedPnlRecognised,
  decodeSubLedgerLeg,
} from "./fx-accounting";
import {
  decodeIrdSwapCouponSettled,
  decodeIrdSwapPositionRevalued,
  decodeIrdSwapTradeExecuted,
} from "./ird-accounting";
import { decodeOperationalLossEvent } from "./operational-risk";
import { decodePaymentInitiated, decodePaymentSettled } from "./payments";
import { decodeRwaComputed } from "./regulatory-reporting";
import { decodeTradeMaturedFxSpot, encodeTradeMaturedFxSpot } from "./trade-matured";

const ZAR = "ZAR" as Currency;
const USD = "USD" as Currency;

// ---------------------------------------------------------------------------
// Helper: assert all MoneyWire fields in an object are string-amount (no float)
// ---------------------------------------------------------------------------

function assertNoFloatMoney(payload: unknown, label: string): void {
  const violations = findFloatMoneyViolations(payload);
  expect(violations).toEqual([]);
  if (violations.length > 0) {
    throw new Error(`${label}: float-money violations at: ${violations.join(", ")}`);
  }
}

function assertMoneyWireString(wire: { amount: string; currency: string; __money: string }): void {
  expect(typeof wire.amount).toBe("string");
  expect(wire.__money).toBe("v1");
}

// ---------------------------------------------------------------------------
// Bond accounting round-trips
// ---------------------------------------------------------------------------

describe("bond-accounting V2 decode round-trips", () => {
  const baseBondTrade = {
    tradeId: "BOND-001",
    bondIsin: "ZAG000149037",
    side: "buy" as const,
    cleanPricePercent: 97.5,
    dirtyPricePercent: 97.75,
    settlementDate: "2026-06-16",
    portfolio: "banking-book" as const,
    couponRate: 0.085,
    maturityDate: "2030-01-15",
    currency: "ZAR",
    counterpartyLei: "7LTWFZYICNSX8D621K86",
    executedAt: "2026-06-13T09:00:00Z",
  };

  it("decodeBondTradeExecuted: minor → MoneyWire with string amounts", () => {
    const raw = { ...baseBondTrade, nominalMinor: 10_000_000, accruedInterestMinor: 25_000 };
    const v2 = decodeBondTradeExecuted(raw);
    assertMoneyWireString(v2.nominal);
    assertMoneyWireString(v2.accruedInterest);
    // 10_000_000 ZAR minor = R100,000.00
    expect(v2.nominal.amount).toBe("100000");
    expect(v2.nominal.currency).toBe("ZAR");
    // 25_000 minor = R250.00
    expect(v2.accruedInterest.amount).toBe("250");
    assertNoFloatMoney(v2, "BondTradeExecutedPayloadV2");
  });

  it("encodeBondTradeExecuted: Money → MoneyWire with string amounts", () => {
    const base = { ...baseBondTrade };
    const v2 = encodeBondTradeExecuted(base, money("100000", ZAR), money("250", ZAR));
    assertMoneyWireString(v2.nominal);
    assertMoneyWireString(v2.accruedInterest);
    assertNoFloatMoney(v2, "BondTradeExecutedPayloadV2 (encoded)");
  });

  it("decodeBondInterestAccrued: minor → MoneyWire", () => {
    const raw = {
      tradeId: "BOND-001",
      bondIsin: "ZAG000149037",
      accrualDate: "2026-06-13",
      accruedInterestMinor: 5_000, // R50.00
      eirRate: 0.0873,
      openingCarryingAmountMinor: 9_950_000,
      closingCarryingAmountMinor: 9_955_000,
      currency: "ZAR",
    };
    const v2 = decodeBondInterestAccrued(raw);
    assertMoneyWireString(v2.accruedInterest);
    assertMoneyWireString(v2.openingCarryingAmount);
    assertMoneyWireString(v2.closingCarryingAmount);
    expect(v2.accruedInterest.amount).toBe("50");
    assertNoFloatMoney(v2, "BondInterestAccruedPayloadV2");
  });

  it("decodeBondPositionRevalued: minor → MoneyWire", () => {
    const raw = {
      tradeId: "BOND-001",
      bondIsin: "ZAG000149037",
      revalDate: "2026-06-13",
      bookCleanPricePercent: 97.5,
      currentCleanPricePercent: 97.6,
      unrealisedPnlZarMinor: 10_000, // R100.00 gain
      currency: "ZAR",
    };
    const v2 = decodeBondPositionRevalued(raw);
    assertMoneyWireString(v2.unrealisedPnlZar);
    expect(v2.unrealisedPnlZar.amount).toBe("100");
    expect(v2.unrealisedPnlZar.currency).toBe("ZAR");
    assertNoFloatMoney(v2, "BondPositionRevaluedPayloadV2");
  });

  it("decodeBondMatured: minor → MoneyWire", () => {
    const raw = {
      tradeId: "BOND-001",
      bondIsin: "ZAG000149037",
      maturityDate: "2030-01-15",
      nominalRepaidMinor: 10_000_000, // R100,000.00
      finalCouponMinor: 10_000, // R100.00
      currency: "ZAR",
    };
    const v2 = decodeBondMatured(raw);
    assertMoneyWireString(v2.nominalRepaid);
    assertMoneyWireString(v2.finalCoupon);
    expect(v2.nominalRepaid.amount).toBe("100000");
    expect(v2.finalCoupon.amount).toBe("100");
    assertNoFloatMoney(v2, "BondMaturedPayloadV2");
  });

  it("decodeBondSold: minor → MoneyWire", () => {
    const raw = {
      tradeId: "BOND-001",
      bondIsin: "ZAG000149037",
      side: "sell" as const,
      saleProceedsMinor: 9_850_000,
      carryingAmountAtSaleMinor: 9_900_000,
      realisedPnlMinor: -50_000,
      settlementDate: "2026-06-16",
      currency: "ZAR",
    };
    const v2 = decodeBondSold(raw);
    assertMoneyWireString(v2.saleProceeds);
    assertMoneyWireString(v2.carryingAmountAtSale);
    assertMoneyWireString(v2.realisedPnl);
    // -50_000 minor = -R500.00
    expect(v2.realisedPnl.amount).toBe("-500");
    assertNoFloatMoney(v2, "BondSoldPayloadV2");
  });
});

// ---------------------------------------------------------------------------
// Trade matured round-trips
// ---------------------------------------------------------------------------

describe("trade-matured V2 decode round-trips", () => {
  const baseFxSpot = {
    productKind: "fx-spot" as const,
    tradeId: "FX-001",
    currencyPair: "USD/ZAR",
    legKind: "near" as const,
    settledAt: "2026-06-13T09:00:00Z",
    nostroAccountBase: "ACC-1001-001",
    nostroAccountQuote: "ACC-1001-002",
  };

  it("decodeTradeMaturedFxSpot: derives base/quote currencies from pair", () => {
    const raw = {
      ...baseFxSpot,
      settledBaseCurrencyMinor: 1_000_000, // 1,000,000 USD minor → 10,000.00 USD
      settledQuoteCurrencyMinor: 182_000_000, // 182,000,000 ZAR minor → R1,820,000.00
      realisedPnlZarMinor: 50_000, // R500.00
    };
    const v2 = decodeTradeMaturedFxSpot(raw);
    assertMoneyWireString(v2.settledBaseCurrency);
    assertMoneyWireString(v2.settledQuoteCurrency);
    assertMoneyWireString(v2.realisedPnlZar);
    expect(v2.settledBaseCurrency.currency).toBe("USD");
    expect(v2.settledBaseCurrency.amount).toBe("10000");
    expect(v2.settledQuoteCurrency.currency).toBe("ZAR");
    expect(v2.realisedPnlZar.currency).toBe("ZAR");
    expect(v2.realisedPnlZar.amount).toBe("500");
    assertNoFloatMoney(v2, "TradeMaturedFxSpotPayloadV2");
  });

  it("encodeTradeMaturedFxSpot + decodeTradeMaturedFxSpot: round-trip consistency", () => {
    const encoded = encodeTradeMaturedFxSpot(
      baseFxSpot,
      money("10000", USD),
      money("182000", ZAR),
      money("500", ZAR),
    );
    assertMoneyWireString(encoded.settledBaseCurrency);
    assertMoneyWireString(encoded.settledQuoteCurrency);
    assertMoneyWireString(encoded.realisedPnlZar);
    // minor-unit back-conversion should round-trip
    expect(minorFromMoneyWire(encoded.settledBaseCurrency)).toBe(1_000_000);
    expect(minorFromMoneyWire(encoded.settledQuoteCurrency)).toBe(18_200_000);
    assertNoFloatMoney(encoded, "TradeMaturedFxSpotPayloadV2 (encoded)");
  });
});

// ---------------------------------------------------------------------------
// FX accounting round-trips
// ---------------------------------------------------------------------------

describe("fx-accounting V2 decode round-trips", () => {
  it("decodeFxPositionRevalued: minor → MoneyWire", () => {
    const raw = {
      tradeId: "FX-001",
      currencyPair: "USD/ZAR",
      bookRate: 18.0,
      revalRate: 18.2,
      notionalBaseMinor: 1_000_000, // 10,000.00 USD
      unrealisedPnlZarMinor: 200_000, // R2,000.00 ZAR gain
      revaluedAt: "2026-06-13T17:00:00Z",
      rateSource: "stub",
    };
    const v2 = decodeFxPositionRevalued(raw);
    assertMoneyWireString(v2.notionalBase);
    assertMoneyWireString(v2.unrealisedPnlZar);
    // currency derived from pair split: USD/ZAR → base="USD"
    expect(v2.notionalBase.currency).toBe("USD");
    expect(v2.notionalBase.amount).toBe("10000");
    expect(v2.unrealisedPnlZar.currency).toBe("ZAR");
    expect(v2.unrealisedPnlZar.amount).toBe("2000");
    assertNoFloatMoney(v2, "FxPositionRevaluedPayloadV2");
  });

  it("decodeSubLedgerLeg: minor → MoneyWire", () => {
    const raw = {
      accountId: "ACC-1001-001",
      debitCredit: "debit" as const,
      amountMinor: 100_00,
      currency: "ZAR",
    };
    const v2 = decodeSubLedgerLeg(raw);
    assertMoneyWireString(v2.amount);
    expect(v2.amount.amount).toBe("100");
    expect(v2.amount.currency).toBe("ZAR");
    assertNoFloatMoney(v2, "SubLedgerLegV2");
  });

  it("decodeRealisedPnlRecognised: minor → MoneyWire", () => {
    const raw = {
      instrumentId: "CSH-USD-001",
      bookId: "FX-BOOK-01",
      currency: "USD",
      amountClosedMinor: 100_000, // 1,000.00 USD
      avgCostZarRate: 18.0,
      disposalCostZarRate: 18.5,
      realisedPnlZarMinor: 50_000, // R500.00
      sourceTradeId: "FX-001",
      recognisedAt: "2026-06-13T09:00:00Z",
    };
    const v2 = decodeRealisedPnlRecognised(raw);
    assertMoneyWireString(v2.realisedPnlZar);
    assertMoneyWireString(v2.amountClosed);
    expect(v2.realisedPnlZar.amount).toBe("500");
    expect(v2.realisedPnlZar.currency).toBe("ZAR");
    expect(v2.amountClosed.currency).toBe("USD");
    assertNoFloatMoney(v2, "RealisedPnlRecognisedPayloadV2");
  });
});

// ---------------------------------------------------------------------------
// Equity accounting round-trips
// ---------------------------------------------------------------------------

describe("equity-accounting V2 decode round-trips", () => {
  it("decodeEquityDividendAccrued: minor → MoneyWire (4 fields)", () => {
    const raw = {
      tradeId: "EQ-TRADE-001",
      instrumentId: "ZAE000171562",
      quantity: 1000,
      grossDividendPerShareMinor: 50, // R0.50
      grossDividendTotalMinor: 50_000, // R500.00
      withholdingTaxRate: 0.15,
      withholdingTaxMinor: 7_500, // R75.00
      netDividendMinor: 42_500, // R425.00
      exDividendDate: "2026-06-10",
      paymentDate: "2026-07-01",
      currency: "ZAR",
    };
    const v2 = decodeEquityDividendAccrued(raw);
    assertMoneyWireString(v2.grossDividendPerShare);
    assertMoneyWireString(v2.grossDividendTotal);
    assertMoneyWireString(v2.withholdingTax);
    assertMoneyWireString(v2.netDividend);
    expect(v2.grossDividendPerShare.amount).toBe("0.5");
    expect(v2.grossDividendTotal.amount).toBe("500");
    expect(v2.netDividend.amount).toBe("425");
    assertNoFloatMoney(v2, "EquityDividendAccruedPayloadV2");
  });

  it("encodeEquityDividendAccrued: Money → MoneyWire", () => {
    const base = {
      tradeId: "EQ-TRADE-001",
      instrumentId: "ZAE000171562",
      quantity: 1000,
      withholdingTaxRate: 0.15,
      exDividendDate: "2026-06-10",
      paymentDate: "2026-07-01",
      currency: "ZAR",
    };
    const v2 = encodeEquityDividendAccrued(
      base,
      money("0.5", ZAR),
      money("500", ZAR),
      money("75", ZAR),
      money("425", ZAR),
    );
    assertMoneyWireString(v2.grossDividendPerShare);
    assertMoneyWireString(v2.grossDividendTotal);
    assertNoFloatMoney(v2, "EquityDividendAccruedPayloadV2 (encoded)");
  });

  it("decodeEquitySold: minor → MoneyWire (4 fields)", () => {
    const raw = {
      tradeId: "EQ-TRADE-001",
      instrumentId: "ZAE000171562",
      classification: "fvtpl" as const,
      quantity: 1000,
      salePricePerShareMinor: 1_500, // R15.00 per share
      saleProceedsMinor: 1_500_000, // R15,000.00
      carryingAmountAtSaleMinor: 1_400_000, // R14,000.00
      realisedPnlMinor: 100_000, // R1,000.00 gain
      settlementDate: "2026-06-16",
      currency: "ZAR",
    };
    const v2 = decodeEquitySold(raw);
    assertMoneyWireString(v2.salePricePerShare);
    assertMoneyWireString(v2.saleProceeds);
    assertMoneyWireString(v2.carryingAmountAtSale);
    assertMoneyWireString(v2.realisedPnl);
    expect(v2.realisedPnl.amount).toBe("1000");
    assertNoFloatMoney(v2, "EquitySoldPayloadV2");
  });
});

// ---------------------------------------------------------------------------
// Payments round-trips
// ---------------------------------------------------------------------------

describe("payments V2 decode round-trips", () => {
  it("decodePaymentInitiated: minor → MoneyWire", () => {
    const raw = {
      tradeId: "FX-001",
      legKind: "deliver" as const,
      paymentRef: "PAY-REF-001",
      currency: "ZAR",
      netCash: 1_000_000, // R10,000.00
      initiatedAt: "2026-06-13T09:00:00Z",
      citations: ["D-FX-AD-STATUS"],
    };
    const v2 = decodePaymentInitiated(raw);
    assertMoneyWireString(v2.netCashWire);
    expect(v2.netCashWire.amount).toBe("10000");
    expect(v2.netCashWire.currency).toBe("ZAR");
    assertNoFloatMoney(v2, "PaymentInitiatedPayloadV2");
  });

  it("decodePaymentSettled: minor → MoneyWire", () => {
    const raw = {
      tradeId: "FX-001",
      legKind: "deliver" as const,
      paymentRef: "PAY-REF-001",
      currency: "ZAR",
      netCash: 1_000_000, // R10,000.00
      settledAt: "2026-06-13T10:00:00Z",
      citations: ["D-FX-AD-STATUS"],
    };
    const v2 = decodePaymentSettled(raw);
    assertMoneyWireString(v2.netCashWire);
    expect(v2.netCashWire.amount).toBe("10000");
    assertNoFloatMoney(v2, "PaymentSettledPayloadV2");
  });
});

// ---------------------------------------------------------------------------
// Regulatory reporting round-trips
// ---------------------------------------------------------------------------

describe("regulatory-reporting V2 decode round-trips", () => {
  it("decodeRwaComputed: minor → MoneyWire (4 fields, all ZAR)", () => {
    const raw = {
      entityId: "LE-ZA-HOZ-BANK",
      asOf: "2026-05-31",
      periodId: "period:hoz-bank:month:2026-05",
      functionalCurrency: "ZAR",
      creditRwaMinor: 5_000_000_00,
      marketRwaMinor: 1_000_000_00,
      operationalRwaMinor: 0,
      totalRwaMinor: 6_000_000_00,
      source: "credit+market-event-sourced;op-placeholder-gross-income-blocked",
      operationalRwaIsPlaceholder: true,
      sourceEventIds: ["evt-001"],
      creditExposureCount: 5,
      citations: ["D-RWA-ENGINE-W2-SLICE-3"],
    };
    const v2 = decodeRwaComputed(raw);
    assertMoneyWireString(v2.creditRwa);
    assertMoneyWireString(v2.marketRwa);
    assertMoneyWireString(v2.operationalRwa);
    assertMoneyWireString(v2.totalRwa);
    expect(v2.creditRwa.currency).toBe("ZAR");
    expect(v2.operationalRwa.amount).toBe("0");
    assertNoFloatMoney(v2, "RwaComputedPayloadV2");
  });
});

// ---------------------------------------------------------------------------
// IRD accounting round-trips
// ---------------------------------------------------------------------------

describe("ird-accounting V2 decode round-trips", () => {
  it("decodeIrdSwapTradeExecuted: minor → MoneyWire", () => {
    const raw = {
      tradeId: "IRS-001",
      instrumentType: "irs" as const,
      role: "pay-fixed" as const,
      currency: "ZAR",
      notionalMinor: 1_000_000_000, // R10,000,000.00
      npvMinor: 0,
      fixedRatePercent: 0.085,
      tradeDate: "2026-06-13",
      startDate: "2026-06-15",
      maturityDate: "2031-06-15",
      counterpartyLei: "7LTWFZYICNSX8D621K86",
    };
    const v2 = decodeIrdSwapTradeExecuted(raw);
    assertMoneyWireString(v2.notional);
    assertMoneyWireString(v2.npv);
    expect(v2.notional.currency).toBe("ZAR");
    expect(v2.notional.amount).toBe("10000000");
    expect(v2.npv.amount).toBe("0");
    assertNoFloatMoney(v2, "IrdSwapTradeExecutedPayloadV2");
  });

  it("decodeIrdSwapPositionRevalued: minor → MoneyWire", () => {
    const raw = {
      tradeId: "IRS-001",
      currency: "ZAR",
      npvDeltaMinor: 200_000,
      npvClosingMinor: -4_800_000,
      npvOpeningMinor: -5_000_000,
      revalDate: "2026-06-13",
    };
    const v2 = decodeIrdSwapPositionRevalued(raw);
    assertMoneyWireString(v2.npvDelta);
    assertMoneyWireString(v2.npvClosing);
    assertMoneyWireString(v2.npvOpening);
    expect(v2.npvDelta.amount).toBe("2000");
    expect(v2.npvClosing.amount).toBe("-48000");
    expect(v2.npvOpening.amount).toBe("-50000");
    assertNoFloatMoney(v2, "IrdSwapPositionRevaluedPayloadV2");
  });

  it("decodeIrdSwapCouponSettled: minor → MoneyWire (3 fields)", () => {
    const raw = {
      tradeId: "IRS-001",
      currency: "ZAR",
      settlementDate: "2026-12-13",
      periodStartDate: "2026-06-13",
      periodEndDate: "2026-12-13",
      fixedLegMinor: 4_250_000,
      floatingLegMinor: 3_900_000,
      netCashMinor: 350_000,
      settledAt: "2026-12-13T12:00:00Z",
    };
    const v2 = decodeIrdSwapCouponSettled(raw);
    assertMoneyWireString(v2.fixedLeg);
    assertMoneyWireString(v2.floatingLeg);
    assertMoneyWireString(v2.netCash);
    expect(v2.netCash.amount).toBe("3500");
    assertNoFloatMoney(v2, "IrdSwapCouponSettledPayloadV2");
  });
});

// ---------------------------------------------------------------------------
// Operational risk round-trips
// ---------------------------------------------------------------------------

describe("operational-risk V2 decode round-trips", () => {
  it("decodeOperationalLossEvent: minor → MoneyWire (with optional recovery)", () => {
    const rawWithRecovery = {
      lossEventId: "OLE-001",
      eventDate: "2026-06-13",
      discoveryDate: "2026-06-13",
      currency: "ZAR",
      grossLossMinor: 500_000,
      recoveryMinor: 100_000,
      businessLine: "retail-banking" as const,
      eventTypeCategory: "external-fraud" as const,
      status: "open" as const,
      description: "Card fraud incident",
    };
    const v2 = decodeOperationalLossEvent(rawWithRecovery);
    assertMoneyWireString(v2.grossLoss);
    assertMoneyWireString(v2.recovery);
    expect(v2.grossLoss.amount).toBe("5000");
    expect(v2.recovery.amount).toBe("1000");
    assertNoFloatMoney(v2, "OperationalLossEventPayloadV2 (with recovery)");
  });

  it("decodeOperationalLossEvent: zero recovery → MoneyWire 0", () => {
    const rawNoRecovery = {
      lossEventId: "OLE-002",
      eventDate: "2026-06-13",
      discoveryDate: "2026-06-13",
      currency: "ZAR",
      grossLossMinor: 200_000,
      recoveryMinor: 0,
      businessLine: "trading-and-sales" as const,
      eventTypeCategory: "business-disruption-and-system-failures" as const,
      status: "closed" as const,
      description: "System outage",
    };
    const v2 = decodeOperationalLossEvent(rawNoRecovery);
    assertMoneyWireString(v2.recovery);
    expect(v2.recovery.amount).toBe("0");
    assertNoFloatMoney(v2, "OperationalLossEventPayloadV2 (no recovery)");
  });
});

// ---------------------------------------------------------------------------
// recon:money-codec-no-float gate integration
// ---------------------------------------------------------------------------

describe("recon:money-codec-no-float gate", () => {
  it("flags a payload with a numeric MoneyWire amount", () => {
    const badPayload = {
      amount: { __money: "v1", amount: 1234.56, currency: "ZAR" },
    };
    expect(findFloatMoneyViolations(badPayload)).toEqual(["amount.amount"]);
  });

  it("passes a clean V2-decoded payload", () => {
    const raw = {
      tradeId: "BOND-001",
      bondIsin: "ZAG000149037",
      side: "buy" as const,
      nominalMinor: 10_000_000,
      cleanPricePercent: 97.5,
      accruedInterestMinor: 25_000,
      dirtyPricePercent: 97.75,
      settlementDate: "2026-06-16",
      portfolio: "banking-book" as const,
      couponRate: 0.085,
      maturityDate: "2030-01-15",
      currency: "ZAR",
      counterpartyLei: "7LTWFZYICNSX8D621K86",
      executedAt: "2026-06-13T09:00:00Z",
    };
    const v2 = decodeBondTradeExecuted(raw);
    expect(findFloatMoneyViolations(v2)).toEqual([]);
  });
});
