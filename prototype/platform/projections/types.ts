// platform/projections/types.ts
//
// Projection types. A projection is a pure function over a stream of events.
// It is, by Principle 1, a *cache* — it can always be rebuilt by replaying
// the event log. The projection's state is never authoritative; the events
// are.
//
// P1 — events are the only source of truth. Projections are deterministic
//      functions over those events. As-of replay is supported by passing
//      `asOf` through to the EventStore.
// P6 — projections are *generated* (replayed), not assembled (downward
//      chain); capability code depends on this interface, not on a concrete
//      runtime (upward chain). The cloud lift swaps the runtime; reducers
//      stay identical.
//
// D-EVENT-STORE-SCALING Slice 3 (consumer adoption) — projections gain an
// optional snapshot codec (`encodeSnapshot` / `decodeSnapshot`). When
// supplied, the runtime can persist + restore the projection's state via
// `eventStore.snapshot()` / `loadSnapshot()`, collapsing rebuild cost from
// O(N_events) to O(snapshot + delta).
//
// D-DATA-PROVENANCE-SUBSTRATE Slice 2 — every projection-runtime call
// site declares its `ProvenanceFilter`. The filter narrows the events
// folded into the projection state and is included (as a structural
// digest) in the effective snapshot stream key, so a snapshot computed
// under `production-only` is never returned to a `simulated-only`
// request. The filter is *optional* on the opts surface for
// backward-compatibility; when omitted the runtime computes
// `defaultProvenanceFilter()` from the `BANK_PHASE` env var (see
// `filter.ts`).
//
// Author: Atlas (platform plumbing) · Anya (data substrate; Slice 3 codec
// + Slice 2 provenance filter)

import type { SnapshotRow } from "../event-store/store";
import type { Event } from "../event-store/types";
import type { ProvenanceFilter } from "./filter";

/**
 * A reducer is a *pure* function from (state, event) → state. It must be
 * deterministic and side-effect-free; the runtime calls it many times with
 * the same inputs (e.g. as-of replay, recon) and expects the same output.
 */
export type Reducer<S, E extends Event = Event> = (state: S, event: E) => S;

/**
 * A predicate that narrows an Event to the subset the projection cares
 * about. Used by the runtime to skip unrelated events efficiently.
 */
export type EventFilter<E extends Event = Event> = (event: Event) => event is E;

/**
 * A Projection is the full definition: its name, initial state, the events
 * it cares about, and the reducer that folds them into state.
 *
 * `name` is used for telemetry and (later) as the cache table key when
 * projections are persisted. Names should be stable across replays.
 *
 * Optional snapshot codec (D-EVENT-STORE-SCALING Slice 3). When supplied,
 * the projection can be persisted to the event store's snapshot substrate
 * and restored via `Projector.projectFromSnapshot`. Codec contract:
 *   - `encodeSnapshot(state)` → JSON-string suitable for `SnapshotOpts.payload`.
 *   - `decodeSnapshot(payload)` → typed state, equivalent to a fresh
 *     fold over the events the snapshot covers.
 * Round-trip is asserted by the snapshot equivalence test for any
 * projection that defines both.
 */
export interface Projection<S, E extends Event = Event> {
  readonly name: string;
  readonly initial: S;
  readonly accepts: EventFilter<E>;
  readonly reduce: Reducer<S, E>;
  /** Snapshot encoder — serialise state to a JSON-string payload. */
  readonly encodeSnapshot?: (state: S) => string;
  /** Snapshot decoder — re-hydrate state from a serialised payload. */
  readonly decodeSnapshot?: (payload: string) => S;
}

/** Replay options the projector forwards to the event store. */
export interface ProjectionReplayOpts {
  fromSequence?: number;
  entity?: string;
  asOf?: string; // upper bound (inclusive) on event.as_of (P1 — as-of replay)
}

/**
 * Snapshot-projection opts — the inputs to `Projector.projectFromSnapshot`.
 * `streamKey` and `asOf` are forwarded to `eventStore.replayFromSnapshot`;
 * `filter` narrows the delta replay (e.g. to a specific entity / event
 * type); the consumer is responsible for choosing a filter equivalent to
 * its naive replay path.
 *
 * D-DATA-PROVENANCE-SUBSTRATE Slice 2 — `provenanceFilter` selects the
 * projection's read-time provenance mode (production-only / simulated-
 * only / combined) and any scenario / variant / lineage narrowing.
 * Optional on this surface for backward compatibility; when omitted the
 * runtime applies `defaultProvenanceFilter()` (env-derived from
 * `BANK_PHASE`). The filter digest rides inside the effective stream
 * key the runtime passes to the snapshot APIs, so cross-mode snapshots
 * never cross-contaminate.
 */
export interface SnapshotProjectionOpts {
  readonly streamKey: string;
  readonly asOf: string;
  readonly filter?: { entity?: string; type?: string };
  readonly provenanceFilter?: ProvenanceFilter;
}

/**
 * Snapshot-emission opts — the inputs to `Projector.maybeSnapshot`. The
 * caller owns the projection's current state; the runtime asks the event
 * store whether the cadence rule for `eventType` has fired for `streamKey`,
 * and if so persists the encoded state.
 */
export interface ProjectionSnapshotOpts<S> {
  readonly streamKey: string;
  readonly asOf: string;
  readonly uptoSequence: number;
  readonly state: S;
  /** Resolves the cadence rule used by `EventStore.shouldSnapshot`. When
   *  omitted the store falls back to `DEFAULT_SNAPSHOT_CADENCE`. */
  readonly eventType?: string;
  /** D-DATA-PROVENANCE-SUBSTRATE Slice 2 — provenance filter under which
   *  `state` was computed. Rides inside the effective snapshot stream
   *  key so cross-mode snapshots never cross-contaminate. Optional on
   *  the opts surface for backward compatibility; when omitted the
   *  runtime applies `defaultProvenanceFilter()`. */
  readonly provenanceFilter?: ProvenanceFilter;
}

/** Outcome of a `maybeSnapshot` call. */
export interface SnapshotEmissionResult {
  readonly emitted: boolean;
  readonly reason: string;
  readonly snapshot?: SnapshotRow;
}

/**
 * The projector materialises a Projection by replaying events through its
 * reducer. The local implementation (`runtime.ts`) reads from the SQLite
 * event store; the cloud implementation (M8) reads from the cloud event
 * substrate via the same `EventStore` interface — no reducer change.
 */
export interface Projector {
  build<S, E extends Event>(p: Projection<S, E>, opts?: ProjectionReplayOpts): S;
  fold<S, E extends Event>(p: Projection<S, E>, initial: S, opts?: ProjectionReplayOpts): S;
  /** D-EVENT-STORE-SCALING Slice 3 — snapshot-aware projection.
   *
   *  D-DATA-PROVENANCE-SUBSTRATE Slice 2 — the result includes the
   *  resolved `provenanceFilter` so consumers can confirm which mode
   *  the state was computed under (esp. when the runtime resolved the
   *  default rather than the consumer supplying one explicitly). */
  projectFromSnapshot<S, E extends Event>(
    p: Projection<S, E>,
    opts: SnapshotProjectionOpts,
  ): { state: S; snapshot?: SnapshotRow; deltaCount: number; provenanceFilter: ProvenanceFilter };
  /** D-EVENT-STORE-SCALING Slice 3 — cadence-driven snapshot emit. */
  maybeSnapshot<S, E extends Event>(
    p: Projection<S, E>,
    opts: ProjectionSnapshotOpts<S>,
  ): SnapshotEmissionResult;
}

/**
 * Convenience accept-all filter for projections that fold every event.
 * Most domain projections will narrow on `event.type`.
 */
export const acceptAll: EventFilter = (_event): _event is Event => true;

/**
 * Build an `accepts` predicate that narrows on a specific event type. The
 * type parameter `E` lets the reducer see the narrowed payload shape.
 */
export function acceptType<E extends Event>(typeName: E["type"]): EventFilter<E> {
  return (e): e is E => e.type === typeName;
}
