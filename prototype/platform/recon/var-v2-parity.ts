// platform/recon/var-v2-parity.ts
//
// `recon:var-v2-parity` — ADVISORY parity gate for Phase 2 Gap A3.
//
// STATUS: ADVISORY — `ok: true` regardless of warn-severity violations.
//
// This gate compares the latest V1 `MarketRiskMeasureComputed` VaR/SVaR/ES
// figures against the latest V2 `MarketRiskVarComputed` figures and asserts
// they agree within minor-unit rounding tolerance.
//
// ## Why advisory
//
// The flip from V1-authoritative to V2-authoritative requires:
//   (1) production-proven parity over multiple EOD runs (this gate),
//   (2) CEO Decision approving the flip (D-V1-REMOVAL-PHASE-X).
//
// Until both hold, the gate surfaces differences as warnings without blocking
// CI. It becomes enforcing when the flip is approved.
//
// ## Assertions
//
//   (1) REGISTRY: `MarketRiskVarComputed` is in the registry with
//       `v2Status: "v2-parallel"`.
//   (2) PARITY: when both a V1 and a V2 event exist, the VaR / SVaR / ES
//       figures agree within 1 ZAR minor unit (rounding across two
//       independently-derived major-unit floats).
//   (3) ABSENT-EVENT: if no V2 event exists yet, warn (expected in CI on
//       a fresh store; not a regression).
//
// ## Tolerance
//
// The V1 engine returns ZAR major-unit floats (e.g. 499_432.87). The V2
// engine returns MoneyWire amounts (major-unit string, 2 d.p.). Both are
// rounded to the nearest minor unit (cent = ZAR 0.01) for comparison. A
// difference of ≤ 1 minor unit (ZAR 0.01) is tolerated; anything larger
// indicates a computation divergence.
//
// Authority: D-V1-REMOVAL-PHASE2-GAP-A3 (CEO-approved 2026-06-15);
//            D-VAR-EXPOSURE-INCLUDES-STANDING-NOP; BCBS d457 / MAR33.
// Author: Atlas (Substrate Architect, engineering).

import { eventStore } from "../composition";
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

/** Parse a MoneyWire amount string to a ZAR minor-unit integer.
 *  MoneyWire invariant: amount is always 2 decimal places (e.g. "499432.87").
 *  Strip the decimal point to obtain the minor-unit integer directly — no
 *  float arithmetic involved. "499432.87" → 49943287 minor units (ZAR). */
function moneyWireToZarMinor(majorStr: string): number {
  const sign = majorStr.startsWith("-") ? -1 : 1;
  const digits = majorStr.replace("-", "").replace(".", "");
  return sign * Number.parseInt(digits || "0", 10);
}

function approxEqual(v1Minor: number, v2Minor: number): boolean {
  return Math.abs(v1Minor - v2Minor) <= TOLERANCE_MINOR;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Registry: MarketRiskVarComputed must be registered as v2-parallel.
  const entry = EVENT_TYPE_REGISTRY.find((e) => e.type === "MarketRiskVarComputed");
  result.asserted += 1;
  if (!entry) {
    violations.push({
      subject: "var-v2-parity:registry-missing:MarketRiskVarComputed",
      message:
        '"MarketRiskVarComputed" is not in the event-type registry. ' +
        "This is a three-site F-032 registration defect. " +
        'Register in platform/event-store/registry/markets.ts with v2Status: "v2-parallel". ' +
        "Authority: D-V1-REMOVAL-PHASE2-GAP-A3.",
      severity: "fail",
    });
  } else if (entry.v2Status !== "v2-parallel") {
    violations.push({
      subject: "var-v2-parity:unexpected-status:MarketRiskVarComputed",
      message: `"MarketRiskVarComputed" is tagged "${entry.v2Status}" — expected "v2-parallel". Phase 2 Gap A3 runs the V2 event in parallel with MarketRiskMeasureComputed. A flip to v2-replaced requires byte-equivalence proof and CEO Decision. Authority: D-V1-REMOVAL-PHASE2-GAP-A3.`,
      severity: entry.v2Status === "v2-replaced" ? "fail" : "warn",
    });
  }

  // (2) Fold the latest V1 and V2 events.
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

  // (3) If no V2 event yet — advisory warn (expected on fresh CI store).
  result.asserted += 1;
  if (!latestV2) {
    violations.push({
      subject: "var-v2-parity:no-v2-event",
      message:
        'No "MarketRiskVarComputed" event found in the event store. ' +
        "This is expected on a fresh CI store before the V2 emitter has run. " +
        "Run `bun run mr:var-v2-run` or wire it into the EOD cron to populate. " +
        "Advisory only: not a regression until the emitter is scheduled.",
      severity: "warn",
    });
    result.violations = violations;
    result.ok = violations.every((v) => v.severity !== "fail");
    result.asOf = `${PIPELINE}: no V2 event — advisory warn. V1 present: ${latestV1 !== undefined}.`;
    return result;
  }

  if (!latestV1) {
    violations.push({
      subject: "var-v2-parity:no-v1-event",
      message:
        'No "MarketRiskMeasureComputed" (V1) event found but a V2 event exists. ' +
        "Run `bun run mr:measure-run` to populate the V1 event. " +
        "Cannot assert parity without both sides.",
      severity: "warn",
    });
    result.violations = violations;
    result.ok = violations.every((v) => v.severity !== "fail");
    result.asOf = `${PIPELINE}: no V1 event — cannot compare. V2 asOf=${latestV2.asOf}.`;
    return result;
  }

  // (4) Parity assertions: V1 figure ↔ V2 figure within tolerance.
  const comparisons: Array<{ name: string; v1: number | null; v2: number | null }> = [
    {
      name: "VaR",
      v1: latestV1.var.present ? zarMajorToMinor(latestV1.var.value) : null,
      v2: latestV2.var.present ? moneyWireToZarMinor(latestV2.var.value.amount) : null,
    },
    {
      name: "SVaR",
      v1: latestV1.svar.present ? zarMajorToMinor(latestV1.svar.value) : null,
      v2: latestV2.svar.present ? moneyWireToZarMinor(latestV2.svar.value.amount) : null,
    },
    {
      name: "ES",
      v1: latestV1.es.present ? zarMajorToMinor(latestV1.es.value) : null,
      v2: latestV2.es.present ? moneyWireToZarMinor(latestV2.es.value.amount) : null,
    },
  ];

  for (const { name, v1, v2 } of comparisons) {
    result.asserted += 1;
    if (v1 === null && v2 === null) continue; // both absent — agree
    if (v1 === null || v2 === null) {
      violations.push({
        subject: `var-v2-parity:presence-mismatch:${name}`,
        message: `${name}: V1 present=${v1 !== null} vs V2 present=${v2 !== null} — one side has a figure and the other does not. Both sides must be computed or both absent for parity to hold.`,
        severity: "warn",
      });
      continue;
    }
    if (!approxEqual(v1, v2)) {
      violations.push({
        subject: `var-v2-parity:divergence:${name}`,
        message: `${name}: V1=${v1} minor units (ZAR ${(v1 / 100).toFixed(2)}) ≠ V2=${v2} minor units (ZAR ${(v2 / 100).toFixed(2)}). Delta: ${Math.abs(v1 - v2)} minor units (tolerance: ${TOLERANCE_MINOR}). A divergence > 1 cent indicates a computation discrepancy between the V1 historical-simulation engine and the V2 ported kernel.`,
        severity: "warn",
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
    `${PIPELINE} [ADVISORY]: ${parityStr}; V1 asOf=${latestV1.asOf}; V2 asOf=${latestV2.asOf}; ` +
    `${result.asserted} assertion(s); ${violations.filter((v) => v.severity === "warn").length} warn(s).`;

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
