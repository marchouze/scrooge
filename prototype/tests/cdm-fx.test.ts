// tests/cdm-fx.test.ts
//
// Tests for the M4 CDM FX foundation slice. Validates:
//   - currencyPair / bookType primitives
//   - FxTradeExecuted shapes for all four M4 variants (Spot, Forward,
//     Swap, NDF) — including discriminator enforcement and the
//     bookType-required rule per D-FX-BOOK-BOUNDARY.
//   - FxSettlementInstructed correspondent vs bilateral path discipline.
//   - PrincipalPayment schema validation + citation enforcement (Principle 2).
//   - SettlementConfirmed schema validation + citation enforcement (Principle 2).
//   - Full 6-event FX Spot lifecycle (scenario 06).
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
  makePrincipalPayment,
  makeSettlementConfirmed,
  principalPaymentPayloadSchema,
  settlementConfirmedPayloadSchema,
} from "../platform/markets/cdm";
import { buildFxSpotScenarioEvents, runFxSpotScenario } from "../scenarios/06-fx-spot-trade";

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
  it("exposes the M4 FX event-type list including settlement lifecycle events", () => {
    expect(FX_EVENT_TYPES).toContain("FxTradeExecuted");
    expect(FX_EVENT_TYPES).toContain("FxSettlementInstructed");
    expect(FX_EVENT_TYPES).toContain("PrincipalPayment");
    expect(FX_EVENT_TYPES).toContain("SettlementConfirmed");
    expect(FX_EVENT_TYPES.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// PrincipalPayment — schema validation + citation enforcement
// ---------------------------------------------------------------------------

const basePrincipalPaymentPayload = {
  tradeId: "TRD-FX-001",
  legKind: "deliver" as const,
  currencyPair: "ZAR/USD",
  currency: "ZAR",
  netCash: -1_900_000_000,
  settlementDate: "2026-05-13",
  settlementPath: "correspondent" as const,
  correspondent: {
    name: "Test Correspondent Bank",
    bic: "SBZAZAJJXXX",
  },
  citations: ["D-FX-CLS-MEMBERSHIP", "D-FX-AD-STATUS"],
};

describe("PrincipalPayment — schema validation", () => {
  it("accepts a valid deliver-leg PrincipalPayment", () => {
    expect(() => principalPaymentPayloadSchema.parse(basePrincipalPaymentPayload)).not.toThrow();
  });

  it("accepts a valid receive-leg PrincipalPayment", () => {
    expect(() =>
      principalPaymentPayloadSchema.parse({
        ...basePrincipalPaymentPayload,
        legKind: "receive",
        currency: "USD",
        netCash: 500_000_000,
      }),
    ).not.toThrow();
  });

  it("accepts an optional settlementConfirmationRef", () => {
    expect(() =>
      principalPaymentPayloadSchema.parse({
        ...basePrincipalPaymentPayload,
        settlementConfirmationRef: "CONF-001",
      }),
    ).not.toThrow();
  });

  it("rejects empty citations array (Principle 2)", () => {
    expect(() =>
      principalPaymentPayloadSchema.parse({ ...basePrincipalPaymentPayload, citations: [] }),
    ).toThrow();
  });

  it("rejects an invalid currency code (lowercase)", () => {
    expect(() =>
      principalPaymentPayloadSchema.parse({ ...basePrincipalPaymentPayload, currency: "zar" }),
    ).toThrow();
  });

  it("rejects a currency code longer than 3 characters", () => {
    expect(() =>
      principalPaymentPayloadSchema.parse({ ...basePrincipalPaymentPayload, currency: "ZARX" }),
    ).toThrow();
  });
});

describe("makePrincipalPayment — envelope + citation enforcement", () => {
  it("envelopes a valid PrincipalPayment and stamps event_id + type", () => {
    const e = makePrincipalPayment({
      asOf: "2026-05-13T10:00:00.000Z",
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:tomas:settlement" },
      citations: ["D-FX-CLS-MEMBERSHIP"],
      payload: basePrincipalPaymentPayload,
    });
    expect(e.type).toBe("PrincipalPayment");
    expect(e.event_id).toBeDefined();
    expect(e.entity).toBe("BANK-ZA-001");
    expect(e.citations).toContain("D-FX-CLS-MEMBERSHIP");
  });

  it("rejects empty envelope citations (Principle 2)", () => {
    expect(() =>
      makePrincipalPayment({
        asOf: "2026-05-13T10:00:00.000Z",
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:tomas:settlement" },
        citations: [],
        payload: basePrincipalPaymentPayload,
      }),
    ).toThrow();
  });

  it("rejects empty payload citations (Principle 2)", () => {
    expect(() =>
      makePrincipalPayment({
        asOf: "2026-05-13T10:00:00.000Z",
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:tomas:settlement" },
        citations: ["D-FX-CLS-MEMBERSHIP"],
        payload: { ...basePrincipalPaymentPayload, citations: [] },
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// SettlementConfirmed — schema validation + citation enforcement
// ---------------------------------------------------------------------------

const baseSettlementConfirmedPayload = {
  tradeId: "TRD-FX-001",
  currencyPair: "ZAR/USD",
  settledDate: "2026-05-13",
  realisedPnlDelta: 0,
  settlementRef: "SWIFT-CONF-001",
  citations: ["D-FX-CLS-MEMBERSHIP", "D-FX-AD-STATUS"],
};

describe("SettlementConfirmed — schema validation", () => {
  it("accepts a valid SettlementConfirmed with zero P&L delta", () => {
    expect(() =>
      settlementConfirmedPayloadSchema.parse(baseSettlementConfirmedPayload),
    ).not.toThrow();
  });

  it("accepts a positive realisedPnlDelta (profit)", () => {
    expect(() =>
      settlementConfirmedPayloadSchema.parse({
        ...baseSettlementConfirmedPayload,
        realisedPnlDelta: 50_000_00,
      }),
    ).not.toThrow();
  });

  it("accepts a negative realisedPnlDelta (loss)", () => {
    expect(() =>
      settlementConfirmedPayloadSchema.parse({
        ...baseSettlementConfirmedPayload,
        realisedPnlDelta: -20_000_00,
      }),
    ).not.toThrow();
  });

  it("accepts an optional finsurvReportingRef", () => {
    expect(() =>
      settlementConfirmedPayloadSchema.parse({
        ...baseSettlementConfirmedPayload,
        finsurvReportingRef: "FINSURV-2026-001",
      }),
    ).not.toThrow();
  });

  it("rejects empty citations array (Principle 2)", () => {
    expect(() =>
      settlementConfirmedPayloadSchema.parse({
        ...baseSettlementConfirmedPayload,
        citations: [],
      }),
    ).toThrow();
  });

  it("rejects a non-integer realisedPnlDelta (minor units must be integer)", () => {
    expect(() =>
      settlementConfirmedPayloadSchema.parse({
        ...baseSettlementConfirmedPayload,
        realisedPnlDelta: 1.5,
      }),
    ).toThrow();
  });
});

describe("makeSettlementConfirmed — envelope + citation enforcement", () => {
  it("envelopes a valid SettlementConfirmed and stamps event_id + type", () => {
    const e = makeSettlementConfirmed({
      asOf: "2026-05-13T10:05:00.000Z",
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:tomas:settlement" },
      citations: ["D-FX-CLS-MEMBERSHIP"],
      payload: baseSettlementConfirmedPayload,
    });
    expect(e.type).toBe("SettlementConfirmed");
    expect(e.event_id).toBeDefined();
    expect(e.entity).toBe("BANK-ZA-001");
  });

  it("rejects empty envelope citations (Principle 2)", () => {
    expect(() =>
      makeSettlementConfirmed({
        asOf: "2026-05-13T10:05:00.000Z",
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:tomas:settlement" },
        citations: [],
        payload: baseSettlementConfirmedPayload,
      }),
    ).toThrow();
  });

  it("rejects empty payload citations (Principle 2)", () => {
    expect(() =>
      makeSettlementConfirmed({
        asOf: "2026-05-13T10:05:00.000Z",
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:tomas:settlement" },
        citations: ["D-FX-CLS-MEMBERSHIP"],
        payload: { ...baseSettlementConfirmedPayload, citations: [] },
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Full 6-event FX Spot lifecycle — scenario 06
// ---------------------------------------------------------------------------

describe("Scenario 06 — full 6-event FX Spot lifecycle", () => {
  it("builds all 6 events with correct types in order", () => {
    const events = buildFxSpotScenarioEvents();
    expect(events.all.length).toBe(6);
    expect(events.all[0]?.type).toBe("FxTradeExecuted");
    expect(events.all[1]?.type).toBe("FxSettlementInstructed");
    expect(events.all[2]?.type).toBe("FxSettlementInstructed");
    expect(events.all[3]?.type).toBe("PrincipalPayment");
    expect(events.all[4]?.type).toBe("PrincipalPayment");
    expect(events.all[5]?.type).toBe("SettlementConfirmed");
  });

  it("all 6 events carry the simulated provenance tag", () => {
    const events = buildFxSpotScenarioEvents();
    for (const e of events.all) {
      expect(e.provenance?.kind).toBe("simulated");
    }
  });

  it("PrincipalPayment events carry correct legKind (deliver then receive)", () => {
    const events = buildFxSpotScenarioEvents();
    const zarPayment = events.zarPrincipalPayment;
    const usdPayment = events.usdPrincipalPayment;
    expect((zarPayment.payload as { legKind: string }).legKind).toBe("deliver");
    expect((usdPayment.payload as { legKind: string }).legKind).toBe("receive");
  });

  it("SettlementConfirmed references the correct tradeId", () => {
    const events = buildFxSpotScenarioEvents();
    const confirmed = events.settlementConfirmed;
    expect((confirmed.payload as { tradeId: string }).tradeId).toBe("TRD-FX-SPOT-M4-001");
  });

  it("runFxSpotScenario stores exactly 6 events and returns ok", () => {
    const result = runFxSpotScenario({
      dbPath: ".local/test-scenario-fx-spot-6events.db",
      cleanup: true,
    });
    expect(result.ok).toBe(true);
    expect(result.emitted).toBe(6);
    expect(result.countsByType.FxTradeExecuted).toBe(1);
    expect(result.countsByType.FxSettlementInstructed).toBe(2);
    expect(result.countsByType.PrincipalPayment).toBe(2);
    expect(result.countsByType.SettlementConfirmed).toBe(1);
  });
});
