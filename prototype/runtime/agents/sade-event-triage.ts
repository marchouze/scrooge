// runtime/agents/sade-event-triage.ts
//
// Sade's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Sade (AgentOps engineer during
// build phase; HR engineer for the human layer at licence-day) identified by
// `recon:trigger-spec-handler-symmetry` (Slice 2a, PR #212). Sade's §7
// declares event-driven triggers on agent-lifecycle and HR events; this
// handler is the corresponding runtime entry-point.
//
// Subscribed events (per Sade's Team/Sade.md §7):
//   AgentRegistered, AgentRetired, AgentCapabilityChanged, PersonaSpecChanged,
//   HireConfirmed, Termination, LeaveGranted, DisciplinaryActionRequested
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// No LLM call; no Owner Inbox deliverable in this stub pass. Full
// implementation is a roadmap item per D-AGENT-AUTONOMY-OPERATIONAL.
//
// Author: Atlas (Core banking platform architect) · Sade (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "AgentRegistered",
  "AgentRetired",
  "AgentCapabilityChanged",
  "PersonaSpecChanged",
  "HireConfirmed",
  "Termination",
  "LeaveGranted",
  "DisciplinaryActionRequested",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );

  logger.info(
    {
      triggeringCount: triggering.length,
      relevantCount: relevant.length,
      eventTypes: relevant.map((e) => e.type),
    },
    "sade:event-triage — stub received events (full implementation pending)",
  );

  return {
    eventsEmitted: 0,
    summary: `sade:event-triage stub — acknowledged ${relevant.length} event(s) [${[...new Set(relevant.map((e) => e.type))].join(", ") || "none"}]. Full triage implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.`,
    ok: true,
  };
};

export default handler;
