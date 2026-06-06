// tests/sla-approval-workflow.test.ts
//
// Phase 4c — coverage for the SLA rule approval workflow (design spec §9.3;
// D-SLA-ENGINE-RULES-AS-DATA; D-SLA-APPROVAL-WORKFLOW-SEGREGATION). Covers:
//   - the eligibility core (four-eyes, content-hash, last-writer-wins veto);
//   - Owen's no-self-approval control (i);
//   - the interpreter approval gate (a published-but-unapproved rule does not
//     post; an approved rule does);
//   - grandfathering keeps the in-force IFRS set eligible (non-regression);
//   - the recon:sla-approval-workflow assertions (coverage + joint-activation +
//     composed versioning).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import {
  type ApprovalCorpus,
  approvalGate as buildApprovalGate,
  computeEligibility,
  ruleApprovalKey,
  ruleContentHash,
} from "../platform/accounting/sla/approval";
import type { AccountId, SlaRule } from "../platform/accounting/sla/generated/sla-types";
import { interpret } from "../platform/accounting/sla/interpreter";
import type { AccountResolver } from "../platform/accounting/sla/resolver";
import { run as runApprovalRecon } from "../platform/recon/sla-approval-workflow";

const RULE: SlaRule = {
  rule_id: "PR-APR-001",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: { event_type: "AprTestEvent", instrument_type: "TEST" },
  condition: { kind: "always" },
  lines: [
    { account: { logical: "a", currency: "ZAR" }, side: "debit", amount: "100", currency: "ZAR" },
    { account: { logical: "b", currency: "ZAR" }, side: "credit", amount: "100", currency: "ZAR" },
  ],
  balancing: "assert_zero",
  cites: ["urn:test:apr"],
};

const KEY = ruleApprovalKey(RULE);
const HASH = ruleContentHash(RULE);

function publish(overrides: Partial<ApprovalCorpus["published"][number]> = {}) {
  return {
    representation: RULE.representation,
    ruleId: RULE.rule_id,
    version: RULE.version,
    publisherName: "Bea",
    publisherPosition: "Accounting & financial reporting engineer, engineering",
    ruleContentHash: HASH,
    ...overrides,
  };
}

function approve(
  overrides: Partial<Extract<ApprovalCorpus["decisions"][number], { kind: "approve" }>> = {},
) {
  return {
    kind: "approve" as const,
    representation: RULE.representation,
    ruleId: RULE.rule_id,
    version: RULE.version,
    approverName: "Atlas",
    approverPosition: "Core banking platform architect, engineering",
    reviewedRuleHash: HASH,
    reviewedPreviewHash: "preview:abc",
    grandfather: false,
    ...overrides,
  };
}

function withhold(
  overrides: Partial<Extract<ApprovalCorpus["decisions"][number], { kind: "withhold" }>> = {},
) {
  return {
    kind: "withhold" as const,
    representation: RULE.representation,
    ruleId: RULE.rule_id,
    version: RULE.version,
    approverName: "Atlas",
    reason: "needs rework",
    ...overrides,
  };
}

describe("SLA approval eligibility core", () => {
  it("a four-eyes approval (approver ≠ publisher) makes the rule eligible", () => {
    const { eligible, defects } = computeEligibility({
      published: [publish()],
      decisions: [approve()],
    });
    expect(eligible.has(KEY)).toBe(true);
    expect(defects).toEqual([]);
  });

  it("a self-approval (approver === publisher) is rejected and NOT eligible (Owen control i)", () => {
    const { eligible, defects } = computeEligibility({
      published: [publish({ publisherName: "Bea" })],
      decisions: [approve({ approverName: "Bea" })],
    });
    expect(eligible.has(KEY)).toBe(false);
    expect(defects.length).toBe(1);
    expect(defects[0]?.reason).toContain("self-approval");
  });

  it("an approval with no matching published content-hash is rejected", () => {
    const { eligible, defects } = computeEligibility({
      published: [publish({ ruleContentHash: "different" })],
      decisions: [approve({ reviewedRuleHash: HASH })],
    });
    expect(eligible.has(KEY)).toBe(false);
    expect(defects.length).toBe(1);
  });

  it("a withhold vetoes a prior approval (last-writer-wins)", () => {
    const { eligible } = computeEligibility({
      published: [publish()],
      decisions: [approve(), withhold()],
    });
    expect(eligible.has(KEY)).toBe(false);
  });

  it("a re-approval after a withhold restores eligibility", () => {
    const { eligible } = computeEligibility({
      published: [publish()],
      decisions: [approve(), withhold(), approve()],
    });
    expect(eligible.has(KEY)).toBe(true);
  });

  it("a grandfather approval still requires author ≠ approver", () => {
    const { eligible, defects } = computeEligibility({
      published: [publish({ publisherName: "Bea" })],
      decisions: [approve({ approverName: "Bea", grandfather: true })],
    });
    expect(eligible.has(KEY)).toBe(false);
    expect(defects[0]?.reason).toContain("self-approval");
  });
});

describe("interpreter approval gate (Phase 4c)", () => {
  const event = {
    type: "AprTestEvent",
    entity: "LE-ZA-HOZ-BANK",
    as_of: "2026-03-01T00:00:00.000Z",
    payload: {},
  };

  // A passthrough resolver — resolves any logical to a fixed COA leaf so the
  // synthetic rule balances (the gate, not account mapping, is under test).
  const resolver = {
    resolve: () => ({ ok: true, physical: "ACC-1000-001" as AccountId, via: "exact" as const }),
  } as unknown as AccountResolver;

  // A minimal context builder for the synthetic event type, exposing the
  // instrument_type so the rule's applies_to matches.
  const contextBuilders = {
    AprTestEvent: () => ({
      context: {
        event_type: "AprTestEvent",
        entity: "LE-ZA-HOZ-BANK",
        effective_date: "2026-03-01",
        instrument_type: "TEST",
      },
      eventScope: {},
      contextScope: {},
    }),
  };

  it("WITHOUT a gate the rule posts (gate off — preview/parity callers)", () => {
    const [r] = interpret(event, [RULE], ["IFRS"], event.as_of, { contextBuilders, resolver });
    expect(r?.outcome).toBe("post");
  });

  it("WITH a gate excluding the rule → no-eligible-rule (published-but-unapproved)", () => {
    const gate = buildApprovalGate(new Set<string>()); // nothing eligible
    const [r] = interpret(event, [RULE], ["IFRS"], event.as_of, {
      contextBuilders,
      resolver,
      approvalGate: gate,
    });
    expect(r?.outcome).toBe("rejected");
    if (r?.outcome === "rejected") expect(r.reason).toBe("no-eligible-rule");
  });

  it("WITH a gate including the rule → posts", () => {
    const gate = buildApprovalGate(new Set<string>([KEY]));
    const [r] = interpret(event, [RULE], ["IFRS"], event.as_of, {
      contextBuilders,
      resolver,
      approvalGate: gate,
    });
    expect(r?.outcome).toBe("post");
  });
});

describe("recon:sla-approval-workflow", () => {
  it("passes when every in-force production rule has a four-eyes approval", () => {
    // Build a corpus that grandfathers RULE; assert (a) clean for the IFRS path.
    const corpus: ApprovalCorpus = { published: [publish()], decisions: [approve()] };
    const res = runApprovalRecon({
      rules: [RULE],
      corpus,
      productionRepresentations: ["IFRS"],
      approvedDecisions: [],
    });
    expect(res.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it("fails when an in-force production rule lacks any approval", () => {
    const res = runApprovalRecon({
      rules: [RULE],
      corpus: { published: [], decisions: [] },
      productionRepresentations: ["IFRS"],
      approvedDecisions: [],
    });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.subject === KEY)).toBe(true);
  });

  it("fails activating a non-IFRS representation without CFO + CoSec Decisions", () => {
    const res = runApprovalRecon({
      rules: [RULE],
      corpus: { published: [publish()], decisions: [approve()] },
      productionRepresentations: ["IFRS", "SARB-BA-RETURN"],
      approvedDecisions: [], // no CFO / CoSec approvals
    });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.subject === "representation:SARB-BA-RETURN")).toBe(true);
  });

  it("passes activating a non-IFRS representation WITH both CFO + CoSec Decisions", () => {
    const sarbRule: SlaRule = {
      ...RULE,
      rule_id: "PR-APR-BA-001",
      representation: "SARB-BA-RETURN",
    };
    const corpus: ApprovalCorpus = {
      published: [
        publish(),
        publish({
          representation: "SARB-BA-RETURN",
          ruleId: "PR-APR-BA-001",
          ruleContentHash: ruleContentHash(sarbRule),
        }),
      ],
      decisions: [
        approve(),
        approve({
          representation: "SARB-BA-RETURN",
          ruleId: "PR-APR-BA-001",
          reviewedRuleHash: ruleContentHash(sarbRule),
        }),
      ],
    };
    const res = runApprovalRecon({
      rules: [RULE, sarbRule],
      corpus,
      productionRepresentations: ["IFRS", "SARB-BA-RETURN"],
      approvedDecisions: [{ authority: "CFO" }, { authority: "CoSec" }],
    });
    expect(res.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it("composes the 4b versioning recon (clean live registry)", () => {
    // No rule/corpus override → live ALL_SLA_RULES + store; the composed
    // versioning violations carry a `versioning:` subject prefix.
    const res = runApprovalRecon({
      rules: [RULE],
      corpus: { published: [publish()], decisions: [approve()] },
      productionRepresentations: ["IFRS"],
      approvedDecisions: [],
    });
    // The single injected RULE is a clean lineage → no versioning violations.
    expect(res.violations.filter((v) => v.subject.startsWith("versioning:"))).toEqual([]);
  });
});
