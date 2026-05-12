// domains/customer/types.ts
//
// Event types and value objects for the institutional client lifecycle.
//
// P1 — every state change is an event in the log.
// P2 — every event carries citations (registry entries cited at emission).
// P5 — multi-entity-ready: every counterparty is held under a typed legal
//      entity ("BANK-ZA-001" today; the entity field is non-optional).
// D-PARTY-REGISTER (CEO-approved 2026-05-11, PR 4): `personId` and
//      `reviewerId` are tightened from plain `string` to `PartyId` so that
//      all identity-axis foreign keys carry the Party URN discipline.
//
// Author: Niko · Anya (event shape review)

import type { LegalEntity } from "@platform/core/types";
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
] as const;

export type CustomerEventType = (typeof CUSTOMER_EVENT_TYPES)[number];

/** Build a typed CounterpartyId from a string (use sparingly — at boundaries). */
export function counterpartyId(s: string): CounterpartyId {
  return s as CounterpartyId;
}

/** Default entity used during the build phase. P5 — multi-entity-ready. */
export const DEFAULT_ENTITY: LegalEntity = "BANK-ZA-001" as LegalEntity;
