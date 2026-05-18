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
  // Slice 5 — identity and authorisation check (FAIS §8A / FMA §5 / D-PARTY-REGISTER).
  entry("Kai", "identity-gateway-check", "event-driven", {
    subscribesTo: ["GatewayCheckRequested"],
  }),
  // Slice 6 — FAIS suitability check (FAIS §8D / D-FAIS-SCOPE / ORG-CD-01).
  entry("Kai", "suitability-gateway-check", "event-driven", {
    subscribesTo: ["GatewayCheckRequested"],
  }),
  // Slice 7 — Credit limit, capital impact (BA 325 RWA), and funding (LCR) checks.
  // Authority: RAS-B3, ORG-PR-01, Banks Act 94/1990 Reg 38 (BA 325), BCBS 238.
  entry("Kai", "credit-capital-funding-check", "event-driven", {
    subscribesTo: ["GatewayCheckRequested"],
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
