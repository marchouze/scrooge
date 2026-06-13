// platform/event-store/event-types/v2-eval.ts
//
// V1-SIDE event-type definitions for the V2 S13 eval-harness event family.
// Lives on the V1 side and IMPORTS the canonical payload schemas FROM v2-core —
// the permitted dependency direction (v1→v2; v2-core never reaches back,
// enforced by `recon:v2-no-v1-import`). Registers the two eval event kinds in
// the live event-type registry (F-032) so the `recon:v2-eval-harness-integrity`
// projection can replay them.
//
// Two event kinds:
//   ExamSetRegistered — a named exam-set enters the assurance corpus
//   EvalRunCompleted  — an eval run's typed verdict-of-record
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-W4-MODEL-LIBRARY-PILOT;
//   D-W8-POSTURE-REGISTER-SLICE-1. F-032 (new event types MUST register in
//   `platform/event-store/registry/`).
// Author: Vera (Internal Audit Engineer, governance).

import {
  evalRunCompletedPayloadSchema,
  examSetRegisteredPayloadSchema,
} from "../../../v2-core/eval/events";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// Re-export the v2-core schemas so the v1 registry can reference them via this
// adapter module (keeps a single grammar source).
export { evalRunCompletedPayloadSchema, examSetRegisteredPayloadSchema };

export type ExamSetRegisteredPayload = ReturnType<typeof examSetRegisteredPayloadSchema.parse>;
export type EvalRunCompletedPayload = ReturnType<typeof evalRunCompletedPayloadSchema.parse>;

function makeEvalEvent(args: {
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

export function makeExamSetRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ExamSetRegisteredPayload;
  eventId?: string;
}): Event {
  return makeEvalEvent({
    ...args,
    type: "ExamSetRegistered",
    payload: examSetRegisteredPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makeEvalRunCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EvalRunCompletedPayload;
  eventId?: string;
}): Event {
  return makeEvalEvent({
    ...args,
    type: "EvalRunCompleted",
    payload: evalRunCompletedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export const V2_EVAL_TYPED_EVENT_TYPES = ["ExamSetRegistered", "EvalRunCompleted"] as const;
export type V2EvalEventType = (typeof V2_EVAL_TYPED_EVENT_TYPES)[number];
