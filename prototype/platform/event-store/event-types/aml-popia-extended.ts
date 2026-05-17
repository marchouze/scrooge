// platform/event-store/event-types/aml-popia-extended.ts
//
// AML, sanctions, POPIA, party screening event-payload schemas.
//
// Covers: SanctionsHit, SanctionsHoldRaised, SanctionsListPublished,
//   PEPMatchExceedsThreshold, PepListPublished, AdverseMediaPublished,
//   STRCandidate, FAISConductBreachSuspected, CounterpartyEvent,
//   DSARReceived, PAIARequest, POPIAControlsSnapshot,
//   PersonalInformationCompromiseSuspected, ConsentWithdrawn,
//   InformationRegulatorInquiry, NewProcessingPurposeProposed,
//   SuspiciousAuthEvent, CrossBorderTransferRequested,
//   AdviceRecordRequested, ClientCandidateRegistered, ClientReviewTriggered,
//   LeadCaptured, OnboardingHandoffPending, SuitabilityAssessmentRequired
//
// Authority: F-032 (event-type-registry-coverage recon).
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// SanctionsHit
// ---------------------------------------------------------------------------

export const sanctionsHitPayloadSchema = z.object({
  hitId: z.string().min(1),
  screeningRunId: z.string().min(1),
  partyRef: z.string().min(1),
  listName: z.string().min(1),
  matchScore: z.number().min(0).max(100),
  matchedName: z.string().min(1),
  detectedAt: z.string().min(1),
  requiresHold: z.boolean(),
});

export type SanctionsHitPayload = z.infer<typeof sanctionsHitPayloadSchema>;

export function makeSanctionsHit(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SanctionsHitPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SanctionsHit",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: sanctionsHitPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SanctionsHoldRaised
// ---------------------------------------------------------------------------

export const sanctionsHoldRaisedPayloadSchema = z.object({
  holdId: z.string().min(1),
  hitId: z.string().min(1),
  paymentRef: z.string().optional(),
  raisedBy: z.string().min(1),
  raisedAt: z.string().min(1),
  holdKind: z.enum(["payment", "account", "counterparty"]),
  escalatedTo: z.string().optional(),
});

export type SanctionsHoldRaisedPayload = z.infer<typeof sanctionsHoldRaisedPayloadSchema>;

export function makeSanctionsHoldRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SanctionsHoldRaisedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SanctionsHoldRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: sanctionsHoldRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SanctionsListPublished
// ---------------------------------------------------------------------------

export const sanctionsListPublishedPayloadSchema = z.object({
  listId: z.string().min(1),
  listName: z.string().min(1),
  publishingAuthority: z.string().min(1),
  publishedAt: z.string().min(1),
  entryCount: z.number().int().nonnegative(),
  changeKind: z.enum(["new", "update", "removal"]).optional(),
});

export type SanctionsListPublishedPayload = z.infer<typeof sanctionsListPublishedPayloadSchema>;

export function makeSanctionsListPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SanctionsListPublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SanctionsListPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: sanctionsListPublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PEPMatchExceedsThreshold
// ---------------------------------------------------------------------------

export const pepMatchExceedsThresholdPayloadSchema = z.object({
  matchId: z.string().min(1),
  screeningRunId: z.string().min(1),
  partyRef: z.string().min(1),
  matchScore: z.number().min(0).max(100),
  threshold: z.number().min(0).max(100),
  matchedName: z.string().min(1),
  pepCategory: z.string().optional(),
  detectedAt: z.string().min(1),
});

export type PEPMatchExceedsThresholdPayload = z.infer<typeof pepMatchExceedsThresholdPayloadSchema>;

export function makePEPMatchExceedsThreshold(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PEPMatchExceedsThresholdPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PEPMatchExceedsThreshold",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: pepMatchExceedsThresholdPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PepListPublished
// ---------------------------------------------------------------------------

export const pepListPublishedPayloadSchema = z.object({
  listId: z.string().min(1),
  listName: z.string().min(1),
  publishingAuthority: z.string().min(1),
  publishedAt: z.string().min(1),
  entryCount: z.number().int().nonnegative(),
});

export type PepListPublishedPayload = z.infer<typeof pepListPublishedPayloadSchema>;

export function makePepListPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PepListPublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PepListPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: pepListPublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AdverseMediaPublished
// ---------------------------------------------------------------------------

export const adverseMediaPublishedPayloadSchema = z.object({
  mediaId: z.string().min(1),
  partyRef: z.string().min(1),
  headline: z.string().min(1),
  source: z.string().min(1),
  publishedAt: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  requiresReview: z.boolean(),
});

export type AdverseMediaPublishedPayload = z.infer<typeof adverseMediaPublishedPayloadSchema>;

export function makeAdverseMediaPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AdverseMediaPublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AdverseMediaPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: adverseMediaPublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// STRCandidate
// ---------------------------------------------------------------------------

export const strCandidatePayloadSchema = z.object({
  candidateId: z.string().min(1),
  transactionRef: z.string().min(1),
  flaggedBy: z.string().min(1),
  flaggedAt: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  suspicionBasis: z.string().min(1),
  mlroReviewRequired: z.boolean(),
});

export type STRCandidatePayload = z.infer<typeof strCandidatePayloadSchema>;

export function makeSTRCandidate(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: STRCandidatePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "STRCandidate",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: strCandidatePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FAISConductBreachSuspected
// ---------------------------------------------------------------------------

export const faisConductBreachSuspectedPayloadSchema = z.object({
  suspicionId: z.string().min(1),
  faisProvision: z.string().min(1),
  detectedBy: z.string().min(1),
  detectedAt: z.string().min(1),
  description: z.string().min(1),
  agentRef: z.string().optional(),
  severity: z.enum(["low", "medium", "high"]),
});

export type FAISConductBreachSuspectedPayload = z.infer<
  typeof faisConductBreachSuspectedPayloadSchema
>;

export function makeFAISConductBreachSuspected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FAISConductBreachSuspectedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FAISConductBreachSuspected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: faisConductBreachSuspectedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CounterpartyEvent
// ---------------------------------------------------------------------------

export const counterpartyEventPayloadSchema = z.object({
  counterpartyRef: z.string().min(1),
  eventKind: z.enum([
    "default",
    "rating-change",
    "insolvency-filing",
    "sanctions-listed",
    "restructuring",
    "other",
  ]),
  detectedAt: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().min(1),
  sourceRef: z.string().optional(),
  requiresAction: z.boolean(),
});

export type CounterpartyEventPayload = z.infer<typeof counterpartyEventPayloadSchema>;

export function makeCounterpartyEvent(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyEventPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyEvent",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyEventPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// DSARReceived
// ---------------------------------------------------------------------------

export const dsarReceivedPayloadSchema = z.object({
  dsarId: z.string().min(1),
  dataSubjectRef: z.string().min(1),
  receivedAt: z.string().min(1),
  requestKind: z.enum(["access", "rectification", "erasure", "portability", "objection", "other"]),
  responseDeadline: z.string().min(1),
  assignedTo: z.string().optional(),
});

export type DSARReceivedPayload = z.infer<typeof dsarReceivedPayloadSchema>;

export function makeDSARReceived(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DSARReceivedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DSARReceived",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: dsarReceivedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PAIARequest
// ---------------------------------------------------------------------------

export const paiaRequestPayloadSchema = z.object({
  requestId: z.string().min(1),
  requesterRef: z.string().min(1),
  receivedAt: z.string().min(1),
  informationDescription: z.string().min(1),
  responseDeadline: z.string().min(1),
  assignedTo: z.string().optional(),
  fee: z.number().nonnegative().optional(),
});

export type PAIARequestPayload = z.infer<typeof paiaRequestPayloadSchema>;

export function makePAIARequest(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PAIARequestPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PAIARequest",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: paiaRequestPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// POPIAControlsSnapshot
// ---------------------------------------------------------------------------

export const popiaControlsSnapshotPayloadSchema = z.object({
  snapshotId: z.string().min(1),
  asOf: z.string().min(1),
  dataMappingComplete: z.boolean(),
  consentRegisterCount: z.number().int().nonnegative(),
  openBreachCount: z.number().int().nonnegative(),
  openDSARCount: z.number().int().nonnegative(),
  overallStatus: z.enum(["green", "amber", "red"]),
});

export type POPIAControlsSnapshotPayload = z.infer<typeof popiaControlsSnapshotPayloadSchema>;

export function makePOPIAControlsSnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: POPIAControlsSnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "POPIAControlsSnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: popiaControlsSnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PersonalInformationCompromiseSuspected
// ---------------------------------------------------------------------------

export const personalInformationCompromiseSuspectedPayloadSchema = z.object({
  incidentId: z.string().min(1),
  detectedBy: z.string().min(1),
  detectedAt: z.string().min(1),
  compromiseKind: z.enum(["breach", "unauthorised-access", "loss", "theft", "other"]),
  estimatedRecordsAffected: z.number().int().nonnegative().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  regulatorNotificationRequired: z.boolean(),
});

export type PersonalInformationCompromiseSuspectedPayload = z.infer<
  typeof personalInformationCompromiseSuspectedPayloadSchema
>;

export function makePersonalInformationCompromiseSuspected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PersonalInformationCompromiseSuspectedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PersonalInformationCompromiseSuspected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: personalInformationCompromiseSuspectedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ConsentWithdrawn
// ---------------------------------------------------------------------------

export const consentWithdrawnPayloadSchema = z.object({
  consentId: z.string().min(1),
  dataSubjectRef: z.string().min(1),
  withdrawnAt: z.string().min(1),
  processingPurpose: z.string().min(1),
  effectiveImmediately: z.boolean(),
  downstreamNotificationRequired: z.boolean(),
});

export type ConsentWithdrawnPayload = z.infer<typeof consentWithdrawnPayloadSchema>;

export function makeConsentWithdrawn(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ConsentWithdrawnPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ConsentWithdrawn",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: consentWithdrawnPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// InformationRegulatorInquiry
// ---------------------------------------------------------------------------

export const informationRegulatorInquiryPayloadSchema = z.object({
  inquiryId: z.string().min(1),
  receivedAt: z.string().min(1),
  subject: z.string().min(1),
  regulatorRef: z.string().optional(),
  responseDeadline: z.string().optional(),
  assignedTo: z.string().optional(),
});

export type InformationRegulatorInquiryPayload = z.infer<
  typeof informationRegulatorInquiryPayloadSchema
>;

export function makeInformationRegulatorInquiry(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: InformationRegulatorInquiryPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "InformationRegulatorInquiry",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: informationRegulatorInquiryPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// NewProcessingPurposeProposed
// ---------------------------------------------------------------------------

export const newProcessingPurposeProposedPayloadSchema = z.object({
  proposalId: z.string().min(1),
  purpose: z.string().min(1),
  lawfulBasis: z.enum([
    "consent",
    "contract",
    "legal-obligation",
    "legitimate-interest",
    "vital-interest",
    "public-task",
  ]),
  proposedBy: z.string().min(1),
  proposedAt: z.string().min(1),
  dataCategories: z.array(z.string()).optional(),
  status: z.enum(["draft", "under-review", "approved", "rejected"]),
});

export type NewProcessingPurposeProposedPayload = z.infer<
  typeof newProcessingPurposeProposedPayloadSchema
>;

export function makeNewProcessingPurposeProposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: NewProcessingPurposeProposedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "NewProcessingPurposeProposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: newProcessingPurposeProposedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SuspiciousAuthEvent
// ---------------------------------------------------------------------------

export const suspiciousAuthEventPayloadSchema = z.object({
  authEventId: z.string().min(1),
  eventKind: z.enum([
    "brute-force",
    "credential-stuffing",
    "anomalous-login",
    "mfa-bypass",
    "session-hijack",
    "other",
  ]),
  detectedAt: z.string().min(1),
  sourceIp: z.string().optional(),
  userRef: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  autoBlocked: z.boolean(),
});

export type SuspiciousAuthEventPayload = z.infer<typeof suspiciousAuthEventPayloadSchema>;

export function makeSuspiciousAuthEvent(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SuspiciousAuthEventPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SuspiciousAuthEvent",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: suspiciousAuthEventPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CrossBorderTransferRequested
// ---------------------------------------------------------------------------

export const crossBorderTransferRequestedPayloadSchema = z.object({
  requestId: z.string().min(1),
  dataSubjectRef: z.string().min(1),
  destinationCountry: z.string().min(1),
  transferPurpose: z.string().min(1),
  requestedAt: z.string().min(1),
  adequacyStatus: z.enum(["adequate", "standard-clauses", "binding-rules", "unknown"]),
  requiresApproval: z.boolean(),
});

export type CrossBorderTransferRequestedPayload = z.infer<
  typeof crossBorderTransferRequestedPayloadSchema
>;

export function makeCrossBorderTransferRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CrossBorderTransferRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CrossBorderTransferRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: crossBorderTransferRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AdviceRecordRequested
// ---------------------------------------------------------------------------

export const adviceRecordRequestedPayloadSchema = z.object({
  requestId: z.string().min(1),
  clientRef: z.string().min(1),
  faisObligation: z.string().min(1),
  requestedAt: z.string().min(1),
  interactionRef: z.string().optional(),
  deadline: z.string().optional(),
});

export type AdviceRecordRequestedPayload = z.infer<typeof adviceRecordRequestedPayloadSchema>;

export function makeAdviceRecordRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AdviceRecordRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AdviceRecordRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: adviceRecordRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ClientCandidateRegistered
// ---------------------------------------------------------------------------

export const clientCandidateRegisteredPayloadSchema = z
  .object({
    // Emitted by domains/customer/onboarding.ts clientCandidateRegistered()
    candidateId: z.string().optional(),
    entityType: z.enum(["natural-person", "legal-entity", "trust"]).optional(),
    registeredBy: z.string().optional(),
    entity: z.string().optional(),
    // Factory fields (alternative shape)
    registeredAt: z.string().optional(),
    clientKind: z.enum(["institutional", "retail", "internal"]).optional(),
    kycStatus: z.enum(["pending", "in-progress", "complete", "failed"]).optional(),
    assignedTo: z.string().optional(),
    sourceRef: z.string().optional(),
  })
  .passthrough();

export type ClientCandidateRegisteredPayload = z.infer<
  typeof clientCandidateRegisteredPayloadSchema
>;

export function makeClientCandidateRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ClientCandidateRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ClientCandidateRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: clientCandidateRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ClientReviewTriggered
// ---------------------------------------------------------------------------

export const clientReviewTriggeredPayloadSchema = z.object({
  reviewId: z.string().min(1),
  clientRef: z.string().min(1),
  triggeredAt: z.string().min(1),
  reviewKind: z.enum(["periodic", "event-driven", "enhanced-due-diligence"]),
  triggerReason: z.string().optional(),
  dueDate: z.string().optional(),
});

export type ClientReviewTriggeredPayload = z.infer<typeof clientReviewTriggeredPayloadSchema>;

export function makeClientReviewTriggered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ClientReviewTriggeredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ClientReviewTriggered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: clientReviewTriggeredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LeadCaptured
// ---------------------------------------------------------------------------

export const leadCapturedPayloadSchema = z.object({
  leadId: z.string().min(1),
  capturedAt: z.string().min(1),
  source: z.enum(["referral", "inbound", "outbound", "conference", "other"]),
  prospectName: z.string().optional(),
  prospectKind: z.enum(["institutional", "corporate", "other"]).optional(),
  assignedTo: z.string().optional(),
});

export type LeadCapturedPayload = z.infer<typeof leadCapturedPayloadSchema>;

export function makeLeadCaptured(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LeadCapturedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LeadCaptured",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: leadCapturedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OnboardingHandoffPending
// ---------------------------------------------------------------------------

export const onboardingHandoffPendingPayloadSchema = z.object({
  handoffId: z.string().min(1),
  clientRef: z.string().min(1),
  fromAgent: z.string().min(1),
  toAgent: z.string().min(1),
  pendingAt: z.string().min(1),
  handoffKind: z.enum(["kyc-gate", "credit-approval", "documentation", "other"]),
  notes: z.string().optional(),
});

export type OnboardingHandoffPendingPayload = z.infer<typeof onboardingHandoffPendingPayloadSchema>;

export function makeOnboardingHandoffPending(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OnboardingHandoffPendingPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OnboardingHandoffPending",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: onboardingHandoffPendingPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SuitabilityAssessmentRequired
// ---------------------------------------------------------------------------

export const suitabilityAssessmentRequiredPayloadSchema = z.object({
  assessmentId: z.string().min(1),
  clientRef: z.string().min(1),
  productRef: z.string().min(1),
  requiredAt: z.string().min(1),
  faisObligation: z.string().optional(),
  deadline: z.string().optional(),
  assignedTo: z.string().optional(),
});

export type SuitabilityAssessmentRequiredPayload = z.infer<
  typeof suitabilityAssessmentRequiredPayloadSchema
>;

export function makeSuitabilityAssessmentRequired(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SuitabilityAssessmentRequiredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SuitabilityAssessmentRequired",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: suitabilityAssessmentRequiredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const AML_POPIA_EXTENDED_TYPED_EVENT_TYPES = [
  "SanctionsHit",
  "SanctionsHoldRaised",
  "SanctionsListPublished",
  "PEPMatchExceedsThreshold",
  "PepListPublished",
  "AdverseMediaPublished",
  "STRCandidate",
  "FAISConductBreachSuspected",
  "CounterpartyEvent",
  "DSARReceived",
  "PAIARequest",
  "POPIAControlsSnapshot",
  "PersonalInformationCompromiseSuspected",
  "ConsentWithdrawn",
  "InformationRegulatorInquiry",
  "NewProcessingPurposeProposed",
  "SuspiciousAuthEvent",
  "CrossBorderTransferRequested",
  "AdviceRecordRequested",
  "ClientCandidateRegistered",
  "ClientReviewTriggered",
  "LeadCaptured",
  "OnboardingHandoffPending",
  "SuitabilityAssessmentRequired",
] as const;
