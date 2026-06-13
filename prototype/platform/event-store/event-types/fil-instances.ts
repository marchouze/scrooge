// platform/event-store/event-types/fil-instances.ts
//
// V1-SIDE event-type definitions for the FIL instance lifecycle event family
// (WS-V2-BBAAS, FIL-instance materialisation). This file lives on the V1 side
// and IMPORTS the canonical payload schemas FROM the v2-core package — the
// permitted dependency direction (v1→v2; v2-core never reaches back, enforced
// by `recon:v2-no-v1-import`). It registers the three lifecycle event types in
// the live event-type registry (F-032: new event types MUST register in
// `platform/event-store/registry/`).
//
//   FilInstrumentCreated     — first lifecycle event for a FIL instance
//   FilInstrumentAmended     — in-life economic change
//   FilInstrumentTerminated  — terminal transition (settled/matured/cancelled)
//
// These are REAL anchor-book records (category `governance`/production — see
// `provenance-category.ts`), NOT simulated. They are emitted ONLY into the v2
// anchor store (`BANK_V2_ANCHOR_DB`); they NEVER touch the v1 canonical store.
//
// THREE-SITE REGISTRATION (recurring gotcha — a prior slice registered 2/3 and
// broke a seed): this is SITE 1 of 3.
//   1. event-types  → this file (schemas + make* + kind list)
//   2. registry     → registry/fil-instances.ts (EventTypeMetadata rows)
//   3. provenance   → provenance-category.ts (each kind → `governance`)
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS. F-032 (event-type registration).
// Author: Atlas (Substrate Architect, engineering).

import {
  filInstrumentAmendedPayloadSchema,
  filInstrumentCreatedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
} from "../../../v2-core/fil-instances/events";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// Re-export the v2-core schemas as the canonical payload grammar (single source).
export const filInstrumentCreatedPayload = filInstrumentCreatedPayloadSchema;
export const filInstrumentAmendedPayload = filInstrumentAmendedPayloadSchema;
export const filInstrumentTerminatedPayload = filInstrumentTerminatedPayloadSchema;

export type FilInstrumentCreatedEventPayload = ReturnType<
  typeof filInstrumentCreatedPayloadSchema.parse
>;
export type FilInstrumentAmendedEventPayload = ReturnType<
  typeof filInstrumentAmendedPayloadSchema.parse
>;
export type FilInstrumentTerminatedEventPayload = ReturnType<
  typeof filInstrumentTerminatedPayloadSchema.parse
>;

export function makeFilInstrumentCreated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FilInstrumentCreatedEventPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FilInstrumentCreated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: filInstrumentCreatedPayloadSchema.parse(args.payload),
  });
}

export function makeFilInstrumentAmended(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FilInstrumentAmendedEventPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FilInstrumentAmended",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: filInstrumentAmendedPayloadSchema.parse(args.payload),
  });
}

export function makeFilInstrumentTerminated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FilInstrumentTerminatedEventPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FilInstrumentTerminated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: filInstrumentTerminatedPayloadSchema.parse(args.payload),
  });
}

export const FIL_INSTANCE_TYPED_EVENT_TYPES = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
] as const;
export type FilInstanceEventType = (typeof FIL_INSTANCE_TYPED_EVENT_TYPES)[number];
