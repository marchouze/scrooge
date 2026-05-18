// runtime/agents/callables/kai.ts
// Per-agent callable map for Kai (Markets / Trading Systems Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import kaiCreditCapitalFundingCheck from "../kai-credit-capital-funding-check";
import kaiEventTriage from "../kai-event-triage";
import kaiGoalLoop from "../kai-goal-loop";
import kaiIdentityGatewayCheck from "../kai-identity-gateway-check";
import kaiM1CdmTypescriptBindings from "../kai-m1-cdm-typescript-bindings";
import kaiPreTradeGatewayAggregator from "../kai-pre-trade-gateway-aggregator";
import kaiSuitabilityGatewayCheck from "../kai-suitability-gateway-check";

export const KAI_CALLABLES: Record<string, AgentRunHandler> = {
  "kai:m1-cdm-typescript-bindings": kaiM1CdmTypescriptBindings,
  "kai:pre-trade-gateway-aggregator": kaiPreTradeGatewayAggregator,
  // Slices 5–7 gateway check handlers
  "kai:identity-gateway-check": kaiIdentityGatewayCheck,
  "kai:suitability-gateway-check": kaiSuitabilityGatewayCheck,
  "kai:credit-capital-funding-check": kaiCreditCapitalFundingCheck,
  "kai:goal-loop": kaiGoalLoop,
  "kai:event-triage": kaiEventTriage,
};
