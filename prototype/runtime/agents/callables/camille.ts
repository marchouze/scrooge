// runtime/agents/callables/camille.ts
// Per-agent callable map for Camille (CFO / Financial Controller).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import camilleEventTriage from "../camille-event-triage";
import camilleFinancialPositionSnapshot from "../camille-financial-position-snapshot";
import camilleGoalLoop from "../camille-goal-loop";
import type { AgentRunHandler } from "../../types";

export const CAMILLE_CALLABLES: Record<string, AgentRunHandler> = {
  "camille:financial-position-snapshot": camilleFinancialPositionSnapshot,
  "camille:goal-loop": camilleGoalLoop,
  "camille:event-triage": camilleEventTriage,
};
