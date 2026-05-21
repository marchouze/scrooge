// tests/cdm.test.ts
//
// Tests for the M1 CDM v1 slice. Validates:
//   - Primitive schemas accept valid shapes and reject invalid ones.
//   - Equity event factories validate + envelope correctly.
//   - The handler self-test path (round-trip via the factory) passes.
//
// Author: Kai · M1 per D-MARKETS-SCHEMA-FOUNDATION.

import { describe, expect, it } from "bun:test";

import {
  EQUITY_EVENT_TYPES,
  cdmDateSchema,
  equityCorporateActionAppliedPayloadSchema,
  equityTradeBookedPayloadSchema,
  identifierSchema,
  instrumentSchema,
  makeEquityCorporateActionApplied,
  makeEquitySettlementInstructed,
  makeEquityTradeBooked,
  moneySchema,
  partySchema,
  priceSchema,
  quantitySchema,
} from "../platform/markets/cdm";

describe("CDM primitives", () => {
  it("validates a well-formed Identifier", () => {
    expect(() => identifierSchema.parse({ scheme: "ISIN", value: "ZAE000000001" })).not.toThrow();
  });

  it("rejects an Identifier with missing scheme", () => {
    expect(() => identifierSchema.parse({ value: "ZAE000000001" })).toThrow();
  });

  it("validates Money in minor units", () => {
    expect(() => moneySchema.parse({ currency: "ZAR", amountMinor: 100_000 })).not.toThrow();
    expect(() => moneySchema.parse({ currency: "zar", amountMinor: 100_000 })).toThrow();
    expect(() => moneySchema.parse({ currency: "ZAR", amountMinor: 1.5 })).toThrow();
  });

  it("validates Quantity with typed unit", () => {
    expect(() => quantitySchema.parse({ unit: "share", amount: 1000 })).not.toThrow();
    expect(() => quantitySchema.parse({ unit: "fish", amount: 1 })).toThrow();
  });

  it("validates Price with currency and per-unit amount", () => {
    expect(() => priceSchema.parse({ currency: "ZAR", amount: 12.5 })).not.toThrow();
    expect(() => priceSchema.parse({ currency: "USD", amount: 100.25 })).not.toThrow();
  });

  it("validates CdmDate with calendar tag", () => {
    expect(() => cdmDateSchema.parse({ iso: "2026-05-07", calendar: "JIHCAL" })).not.toThrow();
    expect(() => cdmDateSchema.parse({ iso: "not-a-date", calendar: "JIHCAL" })).toThrow();
  });

  it("validates Party with required fields", () => {
    const ok = partySchema.safeParse({
      partyId: "LEI-XYZ",
      name: "Test Co",
      role: "counterparty",
      jurisdiction: "ZA",
    });
    expect(ok.success).toBe(true);
  });

  it("validates Instrument and dispatches on class", () => {
    const ok = instrumentSchema.safeParse({
      identifier: { scheme: "ISIN", value: "ZAE000000001" },
      class: "listed-equity",
      venue: "JSE",
      currency: "ZAR",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.class).toBe("listed-equity");
  });
});

describe("CDM equity event types", () => {
  const baseTrade = {
    tradeId: { scheme: "INTERNAL", value: "TRD-001" },
    instrument: {
      identifier: { scheme: "ISIN", value: "ZAE000000001" },
      class: "listed-equity" as const,
      venue: "JSE",
      currency: "ZAR",
    },
    side: "buy" as const,
    quantity: { unit: "share" as const, amount: 1000 },
    price: { currency: "ZAR", amount: 1.0 },
    consideration: { currency: "ZAR", amountMinor: 100_000 },
    tradeDate: { iso: "2026-05-07", calendar: "JIHCAL" as const },
    settlementDate: { iso: "2026-05-09", calendar: "JIHCAL" as const },
    counterparty: {
      partyId: "LEI-CTPY",
      name: "Counterparty Co",
      role: "counterparty" as const,
      jurisdiction: "ZA",
    },
    venue: "JSE",
    trader: "TRADER-001",
    bookId: "BOOK-EQUITY-LP",
  };

  it("EquityTradeBooked accepts a valid listed-equity trade", () => {
    expect(() => equityTradeBookedPayloadSchema.parse(baseTrade)).not.toThrow();
  });

  it("EquityTradeBooked rejects a non-equity instrument class", () => {
    const bad = {
      ...baseTrade,
      instrument: { ...baseTrade.instrument, class: "otc-irs" as const },
    };
    expect(() => equityTradeBookedPayloadSchema.parse(bad)).toThrow();
  });

  it("makeEquityTradeBooked envelopes a valid trade and stamps event_id + type", () => {
    const e = makeEquityTradeBooked({
      asOf: "2026-05-07T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:kai:test" },
      citations: ["ISDA-CDM"],
      payload: baseTrade,
    });
    expect(e.type).toBe("EquityTradeBooked");
    expect(e.event_id).toBeDefined();
    expect(e.entity).toBe("LE-ZA-HOZ-BANK");
    expect(e.citations).toContain("ISDA-CDM");
  });

  it("EquityCorporateActionApplied accepts a cash-dividend payload", () => {
    const ok = equityCorporateActionAppliedPayloadSchema.safeParse({
      actionId: { scheme: "INTERNAL", value: "CA-001" },
      instrument: baseTrade.instrument,
      actionType: "cash-dividend",
      exDate: { iso: "2026-06-01", calendar: "JIHCAL" },
      recordDate: { iso: "2026-06-03", calendar: "JIHCAL" },
      paymentDate: { iso: "2026-06-15", calendar: "JIHCAL" },
      cashPerShare: { currency: "ZAR", amount: 0.5 },
      bookId: "BOOK-EQUITY-LP",
      positionAtRecord: { unit: "share", amount: 1000 },
    });
    expect(ok.success).toBe(true);
  });

  it("EquityCorporateActionApplied accepts a stock-split with ratio", () => {
    const ok = equityCorporateActionAppliedPayloadSchema.safeParse({
      actionId: { scheme: "INTERNAL", value: "CA-002" },
      instrument: baseTrade.instrument,
      actionType: "stock-split",
      exDate: { iso: "2026-07-01", calendar: "JIHCAL" },
      recordDate: { iso: "2026-07-03", calendar: "JIHCAL" },
      paymentDate: { iso: "2026-07-15", calendar: "JIHCAL" },
      ratio: { numerator: 3, denominator: 2 },
      bookId: "BOOK-EQUITY-LP",
      positionAtRecord: { unit: "share", amount: 1000 },
    });
    expect(ok.success).toBe(true);
  });

  it("makeEquityCorporateActionApplied envelopes correctly", () => {
    const e = makeEquityCorporateActionApplied({
      asOf: "2026-06-15T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:kai:test" },
      citations: ["ISDA-CDM"],
      payload: {
        actionId: { scheme: "INTERNAL", value: "CA-001" },
        instrument: baseTrade.instrument,
        actionType: "cash-dividend",
        exDate: { iso: "2026-06-01", calendar: "JIHCAL" },
        recordDate: { iso: "2026-06-03", calendar: "JIHCAL" },
        paymentDate: { iso: "2026-06-15", calendar: "JIHCAL" },
        cashPerShare: { currency: "ZAR", amount: 0.5 },
        bookId: "BOOK-EQUITY-LP",
        positionAtRecord: { unit: "share", amount: 1000 },
      },
    });
    expect(e.type).toBe("EquityCorporateActionApplied");
  });

  it("EquitySettlementInstructed validates and envelopes", () => {
    const e = makeEquitySettlementInstructed({
      asOf: "2026-05-09T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:kai:test" },
      citations: ["ISDA-CDM"],
      payload: {
        tradeId: { scheme: "INTERNAL", value: "TRD-001" },
        settlementId: { scheme: "INTERNAL", value: "SET-001" },
        netCash: { currency: "ZAR", amountMinor: -100_000 },
        netQuantity: { unit: "share", amount: 1000 },
        settlementDate: { iso: "2026-05-09", calendar: "JIHCAL" },
        settlementVenue: "STRATE",
        counterparty: baseTrade.counterparty,
      },
    });
    expect(e.type).toBe("EquitySettlementInstructed");
  });
});

describe("CDM event-type registry", () => {
  it("exposes the M1+M3 equity event-type list", () => {
    // M1 events
    expect(EQUITY_EVENT_TYPES).toContain("EquityTradeBooked");
    expect(EQUITY_EVENT_TYPES).toContain("EquityCorporateActionApplied");
    expect(EQUITY_EVENT_TYPES).toContain("EquitySettlementInstructed");
    // M3 events (added in equity lifecycle extension)
    expect(EQUITY_EVENT_TYPES).toContain("EquityTradeExecuted");
    expect(EQUITY_EVENT_TYPES).toContain("EquitySettlementConfirmed");
    expect(EQUITY_EVENT_TYPES).toContain("EquityPositionRevalued");
    expect(EQUITY_EVENT_TYPES.length).toBe(6);
  });
});
