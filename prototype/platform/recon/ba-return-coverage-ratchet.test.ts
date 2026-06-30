// platform/recon/ba-return-coverage-ratchet.test.ts
//
// Tests for the BA-return capability-coverage ratchet gate.
// Authority: D-BA-RETURN-CAPABILITY-FIRST; D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { coverageByForm, run } from "./ba-return-coverage-ratchet";

const HERE = import.meta.dir;
const REAL_JSON = resolve(HERE, "ba-return-coverage-ratchet.json");

describe("ba-return-coverage-ratchet", () => {
  test("real baseline == current (no regression when baseline was just set)", () => {
    // The committed baseline was set from the ACTUAL current counts — so on a
    // clean checkout the gate must pass with zero violations.
    const result = run({ ratchetJsonPath: REAL_JSON });
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(0);
    expect(result.ok).toBe(true);
  });

  test("a synthetic baseline one-higher than current → FAIL (regression detected)", () => {
    // Build a baseline that claims BA100 has one more sourced cell than it does.
    const current = coverageByForm();
    const ba100 = current.find((f) => f.form === "BA100");
    expect(ba100).toBeDefined();
    const inflatedCount = (ba100?.sourced ?? 0) + 1;

    // Write a temp JSON with the inflated baseline.
    const tmpDir = tmpdir();
    const tmpPath = resolve(tmpDir, `ba-coverage-ratchet-test-${Date.now()}.json`);
    writeFileSync(
      tmpPath,
      JSON.stringify({
        asOf: "2026-06-30",
        authority: "test",
        perForm: { BA100: inflatedCount },
      }),
    );

    const result = run({ ratchetJsonPath: tmpPath });
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails.length).toBeGreaterThan(0);
    expect(fails[0]?.message).toContain("REGRESSED");
    expect(result.ok).toBe(false);
  });

  test("a baseline at zero for all forms → PASS (zero is always achievable, no regression)", () => {
    const tmpDir = tmpdir();
    const tmpPath = resolve(tmpDir, `ba-coverage-ratchet-zero-${Date.now()}.json`);
    writeFileSync(
      tmpPath,
      JSON.stringify({
        asOf: "2026-01-01",
        authority: "test",
        perForm: {},
      }),
    );
    const result = run({ ratchetJsonPath: tmpPath });
    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  test("missing baseline file → FAIL with clear error message", () => {
    const result = run({ ratchetJsonPath: "/nonexistent/path/ratchet.json" });
    expect(result.ok).toBe(false);
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails.length).toBeGreaterThan(0);
    expect(fails[0]?.subject).toBe("ratchet-baseline-missing");
  });
});
