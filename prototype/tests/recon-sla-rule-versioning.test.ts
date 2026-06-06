// tests/recon-sla-rule-versioning.test.ts
//
// Phase 4b — coverage for the recon:sla-rule-versioning gate (design spec §6 /
// §10; D-SLA-ENGINE-RULES-AS-DATA). Drives the pipeline's pure `run()` with
// injected registries + posted refs (no event store), asserting:
//   (a) a clean abutting registry + matching postings passes;
//   (b) a window gap fails;
//   (c) a version-2 rule lacking `supersedes` fails;
//   (d) a posting citing a non-registry ruleVersion fails (reproducibility break);
//   (e) the LIVE committed registry (ALL_SLA_RULES) is clean.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import type { SlaRule } from "../platform/accounting/sla/generated/sla-types";
import { ALL_SLA_RULES } from "../platform/accounting/sla/rules/all-rules";
import { run } from "../platform/recon/sla-rule-versioning";

const BASE: SlaRule = {
  rule_id: "PR-TEST-001",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: { event_type: "TestEvent" },
  condition: { kind: "always" },
  lines: [
    { account: { logical: "a", currency: "ZAR" }, side: "debit", amount: "1", currency: "ZAR" },
    { account: { logical: "b", currency: "ZAR" }, side: "credit", amount: "1", currency: "ZAR" },
  ],
  balancing: "assert_zero",
  cites: [],
};

describe("recon:sla-rule-versioning", () => {
  it("passes on a clean abutting registry + matching postings", () => {
    const v1: SlaRule = { ...BASE, version: 1, effective_to: "2026-07-01" };
    const v2: SlaRule = {
      ...BASE,
      version: 2,
      effective_from: "2026-07-01",
      supersedes: "PR-TEST-001@1",
    };
    const res = run({
      rules: [v1, v2],
      postedRefs: [
        { eventId: "E1", representation: "IFRS", ruleId: "PR-TEST-001", ruleVersion: 1 },
      ],
    });
    expect(res.ok).toBe(true);
    expect(res.violations).toEqual([]);
  });

  it("fails on a window gap", () => {
    const v1: SlaRule = { ...BASE, version: 1, effective_to: "2026-06-01" };
    const v2: SlaRule = {
      ...BASE,
      version: 2,
      effective_from: "2026-07-01",
      supersedes: "PR-TEST-001@1",
    };
    const res = run({ rules: [v1, v2], postedRefs: [] });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.message.includes("window-gap"))).toBe(true);
  });

  it("fails when a v2 rule lacks 'supersedes'", () => {
    const v1: SlaRule = { ...BASE, version: 1, effective_to: "2026-07-01" };
    const v2: SlaRule = { ...BASE, version: 2, effective_from: "2026-07-01" }; // no supersedes
    const res = run({ rules: [v1, v2], postedRefs: [] });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.message.includes("no 'supersedes'"))).toBe(true);
  });

  it("fails when a posting cites a ruleVersion absent from the registry", () => {
    const res = run({
      rules: [BASE],
      postedRefs: [
        { eventId: "E9", representation: "IFRS", ruleId: "PR-TEST-001", ruleVersion: 7 },
      ],
    });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.message.includes("cannot be reproduced"))).toBe(true);
  });

  it("the live committed registry (ALL_SLA_RULES) is window-integral", () => {
    const res = run({ rules: ALL_SLA_RULES, postedRefs: [] });
    expect(res.ok).toBe(true);
  });
});
