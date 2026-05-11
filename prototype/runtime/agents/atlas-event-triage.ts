// runtime/agents/atlas-event-triage.ts
//
// Atlas's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Atlas (Core banking platform
// architect) identified by `recon:trigger-spec-handler-symmetry` (Slice 2a,
// PR #212). Atlas's §7 declares event-driven triggers on platform-architecture
// events; this handler is the corresponding runtime entry-point.
//
// Subscribed events (per Atlas's Team/Atlas.md §7):
//   EventSchemaProposal, IdentityPermissionChangeProposal, SubstrateAlert
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "EventSchemaProposal",
  "IdentityPermissionChangeProposal",
  "SubstrateAlert",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "atlas:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `atlas:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
