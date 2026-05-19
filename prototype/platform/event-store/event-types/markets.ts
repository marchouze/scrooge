// platform/event-store/event-types/markets.ts
//
// Market data event-payload schemas — events emitted by the EnvSim market
// data simulator and any future real market data feed.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Env (External Environment Simulator) / Devon (Chief Operating Officer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// MarketDataTickReceived
//
// Emitted when a market data price tick is received (real or simulated).
// Carries bid/mid/ask for one currency pair. Source field distinguishes
// simulated ticks ("env-sim") from future live feed ticks.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// ---------------------------------------------------------------------------

export const marketDataTickReceivedPayloadSchema = z.object({
  /** Currency pair in BASE/QUOTE format, e.g. "ZAR/USD". */
  pair: z.string().min(1),
  /** Mid price. */
  mid: z.number(),
  /** Bid price (best buy). */
  bid: z.number(),
  /** Ask price (best sell). */
  ask: z.number(),
  /** Data source identifier. "env-sim" for simulated ticks. */
  source: z.literal("env-sim"),
  /** ISO 8601 timestamp of the tick. */
  asOf: z.string().min(1),
});

export type MarketDataTickReceivedPayload = z.infer<typeof marketDataTickReceivedPayloadSchema>;

export function makeMarketDataTickReceived(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MarketDataTickReceivedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "MarketDataTickReceived requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MarketDataTickReceived",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: marketDataTickReceivedPayloadSchema.parse(args.payload),
  });
}
