// platform/recon/npa-page-no-invented-functionality.test.ts
//
// Coverage for recon:npa-page-no-invented-functionality (D-NPA-PAGE-DE-
// INVENTION). Proves:
//   1. The gate is GREEN against the real baseline fixtures (the page sources
//      all functionality from the real substrate or surfaces it as a gap).
//   2. A FABRICATED posting-rule mapping (a `present` journal row for an event
//      type with no registry entry) trips the gate.
//   3. A FABRICATED dimension event type (a triggeredBy name that is neither
//      registered nor flagged unbacked) trips the gate.
//   4. A FALSE gap (flagging a real registered event type as unbacked) trips
//      the gate.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import type {
  DimensionCard,
  FxLifecycleView,
  ProductDetailView,
  ValuationDomainLens,
} from "../../dashboard/products-detail";
import { assertNoInvention, run } from "./npa-page-no-invented-functionality";

// A minimal ValuationDomainLens with overridable rule/event/gap fields.
function valLens(over: Partial<ValuationDomainLens> = {}): ValuationDomainLens {
  return {
    domain: "general-ledger",
    label: "General Ledger",
    valuationBasis: "",
    feedsReturn: [],
    postingRuleIds: [],
    eventTypes: [],
    models: [],
    citations: [],
    unbacked: { postingRuleIds: [], eventTypes: [] },
    status: "built",
    ...over,
  };
}

// A minimal DimensionCard with overridable trigger/emit + unbacked fields.
function dimCard(over: Partial<DimensionCard> = {}): DimensionCard {
  return {
    dimension: "market-risk",
    label: "Market risk",
    owner: { name: "Test", position: "test" },
    artefactRequired: "",
    failRule: "",
    citationChain: [],
    triggeredBy: [],
    emits: [],
    unbacked: { triggeredBy: [], emits: [] },
    surfacesClientOnboarding: false,
    attestation: { status: "pending" },
    narrative: null,
    narrativeRequested: false,
    chain: {
      policies: [],
      procedures: [],
      functions: [],
      events: [],
    } as unknown as DimensionCard["chain"],
    ...over,
  };
}

// A representative valid FX spot settlement lifecycle block — every event type
// resolves to the registry. Stages a→b→c→d, FX-only.
function fxLifecycleBlock(): FxLifecycleView {
  const link = (field: string) => ({ field, connects: `${field} link`, source: "x.ts" });
  return {
    stages: [
      {
        id: "a",
        label: "Initiation",
        description: "x",
        filStages: ["proposed", "active"],
        eventTypes: ["FxTradeExecuted", "FilInstrumentCreated"],
        ownership: "booking-composite-act",
        ownershipLabel: "Booking / composite act",
        linkingFields: ["originatingEvent", "productId"],
        citations: ["D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL"],
      },
      {
        id: "b",
        label: "Payment",
        description: "x",
        filStages: ["active"],
        eventTypes: ["TradeSettlementExecuted"],
        ownership: "booking-composite-act",
        ownershipLabel: "Booking / composite act",
        linkingFields: ["tradeInstance", "holdingInstance"],
        materialises: {
          eventType: "FilInstrumentCreated",
          assetClass: "cash",
          sign: "-",
          label: "Cash holding −",
          description: "x",
          holdingLink: "holdingInstance",
          originatingLink: "originatingInstrument",
          citations: ["D-CASH-ASSET-CLASS-V1"],
        },
        citations: ["D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL"],
      },
      {
        id: "c",
        label: "Receipt",
        description: "x",
        filStages: ["active", "settled"],
        eventTypes: ["TradeSettlementExecuted"],
        ownership: "booking-composite-act",
        ownershipLabel: "Booking / composite act",
        linkingFields: ["tradeInstance", "holdingInstance"],
        materialises: {
          eventType: "FilInstrumentCreated",
          assetClass: "cash",
          sign: "+",
          label: "Cash holding +",
          description: "x",
          holdingLink: "holdingInstance",
          originatingLink: "originatingInstrument",
          citations: ["D-CASH-ASSET-CLASS-V1"],
        },
        citations: ["D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL"],
      },
      {
        id: "d",
        label: "Termination",
        description: "x",
        filStages: ["settled", "cancelled"],
        eventTypes: ["FilInstrumentTerminated"],
        ownership: "fil-leg-fact",
        ownershipLabel: "FIL-leg fact",
        linkingFields: ["originatingInstrument", "tradeFamily"],
        citations: ["D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL"],
      },
    ],
    ownershipLevels: [
      {
        level: "product-type-governance",
        label: "Product-type governance",
        description: "x",
        representativeEventType: "V2ProductRegistered",
      },
      {
        level: "booking-composite-act",
        label: "Booking / composite act",
        description: "x",
        representativeEventType: "TradeSettlementExecuted",
      },
      {
        level: "fil-leg-fact",
        label: "FIL-leg fact",
        description: "x",
        representativeEventType: "FilInstrumentCreated",
      },
    ],
    links: ["originatingEvent", "productId", "tradeInstance"].map(link),
    authority: ["D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL"],
  };
}

// A minimal ProductDetailView carrying only the fields the gate inspects.
function detailView(over: {
  journalEntries?: ProductDetailView["journalEntries"];
  dimensions?: DimensionCard[];
  valuation?: ValuationDomainLens[];
  family?: string;
  fxLifecycle?: FxLifecycleView;
}): ProductDetailView {
  return {
    journalEntries: over.journalEntries ?? [],
    dimensions: over.dimensions ?? [],
    ...(over.valuation ? { lenses: { valuation: over.valuation } } : {}),
    ...(over.family ? { product: { family: over.family } } : {}),
    ...(over.fxLifecycle ? { fxLifecycle: over.fxLifecycle } : {}),
    // The remaining fields are not inspected by the gate; cast through unknown.
  } as unknown as ProductDetailView;
}

describe("recon:npa-page-no-invented-functionality", () => {
  it("is GREEN against the real baseline fixtures", () => {
    const r = run();
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
    expect(r.asserted).toBeGreaterThan(0);
  });

  it("FAILS on a fabricated posting-rule mapping (present row, no registry entry)", () => {
    const view = detailView({
      journalEntries: [
        {
          eventType: "TotallyInventedEventXYZ",
          status: "present",
          rule: {
            ruleId: "PR-FAKE-999",
            module: "v2-core/posting-rules/registry.ts",
            legs: "invented",
            lifecycleStage: "opening",
            condition: "always",
          },
        },
      ],
    });
    const violations = assertNoInvention("prd:test", ["TotallyInventedEventXYZ"], view);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.message.includes("invented posting rule"))).toBe(true);
  });

  it("FAILS on a fabricated dimension event type that is not gap-surfaced", () => {
    const view = detailView({
      dimensions: [
        dimCard({
          triggeredBy: ["NotARealEventType123"],
          unbacked: { triggeredBy: [], emits: [] },
        }),
      ],
    });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.message.includes("silent invented assertion"))).toBe(true);
  });

  it("PASSES when a fabricated dimension event type IS surfaced as a gap", () => {
    const view = detailView({
      dimensions: [
        dimCard({
          triggeredBy: ["NotARealEventType123"],
          unbacked: { triggeredBy: ["NotARealEventType123"], emits: [] },
        }),
      ],
    });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations).toHaveLength(0);
  });

  it("FAILS on a FALSE gap (a real registered event type flagged unbacked)", () => {
    // FxTradeExecuted is a registered event type — flagging it unbacked is a lie.
    const view = detailView({
      dimensions: [
        dimCard({
          triggeredBy: ["FxTradeExecuted"],
          unbacked: { triggeredBy: ["FxTradeExecuted"], emits: [] },
        }),
      ],
    });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations.some((v) => v.message.includes("false gap"))).toBe(true);
  });

  // ── (D) Five-domain valuation/reporting lenses ──────────────────────────

  it("PASSES a valuation domain whose rule ids / event types all resolve", () => {
    const view = detailView({
      valuation: [
        valLens({
          domain: "general-ledger",
          // PR-FX-001 is a real registry rule id; FxTradeExecuted a real event.
          postingRuleIds: ["PR-FX-001"],
          eventTypes: ["FxTradeExecuted"],
          status: "built",
        }),
      ],
    });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations).toHaveLength(0);
  });

  it("FAILS on a fabricated valuation posting-rule id not gap-surfaced", () => {
    const view = detailView({
      valuation: [valLens({ postingRuleIds: ["PR-FAKE-999"] })],
    });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations.some((v) => v.message.includes("fabricated rule id"))).toBe(true);
  });

  it("PASSES when a fabricated valuation rule id IS surfaced as unbacked", () => {
    const view = detailView({
      valuation: [
        valLens({
          postingRuleIds: ["PR-FAKE-999"],
          unbacked: { postingRuleIds: ["PR-FAKE-999"], eventTypes: [] },
        }),
      ],
    });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations).toHaveLength(0);
  });

  it("FAILS on a FALSE valuation gap (a real registry rule id flagged unbacked)", () => {
    const view = detailView({
      valuation: [
        valLens({
          unbacked: { postingRuleIds: ["PR-FX-001"], eventTypes: [] },
        }),
      ],
    });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations.some((v) => v.message.includes("false gap"))).toBe(true);
  });

  it("FAILS on a fabricated valuation event type not gap-surfaced", () => {
    const view = detailView({
      valuation: [valLens({ eventTypes: ["NotARealEventType123"] })],
    });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations.some((v) => v.message.includes("silent invented assertion"))).toBe(true);
  });

  it("FAILS on a planned-with-gap domain carrying no tracked gap (bare planned)", () => {
    const view = detailView({
      valuation: [valLens({ domain: "liquidity-risk", status: "planned-with-gap" })],
    });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations.some((v) => v.message.includes("no backing gap is a silent deferral"))).toBe(
      true,
    );
  });

  it("PASSES a planned-with-gap domain carrying a well-formed tracked gap", () => {
    const view = detailView({
      valuation: [
        valLens({
          domain: "liquidity-risk",
          status: "planned-with-gap",
          gap: {
            gapId: "fx-liquidity-lcr-nsfr-measure",
            title: "No LCR/NSFR projection yet",
            owner: "Treasury / ALM engineer, engineering",
            targetTrigger: "LCR (BA-300) / NSFR projection",
            citations: ["BA-300"],
          },
        }),
      ],
    });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations).toHaveLength(0);
  });

  // ── (E) FX spot settlement lifecycle ────────────────────────────────────

  it("PASSES an FX product whose fxLifecycle event types all resolve", () => {
    const view = detailView({ family: "fx", fxLifecycle: fxLifecycleBlock() });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations).toHaveLength(0);
  });

  it("FAILS on a fabricated fxLifecycle event type (no gap channel)", () => {
    const block = fxLifecycleBlock();
    const broken: FxLifecycleView = {
      ...block,
      stages: block.stages.map((s) =>
        s.id === "b" ? { ...s, eventTypes: ["NotARealSettlementEvent999"] } : s,
      ),
    };
    const view = detailView({ family: "fx", fxLifecycle: broken });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations.some((v) => v.message.includes("invented lifecycle event"))).toBe(true);
  });

  it("FAILS on a fabricated materialised cash-holding event type (Level 3, no gap channel)", () => {
    const block = fxLifecycleBlock();
    const broken: FxLifecycleView = {
      ...block,
      stages: block.stages.map((s) =>
        s.id === "b" && s.materialises
          ? { ...s, materialises: { ...s.materialises, eventType: "NotARealCashCreate999" } }
          : s,
      ),
    };
    const view = detailView({ family: "fx", fxLifecycle: broken });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations.some((v) => v.message.includes("invented Level-3 FIL-leg fact"))).toBe(true);
  });

  it("FAILS on a fabricated ownership-level representative event type", () => {
    const block = fxLifecycleBlock();
    const broken: FxLifecycleView = {
      ...block,
      ownershipLevels: block.ownershipLevels.map((t) =>
        t.level === "fil-leg-fact" ? { ...t, representativeEventType: "NotARealOwnershipEvt999" } : t,
      ),
    };
    const view = detailView({ family: "fx", fxLifecycle: broken });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations.some((v) => v.message.includes("invented ownership-tier event"))).toBe(true);
  });

  it("PASSES with materialised cash holdings on Payment + Receipt (FilInstrumentCreated · cash, −/+)", () => {
    const block = fxLifecycleBlock();
    const payment = block.stages.find((s) => s.id === "b");
    const receipt = block.stages.find((s) => s.id === "c");
    expect(payment?.materialises?.eventType).toBe("FilInstrumentCreated");
    expect(payment?.materialises?.assetClass).toBe("cash");
    expect(payment?.materialises?.sign).toBe("-");
    expect(receipt?.materialises?.sign).toBe("+");
    const view = detailView({ family: "fx", fxLifecycle: block });
    expect(assertNoInvention("prd:test", [], view)).toHaveLength(0);
  });

  it("FAILS when the fxLifecycle stages are not the four ordered stages", () => {
    const block = fxLifecycleBlock();
    const broken: FxLifecycleView = { ...block, stages: block.stages.slice(0, 3) };
    const view = detailView({ family: "fx", fxLifecycle: broken });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations.some((v) => v.subject.endsWith(":fx-lifecycle:stages"))).toBe(true);
  });

  it("FAILS when an FX product carries NO fxLifecycle block", () => {
    const view = detailView({ family: "fx" });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations.some((v) => v.subject.endsWith(":fx-lifecycle:missing"))).toBe(true);
  });

  it("FAILS when a non-FX product carries an fxLifecycle block", () => {
    const view = detailView({ family: "listed-bond", fxLifecycle: fxLifecycleBlock() });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations.some((v) => v.subject.endsWith(":fx-lifecycle:non-fx"))).toBe(true);
  });

  it("does NOT require fxLifecycle on a non-FX product", () => {
    const view = detailView({ family: "listed-bond" });
    const violations = assertNoInvention("prd:test", [], view);
    expect(violations).toHaveLength(0);
  });
});
