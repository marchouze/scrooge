// platform/event-store/event-types/governance-extended.ts
//
// Extended governance, HR, audit, compliance event-payload schemas.
//
// Covers: AuditCommitteePackPrepped, AuditIssueOpened, AuditIssueClosed,
//   ExternalAuditorInquiry, ChangeApprovalRequested, ConflictDeclared,
//   PolicyChange, RiskPolicyChange, RiskPolicyChangeProposal, IncidentRaised,
//   ResolutionRequired, WhistleblowingDisclosure, DisciplinaryActionRequested,
//   HireConfirmed, LeaveGranted, Termination, LicenceGranted,
//   AlertOpened, SupervisoryLetterReceived, RegulatorInquiry,
//   RegulatorRequest, RegulatorCyberInquiry, ModelRiskDecisionRequired,
//   IdentityPermissionChangeProposal, ResilienceTestResult, SLOBudgetBurn,
//   CapacityBreach
//
// Authority: F-032 (event-type-registry-coverage recon).
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// AuditCommitteePackPrepped
// ---------------------------------------------------------------------------
//
// Schema aligned with thandiwe-audit-committee-prep.ts handler emission shape
// (2026-05-29). Handler emits: findingsLast7d, highSeverityFindingsLast7d,
// reconResultsLast7d, reconViolationsLast7d, governancePrepLast7d,
// priorPacksLast30d, whistleblowingLast7d, externalAuditorInquiryLast7d,
// thirdLineRelevantObligations, runTrigger.
// Original idealised fields (packId, period, preparedBy, preparedAt,
// meetingDate, sectionCount) are now optional for backward compat.
//
export const auditCommitteePackPreppedPayloadSchema = z
  .object({
    // Handler-emitted fields (authoritative)
    findingsLast7d: z.number().int().nonnegative().optional(),
    highSeverityFindingsLast7d: z.number().int().nonnegative().optional(),
    reconResultsLast7d: z.number().int().nonnegative().optional(),
    reconViolationsLast7d: z.number().int().nonnegative().optional(),
    governancePrepLast7d: z.number().int().nonnegative().optional(),
    priorPacksLast30d: z.number().int().nonnegative().optional(),
    whistleblowingLast7d: z.number().int().nonnegative().optional(),
    externalAuditorInquiryLast7d: z.number().int().nonnegative().optional(),
    thirdLineRelevantObligations: z.number().int().nonnegative().optional(),
    runTrigger: z.string().optional(),
    // Original idealised fields (optional, backward compat)
    packId: z.string().min(1).optional(),
    period: z.string().min(1).optional(),
    preparedBy: z.string().min(1).optional(),
    preparedAt: z.string().min(1).optional(),
    meetingDate: z.string().min(1).optional(),
    sectionCount: z.number().int().positive().optional(),
    filePath: z.string().optional(),
  })
  .passthrough();

export type AuditCommitteePackPreppedPayload = z.infer<
  typeof auditCommitteePackPreppedPayloadSchema
>;

export function makeAuditCommitteePackPrepped(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AuditCommitteePackPreppedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AuditCommitteePackPrepped",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: auditCommitteePackPreppedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AuditIssueOpened
// ---------------------------------------------------------------------------

export const auditIssueOpenedPayloadSchema = z.object({
  issueId: z.string().min(1),
  title: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  openedBy: z.string().min(1),
  openedAt: z.string().min(1),
  /** AuditFinding.findingId that triggered this issue. */
  auditFindingRef: z.string().optional(),
  dueDate: z.string().optional(),
  description: z.string().optional(),
  // Extended fields (2026-05-31) — added to support the issues-and-actions
  // tracker projection (platform/projections/issues-tracker.ts).
  /** AuditFinding category (mirrors AuditFindingCategory). */
  category: z.string().optional(),
  /** Agent URN the issue is addressed to — e.g. "agent:rohan". */
  addressedTo: z.string().optional(),
  /** Bare agent name — matches AgentRegistered.agentId. */
  agentId: z.string().optional(),
  /** Agent or human responsible for remediation (may differ from addressedTo). */
  remediationOwner: z.string().optional(),
});

export type AuditIssueOpenedPayload = z.infer<typeof auditIssueOpenedPayloadSchema>;

export function makeAuditIssueOpened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AuditIssueOpenedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AuditIssueOpened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: auditIssueOpenedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AuditIssueClosed
// ---------------------------------------------------------------------------

export const auditIssueClosedPayloadSchema = z.object({
  issueId: z.string().min(1),
  title: z.string().min(1),
  closedBy: z.string().min(1),
  closedAt: z.string().min(1),
  managementActionVerified: z.boolean(),
  closureNotes: z.string().optional(),
  // Extended fields (2026-05-31).
  /** Resolution classification. */
  resolution: z.enum(["remediated", "risk-accepted", "duplicate", "invalid"]).optional(),
});

export type AuditIssueClosedPayload = z.infer<typeof auditIssueClosedPayloadSchema>;

export function makeAuditIssueClosed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AuditIssueClosedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AuditIssueClosed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: auditIssueClosedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ExternalAuditorInquiry
// ---------------------------------------------------------------------------

export const externalAuditorInquiryPayloadSchema = z.object({
  inquiryId: z.string().min(1),
  auditorFirm: z.string().min(1),
  receivedAt: z.string().min(1),
  subject: z.string().min(1),
  responseDeadline: z.string().optional(),
  assignedTo: z.string().optional(),
});

export type ExternalAuditorInquiryPayload = z.infer<typeof externalAuditorInquiryPayloadSchema>;

export function makeExternalAuditorInquiry(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ExternalAuditorInquiryPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ExternalAuditorInquiry",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: externalAuditorInquiryPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ChangeApprovalRequested
// ---------------------------------------------------------------------------

export const changeApprovalRequestedPayloadSchema = z.object({
  changeId: z.string().min(1),
  title: z.string().min(1),
  requestedBy: z.string().min(1),
  requestedAt: z.string().min(1),
  changeKind: z.enum(["standard", "normal", "emergency", "pre-approved"]),
  impactAssessment: z.string().optional(),
  implementationWindow: z.string().optional(),
});

export type ChangeApprovalRequestedPayload = z.infer<typeof changeApprovalRequestedPayloadSchema>;

export function makeChangeApprovalRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ChangeApprovalRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ChangeApprovalRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: changeApprovalRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ConflictDeclared
// ---------------------------------------------------------------------------

export const conflictDeclaredPayloadSchema = z
  .object({
    conflictId: z.string().optional(),
    declarant: z.string().optional(),
    declaredAt: z.string().optional(),
    declarationId: z.string().optional(),
    declarantName: z.string().optional(),
    declarantRole: z.string().optional(),
    conflictDescription: z.string().optional(),
    dispositionRequired: z.boolean().optional(),
    relatedMatter: z.string().optional(),
  })
  .passthrough();

export type ConflictDeclaredPayload = z.infer<typeof conflictDeclaredPayloadSchema>;

export function makeConflictDeclared(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ConflictDeclaredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ConflictDeclared",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: conflictDeclaredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PolicyChange
// ---------------------------------------------------------------------------

export const policyChangePayloadSchema = z.object({
  policyId: z.string().min(1),
  policyTitle: z.string().min(1),
  changeKind: z.enum(["new", "amendment", "withdrawal", "supersession"]),
  effectiveDate: z.string().min(1),
  approvedBy: z.string().min(1),
  version: z.string().min(1),
  filePath: z.string().optional(),
  supersedes: z.string().optional(),
});

export type PolicyChangePayload = z.infer<typeof policyChangePayloadSchema>;

export function makePolicyChange(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PolicyChangePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PolicyChange",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: policyChangePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RiskPolicyChange
// ---------------------------------------------------------------------------

export const riskPolicyChangePayloadSchema = z.object({
  policyId: z.string().min(1),
  policyTitle: z.string().min(1),
  changeKind: z.enum(["new", "amendment", "withdrawal"]),
  effectiveDate: z.string().min(1),
  approvedBy: z.string().min(1),
  version: z.string().min(1),
  riskDomain: z.string().optional(),
});

export type RiskPolicyChangePayload = z.infer<typeof riskPolicyChangePayloadSchema>;

export function makeRiskPolicyChange(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RiskPolicyChangePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RiskPolicyChange",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: riskPolicyChangePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RiskPolicyChangeProposal
// ---------------------------------------------------------------------------

export const riskPolicyChangeProposalPayloadSchema = z.object({
  proposalId: z.string().min(1),
  policyId: z.string().min(1),
  proposedBy: z.string().min(1),
  proposedAt: z.string().min(1),
  changeDescription: z.string().min(1),
  rationale: z.string().min(1),
  status: z.enum(["draft", "under-review", "approved", "rejected"]),
});

export type RiskPolicyChangeProposalPayload = z.infer<typeof riskPolicyChangeProposalPayloadSchema>;

export function makeRiskPolicyChangeProposal(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RiskPolicyChangeProposalPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RiskPolicyChangeProposal",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: riskPolicyChangeProposalPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IncidentRaised
// ---------------------------------------------------------------------------

export const incidentRaisedPayloadSchema = z.object({
  incidentId: z.string().min(1),
  title: z.string().min(1),
  severity: z.enum(["P1", "P2", "P3", "P4"]),
  raisedBy: z.string().min(1),
  raisedAt: z.string().min(1),
  affectedSystem: z.string().optional(),
  incidentKind: z.enum(["security", "operational", "availability", "performance", "other"]),
  description: z.string().optional(),
});

export type IncidentRaisedPayload = z.infer<typeof incidentRaisedPayloadSchema>;

export function makeIncidentRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IncidentRaisedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IncidentRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: incidentRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ResolutionRequired
// ---------------------------------------------------------------------------

export const resolutionRequiredPayloadSchema = z.object({
  resolutionId: z.string().min(1),
  subject: z.string().min(1),
  raisedBy: z.string().min(1),
  raisedAt: z.string().min(1),
  resolutionKind: z.enum(["arbitration", "mediation", "regulatory", "internal"]),
  description: z.string().optional(),
  deadline: z.string().optional(),
});

export type ResolutionRequiredPayload = z.infer<typeof resolutionRequiredPayloadSchema>;

export function makeResolutionRequired(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ResolutionRequiredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ResolutionRequired",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: resolutionRequiredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// WhistleblowingDisclosure
// ---------------------------------------------------------------------------

export const whistleblowingDisclosurePayloadSchema = z.object({
  disclosureId: z.string().min(1),
  receivedAt: z.string().min(1),
  channel: z.enum(["anonymous", "named", "third-party"]),
  subject: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  assignedTo: z.string().optional(),
  sealed: z.boolean().optional(),
});

export type WhistleblowingDisclosurePayload = z.infer<typeof whistleblowingDisclosurePayloadSchema>;

export function makeWhistleblowingDisclosure(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: WhistleblowingDisclosurePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "WhistleblowingDisclosure",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: whistleblowingDisclosurePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// DisciplinaryActionRequested
// ---------------------------------------------------------------------------

export const disciplinaryActionRequestedPayloadSchema = z.object({
  requestId: z.string().min(1),
  subjectName: z.string().min(1),
  requestedBy: z.string().min(1),
  requestedAt: z.string().min(1),
  actionKind: z.enum([
    "verbal-warning",
    "written-warning",
    "final-warning",
    "suspension",
    "termination",
    "investigation",
  ]),
  allegation: z.string().min(1),
});

export type DisciplinaryActionRequestedPayload = z.infer<
  typeof disciplinaryActionRequestedPayloadSchema
>;

export function makeDisciplinaryActionRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DisciplinaryActionRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DisciplinaryActionRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: disciplinaryActionRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// HireConfirmed
// ---------------------------------------------------------------------------

export const hireConfirmedPayloadSchema = z.object({
  agentName: z.string().min(1),
  agentPosition: z.string().min(1),
  confirmedBy: z.string().min(1),
  confirmedAt: z.string().min(1),
  startDate: z.string().min(1),
  specFilePath: z.string().optional(),
});

export type HireConfirmedPayload = z.infer<typeof hireConfirmedPayloadSchema>;

export function makeHireConfirmed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: HireConfirmedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "HireConfirmed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: hireConfirmedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LeaveGranted
// ---------------------------------------------------------------------------

export const leaveGrantedPayloadSchema = z.object({
  leaveId: z.string().min(1),
  agentName: z.string().min(1),
  agentPosition: z.string().min(1),
  leaveKind: z.enum(["annual", "sick", "maternity", "paternity", "study", "other"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  approvedBy: z.string().min(1),
  approvedAt: z.string().min(1),
});

export type LeaveGrantedPayload = z.infer<typeof leaveGrantedPayloadSchema>;

export function makeLeaveGranted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LeaveGrantedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LeaveGranted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: leaveGrantedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Termination
// ---------------------------------------------------------------------------

export const terminationPayloadSchema = z.object({
  agentName: z.string().min(1),
  agentPosition: z.string().min(1),
  terminationKind: z.enum(["resignation", "dismissal", "redundancy", "retirement", "contract-end"]),
  effectiveDate: z.string().min(1),
  authorizedBy: z.string().min(1),
  reason: z.string().optional(),
});

export type TerminationPayload = z.infer<typeof terminationPayloadSchema>;

export function makeTermination(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TerminationPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "Termination",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: terminationPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LicenceGranted
// ---------------------------------------------------------------------------

export const licenceGrantedPayloadSchema = z.object({
  licenceId: z.string().min(1),
  licenceKind: z.string().min(1),
  grantedBy: z.string().min(1),
  grantedAt: z.string().min(1),
  effectiveDate: z.string().min(1),
  expiryDate: z.string().optional(),
  conditions: z.array(z.string()).optional(),
});

export type LicenceGrantedPayload = z.infer<typeof licenceGrantedPayloadSchema>;

export function makeLicenceGranted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LicenceGrantedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LicenceGranted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: licenceGrantedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AlertOpened
// ---------------------------------------------------------------------------

export const alertOpenedPayloadSchema = z
  .object({
    alertId: z.string().optional(),
    raisedAt: z.string().optional(),
    alertKind: z.string().optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    openedBy: z.string().optional(),
    openedAt: z.string().optional(),
    description: z.string().optional(),
    sourceRef: z.string().optional(),
  })
  .passthrough();

export type AlertOpenedPayload = z.infer<typeof alertOpenedPayloadSchema>;

export function makeAlertOpened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AlertOpenedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AlertOpened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: alertOpenedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SupervisoryLetterReceived
// ---------------------------------------------------------------------------

export const supervisoryLetterReceivedPayloadSchema = z.object({
  letterId: z.string().min(1),
  regulator: z.enum(["SARB", "FSCA", "FIC", "NPA", "other"]),
  receivedAt: z.string().min(1),
  subject: z.string().min(1),
  responseDeadline: z.string().optional(),
  assignedTo: z.string().optional(),
  urgent: z.boolean().optional(),
});

export type SupervisoryLetterReceivedPayload = z.infer<
  typeof supervisoryLetterReceivedPayloadSchema
>;

export function makeSupervisoryLetterReceived(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SupervisoryLetterReceivedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SupervisoryLetterReceived",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: supervisoryLetterReceivedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RegulatorInquiry
// ---------------------------------------------------------------------------

export const regulatorInquiryPayloadSchema = z.object({
  inquiryId: z.string().min(1),
  regulator: z.enum(["SARB", "FSCA", "FIC", "NPA", "other"]),
  receivedAt: z.string().min(1),
  subject: z.string().min(1),
  responseDeadline: z.string().optional(),
  assignedTo: z.string().optional(),
  sensitiveInformation: z.boolean().optional(),
});

export type RegulatorInquiryPayload = z.infer<typeof regulatorInquiryPayloadSchema>;

export function makeRegulatorInquiry(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RegulatorInquiryPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RegulatorInquiry",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: regulatorInquiryPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RegulatorRequest
// ---------------------------------------------------------------------------

export const regulatorRequestPayloadSchema = z.object({
  requestId: z.string().min(1),
  regulator: z.enum(["SARB", "FSCA", "FIC", "NPA", "other"]),
  receivedAt: z.string().min(1),
  requestKind: z.enum(["data", "document", "information", "on-site", "other"]),
  subject: z.string().min(1),
  responseDeadline: z.string().optional(),
});

export type RegulatorRequestPayload = z.infer<typeof regulatorRequestPayloadSchema>;

export function makeRegulatorRequest(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RegulatorRequestPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RegulatorRequest",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: regulatorRequestPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RegulatorCyberInquiry
// ---------------------------------------------------------------------------

export const regulatorCyberInquiryPayloadSchema = z.object({
  inquiryId: z.string().min(1),
  regulator: z.enum(["SARB", "FSCA", "FIC", "other"]),
  receivedAt: z.string().min(1),
  subject: z.string().min(1),
  cyberIncidentRef: z.string().optional(),
  responseDeadline: z.string().optional(),
  assignedTo: z.string().optional(),
});

export type RegulatorCyberInquiryPayload = z.infer<typeof regulatorCyberInquiryPayloadSchema>;

export function makeRegulatorCyberInquiry(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RegulatorCyberInquiryPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RegulatorCyberInquiry",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: regulatorCyberInquiryPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ModelRiskDecisionRequired
// ---------------------------------------------------------------------------

export const modelRiskDecisionRequiredPayloadSchema = z.object({
  decisionRequestId: z.string().min(1),
  modelId: z.string().min(1),
  decisionKind: z.enum(["approve", "reject", "conditional-approve", "defer"]),
  raisedBy: z.string().min(1),
  raisedAt: z.string().min(1),
  context: z.string().min(1),
  deadline: z.string().optional(),
});

export type ModelRiskDecisionRequiredPayload = z.infer<
  typeof modelRiskDecisionRequiredPayloadSchema
>;

export function makeModelRiskDecisionRequired(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ModelRiskDecisionRequiredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ModelRiskDecisionRequired",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: modelRiskDecisionRequiredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IdentityPermissionChangeProposal
// ---------------------------------------------------------------------------

export const identityPermissionChangeProposalPayloadSchema = z.object({
  proposalId: z.string().min(1),
  proposedBy: z.string().min(1),
  proposedAt: z.string().min(1),
  targetAgent: z.string().min(1),
  changeDescription: z.string().min(1),
  permissionKind: z.enum(["grant", "revoke", "modify"]),
  rationale: z.string().min(1),
  status: z.enum(["draft", "under-review", "approved", "rejected"]),
});

export type IdentityPermissionChangeProposalPayload = z.infer<
  typeof identityPermissionChangeProposalPayloadSchema
>;

export function makeIdentityPermissionChangeProposal(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IdentityPermissionChangeProposalPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IdentityPermissionChangeProposal",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: identityPermissionChangeProposalPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ResilienceTestResult
// ---------------------------------------------------------------------------

export const resilienceTestResultPayloadSchema = z.object({
  testId: z.string().min(1),
  testKind: z.enum(["BCP", "DR", "chaos-engineering", "fire-drill", "other"]),
  executedAt: z.string().min(1),
  executedBy: z.string().min(1),
  outcome: z.enum(["passed", "failed", "partial"]),
  rtoAchievedMs: z.number().int().nonnegative().optional(),
  rpoAchievedMs: z.number().int().nonnegative().optional(),
  findingsCount: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

export type ResilienceTestResultPayload = z.infer<typeof resilienceTestResultPayloadSchema>;

export function makeResilienceTestResult(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ResilienceTestResultPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ResilienceTestResult",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: resilienceTestResultPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SLOBudgetBurn
// ---------------------------------------------------------------------------

export const sloBudgetBurnPayloadSchema = z.object({
  alertId: z.string().min(1),
  sloName: z.string().min(1),
  windowHours: z.number().int().positive(),
  burnRate: z.number().positive(),
  budgetRemainingPct: z.number().min(0).max(100),
  detectedAt: z.string().min(1),
  severity: z.enum(["warn", "critical"]),
});

export type SLOBudgetBurnPayload = z.infer<typeof sloBudgetBurnPayloadSchema>;

export function makeSLOBudgetBurn(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SLOBudgetBurnPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SLOBudgetBurn",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: sloBudgetBurnPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CapacityBreach
// ---------------------------------------------------------------------------

export const capacityBreachPayloadSchema = z.object({
  alertId: z.string().min(1),
  resourceKind: z.enum(["cpu", "memory", "storage", "network", "api-quota", "other"]),
  resourceName: z.string().min(1),
  utilizationPct: z.number().min(0).max(100),
  thresholdPct: z.number().min(0).max(100),
  detectedAt: z.string().min(1),
  severity: z.enum(["warn", "critical"]),
  projectedExhaustionAt: z.string().optional(),
});

export type CapacityBreachPayload = z.infer<typeof capacityBreachPayloadSchema>;

export function makeCapacityBreach(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CapacityBreachPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CapacityBreach",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: capacityBreachPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const GOVERNANCE_EXTENDED_TYPED_EVENT_TYPES = [
  "AuditCommitteePackPrepped",
  "AuditIssueOpened",
  "AuditIssueClosed",
  "ExternalAuditorInquiry",
  "ChangeApprovalRequested",
  "ConflictDeclared",
  "PolicyChange",
  "RiskPolicyChange",
  "RiskPolicyChangeProposal",
  "IncidentRaised",
  "ResolutionRequired",
  "WhistleblowingDisclosure",
  "DisciplinaryActionRequested",
  "HireConfirmed",
  "LeaveGranted",
  "Termination",
  "LicenceGranted",
  "AlertOpened",
  "SupervisoryLetterReceived",
  "RegulatorInquiry",
  "RegulatorRequest",
  "RegulatorCyberInquiry",
  "ModelRiskDecisionRequired",
  "IdentityPermissionChangeProposal",
  "ResilienceTestResult",
  "SLOBudgetBurn",
  "CapacityBreach",
] as const;
