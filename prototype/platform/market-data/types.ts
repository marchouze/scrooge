// platform/market-data/types.ts
//
// Typed payload shapes for the initial set of market data types stored in
// MarketDataStore. These are reference/time-series data, NOT business domain
// events — they must not enter the event store.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

// ---------------------------------------------------------------------------
// FX spot/forward quote from sim or external feed
// ---------------------------------------------------------------------------

export interface FxQuotePayload {
  pair: string; // "USDZAR"
  mid: number;
  bid: number;
  ask: number;
  source: "fx-sim" | string;
}

// ---------------------------------------------------------------------------
// JSE SENS announcement stub
// ---------------------------------------------------------------------------

export interface SensAnnouncementPayload {
  ticker: string; // "AGL" (no exchange suffix in payload)
  exchange: "JSE";
  headline: string;
  category: string; // "Results" | "Dividend" | "RightsIssue" | "TradeStatement" | "Other"
  body: string;
  sensPdfUrl?: string; // when available from real feed
  sensDetailUrl?: string; // link to Sharenet detail page
}

// ---------------------------------------------------------------------------
// Generic news item (future: Bloomberg, Reuters, etc.)
// ---------------------------------------------------------------------------

export interface NewsPayload {
  headline: string;
  body: string;
  source: string; // "reuters" | "bloomberg" | "env-sim"
  relatedInstruments?: string[];
}

// ---------------------------------------------------------------------------
// Canonical source identifiers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ZARONIA overnight rate (SARB-published)
// ---------------------------------------------------------------------------

export interface ZaroniaRatePayload {
  /** Rate in decimal form, e.g. "0.0818" for 8.18% */
  rate: string;
  /** Compounding convention */
  convention: "overnight-compounded";
  /** Publication reference time, e.g. "17:00:00+02:00" */
  refTime: string;
  /** Build-phase marker */
  fixingVariant: "build-phase-fixture" | "live-sarb-api";
}

// ---------------------------------------------------------------------------
// Canonical source identifiers
// ---------------------------------------------------------------------------

export const MarketDataSources = {
  FX_SIM: "fx-sim",
  JSE_SENS: "jse-sens",
  NEWS: "news",
  OPEN_ER_API: "open-er-api",
  TWELVE_DATA: "twelve-data",
  ZARONIA_SARB: "zaronia-sarb",
} as const;
