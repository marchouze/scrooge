// runtime/agents/imani-event-triage.ts
//
// Imani's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Imani (Legal / ISDA / contract
// engineer) identified by `recon:trigger-spec-handler-symmetry` (Slice 2a,
// PR #212). Imani's §7 declares event-driven triggers on legal/contract
// events; this handler is the corresponding runtime entry-point.
//
// Subscribed events (per Imani's Team/Imani.md §7):
//   ContractDraftRequested, ClauseChangeProposed, SignatureRequested,
//   ECTAExceptionFlagged, LegalEntityChange, ObligationRegistered
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.
//
// Author: Atlas (Core banking platform architect) · Imani (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "ContractDraftRequested",
  "ClauseChangeProposed",
  "SignatureRequested",
  "ECTAExceptionFlagged",
  "LegalEntityChange",
  "ObligationRegistered",
] as const;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );
  logger.info(
    { relevantCount: relevant.length, eventTypes: relevant.map((e) => e.type) },
    "imani:event-triage — stub received events (full implementation pending)",
  );
  return {
    eventsEmitted: 0,
    summary: `imani:event-triage stub — acknowledged ${relevant.length} event(s). Full implementation pending.`,
    ok: true,
  };
};

export default handler;
