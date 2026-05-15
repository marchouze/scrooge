// platform/event-store/event-types/performance.ts
//
// Agent performance management event-payload schemas.
//
// Covers:
//   - AgentPerformanceEvaluated — daily per-agent evaluation by Sade's evaluator
//   - AgentFeedbackIssued       — feedback delivery record after evaluation
//
// Authority: Sade mandate (AgentOps); Atlas projection integration.
// Author: Mira (Compliance / RegTech engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// AgentPerformanceEvaluated
// ---------------------------------------------------------------------------

export const agentPerformanceEvaluatedPayloadSchema = z.object({
  /** Agent identifier — matches AgentRegistered.agentId (e.g. "atlas", "mira", "anya"). */
  agentId: z.string().min(1),

  /** ISO date (YYYY-MM-DD) of the evaluation period. */
  evaluationPeriod: z.string().min(1),

  /** URN of the evaluating agent. */
  evaluatedBy: z.string().min(1),

  /** Run metrics for the period. */
  runMetrics: z.object({
    /** Total agent runs started in the period. */
    runsStarted: z.number().int().nonnegative(),
    /** Runs that completed with outcome "delivered". */
    runsDelivered: z.number().int().nonnegative(),
    /** Runs that completed with outcome "blocked". */
    runsBlocked: z.number().int().nonnegative(),
    /** Runs that failed (SubstrateAgentRunFailed or outcome not "delivered"). */
    runsFailed: z.number().int().nonnegative(),
    /** Delivery rate 0–1 (runsDelivered / runsStarted). */
    deliveryRate: z.number().min(0).max(1),
  }),

  /** Quality metrics for the period. */
  qualityMetrics: z.object({
    /** AuditFinding events attributable to this agent's outputs in the period. */
    auditFindingsRaised: z.number().int().nonnegative(),
    /** AuditFinding events resolved. */
    auditFindingsResolved: z.number().int().nonnegative(),
    /** CI gate violations (type errors, lint failures) in the period. */
    ciViolations: z.number().int().nonnegative(),
    /** Worktree isolation violations documented in the period. */
    worktreeViolations: z.number().int().nonnegative(),
  }),

  /** Strategic contribution for the period. */
  strategicMetrics: z.object({
    /** CEO decision IDs advanced (closed or moved from open to in-progress). */
    decisionsAdvanced: z.array(z.string()),
    /** Workstream IDs progressed. */
    workstreamsProgressed: z.array(z.string()),
    /** Obligations or regulatory concepts linked/created. */
    complianceArtifacts: z.number().int().nonnegative(),
    /** PRs merged to main attributable to this agent. */
    prsMerged: z.number().int().nonnegative(),
  }),

  /** Composite scores — 0.0 (poor) to 1.0 (excellent). */
  scores: z.object({
    /** Delivery score: weight on runsDelivered / runsStarted, adjusted for blockages outside control. */
    delivery: z.number().min(0).max(1),
    /** Quality score: penalty for audit findings and CI violations, bonus for fast resolution. */
    quality: z.number().min(0).max(1),
    /** Strategic score: contribution to CEO-approved decisions and workstreams. */
    strategic: z.number().min(0).max(1),
    /** Overall weighted score (delivery 40%, quality 40%, strategic 20%). */
    overall: z.number().min(0).max(1),
  }),

  /** Performance tier for the period. */
  tier: z.enum(["exceeds", "meets", "needs-improvement", "unsatisfactory"]),

  /** Narrative feedback. */
  narrative: z.object({
    strengths: z.array(z.string().min(1)),
    areasForImprovement: z.array(z.string().min(1)),
    feedbackSummary: z.string().min(1),
  }),
});

export type AgentPerformanceEvaluatedPayload = z.infer<
  typeof agentPerformanceEvaluatedPayloadSchema
>;

export function makeAgentPerformanceEvaluated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentPerformanceEvaluatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentPerformanceEvaluated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentPerformanceEvaluatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentFeedbackIssued
// ---------------------------------------------------------------------------

export const agentFeedbackIssuedPayloadSchema = z.object({
  /** Agent receiving feedback. */
  agentId: z.string().min(1),

  /** ISO date of the evaluation period this feedback covers. */
  evaluationPeriod: z.string().min(1),

  /** The evaluationId (event_id of the AgentPerformanceEvaluated event). */
  evaluationEventId: z.string().min(1),

  /** How the feedback was delivered. */
  deliveredVia: z.enum(["memory-file", "team-inbox", "both"]),

  /** Path to the memory file or Team Inbox brief written. */
  artifactPath: z.string().min(1).optional(),

  /** One-paragraph feedback text delivered to the agent. */
  feedbackText: z.string().min(1),

  /** Who issued the feedback. */
  issuedBy: z.string().min(1),
});

export type AgentFeedbackIssuedPayload = z.infer<typeof agentFeedbackIssuedPayloadSchema>;

export function makeAgentFeedbackIssued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentFeedbackIssuedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentFeedbackIssued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentFeedbackIssuedPayloadSchema.parse(args.payload),
  });
}

export const PERFORMANCE_TYPED_EVENT_TYPES = [
  "AgentPerformanceEvaluated",
  "AgentFeedbackIssued",
] as const;
export type PerformanceEventType = (typeof PERFORMANCE_TYPED_EVENT_TYPES)[number];
