// runtime/agents/senna-event-triage.ts
//
// Senna's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Senna (Security substrate
// engineer; DevSecOps engineer) identified by
// `recon:trigger-spec-handler-symmetry` (Slice 2a, PR #212). Senna's §7
// declares event-driven triggers on DevSecOps/security events; this handler
// is the corresponding runtime entry-point.
//
// Subscribed events (per Senna's Team/Senna.md §7):
//   MergeRequested, SecurityIncidentRaised, KeyRotationDue,
//   DependencyVulnDetected, SuspiciousAuthEvent, SBOMRequired
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Senna (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "MergeRequested",
  "SecurityIncidentRaised",
  "KeyRotationDue",
  "DependencyVulnDetected",
  "SuspiciousAuthEvent",
  "SBOMRequired",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "senna:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `senna:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
