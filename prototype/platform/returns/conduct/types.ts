// platform/returns/conduct/types.ts
//
// M3 Slice 9 — Conduct events reporting types.
//
// Data substrate for the FSCA/FSR Act market conduct reporting module.
// Extends the CMS Slice 8 foundation with typed conduct events:
//   - ConductComplaintFiled / ConductComplaintResolved (typed event feeds)
//   - ConductIncidentLogged (internal near-miss / breach incidents)
//   - BestExecutionAnalysisCompleted (FAIS §16 periodic review)
//   - ConductDisclosureEmitted (period report)
//
// Principle 1: all metric cells derive from event replay, not stored aggregates.
//
// Standing authority: D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
//   (CEO-approved 2026-05-10).
//
// Citations:
//   Financial Sector Regulation Act 9 of 2017 (FSRA) §131;
//   FSB Treating Customers Fairly 2012 (TCF framework, 6 outcomes);
//   FAIS Act 37/2002 §§16–17 (complaints + best execution);
//   D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Mira (Compliance / RegTech engineer, engineering — conduct obligation chain).

import type { ConductStatus } from "../../event-store/event-types/conduct";

// ---------------------------------------------------------------------------
// Re-export shared TCF type for consumers of this module
// ---------------------------------------------------------------------------

export type { ConductStatus };

// ---------------------------------------------------------------------------
// TCF Outcome type
// ---------------------------------------------------------------------------

/**
 * The six TCF Outcomes per the FSB Treating Customers Fairly (2012) framework.
 * Re-declared here (aligned with event-types/conduct.ts) so the returns module
 * has a self-contained surface.
 *
 * 1 — Culture: fair treatment embedded in the firm's culture.
 * 2 — Products: products / services designed to meet customer needs.
 * 3 — Information: clear, timely, appropriate customer information.
 * 4 — Advice: suitable advice based on customer circumstances.
 * 5 — Standards: products perform as expected and standards met.
 * 6 — Barriers: no unreasonable post-sale barriers.
 *
 * Citation: FSB Treating Customers Fairly (2012) §2.
 */
export type TCFOutcome = 1 | 2 | 3 | 4 | 5 | 6;

// ---------------------------------------------------------------------------
// Complaint record (event-derived)
// ---------------------------------------------------------------------------

/**
 * A typed complaint record derived from a pair of
 * `ConductComplaintFiled` + `ConductComplaintResolved` events.
 *
 * When `ConductComplaintResolved` has not yet been emitted, `status`
 * is "open" and the resolution fields are omitted.
 */
export interface ConductComplaintRecord {
  readonly complaintId: string;
  readonly receivedAt: string;
  readonly counterpartyId: string;
  readonly category: string;
  readonly tcfOutcome: TCFOutcome;
  readonly status: ConductStatus;
  readonly resolvedAt?: string;
  readonly resolutionDays?: number;
  readonly escalated?: boolean;
}

// ---------------------------------------------------------------------------
// Incident record (event-derived)
// ---------------------------------------------------------------------------

/**
 * A conduct incident record derived from a `ConductIncidentLogged` event.
 */
export interface ConductIncidentRecord {
  readonly incidentId: string;
  readonly occurredAt: string;
  readonly category: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly tcfOutcome: TCFOutcome;
  readonly counterpartyId?: string;
  readonly regulatoryNotificationFiled: boolean;
}

// ---------------------------------------------------------------------------
// Best-execution summary (event-derived)
// ---------------------------------------------------------------------------

/**
 * Best-execution review summary derived from `BestExecutionAnalysisCompleted`
 * events for the reporting period.
 */
export interface BestExecutionSummary {
  /** Number of completed analyses in the period. */
  readonly analysisCount: number;
  /** Total trades reviewed across all analyses. */
  readonly tradesReviewed: number;
  /** Total trades in breach across all analyses. */
  readonly breachCount: number;
  /**
   * Aggregate breach rate as a percentage (0–100).
   * 0 when no trades were reviewed.
   */
  readonly aggregateBreachRatePct: number;
  /**
   * Overall verdict for the period:
   *   "compliant"     — no breaches found.
   *   "breach"        — at least one breach detected.
   *   "not-applicable" — no analyses completed in period.
   */
  readonly verdict: "compliant" | "breach" | "not-applicable";
  /** Asset classes covered across all analyses. */
  readonly assetClassesCovered: readonly string[];
  /** Execution venues covered across all analyses. */
  readonly venuesCovered: readonly string[];
}

// ---------------------------------------------------------------------------
// Conduct metrics (period aggregate)
// ---------------------------------------------------------------------------

/**
 * Aggregated conduct metrics for a reporting period.
 * Derived entirely from event replay (Principle 1).
 */
export interface ConductPeriodMetrics {
  /** Reporting period label (e.g. "2026-Q2", "2026-05"). */
  readonly period: string;
  /** Legal entity short-id (e.g. "LE-ZA-HOZ-BANK"). */
  readonly entityId: string;

  // --- Complaint KPIs ---

  /** Total `ConductComplaintFiled` events in the period. */
  readonly totalComplaints: number;
  /** Complaints with `status === "resolved"` in the period. */
  readonly resolvedComplaints: number;
  /** Complaints resolved within 5 calendar days. */
  readonly resolvedWithin5Days: number;
  /**
   * Average calendar days to resolution.
   * 0 (not NaN) when no resolved complaints exist.
   */
  readonly averageResolutionDays: number;
  /** Complaints escalated to FSCA or senior management. */
  readonly escalatedCount: number;
  /**
   * Per-TCF-outcome complaint count.
   * Invariant: sum of values === `totalComplaints`.
   */
  readonly tcfOutcomeBreakdown: Record<TCFOutcome, number>;

  // --- Incident KPIs ---

  /** Total `ConductIncidentLogged` events in the period. */
  readonly totalIncidents: number;
  /** Incidents with severity "high" or "critical". */
  readonly highSeverityIncidents: number;
  /** Incidents where a regulatory notification was filed. */
  readonly regulatoryNotificationsCount: number;

  // --- Best-execution KPIs ---

  /** Best-execution summary for the period. */
  readonly bestExecution: BestExecutionSummary;
}

// ---------------------------------------------------------------------------
// Conduct period disclosure
// ---------------------------------------------------------------------------

/**
 * The conduct period disclosure — the top-level artefact produced by the
 * `ConductGenerator` on `AccountingPeriodClosed` for a regulated entity.
 *
 * `status`:
 *   "rehearsal"  — placeholder data; event feeds are newly connected but no
 *                  tolerance thresholds are yet configured.
 *   "compliant"  — all conduct KPIs within tolerances for the period.
 *   "breach"     — one or more KPIs outside tolerance; FSCA notification may
 *                  be required (Devon (COO, governance) to determine).
 */
export interface ConductPeriodDisclosure {
  readonly entityId: string;
  /** ISO 8601 — reporting date (convention: `AccountingPeriodClosed.closedAt`). */
  readonly reportingDate: string;
  /** Aggregated conduct metrics for the period. */
  readonly metrics: ConductPeriodMetrics;
  /** Individual complaint records for the period. */
  readonly complaints: readonly ConductComplaintRecord[];
  /** Individual incident records for the period. */
  readonly incidents: readonly ConductIncidentRecord[];
  /** Disclosure quality status. */
  readonly status: "rehearsal" | "compliant" | "breach";
}

// ---------------------------------------------------------------------------
// Entity guard constant
// ---------------------------------------------------------------------------

/**
 * Legal entity IDs for which conduct period disclosures are generated.
 * FSCA conduct-mandate scoped — applies only to entities holding an
 * FSCA licence under the FSRA or conducting business with institutional
 * or retail clients.
 *
 * Build phase: only Hoz Bank (`LE-ZA-HOZ-BANK`) is in scope.
 *
 * Citation: FSRA §131; D-MARKET-CONDUCT.
 */
export const CONDUCT_REGULATED_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];
