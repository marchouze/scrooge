// platform/event-store/registry/governance-seat-runs.ts
//
// WAVE 2 BATCH-2 FLIP (2026-06-16): every type in this registry flipped
// v1-only -> v2-replaced. Money-free governance-attestation / KYC / lifecycle
// reference data, tee-mirrored verbatim into the v2 control-plane store;
// recon:governance-attestation-v2-parity proves the V1-store <-> v2-store
// event-list register byte-clean (ENFORCING; 571 events at the flip). Basis:
// ordinary dual-write + parity. Authority: D-BANK-WIDE-V2-MIGRATION;
// D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16). Flip by Atlas (Core
// banking platform architect, engineering).
//
// Event-type registry rows for governance-seat periodic run events.
//
// Covers all five event types from event-types/governance-seat-runs.ts:
//   - GovernanceSeatRunCompleted — quarterly run completion record
//   - GovernanceAttestationFiled — RMCP / FIC periodic attestation
//   - SuspiciousActivityQueueReviewed — STR/CTR queue review (CCO)
//   - AmlRiskAssessmentCompleted — AML risk assessment cycle close (CCO)
//   - EddQueueReviewed — EDD queue sign-off (CCO)
//
// Authority:
//   - FIC Act 38/2001 (AML/CFT obligations)
//   - Banks Act 94/1990 §60A (MLRO responsibilities)
//   - POL-AML-001 v1 (AML/CFT Policy)
//   - RMCP v1 (Risk Management and Compliance Programme)
//   - D-CCO-GOVERNANCE-SEAT-G5 (pre-licence gate G5; CEO-approved)
//
// Authors: Zara (Chief Compliance Officer, governance)
//          + Atlas (Core banking platform architect, engineering)

import {
  AmlRiskAssessmentCompletedPayloadSchema,
  EddQueueReviewedPayloadSchema,
  GovernanceAttestationFiledPayloadSchema,
  GovernanceSeatRunCompletedPayloadSchema,
  SuspiciousActivityQueueReviewedPayloadSchema,
} from "../event-types/governance-seat-runs";
import { type EventTypeMetadata, RETENTION_FIC_5Y, RETENTION_GOVERNANCE_7Y } from "./types";

export const GOVERNANCE_SEAT_RUNS_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    // Terminal completion marker for a governance-seat quarterly run.
    // Idempotency anchor: the run script skips re-emission if this event
    // already exists for (seatId, period). Retained 7 years per governance
    // audit-trail requirements (Companies Act ss.24 + 66; BCBS 239 Principle IX).
    type: "GovernanceSeatRunCompleted",
    class: "governance",
    payloadSchema: GovernanceSeatRunCompletedPayloadSchema,
    issuer: "Zara",
    subscribers: ["Zara", "Vera", "Owen", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["FIC Act 38/2001 §42", "POL-AML-001", "RMCP §4", "D-CCO-GOVERNANCE-SEAT-G5"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "scripts/governance/cco-periodic-run.ts (CCO quarterly run); future CISO and CAE analogues",
    v2Status: "v2-replaced",
  },
  {
    // RMCP quarterly attestation filed by the CCO under FIC Act §42.
    // 7-year governance retention — director-level sign-off record.
    type: "GovernanceAttestationFiled",
    class: "governance",
    payloadSchema: GovernanceAttestationFiledPayloadSchema,
    issuer: "Zara",
    subscribers: ["Zara", "Owen", "Vera", "Thandiwe", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "FIC Act 38/2001 §42",
      "RMCP §4",
      "POL-AML-001 §6.1",
      "D-CCO-GOVERNANCE-SEAT-G5",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "scripts/governance/cco-periodic-run.ts",
    v2Status: "v2-replaced",
  },
  {
    // STR / CTR queue review emitted by the CCO (or MLRO delegate).
    // 5-year FIC Act retention floor — FIC Act §22 record-keeping.
    // STR/CTR filings are regulatory-reportable; retain aligned with
    // the underlying report obligation (FIC Act §29 + §28A).
    type: "SuspiciousActivityQueueReviewed",
    class: "governance",
    payloadSchema: SuspiciousActivityQueueReviewedPayloadSchema,
    issuer: "Zara",
    subscribers: ["Zara", "Vera", "Thandiwe", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "FIC Act 38/2001 §29",
      "FIC Act 38/2001 §28A",
      "PROC-CCO-STR-01",
      "POL-AML-001 §7",
      "D-CCO-GOVERNANCE-SEAT-G5",
    ],
    retention: RETENTION_FIC_5Y,
    source: "scripts/governance/cco-periodic-run.ts",
    v2Status: "v2-replaced",
  },
  {
    // AML/CFT risk assessment cycle close. 7-year retention per governance
    // audit-trail requirements; the assessment drives the RMCP risk profile.
    type: "AmlRiskAssessmentCompleted",
    class: "governance",
    payloadSchema: AmlRiskAssessmentCompletedPayloadSchema,
    issuer: "Zara",
    subscribers: ["Zara", "Owen", "Vera", "Thandiwe", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "FIC Act 38/2001 §21B",
      "POL-AML-001 §4",
      "PROC-CCO-AML-ASSESS-01",
      "D-CCO-GOVERNANCE-SEAT-G5",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "scripts/governance/cco-periodic-run.ts",
    v2Status: "v2-replaced",
  },
  {
    // EDD queue sign-off by CCO. FIC Act 5-year minimum; mandatory for
    // high-risk customer reviews per FIC Act §21G (HRNPO / PEP / DNFBP).
    type: "EddQueueReviewed",
    class: "governance",
    payloadSchema: EddQueueReviewedPayloadSchema,
    issuer: "Zara",
    subscribers: ["Zara", "Vera", "Thandiwe", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "FIC Act 38/2001 §21G",
      "POL-AML-001 §5.3",
      "PROC-CCO-EDD-01",
      "D-CCO-GOVERNANCE-SEAT-G5",
    ],
    retention: RETENTION_FIC_5Y,
    source: "scripts/governance/cco-periodic-run.ts",
    v2Status: "v2-replaced",
  },
];
