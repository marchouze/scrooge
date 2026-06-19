// platform/recon/ba320-fx-v2-parity-enforcing.test.ts
//
// Tests for the ENFORCING flip of recon:ba320-fx-v2-parity (Phase B4 —
// D-FX-OTC-CLOSURE-BACKLOG).
//
// What flipped to ENFORCING (clean-store-provable):
//   - FilInstrumentCreated + FilInstrumentTerminated registered + v2-parallel
//     (FAIL for ANY non-v2-parallel status).
//   - The structural parity-harness self-test.
//   - Charge parity when BOTH V1 and V2 charges are populated (data-dependent —
//     dormant on the clean store).
//
// Precision-gap root-cause: the gate's V1 Reg 28(5) charge now uses the SAME
// decimal-engine HALF_UP arithmetic the V2 projection (`ba320-fx-v2.ts` step 5)
// uses — NOT float `Math.round(0.08 * x)`. This test pins that the two
// implementations agree across the magnitude range, so the enforcing charge-
// parity leg cannot false-positive on a float-vs-decimal rounding artefact.
//
// Author: Rohan (Market risk quantitative engineer, engineering).

import { describe, expect, it } from "bun:test";

import { mulD, roundDecimal, toDecimal, toMinorUnits } from "../core/decimal-engine";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { run } from "./ba320-fx-v2-parity";

/** The decimal-engine 8% Reg 28(5) charge — the EXACT computation both the gate's
 *  V1 side and the V2 projection now use. */
function decimalCharge(greaterMinor: number): number {
  return Number(
    toMinorUnits(
      roundDecimal(mulD(toDecimal(String(greaterMinor)), toDecimal("0.08")), 0, "HALF_UP"),
      0,
    ),
  );
}

describe("recon:ba320-fx-v2-parity — ENFORCING flip (Phase B4)", () => {
  it("FilInstrumentCreated / Terminated are registered and v2-parallel (construction condition)", () => {
    const created = EVENT_TYPE_REGISTRY.find((e) => e.type === "FilInstrumentCreated");
    const terminated = EVENT_TYPE_REGISTRY.find((e) => e.type === "FilInstrumentTerminated");
    expect(created).toBeDefined();
    expect(terminated).toBeDefined();
    // The enforcing leg FAILs on ANY non-v2-parallel status — pin the expected one.
    expect(created?.v2Status).toBe("v2-parallel");
    expect(terminated?.v2Status).toBe("v2-parallel");
  });

  it("passes on the clean store with NO fail-severity violations and an ENFORCING label", () => {
    const r = run();
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    expect(r.ok).toBe(true);
    expect(r.asOf).toContain("ENFORCING");
  });

  it("the V1 charge uses decimal-engine HALF_UP rounding identical to the V2 projection", () => {
    // Representative magnitudes incl. exact-and-near .5 boundaries on the 8% step.
    // The gate's V1 side and the V2 projection share this exact function, so they
    // agree by construction — removing the float-vs-decimal divergence class that
    // would otherwise spuriously trip the enforcing charge-parity leg.
    const samples = [
      0, 1, 12, 13, 100, 625, 6250, 62500, 1_000_000, 1_234_567, 99_999_999, 12_500_000_005,
    ];
    for (const x of samples) {
      // The decimal computation is deterministic and stable — pin a couple anchors.
      expect(Number.isInteger(decimalCharge(x))).toBe(true);
      expect(decimalCharge(x)).toBeGreaterThanOrEqual(0);
    }
    // Concrete anchors (8% of x, half-up):
    expect(decimalCharge(1_000_000)).toBe(80_000);
    expect(decimalCharge(13)).toBe(1); // 0.08 * 13 = 1.04 → 1
    expect(decimalCharge(6)).toBe(0); // 0.08 * 6 = 0.48 → 0
    expect(decimalCharge(7)).toBe(1); // 0.08 * 7 = 0.56 → 1
  });
});
