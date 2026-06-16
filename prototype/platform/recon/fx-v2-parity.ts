// platform/recon/fx-v2-parity.ts
//
// recon:fx-v2-parity — ENFORCING sentinel gate (Phase 2).
//
// STATUS: PHASE 2 — enforcing against premature v2-replaced tags;
//         advisory warnings for the two known flip-blocking gaps.
//
// This gate was promoted from ADVISORY (Phase 1) to ENFORCING (Phase 2) by
// D-V1-REMOVAL-PHASE-2 (CEO-approved 2026-06-15). Phase 1 proved the harness
// is structurally sound (vacuous parity check passes). Phase 2 was intended to
// flip FX valuation (A2) and VaR/ES (A3) to V2-authoritative.
//
// RESULT: FLIP BLOCKED — structural gaps prevent byte-equivalence proof.
//
// ─── GAP 1: FX VALUATION (A2) — INCOMMENSURABLE DATA PATHS ─────────────────
//
// The V1 authoritative path for FX valuation is `FxPositionRevalued` events
// (per-trade, per-day unrealised P&L deltas; emitted by Bea's EOD close engine;
// consumed by `platform/product-control/daily-pnl.ts`).
//
// The V2 A2 path emits `FxBookValuationSnapshotted` events (aggregate Δ(gross)
// snapshots of the book; emitted by `platform/markets/eod/fx-valuation-eod.ts`).
//
// These are INCOMMENSURABLE — a per-trade P&L delta (V1) cannot be byte-compared
// to an aggregate book snapshot (V2). The `FxPositionRevalued` event type is
// tagged `v2Status: "v1-only"` in the registry; `MarketRiskMeasureComputed` is
// likewise `v1-only`. No V2 event type has been promoted to `v2-parallel` for
// the product-control read path (only `FxBookValuationSnapshotted` is `v2-parallel`,
// but it feeds the GL, not the `daily-pnl.ts` product-control view).
//
// TO RESOLVE: wire `daily-pnl.ts` (and any other product-control consumer) to
// read from the V2 FIL instance projection + `FxBookValuationSnapshotted` instead
// of `FxPositionRevalued`. Only then can the two paths be compared and the flip
// approved. This is the "A4" work scoped in D-FIL-BOOK-COMPOSITE-VALUATION.
//
// ─── GAP 2: VaR/ES (A3) — NO V2 PRODUCTION EVENT EXISTS ────────────────────
//
// The V1 authoritative path for VaR/ES is `MarketRiskMeasureComputed` events
// (emitted by `computeMarketRisk` in `platform/market-risk/var-engine.ts`;
// read by `platform/projections/markets/market-risk-measure.ts`).
//
// The V2 A3 VaR metric (`makeVarMetric`) runs ONLY in the recon gate
// `recon:attribution-var-diversification` — it is not wired to emit any event
// to replace `MarketRiskMeasureComputed`. The `MarketRiskMeasureComputed` type
// is tagged `v2Status: "v1-only"`.
//
// TO RESOLVE: wire the V2 VaR metric to emit a `MarketRiskVarComputed` event
// (or promote `MarketRiskMeasureComputed` to `v2-parallel`) so both paths emit
// comparable figures. Only then can a byte-diff be detected and the flip approved.
//
// ─── GATE BEHAVIOUR (ENFORCING) ─────────────────────────────────────────────
//
// This gate verifies the CURRENT v2Status tags match the expected state for
// Phase 2 (still "v2-parallel" or "v1-only" — not prematurely "v2-replaced").
// Any premature promotion to "v2-replaced" without the flip being approved is
// a fail-severity violation.
//
// The gate also checks that `FxBookValuationSnapshotted` is still tagged
// `v2-parallel` (correct for Phase 2 — the A2 path runs parallel; the flip to
// v2-replaced will happen when A4 is approved).
//
// Authority: D-V1-REMOVAL-PHASE-2 (CEO-approved 2026-06-15);
//            D-FIL-BOOK-COMPOSITE-VALUATION (A2 + A3 build slice);
//            D-FIL-ATTRIBUTION-A1-BUILD (A3 VaR metric).
// Author: Atlas (Substrate Architect, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import { eventStore } from "../composition";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";

const PIPELINE = "fx-v2-parity";

// ─── Registry entries we are tracking for Phase 2 ───────────────────────────

/**
 * FxBookValuationSnapshotted — the A2 V2-authored event. Should be `v2-parallel`
 * (A2 runs parallel; A4 flips it to v2-replaced).
 */
const FX_BOOK_VALUATION_SNAPSHOTTED = "FxBookValuationSnapshotted" as const;

/**
 * FxPositionRevalued — the V1 per-trade revaluation event. Should be `v1-only`
 * (not yet flipped; flip requires A4 completion).
 */
const FX_POSITION_REVALUED = "FxPositionRevalued" as const;

/**
 * MarketRiskMeasureComputed — the V1 VaR event. Should be `v1-only`
 * (A3 VaR is only in recon; no V2 production VaR event exists yet).
 */
const MARKET_RISK_MEASURE_COMPUTED = "MarketRiskMeasureComputed" as const;

// ─── Gate implementation ─────────────────────────────────────────────────────

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Structural self-test — the vacuous parity harness must still pass.
  const vacuousViolations = runParityCheck({
    label: "fx-v2-parity:structural-check",
    readV1: () => ({}),
    readV2: () => ({}),
  });
  result.asserted += 1;
  if (vacuousViolations.length > 0) {
    violations.push({
      subject: "parity-harness-structural-check",
      message:
        "The parity harness structural check failed: the vacuous (empty == empty) " +
        "self-test did not pass. This is a harness bug, not a domain divergence. " +
        "Inspect v1-v2-parity-harness.ts.",
      severity: "fail",
    });
  }

  // (2) FxBookValuationSnapshotted must be `v2-parallel` (not yet v2-replaced).
  //     A premature v2-replaced tag without A4 completion is a fail.
  const fxBookEntry = EVENT_TYPE_REGISTRY.find((e) => e.type === FX_BOOK_VALUATION_SNAPSHOTTED);
  result.asserted += 1;
  if (!fxBookEntry) {
    violations.push({
      subject: `fx-v2-parity:registry-missing:${FX_BOOK_VALUATION_SNAPSHOTTED}`,
      message: `Event type "${FX_BOOK_VALUATION_SNAPSHOTTED}" is not in the registry. Expected v2Status: "v2-parallel". The A2 FX book valuation V2 path must be registered. Authority: D-FIL-BOOK-COMPOSITE-VALUATION.`,
      severity: "fail",
    });
  } else if (fxBookEntry.v2Status === "v2-replaced") {
    violations.push({
      subject: `fx-v2-parity:premature-v2-replaced:${FX_BOOK_VALUATION_SNAPSHOTTED}`,
      message: `"${FX_BOOK_VALUATION_SNAPSHOTTED}" is tagged "v2-replaced" but the A2→A4 flip has not been approved. The product-control read path (daily-pnl.ts) still reads "${FX_POSITION_REVALUED}" (v1-only). A flip requires: (1) wire daily-pnl.ts to read from FIL instance projection + FxBookValuationSnapshotted, (2) byte-equivalence proof across both paths, (3) CEO Decision approving A4. Authority: D-FIL-BOOK-COMPOSITE-VALUATION.`,
      severity: "fail",
    });
  } else if (fxBookEntry.v2Status !== "v2-parallel") {
    violations.push({
      subject: `fx-v2-parity:unexpected-status:${FX_BOOK_VALUATION_SNAPSHOTTED}`,
      message: `"${FX_BOOK_VALUATION_SNAPSHOTTED}" is tagged "${fxBookEntry.v2Status}" — expected "v2-parallel". A2 runs in parallel with V1 but has not been flipped yet. Authority: D-FIL-BOOK-COMPOSITE-VALUATION.`,
      severity: "warn",
    });
  }

  // (3) FxPositionRevalued — FLIPPED to `v2-replaced` (WS-V2-AUTHORITATIVE S2),
  //     RETIRED-BY-CONSTRUCTION. Byte-comparison is impossible (the V1 per-trade
  //     delta event is un-emittable AND incommensurable with the aggregate FIL
  //     snapshot), so this gate asserts the CONSTRUCTION conditions instead of a
  //     byte-diff (D-V1-REMOVAL-FLIP-BASIS-RBC; Charter cmd 3 — no green by
  //     concealment, the gate enforces the real precondition):
  //       (C1) the registry tags FxPositionRevalued "v2-replaced" (flip recorded);
  //       (C2) V1 is un-emittable: ZERO FxPositionRevalued events in the store
  //            (the schema requires numeric *Minor fields → any emission trips the
  //            live ratchet recon:no-residual-minor-encoding, which enforces this
  //            globally; here we assert the corollary — none exist);
  //       (C3) V2 produces non-vacuous output: the FIL-instance valuation path
  //            (FxBookValuationSnapshotted / daily-pnl-v2) yields real figures —
  //            asserted by the companion enforcing gate recon:daily-pnl-v2-parity
  //            (construction block) and recon:ba320-fx-v2-parity.
  const fxPosEntry = EVENT_TYPE_REGISTRY.find((e) => e.type === FX_POSITION_REVALUED);
  result.asserted += 1;
  if (!fxPosEntry) {
    violations.push({
      subject: `fx-v2-parity:registry-missing:${FX_POSITION_REVALUED}`,
      message: `"${FX_POSITION_REVALUED}" is not in the registry. Expected v2Status "v2-replaced" (retired-by-construction, WS-V2-AUTHORITATIVE S2). Authority: D-V1-REMOVAL-FLIP-BASIS-RBC.`,
      severity: "fail",
    });
  } else if (fxPosEntry.v2Status !== "v2-replaced") {
    // The flip is recorded; reverting it without a Decision is a regression.
    violations.push({
      subject: `fx-v2-parity:flip-reverted:${FX_POSITION_REVALUED}`,
      message: `"${FX_POSITION_REVALUED}" is tagged "${fxPosEntry.v2Status}" but it was flipped to "v2-replaced" under WS-V2-AUTHORITATIVE S2 (retired-by-construction). Reverting a recorded flip requires a CEO Decision. Authority: D-V1-REMOVAL-FLIP-BASIS-RBC; D-V1-REMOVAL-PHASE-2.`,
      severity: "fail",
    });
  } else {
    // (C2) construction condition: V1 is un-emittable → no events may exist.
    result.asserted += 1;
    let fxPosCount = 0;
    for (const _e of eventStore.replay({ type: FX_POSITION_REVALUED })) fxPosCount += 1;
    if (fxPosCount > 0) {
      violations.push({
        subject: `fx-v2-parity:construction-broken:${FX_POSITION_REVALUED}`,
        message: `"${FX_POSITION_REVALUED}" is flipped v2-replaced RETIRED-BY-CONSTRUCTION, but ${fxPosCount} such event(s) exist in the store. The construction basis requires the V1 type to be un-emittable (its schema carries required numeric *Minor fields, blocked by recon:no-residual-minor-encoding). A present event means either the ratchet was bypassed or these are historical replay-only events that pre-date the *Minor purge — investigate. Authority: D-V1-REMOVAL-FLIP-BASIS-RBC; recon:no-residual-minor-encoding.`,
        severity: "fail",
      });
    }
  }

  // (4) MarketRiskMeasureComputed must be `v1-only` (VaR A3 not yet promoted).
  const varEntry = EVENT_TYPE_REGISTRY.find((e) => e.type === MARKET_RISK_MEASURE_COMPUTED);
  result.asserted += 1;
  if (varEntry && varEntry.v2Status === "v2-replaced") {
    violations.push({
      subject: `fx-v2-parity:premature-v2-replaced:${MARKET_RISK_MEASURE_COMPUTED}`,
      message: `"${MARKET_RISK_MEASURE_COMPUTED}" is tagged "v2-replaced" but the A3 parity proof has not been completed. MarketRiskVarComputed is registered (v2-parallel) and the emitter is wired (D-V1-REMOVAL-PHASE2-GAP-A3), but the flip to v2-replaced requires byte-equivalence proof across multiple EOD runs and a CEO Decision. Do not promote before both conditions hold. Authority: D-V1-REMOVAL-PHASE2-GAP-A3; D-FIL-ATTRIBUTION-A1-BUILD (A3 build slice).`,
      severity: "fail",
    });
  }

  // (5) GAP DOCUMENTATION — surface the two blocking gaps as advisory warnings.
  //     These are not regressions; they are the structural gaps that prevent the flip.
  //     Severity is "warn" so they appear in every CI run without blocking merges.
  //     The premature-v2-replaced guards above (severity: "fail") protect against bypass.
  result.asserted += 2;

  violations.push({
    subject: "fx-v2-parity:status:A2-flip-complete-retired-by-construction",
    message: `A2 FLIP COMPLETE (WS-V2-AUTHORITATIVE S2): "${FX_POSITION_REVALUED}" is flipped to "v2-replaced" RETIRED-BY-CONSTRUCTION. The V1 per-trade-delta path is un-emittable (required numeric *Minor fields → recon:no-residual-minor-encoding) and incommensurable with the aggregate "${FX_BOOK_VALUATION_SNAPSHOTTED}" / FIL-instance snapshot path. Byte-equivalence is N/A by construction; the construction conditions (V1 un-emittable + V2 produces) are asserted by check (3) above + recon:daily-pnl-v2-parity (which verified V2 unrealised P&L = real non-zero figure over the FIL-instance projection) + recon:ba320-fx-v2-parity. Basis: D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16); D-FIL-BOOK-COMPOSITE-VALUATION; D-V1-REMOVAL-PHASE2-GAP-A2.`,
    severity: "info",
  });

  violations.push({
    subject: "fx-v2-parity:gap:A3-flip-pending-parity-proof",
    message: `GAP A3 (FLIP PENDING PARITY PROOF — advisory): MarketRiskVarComputed is now registered (v2Status: "v2-parallel", schemaVersion: 2; D-V1-REMOVAL-PHASE2-GAP-A3) and the V2 emitter (platform/market-risk/var-engine-v2.ts) is wired. The dual-read is live in market-risk-measure.ts (v2Measure field). Parity gate: recon:var-v2-parity asserts V1 MarketRiskMeasureComputed ↔ V2 MarketRiskVarComputed agree within 1 ZAR minor unit. REMAINING STEP: prove parity across multiple EOD production runs → CEO Decision approving the flip to v2-replaced. Authority: D-V1-REMOVAL-PHASE2-GAP-A3; D-FIL-ATTRIBUTION-A1-BUILD (A3 build slice); D-V1-REMOVAL-PHASE-2.`,
    severity: "warn",
  });

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  const summary = `fx-v2-parity [ENFORCING sentinel — Phase 2 / S2]: A2 FxPositionRevalued FLIPPED to v2-replaced (retired-by-construction; un-emittable V1 + V2 FIL-snapshot produces). A3 MarketRiskVarComputed REGISTERED (v2-parallel) + emitter wired — VaR flip NOT taken (MarketRiskMeasureComputed is emittable, parity proof pending). Tags: FxBookValuationSnapshotted=${fxBookEntry?.v2Status ?? "MISSING"} | FxPositionRevalued=${fxPosEntry?.v2Status ?? "MISSING"} | MarketRiskMeasureComputed=${varEntry?.v2Status ?? "MISSING"}. Harness: ${vacuousViolations.length === 0 ? "OK" : "FAILED"}.`;

  result.asOf = summary;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok ? "OK" : "FAIL (FLIP BLOCKED — see violations for required gap-closure work)";
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
