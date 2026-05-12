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
  type CounterpartyFaisClassifiedPayload,
  type CounterpartyId,
  type CreditAssessmentCompletedPayload,
  DEFAULT_ENTITY,
  type DocumentationPayload,
  type FatcaCrsClassifiedPayload,
  type KycCompletedPayload,
  type MandatePayload,
  type OffboardPayload,
  type PopiaConsentRecordedPayload,
  type ProspectPayload,
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
export function beneficialOwnerResolved(
  p: BeneficialOwnerResolvedPayload,
  opts: MakeOpts,
): Event {
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
