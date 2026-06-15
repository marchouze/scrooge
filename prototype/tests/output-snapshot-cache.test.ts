// tests/output-snapshot-cache.test.ts
//
// D-PROJECTION-SNAPSHOT-ADOPTION — per-projection byte-identical equality
// regression. For every projection adopted onto the output-snapshot cache,
// asserts that the snapshot-backed read returns output bit-for-bit equal to
// the unchanged un-cached computation:
//
//   - first read (no snapshot yet → degrades to compute());
//   - second read (snapshot now present → cache hit);
//   - read after the store advances (cache invalidated by count() witness →
//     recompute → still equal);
//   - generic helper invariants (cache-hit only at identical count + asOf;
//     fresh asOf misses; corrupt payload self-heals).
//
// Author: Atlas (Substrate Architect, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  computeTrialBalance,
  computeTrialBalanceUncached,
} from "../platform/accounting/period-close";
import { newEventId } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import {
  computeALMPositionSnapshot,
  getALMPositionSnapshot,
} from "../platform/projections/alm-positions";
import {
  computeCapitalMetrics,
  computeCapitalMetricsUncached,
} from "../platform/projections/capital-metrics";
import {
  defaultProvenanceFilter,
  effectiveStreamKey,
  setDefaultProvenanceModeOverride,
} from "../platform/projections/filter";
import { readWithOutputSnapshot } from "../platform/projections/output-snapshot-cache";

const AS_OF = "2026-06-15T09:00:00.000Z";
const AS_OF_2 = "2026-06-16T09:00:00.000Z";
const ACTOR = { type: "service" as const, id: "agent:test" };
const ENTITY = "LE-ZA-HOZ-BANK";

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

function appendCapital(store: EventStore, amountMinor: number): void {
  store.append({
    event_id: newEventId(),
    type: "CapitalEvent",
    as_of: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: ["D-RAS"],
    payload: {
      eventId: newEventId(),
      capitalEventKind: "capital-injection",
      amount: amountMinor,
      currency: "ZAR",
      effectiveDate: AS_OF,
    },
  });
}


// ---------------------------------------------------------------------------
// Capital metrics — cached === uncached across the snapshot lifecycle.
// ---------------------------------------------------------------------------

describe("output-snapshot-cache — capital-metrics equality", () => {
  it("cached output equals uncached on empty, populated, and advanced store", () => {
    const store = new EventStore(":memory:");

    // 1. Empty store (build-phase fallback). First cached read has no snapshot
    //    → degrades to compute(); must equal the uncached function exactly.
    expect(computeCapitalMetrics(store, AS_OF)).toEqual(
      computeCapitalMetricsUncached(store, AS_OF),
    );

    // 2. Second read: a snapshot now exists → this is a cache HIT. Must STILL
    //    equal a fresh uncached compute() over the identical store.
    expect(computeCapitalMetrics(store, AS_OF)).toEqual(
      computeCapitalMetricsUncached(store, AS_OF),
    );

    // 3. Store advances (count() changes) → cache invalidates → recompute.
    //    Output must equal the uncached function over the new population.
    appendCapital(store, 50_000_000_00);
    expect(computeCapitalMetrics(store, AS_OF)).toEqual(
      computeCapitalMetricsUncached(store, AS_OF),
    );

    // 4. A different asOf must not be served by the prior snapshot.
    expect(computeCapitalMetrics(store, AS_OF_2)).toEqual(
      computeCapitalMetricsUncached(store, AS_OF_2),
    );
  });
});

// ---------------------------------------------------------------------------
// ALM positions — cached === uncached across the snapshot lifecycle.
// ---------------------------------------------------------------------------

describe("output-snapshot-cache — alm-positions equality", () => {
  it("cached output equals uncached on empty, populated, and advanced store", () => {
    const store = new EventStore(":memory:");

    expect(getALMPositionSnapshot(store, AS_OF, 30, ENTITY)).toEqual(
      computeALMPositionSnapshot(store, AS_OF, 30, ENTITY),
    );
    // Cache hit on the second read — still equal.
    expect(getALMPositionSnapshot(store, AS_OF, 30, ENTITY)).toEqual(
      computeALMPositionSnapshot(store, AS_OF, 30, ENTITY),
    );

    // Advance the store (a CapitalEvent changes ALM's ASF tier-1 fold via
    // computeCapitalMetrics). The count() witness invalidates the cache.
    appendCapital(store, 10_000_000_00);
    expect(getALMPositionSnapshot(store, AS_OF, 30, ENTITY)).toEqual(
      computeALMPositionSnapshot(store, AS_OF, 30, ENTITY),
    );

    // Different horizon must not collide on the entity-30 snapshot.
    expect(getALMPositionSnapshot(store, AS_OF, 90, ENTITY)).toEqual(
      computeALMPositionSnapshot(store, AS_OF, 90, ENTITY),
    );
  });
});

// ---------------------------------------------------------------------------
// GL trial balance — cached === uncached across the snapshot lifecycle.
// ---------------------------------------------------------------------------

function appendPosting(store: EventStore, amountMinor: number): void {
  store.append({
    event_id: newEventId(),
    type: "SubLedgerPostingEmitted",
    as_of: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: ["D-REPORTING-CAPABILITY-SLICE-2"],
    payload: {
      tradeId: `trade-${newEventId()}`,
      postingType: "trade-date-booking",
      legs: [
        {
          debit: "ACC-1000-001",
          credit: "ACC-2000-001",
          currency: "ZAR",
          amountMinor,
          memo: "test posting",
        },
      ],
      asOfDate: AS_OF,
      citations: ["D-REPORTING-CAPABILITY-SLICE-2"],
    },
  });
}

describe("output-snapshot-cache — trial-balance equality", () => {
  const WINDOW = {
    periodStart: "2026-06-01T00:00:00.000Z",
    periodEnd: "2026-06-30T23:59:59.999Z",
  };

  it("cached output equals uncached on empty, populated, and advanced store", () => {
    const store = new EventStore(":memory:");
    const args = { eventStore: store, entity: ENTITY, ...WINDOW };

    expect(computeTrialBalance(args)).toEqual(computeTrialBalanceUncached(args));
    // Cache hit on the second read — still equal.
    expect(computeTrialBalance(args)).toEqual(computeTrialBalanceUncached(args));

    appendPosting(store, 25_000_00);
    expect(computeTrialBalance(args)).toEqual(computeTrialBalanceUncached(args));

    // A different entity must not collide on this entity's snapshot.
    const otherArgs = { eventStore: store, entity: "LE-ZA-HOZ-SECURITIES", ...WINDOW };
    expect(computeTrialBalance(otherArgs)).toEqual(computeTrialBalanceUncached(otherArgs));
  });
});

// ---------------------------------------------------------------------------
// Generic helper invariants.
// ---------------------------------------------------------------------------

describe("readWithOutputSnapshot — generic invariants", () => {
  function run(store: EventStore, asOf: string, calls: { n: number }) {
    return readWithOutputSnapshot<{ value: number }>({
      store,
      streamKey: "test:generic",
      asOf,
      compute: () => {
        calls.n += 1;
        return { value: store.count() };
      },
      encode: (o) => JSON.stringify(o),
      decode: (p) => JSON.parse(p) as { value: number },
    });
  }

  it("misses then hits at identical (count, asOf); recomputes when store advances", () => {
    const store = new EventStore(":memory:");
    const calls = { n: 0 };

    const r1 = run(store, AS_OF, calls);
    expect(r1.cacheHit).toBe(false);
    expect(r1.snapshotWritten).toBe(true); // first-snapshot cadence
    expect(calls.n).toBe(1);

    const r2 = run(store, AS_OF, calls);
    expect(r2.cacheHit).toBe(true);
    expect(calls.n).toBe(1); // compute() NOT re-run
    expect(r2.output).toEqual(r1.output);

    // Advance the store → count() witness changes → miss + recompute.
    appendCapital(store, 1_00);
    const r3 = run(store, AS_OF, calls);
    expect(r3.cacheHit).toBe(false);
    expect(calls.n).toBe(2);
    expect(r3.output.value).toBe(store.count());
  });

  it("does not serve a snapshot from a different asOf", () => {
    const store = new EventStore(":memory:");
    const calls = { n: 0 };
    run(store, AS_OF, calls); // writes snapshot at AS_OF
    const r = run(store, AS_OF_2, calls); // different asOf
    expect(r.cacheHit).toBe(false);
    expect(calls.n).toBe(2);
  });

  it("self-heals on a corrupt snapshot payload (recompute, no throw)", () => {
    const store = new EventStore(":memory:");
    const calls = { n: 0 };
    // Write a deliberately corrupt (non-envelope) payload under the SAME
    // effective stream key the helper uses (base key + provenance digest).
    const effKey = effectiveStreamKey("test:generic", defaultProvenanceFilter());
    store.snapshot({
      streamKey: effKey,
      asOf: AS_OF,
      uptoSequence: store.count(),
      payload: "}{ not json at all",
    });
    // The helper must NOT throw — it treats the corrupt row as a miss,
    // recomputes, and self-heals by writing a well-formed snapshot.
    const r = run(store, AS_OF, calls);
    expect(r.cacheHit).toBe(false);
    expect(calls.n).toBe(1);
  });
});
