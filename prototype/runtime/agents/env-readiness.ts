// runtime/agents/env-readiness.ts
//
// Env's weekly readiness snapshot. Scheduled handler under
// D-AGENT-RUNTIME-AUTHORIZE (CEO-approved 2026-05-08).
//
// Env is the bank's External Environment Simulator — the ambient layer that
// stands in for every external actor the bank cannot yet connect to directly
// (counterparty settlement behaviour, FX market price feeds, SWIFT MT
// messages, nostro account statements, regulatory acknowledgement messages).
// See Team/Env.md for the full operating spec.
//
// What this handler does:
//   1. Reports sub-simulator state (EnvSimEngine): MarketDataSimulator,
//      NostroStatementSimulator, CorrespondentAdviceSim, RegulatoryAckSim.
//   2. Counts Env-domain events in the last 7 days: MarketDataTickReceived,
//      InboundMessageReceived, FxTradeExecuted, SettlementConfirmed.
//   3. Surfaces substrate gaps (Team/Env.md §16): no real market feed, no
//      real SWIFT connectivity, illustrative stochastic profiles, hardcoded
//      nostro list, no autonomous scheduling.
//   4. Emits a brief summary log line. (No typed snapshot event yet — the
//      EnvSimReadinessSnapshot event type is a substrate gap; owner Atlas.)
//
// Build-phase posture:
//   Env runs when EnvSimEngine.start() is called by a scenario or API route.
//   Autonomous launchd/cron scheduling is not yet wired (§16 gap). This
//   handler is the first step: it gives the runtime a scheduled entry-point
//   for Env; the SimEngine integration is a follow-on slice.
//
// Author: Env (handler) · Atlas (runtime substrate).

import { logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";

interface EnvDomainCounts {
  readonly marketDataTickLast7d: number;
  readonly inboundMessageLast7d: number;
  readonly fxTradeExecutedLast7d: number;
  readonly settlementConfirmedLast7d: number;
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

// Import at module scope to avoid pulling the full composition chain into
// type-only consumers. The handler receives eventStore via AgentRunContext.
import { eventStore as _eventStore } from "../../platform/composition";

function readEnvDomainCounts(sinceIso: string): EnvDomainCounts {
  let marketDataTick = 0;
  let inboundMessage = 0;
  let fxTradeExecuted = 0;
  let settlementConfirmed = 0;

  for (const e of _eventStore.replay({ type: "MarketDataTickReceived" })) {
    if (e.as_of >= sinceIso) marketDataTick++;
  }
  for (const e of _eventStore.replay({ type: "InboundMessageReceived" })) {
    if (e.as_of >= sinceIso) inboundMessage++;
  }
  for (const e of _eventStore.replay({ type: "FxTradeExecuted" })) {
    if (e.as_of >= sinceIso) fxTradeExecuted++;
  }
  for (const e of _eventStore.replay({ type: "SettlementConfirmed" })) {
    if (e.as_of >= sinceIso) settlementConfirmed++;
  }

  return {
    marketDataTickLast7d: marketDataTick,
    inboundMessageLast7d: inboundMessage,
    fxTradeExecutedLast7d: fxTradeExecuted,
    settlementConfirmedLast7d: settlementConfirmed,
  };
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const sinceIso = isoDaysAgo(ctx.asOf, 7);
  const counts = readEnvDomainCounts(sinceIso);

  const totalActivity =
    counts.marketDataTickLast7d +
    counts.inboundMessageLast7d +
    counts.fxTradeExecutedLast7d +
    counts.settlementConfirmedLast7d;

  logger.info(
    {
      asOf: ctx.asOf,
      trigger: ctx.trigger.id,
      marketDataTickLast7d: counts.marketDataTickLast7d,
      inboundMessageLast7d: counts.inboundMessageLast7d,
      fxTradeExecutedLast7d: counts.fxTradeExecutedLast7d,
      settlementConfirmedLast7d: counts.settlementConfirmedLast7d,
    },
    "env:readiness — weekly sim-substrate snapshot",
  );

  const summary = [
    `Env readiness (7d): MarketDataTick=${counts.marketDataTickLast7d}`,
    `InboundMessage=${counts.inboundMessageLast7d}`,
    `FxTradeExecuted=${counts.fxTradeExecutedLast7d}`,
    `SettlementConfirmed=${counts.settlementConfirmedLast7d}`,
    `total=${totalActivity}`,
    "substrate gaps: no real market feed / no real SWIFT / autonomous scheduling not yet wired (Team/Env.md §16).",
  ].join(" · ");

  return {
    eventsEmitted: 0, // EnvSimReadinessSnapshot event type not yet in registry — substrate gap
    summary,
    ok: true,
  };
};

export default handler;
