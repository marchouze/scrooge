// runtime/agents/metadata/kai.ts
// Per-agent handler metadata for Kai (Markets / Trading Systems Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const KAI_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Kai", "m1-cdm-typescript-bindings", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "27 6 * * MON",
  }),
  entry("Kai", "pre-trade-gateway-aggregator", "event-driven", {
    subscribesTo: ["OrderProposed", "GatewayCheckCompleted"],
  }),
  // kai:goal-loop — cohort-3 (on-request only).
  entry("Kai", "goal-loop", "on-request"),
  entry("Kai", "event-triage", "event-driven", {
    subscribesTo: [
      "OrderSubmitted",
      "OrderFilled",
      "PreTradeGatewayBlock",
      "OrderRoutingAnomaly",
      "SurveillanceFeedGap",
      "MarketDataOutage",
      "ExchangeRuleChange",
    ],
  }),
];
