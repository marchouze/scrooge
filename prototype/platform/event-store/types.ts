// platform/event-store/types.ts
//
// Event base type. Every event in the bank shares this shape.
//
// P1 — events are the only source of truth.
// P2 — every event must carry at least one citation to a register entry.
// P4 — events carry the typed actor for security audit.
// P5 — events carry the legal entity (jurisdictional context follows).
//
// D-DATA-PROVENANCE-SUBSTRATE Slice 1 — every event carries a typed
// `ProvenanceTag` (kind / scenario / variant / sourceLineage / tags).
// The schema marks the field optional so legacy callers + the soft-tagger
// path don't trip the Zod parse; the store's append() enforces presence
// when the substrate-active flag is true (Slice 1 hard-rejection,
// gated per the §7 ordering note).
//
// Author: Atlas

import { z } from "zod";

import { type ProvenanceTag, provenanceTagSchema } from "./provenance.ts";

export const actorSchema = z.object({
  type: z.enum(["system", "human", "service"]),
  id: z.string().min(1),
});

export const eventSchema = z.object({
  event_id: z.string().min(1),
  type: z.string().min(1),
  // ISO 8601 UTC. The event's effective business time. Processing time
  // (recorded_at) is set by the store and is separate.
  as_of: z.string().min(1),
  entity: z.string().min(1), // legal-entity identifier (e.g. BANK-ZA-001)
  actor: actorSchema,
  // P2: at least one citation required at append time.
  citations: z.array(z.string().min(1)).min(1, {
    message: "P2 violation: events must carry at least one obligations-register citation",
  }),
  payload: z.record(z.unknown()),
  // D-DATA-PROVENANCE-SUBSTRATE Slice 1: typed multi-axis provenance.
  // Marked optional at the schema level so the soft-tagger can still parse
  // legacy untagged appends; the store's append() enforces presence when
  // the substrate-active flag is true.
  provenance: provenanceTagSchema.optional(),
  // Aggregate identity — groups all events that belong to the same business
  // object (trade, decision, KYC case, …). Optional so existing emitters
  // need not change immediately; the backfill script derives deterministic
  // UUID v5s for historical events.
  aggregateId: z.string().uuid().optional(),
  aggregateLabel: z.string().min(1).optional(), // "<type>:<natural-id>"
});

export type Event = z.infer<typeof eventSchema>;
export type Actor = z.infer<typeof actorSchema>;

/** Re-export so consumers don't need a second import for the tag type. */
export type { ProvenanceTag };

/** Convenience — create an Event without forcing the payload to be unknown. */
export function makeEvent<P extends Record<string, unknown>>(
  e: Omit<Event, "payload"> & { payload: P },
): Event {
  return eventSchema.parse(e);
}
