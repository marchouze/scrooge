// platform/event-store/registry/credit-limit.ts
//
// WS-CREDIT-LIMIT-ENGINE — Credit-limit lifecycle event-type registry rows.
//
// Covers:
//   CreditLimitApplicationSubmitted, CreditLimitExtensionRequested,
//   CreditAnalysisCompleted, ISDACSAAssessmentCompleted, CreditLimitProposed,
//   CreditLimitApproved, CreditLimitLoaded, CreditLimitAnnualReviewCompleted,
//   CreditLimitBreached, CreditLimitBreachDisposed,
//   CrcLimitExceptionApproved, SubInvestmentGradeCounterpartyApproved.
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
//
// Citations:
//   Banks Act 94 of 1990 §73;
//   RRB Regulation 23 (credit-risk large exposure limits);
//   LEX Directive D3/2022;
//   BCBS 283 (large exposures framework, 2014);
//   Policies/credit-risk-policy-v1.md (IN FORCE 2026-05-13);
//   Procedures/by-policy/credit-origination.md (PROC-RISK-CO-01).
//
// Retention classification:
//   - Lifecycle audit trail (application → approval → load → review)
//     → RETENTION_BANKING_5Y (Banks Act s.60 audit trail; 5-year floor).
//   - Breach + disposal events
//     → RETENTION_BANKING_5Y (regulator inspection scope).
//   - Governance exceptions (CRC, sub-IG counterparty)
//     → RETENTION_GOVERNANCE_7Y (board / committee minutes; 7-year floor).
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Helena (Chief Risk Officer, governance — credit-risk limit authority) +
//   Rohan (Market risk quantitative engineer, engineering).

import {
  crcLimitExceptionApprovedPayloadSchema,
  creditAnalysisCompletedPayloadSchema,
  creditLimitAnnualReviewCompletedPayloadSchema,
  creditLimitApplicationSubmittedPayloadSchema,
  creditLimitApprovedPayloadSchema,
  creditLimitBreachDisposedPayloadSchema,
  creditLimitBreachedPayloadSchema,
  creditLimitExtensionRequestedPayloadSchema,
  creditLimitLoadedPayloadSchema,
  creditLimitProposedPayloadSchema,
  creditLimitWithdrawnPayloadSchema,
  isdaCsaAssessmentCompletedPayloadSchema,
  subInvestmentGradeCounterpartyApprovedPayloadSchema,
} from "../event-types/credit-limit";
import { RETENTION_BANKING_5Y, RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Credit-limit lifecycle event-type registry rows.
 *
 * Subscribers:
 *   Helena (CRO, governance) — every event; she owns the credit-risk
 *     limit authority chain per Credit Risk Policy §7.
 *   Rohan (Market risk quantitative engineer, engineering) — analysis,
 *     proposal, approval, breach events for SA-CCR / PFE inputs.
 *   Saskia (Head of Global Markets, governance) — application,
 *     extension, approval, breach events to assess franchise impact.
 *   Mira (Compliance / RegTech engineer, engineering) — approval, load,
 *     annual-review, breach + disposal for BA 600 large-exposure
 *     reporting and PA notification triggers.
 *   Owen (Company Secretary, governance) — CRC + sub-IG governance
 *     exceptions for the decisions register.
 *   Atlas (Core banking platform architect, engineering) — every event
 *     for substrate monitoring.
 */
export const CREDIT_LIMIT_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  // -------------------------------------------------------------------------
  // Application + extension
  // -------------------------------------------------------------------------
  {
    type: "CreditLimitApplicationSubmitted",
    class: "audit",
    issuer: "Saskia",
    subscribers: ["Helena", "Rohan", "Saskia", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: creditLimitApplicationSubmittedPayloadSchema,
    source: "platform/event-store/event-types/credit-limit.ts",
    citationsHint: [
      "BANKS-ACT-94-1990-S73",
      "RRB-REG-23",
      "POLICY:credit-risk-policy-v1",
      "PROC-RISK-CO-01",
    ],
    v2Status: "v1-only",
  },
  {
    type: "CreditLimitExtensionRequested",
    class: "audit",
    issuer: "Saskia",
    subscribers: ["Helena", "Rohan", "Saskia", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: creditLimitExtensionRequestedPayloadSchema,
    source: "platform/event-store/event-types/credit-limit.ts",
    citationsHint: ["POLICY:credit-risk-policy-v1", "PROC-RISK-CO-01"],
    v2Status: "v1-only",
  },
  // -------------------------------------------------------------------------
  // Analysis + ISDA/CSA assessment
  // -------------------------------------------------------------------------
  {
    type: "CreditAnalysisCompleted",
    class: "audit",
    issuer: "Helena",
    subscribers: ["Helena", "Rohan", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: creditAnalysisCompletedPayloadSchema,
    source: "platform/event-store/event-types/credit-limit.ts",
    citationsHint: ["BCBS-283", "POLICY:credit-risk-policy-v1", "PROC-RISK-CO-01"],
    v2Status: "v1-only",
  },
  {
    type: "ISDACSAAssessmentCompleted",
    class: "audit",
    issuer: "Imani",
    subscribers: ["Helena", "Rohan", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: isdaCsaAssessmentCompletedPayloadSchema,
    source: "platform/event-store/event-types/credit-limit.ts",
    citationsHint: [
      "ISDA-MASTER-2002",
      "GMRA-2011",
      "POLICY:credit-risk-policy-v1",
      "PROC-RISK-CO-01",
    ],
    v2Status: "v1-only",
  },
  // -------------------------------------------------------------------------
  // Proposal + approval
  // -------------------------------------------------------------------------
  {
    type: "CreditLimitProposed",
    class: "audit",
    issuer: "Helena",
    subscribers: ["Helena", "Rohan", "Saskia", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: creditLimitProposedPayloadSchema,
    source: "platform/event-store/event-types/credit-limit.ts",
    citationsHint: ["RRB-REG-23", "POLICY:credit-risk-policy-v1", "PROC-RISK-CO-01"],
    v2Status: "v1-only",
  },
  {
    type: "CreditLimitApproved",
    class: "audit",
    issuer: "Helena",
    subscribers: ["Helena", "Rohan", "Saskia", "Mira", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: creditLimitApprovedPayloadSchema,
    source: "platform/event-store/event-types/credit-limit.ts",
    citationsHint: [
      "BANKS-ACT-94-1990-S73",
      "RRB-REG-23",
      "POLICY:credit-risk-policy-v1",
      "PROC-RISK-CO-01",
    ],
    v2Status: "v1-only",
  },
  // -------------------------------------------------------------------------
  // Load + annual review
  // -------------------------------------------------------------------------
  {
    type: "CreditLimitLoaded",
    class: "audit",
    issuer: "Atlas",
    subscribers: ["Helena", "Rohan", "Saskia", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: creditLimitLoadedPayloadSchema,
    source: "platform/event-store/event-types/credit-limit.ts",
    citationsHint: ["POLICY:credit-risk-policy-v1", "PROC-RISK-CO-01"],
    v2Status: "v1-only",
  },
  {
    type: "CreditLimitAnnualReviewCompleted",
    class: "audit",
    issuer: "Helena",
    subscribers: ["Helena", "Rohan", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: creditLimitAnnualReviewCompletedPayloadSchema,
    source: "platform/event-store/event-types/credit-limit.ts",
    citationsHint: ["POLICY:credit-risk-policy-v1", "PROC-RISK-CO-01"],
    v2Status: "v1-only",
  },
  // -------------------------------------------------------------------------
  // Breach + disposal
  // -------------------------------------------------------------------------
  {
    type: "CreditLimitBreached",
    class: "audit",
    issuer: "Atlas",
    subscribers: ["Helena", "Rohan", "Saskia", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: creditLimitBreachedPayloadSchema,
    source: "platform/event-store/event-types/credit-limit.ts",
    citationsHint: ["RRB-REG-23", "POLICY:credit-risk-policy-v1-S1.4", "PROC-RISK-CO-01"],
    v2Status: "v1-only",
  },
  {
    type: "CreditLimitBreachDisposed",
    class: "audit",
    issuer: "Helena",
    subscribers: ["Helena", "Rohan", "Saskia", "Mira", "Owen", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: creditLimitBreachDisposedPayloadSchema,
    source: "platform/event-store/event-types/credit-limit.ts",
    citationsHint: ["POLICY:credit-risk-policy-v1", "PROC-RISK-CO-01"],
    v2Status: "v1-only",
  },
  // -------------------------------------------------------------------------
  // Governance exceptions
  // -------------------------------------------------------------------------
  {
    type: "CrcLimitExceptionApproved",
    class: "audit",
    issuer: "Owen",
    subscribers: ["Helena", "Owen", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: crcLimitExceptionApprovedPayloadSchema,
    source: "platform/event-store/event-types/credit-limit.ts",
    citationsHint: ["POLICY:credit-risk-policy-v1-S7"],
    v2Status: "v1-only",
  },
  {
    type: "SubInvestmentGradeCounterpartyApproved",
    class: "audit",
    issuer: "Owen",
    subscribers: ["Helena", "Rohan", "Saskia", "Owen", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: subInvestmentGradeCounterpartyApprovedPayloadSchema,
    source: "platform/event-store/event-types/credit-limit.ts",
    citationsHint: ["POLICY:credit-risk-policy-v1-S3"],
    v2Status: "v1-only",
  },
  // -------------------------------------------------------------------------
  // Withdrawal — explicit decommissioning of a loaded / approved limit
  // -------------------------------------------------------------------------
  {
    type: "CreditLimitWithdrawn",
    class: "audit",
    issuer: "Helena",
    subscribers: ["Helena", "Rohan", "Saskia", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: creditLimitWithdrawnPayloadSchema,
    source: "platform/event-store/event-types/credit-limit.ts",
    citationsHint: ["POLICY:credit-risk-policy-v1-S7", "PROC-RISK-CO-01"],
    v2Status: "v1-only",
  },
];
