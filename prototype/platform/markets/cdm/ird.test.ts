// platform/markets/cdm/ird.test.ts
//
// Tests for D-FINANCIAL-INSTRUMENT-ENTITY Slice 7 — optional instrumentId fields
// on IrsTradeBooked and IrsPositionRevalued.
//
// Eitan (IRRBB / derivatives engineer, engineering) per D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).

import { describe, expect, it } from "bun:test";

import { eventSchema } from "../../event-store/types";
import {
  irsPositionRevaluedPayloadSchema,
  irsTradeBookedPayloadSchema,
  makeIrsPositionRevalued,
  makeIrsTradeBooked,
} from "./ird";

const ACTOR = { type: "system" as const, id: "eitan:test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["D-FINANCIAL-INSTRUMENT-ENTITY", "D-MARKETS-SCHEMA-FOUNDATION"];
const AS_OF = "2026-05-22T00:00:00Z";

const BASE_TRADE_PAYLOAD = {
  tradeId: { scheme: "internal", value: "TRD-IRS-001" },
  counterparty: {
    partyId: "LEI-CTPY-IRS-001",
    name: "Test Counterparty",
    role: "counterparty" as const,
  },
  notional: { currency: "ZAR", amountMinor: 10_000_000_000 }, // ZAR 100m in cents
  fixedRate: 0.085,
  floatingIndex: "JIBAR-3M" as const,
  bankPays: "fixed" as const,
  tradeDate: { iso: "2026-05-22", calendar: "JIHCAL" as const },
  effectiveDate: { iso: "2026-05-24", calendar: "JIHCAL" as const },
  maturityDate: { iso: "2031-05-24", calendar: "JIHCAL" as const },
  paymentFrequency: "quarterly" as const,
  dayCountConvention: "ACT/365" as const,
  bookId: "BK-IRD-001",
  traderRef: "TRADER-001",
};

const BASE_REVALUED_PAYLOAD = {
  tradeId: { scheme: "internal", value: "TRD-IRS-001" },
  valuationDate: "2026-05-22",
  fixedLegPv: { currency: "ZAR", amountMinor: 9_500_000_000 },
  floatingLegPv: { currency: "ZAR", amountMinor: 9_300_000_000 },
  markToMarket: { currency: "ZAR", amountMinor: 200_000_000 },
  dv01: { currency: "ZAR", amountMinor: 100_000 },
  remainingTenorDays: 1826,
};

describe("IrsTradeBooked — instrumentId (Slice 7)", () => {
  it("1. valid payload WITHOUT instrumentId passes (backward compat)", () => {
    const result = irsTradeBookedPayloadSchema.safeParse(BASE_TRADE_PAYLOAD);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instrumentId).toBeUndefined();
    }
  });

  it("2. valid payload WITH instrumentId passes", () => {
    const payload = { ...BASE_TRADE_PAYLOAD, instrumentId: "fi:irs:TRD-IRS-001" };
    const result = irsTradeBookedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instrumentId).toBe("fi:irs:TRD-IRS-001");
    }
  });

  it("instrumentId must not be empty string", () => {
    const payload = { ...BASE_TRADE_PAYLOAD, instrumentId: "" };
    const result = irsTradeBookedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe("IrsPositionRevalued — instrumentId (Slice 7)", () => {
  it("3. valid payload WITHOUT instrumentId passes", () => {
    const result = irsPositionRevaluedPayloadSchema.safeParse(BASE_REVALUED_PAYLOAD);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instrumentId).toBeUndefined();
    }
  });

  it("4. valid payload WITH instrumentId passes", () => {
    const payload = { ...BASE_REVALUED_PAYLOAD, instrumentId: "fi:irs:TRD-IRS-001" };
    const result = irsPositionRevaluedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instrumentId).toBe("fi:irs:TRD-IRS-001");
    }
  });
});

describe("Round-trip — event factory passes eventSchema.parse()", () => {
  it("5a. makeIrsTradeBooked without instrumentId round-trips", () => {
    const event = makeIrsTradeBooked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: BASE_TRADE_PAYLOAD,
    });
    const parsed = eventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.type).toBe("IrsTradeBooked");
    }
  });

  it("5b. makeIrsTradeBooked with instrumentId round-trips", () => {
    const event = makeIrsTradeBooked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: { ...BASE_TRADE_PAYLOAD, instrumentId: "fi:irs:TRD-IRS-001" },
    });
    const parsed = eventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data.payload as { instrumentId?: string }).instrumentId).toBe(
        "fi:irs:TRD-IRS-001",
      );
    }
  });

  it("5c. makeIrsPositionRevalued without instrumentId round-trips", () => {
    const event = makeIrsPositionRevalued({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: BASE_REVALUED_PAYLOAD,
    });
    const parsed = eventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.type).toBe("IrsPositionRevalued");
    }
  });

  it("5d. makeIrsPositionRevalued with instrumentId round-trips", () => {
    const event = makeIrsPositionRevalued({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: { ...BASE_REVALUED_PAYLOAD, instrumentId: "fi:irs:TRD-IRS-001" },
    });
    const parsed = eventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data.payload as { instrumentId?: string }).instrumentId).toBe(
        "fi:irs:TRD-IRS-001",
      );
    }
  });
});
