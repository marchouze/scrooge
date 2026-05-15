// runtime/agents/callables/kai.ts
// Per-agent callable map for Kai (Markets / Trading Systems Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import kaiEventTriage from "../kai-event-triage";
import kaiGoalLoop from "../kai-goal-loop";
import kaiM1CdmTypescriptBindings from "../kai-m1-cdm-typescript-bindings";
import kaiPreTradeGatewayAggregator from "../kai-pre-trade-gateway-aggregator";

export const KAI_CALLABLES: Record<string, AgentRunHandler> = {
  "kai:m1-cdm-typescript-bindings": kaiM1CdmTypescriptBindings,
  "kai:pre-trade-gateway-aggregator": kaiPreTradeGatewayAggregator,
  "kai:goal-loop": kaiGoalLoop,
  "kai:event-triage": kaiEventTriage,
};
