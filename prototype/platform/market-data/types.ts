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

// ---------------------------------------------------------------------------
// JIBAR 3M daily fixing (AFMA-published)
// ---------------------------------------------------------------------------

export interface JibarFixingPayload {
  /** Rate in decimal form, e.g. "0.0815" for 8.15% */
  rate: string;
  /** Fixing tenor */
  tenor: "3M";
  /** Day-count convention */
  convention: "act365-simple";
  /** Build-phase marker */
  fixingVariant: "build-phase-fixture" | "live-afma-api";
}

// ---------------------------------------------------------------------------
// JIBAR swap curve daily snapshot
// ---------------------------------------------------------------------------

export interface SwapCurveSnapshotPayload {
  /** Annualised par JIBAR swap rates by tenor, e.g. {"3M":0.0815, "10Y":0.086} */
  tenors: Record<string, number>;
  /** Risk-free discount factors P(0,T) by tenor */
  discountFactors: Record<string, number>;
  /** Curve build convention */
  curveConvention: "jibar-single-curve";
  /** Build-phase marker */
  fixingVariant: "build-phase-fixture" | "live-sarb-api";
}

// ---------------------------------------------------------------------------
// SARB repo rate + prime rate (MPC decision)
// ---------------------------------------------------------------------------

export interface RepoPrimeRatePayload {
  /** Repo rate in decimal form, e.g. "0.075" for 7.5% */
  repoRate: string;
  /** Prime rate = repo + 0.035, derived */
  primeRate: string;
  /** ISO 8601 date of MPC decision */
  effectiveDate: string;
  /** Build-phase marker */
  fixingVariant: "build-phase-fixture" | "live-sarb-api";
}

// ---------------------------------------------------------------------------
// Bond reference price (JSE Debt Market / Bond Exchange of SA)
// ---------------------------------------------------------------------------

export interface BondPricePayload {
  /** Clean price as a percentage of par, e.g. "101.52" for 101.52% of nominal */
  cleanPrice: string;
  /** Yield to maturity in decimal form, e.g. "0.0802" for 8.02% */
  yieldToMaturity: string;
  /** Human-readable bond code, e.g. "R186" (ISIN is carried in the tick's instrument field) */
  bondCode: string;
  /**
   * Variant marker:
   *   "build-phase-fixture" — JSE Debt fixture seed (reference prices)
   *   "live-jse-debt"       — production JSE Debt Market feed (post-licence)
   *   "simulated-walk"      — bond-sim continuous clean-price walk (provenance "simulated")
   */
  fixingVariant: "build-phase-fixture" | "live-jse-debt" | "simulated-walk";
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
  JIBAR_AFMA: "jibar-afma",
  JIBAR_SWAP_SARB: "jibar-swap-sarb",
  SARB_REPO: "sarb-repo",
  JSE_DEBT: "jse-debt",
  BOND_SIM: "bond-sim",
} as const;
