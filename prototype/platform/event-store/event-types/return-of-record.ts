// platform/event-store/event-types/return-of-record.ts
//
// V1-SIDE adapter for the BORN-V2 BA-return-of-record + filing-lifecycle event
// family. Lives on the V1 side and IMPORTS the canonical payload schemas FROM
// v2-core — the permitted dependency direction (v1→v2; v2-core never reaches
// back, enforced by `recon:v2-no-v1-import`). Provides the event factories the
// runtime period-close handler uses, and re-exports the v2-core schemas so the
// registry references them via this single adapter (one grammar source).
//
// THREE-SITE REGISTRATION (recurring gotcha — F-032):
//   1. event-types  → this file (schema re-exports + make* factories + kind list)
//   2. registry     → registry/return-of-record.ts (EventTypeMetadata rows)
//   3. provenance   → provenance-category.ts (each kind → category)
//
// Born V2 (D-V1-REMOVAL-PHASE-1) — every registry row is `v2Status:
// "v2-replaced"`; the family never emits a `v1-only` type and never imports a
// V1 module.
//
// Authority: D-BA-RETURN-OF-RECORD-EVENT-FAMILY; D-BA-RETURN-DATA-CONTRACT;
//   D-RMS-PHASE-1; D-V1-REMOVAL-PHASE-1.
// Author: Bea (Accounting & financial reporting engineer, engineering — reports
//   to Camille (Chief Financial Officer)).

import {
  REPORT_DUE,
  REPORT_FILED,
  REPORT_GENERATED,
  REPORT_SUBMISSION_ACKNOWLEDGED,
  type ReportDuePayload,
  type ReportDuePayloadInput,
  type ReportFiledPayload,
  type ReportFiledPayloadInput,
  type ReportGeneratedPayload,
  type ReportGeneratedPayloadInput,
  type ReportSubmissionAcknowledgedPayload,
  type ReportSubmissionAcknowledgedPayloadInput,
  reportDuePayloadSchema,
  reportFiledPayloadSchema,
  reportGeneratedPayloadSchema,
  reportSubmissionAcknowledgedPayloadSchema,
} from "../../../v2-core/regulatory-returns/return-of-record-events";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// Re-export the v2-core schemas so the v1 registry references them via this
// adapter module (a single grammar source).
export {
  REPORT_DUE,
  REPORT_FILED,
  REPORT_GENERATED,
  REPORT_SUBMISSION_ACKNOWLEDGED,
  reportDuePayloadSchema,
  reportFiledPayloadSchema,
  reportGeneratedPayloadSchema,
  reportSubmissionAcknowledgedPayloadSchema,
};
export type {
  ReportDuePayload,
  ReportDuePayloadInput,
  ReportFiledPayload,
  ReportFiledPayloadInput,
  ReportGeneratedPayload,
  ReportGeneratedPayloadInput,
  ReportSubmissionAcknowledgedPayload,
  ReportSubmissionAcknowledgedPayloadInput,
};

// ---------------------------------------------------------------------------
// Generic factory
// ---------------------------------------------------------------------------

function makeReturnOfRecordEvent(args: {
  type: string;
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: Record<string, unknown>;
  eventId?: string;
  provenance?: Event["provenance"];
  aggregateLabel?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      `${args.type} requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.`,
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: args.type,
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: args.payload,
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
    ...(args.aggregateLabel !== undefined ? { aggregateLabel: args.aggregateLabel } : {}),
  });
}

interface MakeArgs<P> {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: P;
  eventId?: string;
  provenance?: Event["provenance"];
  aggregateLabel?: string;
}

/** ReportGenerated — the return-of-record (figures + content hash). */
export function makeReportGenerated(args: MakeArgs<ReportGeneratedPayloadInput>): Event {
  return makeReturnOfRecordEvent({
    ...args,
    type: REPORT_GENERATED,
    payload: reportGeneratedPayloadSchema.parse(args.payload) as unknown as Record<string, unknown>,
  });
}

/** ReportDue — a return becomes due for a period (reporting-calendar fact). */
export function makeReportDue(args: MakeArgs<ReportDuePayloadInput>): Event {
  return makeReturnOfRecordEvent({
    ...args,
    type: REPORT_DUE,
    payload: reportDuePayloadSchema.parse(args.payload) as unknown as Record<string, unknown>,
  });
}

/** ReportFiled — the return was filed with the regulator. */
export function makeReportFiled(args: MakeArgs<ReportFiledPayloadInput>): Event {
  return makeReturnOfRecordEvent({
    ...args,
    type: REPORT_FILED,
    payload: reportFiledPayloadSchema.parse(args.payload) as unknown as Record<string, unknown>,
  });
}

/** ReportSubmissionAcknowledged — the regulator acknowledged the filing. */
export function makeReportSubmissionAcknowledged(
  args: MakeArgs<ReportSubmissionAcknowledgedPayloadInput>,
): Event {
  return makeReturnOfRecordEvent({
    ...args,
    type: REPORT_SUBMISSION_ACKNOWLEDGED,
    payload: reportSubmissionAcknowledgedPayloadSchema.parse(args.payload) as unknown as Record<
      string,
      unknown
    >,
  });
}

/** All four type literals (used by the registry kind list + tests). */
export const RETURN_OF_RECORD_TYPED_EVENT_TYPES = [
  REPORT_GENERATED,
  REPORT_DUE,
  REPORT_FILED,
  REPORT_SUBMISSION_ACKNOWLEDGED,
] as const;
