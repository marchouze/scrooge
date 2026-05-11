// runtime/agents/niko-event-triage.ts
//
// Niko's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Niko (Client lifecycle /
// onboarding engineer; paused at build-phase, activates at licence-day)
// identified by `recon:trigger-spec-handler-symmetry` (Slice 2a, PR #212).
// Niko's §7 declares event-driven triggers on client-lifecycle events;
// this handler is the corresponding runtime entry-point.
//
// Subscribed events (per Niko's Team/Niko.md §7):
//   LeadCaptured, SuitabilityAssessmentRequired, AdviceRecordRequested,
//   OnboardingHandoffPending, ConsentWithdrawn
//
// Note: Niko is paused at build-phase per CLAUDE.md operating model; these
// stubs wire the runtime symmetry while keeping the handler acknowledgement-
// only until licence-day activation.
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Niko (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "LeadCaptured",
  "SuitabilityAssessmentRequired",
  "AdviceRecordRequested",
  "OnboardingHandoffPending",
  "ConsentWithdrawn",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "niko:event-triage — stub received events (full implementation pending; Niko paused until licence-day)",
  );
  return {
    eventsEmitted: 0,
    summary: `niko:event-triage stub — acknowledged ${relevant.length} event(s). Handler paused until licence-day; full implementation pending.`,
    ok: true,
  };
};

export default handler;
