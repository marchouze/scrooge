// platform/simulation/bond-sim-prices.test.ts

import { describe, expect, it } from "bun:test";

import { MarketDataStore } from "../market-data/store";
import { MarketDataSources } from "../market-data/types";
import { BondPriceEngine, resolveSeedBondPrices } from "./bond-sim-prices";

const R186 = "ZAG000030108";

/** Deterministic LCG so the walk tests are reproducible. */
function lcg(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe("BondPriceEngine.tick", () => {
  it("returns bid < mid < ask and a positive yield", () => {
    const engine = new BondPriceEngine();
    const q = engine.tick(R186, () => 0.5);
    expect(q.bid).toBeLessThan(q.mid);
    expect(q.mid).toBeLessThan(q.ask);
    expect(q.yieldToMaturity).toBeGreaterThan(0);
  });

  it("stays close to the seed over many ticks (bounded walk)", () => {
    const engine = new BondPriceEngine();
    const seed = engine.getCleanPrice(R186);
    const rng = lcg(42);
    for (let i = 0; i < 300; i++) engine.tick(R186, rng);
    const drifted = engine.getCleanPrice(R186);
    expect(Math.abs(drifted - seed) / seed).toBeLessThan(0.25);
  });
});

describe("resolveSeedBondPrices", () => {
  it("seeds from the latest production jse-debt tick", () => {
    const store = new MarketDataStore(":memory:");
    store.append({
      id: `JSE:BOND:${R186}:2026-06-06`,
      source: MarketDataSources.JSE_DEBT,
      instrument: R186,
      dataType: "bond-price",
      provenance: "production",
      asOf: "2026-06-06T17:00:00+02:00",
      payload: {
        cleanPrice: "105.25",
        yieldToMaturity: "0.0750",
        bondCode: "R186",
        fixingVariant: "build-phase-fixture",
      },
    });
    const seeds = resolveSeedBondPrices(store);
    expect(seeds[R186]?.cleanPrice).toBeCloseTo(105.25);
    expect(seeds[R186]?.yield).toBeCloseTo(0.075);
  });

  it("never anchors on its own simulated (bond-sim) output", () => {
    const store = new MarketDataStore(":memory:");
    store.append({
      id: "sim-1",
      source: MarketDataSources.BOND_SIM,
      instrument: R186,
      dataType: "bond-price",
      provenance: "simulated",
      asOf: "2026-06-07T10:00:00Z",
      payload: {
        cleanPrice: "50.00",
        yieldToMaturity: "0.20",
        bondCode: "R186",
        fixingVariant: "simulated-walk",
      },
    });
    // No jse-debt tick → falls back to the reference seed (~101.5), not 50.0.
    const seeds = resolveSeedBondPrices(store);
    expect(seeds[R186]?.cleanPrice ?? 0).toBeGreaterThan(90);
  });
});

describe("BondPriceEngine.reseed", () => {
  it("re-anchors mids from production ticks", () => {
    const store = new MarketDataStore(":memory:");
    const engine = new BondPriceEngine();
    // Drift the walk first.
    const rng = lcg(7);
    for (let i = 0; i < 50; i++) engine.tick(R186, rng);
    store.append({
      id: `JSE:BOND:${R186}:2026-06-06`,
      source: MarketDataSources.JSE_DEBT,
      instrument: R186,
      dataType: "bond-price",
      provenance: "production",
      asOf: "2026-06-06T17:00:00+02:00",
      payload: {
        cleanPrice: "103.10",
        yieldToMaturity: "0.0790",
        bondCode: "R186",
        fixingVariant: "build-phase-fixture",
      },
    });
    engine.reseed(store);
    expect(engine.getCleanPrice(R186)).toBeCloseTo(103.1);
  });
});
