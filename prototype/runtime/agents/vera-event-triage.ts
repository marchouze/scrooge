// runtime/agents/vera-event-triage.ts
//
// Vera's event-triage handler — stub, Slice 2b.
//
// Closes the `specWithoutHandler` violation for Vera (Internal audit
// engineer; third line of defence) identified by
// `recon:trigger-spec-handler-symmetry` (Slice 2a, PR #212). Vera's §7
// declares a CeoDecision event-driven trigger (Vera reviews and validates
// CEO decisions from a third-line audit perspective); this handler is the
// corresponding runtime entry-point.
//
// Subscribed events (per Vera's §7):
//   CeoDecision
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Vera (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = ["CeoDecision"] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "vera:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `vera:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
