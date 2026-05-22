// platform/markets/cdm/fx.test.ts
//
// Tests for D-FINANCIAL-INSTRUMENT-ENTITY Slice 8 — optional instrumentId on
// FX trade and position-revaluation schemas.
//
// Validates:
//   1. FxTradeExecuted: backward-compatible (no instrumentId) passes.
//   2. FxTradeExecuted: with instrumentId passes.
//   3. FxPositionRevalued: backward-compatible (no instrumentId) passes.
//   4. FxPositionRevalued: with instrumentId passes.
//   5. Round-trip: makeFxTradeExecuted produces an event that passes
//      eventSchema.parse().
//
// Kai (Trading Systems Engineer, engineering) per D-FINANCIAL-INSTRUMENT-ENTITY
//   (CEO-approved 2026-05-22).

import { describe, expect, it } from "bun:test";

import { makeFxPositionRevalued, fxPositionRevaluedPayloadSchema } from "../../event-store/event-types/fx-accounting";
import { eventSchema } from "../../event-store/types";
import { fxTradeExecutedPayloadSchema, makeFxTradeExecuted } from "./fx";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const counterparty = {
  partyId: "LEI-CTPY-FX",
  name: "Counterparty FX Co",
  role: "counterparty" as const,
  jurisdiction: "ZA",
};

const tradeDate = { iso: "2026-05-22", calendar: "JIHCAL" as const };
const settleDate = { iso: "2026-05-26", calendar: "JIHCAL" as const };

/** Valid FX-spot trade payload — backward-compatible shape (no instrumentId). */
const baseSpotPayload = {
  tradeId: { scheme: "INTERNAL", value: "FX-TRD-SLICE8-001" },
  productTaxonomy: "FX-spot" as const,
  currencyPair: { base: "USD", quote: "ZAR" },
  side: "buy" as const,
  legs: [
    {
      legKind: "near" as const,
      // BUY → pay quote (ZAR), receive base (USD)
      payCurrency: "ZAR",
      receiveCurrency: "USD",
      notional: { currency: "ZAR", amountMinor: 1_900_000_000 }, // ZAR 19m
      counterNotional: { currency: "USD", amountMinor: 100_000_000 }, // USD 1m
      rate: { currency: "ZAR", amount: 19.0 },
      settlementDate: settleDate,
    },
  ],
  tradeDate,
  counterparty,
  venue: "OTC",
  trader: "TRADER-FX-001",
  bookId: "BOOK-FX-MARKETS-LP",
  bookType: "trading" as const,
  settlementForm: "physical" as const,
  settlementPath: "correspondent" as const,
  clientFlowRef: "client-trade:NK-2026-05-22-00001",
};

const actor = { id: "kai-trading-systems", role: "system" } as const;
const citations = ["D-FINANCIAL-INSTRUMENT-ENTITY", "D-MARKETS-SCHEMA-FOUNDATION"];

// ---------------------------------------------------------------------------
// 1 & 2. FxTradeExecuted — instrumentId is optional (backward compatible)
// ---------------------------------------------------------------------------

describe("FxTradeExecuted instrumentId — D-FINANCIAL-INSTRUMENT-ENTITY Slice 8", () => {
  it("1. accepts a valid FX-spot payload WITHOUT instrumentId (backward compat)", () => {
    expect(() => fxTradeExecutedPayloadSchema.parse(baseSpotPayload)).not.toThrow();
  });

  it("2. accepts a valid FX-spot payload WITH instrumentId", () => {
    const payload = { ...baseSpotPayload, instrumentId: "fi:fx:USD-ZAR" };
    expect(() => fxTradeExecutedPayloadSchema.parse(payload)).not.toThrow();
    const parsed = fxTradeExecutedPayloadSchema.parse(payload);
    expect(parsed.instrumentId).toBe("fi:fx:USD-ZAR");
  });

  it("rejects an empty string instrumentId (min(1) guard)", () => {
    const payload = { ...baseSpotPayload, instrumentId: "" };
    expect(() => fxTradeExecutedPayloadSchema.parse(payload)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3 & 4. FxPositionRevalued — instrumentId is optional (backward compatible)
// ---------------------------------------------------------------------------

const baseRevalPayload = {
  tradeId: "FX-TRD-SLICE8-001",
  currencyPair: "USD/ZAR",
  bookRate: 19.0,
  revalRate: 19.25,
  notionalBaseMinor: 100_000_000,
  unrealisedPnlZarMinor: 25_000_000,
  revaluedAt: "2026-05-22T17:00:00Z",
  rateSource: "stub",
};

describe("FxPositionRevalued instrumentId — D-FINANCIAL-INSTRUMENT-ENTITY Slice 8", () => {
  it("3. accepts a valid revaluation payload WITHOUT instrumentId (backward compat)", () => {
    expect(() => fxPositionRevaluedPayloadSchema.parse(baseRevalPayload)).not.toThrow();
  });

  it("4. accepts a valid revaluation payload WITH instrumentId", () => {
    const payload = { ...baseRevalPayload, instrumentId: "fi:fx:USD-ZAR" };
    expect(() => fxPositionRevaluedPayloadSchema.parse(payload)).not.toThrow();
    const parsed = fxPositionRevaluedPayloadSchema.parse(payload);
    expect(parsed.instrumentId).toBe("fi:fx:USD-ZAR");
  });

  it("rejects an empty string instrumentId (min(1) guard)", () => {
    const payload = { ...baseRevalPayload, instrumentId: "" };
    expect(() => fxPositionRevaluedPayloadSchema.parse(payload)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5. Round-trip — makeFxTradeExecuted + eventSchema.parse()
// ---------------------------------------------------------------------------

describe("Round-trip: makeFxTradeExecuted with instrumentId passes eventSchema", () => {
  it("5. event produced by factory passes eventSchema.parse()", () => {
    const event = makeFxTradeExecuted({
      asOf: "2026-05-22T10:00:00Z",
      entity: "TGV-BANK-ZA",
      actor,
      citations,
      payload: { ...baseSpotPayload, instrumentId: "fi:fx:USD-ZAR" },
    });
    expect(() => eventSchema.parse(event)).not.toThrow();
    const parsed = eventSchema.parse(event);
    expect(parsed.type).toBe("FxTradeExecuted");
    // instrumentId persists through round-trip
    expect((parsed.payload as Record<string, unknown>).instrumentId).toBe("fi:fx:USD-ZAR");
  });

  it("5b. event WITHOUT instrumentId also passes eventSchema.parse() (backward compat)", () => {
    const event = makeFxTradeExecuted({
      asOf: "2026-05-22T10:00:00Z",
      entity: "TGV-BANK-ZA",
      actor,
      citations,
      payload: baseSpotPayload,
    });
    expect(() => eventSchema.parse(event)).not.toThrow();
    const parsed = eventSchema.parse(event);
    expect((parsed.payload as Record<string, unknown>).instrumentId).toBeUndefined();
  });
});
