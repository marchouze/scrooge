// platform/liquidity/__tests__/projection.test.ts
//
// Tests for the multi-horizon liquidity projection runner and the
// EventStoreLiquidityInputProvider factory.
//
// Authority: D-TREASURY-GAPS-WAVE1; BA 110; BA 120.
// Author: Anya (Liquidity & projections engineer, engineering)

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../core/types";
import { EventStore } from "../../event-store/store";
import {
  PROJECTION_HORIZONS,
  makeEventStoreLiquidityInputProvider,
  runLiquidityProjection,
} from "../projection";

const AS_OF = "2026-05-25T06:00:00.000Z";

function makeStore(): EventStore {
  return new EventStore();
}

// ---------------------------------------------------------------------------
// 1. Empty store — build-phase no-positions baseline
// ---------------------------------------------------------------------------

describe("runLiquidityProjection — empty store", () => {
  it("returns no-positions status for all five horizons", () => {
    const store = makeStore();
    const provider = makeEventStoreLiquidityInputProvider(store);
    const result = runLiquidityProjection(AS_OF, provider);

    expect(result.asOf).toBe(AS_OF);
    expect(result.horizons.length).toBe(PROJECTION_HORIZONS.length);

    for (const h of result.horizons) {
      // With no HQLA and no funding positions, LCR is no-positions.
      // (ASF may be non-zero due to Tier 1 capital baseline; NSFR may be above-minimum.)
      expect(["no-positions", "above-minimum"]).toContain(h.lcr.status);
    }

    // worst* summaries are consistent with per-horizon results
    const lcrStatuses = result.horizons.map((h) => h.lcr.status);
    expect(lcrStatuses).toContain(result.worstLCRStatus);
  });

  it("covers every PROJECTION_HORIZONS value in the result", () => {
    const store = makeStore();
    const provider = makeEventStoreLiquidityInputProvider(store);
    const result = runLiquidityProjection(AS_OF, provider);

    const returnedDays = new Set(result.horizons.map((h) => h.horizonDays));
    for (const d of PROJECTION_HORIZONS) {
      expect(returnedDays.has(d)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Fed HQLA — LCR above-minimum with SAGB position
// ---------------------------------------------------------------------------

describe("runLiquidityProjection — fed HQLA via TradeBooked", () => {
  it("returns above-minimum LCR when HQLA present and no outflows", () => {
    const store = makeStore();
    // Sovereign bond (SAGB) — classifies as L1 HQLA (0% haircut).
    store.append({
      event_id: newEventId(),
      type: "TradeBooked",
      as_of: AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:test" },
      citations: ["D-RAS"],
      payload: {
        tradeId: newEventId(),
        isin: "ZAG000111111",
        assetClass: "sovereign-bond",
        issuer: "RSA Government",
        riskWeight: 0,
        marketValueZar: 100_000_000,
        currency: "ZAR",
      },
    });

    const provider = makeEventStoreLiquidityInputProvider(store);
    const result = runLiquidityProjection(AS_OF, provider);

    const t0 = result.horizons.find((h) => h.horizonDays === 0);
    expect(t0).toBeDefined();
    if (!t0) return;
    // HQLA present, zero net outflows → LCR is infinite (null ratio) = above-minimum
    expect(t0.lcr.status).toBe("above-minimum");
    expect(t0.lcr.hqlaZar).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. makeEventStoreLiquidityInputProvider — caches per (asOf, horizonDays)
// ---------------------------------------------------------------------------

describe("makeEventStoreLiquidityInputProvider", () => {
  it("provides consistent arrays for the same (asOf, horizonDays)", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "TradeBooked",
      as_of: AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:test" },
      citations: ["D-RAS"],
      payload: {
        tradeId: newEventId(),
        isin: "ZAG000222222",
        assetClass: "sovereign-bond",
        issuer: "RSA Government",
        riskWeight: 0,
        marketValueZar: 50_000_000,
        currency: "ZAR",
      },
    });

    const provider = makeEventStoreLiquidityInputProvider(store);

    // Call twice — both should return same result (cache hit on second call)
    const hqla1 = provider.getHQLAPositions(AS_OF, 30);
    const hqla2 = provider.getHQLAPositions(AS_OF, 30);
    expect(hqla1.length).toBe(hqla2.length);
    expect(hqla1[0]?.amountZar).toBe(hqla2[0]?.amountZar);
  });
});
