// platform/event-store/event-types/entity-reclassified.ts
//
// EntityReclassified — typed audit event recording the reclassification
// of an existing event's `entity` envelope column from one entity ID to
// another (e.g. legacy `BANK-ZA-001` → canonical `LE-ZA-HOZ-BANK`).
//
// Authority:
//   - D-G2-ENTITY-ID-BACKFILL (CEO-approved 2026-05-22,
//     event `a507ce6e-de32-48be-9350-a8044ee0b16f`) — G-2 backfill:
//     all events with `entity = "BANK-ZA-001"` are migrated to
//     `entity = "LE-ZA-HOZ-BANK"`.
//   - Principle 1 — events are the only source of truth. The envelope
//     re-tag is a substrate-managed UPDATE (mirroring `reclassifyProvenance`);
//     the durable audit trail for the reclassification is this typed event.
//
// Authoring contract:
//   - The reclassification target event MUST exist in the event store at
//     emit time (callers verify before emitting; backfill script asserts).
//   - `priorEntity` and `newEntity` capture the envelope axis change.
//   - `reclassificationReason` is a free-text human-readable explanation.
//   - `decisionRef` cites the CEO decision authorising the move.
//   - `runRef` clusters all rows reclassified in one pass.
//
// Author: Atlas (Records & Documents Engineer, engineering — substrate)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Payload schema
// ---------------------------------------------------------------------------

export const entityReclassifiedPayloadSchema = z.object({
  /** event_id of the row whose entity field was reclassified. */
  targetEventId: z.string().min(1),

  /** Event type of the target row (denormalised for audit). */
  targetEventType: z.string().min(1),

  /** Previous `entity` value (e.g. `"BANK-ZA-001"`). */
  priorEntity: z.string().min(1),

  /** New `entity` value (e.g. `"LE-ZA-HOZ-BANK"`). */
  newEntity: z.string().min(1),

  /**
   * CEO decision authorising the reclassification
   * (e.g. `D-G2-ENTITY-ID-BACKFILL`).
   */
  decisionRef: z.string().min(1),

  /**
   * Free-text human-readable explanation for this reclassification.
   * Required so audit reviewers see the rationale without consulting
   * the script source.
   */
  reclassificationReason: z.string().min(1),

  /**
   * Hash / identifier of the script run that emitted this event, so a
   * recon can cluster all rows reclassified together. Convention:
   * `backfill:<script-name>:<runId>`.
   */
  runRef: z.string().min(1),
});

export type EntityReclassifiedPayload = z.infer<typeof entityReclassifiedPayloadSchema>;

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

export function makeEntityReclassified(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EntityReclassifiedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EntityReclassified",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: entityReclassifiedPayloadSchema.parse(args.payload),
  });
}

export const ENTITY_RECLASSIFIED_EVENT_TYPES = ["EntityReclassified"] as const;
export type EntityReclassifiedEventType = (typeof ENTITY_RECLASSIFIED_EVENT_TYPES)[number];
