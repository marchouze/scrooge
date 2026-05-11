// runtime/agents/owen-event-triage.ts
//
// Owen's event-triage handler — stub, Slice 2b.
//
// Closes `specWithoutHandler` violations for Owen (Company Secretary;
// statutory officer under the Companies Act) identified by
// `recon:trigger-spec-handler-symmetry` (Slice 2a, PR #212). Owen's §7
// declares event-driven triggers on corporate-governance events; this
// handler is the corresponding runtime entry-point.
//
// Subscribed events (per Owen's Team/Owen.md §7):
//   ResolutionRequired, ConflictDeclared, RelatedPartyTransactionProposed,
//   WhistleblowingDisclosure, PAIARequest, MOIChangeProposed,
//   SupervisoryLetterReceived, AgentEscalation
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// No LLM call; no Owner Inbox deliverable in this stub pass. Full
// implementation is a roadmap item per D-AGENT-AUTONOMY-OPERATIONAL.
//
// Author: Atlas (Core banking platform architect) · Owen (handler owner)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = [
  "ResolutionRequired",
  "ConflictDeclared",
  "RelatedPartyTransactionProposed",
  "WhistleblowingDisclosure",
  "PAIARequest",
  "MOIChangeProposed",
  "SupervisoryLetterReceived",
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
    "owen:event-triage — stub received events (full implementation pending)",
  );

  return {
    eventsEmitted: 0,
    summary: `owen:event-triage stub — acknowledged ${relevant.length} event(s) [${[...new Set(relevant.map((e) => e.type))].join(", ") || "none"}]. Full triage implementation pending per D-AGENT-AUTONOMY-OPERATIONAL roadmap.`,
    ok: true,
  };
};

export default handler;
