// platform/simulation/fx-sim-engine.test.ts
//
// Unit tests for the FX simulation engine components.
// Uses a mock event store — does NOT import the real store or composition root.
//
// Author: Devon (Chief Operating Officer, engineering)

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { SIM_COUNTERPARTIES } from "./fx-sim-counterparties";
import { generateSimTrade } from "./fx-sim-generator";
import { FxRateEngine } from "./fx-sim-rates";
import { FxSimEngine } from "./fx-sim-engine";

// ---------------------------------------------------------------------------
// Mock event store
// ---------------------------------------------------------------------------

function makeMockStore() {
  return {
    append: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// generateSimTrade tests
// ---------------------------------------------------------------------------

describe("generateSimTrade", () => {
  it("returns a valid payload — tradeId starts with SIM-", () => {
    const engine = new FxRateEngine();
    const payload = generateSimTrade(engine, SIM_COUNTERPARTIES, "BK-TEST");
    expect(payload.tradeId.value).toMatch(/^SIM-/);
  });

  it("legs has exactly 1 entry for FX-spot", () => {
    const engine = new FxRateEngine();
    const payload = generateSimTrade(engine, SIM_COUNTERPARTIES, "BK-TEST");
    expect(payload.legs).toHaveLength(1);
  });

  it("pair is in the selected counterparty's eligiblePairs", () => {
    const engine = new FxRateEngine();
    // Run multiple times to get a statistical sample
    for (let i = 0; i < 20; i++) {
      const payload = generateSimTrade(engine, SIM_COUNTERPARTIES, "BK-TEST");
      const tradeBase = payload.currencyPair.base;
      const tradeQuote = payload.currencyPair.quote;
      const pair = `${tradeBase}/${tradeQuote}`;
      const cp = SIM_COUNTERPARTIES.find((c) => c.name === payload.counterparty.name);
      expect(cp).toBeDefined();
      expect(cp?.eligiblePairs).toContain(pair);
    }
  });

  it("counterNotional ≈ notional × rate within 1%", () => {
    const engine = new FxRateEngine();
    const payload = generateSimTrade(engine, SIM_COUNTERPARTIES, "BK-TEST");
    const leg = payload.legs[0];
    expect(leg).toBeDefined();
    if (!leg) return;

    const actualRatio = leg.counterNotional.amountMinor / leg.notional.amountMinor;
    const expectedRatio = leg.rate.amount;

    // Within 1% tolerance (rounding in minor units)
    const relErr = Math.abs(actualRatio - expectedRatio) / expectedRatio;
    expect(relErr).toBeLessThanOrEqual(0.01);
  });

  it("productTaxonomy is FX-spot and settlementForm is physical", () => {
    const engine = new FxRateEngine();
    const payload = generateSimTrade(engine, SIM_COUNTERPARTIES, "BK-TEST");
    expect(payload.productTaxonomy).toBe("FX-spot");
    expect(payload.settlementForm).toBe("physical");
  });
});

// ---------------------------------------------------------------------------
// FxRateEngine tests
// ---------------------------------------------------------------------------

describe("FxRateEngine", () => {
  it("tick returns bid < mid < ask", () => {
    const engine = new FxRateEngine();
    const rate = engine.tick("ZAR/USD");
    expect(rate.bid).toBeLessThan(rate.mid);
    expect(rate.mid).toBeLessThan(rate.ask);
  });

  it("after 100 ticks rate stays within 20% of seed", () => {
    const engine = new FxRateEngine();
    const seed = engine.getMid("ZAR/USD");
    let rate = { mid: seed, bid: seed, ask: seed };
    for (let i = 0; i < 100; i++) {
      rate = engine.tick("ZAR/USD");
    }
    // 20% band around seed
    expect(rate.mid).toBeGreaterThan(seed * 0.8);
    expect(rate.mid).toBeLessThan(seed * 1.2);
  });
});

// ---------------------------------------------------------------------------
// FxSimEngine lifecycle tests
// ---------------------------------------------------------------------------

describe("FxSimEngine", () => {
  let store: ReturnType<typeof makeMockStore>;
  let engine: FxSimEngine;

  beforeEach(() => {
    store = makeMockStore();
    engine = new FxSimEngine(store);
    vi.useFakeTimers();
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
  });

  it("start sets running=true, stop sets running=false", () => {
    expect(engine.getStatus().running).toBe(false);
    engine.start();
    expect(engine.getStatus().running).toBe(true);
    engine.stop();
    expect(engine.getStatus().running).toBe(false);
  });

  it("calling start when already running returns current status without duplicate timer", async () => {
    const s1 = engine.start({ minIntervalMs: 10, maxIntervalMs: 20 });
    const s2 = engine.start({ minIntervalMs: 100, maxIntervalMs: 200 });
    // Second start should return same config (not overwritten)
    expect(s1.config.minIntervalMs).toBe(10);
    expect(s2.config.minIntervalMs).toBe(10);
    expect(s2.running).toBe(true);
  });

  it("calling stop when already stopped is a no-op", () => {
    expect(() => engine.stop()).not.toThrow();
    const s = engine.stop();
    expect(s.running).toBe(false);
  });

  it("after running for 200ms with minInterval=10 maxInterval=20, store.append was called at least once", async () => {
    engine.start({ minIntervalMs: 10, maxIntervalMs: 20 });
    // Advance time 200ms to allow at least several fires
    await vi.advanceTimersByTimeAsync(200);
    expect(store.append).toHaveBeenCalled();
  });

  it("append is called with type FxTradeExecuted", async () => {
    engine.start({ minIntervalMs: 10, maxIntervalMs: 20 });
    await vi.advanceTimersByTimeAsync(100);
    const calls = store.append.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstCall = calls[0]?.[0] as { type: string } | undefined;
    expect(firstCall?.type).toBe("FxTradeExecuted");
  });
});
