// tests/cdm-fx.test.ts
//
// Tests for the M4 CDM FX foundation slice. Validates:
//   - currencyPair / bookType primitives
//   - FxTradeExecuted shapes for all four M4 variants (Spot, Forward,
//     Swap, NDF) — including discriminator enforcement and the
//     bookType-required rule per D-FX-BOOK-BOUNDARY.
//   - FxSettlementInstructed correspondent vs bilateral path discipline.
//   - Citation-slot enforcement (Principle 2).
//
// Author: Saskia · Kai — M4 per D-MARKETS-SCHEMA-FOUNDATION + D-FX-* sub-decisions.

import { describe, expect, it } from "bun:test";

import {
  FX_EVENT_TYPES,
  bookTypeSchema,
  currencyPairSchema,
  fxProductTaxonomySchema,
  fxSettlementInstructedPayloadSchema,
  fxTradeExecutedPayloadSchema,
  makeFxSettlementInstructed,
  makeFxTradeExecuted,
} from "../platform/markets/cdm";

const counterparty = {
  partyId: "LEI-CTPY-FX",
  name: "Counterparty FX Co",
  role: "counterparty" as const,
  jurisdiction: "ZA",
};

const correspondent = {
  partyId: "LEI-CORR-CLS",
  name: "Major SA / Global Correspondent",
  role: "settlement-agent" as const,
  jurisdiction: "ZA",
};

const tradeDate = { iso: "2026-05-09", calendar: "JIHCAL" as const };
const spotSettleDate = { iso: "2026-05-13", calendar: "JIHCAL" as const };
const forwardSettleDate = { iso: "2026-08-09", calendar: "JIHCAL" as const };

const baseSpotPayload = {
  tradeId: { scheme: "INTERNAL", value: "FX-TRD-001" },
  productTaxonomy: "FX-spot" as const,
  currencyPair: { base: "USD", quote: "ZAR" },
  side: "buy" as const,
  legs: [
    {
      legKind: "near" as const,
      payCurrency: "ZAR",
      receiveCurrency: "USD",
      notional: { currency: "ZAR", amountMinor: 1_900_000_000 }, // ZAR 19m
      counterNotional: { currency: "USD", amountMinor: 100_000_000 }, // USD 1m (in cents)
      rate: { currency: "ZAR", amount: 19.0 },
      settlementDate: spotSettleDate,
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
};

describe("CDM FX primitives", () => {
  it("validates a well-formed currencyPair", () => {
    expect(() => currencyPairSchema.parse({ base: "USD", quote: "ZAR" })).not.toThrow();
  });

  it("rejects identical base and quote", () => {
    expect(() => currencyPairSchema.parse({ base: "ZAR", quote: "ZAR" })).toThrow();
  });

  it("rejects lowercase currency codes", () => {
    expect(() => currencyPairSchema.parse({ base: "usd", quote: "zar" })).toThrow();
  });

  it("validates bookType enum", () => {
    expect(() => bookTypeSchema.parse("trading")).not.toThrow();
    expect(() => bookTypeSchema.parse("banking-treasury")).not.toThrow();
    expect(() => bookTypeSchema.parse("retail")).toThrow();
  });

  it("validates fxProductTaxonomy enum (M4 in-scope variants only)", () => {
    expect(() => fxProductTaxonomySchema.parse("FX-spot")).not.toThrow();
    expect(() => fxProductTaxonomySchema.parse("FX-forward")).not.toThrow();
    expect(() => fxProductTaxonomySchema.parse("FX-swap")).not.toThrow();
    expect(() => fxProductTaxonomySchema.parse("NDF")).not.toThrow();
    // CCS lives at M3, not M4.
    expect(() => fxProductTaxonomySchema.parse("CCS")).toThrow();
    // Options ship at M5.
    expect(() => fxProductTaxonomySchema.parse("FX-option")).toThrow();
  });
});

describe("FxTradeExecuted — Spot", () => {
  it("accepts a valid Spot trade with bookType = trading", () => {
    expect(() => fxTradeExecutedPayloadSchema.parse(baseSpotPayload)).not.toThrow();
  });

  it("rejects a Spot trade with no bookType (D-FX-BOOK-BOUNDARY)", () => {
    const { bookType, ...withoutBookType } = baseSpotPayload;
    void bookType;
    expect(() => fxTradeExecutedPayloadSchema.parse(withoutBookType)).toThrow();
  });

  it("accepts a Spot trade with bookType = banking-treasury (Eitan HQLA rotation)", () => {
    expect(() =>
      fxTradeExecutedPayloadSchema.parse({ ...baseSpotPayload, bookType: "banking-treasury" }),
    ).not.toThrow();
  });

  it("rejects a Spot trade with cash settlementForm (Spot must be physical)", () => {
    expect(() =>
      fxTradeExecutedPayloadSchema.parse({ ...baseSpotPayload, settlementForm: "cash" }),
    ).toThrow();
  });

  it("rejects a leg currency outside the currencyPair", () => {
    const bad = {
      ...baseSpotPayload,
      legs: [{ ...baseSpotPayload.legs[0], payCurrency: "EUR" }],
    };
    expect(() => fxTradeExecutedPayloadSchema.parse(bad)).toThrow();
  });
});

describe("FxTradeExecuted — Forward", () => {
  it("accepts a valid Outright Forward (settlement beyond spot)", () => {
    const fwd = {
      ...baseSpotPayload,
      tradeId: { scheme: "INTERNAL", value: "FX-TRD-FWD-001" },
      productTaxonomy: "FX-forward" as const,
      legs: [
        {
          ...baseSpotPayload.legs[0],
          settlementDate: forwardSettleDate,
        },
      ],
    };
    expect(() => fxTradeExecutedPayloadSchema.parse(fwd)).not.toThrow();
  });
});

describe("FxTradeExecuted — Swap", () => {
  it("accepts a valid FX Swap (one near + one far leg)", () => {
    const swap = {
      ...baseSpotPayload,
      tradeId: { scheme: "INTERNAL", value: "FX-TRD-SWP-001" },
      productTaxonomy: "FX-swap" as const,
      bookType: "banking-treasury" as const,
      legs: [
        {
          legKind: "near" as const,
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          notional: { currency: "ZAR", amountMinor: 1_900_000_000 },
          counterNotional: { currency: "USD", amountMinor: 100_000_000 },
          rate: { currency: "ZAR", amount: 19.0 },
          settlementDate: spotSettleDate,
        },
        {
          legKind: "far" as const,
          payCurrency: "USD",
          receiveCurrency: "ZAR",
          notional: { currency: "USD", amountMinor: 100_000_000 },
          counterNotional: { currency: "ZAR", amountMinor: 1_910_000_000 },
          rate: { currency: "ZAR", amount: 19.1 },
          settlementDate: forwardSettleDate,
        },
      ],
    };
    expect(() => fxTradeExecutedPayloadSchema.parse(swap)).not.toThrow();
  });

  it("rejects an FX Swap with only one leg", () => {
    const swap = {
      ...baseSpotPayload,
      productTaxonomy: "FX-swap" as const,
    };
    expect(() => fxTradeExecutedPayloadSchema.parse(swap)).toThrow();
  });

  it("rejects an FX Swap with two 'near' legs (no 'far')", () => {
    const swap = {
      ...baseSpotPayload,
      productTaxonomy: "FX-swap" as const,
      legs: [
        baseSpotPayload.legs[0],
        { ...baseSpotPayload.legs[0], settlementDate: forwardSettleDate },
      ],
    };
    expect(() => fxTradeExecutedPayloadSchema.parse(swap)).toThrow();
  });
});

describe("FxTradeExecuted — NDF", () => {
  const ndfBase = {
    ...baseSpotPayload,
    tradeId: { scheme: "INTERNAL", value: "FX-TRD-NDF-001" },
    productTaxonomy: "NDF" as const,
    settlementForm: "cash" as const,
    ndfFixingSource: "SARB-ZAR-Fixing-1600-SAST",
    ndfSettlementCurrency: "USD",
  };

  it("accepts a valid NDF with fixing source + settlement currency", () => {
    expect(() => fxTradeExecutedPayloadSchema.parse(ndfBase)).not.toThrow();
  });

  it("rejects an NDF without ndfFixingSource", () => {
    const { ndfFixingSource, ...without } = ndfBase;
    void ndfFixingSource;
    expect(() => fxTradeExecutedPayloadSchema.parse(without)).toThrow();
  });

  it("rejects an NDF without ndfSettlementCurrency", () => {
    const { ndfSettlementCurrency, ...without } = ndfBase;
    void ndfSettlementCurrency;
    expect(() => fxTradeExecutedPayloadSchema.parse(without)).toThrow();
  });

  it("rejects an NDF with physical settlement", () => {
    expect(() =>
      fxTradeExecutedPayloadSchema.parse({ ...ndfBase, settlementForm: "physical" }),
    ).toThrow();
  });
});

describe("makeFxTradeExecuted — envelope + citation enforcement", () => {
  it("envelopes a valid Spot trade and stamps event_id + type", () => {
    const e = makeFxTradeExecuted({
      asOf: "2026-05-09T10:00:00.000Z",
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:kai:fx-test" },
      citations: ["ORG-MK-08", "D-FX-BOOK-BOUNDARY", "[citation: TBC]"],
      payload: baseSpotPayload,
    });
    expect(e.type).toBe("FxTradeExecuted");
    expect(e.event_id).toBeDefined();
    expect(e.entity).toBe("BANK-ZA-001");
    expect(e.citations).toContain("ORG-MK-08");
  });

  it("rejects a trade with no citations (Principle 2)", () => {
    expect(() =>
      makeFxTradeExecuted({
        asOf: "2026-05-09T10:00:00.000Z",
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:kai:fx-test" },
        citations: [],
        payload: baseSpotPayload,
      }),
    ).toThrow();
  });
});

describe("FxSettlementInstructed — correspondent vs bilateral path", () => {
  const baseSettle = {
    tradeId: { scheme: "INTERNAL", value: "FX-TRD-001" },
    legKind: "near" as const,
    settlementId: { scheme: "INTERNAL", value: "FX-SET-001" },
    settlementPath: "correspondent" as const,
    settlementForm: "physical" as const,
    correspondent,
    counterparty,
    netCash: { currency: "ZAR", amountMinor: -1_900_000_000 },
    settlementDate: spotSettleDate,
    messageStandard: "SWIFT-MT202" as const,
  };

  it("accepts a correspondent-routed FX settlement instruction", () => {
    expect(() => fxSettlementInstructedPayloadSchema.parse(baseSettle)).not.toThrow();
  });

  it("envelopes correspondent-path settlement and stamps event_id + type", () => {
    const e = makeFxSettlementInstructed({
      asOf: "2026-05-09T10:01:00.000Z",
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:kai:fx-test" },
      citations: ["D-FX-CLS-MEMBERSHIP", "ORG-MK-08"],
      payload: baseSettle,
    });
    expect(e.type).toBe("FxSettlementInstructed");
  });

  it("rejects correspondent-path settlement without a correspondent party (D-FX-CLS-MEMBERSHIP)", () => {
    const { correspondent: c, ...without } = baseSettle;
    void c;
    expect(() =>
      makeFxSettlementInstructed({
        asOf: "2026-05-09T10:01:00.000Z",
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:kai:fx-test" },
        citations: ["D-FX-CLS-MEMBERSHIP"],
        payload: without,
      }),
    ).toThrow();
  });

  it("accepts a bilateral-path settlement (no correspondent required)", () => {
    const { correspondent: c, ...without } = baseSettle;
    void c;
    expect(() =>
      fxSettlementInstructedPayloadSchema.parse({ ...without, settlementPath: "bilateral" }),
    ).not.toThrow();
  });

  it("rejects settlement instruction with no citations", () => {
    expect(() =>
      makeFxSettlementInstructed({
        asOf: "2026-05-09T10:01:00.000Z",
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:kai:fx-test" },
        citations: [],
        payload: baseSettle,
      }),
    ).toThrow();
  });
});

describe("FX event-type registry", () => {
  it("exposes the M4 FX event-type list", () => {
    expect(FX_EVENT_TYPES).toContain("FxTradeExecuted");
    expect(FX_EVENT_TYPES).toContain("FxSettlementInstructed");
    expect(FX_EVENT_TYPES.length).toBe(2);
  });
});
