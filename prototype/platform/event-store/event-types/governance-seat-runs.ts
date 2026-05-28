// platform/event-store/event-types/governance-seat-runs.ts
//
// Shared event types for governance-seat periodic runs.
//
// Covers:
//   - GovernanceSeatRunCompleted — quarterly run completion record for
//     CCO / CISO / CAE governance seats.
//   - GovernanceAttestationFiled — RMCP / FIC quarterly attestation.
//   - SuspiciousActivityQueueReviewed — STR/CTR queue review by CCO.
//   - AmlRiskAssessmentCompleted — AML risk assessment cycle close.
//   - EddQueueReviewed — Enhanced Due Diligence queue sign-off by CCO.
//
// Authority:
//   - FIC Act 38/2001 (AML/CFT obligations — CCO mandatory functions)
//   - Banks Act 94/1990 §60A (MLRO appointment + responsibilities)
//   - POL-AML-001 v1 (AML/CFT Policy)
//   - RMCP v1 (Risk Management and Compliance Programme)
//   - D-CCO-GOVERNANCE-SEAT-G5 (pre-licence gate G5; CEO-approved)
//
// Authors: Zara (Chief Compliance Officer, governance)
//          + Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// GovernanceSeatRunCompleted
//
// Terminal event for a quarterly periodic run of a governance seat.
// Emitted by the seat's run script after all domain events have been appended.
// Serves as the idempotency anchor: a second run for the same (seatId, period)
// must be skipped if this event already exists.
//
// Regulatory chain:
//   FIC Act 38/2001 §42 → POL-AML-001 §6.1 → RMCP §4 → GovernanceSeatRunCompleted
// ---------------------------------------------------------------------------

export const GovernanceSeatRunCompletedPayloadSchema = z.object({
  /** Governance seat identifier: "cco" | "ciso" | "cae". */
  seatId: z.string().min(1),
  /** Agent name that produced this run (e.g. "zara"). */
  agentId: z.string().min(1),
  /** Run type discriminator. */
  runType: z.string().min(1),
  /** Reporting period the run covers (e.g. "2026-Q2"). */
  period: z.string().min(1),
  /** Count of domain events emitted by this run (excluding this completion event). */
  eventsEmitted: z.number().int().nonnegative(),
  /** Summary findings or notes from the run. Empty array when no findings. */
  findings: z.array(z.string()),
  /** Run outcome status. */
  status: z.string().min(1),
});

export type GovernanceSeatRunCompletedPayload = z.infer<
  typeof GovernanceSeatRunCompletedPayloadSchema
>;

export function makeGovernanceSeatRunCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: GovernanceSeatRunCompletedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "GovernanceSeatRunCompleted requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "GovernanceSeatRunCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: GovernanceSeatRunCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// GovernanceAttestationFiled
//
// Emitted when a governance seat officer files a periodic attestation
// (e.g. RMCP quarterly attestation required under FIC Act §42 + RMCP §4).
//
// Regulatory chain:
//   FIC Act 38/2001 §42 → POL-AML-001 §6.1 → RMCP §4 → GovernanceAttestationFiled
// ---------------------------------------------------------------------------

export const GovernanceAttestationFiledPayloadSchema = z.object({
  /** Governance seat identifier: "cco" | "ciso" | "cae". */
  seatId: z.string().min(1),
  /** Agent or officer ID filing the attestation (e.g. "zara"). */
  attestorId: z.string().min(1),
  /**
   * Attestation type. Identifies the regulatory procedure being attested.
   *   - "rmcp-quarterly" — RMCP §4 quarterly sign-off (CCO).
   *   - "information-security-quarterly" — IS quarterly attestation (CISO).
   *   - "internal-audit-quarterly" — internal-audit plan attestation (CAE).
   */
  attestationType: z.string().min(1),
  /** Reporting period the attestation covers (e.g. "2026-Q2"). */
  period: z.string().min(1),
  /** ISO 8601 timestamp when the attestation was filed. */
  attestedAt: z.string().min(1),
  /** Summary findings included in the attestation. Empty array when none. */
  findings: z.array(z.string()),
  /** Policy or procedure reference the attestation is filed under. */
  policyRef: z.string().min(1),
});

export type GovernanceAttestationFiledPayload = z.infer<
  typeof GovernanceAttestationFiledPayloadSchema
>;

export function makeGovernanceAttestationFiled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: GovernanceAttestationFiledPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "GovernanceAttestationFiled requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "GovernanceAttestationFiled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: GovernanceAttestationFiledPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SuspiciousActivityQueueReviewed
//
// Emitted when the CCO (or MLRO delegate) completes a review of the
// suspicious-transaction queue. Records STR / CTR counts filed in the period.
//
// Regulatory chain:
//   FIC Act 38/2001 §29 (STR) + §28A (CTR) → PROC-CCO-STR-01
//   → SuspiciousActivityQueueReviewed
// ---------------------------------------------------------------------------

export const SuspiciousActivityQueueReviewedPayloadSchema = z.object({
  /** ISO 8601 timestamp when the queue review was completed. */
  reviewedAt: z.string().min(1),
  /** Number of items in the queue at the time of review. */
  queueDepth: z.number().int().nonnegative(),
  /** Count of Suspicious Transaction Reports filed in the period. */
  strFiled: z.number().int().nonnegative(),
  /** Count of Cash Threshold Reports filed in the period. */
  ctrFiled: z.number().int().nonnegative(),
  /** Reviewer notes — summary disposition or key issues. */
  notes: z.string(),
});

export type SuspiciousActivityQueueReviewedPayload = z.infer<
  typeof SuspiciousActivityQueueReviewedPayloadSchema
>;

export function makeSuspiciousActivityQueueReviewed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SuspiciousActivityQueueReviewedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "SuspiciousActivityQueueReviewed requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SuspiciousActivityQueueReviewed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: SuspiciousActivityQueueReviewedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AmlRiskAssessmentCompleted
//
// Emitted when the CCO closes a periodic AML/CFT risk assessment cycle.
//
// Regulatory chain:
//   FIC Act 38/2001 §21B (Risk-based approach) → POL-AML-001 §4
//   → PROC-CCO-AML-ASSESS-01 → AmlRiskAssessmentCompleted
// ---------------------------------------------------------------------------

export const AmlRiskAssessmentCompletedPayloadSchema = z.object({
  /**
   * Assessment type discriminator.
   *   - "institutional-quarterly" — full institutional AML/CFT risk assessment.
   *   - "product-risk-review"     — product-specific AML risk review.
   *   - "geographic-risk-review"  — country/corridor-specific risk review.
   */
  assessmentType: z.string().min(1),
  /** Reporting period covered (e.g. "2026-Q2"). */
  period: z.string().min(1),
  /** Aggregate risk rating assigned (e.g. "low" | "medium" | "high" | "critical"). */
  riskRating: z.string().min(1),
  /** Summary of key findings and material risk drivers. */
  keyFindings: z.string(),
  /** Policy reference under which the assessment was conducted. */
  policyRef: z.string().min(1),
});

export type AmlRiskAssessmentCompletedPayload = z.infer<
  typeof AmlRiskAssessmentCompletedPayloadSchema
>;

export function makeAmlRiskAssessmentCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AmlRiskAssessmentCompletedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "AmlRiskAssessmentCompleted requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AmlRiskAssessmentCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: AmlRiskAssessmentCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// EddQueueReviewed
//
// Emitted when the CCO signs off on the Enhanced Due Diligence (EDD) queue.
// EDD is mandatory for high-risk customers per FIC Act §21G + POL-AML-001 §5.
//
// Regulatory chain:
//   FIC Act 38/2001 §21G → POL-AML-001 §5.3 → PROC-CCO-EDD-01
//   → EddQueueReviewed
// ---------------------------------------------------------------------------

export const EddQueueReviewedPayloadSchema = z.object({
  /** ISO 8601 timestamp when the EDD queue review was completed. */
  reviewedAt: z.string().min(1),
  /** Number of EDD cases in the queue at review time. */
  queueDepth: z.number().int().nonnegative(),
  /** Whether the CCO has formally signed off on all outstanding EDD cases. */
  signed: z.boolean(),
  /** Reviewer notes — escalation items, remediation required, or "no action". */
  notes: z.string(),
});

export type EddQueueReviewedPayload = z.infer<typeof EddQueueReviewedPayloadSchema>;

export function makeEddQueueReviewed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EddQueueReviewedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "EddQueueReviewed requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EddQueueReviewed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: EddQueueReviewedPayloadSchema.parse(args.payload),
  });
}

export const GOVERNANCE_SEAT_RUNS_TYPED_EVENT_TYPES = [
  "GovernanceSeatRunCompleted",
  "GovernanceAttestationFiled",
  "SuspiciousActivityQueueReviewed",
  "AmlRiskAssessmentCompleted",
  "EddQueueReviewed",
] as const;
