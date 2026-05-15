// runtime/agents/noa-design-review-complete.ts
//
// Noa's design-review-complete handler — stub.
//
// Fires when a DesignReviewComplete event lands. Records that a design
// review has been completed and acknowledges.
//
// Subscribed events: DesignReviewComplete
//
// Stub behaviour: logs receipt of the triggering event and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Authority: Principle 1 (events-first authoring per CLAUDE.md).
// Author: Noa (Intranet Product Owner & UI Architect, reporting to CEO)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = ["DesignReviewComplete"] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "noa:design-review-complete — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `noa:design-review-complete stub — acknowledged ${relevant.length} DesignReviewComplete event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
