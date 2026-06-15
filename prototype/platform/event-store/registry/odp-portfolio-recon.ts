// platform/event-store/registry/odp-portfolio-recon.ts
//
// WS-ODP-PORTFOLIO-RECON — event-type registry rows for the ODP portfolio
// reconciliation substrate (5 recon-run events + 3 break/dispute lifecycle events).
//
// Events registered:
//   OdpMtmVsGlReconRun           — MTM vs GL mark reconciliation run
//   OdpExposureVsCsaReconRun     — Counterparty exposure vs CSA collateral balance
//   OdpCollateralVsCustodyReconRun — Collateral portfolio vs custody holdings
//   OdpCreditLimitVsAllocatedReconRun — Credit limit vs allocated limit
//   OdpNettingSetVsSettlementReconRun — Netting set vs settlement instruction
//   OdpReconBreakRaised          — Individual break item within a recon run
//   OdpReconDisputeOpened        — Formal dispute opened on a break
//   OdpReconDisputeResolved      — Dispute resolved or escalated to CRO
//
// Authority:
//   ORG-ODP-COND-007 (Derivatives Counterparty obligation — portfolio reconciliation)
//   urn:regulation:odp:cs-2-2018 §9 (portfolio reconciliation and dispute resolution)
//   ISDA EMIR Portfolio Reconciliation, Dispute Resolution and Disclosure (2013)
//   Principle 1 (events-are-truth)
//   Principle 5 (multi-currency)
//
// Retention:
//   Recon run events → RETENTION_ACCOUNTING_7Y
//   (Financial-records obligation under Companies Act s.24 + CS 3/2018 §12;
//    7-year retention for derivatives reconciliation records.)
//   Break/dispute events → RETENTION_ACCOUNTING_7Y
//   (Dispute records form part of the ODP reconciliation audit trail;
//    regulatory scrutiny horizon mirrors the parent recon runs.)
//
// Author: Devon (COO, operations)

import {
  odpCollateralVsCustodyReconRunPayloadSchema,
  odpCreditLimitVsAllocatedReconRunPayloadSchema,
  odpExposureVsCsaReconRunPayloadSchema,
  odpMtmVsGlReconRunPayloadSchema,
  odpNettingSetVsSettlementReconRunPayloadSchema,
  odpReconBreakRaisedPayloadSchema,
  odpReconDisputeOpenedPayloadSchema,
  odpReconDisputeResolvedPayloadSchema,
} from "../event-types/odp-portfolio-recon";
import { RETENTION_ACCOUNTING_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * ODP portfolio reconciliation run event-type registry rows.
 *
 * Primary consumers:
 *   Devon (COO, operations) — reconciliation process ownership.
 *   Helena (Chief Risk Officer, governance) — CRO escalation target.
 *   Owen (Company Secretary, governance) — compliance register.
 *   Vera (Internal audit engineer) — dispute-staleness recon gate.
 *   Atlas (Core banking platform architect, engineering) — substrate.
 */
export const ODP_PORTFOLIO_RECON_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  // --------------------------------------------------------------------------
  // Dimension 1: MTM vs GL mark reconciliation
  // --------------------------------------------------------------------------
  {
    type: "OdpMtmVsGlReconRun",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpMtmVsGlReconRunPayloadSchema,
    citationsHint: [
      "ORG-ODP-COND-007",
      "urn:regulation:odp:cs-2-2018",
      "D-IPV-TOLERANCE-SCHEDULE-FX-SPOT",
    ],
    source: "platform/event-store/event-types/odp-portfolio-recon.ts",
    v2Status: "v1-only",
  },

  // --------------------------------------------------------------------------
  // Dimension 2: Counterparty exposure vs CSA collateral balance
  // --------------------------------------------------------------------------
  {
    type: "OdpExposureVsCsaReconRun",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpExposureVsCsaReconRunPayloadSchema,
    citationsHint: [
      "ORG-ODP-COND-007",
      "urn:regulation:odp:cs-2-2018",
      "ORG-ODP-COND-005",
      "BCBS-D317",
    ],
    source: "platform/event-store/event-types/odp-portfolio-recon.ts",
    v2Status: "v1-only",
  },

  // --------------------------------------------------------------------------
  // Dimension 3: Collateral portfolio vs custody holdings
  // --------------------------------------------------------------------------
  {
    type: "OdpCollateralVsCustodyReconRun",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpCollateralVsCustodyReconRunPayloadSchema,
    citationsHint: ["ORG-ODP-COND-007", "urn:regulation:odp:cs-2-2018", "ORG-ODP-COND-005"],
    source: "platform/event-store/event-types/odp-portfolio-recon.ts",
    v2Status: "v1-only",
  },

  // --------------------------------------------------------------------------
  // Dimension 4: Credit limit vs allocated limit
  // --------------------------------------------------------------------------
  {
    type: "OdpCreditLimitVsAllocatedReconRun",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpCreditLimitVsAllocatedReconRunPayloadSchema,
    citationsHint: [
      "ORG-ODP-COND-007",
      "urn:regulation:odp:cs-2-2018",
      "D-CREDIT-LIMIT-ENGINE-BUILD",
      "RRB-REG-23",
    ],
    source: "platform/event-store/event-types/odp-portfolio-recon.ts",
    v2Status: "v1-only",
  },

  // --------------------------------------------------------------------------
  // Dimension 5: Netting set vs settlement instruction
  // --------------------------------------------------------------------------
  {
    type: "OdpNettingSetVsSettlementReconRun",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpNettingSetVsSettlementReconRunPayloadSchema,
    citationsHint: [
      "ORG-ODP-COND-007",
      "urn:regulation:odp:cs-2-2018",
      "ORG-ODP-COND-005",
      "ISDA-2002-MA",
    ],
    source: "platform/event-store/event-types/odp-portfolio-recon.ts",
    v2Status: "v1-only",
  },

  // --------------------------------------------------------------------------
  // Break/dispute lifecycle
  // --------------------------------------------------------------------------

  {
    type: "OdpReconBreakRaised",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpReconBreakRaisedPayloadSchema,
    citationsHint: ["ORG-ODP-COND-007", "urn:regulation:odp:cs-2-2018", "ISDA-EMIR-RECON-2013"],
    source: "platform/event-store/event-types/odp-portfolio-recon.ts",
    v2Status: "v1-only",
  },

  {
    type: "OdpReconDisputeOpened",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Owen", "Vera", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpReconDisputeOpenedPayloadSchema,
    citationsHint: ["ORG-ODP-COND-007", "urn:regulation:odp:cs-2-2018", "ISDA-EMIR-RECON-2013"],
    source: "platform/event-store/event-types/odp-portfolio-recon.ts",
    v2Status: "v1-only",
  },

  {
    type: "OdpReconDisputeResolved",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Helena", "Owen", "Vera", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpReconDisputeResolvedPayloadSchema,
    citationsHint: ["ORG-ODP-COND-007", "urn:regulation:odp:cs-2-2018", "ISDA-EMIR-RECON-2013"],
    source: "platform/event-store/event-types/odp-portfolio-recon.ts",
    v2Status: "v1-only",
  },
];
