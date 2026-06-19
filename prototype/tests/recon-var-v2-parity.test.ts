// tests/recon-var-v2-parity.test.ts
//
// Unit tests for the WS-FX-OTC-CLOSURE A3 VaR cutover gate
// (recon:var-v2-parity). Locks the honest enforcing-vs-awaiting-data split
// the A3 cutover introduced (Engineering Charter cmd 3 — no green by
// concealment):
//   - Construction / wiring legs (registry coherence, V1-not-prematurely-
//     replaced sentinel, V2-kernel-live probe) are ENFORCING and bind on the
//     clean store regardless of position/scenario data.
//   - The byte-parity leg is honest: vacuous-skipped (info severity, ok: true)
//     when no V2 event exists, and ENFORCING (fail severity) the instant both a
//     V1 and a V2 event are present.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19);
//            D-V1-REMOVAL-PHASE2-GAP-A3; D-BANK-WIDE-V2-MIGRATION.
// Author: Rohan (Market risk quantitative engineer, engineering — governance
//         owner Helena, Chief Risk Officer).

import { describe, expect, it } from "bun:test";

import { EVENT_TYPE_REGISTRY } from "../platform/event-store/registry/index";
import { run } from "../platform/recon/var-v2-parity";

describe("recon:var-v2-parity — A3 cutover honest split", () => {
  it("passes on the clean store: construction legs enforce, byte-parity vacuous-skipped", () => {
    const r = run();
    expect(r.pipeline).toBe("var-v2-parity");
    // The construction/wiring legs assert independently of store data, so there
    // are always ≥3 assertions.
    expect(r.asserted).toBeGreaterThanOrEqual(3);
    // No fail-severity violation on a coherent, data-empty clean store.
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails.map((f) => f.subject)).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("does NOT force a vacuous byte-parity green — surfaces the awaiting-data gap loudly", () => {
    // On the clean store the V2 emitter is fail-closed (flat book / no scenario
    // history) so no MarketRiskVarComputed event exists. The byte-parity leg must
    // be SKIPPED with an explicit awaiting-data marker, never silently green.
    const r = run();
    const vacuous = r.violations.find(
      (v) => v.subject === "var-v2-parity:byte-parity-vacuous-awaiting-data",
    );
    // The marker is present only when there is genuinely no V2 event. If a V2
    // event has been backfilled into the local store, the byte-parity leg runs
    // instead — both are acceptable, but if the marker IS present it must be
    // info-severity (non-blocking honest skip) and name the data dependency.
    if (vacuous) {
      expect(vacuous.severity).toBe("info");
      expect(vacuous.message).toContain("VACUOUS ON CLEAN STORE");
      expect(vacuous.message).toContain("NOT forced green");
      expect(r.asOf).toContain("byte-parity VACUOUS");
    } else {
      // A V2 event exists → the gate is in the enforcing byte-parity branch.
      expect(r.asOf).toContain("byte-parity ENFORCING");
    }
  });

  it("the V2 historical-simulation kernel is LIVE (construction leg 3)", () => {
    // The kernel-live probe drives a deterministic non-vacuous synthetic cohort
    // through the SAME ported kernel var-engine-v2.ts emits from. If that probe
    // failed it would emit a fail-severity construction-v2-kernel-dead violation.
    const r = run();
    const kernelDead = r.violations.find(
      (v) => v.subject === "var-v2-parity:construction-v2-kernel-dead",
    );
    expect(kernelDead).toBeUndefined();
    expect(r.asOf).toContain("kernel LIVE");
  });

  it("registry is coherent: V2 v2-parallel, V1 NOT prematurely v2-replaced", () => {
    // Data-independent invariants the A3 route-boundary cutover relies on.
    const v2Entry = EVENT_TYPE_REGISTRY.find((e) => e.type === "MarketRiskVarComputed");
    expect(v2Entry?.v2Status).toBe("v2-parallel");

    const v1Entry = EVENT_TYPE_REGISTRY.find((e) => e.type === "MarketRiskMeasureComputed");
    // The A3 cutover is a route-boundary promotion that retires no V1 event.
    // MarketRiskMeasureComputed MUST stay v1-only until a byte-parity proof +
    // CEO flip Decision retires it (strengthens the fx-v2-parity sentinel).
    expect(v1Entry?.v2Status).toBe("v1-only");

    // The gate would emit a fail if either invariant broke.
    const r = run();
    const registryFail = r.violations.find(
      (v) =>
        v.subject === "var-v2-parity:registry-missing:MarketRiskVarComputed" ||
        v.subject === "var-v2-parity:unexpected-status:MarketRiskVarComputed" ||
        v.subject === "var-v2-parity:premature-v2-replaced:MarketRiskMeasureComputed",
    );
    expect(registryFail).toBeUndefined();
  });
});
