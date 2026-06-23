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

import type { DimensionCard, ProductDetailView } from "../../dashboard/products-detail";
import { assertNoInvention, run } from "./npa-page-no-invented-functionality";

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

// A minimal ProductDetailView carrying only the fields the gate inspects.
function detailView(over: {
  journalEntries?: ProductDetailView["journalEntries"];
  dimensions?: DimensionCard[];
}): ProductDetailView {
  return {
    journalEntries: over.journalEntries ?? [],
    dimensions: over.dimensions ?? [],
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
});
