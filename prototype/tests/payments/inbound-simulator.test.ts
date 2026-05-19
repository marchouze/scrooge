// tests/payments/inbound-simulator.test.ts
//
// Unit tests for the FX inbound message simulator.
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — correspondent settlement path
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   PROC-PAY-RBH-01 — reconciliation procedure

import { describe, expect, test } from "bun:test";

import type { FxTradeExecutedPayload } from "@platform/markets/cdm/fx";
import { simulateInboundMessages } from "@platform/payments/inbound-simulator";

// ---------------------------------------------------------------------------
// ZAR/USD spot trade fixture — bank buys USD, delivers ZAR
// ---------------------------------------------------------------------------

const ZAR_USD_BUY_TRADE: FxTradeExecutedPayload = {
  tradeId: { scheme: "INTERNAL", value: "TRD-SIM-INBOUND-001" },
  productTaxonomy: "FX-spot",
  currencyPair: { base: "USD", quote: "ZAR" },
  side: "buy",
  legs: [
    {
      legKind: "near",
      payCurrency: "ZAR",      // bank pays (delivers) ZAR
      receiveCurrency: "USD",  // bank receives (buys) USD
      notional: { currency: "ZAR", amountMinor: 9_250_000_000_00 }, // ZAR 92,500,000
      counterNotional: { currency: "USD", amountMinor: 5_000_000_00 }, // USD 5,000,000
      rate: { currency: "ZAR", amount: 18.5 },
      settlementDate: { iso: "2026-05-14", calendar: "JIHCAL" },
    },
  ],
  tradeDate: { iso: "2026-05-12", calendar: "JIHCAL" },
  counterparty: {
    partyId: "CP-STANDARD-001",
    name: "Standard Bank Counterparty",
    role: "counterparty",
    jurisdiction: "ZA",
  },
  venue: "OTC",
  trader: "trader@bank.local",
  bookId: "BOOK-FX-MARKETS",
  bookType: "trading",
  settlementForm: "physical",
  settlementPath: "correspondent",
  finsurvCategory: "ODP-001",
};

const SETTLED_AT = new Date("2026-05-14T10:00:00.000Z");
const NOSTRO_BALANCE = 10_000_000_00n; // USD 100,000 opening balance
const CORRESPONDENT_BIC = "SBZAZAJJXXX";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("simulateInboundMessages — ZAR/USD buy trade", () => {
  test("returns a message set with the correct tradeId", () => {
    const result = simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      CORRESPONDENT_BIC,
    );

    expect(result.tradeId).toBe("TRD-SIM-INBOUND-001");
  });

  test("mt300Confirmation is present with mirrored legs", () => {
    const result = simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      CORRESPONDENT_BIC,
    );

    expect(result.mt300Confirmation).toBeDefined();

    // MT300 from counterparty's perspective: :32B: sold = ZAR (they sell ZAR to bank)
    const field32B = result.mt300Confirmation!.block4.find((f) => f.tag === "32B");
    expect(field32B?.value).toContain("ZAR");

    // :33B: bought = USD (they buy USD from bank's perspective — mirrored)
    const field33B = result.mt300Confirmation!.block4.find((f) => f.tag === "33B");
    expect(field33B?.value).toContain("USD");
  });

  test("mt202ReceiveLeg is present — USD flowing in", () => {
    const result = simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      CORRESPONDENT_BIC,
    );

    expect(result.mt202ReceiveLeg).toBeDefined();

    // The receive leg carries USD (what the bank receives)
    const field32A = result.mt202ReceiveLeg!.block4.find((f) => f.tag === "32A");
    expect(field32A?.value).toContain("USD");
  });

  test("mt940Statement has one credit entry in USD", () => {
    const result = simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      CORRESPONDENT_BIC,
    );

    expect(result.mt940Statement).toBeDefined();

    // Should have exactly one :61: entry
    const entries61 = result.mt940Statement!.block4.filter((f) => f.tag === "61");
    expect(entries61).toHaveLength(1);

    // Entry should be a credit (C mark)
    expect(entries61[0]!.value).toContain("C");

    // :60F: opening balance should be in USD
    const field60F = result.mt940Statement!.block4.find((f) => f.tag === "60F");
    expect(field60F?.value).toContain("USD");
  });

  test("pacs009ReceiveLeg is present with USD currency", () => {
    const result = simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      CORRESPONDENT_BIC,
    );

    expect(result.pacs009ReceiveLeg).toBeDefined();

    const txInfo = result.pacs009ReceiveLeg!.CdtTrfTxInf[0];
    expect(txInfo).toBeDefined();
    expect(txInfo!.IntrBkSttlmAmt.Ccy).toBe("USD");
  });

  test("camt053Statement has one credit entry in USD", () => {
    const result = simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      CORRESPONDENT_BIC,
    );

    expect(result.camt053Statement).toBeDefined();

    const stmt = result.camt053Statement!.Stmt[0];
    expect(stmt).toBeDefined();
    expect(stmt!.Ntry).toHaveLength(1);
    expect(stmt!.Ntry[0]!.CdtDbtInd).toBe("CRDT");
    expect(stmt!.Ntry[0]!.Amt.Ccy).toBe("USD");
  });

  test("mt940 closing balance = opening + USD received", () => {
    const result = simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      CORRESPONDENT_BIC,
    );

    // Opening: USD 100,000 = 10_000_000 minor units
    // Received: USD 5,000,000 = 5_000_000_00 minor units = 500_000_000
    // Closing: USD 5,100,000 = 510_000_000 minor units
    expect(result.mt940Statement!.closingBalance).toBe(
      NOSTRO_BALANCE + 5_000_000_00n,
    );
  });

  test("camt.053 closing balance = opening + USD received", () => {
    const result = simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      CORRESPONDENT_BIC,
    );

    const stmt = result.camt053Statement!.Stmt[0]!;
    const clBal = stmt.Bal.find((b) => b.Tp.CdOrPrtry.Cd === "CLBD");
    expect(clBal).toBeDefined();

    // Opening + received = 100,000 + 5,000,000 = 5,100,000 USD
    // In minor units: 10_000_000 + 500_000_000 = 510_000_000 → 5100000.00
    expect(parseFloat(clBal!.Amt.value)).toBeCloseTo(5_100_000, 0);
  });

  test("all message types are present", () => {
    const result = simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      CORRESPONDENT_BIC,
    );

    expect(result.mt300Confirmation).toBeDefined();
    expect(result.mt202ReceiveLeg).toBeDefined();
    expect(result.mt940Statement).toBeDefined();
    expect(result.pacs009ReceiveLeg).toBeDefined();
    expect(result.camt053Statement).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// USD/ZAR sell trade fixture — bank sells USD, receives ZAR
// ---------------------------------------------------------------------------

const USD_ZAR_SELL_TRADE: FxTradeExecutedPayload = {
  tradeId: { scheme: "INTERNAL", value: "TRD-SIM-INBOUND-002" },
  productTaxonomy: "FX-spot",
  currencyPair: { base: "USD", quote: "ZAR" },
  side: "sell",
  legs: [
    {
      legKind: "near",
      payCurrency: "USD",      // bank pays (delivers) USD
      receiveCurrency: "ZAR",  // bank receives ZAR
      notional: { currency: "USD", amountMinor: 5_000_000_00 }, // USD 5,000,000
      counterNotional: { currency: "ZAR", amountMinor: 9_250_000_000_00 }, // ZAR 92,500,000
      rate: { currency: "USD", amount: 1 / 18.5 },
      settlementDate: { iso: "2026-05-14", calendar: "JIHCAL" },
    },
  ],
  tradeDate: { iso: "2026-05-12", calendar: "JIHCAL" },
  counterparty: {
    partyId: "CP-STANDARD-001",
    name: "Standard Bank Counterparty",
    role: "counterparty",
    jurisdiction: "ZA",
  },
  venue: "OTC",
  trader: "trader@bank.local",
  bookId: "BOOK-FX-MARKETS",
  bookType: "trading",
  settlementForm: "physical",
  settlementPath: "correspondent",
  finsurvCategory: "ODP-001",
};

describe("simulateInboundMessages — USD/ZAR sell trade", () => {
  test("receive leg carries ZAR (bank receives ZAR in sell)", () => {
    const result = simulateInboundMessages(
      USD_ZAR_SELL_TRADE,
      SETTLED_AT,
      50_000_000_000n, // ZAR 500,000,000 opening nostro
      CORRESPONDENT_BIC,
    );

    expect(result.mt202ReceiveLeg).toBeDefined();
    const field32A = result.mt202ReceiveLeg!.block4.find((f) => f.tag === "32A");
    expect(field32A?.value).toContain("ZAR");
  });

  test("pacs.009 receive leg carries ZAR", () => {
    const result = simulateInboundMessages(
      USD_ZAR_SELL_TRADE,
      SETTLED_AT,
      50_000_000_000n,
      CORRESPONDENT_BIC,
    );

    expect(result.pacs009ReceiveLeg!.CdtTrfTxInf[0]!.IntrBkSttlmAmt.Ccy).toBe("ZAR");
  });
});
