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
// ZaroniaRatePublished
//
// Emitted by ravi:zaronia-ingest when a ZARONIA overnight rate is ingested
// from the feed adapter (SARB SarbWebApi or rbond.co.za build-phase source).
// ZARONIA is the SA RFR; daily publication at 10:00 SAST by SARB.
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE
// ---------------------------------------------------------------------------

export const zaroniaRatePublishedPayloadSchema = z.object({
  /** ZARONIA overnight rate as decimal (e.g. 0.0818 for 8.18%). */
  rate: z.number(),
  /** ISO 8601 date the rate was published (YYYY-MM-DD). */
  publicationDate: z.string(),
  /** Data source identifier (e.g. "sarb-sarbwebapi", "rbond-rates-latest"). */
  source: z.string(),
});

export type ZaroniaRatePublishedPayload = z.infer<typeof zaroniaRatePublishedPayloadSchema>;

export function makeZaroniaRatePublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  eventId?: string;
  payload: ZaroniaRatePublishedPayload;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ZaroniaRatePublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: zaroniaRatePublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ZaroniaTermRatePublished
//
// Emitted by ravi:zaronia-ingest when a ZARONIA compounded term rate is
// ingested. Term rates are backward-looking averages (1W–12M) used as
// floating-leg inputs for ZARONIA-first FTP curve construction.
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE
// ---------------------------------------------------------------------------

export const zaroniaTermRatePublishedPayloadSchema = z.object({
  /** ZARONIA compounded term rate as decimal (e.g. 0.0822 for 8.22%). */
  rate: z.number(),
  /** Compounding tenor (e.g. "1W", "1M", "3M", "6M", "9M", "12M"). */
  tenor: z.string(),
  /** ISO 8601 date the rate was published (YYYY-MM-DD). */
  publicationDate: z.string(),
  /** Data source identifier. */
  source: z.string(),
});

export type ZaroniaTermRatePublishedPayload = z.infer<typeof zaroniaTermRatePublishedPayloadSchema>;

export function makeZaroniaTermRatePublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  eventId?: string;
  payload: ZaroniaTermRatePublishedPayload;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ZaroniaTermRatePublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: zaroniaTermRatePublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// JibarFixingPublished
//
// LEGACY — emitted only during the JIBAR wind-down transition window.
// JIBAR new-trade cessation: May 2026. Full cessation: December 2026.
// Use ZARONIA-first events (ZaroniaRatePublished, ZaroniaTermRatePublished)
// for all new FTP curve construction.
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE
// ---------------------------------------------------------------------------

export const jibarFixingPublishedPayloadSchema = z.object({
  /** JIBAR fixing rate as decimal (e.g. 0.0890 for 8.90%). */
  rate: z.number(),
  /** Fixing tenor (e.g. "1M", "3M", "6M", "12M"). */
  tenor: z.string(),
  /** ISO 8601 date of the JIBAR fixing (YYYY-MM-DD). */
  fixingDate: z.string(),
  /** Data source identifier (e.g. "sarb-cpd-rates"). */
  source: z.string(),
});

export type JibarFixingPublishedPayload = z.infer<typeof jibarFixingPublishedPayloadSchema>;

/**
 * @deprecated Legacy calibration anchor only. JIBAR full cessation Dec 2026.
 *             Do not use for new FTP curve design or new trade structuring.
 */
export function makeJibarFixingPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  eventId?: string;
  payload: JibarFixingPublishedPayload;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "JibarFixingPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: jibarFixingPublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OisCurvePublished
//
// Emitted by ravi:sagb-yield-ingest when an OIS curve is ingested from
// the feed adapter (rbond.co.za build-phase source, JSE YieldX composite).
// ZARONIA-based OIS rates are the discount curve for collateralised pricing.
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE
// ---------------------------------------------------------------------------

export const oisCurvePublishedPayloadSchema = z.object({
  /** Ordered pillar array (tenor + rate as decimal). */
  pillars: z.array(
    z.object({
      tenor: z.string(),
      rate: z.number(),
    }),
  ),
  /** ISO 8601 date of the curve snapshot (YYYY-MM-DD). */
  curveDate: z.string(),
  /** Data source identifier (e.g. "rbond-curve"). */
  source: z.string(),
});

export type OisCurvePublishedPayload = z.infer<typeof oisCurvePublishedPayloadSchema>;

export function makeOisCurvePublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  eventId?: string;
  payload: OisCurvePublishedPayload;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OisCurvePublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: oisCurvePublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SagbYieldsPublished
//
// Emitted by ravi:sagb-yield-ingest when SA Government Bond benchmark yields
// are ingested from the feed adapter (rbond.co.za generics endpoint,
// JSE YieldX daily close).
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE
// ---------------------------------------------------------------------------

export const sagbYieldsPublishedPayloadSchema = z.object({
  /** Benchmark yield array — one entry per standard tenor. */
  yields: z.array(
    z.object({
      /** Standard tenor label (e.g. "1Y", "10Y", "30Y"). */
      tenor: z.string(),
      /** Yield as a percentage (e.g. 9.25 for 9.25%). */
      yieldPct: z.number(),
      /** ISIN of the benchmark bond at this tenor, if available. */
      isin: z.string().optional(),
    }),
  ),
  /** ISO 8601 settlement date for the yields (YYYY-MM-DD). */
  settleDate: z.string(),
  /** Data source identifier (e.g. "rbond-generics"). */
  source: z.string(),
});

export type SagbYieldsPublishedPayload = z.infer<typeof sagbYieldsPublishedPayloadSchema>;

export function makeSagbYieldsPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  eventId?: string;
  payload: SagbYieldsPublishedPayload;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SagbYieldsPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: sagbYieldsPublishedPayloadSchema.parse(args.payload),
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

export const MARKET_DATA_TYPED_EVENT_TYPES = [
  "MarketDataStaleAlert",
  // W2.3 FTP feed adapter events — Authority: D-TREASURER-WAVE2-SUBSTRATE
  "ZaroniaRatePublished",
  "ZaroniaTermRatePublished",
  /** @deprecated JIBAR legacy calibration anchor — cessation Dec 2026 */
  "JibarFixingPublished",
  "OisCurvePublished",
  "SagbYieldsPublished",
] as const;

export type MarketDataEventType = (typeof MARKET_DATA_TYPED_EVENT_TYPES)[number];
