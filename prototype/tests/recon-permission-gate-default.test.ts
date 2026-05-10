// tests/recon-permission-gate-default.test.ts
//
// Unit tests for the F-031 permission-gate-default recon.
//
// - Smoke: pipeline runs green over current state.
// - Catches: phantom legacy-bypass entry (a type with no real usage).
// - Catches: raw EventStore construction site outside the carve-out list.
// - Catches: legacy-bypass list growth past the baseline.
// - Catches: agent-keyed actor appending without a policy.
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

  it("downgrades accepted-no-policy actors to info", () => {
    const r = run({
      legacyBypass: new Set(),
      knownEventTypes: new Set(),
      appendedAgentActors: [{ agentUrn: "agent:substrate-runner", hasPolicy: false }],
      constructionSites: [],
    });
    expect(r.ok).toBe(true);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "info" &&
          v.subject === "actor:agent:substrate-runner" &&
          v.message.includes("Accepted today"),
      ),
    ).toBe(true);
  });
});
