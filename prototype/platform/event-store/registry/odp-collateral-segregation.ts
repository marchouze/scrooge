// platform/event-store/registry/odp-collateral-segregation.ts
//
// WS-ODP-COLLATERAL-SEGREGATION — event-type registry rows for the ODP
// collateral segregation enforcement engine.
//
// Events registered:
//   CollateralSegregationLocked      — collateral locked to counterparty CSA
//   CollateralSegregationReleased    — lock released (margin return / substitution out)
//   CollateralSubstitutionRequested  — counterparty requests collateral substitution
//   CollateralSubstitutionApproved   — substitution validated against CSA schedule
//   CollateralSubstitutionRejected   — substitution rejected (ineligible / value deficient)
//   CollateralSufficiencyChecked     — daily haircut + FX-adjusted sufficiency check
//   CollateralSegregationBreachRaised — sufficiency or commingling breach → CRO escalation
//
// Authority:
//   ORG-ODP-COND-010 (Derivatives Counterparty obligation — collateral segregation)
//   urn:regulation:odp:cs-2-2018 §12 (Segregation and rehypothecation controls)
//   ISDA 1994 CSA §§ 3–4 (eligible collateral, thresholds, substitution)
//   ISDA 2016 VM CSA §§ 3–4 (variation-margin eligible credit support, substitution)
//   BCBS d317 (SA-CCR §§ 5–7) — CSA terms; margined vs unmargined netting sets
//   Principle 1 (events-are-truth)
//   Principle 5 (multi-currency)
//
// Retention:
//   Lock/release/sufficiency events → RETENTION_ACCOUNTING_7Y
//   (Collateral records are financial-contract records under Companies Act s.24 +
//    SARB CS 3/2018 §12; 7-year retention.)
//   Substitution events → RETENTION_ACCOUNTING_7Y
//   (Substitution audit trail forms part of the CSA operational record.)
//   Breach events → RETENTION_ACCOUNTING_7Y
//   (Regulatory compliance obligation; breach records may be subject to PA review.)
//
// Author: Devon (COO, operations)

import {
  collateralSegregationBreachRaisedPayloadSchema,
  collateralSegregationLockedPayloadSchema,
  collateralSegregationReleasedPayloadSchema,
  collateralSubstitutionApprovedPayloadSchema,
  collateralSubstitutionRejectedPayloadSchema,
  collateralSubstitutionRequestedPayloadSchema,
  collateralSufficiencyCheckedPayloadSchema,
} from "../event-types/odp-collateral-segregation";
import { RETENTION_ACCOUNTING_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * ODP collateral segregation enforcement event-type registry rows.
 *
 * Primary consumers:
 *   Devon (COO, operations) — segregation process ownership; sufficiency checks.
 *   Helena (Chief Risk Officer, governance) — CRO escalation target on breach.
 *   Imani (General Counsel, legal) — CSA eligible-collateral schedule enforcement.
 *   Owen (Company Secretary, governance) — compliance register.
 *   Vera (Internal audit engineer) — breach-staleness recon gate.
 *   Atlas (Core banking platform architect, engineering) — substrate.
 */
export const ODP_COLLATERAL_SEGREGATION_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  // --------------------------------------------------------------------------
  // Lock lifecycle
  // --------------------------------------------------------------------------

  {
    type: "CollateralSegregationLocked",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Imani", "Owen", "Vera", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: collateralSegregationLockedPayloadSchema,
    citationsHint: [
      "ORG-ODP-COND-010",
      "urn:regulation:odp:cs-2-2018",
      "ISDA-CSA-2016-VM",
      "BCBS-D317",
    ],
    source: "platform/event-store/event-types/odp-collateral-segregation.ts",
    v2Status: "v1-only",
  },

  {
    type: "CollateralSegregationReleased",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Imani", "Owen", "Vera", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: collateralSegregationReleasedPayloadSchema,
    citationsHint: ["ORG-ODP-COND-010", "urn:regulation:odp:cs-2-2018", "ISDA-CSA-2016-VM"],
    source: "platform/event-store/event-types/odp-collateral-segregation.ts",
    v2Status: "v1-only",
  },

  // --------------------------------------------------------------------------
  // Substitution lifecycle
  // --------------------------------------------------------------------------

  {
    type: "CollateralSubstitutionRequested",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Imani", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: collateralSubstitutionRequestedPayloadSchema,
    citationsHint: [
      "ORG-ODP-COND-010",
      "urn:regulation:odp:cs-2-2018",
      "ISDA-CSA-1994-NY",
      "ISDA-CSA-2016-VM",
    ],
    source: "platform/event-store/event-types/odp-collateral-segregation.ts",
    v2Status: "v1-only",
  },

  {
    type: "CollateralSubstitutionApproved",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Imani", "Owen", "Vera", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: collateralSubstitutionApprovedPayloadSchema,
    citationsHint: [
      "ORG-ODP-COND-010",
      "urn:regulation:odp:cs-2-2018",
      "ISDA-CSA-1994-NY",
      "ISDA-CSA-2016-VM",
    ],
    source: "platform/event-store/event-types/odp-collateral-segregation.ts",
    v2Status: "v1-only",
  },

  {
    type: "CollateralSubstitutionRejected",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Imani", "Owen", "Vera", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: collateralSubstitutionRejectedPayloadSchema,
    citationsHint: [
      "ORG-ODP-COND-010",
      "urn:regulation:odp:cs-2-2018",
      "ISDA-CSA-1994-NY",
      "ISDA-CSA-2016-VM",
    ],
    source: "platform/event-store/event-types/odp-collateral-segregation.ts",
    v2Status: "v1-only",
  },

  // --------------------------------------------------------------------------
  // Sufficiency check
  // --------------------------------------------------------------------------

  {
    type: "CollateralSufficiencyChecked",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Imani", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: collateralSufficiencyCheckedPayloadSchema,
    citationsHint: [
      "ORG-ODP-COND-010",
      "urn:regulation:odp:cs-2-2018",
      "ISDA-CSA-2016-VM",
      "BCBS-D317",
    ],
    source: "platform/event-store/event-types/odp-collateral-segregation.ts",
    v2Status: "v1-only",
  },

  // --------------------------------------------------------------------------
  // Breach / CRO escalation
  // --------------------------------------------------------------------------

  {
    type: "CollateralSegregationBreachRaised",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Imani", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: collateralSegregationBreachRaisedPayloadSchema,
    citationsHint: [
      "ORG-ODP-COND-010",
      "urn:regulation:odp:cs-2-2018",
      "ISDA-CSA-2016-VM",
      "BCBS-D317",
    ],
    source: "platform/event-store/event-types/odp-collateral-segregation.ts",
    v2Status: "v1-only",
  },
];
