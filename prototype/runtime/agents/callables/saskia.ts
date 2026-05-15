// runtime/agents/callables/saskia.ts
// Per-agent callable map for Saskia (Head of Global Markets).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import saskiaEventTriage from "../saskia-event-triage";
import saskiaGoalLoop from "../saskia-goal-loop";
import saskiaMarketsReadinessSnapshot from "../saskia-markets-readiness-snapshot";

export const SASKIA_CALLABLES: Record<string, AgentRunHandler> = {
  "saskia:markets-readiness-snapshot": saskiaMarketsReadinessSnapshot,
  "saskia:goal-loop": saskiaGoalLoop,
  "saskia:event-triage": saskiaEventTriage,
};
