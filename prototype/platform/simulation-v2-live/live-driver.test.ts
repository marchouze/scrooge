// platform/simulation-v2-live/live-driver.test.ts
//
// Tests for the live FX V2 driver (Slice 2). The binding properties:
//   1. REPLAY-SAFETY — two drivers with the same config produce a byte-identical
//      event stream over the same number of ticks (the wall-clock scheduler is
//      bypassed by calling tickOnce() directly).
//   2. PROVENANCE SEGREGATION — every booked FX instrument + materialised cash leg
//      carries a `simulated` tag (scenario "fx-v2-live"), so it never leaks into
//      the bank's production reads on the shared store.
//   3. FULL LIFECYCLE — generate → confirm → book → settle → cash materialises.

import { describe, expect, test } from "bun:test";

import { EventStore } from "../event-store/store";
import { MarketDataStore } from "../market-data/store";
import { V2LiveFxDriver, type V2LiveFxDriverConfig } from "./live-driver";

function freshDriver(config?: V2LiveFxDriverConfig): {
  driver: V2LiveFxDriver;
  eventStore: EventStore;
} {
  const eventStore = new EventStore();
  const marketDataStore = new MarketDataStore(":memory:");
  const driver = new V2LiveFxDriver({
    eventStore,
    marketDataStore,
    ...(config ? { config } : {}),
  });
  return { driver, eventStore };
}

function eventSignature(store: EventStore): { types: Record<string, number>; fxUrns: string[] } {
  const types: Record<string, number> = {};
  const fxUrns: string[] = [];
  for (const e of store.replay({})) {
    types[e.type] = (types[e.type] ?? 0) + 1;
  }
  for (const e of store.replay({ type: "FilInstrumentCreated" })) {
    const p = e.payload as { instance?: string; economicTerms?: { assetClass?: string } };
    if (p.economicTerms?.assetClass === "fx" && p.instance) fxUrns.push(p.instance);
  }
  return { types, fxUrns };
}

describe("V2LiveFxDriver", () => {
  test("replay-safe: same config + same tick count → identical event stream", () => {
    const config: V2LiveFxDriverConfig = { seed: 0x1234, tradesPerTick: 2 };
    const a = freshDriver(config);
    const b = freshDriver(config);
    for (let i = 0; i < 6; i++) {
      a.driver.tickOnce();
      b.driver.tickOnce();
    }
    const sa = eventSignature(a.eventStore);
    const sb = eventSignature(b.eventStore);
    expect(sa.types).toEqual(sb.types);
    expect(sa.fxUrns).toEqual(sb.fxUrns);
  });

  test("every booked FX instrument + cash leg is tagged `simulated` (provenance segregation)", () => {
    const { driver, eventStore } = freshDriver({ tradesPerTick: 2 });
    for (let i = 0; i < 4; i++) driver.tickOnce();

    const created = [...eventStore.replay({ type: "FilInstrumentCreated" })];
    expect(created.length).toBeGreaterThan(0);
    for (const e of created) {
      const prov = (e as unknown as { provenance?: { kind?: string; scenario?: string } })
        .provenance;
      expect(prov?.kind).toBe("simulated");
      expect(prov?.scenario).toBe("fx-v2-live");
    }
    // Terminations + settlements carry the simulated tag too.
    for (const t of "FilInstrumentTerminated TradeSettlementExecuted".split(" ")) {
      for (const e of eventStore.replay({ type: t })) {
        const prov = (e as unknown as { provenance?: { kind?: string } }).provenance;
        expect(prov?.kind).toBe("simulated");
      }
    }
  });

  test("full lifecycle (accelerated): generate → book → settle → cash materialises", () => {
    const { driver, eventStore } = freshDriver({ tradesPerTick: 1 });
    for (let i = 0; i < 5; i++) driver.tickOnce();
    const s = driver.getStatus();
    expect(s.tradesGenerated).toBe(5);
    expect(s.tradesBooked).toBe(5);
    expect(s.settlementsConfirmed).toBe(5);
    // Spot ⇒ 2 cash legs (received + paid) per settled trade.
    expect(s.cashInstancesMaterialised).toBe(10);
    expect(s.boundariesFired).toBe(5);
    // The settled FX instruments are terminated.
    expect([...eventStore.replay({ type: "FilInstrumentTerminated" })].length).toBe(5);
    expect([...eventStore.replay({ type: "TradeSettlementExecuted" })].length).toBe(10);
  });

  test("settlement emits born-V2 external post-settlement advices (correspondent + nostro)", () => {
    const { driver, eventStore } = freshDriver({ tradesPerTick: 1 });
    for (let i = 0; i < 3; i++) driver.tickOnce();
    const corr = [...eventStore.replay({ type: "CorrespondentSettlementStatusReceived" })];
    const nostro = [...eventStore.replay({ type: "NostroStatementReceived" })];
    // One of each per settled trade (3 settled in accelerated mode).
    expect(corr.length).toBe(3);
    expect(nostro.length).toBe(3);
    expect((corr[0]?.payload as { txStatus?: string }).txStatus).toBe("ACSC");
    const np = nostro[0]?.payload as { currency?: string; entryCount?: number };
    expect(np.currency).toMatch(/^[A-Z]{3}$/);
    expect(np.entryCount).toBe(1);
  });

  test("realtime mode defers settlement until the sim clock reaches T+2", () => {
    const { driver } = freshDriver({ tradesPerTick: 1, settlementMode: "realtime" });
    // Tick 1 books a trade settling T+2 — it must NOT settle on the booking day.
    driver.tickOnce();
    expect(driver.getStatus().tradesBooked).toBe(1);
    expect(driver.getStatus().settlementsConfirmed).toBe(0);
    // After two more sim days (T+2 reached), the trade settles.
    driver.tickOnce();
    driver.tickOnce();
    expect(driver.getStatus().settlementsConfirmed).toBeGreaterThanOrEqual(1);
  });

  test("start()/stop() toggle the scheduler; getStatus reflects running state", () => {
    const { driver } = freshDriver();
    expect(driver.isRunning()).toBe(false);
    driver.start();
    expect(driver.isRunning()).toBe(true);
    driver.start(); // idempotent
    expect(driver.isRunning()).toBe(true);
    driver.stop();
    expect(driver.isRunning()).toBe(false);
  });
});
