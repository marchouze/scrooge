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
// Author: Atlas (platform plumbing) · Anya (data substrate)

import type { Event } from "../event-store/types";

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
 */
export interface Projection<S, E extends Event = Event> {
  readonly name: string;
  readonly initial: S;
  readonly accepts: EventFilter<E>;
  readonly reduce: Reducer<S, E>;
}

/** Replay options the projector forwards to the event store. */
export interface ProjectionReplayOpts {
  fromSequence?: number;
  entity?: string;
  asOf?: string; // upper bound (inclusive) on event.as_of (P1 — as-of replay)
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
