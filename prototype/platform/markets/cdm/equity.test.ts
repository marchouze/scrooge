// platform/markets/cdm/equity.test.ts
//
// Unit tests for the optional instrumentId field added to equity CDM schemas.
//
// Covers:
//   1. makeEquityTradeBooked — valid payload WITHOUT instrumentId passes (backward compat).
//   2. makeEquityTradeBooked — valid payload WITH instrumentId passes.
//   3. makeEquityTradeExecuted — valid payload without instrumentId passes.
//   4. makeEquityTradeExecuted — valid payload with instrumentId passes.
//   5. makeEquitySettlementInstructed — valid payload without instrumentId passes.
//   6. makeEquityCorporateActionApplied — valid payload without instrumentId passes.
//
// Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
// Kai (Trading Systems Engineer, engineering) per D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).

import { describe, expect, it } from "bun:test";

import {
  makeEquityCorporateActionApplied,
  makeEquitySettlementInstructed,
  makeEquityTradeBooked,
  makeEquityTradeExecuted,
} from "./equity";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:kai:equity-cdm-test" };
const CITATIONS = ["D-FINANCIAL-INSTRUMENT-ENTITY", "D-MARKETS-SCHEMA-FOUNDATION"];
const AS_OF = "2026-05-22T12:00:00.000Z";

const INSTRUMENT_LISTED_EQUITY = {
  identifier: { scheme: "ISIN", value: "ZAE000012084" },
  class: "listed-equity" as const,
  currency: "ZAR",
  venue: "JSE",
};

const COUNTERPARTY = {
  partyId: "378900DATFB3JVOZL999",
  name: "Test Counterparty",
  role: "counterparty" as const,
  jurisdiction: "ZA",
};

const TRADE_DATE = { iso: "2026-05-22" as const, calendar: "JIHCAL" as const };
const SETTLEMENT_DATE = { iso: "2026-05-26" as const, calendar: "JIHCAL" as const };

const QUANTITY = { unit: "share" as const, amount: 1000 };
const PRICE = { currency: "ZAR", amount: 200.5 };
const CONSIDERATION = { currency: "ZAR", amountMinor: 200_500_00 };

const TRADE_ID = { scheme: "internal", value: "TRD-EQ-001" };

// ---------------------------------------------------------------------------
// 1. makeEquityTradeBooked — backward-compatible (no instrumentId)
// ---------------------------------------------------------------------------

describe("EquityTradeBooked — backward compatibility", () => {
  it("accepts a valid payload WITHOUT instrumentId", () => {
    expect(() =>
      makeEquityTradeBooked({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: TRADE_ID,
          instrument: INSTRUMENT_LISTED_EQUITY,
          side: "buy",
          quantity: QUANTITY,
          price: PRICE,
          consideration: CONSIDERATION,
          tradeDate: TRADE_DATE,
          settlementDate: SETTLEMENT_DATE,
          counterparty: COUNTERPARTY,
          venue: "JSE",
          trader: "trader:kai:desk-1",
          bookId: "BK-EQUITY-PROP",
        },
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. makeEquityTradeBooked — accepts instrumentId when present
// ---------------------------------------------------------------------------

describe("EquityTradeBooked — instrumentId present", () => {
  it("accepts a valid payload WITH instrumentId", () => {
    const event = makeEquityTradeBooked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: TRADE_ID,
        instrument: INSTRUMENT_LISTED_EQUITY,
        side: "buy",
        quantity: QUANTITY,
        price: PRICE,
        consideration: CONSIDERATION,
        tradeDate: TRADE_DATE,
        settlementDate: SETTLEMENT_DATE,
        counterparty: COUNTERPARTY,
        venue: "JSE",
        trader: "trader:kai:desk-1",
        bookId: "BK-EQUITY-PROP",
        instrumentId: "fi:equity:JSE:SOL",
      },
    });

    expect((event.payload as Record<string, unknown>).instrumentId).toBe("fi:equity:JSE:SOL");
  });

  it("rejects instrumentId that is an empty string", () => {
    expect(() =>
      makeEquityTradeBooked({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: TRADE_ID,
          instrument: INSTRUMENT_LISTED_EQUITY,
          side: "buy",
          quantity: QUANTITY,
          price: PRICE,
          consideration: CONSIDERATION,
          tradeDate: TRADE_DATE,
          settlementDate: SETTLEMENT_DATE,
          counterparty: COUNTERPARTY,
          venue: "JSE",
          trader: "trader:kai:desk-1",
          bookId: "BK-EQUITY-PROP",
          instrumentId: "",
        },
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. makeEquityTradeExecuted — backward-compatible (no instrumentId)
// ---------------------------------------------------------------------------

describe("EquityTradeExecuted — backward compatibility", () => {
  it("accepts a valid payload without instrumentId", () => {
    expect(() =>
      makeEquityTradeExecuted({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: TRADE_ID,
          orderId: "ORD-EQ-001",
          instrument: INSTRUMENT_LISTED_EQUITY,
          side: "buy",
          quantity: QUANTITY,
          executionPrice: PRICE,
          consideration: CONSIDERATION,
          executedAt: AS_OF,
          venue: "JSE",
          bookId: "BK-EQUITY-PROP",
          counterparty: COUNTERPARTY,
          traderRef: "trader:kai:desk-1",
        },
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. makeEquityTradeExecuted — accepts instrumentId when present
// ---------------------------------------------------------------------------

describe("EquityTradeExecuted — instrumentId present", () => {
  it("accepts a valid payload with instrumentId", () => {
    const event = makeEquityTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: TRADE_ID,
        orderId: "ORD-EQ-001",
        instrument: INSTRUMENT_LISTED_EQUITY,
        side: "buy",
        quantity: QUANTITY,
        executionPrice: PRICE,
        consideration: CONSIDERATION,
        executedAt: AS_OF,
        venue: "JSE",
        bookId: "BK-EQUITY-PROP",
        counterparty: COUNTERPARTY,
        traderRef: "trader:kai:desk-1",
        instrumentId: "fi:equity:JSE:SOL",
      },
    });

    expect((event.payload as Record<string, unknown>).instrumentId).toBe("fi:equity:JSE:SOL");
  });
});

// ---------------------------------------------------------------------------
// 5. makeEquitySettlementInstructed — backward-compatible (no instrumentId)
// ---------------------------------------------------------------------------

describe("EquitySettlementInstructed — backward compatibility", () => {
  it("accepts a valid payload without instrumentId", () => {
    expect(() =>
      makeEquitySettlementInstructed({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: TRADE_ID,
          settlementId: { scheme: "internal", value: "SETT-EQ-001" },
          netCash: { currency: "ZAR", amountMinor: -200_500_00 },
          netQuantity: QUANTITY,
          settlementDate: SETTLEMENT_DATE,
          settlementVenue: "STRATE",
          counterparty: COUNTERPARTY,
        },
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 6. makeEquityCorporateActionApplied — backward-compatible (no instrumentId)
// ---------------------------------------------------------------------------

describe("EquityCorporateActionApplied — backward compatibility", () => {
  it("accepts a valid payload without instrumentId", () => {
    expect(() =>
      makeEquityCorporateActionApplied({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          actionId: { scheme: "internal", value: "CA-DIV-001" },
          instrument: INSTRUMENT_LISTED_EQUITY,
          actionType: "cash-dividend",
          exDate: { iso: "2026-06-01" as const, calendar: "JIHCAL" as const },
          recordDate: { iso: "2026-06-03" as const, calendar: "JIHCAL" as const },
          paymentDate: { iso: "2026-06-10" as const, calendar: "JIHCAL" as const },
          cashPerShare: { currency: "ZAR", amount: 5.0 },
          bookId: "BK-EQUITY-PROP",
          positionAtRecord: QUANTITY,
        },
      }),
    ).not.toThrow();
  });
});
