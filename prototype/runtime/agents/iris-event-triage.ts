// runtime/agents/iris-event-triage.ts
//
// Iris's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Iris (POPIA / Privacy engineer;
// Information Officer) identified by `recon:trigger-spec-handler-symmetry`
// (Slice 2a, PR #212). Iris's §7 declares event-driven triggers on data-
// protection events; this handler is the corresponding runtime entry-point.
//
// Subscribed events (per Iris's Team/Iris.md §7):
//   PersonalInformationCompromiseSuspected, DSARReceived,
//   NewProcessingPurposeProposed, ConsentWithdrawn,
//   CrossBorderTransferRequested, InformationRegulatorInquiry, AgentEscalation
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Iris (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "PersonalInformationCompromiseSuspected",
  "DSARReceived",
  "NewProcessingPurposeProposed",
  "ConsentWithdrawn",
  "CrossBorderTransferRequested",
  "InformationRegulatorInquiry",
  "AgentEscalation",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "iris:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `iris:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
