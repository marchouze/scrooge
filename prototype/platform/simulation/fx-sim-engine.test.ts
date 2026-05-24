// platform/simulation/fx-sim-engine.test.ts
//
// Unit tests for the FX simulation engine components.
// Uses a mock event store — does NOT import the real store or composition root.
//
// Author: Devon (Chief Operating Officer, engineering)

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const vi = { fn: mock, spyOn, useFakeTimers: () => {}, useRealTimers: () => {} };

import type { EventStore } from "../event-store/store";
import { fxTradeExecutedPayloadSchema } from "../markets/cdm/fx";
import { SIM_COUNTERPARTIES } from "./fx-sim-counterparties";
import { FxSimEngine } from "./fx-sim-engine";
import { generateSimTrade } from "./fx-sim-generator";
import { FxRateEngine } from "./fx-sim-rates";

// ---------------------------------------------------------------------------
// Mock event store
// ---------------------------------------------------------------------------

function makeMockStore() {
  const mockStore = {
    append: vi.fn(),
    replay: () => [] as unknown[],
  };
  return mockStore as unknown as EventStore & { append: ReturnType<typeof mock> };
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

  it("counterNotional is consistent with rate (quote-per-base) by side within 1%", () => {
    const engine = new FxRateEngine();
    const payload = generateSimTrade(engine, SIM_COUNTERPARTIES, "BK-TEST");
    const leg = payload.legs[0];
    expect(leg).toBeDefined();
    if (!leg) return;

    // Per D-FX-QUOTING-CONVENTION:
    //   rate.amount = quote-per-base.
    //   BUY  → pay=quote, receive=base → counter (base) = notional (quote) / rate.
    //   SELL → pay=base, receive=quote → counter (quote) = notional (base) × rate.
    const expectedRatio = payload.side === "buy" ? 1 / leg.rate.amount : leg.rate.amount;
    const actualRatio = leg.counterNotional.amountMinor / leg.notional.amountMinor;
    const relErr = Math.abs(actualRatio - expectedRatio) / expectedRatio;
    expect(relErr).toBeLessThanOrEqual(0.01);
  });

  it("productTaxonomy is FX-spot and settlementForm is physical", () => {
    const engine = new FxRateEngine();
    const payload = generateSimTrade(engine, SIM_COUNTERPARTIES, "BK-TEST");
    expect(payload.productTaxonomy).toBe("FX-spot");
    expect(payload.settlementForm).toBe("physical");
  });

  // D-FX-QUOTING-CONVENTION Slice 3b regression — generated payloads must
  // parse cleanly under the Slice-1 Zod refinement (rate is quote-per-base;
  // rate.currency = currencyPair.quote; pay/receive coherent with side).
  it("generated payload satisfies the D-FX-QUOTING-CONVENTION Zod refinement (50 samples)", () => {
    const engine = new FxRateEngine();
    for (let i = 0; i < 50; i++) {
      const payload = generateSimTrade(engine, SIM_COUNTERPARTIES, "BK-TEST");
      const parsed = fxTradeExecutedPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        // Surface the first failure with full detail for debugging.
        throw new Error(
          `Sample ${i} failed refinement: ${JSON.stringify(parsed.error.format(), null, 2)} for payload: ${JSON.stringify(payload, null, 2)}`,
        );
      }
      expect(parsed.success).toBe(true);
    }
  });

  // Synthesised BUY against a USD/ZAR-only counterparty — explicit assertion
  // of the rate.currency = quote / counter-derivation contract.
  it("BUY trade on USD/ZAR: rate.currency = ZAR, rate.amount ≈ mid, counter ≈ notional / mid", () => {
    const engine = new FxRateEngine();
    const usdZarOnly = SIM_COUNTERPARTIES.filter((cp) =>
      cp.eligiblePairs.every((p) => p === "USD/ZAR"),
    );
    // If no USD/ZAR-only counterparty, fall back to one whose first pair is USD/ZAR.
    const cps =
      usdZarOnly.length > 0
        ? usdZarOnly
        : SIM_COUNTERPARTIES.filter((cp) => cp.eligiblePairs.includes("USD/ZAR"));
    expect(cps.length).toBeGreaterThan(0);

    // Force BUY by retrying generation until we get one (Math.random sampled).
    let payload = generateSimTrade(engine, cps, "BK-TEST");
    let attempts = 0;
    while (
      (payload.side !== "buy" ||
        `${payload.currencyPair.base}/${payload.currencyPair.quote}` !== "USD/ZAR") &&
      attempts < 200
    ) {
      payload = generateSimTrade(engine, cps, "BK-TEST");
      attempts++;
    }
    expect(payload.side).toBe("buy");
    expect(payload.currencyPair.base).toBe("USD");
    expect(payload.currencyPair.quote).toBe("ZAR");

    const leg = payload.legs[0];
    expect(leg).toBeDefined();
    if (!leg) return;

    // Per Slice 3b: rate.currency = quote = ZAR; rate.amount = quote-per-base = mid.
    expect(leg.rate.currency).toBe("ZAR");
    // For BUY: payCurrency = quote = ZAR; receiveCurrency = base = USD.
    expect(leg.payCurrency).toBe("ZAR");
    expect(leg.receiveCurrency).toBe("USD");
    expect(leg.notional.currency).toBe("ZAR");
    expect(leg.counterNotional.currency).toBe("USD");

    // counter (USD-minor) = notional (ZAR-minor) / mid.
    const ratio = leg.notional.amountMinor / leg.counterNotional.amountMinor;
    const expected = leg.rate.amount;
    const relErr = Math.abs(ratio - expected) / expected;
    expect(relErr).toBeLessThanOrEqual(0.01);

    // And the payload re-parses cleanly under the refinement.
    const parsed = fxTradeExecutedPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
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
    // Use real timers for this test — fake timer async advance not available in Bun.
    vi.useRealTimers();
    engine.start({ minIntervalMs: 10, maxIntervalMs: 20 });
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
    expect(store.append).toHaveBeenCalled();
  });

  it("append is called with type FxTradeExecuted", async () => {
    // Use real timers for this test.
    vi.useRealTimers();
    engine.start({ minIntervalMs: 10, maxIntervalMs: 20 });
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    const calls = store.append.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstCall = calls[0]?.[0] as { type: string } | undefined;
    expect(firstCall?.type).toBe("FxTradeExecuted");
  });
});
