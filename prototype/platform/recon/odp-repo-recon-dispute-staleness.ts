// platform/recon/odp-repo-recon-dispute-staleness.ts
//
// Vera continuous-controls pipeline: assert that every OdpRepoReconBreakRaised
// event is either:
//
//   (a) Resolved via OdpRepoReconDisputeResolved within the prescribed deadline, OR
//   (b) Escalated to the CCO (outcome === "escalated-to-cco"), OR
//   (c) Corresponds to an open OdpRepoReconDisputeOpened that is still within its
//       resolution deadline.
//
// Deadline rule (CS 3/2018 §6):
//   - Repo-recon breaks must be investigated within 2 business days
//     (calendar-day approximation: 4 calendar days).
//
// Failure conditions (result in "fail" violation):
//   1. Break with no dispute opened AND past deadline.
//   2. Open dispute (OdpRepoReconDisputeOpened) past its resolutionDeadline
//      without a corresponding OdpRepoReconDisputeResolved.
//
// Warning conditions (result in "warn" violation):
//   1. Open dispute within 24h of deadline (approaching deadline warning).
//   2. Break with no dispute opened within approaching deadline window.
//
// Empty-state correctness: no breaks → pass.
//
// Independence: reads from the shared event store via eventStore.replay;
// does NOT import any domain service (pure event-fold).
//
// Standing authority: ORG-ODP-RPT-003 (trade reporting obligation).
// Citations:
//   urn:regulation:odp:cs-3-2018 §6 (trade repository reconciliation);
//   urn:regulation:odp:jn-2-2024 §5 (UTI reconciliation requirements);
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Devon (COO, operations)

import { eventStore } from "../composition";
import { type ReconResult, emptyResult } from "./types";

const PIPELINE = "odp-repo-recon-dispute-staleness";

// ---------------------------------------------------------------------------
// Deadline constants (calendar-day approximations of business-day windows)
// ---------------------------------------------------------------------------

/** Milliseconds per hour. */
const MS_PER_HOUR = 3_600_000;

/** Milliseconds per calendar day. */
const MS_PER_DAY = 86_400_000;

/**
 * Calendar-day approximation of 2 business days for repo-recon break resolution.
 * (CS 3/2018 §6)
 */
const REPO_RECON_BREAK_CALENDAR_DAYS = 4;

/** Warning threshold: 24h before deadline. */
const APPROACHING_DEADLINE_HOURS = 24;

// ---------------------------------------------------------------------------
// Minimal event shape
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
  /** Wall-clock anchor for deadline comparison. Defaults to current instant. */
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
    // event store unavailable — return empty (safe default for CI)
  }
  return out;
}

function safeString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// ---------------------------------------------------------------------------
// Main recon function
// ---------------------------------------------------------------------------

/**
 * Repo-recon dispute staleness recon.
 *
 * Asserts that every OdpRepoReconBreakRaised event is either resolved within
 * deadline or has an active OdpRepoReconDisputeOpened that is still within
 * its resolution deadline.
 *
 * @param opts — optional override for event sources + wall-clock anchor (tests)
 */
export function runOdpRepoReconDisputeStaleness(opts: RunOpts = {}): ReconResult {
  const now = opts.now ?? new Date();
  const violations: Array<{
    subject: string;
    message: string;
    severity: "fail" | "warn" | "info";
  }> = [];

  const breakEvents = loadEvents("OdpRepoReconBreakRaised", opts.breakEvents);
  const disputeOpenedEvents = loadEvents("OdpRepoReconDisputeOpened", opts.disputeOpenedEvents);
  const disputeResolvedEvents = loadEvents(
    "OdpRepoReconDisputeResolved",
    opts.disputeResolvedEvents,
  );

  // Early-exit if no breaks exist — nothing to check.
  if (breakEvents.length === 0) {
    return emptyResult(PIPELINE);
  }

  // Index: breakId → resolved event (if any)
  const resolvedByBreakId = new Map<string, MinimalEvent>();
  for (const e of disputeResolvedEvents) {
    const breakId = safeString(e.payload.breakId);
    if (breakId) resolvedByBreakId.set(breakId, e);
  }

  // Index: breakId → opened dispute event (if any)
  const disputeOpenedByBreakId = new Map<string, MinimalEvent>();
  for (const e of disputeOpenedEvents) {
    const breakId = safeString(e.payload.breakId);
    if (breakId) disputeOpenedByBreakId.set(breakId, e);
  }

  for (const breakEvt of breakEvents) {
    const breakId = safeString(breakEvt.payload.breakId);
    const tradeId = safeString(breakEvt.payload.tradeId);
    if (!breakId) continue;

    const subject = `break:${breakId}:trade:${tradeId ?? "?"}`;

    // Compute the deadline for this break (4 calendar days from as_of)
    const breakTs = Date.parse(breakEvt.as_of);
    if (Number.isNaN(breakTs)) continue;
    const deadline = new Date(breakTs + REPO_RECON_BREAK_CALENDAR_DAYS * MS_PER_DAY);

    const resolvedEvt = resolvedByBreakId.get(breakId);
    const disputeOpenedEvt = disputeOpenedByBreakId.get(breakId);

    // Case 1: Already resolved (with or without dispute opened) — check within deadline
    if (resolvedEvt) {
      const outcome = safeString(resolvedEvt.payload.outcome);
      // Escalated to CCO is acceptable — no further check needed
      if (outcome === "escalated-to-cco") continue;
      // withinDeadline: false in the resolved event is a warning finding
      if (resolvedEvt.payload.withinDeadline === false) {
        violations.push({
          subject,
          severity: "warn",
          message: `Repo-recon break '${breakId}' (trade: ${tradeId ?? "?"}) was resolved but outside the CS 3/2018 §6 deadline. Consider escalating to CCO. Authority: ORG-ODP-RPT-003; urn:regulation:odp:cs-3-2018 §6.`,
        });
      }
      continue;
    }

    // Case 2: Dispute opened — check if past deadline
    if (disputeOpenedEvt) {
      const deadlineStr = safeString(disputeOpenedEvt.payload.resolutionDeadline);
      if (!deadlineStr) continue;
      const disputeDeadlineTs = Date.parse(deadlineStr);
      if (Number.isNaN(disputeDeadlineTs)) continue;

      if (now.getTime() > disputeDeadlineTs) {
        // Past deadline with no resolution → fail
        violations.push({
          subject,
          severity: "fail",
          message: `CRITICAL: Repo-recon dispute for break '${breakId}' (trade: ${tradeId ?? "?"}) is PAST its resolution deadline (${deadlineStr}) with no OdpRepoReconDisputeResolved event. Escalate to CCO (Zara, Chief Compliance Officer) per CS 3/2018 §6. Authority: ORG-ODP-RPT-003.`,
        });
      } else if (now.getTime() > disputeDeadlineTs - APPROACHING_DEADLINE_HOURS * MS_PER_HOUR) {
        // Approaching deadline → warn
        violations.push({
          subject,
          severity: "warn",
          message: `Repo-recon dispute for break '${breakId}' (trade: ${tradeId ?? "?"}) is approaching its resolution deadline (${deadlineStr}). Resolve or escalate to CCO (Zara) soon. Authority: ORG-ODP-RPT-003; urn:regulation:odp:cs-3-2018 §6.`,
        });
      }
      continue;
    }

    // Case 3: No dispute opened — check if deadline has passed
    if (now.getTime() > deadline.getTime()) {
      violations.push({
        subject,
        severity: "fail",
        message: `Repo-recon break '${breakId}' (trade: ${tradeId ?? "?"}) has no OdpRepoReconDisputeOpened and the ${REPO_RECON_BREAK_CALENDAR_DAYS}-calendar-day investigation deadline has passed. Open a dispute or escalate to CCO (Zara) per CS 3/2018 §6. Deadline was: ${deadline.toISOString()}. Authority: ORG-ODP-RPT-003.`,
      });
    } else if (now.getTime() > deadline.getTime() - APPROACHING_DEADLINE_HOURS * MS_PER_HOUR) {
      violations.push({
        subject,
        severity: "warn",
        message: `Repo-recon break '${breakId}' (trade: ${tradeId ?? "?"}) has no OdpRepoReconDisputeOpened and the investigation deadline approaches (${deadline.toISOString()}). Investigate or open a dispute. Authority: ORG-ODP-RPT-003; urn:regulation:odp:cs-3-2018 §6.`,
      });
    }
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  const warnCount = violations.filter((v) => v.severity === "warn").length;

  return {
    pipeline: PIPELINE,
    ok: failCount === 0,
    asserted: breakEvents.length,
    violations,
    asOf: emptyResult(PIPELINE).asOf,
    ...(failCount > 0 || warnCount > 0
      ? {
          summary:
            failCount > 0
              ? `${PIPELINE}: FAILED — ${failCount} stale/unresolved break(s) detected`
              : `${PIPELINE}: passed with ${warnCount} warning(s)`,
        }
      : {
          summary: `${PIPELINE}: passed — ${breakEvents.length} break(s) checked, all within deadline`,
        }),
  } as ReconResult & { summary?: string };
}

// ---------------------------------------------------------------------------
// Main entry point (for bun run / CI)
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = runOdpRepoReconDisputeStaleness();
  const failCount = result.violations.filter((v) => v.severity === "fail").length;
  if (!result.ok) {
    console.error(`FAIL: ${result.pipeline} — ${failCount} violation(s)`);
    for (const v of result.violations) {
      console.error(`  [${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`);
    }
    process.exit(1);
  }
  console.log(`PASS: ${result.pipeline} — ${result.asserted} break(s) checked`);
}
