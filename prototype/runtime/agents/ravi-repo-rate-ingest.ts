// runtime/agents/ravi-repo-rate-ingest.ts
//
// Ravi's SARB repo rate ingest handler — wraps the reusable ingest
// function from `scripts/agents/repo-rate-ingest.ts` so the
// in-process scheduler can fire it on request.
//
// ADAPTER WIRING: The underlying `SarbRepoPrimeSource` interface in
// `platform/market-data/sarb-repo-prime-ingester.ts` is the injection seam
// for live-feed adapters. The build-phase adapter `SarbRbondMarketDataAdapter`
// provides SARB SarbWebApi CurrentMarketRates (repo rate spot) as a pre-go-live
// source via `fetchRate` (ZaroniaFeedAdapter). At vendor selection, swap in a
// concrete live-feed implementation.
//
// Fallback invariant: build-phase behaviour is byte-identical to pre-W2.3
// when the adapter returns null — the fixture remains the default.
//
// Authority: D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//            D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//            D-TREASURER-WAVE2-SUBSTRATE (adapter seam documented)
//
// Author: Ravi (Treasury / ALM engineer, engineering)

import { logger } from "../../platform/composition";
import {
  runRepoRateIngestAllDates,
  runRepoRateIngestForDate,
} from "../../scripts/agents/repo-rate-ingest";
import type { AgentRunContext, AgentRunOutput } from "../types";

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const dbPath = process.env.BANK_MARKET_DATA_DB ?? ".local/market-data.db";

  // When trigger id is "repo-rate-ingest:seed-all", seed all MPC decisions.
  // For the regular on-request case, resolve the effective rate for as-of date.
  const seedAll = ctx.trigger.id === "repo-rate-ingest:seed-all";

  if (seedAll) {
    const result = runRepoRateIngestAllDates({
      dbPath,
      log: (level, message) => {
        if (level === "error") {
          logger.error({ pipeline: "repo-rate-ingest" }, message);
        } else {
          logger.info({ pipeline: "repo-rate-ingest" }, message);
        }
      },
    });
    return {
      eventsEmitted: 0,
      summary: result.ok
        ? `repo-rate-ingest (all-dates): ${result.ticksAppended} appended, ${result.ticksSkipped} skipped`
        : `repo-rate-ingest (all-dates) failed: ${result.error ?? "unknown"}`,
      ok: result.ok,
    };
  }

  const date = ctx.asOf.slice(0, 10);
  const result = runRepoRateIngestForDate({
    dbPath,
    date,
    log: (level, message) => {
      if (level === "error") {
        logger.error({ pipeline: "repo-rate-ingest" }, message);
      } else {
        logger.info({ pipeline: "repo-rate-ingest" }, message);
      }
    },
  });

  return {
    eventsEmitted: 0,
    summary: result.ok
      ? `repo-rate-ingest: date=${date} appended=${result.ticksAppended} skipped=${result.ticksSkipped}`
      : `repo-rate-ingest failed: ${result.error ?? "unknown"}`,
    ok: result.ok,
  };
};

export default handler;
