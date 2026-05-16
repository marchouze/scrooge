// runtime/agents/callables/tomas.ts
// Per-agent callable map for Tomas (Payments Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import tomasDailyReconciliation from "../tomas-daily-reconciliation";
import tomasEventTriage from "../tomas-event-triage";
import tomasGoalLoop from "../tomas-goal-loop";
import tomasPaymentsReadiness from "../tomas-payments-readiness";

export const TOMAS_CALLABLES: Record<string, AgentRunHandler> = {
  "tomas:payments-readiness": tomasPaymentsReadiness,
  "tomas:daily-reconciliation": tomasDailyReconciliation,
  "tomas:goal-loop": tomasGoalLoop,
  "tomas:event-triage": tomasEventTriage,
};
