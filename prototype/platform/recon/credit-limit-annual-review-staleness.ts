// platform/recon/credit-limit-annual-review-staleness.ts
//
// Vera continuous-controls pipeline: assert that every counterparty with an
// active `CreditLimitLoaded` has had a `CreditLimitAnnualReviewCompleted`
// within the last 13 months (high) / 15 months (critical).
//
// "Active" = at least one `CreditLimitLoaded` exists for the counterparty
// AND no `CreditLimitWithdrawn` event has been emitted to take it offline.
// (`CreditLimitWithdrawn` is registered in
// `platform/event-store/event-types/credit-limit.ts`; the projection folds
// it to status = "withdrawn" and `listActiveLimits` excludes withdrawn rows.)
//
// Severity ladder per Credit Risk Policy §1.4 / §7:
//   - reviewedAt within last 13 months          → pass
//   - reviewedAt 13–15 months ago               → high   (warn-class "fail")
//   - reviewedAt > 15 months ago                → critical (warn-class "fail")
//   - no review event at all (and limit > 13mo) → critical (warn-class "fail")
//
// `ReconSeverity` is the canonical platform/recon scheme — we map
// {high, critical} both to `fail` and distinguish in the message.
//
// Empty-state correctness: no `CreditLimitLoaded` events → pass on clean
// bench (no counterparties to assert against).
//
// Independence: reads from the shared event store via `eventStore.replay`;
// does NOT import `@platform/risk/credit-limit-engine`.
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
// Citations:
//   Policies/credit-risk-policy-v1.md §1.4 + §7;
//   Procedures/by-policy/credit-risk-limit-management.md §9 (PROC-RISK-CLM-01);
//   Procedures/by-policy/credit-origination.md §9 (PROC-RISK-CO-01 Step 7);
//   Banks Act 94 of 1990 §73; RRB Regulation 23;
//   D-CREDIT-LIMIT-ENGINE-BUILD;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Vera (Internal audit engineer).

import { eventStore } from "../composition";
import type { ProvenanceTag } from "../event-store/provenance";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "credit-limit-annual-review-staleness";

/** Months that constitute "high" staleness (13-month band start). */
const HIGH_MONTHS = 13;
/** Months that constitute "critical" staleness (15-month band start). */
const CRITICAL_MONTHS = 15;

// ---------------------------------------------------------------------------
// Minimal event shapes
// ---------------------------------------------------------------------------

interface MinimalEvent {
  readonly event_id: string;
  readonly type: string;
  readonly as_of: string;
  readonly payload: Record<string, unknown>;
}

export interface RunOpts {
  /** Override the event source — used by tests. */
  loadedEvents?: Iterable<MinimalEvent>;
  reviewEvents?: Iterable<MinimalEvent>;
  withdrawnEvents?: Iterable<MinimalEvent>;
  /**
   * Override the "now" anchor used for staleness arithmetic. Defaults to
   * `new Date()` (live wall-clock at recon run time). Tests inject a fixed
   * ISO timestamp.
   */
  now?: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function monthsBetween(earlier: Date, later: Date): number {
  const yrDiff = later.getUTCFullYear() - earlier.getUTCFullYear();
  const moDiff = later.getUTCMonth() - earlier.getUTCMonth();
  let months = yrDiff * 12 + moDiff;
  // Sub-month adjustment by day-of-month — if the "later" day is before the
  // "earlier" day, we have not yet completed the final month.
  if (later.getUTCDate() < earlier.getUTCDate()) months -= 1;
  return months;
}

function loadEvents(type: string, override: Iterable<MinimalEvent> | undefined): MinimalEvent[] {
  if (override) return [...override];
  const out: MinimalEvent[] = [];
  try {
    for (const e of eventStore.replay({ type })) {
      // Only process production-tagged events. build-phase-fixture and simulated
      // events are test/scenario data and must not trigger staleness alerts.
      const tag = (e.provenance ?? {}) as Partial<ProvenanceTag>;
      if (tag.kind !== "production") continue;
      out.push({
        event_id: e.event_id,
        type: e.type,
        as_of: e.as_of,
        payload: (e.payload ?? {}) as Record<string, unknown>,
      });
    }
  } catch {
    // ignore — empty
  }
  return out;
}

interface LoadState {
  counterpartyId: string;
  loadedAt: string;
  withdrawn: boolean;
}

// ---------------------------------------------------------------------------
// Pipeline run
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const loaded = loadEvents("CreditLimitLoaded", opts.loadedEvents);
  const reviews = loadEvents("CreditLimitAnnualReviewCompleted", opts.reviewEvents);
  // CreditLimitWithdrawn is registered as a typed event family member under
  // D-CREDIT-LIMIT-ENGINE-BUILD Phase 4 (closes Vera's PR #613 substrate gap).
  const withdrawn = loadEvents("CreditLimitWithdrawn", opts.withdrawnEvents);

  // Empty-state guard — no loads → nothing to assert.
  if (loaded.length === 0) {
    result.asserted = 1;
    result.ok = true;
    return result;
  }

  // -------------------------------------------------------------------------
  // Build per-counterparty load state: earliest loadedAt + withdrawn flag.
  // -------------------------------------------------------------------------
  const stateByCp = new Map<string, LoadState>();
  for (const e of loaded) {
    const cpid = e.payload.counterpartyId;
    if (typeof cpid !== "string" || cpid.length === 0) continue;
    const existing = stateByCp.get(cpid);
    if (!existing || e.as_of < existing.loadedAt) {
      stateByCp.set(cpid, { counterpartyId: cpid, loadedAt: e.as_of, withdrawn: false });
    }
  }

  for (const w of withdrawn) {
    const cpid = w.payload.counterpartyId;
    if (typeof cpid !== "string" || cpid.length === 0) continue;
    const st = stateByCp.get(cpid);
    if (st) st.withdrawn = true;
  }

  // -------------------------------------------------------------------------
  // Build per-counterparty most-recent review timestamp.
  // -------------------------------------------------------------------------
  const lastReviewByCp = new Map<string, string>();
  for (const r of reviews) {
    const cpid = r.payload.counterpartyId;
    if (typeof cpid !== "string" || cpid.length === 0) continue;
    // reviewedAt is the canonical timestamp; fall back to event as_of.
    const rawReviewedAt = r.payload.reviewedAt;
    const reviewedAt = typeof rawReviewedAt === "string" ? rawReviewedAt : r.as_of;
    const existing = lastReviewByCp.get(cpid);
    if (!existing || reviewedAt > existing) lastReviewByCp.set(cpid, reviewedAt);
  }

  const now = opts.now ?? new Date();

  // -------------------------------------------------------------------------
  // Assert each active counterparty has a fresh-enough review.
  // -------------------------------------------------------------------------
  for (const st of stateByCp.values()) {
    if (st.withdrawn) continue;
    result.asserted++;

    const cpid = st.counterpartyId;
    const loadedAtMs = Date.parse(st.loadedAt);
    if (Number.isNaN(loadedAtMs)) continue;
    const loadedAtDate = new Date(loadedAtMs);
    const monthsSinceLoad = monthsBetween(loadedAtDate, now);

    // If the limit was loaded less than HIGH_MONTHS ago, no annual-review is
    // yet due — skip without finding.
    if (monthsSinceLoad < HIGH_MONTHS) continue;

    const lastReview = lastReviewByCp.get(cpid);
    if (!lastReview) {
      const sev = monthsSinceLoad > CRITICAL_MONTHS ? "CRITICAL" : "HIGH";
      violations.push({
        subject: `${cpid}:no-review`,
        severity: "fail",
        message: `Counterparty "${cpid}" has an active CreditLimitLoaded (as_of=${st.loadedAt}, ${monthsSinceLoad} months ago) but NO CreditLimitAnnualReviewCompleted event exists. Severity: ${sev}. PROC-RISK-CO-01 Step 7 mandates annual review within 13 months of load (HIGH at 13–15 months, CRITICAL > 15 months). Authority: D-CREDIT-LIMIT-ENGINE-BUILD; Policies/credit-risk-policy-v1.md §7.`,
      });
      continue;
    }

    const lastReviewMs = Date.parse(lastReview);
    if (Number.isNaN(lastReviewMs)) continue;
    const monthsSinceReview = monthsBetween(new Date(lastReviewMs), now);

    if (monthsSinceReview >= CRITICAL_MONTHS) {
      violations.push({
        subject: `${cpid}:review-critical`,
        severity: "fail",
        message: `Counterparty "${cpid}" CreditLimitAnnualReviewCompleted is ${monthsSinceReview} months stale (reviewedAt=${lastReview}; threshold > ${CRITICAL_MONTHS} months). Severity: CRITICAL. PROC-RISK-CO-01 Step 7. Remediation: convene CRC review; emit CreditLimitAnnualReviewCompleted({ counterpartyId, reviewYear, revisedLimit, ... }) or withdraw the limit. Authority: D-CREDIT-LIMIT-ENGINE-BUILD; Policies/credit-risk-policy-v1.md §7.`,
      });
    } else if (monthsSinceReview >= HIGH_MONTHS) {
      violations.push({
        subject: `${cpid}:review-high`,
        severity: "fail",
        message: `Counterparty "${cpid}" CreditLimitAnnualReviewCompleted is ${monthsSinceReview} months stale (reviewedAt=${lastReview}; threshold ${HIGH_MONTHS}–${CRITICAL_MONTHS} months). Severity: HIGH. PROC-RISK-CO-01 Step 7. Remediation: schedule CRC review before ${CRITICAL_MONTHS}-month critical threshold. Authority: D-CREDIT-LIMIT-ENGINE-BUILD; Policies/credit-risk-policy-v1.md §7.`,
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "credit-limit-annual-review-staleness passed — all active limits reviewed within 13 months."
        : "credit-limit-annual-review-staleness FAILED — see violations.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
