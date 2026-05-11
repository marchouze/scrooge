// runtime/agents/yael-event-triage.ts
//
// Yael's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Yael (Tax / CIT / VAT / STT /
// FATCA / CRS engineer) identified by `recon:trigger-spec-handler-symmetry`
// (Slice 2a, PR #212). Yael's §7 declares event-driven triggers on tax
// events; this handler is the corresponding runtime entry-point.
//
// Subscribed events (per Yael's Team/Yael.md §7):
//   SARSGuidanceUpdate, IFRS9ECLChange, InterEntityTransactionProposed,
//   ClientCandidateRegistered, ClientReviewTriggered
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Yael (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "SARSGuidanceUpdate",
  "IFRS9ECLChange",
  "InterEntityTransactionProposed",
  "ClientCandidateRegistered",
  "ClientReviewTriggered",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "yael:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `yael:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
