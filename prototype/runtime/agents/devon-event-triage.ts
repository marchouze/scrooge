// runtime/agents/devon-event-triage.ts
//
// Devon's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Devon (Operational Resilience
// engineer) identified by `recon:trigger-spec-handler-symmetry` (Slice 2a,
// PR #212). Devon's §7 declares event-driven triggers on resilience/incident
// events; this handler is the corresponding runtime entry-point.
//
// Subscribed events (per Devon's Team/Devon.md §7):
//   IncidentRaised, SLOBudgetBurn, CapacityBreach, ChangeApprovalRequested,
//   AgentEscalation, ResilienceTestResult, AuditFinding
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Devon (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "IncidentRaised",
  "SLOBudgetBurn",
  "CapacityBreach",
  "ChangeApprovalRequested",
  "AgentEscalation",
  "ResilienceTestResult",
  "AuditFinding",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "devon:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `devon:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
