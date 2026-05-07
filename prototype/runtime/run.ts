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
import anyaProjectionDrift from "./agents/anya-projection-drift";
import anyaProjectionRefresh from "./agents/anya-projection-refresh";
import atlasSubstrateState from "./agents/atlas-substrate-state";
import miraCitationGate from "./agents/mira-citation-gate";
import miraObligationsSnapshot from "./agents/mira-obligations-snapshot";
import owenGovernanceCyclePrep from "./agents/owen-governance-cycle-prep";
import scroogeInboxHygiene from "./agents/scrooge-inbox-hygiene";
import sennaSecuritySubstrateState from "./agents/senna-security-substrate-state";
import veraOvernightRecon from "./agents/vera-overnight-recon";
import type { AgentRunContext, AgentRunHandler, AgentRunOutput, TriggerKind } from "./types";

interface HandlerEntry {
  /** Trigger classification. */
  readonly kind: TriggerKind;
  /** The handler itself. */
  readonly handler: AgentRunHandler;
  /**
   * For event-driven entries: the event types this handler subscribes to.
   * Empty for scheduled / on-request entries. After a parent run, the
   * runtime fans out to any event-driven handler whose subscribesTo
   * intersects the set of types appended during the parent run.
   */
  readonly subscribesTo?: readonly string[];
}

// Static handler registry. Keyed by `<lowercased-agent>:<trigger-id>`.
const HANDLERS: Record<string, HandlerEntry> = {
  "vera:overnight-recon": { kind: "scheduled", handler: veraOvernightRecon },
  "atlas:substrate-state": { kind: "scheduled", handler: atlasSubstrateState },
  "anya:projection-drift": { kind: "scheduled", handler: anyaProjectionDrift },
  "scrooge:inbox-hygiene": { kind: "scheduled", handler: scroogeInboxHygiene },
  "owen:governance-cycle-prep": { kind: "scheduled", handler: owenGovernanceCyclePrep },
  "mira:obligations-snapshot": { kind: "scheduled", handler: miraObligationsSnapshot },
  "senna:security-substrate-state": { kind: "scheduled", handler: sennaSecuritySubstrateState },
  // On-request: invoked ad-hoc, not on a schedule. The CI gate runs as
  // part of `bun run ci`; the agent shape is the on-demand surface for the
  // same machinery (Marc, an automation, or a workflow_dispatch can fire
  // it without waiting for the next cron tick).
  "mira:citation-gate": { kind: "on-request", handler: miraCitationGate },
  // Event-driven: fires when any of the named event types is appended
  // within a parent agent run. Refreshes the dashboard projection cache
  // whenever substrate state changes. Demonstrative subscription set;
  // expand as more event types come online.
  "anya:projection-refresh": {
    kind: "event-driven",
    handler: anyaProjectionRefresh,
    subscribesTo: [
      "SubstrateStateSnapshot",
      "WorkstreamRegistered",
      "WorkstreamCompleted",
      "CeoDecision",
    ],
  },
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
  if (entry.kind !== "event-driven" && !ctx.dryRun) {
    const newEventTypes = new Set<string>();
    for (const e of eventStore.replay({ fromSequence: seqBefore + 1 })) {
      newEventTypes.add(e.type);
    }
    if (newEventTypes.size > 0) {
      const triggered: string[] = [];
      for (const [k, e] of Object.entries(HANDLERS)) {
        if (e.kind !== "event-driven") continue;
        const subs = e.subscribesTo ?? [];
        if (subs.some((t) => newEventTypes.has(t))) triggered.push(k);
      }
      for (const tk of triggered) {
        const tEntry = HANDLERS[tk];
        if (!tEntry) continue;
        const [tAgent, tTrigger] = tk.split(":");
        if (!tAgent || !tTrigger) continue;
        const tCtx: AgentRunContext = {
          agent: capitalise(tAgent),
          trigger: { kind: "event-driven", id: tTrigger },
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
              (tEntry.subscribesTo ?? []).includes(t),
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
