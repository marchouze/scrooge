// tests/ba-return-trigger.test.ts
//
// MC14 BA-return generation trigger — exit-criterion tests for
// platform/accounting/ba-return-trigger.ts.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
// Procedure: PROC-FIN-MC-01 §5 MC14
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { triggerBAReturnGeneration } from "../platform/accounting/ba-return-trigger";
import { EventStore } from "../platform/event-store/store";
import { simulatedTag } from "../platform/event-store/provenance";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const PERIOD = "2026-05";
const TRIGGER_EVENT_ID = "evt-period-closed-001";
const AS_OF = "2026-06-01T00:00:00.000Z";
const ACTOR = { type: "service" as const, id: "agent:Bea" };
const CITATIONS = ["PROC-FIN-MC-01", "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN", "BANKS-ACT-94-1990-S90"];

const PROVENANCE = simulatedTag({
  scenario: "ba-return-trigger-tests",
  sourceLineage: "agent:bea:month-end-close",
});

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("triggerBAReturnGeneration", () => {
  it("appends BAReturnGenerationTriggered and returns eventId on first call", async () => {
    const store = new EventStore();

    const result = await triggerBAReturnGeneration({
      eventStore: store,
      period: PERIOD,
      triggerEventId: TRIGGER_EVENT_ID,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      asOf: AS_OF,
      provenance: PROVENANCE,
    });

    expect(result.appended).toBe(true);
    expect(result.period).toBe(PERIOD);
    expect(result.eventId).toBeTruthy();
  });

  it("is idempotent — second call returns existing eventId and appended:false", async () => {
    const store = new EventStore();

    const first = await triggerBAReturnGeneration({
      eventStore: store,
      period: PERIOD,
      triggerEventId: TRIGGER_EVENT_ID,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      asOf: AS_OF,
      provenance: PROVENANCE,
    });

    const second = await triggerBAReturnGeneration({
      eventStore: store,
      period: PERIOD,
      triggerEventId: TRIGGER_EVENT_ID,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      asOf: AS_OF,
      provenance: PROVENANCE,
    });

    expect(second.appended).toBe(false);
    expect(second.eventId).toBe(first.eventId);
    expect(second.period).toBe(PERIOD);
  });

  it("stores a BAReturnGenerationTriggered event in the event store", async () => {
    const store = new EventStore();

    await triggerBAReturnGeneration({
      eventStore: store,
      period: PERIOD,
      triggerEventId: TRIGGER_EVENT_ID,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      asOf: AS_OF,
      provenance: PROVENANCE,
    });

    const events = [...store.replay({ entity: ENTITY, type: "BAReturnGenerationTriggered" })];
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as { period: string; triggerEventId: string; entity: string };
    expect(payload.period).toBe(PERIOD);
    expect(payload.triggerEventId).toBe(TRIGGER_EVENT_ID);
    expect(payload.entity).toBe(ENTITY);
  });

  it("allows different periods on the same entity without idempotency collision", async () => {
    const store = new EventStore();

    const r1 = await triggerBAReturnGeneration({
      eventStore: store,
      period: "2026-04",
      triggerEventId: "evt-closed-apr",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      asOf: "2026-05-01T00:00:00.000Z",
      provenance: PROVENANCE,
    });

    const r2 = await triggerBAReturnGeneration({
      eventStore: store,
      period: "2026-05",
      triggerEventId: "evt-closed-may",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      asOf: AS_OF,
      provenance: PROVENANCE,
    });

    expect(r1.appended).toBe(true);
    expect(r2.appended).toBe(true);
    expect(r1.eventId).not.toBe(r2.eventId);

    const events = [...store.replay({ entity: ENTITY, type: "BAReturnGenerationTriggered" })];
    expect(events).toHaveLength(2);
  });

  it("uses triggeredAt from args when provided", async () => {
    const store = new EventStore();
    const customTriggeredAt = "2026-06-01T08:30:00.000Z";

    await triggerBAReturnGeneration({
      eventStore: store,
      period: PERIOD,
      triggerEventId: TRIGGER_EVENT_ID,
      entity: ENTITY,
      triggeredAt: customTriggeredAt,
      actor: ACTOR,
      citations: CITATIONS,
      asOf: AS_OF,
      provenance: PROVENANCE,
    });

    const events = [...store.replay({ entity: ENTITY, type: "BAReturnGenerationTriggered" })];
    const payload = events[0]!.payload as { triggeredAt: string };
    expect(payload.triggeredAt).toBe(customTriggeredAt);
  });
});
