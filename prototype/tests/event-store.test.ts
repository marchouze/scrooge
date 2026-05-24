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

  // D-EVENT-STORE-SCALING-PHASE-1 — snapshot pruning
  it("pruneSnapshots keeps only keepN most recent snapshots per stream", () => {
    const store = new EventStore();
    const streamKey = "test-stream|pruning";
    const asOf = nowUtc();
    // Emit 20 snapshots with increasing upto_sequence values
    for (let i = 1; i <= 20; i++) {
      store.snapshot({ streamKey, asOf, uptoSequence: i, payload: JSON.stringify({ i }) });
    }
    // pruneSnapshots is called automatically inside snapshot(); verify via listSnapshots
    const remaining = store.listSnapshots(streamKey);
    expect(remaining.length).toBeLessThanOrEqual(5);
    // The 5 kept should be the most recent by upto_sequence
    const seqs = remaining.map((s) => s.uptoSequence).sort((a, b) => a - b);
    expect(seqs).toEqual([16, 17, 18, 19, 20]);
    store.close();
  });

  it("pruneSnapshots with explicit keepN", () => {
    const store = new EventStore();
    const streamKey = "test-stream|pruning-k3";
    const asOf = nowUtc();
    for (let i = 1; i <= 10; i++) {
      store.snapshot({ streamKey, asOf, uptoSequence: i, payload: JSON.stringify({ i }) });
    }
    store.pruneSnapshots(streamKey, 3);
    const remaining = store.listSnapshots(streamKey);
    expect(remaining.length).toBeLessThanOrEqual(3);
    store.close();
  });

  // D-EVENT-STORE-SCALING-PHASE-1 — incremental recon cursors
  it("getReconCursor returns 0 for unknown pipeline", () => {
    const store = new EventStore();
    expect(store.getReconCursor("recon:unknown")).toBe(0);
    store.close();
  });

  it("advanceReconCursor and getReconCursor round-trip", () => {
    const store = new EventStore();
    store.advanceReconCursor("recon:test", 42);
    expect(store.getReconCursor("recon:test")).toBe(42);
    store.close();
  });

  it("advanceReconCursor only moves forward", () => {
    const store = new EventStore();
    store.advanceReconCursor("recon:forward-only", 100);
    store.advanceReconCursor("recon:forward-only", 50); // attempt regression
    expect(store.getReconCursor("recon:forward-only")).toBe(100);
    store.close();
  });

  it("resetReconCursor clears cursor back to 0", () => {
    const store = new EventStore();
    store.advanceReconCursor("recon:reset", 999);
    store.resetReconCursor("recon:reset");
    expect(store.getReconCursor("recon:reset")).toBe(0);
    store.close();
  });

  it("WAL mode is active on file-backed stores", async () => {
    // Verify PRAGMAs apply; :memory: stores skip them intentionally
    const tmp = `/tmp/test-wal-${Math.random().toString(36).slice(2)}.db`;
    const store = new EventStore(tmp);
    // If WAL is active the pragma query returns "wal"
    const db = (store as unknown as { db: { query: (sql: string) => { get: () => unknown } } }).db;
    const row = db.query("PRAGMA journal_mode").get() as { journal_mode: string } | null;
    expect(row?.journal_mode).toBe("wal");
    store.close();
  });
});
