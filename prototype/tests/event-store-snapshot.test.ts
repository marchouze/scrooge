// tests/event-store-snapshot.test.ts
//
// Tests for the D-EVENT-STORE-SCALING Slice 2 snapshot substrate
// (CEO-approved 2026-05-10; spec at
// `Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md` §4.2 +
// §6 Slice 2). Asserts:
//   - snapshot round-trip (persist → load).
//   - replayFromSnapshot equivalence with naive replay (with snapshot
//     and without — graceful degradation when no snapshot exists).
//   - idempotent snapshot (same triple → same row).
//   - cadence-trigger behaviour (K events / T time / first-snapshot
//     bootstrap, plus per-event-type override).
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001, newEventId } from "../platform/core/types";
import { DEFAULT_SNAPSHOT_CADENCE } from "../platform/event-store/registry";
import { EventStore } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";

function mk(overrides: Partial<Event> = {}): Event {
  return {
    event_id: newEventId(),
    type: "TestEvent",
    as_of: "2026-05-10T00:00:00.000Z",
    entity: BANK_ZA_001,
    actor: { type: "human", id: "test" },
    citations: ["TEST-CIT"],
    payload: {},
    ...overrides,
  } as Event;
}

const STREAM = "LE-BANK-SA|test/SLICE-2";

describe("EventStore.snapshot — round-trip + idempotency", () => {
  it("persists and loads a snapshot for a stream", () => {
    const store = new EventStore();
    const snap = store.snapshot({
      streamKey: STREAM,
      asOf: "2026-05-10T12:00:00.000Z",
      uptoSequence: 42,
      payload: JSON.stringify({ count: 42, total: 12345 }),
    });

    expect(snap.streamKey).toBe(STREAM);
    expect(snap.asOf).toBe("2026-05-10T12:00:00.000Z");
    expect(snap.uptoSequence).toBe(42);
    expect(JSON.parse(snap.payload)).toEqual({ count: 42, total: 12345 });
    expect(snap.id).toBeGreaterThan(0);
    expect(snap.recordedAt).toBeTruthy();

    const loaded = store.loadSnapshot(STREAM, "2026-05-10T23:59:59.000Z");
    expect(loaded?.id).toBe(snap.id);
    expect(loaded?.uptoSequence).toBe(42);

    store.close();
  });

  it("is idempotent on (streamKey, asOf, uptoSequence) — same triple returns same row", () => {
    const store = new EventStore();
    const opts = {
      streamKey: STREAM,
      asOf: "2026-05-10T12:00:00.000Z",
      uptoSequence: 100,
      payload: JSON.stringify({ v: 1 }),
    };
    const a = store.snapshot(opts);
    const b = store.snapshot(opts);
    expect(b.id).toBe(a.id);

    // listSnapshots confirms no duplicate row was written.
    expect(store.listSnapshots(STREAM)).toHaveLength(1);
    store.close();
  });

  it("rejects bad inputs", () => {
    const store = new EventStore();
    expect(() =>
      store.snapshot({ streamKey: "", asOf: "2026", uptoSequence: 1, payload: "{}" }),
    ).toThrow(/streamKey/);
    expect(() =>
      store.snapshot({ streamKey: "S", asOf: "", uptoSequence: 1, payload: "{}" }),
    ).toThrow(/asOf/);
    expect(() =>
      store.snapshot({ streamKey: "S", asOf: "2026", uptoSequence: -1, payload: "{}" }),
    ).toThrow(/uptoSequence/);
    store.close();
  });

  it("loadSnapshot returns the latest-≤-asOf snapshot, ignoring later snapshots", () => {
    const store = new EventStore();
    store.snapshot({
      streamKey: STREAM,
      asOf: "2026-05-10T01:00:00.000Z",
      uptoSequence: 10,
      payload: JSON.stringify({ at: "01:00" }),
    });
    store.snapshot({
      streamKey: STREAM,
      asOf: "2026-05-10T05:00:00.000Z",
      uptoSequence: 50,
      payload: JSON.stringify({ at: "05:00" }),
    });
    store.snapshot({
      streamKey: STREAM,
      asOf: "2026-05-10T09:00:00.000Z",
      uptoSequence: 90,
      payload: JSON.stringify({ at: "09:00" }),
    });

    const at0300 = store.loadSnapshot(STREAM, "2026-05-10T03:00:00.000Z");
    expect(at0300).toBeDefined();
    expect(JSON.parse(at0300?.payload ?? "{}").at).toBe("01:00");

    const at0700 = store.loadSnapshot(STREAM, "2026-05-10T07:00:00.000Z");
    expect(at0700).toBeDefined();
    expect(JSON.parse(at0700?.payload ?? "{}").at).toBe("05:00");

    const at1200 = store.loadSnapshot(STREAM, "2026-05-10T12:00:00.000Z");
    expect(at1200).toBeDefined();
    expect(JSON.parse(at1200?.payload ?? "{}").at).toBe("09:00");

    const beforeAny = store.loadSnapshot(STREAM, "2026-05-09T00:00:00.000Z");
    expect(beforeAny).toBeUndefined();

    store.close();
  });
});

describe("EventStore.replayFromSnapshot — equivalence with naive replay", () => {
  it("yields identical events as naive replay when no snapshot exists (degraded path)", () => {
    const store = new EventStore();
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      const id = newEventId();
      ids.push(id);
      store.append(
        mk({
          event_id: id,
          as_of: `2026-05-10T${String(i).padStart(2, "0")}:00:00.000Z`,
        }),
      );
    }

    const naive = [...store.replay({ asOf: "2026-05-10T12:00:00.000Z" })].map((e) => e.event_id);
    const fromSnap = [
      ...store.replayFromSnapshot({
        streamKey: STREAM,
        asOf: "2026-05-10T12:00:00.000Z",
      }),
    ].map((e) => e.event_id);

    expect(fromSnap).toEqual(naive);
    expect(fromSnap.length).toBe(13); // hours 00..12 inclusive
    store.close();
  });

  it("yields only the delta after a snapshot, equivalent to naive(filter) minus pre-snapshot", () => {
    const store = new EventStore();

    // 30 events across 30 hours.
    for (let i = 0; i < 30; i++) {
      store.append(
        mk({
          event_id: newEventId(),
          type: "WidgetTouched",
          as_of: `2026-05-10T${String(i % 24).padStart(2, "0")}:00:00.000Z`,
        }),
      );
    }
    // Snapshot covering events ≤ sequence 12 at asOf hour 12.
    store.snapshot({
      streamKey: STREAM,
      asOf: "2026-05-10T12:00:00.000Z",
      uptoSequence: 12,
      payload: JSON.stringify({ widgets: 12 }),
    });

    // Ask for as-of hour 18 — naive yields all events with as_of ≤ 18:00.
    // Snapshot-based yields only events with sequence > 12 AND as_of ≤ 18:00.
    const naive = [
      ...store.replay({
        asOf: "2026-05-10T18:00:00.000Z",
        type: "WidgetTouched",
      }),
    ];
    const fromSnap = [
      ...store.replayFromSnapshot({
        streamKey: STREAM,
        asOf: "2026-05-10T18:00:00.000Z",
        filter: { type: "WidgetTouched" },
      }),
    ];

    // Equivalence: snapshot delta + (events ≤ snapshot.uptoSequence in
    // the naive set) reconstructs the naive set exactly. Since the
    // snapshot records the projection — not the events — we assert
    // here that the delta is the events with sequence > 12 AND
    // as_of ≤ 18:00.
    const expectedDeltaIds = naive
      .filter((e) => {
        // Re-derive event sequence by event_id lookup against the full
        // log — sequence is not surfaced on the Event envelope, so we
        // compare ids in append-order.
        const allIds = [...store.replay()].map((x) => x.event_id);
        return allIds.indexOf(e.event_id) >= 12; // 0-indexed; sequence > 12 means index ≥ 12
      })
      .map((e) => e.event_id);

    expect(fromSnap.map((e) => e.event_id)).toEqual(expectedDeltaIds);
    // Snapshot-based path yields strictly fewer events than naive when
    // the snapshot covers a non-empty prefix.
    expect(fromSnap.length).toBeLessThan(naive.length);
    expect(fromSnap.length).toBeGreaterThan(0);

    store.close();
  });

  it("respects asOf as upper bound on the delta", () => {
    const store = new EventStore();
    for (let i = 0; i < 10; i++) {
      store.append(
        mk({
          event_id: newEventId(),
          as_of: `2026-05-10T${String(i).padStart(2, "0")}:00:00.000Z`,
        }),
      );
    }
    // Events appended above carry sequences 1..10 (sqlite AUTOINCREMENT)
    // mapped to as_of hours 00..09. Snapshot covers uptoSequence=3 →
    // delta starts at sequence 4 (as_of 03:00). asOf clamps at 05:00 →
    // sequences 4..6 (as_of 03:00, 04:00, 05:00).
    store.snapshot({
      streamKey: STREAM,
      asOf: "2026-05-10T03:00:00.000Z",
      uptoSequence: 3,
      payload: "{}",
    });
    const delta = [
      ...store.replayFromSnapshot({
        streamKey: STREAM,
        asOf: "2026-05-10T05:00:00.000Z",
      }),
    ];
    expect(delta.map((e) => e.as_of)).toEqual([
      "2026-05-10T03:00:00.000Z",
      "2026-05-10T04:00:00.000Z",
      "2026-05-10T05:00:00.000Z",
    ]);
    store.close();
  });
});

describe("EventStore.shouldSnapshot — cadence-trigger behaviour", () => {
  it("returns first-snapshot when no prior snapshot exists for the stream", () => {
    const store = new EventStore();
    const check = store.shouldSnapshot({ streamKey: STREAM });
    expect(check.shouldSnapshot).toBe(true);
    expect(check.reason).toBe("first-snapshot");
    expect(check.cadence).toEqual(DEFAULT_SNAPSHOT_CADENCE);
    store.close();
  });

  it("returns events-threshold when K events accrue since last snapshot", () => {
    const store = new EventStore();
    // Synthetic last-snapshot at sequence 0; default cadence K = 1000.
    // Append 1000 events to cross the K threshold.
    for (let i = 0; i < 1000; i++) {
      store.append(mk({ event_id: newEventId() }));
    }
    const check = store.shouldSnapshot({
      streamKey: STREAM,
      lastSnapshot: {
        id: 1,
        streamKey: STREAM,
        asOf: "2026-05-10T00:00:00.000Z",
        uptoSequence: 0,
        payload: "{}",
        recordedAt: new Date().toISOString(),
      },
      nowUtc: new Date().toISOString(),
    });
    expect(check.shouldSnapshot).toBe(true);
    expect(check.reason).toBe("events-threshold");
    expect(check.eventsSinceSnapshot).toBe(1000);
    store.close();
  });

  it("returns time-threshold when T seconds elapse with no event-threshold breach", () => {
    const store = new EventStore();
    // Append a handful of events — well below K.
    for (let i = 0; i < 5; i++) store.append(mk({ event_id: newEventId() }));
    const lastSnapshotAt = "2026-05-09T00:00:00.000Z";
    const now = "2026-05-10T01:30:00.000Z"; // > 24 hours later
    const check = store.shouldSnapshot({
      streamKey: STREAM,
      nowUtc: now,
      lastSnapshot: {
        id: 1,
        streamKey: STREAM,
        asOf: lastSnapshotAt,
        uptoSequence: 0,
        payload: "{}",
        recordedAt: lastSnapshotAt,
      },
    });
    expect(check.shouldSnapshot).toBe(true);
    expect(check.reason).toBe("time-threshold");
    expect(check.secondsSinceSnapshot).toBeGreaterThan(60 * 60);
    store.close();
  });

  it("returns below-thresholds when neither K nor T is breached", () => {
    const store = new EventStore();
    // Synthetic lastSnapshot 5 minutes ago covering sequence 0; only 5
    // events appended → far below K=1000 and T=3600s.
    for (let i = 0; i < 5; i++) store.append(mk({ event_id: newEventId() }));
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const check = store.shouldSnapshot({
      streamKey: STREAM,
      lastSnapshot: {
        id: 1,
        streamKey: STREAM,
        asOf: fiveMinutesAgo,
        uptoSequence: 0,
        payload: "{}",
        recordedAt: fiveMinutesAgo,
      },
    });
    expect(check.shouldSnapshot).toBe(false);
    expect(check.reason).toBe("below-thresholds");
    store.close();
  });

  it("falls back to DEFAULT_SNAPSHOT_CADENCE for unknown event types", () => {
    const store = new EventStore();
    const check = store.shouldSnapshot({
      streamKey: STREAM,
      eventType: "TotallyMadeUpType",
    });
    expect(check.cadence).toEqual(DEFAULT_SNAPSHOT_CADENCE);
    store.close();
  });

  it("uses the persisted last-snapshot when none is supplied", () => {
    const store = new EventStore();
    const persisted = store.snapshot({
      streamKey: STREAM,
      asOf: "2026-05-10T00:00:00.000Z",
      uptoSequence: 0,
      payload: "{}",
    });
    expect(persisted.id).toBeGreaterThan(0);
    // Append below the K threshold, immediately check — should be
    // below-thresholds (fresh snapshot, low event count).
    for (let i = 0; i < 5; i++) store.append(mk({ event_id: newEventId() }));
    const check = store.shouldSnapshot({ streamKey: STREAM });
    expect(check.shouldSnapshot).toBe(false);
    expect(check.reason).toBe("below-thresholds");
    store.close();
  });
});
