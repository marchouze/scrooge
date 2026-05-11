// runtime/agents/eitan-event-triage.ts
//
// Eitan's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Eitan (Liquidity / Capital
// engineer) identified by `recon:trigger-spec-handler-symmetry` (Slice 2a,
// PR #212). Eitan's §7 declares event-driven triggers on liquidity/capital
// events; this handler is the corresponding runtime entry-point.
//
// Subscribed events (per Eitan's Team/Eitan.md §7):
//   IRRBBExcursion, FXPositionBreach, LCRRatioProjection, NSFRRatioProjection,
//   CapitalActionTrigger, AgentEscalation, PolicyChange
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Eitan (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "IRRBBExcursion",
  "FXPositionBreach",
  "LCRRatioProjection",
  "NSFRRatioProjection",
  "CapitalActionTrigger",
  "AgentEscalation",
  "PolicyChange",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "eitan:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `eitan:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
