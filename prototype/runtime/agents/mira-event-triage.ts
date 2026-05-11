// runtime/agents/mira-event-triage.ts
//
// Mira's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Mira (Compliance / AML / FICA
// engineer; Regulatory obligations engineer) identified by
// `recon:trigger-spec-handler-symmetry` (Slice 2a, PR #212). Mira's §7
// declares event-driven triggers on compliance/AML events; this handler
// is the corresponding runtime entry-point.
//
// Subscribed events (per Mira's Team/Mira.md §7):
//   ClientCandidateRegistered, TransactionPosted, SanctionsListPublished,
//   PepListPublished, AdverseMediaPublished, RegulatoryInstrumentUpdate,
//   AlertOpened
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Mira (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "ClientCandidateRegistered",
  "TransactionPosted",
  "SanctionsListPublished",
  "PepListPublished",
  "AdverseMediaPublished",
  "RegulatoryInstrumentUpdate",
  "AlertOpened",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "mira:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `mira:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
