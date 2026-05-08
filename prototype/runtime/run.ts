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

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { HANDLER_CALLABLES } from "./handler-callables";
import { HANDLERS_METADATA, type HandlerMetadata } from "./handlers-metadata";
import type { AgentRunContext, AgentRunHandler, AgentRunOutput } from "./types";

interface HandlerEntry {
  readonly metadata: HandlerMetadata;
  readonly handler: AgentRunHandler;
}

/**
 * Compose metadata + callables on module load. Throws if either side
 * has a key the other lacks — fail-loud is correct here; the build
 * shouldn't ship with a half-registered handler.
 */
function buildHandlerMap(): Readonly<Record<string, HandlerEntry>> {
  const out: Record<string, HandlerEntry> = {};
  const metadataKeys = new Set<string>();
  for (const m of HANDLERS_METADATA) {
    metadataKeys.add(m.key);
    const handler = HANDLER_CALLABLES[m.key];
    if (!handler) {
      throw new Error(
        `runtime/handlers-metadata.ts declares ${m.key} but runtime/run.ts has no callable. Add it to HANDLER_CALLABLES.`,
      );
    }
    out[m.key] = { metadata: m, handler };
  }
  for (const k of Object.keys(HANDLER_CALLABLES)) {
    if (!metadataKeys.has(k)) {
      throw new Error(
        `runtime/run.ts has callable for ${k} but runtime/handlers-metadata.ts has no metadata. Add a row to HANDLERS_METADATA.`,
      );
    }
  }
  return out;
}

const HANDLERS: Readonly<Record<string, HandlerEntry>> = buildHandlerMap();

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
      // biome-ignore lint/style/useTemplate: minimal-touch — Atlas owns this file in A2.2 cutover (claude/cool-rhodes-9b2c4e); a template-literal collapse would clobber his single-commit-revert path. Re-fix in his next pass.
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
    trigger: { kind: entry.metadata.kind, id: opts.trigger },
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
  // Capture the event-store sequence pointer before the run so we can
  // observe what new event types this run appended (for event-driven
  // fan-out below).
  const seqBefore = eventStore.count();
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

  // Event-driven fan-out: if this parent run was scheduled or on-request,
  // dispatch any event-driven handlers whose `subscribesTo` intersects
  // the set of event types appended during this run. We do NOT recurse
  // into event-driven handlers themselves — that would risk loops.
  if (entry.metadata.kind !== "event-driven" && !ctx.dryRun) {
    // Collect new events with full payloads (not just types) so we can
    // pass triggeringEvents to each event-driven handler.
    const newEvents = [...eventStore.replay({ fromSequence: seqBefore + 1 })];
    const newEventTypes = new Set<string>(newEvents.map((e) => e.type));
    if (newEventTypes.size > 0) {
      const triggered: string[] = [];
      for (const [k, e] of Object.entries(HANDLERS)) {
        if (e.metadata.kind !== "event-driven") continue;
        const subs = e.metadata.subscribesTo ?? [];
        if (subs.some((t) => newEventTypes.has(t))) triggered.push(k);
      }
      for (const tk of triggered) {
        const tEntry = HANDLERS[tk];
        if (!tEntry) continue;
        const [tAgent, tTrigger] = tk.split(":");
        if (!tAgent || !tTrigger) continue;
        const subscribed = new Set(tEntry.metadata.subscribesTo ?? []);
        const matchedEvents = newEvents.filter((e) => subscribed.has(e.type));
        const tCtx: AgentRunContext = {
          agent: capitalise(tAgent),
          trigger: {
            kind: "event-driven",
            id: tTrigger,
            triggeringEvents: matchedEvents,
          },
          asOf: new Date().toISOString(),
          repoRoot,
          ownerInboxDir: resolve(repoRoot, "Owner Inbox"),
          dryRun: ctx.dryRun,
        };
        logger.info(
          {
            parent: `${ctx.agent}:${ctx.trigger.id}`,
            triggered: tk,
            triggerEventTypes: [...newEventTypes].filter((t) =>
              (tEntry.metadata.subscribesTo ?? []).includes(t),
            ),
          },
          "event-driven dispatch",
        );
        try {
          const tResult = await tEntry.handler(tCtx);
          logger.info(
            {
              triggered: tk,
              ok: tResult.ok,
              eventsEmitted: tResult.eventsEmitted,
              deliverable: tResult.deliverable,
            },
            `event-driven handler finished: ${tResult.summary}`,
          );
        } catch (e) {
          // Event-driven failures are non-fatal to the parent run — the
          // parent's deliverable + events are already valuable. Log and
          // continue; surface as a substrate-gap if it recurs.
          logger.error(
            { triggered: tk, err: (e as Error).message },
            "event-driven handler failed (non-fatal to parent)",
          );
        }
      }
    }
  }

  return result;
}

function capitalise(s: string): string {
  return s.length === 0 ? s : (s[0]?.toUpperCase() ?? "") + s.slice(1);
}

// CLI entry — only when invoked directly.
//
// Exit-code semantics (deliberate):
//   0 — agent run completed. Findings, if any, live in the deliverable +
//       events; they are NOT a workflow failure. An autonomous agent
//       observing and reporting is doing its job.
//   1 — runtime / substrate failure. The agent could not run to completion
//       (handler threw, capability resolution failed, etc.). This is a
//       genuine workflow failure that requires substrate attention.
//
// Caller workflows that want to react to findings (post a comment, raise
// an issue, escalate) should parse the deliverable / event stream — not
// the exit code.
if (import.meta.main) {
  const opts = parseArgs(process.argv);
  runAgent(opts)
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error({ err: (e as Error).message }, "agent run failed");
      process.exit(1);
    });
}
