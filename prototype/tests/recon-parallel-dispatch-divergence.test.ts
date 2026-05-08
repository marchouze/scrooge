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

  it("flags pair-level divergence at warn severity pre-window", () => {
    // Bus-only pair `ev-aaa`; shadow-only pair `ev-bbb` — both streams non-empty
    // but they don't overlap.
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
    const r = parallelDispatchDivergence({ events, now: NOW });
    // Pre-window: divergences are warn, so ok stays true.
    expect(r.ok).toBe(true);
    const warns = r.violations.filter((v) => v.severity === "warn");
    // Two divergence rows: bus-side missing shadow + shadow-side missing bus.
    expect(warns.length).toBeGreaterThanOrEqual(2);
  });

  it("escalates pair-level divergence to fail severity post-window", () => {
    const events: Event[] = [
      busDispatched({
        eventId: "ev-aaa",
        handlerKey: "anya:projection-refresh",
        asOf: T_POST_WINDOW,
      }),
      legacyShadowed({
        eventId: "ev-bbb",
        handlerKey: "anya:projection-refresh",
        asOf: T_POST_WINDOW,
      }),
    ];
    const r = parallelDispatchDivergence({ events, now: NOW });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails.length).toBeGreaterThanOrEqual(2);
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
    // 1-millisecond window — any event older than 1ms post-window.
    const events: Event[] = [
      busDispatched({
        eventId: "ev-aaa",
        handlerKey: "anya:projection-refresh",
        asOf: T_PRE_WINDOW,
      }),
    ];
    const r = parallelDispatchDivergence({
      events,
      now: NOW,
      gatingWindowMs: 1,
    });
    // Bus-only stream → shadow-stream warn → escalates to fail
    // post-window (which we forced via the 1ms override).
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject === "shadow-stream" && v.severity === "fail")).toBe(
      true,
    );
  });
});
