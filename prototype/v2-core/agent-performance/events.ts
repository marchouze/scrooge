// v2-core/agent-performance/events.ts
//
// Bucket C PILOT — re-declared money-free payload schemas for the agent-
// performance domain (D-BANK-WIDE-V2-MIGRATION).
//
// The v2-core package CANNOT import the V1 schemas
// (`platform/event-store/event-types/performance.ts`) across the no-v1-import
// boundary, so it re-declares them here, faithful to the V1 definitions. The
// anti-drift backstop is the schema-parity test
// (`platform/event-store/registry/agent-performance-v2-schema-parity.test.ts`,
// Charter cmd 3: no green by concealment): for each re-declared type a sample the
// AUTHORITATIVE V1 schema accepts MUST be accepted by the v2 schema, and a
// payload the V1 schema rejects MUST be rejected by the v2 schema.
//
// Money-free: agent-performance payloads carry NO money fields — every numeric
// value is an integer count, a rate/score in [0,1], or a percentage. So the
// store-tee mirrors verbatim (no codec), exactly as the posture / reference-data
// / governance-attestation / batch-3 money-free domains did.
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:bucket-c-pilot-agent-performance-domain-to-v2:2026-06-17.
// Principle 1 (events are truth); Principle 2 (single-graph discipline).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

// ---------------------------------------------------------------------------
// AgentPerformanceEvaluated — faithful re-declaration of the V1 schema.
// ---------------------------------------------------------------------------

export const agentPerformanceEvaluatedPayloadSchema = z.object({
  agentId: z.string().min(1),
  evaluationPeriod: z.string().min(1),
  evaluatedBy: z.string().min(1),
  runMetrics: z.object({
    runsStarted: z.number().int().nonnegative(),
    runsDelivered: z.number().int().nonnegative(),
    runsBlocked: z.number().int().nonnegative(),
    runsFailed: z.number().int().nonnegative(),
    deliveryRate: z.number().min(0).max(1),
  }),
  qualityMetrics: z.object({
    auditFindingsRaised: z.number().int().nonnegative(),
    auditFindingsResolved: z.number().int().nonnegative(),
    ciViolations: z.number().int().nonnegative(),
    worktreeViolations: z.number().int().nonnegative(),
  }),
  strategicMetrics: z.object({
    decisionsAdvanced: z.array(z.string()),
    workstreamsProgressed: z.array(z.string()),
    complianceArtifacts: z.number().int().nonnegative(),
    prsMerged: z.number().int().nonnegative(),
  }),
  scores: z.object({
    delivery: z.number().min(0).max(1),
    quality: z.number().min(0).max(1),
    strategic: z.number().min(0).max(1),
    overall: z.number().min(0).max(1),
  }),
  tier: z.enum(["exceeds", "meets", "needs-improvement", "unsatisfactory"]),
  narrative: z.object({
    strengths: z.array(z.string().min(1)),
    areasForImprovement: z.array(z.string().min(1)),
    feedbackSummary: z.string().min(1),
  }),
});

export type AgentPerformanceEvaluatedPayload = z.infer<
  typeof agentPerformanceEvaluatedPayloadSchema
>;

// ---------------------------------------------------------------------------
// AgentFeedbackIssued — faithful re-declaration of the V1 schema.
// ---------------------------------------------------------------------------

export const agentFeedbackIssuedPayloadSchema = z.object({
  agentId: z.string().min(1),
  evaluationPeriod: z.string().min(1),
  evaluationEventId: z.string().min(1),
  deliveredVia: z.enum(["memory-file", "team-inbox", "both", "rms-event"]),
  artifactPath: z.string().min(1).optional(),
  feedbackText: z.string().min(1),
  issuedBy: z.string().min(1),
});

export type AgentFeedbackIssuedPayload = z.infer<typeof agentFeedbackIssuedPayloadSchema>;

// ---------------------------------------------------------------------------
// Manifest — the two migrated agent-performance type names.
// ---------------------------------------------------------------------------

/** The agent-performance types re-declared (and migrated) by the bucket-C pilot. */
export const AGENT_PERFORMANCE_REDECLARED_TYPES = [
  "AgentPerformanceEvaluated",
  "AgentFeedbackIssued",
] as const;

/** All agent-performance types migrated by the bucket-C pilot (== re-declared set). */
export const AGENT_PERFORMANCE_TYPES = AGENT_PERFORMANCE_REDECLARED_TYPES;

export type AgentPerformanceEventType = (typeof AGENT_PERFORMANCE_TYPES)[number];
