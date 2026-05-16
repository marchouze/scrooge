// platform/returns/cms/types.ts
//
// M3 Slice 8 — Conduct Management System (CMS) types.
//
// Data substrate for conduct risk monitoring, complaints management, and
// FSCA conduct reporting, aligned with the Financial Sector Regulation Act
// (FSRA) and the Treating Customers Fairly (TCF) framework.
//
// The bank is institutional-only: "customer" = institutional counterparty.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10).
//
// Citations:
//   Financial Sector Regulation Act 9 of 2017 (FSRA) §131 (FSCA conduct mandate);
//   FSB Treating Customers Fairly 2012 (TCF framework, 6 outcomes);
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md;
//   Principles/6-autonomous-by-default.md.
//
// Authors: Atlas (Platform Engineer, engineering) +
//   Devon (Chief Operating Officer, governance — TCF oversight).

// ---------------------------------------------------------------------------
// TCF Outcome type
// ---------------------------------------------------------------------------

/**
 * The six TCF Outcomes per the FSB Treating Customers Fairly (2012) framework.
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
// Complaint record
// ---------------------------------------------------------------------------

/**
 * A logged conduct complaint from an institutional counterparty.
 *
 * `tcfOutcome` is the primary TCF outcome the complaint maps to.
 * Where a complaint implicates multiple outcomes, the most material
 * outcome is recorded; the others can be added in `category` free text.
 */
export interface ConductComplaint {
  /** Unique complaint reference (UUID or internal scheme). */
  readonly complaintId: string;
  /** ISO 8601 — when the complaint was received. */
  readonly receivedAt: string;
  /** ISO 8601 — when the complaint was resolved (omit if still open). */
  readonly resolvedAt?: string;
  /** Party register ID of the institutional counterparty. */
  readonly counterpartyId: string;
  /**
   * Complaint category.
   * Examples: "best-execution", "front-running", "conflict-of-interest",
   * "disclosure", "product-suitability", "settlement-failure".
   */
  readonly category: string;
  /** Primary TCF outcome implicated. */
  readonly tcfOutcome: TCFOutcome;
  /** Complaint lifecycle state. */
  readonly status: "open" | "resolved" | "escalated";
  /**
   * Calendar days from `receivedAt` to `resolvedAt`.
   * Populated only when `status === "resolved"`.
   */
  readonly resolutionDays?: number;
}

// ---------------------------------------------------------------------------
// Period conduct metrics
// ---------------------------------------------------------------------------

/**
 * Aggregated conduct metrics for a reporting period.
 *
 * All numeric fields default to 0 for empty event stores
 * (rehearsal-grade placeholders).
 */
export interface ConductMetrics {
  /** Reporting period identifier (e.g. "2026-Q2", "2026-05"). */
  readonly period: string;
  /** Legal entity short-id (e.g. "LE-ZA-HOZ-BANK"). */
  readonly entityId: string;

  // --- Complaints KPIs ---

  /** Total complaints received in the period. */
  readonly totalComplaints: number;
  /** Complaints resolved within 5 business days. */
  readonly resolvedWithin5Days: number;
  /** Average calendar days to resolution (NaN-safe: 0 when no resolved complaints). */
  readonly averageResolutionDays: number;
  /** Complaints escalated to FSCA or senior management. */
  readonly escalatedCount: number;
  /**
   * Per-TCF-outcome complaint count.
   * Invariant: sum of values === `totalComplaints`.
   */
  readonly tcfOutcomeBreakdown: Record<TCFOutcome, number>;

  // --- Market conduct risk KPIs ---

  /**
   * Best-execution policy breach count detected in the period.
   * // TODO: feed from BestExecutionAnalysisCompleted event (M3 Slice 9+)
   */
  readonly bestExecutionBreachCount: number;

  /**
   * Conflict-of-interest flags raised by Owen (Company Secretary, governance)
   * in the period.
   * // TODO: feed from ConflictDeclared event (missing-types registry)
   */
  readonly conflictFlagsRaised: number;
}

// ---------------------------------------------------------------------------
// CMS disclosure (period report)
// ---------------------------------------------------------------------------

/**
 * The CMS period disclosure — the top-level artefact produced by the
 * `CMSGenerator` on `AccountingPeriodClosed` for a bank-licence entity.
 *
 * `status`:
 *   "rehearsal"  — placeholder data; no live event feeds yet.
 *   "compliant"  — all conduct KPIs within tolerances for the period.
 *   "breach"     — one or more KPIs outside tolerance; FSCA notification
 *                  may be required (Devon (COO) to determine).
 */
export interface CMSDisclosure {
  /** Legal entity short-id. */
  readonly entityId: string;
  /** ISO 8601 — reporting date (convention: `AccountingPeriodClosed.closedAt`). */
  readonly reportingDate: string;
  /** Aggregated conduct metrics for the period. */
  readonly metrics: ConductMetrics;
  /** Individual complaint records for the period. */
  readonly complaints: ConductComplaint[];
  /** Disclosure quality status. */
  readonly status: "rehearsal" | "compliant" | "breach";
}

// ---------------------------------------------------------------------------
// Entity guard constant
// ---------------------------------------------------------------------------

/**
 * Legal entity IDs for which CMS disclosures are generated.
 * CMS is FSCA conduct-mandate scoped — applies only to entities
 * holding a licence under the FSRA / conducting business with
 * retail or institutional clients.
 *
 * For the build phase, only Hoz Bank LE-ZA-HOZ-BANK is in scope.
 *
 * Citation: FSRA §131; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
 */
export const CMS_REGULATED_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];
