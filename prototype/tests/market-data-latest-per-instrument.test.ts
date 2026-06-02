// tests/market-data-latest-per-instrument.test.ts
//
// Tests for MarketDataStore.latestPerInstrument() — the canonical
// "latest tick per (source, instrument)" read used by the market-data
// dashboard's asset-class sections.
//
// Covers:
//   1. Exactly one (newest) tick per (source, instrument) is returned.
//   2. Distinct instruments / sources are each represented.
//   3. Provenance default is production-only; "all" opts into mixed.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION; D-MARKET-DATA-PROVENANCE-ISOLATION-HARDENING.

import { describe, expect, it } from "bun:test";

import { MarketDataStore } from "../platform/market-data/store";

function freshStore(): MarketDataStore {
  return new MarketDataStore(":memory:");
}

describe("MarketDataStore.latestPerInstrument", () => {
  it("returns exactly the newest tick per (source, instrument)", () => {
    const store = freshStore();
    // Two ticks for the same instrument — only the newest should win.
    store.append({
      id: "a-old",
      source: "twelve-data",
      instrument: "USDZAR",
      dataType: "fx-quote",
      provenance: "production",
      asOf: "2026-06-01T10:00:00.000Z",
      payload: { mid: 18.1 },
    });
    store.append({
      id: "a-new",
      source: "twelve-data",
      instrument: "USDZAR",
      dataType: "fx-quote",
      provenance: "production",
      asOf: "2026-06-02T10:00:00.000Z",
      payload: { mid: 18.4 },
    });
    // A different instrument.
    store.append({
      id: "b",
      source: "jibar-afma",
      instrument: "JIBAR3M",
      dataType: "jibar-fixing",
      provenance: "production",
      asOf: "2026-05-27T15:00:00.000Z",
      payload: { rate: "0.0865" },
    });

    const latest = store.latestPerInstrument({ provenance: "all" });
    expect(latest).toHaveLength(2);

    const usdzar = latest.find((t) => t.instrument === "USDZAR");
    expect(usdzar?.id).toBe("a-new");
    expect(usdzar?.payload?.mid).toBe(18.4);

    const jibar = latest.find((t) => t.instrument === "JIBAR3M");
    expect(jibar?.id).toBe("b");

    // Stale-but-valid rate feed surfaces alongside the fresh FX feed — the
    // whole point of the sectioned view.
    expect(latest.map((t) => t.dataType).sort()).toEqual(["fx-quote", "jibar-fixing"]);
  });

  it("treats the same instrument from different sources as distinct rows", () => {
    const store = freshStore();
    store.append({
      id: "tw",
      source: "twelve-data",
      instrument: "USDZAR",
      dataType: "fx-quote",
      provenance: "production",
      asOf: "2026-06-02T10:00:00.000Z",
      payload: { mid: 18.4 },
    });
    store.append({
      id: "er",
      source: "open-er-api",
      instrument: "USDZAR",
      dataType: "fx-quote",
      provenance: "production",
      asOf: "2026-06-01T00:00:00.000Z",
      payload: { mid: 18.3 },
    });
    const latest = store.latestPerInstrument({ provenance: "all" });
    expect(latest).toHaveLength(2);
    expect(latest.map((t) => t.source).sort()).toEqual(["open-er-api", "twelve-data"]);
  });

  it("defaults to production-only; 'all' opts into simulated", () => {
    const store = freshStore();
    store.append({
      id: "prod",
      source: "twelve-data",
      instrument: "USDZAR",
      dataType: "fx-quote",
      provenance: "production",
      asOf: "2026-06-02T10:00:00.000Z",
      payload: { mid: 18.4 },
    });
    store.append({
      id: "sim",
      source: "fx-sim",
      instrument: "EURZAR",
      dataType: "fx-quote",
      provenance: "simulated",
      asOf: "2026-06-02T10:00:01.000Z",
      payload: { mid: 19.9 },
    });

    // Default (omitted) → production only.
    const prodOnly = store.latestPerInstrument();
    expect(prodOnly).toHaveLength(1);
    expect(prodOnly[0]?.provenance).toBe("production");

    // "all" → both.
    const all = store.latestPerInstrument({ provenance: "all" });
    expect(all).toHaveLength(2);
  });
});
