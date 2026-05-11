// runtime/agents/anya-event-triage.ts
//
// Anya's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Anya (Core platform projection
// engineer; event-schema and projection substrate engineer) identified by
// `recon:trigger-spec-handler-symmetry` (Slice 2a, PR #212). Anya's §7
// declares additional event-driven triggers beyond the existing
// `projection-refresh` handler; this handler covers the remaining gaps.
//
// Subscribed events (per Anya's Team/Anya.md §7):
//   EventSchemaPublished, ObligationRegistered, PolicyChange
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Anya (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "EventSchemaPublished",
  "ObligationRegistered",
  "PolicyChange",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "anya:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `anya:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
