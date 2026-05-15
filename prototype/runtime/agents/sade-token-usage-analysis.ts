// runtime/agents/sade-token-usage-analysis.ts
//
// Sade (AgentOps & Token Efficiency Engineer, engineering) — daily token-usage
// analysis handler.
//
// Scheduled daily at 05:00 UTC. Reviews all TokenUsageRecorded events in the
// event store, groups by agent, computes totals and cost estimates, and flags
// high-spend agents (totalTokens > 50,000) for follow-up.
//
// This handler does NOT emit AgentEfficiencyAdvisoryIssued — that is the
// efficiency-advisory handler's responsibility. This handler is the data
// collection and summary layer.
//
// Authority: Sade mandate (AgentOps & Token Efficiency Engineer, engineering).
// Author: Atlas (Platform & Substrate Engineering, engineering) — P0 token-capture gap closure.

import { eventStore, logger } from "../../platform/composition";
import type { TokenUsageRecordedPayload } from "../../platform/event-store/event-types/agent-ops";
import type { AgentRunContext, AgentRunOutput } from "../types";

const HIGH_SPEND_THRESHOLD = 50_000;

interface AgentTokenSummary {
  agent: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  runCount: number;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    {
      trigger: ctx.trigger.id,
      asOf: ctx.asOf,
      dryRun: ctx.dryRun,
    },
    "sade:token-usage-analysis — starting",
  );

  // Replay all TokenUsageRecorded events and aggregate by agent.
  const summaryMap = new Map<string, AgentTokenSummary>();
  let eventCount = 0;

  for (const event of eventStore.replay({ type: "TokenUsageRecorded" })) {
    eventCount++;
    const p = event.payload as TokenUsageRecordedPayload;

    const existing = summaryMap.get(p.agent);
    if (existing) {
      existing.inputTokens += p.inputTokens;
      existing.outputTokens += p.outputTokens;
      existing.totalTokens += p.totalTokens;
      existing.estimatedCostUsd += p.estimatedCostUsd;
      existing.runCount++;
    } else {
      summaryMap.set(p.agent, {
        agent: p.agent,
        inputTokens: p.inputTokens,
        outputTokens: p.outputTokens,
        totalTokens: p.totalTokens,
        estimatedCostUsd: p.estimatedCostUsd,
        runCount: 1,
      });
    }
  }

  const summaries = Array.from(summaryMap.values()).sort((a, b) => b.totalTokens - a.totalTokens);
  const agentCount = summaries.length;
  const totalCost = summaries.reduce((acc, s) => acc + s.estimatedCostUsd, 0);
  const totalTokens = summaries.reduce((acc, s) => acc + s.totalTokens, 0);

  const highSpend = summaries.filter((s) => s.totalTokens > HIGH_SPEND_THRESHOLD);

  if (agentCount === 0) {
    logger.info(
      { trigger: ctx.trigger.id, asOf: ctx.asOf },
      "sade:token-usage-analysis — no TokenUsageRecorded events found (token-capture not yet producing data, or first run)",
    );
    return {
      eventsEmitted: 0,
      summary: "token-usage-analysis: 0 events, 0 agents, $0.0000 estimated total",
      ok: true,
    };
  }

  // Log summary table.
  logger.info(
    {
      eventCount,
      agentCount,
      totalTokens,
      totalCostUsd: totalCost.toFixed(4),
      highSpendAgents: highSpend.map((s) => s.agent),
    },
    "sade:token-usage-analysis — summary",
  );

  for (const s of summaries) {
    const flag = s.totalTokens > HIGH_SPEND_THRESHOLD ? " [HIGH-SPEND]" : "";
    logger.info(
      {
        agent: s.agent,
        inputTokens: s.inputTokens,
        outputTokens: s.outputTokens,
        totalTokens: s.totalTokens,
        estimatedCostUsd: s.estimatedCostUsd.toFixed(4),
        runCount: s.runCount,
      },
      `sade:token-usage-analysis — agent: ${s.agent}${flag}`,
    );
  }

  return {
    eventsEmitted: 0,
    summary: `token-usage-analysis: ${eventCount} events, ${agentCount} agents, $${totalCost.toFixed(4)} estimated total`,
    ok: true,
  };
};

export default handler;
