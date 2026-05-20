// platform/event-store/event-types/agent.ts
//
// Agent-domain event-payload schemas.
//
// Covers:
//   - AgentEscalation family (5 events)
//   - AgentDecision
//   - AgentRegistered
//   - SubstrateAgentRun family (3 events)
//   - AgentBriefIssued, AgentRunStarted, AgentRunCompleted (RMS records-of-agent-runs)
//
// F-020 split from the god-file `../event-types.ts`.
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { deterministicAggregateId, makeAggregateLabel } from "../aggregate";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// AgentEscalation
// ---------------------------------------------------------------------------

export const agentEscalationPayloadSchema = z.object({
  escalationId: z.string().min(1),
  raisedBy: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.string()),
  blockedBy: z.string().min(1),
  deadline: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "blocking"]),
  routedTo: z.string().min(1),
  sealed: z
    .object({
      reason: z.enum(["fraud", "whistleblowing", "popia-incident"]),
    })
    .optional(),
});

export type AgentEscalationPayload = z.infer<typeof agentEscalationPayloadSchema>;

export function makeAgentEscalation(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentEscalationPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentEscalation",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentEscalationPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentEscalationAcknowledged
// ---------------------------------------------------------------------------

export const agentEscalationAcknowledgedPayloadSchema = z.object({
  escalationId: z.string().min(1),
  acknowledgedBy: z.string().min(1),
  acknowledgedAt: z.string().min(1),
});

export type AgentEscalationAcknowledgedPayload = z.infer<
  typeof agentEscalationAcknowledgedPayloadSchema
>;

export function makeAgentEscalationAcknowledged(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentEscalationAcknowledgedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentEscalationAcknowledged",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentEscalationAcknowledgedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentEscalationDecided
// ---------------------------------------------------------------------------

export const agentEscalationDecidedPayloadSchema = z.object({
  escalationId: z.string().min(1),
  decidedBy: z.string().min(1),
  chosenOption: z.string().min(1),
  rationale: z.string().min(1),
});

export type AgentEscalationDecidedPayload = z.infer<typeof agentEscalationDecidedPayloadSchema>;

export function makeAgentEscalationDecided(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentEscalationDecidedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentEscalationDecided",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentEscalationDecidedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentEscalationDelegated
// ---------------------------------------------------------------------------

export const agentEscalationDelegatedPayloadSchema = z.object({
  escalationId: z.string().min(1),
  delegatedBy: z.string().min(1),
  delegatedTo: z.string().min(1),
  reason: z.string().min(1),
});

export type AgentEscalationDelegatedPayload = z.infer<typeof agentEscalationDelegatedPayloadSchema>;

export function makeAgentEscalationDelegated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentEscalationDelegatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentEscalationDelegated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentEscalationDelegatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentEscalationOverdue
// ---------------------------------------------------------------------------

export const agentEscalationOverduePayloadSchema = z.object({
  escalationId: z.string().min(1),
  deadline: z.string().min(1),
  detectedAt: z.string().min(1),
  escalatedTo: z.string().min(1),
});

export type AgentEscalationOverduePayload = z.infer<typeof agentEscalationOverduePayloadSchema>;

export function makeAgentEscalationOverdue(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentEscalationOverduePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentEscalationOverdue",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentEscalationOverduePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentDecision
// ---------------------------------------------------------------------------

export const agentDecisionPayloadSchema = z.object({
  decisionId: z.string().min(1),
  decidedBy: z.string().min(1),
  what: z.string().min(1),
  inScopeBy: z.string().min(1),
  options: z.array(z.string()),
  chosen: z.string().min(1),
  rationale: z.string().min(1),
});

export type AgentDecisionPayload = z.infer<typeof agentDecisionPayloadSchema>;

export function makeAgentDecision(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentDecisionPayload;
  eventId?: string;
}): Event {
  const payload = agentDecisionPayloadSchema.parse(args.payload);
  if (payload.options.length > 0 && !payload.options.includes(payload.chosen)) {
    throw new Error(
      `AgentDecision: chosen "${payload.chosen}" is not in options [${payload.options.join(", ")}]`,
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentDecision",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload,
  });
}

// ---------------------------------------------------------------------------
// AgentRegistered
// ---------------------------------------------------------------------------

export const agentRegisteredPayloadSchema = z.object({
  agentUrn: z
    .string()
    .min(1)
    .regex(/^agent:[a-z0-9-]+$/, {
      message: "agentUrn must be `agent:<lowercased-persona-name>` (a-z, 0-9, -)",
    }),
  personaName: z.string().min(1),
  reportsTo: z.string().min(1),
  cadenceMode: z.string().min(1),
  triggerCount: z.number().int().nonnegative(),
  decisionsInScopeCount: z.number().int().nonnegative(),
  decisionsInScope: z.array(z.string().min(1)),
  decisionsEscalateCount: z.number().int().nonnegative(),
  escalationClasses: z.array(z.string().min(1)),
  systemCapabilities: z.array(z.string().min(1)),
  eventsEmitted: z.array(z.string().min(1)),
  proceduresOwned: z.array(z.string().min(1)),
  specVersion: z.string().min(1),
  specHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "specHash must be a lowercase hex sha256 (64 chars)",
    }),
});

export type AgentRegisteredPayload = z.infer<typeof agentRegisteredPayloadSchema>;

export function makeAgentRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SubstrateAgentRunStarted / SubstrateAgentRunCompleted / SubstrateAgentRunFailed
//
// Substrate-emitted run lifecycle (S8 primitives, distinct from RMS
// brief-coupled AgentRunStarted/AgentRunCompleted).
// ---------------------------------------------------------------------------

const substrateRunIdSchema = z
  .string()
  .min(1)
  .regex(
    /^run:[a-z0-9-]+:[0-9TZ-]+:[a-z0-9]+$/,
    "runId must match `run:<lowercased-agent>:<iso-utc-no-punct>:<short-rand>`",
  );

export const substrateAgentRunStartedPayloadSchema = z.object({
  runId: substrateRunIdSchema,
  agent: z.string().min(1),
  trigger: z.object({
    kind: z.enum(["scheduled", "event-driven", "on-request"]),
    id: z.string().min(1),
  }),
  startedAt: z.string().min(1),
  dryRun: z.boolean(),
  substrate: z.enum(["agent-runtime", "scrooge-coordinated-in-session"]),
  sequenceAtStart: z.number().int().nonnegative(),
});

export type SubstrateAgentRunStartedPayload = z.infer<typeof substrateAgentRunStartedPayloadSchema>;

export function makeSubstrateAgentRunStarted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SubstrateAgentRunStartedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SubstrateAgentRunStarted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: substrateAgentRunStartedPayloadSchema.parse(args.payload),
  });
}

export const substrateAgentRunCompletedPayloadSchema = z.object({
  runId: substrateRunIdSchema,
  agent: z.string().min(1),
  completedAt: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  ok: z.boolean(),
  eventsEmitted: z.number().int().nonnegative(),
  decisionsEmitted: z.number().int().nonnegative(),
  escalationsEmitted: z.number().int().nonnegative(),
  sequenceAtCompletion: z.number().int().nonnegative(),
  deliverable: z.string().min(1).optional(),
  summary: z.string().min(1),
});

export type SubstrateAgentRunCompletedPayload = z.infer<
  typeof substrateAgentRunCompletedPayloadSchema
>;

export function makeSubstrateAgentRunCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SubstrateAgentRunCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SubstrateAgentRunCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: substrateAgentRunCompletedPayloadSchema.parse(args.payload),
  });
}

export const substrateAgentRunFailedPayloadSchema = z.object({
  runId: substrateRunIdSchema,
  agent: z.string().min(1),
  failedAt: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  errorClass: z.enum(["exception", "structured", "timeout", "unknown"]),
  errorMessage: z.string().min(1).max(1024),
  sequenceAtFailure: z.number().int().nonnegative(),
});

export type SubstrateAgentRunFailedPayload = z.infer<typeof substrateAgentRunFailedPayloadSchema>;

export function makeSubstrateAgentRunFailed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SubstrateAgentRunFailedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SubstrateAgentRunFailed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: substrateAgentRunFailedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RMS agent-run records (brief-coupled — RMS owns these per S8/RMS overlap
// disposition, Scrooge ruling 2026-05-10).
// ---------------------------------------------------------------------------

/**
 * Reusable agent reference shape — name + position per identity-discipline rule.
 */
export const rmsAgentRefSchema = z.object({
  name: z.string().min(1),
  position: z.string().min(1),
  agentId: z.string().min(1).optional(),
});
export type RmsAgentRef = z.infer<typeof rmsAgentRefSchema>;

/**
 * BLAKE3 document-hash string. Format: `blake3:<64-hex-chars>`.
 */
export const documentHashSchema = z
  .string()
  .regex(/^blake3:[0-9a-f]{64}$/, "documentHash must match `blake3:<64-hex-chars>`");

// AgentBriefIssued

// D-DISPATCH-SYNC-PRIMITIVE (CEO-approved 2026-05-20).
// `runRoleClass` distinguishes reviewer-class briefs (independent validation,
// audit, peer challenge) from decider-class briefs (approval, sign-off, merge)
// and from default executor / observer briefs. `blocksOn` lists prior briefs
// whose `AgentRunCompleted{outcome:"delivered"}` event must exist before this
// brief's run may close `delivered`. Both fields are optional and
// backward-compatible: pre-primitive briefs read as `runRoleClass:"executor"`
// and `blocksOn:[]`.
export const dispatchRunRoleClassValues = ["reviewer", "decider", "executor", "observer"] as const;

export const blocksOnEntrySchema = z.object({
  briefId: z.string().min(1),
  runRoleClass: z.enum(dispatchRunRoleClassValues),
});
export type BlocksOnEntry = z.infer<typeof blocksOnEntrySchema>;

export const agentBriefIssuedPayloadSchema = z.object({
  briefId: z.string().min(1),
  issuedTo: rmsAgentRefSchema,
  issuedBy: rmsAgentRefSchema,
  title: z.string().min(1),
  directiveDocumentHash: documentHashSchema,
  workstreamId: z.string().min(1).optional(),
  priority: z.enum(["now", "next-tick", "scheduled"]),
  scheduledFor: z.string().min(1).optional(),
  supersedes: z.string().min(1).optional(),
  expectedOutputs: z
    .array(
      z.object({
        kind: z.enum(["decision-card", "deliverable-document", "register-row", "code-pr"]),
        description: z.string().min(1),
      }),
    )
    .min(1),
  // D-DISPATCH-SYNC-PRIMITIVE additions.
  runRoleClass: z.enum(dispatchRunRoleClassValues).optional(),
  blocksOn: z.array(blocksOnEntrySchema).optional(),
});

export type AgentBriefIssuedPayload = z.infer<typeof agentBriefIssuedPayloadSchema>;

export function makeAgentBriefIssued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentBriefIssuedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("brief", args.payload.briefId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentBriefIssued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentBriefIssuedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// AgentRunStarted (RMS-2)

export const agentRunStartedPayloadSchema = z.object({
  runId: z.string().min(1),
  briefId: z.string().min(1),
  agent: rmsAgentRefSchema,
  startedAt: z.string().min(1),
  substrate: z.enum(["agent-runtime", "scrooge-coordinated-in-session"]),
  worktree: z.string().min(1).optional(),
});

export type AgentRunStartedPayload = z.infer<typeof agentRunStartedPayloadSchema>;

export function makeAgentRunStarted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentRunStartedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("agent-run", args.payload.runId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentRunStarted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentRunStartedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// AgentRunCompleted (RMS-3)

export const agentRunCompletedFollowOnRouteSchema = z.object({
  kind: z.enum(["agent", "decision", "register-update", "code-pr"]),
  target: z.string().min(1),
  directive: z.string().min(1),
});

export type AgentRunCompletedFollowOnRoute = z.infer<typeof agentRunCompletedFollowOnRouteSchema>;

export const agentRunCompletedPayloadSchema = z.object({
  runId: z.string().min(1),
  briefId: z.string().min(1),
  agent: rmsAgentRefSchema,
  completedAt: z.string().min(1),
  outcome: z.enum(["delivered", "blocked", "withdrawn"]),
  deliverableDocumentHashes: z.array(documentHashSchema),
  substrateGapsSurfaced: z.array(z.string().min(1)),
  citations: z.array(z.string().min(1)),
  followOnRoutes: z.array(agentRunCompletedFollowOnRouteSchema),
});

export type AgentRunCompletedPayload = z.infer<typeof agentRunCompletedPayloadSchema>;

export function makeAgentRunCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentRunCompletedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("agent-run", args.payload.runId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentRunCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentRunCompletedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// AgentGoalEvaluated / AgentGoalSelected / AgentGoalDeferred
//
// Planning-trace event types emitted at every goal-loop iteration.
// Added from D-AGENT-AUTONOMY-OPERATIONAL Slice 3 (PR #226, 2026-05-11).
// ---------------------------------------------------------------------------

export const agentGoalEvaluatedPayloadSchema = z.object({
  agentUrn: z.string().min(1),
  iterationId: z.string().min(1),
  worldStateSnapshotHash: z.string().min(1),
  recentRunCount: z.number().int().nonnegative(),
  candidateGoals: z.array(
    z.object({
      label: z.string(),
      mandateRowKey: z.string(),
      weight: z.number().optional(),
    }),
  ),
  chosen: z.string().optional(),
  reason: z.string().max(2000),
});
export type AgentGoalEvaluatedPayload = z.infer<typeof agentGoalEvaluatedPayloadSchema>;

export function makeAgentGoalEvaluated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentGoalEvaluatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentGoalEvaluated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentGoalEvaluatedPayloadSchema.parse(args.payload),
  });
}

export const agentGoalSelectedPayloadSchema = z.object({
  agentUrn: z.string().min(1),
  iterationId: z.string().min(1),
  goal: z.string().min(1),
  mandateCitations: z
    .array(
      z.object({
        section: z.enum(["9-decisions-in-scope", "11-outputs", "13-procedures-owned"]),
        rowKey: z.string().min(1),
        specHash: z.string().min(1),
      }),
    )
    .min(1, "P2 violation: AgentGoalSelected requires at least one mandate citation"),
  procedureCitations: z
    .array(
      z.object({
        procedurePath: z.string().min(1),
        stepId: z.string().min(1),
        procedureHash: z.string().min(1),
      }),
    )
    .min(1, "P2 violation: AgentGoalSelected requires at least one procedure citation"),
  plannedEvents: z.array(
    z.object({
      type: z.string().min(1),
      payloadPreview: z.record(z.unknown()).optional(),
    }),
  ),
});
export type AgentGoalSelectedPayload = z.infer<typeof agentGoalSelectedPayloadSchema>;

export function makeAgentGoalSelected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentGoalSelectedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentGoalSelected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentGoalSelectedPayloadSchema.parse(args.payload),
  });
}

export const agentGoalDeferredPayloadSchema = z.object({
  agentUrn: z.string().min(1),
  iterationId: z.string().min(1),
  reason: z.string().max(2000),
  retryAfter: z.string().optional(),
  consideredAndRejected: z
    .array(
      z.object({
        label: z.string(),
        rejectionReason: z.string(),
      }),
    )
    .optional(),
});
export type AgentGoalDeferredPayload = z.infer<typeof agentGoalDeferredPayloadSchema>;

export function makeAgentGoalDeferred(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentGoalDeferredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentGoalDeferred",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentGoalDeferredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Per-domain typed-event-type registry
// ---------------------------------------------------------------------------

export const AGENT_TYPED_EVENT_TYPES = [
  "AgentEscalation",
  "AgentEscalationAcknowledged",
  "AgentEscalationDecided",
  "AgentEscalationDelegated",
  "AgentEscalationOverdue",
  "AgentDecision",
  "AgentRegistered",
  // RMS agent-run records
  "AgentBriefIssued",
  "AgentRunStarted",
  "AgentRunCompleted",
  // Goal-loop planning-trace events
  "AgentGoalEvaluated",
  "AgentGoalSelected",
  "AgentGoalDeferred",
] as const;

export type AgentEventType = (typeof AGENT_TYPED_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// D-DECISIONS-FRAMEWORK-REDESIGN Slice C — AgentDecision deprecated alias.
//
// `AgentDecision` events are now unified under the `Decision` event family
// (authority: 'Agent'). The type is kept here so old events in
// `.local/event.db` remain deserializable; new agent-autonomous decisions
// must use `recordDecision({ authority: 'Agent', ... })`.
//
// The migration script (scripts/migrate/backfill-all-decisions.ts) migrates
// existing `AgentDecision` events to `Decision { authority: 'Agent', ... }`
// events as part of Slice C.
//
// @deprecated D-DECISIONS-FRAMEWORK-REDESIGN Slice C — use
//   `recordDecision({ authority: 'Agent', recordedVia: 'agent:autonomous', ... })`.
// ---------------------------------------------------------------------------
export type AgentDecisionDeprecated = AgentDecisionPayload;
