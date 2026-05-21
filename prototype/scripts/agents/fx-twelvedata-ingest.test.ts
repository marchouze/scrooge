// scripts/agents/fx-twelvedata-ingest.test.ts
//
// Unit tests for fx-twelvedata-parse.ts — no network calls.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION

import { describe, expect, it } from "bun:test";
import { TWELVE_DATA_TARGET_PAIRS, parseTwelveDataQuoteResponse } from "./fx-twelvedata-parse";

// ---------------------------------------------------------------------------
// Fixture — multi-symbol /quote response, free-tier shape (close + timestamp,
// no bid/ask in the upstream payload).
// ---------------------------------------------------------------------------

const TS = 1747795351; // 2025-05-21T03:22:31Z — arbitrary intraday UTC second

function makeQuote(
  symbol: string,
  close: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    symbol,
    name: `${symbol} exchange rate`,
    exchange: "Physical Currency",
    currency_base: symbol.split("/")[0],
    currency_quote: symbol.split("/")[1],
    datetime: "2025-05-21",
    timestamp: TS,
    open: close,
    high: close,
    low: close,
    close,
    previous_close: close,
    change: "0.00000",
    percent_change: "0.00000",
    is_market_open: true,
    ...extra,
  };
}

const FIXTURE = {
  "USD/ZAR": makeQuote("USD/ZAR", "18.42150"),
  "EUR/ZAR": makeQuote("EUR/ZAR", "20.55320"),
  "GBP/ZAR": makeQuote("GBP/ZAR", "24.11200"),
  "JPY/ZAR": makeQuote("JPY/ZAR", "0.11820"),
  "CHF/ZAR": makeQuote("CHF/ZAR", "21.04500"),
  "AUD/ZAR": makeQuote("AUD/ZAR", "12.21300"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseTwelveDataQuoteResponse", () => {
  it("returns exactly 6 quotes", () => {
    const quotes = parseTwelveDataQuoteResponse(FIXTURE);
    expect(quotes).toHaveLength(6);
  });

  it("returns all 6 target pairs", () => {
    const quotes = parseTwelveDataQuoteResponse(FIXTURE);
    const pairs = quotes.map((q) => q.pair);
    for (const target of TWELVE_DATA_TARGET_PAIRS) {
      expect(pairs).toContain(target);
    }
  });

  it("parses `close` (string) as numeric mid", () => {
    const quotes = parseTwelveDataQuoteResponse(FIXTURE);
    const usd = quotes.find((q) => q.pair === "USD/ZAR");
    expect(usd?.mid).toBeCloseTo(18.4215, 4);
  });

  it("synthesises bid = mid * 0.9998 when upstream omits bid", () => {
    const quotes = parseTwelveDataQuoteResponse(FIXTURE);
    const usd = quotes.find((q) => q.pair === "USD/ZAR");
    expect(usd?.bid).toBeCloseTo((usd?.mid ?? 0) * 0.9998, 10);
  });

  it("synthesises ask = mid * 1.0002 when upstream omits ask", () => {
    const quotes = parseTwelveDataQuoteResponse(FIXTURE);
    const usd = quotes.find((q) => q.pair === "USD/ZAR");
    expect(usd?.ask).toBeCloseTo((usd?.mid ?? 0) * 1.0002, 10);
  });

  it("uses actual bid/ask when the response provides them (paid-tier shape)", () => {
    const fixture = {
      ...FIXTURE,
      "USD/ZAR": makeQuote("USD/ZAR", "18.42150", { bid: "18.42000", ask: "18.42300" }),
    };
    const quotes = parseTwelveDataQuoteResponse(fixture);
    const usd = quotes.find((q) => q.pair === "USD/ZAR");
    expect(usd?.bid).toBeCloseTo(18.42, 4);
    expect(usd?.ask).toBeCloseTo(18.423, 4);
  });

  it("derives asOf from the unix timestamp", () => {
    const quotes = parseTwelveDataQuoteResponse(FIXTURE);
    for (const q of quotes) {
      expect(q.timestamp).toBe(TS);
      expect(q.asOf).toBe(new Date(TS * 1000).toISOString());
    }
  });

  it("throws when input is not an object", () => {
    expect(() => parseTwelveDataQuoteResponse("not an object")).toThrow(/not an object/);
  });

  it("throws on top-level API error envelope", () => {
    expect(() =>
      parseTwelveDataQuoteResponse({ code: 401, message: "Invalid API key", status: "error" }),
    ).toThrow(/API error/);
  });

  it("throws on per-symbol error envelope", () => {
    const broken = {
      ...FIXTURE,
      "USD/ZAR": { status: "error", code: 400, message: "symbol not found" },
    };
    expect(() => parseTwelveDataQuoteResponse(broken)).toThrow(/per-symbol error for USD\/ZAR/);
  });

  it("throws when a target pair is missing", () => {
    const { "USD/ZAR": _omitted, ...missing } = FIXTURE;
    expect(() => parseTwelveDataQuoteResponse(missing)).toThrow(/missing entry for USD\/ZAR/);
  });

  it("throws when `close` is invalid", () => {
    const broken = {
      ...FIXTURE,
      "USD/ZAR": makeQuote("USD/ZAR", "not-a-number"),
    };
    expect(() => parseTwelveDataQuoteResponse(broken)).toThrow(/invalid close for USD\/ZAR/);
  });

  it("throws when `timestamp` is missing or non-numeric", () => {
    const broken = {
      ...FIXTURE,
      "USD/ZAR": { ...makeQuote("USD/ZAR", "18.42"), timestamp: undefined },
    };
    expect(() => parseTwelveDataQuoteResponse(broken)).toThrow(/invalid timestamp for USD\/ZAR/);
  });
});
