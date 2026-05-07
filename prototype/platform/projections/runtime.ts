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
// Author: Atlas

import type { EventStore } from "../event-store/store";
import type { Event } from "../event-store/types";
import { logger } from "../observability/logger";
import type { Projection, ProjectionReplayOpts, Projector } from "./types";

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
}
