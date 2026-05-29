// runtime/agents/ravi-jibar-swap-curve-ingest.ts
//
// Ravi's JIBAR swap curve ingest handler — wraps the reusable ingest
// function from `scripts/agents/jibar-swap-curve-ingest.ts` so the
// in-process scheduler can fire it on request.
//
// No API key required — fixture data only in the build phase. Production
// SARB/Bloomberg curve feed integration is sequenced post-licence.
//
// Kept as on-request callable so `ravi:jibar-swap-curve-ingest` can be
// called from ad-hoc runs and the launchd scheduler without double-firing.
//
// The swap-curve ticks stored here are consumed by
// `MarketDataStoreJibarRateSource` (platform/markets/eod/make-jibar-rate-source.ts)
// which implements `IrsRateSource` — closing GAP-IRS-1 in jibar-curve-seed.ts.
//
// Authority: D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//            D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
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
  const date = ctx.asOf.slice(0, 10);

  // When triggered with payload.seedAll=true, seed the entire fixture.
  const seedAll =
    typeof ctx.trigger.payload === "object" &&
    ctx.trigger.payload !== null &&
    (ctx.trigger.payload as Record<string, unknown>)["seedAll"] === true;

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
