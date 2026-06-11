// runtime/agents/rohan-conduct-risk-events.ts
//
// Rohan's conduct risk events handler — M3 Slice 9.
//
// Event-driven on FxTradeExecuted. For each FX trade in the triggering set it
// evaluates best execution, FAIS suitability, and conflict-of-interest, emitting
// the corresponding surveillance events-of-record.
//
// ## Dispatch note (FX conduct surveillance wiring, 2026-06-11)
//
// This handler fires only when an FxTradeExecuted lands *inside an agent run*
// (the run-coupled bus tick walks only that run's sequence window). FX trades
// booked by the operator / pre-trade-gateway path are NOT agent runs, so this
// handler alone leaves the live book uncovered. The reliable coverage path is
// the store-scanning sweep `rohan:conduct-surveillance-sweep`
// (platform/conduct/fx-conduct-surveillance-sweep.ts), registered on a daily
// scheduled cadence. Both this handler and the sweep call the same evaluation
// core (platform/conduct/fx-trade-conduct-evaluation.ts), so the verdicts cannot
// drift between the two dispatch paths, and the per-trade idempotency guard
// means a trade processed by one path is a no-op for the other.
//
// Build-phase limitations (see the evaluation core):
//   - Best-execution tolerance values are fixed constants; production drives
//     them from a published BestExecutionPolicySchedule event.
//   - Reference rates default to the FX leg rate when no external benchmark is
//     available (spread = 0 bps when only one price source exists).
//   - FAIS suitability fires only for classified counterparties
//     (CounterpartyFaisClassified); an unclassified counterparty is logged.
//
// Authority:
//   FAIS Act 37/2002 §§16–17 (best execution obligation);
//   FAIS Act 37/2002 §8D (product suitability);
//   Financial Markets Act 19 of 2012 §§78–82 (market abuse);
//   FSRA §131 (FSCA conduct mandate);
//   D-MARKET-CONDUCT; D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH;
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md; Principles/6-autonomous-by-default.md.
//
// Author: Rohan (Markets risk/quant engineer, engineering); evaluation core
//   extracted + sweep added by Zara (Chief Compliance Officer, governance).

import { eventStore, logger } from "../../platform/composition";
import { evaluateFxTradeConduct } from "../../platform/conduct/fx-trade-conduct-evaluation";
import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];

  const fxTrades = triggering.filter((e): e is Event => e.type === "FxTradeExecuted");

  if (fxTrades.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "no FxTradeExecuted events in triggering set; no conduct risk evaluation to perform",
      ok: true,
    };
  }

  let totalEventsEmitted = 0;
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let faisUnclassified = 0;

  for (const trade of fxTrades) {
    try {
      const result = evaluateFxTradeConduct(eventStore, trade, {
        asOf: ctx.asOf,
        dryRun: ctx.dryRun,
      });
      totalEventsEmitted += result.eventsEmitted;
      if (result.eventsEmitted > 0 || ctx.dryRun) {
        processed += 1;
      } else {
        skipped += 1;
      }
      if (result.faisSkippedUnclassified) {
        faisUnclassified += 1;
        logger.warn(
          { tradeId: result.tradeId },
          "rohan:conduct-risk-events — no CounterpartyFaisClassified for counterparty; FAIS suitability skipped",
        );
      }
    } catch (err) {
      logger.error(
        { err: (err as Error).message },
        "rohan:conduct-risk-events — error evaluating trade; continuing",
      );
      errors += 1;
    }
  }

  logger.info(
    { fxTrades: fxTrades.length, processed, skipped, errors, faisUnclassified, eventsEmitted: totalEventsEmitted },
    "rohan:conduct-risk-events — done",
  );

  return {
    eventsEmitted: totalEventsEmitted,
    summary:
      `${fxTrades.length} FX trade(s): ${processed} processed, ${skipped} skipped (idempotent), ` +
      `${errors} errors. ${totalEventsEmitted} conduct risk events emitted.`,
    ok: errors === 0,
  };
};

export default handler;
