// runtime/agents/devon-fx-rates-ingest.ts
//
// Devon's daily fx-rates-ingest handler — wraps the reusable ingest function
// from `scripts/agents/fx-rates-ingest.ts` so the in-process scheduler-tick
// (com.scrooge.scheduler-tick launchd agent) can fire it on cron.
//
// Cadence: daily at 02:00 UTC. The upstream open.er-api.com feed updates
// once per day around 00:00 UTC; we run 2h later to give the feed time
// to refresh.
//
// Side effects:
//   - Appends fx-quote ticks to MarketDataStore (separate from event store
//     per Principle 1 — market data is reference/time-series, not domain
//     events).
//   - Emits zero domain events. AgentRunOutput.eventsEmitted is therefore 0.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.

import { logger } from "../../platform/composition";
import { runFxRatesIngest } from "../../scripts/agents/fx-rates-ingest";
import type { AgentRunContext, AgentRunOutput } from "../types";

const handler = async (_ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const dbPath = process.env.BANK_MARKET_DATA_DB ?? ".local/market-data.db";

  const result = await runFxRatesIngest({
    dbPath,
    log: (level, message) => {
      if (level === "error") {
        logger.error({ pipeline: "fx-rates-ingest" }, message);
      } else {
        logger.info({ pipeline: "fx-rates-ingest" }, message);
      }
    },
  });

  return {
    eventsEmitted: 0,
    summary: result.ok
      ? `fx-rates-ingest: fetched ${result.fetched} rates, ${result.newStored} new stored`
      : `fx-rates-ingest failed: ${result.error ?? "unknown"}`,
    ok: result.ok,
  };
};

export default handler;
