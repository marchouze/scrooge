// runtime/agents/callables/rohan.ts
// Per-agent callable map for Rohan (Risk Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import rohanBacktestHarness from "../rohan-backtest-harness";
import rohanEventTriage from "../rohan-event-triage";
import rohanGoalLoop from "../rohan-goal-loop";
import rohanMarketRiskLimitCheck from "../rohan-market-risk-limit-check";
import rohanRiskRun from "../rohan-risk-run";

export const ROHAN_CALLABLES: Record<string, AgentRunHandler> = {
  "rohan:risk-run": rohanRiskRun,
  "rohan:goal-loop": rohanGoalLoop,
  "rohan:backtest-harness": rohanBacktestHarness,
  "rohan:event-triage": rohanEventTriage,
  "rohan:market-risk-limit-check": rohanMarketRiskLimitCheck,
};
