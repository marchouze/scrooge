// runtime/agents/camille-event-triage.ts
//
// Camille's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Camille (CFO / Financial
// Controller) identified by `recon:trigger-spec-handler-symmetry` (Slice 2a,
// PR #212). Camille's §7 declares event-driven triggers on financial/audit
// events; this handler is the corresponding runtime entry-point.
//
// Subscribed events (per Camille's Team/Camille.md §7):
//   RestatementProposed, CapitalEvent, MaterialIFRSClassificationChange,
//   AgentEscalation, AuditFinding, RegulatorRequest
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Camille (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "RestatementProposed",
  "CapitalEvent",
  "MaterialIFRSClassificationChange",
  "AgentEscalation",
  "AuditFinding",
  "RegulatorRequest",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "camille:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `camille:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
