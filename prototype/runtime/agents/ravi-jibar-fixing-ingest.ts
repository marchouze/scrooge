// runtime/agents/ravi-jibar-fixing-ingest.ts
//
// Ravi's JIBAR 3M fixing ingest handler — wraps the reusable ingest
// function from `scripts/agents/jibar-fixing-ingest.ts` so the
// in-process scheduler can fire it on request.
//
// No API key required — fixture data only in the build phase. Production
// AFMA feed integration is sequenced post-licence.
//
// Kept as on-request callable so `ravi:jibar-fixing-ingest` can be called
// from ad-hoc runs and the launchd scheduler without double-firing.
//
// Authority: D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//            D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//
// Author: Ravi (Treasury / ALM engineer, engineering)

import { logger } from "../../platform/composition";
import {
  runJibarFixingIngestAllDates,
  runJibarFixingIngestForDate,
} from "../../scripts/agents/jibar-fixing-ingest";
import type { AgentRunContext, AgentRunOutput } from "../types";

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const dbPath = process.env.BANK_MARKET_DATA_DB ?? ".local/market-data.db";

  // When trigger id is "jibar-fixing-ingest:seed-all", seed the entire fixture.
  // For the regular on-request case, ingest the current as-of date.
  const seedAll = ctx.trigger.id === "jibar-fixing-ingest:seed-all";

  if (seedAll) {
    const result = runJibarFixingIngestAllDates({
      dbPath,
      log: (level, message) => {
        if (level === "error") {
          logger.error({ pipeline: "jibar-fixing-ingest" }, message);
        } else {
          logger.info({ pipeline: "jibar-fixing-ingest" }, message);
        }
      },
    });
    return {
      eventsEmitted: 0,
      summary: result.ok
        ? `jibar-fixing-ingest (all-dates): ${result.ticksAppended} appended, ${result.ticksSkipped} skipped`
        : `jibar-fixing-ingest (all-dates) failed: ${result.error ?? "unknown"}`,
      ok: result.ok,
    };
  }

  const date = ctx.asOf.slice(0, 10);
  const result = runJibarFixingIngestForDate({
    dbPath,
    date,
    log: (level, message) => {
      if (level === "error") {
        logger.error({ pipeline: "jibar-fixing-ingest" }, message);
      } else {
        logger.info({ pipeline: "jibar-fixing-ingest" }, message);
      }
    },
  });

  return {
    eventsEmitted: 0,
    summary: result.ok
      ? `jibar-fixing-ingest: date=${date} appended=${result.ticksAppended} skipped=${result.ticksSkipped}`
      : `jibar-fixing-ingest failed: ${result.error ?? "unknown"}`,
    ok: result.ok,
  };
};

export default handler;
