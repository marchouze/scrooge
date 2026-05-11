// runtime/agents/nolan-event-triage.ts
//
// Nolan's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Nolan (HR / Hiring engineer;
// agent-recruitment orchestrator) identified by
// `recon:trigger-spec-handler-symmetry` (Slice 2a, PR #212). Nolan's §7
// declares event-driven triggers; this handler is the corresponding runtime
// entry-point.
//
// Subscribed events (per Nolan's Team/Nolan.md §7):
//   RoleBriefDelivered, MandateGapDetected, WorkstreamRegistered
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Nolan (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "RoleBriefDelivered",
  "MandateGapDetected",
  "WorkstreamRegistered",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "nolan:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `nolan:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
