// platform/simulation/fx-sim-rates.test.ts
//
// Tests for resolveSeedMidRates — the engine now seeds each pair's starting mid
// from the most recent production market-data tick, falling back to the
// hardcoded approximations only when none exists.

import { describe, expect, it } from "bun:test";

import { MarketDataStore } from "../market-data/store";
import { MarketDataSources } from "../market-data/types";
import { FxRateEngine, resolveSeedMidRates } from "./fx-sim-rates";

function store(): MarketDataStore {
  return new MarketDataStore(":memory:");
}

function appendQuote(
  md: MarketDataStore,
  pair: string,
  mid: number,
  provenance: "production" | "simulated",
  source: string,
): void {
  md.append({
    id: `${pair}-${source}-${mid}`,
    source,
    instrument: pair,
    dataType: "fx-quote",
    provenance,
    asOf: "2026-06-03T00:00:00.000Z",
    payload: { pair, mid, bid: mid, ask: mid, source },
  });
}

describe("resolveSeedMidRates", () => {
  it("falls back to the hardcoded approximations with no store", () => {
    expect(resolveSeedMidRates()["USD/ZAR"]).toBe(18.5);
  });

  it("falls back when the store has no production tick for a pair", () => {
    expect(resolveSeedMidRates(store())["USD/ZAR"]).toBe(18.5);
  });

  it("seeds a pair from its most recent production tick", () => {
    const md = store();
    appendQuote(md, "USD/ZAR", 16.29, "production", MarketDataSources.ZARONIA_SARB);
    expect(resolveSeedMidRates(md)["USD/ZAR"]).toBeCloseTo(16.29, 6);
    // Untouched pairs keep the fallback.
    expect(resolveSeedMidRates(md)["EUR/GBP"]).toBe(1.15);
  });

  it("ignores simulated fx-sim ticks — never seeds the walk off its own output", () => {
    const md = store();
    appendQuote(md, "USD/ZAR", 99.0, "simulated", MarketDataSources.FX_SIM);
    expect(resolveSeedMidRates(md)["USD/ZAR"]).toBe(18.5); // fallback, not 99.0
  });

  it("the engine starts at the resolved (production) mid", () => {
    const md = store();
    appendQuote(md, "USD/ZAR", 17.42, "production", MarketDataSources.ZARONIA_SARB);
    const engine = new FxRateEngine(resolveSeedMidRates(md));
    expect(engine.getMid("USD/ZAR")).toBeCloseTo(17.42, 6);
  });
});
