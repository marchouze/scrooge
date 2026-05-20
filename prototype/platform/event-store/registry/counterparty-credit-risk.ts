// platform/event-store/registry/counterparty-credit-risk.ts
//
// WS-CREDIT-LIMIT-ENGINE — SA-CCR / LEX computation event-type registry rows.
//
// Covers:
//   CcrReplacementCostComputed, CcrEadComputed, LexUtilisationComputed,
//   LexExceptionApproved.
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
//
// Citations:
//   Banks Act 94 of 1990 §73;
//   RRB Regulation 23 (large exposures);
//   LEX Directive D3/2022;
//   BCBS 279 (SA-CCR — standardised approach for counterparty credit risk);
//   BCBS 283 (large exposures framework, 2014);
//   Policies/credit-risk-policy-v1.md §2 + §3.
//
// Retention classification:
//   - CcrReplacementCostComputed → RETENTION_BANKING_5Y (Banks Act s.60).
//   - CcrEadComputed → RETENTION_BANKING_5Y (Banks Act s.60; BA 600 input).
//   - LexUtilisationComputed → RETENTION_BANKING_5Y (RRB Reg 23 audit trail).
//   - LexExceptionApproved → RETENTION_GOVERNANCE_7Y (governance / committee
//     minutes; PA-grade approvals.).
//
// Authors: Rohan (Market risk quantitative engineer, engineering — SA-CCR /
//   RC shapes) + Atlas (Core banking platform architect, engineering).

import {
  ccrEadComputedPayloadSchema,
  ccrReplacementCostComputedPayloadSchema,
  lexExceptionApprovedPayloadSchema,
  lexUtilisationComputedPayloadSchema,
} from "../event-types/counterparty-credit-risk";
import { RETENTION_BANKING_5Y, RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * SA-CCR / LEX computation event-type registry rows.
 *
 * Subscribers:
 *   Helena (CRO, governance) — every event; she owns LEX cap monitoring
 *     and the RAS counterparty-concentration line.
 *   Rohan (Market risk quantitative engineer, engineering) — daily RC +
 *     utilisation feed; PFE model inputs.
 *   Mira (Compliance / RegTech engineer, engineering) — BA 600 large-
 *     exposure return inputs; PA notification on cap breaches.
 *   Owen (Company Secretary, governance) — LexExceptionApproved entries
 *     for the decisions register.
 *   Atlas (Core banking platform architect, engineering) — every event
 *     for substrate monitoring.
 */
export const COUNTERPARTY_CREDIT_RISK_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "CcrReplacementCostComputed",
    class: "audit",
    issuer: "Rohan",
    subscribers: ["Helena", "Rohan", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: ccrReplacementCostComputedPayloadSchema,
    source: "platform/event-store/event-types/counterparty-credit-risk.ts",
    citationsHint: ["BCBS-279", "POLICY:credit-risk-policy-v1-S3"],
  },
  {
    type: "CcrEadComputed",
    class: "audit",
    issuer: "Rohan",
    subscribers: ["Helena", "Rohan", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: ccrEadComputedPayloadSchema,
    source: "platform/event-store/event-types/counterparty-credit-risk.ts",
    citationsHint: ["BCBS-279", "POLICY:credit-risk-policy-v1-S3"],
  },
  {
    type: "LexUtilisationComputed",
    class: "audit",
    issuer: "Rohan",
    subscribers: ["Helena", "Rohan", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: lexUtilisationComputedPayloadSchema,
    source: "platform/event-store/event-types/counterparty-credit-risk.ts",
    citationsHint: [
      "BANKS-ACT-94-1990-S73",
      "RRB-REG-23",
      "BCBS-283",
      "POLICY:credit-risk-policy-v1-S2",
    ],
  },
  {
    type: "LexExceptionApproved",
    class: "audit",
    issuer: "Owen",
    subscribers: ["Helena", "Owen", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: lexExceptionApprovedPayloadSchema,
    source: "platform/event-store/event-types/counterparty-credit-risk.ts",
    citationsHint: ["RRB-REG-23", "POLICY:credit-risk-policy-v1-S2"],
  },
];
