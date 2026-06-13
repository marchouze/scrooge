// platform/event-store/event-types/decision-impact-sweep.ts
//
// V1-SIDE event-type definitions for the V2 S9 decision-impact sweep event
// family. Lives on the V1 side and IMPORTS the canonical payload schemas FROM
// v2-core — the permitted dependency direction (v1→v2; v2-core never reaches
// back, enforced by `recon:v2-no-v1-import`). Registers the two sweep event
// kinds in the live event-type registry (F-032) so the
// `recon:v2-decision-impact-sweep-coverage` projection can replay them.
//
// Two event kinds:
//   DecisionImpactSweepRequested — a Decision triggers a sweep
//   DecisionImpactAssessed       — the computed impact set + recommended actions
//
// Authority: D-W8-DECISION-IMPACT-SWEEP (CEO-approved 2026-06-13);
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// F-032 (new event types MUST register in `platform/event-store/registry/`).
// Author: Owen (Company Secretary, governance), with Atlas (Substrate
//         Architect, engineering).

import {
  decisionImpactAssessedPayloadSchema,
  decisionImpactSweepRequestedPayloadSchema,
} from "../../../v2-core/decision-impact/events";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// Re-export the v2-core schemas so the v1 registry can reference them via this
// adapter module (single grammar source).
export { decisionImpactAssessedPayloadSchema, decisionImpactSweepRequestedPayloadSchema };

export type DecisionImpactSweepRequestedPayload = ReturnType<
  typeof decisionImpactSweepRequestedPayloadSchema.parse
>;
export type DecisionImpactAssessedPayload = ReturnType<
  typeof decisionImpactAssessedPayloadSchema.parse
>;

// ---------------------------------------------------------------------------
// Event factory helpers
// ---------------------------------------------------------------------------

function makeSweepEvent(args: {
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

export function makeDecisionImpactSweepRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DecisionImpactSweepRequestedPayload;
  eventId?: string;
}): Event {
  return makeSweepEvent({
    ...args,
    type: "DecisionImpactSweepRequested",
    payload: decisionImpactSweepRequestedPayloadSchema.parse(args.payload) as Record<
      string,
      unknown
    >,
  });
}

export function makeDecisionImpactAssessed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DecisionImpactAssessedPayload;
  eventId?: string;
}): Event {
  return makeSweepEvent({
    ...args,
    type: "DecisionImpactAssessed",
    payload: decisionImpactAssessedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export const DECISION_IMPACT_SWEEP_TYPED_EVENT_TYPES = [
  "DecisionImpactSweepRequested",
  "DecisionImpactAssessed",
] as const;

export type DecisionImpactSweepEventType = (typeof DECISION_IMPACT_SWEEP_TYPED_EVENT_TYPES)[number];
