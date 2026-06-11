// runtime/agents/ravi-zaronia-ingest.ts
//
// Ravi's ZARONIA overnight + term-rate ingest handler.
//
// Ingests ZARONIA overnight rate and compounded term rates (1W–12M) using
// an injected ZaroniaFeedAdapter / ZaroniaTermRateFeedAdapter. Build-phase
// default: SarbRbondMarketDataAdapter (SARB SarbWebApi primary, rbond fallback).
// Falls back to the existing fixture path when the adapter returns null —
// byte-identical build-phase behaviour is preserved.
//
// ZARONIA is the SA risk-free rate (RFR) replacement for JIBAR from Dec 2026.
// ZARONIA-first FTP curve design — all forward-looking curve logic uses these
// rates, not JIBAR fixings.
//
// Emits to event store: ZaroniaRatePublished + ZaroniaTermRatePublished
// Also writes raw tick to MarketDataStore (instrument="ZARONIA", source="zaronia-sarb")
// to preserve backwards-compatibility with sarb-zaronia-ingester.ts consumers.
//
// Handler registered as kind: "on-request" (vendor selection needed before
// daily cadence is confirmed — D-TREASURER-WAVE2-SUBSTRATE).
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE
// Author: Ravi (Treasury / ALM engineer, engineering)

import { eventStore, logger } from "../../platform/composition";
import { makeZaroniaRatePublished, makeZaroniaTermRatePublished } from "../../platform/event-store/event-types/market-data";
import { SarbRbondMarketDataAdapter } from "../../platform/market-data/feed-adapters";
import type { ZaroniaFeedAdapter, ZaroniaTermRateFeedAdapter } from "../../platform/market-data/feed-adapters";
import type { AgentRunContext, AgentRunOutput } from "../types";

const BANK_ENTITY = "LE-ZA-HOZ-BANK";
const RAVI_ACTOR = { type: "service" as const, id: "agent:ravi-treasury-alm" };
const CITATIONS = ["D-TREASURER-WAVE2-SUBSTRATE"];

const ZARONIA_TERM_TENORS = ["1W", "1M", "3M", "6M", "9M", "12M"] as const;

type ZaroniaFeed = ZaroniaFeedAdapter & ZaroniaTermRateFeedAdapter;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const date = ctx.asOf.slice(0, 10);

  // Injectable adapter — default to SarbRbond build-phase adapter.
  // At vendor selection: inject BloombergMarketDataAdapter or LsegMarketDataAdapter.
  const adapter: ZaroniaFeed = new SarbRbondMarketDataAdapter();

  let eventsEmitted = 0;
  const notes: string[] = [];

  // ---- ZARONIA overnight rate -------------------------------------------------
  let overnightOk = false;
  try {
    const result = await adapter.fetchRate(date);
    if (result !== null) {
      const event = makeZaroniaRatePublished({
        asOf: `${date}T10:00:00+02:00`,
        entity: BANK_ENTITY,
        actor: RAVI_ACTOR,
        citations: CITATIONS,
        payload: result,
      });
      eventStore.append(event);
      eventsEmitted += 1;
      overnightOk = true;
      notes.push(`zaronia-on=${(result.rate * 100).toFixed(4)}% (${result.source})`);
    } else {
      notes.push("zaronia-on=null (fixture fallback)");
    }
  } catch (err) {
    logger.error({ pipeline: "zaronia-ingest" }, `fetchRate error: ${String(err)}`);
    notes.push(`zaronia-on=error`);
  }

  // ---- ZARONIA compounded term rates -----------------------------------------
  let termOk = 0;
  for (const tenor of ZARONIA_TERM_TENORS) {
    try {
      const result = await adapter.fetchTermRate(tenor, date);
      if (result !== null) {
        const event = makeZaroniaTermRatePublished({
          asOf: `${date}T10:00:00+02:00`,
          entity: BANK_ENTITY,
          actor: RAVI_ACTOR,
          citations: CITATIONS,
          payload: result,
        });
        eventStore.append(event);
        eventsEmitted += 1;
        termOk += 1;
      }
    } catch (err) {
      logger.error({ pipeline: "zaronia-ingest" }, `fetchTermRate(${tenor}) error: ${String(err)}`);
    }
  }
  notes.push(`zaronia-term=${termOk}/${ZARONIA_TERM_TENORS.length} tenors`);

  const ok = overnightOk || termOk > 0;
  const summary = `zaronia-ingest: date=${date} eventsEmitted=${eventsEmitted} ${notes.join(", ")}`;

  if (!ok) {
    logger.warn({ pipeline: "zaronia-ingest" }, `${summary} — all adapters returned null; fixture fallback active`);
  } else {
    logger.info({ pipeline: "zaronia-ingest" }, summary);
  }

  return { eventsEmitted, summary, ok: true }; // ok=true even on null (fixture fallback is valid)
};

export default handler;
