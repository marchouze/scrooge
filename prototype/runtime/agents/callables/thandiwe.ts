// runtime/agents/callables/thandiwe.ts
// Per-agent callable map for Thandiwe (Chief Audit Executive).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import thandiweAuditCommitteePrep from "../thandiwe-audit-committee-prep";
import thandiweEventTriage from "../thandiwe-event-triage";
import thandiweGoalLoop from "../thandiwe-goal-loop";
import type { AgentRunHandler } from "../../types";

export const THANDIWE_CALLABLES: Record<string, AgentRunHandler> = {
  "thandiwe:audit-committee-prep": thandiweAuditCommitteePrep,
  "thandiwe:goal-loop": thandiweGoalLoop,
  "thandiwe:event-triage": thandiweEventTriage,
};
