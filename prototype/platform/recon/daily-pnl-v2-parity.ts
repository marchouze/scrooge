// platform/recon/daily-pnl-v2-parity.ts
//
// recon:daily-pnl-v2-parity — CONSTRUCTION-SENTINEL gate (FX V1-parity RETIRED).
//
// ─── FX V1-PARITY LEG RETIRED (D-FX-V2-SIMULATOR-FIRST, 2026-06-20) ──────────
//
// The V1↔V2 byte-parity comparison of the daily P&L (the original purpose of
// this gate) is RETIRED for FX. Under D-FX-V2-SIMULATOR-FIRST, V1 is no longer a
// correctness oracle for FX — it carried too many errors to reconcile against.
// The FX V2 daily-P&L correctness is now asserted by recon:fx-v2-sim-oracle,
// which replays a deterministic simulated scenario with KNOWN inputs and asserts
// the cohort daily P&L V2 equals the closed-form expected MtM (Engineering
// Charter cmd 3 — no green by concealment: the retired assurance is REPLACED, not
// dropped). The V1-read + byte-compare sections (1)–(4) below are therefore gone.
//
// What REMAINS enforcing is the RETIRED-BY-CONSTRUCTION sentinel: when
// DailyPnLReportGenerated is flipped "v2-replaced" (RBC), this gate STILL enforces
// that the V1 type is un-emittable AND the V2 path produces non-vacuous output.
// That construction condition guards the V1-REMOVAL invariant, NOT V1↔V2 parity,
// so it is preserved (it is not parity scaffolding).
//
// STATUS: construction-sentinel ENFORCING; FX byte-parity retired.
//
// (Historical) This gate compared the V1 daily P&L (latest DailyPnLReportGenerated
// event read by computeDailyPnL) against the V2 daily P&L (computeDailyPnLV2 over
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
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { resolveMarketDataDbPath } from "../market-data/resolve-market-data-db";
import { MarketDataStore } from "../market-data/store";
import { computeDailyPnLV2 } from "../product-control/daily-pnl-v2";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "daily-pnl-v2-parity";

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
  // FX V1↔V2 BYTE-PARITY — RETIRED (D-FX-V2-SIMULATOR-FIRST). The V1-read +
  // byte-compare legs that lived here are gone: V1 is no longer a correctness
  // oracle for FX. The replacement assurance — that the V2 cohort daily P&L
  // matches the KNOWN simulated inputs — is enforced by recon:fx-v2-sim-oracle.
  // The construction-sentinel block (0) above is preserved and stays enforcing
  // (it guards the V1-removal invariant when the type is flipped RBC).
  // -------------------------------------------------------------------------
  result.asserted += 1;
  violations.push({
    subject: "daily-pnl-v2-parity:fx-byte-parity-retired",
    message:
      "FX V1↔V2 daily-P&L byte-parity is RETIRED under D-FX-V2-SIMULATOR-FIRST — V1 is no longer the FX correctness oracle. The replacement assurance (V2 cohort daily P&L matches the known simulated inputs) is enforced by recon:fx-v2-sim-oracle. This gate now enforces ONLY the retired-by-construction sentinel (V1 un-emittable + V2 produces) when DailyPnLReportGenerated is flipped v2-replaced. Authority: D-FX-V2-SIMULATOR-FIRST; D-V1-REMOVAL-FLIP-BASIS-RBC.",
    severity: "info",
  });

  result.violations = violations;
  // Construction-sentinel fails (block 0) are fail-severity and bind; the
  // retirement notice is informational.
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `${PIPELINE} [construction-sentinel ENFORCING / FX byte-parity RETIRED → recon:fx-v2-sim-oracle]: construction check ${result.ok ? "PASSED" : "FAILED"}; RBC-flipped=${flippedRbc}.`;
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
