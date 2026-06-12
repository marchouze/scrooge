// platform/event-store/event-types/fil-models.ts
//
// V1-SIDE event-type definition for the FIL-Models declaration event family
// (V2 S0). This file lives on the V1 side and IMPORTS the canonical payload
// schema FROM the v2-core package — the permitted dependency direction (v1→v2;
// v2-core never reaches back, enforced by `recon:v2-no-v1-import`). It registers
// `FilModelImplementationDeclared` in the live event-type registry (F-032: new
// event types MUST register in `platform/event-store/registry/`) so the
// `recon:fil-conformance` projection can replay it.
//
// S0 SCOPE: the event TYPE is registered; the register starts EMPTY (no
// declaration is emitted in S0 — SA-CCR is the first, landed by S7-FIL). NO
// live-bus handler subscribes to it here (brief §"Out of scope": no live-bus
// handler registration).
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION (FIL-Models registry, §3);
// D-V2-REPO-STRATEGY-REEXAMINATION (S0). F-032 (event-type registration).
// Author: Atlas (Core banking platform architect, engineering).

import { filModelImplementationDeclaredSchema } from "../../../v2-core/fil-models/declaration";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

/**
 * The `FilModelImplementationDeclared` payload — the v2-core schema is
 * canonical; this re-export keeps a single grammar source while giving the v1
 * registry a local handle.
 */
export const filModelImplementationDeclaredPayloadSchema = filModelImplementationDeclaredSchema;

export type FilModelImplementationDeclaredPayload = ReturnType<
  typeof filModelImplementationDeclaredPayloadSchema.parse
>;

export function makeFilModelImplementationDeclared(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FilModelImplementationDeclaredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FilModelImplementationDeclared",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: filModelImplementationDeclaredPayloadSchema.parse(args.payload),
  });
}

export const FIL_MODELS_TYPED_EVENT_TYPES = ["FilModelImplementationDeclared"] as const;
export type FilModelsEventType = (typeof FIL_MODELS_TYPED_EVENT_TYPES)[number];
