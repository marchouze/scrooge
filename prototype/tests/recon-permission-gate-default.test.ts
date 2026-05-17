// tests/recon-permission-gate-default.test.ts
//
// Unit tests for the F-031 permission-gate-default recon.
//
// - Smoke: pipeline runs green over current state.
// - Catches: phantom legacy-bypass entry (a type with no real usage).
// - Catches: raw EventStore construction site outside the carve-out list.
// - Catches: legacy-bypass list growth past the baseline.
// - Catches: agent-keyed actor appending without a policy.
// - D-T-01 Option C: PRIVILEGED_EVENT_TYPES non-empty + required entries present.
// - D-T-01 Option C: Goal-loop operational types NOT blocked by privileged set.
//
// Author: Vera (Internal audit engineer, third-line)

import { describe, expect, it } from "bun:test";

import { run } from "../platform/recon/permission-gate-default";

describe("permission-gate-default recon (F-031)", () => {
  it("runs clean over the live corpus", () => {
    // Real corpus baseline. The test bakes in zero fails as the contract:
    // if a future change introduces a non-carve-out raw EventStore site,
    // a phantom legacy entry, or a baseline overrun, this test fails
    // *before* the recon-overnight handler picks it up. Info / warn
    // findings (actors without a policy; baseline shrinkage) are allowed.
    const r = run();
    expect(r.pipeline).toBe("permission-gate-default");
    const fails = r.violations.filter((v) => v.severity === "fail");
    if (fails.length > 0) {
      console.error(
        "Unexpected fails:",
        fails.map((v) => v.subject),
      );
    }
    expect(fails).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.asserted).toBeGreaterThan(0);
  });

  it("catches a phantom entry in LEGACY_PRE_A1_EVENT_TYPES", () => {
    const r = run({
      legacyBypass: new Set(["DefinitelyNotARealEventType"]),
      knownEventTypes: new Set(),
      appendedAgentActors: [],
      constructionSites: [],
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "legacy-bypass:DefinitelyNotARealEventType" &&
          v.message.includes("Phantom entry"),
      ),
    ).toBe(true);
  });

  it("catches a raw EventStore construction site outside the carve-out list", () => {
    const r = run({
      legacyBypass: new Set(),
      knownEventTypes: new Set(),
      appendedAgentActors: [],
      constructionSites: [
        { file: "platform/some-new-module.ts", line: 42, source: "const s = new EventStore(p);" },
      ],
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "platform/some-new-module.ts:42" &&
          v.message.includes("gateEventStore"),
      ),
    ).toBe(true);
  });

  it("allows construction in the carve-out list", () => {
    const r = run({
      legacyBypass: new Set(),
      knownEventTypes: new Set(),
      appendedAgentActors: [],
      constructionSites: [
        { file: "platform/composition.ts", line: 47, source: "const s = new EventStore(p);" },
        { file: "tests/some.test.ts", line: 10, source: "const s = new EventStore(':memory:');" },
        { file: "scenarios/01-x.ts", line: 5, source: "const s = new EventStore(p);" },
      ],
    });
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("catches legacy-bypass list growth past baseline", () => {
    const big = new Set<string>();
    for (let i = 0; i < 5; i++) big.add(`Type${i}`);
    const r = run({
      legacyBypass: big,
      baseline: 2,
      knownEventTypes: big, // all known so we only fail on size
      appendedAgentActors: [],
      constructionSites: [],
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "legacy-bypass:size" &&
          v.message.includes("baseline is 2"),
      ),
    ).toBe(true);
  });

  it("notes legacy-bypass shrinkage as info", () => {
    const small = new Set(["KnownType"]);
    const r = run({
      legacyBypass: small,
      baseline: 10,
      knownEventTypes: small,
      appendedAgentActors: [],
      constructionSites: [],
    });
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "info" &&
          v.subject === "legacy-bypass:size" &&
          v.message.includes("shrunk"),
      ),
    ).toBe(true);
  });

  it("flags agent-keyed actor without policy as warn (not fail)", () => {
    const r = run({
      legacyBypass: new Set(),
      knownEventTypes: new Set(),
      appendedAgentActors: [
        { agentUrn: "agent:noah:tick", hasPolicy: false },
        { agentUrn: "agent:atlas:registrar", hasPolicy: true },
      ],
      constructionSites: [],
    });
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]); // not fail — Senna's T-12 substrate gap
    expect(
      r.violations.some(
        (v) =>
          v.severity === "warn" &&
          v.subject === "actor:agent:noah:tick" &&
          v.message.includes("PermissionPolicy"),
      ),
    ).toBe(true);
  });

  it("T-12: ACCEPTED_NO_POLICY_ACTORS is empty — any actor without a policy is warn (not info)", () => {
    // Post-T-12 (2026-05-17): the carve-out set is intentionally empty.
    // Previously `agent:substrate-runner` was in ACCEPTED_NO_POLICY_ACTORS
    // and produced `info` severity. Now it is published via
    // `bun run publish:sub-agent-policies`, so in production it resolves
    // to hasPolicy: true. This unit test simulates the hypothetical case
    // where a policy is missing — it should produce `warn`, not `info`,
    // because the carve-out set is empty.
    const r = run({
      legacyBypass: new Set(),
      knownEventTypes: new Set(),
      appendedAgentActors: [{ agentUrn: "agent:substrate-runner", hasPolicy: false }],
      constructionSites: [],
    });
    expect(r.ok).toBe(true); // warn does not fail the pipeline
    expect(
      r.violations.some(
        (v) =>
          v.severity === "warn" &&
          v.subject === "actor:agent:substrate-runner" &&
          v.message.includes("PermissionPolicy"),
      ),
    ).toBe(true);
  });
});

describe("permission-gate-default recon — D-T-01 Option C (PRIVILEGED_EVENT_TYPES)", () => {
  const baseOpts = {
    legacyBypass: new Set<string>(),
    knownEventTypes: new Set<string>(),
    appendedAgentActors: [] as Array<{ agentUrn: string; hasPolicy: boolean }>,
    constructionSites: [] as Array<{ file: string; line: number; source: string }>,
    baseline: 0,
  };

  it("passes when PRIVILEGED_EVENT_TYPES contains at minimum CeoDecision and IdentityPermissionChanged", () => {
    const r = run({
      ...baseOpts,
      privilegedEventTypes: new Set([
        "CeoDecision",
        "IdentityPermissionChanged",
        "PermissionPolicyPublished",
      ]),
    });
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("fails when PRIVILEGED_EVENT_TYPES is empty", () => {
    const r = run({
      ...baseOpts,
      privilegedEventTypes: new Set<string>(),
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "privileged-types:non-empty" &&
          v.message.includes("is empty"),
      ),
    ).toBe(true);
  });

  it("fails when CeoDecision is missing from PRIVILEGED_EVENT_TYPES", () => {
    const r = run({
      ...baseOpts,
      privilegedEventTypes: new Set(["IdentityPermissionChanged"]),
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.severity === "fail" && v.subject === "privileged-types:required:CeoDecision",
      ),
    ).toBe(true);
  });

  it("fails when IdentityPermissionChanged is missing from PRIVILEGED_EVENT_TYPES", () => {
    const r = run({
      ...baseOpts,
      privilegedEventTypes: new Set(["CeoDecision"]),
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "privileged-types:required:IdentityPermissionChanged",
      ),
    ).toBe(true);
  });

  it("fails when a goal-loop operational type (RiskRaised) is in PRIVILEGED_EVENT_TYPES", () => {
    const r = run({
      ...baseOpts,
      privilegedEventTypes: new Set(["CeoDecision", "IdentityPermissionChanged", "RiskRaised"]),
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" && v.subject === "privileged-types:goal-loop-blocked:RiskRaised",
      ),
    ).toBe(true);
  });

  it("fails when a goal-loop operational type (WorkstreamRegistered) is in PRIVILEGED_EVENT_TYPES", () => {
    const r = run({
      ...baseOpts,
      privilegedEventTypes: new Set([
        "CeoDecision",
        "IdentityPermissionChanged",
        "WorkstreamRegistered",
      ]),
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "privileged-types:goal-loop-blocked:WorkstreamRegistered",
      ),
    ).toBe(true);
  });
});
