// tests/bond-price-ingester.test.ts
//
// Tests for the SA government bond reference-price ingester (build-phase
// fixture variant).
//
// Covers:
//   1. Happy path — fixture ingested, one tick per (ISIN, date) with correct
//      fields in MarketDataStore.
//   2. Idempotency — second ingest appends 0, skips all.
//   3. Deterministic tick ids.
//   4. ingestBondPriceFixtureFromFile loads the real seed fixture.
//
// Authority
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22) Slice 10
//
// Author: Ravi (Treasury / ALM engineer, engineering)

import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import {
  BUILD_PHASE_VARIANT_MARKER,
  type BondPriceFixtureShape,
  deriveBondPriceTickId,
  ingestBondPriceFixtureFromFile,
  makeFixtureBondPriceSource,
  runBondPriceIngest,
  runBondPriceIngestAll,
} from "../platform/market-data/bond-price-ingester";
import { MarketDataStore } from "../platform/market-data/store";

const TINY_FIXTURE: BondPriceFixtureShape = {
  source: "JSE-DEBT",
  refTime: "17:00:00+02:00",
  instruments: [
    { isin: "ZAG000030108", bondCode: "R186" },
    { isin: "ZAG000057547", bondCode: "R2030" },
  ],
  prices: {
    "2026-05-26": {
      ZAG000030108: { cleanPrice: "101.55", yield: "0.0800" },
      ZAG000057547: { cleanPrice: "95.18", yield: "0.0916" },
    },
    "2026-05-27": {
      ZAG000030108: { cleanPrice: "101.50", yield: "0.0802" },
      ZAG000057547: { cleanPrice: "95.02", yield: "0.0919" },
    },
  },
};

function freshStore(): MarketDataStore {
  return new MarketDataStore(":memory:");
}

describe("bond-price-ingester", () => {
  it("happy path — one tick per (ISIN, date) with correct fields", () => {
    const marketDataStore = freshStore();
    const source = makeFixtureBondPriceSource(TINY_FIXTURE);

    const results = runBondPriceIngestAll({ source, marketDataStore });

    // One result per date; 2 entries per date → 4 ticks appended.
    expect(results).toHaveLength(2);
    const totalAppended = results.reduce((acc, r) => acc + r.ticksAppended, 0);
    expect(totalAppended).toBe(4);

    const ticks = marketDataStore.query({
      source: "jse-debt",
      instrument: "ZAG000030108",
      provenance: "production",
    });
    expect(ticks).toHaveLength(2);

    const r186May27 = ticks.find(
      (t) => t.id === deriveBondPriceTickId("ZAG000030108", "2026-05-27"),
    );
    expect(r186May27).toBeDefined();
    expect(r186May27?.dataType).toBe("bond-price");
    expect(r186May27?.provenance).toBe("production");
    expect(r186May27?.asOf).toBe("2026-05-27T17:00:00+02:00");
    expect(r186May27?.payload?.cleanPrice).toBe("101.50");
    expect(r186May27?.payload?.yieldToMaturity).toBe("0.0802");
    expect(r186May27?.payload?.bondCode).toBe("R186");
    expect(r186May27?.payload?.fixingVariant).toBe(BUILD_PHASE_VARIANT_MARKER);
  });

  it("idempotency — second ingest appends 0, skips all", () => {
    const marketDataStore = freshStore();
    const source = makeFixtureBondPriceSource(TINY_FIXTURE);

    const first = runBondPriceIngestAll({ source, marketDataStore });
    expect(first.reduce((a, r) => a + r.ticksAppended, 0)).toBe(4);

    const second = runBondPriceIngestAll({ source, marketDataStore });
    expect(second.reduce((a, r) => a + r.ticksAppended, 0)).toBe(0);
    expect(second.reduce((a, r) => a + r.ticksSkippedAsDuplicate, 0)).toBe(4);
  });

  it("returns zero entries for a date not in the fixture", () => {
    const marketDataStore = freshStore();
    const source = makeFixtureBondPriceSource(TINY_FIXTURE);
    const result = runBondPriceIngest({ date: "2026-04-27", source, marketDataStore });
    expect(result.entriesProcessed).toBe(0);
    expect(result.ticksAppended).toBe(0);
  });

  it("deriveBondPriceTickId produces deterministic ids", () => {
    expect(deriveBondPriceTickId("ZAG000030108", "2026-05-27")).toBe(
      "JSE:BOND:ZAG000030108:2026-05-27",
    );
  });

  it("ingestBondPriceFixtureFromFile loads the real seed fixture (3 bonds)", () => {
    const marketDataStore = freshStore();
    const fixturePath = resolve(import.meta.dir, "..", "seeds", "bond-prices.json");
    const result = ingestBondPriceFixtureFromFile(marketDataStore, fixturePath);

    expect(result.datesProcessed).toBeGreaterThan(0);
    // 3 benchmark bonds × N dates.
    expect(result.ticksAppended).toBe(result.datesProcessed * 3);

    const r2040 = marketDataStore.query({
      source: "jse-debt",
      instrument: "ZAG000074989",
      provenance: "production",
    });
    expect(r2040.length).toBe(result.datesProcessed);
    expect(r2040[0]?.payload?.bondCode).toBe("R2040");
  });
});
