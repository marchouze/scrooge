// platform/event-store/event-types/counterparty-provisioning.ts
//
// Counterparty-provisioning event family (WS-FX-V2-SIMULATOR, M2). These model
// the OUTSIDE party's side of the clean Niko lifecycle — the steps an external
// counterparty takes as it is stood up for FX dealing — plus the counterparty's
// acceptance of the bank's ISDA/CSA terms. They are external-party events the
// simulator emits; the bank's RECORDING of the agreement + netting-set readiness
// is SUT-internal and lives outside this family (see
// platform/markets/counterparty/provision-counterparty.ts).
//
//   CounterpartySoundingMade        — the counterparty expresses dealing interest
//   CounterpartyKycDocumentsSubmitted — the counterparty submits its KYC pack
//   CounterpartyMandateAccepted     — the counterparty accepts the dealing mandate
//   CounterpartyAgreementAccepted   — the counterparty accepts the ISDA/CSA terms
//
// The lifecycle is sounding → prospect (sounding implies prospect) → KYC →
// mandate → agreement. Each step is the EXTERNAL party's action; the bank's
// onboarding/KYC-clearance/election decisions are the SUT response.
//
// Born V2 (D-V1-REMOVAL-PHASE-1) — never v1-only. THREE-SITE REGISTRATION
// (recurring gotcha — F-032):
//   1. event-types  → this file (schemas + make* + kind list)
//   2. registry     → registry/counterparty-provisioning.ts (EventTypeMetadata rows)
//   3. provenance   → provenance-category.ts (each kind → category)
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const counterpartySoundingMadePayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  name: z.string().min(1),
  bic: z.string().min(1),
  /** FX pairs the counterparty wishes to deal. */
  eligiblePairs: z.array(z.string().min(1)).min(1),
});
export type CounterpartySoundingMadePayload = z.infer<typeof counterpartySoundingMadePayloadSchema>;

export const counterpartyKycDocumentsSubmittedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  /** Document kinds the counterparty supplied (e.g. constitutional docs, LEI). */
  documents: z.array(z.string().min(1)).min(1),
});
export type CounterpartyKycDocumentsSubmittedPayload = z.infer<
  typeof counterpartyKycDocumentsSubmittedPayloadSchema
>;

export const counterpartyMandateAcceptedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  /** Reporting/base currency the dealing mandate covers. */
  baseCurrency: z.string().min(1),
});
export type CounterpartyMandateAcceptedPayload = z.infer<
  typeof counterpartyMandateAcceptedPayloadSchema
>;

export const counterpartyAgreementAcceptedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  /** Master-agreement form the counterparty accepted. */
  agreementType: z.enum(["ISDA-2002", "ISDA-1992"]),
  /** Whether a CSA (collateral support annex) is in scope. */
  csaInScope: z.boolean(),
  /** Reporting/threshold currency for the CSA, if csaInScope. */
  csaCurrency: z.string().min(1).optional(),
});
export type CounterpartyAgreementAcceptedPayload = z.infer<
  typeof counterpartyAgreementAcceptedPayloadSchema
>;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function makeCounterpartySoundingMade(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartySoundingMadePayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartySoundingMade",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartySoundingMadePayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export function makeCounterpartyKycDocumentsSubmitted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyKycDocumentsSubmittedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyKycDocumentsSubmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyKycDocumentsSubmittedPayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export function makeCounterpartyMandateAccepted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyMandateAcceptedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyMandateAccepted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyMandateAcceptedPayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export function makeCounterpartyAgreementAccepted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyAgreementAcceptedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyAgreementAccepted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyAgreementAcceptedPayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export const COUNTERPARTY_PROVISIONING_EVENT_TYPES = [
  "CounterpartySoundingMade",
  "CounterpartyKycDocumentsSubmitted",
  "CounterpartyMandateAccepted",
  "CounterpartyAgreementAccepted",
] as const;
export type CounterpartyProvisioningEventType =
  (typeof COUNTERPARTY_PROVISIONING_EVENT_TYPES)[number];
