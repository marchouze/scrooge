// platform/recon/recon-mtm-vs-gl-amount-delta.ts
//
// Continuous-controls pipeline: Risk MTM P&L amounts must match Accounting GL
// postings at the transaction level (per position-day).
//
// This complements `recon:mtm-reversal-paired-with-reval` which verifies pairing
// but NOT amount agreement. A mark-entry amount mismatch passes that check silently.
//
// Algorithm:
//   1. Replay all FxPositionRevalued events; group by (tradeId, value-date);
//      sum unrealisedPnlZarMinor → riskPnlSum.
//   2. Build a sourceEventId index from all SubLedgerPostingEmitted events so
//      we can join revaluation postings back to the FxPositionRevalued event
//      that triggered them (via sourceEventId).
//   3. For each (tradeId, value-date), collect the postings whose sourceEventId
//      references an FxPositionRevalued event for that (tradeId, value-date),
//      restricted to P&L accounts (category: "income" per chart-of-accounts;
//      specifically the Unrealised FX P&L — FVTPL family).
//   4. Compute glNet = sum(credits) - sum(debits) for those P&L legs in ZAR.
//   5. Tolerance check against D-IPV-TOLERANCE-SCHEDULE-FX-SPOT tiers:
//        tier1 = 0.75%  → warn (non-failing)
//        tier2 = 1.00%  → fail (exit 1)
//      Skip check if riskPnlSum === 0 (zero-delta positions have no postings
//      and there is nothing to check).
//   6. Print summary: position-days checked, warnings, failures.
//
// What this catches:
//   - Amount mismatch between FxPositionRevalued.unrealisedPnlZarMinor and the
//     GL posting amount for the same trade-day: e.g. a rounding error in the
//     posting engine, or a reversal that netted out the wrong amount.
//   - Missing GL postings for a revaluation event (glNet = 0 while riskPnlSum ≠ 0).
//
// What this does NOT catch:
//   - Missing revaluation events for a day (→ recon:position-revalued-cites-mark).
//   - Unmatched reversal/reval pairing (→ recon:mtm-reversal-paired-with-reval).
//   - Non-FX asset classes: focuses only on FxPositionRevalued / ACC-2100-* family.
//
// Tolerance authority: D-IPV-TOLERANCE-SCHEDULE-FX-SPOT (CEO-approved 2026-05-22).
// Data-quality authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
// IFRS-9-§5.7.1: fair value changes of FVTPL instruments recognised in profit or loss.
//
// Author: Atlas (Core banking platform architect, engineering)
// Brief: brief:atlas:gap-1-implement-recon-mtm-vs-gl-amount-delta:2026-05-26

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { eventStore } from "../composition";
import type { FxPositionRevaluedPayload } from "../event-store/event-types/fx-accounting";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "mtm-vs-gl-amount-delta";

// ---------------------------------------------------------------------------
// IPV tolerance tiers (D-IPV-TOLERANCE-SCHEDULE-FX-SPOT, CEO-approved 2026-05-22)
// ---------------------------------------------------------------------------
const TIER1_RATIO = 0.0075; // 0.75% — warn
const TIER2_RATIO = 0.01; // 1.00% — fail

// ---------------------------------------------------------------------------
// P&L account identification
//
// We classify an account as a P&L/trading account if its CoA category is
// "income" — consistent with how gl-projection.ts uses the chart-of-accounts
// category field. This captures:
//   ACC-2100-005  Unrealised FX P&L — FVTPL   (income / credit-normal)
//   ACC-2100-006  Realised FX P&L              (income / credit-normal)
//   ACC-3100-005  Unrealised P&L — Bonds       (income)
//   ACC-3200-003  Unrealised P&L — Equities    (income)
//   ACC-3300-003  Unrealised P&L — IRD         (income)
//   ... and any future income accounts.
//
// We additionally restrict to postings whose sourceEventId traces to an
// FxPositionRevalued event (i.e. postingType "revaluation" or the source
// event_id is in the reval set), so we only look at MTM P&L legs.
// ---------------------------------------------------------------------------

interface CoaEntry {
  id: string;
  name: string;
  category: string;
  side: "debit" | "credit";
}

interface CoaFile {
  items?: CoaEntry[];
  accounts?: CoaEntry[];
}

let _coaCache: Map<string, CoaEntry> | null = null;

function loadCoa(): Map<string, CoaEntry> {
  if (_coaCache) return _coaCache;
  try {
    const filePath = join(import.meta.dir, "../accounting/chart-of-accounts.json");
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as CoaFile;
    const entries: CoaEntry[] = parsed.items ?? parsed.accounts ?? [];
    _coaCache = new Map(entries.map((e) => [e.id, e]));
  } catch {
    _coaCache = new Map();
  }
  return _coaCache;
}

function isPnlAccount(accountId: string): boolean {
  const coa = loadCoa();
  const entry = coa.get(accountId);
  if (!entry) return false;
  return entry.category === "income";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dayOf(asOf: string): string {
  return asOf.slice(0, 10);
}

function positionDayKey(tradeId: string, day: string): string {
  return `${tradeId}::${day}`;
}

// ---------------------------------------------------------------------------
// Phase 1: Build FxPositionRevalued index
//
// Returns:
//   revalSumByKey  — Map<positionDayKey, number>  summed unrealisedPnlZarMinor
//   revalEventDays — Map<eventId, {tradeId, day}>  used to join posting back to event
// ---------------------------------------------------------------------------

interface RevalIndex {
  revalSumByKey: Map<string, number>;
  revalEventDays: Map<string, { tradeId: string; day: string }>;
}

function buildRevalIndex(): RevalIndex {
  const revalSumByKey = new Map<string, number>();
  const revalEventDays = new Map<string, { tradeId: string; day: string }>();

  for (const e of eventStore.replay({ type: "FxPositionRevalued" })) {
    const p = e.payload as FxPositionRevaluedPayload;
    if (!p.tradeId) continue;
    const day = dayOf(e.as_of);
    const key = positionDayKey(p.tradeId, day);
    revalSumByKey.set(key, (revalSumByKey.get(key) ?? 0) + p.unrealisedPnlZarMinor);
    revalEventDays.set(e.event_id, { tradeId: p.tradeId, day });
  }

  return { revalSumByKey, revalEventDays };
}

// ---------------------------------------------------------------------------
// Phase 2: Build SubLedgerPostingEmitted index for P&L legs
//
// For each SubLedgerPostingEmitted that has sourceEventId pointing to an
// FxPositionRevalued event, sum the P&L account legs per (tradeId, day).
//
// glNetByKey: Map<positionDayKey, number> where value = sum(credits) - sum(debits)
// for P&L/income accounts, in ZAR.
// ---------------------------------------------------------------------------

function buildGlNetIndex(
  revalEventDays: Map<string, { tradeId: string; day: string }>,
): Map<string, number> {
  const glNetByKey = new Map<string, number>();

  for (const e of eventStore.replay({ type: "SubLedgerPostingEmitted" })) {
    const p = e.payload as {
      sourceEventId?: unknown;
      postingType?: unknown;
      legs?: unknown;
    };
    if (typeof p.sourceEventId !== "string") continue;

    // Only care about postings whose source is an FxPositionRevalued event.
    const reval = revalEventDays.get(p.sourceEventId);
    if (!reval) continue;

    const legs = Array.isArray(p.legs) ? p.legs : [];
    const key = positionDayKey(reval.tradeId, reval.day);

    for (const leg of legs) {
      if (
        typeof leg !== "object" ||
        leg === null ||
        typeof leg.accountId !== "string" ||
        typeof leg.debitCredit !== "string" ||
        typeof leg.amountMinor !== "number" ||
        typeof leg.currency !== "string"
      )
        continue;

      // Restrict to ZAR P&L/income accounts (revaluation entries are in functional currency ZAR).
      if (leg.currency !== "ZAR") continue;
      if (!isPnlAccount(leg.accountId)) continue;

      const prior = glNetByKey.get(key) ?? 0;
      if (leg.debitCredit === "credit") {
        glNetByKey.set(key, prior + leg.amountMinor);
      } else {
        glNetByKey.set(key, prior - leg.amountMinor);
      }
    }
  }

  return glNetByKey;
}

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface MtmVsGlAmountDeltaResult extends ReconResult {
  readonly positionDaysChecked: number;
  readonly positionDaysWarned: number;
  readonly positionDaysFailed: number;
  readonly positionDaysSkipped: number;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(): MtmVsGlAmountDeltaResult {
  const base = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const { revalSumByKey, revalEventDays } = buildRevalIndex();
  const glNetByKey = buildGlNetIndex(revalEventDays);

  let positionDaysChecked = 0;
  let positionDaysWarned = 0;
  let positionDaysFailed = 0;
  let positionDaysSkipped = 0;

  for (const [key, riskPnlSum] of revalSumByKey) {
    // Zero-delta position: no posting expected; nothing to check.
    if (riskPnlSum === 0) {
      positionDaysSkipped += 1;
      continue;
    }

    positionDaysChecked += 1;
    const glNet = glNetByKey.get(key) ?? 0;
    const delta = Math.abs(riskPnlSum - glNet);
    const ratio = delta / Math.abs(riskPnlSum);

    if (ratio > TIER2_RATIO) {
      positionDaysFailed += 1;
      violations.push({
        subject: `position-day:${key}`,
        message: `MTM vs GL amount mismatch EXCEEDS tier2 tolerance (${(TIER2_RATIO * 100).toFixed(2)}%). riskPnlSum=${riskPnlSum} glNet=${glNet} delta=${delta} ratio=${(ratio * 100).toFixed(4)}%. Citations: D-IPV-TOLERANCE-SCHEDULE-FX-SPOT; D-DATA-QUALITY-CROSS-DOMAIN-V1; IFRS-9-§5.7.1.`,
        severity: "fail",
      });
    } else if (ratio > TIER1_RATIO) {
      positionDaysWarned += 1;
      violations.push({
        subject: `position-day:${key}`,
        message: `MTM vs GL amount mismatch exceeds tier1 warning threshold (${(TIER1_RATIO * 100).toFixed(2)}%). riskPnlSum=${riskPnlSum} glNet=${glNet} delta=${delta} ratio=${(ratio * 100).toFixed(4)}%. Citations: D-IPV-TOLERANCE-SCHEDULE-FX-SPOT; D-DATA-QUALITY-CROSS-DOMAIN-V1; IFRS-9-§5.7.1.`,
        severity: "warn",
      });
    }
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  const ok = failCount === 0;

  return {
    ...base,
    asserted: positionDaysChecked,
    violations,
    ok,
    positionDaysChecked,
    positionDaysWarned,
    positionDaysFailed,
    positionDaysSkipped,
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
        positionDaysChecked: r.positionDaysChecked,
        positionDaysSkipped: r.positionDaysSkipped,
        msg: `mtm-vs-gl-amount-delta passed — ${r.positionDaysChecked} position-day(s) within tolerance; ${r.positionDaysSkipped} zero-delta skipped`,
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        level: failCount > 0 ? "error" : "warn",
        pipeline: PIPELINE,
        ok: r.ok,
        positionDaysChecked: r.positionDaysChecked,
        positionDaysWarned: r.positionDaysWarned,
        positionDaysFailed: r.positionDaysFailed,
        positionDaysSkipped: r.positionDaysSkipped,
        warnings: warnCount,
        failures: failCount,
        msg: `mtm-vs-gl-amount-delta: ${r.positionDaysFailed} position-day(s) exceed tier2 fail threshold; ${r.positionDaysWarned} exceed tier1 warn threshold`,
      }),
    );
    for (const v of r.violations) {
      console.warn(`  [${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`);
    }
  }

  if (!r.ok) process.exit(1);
}
