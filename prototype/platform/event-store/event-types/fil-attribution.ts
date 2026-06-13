// platform/event-store/event-types/fil-attribution.ts
//
// V1-SIDE event-type definitions for the FIL attribution event family
// (WS-V2-BBAAS, A1 kernel — dimensional metric-attribution layer). This file
// lives on the V1 side and IMPORTS the canonical payload schemas FROM the
// v2-core package — the permitted dependency direction (v1→v2; v2-core never
// reaches back, enforced by `recon:v2-no-v1-import`). It registers the two new
// event types in the live event-type registry (F-032: new event types MUST
// register in `platform/event-store/registry/`).
//
//   InstrumentDimensionAssigned — an organisational attribution dimension value
//     is asserted (or re-asserted) for a FIL instance, effective from an instant
//     (a book transfer / desk move / strategy re-tag is a new event, not a
//     mutation — Principle 1).
//   SliceDefined — a named / persistent slice (book / portfolio / consolidation)
//     is registered as a STORED PREDICATE (never a stored number).
//
// These are REAL anchor-book governance records (category `governance`/production
// — see `provenance-category.ts`), NOT simulated. They are emitted into the v2
// anchor store.
//
// THREE-SITE REGISTRATION (recurring F-032 gotcha — a prior slice registered 2/3
// and broke a seed): this is SITE 1 of 3.
//   1. event-types  → this file (schemas + make* + kind list)
//   2. registry     → registry/fil-attribution.ts (EventTypeMetadata rows)
//   3. provenance   → provenance-category.ts (each kind → `governance`)
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-METRIC-ATTRIBUTION-DIMENSIONAL;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS. F-032 (event-type registration).
// Author: Atlas (Core banking platform architect, engineering).

import {
  instrumentDimensionAssignedPayloadSchema,
  sliceDefinedPayloadSchema,
} from "../../../v2-core/fil-attribution/events";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// Re-export the v2-core schemas as the canonical payload grammar (single source).
export const instrumentDimensionAssignedPayload = instrumentDimensionAssignedPayloadSchema;
export const sliceDefinedPayload = sliceDefinedPayloadSchema;

export type InstrumentDimensionAssignedEventPayload = ReturnType<
  typeof instrumentDimensionAssignedPayloadSchema.parse
>;
export type SliceDefinedEventPayload = ReturnType<typeof sliceDefinedPayloadSchema.parse>;

export function makeInstrumentDimensionAssigned(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: InstrumentDimensionAssignedEventPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "InstrumentDimensionAssigned",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: instrumentDimensionAssignedPayloadSchema.parse(args.payload),
  });
}

export function makeSliceDefined(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SliceDefinedEventPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SliceDefined",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: sliceDefinedPayloadSchema.parse(args.payload),
  });
}

export const FIL_ATTRIBUTION_TYPED_EVENT_TYPES = [
  "InstrumentDimensionAssigned",
  "SliceDefined",
] as const;
export type FilAttributionEventType = (typeof FIL_ATTRIBUTION_TYPED_EVENT_TYPES)[number];
