// domains/customer/types.ts
//
// Event types and value objects for the institutional client lifecycle.
//
// P1 — every state change is an event in the log.
// P2 — every event carries citations (registry entries cited at emission).
// P5 — multi-entity-ready: every counterparty is held under a typed legal
//      entity ("LE-ZA-HOZ-BANK" today; the entity field is non-optional).
// D-PARTY-REGISTER (CEO-approved 2026-05-11, PR 4): `personId` and
//      `reviewerId` are tightened from plain `string` to `PartyId` so that
//      all identity-axis foreign keys carry the Party URN discipline.
//
// Author: Niko · Anya (event shape review)

import { BANK_ZA_001, type LegalEntity } from "@platform/core/types";
import type { PartyId } from "../party";

export type CounterpartyId = string & { readonly __counterparty: unique symbol };
export type AgreementType = "ISDA" | "GMRA" | "CSA" | "GMSLA" | "Account-Mandate";
export type KycTier = "Tier-1" | "Tier-2";

export type DocumentationStatus =
  | "Sounding"
  | "InPrinciple"
  | "Drafted"
  | "Reviewed"
  | "ReadyToExecute"
  | "Executed";

export type CounterpartyStatus =
  | "Sounding"
  | "Prospect"
  | "KycPassed"
  | "DocumentationReady"
  | "MandateAssigned"
  | "Active"
  | "Offboarded";

export interface SoundingPayload {
  counterpartyId: CounterpartyId;
  channel: "introduction" | "inbound" | "outbound" | "event";
  introSource?: string;
}

export interface ProspectPayload {
  counterpartyId: CounterpartyId;
  legalName: string;
  jurisdiction: string;
  sector: string;
}

export interface KycCompletedPayload {
  counterpartyId: CounterpartyId;
  tier: KycTier;
  pep: boolean;
  sanctionsClear: boolean;
  jurisdictionalRiskScore: "low" | "medium" | "high";
  /** Party URN of the reviewing agent or human. D-PARTY-REGISTER PR 4. */
  reviewerId: PartyId;
}

export interface DocumentationPayload {
  counterpartyId: CounterpartyId;
  agreementType: AgreementType;
  version: string;
  packageHash?: string;
}

export interface AuthorisedSignatoryPayload {
  counterpartyId: CounterpartyId;
  /** Party URN of the natural person being authorised. D-PARTY-REGISTER PR 4. */
  personId: PartyId;
  scope: "signatory" | "authorised-trader" | "both";
  evidenceRef: string;
}

export interface MandatePayload {
  counterpartyId: CounterpartyId;
  products: readonly string[];
  limits: Readonly<Record<string, number>>; // limit-name → cap (in minor units)
  rasReference: string;
}

export interface ActivationPayload {
  counterpartyId: CounterpartyId;
  configSwitchEventId: string;
}

export interface OffboardPayload {
  counterpartyId: CounterpartyId;
  reason: string;
  finalSettlementHash?: string;
}

// ---------------------------------------------------------------------------
// Slice 2 — 7 new phase event types
// Authority: D-LIFECYCLE-SLICE-2 (onboarding Slice 2 dispatch)
// Author: Atlas (Core banking platform architect, engineering)
// ---------------------------------------------------------------------------

/**
 * FAIS categorisation — records the client category assigned under
 * FAIS Act 37 of 2002 s.45 and General Code of Conduct s.2(1).
 * Emitted by Niko (Client lifecycle, sales) at the fais-categorised gate.
 */
export interface CounterpartyFaisClassifiedPayload {
  counterpartyId: CounterpartyId;
  faisCategory: "professional-client" | "retail-client" | "market-counterparty";
  classifiedAt: string; // ISO timestamp
  classifiedBy: string; // agent URN or PartyId
}

/**
 * Beneficial-ownership resolution — records the natural-person UBO
 * chain for a counterparty per FIC Act 38/2001 s.21B.
 * Emitted by Niko after UBO resolution is complete.
 */
export interface BeneficialOwnerResolvedPayload {
  counterpartyId: CounterpartyId;
  beneficialOwners: ReadonlyArray<{
    partyId: string;
    ownershipPct: number;
    controlBasis: string;
  }>;
  resolvedAt: string; // ISO timestamp
  resolvedBy: string; // agent URN or PartyId
}

/**
 * Sanctions clearance — records that the counterparty passed sanctions
 * screening per FIC Act 38/2001 s.28A and FAFT Recommendations.
 * Emitted by Zara (MLRO) after the screening provider confirms clear.
 */
export interface SanctionsClearancePassedPayload {
  counterpartyId: CounterpartyId;
  screeningProvider: string;
  screeningRef: string;
  clearedAt: string; // ISO timestamp
  screenedBy: string; // agent URN of Zara or delegated service
}

/**
 * FATCA / CRS classification — records tax-residency status for
 * FATCA (IRS IRC §1471–1474) and CRS (OECD Common Reporting Standard)
 * purposes. Emitted by Niko at the fatca-crs-classified gate.
 */
export interface FatcaCrsClassifiedPayload {
  counterpartyId: CounterpartyId;
  fatcaStatus: "us-person" | "non-us-person" | "exempt";
  crsResidency: string; // ISO 3166-1 alpha-2 country code
  classifiedAt: string; // ISO timestamp
  classifiedBy: string; // agent URN or PartyId
}

/**
 * POPIA consent recorded — records the counterparty's processing-consent
 * scope under POPIA s.11. Emitted by Niko at the popia-recorded gate.
 */
export interface PopiaConsentRecordedPayload {
  counterpartyId: CounterpartyId;
  consentScope: string[]; // e.g. ["credit-assessment", "market-data-sharing"]
  recordedAt: string; // ISO timestamp
  recordedBy: string; // agent URN or PartyId
}

/**
 * Credit assessment completed — records the internal credit grade and
 * exposure limit for the counterparty. Emitted by Niko (or the credit
 * desk) at the credit-assessed gate. Authority: RT-CR.CP.
 */
export interface CreditAssessmentCompletedPayload {
  counterpartyId: CounterpartyId;
  creditGrade: string; // e.g. "A", "BBB+", "Sub-IG"
  exposureLimitZar: number; // ZAR minor units
  assessedAt: string; // ISO timestamp
  assessedBy: string; // agent URN or PartyId
}

/**
 * Accounts setup completed — records the settlement / nostro accounts
 * opened for the counterparty. Emitted by Niko at the accounts-setup gate.
 */
export interface AccountsSetupCompletedPayload {
  counterpartyId: CounterpartyId;
  accounts: ReadonlyArray<{
    accountId: string;
    currency: string; // ISO 4217
    accountType: string; // e.g. "settlement", "nostro", "collateral"
  }>;
  setupAt: string; // ISO timestamp
  setupBy: string; // agent URN or PartyId
}

// ---------------------------------------------------------------------------
// KYC onboarding gateway event types (PROC-FC-01)
// Authority: PROC-FC-01 (Approved), KYC/CDD/EDD Policy (BRC-approved)
// Author: Mira (Regulatory Intelligence Engineer)
// ---------------------------------------------------------------------------

/**
 * ClientCandidateRegistered — a new onboarding candidate is registered for
 * KYC processing under PROC-FC-01 step 1.
 * Citations: ORG-FC-02, FIC-ACT-S21, FATF-REC-10
 */
export interface ClientCandidateRegisteredPayload {
  candidateId: string;
  entityType: "natural-person" | "legal-entity" | "trust";
  registeredBy: PartyId;
  entity: string;
}

/**
 * PEPScreeningCompleted — PEP screening result recorded per PROC-FC-01 step 3.
 * Citations: ORG-FC-04, FIC-ACT-S21B, FATF-REC-12
 */
export interface PEPScreeningCompletedPayload {
  candidateId: string;
  result: "CLEAR" | "HIT" | "ERROR";
  pepTier?: 1 | 2 | 3;
  matchRefs?: string[];
}

/**
 * RiskRatingAssigned — RBA risk rating assigned per PROC-FC-01 step 5.
 * Citations: ORG-FC-02, FIC-ACT-S21, FATF-REC-10
 */
export interface RiskRatingAssignedPayload {
  candidateId: string;
  rating: "STANDARD" | "HIGH" | "PEP" | "PROHIBITED";
  rbaScoreFactors: string[];
}

/**
 * EddInitiated — enhanced due diligence initiated per PROC-FC-01 step 6.
 * Citations: ORG-FC-05, FIC-ACT-S21B, FATF-REC-10
 */
export interface EddInitiatedPayload {
  candidateId: string;
  reason: string;
  assignedTo: PartyId;
  slaDeadlineIso: string;
}

/**
 * EddCompleted — EDD review outcome recorded per PROC-FC-01 step 7.
 * Citations: ORG-FC-05, FIC-ACT-S21B
 */
export interface EddCompletedPayload {
  candidateId: string;
  outcome: "PROCEED" | "REJECT";
  reviewerId: PartyId;
  notes: string;
}

/**
 * ClientAccepted — candidate accepted into client roster per PROC-FC-01 step 8.
 * Citations: ORG-FC-02, ORG-FC-03, FIC-ACT-S21
 */
export interface ClientAcceptedPayload {
  candidateId: string;
  riskRating: "STANDARD" | "HIGH" | "PEP";
  kycTier: "Tier-1" | "Tier-2";
  acceptedBy: PartyId;
}

/**
 * ClientRejected — candidate rejected at any gate per PROC-FC-01 steps 2–7.
 * Citations: ORG-FC-02, ORG-FC-03, ORG-FC-04, FIC-ACT-S21
 */
export interface ClientRejectedPayload {
  candidateId: string;
  reasonCode:
    | "SANCTIONS_HIT"
    | "PEP_EDD_REJECTED"
    | "PROHIBITED_ENTITY"
    | "DOCUMENT_FAIL"
    | "SCREENING_ERROR";
  rejectedBy: PartyId;
}

export const CUSTOMER_EVENT_TYPES = [
  "CounterpartySoundingOpened",
  "CounterpartyProspectRegistered",
  "KycCompleted",
  "DocumentationDrafted",
  "DocumentationReadyToExecute",
  "AuthorisedSignatoryAdded",
  "AuthorisedSignatoryRemoved",
  "MandateAssigned",
  "MandateRevised",
  "MandateRevoked",
  "CounterpartyActivated",
  "CounterpartyOffboarded",
  // Slice 2 — 7 new phase event types
  "CounterpartyFaisClassified",
  "BeneficialOwnerResolved",
  "SanctionsClearancePassed",
  "FatcaCrsClassified",
  "PopiaConsentRecorded",
  "CreditAssessmentCompleted",
  "AccountsSetupCompleted",
  // KYC onboarding gateway — PROC-FC-01 (Mira)
  "ClientCandidateRegistered",
  "PEPScreeningCompleted",
  "RiskRatingAssigned",
  "EddInitiated",
  "EddCompleted",
  "ClientAccepted",
  "ClientRejected",
] as const;

export type CustomerEventType = (typeof CUSTOMER_EVENT_TYPES)[number];

/** Build a typed CounterpartyId from a string (use sparingly — at boundaries). */
export function counterpartyId(s: string): CounterpartyId {
  return s as CounterpartyId;
}

/** Default entity used during the build phase. P5 — multi-entity-ready. */
export const DEFAULT_ENTITY: LegalEntity = BANK_ZA_001;
