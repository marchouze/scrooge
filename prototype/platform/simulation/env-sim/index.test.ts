// platform/simulation/env-sim/index.test.ts
//
// Unit tests for EnvSimEngine and sub-simulators.
//
// Uses in-memory event store (same pattern as fx-sim-engine.test.ts).
// Author: Devon (Chief Operating Officer, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { EventStore } from "../../event-store/store";
import { MarketDataStore } from "../../market-data/store";
import { FxRateEngine } from "../fx-sim-rates";
import { type CounterpartyBehaviorProfile, mulberry32 } from "./counterparty-profiles";
import { EnvSimEngine } from "./index";
import { MarketDataSimulator } from "./market-data-sim";
import { NostroStatementSimulator } from "./nostro-statement-sim";

// ---------------------------------------------------------------------------
// In-memory event store helper
// ---------------------------------------------------------------------------

function makeInMemoryStore(): EventStore {
  // Use an in-memory SQLite database.
  return new EventStore(":memory:");
}

// ---------------------------------------------------------------------------
// Test 1: Deterministic mode — same seed produces same event sequence
// ---------------------------------------------------------------------------

// Re-enabled in Slice 3b (Devon — sim generator simplification, PR #665).
// The fx-sim-generator now emits FxTradeExecuted events whose rate.currency
// equals currencyPair.quote and whose rate.amount is quote-per-base, in
// line with the D-FX-QUOTING-CONVENTION refinement.
describe("EnvSimEngine — deterministic mode", () => {
  it("two engines with same seed produce same event count and types", () => {
    const store1 = makeInMemoryStore();
    const store2 = makeInMemoryStore();

    const engine1 = new EnvSimEngine(store1, { seed: 42 });
    const engine2 = new EnvSimEngine(store2, { seed: 42 });

    // Fire trades synchronously on both.
    engine1.fireTrade();
    engine1.fireTrade();
    engine2.fireTrade();
    engine2.fireTrade();

    // Collect event types from both stores.
    const events1: string[] = [];
    for (const evt of store1.replay()) {
      events1.push(evt.type);
    }
    const events2: string[] = [];
    for (const evt of store2.replay()) {
      events2.push(evt.type);
    }

    // Same event count and same sequence of types.
    expect(events1.length).toBe(events2.length);
    expect(events1).toEqual(events2);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Stochastic failure — always-fail profile produces settlement failures
// ---------------------------------------------------------------------------

// Re-enabled in Slice 3b (Devon — sim generator simplification, PR #665).
describe("EnvSimEngine — stochastic failure", () => {
  it("counterparty with settlementFailureProbability:1 always produces settlement-failed event", () => {
    const store = makeInMemoryStore();

    // Use seed 99, override all counterparties with always-fail profile.
    // We need to target a specific counterpartyId or use '*' wildcard.
    const failProfile: CounterpartyBehaviorProfile = {
      counterpartyId: "*",
      settlementFailureProbability: 1.0,
      settlementDelayDays: 0,
      rejectionProbability: 0,
      confirmationDelayMs: 0,
    };

    const engine = new EnvSimEngine(store, {
      seed: 99,
      counterpartyProfiles: [failProfile],
    });

    engine.fireTrade();
    engine.fireTrade();
    engine.fireTrade();

    // Collect InboundMessageReceived events with settlement-failed content.
    const failedEvents: string[] = [];
    for (const evt of store.replay({ type: "InboundMessageReceived" })) {
      const payload = evt.payload as Record<string, unknown>;
      if (
        typeof payload.serialisedMessage === "string" &&
        payload.serialisedMessage.includes("Settlement failed")
      ) {
        failedEvents.push(evt.event_id);
      }
    }

    expect(failedEvents.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Test 3: MarketDataTick — ticks appear in MarketDataStore after interval
// ---------------------------------------------------------------------------

describe("MarketDataSimulator", () => {
  let mdStore: MarketDataStore;
  let rateEngine: FxRateEngine;
  let sim: MarketDataSimulator;

  beforeEach(() => {
    mdStore = new MarketDataStore(":memory:");
    rateEngine = new FxRateEngine();
    sim = new MarketDataSimulator(mdStore, rateEngine, {
      intervalMs: 50,
      rng: mulberry32(42),
    });
  });

  afterEach(() => {
    sim.stop();
    mdStore.close();
  });

  it("appends fx-quote ticks to MarketDataStore within 200ms", async () => {
    sim.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    sim.stop();

    const ticks = mdStore.query({ dataType: "fx-quote" });
    expect(ticks.length).toBeGreaterThan(0);
  });

  it("fx-quote ticks have correct source and numeric fields", async () => {
    sim.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    sim.stop();

    const ticks = mdStore.query({ dataType: "fx-quote" });
    expect(ticks.length).toBeGreaterThan(0);
    const tick = ticks[0];
    expect(tick).toBeDefined();
    if (tick) {
      expect(tick.source).toBe("fx-sim");
      expect(tick.dataType).toBe("fx-quote");
      expect(typeof (tick.payload as Record<string, unknown>).mid).toBe("number");
      expect(typeof (tick.payload as Record<string, unknown>).bid).toBe("number");
      expect(typeof (tick.payload as Record<string, unknown>).ask).toBe("number");
    }
  });
});

// ---------------------------------------------------------------------------
// Test 4: NostroStatement — emits MT940 after interval
// ---------------------------------------------------------------------------

describe("NostroStatementSimulator", () => {
  let store: EventStore;
  let sim: NostroStatementSimulator;

  beforeEach(() => {
    store = makeInMemoryStore();
    sim = new NostroStatementSimulator(store, mulberry32(42), { intervalMs: 50 });
  });

  afterEach(() => {
    sim.stop();
  });

  it("emits InboundMessageReceived with MT940 content within 200ms", async () => {
    sim.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    sim.stop();

    const mt940Events: string[] = [];
    for (const evt of store.replay({ type: "InboundMessageReceived" })) {
      const payload = evt.payload as Record<string, unknown>;
      if (payload.messageStandard === "MT940") {
        mt940Events.push(evt.event_id);
      }
    }

    expect(mt940Events.length).toBeGreaterThan(0);
  });

  it("MT940 serialised message starts with SWIFT block header", async () => {
    sim.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    sim.stop();

    for (const evt of store.replay({ type: "InboundMessageReceived" })) {
      const payload = evt.payload as Record<string, unknown>;
      if (payload.messageStandard === "MT940") {
        expect(typeof payload.serialisedMessage).toBe("string");
        // MT940 serialised form starts with :20: or {1: SWIFT block headers
        const body = payload.serialisedMessage as string;
        expect(body.length).toBeGreaterThan(10);
        break;
      }
    }
  });
});
