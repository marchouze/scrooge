// platform/recon/fx-lifecycle-parity.ts
//
// Continuous-controls pipeline: every non-cancelled FxTradeExecuted must have
// at least one FxSettlementInstructed (and, for past-settlement-date trades,
// a SettlementConfirmed).
//
// ─── WHAT THIS ASSERTS ───────────────────────────────────────────────────────
//
// For every `FxTradeExecuted` that:
//   - has no corresponding `FxTradeCancelled`, AND
//   - has no corresponding `FxSettlementInstructed` (by tradeId)
//
// emit a FAIL violation. This is the lifecycle-parity gap (the root cause
// being seed/fixture trades emitted via direct `store.append` bypassing
// `runPostTradeLifecycle`).
//
// Additional advisory (warn) check: trades that are fully instructed but
// have no `SettlementConfirmed` and whose settlement date is in the past
// (> cutoff days ago) — these indicate a settled-but-unconfirmed gap that
// may be a bug or a missing `settleMaturedTrades` run.
//
// ─── CUTOFF ──────────────────────────────────────────────────────────────────
//
// The assertion applies to trades whose `legs[0].settlementDate.iso` ≤ today.
// Future-dated trades are instructed-but-not-yet-settled (correct lifecycle
// state while the trade awaits T+2); excluding them from FAIL keeps the gate
// green during normal operation. Future-dated uninstructed trades are still
// flagged as FAIL — there is no reason a trade should be executed but not
// instructed regardless of its settlement date.
//
// ─── AUTHORITY ────────────────────────────────────────────────────────────────
//
//   D-FX-CLS-MEMBERSHIP        — settlement lifecycle obligations
//   D-MARKETS-SCHEMA-FOUNDATION — CDM FX event shapes
//   Principle 1                — events are the only source of truth
//   Principle 6                — autonomous by default (recon is a standing gate)
//
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-lifecycle-parity";

// ---------------------------------------------------------------------------
// Cutoff for "instructed but not confirmed" advisory check.
// Trades settled more than this many days ago with no SettlementConfirmed
// are flagged at warn severity.
// ---------------------------------------------------------------------------
const UNCONFIRMED_ADVISORY_DAYS = 3;

// ---------------------------------------------------------------------------
// Extended result type
// ---------------------------------------------------------------------------

export interface FxLifecycleParityResult extends ReconResult {
  /** FxTradeExecuted events examined (excludes cancelled). */
  readonly tradesChecked: number;
  /** Trades with no FxSettlementInstructed — FAIL. */
  readonly uninstructedCount: number;
  /** Trades instructed but with no SettlementConfirmed past the advisory cutoff — WARN. */
  readonly unconfirmedAdvisoryCount: number;
  /** Trades cancelled (excluded from checks). */
  readonly cancelledCount: number;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(): FxLifecycleParityResult {
  const base = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const todayIso = new Date().toISOString().slice(0, 10);
  const advisoryCutoff = subtractDays(todayIso, UNCONFIRMED_ADVISORY_DAYS);

  // -------------------------------------------------------------------------
  // Build indexes from a single replay pass.
  // -------------------------------------------------------------------------

  interface TradeInfo {
    tradeId: string;
    settlementDateIso: string;
  }

  const trades = new Map<string, TradeInfo>();
  const instructed = new Set<string>();
  const confirmed = new Set<string>();
  const cancelled = new Set<string>();

  for (const e of eventStore.replay({})) {
    switch (e.type) {
      case "FxTradeExecuted": {
        const p = e.payload as Record<string, unknown>;
        const rawId = p.tradeId as { value?: string } | string | undefined;
        const tradeId = typeof rawId === "string" ? rawId : rawId?.value;
        if (!tradeId) break;
        // Extract settlement date from legs[0] (canonical location per backfill).
        const legs = p.legs as Array<Record<string, unknown>> | undefined;
        const leg0 = legs?.[0];
        const settlementDateIso =
          (leg0?.settlementDate as { iso?: string } | undefined)?.iso ?? "";
        trades.set(tradeId, { tradeId, settlementDateIso });
        break;
      }
      case "FxSettlementInstructed": {
        const p = e.payload as Record<string, unknown>;
        const rawId = p.tradeId as { value?: string } | string | undefined;
        const tradeId = typeof rawId === "string" ? rawId : rawId?.value;
        if (tradeId) instructed.add(tradeId);
        break;
      }
      case "SettlementConfirmed": {
        const id = (e.payload as { tradeId?: string }).tradeId;
        if (id) confirmed.add(id);
        break;
      }
      case "FxTradeCancelled": {
        const id = (e.payload as { tradeId?: string }).tradeId;
        if (id) cancelled.add(id);
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Assert lifecycle parity.
  // -------------------------------------------------------------------------

  let tradesChecked = 0;
  let uninstructedCount = 0;
  let unconfirmedAdvisoryCount = 0;
  let failCount = 0;

  for (const [tradeId, info] of trades) {
    if (cancelled.has(tradeId)) continue;
    tradesChecked++;

    // FAIL: no FxSettlementInstructed (regardless of settlement date).
    if (!instructed.has(tradeId)) {
      uninstructedCount++;
      failCount++;
      violations.push({
        subject: `trade:${tradeId}`,
        message:
          `FX lifecycle parity violation: FxTradeExecuted (tradeId=${tradeId}, settlementDate=${info.settlementDateIso}) has no FxSettlementInstructed. ` +
          `Seed/fixture trades emitted via direct store.append bypass runPostTradeLifecycle. ` +
          `Run backfill-fx-post-trade-lifecycle to repair. ` +
          `Authority: D-FX-CLS-MEMBERSHIP, D-MARKETS-SCHEMA-FOUNDATION.`,
        severity: "fail",
      });
      continue;
    }

    // WARN: instructed but no SettlementConfirmed and settlement date is past the advisory cutoff.
    if (!confirmed.has(tradeId) && info.settlementDateIso && info.settlementDateIso <= advisoryCutoff) {
      unconfirmedAdvisoryCount++;
      violations.push({
        subject: `trade:${tradeId}`,
        message:
          `FX lifecycle advisory: FxTradeExecuted (tradeId=${tradeId}, settlementDate=${info.settlementDateIso}) is instructed but has no SettlementConfirmed, and settlementDate ≤ today − ${UNCONFIRMED_ADVISORY_DAYS} days (cutoff=${advisoryCutoff}). ` +
          `This trade may be awaiting settleMaturedTrades or a correspondent confirmation. ` +
          `Investigate if the trade remains unconfirmed beyond normal processing windows. ` +
          `Authority: D-FX-CLS-MEMBERSHIP.`,
        severity: "warn",
      });
    }
  }

  const ok = failCount === 0;

  return {
    ...base,
    ok,
    asserted: tradesChecked,
    violations,
    tradesChecked,
    uninstructedCount,
    unconfirmedAdvisoryCount,
    cancelledCount: cancelled.size,
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
        tradesChecked: r.tradesChecked,
        cancelledCount: r.cancelledCount,
        uninstructedCount: r.uninstructedCount,
        unconfirmedAdvisoryCount: r.unconfirmedAdvisoryCount,
        msg: "fx-lifecycle-parity: all non-cancelled FxTradeExecuted have FxSettlementInstructed",
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        level: failCount > 0 ? "error" : "warn",
        pipeline: PIPELINE,
        ok: r.ok,
        tradesChecked: r.tradesChecked,
        cancelledCount: r.cancelledCount,
        uninstructedCount: r.uninstructedCount,
        unconfirmedAdvisoryCount: r.unconfirmedAdvisoryCount,
        failures: failCount,
        warnings: warnCount,
        msg:
          failCount > 0
            ? `fx-lifecycle-parity: ${r.uninstructedCount} trade(s) have no FxSettlementInstructed — run backfill-fx-post-trade-lifecycle to repair`
            : `fx-lifecycle-parity: ${r.unconfirmedAdvisoryCount} instructed trade(s) lack SettlementConfirmed past the ${UNCONFIRMED_ADVISORY_DAYS}-day advisory cutoff`,
      }),
    );
    for (const v of r.violations) {
      if (v.severity === "fail") {
        console.error(`  [FAIL] ${v.subject}: ${v.message}`);
      } else {
        console.warn(`  [WARN] ${v.subject}: ${v.message}`);
      }
    }
  }

  if (!r.ok) process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function subtractDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
