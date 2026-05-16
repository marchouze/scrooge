// scripts/record-agent-run.ts
//
// Lightweight helper to emit AgentRunStarted + AgentRunCompleted(outcome: "delivered")
// events for a Scrooge-coordinated dispatch (isolated worktree Agent call).
//
// When Scrooge dispatches an agent via an isolated worktree Agent call, the work
// gets done and a PR gets merged, but no run-lifecycle events are written to the
// event store. The daily evaluator therefore sees no events and scores the agent
// as inactive. Run this script after a PR merges to backfill the record.
//
// Idempotent: skips agents that already have an AgentRunStarted event for the
// same agentId + evaluationPeriod to prevent double-counting.
//
// Usage:
//   bun run agent:record-run \
//     --agent <agentId>          (e.g. "atlas", "mira")
//     --period <YYYY-MM-DD>      (evaluation date; defaults to today)
//     [--pr <number>]            (GitHub PR number, for the deliverable reference)
//     [--decision <decisionId>]  (CEO decision ID advanced, e.g. "D-RMS-PHASE-1")
//     [--summary <text>]         (one-line summary of what was delivered)
//
// Multiple --decision flags are supported by repeating the flag.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (Principle 6).
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { eventSchema } from "../platform/event-store/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["D-AGENT-AUTONOMY-OPERATIONAL"];

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
  agent: string;
  period: string;
  pr?: number;
  decisions: string[];
  summary: string;
} {
  const args: Record<string, string | string[]> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--") || i + 1 >= argv.length) continue;
    const key = arg.slice(2);
    const value = argv[i + 1] ?? "";
    i++;
    if (key === "decision") {
      const existing = args[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        args[key] = [value];
      }
    } else {
      args[key] = value;
    }
  }

  if (!args.agent || typeof args.agent !== "string" || args.agent.trim() === "") {
    console.error("Missing required argument: --agent <agentId>");
    console.error(
      "Usage: bun run agent:record-run --agent <agentId> [--period YYYY-MM-DD] [--pr <number>] [--decision <id>] [--summary <text>]",
    );
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const period =
    typeof args.period === "string" && args.period.match(/^\d{4}-\d{2}-\d{2}$/)
      ? args.period
      : today;

  const prRaw = args.pr;
  const pr =
    typeof prRaw === "string" && prRaw.trim() !== "" ? Number.parseInt(prRaw, 10) : undefined;

  const decisions = Array.isArray(args.decision)
    ? (args.decision as string[])
    : typeof args.decision === "string" && args.decision.trim() !== ""
      ? [args.decision]
      : [];

  const agentId = (args.agent as string).toLowerCase().trim();
  const summary =
    typeof args.summary === "string" && args.summary.trim() !== ""
      ? args.summary.trim()
      : pr !== undefined
        ? `Scrooge-coordinated dispatch — PR #${pr} merged`
        : `Scrooge-coordinated dispatch — period ${period}`;

  return { agent: agentId, period, pr, decisions, summary };
}

// ---------------------------------------------------------------------------
// Idempotency check
// ---------------------------------------------------------------------------

function hasExistingRun(agentId: string, period: string): boolean {
  const agentLower = agentId.toLowerCase();
  for (const e of eventStore.replay({})) {
    if (!e.as_of.startsWith(period)) continue;
    if (e.type !== "AgentRunStarted" && e.type !== "SubstrateAgentRunStarted") continue;
    const p = e.payload as Record<string, unknown>;
    // AgentRunStarted (RMS form) — agent is a ref object
    const agentRef = p.agent as Record<string, unknown> | undefined;
    if (typeof agentRef === "object" && agentRef !== null) {
      const name = String(agentRef.name ?? "").toLowerCase();
      const agentIdField = String(agentRef.agentId ?? "").toLowerCase();
      if (name === agentLower || agentIdField === `agent:${agentLower}`) return true;
    }
    // SubstrateAgentRunStarted — agent is a plain string
    const agentStr = String(p.agent ?? "").toLowerCase();
    if (agentStr === agentLower || agentStr === `agent:${agentLower}`) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const { agent, period, pr, decisions, summary } = parseArgs(process.argv.slice(2));
  const asOf = `${period}T09:00:00.000Z`;

  if (hasExistingRun(agent, period)) {
    console.log(
      `\nSKIP — AgentRunStarted already recorded for agent "${agent}" on period ${period}.`,
    );
    console.log(
      "Use --force to override (not yet implemented — delete events manually if needed).",
    );
    process.exit(0);
  }

  const runId = `run:${agent}:${period.replace(/-/g, "")}T090000Z:scrooge`;

  const actor = {
    type: "service" as const,
    id: "agent:scrooge:dispatch-recorder",
  };

  // --- AgentRunStarted ---
  const startedEvent = eventSchema.parse({
    event_id: newEventId(),
    type: "AgentRunStarted",
    as_of: asOf,
    entity: ENTITY,
    actor,
    citations: CITATIONS,
    payload: {
      runId,
      briefId: `brief:scrooge:${agent}:${period}`,
      agent: {
        name: agent,
        position: "scrooge-coordinated",
        agentId: `agent:${agent}`,
      },
      startedAt: asOf,
      substrate: "scrooge-coordinated-in-session",
      ...(pr !== undefined ? { worktree: `agent-worktree-pr-${pr}` } : {}),
    },
  });

  // --- AgentRunCompleted ---
  const followOnRoutes: Array<{ kind: string; target: string; directive: string }> = [];
  if (pr !== undefined) {
    followOnRoutes.push({
      kind: "agent",
      target: `github:pr:${pr}`,
      directive: `PR #${pr} merged to main`,
    });
  }
  for (const decisionId of decisions) {
    followOnRoutes.push({
      kind: "decision",
      target: decisionId,
      directive: `Advanced CEO decision ${decisionId}`,
    });
  }

  const completedEvent = eventSchema.parse({
    event_id: newEventId(),
    type: "AgentRunCompleted",
    as_of: asOf,
    entity: ENTITY,
    actor,
    citations: CITATIONS,
    payload: {
      runId,
      briefId: `brief:scrooge:${agent}:${period}`,
      agent: {
        name: agent,
        position: "scrooge-coordinated",
        agentId: `agent:${agent}`,
      },
      completedAt: asOf,
      outcome: "delivered",
      deliverableDocumentHashes: [],
      substrateGapsSurfaced: [
        "Autonomous scheduler not yet active — run recorded retroactively via record-agent-run.ts",
      ],
      citations: CITATIONS,
      followOnRoutes,
    },
  });

  eventStore.append(startedEvent);
  eventStore.append(completedEvent);

  console.log("\nAgent run recorded.");
  console.log(`  Agent    : ${agent}`);
  console.log(`  Period   : ${period}`);
  console.log(`  Run ID   : ${runId}`);
  if (pr !== undefined) console.log(`  PR       : #${pr}`);
  if (decisions.length > 0) console.log(`  Decisions: ${decisions.join(", ")}`);
  console.log(`  Summary  : ${summary}`);
  console.log();
  console.log("Events emitted: AgentRunStarted + AgentRunCompleted(outcome: delivered).");
  console.log(
    "The daily evaluator will now count this agent as having 1 delivered run for the period.",
  );
  console.log(
    "\nNext: re-run the performance evaluator to pick up the new run:\n  bun run agent:performance-eval",
  );
}

main();
