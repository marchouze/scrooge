// runtime/agents/noa-ux-finding-raised.ts
//
// Noa's ux-finding-raised handler — stub.
//
// Fires when a UXFindingRaised event lands. Records that a UX finding
// has been raised and acknowledges.
//
// Subscribed events: UXFindingRaised
//
// Stub behaviour: logs receipt of the triggering event and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Authority: Principle 1 (events-first authoring per CLAUDE.md).
// Author: Noa (Intranet Product Owner & UI Architect, reporting to CEO)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = ["UXFindingRaised"] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "noa:ux-finding-raised — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `noa:ux-finding-raised stub — acknowledged ${relevant.length} UXFindingRaised event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
