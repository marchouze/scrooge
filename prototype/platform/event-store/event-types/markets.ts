// platform/event-store/event-types/markets.ts
//
// Market-related event-payload schemas for the event store.
//
// NOTE: Market data price ticks (FX quotes, equity prices, SENS announcements,
// news) are reference/time-series data and must NOT go into the event store.
// Use platform/market-data/store.ts (MarketDataStore) for those.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)
//
// (File intentionally empty — formerly contained marketDataTickReceivedPayloadSchema
// which was removed because market data ticks belong in MarketDataStore, not the
// event store. Retained as a module boundary for future market event schemas that
// legitimately belong in the event store.)
