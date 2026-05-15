// platform/event-store/event-types/customer.ts
//
// Institutional counterparty onboarding lifecycle event-payload schemas.
//
// Slice 2 — 7 new phase event types that complete the 21-phase onboarding
// model. See `platform/lifecycle/onboarding-orchestrator.ts` for the fold
// logic that maps these to phase advances.
//
// Authority:
//   FAIS-ACT-37-2002         — fais-categorised gate (s.45 + GCC s.2(1))
//   FIC-ACT-38-2001          — bo-resolved gate (s.21B UBO), sanctions gate (s.28A)
//   AML-CFT-POLICY-V1        — KYC/CDD/sanctions obligations
//   POPIA-S11                — popia-recorded gate (processing consent)
//   RT-CR.CP                 — credit-assessed gate (counterparty credit risk)
//   TRADING-MANDATE-V1       — mandate / account-setup gate
//
// Authors: Niko (Client lifecycle, sales), Zara (MLRO),
//          Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// CounterpartyFaisClassified
// Phase: fais-categorised (Phase 3)
// Issuer: Niko
// ---------------------------------------------------------------------------

export const counterpartyFaisClassifiedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  faisCategory: z.enum(["professional-client", "retail-client", "market-counterparty"]),
  classifiedAt: z.string().min(1), // ISO timestamp
  classifiedBy: z.string().min(1), // agent URN or Party URN
});

export type CounterpartyFaisClassifiedPayload = z.infer<
  typeof counterpartyFaisClassifiedPayloadSchema
>;

export function makeCounterpartyFaisClassified(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyFaisClassifiedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyFaisClassified",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyFaisClassifiedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BeneficialOwnerResolved
// Phase: bo-resolved (Phase 5)
// Issuer: Niko
// ---------------------------------------------------------------------------

export const beneficialOwnerResolvedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  beneficialOwners: z
    .array(
      z.object({
        partyId: z.string().min(1),
        ownershipPct: z.number().gte(0).lte(100),
        controlBasis: z.string().min(1),
      }),
    )
    .min(1),
  resolvedAt: z.string().min(1),
  resolvedBy: z.string().min(1),
});

export type BeneficialOwnerResolvedPayload = z.infer<typeof beneficialOwnerResolvedPayloadSchema>;

export function makeBeneficialOwnerResolved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BeneficialOwnerResolvedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BeneficialOwnerResolved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: beneficialOwnerResolvedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SanctionsClearancePassed
// Phase: sanctions-cleared (Phase 6)
// Issuer: Zara (MLRO)
// ---------------------------------------------------------------------------

export const sanctionsClearancePassedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  screeningProvider: z.string().min(1),
  screeningRef: z.string().min(1),
  clearedAt: z.string().min(1),
  screenedBy: z.string().min(1),
});

export type SanctionsClearancePassedPayload = z.infer<typeof sanctionsClearancePassedPayloadSchema>;

export function makeSanctionsClearancePassed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SanctionsClearancePassedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SanctionsClearancePassed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: sanctionsClearancePassedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FatcaCrsClassified
// Phase: fatca-crs-classified (Phase 7)
// Issuer: Niko
// ---------------------------------------------------------------------------

export const fatcaCrsClassifiedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  fatcaStatus: z.enum(["us-person", "non-us-person", "exempt"]),
  crsResidency: z.string().length(2), // ISO 3166-1 alpha-2
  classifiedAt: z.string().min(1),
  classifiedBy: z.string().min(1),
});

export type FatcaCrsClassifiedPayload = z.infer<typeof fatcaCrsClassifiedPayloadSchema>;

export function makeFatcaCrsClassified(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FatcaCrsClassifiedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FatcaCrsClassified",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fatcaCrsClassifiedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PopiaConsentRecorded
// Phase: popia-recorded (Phase 8)
// Issuer: Niko
// ---------------------------------------------------------------------------

export const popiaConsentRecordedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  consentScope: z.array(z.string().min(1)).min(1),
  recordedAt: z.string().min(1),
  recordedBy: z.string().min(1),
});

export type PopiaConsentRecordedPayload = z.infer<typeof popiaConsentRecordedPayloadSchema>;

export function makePopiaConsentRecorded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PopiaConsentRecordedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PopiaConsentRecorded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: popiaConsentRecordedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CreditAssessmentCompleted
// Phase: credit-assessed (Phase 10)
// Issuer: Niko
// ---------------------------------------------------------------------------

export const creditAssessmentCompletedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  creditGrade: z.string().min(1),
  exposureLimitZar: z.number().int().gte(0),
  assessedAt: z.string().min(1),
  assessedBy: z.string().min(1),
});

export type CreditAssessmentCompletedPayload = z.infer<
  typeof creditAssessmentCompletedPayloadSchema
>;

export function makeCreditAssessmentCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CreditAssessmentCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CreditAssessmentCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: creditAssessmentCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AccountsSetupCompleted
// Phase: accounts-setup (Phase 16)
// Issuer: Niko
// ---------------------------------------------------------------------------

export const accountsSetupCompletedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  accounts: z
    .array(
      z.object({
        accountId: z.string().min(1),
        currency: z.string().length(3), // ISO 4217
        accountType: z.string().min(1),
      }),
    )
    .min(1),
  setupAt: z.string().min(1),
  setupBy: z.string().min(1),
});

export type AccountsSetupCompletedPayload = z.infer<typeof accountsSetupCompletedPayloadSchema>;

export function makeAccountsSetupCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AccountsSetupCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AccountsSetupCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: accountsSetupCompletedPayloadSchema.parse(args.payload),
  });
}

export const CUSTOMER_TYPED_EVENT_TYPES = [
  "CounterpartyFaisClassified",
  "BeneficialOwnerResolved",
  "SanctionsClearancePassed",
  "FatcaCrsClassified",
  "PopiaConsentRecorded",
  "CreditAssessmentCompleted",
  "AccountsSetupCompleted",
] as const;
export type CustomerEventType = (typeof CUSTOMER_TYPED_EVENT_TYPES)[number];
