// runtime/agents/atlas-permission-policy-refresh.ts
//
// Atlas's permission-policy-refresh handler (T-12).
//
// Event-driven on `AgentRegistered`. When a new agent is registered (or
// re-registered with a changed spec), this handler derives and publishes
// the agent's PermissionPolicy — closing the gap where a freshly-registered
// agent could append events before a human ran `bun run identity:issue`.
//
// Design:
//   - Triggered by `AgentRegistered` events from the bus.
//   - For each triggering `AgentRegistered` event, derives and publishes a
//     `PermissionPolicyPublished` event via `LocalPermissionPolicyPublisher`.
//   - Idempotent: if the spec hash hasn't changed, `publish()` emits no event.
//   - Also runs a full sweep of the registry on each invocation to catch any
//     agents whose policy may be stale (e.g. if the spec was changed without
//     triggering a new `AgentRegistered` event).
//
// Authority:
//   - T-12 threat mitigation (archive/owner-inbox/2026-05-17_senna_t12-sub-agent-permission-policy-design-spec.md)
//   - D-T01-PERMISSION-GATE-SECURE-DEFAULT; P4-SECURITY-DESIGNED-IN; ORG-CY-09
//
// Author: Atlas (Principal Software Engineer, engineering)

import { LocalPermissionPolicyPublisher } from "../../platform/agent-identity/permission-policy";
import { LocalAgentRegistry } from "../../platform/agent-runtime/registry";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const CITATIONS = [
  "T-12",
  "D-T01-PERMISSION-GATE-SECURE-DEFAULT",
  "P4-SECURITY-DESIGNED-IN",
  "ORG-CY-09",
];

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const { trigger } = ctx;
  const triggeringEvents = trigger.triggeringEvents ?? [];

  const triggeredUrns = new Set<string>();
  for (const e of triggeringEvents) {
    if (e.type === "AgentRegistered") {
      const body = e.body as Record<string, unknown>;
      const agentUrn = body?.agentUrn ?? (e as unknown as Record<string, unknown>)?.payload?.agentUrn;
      if (typeof agentUrn === "string" && agentUrn) {
        triggeredUrns.add(agentUrn);
      }
    }
  }

  logger.info(
    {
      triggeredUrns: [...triggeredUrns],
      triggeringEventCount: triggeringEvents.length,
      citations: CITATIONS,
    },
    "atlas:permission-policy-refresh — starting",
  );

  const registry = new LocalAgentRegistry({ eventStore });
  const publisher = new LocalPermissionPolicyPublisher({ eventStore });

  const allAgents = registry.list();
  if (allAgents.length === 0) {
    logger.warn(
      "atlas:permission-policy-refresh — no registered agents; run `bun run registry:sync` first",
    );
    return {
      eventsEmitted: 0,
      summary: "atlas:permission-policy-refresh — skipped: no registered agents in registry",
      ok: true,
    };
  }

  let published = 0;
  let unchanged = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const spec of allAgents) {
    try {
      const result = publisher.publish(spec);
      if (result.status === "published") {
        published++;
        logger.info(
          {
            agentUrn: spec.agentUrn,
            policyHash: result.policyHash.slice(0, 12),
            triggered: triggeredUrns.has(spec.agentUrn),
          },
          `atlas:permission-policy-refresh — published policy for ${spec.agentUrn}`,
        );
      } else {
        unchanged++;
        logger.debug(
          { agentUrn: spec.agentUrn },
          `atlas:permission-policy-refresh — policy unchanged for ${spec.agentUrn}`,
        );
      }
    } catch (e) {
      failed++;
      failures.push(spec.agentUrn);
      logger.error(
        { agentUrn: spec.agentUrn, err: e },
        `atlas:permission-policy-refresh — FAILED for ${spec.agentUrn}`,
      );
    }
  }

  const ok = failed === 0;
  const summary = `atlas:permission-policy-refresh — done: published=${published} unchanged=${unchanged} failed=${failed} / total=${allAgents.length}${failures.length > 0 ? ` [failures: ${failures.join(", ")}]` : ""}`;

  logger.info({ published, unchanged, failed, total: allAgents.length }, summary);

  return {
    eventsEmitted: published,
    summary,
    ok,
  };
};

export default handler;
