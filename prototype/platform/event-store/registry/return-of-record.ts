// platform/event-store/registry/return-of-record.ts
//
// EventTypeMetadata rows for the BORN-V2 BA-return-of-record + filing-lifecycle
// event family. The payload schemas are sourced via the V1-side adapter
// (`../event-types/return-of-record`), which itself re-exports the canonical
// v2-core schemas (one grammar source; the permitted v1→v2 direction).
//
// THREE-SITE REGISTRATION (recurring gotcha — F-032):
//   1. event-types  → ../event-types/return-of-record.ts (schema re-exports + factories)
//   2. registry     → THIS file (EventTypeMetadata rows; wired into registry/index.ts)
//   3. provenance   → ../provenance-category.ts (each type → "accounting")
//
// Born V2 (D-V1-REMOVAL-PHASE-1): every row is `v2Status: "v2-replaced"` — the
// V2 path is authoritative and there is no V1 ancestor (the family never emits a
// `v1-only` type and never imports a V1 module). "v2-replaced" is the registry's
// term for "V2 is the sole authority".
//
// Registry `class` taxonomy is "runtime" | "markets" | "governance" | "audit".
// Regulatory returns are accounting / capital-adequacy basis records — the
// existing capital-adequacy basis event (RwaComputed) is registered `class:
// "governance"`; the return-of-record family is the BA-return submission audit
// trail, so it mirrors `SarbSubmissionAttempted` (`class: "governance"`).
//
// Retention: regulatory submissions carry the 7-year SARB inspection floor
// (Banks Act §73/§91 — record-keeping; mirrors SarbSubmissionAttempted /
// RwaComputed), so every row is `RETENTION_ACCOUNTING_7Y`.
//
// Replay: `append-only-audit` — each return-of-record / filing-lifecycle event
// is an immutable audit-trail fact, never overwritten; the Finance returns
// projection folds the latest per (entity, formId, reportingPeriod).
//
// Authority: D-BA-RETURN-OF-RECORD-EVENT-FAMILY; D-BA-RETURN-DATA-CONTRACT;
//   D-RMS-PHASE-1; D-V1-REMOVAL-PHASE-1; Banks Act 94/1990 §70 + §73;
//   Regulations Relating to Banks Reg 38 + Reg 26.
// Author: Bea (Accounting & financial reporting engineer, engineering — reports
//   to Camille (Chief Financial Officer)).

import {
  REPORT_DUE,
  REPORT_FILED,
  REPORT_GENERATED,
  REPORT_SUBMISSION_ACKNOWLEDGED,
  reportDuePayloadSchema,
  reportFiledPayloadSchema,
  reportGeneratedPayloadSchema,
  reportSubmissionAcknowledgedPayloadSchema,
} from "../event-types/return-of-record";
import { RETENTION_ACCOUNTING_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const SOURCE = "platform/event-store/event-types/return-of-record.ts";

const CITATIONS_HINT = [
  "D-BA-RETURN-OF-RECORD-EVENT-FAMILY",
  "D-BA-RETURN-DATA-CONTRACT",
  "D-RMS-PHASE-1",
  "Banks Act 94 of 1990 §70",
  "Banks Act 94 of 1990 §73",
  "Regulations Relating to Banks Reg 38",
];

/**
 * Born-V2 BA-return-of-record + filing-lifecycle event-type registry rows.
 *
 * Subscribers (seats that read the family):
 *   Bea (Accounting/reporting engineer) — issues + folds the return-of-record.
 *   Camille (CFO) — capital-adequacy accountable signer.
 *   Mira (CCO / RegTech) — filing-lifecycle / submission compliance.
 *   Vera (internal audit) — third-line audit trail.
 *   dashboard — the V2 Finance regulatory-returns register.
 */
export const RETURN_OF_RECORD_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: REPORT_GENERATED,
    class: "governance",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: reportGeneratedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS_HINT,
    v2Status: "v2-replaced",
  },
  {
    type: REPORT_DUE,
    class: "governance",
    issuer: "Bea",
    subscribers: ["Bea", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: reportDuePayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS_HINT,
    v2Status: "v2-replaced",
  },
  {
    type: REPORT_FILED,
    class: "governance",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: reportFiledPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS_HINT,
    v2Status: "v2-replaced",
  },
  {
    type: REPORT_SUBMISSION_ACKNOWLEDGED,
    class: "governance",
    issuer: "Mira",
    subscribers: ["Bea", "Camille", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: reportSubmissionAcknowledgedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS_HINT,
    v2Status: "v2-replaced",
  },
];
