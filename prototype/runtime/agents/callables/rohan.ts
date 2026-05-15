// runtime/agents/callables/rohan.ts
// Per-agent callable map for Rohan (Risk Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import rohanBacktestHarness from "../rohan-backtest-harness";
import rohanEventTriage from "../rohan-event-triage";
import rohanGoalLoop from "../rohan-goal-loop";
import rohanRiskRun from "../rohan-risk-run";
import type { AgentRunHandler } from "../../types";

export const ROHAN_CALLABLES: Record<string, AgentRunHandler> = {
  "rohan:risk-run": rohanRiskRun,
  "rohan:goal-loop": rohanGoalLoop,
  "rohan:backtest-harness": rohanBacktestHarness,
  "rohan:event-triage": rohanEventTriage,
};
