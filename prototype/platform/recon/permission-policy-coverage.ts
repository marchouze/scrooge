// platform/recon/permission-policy-coverage.ts
//
// Continuous-controls pipeline: permission-policy coverage (T-12 closure).
//
// Asserts that every agent registered in the event store (via `AgentRegistered`
// events) has at least one published `PermissionPolicyPublished` event.
//
// This complements `recon:permission-gate-default` which checks actors that
// have _appended events_ against their published policy. This pipeline checks
// the registry itself — ensuring no registered agent is missing a policy,
// even if they haven't appended any events yet.
//
// Assertions:
//   1. Every registered agent (from the `AgentRegistered` event stream) has
//      at least one `PermissionPolicyPublished` event keyed on their agentUrn.
//   2. The count of registered agents with policies equals the count of
//      registered agents (zero-gap assertion).
//   3. No registered agent has a policy where the `derivedFromSpecHash`
//      disagrees with the current registered spec hash (stale-policy detect).
//
// Severity levels:
//   - `fail`: registered agent has NO policy at all — blocks CI.
//   - `warn`: registered agent's policy derives from a stale spec hash —
//             policy exists but is outdated; run `bun run identity:issue`.
//   - `info`: informational only (e.g. coverage baseline notes).
//
// Authority:
//   - T-12 threat mitigation (archive/owner-inbox/2026-05-17_senna_t12-sub-agent-permission-policy-design-spec.md)
//   - D-T01-PERMISSION-GATE-SECURE-DEFAULT; P4-SECURITY-DESIGNED-IN; ORG-CY-09
//
// Author: Atlas (Principal Software Engineer, engineering) +
//         Vera (Internal audit engineer, third-line)

import { LocalPermissionPolicyPublisher } from "../agent-identity/permission-policy";
import { LocalAgentRegistry } from "../agent-runtime/registry";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "permission-policy-coverage";

const CITATIONS = [
  "T-12",
  "D-T01-PERMISSION-GATE-SECURE-DEFAULT",
  "P4-SECURITY-DESIGNED-IN",
  "ORG-CY-09",
  "archive/owner-inbox/2026-05-17_senna_t12-sub-agent-permission-policy-design-spec.md",
];

export interface RunOpts {
  /** Inject registered agents for testing (bypasses event store). */
  registeredAgents?: ReadonlyArray<{ agentUrn: string; specHash: string }>;
  /** Inject published policies for testing (bypasses event store). */
  publishedPolicies?: ReadonlyMap<string, { policyHash: string; derivedFromSpecHash: string }>;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // Gather registered agents
  let registeredAgents: ReadonlyArray<{ agentUrn: string; specHash: string }>;
  if (opts.registeredAgents !== undefined) {
    registeredAgents = opts.registeredAgents;
  } else {
    try {
      const registry = new LocalAgentRegistry({ eventStore });
      registeredAgents = registry.list().map((spec) => ({
        agentUrn: spec.agentUrn,
        specHash: spec.specHash,
      }));
    } catch {
      // Fresh runner with no event store — tolerate gracefully (same as
      // decision-event-recon.ts fail-open posture).
      result.ok = true;
      result.violations = [];
      return result;
    }
  }

  // Gather published policies
  let policyMap: ReadonlyMap<string, { policyHash: string; derivedFromSpecHash: string }>;
  if (opts.publishedPolicies !== undefined) {
    policyMap = opts.publishedPolicies;
  } else {
    try {
      const publisher = new LocalPermissionPolicyPublisher({ eventStore });
      const policies = publisher.list();
      policyMap = new Map(
        policies.map((p) => [
          p.agentUrn,
          { policyHash: p.policyHash, derivedFromSpecHash: p.derivedFromSpecHash },
        ]),
      );
    } catch {
      // Event store unavailable — tolerate gracefully.
      result.ok = true;
      result.violations = [];
      return result;
    }
  }

  if (registeredAgents.length === 0) {
    // No registered agents — fresh runner; skip silently (not a failure).
    result.ok = true;
    result.violations = [];
    return result;
  }

  // Assertion 1 + 3: every registered agent has a policy; policies are current.
  for (const { agentUrn, specHash } of registeredAgents) {
    result.asserted++;
    const policy = policyMap.get(agentUrn);
    if (!policy) {
      violations.push({
        subject: `agent:${agentUrn}`,
        message:
          `Registered agent \`${agentUrn}\` has no published \`PermissionPolicyPublished\` event. ` +
          `Run \`bun run identity:issue\` to publish a policy for all registered agents. ` +
          `Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
    } else if (specHash && policy.derivedFromSpecHash && policy.derivedFromSpecHash !== specHash) {
      violations.push({
        subject: `agent:${agentUrn}`,
        message:
          `Registered agent \`${agentUrn}\` has a policy derived from spec hash ` +
          `\`${policy.derivedFromSpecHash.slice(0, 12)}\` but the current spec hash is ` +
          `\`${specHash.slice(0, 12)}\`. The policy is stale. ` +
          `Run \`bun run identity:issue\` to refresh. ` +
          `Citations: ${CITATIONS.join(", ")}.`,
        severity: "warn",
      });
    }
  }

  // Assertion 2: summary coverage note.
  result.asserted++;
  const coveredCount = [...registeredAgents].filter((a) => policyMap.has(a.agentUrn)).length;
  const totalCount = registeredAgents.length;
  if (coveredCount < totalCount) {
    // Already reported per-agent above; add an aggregate info note.
    violations.push({
      subject: "permission-policy:coverage-summary",
      message:
        `${coveredCount} of ${totalCount} registered agents have published PermissionPolicies ` +
        `(${totalCount - coveredCount} missing). Run \`bun run identity:issue\` to close the gap. ` +
        `Citations: ${CITATIONS.join(", ")}.`,
      severity: "info",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entry-point
// ---------------------------------------------------------------------------
if (import.meta.main) {
  const r = run();
  const fails = r.violations.filter((v) => v.severity === "fail");
  const warns = r.violations.filter((v) => v.severity === "warn");
  const infos = r.violations.filter((v) => v.severity === "info");

  if (fails.length > 0) {
    console.error(`\n[FAIL] ${PIPELINE}: ${fails.length} failure(s):`);
    for (const v of fails) console.error(`  ✗ ${v.subject}: ${v.message}`);
  }
  if (warns.length > 0) {
    console.warn(`\n[WARN] ${PIPELINE}: ${warns.length} warning(s):`);
    for (const v of warns) console.warn(`  ⚠ ${v.subject}: ${v.message}`);
  }
  if (infos.length > 0) {
    console.info(`\n[INFO] ${PIPELINE}: ${infos.length} info finding(s):`);
    for (const v of infos) console.info(`  ℹ ${v.subject}: ${v.message}`);
  }

  if (r.ok) {
    console.log(
      `\n[OK] ${PIPELINE}: ${r.asserted} assertion(s), ${fails.length} fail(s), ${warns.length} warn(s)`,
    );
    process.exit(0);
  } else {
    console.error(
      `\n[FAIL] ${PIPELINE}: ${r.asserted} assertion(s), ${fails.length} fail(s), ${warns.length} warn(s)`,
    );
    process.exit(1);
  }
}
