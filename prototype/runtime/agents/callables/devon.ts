// runtime/agents/callables/devon.ts
// Per-agent callable map for Devon (Operational Resilience Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import devonEventTriage from "../devon-event-triage";
import devonGoalLoop from "../devon-goal-loop";
import devonOperationalResilienceSnapshot from "../devon-operational-resilience-snapshot";
import type { AgentRunHandler } from "../../types";

export const DEVON_CALLABLES: Record<string, AgentRunHandler> = {
  "devon:operational-resilience-snapshot": devonOperationalResilienceSnapshot,
  "devon:goal-loop": devonGoalLoop,
  "devon:event-triage": devonEventTriage,
};
