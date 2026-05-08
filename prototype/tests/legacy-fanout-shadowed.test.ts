// tests/legacy-fanout-shadowed.test.ts
//
// Unit tests for the LegacyFanoutShadowed event type — introduced for
// D-A22-RETIRE-LEGACY Phase 1 (bus-canonical, legacy-shadow). Asserts:
//   - The factory builds a valid envelope + payload.
//   - The handlerKey regex rejects malformed keys.
//   - The triggeringEventTypes array must be non-empty.
//   - The store accepts the event end-to-end (registry-validated).
//
// Phase 2 deletes both this event type and these tests.
//
// Author: Atlas (D-A22-RETIRE-LEGACY Phase 1)

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001 } from "../platform/core/types";
import { TYPED_EVENT_TYPES, makeLegacyFanoutShadowed } from "../platform/event-store/event-types";
import { lookupEventType } from "../platform/event-store/registry";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";

const SHADOW_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:legacy-fanout-shadow",
};

const PHASE_1_CITATIONS = ["D-A22-RETIRE-LEGACY", "GOV-FRAMEWORK-CEO-RESERVED"];

describe("LegacyFanoutShadowed — factory + payload validation", () => {
  it("builds a valid event with all required payload fields", () => {
    const event = makeLegacyFanoutShadowed({
      asOf: "2026-05-08T12:00:00.000Z",
      entity: BANK_ZA_001,
      actor: SHADOW_ACTOR,
      citations: [...PHASE_1_CITATIONS],
      payload: {
        parentAgent: "atlas",
        parentTrigger: "substrate-state",
        triggeredHandlerKey: "anya:projection-refresh",
        triggeringEventTypes: ["SubstrateStateSnapshot", "WorkstreamRegistered"],
        suppressedAtSequence: 42,
      },
    });

    expect(event.type).toBe("LegacyFanoutShadowed");
    expect(event.actor.id).toBe("agent:atlas:legacy-fanout-shadow");
    expect(event.entity).toBe(BANK_ZA_001);
    expect(event.citations).toContain("D-A22-RETIRE-LEGACY");
    expect((event.payload as Record<string, unknown>).triggeredHandlerKey).toBe(
      "anya:projection-refresh",
    );
    expect((event.payload as Record<string, unknown>).suppressedAtSequence).toBe(42);
  });

  it("rejects a malformed handler key (no colon)", () => {
    expect(() =>
      makeLegacyFanoutShadowed({
        asOf: "2026-05-08T12:00:00.000Z",
        entity: BANK_ZA_001,
        actor: SHADOW_ACTOR,
        citations: [...PHASE_1_CITATIONS],
        payload: {
          parentAgent: "atlas",
          parentTrigger: "substrate-state",
          triggeredHandlerKey: "anyaprojectionrefresh",
          triggeringEventTypes: ["SubstrateStateSnapshot"],
          suppressedAtSequence: 0,
        },
      }),
    ).toThrow();
  });

  it("rejects a handler key with uppercase characters", () => {
    expect(() =>
      makeLegacyFanoutShadowed({
        asOf: "2026-05-08T12:00:00.000Z",
        entity: BANK_ZA_001,
        actor: SHADOW_ACTOR,
        citations: [...PHASE_1_CITATIONS],
        payload: {
          parentAgent: "atlas",
          parentTrigger: "substrate-state",
          triggeredHandlerKey: "Anya:projection-refresh",
          triggeringEventTypes: ["SubstrateStateSnapshot"],
          suppressedAtSequence: 0,
        },
      }),
    ).toThrow();
  });

  it("rejects an empty triggeringEventTypes array", () => {
    expect(() =>
      makeLegacyFanoutShadowed({
        asOf: "2026-05-08T12:00:00.000Z",
        entity: BANK_ZA_001,
        actor: SHADOW_ACTOR,
        citations: [...PHASE_1_CITATIONS],
        payload: {
          parentAgent: "atlas",
          parentTrigger: "substrate-state",
          triggeredHandlerKey: "anya:projection-refresh",
          triggeringEventTypes: [],
          suppressedAtSequence: 0,
        },
      }),
    ).toThrow();
  });

  it("rejects a negative suppressedAtSequence", () => {
    expect(() =>
      makeLegacyFanoutShadowed({
        asOf: "2026-05-08T12:00:00.000Z",
        entity: BANK_ZA_001,
        actor: SHADOW_ACTOR,
        citations: [...PHASE_1_CITATIONS],
        payload: {
          parentAgent: "atlas",
          parentTrigger: "substrate-state",
          triggeredHandlerKey: "anya:projection-refresh",
          triggeringEventTypes: ["SubstrateStateSnapshot"],
          suppressedAtSequence: -1,
        },
      }),
    ).toThrow();
  });
});

describe("LegacyFanoutShadowed — registry registration", () => {
  it("appears in the TYPED_EVENT_TYPES list", () => {
    expect(TYPED_EVENT_TYPES).toContain("LegacyFanoutShadowed");
  });

  it("is registered in the event-type registry as a runtime event", () => {
    const meta = lookupEventType("LegacyFanoutShadowed");
    expect(meta).toBeDefined();
    expect(meta?.class).toBe("runtime");
    expect(meta?.replay).toBe("append-only-audit");
    expect(meta?.payloadSchema).toBeDefined();
    expect(meta?.subscribers).toContain("Atlas");
    expect(meta?.subscribers).toContain("Vera");
  });
});

describe("LegacyFanoutShadowed — event store end-to-end", () => {
  it("appends and replays a LegacyFanoutShadowed event from an in-memory store", () => {
    const store = new EventStore(":memory:");
    try {
      const event = makeLegacyFanoutShadowed({
        asOf: "2026-05-08T12:00:00.000Z",
        entity: BANK_ZA_001,
        actor: SHADOW_ACTOR,
        citations: [...PHASE_1_CITATIONS],
        payload: {
          parentAgent: "scrooge",
          parentTrigger: "ceo-decision-record",
          triggeredHandlerKey: "scrooge:follow-on-router",
          triggeringEventTypes: ["CeoDecision"],
          suppressedAtSequence: 0,
        },
      });
      store.append(event);

      const out: (typeof event)[] = [];
      for (const e of store.replay({ type: "LegacyFanoutShadowed" })) {
        out.push(e);
      }
      expect(out.length).toBe(1);
      expect(out[0]?.type).toBe("LegacyFanoutShadowed");
      const payload = out[0]?.payload as Record<string, unknown>;
      expect(payload.triggeredHandlerKey).toBe("scrooge:follow-on-router");
      expect(payload.triggeringEventTypes).toEqual(["CeoDecision"]);
    } finally {
      store.close();
    }
  });
});
