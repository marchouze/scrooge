// runtime/agents/helena-event-triage.ts
//
// Helena's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Helena (Chief Risk Officer)
// identified by `recon:trigger-spec-handler-symmetry` (Slice 2a, PR #212).
// Helena's §7 declares event-driven triggers on risk-governance events;
// this handler is the corresponding runtime entry-point.
//
// Subscribed events (per Helena's Team/Helena.md §7):
//   AppetiteBreach, ModelRiskDecisionRequired, SupervisoryLetterReceived,
//   IcaapIlaapInputReady, RiskPolicyChangeProposal
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Helena (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "AppetiteBreach",
  "ModelRiskDecisionRequired",
  "SupervisoryLetterReceived",
  "IcaapIlaapInputReady",
  "RiskPolicyChangeProposal",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "helena:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `helena:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
