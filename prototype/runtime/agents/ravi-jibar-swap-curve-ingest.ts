// runtime/agents/ravi-jibar-swap-curve-ingest.ts
//
// Ravi's JIBAR swap curve ingest handler — wraps the reusable ingest
// function from `scripts/agents/jibar-swap-curve-ingest.ts` so the
// in-process scheduler can fire it on request.
//
// JIBAR CESSATION NOTE: JIBAR new-trade cessation was May 2026; full cessation
// December 2026. This handler manages the legacy JIBAR swap-curve calibration
// for existing IRS instruments during the wind-down window.
// Forward-looking curve logic should use `ravi:zaronia-ingest` (OIS curve).
//
// ADAPTER WIRING: The underlying swap-curve source interface in
// `platform/market-data/jibar-swap-curve-ingester.ts` is the injection seam.
// At vendor selection, wire a `OisCurveFeedAdapter`-backed source to replace
// the fixture. The build-phase adapter `SarbRbondMarketDataAdapter` provides
// rbond OIS curve data (via fetchCurve) as the pre-go-live source.
//
// Fallback invariant: build-phase behaviour is byte-identical to pre-W2.3
// when the adapter returns null — the fixture remains the default.
//
// The swap-curve ticks stored here are consumed by
// `MarketDataStoreJibarRateSource` (platform/markets/eod/make-jibar-rate-source.ts)
// which implements `IrsRateSource` — closing GAP-IRS-1 in jibar-curve-seed.ts.
//
// Authority: D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//            D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//            D-TREASURER-WAVE2-SUBSTRATE (adapter seam documented)
//
// Author: Ravi (Treasury / ALM engineer, engineering)

import { logger } from "../../platform/composition";
import {
  runJibarSwapCurveIngestAllDates,
  runJibarSwapCurveIngestForDate,
} from "../../scripts/agents/jibar-swap-curve-ingest";
import type { AgentRunContext, AgentRunOutput } from "../types";

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const dbPath = process.env.BANK_MARKET_DATA_DB ?? ".local/market-data.db";

  // When trigger id is "jibar-swap-curve-ingest:seed-all", seed the entire fixture.
  // For the regular on-request case, ingest the current as-of date.
  const seedAll = ctx.trigger.id === "jibar-swap-curve-ingest:seed-all";

  if (seedAll) {
    const result = runJibarSwapCurveIngestAllDates({
      dbPath,
      log: (level, message) => {
        if (level === "error") {
          logger.error({ pipeline: "jibar-swap-curve-ingest" }, message);
        } else {
          logger.info({ pipeline: "jibar-swap-curve-ingest" }, message);
        }
      },
    });
    return {
      eventsEmitted: 0,
      summary: result.ok
        ? `jibar-swap-curve-ingest (all-dates): ${result.ticksAppended} appended, ${result.ticksSkipped} skipped`
        : `jibar-swap-curve-ingest (all-dates) failed: ${result.error ?? "unknown"}`,
      ok: result.ok,
    };
  }

  const date = ctx.asOf.slice(0, 10);
  const result = runJibarSwapCurveIngestForDate({
    dbPath,
    date,
    log: (level, message) => {
      if (level === "error") {
        logger.error({ pipeline: "jibar-swap-curve-ingest" }, message);
      } else {
        logger.info({ pipeline: "jibar-swap-curve-ingest" }, message);
      }
    },
  });

  return {
    eventsEmitted: 0,
    summary: result.ok
      ? `jibar-swap-curve-ingest: date=${date} appended=${result.ticksAppended} skipped=${result.ticksSkipped}`
      : `jibar-swap-curve-ingest failed: ${result.error ?? "unknown"}`,
    ok: result.ok,
  };
};

export default handler;
