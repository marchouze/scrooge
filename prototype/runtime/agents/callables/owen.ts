// runtime/agents/callables/owen.ts
// Per-agent callable map for Owen (Company Secretary / Governance).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import owenDecisionImpactSweep from "../owen-decision-impact-sweep";
import owenEventTriage from "../owen-event-triage";
import owenGoalLoop from "../owen-goal-loop";
import owenGovernanceCyclePrep from "../owen-governance-cycle-prep";

export const OWEN_CALLABLES: Record<string, AgentRunHandler> = {
  "owen:goal-loop": owenGoalLoop,
  "owen:governance-cycle-prep": owenGovernanceCyclePrep,
  "owen:event-triage": owenEventTriage,
  "owen:decision-impact-sweep": owenDecisionImpactSweep,
};
