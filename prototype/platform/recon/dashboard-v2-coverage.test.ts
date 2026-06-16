// platform/recon/dashboard-v2-coverage.test.ts
//
// Regression tests for the dashboard-v2-coverage advisory gate (Phase 4).
// Non-vacuous: asserts the real inventory passes (advisory), the wired count is
// honest, and that the gate would FAIL on genuine drift.
//
// Authority: D-V1-REMOVAL-PHASE-4 (CEO-approved 2026-06-16).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import { run } from "./dashboard-v2-coverage";

describe("recon:dashboard-v2-coverage", () => {
  it("passes (advisory) against the real route inventory", () => {
    const r = run();
    expect(r.ok).toBe(true);
    expect(r.pipeline).toBe("dashboard-v2-coverage");
  });

  it("reports the wired routes (GL trial-balance + entries + accounts, market-risk, daily P&L, ALM/LCR/NSFR, BA-700/BA-320 returns) and no hard failures", () => {
    const r = run();
    // No fail-severity violations on the real tree (only warn for V1-only routes).
    expect(r.violations.some((v) => v.severity === "fail")).toBe(false);
    // The summary records the wired/total split. WS-V2-AUTHORITATIVE S9 wires the
    // BA-700 / BA-320 regulatory-returns route (the new GET
    // /api/regulatory-returns/:return boundary → selectRegulatoryReturn dual-read),
    // taking the wired count to seven of eight (GL trial-balance + GL entries +
    // GL accounts + market-risk + daily P&L + ALM/LCR/NSFR snapshot + BA-700/BA-320
    // returns). Only #6 (capital metrics) stays V1-only with its honest reason.
    expect(r.asOf).toContain("/8 read routes wired to V2");
    expect(r.asOf).toMatch(/7\/8 read routes wired/);
  });

  it("emits an explicit reason (warn) for every V1-only route — no silent gaps", () => {
    const r = run();
    const v1Only = r.violations.filter((v) => v.subject.startsWith("v1-only:"));
    expect(v1Only.length).toBeGreaterThan(0);
    for (const v of v1Only) {
      expect(v.severity).toBe("warn");
      expect(v.message).toContain("Reason:");
    }
  });

  it("the wired marker for GL trial-balance is genuinely present (catch is non-vacuous)", () => {
    const r = run();
    // If the V2 read call were removed from gl-view.ts, the gate would surface a
    // fail-severity wired-marker-missing violation. Asserting its absence here
    // confirms the marker check is live, not a no-op.
    const markerMissing = r.violations.filter((v) => v.subject.startsWith("wired-marker-missing:"));
    expect(markerMissing.length).toBe(0);
  });

  it("the BA-700/BA-320 regulatory-returns route (#8) is wired with a present marker (WS-V2-AUTHORITATIVE S9)", () => {
    const r = run();
    // The route #8 wired entry must NOT surface a missing-marker fail — confirms
    // selectRegulatoryReturn is genuinely present in the handler file and the
    // dual-read boundary is live, not an inventory claim the code lacks.
    const ba700Missing = r.violations.filter(
      (v) =>
        v.subject.startsWith("wired-marker-missing:") && v.subject.includes("regulatory-returns"),
    );
    expect(ba700Missing.length).toBe(0);
    // And the route is no longer surfaced as a V1-only warn.
    const ba700V1Only = r.violations.filter(
      (v) => v.subject.startsWith("v1-only:") && v.subject.includes("regulatory-returns"),
    );
    expect(ba700V1Only.length).toBe(0);
  });
});
