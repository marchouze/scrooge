// platform/event-store/event-types/provenance-reclassified.ts
//
// ProvenanceReclassified — typed audit event recording the reclassification
// of an existing event's provenance tag from one `ProvenanceKind` to another.
//
// Authority:
//   - D-PROVENANCE-BUILD-PHASE-CLASS (CEO-approved 2026-05-22,
//     event `138a7570-be2a-4d0a-8762-c060c345ff15`) — Slice 2 backfill +
//     Slice 5 commencement-of-trading migration both emit this event type.
//   - D-DATA-PROVENANCE-SUBSTRATE (CEO-approved 2026-05-10) — provenance is
//     a typed envelope axis, not a payload field; reclassification preserves
//     the original event_id and is recorded via this audit event.
//   - Principle 1 — events are the only source of truth. The envelope
//     re-tag is a substrate-managed UPDATE (mirroring the Slice-6 soft-
//     tagger's healing UPDATE on `provenance IS NULL` rows); the durable
//     audit trail for the reclassification is this typed event.
//
// Lifecycle scope:
//   - Slice 2 (this PR): re-tag genuine build-phase fixture rows from
//     `simulated` → `build-phase-fixture` so M2 reports populate during the
//     build phase under the production-only filter.
//   - Slice 5 (later): re-tag surviving `build-phase-fixture` rows to
//     `production` at commencement-of-trading via the same event family.
//
// Authoring contract:
//   - The reclassification target event MUST exist in the event store at
//     emit time (callers verify before emitting; backfill script asserts).
//   - The `priorKind` and `newKind` fields capture the envelope axis change.
//   - The `priorSourceLineage` and `newSourceLineage` fields are required
//     so the audit trail is self-contained (no need to replay the prior
//     row to recover the lineage tag).
//   - `reclassificationReason` is a free-text human-readable explanation;
//     `decisionRef` cites the CEO decision authorising the move (e.g.
//     `D-PROVENANCE-BUILD-PHASE-CLASS`).
//
// Author: Atlas (Records & Documents Engineer, engineering — substrate)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Payload schema
// ---------------------------------------------------------------------------

const provenanceKindEnum = z.enum(["production", "simulated", "build-phase-fixture"]);

export const provenanceReclassifiedPayloadSchema = z.object({
  /** event_id of the row whose provenance tag was reclassified. */
  targetEventId: z.string().min(1),

  /** Event type of the target row (denormalised for audit). */
  targetEventType: z.string().min(1),

  /** Previous `ProvenanceKind` value. */
  priorKind: provenanceKindEnum,

  /** Previous `sourceLineage` value. */
  priorSourceLineage: z.string().min(1),

  /** Previous `scenario` value, if any. */
  priorScenario: z.string().min(1).optional(),

  /** New `ProvenanceKind` value. */
  newKind: provenanceKindEnum,

  /** New `sourceLineage` value. */
  newSourceLineage: z.string().min(1),

  /** New `scenario` value, if any. */
  newScenario: z.string().min(1).optional(),

  /**
   * CEO decision authorising the reclassification (e.g.
   * `D-PROVENANCE-BUILD-PHASE-CLASS`).
   */
  decisionRef: z.string().min(1),

  /**
   * Free-text human-readable explanation for this reclassification
   * (e.g. "build-phase fixture identified by sourceLineage allowlist —
   * Slice 2 backfill"). Required so audit reviewers see the rationale
   * without consulting the script source.
   */
  reclassificationReason: z.string().min(1),

  /**
   * Hash / identifier of the script run that emitted this event, so a
   * recon can cluster all rows reclassified together. Convention:
   * `backfill:<script-name>:<runId>` (e.g.
   * `backfill:build-phase-fixture-provenance:2026-05-22T...`).
   */
  runRef: z.string().min(1),
});

export type ProvenanceReclassifiedPayload = z.infer<typeof provenanceReclassifiedPayloadSchema>;

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

export function makeProvenanceReclassified(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProvenanceReclassifiedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProvenanceReclassified",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: provenanceReclassifiedPayloadSchema.parse(args.payload),
  });
}

export const PROVENANCE_RECLASSIFIED_EVENT_TYPES = ["ProvenanceReclassified"] as const;
export type ProvenanceReclassifiedEventType = (typeof PROVENANCE_RECLASSIFIED_EVENT_TYPES)[number];
