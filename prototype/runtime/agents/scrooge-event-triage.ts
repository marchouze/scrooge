// runtime/agents/scrooge-event-triage.ts
//
// Scrooge's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Scrooge (Chief of Staff /
// Orchestrator) identified by `recon:trigger-spec-handler-symmetry`
// (Slice 2a, PR #212). Scrooge's §7 declares event-driven triggers on
// orchestration-relevant events; this handler is the corresponding
// runtime entry-point.
//
// Subscribed events (per Scrooge's §7):
//   AgentEscalation, WorkstreamCompleted, WorkstreamRegistered,
//   HireConfirmed, MandateGapDetected
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Scrooge (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "AgentEscalation",
  "WorkstreamCompleted",
  "WorkstreamRegistered",
  "HireConfirmed",
  "MandateGapDetected",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "scrooge:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `scrooge:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
