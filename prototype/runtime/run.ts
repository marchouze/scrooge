// runtime/run.ts
//
// Agent-runtime entry point. Invoked by:
//   - bun run agent:vera-overnight     (npm script in package.json)
//   - GitHub Actions scheduled workflow (.github/workflows/agent-runtime-*.yml)
//
// Resolves the handler for `<agent>:<trigger>`, builds an AgentRunContext,
// invokes the handler, logs the result. Idempotency, citation discipline,
// and event emission are the handler's responsibility — the runtime only
// builds the context and reports the outcome.
//
// MVP scope: handler resolution by static import map. V1 broadens to a
// handler registry that scans /runtime/agents/.
//
// Author: Atlas

import { resolve } from "node:path";

import { logger } from "../platform/observability/logger";
import veraOvernightRecon from "./agents/vera-overnight-recon";
import type { AgentRunContext, AgentRunHandler, AgentRunOutput, TriggerKind } from "./types";

// Static handler registry. Keyed by `<lowercased-agent>:<trigger-id>`.
const HANDLERS: Record<string, { kind: TriggerKind; handler: AgentRunHandler }> = {
  "vera:overnight-recon": { kind: "scheduled", handler: veraOvernightRecon },
};

interface CliArgs {
  agent: string;
  trigger: string;
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args = argv.slice(2);
  let agent = "";
  let trigger = "";
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--agent") {
      agent = args[++i] ?? "";
    } else if (a === "--trigger") {
      trigger = args[++i] ?? "";
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }
  if (!agent || !trigger) {
    throw new Error(
      "Usage: bun runtime/run.ts --agent <Name> --trigger <id> [--dry-run]\n" +
        `Available: ${Object.keys(HANDLERS).join(", ")}`,
    );
  }
  return { agent, trigger, dryRun };
}

export async function runAgent(opts: CliArgs): Promise<AgentRunOutput> {
  const key = `${opts.agent.toLowerCase()}:${opts.trigger}`;
  const entry = HANDLERS[key];
  if (!entry) {
    throw new Error(
      `No handler registered for ${key}. Available: ${Object.keys(HANDLERS).join(", ")}`,
    );
  }

  const repoRoot = process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..");
  const ctx: AgentRunContext = {
    agent: opts.agent,
    trigger: { kind: entry.kind, id: opts.trigger },
    asOf: new Date().toISOString(),
    repoRoot,
    ownerInboxDir: resolve(repoRoot, "Owner Inbox"),
    dryRun: opts.dryRun,
  };

  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, asOf: ctx.asOf, dryRun: ctx.dryRun },
    "agent run started",
  );
  const t0 = Date.now();
  const result = await entry.handler(ctx);
  const ms = Date.now() - t0;
  logger.info(
    {
      agent: ctx.agent,
      trigger: ctx.trigger.id,
      ok: result.ok,
      eventsEmitted: result.eventsEmitted,
      deliverable: result.deliverable,
      ms,
    },
    `agent run finished: ${result.summary}`,
  );
  return result;
}

// CLI entry — only when invoked directly.
if (import.meta.main) {
  const opts = parseArgs(process.argv);
  runAgent(opts)
    .then((r) => process.exit(r.ok ? 0 : 1))
    .catch((e) => {
      logger.error({ err: (e as Error).message }, "agent run failed");
      process.exit(2);
    });
}
