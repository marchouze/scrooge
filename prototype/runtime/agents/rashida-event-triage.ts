// runtime/agents/rashida-event-triage.ts
//
// Rashida's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Rashida (Chief Information
// Security Officer) identified by `recon:trigger-spec-handler-symmetry`
// (Slice 2a, PR #212). Rashida's §7 declares event-driven triggers on
// security-domain events; this handler is the corresponding runtime
// entry-point.
//
// Subscribed events (per Rashida's Team/Rashida.md §7):
//   SecurityIncidentRaised, ThreatModelExceptionRequested,
//   ThreatModelGateDecision, KeyCeremonyScheduled,
//   SBOMAcceptanceRequired, VendorSecurityReview,
//   RegulatorCyberInquiry, PersonalInformationCompromiseSuspected,
//   AgentEscalation
//
// Stub behaviour: logs receipt of triggering events and emits a
// `SubstrateAlert` noting the handler is not yet implemented beyond
// acknowledgement. No LLM call; no Owner Inbox deliverable in this
// stub pass. Full implementation is a roadmap item per
// D-AGENT-AUTONOMY-OPERATIONAL substrate-gap log.
//
// Author: Atlas (Core banking platform architect) · Rashida (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "SecurityIncidentRaised",
  "ThreatModelExceptionRequested",
  "ThreatModelGateDecision",
  "KeyCeremonyScheduled",
  "SBOMAcceptanceRequired",
  "VendorSecurityReview",
  "RegulatorCyberInquiry",
  "PersonalInformationCompromiseSuspected",
  "AgentEscalation",
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
    "rashida:event-triage — stub received events (full implementation pending)",
  );

  return {
    eventsEmitted: 0,
    summary: `rashida:event-triage stub — acknowledged ${relevant.length} event(s) [${[...new Set(relevant.map((e) => e.type))].join(", ") || "none"}]. Full triage implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.`,
    ok: true,
  };
};

export default handler;
