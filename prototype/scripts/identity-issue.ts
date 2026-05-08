// scripts/identity-issue.ts
//
// One-shot CLI: walks the agent registry, issues an identity for every
// agent that doesn't have one yet, and publishes a permission policy if
// none exists or if the policy hash differs. Idempotent — re-running
// with no spec changes emits zero events.
//
// Invocation: `bun run identity:issue` (npm script in `package.json`).
//
// Exit status:
//   - 0 on success.
//   - 1 if any agent failed to issue (logged with reason).
//
// Author: Atlas + Senna (A1.2)

import { resolve } from "node:path";

import { LocalAgentIdentityIssuer } from "../platform/agent-identity/issuer";
import { LocalPermissionPolicyPublisher } from "../platform/agent-identity/permission-policy";
import { LocalAgentRegistry } from "../platform/agent-runtime/registry";
import { eventStore, logger } from "../platform/composition";

interface PerAgentLog {
  readonly agentUrn: string;
  readonly issued: "created" | "unchanged" | "rotated" | "failed";
  readonly published: "published" | "unchanged" | "failed";
  readonly detail: string;
}

async function main(): Promise<number> {
  const registry = new LocalAgentRegistry({ eventStore });
  const issuer = new LocalAgentIdentityIssuer({
    eventStore,
    keyDir: process.env.BANK_AGENT_KEY_DIR ?? resolve(".local/keys"),
  });
  const publisher = new LocalPermissionPolicyPublisher({ eventStore });

  const agents = registry.list();
  if (agents.length === 0) {
    logger.error("identity:issue — no registered agents; run `bun run registry:sync` first");
    return 1;
  }

  const log: PerAgentLog[] = [];
  let failures = 0;

  for (const spec of agents) {
    let issuedStatus: PerAgentLog["issued"];
    let publishedStatus: PerAgentLog["published"];
    let detail = "";

    try {
      const issueResult = issuer.issue(spec);
      issuedStatus = issueResult.status;
      detail = `key=${issueResult.keyVersion}`;
    } catch (e) {
      issuedStatus = "failed";
      detail = `issue error: ${(e as Error).message}`;
      logger.error({ agentUrn: spec.agentUrn, err: e }, "identity:issue — issue failed");
      failures++;
      log.push({
        agentUrn: spec.agentUrn,
        issued: issuedStatus,
        published: "failed",
        detail,
      });
      continue;
    }

    try {
      const pub = publisher.publish(spec);
      publishedStatus = pub.status;
      detail += ` policy=${pub.policyHash.slice(0, 12)}`;
    } catch (e) {
      publishedStatus = "failed";
      detail += ` publish error: ${(e as Error).message}`;
      logger.error({ agentUrn: spec.agentUrn, err: e }, "identity:issue — publish failed");
      failures++;
    }

    log.push({
      agentUrn: spec.agentUrn,
      issued: issuedStatus,
      published: publishedStatus,
      detail,
    });
    logger.info(
      {
        agentUrn: spec.agentUrn,
        issued: issuedStatus,
        published: publishedStatus,
      },
      `identity:issue — ${spec.agentUrn} issued=${issuedStatus} published=${publishedStatus}`,
    );
  }

  const counts = {
    created: log.filter((l) => l.issued === "created").length,
    unchanged: log.filter((l) => l.issued === "unchanged").length,
    rotated: log.filter((l) => l.issued === "rotated").length,
    issueFailed: log.filter((l) => l.issued === "failed").length,
    published: log.filter((l) => l.published === "published").length,
    publishUnchanged: log.filter((l) => l.published === "unchanged").length,
  };
  logger.info(
    { ...counts, total: agents.length },
    `identity:issue — done: created=${counts.created} unchanged=${counts.unchanged} rotated=${counts.rotated} failed=${counts.issueFailed}; policies published=${counts.published} unchanged=${counts.publishUnchanged}`,
  );

  return failures === 0 ? 0 : 1;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
