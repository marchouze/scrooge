// platform/recon/daily-pnl-v2-parity.ts
//
// recon:daily-pnl-v2-parity — ADVISORY parity gate for Gap A2.
//
// STATUS: ADVISORY (ok: true even with warn-severity violations).
//
// This gate compares the V1 daily P&L (latest DailyPnLReportGenerated event
// read by computeDailyPnL) against the V2 daily P&L (computeDailyPnLV2 over
// the FIL instance projection) for the anchor entity.
//
// ## Expected outcome at Phase 2 Gap A2
//
// The comparison is on totalUnrealisedPnlZarMinor only (within ≤1 ZAR minor
// unit tolerance). Realised P&L is out of scope for Gap A2 — V2 reads only
// open FIL FX instruments; settled positions' realised P&L lives in V1.
//
// Three outcomes:
//   - V2 has no FIL FX instruments: advisory gap warn, ok: true.
//   - V1 has no DailyPnLReportGenerated: ok: true (nothing to compare).
//   - Both sides have data: byte-compare totalUnrealisedPnlZarMinor ±1.
//
// The gate is ADVISORY: ok: true regardless of warn violations.
// It becomes enforcing after the parity is proved in production and the
// CEO Decision (A4) approves the flip. Authority: D-V1-REMOVAL-PHASE2-GAP-A2.
//
// ## Why advisory, not fail
//
// The V2 FIL instance projection reads FilInstrumentCreated events emitted by
// the anchor-book materialisation backfill. On a freshly seeded CI store the
// backfill may not have run, leaving the V2 side vacuous. A fail-severity gate
// over a vacuous V2 side would block every CI run that hasn't backfilled —
// that is an environment gap, not a regression. Advisory severity surfaces the
// gap for monitoring without blocking merges.
//
// Authority: D-V1-REMOVAL-PHASE2-GAP-A2 (CEO-approved 2026-06-16).
// Citations: IFRS-9-§5.7.1; IAS-21-§28; D-FIL-BOOK-COMPOSITE-VALUATION;
//            D-TRUSTED-FIGURES-PROGRAM-V1; P1-EVENTS-AS-TRUTH.
// Author: Atlas (Substrate Architect, engineering).

import { eventStore } from "../composition";
import { nowUtc } from "../core/types";
import type { DailyPnLReportGeneratedPayload } from "../event-store/event-types/product-control";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { resolveMarketDataDbPath } from "../market-data/resolve-market-data-db";
import { MarketDataStore } from "../market-data/store";
import { computeDailyPnLV2 } from "../product-control/daily-pnl-v2";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "daily-pnl-v2-parity";

/** Absolute tolerance for V1↔V2 unrealised P&L comparison: ≤1 ZAR minor unit. */
const TOLERANCE_ZAR_MINOR = 1;

// ---------------------------------------------------------------------------
// Run options (injectable for tests)
// ---------------------------------------------------------------------------

export interface RunOpts {
  /** Override the market-data store — used by tests. */
  marketData?: MarketDataStore;
  /** Override the clock — used by tests. */
  clockNow?: () => string;
}

// ---------------------------------------------------------------------------
// Gate implementation
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const clockNow = opts.clockNow ?? nowUtc;
  const marketDataStore = opts.marketData ?? new MarketDataStore(resolveMarketDataDbPath().path);

  // -------------------------------------------------------------------------
  // (0) CONSTRUCTION-CONDITION CHECK (ENFORCING) — WS-V2-AUTHORITATIVE S2.
  //
  // DailyPnLReportGenerated is flipped to "v2-replaced" RETIRED-BY-CONSTRUCTION
  // (D-V1-REMOVAL-FLIP-BASIS-RBC): its schema requires numeric *Minor fields
  // (totalUnrealisedPnlZarMinor etc.) so it is un-emittable on main (blocked by
  // recon:no-residual-minor-encoding, no allowlist). Byte-comparison against V1
  // is therefore impossible. Instead, when the type is tagged v2-replaced this
  // gate ENFORCES the two construction conditions (Charter cmd 3 — no green by
  // concealment; the byte-diff below stays advisory):
  //   (C1) V1 un-emittable → ZERO DailyPnLReportGenerated V1-engine events exist;
  //   (C2) V2 produces non-vacuous output → computeDailyPnLV2 yields ≥1 active
  //        FIL position (real figures over the FIL-instance projection).
  // The construction check only binds once the flip is recorded; before the flip
  // (v2Status !== "v2-replaced") the gate stays purely advisory.
  // -------------------------------------------------------------------------
  const dailyPnlEntry = EVENT_TYPE_REGISTRY.find((e) => e.type === "DailyPnLReportGenerated");
  const flippedRbc = dailyPnlEntry?.v2Status === "v2-replaced";

  if (flippedRbc) {
    // (C2) V2 must produce non-vacuous output on the current store.
    result.asserted += 1;
    try {
      const reportDate = clockNow().slice(0, 10);
      const v2Probe = computeDailyPnLV2(eventStore, marketDataStore, reportDate, clockNow);
      if (v2Probe.payload.activePositions <= 0) {
        violations.push({
          subject: "daily-pnl-v2-parity:construction-c2-vacuous-v2",
          message: `CONSTRUCTION BREACH (C2): DailyPnLReportGenerated is flipped v2-replaced RETIRED-BY-CONSTRUCTION but the V2 path (computeDailyPnLV2) returned 0 active FIL positions for reportDate=${reportDate} — V2 produces no output, so the flip basis "V2 sole emittable path produces real output" does not hold on this store. Run the FIL-instance backfill (bun run backfill:fil-instances) to populate the V2 anchor store. Authority: D-V1-REMOVAL-FLIP-BASIS-RBC.`,
          severity: "fail",
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      violations.push({
        subject: "daily-pnl-v2-parity:construction-c2-engine-error",
        message: `CONSTRUCTION BREACH (C2): the V2 daily-P&L engine threw while proving non-vacuous output for the v2-replaced flip: ${errMsg}. Authority: D-V1-REMOVAL-FLIP-BASIS-RBC.`,
        severity: "fail",
      });
    }
  }

  // -------------------------------------------------------------------------
  // (1) Read the V1 side: fold latest DailyPnLReportGenerated event.
  //     If no event exists → ok: true (no data to compare).
  // -------------------------------------------------------------------------
  let v1Unrealised: number | undefined;
  let v1ReportDate: string | undefined;

  try {
    const v1Events = [...eventStore.replay({ type: "DailyPnLReportGenerated" })];
    if (v1Events.length > 0) {
      // Last event in replay order is the latest report.
      const latest = v1Events[v1Events.length - 1];
      if (latest) {
        const p = latest.payload as unknown as DailyPnLReportGeneratedPayload;
        // Only compare V1 events that were generated by the V1 engine
        // (no marketDataAsOf set). V2-path events (marketDataAsOf present)
        // should not be double-counted.
        if (!p.marketDataAsOf) {
          v1Unrealised = p.totalUnrealisedPnlZarMinor;
          v1ReportDate = p.reportDate;
        }
      }
    }
  } catch {
    // DailyPnLReportGenerated not registered — treat as no V1 data.
  }

  result.asserted += 1;
  if (v1Unrealised === undefined) {
    violations.push({
      subject: "daily-pnl-v2-parity:no-v1-data",
      message:
        "No V1 DailyPnLReportGenerated event found (or all events are V2-path reports). Parity check skipped — nothing to compare against. Run the V1 daily P&L engine (runDailyPnLReport) to populate the V1 side. Advisory: ok: true. Authority: D-V1-REMOVAL-PHASE2-GAP-A2.",
      severity: "info",
    });
    result.violations = violations;
    // Construction-condition fails (C2) above are fail-severity and must not be
    // masked by the "no V1 data" advisory path (V1 is un-emittable by design).
    result.ok = violations.every((v) => v.severity !== "fail");
    result.asOf = `${PIPELINE}: no V1 data (V1 un-emittable by construction) — byte-parity skipped; construction check ${result.ok ? "PASSED" : "FAILED"}.`;
    return result;
  }

  // -------------------------------------------------------------------------
  // (2) Read the V2 side: call computeDailyPnLV2.
  // -------------------------------------------------------------------------
  const reportDate = v1ReportDate ?? clockNow().slice(0, 10);
  let v2Unrealised: number | undefined;
  let v2HasInstruments = false;

  try {
    const v2Result = computeDailyPnLV2(eventStore, marketDataStore, reportDate, clockNow);
    v2Unrealised = v2Result.payload.totalUnrealisedPnlZarMinor;
    v2HasInstruments = v2Result.payload.activePositions > 0;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    violations.push({
      subject: "daily-pnl-v2-parity:v2-engine-error",
      message: `V2 engine threw: ${errMsg}. Inspect daily-pnl-v2.ts for FilInstrumentCreated / MarketDataStore errors. Advisory: ok: true. Authority: D-V1-REMOVAL-PHASE2-GAP-A2.`,
      severity: "warn",
    });
    result.violations = violations;
    result.ok = true;
    result.asOf = `${PIPELINE}: V2 engine error — ${errMsg}.`;
    return result;
  }

  result.asserted += 1;

  // -------------------------------------------------------------------------
  // (3) V2 has no FIL FX instruments: advisory gap warn.
  // -------------------------------------------------------------------------
  if (!v2HasInstruments) {
    violations.push({
      subject: "daily-pnl-v2-parity:gap:no-v2-instruments",
      message: `ADVISORY GAP: V2 FIL instance projection returned 0 open FX instruments for reportDate=${reportDate}. The FilInstrumentCreated backfill has not yet populated the V2 anchor store with FIL FX instances. V1 totalUnrealisedPnlZarMinor=${v1Unrealised}. TO RESOLVE: run the anchor-book FIL instance materialisation backfill to emit FilInstrumentCreated events for all open FX trades, then re-run this gate. The snapshot-anchored approach is now wired in daily-pnl-v2.ts; recon:daily-pnl-v2-parity advisory gate is live. Remaining step: parity proof in production then flip Decision (FxPositionRevalued → v2-replaced). Authority: D-V1-REMOVAL-PHASE2-GAP-A2; D-FIL-BOOK-COMPOSITE-VALUATION.`,
      severity: "warn",
    });
    result.violations = violations;
    result.ok = violations.every((v) => v.severity !== "fail");
    result.asOf = `${PIPELINE} [ADVISORY — Gap A2]: V2 has no FIL FX instruments. V1 unrealised: ${v1Unrealised} ZAR minor. Parity proof pending instrument backfill.`;
    return result;
  }

  // -------------------------------------------------------------------------
  // (4) Both sides have data: compare totalUnrealisedPnlZarMinor ±1.
  // -------------------------------------------------------------------------
  result.asserted += 1;
  const delta = Math.abs(v1Unrealised - (v2Unrealised ?? 0));

  if (delta > TOLERANCE_ZAR_MINOR) {
    violations.push({
      subject: "daily-pnl-v2-parity:unrealised-mismatch",
      message: `V1↔V2 unrealised P&L mismatch for reportDate=${reportDate}: V1 totalUnrealisedPnlZarMinor=${v1Unrealised}, V2 totalUnrealisedPnlZarMinor=${v2Unrealised} (delta=${delta} ZAR minor, tolerance=±${TOLERANCE_ZAR_MINOR}). Inspect daily-pnl-v2.ts: verify FCY-cash Valuable observable lookup, signedNotional derivation, and MarketDataStore provenance (production only). Compare against V1 FxPositionRevalued events for the same date. Advisory: ok: true until A4 flip approved. Authority: D-V1-REMOVAL-PHASE2-GAP-A2; D-TRUSTED-FIGURES-PROGRAM-V1.`,
      severity: "warn",
    });
  }

  // ADVISORY gate: ok = true even when there are warn violations.
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  const failCount = violations.filter((v) => v.severity === "fail").length;
  const warnCount = violations.filter((v) => v.severity === "warn").length;
  result.asOf = `${PIPELINE} [ADVISORY — Gap A2]: V1 unrealised=${v1Unrealised} ZAR minor, V2 unrealised=${v2Unrealised} ZAR minor, delta=${delta} (tolerance=±${TOLERANCE_ZAR_MINOR}). ${failCount} fail, ${warnCount} warn violations. Parity ${delta <= TOLERANCE_ZAR_MINOR ? "HOLDS" : "DIVERGES (advisory)"}.`;

  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok ? "OK (advisory — see violations for gap-closure status)" : "FAIL";
  process.stdout.write(`\nrecon:${PIPELINE} ${label}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
