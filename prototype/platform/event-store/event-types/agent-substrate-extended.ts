// platform/event-store/event-types/agent-substrate-extended.ts
//
// Extended agent / substrate / workstream event-payload schemas.
//
// Covers: AgentCapabilityChanged, AgentRetired, AgentRunFailed,
//   WorkstreamStarted, WorkstreamCompleted, RoleBriefDelivered,
//   RiskRunCompleted, PersonaSpecChanged, MergeRequested,
//   RoleResearchRequested, RoleResearchQueueSnapshot,
//   CitationGateFailed, CitationGatePassed,
//   MandateGapDetected, M1CitationTrancheRegistered,
//   EventSchemaProposal, EventSchemaPublished,
//   ObligationRegistered, DashboardProjectionRefreshed,
//   MarketsProjectionRegistered, MarketsProjectionRefreshed,
//   ThreatModelDimensionRegistered, SecurityGateRegistered,
//   IfrsClassificationApplied (markets registry PT row)
//
// Authority: F-032 (event-type-registry-coverage recon).
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// WorkstreamStarted
// ---------------------------------------------------------------------------

export const workstreamStartedPayloadSchema = z.object({
  workstreamId: z.string().min(1),
  title: z.string().min(1),
  owner: z.string().min(1),
  startedAt: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["now", "next-tick", "scheduled"]).optional(),
});

export type WorkstreamStartedPayload = z.infer<typeof workstreamStartedPayloadSchema>;

export function makeWorkstreamStarted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: WorkstreamStartedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "WorkstreamStarted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: workstreamStartedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// WorkstreamCompleted
// ---------------------------------------------------------------------------

export const workstreamCompletedPayloadSchema = z.object({
  workstreamId: z.string().min(1),
  title: z.string().min(1),
  owner: z.string().min(1),
  completedAt: z.string().min(1),
  outcome: z.enum(["delivered", "partially-delivered", "withdrawn"]),
  deliverableSummary: z.string().optional(),
});

export type WorkstreamCompletedPayload = z.infer<typeof workstreamCompletedPayloadSchema>;

export function makeWorkstreamCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: WorkstreamCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "WorkstreamCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: workstreamCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentCapabilityChanged
// ---------------------------------------------------------------------------

export const agentCapabilityChangedPayloadSchema = z.object({
  agentName: z.string().min(1),
  agentPosition: z.string().min(1),
  changeKind: z.enum(["added", "removed", "modified"]),
  capabilityId: z.string().min(1),
  description: z.string().optional(),
  effectiveAt: z.string().min(1),
});

export type AgentCapabilityChangedPayload = z.infer<typeof agentCapabilityChangedPayloadSchema>;

export function makeAgentCapabilityChanged(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentCapabilityChangedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentCapabilityChanged",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentCapabilityChangedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentRetired
// ---------------------------------------------------------------------------

export const agentRetiredPayloadSchema = z.object({
  agentName: z.string().min(1),
  agentPosition: z.string().min(1),
  retiredAt: z.string().min(1),
  reason: z.string().min(1),
  supersededBy: z.string().optional(),
});

export type AgentRetiredPayload = z.infer<typeof agentRetiredPayloadSchema>;

export function makeAgentRetired(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentRetiredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentRetired",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentRetiredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentRunFailed
// ---------------------------------------------------------------------------

export const agentRunFailedPayloadSchema = z.object({
  runId: z.string().min(1),
  agentName: z.string().min(1),
  agentPosition: z.string().min(1),
  briefId: z.string().optional(),
  failedAt: z.string().min(1),
  errorCode: z.string().optional(),
  errorMessage: z.string().min(1),
  retryable: z.boolean(),
});

export type AgentRunFailedPayload = z.infer<typeof agentRunFailedPayloadSchema>;

export function makeAgentRunFailed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentRunFailedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentRunFailed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentRunFailedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PersonaSpecChanged
// ---------------------------------------------------------------------------

export const personaSpecChangedPayloadSchema = z.object({
  agentName: z.string().min(1),
  agentPosition: z.string().min(1),
  changeKind: z.enum([
    "mandate-update",
    "trigger-update",
    "cadence-update",
    "capability-update",
    "other",
  ]),
  changeDescription: z.string().min(1),
  changedAt: z.string().min(1),
  prNumber: z.string().optional(),
});

export type PersonaSpecChangedPayload = z.infer<typeof personaSpecChangedPayloadSchema>;

export function makePersonaSpecChanged(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PersonaSpecChangedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PersonaSpecChanged",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: personaSpecChangedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RoleBriefDelivered
// ---------------------------------------------------------------------------

export const roleBriefDeliveredPayloadSchema = z.object({
  briefId: z.string().min(1),
  roleName: z.string().min(1),
  rolePosition: z.string().min(1),
  deliveredBy: z.string().min(1),
  deliveredAt: z.string().min(1),
  filePath: z.string().optional(),
});

export type RoleBriefDeliveredPayload = z.infer<typeof roleBriefDeliveredPayloadSchema>;

export function makeRoleBriefDelivered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RoleBriefDeliveredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RoleBriefDelivered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: roleBriefDeliveredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RiskRunCompleted
// ---------------------------------------------------------------------------
//
// Schema aligned with rohan-risk-run.ts handler emission shape (2026-05-29).
// Handler emits: appetiteLineCount, readinessReady/Drafting/Specified/Unspecified,
// positionEventsLast7d, riskRaisedEventsLast7d, latestHelenaRun, runTrigger.
// Original idealised fields (runId, runKind, completedAt, outcome) are now
// optional for backward compat with any stored events.
//
export const riskRunCompletedPayloadSchema = z
  .object({
    // Handler-emitted fields (authoritative)
    appetiteLineCount: z.number().int().nonnegative().optional(),
    readinessReady: z.number().int().nonnegative().optional(),
    readinessDrafting: z.number().int().nonnegative().optional(),
    readinessSpecified: z.number().int().nonnegative().optional(),
    readinessUnspecified: z.number().int().nonnegative().optional(),
    positionEventsLast7d: z.number().int().nonnegative().optional(),
    riskRaisedEventsLast7d: z.number().int().nonnegative().optional(),
    latestHelenaRun: z.string().nullable().optional(),
    runTrigger: z.string().optional(),
    // Original idealised fields (optional, backward compat)
    runId: z.string().min(1).optional(),
    runKind: z.enum(["var", "stress-test", "back-test", "scenario", "other"]).optional(),
    completedAt: z.string().min(1).optional(),
    outcome: z.enum(["passed", "flagged", "breached"]).optional(),
    summaryMetrics: z.record(z.string(), z.number()).optional(),
    notes: z.string().optional(),
  })
  .passthrough();

export type RiskRunCompletedPayload = z.infer<typeof riskRunCompletedPayloadSchema>;

export function makeRiskRunCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RiskRunCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RiskRunCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: riskRunCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MergeRequested
// ---------------------------------------------------------------------------

export const mergeRequestedPayloadSchema = z.object({
  mergeRequestId: z.string().min(1),
  branchName: z.string().min(1),
  targetBranch: z.string().min(1),
  requestedBy: z.string().min(1),
  requestedAt: z.string().min(1),
  reviewRequired: z.boolean(),
  securityReviewRequired: z.boolean().optional(),
  description: z.string().optional(),
});

export type MergeRequestedPayload = z.infer<typeof mergeRequestedPayloadSchema>;

export function makeMergeRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MergeRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MergeRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: mergeRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MandateGapDetected
// ---------------------------------------------------------------------------

export const mandateGapDetectedPayloadSchema = z.object({
  gapId: z.string().min(1),
  agentName: z.string().min(1),
  missingCapability: z.string().min(1),
  detectedBy: z.string().min(1),
  detectedAt: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  remediationRequired: z.boolean(),
});

export type MandateGapDetectedPayload = z.infer<typeof mandateGapDetectedPayloadSchema>;

export function makeMandateGapDetected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MandateGapDetectedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MandateGapDetected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: mandateGapDetectedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RoleResearchRequested
// ---------------------------------------------------------------------------

export const roleResearchRequestedPayloadSchema = z.object({
  requestId: z.string().min(1),
  roleName: z.string().min(1),
  requestedBy: z.string().min(1),
  requestedAt: z.string().min(1),
  rationale: z.string().min(1),
  priority: z.enum(["now", "next-tick", "scheduled"]).optional(),
});

export type RoleResearchRequestedPayload = z.infer<typeof roleResearchRequestedPayloadSchema>;

export function makeRoleResearchRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RoleResearchRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RoleResearchRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: roleResearchRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RoleResearchQueueSnapshot
// ---------------------------------------------------------------------------
//
// Schema aligned with pax-role-research-queue.ts handler emission shape (2026-05-29).
// Handler emits: draftPersonaCount, draftPersonas, substrateGapHireCount,
// substrateGapHires, pendingHireBriefCount, pendingHireBriefs, runTrigger.
// Original idealised fields (snapshotId, asOf, queueDepth, pendingRoles,
// completedCount) are now optional for backward compat.
//
export const roleResearchQueueSnapshotPayloadSchema = z
  .object({
    // Handler-emitted fields (authoritative)
    draftPersonaCount: z.number().int().nonnegative().optional(),
    draftPersonas: z.array(z.object({ name: z.string(), latestVersion: z.string() })).optional(),
    substrateGapHireCount: z.number().int().nonnegative().optional(),
    substrateGapHires: z.array(z.object({ persona: z.string() })).optional(),
    pendingHireBriefCount: z.number().int().nonnegative().optional(),
    pendingHireBriefs: z
      .array(
        z.object({
          file: z.string(),
          decisionId: z.string().nullable().optional(),
          date: z.string().nullable().optional(),
        }),
      )
      .optional(),
    runTrigger: z.string().optional(),
    // Original idealised fields (optional, backward compat)
    snapshotId: z.string().min(1).optional(),
    asOf: z.string().min(1).optional(),
    queueDepth: z.number().int().nonnegative().optional(),
    pendingRoles: z.array(z.string()).optional(),
    completedCount: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export type RoleResearchQueueSnapshotPayload = z.infer<
  typeof roleResearchQueueSnapshotPayloadSchema
>;

export function makeRoleResearchQueueSnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RoleResearchQueueSnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RoleResearchQueueSnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: roleResearchQueueSnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CitationGatePassed
// ---------------------------------------------------------------------------

export const citationGatePassedPayloadSchema = z.object({
  gateRunId: z.string().min(1),
  targetRef: z.string().min(1),
  checkedAt: z.string().min(1),
  citationsChecked: z.number().int().nonnegative(),
  violations: z.number().int().nonnegative(),
});

export type CitationGatePassedPayload = z.infer<typeof citationGatePassedPayloadSchema>;

export function makeCitationGatePassed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CitationGatePassedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CitationGatePassed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: citationGatePassedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CitationGateFailed
// ---------------------------------------------------------------------------

export const citationGateFailedPayloadSchema = z.object({
  gateRunId: z.string().min(1),
  targetRef: z.string().min(1),
  checkedAt: z.string().min(1),
  citationsChecked: z.number().int().nonnegative(),
  violations: z.number().int().positive(),
  violationSummary: z.array(z.string()),
});

export type CitationGateFailedPayload = z.infer<typeof citationGateFailedPayloadSchema>;

export function makeCitationGateFailed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CitationGateFailedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CitationGateFailed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: citationGateFailedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// M1CitationTrancheRegistered
// ---------------------------------------------------------------------------

export const m1CitationTrancheRegisteredPayloadSchema = z
  .object({
    // Emitted by mira-m1-regulator-citation-urns handler
    decisionId: z.string().optional(),
    decisionEventId: z.string().optional(),
    catalogueSize: z.number().optional(),
    registered: z.number().optional(),
    skipped: z.number().optional(),
    tranches: z.array(z.string()).optional(),
    runTrigger: z.string().optional(),
    // Factory fields (alternative shape)
    trancheId: z.string().optional(),
    regulatoryDomain: z.string().optional(),
    citationCount: z.number().optional(),
    registeredAt: z.string().optional(),
    urns: z.array(z.string()).optional(),
    runId: z.string().optional(),
  })
  .passthrough();

export type M1CitationTrancheRegisteredPayload = z.infer<
  typeof m1CitationTrancheRegisteredPayloadSchema
>;

export function makeM1CitationTrancheRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: M1CitationTrancheRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "M1CitationTrancheRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: m1CitationTrancheRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ObligationRegistered
// ---------------------------------------------------------------------------

export const obligationRegisteredPayloadSchema = z
  .object({
    // Emitted by mira-m1-regulator-citation-urns handler
    obligationUrn: z.string().optional(),
    tranche: z.string().optional(),
    regulator: z.string().optional(),
    instrument: z.string().optional(),
    section: z.string().optional(),
    asOfDate: z.string().optional(),
    confidence: z.union([z.number(), z.string()]).optional(),
    consumers: z.array(z.string()).optional(),
    firstConsumedAt: z.string().optional(),
    registerEntryId: z.string().nullable().optional(),
    authorisingDecisionId: z.string().optional(),
    authorisingDecisionEventId: z.string().optional(),
    // Factory fields (alternative shape)
    obligationId: z.string().optional(),
    regulatoryRef: z.string().optional(),
    title: z.string().optional(),
    bindPhase: z
      .enum(["CORPORATE-BIND", "LICENCE-BIND", "COMMENCEMENT-BIND", "CONDITIONAL-BIND"])
      .optional(),
    registeredAt: z.string().optional(),
    ownedBy: z.string().optional(),
  })
  .passthrough();

export type ObligationRegisteredPayload = z.infer<typeof obligationRegisteredPayloadSchema>;

export function makeObligationRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ObligationRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ObligationRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: obligationRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// EventSchemaProposal
// ---------------------------------------------------------------------------

export const eventSchemaProposalPayloadSchema = z.object({
  proposalId: z.string().min(1),
  eventType: z.string().min(1),
  proposedBy: z.string().min(1),
  proposedAt: z.string().min(1),
  schemaDescription: z.string().min(1),
  rationale: z.string().min(1),
  status: z.enum(["draft", "under-review", "approved", "rejected"]),
});

export type EventSchemaProposalPayload = z.infer<typeof eventSchemaProposalPayloadSchema>;

export function makeEventSchemaProposal(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EventSchemaProposalPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EventSchemaProposal",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: eventSchemaProposalPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// EventSchemaPublished
// ---------------------------------------------------------------------------

export const eventSchemaPublishedPayloadSchema = z.object({
  schemaId: z.string().min(1),
  eventType: z.string().min(1),
  publishedBy: z.string().min(1),
  publishedAt: z.string().min(1),
  version: z.string().min(1),
  proposalId: z.string().optional(),
});

export type EventSchemaPublishedPayload = z.infer<typeof eventSchemaPublishedPayloadSchema>;

export function makeEventSchemaPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EventSchemaPublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EventSchemaPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: eventSchemaPublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// DashboardProjectionRefreshed
// ---------------------------------------------------------------------------

export const dashboardProjectionRefreshedPayloadSchema = z.object({
  refreshId: z.string().min(1),
  projectionName: z.string().min(1),
  refreshedAt: z.string().min(1),
  durationMs: z.number().int().nonnegative().optional(),
  rowsRefreshed: z.number().int().nonnegative().optional(),
  triggeredBy: z.string().optional(),
});

export type DashboardProjectionRefreshedPayload = z.infer<
  typeof dashboardProjectionRefreshedPayloadSchema
>;

export function makeDashboardProjectionRefreshed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DashboardProjectionRefreshedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DashboardProjectionRefreshed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: dashboardProjectionRefreshedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MarketsProjectionRegistered
// ---------------------------------------------------------------------------

export const marketsProjectionRegisteredPayloadSchema = z
  .object({
    // Emitted by anya-m1-projection-runtime-mapping handler
    projectionName: z.string().optional(),
    contract: z.string().optional(),
    semanticLayerEntries: z.array(z.unknown()).optional(),
    consumesEventTypes: z.array(z.string()).optional(),
    idempotencyKey: z.string().optional(),
    // Factory fields (alternative shape)
    projectionId: z.string().optional(),
    registeredAt: z.string().optional(),
    owner: z.string().optional(),
    refreshCadence: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

export type MarketsProjectionRegisteredPayload = z.infer<
  typeof marketsProjectionRegisteredPayloadSchema
>;

export function makeMarketsProjectionRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MarketsProjectionRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MarketsProjectionRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: marketsProjectionRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MarketsProjectionRefreshed
// ---------------------------------------------------------------------------

export const marketsProjectionRefreshedPayloadSchema = z
  .object({
    // Emitted by anya-m1-projection-runtime-mapping handler
    projectionName: z.string().optional(),
    rowCount: z.number().optional(),
    asOf: z.string().optional(),
    triggerKind: z.string().optional(),
    triggerId: z.string().optional(),
    triggeringEventIds: z.array(z.string()).optional(),
    // Factory fields (alternative shape)
    projectionId: z.string().optional(),
    refreshedAt: z.string().optional(),
    durationMs: z.number().optional(),
    triggeredBy: z.string().optional(),
  })
  .passthrough();

export type MarketsProjectionRefreshedPayload = z.infer<
  typeof marketsProjectionRefreshedPayloadSchema
>;

export function makeMarketsProjectionRefreshed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MarketsProjectionRefreshedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MarketsProjectionRefreshed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: marketsProjectionRefreshedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ThreatModelDimensionRegistered
// ---------------------------------------------------------------------------

export const threatModelDimensionRegisteredPayloadSchema = z
  .object({
    // Emitted by senna-m1-trading-stack-threat-model handler
    dimensionId: z.string().optional(),
    surface: z.string().optional(),
    headline: z.string().optional(),
    framework: z.string().optional(),
    controls: z.array(z.string()).optional(),
    substrateGap: z.string().optional(),
    sourceDecisionId: z.string().optional(),
    runTrigger: z.string().optional(),
    // Factory fields (alternative shape)
    dimensionName: z.string().optional(),
    threatCategory: z.string().optional(),
    registeredAt: z.string().optional(),
    registeredBy: z.string().optional(),
    mitigationStatus: z.enum(["open", "in-progress", "mitigated", "accepted"]).optional(),
    riskRating: z.enum(["low", "medium", "high", "critical"]).optional(),
  })
  .passthrough();

export type ThreatModelDimensionRegisteredPayload = z.infer<
  typeof threatModelDimensionRegisteredPayloadSchema
>;

export function makeThreatModelDimensionRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ThreatModelDimensionRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ThreatModelDimensionRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: threatModelDimensionRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SecurityGateRegistered
// ---------------------------------------------------------------------------

export const securityGateRegisteredPayloadSchema = z
  .object({
    // Emitted by senna-m1-trading-stack-threat-model handler
    gateId: z.string().optional(),
    gateKind: z.string().optional(),
    description: z.string().optional(),
    gatedDimensionIds: z.array(z.string()).optional(),
    sourceDecisionId: z.string().optional(),
    runTrigger: z.string().optional(),
    // Factory fields (alternative shape)
    gateName: z.string().optional(),
    registeredAt: z.string().optional(),
    registeredBy: z.string().optional(),
    automated: z.boolean().optional(),
  })
  .passthrough();

export type SecurityGateRegisteredPayload = z.infer<typeof securityGateRegisteredPayloadSchema>;

export function makeSecurityGateRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SecurityGateRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SecurityGateRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: securityGateRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IfrsClassificationApplied
// ---------------------------------------------------------------------------

export const ifrsClassificationAppliedPayloadSchema = z
  .object({
    // Emitted by bea-m1-ifrs-classification-rules handler
    tradeId: z.string().optional(),
    instrumentClass: z.string().optional(),
    category: z.string().optional(),
    hierarchyLevel: z.string().optional(),
    fxRevaluationRequired: z.boolean().optional(),
    functionalCurrency: z.string().optional(),
    tradeCurrency: z.string().optional(),
    businessModel: z.string().optional(),
    sppiPass: z.boolean().optional(),
    sourceEventId: z.string().optional(),
    ruleCitations: z.array(z.string()).optional(),
    // Factory fields (alternative shape)
    instrumentId: z.string().optional(),
    instrumentType: z.string().optional(),
    classification: z.enum(["FVTPL", "FVTOCI", "AC", "HFT", "AFS", "HTM", "other"]).optional(),
    appliedAt: z.string().optional(),
    appliedBy: z.string().optional(),
    ifrsStandard: z.string().optional(),
    rationale: z.string().optional(),
  })
  .passthrough();

export type IfrsClassificationAppliedPayload = z.infer<
  typeof ifrsClassificationAppliedPayloadSchema
>;

export function makeIfrsClassificationApplied(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IfrsClassificationAppliedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IfrsClassificationApplied",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ifrsClassificationAppliedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const AGENT_SUBSTRATE_EXTENDED_TYPED_EVENT_TYPES = [
  "WorkstreamStarted",
  "WorkstreamCompleted",
  "AgentCapabilityChanged",
  "AgentRetired",
  "AgentRunFailed",
  "PersonaSpecChanged",
  "RoleBriefDelivered",
  "RiskRunCompleted",
  "MergeRequested",
  "MandateGapDetected",
  "RoleResearchRequested",
  "RoleResearchQueueSnapshot",
  "CitationGatePassed",
  "CitationGateFailed",
  "M1CitationTrancheRegistered",
  "ObligationRegistered",
  "EventSchemaProposal",
  "EventSchemaPublished",
  "DashboardProjectionRefreshed",
  "MarketsProjectionRegistered",
  "MarketsProjectionRefreshed",
  "ThreatModelDimensionRegistered",
  "SecurityGateRegistered",
  "IfrsClassificationApplied",
] as const;
