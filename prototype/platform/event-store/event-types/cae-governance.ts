// platform/event-store/event-types/cae-governance.ts
//
// CAE quarterly governance run event-payload schemas.
//
// Covers:
//   - AuditPlanUpdated       — quarterly audit plan refresh (IIA standards)
//   - AuditIssueTrackerReviewed — open findings review (D&I tracking)
//   - QaipAttestationFiled   — QAIP conformance attestation (IIA §1300)
//   - ThirdLineOpinionFiled  — CAE independent assurance opinion
//   - GovernanceSeatRunCompleted — shared run-completion event (local stub until
//     the parallel Zara (CCO) delivery lands governance-seat-runs.ts)
//
// Regulatory chain:
//   Banks Act 94/1990 §73 → POL-AUDIT-001 → PROC-AUDIT-QUARTERLY-01
//   → AuditPlanUpdated / AuditIssueTrackerReviewed / QaipAttestationFiled
//   → ThirdLineOpinionFiled → GovernanceSeatRunCompleted
//
// Authority:
//   - D-CAE-QUARTERLY-RUN-G5 (CAE quarterly autonomous run, 2026-05-28)
//   - IIA International Standards for the Professional Practice of Internal
//     Auditing §1300 (QAIP), §2010 (Audit Planning), §2600 (Opinion)
//   - Banks Act 94/1990 §73 (record-keeping obligations)
//   - Companies Act 71/2008 ss.24 + 66 + 71 (board audit oversight)
//
// Author: Thandiwe (Chief Audit Executive, governance)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// GovernanceSeatRunCompleted
//
// Canonical shared type defined in governance-seat-runs.ts (CCO delivery).
// Re-exported here for backward-compat import paths used by cae-periodic-run.ts
// and cae-periodic-run.test.ts.
// ---------------------------------------------------------------------------

export {
  GovernanceSeatRunCompletedPayloadSchema as governanceSeatRunCompletedPayloadSchema,
  type GovernanceSeatRunCompletedPayload,
  makeGovernanceSeatRunCompleted,
} from "./governance-seat-runs";

// ---------------------------------------------------------------------------
// AuditPlanUpdated
//
// Emitted each quarter when Thandiwe (CAE) completes the annual/quarterly
// audit plan refresh. Captures scheduled vs completed audit engagements and
// high-risk area coverage per IIA §2010 requirements.
// ---------------------------------------------------------------------------

export const auditPlanUpdatedPayloadSchema = z.object({
  /** Unique run identifier tying this event to the quarterly run lifecycle. */
  runId: z.string().min(1),
  /** Reporting period in `YYYY-QN` format (e.g. "2026-Q2"). */
  period: z.string().regex(/^\d{4}-Q[1-4]$/, {
    message: "period must be YYYY-QN (e.g. 2026-Q2)",
  }),
  /** Total number of audit engagements scheduled in the plan for this period. */
  auditsScheduled: z.number().int().nonnegative(),
  /** Number of audits completed (may be 0 in early-period updates). */
  auditsCompleted: z.number().int().nonnegative(),
  /** Count of high-risk areas covered by the current audit plan. */
  highRiskAreasCovered: z.number().int().nonnegative(),
  /** Audit plan version reference (e.g. "AUP-2026-Q2"). */
  planVersion: z.string().min(1),
  /** ISO 8601 UTC timestamp when the plan was last updated. */
  updatedAt: z.string().min(1),
});

export type AuditPlanUpdatedPayload = z.infer<typeof auditPlanUpdatedPayloadSchema>;

export function makeAuditPlanUpdated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AuditPlanUpdatedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "AuditPlanUpdated requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AuditPlanUpdated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: auditPlanUpdatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AuditIssueTrackerReviewed
//
// Emitted each quarter when the CAE reviews the open findings register.
// Tracks open, overdue, and critical findings counts and findings closed
// in the reporting quarter. Provides third-line assurance on remediation
// velocity.
// ---------------------------------------------------------------------------

export const auditIssueTrackerReviewedPayloadSchema = z.object({
  /** Unique run identifier tying this event to the quarterly run lifecycle. */
  runId: z.string().min(1),
  /** Reporting period in `YYYY-QN` format (e.g. "2026-Q2"). */
  period: z.string().regex(/^\d{4}-Q[1-4]$/, {
    message: "period must be YYYY-QN (e.g. 2026-Q2)",
  }),
  /** Total number of open findings at the time of review. */
  openFindings: z.number().int().nonnegative(),
  /** Findings that are past their agreed remediation deadline. */
  overdueFindings: z.number().int().nonnegative(),
  /** Critical severity findings (P1 or equivalent). */
  criticalFindings: z.number().int().nonnegative(),
  /** Count of findings formally closed during this reporting quarter. */
  findingsClosedThisQuarter: z.number().int().nonnegative(),
  /** ISO 8601 UTC timestamp when the review was completed. */
  reviewedAt: z.string().min(1),
});

export type AuditIssueTrackerReviewedPayload = z.infer<
  typeof auditIssueTrackerReviewedPayloadSchema
>;

export function makeAuditIssueTrackerReviewed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AuditIssueTrackerReviewedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "AuditIssueTrackerReviewed requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AuditIssueTrackerReviewed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: auditIssueTrackerReviewedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// QaipAttestationFiled
//
// Emitted when the CAE files the Quality Assurance and Improvement Programme
// attestation per IIA §1300. The QAIP attestation confirms whether the
// internal audit activity conforms with the IIA Standards and the Definition
// of Internal Auditing. External assessment is required at least every five
// years (IIA §1312).
// ---------------------------------------------------------------------------

export const qaipAttestationFiledPayloadSchema = z.object({
  /** Unique run identifier tying this event to the quarterly run lifecycle. */
  runId: z.string().min(1),
  /** Reporting period in `YYYY-QN` format (e.g. "2026-Q2"). */
  period: z.string().regex(/^\d{4}-Q[1-4]$/, {
    message: "period must be YYYY-QN (e.g. 2026-Q2)",
  }),
  /** Whether the internal assessment component has been completed this period. */
  internalAssessmentCompleted: z.boolean(),
  /** ISO 8601 date when the next external assessment is due (IIA §1312). */
  externalAssessmentDue: z.string().min(1),
  /**
   * IIA conformance rating for this period.
   *   - "generally-conforms"  — internal audit activity conforms with IIA Standards.
   *   - "partially-conforms"  — notable gaps but substantial compliance.
   *   - "does-not-conform"    — significant departure; material deficiency.
   */
  conformanceRating: z.enum(["generally-conforms", "partially-conforms", "does-not-conform"]),
  /** ISO 8601 UTC timestamp when the attestation was filed. */
  attestedAt: z.string().min(1),
});

export type QaipAttestationFiledPayload = z.infer<typeof qaipAttestationFiledPayloadSchema>;

export function makeQaipAttestationFiled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: QaipAttestationFiledPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "QaipAttestationFiled requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "QaipAttestationFiled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: qaipAttestationFiledPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ThirdLineOpinionFiled
//
// Emitted when the CAE files the annual / period internal audit opinion per
// IIA §2600. The opinion synthesises audit work performed and provides
// governance-level assurance on the control environment, risk management,
// and governance processes.
// ---------------------------------------------------------------------------

export const thirdLineOpinionFiledPayloadSchema = z.object({
  /** Unique run identifier tying this event to the quarterly run lifecycle. */
  runId: z.string().min(1),
  /** Reporting period in `YYYY-QN` format (e.g. "2026-Q2"). */
  period: z.string().regex(/^\d{4}-Q[1-4]$/, {
    message: "period must be YYYY-QN (e.g. 2026-Q2)",
  }),
  /** Narrative description of the opinion's scope (domains / processes covered). */
  opinionScope: z.string().min(1),
  /**
   * Overall assurance level per IIA §2600.
   *   - "reasonable"    — based on audit work, internal controls are adequate.
   *   - "limited"       — scope limitations or exceptions preclude reasonable assurance.
   *   - "no-assurance"  — material deficiencies; unable to provide positive assurance.
   */
  overallAssurance: z.enum(["reasonable", "limited", "no-assurance"]),
  /** Bullet-point key findings supporting the opinion (min 1). */
  keyFindings: z.array(z.string().min(1)).min(1),
  /** ISO 8601 UTC timestamp when the opinion was filed. */
  filedAt: z.string().min(1),
});

export type ThirdLineOpinionFiledPayload = z.infer<typeof thirdLineOpinionFiledPayloadSchema>;

export function makeThirdLineOpinionFiled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ThirdLineOpinionFiledPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "ThirdLineOpinionFiled requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ThirdLineOpinionFiled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: thirdLineOpinionFiledPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event type list (for discovery / recon pipelines)
// ---------------------------------------------------------------------------

export const CAE_GOVERNANCE_TYPED_EVENT_TYPES = [
  "AuditPlanUpdated",
  "AuditIssueTrackerReviewed",
  "QaipAttestationFiled",
  "ThirdLineOpinionFiled",
  "GovernanceSeatRunCompleted",
] as const;
