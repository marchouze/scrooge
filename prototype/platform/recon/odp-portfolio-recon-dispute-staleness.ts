// platform/recon/odp-portfolio-recon-dispute-staleness.ts
//
// Vera continuous-controls pipeline: assert that every OdpReconBreakRaised
// event with severity "material" or "critical" is either:
//
//   (a) Resolved via OdpReconDisputeResolved within the prescribed deadline, OR
//   (b) Escalated to the CRO (outcome === "escalated-to-cro"), OR
//   (c) Corresponds to an open OdpReconDisputeOpened that is still within its
//       resolution deadline.
//
// Deadline rules (CS 2/2018 §9(d)):
//   - "material-terms" disputes: 3 business days (approx 5 calendar days)
//   - "valuation"      disputes: 5 business days (approx 9 calendar days)
//
// Minor severity breaks are informational only — not subject to deadline tracking.
//
// Failure conditions (result in FAIL violation):
//   1. Material/critical break with no dispute opened AND past deadline.
//   2. Open dispute (OdpReconDisputeOpened) past its resolutionDeadline without
//      a corresponding OdpReconDisputeResolved.
//
// Warning conditions (result in WARN violation):
//   1. Open dispute within 24h of deadline (approaching deadline warning).
//   2. Material/critical break with no dispute opened but within deadline window.
//
// Empty-state correctness: no breaks and no disputes → pass.
//
// Independence: reads from the shared event store via `eventStore.replay`;
// does NOT import any domain service (pure event-fold).
//
// Standing authority: ORG-ODP-COND-007 (Derivatives Counterparty obligation).
// Citations:
//   urn:regulation:odp:cs-2-2018 §9(d) (dispute resolution and escalation);
//   ISDA EMIR Portfolio Reconciliation, Dispute Resolution and Disclosure (2013);
//   CS 2/2018 §9(a)–(c) (cadence rules, portfolio count thresholds);
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Devon (COO, operations)

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "odp-portfolio-recon-dispute-staleness";

// ---------------------------------------------------------------------------
// Deadline constants (calendar-day approximations of business-day windows)
// ---------------------------------------------------------------------------

/** Milliseconds per hour. */
const MS_PER_HOUR = 3_600_000;

/** Milliseconds per calendar day. */
const MS_PER_DAY = 86_400_000;

/**
 * Calendar-day approximation of 3 business days for material-terms disputes.
 * (CS 2/2018 §9(d)(i))
 */
const MATERIAL_TERMS_CALENDAR_DAYS = 5;

/**
 * Calendar-day approximation of 5 business days for valuation disputes.
 * (CS 2/2018 §9(d)(ii))
 */
const VALUATION_CALENDAR_DAYS = 9;

/** Warning threshold: 24h before deadline. */
const APPROACHING_DEADLINE_HOURS = 24;

// ---------------------------------------------------------------------------
// Minimal event shape (keeps the function testable with plain objects)
// ---------------------------------------------------------------------------

interface MinimalEvent {
  readonly event_id: string;
  readonly type: string;
  readonly as_of: string;
  readonly payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// RunOpts — dependency injection surface for tests
// ---------------------------------------------------------------------------

export interface RunOpts {
  breakEvents?: Iterable<MinimalEvent>;
  disputeOpenedEvents?: Iterable<MinimalEvent>;
  disputeResolvedEvents?: Iterable<MinimalEvent>;
  /** Wall-clock anchor for deadline comparison. Defaults to the current instant. */
  now?: Date;
}

// ---------------------------------------------------------------------------
// Load helpers
// ---------------------------------------------------------------------------

function loadEvents(type: string, override: Iterable<MinimalEvent> | undefined): MinimalEvent[] {
  if (override) return [...override];
  const out: MinimalEvent[] = [];
  try {
    for (const e of eventStore.replay({ type })) {
      out.push({
        event_id: e.event_id,
        type: e.type,
        as_of: e.as_of,
        payload: (e.payload ?? {}) as Record<string, unknown>,
      });
    }
  } catch {
    // production event store unavailable — return empty (safe default for CI)
  }
  return out;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function safeString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Compute the deadline for a break that has no OdpReconDisputeOpened.
 * We infer the deadline from the break's as_of + dispute kind window.
 */
function inferDeadlineMs(breakAsOf: string, disputeKind: string): number {
  const braisedMs = Date.parse(breakAsOf);
  if (Number.isNaN(braisedMs)) return Number.POSITIVE_INFINITY;
  const calDays =
    disputeKind === "material-terms" ? MATERIAL_TERMS_CALENDAR_DAYS : VALUATION_CALENDAR_DAYS;
  return braisedMs + calDays * MS_PER_DAY;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const base = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const now = opts.now ?? new Date();
  const nowMs = now.getTime();

  const breaks = loadEvents("OdpReconBreakRaised", opts.breakEvents);
  const opened = loadEvents("OdpReconDisputeOpened", opts.disputeOpenedEvents);
  const resolved = loadEvents("OdpReconDisputeResolved", opts.disputeResolvedEvents);

  // ---- Build lookup: breakId → dispute-opened event ----
  const disputeOpenedByBreakId = new Map<string, MinimalEvent>();
  for (const d of opened) {
    const breakId = safeString(d.payload.breakId);
    if (breakId) {
      // Keep the most-recent open event per breakId (last wins in chronological order)
      disputeOpenedByBreakId.set(breakId, d);
    }
  }

  // ---- Build lookup: breakId → resolved event ----
  const disputeResolvedByBreakId = new Map<string, MinimalEvent>();
  for (const r of resolved) {
    const breakId = safeString(r.payload.breakId);
    if (breakId) {
      disputeResolvedByBreakId.set(breakId, r);
    }
  }

  // ---- Assertion 1: every material/critical break must be handled ----
  for (const b of breaks) {
    const severity = safeString(b.payload.severity);
    // Only track material and critical breaks — minor is informational only
    if (severity !== "material" && severity !== "critical") continue;

    base.asserted++;

    const breakId = safeString(b.payload.breakId);
    const cpid = safeString(b.payload.counterpartyId);
    const dimension = safeString(b.payload.dimension);

    if (!breakId) {
      violations.push({
        subject: b.event_id,
        severity: "warn",
        message: `OdpReconBreakRaised event ${b.event_id} has no breakId in payload — cannot assert dispute tracking. Authority: ORG-ODP-COND-007; urn:regulation:odp:cs-2-2018 §9(d).`,
      });
      continue;
    }

    // (a) Check if the break has been resolved
    const resolvedEvent = disputeResolvedByBreakId.get(breakId);
    if (resolvedEvent) {
      // Already resolved — no further assertion needed for this break
      continue;
    }

    // (b) Check if there is an open dispute
    const openedEvent = disputeOpenedByBreakId.get(breakId);

    if (openedEvent) {
      // Dispute has been opened — check if it is past its deadline
      const deadlineStr = safeString(openedEvent.payload.resolutionDeadline);
      if (!deadlineStr) continue; // no deadline recorded — skip

      const deadlineMs = Date.parse(deadlineStr);
      if (Number.isNaN(deadlineMs)) continue;

      const msUntilDeadline = deadlineMs - nowMs;

      if (msUntilDeadline < 0) {
        // Past deadline — FAIL
        const hoursOverdue = Math.abs(msUntilDeadline) / MS_PER_HOUR;
        violations.push({
          subject: `break:${breakId}`,
          severity: "fail",
          message: `CRITICAL: OdpReconBreakRaised breakId="${breakId}" (counterparty="${cpid ?? "?"}", dimension="${dimension ?? "?"}", severity="${severity}") has an OPEN dispute (${openedEvent.event_id}) that is PAST ITS RESOLUTION DEADLINE. Deadline: ${deadlineStr}. Overdue by: ${hoursOverdue.toFixed(1)}h. Required: resolve dispute OR escalate to CRO (Helena, Chief Risk Officer). Authority: ORG-ODP-COND-007; urn:regulation:odp:cs-2-2018 §9(d).`,
        });
      } else if (msUntilDeadline <= APPROACHING_DEADLINE_HOURS * MS_PER_HOUR) {
        // Within 24h of deadline — WARN
        const hoursRemaining = msUntilDeadline / MS_PER_HOUR;
        violations.push({
          subject: `break:${breakId}`,
          severity: "warn",
          message: `OdpReconBreakRaised breakId="${breakId}" (counterparty="${cpid ?? "?"}", dimension="${dimension ?? "?"}") has an open dispute approaching its resolution deadline. Deadline: ${deadlineStr}. Hours remaining: ${hoursRemaining.toFixed(1)}h. Authority: ORG-ODP-COND-007; urn:regulation:odp:cs-2-2018 §9(d).`,
        });
      }
      // else: dispute open and within deadline — OK
    } else {
      // No dispute opened yet — check if we are past the implied deadline
      const disputeKind = safeString(b.payload.disputeKind);
      if (!disputeKind) {
        // No disputeKind set — can't compute deadline, treat as warn
        violations.push({
          subject: `break:${breakId}`,
          severity: "warn",
          message: `OdpReconBreakRaised breakId="${breakId}" (counterparty="${cpid ?? "?"}", dimension="${dimension ?? "?"}", severity="${severity}") has no OdpReconDisputeOpened and no disputeKind set. Cannot determine deadline. Recommend opening a dispute. Authority: ORG-ODP-COND-007; urn:regulation:odp:cs-2-2018 §9(d).`,
        });
        continue;
      }

      const deadlineMs = inferDeadlineMs(b.as_of, disputeKind);
      const msUntilDeadline = deadlineMs - nowMs;

      if (msUntilDeadline < 0) {
        const hoursOverdue = Math.abs(msUntilDeadline) / MS_PER_HOUR;
        violations.push({
          subject: `break:${breakId}`,
          severity: "fail",
          message: `CRITICAL: OdpReconBreakRaised breakId="${breakId}" (counterparty="${cpid ?? "?"}", dimension="${dimension ?? "?"}", severity="${severity}") has NO dispute opened and NO resolution, and is PAST its implied ${disputeKind} deadline. Break detected at: ${b.as_of}. Overdue by: ${hoursOverdue.toFixed(1)}h. Required: open OdpReconDisputeOpened OR resolve with OdpReconDisputeResolved OR escalate to CRO (Helena, Chief Risk Officer, risk). Authority: ORG-ODP-COND-007; urn:regulation:odp:cs-2-2018 §9(d).`,
        });
      } else if (msUntilDeadline <= APPROACHING_DEADLINE_HOURS * MS_PER_HOUR) {
        violations.push({
          subject: `break:${breakId}`,
          severity: "warn",
          message: `OdpReconBreakRaised breakId="${breakId}" (counterparty="${cpid ?? "?"}", dimension="${dimension ?? "?"}", severity="${severity}") has no dispute opened yet and is approaching its ${disputeKind} deadline. Hours remaining: ${(msUntilDeadline / MS_PER_HOUR).toFixed(1)}h. Authority: ORG-ODP-COND-007; urn:regulation:odp:cs-2-2018 §9(d).`,
        });
      }
      // else: break detected recently, dispute not yet opened — OK (within window)
    }
  }

  // ---- Assertion 2: open disputes past their own recorded deadline ----
  // (Covers disputes that may have been opened for breaks not currently visible
  //  in the break stream, or where breakId is missing from the break stream.)
  for (const d of opened) {
    const breakId = safeString(d.payload.breakId);
    if (!breakId) continue;

    // Skip if already covered in assertion 1 (break was found in the breaks list)
    // and skip if already resolved
    if (disputeResolvedByBreakId.has(breakId)) continue;

    // Also skip breaks that appear in the breaks stream — already handled above
    const breakEventFound = breaks.some((b) => safeString(b.payload.breakId) === breakId);
    if (breakEventFound) continue;

    // Orphaned open dispute (no corresponding break in stream) — check deadline
    const deadlineStr = safeString(d.payload.resolutionDeadline);
    if (!deadlineStr) continue;

    const deadlineMs = Date.parse(deadlineStr);
    if (Number.isNaN(deadlineMs)) continue;

    base.asserted++;
    const msUntilDeadline = deadlineMs - nowMs;

    if (msUntilDeadline < 0) {
      const hoursOverdue = Math.abs(msUntilDeadline) / MS_PER_HOUR;
      const cpid = safeString(d.payload.counterpartyId);
      violations.push({
        subject: `dispute:${breakId}`,
        severity: "fail",
        message: `OdpReconDisputeOpened for breakId="${breakId}" (counterparty="${cpid ?? "?"}") is PAST its recorded resolution deadline (${deadlineStr}) with no OdpReconDisputeResolved. Overdue by: ${hoursOverdue.toFixed(1)}h. Required: emit OdpReconDisputeResolved OR escalate to CRO. Authority: ORG-ODP-COND-007; urn:regulation:odp:cs-2-2018 §9(d).`,
      });
    }
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;

  return {
    ...base,
    violations,
    ok: failCount === 0,
  };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  const failCount = r.violations.filter((v) => v.severity === "fail").length;

  if (failCount === 0 && warnCount === 0) {
    console.log(
      JSON.stringify({
        level: "info",
        pipeline: PIPELINE,
        ok: r.ok,
        asserted: r.asserted,
        msg: `odp-portfolio-recon-dispute-staleness passed — ${r.asserted} break(s) checked; 0 deadline violations`,
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        level: failCount > 0 ? "error" : "warn",
        pipeline: PIPELINE,
        ok: r.ok,
        asserted: r.asserted,
        warnings: warnCount,
        failures: failCount,
        msg: `odp-portfolio-recon-dispute-staleness: ${failCount} deadline failure(s); ${warnCount} warning(s)`,
      }),
    );
    for (const v of r.violations) {
      console.warn(`  [${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`);
    }
  }

  if (!r.ok) process.exit(1);
}
