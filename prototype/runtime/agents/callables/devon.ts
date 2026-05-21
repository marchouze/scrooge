// runtime/agents/callables/devon.ts
// Per-agent callable map for Devon (Operational Resilience Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import devonEventTriage from "../devon-event-triage";
import devonFxRatesIngest from "../devon-fx-rates-ingest";
import devonFxTwelvedataIngest from "../devon-fx-twelvedata-ingest";
import devonGoalLoop from "../devon-goal-loop";
import devonOperationalResilienceSnapshot from "../devon-operational-resilience-snapshot";

export const DEVON_CALLABLES: Record<string, AgentRunHandler> = {
  "devon:operational-resilience-snapshot": devonOperationalResilienceSnapshot,
  "devon:goal-loop": devonGoalLoop,
  "devon:event-triage": devonEventTriage,
  "devon:fx-rates-ingest": devonFxRatesIngest,
  "devon:fx-twelvedata-ingest": devonFxTwelvedataIngest,
};
