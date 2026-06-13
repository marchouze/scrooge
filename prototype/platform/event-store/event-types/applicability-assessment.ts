// platform/event-store/event-types/applicability-assessment.ts
//
// V1-SIDE event-type definitions for the V2 S8 applicability-assessment event
// family. Lives on the V1 side and IMPORTS the canonical payload schemas FROM
// v2-core — the permitted dependency direction (v1→v2; v2-core never reaches
// back, enforced by `recon:v2-no-v1-import`). Registers the three assessment
// event kinds in the live event-type registry (F-032) so the
// `recon:v2-applicability-assessment-integrity` projection can replay them.
//
// Three event kinds:
//   ApplicabilityAssessmentRequested — a trigger opens an assessment
//   ApplicabilityAssessmentPerformed — the evaluator ran over candidate contexts
//   ApplicabilityAssessmentConcluded — the verdict + matched contexts
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// F-032 (new event types MUST register in `platform/event-store/registry/`).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import {
  applicabilityAssessmentConcludedPayloadSchema,
  applicabilityAssessmentPerformedPayloadSchema,
  applicabilityAssessmentRequestedPayloadSchema,
} from "../../../v2-core/applicability/events";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// Re-export the v2-core schemas so the v1 registry can reference them via this
// adapter module (single grammar source).
export {
  applicabilityAssessmentConcludedPayloadSchema,
  applicabilityAssessmentPerformedPayloadSchema,
  applicabilityAssessmentRequestedPayloadSchema,
};

export type ApplicabilityAssessmentRequestedPayload = ReturnType<
  typeof applicabilityAssessmentRequestedPayloadSchema.parse
>;
export type ApplicabilityAssessmentPerformedPayload = ReturnType<
  typeof applicabilityAssessmentPerformedPayloadSchema.parse
>;
export type ApplicabilityAssessmentConcludedPayload = ReturnType<
  typeof applicabilityAssessmentConcludedPayloadSchema.parse
>;

// ---------------------------------------------------------------------------
// Event factory helpers
// ---------------------------------------------------------------------------

function makeAssessmentEvent(args: {
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

export function makeApplicabilityAssessmentRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ApplicabilityAssessmentRequestedPayload;
  eventId?: string;
}): Event {
  return makeAssessmentEvent({
    ...args,
    type: "ApplicabilityAssessmentRequested",
    payload: applicabilityAssessmentRequestedPayloadSchema.parse(args.payload) as Record<
      string,
      unknown
    >,
  });
}

export function makeApplicabilityAssessmentPerformed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ApplicabilityAssessmentPerformedPayload;
  eventId?: string;
}): Event {
  return makeAssessmentEvent({
    ...args,
    type: "ApplicabilityAssessmentPerformed",
    payload: applicabilityAssessmentPerformedPayloadSchema.parse(args.payload) as Record<
      string,
      unknown
    >,
  });
}

export function makeApplicabilityAssessmentConcluded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ApplicabilityAssessmentConcludedPayload;
  eventId?: string;
}): Event {
  return makeAssessmentEvent({
    ...args,
    type: "ApplicabilityAssessmentConcluded",
    payload: applicabilityAssessmentConcludedPayloadSchema.parse(args.payload) as Record<
      string,
      unknown
    >,
  });
}

export const APPLICABILITY_ASSESSMENT_TYPED_EVENT_TYPES = [
  "ApplicabilityAssessmentRequested",
  "ApplicabilityAssessmentPerformed",
  "ApplicabilityAssessmentConcluded",
] as const;

export type ApplicabilityAssessmentEventType =
  (typeof APPLICABILITY_ASSESSMENT_TYPED_EVENT_TYPES)[number];
