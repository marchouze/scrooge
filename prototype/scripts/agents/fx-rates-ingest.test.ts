// scripts/agents/fx-rates-ingest.test.ts
//
// Unit tests for fx-rates-parse.ts — no network calls.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION
// Author: Devon (Chief Operating Officer, engineering)

import { describe, expect, it } from "bun:test";
import { parseFxRatesFromApiResponse } from "./fx-rates-parse";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const FIXTURE = {
  result: "success",
  base_code: "ZAR",
  time_last_update_utc: "Tue, 19 May 2026 00:02:31 +0000",
  time_next_update_utc: "Wed, 20 May 2026 00:19:41 +0000",
  rates: {
    ZAR: 1,
    USD: 0.05454,
    EUR: 0.04867,
    GBP: 0.04134,
    JPY: 8.1234,
    CHF: 0.04789,
    AUD: 0.08421,
    CAD: 0.07512, // extra rate — should be ignored
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseFxRatesFromApiResponse", () => {
  it("returns exactly 6 pairs", () => {
    const rates = parseFxRatesFromApiResponse(FIXTURE);
    expect(rates).toHaveLength(6);
  });

  it("extracts USD/ZAR with correct mid (1 / rates.USD)", () => {
    const rates = parseFxRatesFromApiResponse(FIXTURE);
    const usd = rates.find((r) => r.pair === "USD/ZAR");
    expect(usd).toBeDefined();
    const expectedMid = 1 / 0.05454;
    expect(usd?.mid).toBeCloseTo(expectedMid, 8);
  });

  it("extracts EUR/ZAR with correct mid (1 / rates.EUR)", () => {
    const rates = parseFxRatesFromApiResponse(FIXTURE);
    const eur = rates.find((r) => r.pair === "EUR/ZAR");
    expect(eur).toBeDefined();
    const expectedMid = 1 / 0.04867;
    expect(eur?.mid).toBeCloseTo(expectedMid, 8);
  });

  it("extracts GBP/ZAR with correct mid", () => {
    const rates = parseFxRatesFromApiResponse(FIXTURE);
    const gbp = rates.find((r) => r.pair === "GBP/ZAR");
    expect(gbp).toBeDefined();
    expect(gbp?.mid).toBeCloseTo(1 / 0.04134, 8);
  });

  it("bid is mid * 0.9998", () => {
    const rates = parseFxRatesFromApiResponse(FIXTURE);
    const usd = rates.find((r) => r.pair === "USD/ZAR");
    expect(usd).toBeDefined();
    expect(usd?.bid).toBeCloseTo((usd?.mid ?? 0) * 0.9998, 10);
  });

  it("ask is mid * 1.0002", () => {
    const rates = parseFxRatesFromApiResponse(FIXTURE);
    const usd = rates.find((r) => r.pair === "USD/ZAR");
    expect(usd).toBeDefined();
    expect(usd?.ask).toBeCloseTo((usd?.mid ?? 0) * 1.0002, 10);
  });

  it("propagates updateUtc from time_last_update_utc", () => {
    const rates = parseFxRatesFromApiResponse(FIXTURE);
    for (const rate of rates) {
      expect(rate.updateUtc).toBe("Tue, 19 May 2026 00:02:31 +0000");
    }
  });

  it("includes all 6 target pairs", () => {
    const rates = parseFxRatesFromApiResponse(FIXTURE);
    const pairs = rates.map((r) => r.pair);
    expect(pairs).toContain("USD/ZAR");
    expect(pairs).toContain("EUR/ZAR");
    expect(pairs).toContain("GBP/ZAR");
    expect(pairs).toContain("JPY/ZAR");
    expect(pairs).toContain("CHF/ZAR");
    expect(pairs).toContain("AUD/ZAR");
  });

  it("ignores extra rates (CAD not returned)", () => {
    const rates = parseFxRatesFromApiResponse(FIXTURE);
    const pairs = rates.map((r) => r.pair);
    expect(pairs).not.toContain("CAD/ZAR");
  });

  it("throws when result is not success", () => {
    expect(() => parseFxRatesFromApiResponse({ ...FIXTURE, result: "error" })).toThrow(
      /result is not "success"/,
    );
  });

  it("throws when base_code is not ZAR", () => {
    expect(() => parseFxRatesFromApiResponse({ ...FIXTURE, base_code: "USD" })).toThrow(
      /base_code "ZAR"/,
    );
  });

  it("throws when time_last_update_utc is missing", () => {
    const { time_last_update_utc: _, ...noTimestamp } = FIXTURE;
    expect(() => parseFxRatesFromApiResponse(noTimestamp)).toThrow(/time_last_update_utc/);
  });

  it("throws when rates object is missing", () => {
    const { rates: _, ...noRates } = FIXTURE;
    expect(() => parseFxRatesFromApiResponse(noRates)).toThrow(/rates/);
  });

  it("throws when a target rate is missing", () => {
    const missingUsd = {
      ...FIXTURE,
      rates: { ...FIXTURE.rates, USD: undefined },
    };
    expect(() => parseFxRatesFromApiResponse(missingUsd)).toThrow(/USD/);
  });

  it("throws when input is not an object", () => {
    expect(() => parseFxRatesFromApiResponse("not an object")).toThrow(/not an object/);
  });
});
