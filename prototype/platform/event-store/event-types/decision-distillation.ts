// platform/event-store/event-types/decision-distillation.ts
//
// `DecisionDistilled` — WS-V2-BBAAS W1 decision-distillation event family.
//
// Classifies an existing `Decision` (by decisionId) along the v2
// "Bank Backbone as a Service" seam:
//   - foundational — defines the backbone; holds for any tenant bank
//     (substrate, platform, framework, discipline decisions).
//   - directional  — this specific bank's choices (products, calibrations,
//     regulatory posture, hires, data fixes).
//   - obsolete     — superseded or overtaken (latest phase no longer
//     approved, or explicitly superseded by a later decision).
//
// Semantics: LATEST event per decisionId wins — a re-classification is a
// new event, never a mutation (P1). The core-knowledge-base register at
// `platform/governance/decision-distillation/register.ts` is the fold.
//
// Authority: D-V2-BBAAS-W1-DECISION-DISTILLATION (CEO session-delegation
// 2026-06-12); D-V2-BBAAS-ANALYSIS-LAUNCH; P1-EVENTS-AS-TRUTH;
// P2-SINGLE-GRAPH-DISCIPLINE.
// Author: Owen (Company Secretary, governance).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";
import { decisionIdSchema } from "./decision";

/** The three distillation classes — the BBaaS shared-core seam. */
export const DECISION_DISTILLATION_CLASSES = [
  "foundational",
  "directional",
  "obsolete",
] as const;
export type DecisionDistillationClass = (typeof DECISION_DISTILLATION_CLASSES)[number];

export const decisionDistilledPayloadSchema = z.object({
  /** The classified decision, e.g. "D-RMS-PHASE-1". */
  decisionId: decisionIdSchema,
  /** foundational | directional | obsolete. */
  class: z.enum(DECISION_DISTILLATION_CLASSES),
  /** 1–3 short sentences: why it generalises / why it is tenant-specific /
   *  what superseded it. */
  rationale: z.string().min(1),
  /** Typed P2 citations (decision ids, principle paths, document URNs). */
  citations: z.array(z.string().min(1)).readonly(),
  /** Seat that performed the distillation, e.g. "company-secretary". */
  distilledBy: z.string().min(1),
  /** Workstream the classification belongs to, e.g. "WS-V2-BBAAS-W1". */
  workstream: z.string().min(1),
});
export type DecisionDistilledPayload = z.infer<typeof decisionDistilledPayloadSchema>;

export function makeDecisionDistilled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DecisionDistilledPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DecisionDistilled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: decisionDistilledPayloadSchema.parse(args.payload),
  });
}

export const DECISION_DISTILLATION_TYPED_EVENT_TYPES = ["DecisionDistilled"] as const;
export type DecisionDistillationEventType = (typeof DECISION_DISTILLATION_TYPED_EVENT_TYPES)[number];
