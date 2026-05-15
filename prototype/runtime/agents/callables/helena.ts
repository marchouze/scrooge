// runtime/agents/callables/helena.ts
// Per-agent callable map for Helena (Chief Risk Officer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import helenaEventTriage from "../helena-event-triage";
import helenaGoalLoop from "../helena-goal-loop";
import helenaRiskAppetiteWatch from "../helena-risk-appetite-watch";

export const HELENA_CALLABLES: Record<string, AgentRunHandler> = {
  "helena:risk-appetite-watch": helenaRiskAppetiteWatch,
  "helena:goal-loop": helenaGoalLoop,
  "helena:event-triage": helenaEventTriage,
};
