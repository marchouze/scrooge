// runtime/agents/linnea-event-triage.ts
//
// Linnea's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Linnea (COO / Operations
// engineer) identified by `recon:trigger-spec-handler-symmetry` (Slice 2a,
// PR #212). Linnea's §7 declares event-driven triggers; this handler is the
// corresponding runtime entry-point.
//
// Subscribed events (per Linnea's Team/Linnea.md §7):
//   CeoDecision, WorkstreamRegistered, AgentEscalation
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Linnea (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = ["CeoDecision", "WorkstreamRegistered", "AgentEscalation"] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "linnea:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `linnea:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
