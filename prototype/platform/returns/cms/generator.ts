// platform/returns/cms/generator.ts
//
// M3 Slice 8 — CMSGenerator: produces a CMSDisclosure for an entity + period.
//
// Design:
//   Input:  entityId + reportingDate (ISO 8601)
//   Queries AlertOpened + ConflictDeclared events from the event store
//   Output: CMSDisclosure (placeholder zeros; status: "rehearsal")
//
// Principle 1 compliance:
//   Complaint counts are derived from events, not from a stored aggregate.
//   Fields backed by not-yet-emitted events carry // TODO: feed from <EventType>
//   comments and default to 0 in the rehearsal status.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10).
//
// Citations:
//   FSRA §131; FSB Treating Customers Fairly 2012;
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md.
//
// Authors: Atlas (Platform Engineer, engineering) +
//   Devon (Chief Operating Officer, governance — TCF oversight).

import type { EventStore } from "../../event-store/store";
import type { CMSDisclosure, ConductComplaint, ConductMetrics, TCFOutcome } from "./types";
import { CMS_REGULATED_ENTITIES } from "./types";

// ---------------------------------------------------------------------------
// Generator input
// ---------------------------------------------------------------------------

export interface CMSGeneratorInput {
  /** Legal entity short-id (e.g. "LE-ZA-HOZ-BANK"). */
  readonly entityId: string;
  /**
   * ISO 8601 — reporting date (convention: `AccountingPeriodClosed.closedAt`).
   * Events with `as_of` <= reportingDate are included in the period scan.
   */
  readonly reportingDate: string;
  /** Event store to query. Typically the same store used by the subscriber. */
  readonly eventStore: EventStore;
  /**
   * Period start ISO 8601. Used to bound the event window.
   * Events with `as_of` in [periodStart, reportingDate] are included.
   */
  readonly periodStart: string;
  /**
   * Period label for the disclosure metrics (e.g. "2026-05", "2026-Q2").
   * Defaults to `reportingDate` if omitted.
   */
  readonly periodLabel?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns all six TCF outcomes initialised to 0. */
function zeroByCF(): Record<TCFOutcome, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
}

/** Clamp a Date.parse result to a finite number; fall back to 0. */
function parseTs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

// ---------------------------------------------------------------------------
// CMSGenerator
// ---------------------------------------------------------------------------

/**
 * Generates a `CMSDisclosure` for the given entity and reporting period.
 *
 * The generator:
 *   1. Guards against non-regulated entities (returns skipped = true).
 *   2. Replays `AlertOpened` events for the entity in the period window.
 *      // TODO: AlertOpened presently has class="audit" / issuer="Mira";
 *      //        connect to ConductComplaint categories when Mira's
 *      //        conduct-alert taxonomy is extended (M3 Slice 9+).
 *   3. Replays `ConflictDeclared` events to count conflict flags.
 *      // TODO: feed from ConflictDeclared event (missing-types registry,
 *      //        source: runtime/agents/metadata/owen.ts).
 *   4. Returns `status: "rehearsal"` when the event store is empty or
 *      the event feeds are not yet connected.
 *
 * Principle 1: all numeric cells derive from event replay, never from
 * stored aggregates. Zero-value cells are placeholders; the TODO comments
 * mark the feed gap (Principle 2 — single-graph discipline, bidirectional
 * traceability to the event types that will eventually back each cell).
 */
export function generateCmsDisclosure(input: CMSGeneratorInput): {
  disclosure: CMSDisclosure;
  skipped: boolean;
  skipReason?: string;
} {
  // Guard: only CMS-regulated entities get a disclosure.
  if (!CMS_REGULATED_ENTITIES.includes(input.entityId)) {
    // Return a minimal rehearsal-grade disclosure so callers always get a
    // typed result; mark skipped so the subscriber can route correctly.
    const skippedDisclosure: CMSDisclosure = {
      entityId: input.entityId,
      reportingDate: input.reportingDate,
      metrics: {
        period: input.periodLabel ?? input.reportingDate,
        entityId: input.entityId,
        totalComplaints: 0,
        resolvedWithin5Days: 0,
        averageResolutionDays: 0,
        escalatedCount: 0,
        tcfOutcomeBreakdown: zeroByCF(),
        bestExecutionBreachCount: 0, // TODO: feed from BestExecutionAnalysisCompleted
        conflictFlagsRaised: 0, // TODO: feed from ConflictDeclared
      },
      complaints: [],
      status: "rehearsal",
    };
    return {
      disclosure: skippedDisclosure,
      skipped: true,
      skipReason: `entity '${input.entityId}' is not in CMS_REGULATED_ENTITIES (${CMS_REGULATED_ENTITIES.join(", ")}); CMS disclosure not generated`,
    };
  }

  const periodStartTs = parseTs(input.periodStart);
  const reportingDateTs = parseTs(input.reportingDate);

  // ---------------------------------------------------------------------------
  // 1. Fold ConflictDeclared events (Owen governance — conflicts of interest).
  // ---------------------------------------------------------------------------

  let conflictFlagsRaised = 0;
  for (const event of input.eventStore.replay({
    type: "ConflictDeclared",
    entity: input.entityId,
  })) {
    const eventTs = parseTs(event.as_of);
    if (eventTs >= periodStartTs && eventTs <= reportingDateTs) {
      conflictFlagsRaised += 1;
    }
  }
  // TODO: ConflictDeclared is currently class="governance"/issuer="Owen"
  //       (missing-types.ts line ~888). When the event payload schema is
  //       formalised, add structured fields for conflict kind / resolution.

  // ---------------------------------------------------------------------------
  // 2. Fold AlertOpened events (Mira AML / compliance alerts).
  //    These proxy conduct alerts until a dedicated ConductComplaintFiled
  //    event type is added (M3 Slice 9+).
  // ---------------------------------------------------------------------------

  const complaints: ConductComplaint[] = [];
  let resolvedWithin5Days = 0;
  let totalResolutionDays = 0;
  let resolvedCount = 0;

  for (const event of input.eventStore.replay({
    type: "AlertOpened",
    entity: input.entityId,
  })) {
    const eventTs = parseTs(event.as_of);
    if (eventTs < periodStartTs || eventTs > reportingDateTs) continue;

    // TODO: AlertOpened payload does not yet carry a counterpartyId or
    //       tcfOutcome field. Default to TCF Outcome 1 (Culture / fair
    //       treatment) and "conduct-alert" category until the payload
    //       schema is extended (M3 Slice 9+).
    const complaint: ConductComplaint = {
      complaintId: event.event_id,
      receivedAt: event.as_of,
      counterpartyId: "TODO: feed from AlertOpened.counterpartyId",
      category: "conduct-alert", // TODO: map from AlertOpened.alertKind
      tcfOutcome: 1, // TODO: map from AlertOpened.tcfOutcome
      status: "open", // TODO: cross-join with AlertDisposed event
    };

    complaints.push(complaint);
  }

  // ---------------------------------------------------------------------------
  // 3. Aggregate complaint metrics.
  // ---------------------------------------------------------------------------

  const tcfOutcomeBreakdown = zeroByCF();
  for (const c of complaints) {
    tcfOutcomeBreakdown[c.tcfOutcome] += 1;
    if (c.status === "resolved" && c.resolutionDays !== undefined) {
      resolvedCount += 1;
      totalResolutionDays += c.resolutionDays;
      if (c.resolutionDays <= 5) resolvedWithin5Days += 1;
    }
  }

  const averageResolutionDays =
    resolvedCount > 0 ? Math.round(totalResolutionDays / resolvedCount) : 0;

  const escalatedCount = complaints.filter((c) => c.status === "escalated").length;

  // ---------------------------------------------------------------------------
  // 4. Determine disclosure status.
  // ---------------------------------------------------------------------------

  // "rehearsal" when no real event feeds are connected:
  //   - AlertOpened.counterpartyId / tcfOutcome not yet populated (M3 S9+).
  //   - BestExecutionAnalysisCompleted event not yet emitted.
  // Status promotion to "compliant" / "breach" deferred to M3 Slice 9+ when
  // real event feeds land and tolerance thresholds are configured.
  //
  // TODO: compute KPI tolerance thresholds from RAS policy (Helena/Devon).
  //       Promote to "compliant" when all KPIs within tolerance;
  //       "breach" otherwise.
  const status = "rehearsal" as const;

  const metrics: ConductMetrics = {
    period: input.periodLabel ?? input.reportingDate,
    entityId: input.entityId,
    totalComplaints: complaints.length,
    resolvedWithin5Days,
    averageResolutionDays,
    escalatedCount,
    tcfOutcomeBreakdown,
    bestExecutionBreachCount: 0, // TODO: feed from BestExecutionAnalysisCompleted (M3 S9+)
    conflictFlagsRaised,
  };

  const disclosure: CMSDisclosure = {
    entityId: input.entityId,
    reportingDate: input.reportingDate,
    metrics,
    complaints,
    status,
  };

  return { disclosure, skipped: false };
}
