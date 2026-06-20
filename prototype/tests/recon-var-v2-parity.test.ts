// tests/recon-var-v2-parity.test.ts
//
// Unit tests for the recon:var-v2-parity gate. As of D-FX-V2-SIMULATOR-FIRST the
// FX V1↔V2 VaR BYTE-PARITY leg is RETIRED (V1 is no longer the FX correctness
// oracle; the replacement assurance is recon:fx-v2-sim-oracle). What this gate
// still enforces — and these tests lock — is the CONSTRUCTION / wiring sentinels,
// which guard the V1-REMOVAL invariants, NOT parity (Engineering Charter cmd 3 —
// the retired assurance is replaced, not dropped):
//   - registry coherence (V2 v2-parallel; V1 NOT prematurely v2-replaced);
//   - the V2-kernel-live probe (the ported HS kernel produces a real figure).
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//            D-FX-OTC-CLOSURE-BACKLOG; D-V1-REMOVAL-PHASE2-GAP-A3.
// Author: Atlas (Core banking platform architect, engineering); original A3 split
//         by Rohan (Market risk quantitative engineer — governance owner Helena,
//         Chief Risk Officer).

import { describe, expect, it } from "bun:test";

import { EVENT_TYPE_REGISTRY } from "../platform/event-store/registry/index";
import { run } from "../platform/recon/var-v2-parity";

describe("recon:var-v2-parity — construction sentinels (FX byte-parity retired)", () => {
  it("passes on the clean store: construction legs enforce, byte-parity retired", () => {
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

  it("retires the FX byte-parity leg and points at the simulator oracle", () => {
    // The FX V1↔V2 VaR byte-parity comparison is RETIRED (D-FX-V2-SIMULATOR-FIRST).
    // The gate surfaces an explicit, info-severity retirement marker naming the
    // replacement assurance (recon:fx-v2-sim-oracle) — never a silent drop.
    const r = run();
    const retired = r.violations.find((v) => v.subject === "var-v2-parity:fx-byte-parity-retired");
    expect(retired).toBeDefined();
    expect(retired?.severity).toBe("info");
    expect(retired?.message).toContain("recon:fx-v2-sim-oracle");
    expect(retired?.message).toContain("RETIRED");
    expect(r.asOf).toContain("FX byte-parity RETIRED");
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
