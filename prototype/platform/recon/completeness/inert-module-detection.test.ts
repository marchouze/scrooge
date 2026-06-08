// platform/recon/completeness/inert-module-detection.test.ts
//
// Tests for Vera's completeness-audit gate `recon:completeness:inert-module-
// detection`, including the SELF-CLEANING enhancement added under
// D-RETURNS-SUBMISSION-WIRING-WORKSTREAM (2026-06-08).
//
// The gate's two directions are proven against the pure `computeViolations`
// builder with an injected `wired` predicate (no filesystem coupling):
//   (1) untracked-inert       → FAIL
//   (2) allowlisted + inert   → tracked (no fail), counted
//   (3) allowlisted + WIRED   → STALE FAIL (the self-cleaning property)
//
// (3) is the proof the gate would have caught the stale BA-310 allowlist entry
// left behind by #1105 (BA-310 wired but not de-allowlisted).
//
// The live `run()` is also exercised to assert the real `main` state is clean
// (BA-310 de-allowlisted; six remaining returns allowlisted + inert).
//
// Author: Mira (Compliance / RegTech engineer, engineering — runtime wiring +
//   completeness recon), enhancing Vera's (Internal audit / continuous-
//   assurance engineer, engineering) gate.

import { describe, expect, test } from "bun:test";

import { KNOWN_INERT_PENDING_WIRING, computeViolations, run } from "./inert-module-detection";

const WATCHED = [
  "platform/returns/ba100/period-close-subscriber.ts",
  "platform/returns/ba110/period-close-subscriber.ts",
  "platform/returns/ba310/period-close-subscriber.ts",
] as const;

describe("inert-module-detection — computeViolations (pure)", () => {
  test("untracked inert module FAILs", () => {
    // ba100 inert + NOT allowlisted → untracked-inert fail.
    const { violations } = computeViolations(WATCHED, [], (m) =>
      m.endsWith("ba310/period-close-subscriber.ts"),
    );
    const fails = violations.filter((v) => v.severity === "fail");
    expect(fails.map((v) => v.subject)).toContain(
      "platform/returns/ba100/period-close-subscriber.ts",
    );
  });

  test("allowlisted + inert module is tracked (no fail) and counted", () => {
    const allowlist = [
      { module: "platform/returns/ba100/period-close-subscriber.ts", owner: "Mira", closing: "x" },
      { module: "platform/returns/ba110/period-close-subscriber.ts", owner: "Mira", closing: "x" },
    ];
    // ba310 wired; ba100/ba110 inert but allowlisted.
    const { violations, inertCount } = computeViolations(WATCHED, allowlist, (m) =>
      m.endsWith("ba310/period-close-subscriber.ts"),
    );
    expect(violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    expect(inertCount).toBe(2);
  });

  test("SELF-CLEANING — allowlisted-but-WIRED module FAILs as STALE", () => {
    // The exact stale-BA-310 shape: ba310 is on the allowlist AND wired.
    const allowlistWithStaleBa310 = [
      { module: "platform/returns/ba310/period-close-subscriber.ts", owner: "Mira", closing: "x" },
    ];
    const { violations } = computeViolations(WATCHED, allowlistWithStaleBa310, (m) =>
      m.endsWith("ba310/period-close-subscriber.ts"),
    );
    const fails = violations.filter((v) => v.severity === "fail");
    const stale = fails.find(
      (v) => v.subject === "platform/returns/ba310/period-close-subscriber.ts",
    );
    expect(stale).toBeDefined();
    expect(stale?.message).toContain("STALE");
  });

  test("clean state — all watched wired, none allowlisted → no violations", () => {
    const { violations } = computeViolations(WATCHED, [], () => true);
    expect(violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    expect(violations).toHaveLength(0);
  });
});

describe("inert-module-detection — live run() on main", () => {
  test("ba310 is de-allowlisted (not on KNOWN_INERT_PENDING_WIRING)", () => {
    expect(
      KNOWN_INERT_PENDING_WIRING.some((e) => e.module.endsWith("ba310/period-close-subscriber.ts")),
    ).toBe(false);
  });

  test("gate is green on the real repo (no fail-severity violations)", () => {
    const result = run();
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(0);
    expect(result.ok).toBe(true);
  });
});
