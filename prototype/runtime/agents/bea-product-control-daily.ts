// runtime/agents/bea-product-control-daily.ts
//
// Bea's daily product-control run — wires the three already-merged
// product-control engines into a LIVE daily cadence (Principle 6:
// autonomous-by-default). Pre-handler, all three engines were DORMANT:
// they emitted nothing on a cadence and were only invoked opportunistically
// (daily-pnl in dashboard re-derivation) or in tests (pnl-attribution).
//
// What it does, per run (sequenced report → attribution):
//   1. runDailyPnLReport(eventStore, () => ctx.asOf)
//      → emits one DailyPnLReportGenerated for ctx.asOf's date.
//   2. runPnLAttribution(eventStore, () => ctx.asOf)
//      → emits PnLAttributionGenerated + a CalculationPerformed (model
//        provenance) + a PnLAttributionExceptionRaised when the attribution
//        is not clean (incomplete inputs or residual breach).
//
// Each engine runs inside its own try/catch so one engine's failure does not
// abort the other. The run summary records eventsEmitted plus per-engine ok.
//
// Cadence: cron `0 19 * * 1-5` — 19:00 UTC weekdays, AFTER Rohan's 18:00 UTC
// daily MTM (so the marks the P&L engines read are the freshest EOD marks).
// Operator-triggered runs available via `bun run agent:bea-product-control-daily`.
//
// Authority:
//   - Camille (CFO) recommendations R1 (daily P&L) / R2 (valuation adjustment,
//     wired into Rohan's MTM) / R3 (P&L attribution).
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (no-silent-zero figures).
//   - Principle 6 (autonomous-by-default — dormant engines become live).
//   - Principle 1 (events are the only source of truth).
//   - brief:bea:wire-product-control-engines-into-daily-cadence:2026-05-31.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { eventStore, logger } from "../../platform/composition";
import { nowUtc } from "../../platform/core/types";
import { runDailyPnLReport } from "../../platform/product-control/daily-pnl";
import { runPnLAttribution } from "../../platform/product-control/pnl-attribution";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC } from "./_shared";

interface EngineResult {
  readonly engine: string;
  readonly ok: boolean;
  readonly eventsEmitted: number;
  readonly error?: string;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const asOf = ctx.asOf;
  const dateStr = fmtDateUTC(asOf);

  logger.info(
    { asOf, agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "bea:product-control-daily — starting daily product-control run",
  );

  const results: EngineResult[] = [];

  // Count events emitted by replaying the store before/after each engine — the
  // run* wrappers append directly and return void, so we diff the store size.
  const countEvents = (): number => {
    let n = 0;
    for (const _ of eventStore.replay()) n += 1;
    return n;
  };

  if (ctx.dryRun) {
    return {
      eventsEmitted: 0,
      summary: `product-control ${dateStr}: dry-run — no engines invoked`,
      ok: true,
    };
  }

  // ---- 1. Daily P&L report (Camille R1) -----------------------------------
  {
    const before = countEvents();
    try {
      runDailyPnLReport(eventStore, () => asOf);
      results.push({ engine: "daily-pnl", ok: true, eventsEmitted: countEvents() - before });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, "bea:product-control-daily — daily-pnl engine failed");
      results.push({ engine: "daily-pnl", ok: false, eventsEmitted: 0, error: msg });
    }
  }

  // ---- 2. P&L attribution (Camille R3) ------------------------------------
  {
    const before = countEvents();
    try {
      runPnLAttribution(eventStore, () => asOf);
      results.push({
        engine: "pnl-attribution",
        ok: true,
        eventsEmitted: countEvents() - before,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, "bea:product-control-daily — pnl-attribution engine failed");
      results.push({ engine: "pnl-attribution", ok: false, eventsEmitted: 0, error: msg });
    }
  }

  const eventsEmitted = results.reduce((s, r) => s + r.eventsEmitted, 0);
  const allOk = results.every((r) => r.ok);
  const perEngine = results
    .map((r) => `${r.engine}=${r.ok ? "ok" : `FAIL(${r.error ?? "?"})`}`)
    .join(" · ");

  logger.info(
    { asOf: nowUtc(), eventsEmitted, allOk, results },
    "bea:product-control-daily — run complete",
  );

  return {
    eventsEmitted,
    summary: `product-control ${dateStr}: ${eventsEmitted} event(s) emitted · ${perEngine}`,
    ok: allOk,
  };
};

export default handler;
