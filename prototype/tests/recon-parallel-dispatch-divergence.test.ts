// tests/recon-parallel-dispatch-divergence.test.ts
//
// Unit tests for Vera Wave-4 #13b — parallel-dispatch-divergence recon
// pipeline. Validates the gating logic for D-A22-RETIRE-LEGACY
// (Atlas A2.2 dispatcher cutover spec).
//
// Coverage:
//   - empty-store sentinel: ok with info-severity row
//   - empty-pair-streams sentinel (pre-Phase 1): warn, ok=true
//   - one-sided coverage (bus-only or shadow-only): warn pre-window;
//     fail post-window
//   - symmetric coverage with no divergence: ok, no violations
//   - divergence (bus pair without shadow match): warn pre-window;
//     fail post-window
//   - dedup race (two BusDispatched ok rows on the same pair): fail
//     unconditionally (no sample-window discount)
//   - bus-attributable integrity alert: fail unconditionally (G3)
//
// Author: Vera

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001, newEventId } from "../platform/core/types";
import type { Event } from "../platform/event-store/types";
import { run as parallelDispatchDivergence } from "../platform/recon/parallel-dispatch-divergence";

const ENTITY = BANK_ZA_001;
const CITATIONS = ["D-A22-RETIRE-LEGACY", "GOV-FRAMEWORK-CEO-RESERVED"];

const BUS_ACTOR = { type: "service" as const, id: "agent:atlas:event-trigger-bus" };
const TEST_ACTOR = { type: "service" as const, id: "agent:test:source" };

/** Build a synthetic `BusDispatched` event for the recon. */
function busDispatched(args: {
  eventId: string;
  handlerKey: string;
  outcome?: "ok" | "failed";
  asOf: string;
}): Event {
  return {
    event_id: newEventId(),
    type: "BusDispatched",
    as_of: args.asOf,
    entity: ENTITY,
    actor: BUS_ACTOR,
    citations: [...CITATIONS],
    payload: {
      eventId: args.eventId,
      eventType: "WorkstreamRegistered",
      handlerKey: args.handlerKey,
      dispatchedAt: args.asOf,
      outcome: args.outcome ?? "ok",
    },
  };
}

/** Build a synthetic `LegacyFanoutShadowed` event for the recon. */
function legacyShadowed(args: {
  eventId: string;
  handlerKey: string;
  asOf: string;
}): Event {
  return {
    event_id: newEventId(),
    type: "LegacyFanoutShadowed",
    as_of: args.asOf,
    entity: ENTITY,
    actor: { type: "service", id: "agent:atlas:legacy-fanout-shadow" },
    citations: [...CITATIONS],
    payload: {
      eventId: args.eventId,
      parentAgent: "Anya",
      parentTrigger: "projection-refresh",
      triggeredHandlerKey: args.handlerKey,
      triggeringEventTypes: ["WorkstreamRegistered"],
      suppressedAtSequence: 1,
    },
  };
}

/** Build a synthetic bus-attributable integrity alert. */
function busIntegrityAlert(asOf: string): Event {
  return {
    event_id: newEventId(),
    type: "SubstrateAlert",
    as_of: asOf,
    entity: ENTITY,
    actor: BUS_ACTOR,
    citations: [...CITATIONS],
    payload: {
      alertId: "alert:integrity:bus-test",
      alertClass: "integrity",
      agentUrn: "agent:anya",
      details: "synthetic integrity alert for test",
      severity: "high",
    },
  };
}

/** Build an unrelated WorkstreamRegistered event (proves non-bus events are ignored). */
function unrelatedEvent(asOf: string): Event {
  return {
    event_id: newEventId(),
    type: "WorkstreamRegistered",
    as_of: asOf,
    entity: ENTITY,
    actor: TEST_ACTOR,
    citations: [...CITATIONS],
    payload: {
      workstreamId: `workstream:test-${newEventId()}`,
      title: "Test workstream",
      owner: "Atlas",
      status: "planned",
      summary: "Synthetic.",
    },
  };
}

const NOW = "2026-05-12T00:00:00.000Z";
// Pre-window: events emitted ~1 hour before NOW (well below the 3-day floor).
const T_PRE_WINDOW = "2026-05-11T23:00:00.000Z";
// Post-window: events emitted ~4 days before NOW (above the floor).
const T_POST_WINDOW = "2026-05-08T00:00:00.000Z";

describe("parallel-dispatch-divergence pipeline (Vera Wave-4 #13b)", () => {
  it("returns ok with info-severity row when the event store path does not exist", () => {
    const r = parallelDispatchDivergence({
      dbPath: "/tmp/bank-recon-pdd-nonexistent.db",
      now: NOW,
    });
    expect(r.pipeline).toBe("parallel-dispatch-divergence");
    expect(r.ok).toBe(true);
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("info");
  });

  it("returns warn (ok=true) when both pair streams are empty (pre-Phase 1)", () => {
    const r = parallelDispatchDivergence({
      events: [unrelatedEvent(T_PRE_WINDOW)],
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.subject).toBe("pair-stream");
  });

  it("returns ok with no violations when bus and shadow streams agree on every pair", () => {
    const eventA = "ev-aaa";
    const eventB = "ev-bbb";
    const handler = "anya:projection-refresh";
    const events: Event[] = [
      busDispatched({ eventId: eventA, handlerKey: handler, asOf: T_POST_WINDOW }),
      busDispatched({ eventId: eventB, handlerKey: handler, asOf: T_POST_WINDOW }),
      legacyShadowed({ eventId: eventA, handlerKey: handler, asOf: T_POST_WINDOW }),
      legacyShadowed({ eventId: eventB, handlerKey: handler, asOf: T_POST_WINDOW }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.violations.filter((v) => v.severity === "warn")).toEqual([]);
    // 4 symmetric-coverage assertions (2 bus-side + 2 shadow-side) +
    // 1 dedup-race assertion per ok-pair (2) + 1 G3 assertion = 7.
    expect(r.asserted).toBeGreaterThanOrEqual(5);
  });

  it("flags one-sided bus coverage (no shadow events) at warn severity", () => {
    const events: Event[] = [
      busDispatched({
        eventId: "ev-aaa",
        handlerKey: "anya:projection-refresh",
        asOf: T_PRE_WINDOW,
      }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.subject === "shadow-stream" && v.severity === "warn")).toBe(
      true,
    );
  });

  it("flags one-sided shadow coverage at fail severity post-window", () => {
    const events: Event[] = [
      legacyShadowed({
        eventId: "ev-aaa",
        handlerKey: "anya:projection-refresh",
        asOf: T_POST_WINDOW,
      }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject === "bus-stream" && v.severity === "fail")).toBe(
      true,
    );
  });

  it("flags one-sided shadow coverage at warn severity pre-window", () => {
    const events: Event[] = [
      legacyShadowed({
        eventId: "ev-aaa",
        handlerKey: "anya:projection-refresh",
        asOf: T_PRE_WINDOW,
      }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.subject === "bus-stream" && v.severity === "warn")).toBe(
      true,
    );
  });

  it("flags genuine pair-level divergence at warn severity pre-window", () => {
    // Shared triggering event `ev-shared` with TWO subscriber handlers. The
    // bus dispatched both (`anya` + `linnea`); the shadow only recorded
    // `anya`. Because `ev-shared` IS in the shadow eventId set, the bus pair
    // for `linnea` is a NON-cascade A.1 divergence (genuine missing shadow),
    // and `anya` matches both ways. This is a true G1 divergence, not a
    // cascade exclusion. Pre-window → warn, ok stays true.
    const events: Event[] = [
      busDispatched({
        eventId: "ev-shared",
        handlerKey: "anya:projection-refresh",
        asOf: T_PRE_WINDOW,
      }),
      busDispatched({
        eventId: "ev-shared",
        handlerKey: "linnea:event-triage",
        asOf: T_PRE_WINDOW,
      }),
      legacyShadowed({
        eventId: "ev-shared",
        handlerKey: "anya:projection-refresh",
        asOf: T_PRE_WINDOW,
      }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    // Pre-window (measured from the epoch = ev-shadow as_of): divergence warn.
    expect(r.ok).toBe(true);
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(warns.some((v) => v.subject === "ev-shared|linnea:event-triage")).toBe(true);
    // No cascade exclusion should fire (the bus event IS in the shadow set).
    expect(r.violations.some((v) => v.subject === "cascade-dispatches")).toBe(false);
  });

  it("escalates genuine pair-level divergence to fail severity post-window", () => {
    const events: Event[] = [
      busDispatched({
        eventId: "ev-shared",
        handlerKey: "anya:projection-refresh",
        asOf: T_POST_WINDOW,
      }),
      busDispatched({
        eventId: "ev-shared",
        handlerKey: "linnea:event-triage",
        asOf: T_POST_WINDOW,
      }),
      legacyShadowed({
        eventId: "ev-shared",
        handlerKey: "anya:projection-refresh",
        asOf: T_POST_WINDOW,
      }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails.some((v) => v.subject === "ev-shared|linnea:event-triage")).toBe(true);
    expect(fails.every((v) => v.message.includes("Divergence") || v.subject === "bus-stream")).toBe(
      true,
    );
  });

  it("flags a dedup race at fail severity regardless of sample window", () => {
    // Two BusDispatched{ok} rows on the same (eventId, handlerKey) pair —
    // F2 violation. Pre-window timing must NOT discount this.
    const eventA = "ev-aaa";
    const handler = "anya:projection-refresh";
    const events: Event[] = [
      busDispatched({ eventId: eventA, handlerKey: handler, asOf: T_PRE_WINDOW }),
      busDispatched({ eventId: eventA, handlerKey: handler, asOf: T_PRE_WINDOW }),
      legacyShadowed({ eventId: eventA, handlerKey: handler, asOf: T_PRE_WINDOW }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.severity === "fail" && v.message.includes("Dedup race")),
    ).toBe(true);
  });

  it("flags bus-attributable integrity alerts at fail severity (G3)", () => {
    const events: Event[] = [
      busIntegrityAlert(T_PRE_WINDOW),
      busDispatched({
        eventId: "ev-aaa",
        handlerKey: "anya:projection-refresh",
        asOf: T_PRE_WINDOW,
      }),
      legacyShadowed({
        eventId: "ev-aaa",
        handlerKey: "anya:projection-refresh",
        asOf: T_PRE_WINDOW,
      }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "agent:atlas:event-trigger-bus" &&
          v.message.includes("integrity"),
      ),
    ).toBe(true);
  });

  it("ignores SubstrateAlert events from non-bus actors", () => {
    // An integrity alert from another agent must NOT trip the bus-G3
    // assertion (only bus actor counts).
    const nonBusAlert: Event = {
      event_id: newEventId(),
      type: "SubstrateAlert",
      as_of: T_PRE_WINDOW,
      entity: ENTITY,
      actor: { type: "service", id: "agent:scheduler:tick" },
      citations: [...CITATIONS],
      payload: {
        alertId: "alert:integrity:scheduler-test",
        alertClass: "integrity",
        details: "synthetic non-bus alert",
        severity: "high",
      },
    };
    const events: Event[] = [
      nonBusAlert,
      busDispatched({
        eventId: "ev-aaa",
        handlerKey: "anya:projection-refresh",
        asOf: T_PRE_WINDOW,
      }),
      legacyShadowed({
        eventId: "ev-aaa",
        handlerKey: "anya:projection-refresh",
        asOf: T_PRE_WINDOW,
      }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.subject === "agent:atlas:event-trigger-bus")).toBe(false);
  });

  it("respects a custom gatingWindowMs override (tests can pin the floor)", () => {
    // A real-id shadow event (ev-bbb) establishes the protocol epoch at
    // T_PRE_WINDOW; a post-epoch shadow pair has no matching bus pair (A.2
    // divergence). With the default window it would be warn (epoch is only
    // ~1h old); the 1ms override forces the window met → fail.
    const events: Event[] = [
      busDispatched({
        eventId: "ev-aaa",
        handlerKey: "anya:projection-refresh",
        asOf: T_PRE_WINDOW,
      }),
      legacyShadowed({
        eventId: "ev-bbb",
        handlerKey: "anya:projection-refresh",
        asOf: T_PRE_WINDOW,
      }),
    ];
    const r = parallelDispatchDivergence({
      events,
      now: NOW,
      gatingWindowMs: 1,
    });
    // Window forced met → the A.2 shadow-side divergence escalates to fail.
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.subject === "ev-bbb|anya:projection-refresh" && v.severity === "fail",
      ),
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // A22 Phase-1 real-id epoch boundary + cascade-topology (option b).
  // -------------------------------------------------------------------------

  it("preserves pre-protocol warn behaviour when only seq:N shadow events exist", () => {
    // Mirrors the production store before the real-id emitter: many bus rows
    // + many seq:N (no real eventId) shadow rows. Epoch is undefined → G1 is
    // not evaluable → single shadow-stream warn, ok=true. The stale baseline
    // must NOT flip the gate to fail.
    const seqShadow = (handlerKey: string, seq: number, asOf: string): Event => ({
      event_id: newEventId(),
      type: "LegacyFanoutShadowed",
      as_of: asOf,
      entity: ENTITY,
      actor: { type: "service", id: "agent:atlas:legacy-fanout-shadow" },
      citations: [...CITATIONS],
      payload: {
        // NOTE: no `eventId` field — pre-protocol shadow event.
        parentAgent: "Anya",
        parentTrigger: "projection-refresh",
        triggeredHandlerKey: handlerKey,
        triggeringEventTypes: ["WorkstreamRegistered"],
        suppressedAtSequence: seq,
      },
    });
    const events: Event[] = [
      busDispatched({
        eventId: "ev-1",
        handlerKey: "anya:projection-refresh",
        asOf: T_POST_WINDOW,
      }),
      busDispatched({ eventId: "ev-2", handlerKey: "linnea:event-triage", asOf: T_POST_WINDOW }),
      seqShadow("anya:projection-refresh", 10, T_POST_WINDOW),
      seqShadow("linnea:event-triage", 11, T_POST_WINDOW),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(true);
    expect(r.violations.every((v) => v.severity !== "fail")).toBe(true);
    expect(r.violations.some((v) => v.subject === "shadow-stream" && v.severity === "warn")).toBe(
      true,
    );
    // The seq:N shadow pairs are reported as pre-protocol info, not divergence.
    expect(
      r.violations.some((v) => v.subject === "pre-protocol-baseline" && v.severity === "info"),
    ).toBe(true);
  });

  it("excludes pre-epoch pairs from divergence when mixed seq:N + real-id shadow exist", () => {
    // The trap: a real-id shadow event (T_POST_WINDOW) establishes the epoch.
    // Pre-epoch baseline = old seq:N shadow + bus rows BEFORE the epoch. They
    // must NOT become divergence — only the post-epoch matched pair counts.
    const EPOCH = "2026-05-10T00:00:00.000Z"; // after T_POST_WINDOW (05-08), before NOW (05-12)
    const PRE = T_POST_WINDOW; // 05-08 — before the epoch
    const seqShadow: Event = {
      event_id: newEventId(),
      type: "LegacyFanoutShadowed",
      as_of: PRE,
      entity: ENTITY,
      actor: { type: "service", id: "agent:atlas:legacy-fanout-shadow" },
      citations: [...CITATIONS],
      payload: {
        parentAgent: "Anya",
        parentTrigger: "projection-refresh",
        triggeredHandlerKey: "anya:projection-refresh",
        triggeringEventTypes: ["WorkstreamRegistered"],
        suppressedAtSequence: 5,
      },
    };
    const events: Event[] = [
      // Pre-epoch bus row with no shadow match — must be excluded, not divergence.
      busDispatched({ eventId: "ev-old", handlerKey: "anya:projection-refresh", asOf: PRE }),
      seqShadow,
      // Post-epoch matched pair — clean.
      busDispatched({ eventId: "ev-new", handlerKey: "anya:projection-refresh", asOf: EPOCH }),
      legacyShadowed({ eventId: "ev-new", handlerKey: "anya:projection-refresh", asOf: EPOCH }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(true);
    // No divergence rows at all (post-epoch set agrees).
    expect(
      r.violations.some((v) => typeof v.message === "string" && v.message.includes("Divergence")),
    ).toBe(false);
    // Pre-epoch pairs reported as info (1 bus + 1 seq shadow = 2).
    expect(
      r.violations.some(
        (v) =>
          v.subject === "pre-protocol-baseline" &&
          v.severity === "info" &&
          v.message.includes("2 pre-protocol"),
      ),
    ).toBe(true);
  });

  it("excludes cascade-only bus dispatches from A.1 (cascade topology, option b)", () => {
    // Post-epoch: shadow saw `ev-parent` (a non-event-driven parent's event).
    // The bus also dispatched `ev-cascade` (appended by an event-driven
    // handler — a cascade). The shadow never recorded `ev-cascade` by design.
    // It must be excluded from A.1 as a cascade, not flagged as divergence.
    const EPOCH = "2026-05-10T00:00:00.000Z";
    const events: Event[] = [
      busDispatched({ eventId: "ev-parent", handlerKey: "anya:projection-refresh", asOf: EPOCH }),
      busDispatched({ eventId: "ev-cascade", handlerKey: "linnea:event-triage", asOf: EPOCH }),
      legacyShadowed({ eventId: "ev-parent", handlerKey: "anya:projection-refresh", asOf: EPOCH }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(true);
    expect(
      r.violations.some((v) => typeof v.message === "string" && v.message.includes("Divergence")),
    ).toBe(false);
    expect(
      r.violations.some((v) => v.subject === "cascade-dispatches" && v.severity === "info"),
    ).toBe(true);
  });

  it("warns (not fails) post-epoch divergence while inside the sample window", () => {
    // Epoch ~1h before NOW (pre-window). A genuine A.2 divergence (shadow
    // pair with no bus match) should be warn, ok=true — the window has not
    // accrued from the cutover point yet.
    const events: Event[] = [
      busDispatched({ eventId: "ev-x", handlerKey: "anya:projection-refresh", asOf: T_PRE_WINDOW }),
      legacyShadowed({
        eventId: "ev-x",
        handlerKey: "anya:projection-refresh",
        asOf: T_PRE_WINDOW,
      }),
      // Unmatched shadow pair (no bus) → A.2 divergence.
      legacyShadowed({ eventId: "ev-y", handlerKey: "linnea:event-triage", asOf: T_PRE_WINDOW }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(true);
    expect(
      r.violations.some((v) => v.subject === "ev-y|linnea:event-triage" && v.severity === "warn"),
    ).toBe(true);
  });

  it("fails on a genuine post-epoch divergence once the sample window is met", () => {
    // Epoch ~4 days before NOW (post-window). A genuine A.2 divergence
    // (shadow pair with no bus match, real id, post-epoch) MUST fail — this
    // is the real divergence the gate exists to catch.
    const events: Event[] = [
      busDispatched({
        eventId: "ev-x",
        handlerKey: "anya:projection-refresh",
        asOf: T_POST_WINDOW,
      }),
      legacyShadowed({
        eventId: "ev-x",
        handlerKey: "anya:projection-refresh",
        asOf: T_POST_WINDOW,
      }),
      legacyShadowed({ eventId: "ev-y", handlerKey: "linnea:event-triage", asOf: T_POST_WINDOW }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.subject === "ev-y|linnea:event-triage" && v.severity === "fail"),
    ).toBe(true);
  });
});
