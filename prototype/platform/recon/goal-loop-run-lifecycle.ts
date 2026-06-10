// platform/recon/goal-loop-run-lifecycle.ts
//
// Continuous-controls pipeline: `recon:goal-loop-run-lifecycle`
//
// ─── THE DEFECT THIS GUARDS ─────────────────────────────────────────────────
// The dashboard autonomy run-feed reads ONLY `AgentRunStarted{substrate:
// "agent-runtime"}`. A goal-loop that emits only the planning trace
// (AgentGoalEvaluated / AgentGoalSelected / AgentGoalDeferred) is invisible to
// the feed. On 2026-06-10 that instrumentation gap froze the feed at a 5-day-
// old run and masked a 48-brief phantom backlog (PR #1182,
// D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION). PR #1182 instrumented Atlas;
// this gate asserts EVERY goal-loop module emits the run lifecycle, so the
// next new goal-loop cannot ship uninstrumented.
//
// ─── WHAT THIS PIPELINE ASSERTS ─────────────────────────────────────────────
// Statically, over every `runtime/agents/*-goal-loop.ts` module (tests
// excluded):
//
//   (1) RUN-LIFECYCLE EMISSION WIRED: the module either
//       (a) imports + calls `dispatchBriefBoundRun` from the shared helper
//           `runtime/agents/goal-loop-brief-dispatch.ts`
//           (D-QUEUE-CLOSEOUT-2026-06-10 completion pattern), or
//       (b) calls `recordAgentRunStarted` directly (the #1182-era in-file
//           pattern used by atlas/rohan/helena/eitan/bea/ravi).
//       A module doing neither can never emit
//       `AgentRunStarted{agent-runtime}` ⇒ invisible to the run-feed ⇒ FAIL.
//
//   (2) NON-EMPTY UNIVERSE: at least one goal-loop module exists (guards
//       against a silently wrong glob/path making the gate vacuous).
//
// Static source-scan rationale: whether a module CAN emit the lifecycle is a
// property of its code, not of the event store (a freshly registered loop has
// no events yet — exactly the case this gate must catch). Same posture as
// `posting-engine-single-subscriber.ts`.
//
// Authority: D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION (CEO-approved
// 2026-06-10); D-QUEUE-CLOSEOUT-2026-06-10.
// Author: Atlas (Core banking platform architect, engineering).

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { ReconResult, ReconViolation } from "./types";
import { emptyResult } from "./types";

const PIPELINE = "recon:goal-loop-run-lifecycle";

const DEFAULT_AGENTS_DIR = resolve(import.meta.dir, "..", "..", "runtime", "agents");

export type GoalLoopLifecycleMechanism = "shared-helper" | "in-file" | "none";

/**
 * Classify how (whether) a goal-loop module emits run-lifecycle events.
 * Exported for direct unit-testing against reconstructed sources.
 */
export function classifyGoalLoopSource(source: string): GoalLoopLifecycleMechanism {
  const usesSharedHelper =
    /from\s+["']\.\/goal-loop-brief-dispatch["']/.test(source) &&
    /\bdispatchBriefBoundRun\s*\(/.test(source);
  if (usesSharedHelper) return "shared-helper";
  const usesInFile = /\brecordAgentRunStarted\s*\(/.test(source);
  if (usesInFile) return "in-file";
  return "none";
}

export function run(opts?: { agentsDir?: string }): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const agentsDir = opts?.agentsDir ?? DEFAULT_AGENTS_DIR;

  let files: string[] = [];
  try {
    files = readdirSync(agentsDir)
      .filter((f) => f.endsWith("-goal-loop.ts") && !f.endsWith(".test.ts"))
      .sort();
  } catch {
    files = [];
  }

  // Assertion 2 — non-empty universe.
  result.asserted++;
  if (files.length === 0) {
    violations.push({
      subject: "goal-loop:universe",
      message: `No \`*-goal-loop.ts\` modules found under ${agentsDir} — the gate would be vacuous. Either the path is wrong or the goal-loop substrate moved; update DEFAULT_AGENTS_DIR.`,
      severity: "fail",
    });
  }

  // Assertion 1 — every goal-loop module emits the run lifecycle.
  for (const file of files) {
    result.asserted++;
    let source = "";
    try {
      source = readFileSync(resolve(agentsDir, file), "utf8");
    } catch {
      violations.push({
        subject: `goal-loop:${file}`,
        message: `Could not read ${file} for run-lifecycle classification.`,
        severity: "fail",
      });
      continue;
    }
    const mechanism = classifyGoalLoopSource(source);
    if (mechanism === "none") {
      violations.push({
        subject: `goal-loop:${file}`,
        message: `Goal-loop module \`${file}\` emits no run-lifecycle events (neither the shared \`dispatchBriefBoundRun\` helper from goal-loop-brief-dispatch.ts nor a direct \`recordAgentRunStarted\` call). Its iterations are invisible to the autonomy run-feed (which reads only AgentRunStarted{substrate:"agent-runtime"}) — the exact gap that masked the 2026-06-10 phantom-brief backlog. Wire the shared helper per D-QUEUE-CLOSEOUT-2026-06-10. Citations: D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION.`,
        severity: "fail",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}
