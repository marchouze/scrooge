// platform/event-store/event-types/context-pack.ts
//
// V1-SIDE event-type definitions for the V2 W8 Slice D context-pack event
// family. Lives on the V1 side and IMPORTS the canonical payload schema FROM
// v2-core — the permitted dependency direction (v1→v2; v2-core never reaches
// back, enforced by `recon:v2-no-v1-import`). Registers ContextPackBuilt in
// the live event-type registry (F-032) so the `recon:context-pack-freshness`
// gate can replay it.
//
// One event kind:
//   ContextPackBuilt — a per-seat context pack was built and emitted.
//
// Authority: D-W8-PARAMETRIC-TRAINING-POSITION; D-W8-EXAM-GOVERNANCE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// F-032 (new event types MUST register in `platform/event-store/registry/`).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import { contextPackBuiltPayloadSchema } from "../../../v2-core/context-pack/events";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// Re-export so callers use the single canonical schema.
export { contextPackBuiltPayloadSchema };

export type ContextPackBuiltPayload = ReturnType<typeof contextPackBuiltPayloadSchema.parse>;

// ---------------------------------------------------------------------------
// Event factory helper
// ---------------------------------------------------------------------------

export function makeContextPackBuilt(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ContextPackBuiltPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ContextPackBuilt",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: contextPackBuiltPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export const CONTEXT_PACK_TYPED_EVENT_TYPES = ["ContextPackBuilt"] as const;
export type ContextPackEventType = (typeof CONTEXT_PACK_TYPED_EVENT_TYPES)[number];
