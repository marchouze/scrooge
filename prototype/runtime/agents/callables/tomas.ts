// runtime/agents/callables/tomas.ts
// Per-agent callable map for Tomas (Payments Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import tomasEventTriage from "../tomas-event-triage";
import tomasGoalLoop from "../tomas-goal-loop";
import tomasPaymentsReadiness from "../tomas-payments-readiness";
import type { AgentRunHandler } from "../../types";

export const TOMAS_CALLABLES: Record<string, AgentRunHandler> = {
  "tomas:payments-readiness": tomasPaymentsReadiness,
  "tomas:goal-loop": tomasGoalLoop,
  "tomas:event-triage": tomasEventTriage,
};
