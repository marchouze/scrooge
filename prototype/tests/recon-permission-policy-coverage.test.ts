// tests/recon-permission-policy-coverage.test.ts
//
// Unit tests for the T-12 permission-policy-coverage recon pipeline.
//
// - Smoke: pipeline runs green over current state (or clean empty-store state).
// - Catches: registered agent with no published policy (fail).
// - Catches: registered agent with stale policy (warn).
// - Allows: registered agent with current policy (no violation).
// - Allows: empty registry (no assertions, not an error).
//
// Author: Vera (Internal audit engineer, third-line) +
//         Atlas (Principal Software Engineer, engineering)

import { describe, expect, it } from "bun:test";

import { run } from "../platform/recon/permission-policy-coverage";

describe("permission-policy-coverage recon (T-12)", () => {
  it("runs clean over the live corpus (or clean empty state)", () => {
    // In CI (fresh runner, no .local/event.db), the pipeline tolerates an
    // absent event store and returns ok:true with 0 violations.
    // On a populated local store, it should also return ok:true — all
    // persona-level agents have policies published via `bun run identity:issue`
    // or `bun run seed:permission-policies`.
    const r = run();
    expect(r.pipeline).toBe("permission-policy-coverage");
    const fails = r.violations.filter((v) => v.severity === "fail");
    if (fails.length > 0) {
      console.error(
        "Unexpected fails — run `bun run seed:permission-policies` to seed policies:",
        fails.map((v) => `${v.subject}: ${v.message}`),
      );
    }
    expect(fails).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("passes when all registered agents have current policies", () => {
    const r = run({
      registeredAgents: [
        { agentUrn: "agent:atlas", specHash: "abc123" },
        { agentUrn: "agent:vera", specHash: "def456" },
      ],
      publishedPolicies: new Map([
        ["agent:atlas", { policyHash: "p1", derivedFromSpecHash: "abc123" }],
        ["agent:vera", { policyHash: "p2", derivedFromSpecHash: "def456" }],
      ]),
    });
    expect(r.ok).toBe(true);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
  });

  it("fails when a registered agent has no policy", () => {
    const r = run({
      registeredAgents: [
        { agentUrn: "agent:atlas", specHash: "abc123" },
        { agentUrn: "agent:vera", specHash: "def456" },
      ],
      publishedPolicies: new Map([
        ["agent:atlas", { policyHash: "p1", derivedFromSpecHash: "abc123" }],
        // agent:vera is missing a policy
      ]),
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails.length).toBeGreaterThan(0);
    expect(
      fails.some(
        (v) =>
          v.subject === "agent:agent:vera" &&
          v.message.includes("no published") &&
          v.message.includes("PermissionPolicyPublished"),
      ),
    ).toBe(true);
  });

  it("warns when a registered agent has a stale policy (spec hash mismatch)", () => {
    const r = run({
      registeredAgents: [
        { agentUrn: "agent:atlas", specHash: "newHash999" }, // spec updated
      ],
      publishedPolicies: new Map([
        ["agent:atlas", { policyHash: "p1", derivedFromSpecHash: "oldHash111" }], // policy stale
      ]),
    });
    expect(r.ok).toBe(true); // warn does not fail the pipeline
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(warns.length).toBeGreaterThan(0);
    expect(
      warns.some(
        (v) => v.subject === "agent:agent:atlas" && v.message.includes("stale"),
      ),
    ).toBe(true);
  });

  it("adds an aggregate info summary when coverage is incomplete", () => {
    const r = run({
      registeredAgents: [
        { agentUrn: "agent:atlas", specHash: "abc123" },
        { agentUrn: "agent:vera", specHash: "def456" },
      ],
      publishedPolicies: new Map([
        ["agent:atlas", { policyHash: "p1", derivedFromSpecHash: "abc123" }],
        // agent:vera is missing
      ]),
    });
    const infos = r.violations.filter((v) => v.severity === "info");
    expect(
      infos.some(
        (v) =>
          v.subject === "permission-policy:coverage-summary" &&
          v.message.includes("1 of 2"),
      ),
    ).toBe(true);
  });

  it("passes (no assertions) for an empty registry", () => {
    const r = run({
      registeredAgents: [],
      publishedPolicies: new Map(),
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.asserted).toBe(0);
  });

  it("does not warn on stale policy when spec hash is empty (initial registration)", () => {
    // Some agents may have empty specHash from the initial registration run.
    // In that case, stale-check should be skipped (can't compare empty to empty).
    const r = run({
      registeredAgents: [
        { agentUrn: "agent:atlas", specHash: "" }, // empty hash
      ],
      publishedPolicies: new Map([
        ["agent:atlas", { policyHash: "p1", derivedFromSpecHash: "" }],
      ]),
    });
    expect(r.ok).toBe(true);
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(warns).toEqual([]);
  });
});
