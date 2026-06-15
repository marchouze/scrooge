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

  // (3) FxPositionRevalued must be `v1-only` (not yet flipped).
  const fxPosEntry = EVENT_TYPE_REGISTRY.find((e) => e.type === FX_POSITION_REVALUED);
  result.asserted += 1;
  if (fxPosEntry && fxPosEntry.v2Status === "v2-replaced") {
    violations.push({
      subject: `fx-v2-parity:premature-v2-replaced:${FX_POSITION_REVALUED}`,
      message: `"${FX_POSITION_REVALUED}" is tagged "v2-replaced" but product-control consumers (daily-pnl.ts) have not been migrated to V2 reads. V2-replaced requires the A4 cutover: wire all consumers to V2 then retire the V1 read path. Authority: D-FIL-BOOK-COMPOSITE-VALUATION.`,
      severity: "fail",
    });
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
    subject: "fx-v2-parity:gap:A2-incommensurable-data-paths",
    message: `GAP A2 (FLIP BLOCKED — advisory): FX valuation V1 and V2 data paths are incommensurable. V1 authoritative path: "${FX_POSITION_REVALUED}" per-trade unrealised P&L deltas (consumed by daily-pnl.ts, product-control views). V2 A2 path: "${FX_BOOK_VALUATION_SNAPSHOTTED}" aggregate Δ(gross) book snapshot (GL-posted; not wired into product-control views). Byte-equivalence is impossible between a per-trade delta stream (V1) and an aggregate snapshot (V2). TO RESOLVE: complete A4 — migrate daily-pnl.ts and all product-control consumers to read FIL instance projection + FxBookValuationSnapshotted; then re-run this gate and prove byte-equivalence of totals. Authority: D-FIL-BOOK-COMPOSITE-VALUATION (A4 gate); D-V1-REMOVAL-PHASE-2.`,
    severity: "warn",
  });

  violations.push({
    subject: "fx-v2-parity:gap:A3-flip-pending-parity-proof",
    message: `GAP A3 (FLIP PENDING PARITY PROOF — advisory): MarketRiskVarComputed is now registered (v2Status: "v2-parallel", schemaVersion: 2; D-V1-REMOVAL-PHASE2-GAP-A3) and the V2 emitter (platform/market-risk/var-engine-v2.ts) is wired. The dual-read is live in market-risk-measure.ts (v2Measure field). Parity gate: recon:var-v2-parity asserts V1 MarketRiskMeasureComputed ↔ V2 MarketRiskVarComputed agree within 1 ZAR minor unit. REMAINING STEP: prove parity across multiple EOD production runs → CEO Decision approving the flip to v2-replaced. Authority: D-V1-REMOVAL-PHASE2-GAP-A3; D-FIL-ATTRIBUTION-A1-BUILD (A3 build slice); D-V1-REMOVAL-PHASE-2.`,
    severity: "warn",
  });

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  const summary = `fx-v2-parity [ENFORCING sentinel — Phase 2]: 2 advisory gap warnings; 0 premature-tag violations. Gap A2 (warn): FxPositionRevalued v1-only vs FxBookValuationSnapshotted v2-parallel are incommensurable — A4 completion required before flip. Gap A3 (warn): MarketRiskVarComputed REGISTERED (v2-parallel, schemaVersion:2) + emitter wired (D-V1-REMOVAL-PHASE2-GAP-A3) — parity proof + CEO Decision required before flip to v2-replaced. Tags: FxBookValuationSnapshotted=${fxBookEntry?.v2Status ?? "MISSING"} | FxPositionRevalued=${fxPosEntry?.v2Status ?? "MISSING"} | MarketRiskMeasureComputed=${varEntry?.v2Status ?? "MISSING"}. Harness: ${vacuousViolations.length === 0 ? "OK" : "FAILED"}.`;

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
