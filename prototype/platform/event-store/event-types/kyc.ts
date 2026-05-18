// platform/event-store/event-types/kyc.ts
//
// KYC onboarding lifecycle typed event-payload schemas.
//
// Covers the full KYC gateway event family:
//   Onboarding: ClientCandidateRegistered (extended), KYCIdentityCollected,
//     KYCIdentityVerified, KYCIdentityVerificationFailed,
//     KYCSanctionsPEPScreened, KYCUBOResolved, KYCRiskRated,
//     KYCEDDInitiated, KYCEDDCompleted, KYCDecisionMade,
//     ClientAccepted, ClientRejected, LawfulProcessingRegistered
//   Refresh: KYCRefreshScheduled, KYCRefreshCompleted, KYCRatingRevised
//   Categorisation: CounterpartyCategorised, CounterpartyDeclined
//
// Note: ClientCandidateRegistered also exists in aml-popia-extended.ts
// with a passthrough/loose schema for legacy compatibility. This module
// provides the strict gateway schema. Both can coexist; the registry
// row in kyc-registry.ts references this stricter schema.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   PROC-FC-01 (KYC onboarding procedure);
//   AML-CFT-POLICY-V1; FIC-ACT-38-2001 (CDD/EDD obligations);
//   FATF-REC-10, FATF-REC-12; POPIA-S11; FAIS-ACT-37-2002.
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Zara (MLRO, governance) + Mira (Compliance / RegTech engineer, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { deterministicAggregateId, makeAggregateLabel } from "../aggregate";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

const directorSchema = z.object({
  name: z.string().min(1),
  id_number: z.string().min(1),
  role: z.string().min(1),
});

const uboSchema = z.object({
  name: z.string().min(1),
  id_number: z.string().min(1),
  nationality: z.string().min(1),
  ownership_pct: z.number().min(0).max(100),
  basis_of_control: z.string().min(1),
});

const documentSchema = z.object({
  type: z.string().min(1),
  hash: z.string().min(1),
});

const sanctionsListSchema = z.enum(["un", "ofac", "eu", "uk-hmt", "sa-pocdatara"]);

const hitSchema = z.object({
  list: z.string().min(1),
  name: z.string().min(1),
  score: z.number().min(0).max(100),
});

const uboChainItemSchema = z.object({
  name: z.string().min(1),
  id_number: z.string().min(1),
  nationality: z.string().min(1),
  residence_country: z.string().min(1),
  ownership_pct: z.number().min(0).max(100),
  basis_of_control: z.string().min(1),
  dha_verified: z.boolean(),
  pep_flag: z.boolean(),
});

const riskFactorSchema = z.object({
  factor_name: z.string().min(1),
  weight: z.number().min(0).max(1),
  value: z.number().min(0).max(100),
});

// ---------------------------------------------------------------------------
// KYCIdentityCollected
// Emitted by the KYC gateway when identity documents are collected.
// ---------------------------------------------------------------------------

export const kycIdentityCollectedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  directors: z.array(directorSchema).default([]),
  ubos: z.array(uboSchema).default([]),
  documents: z.array(documentSchema).min(1),
  collectedAt: z.string().min(1),
});

export type KYCIdentityCollectedPayload = z.infer<typeof kycIdentityCollectedPayloadSchema>;

export function makeKYCIdentityCollected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KYCIdentityCollectedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.candidateId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KYCIdentityCollected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: kycIdentityCollectedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// KYCIdentityVerified
// Emitted when DHA or CIPC confirms identity.
// ---------------------------------------------------------------------------

export const kycIdentityVerifiedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  adapter: z.enum(["dha", "cipc"]),
  result: z.enum(["matched", "partial"]),
  verifiedAt: z.string().min(1),
});

export type KYCIdentityVerifiedPayload = z.infer<typeof kycIdentityVerifiedPayloadSchema>;

export function makeKYCIdentityVerified(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KYCIdentityVerifiedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.candidateId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KYCIdentityVerified",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: kycIdentityVerifiedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// KYCIdentityVerificationFailed
// Emitted when DHA or CIPC cannot verify identity.
// ---------------------------------------------------------------------------

export const kycIdentityVerificationFailedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  adapter: z.enum(["dha", "cipc"]),
  reason: z.enum(["not-found", "expired", "name-mismatch", "adapter-unavailable"]),
  failedAt: z.string().min(1),
});

export type KYCIdentityVerificationFailedPayload = z.infer<
  typeof kycIdentityVerificationFailedPayloadSchema
>;

export function makeKYCIdentityVerificationFailed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KYCIdentityVerificationFailedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.candidateId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KYCIdentityVerificationFailed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: kycIdentityVerificationFailedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// KYCSanctionsPEPScreened
// Emitted after consolidated list + PEP screening completes.
// ---------------------------------------------------------------------------

export const kycSanctionsPEPScreenedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  lists_checked: z.array(sanctionsListSchema).min(1),
  result: z.enum(["clean", "hit", "false-positive"]),
  hits: z.array(hitSchema).default([]),
  pep_flag: z.boolean(),
  pep_linked: z.boolean(),
  screenedAt: z.string().min(1),
});

export type KYCSanctionsPEPScreenedPayload = z.infer<typeof kycSanctionsPEPScreenedPayloadSchema>;

export function makeKYCSanctionsPEPScreened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KYCSanctionsPEPScreenedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.candidateId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KYCSanctionsPEPScreened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: kycSanctionsPEPScreenedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// KYCUBOResolved
// Emitted when the full beneficial ownership chain is traced and verified.
// ---------------------------------------------------------------------------

export const kycUBOResolvedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  ubo_chain: z.array(uboChainItemSchema).min(1),
  ubo_opaque_structure: z.boolean(),
  resolvedAt: z.string().min(1),
});

export type KYCUBOResolvedPayload = z.infer<typeof kycUBOResolvedPayloadSchema>;

export function makeKYCUBOResolved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KYCUBOResolvedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.candidateId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KYCUBOResolved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: kycUBOResolvedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// KYCRiskRated
// Emitted when the risk engine produces a composite risk band.
// ---------------------------------------------------------------------------

export const kycRiskRatedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  score: z.number().min(0).max(100),
  band: z.enum(["low", "medium", "high"]),
  factors: z.array(riskFactorSchema).min(1),
  ratedAt: z.string().min(1),
});

export type KYCRiskRatedPayload = z.infer<typeof kycRiskRatedPayloadSchema>;

export function makeKYCRiskRated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KYCRiskRatedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.candidateId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KYCRiskRated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: kycRiskRatedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// KYCEDDInitiated
// Emitted when enhanced due diligence is triggered.
// ---------------------------------------------------------------------------

export const kycEDDInitiatedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  reason: z.enum([
    "pep",
    "high-risk-jurisdiction",
    "complex-structure",
    "sanctions-adjacent",
    "other",
  ]),
  initiatedBy: z.string().min(1),
  initiatedAt: z.string().min(1),
});

export type KYCEDDInitiatedPayload = z.infer<typeof kycEDDInitiatedPayloadSchema>;

export function makeKYCEDDInitiated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KYCEDDInitiatedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.candidateId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KYCEDDInitiated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: kycEDDInitiatedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// KYCEDDCompleted
// Emitted when MLRO signs off on the EDD review.
// mlro_sign_off_event_id is required — the event that records MLRO approval.
// ---------------------------------------------------------------------------

export const kycEDDCompletedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  mlro_sign_off_event_id: z.string().min(1), // REQUIRED — reject if missing
  outcome: z.enum(["proceed", "reject"]),
  completedAt: z.string().min(1),
});

export type KYCEDDCompletedPayload = z.infer<typeof kycEDDCompletedPayloadSchema>;

export function makeKYCEDDCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KYCEDDCompletedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.candidateId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KYCEDDCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: kycEDDCompletedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// KYCDecisionMade
// Emitted when the KYC gateway agent makes the onboarding decision.
// ---------------------------------------------------------------------------

export const kycDecisionMadePayloadSchema = z.object({
  candidateId: z.string().min(1),
  decision: z.enum(["accept", "reject", "refer"]),
  reason: z.string().min(1),
  decided_by: z.string().min(1),
  decidedAt: z.string().min(1),
});

export type KYCDecisionMadePayload = z.infer<typeof kycDecisionMadePayloadSchema>;

export function makeKYCDecisionMade(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KYCDecisionMadePayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.candidateId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KYCDecisionMade",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: kycDecisionMadePayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// ClientAccepted
// Terminal onboarding event — the ONLY insert gate for the `clients`
// projection. No client row may exist without a corresponding
// ClientAccepted event. This invariant is enforced at the projection layer.
// ---------------------------------------------------------------------------

// NOTE: clientAcceptedPayloadSchema uses passthrough + optional new fields to
// remain backward-compatible with the legacy `domains/customer/onboarding.ts`
// gateway which emits `ClientAccepted` with { candidateId, riskRating,
// kycTier, acceptedBy }. New gateway authoring uses the full shape below.
// Both payload shapes are valid at the registry level.
export const clientAcceptedPayloadSchema = z
  .object({
    candidateId: z.string().min(1),
    clientId: z.string().min(1).optional(), // new UUID — primary key in clients projection
    entityName: z.string().min(1).optional(),
    entityType: z.enum(["company", "trust", "partnership", "individual-sole-trader"]).optional(),
    jurisdiction: z.string().min(1).optional(),
    riskBand: z.enum(["low", "medium", "high"]).optional(),
    category: z.enum(["EC", "PC"]).optional(), // Eligible Counterparty | Professional Client
    acceptedAt: z.string().min(1).optional(),
  })
  .passthrough();

export type ClientAcceptedPayload = z.infer<typeof clientAcceptedPayloadSchema>;

export function makeClientAccepted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ClientAcceptedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.candidateId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ClientAccepted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: clientAcceptedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// ClientRejected
// Terminal onboarding event — candidate cannot be onboarded.
// ---------------------------------------------------------------------------

export const clientRejectedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  reason: z.string().min(1),
  rejectedAt: z.string().min(1),
});

export type ClientRejectedPayload = z.infer<typeof clientRejectedPayloadSchema>;

export function makeClientRejected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ClientRejectedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.candidateId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ClientRejected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: clientRejectedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// LawfulProcessingRegistered
// Records the POPIA lawful basis under which the bank processes the
// client's personal information.
// ---------------------------------------------------------------------------

export const lawfulProcessingRegisteredPayloadSchema = z.object({
  clientId: z.string().min(1),
  lawful_basis: z.enum(["legitimate-interest", "legal-obligation", "contract"]),
  processing_purposes: z.array(z.string().min(1)).min(1),
  registeredAt: z.string().min(1),
});

export type LawfulProcessingRegisteredPayload = z.infer<
  typeof lawfulProcessingRegisteredPayloadSchema
>;

export function makeLawfulProcessingRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LawfulProcessingRegisteredPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.clientId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LawfulProcessingRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: lawfulProcessingRegisteredPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// KYCRefreshScheduled
// Emitted when a periodic KYC refresh is scheduled for an accepted client.
// ---------------------------------------------------------------------------

export const kycRefreshScheduledPayloadSchema = z.object({
  clientId: z.string().min(1),
  cadence: z.enum(["annual", "semi-annual"]),
  triggerReason: z.enum(["calendar", "event-triggered"]),
  scheduledFor: z.string().min(1), // ISO 8601 date
  scheduledAt: z.string().min(1),
});

export type KYCRefreshScheduledPayload = z.infer<typeof kycRefreshScheduledPayloadSchema>;

export function makeKYCRefreshScheduled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KYCRefreshScheduledPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.clientId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KYCRefreshScheduled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: kycRefreshScheduledPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// KYCRefreshCompleted
// Emitted when a periodic KYC refresh cycle completes successfully.
// ---------------------------------------------------------------------------

export const kycRefreshCompletedPayloadSchema = z.object({
  clientId: z.string().min(1),
  refreshId: z.string().min(1),
  nextDueDate: z.string().min(1), // ISO 8601 date
  completedAt: z.string().min(1),
});

export type KYCRefreshCompletedPayload = z.infer<typeof kycRefreshCompletedPayloadSchema>;

export function makeKYCRefreshCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KYCRefreshCompletedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.clientId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KYCRefreshCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: kycRefreshCompletedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// KYCRatingRevised
// Emitted when a client's risk band changes after a refresh.
// mlro_sign_off_event_id is required when upgrading (moving to higher risk).
// ---------------------------------------------------------------------------

export const kycRatingRevisedPayloadSchema = z
  .object({
    clientId: z.string().min(1),
    refreshId: z.string().min(1),
    oldBand: z.enum(["low", "medium", "high"]),
    newBand: z.enum(["low", "medium", "high"]),
    // Required for upgrades (old band is lower risk than new band).
    mlro_sign_off_event_id: z.string().optional(),
    revisedAt: z.string().min(1),
  })
  .refine(
    (data) => {
      // Upgrade = moving from lower risk to higher risk (low→medium, low→high, medium→high).
      const riskOrder = { low: 0, medium: 1, high: 2 };
      const isUpgrade = riskOrder[data.newBand] > riskOrder[data.oldBand];
      if (isUpgrade && !data.mlro_sign_off_event_id) return false;
      return true;
    },
    { message: "mlro_sign_off_event_id is required when upgrading to a higher risk band" },
  );

export type KYCRatingRevisedPayload = z.infer<typeof kycRatingRevisedPayloadSchema>;

export function makeKYCRatingRevised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KYCRatingRevisedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("kyc", args.payload.clientId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KYCRatingRevised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: kycRatingRevisedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// CounterpartyCategorised
// Emitted when a counterparty is categorised under FAIS / GCC.
// ---------------------------------------------------------------------------

export const counterpartyCategorisedPayloadSchema = z.object({
  partyId: z.string().min(1),
  category: z.enum(["EC", "PC", "RC"]), // Eligible Counterparty | Professional Client | Retail Client
  basis: z.string().min(1),
  validUntil: z.string().min(1), // ISO 8601 date
  categorisedBy: z.string().min(1),
  categorisedAt: z.string().min(1),
});

export type CounterpartyCategorisedPayload = z.infer<typeof counterpartyCategorisedPayloadSchema>;

export function makeCounterpartyCategorised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyCategorisedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyCategorised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyCategorisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CounterpartyDeclined
// Emitted when a counterparty cannot be categorised (retail client declined
// or eligibility check fails).
// ---------------------------------------------------------------------------

export const counterpartyDeclinedPayloadSchema = z.object({
  partyId: z.string().min(1),
  reason: z.enum(["retail-client-declined", "eligibility-failed"]),
  declinedAt: z.string().min(1),
});

export type CounterpartyDeclinedPayload = z.infer<typeof counterpartyDeclinedPayloadSchema>;

export function makeCounterpartyDeclined(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyDeclinedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyDeclined",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyDeclinedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list — add every new type name here for the registry.
// ---------------------------------------------------------------------------

export const KYC_TYPED_EVENT_TYPES = [
  "KYCIdentityCollected",
  "KYCIdentityVerified",
  "KYCIdentityVerificationFailed",
  "KYCSanctionsPEPScreened",
  "KYCUBOResolved",
  "KYCRiskRated",
  "KYCEDDInitiated",
  "KYCEDDCompleted",
  "KYCDecisionMade",
  "ClientAccepted",
  "ClientRejected",
  "LawfulProcessingRegistered",
  "KYCRefreshScheduled",
  "KYCRefreshCompleted",
  "KYCRatingRevised",
  "CounterpartyCategorised",
  "CounterpartyDeclined",
] as const;

export type KYCEventType = (typeof KYC_TYPED_EVENT_TYPES)[number];
