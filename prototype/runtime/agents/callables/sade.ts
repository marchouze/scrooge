// runtime/agents/callables/sade.ts
// Per-agent callable map for Sade (AgentOps & Token Efficiency Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import sadeAgentRetirement from "../sade-agent-retirement";
import sadeAgentopsReadiness from "../sade-agentops-readiness";
import sadeEfficiencyAdvisory from "../sade-efficiency-advisory";
import sadeEventTriage from "../sade-event-triage";
import sadeFleetOptimisation from "../sade-fleet-optimisation";
import sadeTokenUsageAnalysis from "../sade-token-usage-analysis";

export const SADE_CALLABLES: Record<string, AgentRunHandler> = {
  "sade:agentops-readiness": sadeAgentopsReadiness,
  "sade:token-usage-analysis": sadeTokenUsageAnalysis,
  "sade:efficiency-advisory": sadeEfficiencyAdvisory,
  "sade:fleet-optimisation": sadeFleetOptimisation,
  "sade:event-triage": sadeEventTriage,
  "sade:agent-retirement": sadeAgentRetirement,
};
