// platform/simulation-v2/sim-modules/fx-generative-engine-v2.test.ts
//
// Determinism + shape tests for the V2-native generative engine (Slice 1):
// FxRateWalkV2 (bounded random walk) + generateScenarioTrade (trade generator).
//
// The binding property is REPLAY-SAFETY: the same seed reproduces the same path
// and the same trades on every run. The shape property is that a generated trade
// is a well-formed born-V2 ScenarioTradeAction the existing modules can book.

import { describe, expect, test } from "bun:test";

import { SeededRng } from "../prng";
import type { ScenarioCounterparty } from "../scenario-manifest";
import { FxRateWalkV2, STANDARD_SIM_PAIRS } from "./fx-rate-walk-v2";
import { generateScenarioTrade } from "./fx-trade-generator-v2";

const SEED = 0x5eed;
const ASOF = "2026-02-02T07:00:00.000Z";

const CPS: readonly ScenarioCounterparty[] = [
  {
    counterpartyId: "CP-SIM-RELIABLE-001",
    name: "Sim Reliable Bank",
    bic: "SIMRZAJJXXX",
    eligiblePairs: ["USD/ZAR"],
    behaviourProfile: "reliable",
  },
  {
    counterpartyId: "CP-SIM-OCCFAIL-002",
    name: "Sim Occasional-Fail Bank",
    bic: "SIMOZAJJXXX",
    eligiblePairs: ["USD/ZAR", "EUR/ZAR"],
    behaviourProfile: "occasional-fail",
  },
];

describe("FxRateWalkV2", () => {
  test("bid < mid < ask and the mid stays within a bounded band of the seed", () => {
    const walk = new FxRateWalkV2();
    const rng = new SeededRng(SEED);
    let mid = 0;
    for (let i = 0; i < 200; i++) {
      const r = walk.tick("USD/ZAR", rng);
      expect(r.bid).toBeLessThan(r.mid);
      expect(r.mid).toBeLessThan(r.ask);
      mid = r.mid;
    }
    // 200 ticks of ±~20bps bounded walk stay well within ±20% of the 18.50 seed.
    expect(mid).toBeGreaterThan(18.5 * 0.8);
    expect(mid).toBeLessThan(18.5 * 1.2);
  });

  test("same seed → identical walk; different seed → different walk", () => {
    const path = (seed: number): number[] => {
      const walk = new FxRateWalkV2();
      const rng = new SeededRng(seed);
      return Array.from({ length: 20 }, () => walk.tick("USD/ZAR", rng).mid);
    };
    expect(path(SEED)).toEqual(path(SEED));
    expect(path(SEED)).not.toEqual(path(SEED + 1));
  });

  test("ZAR pairs carry a wider half-spread than EUR/USD", () => {
    const walk = new FxRateWalkV2();
    const zar = walk.tick("USD/ZAR", new SeededRng(SEED));
    const eurusd = walk.tick("EUR/USD", new SeededRng(SEED));
    const zarSpreadBps = ((zar.ask - zar.bid) / zar.mid) * 10_000;
    const eurusdSpreadBps = ((eurusd.ask - eurusd.bid) / eurusd.mid) * 10_000;
    expect(zarSpreadBps).toBeGreaterThan(eurusdSpreadBps);
  });

  test("standard sim pairs are all major-first and known to the seed table", () => {
    const walk = new FxRateWalkV2();
    for (const pair of STANDARD_SIM_PAIRS) {
      // A known pair resolves to a finite positive mid without falling back to 1.
      expect(walk.getMid(pair)).toBeGreaterThan(0);
      expect(walk.getMid(pair)).not.toBe(1);
    }
  });
});

describe("generateScenarioTrade", () => {
  test("same seed → byte-identical trade", () => {
    const make = () =>
      generateScenarioTrade({
        rng: new SeededRng(SEED),
        asOf: ASOF,
        seq: 1,
        counterparties: CPS,
        rateWalk: new FxRateWalkV2(),
      });
    expect(make()).toEqual(make());
  });

  test("the generated trade is a well-formed born-V2 FX-spot action", () => {
    const trade = generateScenarioTrade({
      rng: new SeededRng(SEED),
      asOf: ASOF,
      seq: 7,
      counterparties: CPS,
      rateWalk: new FxRateWalkV2(),
    });
    expect(trade).not.toBeNull();
    if (!trade) return;
    expect(trade.productTaxonomy).toBe("FX-spot");
    expect(trade.tradeId).toBe("FXSPOT-20260202T070000000Z-7");
    // Counterparty + pair are drawn from the eligible set.
    const cp = CPS.find((c) => c.counterpartyId === trade.counterpartyId);
    expect(cp).toBeDefined();
    expect(cp?.eligiblePairs).toContain(trade.pair);
    // Notional is lot-aligned within the default [1m, 10m] band.
    expect(trade.baseNotionalMajor % 100_000).toBe(0);
    expect(trade.baseNotionalMajor).toBeGreaterThanOrEqual(1_000_000);
    expect(trade.baseNotionalMajor).toBeLessThanOrEqual(10_000_000);
    // T+2 calendar settlement.
    expect(trade.settlementDate).toBe("2026-02-04");
    // Rate is a positive 5-dp number.
    expect(trade.rate).toBeGreaterThan(0);
    expect(Math.round(trade.rate * 100_000) / 100_000).toBe(trade.rate);
  });

  test("forcedSide overrides the random side (risk-aware generation parity)", () => {
    const buy = generateScenarioTrade({
      rng: new SeededRng(SEED),
      asOf: ASOF,
      seq: 1,
      counterparties: CPS,
      rateWalk: new FxRateWalkV2(),
      forcedSide: "buy",
    });
    expect(buy?.side).toBe("buy");
  });

  test("no eligible counterparty → null (fail-closed)", () => {
    expect(
      generateScenarioTrade({
        rng: new SeededRng(SEED),
        asOf: ASOF,
        seq: 1,
        counterparties: [],
        rateWalk: new FxRateWalkV2(),
      }),
    ).toBeNull();
  });
});
