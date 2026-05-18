// scripts/seed-permission-policies.ts
//
// T-12 — Seed founding PermissionPolicy records for all registered agents.
//
// This script walks the agent registry, derives a PermissionPolicy from each
// agent's operating spec, and publishes a `PermissionPolicyPublished` event
// via `LocalPermissionPolicyPublisher.publish()`. Idempotent on policyHash —
// re-running with no spec changes emits zero events.
//
// This is the founding-policy seed for the T-12 substrate. It covers:
//   - All persona-level agents registered via `AgentRegistered` events.
//
// Sub-agent task actors (agent:<persona>:<task>) are seeded separately via
// `bun run publish:sub-agent-policies`.
//
// Pre-condition: agents must be registered in the event store before this
// script runs. If the registry is empty, exit 0 with a warning.
// Run `bun run registry:sync` first if no agents are registered.
//
// Invocation: `bun run seed:permission-policies`
//   or directly: cd prototype && bun run scripts/seed-permission-policies.ts
//
// Exit status:
//   0 — all policies published (or unchanged; idempotent re-run).
//   1 — one or more failures (logged).
//
// Authority:
//   - T-12 (archive/owner-inbox/2026-05-17_senna_t12-sub-agent-permission-policy-design-spec.md)
//   - D-T01-PERMISSION-GATE-SECURE-DEFAULT; P4-SECURITY-DESIGNED-IN; ORG-CY-09
//
// Author: Atlas (Principal Software Engineer, engineering)

import { LocalPermissionPolicyPublisher } from "../platform/agent-identity/permission-policy";
import { LocalAgentRegistry } from "../platform/agent-runtime/registry";
import { eventStore, logger } from "../platform/composition";

interface PerAgentLog {
  readonly agentUrn: string;
  readonly outcome: "published" | "unchanged" | "failed";
  readonly detail: string;
}

async function main(): Promise<number> {
  const registry = new LocalAgentRegistry({ eventStore });
  const publisher = new LocalPermissionPolicyPublisher({ eventStore });

  const agents = registry.list();
  if (agents.length === 0) {
    logger.warn(
      "seed:permission-policies — no registered agents; run `bun run registry:sync` first",
    );
    logger.warn(
      "seed:permission-policies — exiting 0 (no agents to seed; not a failure condition)",
    );
    return 0;
  }

  logger.info(
    { total: agents.length },
    `seed:permission-policies — seeding PermissionPolicies for ${agents.length} registered agents`,
  );

  const log: PerAgentLog[] = [];
  let failures = 0;

  for (const spec of agents) {
    try {
      const result = publisher.publish(spec);
      log.push({
        agentUrn: spec.agentUrn,
        outcome: result.status,
        detail: `hash=${result.policyHash.slice(0, 12)} emitted=${result.eventEmitted}`,
      });
      logger.info(
        {
          agentUrn: spec.agentUrn,
          status: result.status,
          eventEmitted: result.eventEmitted,
          policyHash: result.policyHash.slice(0, 12),
          eventsAllowed: spec.eventsEmitted.length,
          capsAllowed: spec.systemCapabilities.length,
        },
        `seed:permission-policies — ${result.status}: ${spec.agentUrn}`,
      );
    } catch (e) {
      failures++;
      log.push({
        agentUrn: spec.agentUrn,
        outcome: "failed",
        detail: `error: ${(e as Error).message}`,
      });
      logger.error(
        { agentUrn: spec.agentUrn, err: e },
        `seed:permission-policies — FAILED: ${spec.agentUrn}`,
      );
    }
  }

  const counts = {
    published: log.filter((l) => l.outcome === "published").length,
    unchanged: log.filter((l) => l.outcome === "unchanged").length,
    failed: log.filter((l) => l.outcome === "failed").length,
  };

  logger.info(
    { ...counts, total: agents.length },
    `seed:permission-policies — done: published=${counts.published} unchanged=${counts.unchanged} failed=${counts.failed}`,
  );

  if (failures > 0) {
    logger.error(
      { failures },
      "seed:permission-policies — FAILURES detected; recon:permission-policy-coverage will report fails",
    );
    return 1;
  }

  logger.info(
    `seed:permission-policies — ALL ${agents.length} agent policies seeded successfully.`,
  );
  return 0;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
