// platform/event-store/event-types/obligation-review.ts
//
// Obligation-review event family — Mira's LLM-extraction pipeline emits
// `ObligationReviewMatched`, `ObligationReviewConflict`, and
// `ObligationCandidateProposed` against existing rows in
// `Regulations/_obligations-register.md`. A governance seat (or Marc as
// build-phase fallback) emits `ObligationReviewCompleted` when a queued
// row is reviewed.
//
// Asymmetric coupling — the events are advisory: the pipeline measures
// the gap between an LLM extraction and the register, but does not
// silently mutate the register. Closure flows through human (or
// governance-seat) review captured in `ObligationReviewCompleted`.
//
// Authority:
//   - D-OBLIGATION-REVIEW-SUBSTRATE (CEO-approved 2026-05-21 via session
//     delegation; event b913e7c0-99f0-4864-9645-54b96510718a).
//   - D-KG-GRAPHITI-ADOPT (CEO-approved 2026-05-21 via session
//     delegation; LLM-pipeline-as-graph adopter).
//   - P2-SINGLE-GRAPH-DISCIPLINE (Principle 2 — every artefact carries
//     a typed citation; Regulation → Obligation → review event chain).
//   - P1-EVENTS-AS-TRUTH (Principle 1).
//
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

/**
 * Obligations-register domain — the alphabetical-section header in
 * `Regulations/_obligations-register.md` (A = Prudential, B = AML/CFT,
 * C = Excon, D = Conduct, E = Cybersecurity, F = Governance, G = Tax,
 * H = Markets / IFRS, I = HR / employment, J = Markets / exchange-rule).
 * The pipeline emits the bare letter; a future register read-side may
 * expand to the long form.
 */
export const obligationReviewDomainSchema = z.enum([
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
]);
export type ObligationReviewDomain = z.infer<typeof obligationReviewDomainSchema>;

/** Outcome selected by the reviewer when closing a queued obligation. */
export const obligationReviewCompletedStatusSchema = z.enum([
  "reviewed-confirmed",
  "reviewed-modified",
  "reviewed-retired",
]);
export type ObligationReviewCompletedStatus = z.infer<typeof obligationReviewCompletedStatusSchema>;

// ---------------------------------------------------------------------------
// ObligationReviewMatched
// ---------------------------------------------------------------------------

export const obligationReviewMatchedPayloadSchema = z.object({
  /** URN of the existing register row the LLM extraction matches. */
  existingObligationUrn: z.string().min(1),
  /** Instrument the LLM extraction was drawn from (e.g. `BANKS-ACT-94-1990`). */
  instrumentId: z.string().min(1),
  /** Section reference within the instrument (e.g. `s.60(5)(a)`). */
  sectionRef: z.string().min(1),
  /** Event ID of the upstream LLM-extraction event (Mira's pipeline). */
  llmExtractionEventId: z.string().min(1),
  /** Confidence score 0..1; tighter than `applicabilityScore`. */
  matchConfidence: z.number().min(0).max(1),
  /** One-line rationale (why the LLM treated this as a match). */
  rationale: z.string().min(1),
});
export type ObligationReviewMatchedPayload = z.infer<typeof obligationReviewMatchedPayloadSchema>;

export function makeObligationReviewMatched(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ObligationReviewMatchedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ObligationReviewMatched",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: obligationReviewMatchedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ObligationReviewConflict
// ---------------------------------------------------------------------------

export const obligationReviewConflictPayloadSchema = z.object({
  /** URN of the existing register row whose content disagrees. */
  existingObligationUrn: z.string().min(1),
  instrumentId: z.string().min(1),
  sectionRef: z.string().min(1),
  llmExtractionEventId: z.string().min(1),
  /** Fields whose values differ between register and LLM extraction. */
  conflictFields: z.array(z.string().min(1)).min(1),
  /** Existing register cell value(s), keyed by field. */
  existingValue: z.record(z.string(), z.string()),
  /** LLM-proposed cell value(s), keyed by field. */
  proposedValue: z.record(z.string(), z.string()),
  /** One-line rationale (why the LLM thinks the register is stale). */
  rationale: z.string().min(1),
});
export type ObligationReviewConflictPayload = z.infer<typeof obligationReviewConflictPayloadSchema>;

export function makeObligationReviewConflict(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ObligationReviewConflictPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ObligationReviewConflict",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: obligationReviewConflictPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ObligationCandidateProposed
// ---------------------------------------------------------------------------

/**
 * Full proposed obligation row — the columns the register carries today
 * (12-column schema; pre-Owen `WS-URN-VOCABULARY` column extension). The
 * shape is intentionally loose (`z.record`) so we accept whatever the
 * LLM pipeline produces; the review step is where the row is normalised
 * before being inserted into the register.
 */
export const obligationProposedFieldsSchema = z
  .object({
    requirement: z.string().min(1),
    citation: z.string().min(1),
    fulfilmentPolicy: z.string().optional(),
    owner: z.string().optional(),
    status: z.string().optional(),
    bindTrigger: z.string().optional(),
    entityScope: z.string().optional(),
    appliesAt: z.string().optional(),
    productScope: z.string().optional(),
    activityScope: z.string().optional(),
    riskTaxonomy: z.string().optional(),
  })
  .passthrough();
export type ObligationProposedFields = z.infer<typeof obligationProposedFieldsSchema>;

export const obligationCandidateProposedPayloadSchema = z.object({
  /** Mira's URN suggestion for the new row (subject to reviewer overwrite). */
  proposedUrn: z.string().min(1),
  instrumentId: z.string().min(1),
  sectionRef: z.string().min(1),
  llmExtractionEventId: z.string().min(1),
  /** 0..1 — how strongly this obligation applies to the bank. */
  applicabilityScore: z.number().min(0).max(1),
  /** 0..1 — how relevant the obligation is to the bank's operations. */
  relevancyScore: z.number().min(0).max(1),
  /** Single-letter domain (A..J) from the obligations-register layout. */
  domain: obligationReviewDomainSchema,
  /** Proposed cell values for the new register row. */
  proposedFields: obligationProposedFieldsSchema,
});
export type ObligationCandidateProposedPayload = z.infer<
  typeof obligationCandidateProposedPayloadSchema
>;

export function makeObligationCandidateProposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ObligationCandidateProposedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ObligationCandidateProposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: obligationCandidateProposedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ObligationReviewCompleted
// ---------------------------------------------------------------------------

export const obligationReviewCompletedPayloadSchema = z
  .object({
    /** URN of the obligation row being closed. */
    obligationUrn: z.string().min(1),
    /** Closing status; updates the `review-status` register column. */
    newStatus: obligationReviewCompletedStatusSchema,
    /** Reviewing agent name (e.g. "Mira", "Owen", "Marc"). */
    reviewerAgentName: z.string().min(1),
    /** Reviewing seat (e.g. "ceo", "cco", "company-secretary"). */
    reviewerSeat: z.string().min(1),
    /** One-line rationale; survives in the audit trail. */
    rationale: z.string().min(1),
    /**
     * Cell-level modifications when newStatus is `reviewed-modified`. Each
     * key is the obligation-register column name; each value is the new
     * cell text. Absent / empty for `reviewed-confirmed` and
     * `reviewed-retired`.
     */
    modifications: z.record(z.string(), z.string()).optional(),
  })
  .refine(
    (payload) =>
      payload.newStatus !== "reviewed-modified" ||
      (payload.modifications !== undefined && Object.keys(payload.modifications).length > 0),
    {
      message: "modifications must be non-empty when newStatus is reviewed-modified",
      path: ["modifications"],
    },
  );
export type ObligationReviewCompletedPayload = z.infer<
  typeof obligationReviewCompletedPayloadSchema
>;

export function makeObligationReviewCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ObligationReviewCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ObligationReviewCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: obligationReviewCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Domain barrel
// ---------------------------------------------------------------------------

export const OBLIGATION_REVIEW_TYPED_EVENT_TYPES = [
  "ObligationReviewMatched",
  "ObligationReviewConflict",
  "ObligationCandidateProposed",
  "ObligationReviewCompleted",
] as const;
export type ObligationReviewEventType = (typeof OBLIGATION_REVIEW_TYPED_EVENT_TYPES)[number];
