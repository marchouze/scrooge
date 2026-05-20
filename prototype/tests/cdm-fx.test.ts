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
  makeNdfFixingObserved,
  makePrincipalPayment,
  makeSettlementConfirmed,
  ndfFixingObservedPayloadSchema,
  principalPaymentPayloadSchema,
  settlementConfirmedPayloadSchema,
} from "../platform/markets/cdm";
import { buildFxSpotScenarioEvents, runFxSpotScenario } from "../scenarios/06-fx-spot-trade";
import {
  buildFxForwardScenarioEvents,
  buildNdfForwardScenarioEvents,
  runFxForwardScenario,
  runNdfForwardScenario,
} from "../scenarios/07-fx-forward-trade";

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
  // No-prop attribution — exactly one of clientFlowRef / hedgeProgrammeRef
  // required per the FxTradeExecuted refinement (G-3 close, no-prop invariant).
  clientFlowRef: "client-trade:NK-2026-05-20-00001",
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

// ---------------------------------------------------------------------------
// G-3 close — no-prop attribution invariant.
//
// Helena (Chief Risk Officer, governance) FX-spot-only market-risk scope
// review (2026-05-20) §6 gap G-3 + D-MARKETS-SCHEMA-FOUNDATION +
// Policies/trading-mandate-v1.md §5.
// ---------------------------------------------------------------------------

describe("FxTradeExecuted — no-prop attribution (G-3)", () => {
  it("accepts a trade carrying only clientFlowRef (client-driven path)", () => {
    const trade = {
      ...baseSpotPayload,
      clientFlowRef: "client-trade:NK-2026-05-20-00041",
      hedgeProgrammeRef: undefined,
    };
    expect(() => fxTradeExecutedPayloadSchema.parse(trade)).not.toThrow();
  });

  it("accepts a trade carrying only hedgeProgrammeRef (sanctioned-hedge path)", () => {
    const trade = {
      ...baseSpotPayload,
      clientFlowRef: undefined,
      hedgeProgrammeRef: "hedge-programme:fx-translation-zar-usd-2026Q2",
    };
    expect(() => fxTradeExecutedPayloadSchema.parse(trade)).not.toThrow();
  });

  it("rejects a trade with neither clientFlowRef nor hedgeProgrammeRef", () => {
    const { clientFlowRef, hedgeProgrammeRef, ...trade } = baseSpotPayload as typeof baseSpotPayload & {
      clientFlowRef?: string;
      hedgeProgrammeRef?: string;
    };
    void clientFlowRef;
    void hedgeProgrammeRef;
    const result = fxTradeExecutedPayloadSchema.safeParse(trade);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("no-prop"))).toBe(true);
    }
  });

  it("rejects a trade carrying both clientFlowRef and hedgeProgrammeRef", () => {
    const trade = {
      ...baseSpotPayload,
      clientFlowRef: "client-trade:NK-2026-05-20-00041",
      hedgeProgrammeRef: "hedge-programme:fx-translation-zar-usd-2026Q2",
    };
    const result = fxTradeExecutedPayloadSchema.safeParse(trade);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("not both"))).toBe(true);
    }
  });

  it("rejects an empty clientFlowRef (min length 1)", () => {
    const trade = {
      ...baseSpotPayload,
      clientFlowRef: "",
      hedgeProgrammeRef: undefined,
    };
    expect(() => fxTradeExecutedPayloadSchema.parse(trade)).toThrow();
  });

  it("rejects an empty hedgeProgrammeRef (min length 1)", () => {
    const trade = {
      ...baseSpotPayload,
      clientFlowRef: undefined,
      hedgeProgrammeRef: "",
    };
    expect(() => fxTradeExecutedPayloadSchema.parse(trade)).toThrow();
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
    expect(FX_EVENT_TYPES).toContain("NdfFixingObserved");
    expect(FX_EVENT_TYPES.length).toBe(5);
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

  it("runFxSpotScenario stores trade lifecycle events and message events, returns ok", () => {
    const result = runFxSpotScenario({
      dbPath: ".local/test-scenario-fx-spot-6events.db",
      cleanup: true,
    });
    expect(result.ok).toBe(true);
    // 6 trade lifecycle + 1 OutboundMessageDispatched + 5 InboundMessageReceived
    // + 5 MessageCorrelated = 17 events total (D-FX-MESSAGE-EVENTS).
    expect(result.emitted).toBe(17);
    expect(result.countsByType.FxTradeExecuted).toBe(1);
    expect(result.countsByType.FxSettlementInstructed).toBe(2);
    expect(result.countsByType.PrincipalPayment).toBe(2);
    expect(result.countsByType.SettlementConfirmed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// NdfFixingObserved — schema validation + citation enforcement
// ---------------------------------------------------------------------------

const baseNdfFixingPayload = {
  tradeId: "TRD-FX-NDF-TEST-001",
  currencyPair: "USD/ZAR",
  fixingSource: "SARB-ZAR-Fixing-1600-SAST",
  fixingDate: "2026-08-10",
  fixingRate: 18.97,
  contractRate: 18.7,
  settlementCurrency: "USD",
  netCashMinor: 71_165_00,
  settlementDate: "2026-08-12",
  citations: ["D-FX-AD-STATUS", "ORG-EXCON-ODP-001"],
};

describe("NdfFixingObserved — schema + envelope", () => {
  it("accepts a valid NDF fixing payload", () => {
    expect(() => ndfFixingObservedPayloadSchema.parse(baseNdfFixingPayload)).not.toThrow();
  });

  it("envelopes a valid fixing and stamps event_id + type", () => {
    const e = makeNdfFixingObserved({
      asOf: "2026-08-10T16:00:00.000Z",
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:saskia:ndf-fixing" },
      citations: ["D-FX-AD-STATUS"],
      payload: baseNdfFixingPayload,
    });
    expect(e.type).toBe("NdfFixingObserved");
    expect(e.event_id).toBeDefined();
  });

  it("rejects empty envelope citations (Principle 2)", () => {
    expect(() =>
      makeNdfFixingObserved({
        asOf: "2026-08-10T16:00:00.000Z",
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:saskia:ndf-fixing" },
        citations: [],
        payload: baseNdfFixingPayload,
      }),
    ).toThrow();
  });

  it("rejects empty payload citations (Principle 2)", () => {
    expect(() =>
      makeNdfFixingObserved({
        asOf: "2026-08-10T16:00:00.000Z",
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:saskia:ndf-fixing" },
        citations: ["D-FX-AD-STATUS"],
        payload: { ...baseNdfFixingPayload, citations: [] },
      }),
    ).toThrow();
  });

  it("rejects invalid settlementCurrency (must be 3-letter ISO)", () => {
    expect(() =>
      ndfFixingObservedPayloadSchema.parse({
        ...baseNdfFixingPayload,
        settlementCurrency: "us",
      }),
    ).toThrow();
  });

  it("rejects non-positive fixingRate", () => {
    expect(() =>
      ndfFixingObservedPayloadSchema.parse({ ...baseNdfFixingPayload, fixingRate: 0 }),
    ).toThrow();
  });

  it("registry exposes NdfFixingObserved in FX_EVENT_TYPES", () => {
    expect(FX_EVENT_TYPES).toContain("NdfFixingObserved");
    expect(FX_EVENT_TYPES.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Scenario 07 — FX Forward lifecycle (deliverable + NDF variant)
// ---------------------------------------------------------------------------

describe("Scenario 07 — FX Forward deliverable lifecycle", () => {
  it("builds 8 events (trade + 2 settle-instruct + 2 MtM ticks + 2 principal + confirm)", () => {
    const events = buildFxForwardScenarioEvents();
    expect(events.all.length).toBe(8);
    expect(events.all[0]?.type).toBe("FxTradeExecuted");
    expect(events.all[1]?.type).toBe("FxSettlementInstructed");
    expect(events.all[2]?.type).toBe("FxSettlementInstructed");
    expect(events.all[3]?.type).toBe("FxPositionRevalued");
    expect(events.all[4]?.type).toBe("FxPositionRevalued");
    expect(events.all[5]?.type).toBe("PrincipalPayment");
    expect(events.all[6]?.type).toBe("PrincipalPayment");
    expect(events.all[7]?.type).toBe("SettlementConfirmed");
  });

  it("trade carries productTaxonomy = FX-forward and bookType = trading", () => {
    const events = buildFxForwardScenarioEvents();
    const payload = events.trade.payload as {
      productTaxonomy: string;
      bookType: string;
    };
    expect(payload.productTaxonomy).toBe("FX-forward");
    expect(payload.bookType).toBe("trading");
  });

  it("MtM revaluation ticks emit positive unrealised P&L deltas (forward ITM)", () => {
    const events = buildFxForwardScenarioEvents();
    const tick1 = events.revalTick1.payload as { unrealisedPnlZarMinor: number };
    const tick2 = events.revalTick2.payload as { unrealisedPnlZarMinor: number };
    expect(tick1.unrealisedPnlZarMinor).toBeGreaterThan(0);
    expect(tick2.unrealisedPnlZarMinor).toBeGreaterThan(0);
    // Tick 2 should be larger (rate moved further from book)
    expect(tick2.unrealisedPnlZarMinor).toBeGreaterThan(tick1.unrealisedPnlZarMinor);
  });

  it("all events carry simulated provenance", () => {
    const events = buildFxForwardScenarioEvents();
    for (const e of events.all) {
      expect(e.provenance?.kind).toBe("simulated");
    }
  });

  it("runFxForwardScenario stores 8 events and returns ok", () => {
    const result = runFxForwardScenario({
      dbPath: ".local/test-scenario-fx-forward.db",
      cleanup: true,
    });
    expect(result.ok).toBe(true);
    expect(result.emitted).toBe(8);
    expect(result.countsByType.FxTradeExecuted).toBe(1);
    expect(result.countsByType.FxSettlementInstructed).toBe(2);
    expect(result.countsByType.FxPositionRevalued).toBe(2);
    expect(result.countsByType.PrincipalPayment).toBe(2);
    expect(result.countsByType.SettlementConfirmed).toBe(1);
  });
});

describe("Scenario 07 — NDF variant (fixing replaces gross-principal exchange)", () => {
  it("builds 2 events (trade + fixing) — no PrincipalPayment legs", () => {
    const events = buildNdfForwardScenarioEvents();
    expect(events.all.length).toBe(2);
    expect(events.all[0]?.type).toBe("FxTradeExecuted");
    expect(events.all[1]?.type).toBe("NdfFixingObserved");
  });

  it("NDF trade carries settlementForm = cash + fixing source", () => {
    const events = buildNdfForwardScenarioEvents();
    const payload = events.trade.payload as {
      productTaxonomy: string;
      settlementForm: string;
      ndfFixingSource?: string;
      ndfSettlementCurrency?: string;
    };
    expect(payload.productTaxonomy).toBe("NDF");
    expect(payload.settlementForm).toBe("cash");
    expect(payload.ndfFixingSource).toBe("SARB-ZAR-Fixing-1600-SAST");
    expect(payload.ndfSettlementCurrency).toBe("USD");
  });

  it("fixing event computes positive net cash (forward ITM at fixing)", () => {
    const events = buildNdfForwardScenarioEvents();
    const fixing = events.fixing.payload as { netCashMinor: number; fixingRate: number };
    // Fixing rate (18.97) > contract rate (18.70) and bank bought USD → ITM
    expect(fixing.netCashMinor).toBeGreaterThan(0);
    expect(fixing.fixingRate).toBe(18.97);
  });

  it("runNdfForwardScenario stores 2 events and returns ok", () => {
    const result = runNdfForwardScenario({
      dbPath: ".local/test-scenario-fx-forward-ndf.db",
      cleanup: true,
    });
    expect(result.ok).toBe(true);
    expect(result.emitted).toBe(2);
    expect(result.countsByType.FxTradeExecuted).toBe(1);
    expect(result.countsByType.NdfFixingObserved).toBe(1);
  });
});
