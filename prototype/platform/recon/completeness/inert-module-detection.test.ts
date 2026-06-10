// platform/recon/completeness/inert-module-detection.test.ts
//
// Tests for Vera's completeness-audit gate `recon:completeness:inert-module-
// detection`, including the SELF-CLEANING enhancement added under
// D-RETURNS-SUBMISSION-WIRING-WORKSTREAM (2026-06-08) and the NAMED
// tracked-deferred-gap structure added by WS-RETURNS-SUBMISSION-WIRING Wave B
// (2026-06-10, ProductDeferredGap pattern per D-FX-OTC-NPA-SCOPE-EXPANSION).
//
// The gate's directions are proven against the pure `computeViolations`
// builder with an injected `wired` predicate (no filesystem coupling):
//   (1) untracked-inert                 → FAIL
//   (2) allowlisted + inert             → tracked (no fail), counted
//   (3) allowlisted + WIRED             → STALE FAIL (the self-cleaning property)
//   (4) hollow deferral (empty gapId /
//       targetTrigger / citations)      → FAIL (named-deferral well-formedness)
//   (5) component deferral on UNWIRED
//       module, or duplicated module    → FAIL; on a wired module → info
//
// (3) is the proof the gate would have caught the stale BA-310 allowlist entry
// left behind by #1105 (BA-310 wired but not de-allowlisted).
//
// The live `run()` is also exercised to assert the real `main` state is clean
// (ba320 + ba300 + ba700 wired and de-allowlisted; four genuinely-blocked
// returns allowlisted as named deferrals; the BA 700 operational-RWA component
// deferral tracked on the wired side).
//
// Author: Mira (Compliance / RegTech engineer, engineering — runtime wiring +
//   completeness recon), enhancing Vera's (Internal audit / continuous-
//   assurance engineer, engineering) gate.

import { describe, expect, test } from "bun:test";

import {
  KNOWN_INERT_PENDING_WIRING,
  WIRED_RETURN_COMPONENT_DEFERRALS,
  computeViolations,
  run,
} from "./inert-module-detection";

const WATCHED = [
  "platform/returns/ba700/period-close-subscriber.ts",
  "platform/returns/ba300/period-close-subscriber.ts",
  "platform/returns/ba320/period-close-subscriber.ts",
] as const;

/** Well-formed named-deferral fixture fields (Wave B AllowlistEntry shape). */
const GAP_FIELDS = {
  gapId: "GAP-TEST-FIXTURE",
  targetTrigger: "test trigger lands",
  citations: ["D-RETURNS-SUBMISSION-WIRING-WORKSTREAM"],
} as const;

describe("inert-module-detection — computeViolations (pure)", () => {
  test("untracked inert module FAILs", () => {
    // ba700 inert + NOT allowlisted → untracked-inert fail.
    const { violations } = computeViolations(WATCHED, [], (m) =>
      m.endsWith("ba320/period-close-subscriber.ts"),
    );
    const fails = violations.filter((v) => v.severity === "fail");
    expect(fails.map((v) => v.subject)).toContain(
      "platform/returns/ba700/period-close-subscriber.ts",
    );
  });

  test("allowlisted + inert module is tracked (no fail) and counted", () => {
    const allowlist = [
      {
        module: "platform/returns/ba700/period-close-subscriber.ts",
        owner: "Mira",
        closing: "x",
        ...GAP_FIELDS,
      },
      {
        module: "platform/returns/ba300/period-close-subscriber.ts",
        owner: "Mira",
        closing: "x",
        ...GAP_FIELDS,
      },
    ];
    // ba320 (market risk) wired; ba700/ba300 inert but allowlisted.
    const { violations, inertCount } = computeViolations(WATCHED, allowlist, (m) =>
      m.endsWith("ba320/period-close-subscriber.ts"),
    );
    expect(violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    expect(inertCount).toBe(2);
  });

  test("SELF-CLEANING — allowlisted-but-WIRED module FAILs as STALE", () => {
    // The exact stale shape: ba320 (market risk) is on the allowlist AND wired.
    const allowlistWithStaleBa310 = [
      {
        module: "platform/returns/ba320/period-close-subscriber.ts",
        owner: "Mira",
        closing: "x",
        ...GAP_FIELDS,
      },
    ];
    const { violations } = computeViolations(WATCHED, allowlistWithStaleBa310, (m) =>
      m.endsWith("ba320/period-close-subscriber.ts"),
    );
    const fails = violations.filter((v) => v.severity === "fail");
    const stale = fails.find(
      (v) => v.subject === "platform/returns/ba320/period-close-subscriber.ts",
    );
    expect(stale).toBeDefined();
    expect(stale?.message).toContain("STALE");
  });

  test("clean state — all watched wired, none allowlisted → no violations", () => {
    const { violations } = computeViolations(WATCHED, [], () => true);
    expect(violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    expect(violations).toHaveLength(0);
  });

  test("HOLLOW deferral — empty gapId / targetTrigger / citations FAILs", () => {
    const hollow = [
      {
        module: "platform/returns/ba700/period-close-subscriber.ts",
        owner: "Mira",
        closing: "x",
        gapId: "",
        targetTrigger: "  ",
        citations: [],
      },
    ];
    const { violations } = computeViolations(WATCHED, hollow, (m) =>
      m.endsWith("ba320/period-close-subscriber.ts"),
    );
    const fail = violations.find(
      (v) =>
        v.severity === "fail" &&
        v.subject === "platform/returns/ba700/period-close-subscriber.ts" &&
        v.message.includes("HOLLOW"),
    );
    expect(fail).toBeDefined();
    expect(fail?.message).toContain("gapId");
    expect(fail?.message).toContain("targetTrigger");
    expect(fail?.message).toContain("citations");
  });

  test("component deferral on an UNWIRED module FAILs", () => {
    const componentDeferrals = [
      {
        gapId: "GAP-TEST-COMPONENT",
        formId: "BA700",
        module: "platform/returns/ba700/period-close-subscriber.ts",
        title: "t",
        owner: "Bea",
        targetTrigger: "trigger",
        citations: ["D-RWA-ENGINE-W2-SLICE-3"],
      },
    ];
    // Nothing wired → the component deferral references an inert module.
    const { violations } = computeViolations(WATCHED, [], () => false, componentDeferrals);
    const fail = violations.find(
      (v) => v.severity === "fail" && v.subject === "GAP-TEST-COMPONENT",
    );
    expect(fail).toBeDefined();
    expect(fail?.message).toContain("NO runtime/dashboard importer");
  });

  test("component deferral duplicated on the allowlist FAILs", () => {
    const mod = "platform/returns/ba700/period-close-subscriber.ts";
    const allowlist = [{ module: mod, owner: "Mira", closing: "x", ...GAP_FIELDS }];
    const componentDeferrals = [
      {
        gapId: "GAP-TEST-COMPONENT",
        formId: "BA700",
        module: mod,
        title: "t",
        owner: "Bea",
        targetTrigger: "trigger",
        citations: ["D-RWA-ENGINE-W2-SLICE-3"],
      },
    ];
    const { violations } = computeViolations(WATCHED, allowlist, () => false, componentDeferrals);
    const fail = violations.find(
      (v) => v.severity === "fail" && v.message.includes("BOTH"),
    );
    expect(fail).toBeDefined();
  });

  test("component deferral on a WIRED module surfaces as info, not fail", () => {
    const componentDeferrals = [
      {
        gapId: "GAP-TEST-COMPONENT",
        formId: "BA700",
        module: "platform/returns/ba700/period-close-subscriber.ts",
        title: "operational RWA deferred.",
        owner: "Bea",
        targetTrigger: "gross-income feed lands",
        citations: ["D-RWA-ENGINE-W2-SLICE-3"],
      },
    ];
    const { violations } = computeViolations(WATCHED, [], () => true, componentDeferrals);
    expect(violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    const info = violations.find(
      (v) => v.severity === "info" && v.subject === "GAP-TEST-COMPONENT",
    );
    expect(info).toBeDefined();
  });
});

describe("inert-module-detection — live run() on main", () => {
  test("wired returns are de-allowlisted (ba320, ba300, ba700 not on KNOWN_INERT_PENDING_WIRING)", () => {
    for (const wired of ["ba320", "ba300", "ba700"]) {
      expect(
        KNOWN_INERT_PENDING_WIRING.some((e) =>
          e.module.endsWith(`${wired}/period-close-subscriber.ts`),
        ),
      ).toBe(false);
    }
  });

  test("every live allowlist entry is a NAMED deferral (gapId + targetTrigger + citations)", () => {
    for (const entry of KNOWN_INERT_PENDING_WIRING) {
      expect(entry.gapId.startsWith("GAP-RETURNS-")).toBe(true);
      expect(entry.targetTrigger.trim().length).toBeGreaterThan(0);
      expect(entry.citations.length).toBeGreaterThan(0);
    }
  });

  test("BA 700 operational-RWA component deferral is tracked on the wired side", () => {
    const gap = WIRED_RETURN_COMPONENT_DEFERRALS.find(
      (g) => g.gapId === "GAP-RETURNS-BA700-OPERATIONAL-RWA",
    );
    expect(gap).toBeDefined();
    expect(gap?.formId).toBe("BA700");
    expect(gap?.module).toBe("platform/returns/ba700/period-close-subscriber.ts");
  });

  test("gate is green on the real repo (no fail-severity violations)", () => {
    const result = run();
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(0);
    expect(result.ok).toBe(true);
  });
});
