// runtime/agents/callables/eitan.ts
// Per-agent callable map for Eitan (Liquidity / Capital Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import eitanEventTriage from "../eitan-event-triage";
import eitanGoalLoop from "../eitan-goal-loop";
import eitanLiquiditySnapshot from "../eitan-liquidity-snapshot";
import type { AgentRunHandler } from "../../types";

export const EITAN_CALLABLES: Record<string, AgentRunHandler> = {
  "eitan:liquidity-snapshot": eitanLiquiditySnapshot,
  "eitan:goal-loop": eitanGoalLoop,
  "eitan:event-triage": eitanEventTriage,
};
