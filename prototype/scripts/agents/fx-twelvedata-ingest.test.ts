// scripts/agents/fx-twelvedata-ingest.test.ts
//
// Unit tests for fx-twelvedata-parse.ts — no network calls.
// Tests the /time_series parser (parseTwelveDataTimeSeriesResponse).
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION

import { describe, expect, it } from "bun:test";
import { TWELVE_DATA_TARGET_PAIRS, parseTwelveDataTimeSeriesResponse } from "./fx-twelvedata-parse";

// ---------------------------------------------------------------------------
// Fixtures — multi-symbol /time_series response, free-tier shape.
// datetime strings are UTC ("YYYY-MM-DD HH:MM:SS"), outputsize=2 (2 bars).
// ---------------------------------------------------------------------------

const DT1 = "2026-05-21 17:00:00"; // most-recent bar
const DT2 = "2026-05-21 16:00:00"; // previous bar
const TS1 = Math.floor(Date.parse("2026-05-21T17:00:00Z") / 1000);
const TS2 = Math.floor(Date.parse("2026-05-21T16:00:00Z") / 1000);

function makeSymbolEntry(
  symbol: string,
  close1: string,
  close2: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    meta: {
      symbol,
      interval: "1h",
      currency_base: symbol.split("/")[0],
      currency_quote: symbol.split("/")[1],
      exchange_timezone: "UTC",
      type: "Physical Currency",
    },
    values: [
      { datetime: DT1, open: close1, high: close1, low: close1, close: close1, ...extra },
      { datetime: DT2, open: close2, high: close2, low: close2, close: close2 },
    ],
    status: "ok",
  };
}

const FIXTURE = {
  "USD/ZAR": makeSymbolEntry("USD/ZAR", "16.5100", "16.4950"),
  "EUR/ZAR": makeSymbolEntry("EUR/ZAR", "19.1600", "19.1400"),
  "GBP/ZAR": makeSymbolEntry("GBP/ZAR", "22.1900", "22.1700"),
  "JPY/ZAR": makeSymbolEntry("JPY/ZAR", "0.1039", "0.1038"),
  "CHF/ZAR": makeSymbolEntry("CHF/ZAR", "20.9500", "20.9300"),
  "AUD/ZAR": makeSymbolEntry("AUD/ZAR", "11.7800", "11.7700"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseTwelveDataTimeSeriesResponse", () => {
  it("returns 2 bars × 6 pairs = 12 quotes", () => {
    const quotes = parseTwelveDataTimeSeriesResponse(FIXTURE);
    expect(quotes).toHaveLength(12);
  });

  it("covers all 6 target pairs", () => {
    const quotes = parseTwelveDataTimeSeriesResponse(FIXTURE);
    for (const target of TWELVE_DATA_TARGET_PAIRS) {
      expect(quotes.some((q) => q.pair === target)).toBe(true);
    }
  });

  it("parses `close` (string) as numeric mid", () => {
    const quotes = parseTwelveDataTimeSeriesResponse(FIXTURE);
    const usd1 = quotes.find((q) => q.pair === "USD/ZAR" && q.timestamp === TS1);
    expect(usd1?.mid).toBeCloseTo(16.51, 4);
  });

  it("synthesises bid = mid * 0.9998", () => {
    const quotes = parseTwelveDataTimeSeriesResponse(FIXTURE);
    const usd1 = quotes.find((q) => q.pair === "USD/ZAR" && q.timestamp === TS1);
    expect(usd1?.bid).toBeCloseTo((usd1?.mid ?? 0) * 0.9998, 10);
  });

  it("synthesises ask = mid * 1.0002", () => {
    const quotes = parseTwelveDataTimeSeriesResponse(FIXTURE);
    const usd1 = quotes.find((q) => q.pair === "USD/ZAR" && q.timestamp === TS1);
    expect(usd1?.ask).toBeCloseTo((usd1?.mid ?? 0) * 1.0002, 10);
  });

  it("derives timestamps from UTC datetime strings", () => {
    const quotes = parseTwelveDataTimeSeriesResponse(FIXTURE);
    const usd = quotes.filter((q) => q.pair === "USD/ZAR");
    const timestamps = usd.map((q) => q.timestamp).sort((a, b) => b - a);
    expect(timestamps[0]).toBe(TS1);
    expect(timestamps[1]).toBe(TS2);
  });

  it("derives asOf as ISO-8601 UTC from timestamp", () => {
    const quotes = parseTwelveDataTimeSeriesResponse(FIXTURE);
    const usd1 = quotes.find((q) => q.pair === "USD/ZAR" && q.timestamp === TS1);
    expect(usd1?.asOf).toBe(new Date(TS1 * 1000).toISOString());
  });

  it("each bar has a unique pair+timestamp combination", () => {
    const quotes = parseTwelveDataTimeSeriesResponse(FIXTURE);
    const keys = quotes.map((q) => `${q.pair}:${q.timestamp}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("throws when input is not an object", () => {
    expect(() => parseTwelveDataTimeSeriesResponse("not an object")).toThrow(/not an object/);
  });

  it("throws on top-level API error envelope", () => {
    expect(() =>
      parseTwelveDataTimeSeriesResponse({ code: 401, message: "Invalid API key", status: "error" }),
    ).toThrow(/API error/);
  });

  it("throws on per-symbol error envelope", () => {
    const broken = {
      ...FIXTURE,
      "USD/ZAR": { status: "error", code: 400, message: "symbol not found" },
    };
    expect(() => parseTwelveDataTimeSeriesResponse(broken)).toThrow(
      /per-symbol error for USD\/ZAR/,
    );
  });

  it("throws when a target pair is missing", () => {
    const { "USD/ZAR": _omitted, ...missing } = FIXTURE;
    expect(() => parseTwelveDataTimeSeriesResponse(missing)).toThrow(/missing entry for USD\/ZAR/);
  });

  it("throws when values array is absent", () => {
    const broken = {
      ...FIXTURE,
      "USD/ZAR": { ...FIXTURE["USD/ZAR"], values: [] },
    };
    expect(() => parseTwelveDataTimeSeriesResponse(broken)).toThrow(/no values array for USD\/ZAR/);
  });

  it("throws when a bar has an invalid close", () => {
    const broken = {
      ...FIXTURE,
      "USD/ZAR": {
        ...FIXTURE["USD/ZAR"],
        values: [
          { datetime: DT1, open: "16.51", high: "16.51", low: "16.51", close: "not-a-number" },
        ],
      },
    };
    expect(() => parseTwelveDataTimeSeriesResponse(broken)).toThrow(/invalid close for USD\/ZAR/);
  });

  it("throws when a bar has a missing datetime", () => {
    const broken = {
      ...FIXTURE,
      "USD/ZAR": {
        ...FIXTURE["USD/ZAR"],
        values: [{ open: "16.51", high: "16.51", low: "16.51", close: "16.51" }],
      },
    };
    expect(() => parseTwelveDataTimeSeriesResponse(broken)).toThrow(
      /missing datetime for USD\/ZAR/,
    );
  });
});
