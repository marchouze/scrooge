// tests/projections-provenance-filter.test.ts
//
// D-DATA-PROVENANCE-SUBSTRATE Slice 2 — projection-runtime mode selection
// + filtering. Asserts:
//
//   - Round-trip per mode: projectFromSnapshot under each of
//     `production-only`, `simulated-only`, `combined` returns state
//     equivalent to a naive fold over the same provenance subset.
//   - Snapshot-key isolation: a snapshot persisted under one filter
//     digest is invisible to a request under a different digest
//     (cross-mode contamination is impossible).
//   - Scenario / variant / sourceLineage narrowing.
//   - Env-derived default: `BANK_PHASE` change flips the implicit
//     default mode without code change.
//   - Existing consumers (filter omitted) still work — default fires.
//   - Filter-digest determinism + collision properties.
//
// Author: Anya (Data / analytics engineer, engineering — projection runtime)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { BANK_ZA_001, newEventId } from "../platform/core/types";
import {
  type ProvenanceTag,
  scenarioId,
  setProvenanceSubstrateActive,
  simulatedTag,
  sourceLineage,
  variantId,
} from "../platform/event-store/provenance";
import { EventStore } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";
import {
  LocalProjector,
  type ProvenanceFilter,
  acceptType,
  defaultProvenanceFilter,
  defaultProvenanceMode,
  effectiveStreamKey,
  eventMatchesProvenanceFilter,
  provenanceFilterDigest,
  setDefaultProvenanceModeOverride,
} from "../platform/projections";
import type { Projection } from "../platform/projections";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface CounterState {
  readonly count: number;
}

const counter: Projection<CounterState, Event> = {
  name: "widget-counter",
  initial: { count: 0 },
  accepts: acceptType("WidgetTouched"),
  reduce: (s) => ({ count: s.count + 1 }),
  encodeSnapshot: (s) => JSON.stringify(s),
  decodeSnapshot: (p) => JSON.parse(p) as CounterState,
};

const STREAM = "LE-BANK-SA|projection/widget-counter";

function mk(provenance: ProvenanceTag, overrides: Partial<Event> = {}): Event {
  return {
    event_id: newEventId(),
    type: "WidgetTouched",
    as_of: "2026-05-10T00:00:00.000Z",
    entity: BANK_ZA_001,
    actor: { type: "system", id: "test" },
    citations: ["TEST-CIT"],
    payload: {},
    provenance,
    ...overrides,
  } as Event;
}

const SIM_BASE: ProvenanceTag = simulatedTag({
  scenario: "01-hello-bank",
  sourceLineage: "scenario-runner:01-hello-bank",
});

const SIM_STRESS: ProvenanceTag = simulatedTag({
  scenario: "stress-adverse",
  sourceLineage: "scenario-runner:stress-adverse",
  variant: "what-if-rate-cut-50bp",
});

const PROD: ProvenanceTag = {
  kind: "production" as const,
  sourceLineage: "ceo-decision-record",
};

// Pre-tagged events suppress the soft-tagger / append-rejection paths;
// the substrate-active flag is irrelevant for explicitly-provenanced
// appends, but we pin it false to avoid coupling these tests to the
// resolveProvenanceForAppend default behaviour.
beforeEach(() => {
  setProvenanceSubstrateActive(false);
});

afterEach(() => {
  setProvenanceSubstrateActive(undefined);
  setDefaultProvenanceModeOverride(undefined);
  // biome-ignore lint/performance/noDelete: process.env requires delete to unset
  delete process.env.BANK_PHASE;
});

// ---------------------------------------------------------------------------
// Round-trip per mode
// ---------------------------------------------------------------------------

describe("Slice 2 — provenance-mode round-trip", () => {
  function seedMixedStore(store: EventStore): {
    prodCount: number;
    simCount: number;
    stressCount: number;
  } {
    // Six production events, four simulated/01-hello-bank, two
    // simulated/stress-adverse.
    for (let i = 0; i < 6; i++) store.append(mk(PROD));
    for (let i = 0; i < 4; i++) store.append(mk(SIM_BASE));
    for (let i = 0; i < 2; i++) store.append(mk(SIM_STRESS));
    return { prodCount: 6, simCount: 4, stressCount: 2 };
  }

  it("production-only mode counts only production events", () => {
    const store = new EventStore();
    const { prodCount } = seedMixedStore(store);
    const projector = new LocalProjector(store);
    const { state, provenanceFilter } = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
      provenanceFilter: { mode: "production-only" },
    });
    expect(provenanceFilter.mode).toBe("production-only");
    expect(state.count).toBe(prodCount);
    store.close();
  });

  it("simulated-only mode counts only simulated events (across scenarios)", () => {
    const store = new EventStore();
    const { simCount, stressCount } = seedMixedStore(store);
    const projector = new LocalProjector(store);
    const { state } = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
      provenanceFilter: { mode: "simulated-only" },
    });
    expect(state.count).toBe(simCount + stressCount);
    store.close();
  });

  it("combined mode counts every event (production + every simulated scenario)", () => {
    const store = new EventStore();
    const { prodCount, simCount, stressCount } = seedMixedStore(store);
    const projector = new LocalProjector(store);
    const { state } = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
      provenanceFilter: { mode: "combined" },
    });
    expect(state.count).toBe(prodCount + simCount + stressCount);
    store.close();
  });

  it("scenario narrowing within simulated-only", () => {
    const store = new EventStore();
    seedMixedStore(store);
    const projector = new LocalProjector(store);
    const { state } = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
      provenanceFilter: {
        mode: "simulated-only",
        scenarios: [scenarioId("01-hello-bank")],
      },
    });
    expect(state.count).toBe(4);
    store.close();
  });

  it("variant narrowing within combined mode", () => {
    const store = new EventStore();
    seedMixedStore(store);
    const projector = new LocalProjector(store);
    const { state } = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
      provenanceFilter: {
        mode: "combined",
        variants: [variantId("what-if-rate-cut-50bp")],
      },
    });
    // Only stress-adverse events carry that variant; production has no
    // variant so is implicitly excluded by the variant narrowing.
    expect(state.count).toBe(2);
    store.close();
  });

  it("sourceLineage narrowing applies across modes", () => {
    const store = new EventStore();
    seedMixedStore(store);
    const projector = new LocalProjector(store);
    const { state } = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
      provenanceFilter: {
        mode: "combined",
        sourceLineages: [sourceLineage("ceo-decision-record")],
      },
    });
    expect(state.count).toBe(6);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Snapshot-key digest isolation
// ---------------------------------------------------------------------------

describe("Slice 2 — snapshot-key filter digest isolation", () => {
  it("snapshot persisted under production-only is invisible to simulated-only request", () => {
    const store = new EventStore();
    for (let i = 0; i < 5; i++) store.append(mk(PROD));
    for (let i = 0; i < 3; i++) store.append(mk(SIM_BASE));
    const projector = new LocalProjector(store);

    const prodFilter: ProvenanceFilter = { mode: "production-only" };
    const simFilter: ProvenanceFilter = { mode: "simulated-only" };

    // Compute + persist a snapshot under production-only.
    const prodState = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
      provenanceFilter: prodFilter,
    });
    expect(prodState.state.count).toBe(5);
    projector.maybeSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
      uptoSequence: 8,
      state: prodState.state,
      provenanceFilter: prodFilter,
      eventType: "WidgetTouched",
    });

    // Read under simulated-only — must NOT see the production snapshot.
    // Path degrades to naive replay over the simulated subset.
    const simState = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
      provenanceFilter: simFilter,
    });
    expect(simState.snapshot).toBeUndefined();
    expect(simState.state.count).toBe(3);

    // Confirm the snapshot exists under the production effective key.
    expect(store.listSnapshots(effectiveStreamKey(STREAM, prodFilter)).length).toBe(1);
    expect(store.listSnapshots(effectiveStreamKey(STREAM, simFilter)).length).toBe(0);
    store.close();
  });

  it("re-snapshotting under a different filter creates a parallel snapshot row", () => {
    const store = new EventStore();
    for (let i = 0; i < 4; i++) store.append(mk(PROD));
    for (let i = 0; i < 2; i++) store.append(mk(SIM_BASE));
    const projector = new LocalProjector(store);

    const prodFilter: ProvenanceFilter = { mode: "production-only" };
    const combinedFilter: ProvenanceFilter = { mode: "combined" };

    const prod = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
      provenanceFilter: prodFilter,
    });
    projector.maybeSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
      uptoSequence: 6,
      state: prod.state,
      provenanceFilter: prodFilter,
      eventType: "WidgetTouched",
    });
    const combined = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
      provenanceFilter: combinedFilter,
    });
    projector.maybeSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
      uptoSequence: 6,
      state: combined.state,
      provenanceFilter: combinedFilter,
      eventType: "WidgetTouched",
    });

    expect(store.listSnapshots(effectiveStreamKey(STREAM, prodFilter)).length).toBe(1);
    expect(store.listSnapshots(effectiveStreamKey(STREAM, combinedFilter)).length).toBe(1);
    expect(prod.state.count).toBe(4);
    expect(combined.state.count).toBe(6);
    store.close();
  });

  it("cold-start equivalence under each mode", () => {
    const store = new EventStore();
    for (let i = 0; i < 7; i++) store.append(mk(PROD));
    for (let i = 0; i < 5; i++) store.append(mk(SIM_BASE));
    const projector = new LocalProjector(store);

    for (const mode of ["production-only", "simulated-only", "combined"] as const) {
      const filter: ProvenanceFilter = { mode };
      // Phase 1 — fold + snapshot.
      const phase1 = projector.projectFromSnapshot(counter, {
        streamKey: STREAM,
        asOf: "2026-12-31T23:59:59.000Z",
        provenanceFilter: filter,
      });
      projector.maybeSnapshot(counter, {
        streamKey: STREAM,
        asOf: "2026-12-31T23:59:59.000Z",
        uptoSequence: 12,
        state: phase1.state,
        provenanceFilter: filter,
        eventType: "WidgetTouched",
      });
      // Phase 2 — restore from snapshot (cold start).
      const phase2 = projector.projectFromSnapshot(counter, {
        streamKey: STREAM,
        asOf: "2026-12-31T23:59:59.000Z",
        provenanceFilter: filter,
      });
      expect(phase2.snapshot).toBeDefined();
      expect(phase2.state).toEqual(phase1.state);
    }
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Env-derived default
// ---------------------------------------------------------------------------

describe("Slice 2 — BANK_PHASE-derived default mode", () => {
  it("BANK_PHASE unset defaults to simulated-only (current build phase)", () => {
    // biome-ignore lint/performance/noDelete: process.env requires delete to unset
    delete process.env.BANK_PHASE;
    expect(defaultProvenanceMode()).toBe("simulated-only");
    expect(defaultProvenanceFilter()).toEqual({ mode: "simulated-only" });
  });

  it("BANK_PHASE=build → simulated-only", () => {
    process.env.BANK_PHASE = "build";
    expect(defaultProvenanceMode()).toBe("simulated-only");
  });

  it("BANK_PHASE=licence-day → production-only", () => {
    process.env.BANK_PHASE = "licence-day";
    expect(defaultProvenanceMode()).toBe("production-only");
  });

  it("BANK_PHASE=live → production-only", () => {
    process.env.BANK_PHASE = "live";
    expect(defaultProvenanceMode()).toBe("production-only");
  });

  it("explicit override wins over env var", () => {
    process.env.BANK_PHASE = "build";
    setDefaultProvenanceModeOverride("combined");
    expect(defaultProvenanceMode()).toBe("combined");
    setDefaultProvenanceModeOverride(undefined);
    expect(defaultProvenanceMode()).toBe("simulated-only");
  });

  it("filter omitted from opts → runtime applies env default", () => {
    process.env.BANK_PHASE = "licence-day";
    const store = new EventStore();
    for (let i = 0; i < 3; i++) store.append(mk(PROD));
    for (let i = 0; i < 4; i++) store.append(mk(SIM_BASE));
    const projector = new LocalProjector(store);
    const { state, provenanceFilter } = projector.projectFromSnapshot(counter, {
      streamKey: STREAM,
      asOf: "2026-12-31T23:59:59.000Z",
    });
    expect(provenanceFilter.mode).toBe("production-only");
    expect(state.count).toBe(3);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Filter digest determinism + collision properties
// ---------------------------------------------------------------------------

describe("Slice 2 — filter digest", () => {
  it("identical filters produce identical digests", () => {
    const a: ProvenanceFilter = { mode: "combined" };
    const b: ProvenanceFilter = { mode: "combined" };
    expect(provenanceFilterDigest(a)).toBe(provenanceFilterDigest(b));
  });

  it("different modes produce different digests", () => {
    expect(provenanceFilterDigest({ mode: "production-only" })).not.toBe(
      provenanceFilterDigest({ mode: "simulated-only" }),
    );
    expect(provenanceFilterDigest({ mode: "production-only" })).not.toBe(
      provenanceFilterDigest({ mode: "combined" }),
    );
  });

  it("array-axis order does not affect the digest (canonicalisation)", () => {
    const a: ProvenanceFilter = {
      mode: "combined",
      scenarios: [scenarioId("a"), scenarioId("b")],
    };
    const b: ProvenanceFilter = {
      mode: "combined",
      scenarios: [scenarioId("b"), scenarioId("a")],
    };
    expect(provenanceFilterDigest(a)).toBe(provenanceFilterDigest(b));
  });

  it("empty arrays are treated identically to omitted arrays", () => {
    const a: ProvenanceFilter = { mode: "combined" };
    const b: ProvenanceFilter = { mode: "combined", scenarios: [], variants: [] };
    expect(provenanceFilterDigest(a)).toBe(provenanceFilterDigest(b));
  });

  it("effectiveStreamKey embeds the digest", () => {
    const filter: ProvenanceFilter = { mode: "production-only" };
    const eff = effectiveStreamKey("base/key", filter);
    expect(eff.startsWith("base/key#prov=")).toBe(true);
    expect(eff.endsWith(provenanceFilterDigest(filter))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Predicate behaviour for legacy untagged events
// ---------------------------------------------------------------------------

describe("Slice 2 — eventMatchesProvenanceFilter handles legacy untagged events", () => {
  it("treats untagged events as simulated for filter purposes", () => {
    const untagged = { event_id: "x" } as unknown as Event;
    expect(eventMatchesProvenanceFilter(untagged, { mode: "simulated-only" })).toBe(true);
    expect(eventMatchesProvenanceFilter(untagged, { mode: "production-only" })).toBe(false);
    expect(eventMatchesProvenanceFilter(untagged, { mode: "combined" })).toBe(true);
  });

  it("untagged events match the pre-substrate-build-phase scenario narrowing", () => {
    const untagged = { event_id: "x" } as unknown as Event;
    expect(
      eventMatchesProvenanceFilter(untagged, {
        mode: "simulated-only",
        scenarios: [scenarioId("pre-substrate-build-phase")],
      }),
    ).toBe(true);
    expect(
      eventMatchesProvenanceFilter(untagged, {
        mode: "simulated-only",
        scenarios: [scenarioId("01-hello-bank")],
      }),
    ).toBe(false);
  });
});
