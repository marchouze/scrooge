// scripts/run-performance-evaluations.ts
//
// One-shot script: runs performance evaluations for all active agents for
// yesterday (or a date passed as --date YYYY-MM-DD).
//
// Usage:
//   bun run scripts/run-performance-evaluations.ts
//   bun run scripts/run-performance-evaluations.ts --date 2026-05-14
//
// Author: Sade (AgentOps engineer, engineering)

import { runPerformanceEvaluations } from "../platform/agents/performance-runner";
import type { Actor } from "../platform/event-store/types";

// Resolve evaluation period from CLI args or default to yesterday
const period = process.argv.includes("--date")
  ? process.argv[process.argv.indexOf("--date") + 1]
  : new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const force = process.argv.includes("--force");

if (!period || !/^\d{4}-\d{2}-\d{2}$/.test(period)) {
  console.error(`Invalid date: "${period}". Expected YYYY-MM-DD.`);
  process.exit(1);
}

const actor: Actor = {
  type: "service",
  id: "agent:sade:performance-evaluator",
};

console.log(`Running performance evaluations for ${period}…`);

if (force) console.log("--force: bypassing idempotency, re-evaluating all agents.");

const result = await runPerformanceEvaluations(period, actor, { force });

console.log(`Evaluated ${result.evaluated} agents, skipped ${result.skipped} (idempotent).`);
