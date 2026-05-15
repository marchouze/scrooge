// runtime/agents/noa-feature-shipped.ts
//
// Noa's feature-shipped handler — stub.
//
// Fires when an IntranetFeatureShipped event lands. Records that a new
// intranet feature has been shipped and acknowledges.
//
// Subscribed events: IntranetFeatureShipped
//
// Stub behaviour: logs receipt of the triggering event and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Authority: Principle 1 (events-first authoring per CLAUDE.md).
// Author: Noa (Intranet Product Owner & UI Architect, reporting to CEO)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = ["IntranetFeatureShipped"] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "noa:feature-shipped — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `noa:feature-shipped stub — acknowledged ${relevant.length} IntranetFeatureShipped event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
