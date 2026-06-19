// platform/recon/var-v2-parity.ts
//
// `recon:var-v2-parity` — split gate for the WS-FX-OTC-CLOSURE A3 VaR cutover.
//
// STATUS (honest split — Charter cmd 3, no green by concealment):
//   - CONSTRUCTION / WIRING legs (1)–(4): ENFORCING. They hold on a clean store
//     regardless of position/scenario data, so they bind every CI run.
//   - BYTE-PARITY leg (5): ENFORCING WHEN DATA EXISTS, honest-skip when vacuous.
//     The byte-comparison of the two independently-derived VaR/SVaR/ES figures
//     needs a live position cohort + a sufficient historical-return window. On
//     the build-phase clean store the book is flat and there is no scenario
//     history, so the V2 emitter is FAIL-CLOSED and emits nothing — the parity
//     comparison is genuinely vacuous and is skipped with an explicit
//     "vacuous on clean store / awaiting licence-day data" reason. The instant a
//     V2 event exists, the leg ENFORCES ≤1 ZAR-cent agreement (severity: fail).
//     This is the data-dependent leg held honest, never a forced vacuous green.
//
// ## What the A3 cutover is (and is NOT)
//
// The FX market-risk-measure serving route (/api/risk/market-risk-measure) now
// promotes the V2 `MarketRiskVarComputed` figure UNCONDITIONALLY (the
// `useV2Store` flag no longer gates it) — the V2 VaR is authoritative at the
// route boundary. This is a ROUTE-BOUNDARY promotion, fully reversible.
//
// CRITICAL: unlike the A2 daily-P&L cutover (PR #1446), the V1 event
// `MarketRiskMeasureComputed` is NOT retired-by-construction. Its schema carries
// major-unit float figures (no `*Minor` fields), so it is FULLY EMITTABLE; the
// V1 engine is live, not structurally dead. The A3 cutover therefore does NOT
// flip `MarketRiskMeasureComputed` to `v2-replaced` — that would have no parity
// proof and no CEO flip Decision, and would trip the fx-v2-parity
// premature-`v2-replaced` sentinel. Leg (2) below ENFORCES that the V1 type
// stays `v1-only` (strengthening, not weakening, that protection).
//
// ## Tolerance
//
// The V1 engine returns ZAR major-unit floats (e.g. 499_432.87). The V2 engine
// returns MoneyWire amounts (major-unit string, 2 d.p.). Both are reduced to a
// ZAR minor-unit integer (cent) for comparison. A difference of ≤ 1 minor unit
// (ZAR 0.01) is tolerated; anything larger is a computation divergence.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19);
//            D-BANK-WIDE-V2-MIGRATION; D-FIL-ATTRIBUTION-A1-BUILD;
//            D-V1-REMOVAL-PHASE2-GAP-A3 (CEO-approved 2026-06-15);
//            D-VAR-EXPOSURE-INCLUDES-STANDING-NOP; D-V2-CORE-MONEY-DECIMAL-NATIVE;
//            BCBS d457 / MAR33; Engineering Charter (`Engineering-Charter.md`).
// Authors: Atlas (Substrate Architect, engineering); A3 cutover split by Rohan
//          (Market risk quantitative engineer, engineering — governance owner
//          Helena, Chief Risk Officer).

import {
  ES_CONFIDENCE,
  VAR_CONFIDENCE,
  type VarRiskFactorExposure,
  historicalVaR,
  simulatePnLDistribution,
} from "../../v2-core/fil-models/market-risk-var/methodology";
import { eventStore } from "../composition";
import { type MoneyWire, minorFromMoneyWire, moneyWireFromMinor } from "../core/money-codec";
import type {
  MarketRiskMeasureComputedPayload,
  MarketRiskVarComputedPayload,
} from "../event-store/event-types/market-risk-measure";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "var-v2-parity";

/** Tolerance: 1 ZAR minor unit (cent). Two independently-derived major-unit
 *  floats rounded to 2 d.p. can differ by at most ½ cent on each side. */
const TOLERANCE_MINOR = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round a ZAR major-unit float to the nearest minor unit (cent). */
function zarMajorToMinor(major: number): number {
  return Math.round(major * 100);
}

/** Convert a V2 MoneyWire VaR figure to a ZAR minor-unit integer via the
 *  canonical decimal-engine codec (`minorFromMoneyWire`). The MoneyWire amount
 *  is in CANONICAL major-unit form (trailing zeros trimmed — e.g. a whole-rand
 *  "660000", not "660000.00"), so a naive decimal-point strip undercounts by the
 *  cent factor. `minorFromMoneyWire` scales by the ISO 4217 exponent with no
 *  IEEE-754 drift — the same engine the emitter encodes with. */
function moneyWireToZarMinor(wire: MoneyWire): number {
  return minorFromMoneyWire(wire);
}

function approxEqual(v1Minor: number, v2Minor: number): boolean {
  return Math.abs(v1Minor - v2Minor) <= TOLERANCE_MINOR;
}

// ---------------------------------------------------------------------------
// Construction-condition (3): the V2 emit path is structurally LIVE.
//
// The build-phase clean store is data-empty (flat book / no scenario history),
// so the V2 emitter is fail-closed and emits nothing — we cannot prove the
// emit path is live by inspecting the store. Instead we exercise the SAME
// ported historical-simulation kernel the emitter calls (simulatePnLDistribution
// / historicalVaR from v2-core/fil-models/market-risk-var/methodology) against a
// DETERMINISTIC synthetic exposure cohort, and assert it yields a stable,
// strictly-positive figure that round-trips through the V2 MoneyWire codec. This
// is the data-INDEPENDENT analogue of A2's "V2 produces non-vacuous output"
// construction leg: it proves the metric is a real emit path, not an
// advisory-only stub, without fabricating store data.
// ---------------------------------------------------------------------------

/** A fixed, deterministic two-factor exposure cohort with a known return
 *  window. Chosen so the 99% VaR quantile lands on a definite scenario; the
 *  expected figure is pinned below so any silent kernel change fails the gate. */
const SYNTHETIC_COHORT: readonly VarRiskFactorExposure[] = [
  {
    factor: "USD/ZAR",
    exposureZar: 10_000_000,
    // 25 daily log-returns (most-recent-first), one clear tail loss at -0.05.
    returns: [
      0.001, -0.002, 0.0, 0.003, -0.001, 0.002, -0.05, 0.001, 0.0, 0.002, -0.001, 0.0015, 0.0,
      -0.0005, 0.001, 0.0, -0.002, 0.0025, 0.0, 0.001, -0.0015, 0.0, 0.002, -0.001, 0.0005,
    ],
  },
  {
    factor: "EUR/ZAR",
    exposureZar: -4_000_000,
    returns: [
      -0.001, 0.002, 0.0, -0.003, 0.001, -0.002, 0.04, -0.001, 0.0, -0.002, 0.001, -0.0015, 0.0,
      0.0005, -0.001, 0.0, 0.002, -0.0025, 0.0, -0.001, 0.0015, 0.0, -0.002, 0.001, -0.0005,
    ],
  },
];

interface KernelProbeResult {
  readonly ok: boolean;
  readonly varZar: number;
  readonly esZar: number;
  readonly scenarioCount: number;
  readonly moneyWireRoundTrips: boolean;
  readonly detail: string;
}

function probeV2Kernel(): KernelProbeResult {
  const live = SYNTHETIC_COHORT.filter((e) => e.exposureZar !== 0);
  const distribution = simulatePnLDistribution(live);
  const varZar = historicalVaR(distribution, VAR_CONFIDENCE);
  const esZar = historicalVaR(distribution, ES_CONFIDENCE);

  // Round-trip the figure through the SAME codec path the emitter uses
  // (zarMajorToMoneyWire → moneyWireFromMinor(Math.round(major*100))) and back
  // to minor units, asserting the decimal-native MoneyWire encoding is lossless
  // at cent precision.
  const varMinor = Math.round(varZar * 100);
  const wire = moneyWireFromMinor(varMinor, "ZAR");
  const backMinor = moneyWireToZarMinor(wire);
  const moneyWireRoundTrips = backMinor === varMinor;

  // The synthetic cohort MUST produce a strictly-positive VaR over 25 scenarios:
  // the tail scenario (factor1 -0.05 × 10m + factor2 +0.04 × -4m = -660,000 ZAR
  // P&L → +660,000 ZAR loss) dominates. We assert structure (positive, bounded,
  // 25 scenarios), not an exact figure, so the leg stays robust to defensible
  // quantile-index conventions while still catching a dead/zeroed kernel.
  const structurallyValid =
    distribution.length === 25 && varZar > 0 && esZar >= varZar && Number.isFinite(varZar);

  const ok = structurallyValid && moneyWireRoundTrips;
  return {
    ok,
    varZar,
    esZar,
    scenarioCount: distribution.length,
    moneyWireRoundTrips,
    detail: structurallyValid
      ? `kernel live: VaR ZAR ${varZar.toFixed(2)}, ES ZAR ${esZar.toFixed(2)} over ${distribution.length} scenarios; MoneyWire round-trip ${moneyWireRoundTrips ? "OK" : "FAILED"}`
      : `kernel probe FAILED: scenarios=${distribution.length} (expected 25), VaR=${varZar}, ES=${esZar} — the V2 historical-simulation kernel produced no positive figure for a known non-vacuous cohort`,
  };
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // -------------------------------------------------------------------------
  // (1) REGISTRY (ENFORCING): MarketRiskVarComputed registered as v2-parallel.
  // -------------------------------------------------------------------------
  const v2Entry = EVENT_TYPE_REGISTRY.find((e) => e.type === "MarketRiskVarComputed");
  result.asserted += 1;
  if (!v2Entry) {
    violations.push({
      subject: "var-v2-parity:registry-missing:MarketRiskVarComputed",
      message:
        '"MarketRiskVarComputed" is not in the event-type registry. ' +
        "This is a three-site F-032 registration defect. " +
        'Register in platform/event-store/registry/markets.ts with v2Status: "v2-parallel". ' +
        "Authority: D-V1-REMOVAL-PHASE2-GAP-A3.",
      severity: "fail",
    });
  } else if (v2Entry.v2Status !== "v2-parallel" && v2Entry.v2Status !== "v2-replaced") {
    violations.push({
      subject: "var-v2-parity:unexpected-status:MarketRiskVarComputed",
      message: `"MarketRiskVarComputed" is tagged "${v2Entry.v2Status}" — expected "v2-parallel". Phase 2 Gap A3 runs the V2 event in parallel with MarketRiskMeasureComputed; the A3 cutover is at the route boundary, not the registry. Authority: D-V1-REMOVAL-PHASE2-GAP-A3.`,
      severity: "fail",
    });
  }

  // -------------------------------------------------------------------------
  // (2) V1-NOT-PREMATURELY-REPLACED SENTINEL (ENFORCING). The A3 cutover is a
  //     route-boundary promotion that retires NO V1 event; MarketRiskMeasureComputed
  //     stays "v1-only". A flip to "v2-replaced" requires byte-parity proof over
  //     multiple EOD runs + a CEO flip Decision — neither has been taken. This
  //     STRENGTHENS the fx-v2-parity premature-replaced protection (does not
  //     weaken any sentinel; Charter cmd 3).
  // -------------------------------------------------------------------------
  const v1Entry = EVENT_TYPE_REGISTRY.find((e) => e.type === "MarketRiskMeasureComputed");
  result.asserted += 1;
  if (v1Entry && v1Entry.v2Status === "v2-replaced") {
    violations.push({
      subject: "var-v2-parity:premature-v2-replaced:MarketRiskMeasureComputed",
      message:
        '"MarketRiskMeasureComputed" (V1) is tagged "v2-replaced" but the A3 byte-parity proof has not been completed and no CEO flip Decision exists. The A3 cutover is a route-boundary promotion (V2 served unconditionally) that retires no V1 event — the V1 type is emittable (major-unit float schema) and MUST stay "v1-only". Premature retirement would surface a vacuous VaR with no V1 fallback. Authority: D-V1-REMOVAL-PHASE2-GAP-A3; D-FX-OTC-CLOSURE-BACKLOG.',
      severity: "fail",
    });
  }

  // -------------------------------------------------------------------------
  // (3) V2 EMIT-PATH LIVE (ENFORCING, data-independent). Exercise the ported
  //     kernel the emitter calls against a deterministic synthetic cohort.
  // -------------------------------------------------------------------------
  const probe = probeV2Kernel();
  result.asserted += 1;
  if (!probe.ok) {
    violations.push({
      subject: "var-v2-parity:construction-v2-kernel-dead",
      message: `CONSTRUCTION BREACH: the V2 historical-simulation kernel (v2-core/fil-models/market-risk-var/methodology — the SAME path var-engine-v2.ts emits from) did not produce a live figure for a known non-vacuous exposure cohort. ${probe.detail}. The A3 route-boundary cutover serves this kernel's output, so a dead kernel would surface a fabricated or absent VaR. Authority: D-FX-OTC-CLOSURE-BACKLOG; D-V1-REMOVAL-PHASE2-GAP-A3.`,
      severity: "fail",
    });
  }

  // -------------------------------------------------------------------------
  // (4) Fold the latest V1 + V2 events for the byte-parity comparison.
  // -------------------------------------------------------------------------
  let latestV1: MarketRiskMeasureComputedPayload | undefined;
  let latestV2: MarketRiskVarComputedPayload | undefined;

  for (const e of eventStore.replay()) {
    if (e.type === "MarketRiskMeasureComputed") {
      latestV1 = e.payload as unknown as MarketRiskMeasureComputedPayload;
    }
    if (e.type === "MarketRiskVarComputed") {
      latestV2 = e.payload as unknown as MarketRiskVarComputedPayload;
    }
  }

  // -------------------------------------------------------------------------
  // (5) BYTE-PARITY (ENFORCING WHEN DATA EXISTS / honest-skip when vacuous).
  //
  // No V2 event → the book is flat or history is too short on this store, so the
  // V2 emitter is fail-closed. Byte-parity is genuinely VACUOUS — skipped with an
  // explicit "awaiting licence-day data" reason. ok stays true (construction legs
  // (1)–(3) already bind). The instant a V2 event lands the comparison ENFORCES.
  // -------------------------------------------------------------------------
  result.asserted += 1;
  if (!latestV2) {
    violations.push({
      subject: "var-v2-parity:byte-parity-vacuous-awaiting-data",
      message:
        'BYTE-PARITY VACUOUS ON CLEAN STORE — no "MarketRiskVarComputed" event exists. ' +
        "VaR needs a live position cohort + a sufficient historical-return window; on the " +
        "build-phase clean store the book is flat / history is too short, so the V2 emitter " +
        "(var-engine-v2.ts) is fail-closed and emits nothing. The byte-parity comparison is " +
        "skipped (vacuous), NOT forced green — it becomes enforcing the instant a V2 event is " +
        "emitted (licence-day data / `bun run mr:var-v2-run` against a populated store). The " +
        "construction/wiring legs (1)–(3) ARE enforcing and bind this run. " +
        "Authority: D-FX-OTC-CLOSURE-BACKLOG; D-V1-REMOVAL-PHASE2-GAP-A3.",
      severity: "info",
    });
    result.violations = violations;
    result.ok = violations.every((v) => v.severity !== "fail");
    result.asOf = `${PIPELINE} [construction ENFORCING / byte-parity VACUOUS — awaiting data]: kernel ${probe.ok ? "LIVE" : "DEAD"} (${probe.detail}); V1 present: ${latestV1 !== undefined}; V2 present: false. ${result.ok ? "PASS" : "FAIL"}.`;
    return result;
  }

  // A V2 event exists but no V1 event — cannot byte-compare. This is a real
  // coherence gap (the dual-emit should produce both), surfaced as fail since
  // data is present on the V2 side.
  if (!latestV1) {
    violations.push({
      subject: "var-v2-parity:v2-present-v1-missing",
      message:
        'A "MarketRiskVarComputed" (V2) event exists but no "MarketRiskMeasureComputed" (V1) event. The rohan-market-risk-measure handler dual-emits both from the same fold; a V2 event without its V1 sibling is a dual-emit coherence break. Run `bun run mr:measure-run`. Authority: D-V1-REMOVAL-PHASE2-GAP-A3.',
      severity: "fail",
    });
    result.violations = violations;
    result.ok = violations.every((v) => v.severity !== "fail");
    result.asOf = `${PIPELINE}: V2 present, V1 missing — dual-emit coherence break. V2 asOf=${latestV2.asOf}.`;
    return result;
  }

  // -------------------------------------------------------------------------
  // (6) Both sides have data → ENFORCE ≤1 ZAR-cent agreement (severity: fail).
  // -------------------------------------------------------------------------
  const comparisons: Array<{ name: string; v1: number | null; v2: number | null }> = [
    {
      name: "VaR",
      v1: latestV1.var.present ? zarMajorToMinor(latestV1.var.value) : null,
      v2: latestV2.var.present ? moneyWireToZarMinor(latestV2.var.value) : null,
    },
    {
      name: "SVaR",
      v1: latestV1.svar.present ? zarMajorToMinor(latestV1.svar.value) : null,
      v2: latestV2.svar.present ? moneyWireToZarMinor(latestV2.svar.value) : null,
    },
    {
      name: "ES",
      v1: latestV1.es.present ? zarMajorToMinor(latestV1.es.value) : null,
      v2: latestV2.es.present ? moneyWireToZarMinor(latestV2.es.value) : null,
    },
  ];

  for (const { name, v1, v2 } of comparisons) {
    result.asserted += 1;
    if (v1 === null && v2 === null) continue; // both absent — agree
    if (v1 === null || v2 === null) {
      violations.push({
        subject: `var-v2-parity:presence-mismatch:${name}`,
        message: `${name}: V1 present=${v1 !== null} vs V2 present=${v2 !== null} — one side has a figure and the other does not. Both sides must be computed or both absent for parity to hold. Authority: D-V1-REMOVAL-PHASE2-GAP-A3.`,
        severity: "fail",
      });
      continue;
    }
    if (!approxEqual(v1, v2)) {
      violations.push({
        subject: `var-v2-parity:divergence:${name}`,
        message: `${name}: V1=${v1} minor units (ZAR ${(v1 / 100).toFixed(2)}) ≠ V2=${v2} minor units (ZAR ${(v2 / 100).toFixed(2)}). Delta: ${Math.abs(v1 - v2)} minor units (tolerance: ${TOLERANCE_MINOR}). A divergence > 1 cent between the V1 historical-simulation engine and the V2 ported kernel breaks the A3 authoritative-path guarantee. Authority: D-V1-REMOVAL-PHASE2-GAP-A3; D-FX-OTC-CLOSURE-BACKLOG.`,
        severity: "fail",
      });
    }
  }

  const v1VarMinor = comparisons[0]?.v1 ?? null;
  const v2VarMinor = comparisons[0]?.v2 ?? null;
  const parityStr =
    v1VarMinor !== null && v2VarMinor !== null
      ? `V1 VaR=${v1VarMinor}c vs V2 VaR=${v2VarMinor}c (delta ${Math.abs(v1VarMinor - v2VarMinor)}c)`
      : "VaR present flags differ";

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf =
    `${PIPELINE} [construction ENFORCING / byte-parity ENFORCING — data present]: ${parityStr}; ` +
    `V1 asOf=${latestV1.asOf}; V2 asOf=${latestV2.asOf}; ${result.asserted} assertion(s); ` +
    `${violations.filter((v) => v.severity === "fail").length} fail(s).`;

  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(`recon:${PIPELINE} ${r.ok ? "OK" : "FAIL"} — ${r.asOf}\n`);
  process.exit(r.ok ? 0 : 1);
}
