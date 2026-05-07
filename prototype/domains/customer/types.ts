// domains/customer/types.ts
//
// Event types and value objects for the institutional client lifecycle.
//
// P1 — every state change is an event in the log.
// P2 — every event carries citations (registry entries cited at emission).
// P5 — multi-entity-ready: every counterparty is held under a typed legal
//      entity ("BANK-ZA-001" today; the entity field is non-optional).
//
// Author: Niko · Anya (event shape review)

import type { LegalEntity } from "@platform/core/types";

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
  reviewerId: string;
}

export interface DocumentationPayload {
  counterpartyId: CounterpartyId;
  agreementType: AgreementType;
  version: string;
  packageHash?: string;
}

export interface AuthorisedSignatoryPayload {
  counterpartyId: CounterpartyId;
  personId: string;
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
] as const;

export type CustomerEventType = (typeof CUSTOMER_EVENT_TYPES)[number];

/** Build a typed CounterpartyId from a string (use sparingly — at boundaries). */
export function counterpartyId(s: string): CounterpartyId {
  return s as CounterpartyId;
}

/** Default entity used during the build phase. P5 — multi-entity-ready. */
export const DEFAULT_ENTITY: LegalEntity = "BANK-ZA-001" as LegalEntity;
