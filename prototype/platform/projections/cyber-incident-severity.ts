// platform/projections/cyber-incident-severity.ts
//
// Cyber-incident severity posture projection.
//
// Reads IncidentClassified, IncidentContained, and
// PostIncidentReviewCompleted events from the event store and computes
// the current cyber-incident severity posture per the incident response
// policy (CY-IRP-01 §2 + §7 KRIs).
//
// Severity tiers (CY-IRP-01 §2.1):
//   P1 — Critical: confirmed breach / material outage / ransomware /
//        AI-agent credential compromise / POPIA-notifiable event.
//        Containment SLA: 4 hours. PIR: 14 calendar days.
//   P2 — High: suspected breach / partial degradation / boundary violation.
//        Containment SLA: 24 hours. PIR: 14 calendar days.
//   P3/P4 — outside the appetite-line SLA measurement scope (lower tiers
//            do not trigger SLA-based RAG status for the RAS §B6 line).
//
// RAG logic (maps to RAS §B6 / CY-IRP-01 §7.2 KRIs):
//   Green:
//     - No open P1 or P2 incidents.
//     - All P1 containment SLAs met (within 4 hours of classification).
//     - All P2 containment SLAs met (within 24 hours of classification).
//     - All P1/P2 PIRs completed within 14 days of incident closure.
//   Amber (near-miss or minor breach):
//     - One or more P1/P2 SLA near-miss: containment was achieved but
//       >80% of the SLA elapsed before containment (i.e. >3h12m for P1,
//       >19h12m for P2). Signals process stress without a hard breach.
//     - OR one open P1/P2 incident that is less than 24 hours old (active
//       but within initial-response window).
//     - OR at least one P2 PIR completed after the 14-day deadline (P1
//       PIRs are all on time — a missed P2 PIR alone is amber).
//   Red:
//     - Open P1 incident more than 4 hours without containment (SLA breach).
//     - OR open P2 incident more than 24 hours without containment (SLA breach).
//     - OR any missed PIR (P1 or P2 incident closed >14 days ago with no
//       PostIncidentReviewCompleted event).
//
// Build-phase posture:
//   Zero IncidentClassified events → `{ status: "no-incidents", ... }`.
//   The bank has no live operations in build phase; the correct posture is
//   green-by-construction (no incidents to measure). The recon pipeline
//   treats `no-incidents` as a measured (satisfying) status.
//
// Authority: D-RAS (CEO-approved 2026-05-06); RAS §B6;
//   incident-response-policy-v1.md (CY-IRP-01); Joint Standard 2/2024 §6;
//   brief:senna:build-cyber-incident-severity-measurement-substr:2026-06-01.
//
// Author: Senna (CISO, engineering)

import type { EventStore } from "../event-store/store";

// ---------------------------------------------------------------------------
// SLA constants (CY-IRP-01 §2.1)
// ---------------------------------------------------------------------------

const P1_CONTAINMENT_SLA_MS = 4 * 60 * 60 * 1000; // 4 hours
const P2_CONTAINMENT_SLA_MS = 24 * 60 * 60 * 1000; // 24 hours
const PIR_DEADLINE_DAYS = 14;
const NEAR_MISS_THRESHOLD = 0.8; // >80% SLA elapsed = near-miss
const OPEN_INCIDENT_AMBER_WINDOW_MS = 24 * 60 * 60 * 1000; // <24h open = amber (not yet red)

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type CyberSeverityStatus = "green" | "amber" | "red" | "no-incidents";

export interface CyberSeverityPosture {
  /** RAG status or `no-incidents` (build-phase / clean bench). */
  readonly status: CyberSeverityStatus;
  /** Count of open P1 incidents (classified, no matching IncidentContained). */
  readonly openP1: number;
  /** Count of open P2 incidents (classified, no matching IncidentContained). */
  readonly openP2: number;
  /** Count of incidents with a missed containment SLA. */
  readonly missedSlas: number;
  /** Count of P1/P2 incidents with an outstanding (overdue) PIR. */
  readonly openPirs: number;
  /** Human-readable note for the appetite-line card. */
  readonly note: string;
}

// ---------------------------------------------------------------------------
// Internal incident record
// ---------------------------------------------------------------------------

interface Incident {
  incidentId: string;
  severity: "P1" | "P2" | "P3" | "P4";
  classifiedAt: string; // ISO 8601
  dataExposure: boolean;
  systemsAffected: string[];
  regulatoryTrigger: boolean;
  containedAt: string | null; // ISO 8601 or null if still open
  pirCompletedAt: string | null; // ISO 8601 or null if not yet completed
  closedAt: string | null; // ISO 8601 or null if still open
}

// ---------------------------------------------------------------------------
// Event payload shapes (loose — only what we read)
// ---------------------------------------------------------------------------

interface IncidentClassifiedPayload {
  incidentId?: string;
  classifiedAt?: string;
  classifiedBy?: string;
  severity?: string;
  dataExposure?: boolean;
  systemsAffected?: string[];
  regulatoryTrigger?: boolean;
}

interface IncidentContainedPayload {
  incidentId?: string;
  containedAt?: string;
}

interface PostIncidentReviewCompletedPayload {
  incidentId?: string;
  completedAt?: string;
  findings?: unknown[];
}

interface IncidentClosedPayload {
  incidentId?: string;
  closedAt?: string;
  finalSeverity?: string;
  rootCause?: string;
  controlGaps?: unknown[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isP1OrP2(severity: string | undefined): severity is "P1" | "P2" {
  return severity === "P1" || severity === "P2";
}

function elapsedMs(since: string, now: Date): number {
  return now.getTime() - new Date(since).getTime();
}

function daysBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * Compute the cyber-incident severity posture from the event store.
 *
 * The `asOf` parameter (ISO string) is used as the reference clock for
 * SLA elapsed-time and PIR deadline calculations. Defaults to the current
 * wall-clock time when omitted.
 *
 * @param store  — event store instance (injectable for tests)
 * @param asOf   — reference timestamp (ISO 8601); defaults to now
 */
export function computeCyberSeverityPosture(
  store: EventStore,
  asOf?: string,
): CyberSeverityPosture {
  const now = asOf ? new Date(asOf) : new Date();

  // ------------------------------------------------------------------
  // 1. Build incident map from IncidentClassified events
  // ------------------------------------------------------------------
  const incidents = new Map<string, Incident>();

  for (const e of store.replay({ type: "IncidentClassified" })) {
    const p = e.payload as IncidentClassifiedPayload;
    if (!p.incidentId || !p.classifiedAt || !p.severity) continue;
    if (!isP1OrP2(p.severity)) continue; // only P1/P2 matter for RAS §B6

    incidents.set(p.incidentId, {
      incidentId: p.incidentId,
      severity: p.severity as "P1" | "P2",
      classifiedAt: p.classifiedAt,
      dataExposure: p.dataExposure ?? false,
      systemsAffected: p.systemsAffected ?? [],
      regulatoryTrigger: p.regulatoryTrigger ?? false,
      containedAt: null,
      pirCompletedAt: null,
      closedAt: null,
    });
  }

  // ------------------------------------------------------------------
  // 2. Fold in IncidentContained events
  // ------------------------------------------------------------------
  for (const e of store.replay({ type: "IncidentContained" })) {
    const p = e.payload as IncidentContainedPayload;
    if (!p.incidentId || !p.containedAt) continue;
    const inc = incidents.get(p.incidentId);
    if (inc) {
      incidents.set(p.incidentId, { ...inc, containedAt: p.containedAt });
    }
  }

  // ------------------------------------------------------------------
  // 3. Fold in IncidentClosed events (for PIR deadline anchoring)
  // ------------------------------------------------------------------
  for (const e of store.replay({ type: "IncidentClosed" })) {
    const p = e.payload as IncidentClosedPayload;
    if (!p.incidentId || !p.closedAt) continue;
    const inc = incidents.get(p.incidentId);
    if (inc) {
      incidents.set(p.incidentId, { ...inc, closedAt: p.closedAt });
    }
  }

  // ------------------------------------------------------------------
  // 4. Fold in PostIncidentReviewCompleted events
  // ------------------------------------------------------------------
  for (const e of store.replay({ type: "PostIncidentReviewCompleted" })) {
    const p = e.payload as PostIncidentReviewCompletedPayload;
    if (!p.incidentId || !p.completedAt) continue;
    const inc = incidents.get(p.incidentId);
    if (inc) {
      incidents.set(p.incidentId, { ...inc, pirCompletedAt: p.completedAt });
    }
  }

  // ------------------------------------------------------------------
  // 5. Build-phase shortcut: no incidents recorded → green by construction
  // ------------------------------------------------------------------
  if (incidents.size === 0) {
    return {
      status: "no-incidents",
      openP1: 0,
      openP2: 0,
      missedSlas: 0,
      openPirs: 0,
      note: "No incidents recorded in build phase — cyber-severity tier posture is green by construction.",
    };
  }

  // ------------------------------------------------------------------
  // 6. Evaluate each incident against SLA and PIR rules
  // ------------------------------------------------------------------
  let openP1 = 0;
  let openP2 = 0;
  let missedSlas = 0;
  let openPirs = 0;
  let hasNearMiss = false;
  let hasOpenWithinAmberWindow = false;
  let hasAmberPirMiss = false; // P2 PIR missed; P1 PIRs all on time
  let hasRedPirMiss = false;

  for (const inc of incidents.values()) {
    const slaMs = inc.severity === "P1" ? P1_CONTAINMENT_SLA_MS : P2_CONTAINMENT_SLA_MS;
    const elapsedSinceClassification = elapsedMs(inc.classifiedAt, now);

    if (inc.containedAt === null) {
      // Open incident — compute SLA posture
      if (inc.severity === "P1") openP1++;
      if (inc.severity === "P2") openP2++;

      if (elapsedSinceClassification > slaMs) {
        // SLA hard breach → Red
        missedSlas++;
      } else if (elapsedSinceClassification <= OPEN_INCIDENT_AMBER_WINDOW_MS) {
        // Still within initial 24h window → amber at most
        hasOpenWithinAmberWindow = true;
      } else if (elapsedSinceClassification > NEAR_MISS_THRESHOLD * slaMs) {
        // >80% of SLA elapsed → near-miss → amber
        hasNearMiss = true;
      }
    } else {
      // Contained — check whether SLA was met
      const containmentElapsed = elapsedMs(inc.classifiedAt, new Date(inc.containedAt));
      if (containmentElapsed > slaMs) {
        missedSlas++;
      } else if (containmentElapsed > NEAR_MISS_THRESHOLD * slaMs) {
        hasNearMiss = true;
      }
    }

    // PIR check: required for P1/P2; deadline is 14 days after closedAt
    // (or classifiedAt if the incident has never been formally closed).
    // An incident is only PIR-overdue if it was classified more than 14
    // days ago (so fresh incidents don't immediately become overdue).
    const pirAnchor = inc.closedAt ?? inc.classifiedAt;
    const daysSincePirAnchor = daysBetween(pirAnchor, now.toISOString());

    if (inc.pirCompletedAt === null && daysSincePirAnchor > PIR_DEADLINE_DAYS) {
      openPirs++;
      if (inc.severity === "P1") {
        // Missed P1 PIR → Red
        hasRedPirMiss = true;
      } else {
        // Missed P2 PIR → Amber (unless P1 also missed, which is handled by hasRedPirMiss)
        hasAmberPirMiss = true;
      }
    }
  }

  // ------------------------------------------------------------------
  // 7. Determine RAG status
  // ------------------------------------------------------------------
  // Red conditions (any one → red):
  //   - open P1 beyond SLA (openP1 > 0 && missedSlas covers it)
  //   - open P2 beyond SLA
  //   - missed PIR for any P1 or P2
  const isRed = missedSlas > 0 || hasRedPirMiss;

  // Amber conditions (any one → amber, absent red):
  //   - near-miss containment
  //   - open incident within initial 24h window
  //   - missed P2 PIR only
  const isAmber = !isRed && (hasNearMiss || hasOpenWithinAmberWindow || hasAmberPirMiss);

  let status: CyberSeverityStatus;
  if (isRed) {
    status = "red";
  } else if (isAmber) {
    status = "amber";
  } else {
    status = "green";
  }

  // ------------------------------------------------------------------
  // 8. Build note
  // ------------------------------------------------------------------
  const parts: string[] = [];
  parts.push(`${incidents.size} P1/P2 incident(s) on record.`);
  if (openP1 > 0) parts.push(`Open P1: ${openP1}.`);
  if (openP2 > 0) parts.push(`Open P2: ${openP2}.`);
  if (missedSlas > 0) parts.push(`Missed containment SLA(s): ${missedSlas}.`);
  if (openPirs > 0) parts.push(`Overdue PIR(s): ${openPirs}.`);
  if (hasNearMiss && !isRed) parts.push("Near-miss SLA: containment >80% of SLA elapsed.");
  if (hasOpenWithinAmberWindow && openP1 + openP2 > 0 && !isRed)
    parts.push("Open incident within initial 24h response window.");
  if (hasAmberPirMiss && !isRed) parts.push("P2 PIR overdue (P1 PIRs on time).");

  parts.push(
    `CY-IRP-01 §2.1 SLAs: P1 containment 4h / P2 containment 24h / PIR 14d. RAS §B6.`,
  );

  const note = parts.join(" ");

  return { status, openP1, openP2, missedSlas, openPirs, note };
}
