// runtime/agents/bea-event-triage.ts
//
// Bea's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Bea (Accountant / IFRS engineer)
// identified by `recon:trigger-spec-handler-symmetry` (Slice 2a, PR #212).
// Bea's §7 declares event-driven triggers on accounting/financial events;
// this handler is the corresponding runtime entry-point.
//
// Subscribed events (per Bea's Team/Bea.md §7):
//   TradePosted, FundingDrawn, PaymentSettled, AccrualBooked,
//   IFRS9ECLPublished, TaxClassificationPublished, RestatementProposed
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Bea (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "TradePosted",
  "FundingDrawn",
  "PaymentSettled",
  "AccrualBooked",
  "IFRS9ECLPublished",
  "TaxClassificationPublished",
  "RestatementProposed",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "bea:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `bea:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
