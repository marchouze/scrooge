// tests/projections-snapshot.test.ts
//
// D-EVENT-STORE-SCALING Slice 3 — projection-runtime snapshot adoption.
//
// Asserts:
//   - `Projector.projectFromSnapshot` returns the same state as a fresh
//     naive `build()` over the full event log, both before any snapshot
//     has been written (graceful degradation) and after.
//   - Cold-start equivalence: project from a snapshot, kill in-memory
//     state, restore from snapshot, continue projecting forward — the
//     final state matches a fresh naive projection of the full stream.
//   - `Projector.maybeSnapshot` calls into `eventStore.shouldSnapshot()`
//     and persists when the cadence rule fires; idempotent on
//     (streamKey, asOf, uptoSequence).
//   - Decoder/encoder absent → `projectFromSnapshot` / `maybeSnapshot`
//     throws (loud failure, not a silent skip).
//
// Author: Anya (Data / analytics engineer, engineering)

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001, newEventId } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";
import { LocalProjector, acceptType } from "../platform/projections";
import type { Projection } from "../platform/projections";

function mk(overrides: Partial<Event> = {}): Event {
  return {
    event_id: newEventId(),
    type: "WidgetTouched",
    as_of: "2026-05-10T00:00:00.000Z",
    entity: BANK_ZA_001,
    actor: { type: "system", id: "test" },
    citations: ["TEST-CIT"],
    payload: {},
    ...overrides,
  } as Event;
}

interface CounterState {
  readonly count: number;
  readonly lastAsOf: string | null;
}

const STREAM = "LE-BANK-SA|projection/widget-counter";

const counter: Projection<CounterState, Event> = {
  name: "widget-counter",
  initial: { count: 0, lastAsOf: null },
  accepts: acceptType("WidgetTouched"),
  reduce: (s, e) => ({ count: s.count + 1, lastAsOf: e.as_of }),
  encodeSnapshot: (s) => JSON.stringify(s),
  decodeSnapshot: (p) => JSON.parse(p) as CounterState,
};

describe("LocalProjector.projectFromSnapshot — equivalence with naive build", () => {
  it("with no snapshot present, projectFromSnapshot equals naive build (graceful degradation)", () => {
    const store = new EventStore();
    for (let i = 0; i < 12; i++) {
      store.append(mk({ as_of: `2026-05-10T${String(i).padStart(2, "0")}:00:00.000Z` }));
    }
    const projector = new LocalProjector(store);
    const naive = projector.build(counter, { asOf: "2026-05-10T08:00:00.000Z" });
    const { state: fromSnap } = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-05-10T08:00:00.000Z",
    });
    expect(fromSnap).toEqual(naive);
    expect(fromSnap.count).toBe(9); // hours 00..08 inclusive
    store.close();
  });

  it("with a snapshot present, projectFromSnapshot equals naive build", () => {
    const store = new EventStore();
    for (let i = 0; i < 20; i++) {
      store.append(mk({ as_of: `2026-05-10T${String(i % 24).padStart(2, "0")}:00:00.000Z` }));
    }
    const projector = new LocalProjector(store);

    // Persist a snapshot at as_of=10:00 covering sequence 8 (a partial
    // fold — encoder serialises whatever state the caller hands over).
    const partialState: CounterState = { count: 8, lastAsOf: "2026-05-10T07:00:00.000Z" };
    store.snapshot({
      streamKey: STREAM,
      asOf: "2026-05-10T10:00:00.000Z",
      uptoSequence: 8,
      payload: counter.encodeSnapshot?.(partialState) ?? "",
    });

    const naive = projector.build(counter, { asOf: "2026-05-10T15:00:00.000Z" });
    const { state: fromSnap } = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-05-10T15:00:00.000Z",
    });
    expect(fromSnap).toEqual(naive);
    store.close();
  });

  it("cold-start: snapshot → drop in-memory → restore → continue forward equals fresh naive", () => {
    const store = new EventStore();
    // 30 events across 30 distinct as_ofs.
    for (let i = 0; i < 30; i++) {
      store.append(
        mk({
          as_of: `2026-05-${String(10 + Math.floor(i / 24)).padStart(2, "0")}T${String(i % 24).padStart(2, "0")}:00:00.000Z`,
        }),
      );
    }
    const projector = new LocalProjector(store);

    // Phase 1 — project all events at midpoint, then snapshot.
    const midpointAsOf = "2026-05-10T20:00:00.000Z";
    const midpointState = projector.build(counter, { asOf: midpointAsOf });
    const midpointUpto = [...store.replay({ asOf: midpointAsOf })].length;
    projector.maybeSnapshot(counter, {
      streamKey: STREAM,
      asOf: midpointAsOf,
      uptoSequence: midpointUpto,
      state: midpointState,
      eventType: "WidgetTouched",
    });

    // Phase 2 — simulate cold start. Restore from snapshot.
    const finalAsOf = "2026-05-11T05:00:00.000Z";
    const { state: restored } = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: finalAsOf,
    });

    // Phase 3 — naive baseline.
    const naive = projector.build(counter, { asOf: finalAsOf });
    expect(restored).toEqual(naive);
    store.close();
  });

  it("filter narrows the delta replay (snapshot path)", () => {
    const store = new EventStore();
    for (let i = 0; i < 6; i++) {
      store.append(mk({ type: "WidgetTouched" }));
      store.append(mk({ type: "OtherType" }));
    }
    const projector = new LocalProjector(store);
    const naive = projector.build(counter); // accepts only WidgetTouched
    const { state: fromSnap } = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-05-10T23:59:59.000Z",
      filter: { type: "WidgetTouched" },
    });
    expect(fromSnap.count).toBe(naive.count);
    expect(fromSnap.count).toBe(6);
    store.close();
  });

  it("missing decodeSnapshot → projectFromSnapshot throws", () => {
    const store = new EventStore();
    const projector = new LocalProjector(store);
    const noCodec: Projection<number, Event> = {
      name: "no-codec",
      initial: 0,
      accepts: acceptType("WidgetTouched"),
      reduce: (s) => s + 1,
    };
    expect(() =>
      projector.projectFromSnapshot(noCodec, {
        streamKey: STREAM,
        asOf: "2026-05-10T00:00:00.000Z",
      }),
    ).toThrow(/decodeSnapshot/);
    store.close();
  });
});

describe("LocalProjector.maybeSnapshot — cadence-driven persist", () => {
  it("first-snapshot — no prior snapshot exists → persists immediately", () => {
    const store = new EventStore();
    for (let i = 0; i < 3; i++) store.append(mk());
    const projector = new LocalProjector(store);
    const result = projector.maybeSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-05-10T00:00:00.000Z",
      uptoSequence: 3,
      state: { count: 3, lastAsOf: "2026-05-10T00:00:00.000Z" },
      eventType: "WidgetTouched",
    });
    expect(result.emitted).toBe(true);
    expect(result.reason).toBe("first-snapshot");
    expect(result.snapshot).toBeDefined();
    expect(store.listSnapshots(STREAM).length).toBe(1);
    store.close();
  });

  it("idempotent on (streamKey, asOf, uptoSequence) — second call returns same row", () => {
    const store = new EventStore();
    const projector = new LocalProjector(store);
    const opts = {
      streamKey: STREAM,
      asOf: "2026-05-10T00:00:00.000Z",
      uptoSequence: 1,
      state: { count: 1, lastAsOf: "2026-05-10T00:00:00.000Z" } as CounterState,
      eventType: "WidgetTouched",
    };
    const a = projector.maybeSnapshot(counter, opts);
    expect(a.emitted).toBe(true);
    // Second call — `shouldSnapshot` will see the persisted row at
    // sequence 1, and there are 0 events on the log past that point;
    // with the default 1000-event K threshold it returns
    // below-thresholds. The runtime correctly skips re-emission.
    const b = projector.maybeSnapshot(counter, opts);
    expect(b.emitted).toBe(false);
    expect(b.reason).toBe("below-thresholds");
    expect(store.listSnapshots(STREAM).length).toBe(1);
    store.close();
  });

  it("missing encodeSnapshot → maybeSnapshot throws", () => {
    const store = new EventStore();
    const projector = new LocalProjector(store);
    const noCodec: Projection<number, Event> = {
      name: "no-codec",
      initial: 0,
      accepts: acceptType("WidgetTouched"),
      reduce: (s) => s + 1,
    };
    expect(() =>
      projector.maybeSnapshot(noCodec, {
        streamKey: STREAM,
        asOf: "2026-05-10T00:00:00.000Z",
        uptoSequence: 0,
        state: 0,
      }),
    ).toThrow(/encodeSnapshot/);
    store.close();
  });
});
