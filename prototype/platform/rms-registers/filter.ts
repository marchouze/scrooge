// platform/rms-registers/filter.ts
//
// Provenance filter helper for RMS register projections.
//
// Per the D-DATA-PROVENANCE-SUBSTRATE design (Slice 1 + Slice 6), every event
// envelope carries an optional typed `ProvenanceTag`. Register projections
// fold *all* events the projection accepts; mode-aware reads (production
// vs simulated, scenario-scoped, variant-scoped) are a *consumer-time*
// concern. Slice 3 of RMS exposes a small composable helper so consumers
// can pre-filter the event stream before handing it to a projection's
// reducer; the projection itself stays oblivious of provenance.
//
// The Slice-4 dashboard render is the primary consumer (mode-aware register
// views: "production-only Decisions", "scenario rehearsal-2026-Q1 Briefs"
// etc.). Today the helper is generic enough that any caller can compose it
// with `Projector.fold` or `replay({ ... })`.

import type { Event } from "../event-store/types";

/**
 * Opaque filter spec a consumer passes to `filterEventsByProvenance`.
 *
 *   - `kinds`: include only events whose `provenance.kind` is one of these.
 *     Events without provenance are dropped iff `kinds` is supplied (legacy
 *     untagged events are not "production" — they are unknown, see
 *     `D-DATA-PROVENANCE-SUBSTRATE` Slice 6).
 *   - `scenario`: include only events tagged with this scenario id.
 *   - `variant`: include only events tagged with this variant id.
 *   - `includeUntagged`: when true and `kinds` is set, untagged events
 *     are admitted (useful for replaying historical event logs that pre-date
 *     the substrate).
 */
export interface ProvenanceFilter {
  readonly kinds?: ReadonlyArray<"production" | "simulated">;
  readonly scenario?: string;
  readonly variant?: string;
  readonly includeUntagged?: boolean;
}

/**
 * Filter an iterable of events by their provenance tag.
 *
 * Pure / lazy: returns a generator. The projection runtime can fold the
 * filtered stream directly via `Projector.fold(p, p.initial, ...)` (the
 * runtime accepts any iterable through its `replay()` adapter; an
 * intermediate array is acceptable for register-sized event streams).
 */
export function* filterEventsByProvenance(
  events: Iterable<Event>,
  filter: ProvenanceFilter,
): IterableIterator<Event> {
  const noFilter =
    filter.kinds === undefined && filter.scenario === undefined && filter.variant === undefined;
  if (noFilter) {
    yield* events;
    return;
  }

  for (const event of events) {
    const tag = event.provenance;

    if (filter.kinds !== undefined) {
      if (tag === undefined) {
        if (!filter.includeUntagged) continue;
      } else if (!filter.kinds.includes(tag.kind)) {
        continue;
      }
    }

    if (filter.scenario !== undefined) {
      if (tag === undefined || tag.scenario !== filter.scenario) continue;
    }

    if (filter.variant !== undefined) {
      if (tag === undefined || tag.variant !== filter.variant) continue;
    }

    yield event;
  }
}
