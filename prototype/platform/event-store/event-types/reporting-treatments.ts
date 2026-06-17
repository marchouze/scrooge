// platform/event-store/event-types/reporting-treatments.ts
//
// V1-SIDE event-type definition for the reporting-treatment menu declaration
// event (`ReportingTreatmentDeclared`). This file lives on the V1 side and
// IMPORTS the canonical payload schema FROM the v2-core package — the permitted
// dependency direction (v1→v2; v2-core never reaches back, enforced by
// `recon:v2-no-v1-import`). It registers `ReportingTreatmentDeclared` in the
// live event-type registry (F-032: new event types MUST register in
// `platform/event-store/registry/`) so the
// `recon:reporting-treatment-registry-conflict` projection can replay it.
//
// Modelled on `event-types/fil-models.ts` (the FIL-Models declaration family).
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST. F-032 (event-type registration).
// Author: Atlas (Substrate Architect, engineering).

import { reportingTreatmentDeclaredSchema } from "../../../v2-core/reporting-treatments/declaration";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

/**
 * The `ReportingTreatmentDeclared` payload — the v2-core schema is canonical;
 * this re-export keeps a single grammar source while giving the v1 registry a
 * local handle.
 */
export const reportingTreatmentDeclaredPayloadSchema = reportingTreatmentDeclaredSchema;

export type ReportingTreatmentDeclaredPayload = ReturnType<
  typeof reportingTreatmentDeclaredPayloadSchema.parse
>;

export function makeReportingTreatmentDeclared(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ReportingTreatmentDeclaredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ReportingTreatmentDeclared",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: reportingTreatmentDeclaredPayloadSchema.parse(args.payload),
  });
}

export const REPORTING_TREATMENT_TYPED_EVENT_TYPES = ["ReportingTreatmentDeclared"] as const;
export type ReportingTreatmentEventType = (typeof REPORTING_TREATMENT_TYPED_EVENT_TYPES)[number];
