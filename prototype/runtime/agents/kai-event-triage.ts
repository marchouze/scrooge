// runtime/agents/kai-event-triage.ts
//
// Kai's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Kai (Trading systems engineer)
// identified by `recon:trigger-spec-handler-symmetry` (Slice 2a, PR #212).
// Kai's §7 declares event-driven triggers on order/market-data events; this
// handler is the corresponding runtime entry-point.
//
// Subscribed events (per Kai's Team/Kai.md §7):
//   OrderSubmitted, OrderFilled, PreTradeGatewayBlock, OrderRoutingAnomaly,
//   SurveillanceFeedGap, MarketDataOutage, ExchangeRuleChange
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// No LLM call; no Owner Inbox deliverable in this stub pass. Full
// implementation is a roadmap item per D-AGENT-AUTONOMY-OPERATIONAL.
//
// Author: Atlas (Core banking platform architect) · Kai (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "OrderSubmitted",
  "OrderFilled",
  "PreTradeGatewayBlock",
  "OrderRoutingAnomaly",
  "SurveillanceFeedGap",
  "MarketDataOutage",
  "ExchangeRuleChange",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );

  logger.info(
    {
      triggeringCount: triggering.length,
      relevantCount: relevant.length,
      eventTypes: relevant.map((e) => e.type),
    },
    "kai:event-triage — stub received events (full implementation pending)",
  );

  return {
    eventsEmitted: 0,
    summary: `kai:event-triage stub — acknowledged ${relevant.length} event(s) [${[...new Set(relevant.map((e) => e.type))].join(", ") || "none"}]. Full triage implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.`,
    ok: true,
  };
};

export default handler;
