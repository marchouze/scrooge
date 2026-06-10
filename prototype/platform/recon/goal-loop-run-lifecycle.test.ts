// platform/recon/goal-loop-run-lifecycle.test.ts
//
// Tests for `recon:goal-loop-run-lifecycle` — every goal-loop module must
// emit run-lifecycle events (shared dispatchBriefBoundRun helper or direct
// recordAgentRunStarted), else its iterations are invisible to the autonomy
// run-feed (the gap that masked the 2026-06-10 phantom-brief backlog).
//
// Authority: D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION; D-QUEUE-CLOSEOUT-2026-06-10.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyGoalLoopSource, run } from "./goal-loop-run-lifecycle";

// Reconstruction of the pre-instrumentation goal-loop shape (planning trace
// only, no run-lifecycle emission) — the exact module class this gate exists
// to catch. Mirrors the pre-#1182 atlas/anya tails.
const UNINSTRUMENTED_SOURCE = `
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
import someHandler from "./some-handler";

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const goalLoopResult = await runner.runWithGoal(args, deriver);
  const handlerOutput = await someHandler(ctx);
  return { eventsEmitted: handlerOutput.eventsEmitted, ok: true, summary: "x" };
};
export default handler;
`;

const SHARED_HELPER_SOURCE = `
import {
  type GoalLoopBriefDispatchConfig,
  dispatchBriefBoundRun,
  openBriefsListForAgent,
} from "./goal-loop-brief-dispatch";

const handler = async (ctx) => {
  const openBriefs = openBriefsListForAgent("anya");
  const [brief] = openBriefs;
  if (brief) {
    const dispatch = await dispatchBriefBoundRun(ctx, brief, "i", 0, CONFIG);
  }
};
`;

const IN_FILE_SOURCE = `
import { recordAgentRunCompleted, recordAgentRunStarted } from "../../platform/records/helpers";

async function dispatchBriefBoundRun() {
  recordAgentRunStarted({ runId, briefId, agent, startedAt, substrate: "agent-runtime", citations, actor }, asOf);
}
`;

describe("classifyGoalLoopSource", () => {
  test("uninstrumented module (planning trace only) → none", () => {
    expect(classifyGoalLoopSource(UNINSTRUMENTED_SOURCE)).toBe("none");
  });

  test("shared-helper wiring → shared-helper", () => {
    expect(classifyGoalLoopSource(SHARED_HELPER_SOURCE)).toBe("shared-helper");
  });

  test("#1182-era in-file recordAgentRunStarted → in-file", () => {
    expect(classifyGoalLoopSource(IN_FILE_SOURCE)).toBe("in-file");
  });

  test("importing the helper without calling dispatchBriefBoundRun is NOT instrumented", () => {
    const src = 'import { openBriefsListForAgent } from "./goal-loop-brief-dispatch";\n';
    expect(classifyGoalLoopSource(src)).toBe("none");
  });
});

describe("recon:goal-loop-run-lifecycle", () => {
  test("passes on the real tree — every registered goal-loop is instrumented", () => {
    const result = run();
    expect(result.pipeline).toBe("recon:goal-loop-run-lifecycle");
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(result.ok).toBe(true);
    // 21 goal-loop modules + the non-empty-universe assertion.
    expect(result.asserted).toBeGreaterThanOrEqual(22);
  });

  test("fails when a goal-loop module ships uninstrumented", () => {
    const dir = mkdtempSync(join(tmpdir(), "goal-loop-recon-"));
    writeFileSync(join(dir, "newbie-goal-loop.ts"), UNINSTRUMENTED_SOURCE);
    writeFileSync(join(dir, "good-goal-loop.ts"), SHARED_HELPER_SOURCE);
    // Test files are excluded from the universe.
    writeFileSync(join(dir, "newbie-goal-loop.test.ts"), UNINSTRUMENTED_SOURCE);

    const result = run({ agentsDir: dir });
    expect(result.ok).toBe(false);
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.subject).toBe("goal-loop:newbie-goal-loop.ts");
    expect(fails[0]?.message).toContain("invisible to the autonomy run-feed");
  });

  test("fails on an empty universe (vacuous-gate guard)", () => {
    const dir = mkdtempSync(join(tmpdir(), "goal-loop-recon-empty-"));
    const result = run({ agentsDir: dir });
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.subject).toBe("goal-loop:universe");
  });
});
