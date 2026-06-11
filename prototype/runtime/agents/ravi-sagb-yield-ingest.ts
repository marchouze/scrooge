// runtime/agents/ravi-sagb-yield-ingest.ts
//
// Ravi's SA Government Bond benchmark yield + OIS curve ingest handler.
//
// Ingests SAGB benchmark yields (1Y–30Y from JSE YieldX) and the ZARONIA-based
// OIS swap curve using an injected SagbYieldFeedAdapter / OisCurveFeedAdapter.
// Build-phase default: SarbRbondMarketDataAdapter (rbond.co.za generics + curve
// endpoints). Falls back gracefully when the adapter returns null.
//
// Emits to event store:
//   SagbYieldsPublished — SAGB benchmark yields at standard tenors
//   OisCurvePublished   — ZARONIA-based OIS swap curve pillars
//
// Handler registered as kind: "on-request" (vendor selection needed before
// daily cadence is confirmed — D-TREASURER-WAVE2-SUBSTRATE).
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE
// Author: Ravi (Treasury / ALM engineer, engineering)

import { eventStore, logger } from "../../platform/composition";
import {
  makeOisCurvePublished,
  makeSagbYieldsPublished,
} from "../../platform/event-store/event-types/market-data";
import { SarbRbondMarketDataAdapter } from "../../platform/market-data/feed-adapters";
import type {
  OisCurveFeedAdapter,
  SagbYieldFeedAdapter,
} from "../../platform/market-data/feed-adapters";
import type { AgentRunContext, AgentRunOutput } from "../types";

const BANK_ENTITY = "LE-ZA-HOZ-BANK";
const RAVI_ACTOR = { type: "service" as const, id: "agent:ravi-treasury-alm" };
const CITATIONS = ["D-TREASURER-WAVE2-SUBSTRATE"];

type SagbOisFeed = SagbYieldFeedAdapter & OisCurveFeedAdapter;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const date = ctx.asOf.slice(0, 10);

  // Injectable adapter — default to SarbRbond build-phase adapter.
  // At vendor selection: inject BloombergMarketDataAdapter or LsegMarketDataAdapter.
  const adapter: SagbOisFeed = new SarbRbondMarketDataAdapter();

  let eventsEmitted = 0;
  const notes: string[] = [];

  // ---- SAGB benchmark yields -------------------------------------------------
  try {
    const result = await adapter.fetchBenchmarkYields(date);
    if (result !== null) {
      const event = makeSagbYieldsPublished({
        asOf: `${date}T17:00:00+02:00`, // JSE YieldX daily close
        entity: BANK_ENTITY,
        actor: RAVI_ACTOR,
        citations: CITATIONS,
        payload: result,
      });
      eventStore.append(event);
      eventsEmitted += 1;
      notes.push(`sagb-yields=${result.yields.length} tenors (${result.source})`);
    } else {
      notes.push("sagb-yields=null (adapter returned no data)");
    }
  } catch (err) {
    logger.error({ pipeline: "sagb-yield-ingest" }, `fetchBenchmarkYields error: ${String(err)}`);
    notes.push("sagb-yields=error");
  }

  // ---- OIS curve -------------------------------------------------------------
  try {
    const result = await adapter.fetchCurve(date);
    if (result !== null) {
      const event = makeOisCurvePublished({
        asOf: `${date}T17:00:00+02:00`, // JSE YieldX daily close
        entity: BANK_ENTITY,
        actor: RAVI_ACTOR,
        citations: CITATIONS,
        payload: result,
      });
      eventStore.append(event);
      eventsEmitted += 1;
      notes.push(`ois-curve=${result.pillars.length} pillars (${result.source})`);
    } else {
      notes.push("ois-curve=null (adapter returned no data)");
    }
  } catch (err) {
    logger.error({ pipeline: "sagb-yield-ingest" }, `fetchCurve error: ${String(err)}`);
    notes.push("ois-curve=error");
  }

  const summary = `sagb-yield-ingest: date=${date} eventsEmitted=${eventsEmitted} ${notes.join(", ")}`;
  logger.info({ pipeline: "sagb-yield-ingest" }, summary);

  // ok=true even when adapter returns null — null means fixture fallback remains active,
  // which is valid build-phase behaviour (byte-identical to pre-W2.3 behaviour).
  return { eventsEmitted, summary, ok: true };
};

export default handler;
