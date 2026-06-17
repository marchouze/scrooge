// platform/event-store/event-types/instance-election.ts
//
// V1-SIDE event-type definition for the per-instance accounting election event
// (`FilInstanceTreatmentElected`, FX3). This file lives on the V1 side and
// IMPORTS the canonical payload schema FROM the v2-core package — the permitted
// dependency direction (v1→v2; v2-core never reaches back, enforced by
// `recon:v2-no-v1-import`). It registers `FilInstanceTreatmentElected` in the
// live event-type registry (F-032: new event types MUST register in
// `platform/event-store/registry/`).
//
// Modelled on `event-types/reporting-treatments.ts` (the treatment-menu family).
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST. F-032 (event-type registration).
// Author: Atlas (Substrate Architect, engineering).

import { filInstanceTreatmentElectedSchema } from "../../../v2-core/reporting-treatments/instance-election";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

/**
 * The `FilInstanceTreatmentElected` payload — the v2-core schema is canonical;
 * this re-export keeps a single grammar source while giving the v1 registry a
 * local handle.
 */
export const filInstanceTreatmentElectedPayloadSchema = filInstanceTreatmentElectedSchema;

export type FilInstanceTreatmentElectedPayload = ReturnType<
  typeof filInstanceTreatmentElectedPayloadSchema.parse
>;

export function makeFilInstanceTreatmentElected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FilInstanceTreatmentElectedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FilInstanceTreatmentElected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: filInstanceTreatmentElectedPayloadSchema.parse(args.payload),
  });
}

export const INSTANCE_ELECTION_TYPED_EVENT_TYPES = ["FilInstanceTreatmentElected"] as const;
export type InstanceElectionEventType = (typeof INSTANCE_ELECTION_TYPED_EVENT_TYPES)[number];
