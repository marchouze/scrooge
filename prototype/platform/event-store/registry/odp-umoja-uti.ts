// platform/event-store/registry/odp-umoja-uti.ts
//
// WS-ODP-UMOJA-UTI — event-type registry rows for the ODP Umoja portal API +
// UTI allocation substrate (12 events).
//
// Events registered:
//   TradeUtiAllocated               — UTI (ISO 23602) allocated to a reportable trade
//   OdpTradeReportPrepared          — EMIR-style XML serialised and ready for submission
//   OdpReportSubmissionAttempted    — T+1/16:00 submission sent to Umoja portal
//   OdpReportSubmissionAccepted     — Umoja portal returned accepted acknowledgement
//   OdpReportSubmissionRejected     — Umoja portal returned rejection + error codes
//   OdpReportAmendmentRequested     — Counterparty/regulator requests a correction
//   OdpReportAmendmentSubmitted     — Correction submitted to Umoja
//   OdpRepoReconRun                 — Submitted-vs-repository view reconciliation run
//   OdpRepoReconBreakRaised         — Individual trade mismatch between submission and repo
//   OdpRepoReconDisputeOpened       — Formal dispute opened on a repo-recon break
//   OdpRepoReconDisputeResolved     — Dispute resolved or escalated to CCO
//   UmojaPortalTokenRefreshed       — OAuth2 client-credentials token refreshed
//
// Authority:
//   ORG-ODP-RPT-003 (ODP trade reporting obligation — portfolio / UTI)
//   ORG-MK-RPT-002  (Market conduct trade reporting obligation)
//   urn:regulation:odp:cs-3-2018 §§ 4–6 (trade reporting + T+1 deadline + repo recon)
//   urn:regulation:odp:jn-2-2024 §§ 3–5 (UTI allocation rules)
//   ISO 23602:2020 (Unique Trade Identifier standard)
//   Principle 1 (events-are-truth)
//   Principle 5 (multi-currency)
//
// Retention:
//   Trade UTI + report events → RETENTION_ACCOUNTING_7Y
//   (CS 3/2018 §12 audit trail obligation; mirrors derivative reporting records.)
//   Repo-recon break/dispute events → RETENTION_ACCOUNTING_7Y
//   (Dispute records form part of the ODP reconciliation audit trail.)
//   OAuth token refresh → RETENTION_RUNTIME_1Y
//   (Operational security-substrate event; no regulatory retention obligation.)
//
// Author: Devon (COO, operations)

import {
  odpRepoReconBreakRaisedPayloadSchema,
  odpRepoReconDisputeOpenedPayloadSchema,
  odpRepoReconDisputeResolvedPayloadSchema,
  odpRepoReconRunPayloadSchema,
  odpReportAmendmentRequestedPayloadSchema,
  odpReportAmendmentSubmittedPayloadSchema,
  odpReportSubmissionAcceptedPayloadSchema,
  odpReportSubmissionAttemptedPayloadSchema,
  odpReportSubmissionRejectedPayloadSchema,
  odpTradeReportPreparedPayloadSchema,
  tradeUtiAllocatedPayloadSchema,
  umojaPortalTokenRefreshedPayloadSchema,
} from "../event-types/odp-umoja-uti";
import { RETENTION_ACCOUNTING_7Y, RETENTION_RUNTIME_1Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * ODP Umoja UTI substrate event-type registry rows.
 *
 * Primary consumers:
 *   Devon (COO, operations) — ODP reporting process ownership.
 *   Zara (Chief Compliance Officer, governance) — CCO escalation target + ODP obligation owner.
 *   Owen (Company Secretary, governance) — compliance register + procedure records.
 *   Vera (Internal audit engineer) — repo-recon dispute-staleness recon gate.
 *   Atlas (Core banking platform architect, engineering) — substrate.
 *   Mira (Compliance / RegTech engineer, engineering) — Umoja portal XSD + error-code catalogue.
 */
export const ODP_UMOJA_UTI_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  // --------------------------------------------------------------------------
  // UTI allocation
  // --------------------------------------------------------------------------
  {
    type: "TradeUtiAllocated",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Zara", "Owen", "Vera", "Atlas", "Mira"],
    replay: "idempotent-terminal",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: tradeUtiAllocatedPayloadSchema,
    citationsHint: ["ORG-ODP-RPT-003", "urn:regulation:odp:jn-2-2024", "ISO-23602-2020"],
    source: "platform/event-store/event-types/odp-umoja-uti.ts",
    v2Status: "v1-only",
  },

  // --------------------------------------------------------------------------
  // Trade-report serialisation
  // --------------------------------------------------------------------------
  {
    type: "OdpTradeReportPrepared",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Zara", "Owen", "Vera", "Atlas", "Mira"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpTradeReportPreparedPayloadSchema,
    citationsHint: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
    source: "platform/event-store/event-types/odp-umoja-uti.ts",
    v2Status: "v1-only",
  },

  // --------------------------------------------------------------------------
  // Submission lifecycle
  // --------------------------------------------------------------------------
  {
    type: "OdpReportSubmissionAttempted",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Zara", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpReportSubmissionAttemptedPayloadSchema,
    citationsHint: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
    source: "platform/event-store/event-types/odp-umoja-uti.ts",
    v2Status: "v1-only",
  },

  {
    type: "OdpReportSubmissionAccepted",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Zara", "Owen", "Vera", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpReportSubmissionAcceptedPayloadSchema,
    citationsHint: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
    source: "platform/event-store/event-types/odp-umoja-uti.ts",
    v2Status: "v1-only",
  },

  {
    type: "OdpReportSubmissionRejected",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Zara", "Owen", "Vera", "Atlas", "Mira"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpReportSubmissionRejectedPayloadSchema,
    citationsHint: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
    source: "platform/event-store/event-types/odp-umoja-uti.ts",
    v2Status: "v1-only",
  },

  {
    type: "OdpReportAmendmentRequested",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Zara", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpReportAmendmentRequestedPayloadSchema,
    citationsHint: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
    source: "platform/event-store/event-types/odp-umoja-uti.ts",
    v2Status: "v1-only",
  },

  {
    type: "OdpReportAmendmentSubmitted",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Zara", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpReportAmendmentSubmittedPayloadSchema,
    citationsHint: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
    source: "platform/event-store/event-types/odp-umoja-uti.ts",
    v2Status: "v1-only",
  },

  // --------------------------------------------------------------------------
  // Trade-repository reconciliation
  // --------------------------------------------------------------------------
  {
    type: "OdpRepoReconRun",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Zara", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpRepoReconRunPayloadSchema,
    citationsHint: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
    source: "platform/event-store/event-types/odp-umoja-uti.ts",
    v2Status: "v1-only",
  },

  {
    type: "OdpRepoReconBreakRaised",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Zara", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpRepoReconBreakRaisedPayloadSchema,
    citationsHint: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
    source: "platform/event-store/event-types/odp-umoja-uti.ts",
    v2Status: "v1-only",
  },

  {
    type: "OdpRepoReconDisputeOpened",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Zara", "Owen", "Vera", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpRepoReconDisputeOpenedPayloadSchema,
    citationsHint: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
    source: "platform/event-store/event-types/odp-umoja-uti.ts",
    v2Status: "v1-only",
  },

  {
    type: "OdpRepoReconDisputeResolved",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Zara", "Owen", "Vera", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: odpRepoReconDisputeResolvedPayloadSchema,
    citationsHint: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
    source: "platform/event-store/event-types/odp-umoja-uti.ts",
    v2Status: "v1-only",
  },

  // --------------------------------------------------------------------------
  // Umoja portal OAuth token lifecycle
  // --------------------------------------------------------------------------
  {
    type: "UmojaPortalTokenRefreshed",
    class: "governance",
    issuer: "Devon",
    subscribers: ["Devon", "Atlas", "Vera"],
    replay: "latest-wins-per-key",
    retention: RETENTION_RUNTIME_1Y,
    payloadSchema: umojaPortalTokenRefreshedPayloadSchema,
    citationsHint: ["ORG-ODP-RPT-003"],
    source: "platform/event-store/event-types/odp-umoja-uti.ts",
    v2Status: "v1-only",
  },
];
