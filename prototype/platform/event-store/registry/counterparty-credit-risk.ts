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
  ccrEadComputedPayloadSchemaV2,
  ccrReplacementCostComputedPayloadSchema,
  counterpartyBaselClassAssignedPayloadSchema,
  lexExceptionApprovedPayloadSchema,
  lexUtilisationComputedPayloadSchema,
  sicrTriggeredPayloadSchema,
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
    v2Status: "v2-parallel",
  },
  {
    type: "CcrEadComputed",
    class: "audit",
    issuer: "Rohan",
    subscribers: ["Helena", "Rohan", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: ccrEadComputedPayloadSchemaV2,
    source: "platform/event-store/event-types/counterparty-credit-risk.ts",
    citationsHint: ["BCBS-279", "POLICY:credit-risk-policy-v1-S3"],
    v2Status: "v2-parallel",
    // V1 (integer minor rc/pfe/ead) → V2 (MoneyWire decimal-native). The
    // version-keyed upcaster is declared in upcaster-registry.ts; the legacy
    // shape-sniff is retained there ONLY as the permanent fallback for the
    // immutable, un-stamped V1 events already in the store.
    // (D-EVENT-ENVELOPE-SCHEMA-VERSION.)
    schemaVersion: 2,
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
    v2Status: "v1-only",
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
    v2Status: "v1-only",
  },
  {
    // IFRS 9 §5.5.3 Significant-Increase-in-Credit-Risk (SICR) memo.
    // Emitted by `platform/credit-risk/sicr-subscriber.ts` on settlement-
    // failure / rating-downgrade / watchlist triggers. FVTPL instruments
    // take no ECL allowance (§5.5.1 + IFRS 9 ECL Provisioning Policy §51)
    // — this event is the supervisory signal, not a GL movement.
    // Authority: PRs #608/#609/#616/#641; Kai PR #645; Helena 2026-05-20
    //   FX-spot-only market risk scope review.
    type: "SicrTriggered",
    class: "audit",
    issuer: "Bea",
    subscribers: ["Helena", "Bea", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: sicrTriggeredPayloadSchema,
    source: "platform/event-store/event-types/counterparty-credit-risk.ts",
    citationsHint: [
      "IFRS-9-S5.5.1",
      "IFRS-9-S5.5.3",
      "IFRS-9-S5.5.13",
      "POLICY:credit-risk-policy-v1-S4",
      "POLICY:ifrs9-ecl-provisioning-policy-v1-S51",
    ],
    v2Status: "v1-only",
  },
  {
    // Authoritative Basel counterparty-class assignment (CRE20 taxonomy).
    // Set by the credit-risk authority (CRC / CRO); the RWA projection resolves
    // the latest-effective assignment per counterparty to apply the standardised
    // risk weight. An unclassified counterparty falls back to the prudent
    // `corporate-non-ig` (100%) interim and is surfaced by
    // recon:counterparty-basel-classification-coverage.
    // Authority: D-FX-COUNTERPARTY-BASEL-CLASSIFICATION; BCBS CRE20.
    type: "CounterpartyBaselClassAssigned",
    class: "audit",
    issuer: "Helena",
    subscribers: ["Helena", "Rohan", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: counterpartyBaselClassAssignedPayloadSchema,
    source: "platform/event-store/event-types/counterparty-credit-risk.ts",
    citationsHint: ["BCBS-CRE20", "RRB-REG-38", "POLICY:credit-risk-policy-v1-S3"],
    v2Status: "v1-only",
  },
];
