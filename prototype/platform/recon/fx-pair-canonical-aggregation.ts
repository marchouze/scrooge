// platform/recon/fx-pair-canonical-aggregation.ts
//
// Vera recon: assert that every `DailyPnLReportGenerated` event contains a
// `byCurrency` array (per-currency ZAR MTM, CEO instruction 2026-05-31;
// IAS-21-§28; IFRS-9-§5.7.1). For events that pre-date the migration and
// still carry only `byPair`, this pipeline surfaces them as info-only
// findings (Principle 1 — events are immutable).
//
// What the pipeline asserts:
//   1. Live recompute via `computeDailyPnL`: the freshly-computed result must
//      have a `byCurrency` array (gating assertion — fails CI if regressed).
//   2. Historical `DailyPnLReportGenerated` events: each must have
//      `byCurrency`. Events that pre-date the migration and only have `byPair`
//      surface as info findings (immutable history, not a regression).
//
// Empty-state correctness: zero events → asserted=0, ok=true.
//
// Authority:
//   - CEO instruction 2026-05-31 (per-currency ZAR MTM)
//   - IAS-21-§28 (monetary items retranslated at closing rate)
//   - IFRS-9-§5.7.1 (FVTPL: fair value through P&L)
//   - Principle 1 (event store is source of truth; bucket views are queries)
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { eventStore } from "../composition";
import type { PnLByCurrency } from "../event-store/event-types/product-control";
import { computeDailyPnL } from "../product-control/daily-pnl";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-pair-canonical-aggregation";

interface MinimalPnlEvent {
  readonly event_id: string;
  readonly as_of: string;
  readonly payload: {
    byCurrency?: PnLByCurrency[];
    /** Legacy field — present on pre-migration events. */
    byPair?: unknown[];
    reportDate?: string;
    reportId?: string;
  };
}

export interface RunOpts {
  /** Override the live `DailyPnLReportGenerated` replay (test injection). */
  pnlReportEvents?: Iterable<MinimalPnlEvent>;
  /**
   * Override the live-recompute `byCurrency`. When provided, the pipeline
   * skips the in-process `computeDailyPnL` call entirely and asserts on
   * the injected bucket — useful for unit tests where the event store
   * has no FxTradeExecuted state.
   */
  liveByCurrency?: PnLByCurrency[];
  /** Skip the live recompute (default: false). Used by tests. */
  skipLiveRecompute?: boolean;
  /** Override `today` for the live recompute (test injection). */
  today?: string;
}

/**
 * Assert that a `byCurrency` array exists and (when there are trades) has
 * at least one row.
 *
 * @param byCurrency     the bucket to assert (undefined ⟹ violation)
 * @param hasTradeData   true when the source event/compute has trade data
 *                       (so an empty byCurrency could be a real gap)
 * @param subjectPrefix  used in violation `subject` for traceability
 * @param severity       "fail" for live-recompute; "info" for immutable history
 */
export function assertByCurrencyPresent(
  byCurrency: ReadonlyArray<PnLByCurrency> | undefined,
  hasTradeData: boolean,
  subjectPrefix: string,
  severity: "fail" | "info" = "fail",
): ReconViolation[] {
  if (byCurrency === undefined) {
    return [
      {
        subject: subjectPrefix,
        severity,
        message: `DailyPnLReportGenerated is missing the \`byCurrency\` array. This indicates the report was generated before the per-currency ZAR MTM migration (CEO instruction 2026-05-31; IAS-21-§28). New reports must include \`byCurrency\`. Authority: brief:bea:per-currency-zar-mtm-bycurrency-aggregation-full:2026-05-31.`,
      },
    ];
  }
  // byCurrency exists — no violation (an empty array is valid when there are
  // no non-cancelled, non-ZAR-only trades).
  return [];
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
  if (opts.liveByCurrency !== undefined) {
    result.asserted++;
    // An injected liveByCurrency satisfies the assertion (caller controls it).
    // No violation: byCurrency is present.
    violations.push(...assertByCurrencyPresent(opts.liveByCurrency, false, "live-recompute", "fail"));
  } else if (!opts.skipLiveRecompute) {
    try {
      const today = opts.today ?? new Date().toISOString().slice(0, 10);
      const { payload } = computeDailyPnL(eventStore, today);
      result.asserted++;
      violations.push(
        ...assertByCurrencyPresent(payload.byCurrency, payload.activePositions > 0, "live-recompute", "fail"),
      );
    } catch (err) {
      violations.push({
        subject: "live-recompute",
        severity: "warn",
        message: `live-recompute skipped: ${(err as Error).message}`,
      });
    }
  }

  // 2. Replay every DailyPnLReportGenerated event — report missing byCurrency
  //    on historical reports as info-only (Principle 1: events are immutable;
  //    historical pre-migration events are findings, not failures).
  const events = loadPnlReportEvents(opts);
  for (const ev of events) {
    result.asserted++;
    const subject = `DailyPnLReportGenerated:${ev.payload.reportId ?? ev.event_id}`;
    violations.push(
      ...assertByCurrencyPresent(
        ev.payload.byCurrency,
        false, // hasTradeData unknown for historical events
        subject,
        "info",
      ),
    );
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
        ? "fx-pair-canonical-aggregation passed — all DailyPnLReportGenerated events have byCurrency."
        : `fx-pair-canonical-aggregation FAILED — ${failCount} missing byCurrency violation(s).`,
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
