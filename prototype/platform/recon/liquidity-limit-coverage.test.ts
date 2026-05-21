// platform/recon/liquidity-limit-coverage.test.ts
//
// Tests for the liquidity-limit-coverage recon pipeline.
// Author: Vera (Internal audit engineer, engineering).

import { describe, expect, it } from "bun:test";

import { DEFAULT_LIMIT_CONFIGS } from "../risk/liquidity-limit-engine";
import type { LiquidityLimitConfig } from "../risk/liquidity-limit-engine/types";
import { run } from "./liquidity-limit-coverage";

describe("recon:liquidity-limit-coverage", () => {
  it("passes against the shipping DEFAULT_LIMIT_CONFIGS", () => {
    const r = run({ configs: DEFAULT_LIMIT_CONFIGS, breachEvents: [] });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("fails when a required line is missing from the config table", () => {
    // Strip LCR coverage.
    const partial = DEFAULT_LIMIT_CONFIGS.filter((c) => c.line !== "lcr-ratio");
    const r = run({ configs: partial, breachEvents: [] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject === "line:lcr-ratio")).toBe(true);
  });

  it("fails when multiple required lines are missing", () => {
    const minimal: LiquidityLimitConfig[] = [
      {
        tier: "tier-1",
        line: "lcr-ratio",
        threshold: 100,
        direction: "floor",
        severity: "critical",
        currentUnit: "percent",
      },
    ];
    const r = run({ configs: minimal, breachEvents: [] });
    expect(r.ok).toBe(false);
    // Six required lines missing (all except lcr-ratio).
    const failingSubjects = r.violations.filter((v) => v.severity === "fail").map((v) => v.subject);
    expect(failingSubjects).toContain("line:nsfr-ratio");
    expect(failingSubjects).toContain("line:intraday-liquidity-buffer");
    expect(failingSubjects).toContain("line:funding-concentration-counterparty");
    expect(failingSubjects).toContain("line:funding-concentration-depositor");
    expect(failingSubjects).toContain("line:funding-concentration-tenor");
    expect(failingSubjects).toContain("line:hqla-concentration");
  });

  it("flags a breach event referring to a line absent from the config table", () => {
    // Drop one line from configs but emit a breach mentioning it.
    const partial = DEFAULT_LIMIT_CONFIGS.filter((c) => c.line !== "hqla-concentration");
    const r = run({
      configs: partial,
      breachEvents: [
        {
          type: "LiquidityLimitBreached",
          payload: { line: "hqla-concentration", breachId: "BX" },
        },
      ],
    });
    expect(r.ok).toBe(false);
    // Both the required-line check and the observed-but-uncovered check fire.
    expect(r.violations.some((v) => v.subject === "line:hqla-concentration")).toBe(true);
    expect(r.violations.some((v) => v.subject === "observed-line:hqla-concentration")).toBe(true);
  });

  it("ignores breach events that reference covered lines (no observed-line drift)", () => {
    const r = run({
      configs: DEFAULT_LIMIT_CONFIGS,
      breachEvents: [
        {
          type: "LiquidityLimitBreached",
          payload: { line: "lcr-ratio", breachId: "B1" },
        },
      ],
    });
    expect(r.ok).toBe(true);
  });
});
