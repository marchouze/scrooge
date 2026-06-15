// platform/event-store/registry/sla-approval.ts
//
// SLA rule approval-workflow event-type registry rows (Phase 4c).
//
// Covers the three append-only approval-family events:
//   SlaRulePublished — a rule/version published for review (publisher seat).
//   SlaRuleApproved  — an attested four-eyes approval (approver ≠ publisher).
//   SlaRuleWithheld  — approval declined, with reason.
//
// These are the governance gate that makes an SLA rule/version
// interpreter-eligible (spec §9.3). They are control-plane GOVERNANCE events,
// not accounting postings — but they bear directly on the accounting record
// (which rule was eligible to post), so they carry the 7-year accounting
// retention floor (Companies Act 71 of 2008 s.24 — supporting accounting
// records).
//
// Authority:
//   - D-SLA-ENGINE-RULES-AS-DATA (Phase 4c, CEO-approved 2026-06-06).
//   - D-SLA-APPROVAL-WORKFLOW-SEGREGATION (CoSec Owen — the 5 SoD controls).
//   - D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL (CoSec — CFO+CoSec joint).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import {
  slaRuleApprovedPayloadSchema,
  slaRulePublishedPayloadSchema,
  slaRuleWithheldPayloadSchema,
} from "../event-types/sla-approval";
import { RETENTION_ACCOUNTING_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const CITATIONS_HINT = [
  "D-SLA-ENGINE-RULES-AS-DATA",
  "D-SLA-APPROVAL-WORKFLOW-SEGREGATION",
  "D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL",
  "P1-EVENTS-AS-TRUTH",
  "P6-AUTONOMOUS-BY-DEFAULT",
  "COMPANIES-ACT-71-2008-S24",
];

export const SLA_APPROVAL_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "SlaRulePublished",
    class: "governance",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Owen", "Vera", "dashboard"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: slaRulePublishedPayloadSchema,
    citationsHint: CITATIONS_HINT,
    source: "platform/event-store/event-types/sla-approval.ts",
    status: "active",
    v2Status: "v1-only",
  },
  {
    type: "SlaRuleApproved",
    class: "governance",
    issuer: "Camille",
    subscribers: ["Bea", "Camille", "Owen", "Vera", "dashboard"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: slaRuleApprovedPayloadSchema,
    citationsHint: CITATIONS_HINT,
    source: "platform/event-store/event-types/sla-approval.ts",
    status: "active",
    v2Status: "v1-only",
  },
  {
    type: "SlaRuleWithheld",
    class: "governance",
    issuer: "Camille",
    subscribers: ["Bea", "Camille", "Owen", "Vera", "dashboard"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: slaRuleWithheldPayloadSchema,
    citationsHint: CITATIONS_HINT,
    source: "platform/event-store/event-types/sla-approval.ts",
    status: "active",
    v2Status: "v1-only",
  },
];
