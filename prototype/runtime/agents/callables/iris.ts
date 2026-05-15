// runtime/agents/callables/iris.ts
// Per-agent callable map for Iris (POPIA / Privacy Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import irisEventTriage from "../iris-event-triage";
import irisGoalLoop from "../iris-goal-loop";
import irisPopiaControlsSnapshot from "../iris-popia-controls-snapshot";

export const IRIS_CALLABLES: Record<string, AgentRunHandler> = {
  "iris:popia-controls-snapshot": irisPopiaControlsSnapshot,
  "iris:goal-loop": irisGoalLoop,
  "iris:event-triage": irisEventTriage,
};
