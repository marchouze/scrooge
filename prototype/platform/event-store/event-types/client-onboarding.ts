// platform/event-store/event-types/client-onboarding.ts
//
// V1-SIDE adapter for the BORN-V2 client (counterparty) onboarding event family.
// Lives on the V1 side and IMPORTS the canonical payload schemas FROM v2-core —
// the permitted dependency direction (v1→v2; v2-core never reaches back,
// enforced by `recon:v2-no-v1-import`). Provides the event factories the seed
// script uses and re-exports the v2-core schemas so the registry can reference
// them via this single adapter (one grammar source).
//
// THREE-SITE REGISTRATION (recurring gotcha — F-032):
//   1. event-types  → this file (schema re-exports + make* factories + kind list)
//   2. registry     → registry/client-onboarding.ts (EventTypeMetadata rows)
//   3. provenance   → provenance-category.ts (each kind → category "counterparty")
//
// Born V2 (D-V1-REMOVAL-PHASE-1) — every row is `v2Status: "v2-native"`; the
// family never emits a `v1-only` type and never imports a V1 lifecycle module.
//
// Authority: D-V1-REMOVAL-PHASE-1; WS-V2-CLIENT-ONBOARDING;
//   brief:atlas:v2-client-onboarding-family-onboard-15-sim-clien:2026-06-22.
// Author: Atlas (Core banking platform architect, engineering).

import {
  CLIENT_ACCOUNTS_SETUP,
  CLIENT_ACTIVATED,
  CLIENT_BO_RESOLVED,
  CLIENT_CREDIT_ASSESSED,
  CLIENT_FAIS_CLASSIFIED,
  CLIENT_FATCA_CRS_CLASSIFIED,
  CLIENT_KYC_PASSED,
  CLIENT_OFFBOARDED,
  CLIENT_POPIA_RECORDED,
  CLIENT_PROSPECT_REGISTERED,
  CLIENT_SANCTIONS_CLEARED,
  CLIENT_SOUNDING_OPENED,
  type ClientAccountsSetupPayload,
  type ClientActivatedPayload,
  type ClientBeneficialOwnerResolvedPayload,
  type ClientCreditAssessedPayload,
  type ClientFaisClassifiedPayload,
  type ClientFatcaCrsClassifiedPayload,
  type ClientKycPassedPayload,
  type ClientOffboardedPayload,
  type ClientPopiaConsentRecordedPayload,
  type ClientProspectRegisteredPayload,
  type ClientSanctionsClearedPayload,
  type ClientSoundingOpenedPayload,
  clientAccountsSetupPayloadSchema,
  clientActivatedPayloadSchema,
  clientBeneficialOwnerResolvedPayloadSchema,
  clientCreditAssessedPayloadSchema,
  clientFaisClassifiedPayloadSchema,
  clientFatcaCrsClassifiedPayloadSchema,
  clientKycPassedPayloadSchema,
  clientOffboardedPayloadSchema,
  clientPopiaConsentRecordedPayloadSchema,
  clientProspectRegisteredPayloadSchema,
  clientSanctionsClearedPayloadSchema,
  clientSoundingOpenedPayloadSchema,
} from "../../../v2-core/client-onboarding/events";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// Re-export the v2-core schemas so the v1 registry references them via this
// adapter module (a single grammar source).
export {
  clientAccountsSetupPayloadSchema,
  clientActivatedPayloadSchema,
  clientBeneficialOwnerResolvedPayloadSchema,
  clientCreditAssessedPayloadSchema,
  clientFaisClassifiedPayloadSchema,
  clientFatcaCrsClassifiedPayloadSchema,
  clientKycPassedPayloadSchema,
  clientOffboardedPayloadSchema,
  clientPopiaConsentRecordedPayloadSchema,
  clientProspectRegisteredPayloadSchema,
  clientSanctionsClearedPayloadSchema,
  clientSoundingOpenedPayloadSchema,
};

// ---------------------------------------------------------------------------
// Generic factory
// ---------------------------------------------------------------------------

function makeClientOnboardingEvent(args: {
  type: string;
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: Record<string, unknown>;
  eventId?: string;
  provenance?: Event["provenance"];
  aggregateLabel?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: args.type,
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: args.payload,
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
    ...(args.aggregateLabel !== undefined ? { aggregateLabel: args.aggregateLabel } : {}),
  });
}

interface MakeArgs<P> {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: P;
  eventId?: string;
  provenance?: Event["provenance"];
  aggregateLabel?: string;
}

export function makeClientOnboardingSoundingOpened(
  args: MakeArgs<ClientSoundingOpenedPayload>,
): Event {
  return makeClientOnboardingEvent({
    ...args,
    type: CLIENT_SOUNDING_OPENED,
    payload: clientSoundingOpenedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makeClientOnboardingProspectRegistered(
  args: MakeArgs<ClientProspectRegisteredPayload>,
): Event {
  return makeClientOnboardingEvent({
    ...args,
    type: CLIENT_PROSPECT_REGISTERED,
    payload: clientProspectRegisteredPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makeClientOnboardingKycPassed(args: MakeArgs<ClientKycPassedPayload>): Event {
  return makeClientOnboardingEvent({
    ...args,
    type: CLIENT_KYC_PASSED,
    payload: clientKycPassedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makeClientOnboardingSanctionsCleared(
  args: MakeArgs<ClientSanctionsClearedPayload>,
): Event {
  return makeClientOnboardingEvent({
    ...args,
    type: CLIENT_SANCTIONS_CLEARED,
    payload: clientSanctionsClearedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makeClientOnboardingFaisClassified(
  args: MakeArgs<ClientFaisClassifiedPayload>,
): Event {
  return makeClientOnboardingEvent({
    ...args,
    type: CLIENT_FAIS_CLASSIFIED,
    payload: clientFaisClassifiedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makeClientOnboardingBeneficialOwnerResolved(
  args: MakeArgs<ClientBeneficialOwnerResolvedPayload>,
): Event {
  return makeClientOnboardingEvent({
    ...args,
    type: CLIENT_BO_RESOLVED,
    payload: clientBeneficialOwnerResolvedPayloadSchema.parse(args.payload) as Record<
      string,
      unknown
    >,
  });
}

export function makeClientOnboardingFatcaCrsClassified(
  args: MakeArgs<ClientFatcaCrsClassifiedPayload>,
): Event {
  return makeClientOnboardingEvent({
    ...args,
    type: CLIENT_FATCA_CRS_CLASSIFIED,
    payload: clientFatcaCrsClassifiedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makeClientOnboardingPopiaConsentRecorded(
  args: MakeArgs<ClientPopiaConsentRecordedPayload>,
): Event {
  return makeClientOnboardingEvent({
    ...args,
    type: CLIENT_POPIA_RECORDED,
    payload: clientPopiaConsentRecordedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makeClientOnboardingCreditAssessed(
  args: MakeArgs<ClientCreditAssessedPayload>,
): Event {
  return makeClientOnboardingEvent({
    ...args,
    type: CLIENT_CREDIT_ASSESSED,
    payload: clientCreditAssessedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makeClientOnboardingAccountsSetup(
  args: MakeArgs<ClientAccountsSetupPayload>,
): Event {
  return makeClientOnboardingEvent({
    ...args,
    type: CLIENT_ACCOUNTS_SETUP,
    payload: clientAccountsSetupPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makeClientOnboardingActivated(args: MakeArgs<ClientActivatedPayload>): Event {
  return makeClientOnboardingEvent({
    ...args,
    type: CLIENT_ACTIVATED,
    payload: clientActivatedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export function makeClientOnboardingOffboarded(args: MakeArgs<ClientOffboardedPayload>): Event {
  return makeClientOnboardingEvent({
    ...args,
    type: CLIENT_OFFBOARDED,
    payload: clientOffboardedPayloadSchema.parse(args.payload) as Record<string, unknown>,
  });
}

export const CLIENT_ONBOARDING_TYPED_EVENT_TYPES = [
  CLIENT_SOUNDING_OPENED,
  CLIENT_PROSPECT_REGISTERED,
  CLIENT_KYC_PASSED,
  CLIENT_SANCTIONS_CLEARED,
  CLIENT_FAIS_CLASSIFIED,
  CLIENT_BO_RESOLVED,
  CLIENT_FATCA_CRS_CLASSIFIED,
  CLIENT_POPIA_RECORDED,
  CLIENT_CREDIT_ASSESSED,
  CLIENT_ACCOUNTS_SETUP,
  CLIENT_ACTIVATED,
  CLIENT_OFFBOARDED,
] as const;
