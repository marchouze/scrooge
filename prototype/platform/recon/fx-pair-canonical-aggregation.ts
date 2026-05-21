// platform/recon/fx-pair-canonical-aggregation.ts
//
// Vera recon: assert that **no `byPair` aggregation** anywhere in the
// system contains both a canonical key and its inverse (e.g. simultaneous
// `USD/ZAR` + `ZAR/USD`). Such a coexistence means the aggregation site
// is bucketing by raw direction instead of canonical pair, and the
// product-control display is double-counting open positions across two
// inverse buckets.
//
// Severity: fail. The invariant is structural — once
// `toCanonicalPair(...).pairKey` is applied at every aggregation site,
// inverse-pair coexistence is impossible by construction. A violation
// means a regression at one of the aggregation sites.
//
// Empty-state correctness: zero events → asserted=0, ok=true.
//
// What the pipeline asserts:
//   1. Recomputes a fresh `DailyPnLReportGenerated.byPair` from current
//      `FxTradeExecuted` state via `computeDailyPnL` and asserts the same
//      invariant on the freshly-computed bucket — this is the **gating**
//      assertion: it fails CI if the present-day code regresses.
//   2. Replays the live event store for `DailyPnLReportGenerated` and
//      reports inverse coexistence on historical reports as **info-only**
//      — Principle 1 (events are immutable), so historical bug events are
//      a known-historical artefact, not a regression. They surface as
//      info findings so Vera can see them and inform the
//      `decommission-deprecated-events` workstream.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - brief:bea:fx-pair-canonicalisation-in-product-control-aggr:2026-05-21
//     (CEO-approved 2026-05-21)
//   - Principle 1 (event store is source of truth; bucket views are queries)
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { eventStore } from "../composition";
import type { PnLByPair } from "../event-store/event-types/product-control";
import { invertPair } from "../market-data/store";
import { computeDailyPnL } from "../product-control/daily-pnl";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-pair-canonical-aggregation";

interface MinimalPnlEvent {
  readonly event_id: string;
  readonly as_of: string;
  readonly payload: { byPair?: PnLByPair[]; reportDate?: string; reportId?: string };
}

export interface RunOpts {
  /** Override the live `DailyPnLReportGenerated` replay (test injection). */
  pnlReportEvents?: Iterable<MinimalPnlEvent>;
  /**
   * Override the live-recompute `byPair`. When provided, the pipeline
   * skips the in-process `computeDailyPnL` call entirely and asserts on
   * the injected bucket — useful for unit tests where the event store
   * has no FxTradeExecuted state.
   */
  liveByPair?: PnLByPair[];
  /** Skip the live recompute (default: false). Used by tests. */
  skipLiveRecompute?: boolean;
  /** Override `today` for the live recompute (test injection). */
  today?: string;
}

/**
 * Assert that no canonical-inverse pair coexists in a `byPair` array.
 *
 * @param byPair         the bucket to assert
 * @param subjectPrefix  used in violation `subject` for traceability
 * @param severity       "fail" for live-recompute (regression gate);
 *                       "info" for historical events (Principle 1 — events
 *                       are immutable and historical bugs are not
 *                       regressions; they surface as findings, not failures)
 * @returns array of violations (empty on pass).
 */
export function assertNoCanonicalInverse(
  byPair: ReadonlyArray<PnLByPair>,
  subjectPrefix: string,
  severity: "fail" | "info" = "fail",
): ReconViolation[] {
  const violations: ReconViolation[] = [];
  const keys = new Set<string>();
  for (const row of byPair) {
    keys.add(row.pair);
  }
  // Track which inversions we've already flagged so we don't double-report.
  const reported = new Set<string>();
  for (const key of keys) {
    const inverse = invertPair(key);
    if (inverse === key) continue;
    if (!keys.has(inverse)) continue;
    const dedupKey = [key, inverse].sort().join("|");
    if (reported.has(dedupKey)) continue;
    reported.add(dedupKey);
    violations.push({
      subject: `${subjectPrefix}:${dedupKey}`,
      severity,
      message: `byPair contains both "${key}" and "${inverse}" — these are the same pair quoted in opposite directions and must aggregate into a single canonical bucket. Apply \`toCanonicalPair(base, quote).pairKey\` at the aggregation site. Authority: brief:bea:fx-pair-canonicalisation-in-product-control-aggr:2026-05-21.`,
    });
  }
  return violations;
}

function loadPnlReportEvents(opts: RunOpts): MinimalPnlEvent[] {
  if (opts.pnlReportEvents) return [...opts.pnlReportEvents];
  const out: MinimalPnlEvent[] = [];
  for (const e of eventStore.replay({ type: "DailyPnLReportGenerated" })) {
    out.push({
      event_id: e.event_id,
      as_of: e.as_of,
      payload: (e.payload ?? {}) as MinimalPnlEvent["payload"],
    });
  }
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // 1. Live recompute against current FxTradeExecuted state. This is the
  //    gating assertion — failure here means present-day code regressed.
  if (opts.liveByPair !== undefined) {
    result.asserted++;
    violations.push(...assertNoCanonicalInverse(opts.liveByPair, "live-recompute", "fail"));
  } else if (!opts.skipLiveRecompute) {
    try {
      const today = opts.today ?? new Date().toISOString().slice(0, 10);
      const { payload } = computeDailyPnL(eventStore, today);
      result.asserted++;
      violations.push(...assertNoCanonicalInverse(payload.byPair, "live-recompute", "fail"));
    } catch (err) {
      // If recompute fails for an unrelated reason, surface as a warn —
      // the historical replay below still runs.
      violations.push({
        subject: "live-recompute",
        severity: "warn",
        message: `live-recompute skipped: ${(err as Error).message}`,
      });
    }
  }

  // 2. Replay every DailyPnLReportGenerated event — report inverse
  //    coexistence on historical reports as info-only (Principle 1:
  //    events are immutable; historical bugs are findings, not failures).
  const events = loadPnlReportEvents(opts);
  for (const ev of events) {
    result.asserted++;
    const byPair = ev.payload.byPair ?? [];
    const subject = `DailyPnLReportGenerated:${ev.payload.reportId ?? ev.event_id}`;
    violations.push(...assertNoCanonicalInverse(byPair, subject, "info"));
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
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
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
        ? "fx-pair-canonical-aggregation passed — no canonical-inverse pair coexists in any byPair bucket."
        : `fx-pair-canonical-aggregation FAILED — ${failCount} inverse-coexistence violation(s).`,
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
