// platform/event-store/event-types/market-data.ts
//
// Market-data domain event-payload schemas for the event store.
//
// Covers:
//   - MarketDataStaleAlert   — alert raised when a market-data source exceeds
//                              the stale-data threshold for an instrument.
//
// NOTE: Market data price ticks (FX quotes, equity prices, SENS announcements,
// news) are reference/time-series data and must NOT go into the event store.
// Use platform/market-data/store.ts (MarketDataStore) for those.
// These events cover *control-plane* events that belong in the event log
// (alerting, governance decisions) — not the data itself.
//
// NOTE: ModelValidationApproved lives in platform/event-store/event-types/model-risk.ts
// (ModelRegistry substrate). The registry row for ModelValidationApproved with
// Helena as issuer is in platform/event-store/registry/market-data.ts, which
// re-uses the existing payload schema from model-risk.ts.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07);
//   Policies/valuation-policy-v1.md §5.
//
// Authors: Atlas (Core Banking Platform Architect, engineering) +
//   Rohan (Quant Risk Engineer, markets) +
//   Helena (Chief Risk Officer, governance).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// MarketDataStaleAlert
//
// Emitted by Rohan's market-data watchdog when a data source exceeds the
// stale-data threshold for a given instrument and data type. Carries the
// actual age vs threshold, and whether a fallback source was activated.
//
// Authority:
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07);
//   Policies/valuation-policy-v1.md §5 (market-data quality standards).
// ---------------------------------------------------------------------------

export const marketDataStaleAlertPayloadSchema = z.object({
  /** Instrument identifier (e.g. "USD/ZAR", "JSE:NPN", "ZA-SAGB-2030"). */
  instrument: z.string(),
  /** Data source that went stale (e.g. "Bloomberg", "Refinitiv", "JSE-SENS"). */
  source: z.string(),
  /**
   * Type of market data that is stale.
   * Examples: "mid-price", "bid-offer", "yield-curve", "vol-surface", "credit-spread".
   */
  dataType: z.string(),
  /** Stale-data threshold in milliseconds. */
  thresholdMs: z.number().int().positive(),
  /** Actual age of the stale data in milliseconds at the time the alert was raised. */
  actualAgeMs: z.number().int().nonnegative(),
  /** ISO 8601 timestamp when the alert was evaluated. */
  asOf: z.string(),
  /**
   * Fallback data source activated in response to the stale alert.
   * Null if no fallback was available or configured.
   */
  fallbackSourceUsed: z.string().nullable(),
});

export type MarketDataStaleAlertPayload = z.infer<typeof marketDataStaleAlertPayloadSchema>;

export function makeMarketDataStaleAlert(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  eventId?: string;
  payload: MarketDataStaleAlertPayload;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MarketDataStaleAlert",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: marketDataStaleAlertPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MARKET_DATA_TYPED_EVENT_TYPES — registry of all market-data domain event types.
//
// To add a new market-data event type:
//   (1) define its payload schema + factory above,
//   (2) add its name to this array,
//   (3) add a spread of MARKET_DATA_TYPED_EVENT_TYPES in event-types/index.ts.
// ---------------------------------------------------------------------------

export const MARKET_DATA_TYPED_EVENT_TYPES = ["MarketDataStaleAlert"] as const;

export type MarketDataEventType = (typeof MARKET_DATA_TYPED_EVENT_TYPES)[number];
