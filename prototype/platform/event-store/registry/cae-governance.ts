// platform/event-store/registry/cae-governance.ts
//
// Event-type registry rows for CAE quarterly governance run events.
//
// Covers:
//   - AuditPlanUpdated          — quarterly audit plan refresh
//   - AuditIssueTrackerReviewed — open findings review
//   - QaipAttestationFiled      — QAIP conformance attestation (IIA §1300)
//   - ThirdLineOpinionFiled     — CAE independent assurance opinion
//   - GovernanceSeatRunCompleted — shared governance-seat run completion
//
// Authority:
//   - D-CAE-QUARTERLY-RUN-G5 (CAE quarterly autonomous run, 2026-05-28)
//   - IIA Standards §1300 (QAIP), §2010 (Audit Planning), §2600 (Opinion)
//   - Banks Act 94/1990 §73 (record-keeping obligations)
//   - Companies Act 71/2008 ss.24 + 66 + 71 (board audit oversight)
//   - BCBS 239 Principles I, III, IX, XIV (audit trail expectations)
//
// Author: Thandiwe (Chief Audit Executive, governance)

import {
  auditIssueTrackerReviewedPayloadSchema,
  auditPlanUpdatedPayloadSchema,
  qaipAttestationFiledPayloadSchema,
  thirdLineOpinionFiledPayloadSchema,
} from "../event-types/cae-governance";
import { type EventTypeMetadata, RETENTION_GOVERNANCE_7Y } from "./types";

export const CAE_GOVERNANCE_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    // AuditPlanUpdated — quarterly audit plan refresh.
    // Emitted by the CAE quarterly run script when the annual audit plan
    // has been reviewed and updated. Tracks scheduled vs completed audits
    // and high-risk area coverage per IIA §2010.
    //
    // Idempotency: one event per (runId, period) — the quarterly run checks
    // for an existing AuditPlanUpdated before emitting.
    type: "AuditPlanUpdated",
    class: "governance",
    payloadSchema: auditPlanUpdatedPayloadSchema,
    issuer: "Thandiwe",
    subscribers: ["Owen", "Vera", "Atlas", "dashboard", "audit"],
    replay: "append-only-audit",
    citationsHint: ["D-CAE-QUARTERLY-RUN-G5", "IIA-STANDARDS-2010", "Banks Act 94/1990 §73"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "scripts/governance/cae-periodic-run.ts (quarterly batch runner)",
  },
  {
    // AuditIssueTrackerReviewed — open findings review.
    // Emitted each quarter when the CAE reviews the findings tracker.
    // Captures open, overdue, and critical finding counts plus remediation
    // velocity (findings closed this quarter).
    //
    // Idempotency: one event per (runId, period) — the quarterly run checks
    // for an existing AuditIssueTrackerReviewed before emitting.
    type: "AuditIssueTrackerReviewed",
    class: "governance",
    payloadSchema: auditIssueTrackerReviewedPayloadSchema,
    issuer: "Thandiwe",
    subscribers: ["Owen", "Helena", "Vera", "Atlas", "dashboard", "audit"],
    replay: "append-only-audit",
    citationsHint: ["D-CAE-QUARTERLY-RUN-G5", "IIA-STANDARDS-2010", "Banks Act 94/1990 §73"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "scripts/governance/cae-periodic-run.ts (quarterly batch runner)",
  },
  {
    // QaipAttestationFiled — QAIP conformance attestation (IIA §1300).
    // Emitted when the CAE files the annual QAIP attestation confirming
    // conformance with IIA Standards. The conformanceRating drives board
    // audit committee reporting and regulator disclosures.
    //
    // Idempotency: one event per (runId, period).
    type: "QaipAttestationFiled",
    class: "governance",
    payloadSchema: qaipAttestationFiledPayloadSchema,
    issuer: "Thandiwe",
    subscribers: ["Owen", "Vera", "Atlas", "dashboard", "audit"],
    replay: "append-only-audit",
    citationsHint: [
      "D-CAE-QUARTERLY-RUN-G5",
      "IIA-STANDARDS-1300",
      "IIA-STANDARDS-1312",
      "Banks Act 94/1990 §73",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "scripts/governance/cae-periodic-run.ts (quarterly batch runner)",
  },
  {
    // ThirdLineOpinionFiled — CAE independent assurance opinion (IIA §2600).
    // Emitted when the CAE files the overall internal audit opinion covering
    // the control environment, risk management, and governance processes.
    // Drives the Audit Committee / Interim Audit Forum agenda (Owen chair).
    //
    // Idempotency: one event per (runId, period).
    type: "ThirdLineOpinionFiled",
    class: "governance",
    payloadSchema: thirdLineOpinionFiledPayloadSchema,
    issuer: "Thandiwe",
    subscribers: ["Owen", "Helena", "Vera", "Atlas", "dashboard", "audit"],
    replay: "append-only-audit",
    citationsHint: [
      "D-CAE-QUARTERLY-RUN-G5",
      "IIA-STANDARDS-2600",
      "Banks Act 94/1990 §73",
      "BCBS-239-PRINCIPLE-XIV",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "scripts/governance/cae-periodic-run.ts (quarterly batch runner)",
  },
];
