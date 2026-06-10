// scripts/run-recon-suite.test.ts
//
// Tests for the run-all-then-aggregate recon runner.
//
// Core guarantee under test: the runner runs EVERY target regardless of
// individual failures and reports ALL simultaneous failures (not just the
// first), exiting non-zero iff ANY failed. This is the property that stops
// an env-only early failure (e.g. recon:event-store-append-only on the
// home-store archive-partition gap, D-EVENT-STORE-SCALING-PHASE-5) from
// masking downstream real failures (e.g. recon:wall-clock-callsite-coverage).
//
// Author: Atlas (Core banking platform architect)

import { describe, expect, it } from "bun:test";

import {
  RECON_SUITES,
  formatReport,
  resolveTargets,
  runReconSuite,
} from "./run-recon-suite";

// A stub runner factory: maps target name → exit status, so we can drive the
// aggregator deterministically without spawning subprocesses.
function stubRunner(statuses: Record<string, number>) {
  return (target: string): { status: number | null; tail: string } => {
    const status = statuses[target] ?? 0;
    return {
      status,
      tail: status === 0 ? "ok" : `STUB FAILURE for ${target} (exit ${status})`,
    };
  };
}

describe("runReconSuite — run-all-then-aggregate", () => {
  it("reports MULTIPLE simultaneous failures, not just the first", () => {
    // Two failing stubs bracketing a passing one — mirrors the real
    // masking case: an early failure must NOT short-circuit a later one.
    const targets = ["recon:early-fail", "recon:passes", "recon:late-fail"];
    const report = runReconSuite(
      targets,
      stubRunner({
        "recon:early-fail": 1,
        "recon:passes": 0,
        "recon:late-fail": 1,
      }),
    );

    // Every target ran (none short-circuited).
    expect(report.results).toHaveLength(3);
    // Both failures surfaced.
    expect(report.failedCount).toBe(2);
    expect(report.failedTargets).toContain("recon:early-fail");
    expect(report.failedTargets).toContain("recon:late-fail");
    expect(report.passedCount).toBe(1);
    expect(report.ok).toBe(false);

    // Both failures appear in the rendered report.
    const rendered = formatReport(report, "infra");
    expect(rendered).toContain("recon:early-fail");
    expect(rendered).toContain("recon:late-fail");
    expect(rendered).toContain("1 passed, 2 failed");
  });

  it("exits zero (ok) when ALL targets pass", () => {
    const targets = ["recon:a", "recon:b", "recon:c"];
    const report = runReconSuite(
      targets,
      stubRunner({ "recon:a": 0, "recon:b": 0, "recon:c": 0 }),
    );
    expect(report.ok).toBe(true);
    expect(report.failedCount).toBe(0);
    expect(report.passedCount).toBe(3);
    expect(report.failedTargets).toHaveLength(0);
    expect(formatReport(report, "infra")).toContain("3 passed, 0 failed");
  });

  it("treats a null exit status (process killed) as a failure", () => {
    const report = runReconSuite(["recon:killed"], () => ({
      status: null,
      tail: "killed",
    }));
    expect(report.ok).toBe(false);
    expect(report.results[0]?.exitCode).toBe(1);
  });
});

describe("resolveTargets", () => {
  it("resolves a known suite name to its target list", () => {
    const { label, targets } = resolveTargets(["infra"]);
    expect(label).toBe("infra");
    expect(targets).toEqual(RECON_SUITES.infra);
  });

  it("supports an ad-hoc --targets list", () => {
    const { label, targets } = resolveTargets(["--targets", "recon:x, recon:y"]);
    expect(label).toBe("ad-hoc");
    expect(targets).toEqual(["recon:x", "recon:y"]);
  });

  it("throws on an unknown suite name", () => {
    expect(() => resolveTargets(["does-not-exist"])).toThrow(/unknown recon suite/);
  });
});

// Parity guard: the suite target lists are the single source of truth and
// must stay non-empty and reference real `recon` / `recon:*` script names.
// This keeps the control-flow change honest — if someone trims a list, the
// coverage drop is visible here rather than silently dropping a gate.
describe("RECON_SUITES integrity", () => {
  it("both suites are non-empty and every target is a recon script name", async () => {
    const pkg = (await import("../package.json")).default as {
      scripts: Record<string, string>;
    };
    for (const [name, targets] of Object.entries(RECON_SUITES)) {
      expect(targets.length).toBeGreaterThan(0);
      for (const t of targets) {
        // Every target must be a defined npm script (`recon` or `recon:*`).
        expect(pkg.scripts[t], `${name} target ${t} must be a defined script`).toBeDefined();
        expect(t === "recon" || t.startsWith("recon:")).toBe(true);
      }
    }
  });

  it("ci:recon:infra and ci:recon:domain both route through the runner", async () => {
    const pkg = (await import("../package.json")).default as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["ci:recon:infra"]).toContain("run-recon-suite.ts infra");
    expect(pkg.scripts["ci:recon:domain"]).toContain("run-recon-suite.ts domain");
  });
});
