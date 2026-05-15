// runtime/agents/callables/zara.ts
// Per-agent callable map for Zara (MLRO / FIC Compliance Officer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import zaraEventTriage from "../zara-event-triage";
import zaraGoalLoop from "../zara-goal-loop";
import zaraMlroSupervision from "../zara-mlro-supervision";

export const ZARA_CALLABLES: Record<string, AgentRunHandler> = {
  "zara:mlro-supervision": zaraMlroSupervision,
  "zara:goal-loop": zaraGoalLoop,
  "zara:event-triage": zaraEventTriage,
};
