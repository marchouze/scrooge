// domains/customer/onboarding.ts
//
// Pure event constructors for the institutional client lifecycle. Every
// constructor returns an Event ready to append to the event store.
//
// P2 — every event carries citations.
//
// Author: Niko

import { newEventId, nowUtc } from "@platform/core/types";
import type { Actor, Event } from "@platform/event-store/types";
import type { PartyId } from "../party";
import {
  type AccountsSetupCompletedPayload,
  type ActivationPayload,
  type AuthorisedSignatoryPayload,
  type BeneficialOwnerResolvedPayload,
  CUSTOMER_EVENT_TYPES,
  type ClientAcceptedPayload,
  type ClientCandidateRegisteredPayload,
  type ClientRejectedPayload,
  type CounterpartyFaisClassifiedPayload,
  type CounterpartyId,
  type CreditAssessmentCompletedPayload,
  DEFAULT_ENTITY,
  type DocumentationPayload,
  type EddCompletedPayload,
  type EddInitiatedPayload,
  type FatcaCrsClassifiedPayload,
  type KycCompletedPayload,
  type MandatePayload,
  type OffboardPayload,
  type PEPScreeningCompletedPayload,
  type PopiaConsentRecordedPayload,
  type ProspectPayload,
  type RiskRatingAssignedPayload,
  type SanctionsClearancePassedPayload,
  type SoundingPayload,
} from "./types";

export interface MakeOpts {
  actor: Actor;
  citations: readonly string[]; // Principle 2 — at least one
  asOf?: string; // ISO; defaults to now
}

function base(type: string, payload: Record<string, unknown>, opts: MakeOpts): Event {
  if (opts.citations.length === 0) {
    throw new Error("Principle 2 violation: at least one citation required");
  }
  return {
    event_id: newEventId(),
    type,
    as_of: opts.asOf ?? nowUtc(),
    entity: DEFAULT_ENTITY,
    actor: opts.actor,
    citations: [...opts.citations],
    payload,
  };
}

export function soundingOpened(p: SoundingPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[0], { ...p }, opts);
}

export function prospectRegistered(p: ProspectPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[1], { ...p }, opts);
}

export function kycCompleted(p: KycCompletedPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[2], { ...p }, opts);
}

export function documentationDrafted(p: DocumentationPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[3], { ...p }, opts);
}

export function documentationReadyToExecute(p: DocumentationPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[4], { ...p }, opts);
}

export function authorisedSignatoryAdded(p: AuthorisedSignatoryPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[5], { ...p }, opts);
}

export function authorisedSignatoryRemoved(
  p: { counterpartyId: CounterpartyId; personId: PartyId; reason: string },
  opts: MakeOpts,
): Event {
  return base(CUSTOMER_EVENT_TYPES[6], { ...p }, opts);
}

export function mandateAssigned(p: MandatePayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[7], { ...p }, opts);
}

export function mandateRevised(p: MandatePayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[8], { ...p }, opts);
}

export function mandateRevoked(
  p: { counterpartyId: CounterpartyId; reason: string },
  opts: MakeOpts,
): Event {
  return base(CUSTOMER_EVENT_TYPES[9], { ...p }, opts);
}

export function counterpartyActivated(p: ActivationPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[10], { ...p }, opts);
}

export function counterpartyOffboarded(p: OffboardPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[11], { ...p }, opts);
}

// ---------------------------------------------------------------------------
// Slice 2 — 7 new phase event constructors
// Authority: D-LIFECYCLE-SLICE-2; citations: FAIS-ACT-37-2002,
//   FIC-ACT-38-2001, POPIA-S11, AML-CFT-POLICY-V1, TRADING-MANDATE-V1,
//   RT-CR.CP, RT-FC.ML, RT-FC.SA
// Author: Atlas (Core banking platform architect, engineering)
// ---------------------------------------------------------------------------

/** CounterpartyFaisClassified — FAIS category recorded at fais-categorised gate. */
export function counterpartyFaisClassified(
  p: CounterpartyFaisClassifiedPayload,
  opts: MakeOpts,
): Event {
  return base(CUSTOMER_EVENT_TYPES[12], { ...p }, opts);
}

/** BeneficialOwnerResolved — UBO chain resolved at bo-resolved gate. */
export function beneficialOwnerResolved(p: BeneficialOwnerResolvedPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[13], { ...p }, opts);
}

/** SanctionsClearancePassed — screening provider confirms clear at sanctions-cleared gate. */
export function sanctionsClearancePassed(
  p: SanctionsClearancePassedPayload,
  opts: MakeOpts,
): Event {
  return base(CUSTOMER_EVENT_TYPES[14], { ...p }, opts);
}

/** FatcaCrsClassified — FATCA/CRS tax-residency classified at fatca-crs-classified gate. */
export function fatcaCrsClassified(p: FatcaCrsClassifiedPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[15], { ...p }, opts);
}

/** PopiaConsentRecorded — POPIA processing consent scope recorded at popia-recorded gate. */
export function popiaConsentRecorded(p: PopiaConsentRecordedPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[16], { ...p }, opts);
}

/** CreditAssessmentCompleted — credit grade and exposure limit set at credit-assessed gate. */
export function creditAssessmentCompleted(
  p: CreditAssessmentCompletedPayload,
  opts: MakeOpts,
): Event {
  return base(CUSTOMER_EVENT_TYPES[17], { ...p }, opts);
}

/** AccountsSetupCompleted — settlement/nostro accounts opened at accounts-setup gate. */
export function accountsSetupCompleted(p: AccountsSetupCompletedPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[18], { ...p }, opts);
}

// ---------------------------------------------------------------------------
// KYC onboarding gateway event constructors (PROC-FC-01)
// Authority: PROC-FC-01 (Approved), KYC/CDD/EDD Policy (BRC-approved)
// Author: Mira (Regulatory Intelligence Engineer)
// ---------------------------------------------------------------------------

/**
 * ClientCandidateRegistered — PROC-FC-01 step 1.
 * Citations: ORG-FC-02 (KYC/CDD/EDD), FIC-ACT-S21, FATF-REC-10.
 */
export function clientCandidateRegistered(
  p: ClientCandidateRegisteredPayload,
  opts: MakeOpts,
): Event {
  return base(CUSTOMER_EVENT_TYPES[19], { ...p }, opts);
}

/**
 * PEPScreeningCompleted — PROC-FC-01 step 3.
 * Citations: ORG-FC-04 (PEP screening), FIC-ACT-S21B, FATF-REC-12.
 */
export function pepScreeningCompleted(p: PEPScreeningCompletedPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[20], { ...p }, opts);
}

/**
 * RiskRatingAssigned — PROC-FC-01 step 5.
 * Citations: ORG-FC-02 (KYC/CDD/EDD), FIC-ACT-S21, FATF-REC-10.
 */
export function riskRatingAssigned(p: RiskRatingAssignedPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[21], { ...p }, opts);
}

/**
 * EddInitiated — PROC-FC-01 step 6.
 * Citations: ORG-FC-05 (EDD), FIC-ACT-S21B, FATF-REC-10.
 */
export function eddInitiated(p: EddInitiatedPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[22], { ...p }, opts);
}

/**
 * EddCompleted — PROC-FC-01 step 7.
 * Citations: ORG-FC-05 (EDD), FIC-ACT-S21B.
 */
export function eddCompleted(p: EddCompletedPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[23], { ...p }, opts);
}

/**
 * ClientAccepted — PROC-FC-01 step 8.
 * Citations: ORG-FC-02 (KYC/CDD/EDD), ORG-FC-03, FIC-ACT-S21.
 */
export function clientAccepted(p: ClientAcceptedPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[24], { ...p }, opts);
}

/**
 * ClientRejected — PROC-FC-01 steps 2–7 (any gate failure).
 * Citations: ORG-FC-02, ORG-FC-03, ORG-FC-04, FIC-ACT-S21.
 */
export function clientRejected(p: ClientRejectedPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[25], { ...p }, opts);
}
