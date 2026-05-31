// platform/event-store/event-types/audit.ts
//
// AuditFinding event-payload schema.
//
// Covers:
//   - AuditFinding — typed finding raised against an agent's performance or
//     output quality; consumed by the performance evaluator quality-scoring
//     pipeline and the agent world-state AuditFinding view.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (Principle 6 — autonomous by default;
// humans oversee the residual). Findings are the formal channel by which the
// CEO or Vera records a quality gap against a named agent.
//
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// AuditFinding
// ---------------------------------------------------------------------------

export const auditFindingSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type AuditFindingSeverity = z.infer<typeof auditFindingSeveritySchema>;

export const auditFindingCategorySchema = z.enum([
  "code-quality", // bug, type error, logic error
  "process", // violated operating procedure (dispatch discipline, worktree isolation, etc.)
  "mandate", // agent acted outside its mandate or missed a mandate obligation
  "output", // deliverable quality issue (incorrect content, missing section, stale data)
  "security", // security or data-handling violation
  "other",
]);
export type AuditFindingCategory = z.infer<typeof auditFindingCategorySchema>;

export const auditFindingPayloadSchema = z.object({
  /** Unique finding identifier — e.g. "F-MIRA-20260514-A3B2". */
  findingId: z.string().min(1),

  /** Severity level of the finding. */
  severity: auditFindingSeveritySchema,

  /** Category of the finding. */
  category: auditFindingCategorySchema,

  /** Agent URN the finding is addressed to — e.g. "agent:mira". */
  addressedTo: z.string().min(1),

  /** Bare agent name — e.g. "mira". Matches AgentRegistered.agentId. */
  agentId: z.string().min(1),

  /** Actor who raised the finding — e.g. "marc@tgv.co.za" or "agent:vera". */
  raisedBy: z.string().min(1),

  /** One-line description of the finding. */
  summary: z.string().min(1),

  /** Longer context (optional). */
  detail: z.string().optional(),

  /** PR number, file path, or event_id that triggered this finding (optional). */
  sourceRef: z.string().optional(),

  /** Citations for this finding. */
  citations: z.array(z.string()).default([]),
});

export type AuditFindingPayload = z.infer<typeof auditFindingPayloadSchema>;

export function makeAuditFinding(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AuditFindingPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AuditFinding",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: auditFindingPayloadSchema.parse(args.payload),
  });
}

// AuditIssueOpened and AuditIssueClosed live in
// platform/event-store/event-types/governance-extended.ts (pre-existing stubs
// enhanced 2026-05-31 with richer payload fields). Re-exported from the barrel
// index. Do not duplicate here.

export const AUDIT_TYPED_EVENT_TYPES = [
  "AuditFinding",
  "AuditIssueOpened",
  "AuditIssueClosed",
] as const;
export type AuditEventType = (typeof AUDIT_TYPED_EVENT_TYPES)[number];
