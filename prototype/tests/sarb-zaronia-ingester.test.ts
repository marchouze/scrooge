// tests/sarb-zaronia-ingester.test.ts
//
// Tests for the SARB ZARONIA rate ingester (build-phase fixture variant).
//
// Covers:
//   1. Happy path — fixture ingested, ticks present for all dates in
//      MarketDataStore with correct fields.
//   2. Idempotency — second `runSarbZaroniaIngestAll` returns
//      ticksAppended=0, ticksSkippedAsDuplicate>0.
//   3. allDates() — returns dates sorted chronologically.
//
// Authority
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 7
//   - Policies/market-risk-policy-v1.md
//   - Team/Ravi.md (ZARONIA conventions)
//
// Author: Ravi (Treasury / ALM engineer)

import { describe, expect, it } from "bun:test";

import {
  BUILD_PHASE_VARIANT_MARKER,
  type SarbZaroniaFixtureShape,
  deriveSarbZaroniaTickId,
  makeFixtureSarbZaroniaSource,
  runSarbZaroniaIngest,
  runSarbZaroniaIngestAll,
} from "../platform/market-data/sarb-zaronia-ingester";
import { MarketDataStore } from "../platform/market-data/store";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TINY_FIXTURE: SarbZaroniaFixtureShape = {
  source: "SARB",
  instrument: "ZARONIA",
  refTime: "17:00:00+02:00",
  fixings: {
    "2026-01-02": "0.0818",
    "2026-01-05": "0.0817",
    "2026-01-06": "0.0819",
    "2026-01-07": "0.0818",
    "2026-01-08": "0.0817",
  },
};

function freshStore(): MarketDataStore {
  return new MarketDataStore(":memory:");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sarb-zaronia-ingester", () => {
  it("happy path — fixture ingested, ticks present for all dates", () => {
    const marketDataStore = freshStore();
    const source = makeFixtureSarbZaroniaSource(TINY_FIXTURE);

    const results = runSarbZaroniaIngestAll({ source, marketDataStore });

    // One result per date in the fixture.
    expect(results).toHaveLength(5);

    // All ticks appended.
    const totalAppended = results.reduce((acc, r) => acc + r.ticksAppended, 0);
    expect(totalAppended).toBe(5);
    const totalSkipped = results.reduce((acc, r) => acc + r.ticksSkippedAsDuplicate, 0);
    expect(totalSkipped).toBe(0);

    // Ticks land in MarketDataStore with correct fields.
    const ticks = marketDataStore.query({
      source: "zaronia-sarb",
      instrument: "ZARONIA",
      provenance: "production",
    });
    expect(ticks).toHaveLength(5);

    // Spot-check first tick.
    const tickForJan2 = ticks.find((t) => t.id === deriveSarbZaroniaTickId("2026-01-02"));
    expect(tickForJan2).toBeDefined();
    expect(tickForJan2?.dataType).toBe("zaronia-rate");
    expect(tickForJan2?.provenance).toBe("production");
    expect(tickForJan2?.asOf).toBe("2026-01-02T17:00:00+02:00");
    expect(tickForJan2?.payload?.rate).toBe("0.0818");
    expect(tickForJan2?.payload?.convention).toBe("overnight-compounded");
    expect(tickForJan2?.payload?.fixingVariant).toBe(BUILD_PHASE_VARIANT_MARKER);
  });

  it("idempotency — second ingest returns ticksAppended=0, ticksSkippedAsDuplicate>0", () => {
    const marketDataStore = freshStore();
    const source = makeFixtureSarbZaroniaSource(TINY_FIXTURE);

    // First pass — full ingest.
    const first = runSarbZaroniaIngestAll({ source, marketDataStore });
    expect(first.reduce((a, r) => a + r.ticksAppended, 0)).toBe(5);
    expect(first.reduce((a, r) => a + r.ticksSkippedAsDuplicate, 0)).toBe(0);

    // Second pass — all duplicates.
    const second = runSarbZaroniaIngestAll({ source, marketDataStore });
    expect(second.reduce((a, r) => a + r.ticksAppended, 0)).toBe(0);
    expect(second.reduce((a, r) => a + r.ticksSkippedAsDuplicate, 0)).toBe(5);

    // Still only 5 ticks in the store.
    const ticks = marketDataStore.query({ source: "zaronia-sarb", instrument: "ZARONIA" });
    expect(ticks).toHaveLength(5);
  });

  it("allDates() returns dates sorted chronologically", () => {
    // Intentionally out-of-order fixture to verify sorting.
    const unorderedFixture: SarbZaroniaFixtureShape = {
      source: "SARB",
      instrument: "ZARONIA",
      refTime: "17:00:00+02:00",
      fixings: {
        "2026-03-10": "0.0818",
        "2026-01-05": "0.0817",
        "2026-02-12": "0.0819",
        "2026-01-02": "0.0818",
        "2026-02-03": "0.0817",
      },
    };

    const source = makeFixtureSarbZaroniaSource(unorderedFixture);
    const dates = source.allDates();

    expect(dates).toHaveLength(5);
    expect(dates[0]).toBe("2026-01-02");
    expect(dates[1]).toBe("2026-01-05");
    expect(dates[2]).toBe("2026-02-03");
    expect(dates[3]).toBe("2026-02-12");
    expect(dates[4]).toBe("2026-03-10");

    // Verify dates are in strictly ascending order.
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]! > dates[i - 1]!).toBe(true);
    }
  });

  it("deriveSarbZaroniaTickId produces deterministic ids", () => {
    expect(deriveSarbZaroniaTickId("2026-01-02")).toBe("SARB:ZARONIA:2026-01-02");
    expect(deriveSarbZaroniaTickId("2026-05-27")).toBe("SARB:ZARONIA:2026-05-27");
  });

  it("returns zero entries for a date not in the fixture", () => {
    const marketDataStore = freshStore();
    const source = makeFixtureSarbZaroniaSource(TINY_FIXTURE);

    // 2026-04-27 is Freedom Day — not in the tiny fixture.
    const result = runSarbZaroniaIngest({
      date: "2026-04-27",
      source,
      marketDataStore,
    });

    expect(result.entriesProcessed).toBe(0);
    expect(result.ticksAppended).toBe(0);
    expect(result.ticksSkippedAsDuplicate).toBe(0);
  });
});
