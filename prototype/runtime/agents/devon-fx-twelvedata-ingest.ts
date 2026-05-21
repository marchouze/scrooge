// runtime/agents/devon-fx-twelvedata-ingest.ts
//
// Devon's hourly twelve-data ingest handler — wraps the reusable ingest
// function from `scripts/agents/fx-twelvedata-ingest.ts` so the in-process
// scheduler-tick (com.scrooge.scheduler-tick launchd agent) can fire it
// on cron.
//
// Cadence: hourly at minute 5 (offset from open-er-api's daily 02:00
// UTC to avoid clashing). Twelve Data free tier permits 800 req/day
// and 8 req/min; the batched 6-symbol /quote costs 6 credits, so 24
// hourly fires/day = 144 credits/day — well under the daily cap.
//
// Env var requirement:
//   BANK_TWELVEDATA_API_KEY — required. The launchd plist installed at
//   ~/Library/LaunchAgents/com.scrooge.scheduler-tick.plist needs this
//   added to its <EnvironmentVariables> dict (launchd does not source
//   ~/.zshrc). When the key is missing, this handler returns ok:true
//   with a skip summary so a missing-config state does not pollute the
//   substrate-alert stream.
//
// Side effects:
//   - Appends fx-quote ticks to MarketDataStore. Zero domain events.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.

import { logger } from "../../platform/composition";
import { runTwelveDataIngest } from "../../scripts/agents/fx-twelvedata-ingest";
import type { AgentRunContext, AgentRunOutput } from "../types";

const handler = async (_ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const apiKey = process.env.BANK_TWELVEDATA_API_KEY;
  if (!apiKey) {
    logger.warn(
      { pipeline: "fx-twelvedata-ingest" },
      "BANK_TWELVEDATA_API_KEY not set — skipping fire. Add the key to the launchd plist EnvironmentVariables to enable scheduled ingest.",
    );
    return {
      eventsEmitted: 0,
      summary: "fx-twelvedata-ingest: skipped — BANK_TWELVEDATA_API_KEY not set",
      ok: true,
    };
  }

  const dbPath = process.env.BANK_MARKET_DATA_DB ?? ".local/market-data.db";

  const result = await runTwelveDataIngest({
    dbPath,
    apiKey,
    log: (level, message) => {
      if (level === "error") {
        logger.error({ pipeline: "fx-twelvedata-ingest" }, message);
      } else {
        logger.info({ pipeline: "fx-twelvedata-ingest" }, message);
      }
    },
  });

  return {
    eventsEmitted: 0,
    summary: result.ok
      ? `fx-twelvedata-ingest: fetched ${result.fetched} quotes, ${result.newStored} new stored`
      : `fx-twelvedata-ingest failed: ${result.error ?? "unknown"}`,
    ok: result.ok,
  };
};

export default handler;
