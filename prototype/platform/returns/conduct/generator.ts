// platform/returns/conduct/generator.ts
//
// M3 Slice 9 — ConductGenerator: produces a ConductPeriodDisclosure for an
// entity + period by replaying typed conduct events.
//
// Event feeds (all now typed, unlike CMS Slice 8 placeholders):
//   - ConductComplaintFiled     — complaint received; maps to ConductComplaintRecord
//   - ConductComplaintResolved  — pairs with Filed to update status/resolution
//   - ConductIncidentLogged     — internal conduct incident
//   - BestExecutionAnalysisCompleted — best-execution periodic review
//
// Principle 1 compliance:
//   All cells are derived from event replay. No stored aggregates are read.
//
// Standing authority: D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
//   (CEO-approved 2026-05-10).
//
// Citations:
//   FSRA §131; FSB TCF 2012; FAIS Act 37/2002 §§16–17;
//   D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md; Principles/2-single-graph-discipline.md.
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Mira (Compliance / RegTech engineer, engineering).

import type { EventStore } from "../../event-store/store";
import type {
  BestExecutionSummary,
  ConductComplaintRecord,
  ConductIncidentRecord,
  ConductPeriodDisclosure,
  ConductPeriodMetrics,
  TCFOutcome,
} from "./types";
import { CONDUCT_REGULATED_ENTITIES } from "./types";

// ---------------------------------------------------------------------------
// Generator input
// ---------------------------------------------------------------------------

export interface ConductGeneratorInput {
  /** Legal entity short-id (e.g. "LE-ZA-HOZ-BANK"). */
  readonly entityId: string;
  /**
   * ISO 8601 — reporting date (convention: `AccountingPeriodClosed.closedAt`).
   * Events with `as_of` <= reportingDate are included.
   */
  readonly reportingDate: string;
  /** Event store to query. */
  readonly eventStore: EventStore;
  /**
   * Period start ISO 8601. Events in [periodStart, reportingDate] are included.
   */
  readonly periodStart: string;
  /**
   * Period label (e.g. "2026-05", "2026-Q2").
   * Defaults to `reportingDate` if omitted.
   */
  readonly periodLabel?: string;
  /**
   * Upper bound (inclusive) on the event `sequence` column.
   * Sourced from `AccountingPeriodClosed.eventSequence` (frozen cursor).
   * When supplied, all event-store replays in this generator are bounded
   * to prevent divergence from concurrent appends.
   * Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
   */
  readonly untilSequence?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns all six TCF outcomes initialised to 0. */
function zeroTCFBreakdown(): Record<TCFOutcome, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
}

/** Clamp Date.parse to a finite number; fall back to 0. */
function parseTs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** Guard that a number is in the TCFOutcome range [1..6]. */
function toTCFOutcome(n: unknown): TCFOutcome {
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5 || n === 6) return n;
  return 1; // default to Culture outcome when unknown/unset
}

// ---------------------------------------------------------------------------
// ConductGenerator
// ---------------------------------------------------------------------------

/**
 * Generates a `ConductPeriodDisclosure` for the given entity and period.
 *
 * Steps:
 *   1. Guard: non-regulated entities return `skipped = true`.
 *   2. Replay `ConductComplaintFiled` events; build `ConductComplaintRecord[]`.
 *   3. Replay `ConductComplaintResolved` events; update resolution state on
 *      matched filed records.
 *   4. Replay `ConductIncidentLogged` events; build `ConductIncidentRecord[]`.
 *   5. Replay `BestExecutionAnalysisCompleted` events; compute summary.
 *   6. Aggregate metrics; determine disclosure status.
 *
 * Principle 1: all metric cells derive from event replay.
 */
export function generateConductDisclosure(input: ConductGeneratorInput): {
  disclosure: ConductPeriodDisclosure;
  skipped: boolean;
  skipReason?: string;
} {
  const periodLabel = input.periodLabel ?? input.reportingDate;
  const periodStartTs = parseTs(input.periodStart);
  const reportingDateTs = parseTs(input.reportingDate);

  // Frozen-cursor replay opts: when the triggering AccountingPeriodClosed event
  // carries an eventSequence, all event-store replays in this generator are
  // bounded to that sequence to prevent divergence from concurrent appends.
  // Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
  const frozenCursorOpts =
    input.untilSequence !== undefined ? { untilSequence: input.untilSequence } : {};

  // Guard: only regulated entities generate conduct disclosures.
  if (!CONDUCT_REGULATED_ENTITIES.includes(input.entityId)) {
    const skippedDisclosure: ConductPeriodDisclosure = {
      entityId: input.entityId,
      reportingDate: input.reportingDate,
      metrics: {
        period: periodLabel,
        entityId: input.entityId,
        totalComplaints: 0,
        resolvedComplaints: 0,
        resolvedWithin5Days: 0,
        averageResolutionDays: 0,
        escalatedCount: 0,
        tcfOutcomeBreakdown: zeroTCFBreakdown(),
        totalIncidents: 0,
        highSeverityIncidents: 0,
        regulatoryNotificationsCount: 0,
        bestExecution: {
          analysisCount: 0,
          tradesReviewed: 0,
          breachCount: 0,
          aggregateBreachRatePct: 0,
          verdict: "not-applicable",
          assetClassesCovered: [],
          venuesCovered: [],
        },
      },
      complaints: [],
      incidents: [],
      status: "rehearsal",
    };
    return {
      disclosure: skippedDisclosure,
      skipped: true,
      skipReason: `entity '${input.entityId}' is not in CONDUCT_REGULATED_ENTITIES (${CONDUCT_REGULATED_ENTITIES.join(", ")}); conduct disclosure not generated`,
    };
  }

  // ---------------------------------------------------------------------------
  // 1. Replay ConductComplaintFiled events.
  // ---------------------------------------------------------------------------

  const complaintMap = new Map<string, ConductComplaintRecord>();

  for (const event of input.eventStore.replay({
    type: "ConductComplaintFiled",
    entity: input.entityId,
    ...frozenCursorOpts,
  })) {
    const eventTs = parseTs(event.as_of);
    if (eventTs < periodStartTs || eventTs > reportingDateTs) continue;

    const p = event.payload as {
      complaintId?: unknown;
      receivedAt?: unknown;
      counterpartyId?: unknown;
      category?: unknown;
      tcfOutcome?: unknown;
    };
    const complaintId = String(p.complaintId ?? event.event_id);

    const record: ConductComplaintRecord = {
      complaintId,
      receivedAt: String(p.receivedAt ?? event.as_of),
      counterpartyId: String(p.counterpartyId ?? "unknown"),
      category: String(p.category ?? "unclassified"),
      tcfOutcome: toTCFOutcome(p.tcfOutcome),
      status: "open",
    };
    complaintMap.set(complaintId, record);
  }

  // ---------------------------------------------------------------------------
  // 2. Replay ConductComplaintResolved events; update matched records.
  // ---------------------------------------------------------------------------

  for (const event of input.eventStore.replay({
    type: "ConductComplaintResolved",
    entity: input.entityId,
    ...frozenCursorOpts,
  })) {
    const eventTs = parseTs(event.as_of);
    if (eventTs < periodStartTs || eventTs > reportingDateTs) continue;

    const p = event.payload as {
      complaintId?: unknown;
      resolvedAt?: unknown;
      resolutionDays?: unknown;
      escalated?: unknown;
      tcfOutcome?: unknown;
    };
    const complaintId = String(p.complaintId ?? "");
    const existing = complaintMap.get(complaintId);
    if (!existing) continue; // ConductComplaintFiled may be from a prior period

    const resolutionDays = typeof p.resolutionDays === "number" ? p.resolutionDays : undefined;
    const escalated = typeof p.escalated === "boolean" ? p.escalated : false;

    const updated: ConductComplaintRecord = {
      ...existing,
      status: escalated ? "escalated" : "resolved",
      resolvedAt: String(p.resolvedAt ?? event.as_of),
      ...(resolutionDays !== undefined ? { resolutionDays } : {}),
      escalated,
      tcfOutcome: toTCFOutcome(p.tcfOutcome ?? existing.tcfOutcome),
    };
    complaintMap.set(complaintId, updated);
  }

  const complaints: ConductComplaintRecord[] = [...complaintMap.values()];

  // ---------------------------------------------------------------------------
  // 3. Replay ConductIncidentLogged events.
  // ---------------------------------------------------------------------------

  const incidents: ConductIncidentRecord[] = [];

  for (const event of input.eventStore.replay({
    type: "ConductIncidentLogged",
    entity: input.entityId,
    ...frozenCursorOpts,
  })) {
    const eventTs = parseTs(event.as_of);
    if (eventTs < periodStartTs || eventTs > reportingDateTs) continue;

    const p = event.payload as {
      incidentId?: unknown;
      occurredAt?: unknown;
      category?: unknown;
      severity?: unknown;
      tcfOutcome?: unknown;
      counterpartyId?: unknown;
      regulatoryNotificationFiled?: unknown;
    };

    const severity = ["low", "medium", "high", "critical"].includes(String(p.severity))
      ? (String(p.severity) as "low" | "medium" | "high" | "critical")
      : "low";

    const incidentRecord: ConductIncidentRecord = {
      incidentId: String(p.incidentId ?? event.event_id),
      occurredAt: String(p.occurredAt ?? event.as_of),
      category: String(p.category ?? "unclassified"),
      severity,
      tcfOutcome: toTCFOutcome(p.tcfOutcome),
      ...(p.counterpartyId !== undefined ? { counterpartyId: String(p.counterpartyId) } : {}),
      regulatoryNotificationFiled:
        typeof p.regulatoryNotificationFiled === "boolean" ? p.regulatoryNotificationFiled : false,
    };
    incidents.push(incidentRecord);
  }

  // ---------------------------------------------------------------------------
  // 4. Replay BestExecutionAnalysisCompleted events; build summary.
  // ---------------------------------------------------------------------------

  let beAnalysisCount = 0;
  let beTotalTrades = 0;
  let beTotalBreaches = 0;
  const beAssetClasses = new Set<string>();
  const beVenues = new Set<string>();

  for (const event of input.eventStore.replay({
    type: "BestExecutionAnalysisCompleted",
    entity: input.entityId,
    ...frozenCursorOpts,
  })) {
    const eventTs = parseTs(event.as_of);
    if (eventTs < periodStartTs || eventTs > reportingDateTs) continue;

    const p = event.payload as {
      tradesReviewed?: unknown;
      breachCount?: unknown;
      assetClassesCovered?: unknown;
      venuesCovered?: unknown;
    };

    beAnalysisCount += 1;
    beTotalTrades += typeof p.tradesReviewed === "number" ? p.tradesReviewed : 0;
    beTotalBreaches += typeof p.breachCount === "number" ? p.breachCount : 0;

    if (Array.isArray(p.assetClassesCovered)) {
      for (const ac of p.assetClassesCovered) beAssetClasses.add(String(ac));
    }
    if (Array.isArray(p.venuesCovered)) {
      for (const v of p.venuesCovered) beVenues.add(String(v));
    }
  }

  const bestExecution: BestExecutionSummary = {
    analysisCount: beAnalysisCount,
    tradesReviewed: beTotalTrades,
    breachCount: beTotalBreaches,
    aggregateBreachRatePct:
      beTotalTrades > 0 ? Math.round((beTotalBreaches / beTotalTrades) * 100 * 100) / 100 : 0,
    verdict:
      beAnalysisCount === 0 ? "not-applicable" : beTotalBreaches > 0 ? "breach" : "compliant",
    assetClassesCovered: [...beAssetClasses].sort(),
    venuesCovered: [...beVenues].sort(),
  };

  // ---------------------------------------------------------------------------
  // 5. Aggregate complaint metrics.
  // ---------------------------------------------------------------------------

  const tcfOutcomeBreakdown = zeroTCFBreakdown();
  let resolvedComplaints = 0;
  let resolvedWithin5Days = 0;
  let totalResolutionDays = 0;
  let resolvedCount = 0;
  let escalatedCount = 0;

  for (const c of complaints) {
    tcfOutcomeBreakdown[c.tcfOutcome] += 1;
    if (c.status === "escalated") escalatedCount += 1;
    if (c.status === "resolved" || c.status === "escalated") {
      resolvedComplaints += 1;
      if (c.resolutionDays !== undefined) {
        resolvedCount += 1;
        totalResolutionDays += c.resolutionDays;
        if (c.resolutionDays <= 5) resolvedWithin5Days += 1;
      }
    }
  }

  const averageResolutionDays =
    resolvedCount > 0 ? Math.round(totalResolutionDays / resolvedCount) : 0;

  // ---------------------------------------------------------------------------
  // 6. Aggregate incident metrics.
  // ---------------------------------------------------------------------------

  const highSeverityIncidents = incidents.filter(
    (i) => i.severity === "high" || i.severity === "critical",
  ).length;
  const regulatoryNotificationsCount = incidents.filter(
    (i) => i.regulatoryNotificationFiled,
  ).length;

  // ---------------------------------------------------------------------------
  // 7. Determine disclosure status.
  //    "rehearsal" until tolerance thresholds are configured (Helena/Devon).
  //    TODO: promote to "compliant" / "breach" once RAS tolerance levels
  //    are set for complaint KPIs and best-execution breach rate.
  //    (D-MARKET-CONDUCT follow-on; Helena (CRO) + Devon (COO) to calibrate.)
  // ---------------------------------------------------------------------------

  const status = "rehearsal" as const;

  const metrics: ConductPeriodMetrics = {
    period: periodLabel,
    entityId: input.entityId,
    totalComplaints: complaints.length,
    resolvedComplaints,
    resolvedWithin5Days,
    averageResolutionDays,
    escalatedCount,
    tcfOutcomeBreakdown,
    totalIncidents: incidents.length,
    highSeverityIncidents,
    regulatoryNotificationsCount,
    bestExecution,
  };

  const disclosure: ConductPeriodDisclosure = {
    entityId: input.entityId,
    reportingDate: input.reportingDate,
    metrics,
    complaints,
    incidents,
    status,
  };

  return { disclosure, skipped: false };
}
