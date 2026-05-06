// tests/event-store.test.ts
//
// Unit tests for the event store. Asserts:
//   - P2 violation: events without citations are rejected at append.
//   - Sequence ordering on replay.
//   - As-of replay (P1).
//   - Duplicate event-id rejection.
//
// Author: Atlas

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001, newEventId, nowUtc } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";

function mk(overrides: Partial<Event> = {}): Event {
  return {
    event_id: newEventId(),
    type: "TestEvent",
    as_of: nowUtc(),
    entity: BANK_ZA_001,
    actor: { type: "human", id: "test" },
    citations: ["TEST-CIT"],
    payload: {},
    ...overrides,
  } as Event;
}

describe("EventStore", () => {
  it("rejects events without citations (P2)", () => {
    const store = new EventStore();
    const bad = mk({ citations: [] });
    expect(() => store.append(bad)).toThrow();
    store.close();
  });

  it("appends and replays in sequence order", () => {
    const store = new EventStore();
    const ids = [newEventId(), newEventId(), newEventId()];
    for (const id of ids) {
      store.append(mk({ event_id: id }));
    }
    const replayed = [...store.replay()].map((e) => e.event_id);
    expect(replayed).toEqual(ids);
    store.close();
  });

  it("supports as-of replay (P1)", () => {
    const store = new EventStore();
    const earlier = "2026-01-01T00:00:00.000Z";
    const later = "2026-12-31T00:00:00.000Z";
    store.append(mk({ type: "OldEvent", as_of: earlier }));
    store.append(mk({ type: "NewEvent", as_of: later }));

    const upToEarlier = [...store.replay({ asOf: earlier })];
    expect(upToEarlier.length).toBe(1);
    const first = upToEarlier[0];
    expect(first?.type).toBe("OldEvent");
    store.close();
  });

  it("rejects duplicate event ids", () => {
    const store = new EventStore();
    const e = mk();
    store.append(e);
    expect(() => store.append(e)).toThrow();
    store.close();
  });

  it("filters replay by entity", () => {
    const store = new EventStore();
    store.append(mk({ entity: BANK_ZA_001 }));
    store.append(mk({ entity: "SUBSIDIARY-ZA-002" as typeof BANK_ZA_001 }));
    const onlyBank = [...store.replay({ entity: BANK_ZA_001 })];
    expect(onlyBank.length).toBe(1);
    store.close();
  });

  it("filters replay by type", () => {
    const store = new EventStore();
    store.append(mk({ type: "Alpha" }));
    store.append(mk({ type: "Beta" }));
    store.append(mk({ type: "Alpha" }));
    const alphas = [...store.replay({ type: "Alpha" })];
    expect(alphas.length).toBe(2);
    store.close();
  });
});
