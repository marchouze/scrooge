// platform/market-data/index.ts
//
// Barrel export for the market data store and typed payload shapes.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

export { MarketDataStore, lookupQuoteWithInverse, extractMidRate, invertPair } from "./store";
export type { MarketDataTick, MarketDataQueryOptions, DirectedQuote } from "./store";
export { MarketDataSources } from "./types";
export type { FxQuotePayload, SensAnnouncementPayload, NewsPayload } from "./types";
