// platform/projections/runtime.ts
//
// Local projection runtime. Replays events from the EventStore through a
// Projection's reducer to materialise its state. In-memory only at this
// stage — projection-cache persistence is M2 (Anya).
//
// Architectural seam (P6 — upward chain). Capability code depends only on
// the `Projector` interface. The cloud lift (M8) supplies a different
// `Projector` that reads from the cloud event substrate; reducers and
// projection definitions don't change.
//
// D-EVENT-STORE-SCALING Slice 3 — consumer adoption. The runtime now
// exposes `projectFromSnapshot()`: a per-stream snapshot-aware fold that
// loads the latest snapshot ≤ asOf for the projection's stream key,
// deserialises it as the projection's state, and folds the delta events
// (snapshot.uptoSequence + 1 → asOf) on top via `eventStore.replayFromSnapshot`.
// When no snapshot exists the path degrades to naive `build()` — guaranteed
// equivalent (asserted by `tests/projections-snapshot.test.ts`).
//
// The runtime also offers `maybeSnapshot()`: a cadence-driven snapshot
// emitter that calls `eventStore.shouldSnapshot()` and persists the
// projection's current state when the cadence-rule fires. Slice 2 froze the
// snapshot API surface; this runtime is a Slice-3 *consumer* of that
// surface, not an extension.
//
// Author: Atlas (Core banking platform architect, engineering — original)
//   · Anya (Data / analytics engineer, engineering — Slice 3 snapshot consumer wiring)

import type { EventStore, SnapshotRow } from "../event-store/store";
import type { Event } from "../event-store/types";
import { logger } from "../observability/logger";
import type {
  Projection,
  ProjectionReplayOpts,
  ProjectionSnapshotOpts,
  Projector,
  SnapshotEmissionResult,
  SnapshotProjectionOpts,
} from "./types";

export class LocalProjector implements Projector {
  constructor(private readonly store: EventStore) {}

  /**
   * Build a projection from its initial state by replaying every accepted
   * event in sequence order. P1 / P6.
   */
  build<S, E extends Event>(p: Projection<S, E>, opts: ProjectionReplayOpts = {}): S {
    return this.fold(p, p.initial, opts);
  }

  /**
   * Fold from a supplied seed state. Useful for incremental projection
   * updates (e.g. starting from a cached snapshot at `fromSequence`).
   */
  fold<S, E extends Event>(p: Projection<S, E>, initial: S, opts: ProjectionReplayOpts = {}): S {
    let state = initial;
    let seen = 0;
    let folded = 0;
    for (const event of this.store.replay(opts)) {
      seen++;
      if (!p.accepts(event)) continue;
      state = p.reduce(state, event);
      folded++;
    }
    logger.debug({ projection: p.name, seen, folded, opts }, "projection materialised");
    return state;
  }

  /**
   * Project from a per-stream snapshot — the Slice-3 fast path. Loads the
   * latest snapshot ≤ {asOf} for {streamKey}, deserialises its payload via
   * the projection's `decodeSnapshot`, then folds the delta-from-snapshot
   * events on top via `eventStore.replayFromSnapshot`.
   *
   * If no snapshot exists for the stream, degrades to `build()` — the
   * projection's full naive path. Equivalence is asserted by
   * `tests/projections-snapshot.test.ts` (snapshot path = naive path on
   * any (streamKey, asOf) pair).
   *
   * Cold-start use case: the projection runtime restarts (process exit,
   * Azure Function cold-start), the in-memory projection is gone, and the
   * runtime calls `projectFromSnapshot` to restore state without reading
   * the full event log. Continuing forward then folds new events on top
   * via the normal `build()` / `fold()` path.
   */
  projectFromSnapshot<S, E extends Event>(
    p: Projection<S, E>,
    opts: SnapshotProjectionOpts,
  ): { state: S; snapshot?: SnapshotRow; deltaCount: number } {
    if (!p.decodeSnapshot) {
      throw new Error(
        `projectFromSnapshot: projection '${p.name}' has no decodeSnapshot — cannot deserialise snapshot payload`,
      );
    }
    const snap = this.store.loadSnapshot(opts.streamKey, opts.asOf);
    if (!snap) {
      // No snapshot — degrade to naive replay. Caller still gets {state}
      // and a deltaCount that reflects "we read the whole log".
      let deltaCount = 0;
      let state: S = p.initial;
      for (const event of this.store.replay({
        asOf: opts.asOf,
        ...(opts.filter ?? {}),
      })) {
        deltaCount++;
        if (!p.accepts(event)) continue;
        state = p.reduce(state, event);
      }
      logger.debug(
        { projection: p.name, streamKey: opts.streamKey, asOf: opts.asOf, deltaCount, snapshot: null },
        "projection materialised from naive replay (no snapshot)",
      );
      return { state, deltaCount };
    }

    // Snapshot path — decode + fold delta on top.
    const seed = p.decodeSnapshot(snap.payload);
    let state: S = seed;
    let deltaCount = 0;
    for (const event of this.store.replayFromSnapshot({
      streamKey: opts.streamKey,
      asOf: opts.asOf,
      ...(opts.filter ? { filter: opts.filter } : {}),
    })) {
      deltaCount++;
      if (!p.accepts(event)) continue;
      state = p.reduce(state, event);
    }
    logger.debug(
      {
        projection: p.name,
        streamKey: opts.streamKey,
        asOf: opts.asOf,
        snapshotUpto: snap.uptoSequence,
        deltaCount,
      },
      "projection materialised from snapshot + delta",
    );
    return { state, snapshot: snap, deltaCount };
  }

  /**
   * Cadence-driven snapshot emitter. Asks the event store whether the
   * cadence rule for {eventType} has fired for {streamKey}; if so,
   * encodes the projection's current state via `encodeSnapshot` and
   * persists it. Idempotent — re-calling with the same
   * `(streamKey, asOf, uptoSequence)` triple returns the existing row.
   *
   * The caller owns the projection's current state — this runtime does
   * not maintain in-memory state across calls. Pattern:
   *   const result = projector.projectFromSnapshot(p, { streamKey, asOf });
   *   // ... fold further events forward, advancing `state` and `uptoSeq` ...
   *   projector.maybeSnapshot(p, { streamKey, asOf, uptoSequence: uptoSeq, state, eventType });
   */
  maybeSnapshot<S, E extends Event>(
    p: Projection<S, E>,
    opts: ProjectionSnapshotOpts<S>,
  ): SnapshotEmissionResult {
    if (!p.encodeSnapshot) {
      throw new Error(
        `maybeSnapshot: projection '${p.name}' has no encodeSnapshot — cannot serialise state`,
      );
    }
    const check = this.store.shouldSnapshot({
      streamKey: opts.streamKey,
      ...(opts.eventType ? { eventType: opts.eventType } : {}),
    });
    if (!check.shouldSnapshot) {
      return { emitted: false, reason: check.reason };
    }
    const payload = p.encodeSnapshot(opts.state);
    const row = this.store.snapshot({
      streamKey: opts.streamKey,
      asOf: opts.asOf,
      uptoSequence: opts.uptoSequence,
      payload,
    });
    logger.debug(
      {
        projection: p.name,
        streamKey: opts.streamKey,
        asOf: opts.asOf,
        uptoSequence: opts.uptoSequence,
        reason: check.reason,
      },
      "projection snapshot persisted",
    );
    return { emitted: true, reason: check.reason, snapshot: row };
  }
}
