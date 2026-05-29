// platform/event-store/registry/kyc.ts
//
// KYC onboarding lifecycle event-type registry rows.
//
// Covers:
//   KYCIdentityCollected, KYCIdentityVerified, KYCIdentityVerificationFailed,
//   KYCSanctionsPEPScreened, KYCUBOResolved, KYCRiskRated,
//   KYCEDDInitiated, KYCEDDCompleted, KYCDecisionMade,
//   ClientAccepted, ClientRejected, LawfulProcessingRegistered,
//   KYCRefreshScheduled, KYCRefreshCompleted, KYCRatingRevised,
//   CounterpartyCategorised, CounterpartyDeclined
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   AML-CFT-POLICY-V1; FIC-ACT-38-2001; FATF-REC-10; POPIA-S11.
//
// Retention classification:
//   - KYC audit trail events (identity, screening, UBO, EDD, decisions)
//     → RETENTION_FIC_5Y (FIC Act s.22 — CDD records 5-year floor).
//   - ClientAccepted / ClientRejected / ClientRejected lifecycle
//     → RETENTION_BANKING_5Y (Banks Act s.60 + FIC s.22).
//   - LawfulProcessingRegistered → RETENTION_GOVERNANCE_7Y (POPIA s.55
//     processing records; 7-year floor for audit trail).
//   - Refresh / rating revision → RETENTION_FIC_5Y (ongoing CDD obligation).
//   - FAIS categorisation → RETENTION_GOVERNANCE_7Y (FAIS s.18 record-keeping).
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Zara (MLRO, governance) + Mira (Compliance / RegTech engineer, engineering).

import {
  clientAcceptedPayloadSchema,
  clientRejectedPayloadSchema,
  counterpartyCategorisedPayloadSchema,
  counterpartyDeclinedPayloadSchema,
  kycDecisionMadePayloadSchema,
  kycEDDCompletedPayloadSchema,
  kycEDDInitiatedPayloadSchema,
  kycIdentityCollectedPayloadSchema,
  kycIdentityVerificationFailedPayloadSchema,
  kycIdentityVerifiedPayloadSchema,
  kycRatingRevisedPayloadSchema,
  kycRefreshCompletedPayloadSchema,
  kycRefreshScheduledPayloadSchema,
  kycRiskRatedPayloadSchema,
  kycSanctionsPEPScreenedPayloadSchema,
  kycUBOResolvedPayloadSchema,
  lawfulProcessingRegisteredPayloadSchema,
  odpCounterpartyCategorisedPayloadSchema,
} from "../event-types/kyc";
import { RETENTION_BANKING_5Y, RETENTION_FIC_5Y, RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * KYC onboarding lifecycle event-type registry rows.
 *
 * Subscribers:
 *   Zara (MLRO) — all KYC events for AML/CFT oversight.
 *   Niko (Client lifecycle) — onboarding progress events.
 *   Mira (CCO) — screening, EDD, and FAIS categorisation events.
 *   Helena (CRO) — risk rating and EDD events for risk oversight.
 *   Atlas (platform) — all events for substrate monitoring.
 */
export const KYC_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  // ---------------------------------------------------------------------------
  // Identity collection and verification
  // ---------------------------------------------------------------------------
  {
    type: "KYCIdentityCollected",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Niko", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: kycIdentityCollectedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001", "AML-CFT-POLICY-V1", "FATF-REC-10"],
  },
  {
    type: "KYCIdentityVerified",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Niko", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_FIC_5Y,
    payloadSchema: kycIdentityVerifiedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001", "AML-CFT-POLICY-V1"],
  },
  {
    type: "KYCIdentityVerificationFailed",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Niko", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_FIC_5Y,
    payloadSchema: kycIdentityVerificationFailedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001", "AML-CFT-POLICY-V1"],
  },
  // ---------------------------------------------------------------------------
  // Sanctions and PEP screening
  // ---------------------------------------------------------------------------
  {
    type: "KYCSanctionsPEPScreened",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Mira", "Helena", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: kycSanctionsPEPScreenedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001", "FATF-REC-12", "AML-CFT-POLICY-V1"],
  },
  // ---------------------------------------------------------------------------
  // UBO resolution
  // ---------------------------------------------------------------------------
  {
    type: "KYCUBOResolved",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Mira", "Helena", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: kycUBOResolvedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001-S21B", "FATF-REC-10", "AML-CFT-POLICY-V1"],
  },
  // ---------------------------------------------------------------------------
  // Risk rating
  // ---------------------------------------------------------------------------
  {
    type: "KYCRiskRated",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Helena", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: kycRiskRatedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001", "FATF-REC-10", "AML-CFT-POLICY-V1"],
  },
  // ---------------------------------------------------------------------------
  // Enhanced due diligence
  // ---------------------------------------------------------------------------
  {
    type: "KYCEDDInitiated",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Mira", "Helena", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: kycEDDInitiatedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001", "FATF-REC-12", "AML-CFT-POLICY-V1"],
  },
  {
    type: "KYCEDDCompleted",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Mira", "Helena", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_FIC_5Y,
    payloadSchema: kycEDDCompletedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001", "FATF-REC-12", "AML-CFT-POLICY-V1"],
  },
  // ---------------------------------------------------------------------------
  // Onboarding decision
  // ---------------------------------------------------------------------------
  {
    type: "KYCDecisionMade",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Niko", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: kycDecisionMadePayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001", "AML-CFT-POLICY-V1"],
  },
  {
    type: "ClientAccepted",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Niko", "Mira", "Helena", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: clientAcceptedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001", "AML-CFT-POLICY-V1", "FAIS-ACT-37-2002"],
  },
  {
    type: "ClientRejected",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Niko", "Mira", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: clientRejectedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001", "AML-CFT-POLICY-V1"],
  },
  // ---------------------------------------------------------------------------
  // POPIA lawful processing
  // ---------------------------------------------------------------------------
  {
    type: "LawfulProcessingRegistered",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Mira", "Zara", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: lawfulProcessingRegisteredPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["POPIA-S11", "POPIA-S55"],
  },
  // ---------------------------------------------------------------------------
  // Periodic refresh lifecycle
  // ---------------------------------------------------------------------------
  {
    type: "KYCRefreshScheduled",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: kycRefreshScheduledPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001", "AML-CFT-POLICY-V1"],
  },
  {
    type: "KYCRefreshCompleted",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Niko", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_FIC_5Y,
    payloadSchema: kycRefreshCompletedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001", "AML-CFT-POLICY-V1"],
  },
  {
    type: "KYCRatingRevised",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Helena", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: kycRatingRevisedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FIC-ACT-38-2001", "AML-CFT-POLICY-V1"],
  },
  // ---------------------------------------------------------------------------
  // FAIS counterparty categorisation
  // ---------------------------------------------------------------------------
  {
    type: "CounterpartyCategorised",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Mira", "Niko", "Kai", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: counterpartyCategorisedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FAIS-ACT-37-2002", "FAIS-GCC-S2"],
  },
  {
    type: "CounterpartyDeclined",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Mira", "Niko", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: counterpartyDeclinedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["FAIS-ACT-37-2002", "FAIS-GCC-S2"],
  },
  // ---------------------------------------------------------------------------
  // ODP client / counterparty categorisation — CS 2/2018 §4 + ORG-ODP-COND-002
  // Emitted at the fais-categorised gate when determineOdpCategory() runs.
  // Distinct from CounterpartyCategorised (FAIS EC/PC/RC); this is the ODP
  // binary classification required before entering any OTC derivative.
  // Retention: GOVERNANCE_7Y — FAIS s.18 record-keeping obligation.
  // ---------------------------------------------------------------------------
  {
    type: "OdpCounterpartyCategorised",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Mira", "Niko", "Kai", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: odpCounterpartyCategorisedPayloadSchema,
    source: "platform/event-store/event-types/kyc.ts",
    citationsHint: ["CS-2-2018-S4", "ORG-ODP-COND-002", "FAIS-ACT-37-2002"],
  },
];
