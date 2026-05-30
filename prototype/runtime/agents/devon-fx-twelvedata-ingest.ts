// runtime/agents/devon-fx-twelvedata-ingest.ts
//
// Devon's hourly twelve-data ingest handler — wraps the reusable ingest
// function from `scripts/agents/fx-twelvedata-ingest.ts` so the in-process
// scheduler-tick (com.scrooge.scheduler-tick launchd agent) can fire it
// on cron.
//
// Cadence: hourly at minute 5 (offset from open-er-api's daily 02:00
// UTC to avoid clashing). Twelve Data free tier permits 800 req/day and
// 8 req/min; /time_series at outputsize=2 costs 16 credits/run (2 bars ×
// 8 symbols — 6 ZAR pairs + EUR/USD + GBP/USD per
// D-FX-CROSS-PAIRS-PRODUCTION-INGEST), so 24 hourly fires/day = 384
// credits/day — under the cap.
//
// Env var requirement:
//   BANK_TWELVEDATA_API_KEY — required. The launchd plist installed at
//   ~/Library/LaunchAgents/com.scrooge.scheduler-tick.plist needs this
//   added to its <EnvironmentVariables> dict (launchd does not source
//   ~/.zshrc). `install.sh` now propagates whitelisted BANK_* keys
//   from `prototype/.env.local` into the rendered plist; see
//   `scripts/launchd/env-extract.ts`.
//
// Missing-key behaviour (per brief
// `brief:devon:twelve-data-ingest-propagate-bank-twelvedata-api:2026-05-21`):
//   - Returns `ok: false` so the substrate-runner closes
//     `SubstrateAgentRunCompleted` with `ok: false`. The run honestly
//     failed to do its work.
//   - Emits at most one `SubstrateAlert{alertClass: "integrity",
//     severity: "medium"}` per hour. The dedup window is enforced by
//     scanning the event store for prior alerts with this exact
//     `alertId` shape — `alert:integrity:twelvedata-missing-key-<YYYY-MM-DDTHH>`.
//     One alert per UTC hour bucket; subsequent fires within the same
//     bucket return `ok: false` without re-emitting.
//
// Side effects:
//   - On happy path: appends fx-quote ticks to MarketDataStore. Zero
//     domain events.
//   - On missing-key path: at most one SubstrateAlert per UTC hour.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION, D-AGENT-AUTONOMY-OPERATIONAL,
//   D-FX-CROSS-PAIRS-PRODUCTION-INGEST.

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeSubstrateAlert } from "../../platform/event-store/event-types/platform";
import { runTwelveDataIngest } from "../../scripts/agents/fx-twelvedata-ingest";
import type { AgentRunContext, AgentRunOutput } from "../types";

const BANK_ENTITY = "LE-ZA-HOZ-BANK";

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "devon:fx-twelvedata-ingest",
};

const ALERT_CITATIONS = ["D-MARKETS-SCHEMA-FOUNDATION", "D-AGENT-AUTONOMY-OPERATIONAL"];

/**
 * Build the `alertId` for the missing-key alert. One UTC hour per
 * bucket, so the at-most-one-per-hour dedup hinges on the suffix.
 *
 * Example for asOf="2026-05-21T16:07:33Z" → "alert:integrity:twelvedata-missing-key-2026-05-21t16".
 *
 * The substrateAlertPayloadSchema requires `alertId` matches
 * `/^alert:[a-z]+:[a-z0-9-]+$/` — lowercase only, hex digits + dashes
 * in the slug. The hour suffix is rendered lowercase to satisfy this.
 */
export function makeMissingKeyAlertId(asOf: string): string {
  // asOf is ISO-8601 UTC. Take YYYY-MM-DDTHH (first 13 chars) and lowercase.
  const hourBucket = asOf.slice(0, 13).toLowerCase();
  return `alert:integrity:twelvedata-missing-key-${hourBucket}`;
}

/**
 * Returns true if a SubstrateAlert with this exact `alertId` is already
 * in the event store — i.e. another fire within the same UTC hour
 * already raised the alarm. The handler still returns `ok: false`, but
 * skips the redundant alert emission.
 *
 * Implementation note: we replay all `SubstrateAlert` events and match
 * on the payload `alertId`. The cohort is small (build phase), so this
 * is acceptable; if it ever becomes hot, the projection in
 * `platform/projections/substrate-alerts.ts` can be queried instead.
 */
function alertAlreadyEmittedForBucket(alertId: string): boolean {
  for (const e of eventStore.replay({ type: "SubstrateAlert" })) {
    const payload = e.payload as { alertId?: unknown } | undefined;
    if (payload && payload.alertId === alertId) return true;
  }
  return false;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const apiKey = process.env.BANK_TWELVEDATA_API_KEY;
  if (!apiKey) {
    const alertId = makeMissingKeyAlertId(ctx.asOf);
    const alreadyEmitted = ctx.dryRun ? true : alertAlreadyEmittedForBucket(alertId);

    let eventsEmitted = 0;
    if (!ctx.dryRun && !alreadyEmitted) {
      try {
        eventStore.append(
          makeSubstrateAlert({
            asOf: ctx.asOf,
            entity: BANK_ENTITY,
            actor: HANDLER_ACTOR,
            citations: ALERT_CITATIONS,
            payload: {
              alertId,
              alertClass: "integrity",
              agentUrn: "agent:devon",
              details:
                "fx-twelvedata-ingest: BANK_TWELVEDATA_API_KEY missing. Add the key to prototype/.env.local then re-run prototype/scripts/launchd/install.sh to propagate it into the launchd plist EnvironmentVariables dict.",
              severity: "medium",
            },
            eventId: newEventId(),
          }),
        );
        eventsEmitted = 1;
      } catch (err) {
        // Alert emission failed — log but do not throw. The handler's
        // ok:false return still surfaces the failure via
        // SubstrateAgentRunCompleted.
        logger.error(
          { pipeline: "fx-twelvedata-ingest", err: (err as Error).message },
          "fx-twelvedata-ingest: failed to emit missing-key SubstrateAlert",
        );
      }
    }

    logger.warn(
      { pipeline: "fx-twelvedata-ingest", alertId, alreadyEmitted },
      "fx-twelvedata-ingest: BANK_TWELVEDATA_API_KEY not set — skipping fire.",
    );
    return {
      eventsEmitted,
      summary: alreadyEmitted
        ? "fx-twelvedata-ingest: skipped — BANK_TWELVEDATA_API_KEY not set (alert already raised this hour)"
        : "fx-twelvedata-ingest: skipped — BANK_TWELVEDATA_API_KEY not set (SubstrateAlert emitted)",
      ok: false,
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
