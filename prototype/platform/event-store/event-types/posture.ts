// platform/event-store/event-types/posture.ts
//
// V1-SIDE event-type definitions for the V2 S3 posture register event family.
// Lives on the V1 side and IMPORTS the canonical payload schemas FROM v2-core —
// the permitted dependency direction (v1→v2; v2-core never reaches back,
// enforced by `recon:v2-no-v1-import`). Registers the four posture event kinds
// in the live event-type registry (F-032) so the `recon:v2-posture-register-
// integrity` projection can replay them.
//
// Four event kinds:
//   PostureRegistered  — new posture enters the register
//   PostureActivated   — registered posture becomes active for a scope
//   PostureDeactivated — posture retired for a scope
//   PostureRevised     — posture parameters updated
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// F-032 (new event types MUST register in `platform/event-store/registry/`).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import {
  postureActivatedPayloadSchema,
  postureDeactivatedPayloadSchema,
  postureRegisteredPayloadSchema,
  postureRevisedPayloadSchema,
} from "../../../v2-core/posture/events";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// Re-export the v2-core schemas so the v1 registry can reference them via this
// adapter module (keeps a single grammar source).
export {
  postureActivatedPayloadSchema,
  postureDeactivatedPayloadSchema,
  postureRegisteredPayloadSchema,
  postureRevisedPayloadSchema,
};

export type PostureRegisteredPayload = ReturnType<typeof postureRegisteredPayloadSchema.parse>;
export type PostureActivatedPayload = ReturnType<typeof postureActivatedPayloadSchema.parse>;
export type PostureDeactivatedPayload = ReturnType<typeof postureDeactivatedPayloadSchema.parse>;
export type PostureRevisedPayload = ReturnType<typeof postureRevisedPayloadSchema.parse>;

// ---------------------------------------------------------------------------
// Event factory helpers
// ---------------------------------------------------------------------------

function makePostureEvent(args: {
  type: string;
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: Record<string, unknown>;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: args.type,
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: args.payload,
  });
}

export function makePostureRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PostureRegisteredPayload;
  eventId?: string;
}): Event {
  return makePostureEvent({
    ...args,
    type: "PostureRegistered",
    payload: postureRegisteredPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makePostureActivated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PostureActivatedPayload;
  eventId?: string;
}): Event {
  return makePostureEvent({
    ...args,
    type: "PostureActivated",
    payload: postureActivatedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makePostureDeactivated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PostureDeactivatedPayload;
  eventId?: string;
}): Event {
  return makePostureEvent({
    ...args,
    type: "PostureDeactivated",
    payload: postureDeactivatedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makePostureRevised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PostureRevisedPayload;
  eventId?: string;
}): Event {
  return makePostureEvent({
    ...args,
    type: "PostureRevised",
    payload: postureRevisedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export const POSTURE_TYPED_EVENT_TYPES = [
  "PostureRegistered",
  "PostureActivated",
  "PostureDeactivated",
  "PostureRevised",
] as const;

export type PostureEventType = (typeof POSTURE_TYPED_EVENT_TYPES)[number];
