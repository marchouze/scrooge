// platform/recon/posting-engine-single-subscriber.test.ts
//
// Tests for the posting-engine single-subscriber recon pipeline.
//
// The canonical seed test reconstructs the pre-#1095 topology — two production
// callables (bea:gl-posting-engine + the retired bea:fx-posting-engine) both
// emitting SubLedgerPostingEmitted over the same four FX event types — and
// asserts the gate FAILS with one violation per shared event type. The
// post-#1095 single-emitter topology asserts green.
//
// Authority: D-SLA-ENGINE-RULES-AS-DATA (WS-SLA-FULL-RETIREMENT).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { type MetadataInput, type RunOpts, run } from "./posting-engine-single-subscriber";

// The four FX event types both engines subscribed to pre-#1095.
const FX_EVENTS = [
  "FxTradeExecuted",
  "FxPositionRevalued",
  "TradeMatured",
  "FxTradeCancelled",
] as const;

const FX_POSTING_TYPE: Readonly<Record<string, string>> = {
  FxTradeExecuted: "trade-booking",
  FxPositionRevalued: "revaluation",
  FxTradeCancelled: "cancellation",
};

function opts(over: Partial<RunOpts>): RunOpts {
  return {
    // Default: both callables registered, both emit, both declare the FX map.
    callableKeys: ["bea:gl-posting-engine", "bea:fx-posting-engine"],
    emits: () => true,
    postingTypeMap: () => FX_POSTING_TYPE,
    ...over,
  };
}

describe("posting-engine-single-subscriber", () => {
  it("FAILS on the pre-#1095 double-subscription (two emitters share FX event types)", () => {
    const metadata: MetadataInput[] = [
      {
        key: "bea:gl-posting-engine",
        agent: "Bea",
        trigger: "gl-posting-engine",
        subscribesTo: FX_EVENTS,
      },
      {
        key: "bea:fx-posting-engine",
        agent: "Bea",
        trigger: "fx-posting-engine",
        subscribesTo: FX_EVENTS,
      },
    ];
    const r = run(opts({ metadata }));
    expect(r.ok).toBe(false);
    // Check (1): one violation per shared event type (4).
    const eventViolations = r.violations.filter((v) => FX_EVENTS.includes(v.subject as never));
    expect(eventViolations.length).toBe(FX_EVENTS.length);
    expect(eventViolations.every((v) => v.severity === "fail")).toBe(true);
    // Check (2): one violation per declared (event → postingType) pair (3).
    const pairViolations = r.violations.filter((v) => v.subject.includes(" → "));
    expect(pairViolations.length).toBe(Object.keys(FX_POSTING_TYPE).length);
  });

  it("PASSES the post-#1095 topology (single FX emitter)", () => {
    const metadata: MetadataInput[] = [
      {
        key: "bea:gl-posting-engine",
        agent: "Bea",
        trigger: "gl-posting-engine",
        subscribesTo: FX_EVENTS,
      },
    ];
    const r = run(opts({ metadata, callableKeys: ["bea:gl-posting-engine"] }));
    expect(r.ok).toBe(true);
    expect(r.violations.length).toBe(0);
    // Still asserts something — 4 event types + 3 declared pairs.
    expect(r.asserted).toBe(FX_EVENTS.length + Object.keys(FX_POSTING_TYPE).length);
  });

  it("ignores a second subscriber that does NOT emit postings (no false positive)", () => {
    const metadata: MetadataInput[] = [
      {
        key: "bea:gl-posting-engine",
        agent: "Bea",
        trigger: "gl-posting-engine",
        subscribesTo: FX_EVENTS,
      },
      // A non-emitting observer on the same events (e.g. a surveillance handler).
      {
        key: "iris:trade-surveillance",
        agent: "Iris",
        trigger: "trade-surveillance",
        subscribesTo: FX_EVENTS,
      },
    ];
    const r = run(
      opts({
        metadata,
        callableKeys: ["bea:gl-posting-engine", "iris:trade-surveillance"],
        emits: (key) => key === "bea:gl-posting-engine",
      }),
    );
    expect(r.ok).toBe(true);
  });

  it("ignores an emitter that is NOT a registered callable (dead/legacy surface)", () => {
    const metadata: MetadataInput[] = [
      {
        key: "bea:gl-posting-engine",
        agent: "Bea",
        trigger: "gl-posting-engine",
        subscribesTo: FX_EVENTS,
      },
      {
        key: "bea:fx-posting-engine",
        agent: "Bea",
        trigger: "fx-posting-engine",
        subscribesTo: FX_EVENTS,
      },
    ];
    const r = run(
      opts({
        metadata,
        // fx-posting-engine emits but is no longer registered → out of scope.
        callableKeys: ["bea:gl-posting-engine"],
      }),
    );
    expect(r.ok).toBe(true);
  });

  it("passes green on the real current-main topology", () => {
    // No overrides — reads the live HANDLER_CALLABLES + HANDLERS_METADATA and
    // the real static scan. This is the seeded passing baseline (deliverable 4).
    const r = run();
    expect(r.ok).toBe(true);
    expect(r.asserted).toBeGreaterThan(0);
  });
});
