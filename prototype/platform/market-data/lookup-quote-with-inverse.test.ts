// platform/market-data/lookup-quote-with-inverse.test.ts
//
// Tests for the direction-aware FX quote lookup helper introduced to fix the
// MTM-run skip bug: trades booked in one direction (e.g. ZAR/EUR) were silently
// skipping MTM because the upstream feeds store the opposite direction
// (e.g. EUR/ZAR). The helper queries the requested direction first, then falls
// back to the inverted pair with `rate = 1/storedRate`.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - IAS-21-§28 (closing-rate translation — direction-neutral by construction)
//
// Author: Rohan (Market risk engineer, engineering)

import { describe, expect, test } from "bun:test";

import { MarketDataStore, extractMidRate, invertPair, lookupQuoteWithInverse } from "./store";

function freshStore(): MarketDataStore {
  return new MarketDataStore(":memory:");
}

function seedTick(
  store: MarketDataStore,
  args: {
    source: string;
    instrument: string;
    payload: Record<string, unknown>;
    asOf?: string;
    provenance?: "production" | "simulated";
  },
): void {
  store.append({
    id: `${args.source}-${args.instrument}-${args.asOf ?? "2026-05-21"}`,
    source: args.source,
    instrument: args.instrument,
    dataType: "fx-quote",
    provenance: args.provenance ?? "production",
    asOf: args.asOf ?? "2026-05-21T12:00:00Z",
    payload: args.payload,
  });
}

describe("invertPair", () => {
  test("inverts a canonical BASE/QUOTE pair", () => {
    expect(invertPair("EUR/ZAR")).toBe("ZAR/EUR");
    expect(invertPair("ZAR/USD")).toBe("USD/ZAR");
  });

  test("returns the original string when the input is not BASE/QUOTE", () => {
    expect(invertPair("EURZAR")).toBe("EURZAR");
    expect(invertPair("")).toBe("");
    expect(invertPair("/")).toBe("/");
    expect(invertPair("EUR/")).toBe("EUR/");
  });
});

describe("extractMidRate", () => {
  test("returns explicit mid when present", () => {
    expect(extractMidRate({ mid: 19.5 })).toBe(19.5);
  });
  test("returns midRate when mid is absent", () => {
    expect(extractMidRate({ midRate: 21.1 })).toBe(21.1);
  });
  test("returns bid/ask average when neither mid present", () => {
    expect(extractMidRate({ bid: 18, ask: 20 })).toBe(19);
  });
  test("returns undefined when no usable rate", () => {
    expect(extractMidRate({})).toBeUndefined();
    expect(extractMidRate({ mid: 0 })).toBeUndefined();
    expect(extractMidRate({ mid: -1 })).toBeUndefined();
  });
});

describe("lookupQuoteWithInverse", () => {
  test("direct hit — stored EUR/ZAR queried as EUR/ZAR returns rate as-is", () => {
    const store = freshStore();
    seedTick(store, { source: "open-er-api", instrument: "EUR/ZAR", payload: { mid: 19.5 } });

    const result = lookupQuoteWithInverse(store, "EUR/ZAR");
    expect(result).not.toBeNull();
    expect(result?.sourceDirection).toBe("direct");
    expect(result?.rate).toBeCloseTo(19.5);
    expect(result?.tick.source).toBe("open-er-api");
    store.close();
  });

  test("inverse hit — stored EUR/ZAR queried as ZAR/EUR returns 1/rate", () => {
    const store = freshStore();
    seedTick(store, { source: "open-er-api", instrument: "EUR/ZAR", payload: { mid: 20.0 } });

    const result = lookupQuoteWithInverse(store, "ZAR/EUR");
    expect(result).not.toBeNull();
    expect(result?.sourceDirection).toBe("inverse");
    expect(result?.rate).toBeCloseTo(1 / 20.0);
    expect(result?.tick.instrument).toBe("EUR/ZAR");
    store.close();
  });

  test("no-hit — neither direction returns null", () => {
    const store = freshStore();
    seedTick(store, { source: "open-er-api", instrument: "GBP/ZAR", payload: { mid: 22.5 } });

    const result = lookupQuoteWithInverse(store, "USD/JPY");
    expect(result).toBeNull();
    store.close();
  });

  test("rate derivation falls through mid → midRate → bid/ask", () => {
    const store = freshStore();
    seedTick(store, { source: "feed-a", instrument: "USD/ZAR", payload: { bid: 18, ask: 20 } });

    const direct = lookupQuoteWithInverse(store, "USD/ZAR");
    expect(direct?.rate).toBeCloseTo(19);

    const inverse = lookupQuoteWithInverse(store, "ZAR/USD");
    expect(inverse?.sourceDirection).toBe("inverse");
    expect(inverse?.rate).toBeCloseTo(1 / 19);
    store.close();
  });

  test("excludeSource skips primary source — IPV path uses inverse for secondary", () => {
    const store = freshStore();
    // Only the secondary source has the inverse direction stored.
    seedTick(store, {
      source: "twelve-data",
      instrument: "EUR/ZAR",
      payload: { mid: 19.9 },
    });

    // No direct tick at all; secondary IPV lookup must invert to satisfy the
    // ZAR/EUR query while excluding the (non-existent) primary "fake-primary".
    const result = lookupQuoteWithInverse(store, "ZAR/EUR", {
      excludeSource: "open-er-api",
    });
    expect(result).not.toBeNull();
    expect(result?.sourceDirection).toBe("inverse");
    expect(result?.tick.source).toBe("twelve-data");
    expect(result?.rate).toBeCloseTo(1 / 19.9);
    store.close();
  });

  test("excludeSource filters out the primary's source", () => {
    const store = freshStore();
    seedTick(store, { source: "open-er-api", instrument: "EUR/ZAR", payload: { mid: 19.5 } });
    seedTick(store, { source: "twelve-data", instrument: "EUR/ZAR", payload: { mid: 19.7 } });

    const result = lookupQuoteWithInverse(store, "EUR/ZAR", {
      excludeSource: "open-er-api",
    });
    expect(result?.tick.source).toBe("twelve-data");
    expect(result?.rate).toBeCloseTo(19.7);
    store.close();
  });

  test("provenance filter — simulated ticks not returned by default", () => {
    const store = freshStore();
    seedTick(store, {
      source: "fx-sim",
      instrument: "EUR/ZAR",
      payload: { mid: 19.5 },
      provenance: "simulated",
    });

    const result = lookupQuoteWithInverse(store, "EUR/ZAR");
    expect(result).toBeNull();

    const sim = lookupQuoteWithInverse(store, "EUR/ZAR", { provenance: "simulated" });
    expect(sim?.sourceDirection).toBe("direct");
    expect(sim?.rate).toBeCloseTo(19.5);
    store.close();
  });

  test("integration — seed EUR/ZAR tick, query as ZAR/EUR, MTM-style inverse used", () => {
    // Reproduces the production bug class: trade booked ZAR/EUR; feeds store
    // EUR/ZAR; before the fix, MTM would skip the position with
    // `no production rate for ZAR/EUR`.
    const store = freshStore();
    seedTick(store, {
      source: "open-er-api",
      instrument: "EUR/ZAR",
      payload: { mid: 20.5 },
    });
    seedTick(store, {
      source: "twelve-data",
      instrument: "EUR/ZAR",
      payload: { mid: 20.4 },
    });

    // Primary: any-source ZAR/EUR — inverted from EUR/ZAR.
    const primary = lookupQuoteWithInverse(store, "ZAR/EUR");
    expect(primary?.sourceDirection).toBe("inverse");
    expect(primary?.rate).toBeCloseTo(1 / 20.5);

    // IPV secondary: exclude primary's source, still resolves via inverse.
    if (primary === null) throw new Error("primary lookup must succeed for integration test");
    const primarySource = primary.tick.source;
    const secondary = lookupQuoteWithInverse(store, "ZAR/EUR", {
      excludeSource: primarySource,
    });
    expect(secondary?.sourceDirection).toBe("inverse");
    expect(secondary?.tick.source).not.toBe(primarySource);
    expect(secondary?.rate).toBeCloseTo(1 / 20.4);
    store.close();
  });
});
