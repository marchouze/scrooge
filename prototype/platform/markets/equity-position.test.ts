// platform/markets/equity-position.test.ts
//
// Position projection tests for the equity book builder.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION, IFRS-9-§4.1

import { describe, expect, it } from "bun:test";

import type {
  EquityCorporateActionAppliedPayload,
  EquitySettlementConfirmedPayload,
  EquityTradeBookedPayload,
} from "./cdm/equity";
import { buildEquityBook } from "./equity-position";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NPN_ISIN = "ZAE000015889";
const MTN_ISIN = "ZAE000042164";

function makeInstrument(isin: string) {
  return {
    identifier: { scheme: "ISIN", value: isin },
    class: "listed-equity" as const,
    venue: "JSE",
    currency: "ZAR",
  };
}

function makeTradeBooked(
  isin: string,
  side: "buy" | "sell",
  quantity: number,
  priceZAR: number,
  tradeId = "TRD-001",
): { type: string; payload: unknown } {
  const totalMinor = Math.round(quantity * priceZAR * 100);
  const payload: EquityTradeBookedPayload = {
    tradeId: { scheme: "INTERNAL", value: tradeId },
    instrument: makeInstrument(isin),
    side,
    quantity: { unit: "share", amount: quantity },
    price: { currency: "ZAR", amount: priceZAR },
    consideration: { currency: "ZAR", amountMinor: totalMinor },
    tradeDate: { iso: "2026-05-17", calendar: "JIHCAL" },
    settlementDate: { iso: "2026-05-20", calendar: "JIHCAL" },
    counterparty: { partyId: "CP-001", name: "Test CP", role: "counterparty", jurisdiction: "ZA" },
    venue: "JSE",
    trader: "kai@bank.local",
    bookId: "BOOK-EQ-TRADING",
  };
  return { type: "EquityTradeBooked", payload };
}

function makeSettlementConfirmed(isin: string): { type: string; payload: unknown } {
  const payload: EquitySettlementConfirmedPayload = {
    tradeId: { scheme: "INTERNAL", value: "TRD-001" },
    settlementDate: { iso: "2026-05-20", calendar: "JIHCAL" },
    securitiesLeg: {
      direction: "receive",
      quantity: { unit: "share", amount: 1000 },
      instrument: makeInstrument(isin),
    },
    cashLeg: {
      direction: "pay",
      amount: { currency: "ZAR", amountMinor: 1_000_000_00 },
    },
    confirmedAt: "2026-05-20T10:30:00.000Z",
    strateRef: "STRATE-CONF-001",
  };
  return { type: "EquitySettlementConfirmed", payload };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildEquityBook", () => {
  it("buy 1000 shares → position quantity = 1000", () => {
    const events = [makeTradeBooked(NPN_ISIN, "buy", 1000, 4250)];
    const book = buildEquityBook(events);

    expect(book.size).toBe(1);
    const pos = book.get(NPN_ISIN);
    expect(pos).toBeDefined();
    expect(pos?.quantity).toBe(1000);
    expect(pos?.isin).toBe(NPN_ISIN);
  });

  it("buy 1000 then sell 400 → net quantity = 600", () => {
    const events = [
      makeTradeBooked(NPN_ISIN, "buy", 1000, 4250, "TRD-001"),
      makeTradeBooked(NPN_ISIN, "sell", 400, 4300, "TRD-002"),
    ];
    const book = buildEquityBook(events);

    expect(book.size).toBe(1);
    const pos = book.get(NPN_ISIN);
    expect(pos?.quantity).toBe(600);
  });

  it("sell entire position → removes from open book", () => {
    const events = [
      makeTradeBooked(NPN_ISIN, "buy", 1000, 4250, "TRD-001"),
      makeTradeBooked(NPN_ISIN, "sell", 1000, 4300, "TRD-002"),
    ];
    const book = buildEquityBook(events);
    expect(book.size).toBe(0);
  });

  it("2:1 stock split → quantity doubles, avgCostPrice halves", () => {
    const buyEvent = makeTradeBooked(NPN_ISIN, "buy", 1000, 4250);

    const splitPayload: EquityCorporateActionAppliedPayload = {
      actionId: { scheme: "INTERNAL", value: "CA-001" },
      instrument: makeInstrument(NPN_ISIN),
      actionType: "stock-split",
      exDate: { iso: "2026-05-18", calendar: "JIHCAL" },
      recordDate: { iso: "2026-05-19", calendar: "JIHCAL" },
      paymentDate: { iso: "2026-05-20", calendar: "JIHCAL" },
      ratio: { numerator: 2, denominator: 1 },
      bookId: "BOOK-EQ-TRADING",
      positionAtRecord: { unit: "share", amount: 1000 },
    };
    const splitEvent = { type: "EquityCorporateActionApplied", payload: splitPayload };

    const book = buildEquityBook([buyEvent, splitEvent]);
    const pos = book.get(NPN_ISIN);

    expect(pos?.quantity).toBe(2000);
    expect(pos?.avgCostPriceZAR).toBeCloseTo(2125, 2); // 4250 / 2
    // Total cost basis should be unchanged
    expect(pos?.totalCostZAR).toBe(1000 * 4250 * 100); // original cost in minor units
  });

  it("settlement confirmation removes instrument from open book", () => {
    const events = [
      makeTradeBooked(NPN_ISIN, "buy", 1000, 4250),
      makeSettlementConfirmed(NPN_ISIN),
    ];
    const book = buildEquityBook(events);
    expect(book.has(NPN_ISIN)).toBe(false);
    expect(book.size).toBe(0);
  });

  it("multiple instruments tracked independently", () => {
    const events = [
      makeTradeBooked(NPN_ISIN, "buy", 1000, 4250, "TRD-NPN"),
      makeTradeBooked(MTN_ISIN, "buy", 5000, 182.5, "TRD-MTN"),
    ];
    const book = buildEquityBook(events);
    expect(book.size).toBe(2);
    expect(book.get(NPN_ISIN)?.quantity).toBe(1000);
    expect(book.get(MTN_ISIN)?.quantity).toBe(5000);
  });

  it("weighted-average cost is calculated correctly on two buys", () => {
    const events = [
      makeTradeBooked(NPN_ISIN, "buy", 1000, 4000, "TRD-001"),
      makeTradeBooked(NPN_ISIN, "buy", 1000, 4500, "TRD-002"),
    ];
    const book = buildEquityBook(events);
    const pos = book.get(NPN_ISIN);

    expect(pos?.quantity).toBe(2000);
    // avg cost = (1000 × 4000 + 1000 × 4500) / 2000 = 4250
    expect(pos?.avgCostPriceZAR).toBeCloseTo(4250, 2);
  });

  it("non-equity events are ignored", () => {
    const events = [
      makeTradeBooked(NPN_ISIN, "buy", 1000, 4250),
      { type: "FxTradeExecuted", payload: { tradeId: "FX-001" } },
      { type: "AgentDecision", payload: { decisionId: "D-001" } },
    ];
    const book = buildEquityBook(events);
    expect(book.size).toBe(1);
  });
});
