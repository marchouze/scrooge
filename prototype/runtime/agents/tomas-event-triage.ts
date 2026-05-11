// runtime/agents/tomas-event-triage.ts
//
// Tomas's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Tomas (Payments engineer)
// identified by `recon:trigger-spec-handler-symmetry` (Slice 2a, PR #212).
// Tomas's §7 declares event-driven triggers on payment/settlement events;
// this handler is the corresponding runtime entry-point.
//
// Subscribed events (per Tomas's Team/Tomas.md §7):
//   SettlementInstructionReceived, PaymentInitiated, ReconciliationBreak,
//   CutOffBreach, SchemeRuleChange, CSPAttestationDue, SanctionsHoldRaised
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Tomas (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "SettlementInstructionReceived",
  "PaymentInitiated",
  "ReconciliationBreak",
  "CutOffBreach",
  "SchemeRuleChange",
  "CSPAttestationDue",
  "SanctionsHoldRaised",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "tomas:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `tomas:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
