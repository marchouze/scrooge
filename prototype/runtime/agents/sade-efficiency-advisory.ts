// runtime/agents/sade-efficiency-advisory.ts
//
// Sade's efficiency-advisory handler — stub.
//
// Event-driven, subscribes to: AgentRunCompleted, TokenUsageRecorded.
// Fires on every AgentRun completion to check whether the run has crossed
// the efficiency degradation threshold. When a degrading trend is confirmed,
// emits AgentEfficiencyAdvisoryIssued.
//
// Stub behaviour: logs receipt of triggering events and acknowledges.
// Full implementation is a roadmap item pending the token-capture substrate
// gap (Team/Sade.md §16, gap 1).
//
// Authority: Sade mandate (AgentOps & Token Efficiency Engineer, engineering).
// Author: Sade (AgentOps & Token Efficiency Engineer)

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = ["AgentRunCompleted", "TokenUsageRecorded"];

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggeringTypes = (ctx.trigger.triggeringEvents ?? []).map((e) => e.type);
  const relevant = triggeringTypes.filter((t: string) => SUBSCRIBED_EVENTS.includes(t));

  logger.info(
    {
      trigger: ctx.trigger.id,
      asOf: ctx.asOf,
      dryRun: ctx.dryRun,
      triggeringEventTypes: relevant,
    },
    "sade:efficiency-advisory — stub run (token-capture substrate gap; see Team/Sade.md §16 gap 1)",
  );

  return {
    eventsEmitted: 0,
    summary: `efficiency-advisory stub: ${relevant.length} triggering event(s) received; no advisory emitted (token-capture not yet wired).`,
    ok: true,
  };
};

export default handler;
