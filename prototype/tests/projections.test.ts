// tests/projections.test.ts
//
// Unit tests for the projection runtime. Asserts:
//   - Pure-function fold over the event log (P1).
//   - acceptType narrows on event.type.
//   - As-of replay propagates to the projector.
//   - Same events → same state (deterministic, replayable — P6).
//
// Author: Atlas

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001, newEventId, nowUtc } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";
import { LocalProjector, acceptAll, acceptType } from "../platform/projections";
import type { Projection } from "../platform/projections";

function mk(overrides: Partial<Event> = {}): Event {
  return {
    event_id: newEventId(),
    type: "TestEvent",
    as_of: nowUtc(),
    entity: BANK_ZA_001,
    actor: { type: "system", id: "test" },
    citations: ["TEST-CIT"],
    payload: {},
    ...overrides,
  } as Event;
}

const counter: Projection<number, Event> = {
  name: "counter",
  initial: 0,
  accepts: acceptAll,
  reduce: (s) => s + 1,
};

describe("LocalProjector", () => {
  it("folds every event through the reducer (acceptAll)", () => {
    const store = new EventStore();
    for (let i = 0; i < 5; i++) store.append(mk());
    const projector = new LocalProjector(store);
    expect(projector.build(counter)).toBe(5);
    store.close();
  });

  it("acceptType narrows by event.type", () => {
    const store = new EventStore();
    store.append(mk({ type: "Alpha" }));
    store.append(mk({ type: "Alpha" }));
    store.append(mk({ type: "Beta" }));

    const onlyAlpha: Projection<number, Event> = {
      name: "alpha-counter",
      initial: 0,
      accepts: acceptType("Alpha"),
      reduce: (s) => s + 1,
    };
    const projector = new LocalProjector(store);
    expect(projector.build(onlyAlpha)).toBe(2);
    store.close();
  });

  it("supports as-of replay (P1)", () => {
    const store = new EventStore();
    const earlier = "2026-01-01T00:00:00.000Z";
    const later = "2026-12-31T00:00:00.000Z";
    store.append(mk({ as_of: earlier }));
    store.append(mk({ as_of: later }));
    store.append(mk({ as_of: later }));

    const projector = new LocalProjector(store);
    expect(projector.build(counter, { asOf: earlier })).toBe(1);
    expect(projector.build(counter, { asOf: later })).toBe(3);
    store.close();
  });

  it("is deterministic — same events yield same state on replay", () => {
    const store = new EventStore();
    for (let i = 0; i < 10; i++) store.append(mk({ payload: { i } }));

    const sumOfI: Projection<number, Event> = {
      name: "sum-of-i",
      initial: 0,
      accepts: acceptAll,
      reduce: (s, e) => s + ((e.payload.i as number) ?? 0),
    };
    const projector = new LocalProjector(store);
    const a = projector.build(sumOfI);
    const b = projector.build(sumOfI);
    expect(a).toBe(b);
    expect(a).toBe(45); // 0..9
    store.close();
  });

  it("fold accepts a non-default seed", () => {
    const store = new EventStore();
    for (let i = 0; i < 3; i++) store.append(mk());
    const projector = new LocalProjector(store);
    expect(projector.fold(counter, 100)).toBe(103);
    store.close();
  });
});
