// runtime/agents/rohan-conduct-surveillance-sweep.ts
//
// Scheduled FX conduct surveillance sweep — the reliable dispatch path for
// best-execution + FAIS-suitability + conflict surveillance over the live FX
// book.
//
// ## Why this exists (FX conduct surveillance wiring, 2026-06-11)
//
// The event-driven handler `rohan:conduct-risk-events` fires only when an
// FxTradeExecuted lands inside an agent run (the run-coupled bus tick walks only
// that run's sequence window). FX trades are booked by the operator / pre-trade-
// gateway path (`dashboard/markets-fx-trade.ts → store.append`), which is not an
// agent run — so best-execution verification and FAIS-suitability surveillance
// never fired on the live book. Code-level investigation against the canonical
// store (2026-06-11) confirmed it: 44 FxTradeExecuted, 0 BestExecutionVerified /
// Breached, 0 FaisClassificationSuitabilityChecked; the only conduct events were
// CONDUCT-TEST-* synthetic conflicts, none tied to a real booked trade.
//
// This sweep scans the store for every FxTradeExecuted lacking a surveillance
// outcome and evaluates it (platform/conduct/fx-conduct-surveillance-sweep.ts),
// exactly as the BA310/BA300 period-close handlers scan for closed periods.
// Daily 18:45 UTC cadence — 15 min after the daily market-risk measure
// (rohan:market-risk-measure, 18:30 UTC) so the book is already marked.
// Idempotent: a trade already covered (by this sweep or the event-driven
// handler) is a no-op.
//
// Authority: D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH (CEO session-
//   delegation 2026-06-11); D-MARKET-CONDUCT; FAIS Act 37/2002 §§16–17, §8D, §4.
// Brief: brief:zara:otc-vanilla-fx-conduct-dimension-wire-inert-cond:2026-06-11.
// Author: Zara (Chief Compliance Officer, governance) on Rohan's (Markets
//   risk/quant engineer, engineering) conduct-risk logic.

import { eventStore, logger } from "../../platform/composition";
import { sweepFxConductSurveillance } from "../../platform/conduct/fx-conduct-surveillance-sweep";
import type { AgentRunContext, AgentRunOutput } from "../types";

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const result = sweepFxConductSurveillance(eventStore, {
    asOf: ctx.asOf,
    dryRun: ctx.dryRun,
  });

  if (result.bestExScheduleEventId === null) {
    logger.warn(
      {},
      "rohan:conduct-surveillance-sweep — no BestExecutionPolicySchedule in force; best-execution tolerances fell back to build-phase constants (publish the CCO schedule: scripts/publish-fx-bestex-policy-schedule.ts)",
    );
  }

  if (result.faisUnclassifiedTradeIds.length > 0) {
    logger.warn(
      { count: result.faisUnclassifiedTradeIds.length },
      "rohan:conduct-surveillance-sweep — FAIS suitability skipped for unclassified counterparties (residual: classify via CounterpartyFaisClassified)",
    );
  }

  logger.info(
    {
      tradesScanned: result.tradesScanned,
      tradesProcessed: result.tradesProcessed,
      tradesAlreadyCovered: result.tradesAlreadyCovered,
      eventsEmitted: result.eventsEmitted,
      faisUnclassified: result.faisUnclassifiedTradeIds.length,
      bestExScheduleEventId: result.bestExScheduleEventId,
      dryRun: ctx.dryRun,
    },
    "rohan:conduct-surveillance-sweep — done",
  );

  return {
    eventsEmitted: result.eventsEmitted,
    summary: `conduct surveillance sweep: ${result.tradesScanned} FX trade(s) scanned, ${result.tradesProcessed} newly evaluated, ${result.tradesAlreadyCovered} already covered, ${result.eventsEmitted} surveillance event(s) emitted${
      result.faisUnclassifiedTradeIds.length > 0
        ? `; ${result.faisUnclassifiedTradeIds.length} FAIS-suitability skipped (unclassified counterparty)`
        : ""
    }`,
    ok: true,
  };
};

export default handler;
