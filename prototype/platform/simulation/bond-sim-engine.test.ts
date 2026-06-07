// platform/simulation/bond-sim-engine.test.ts
//
// Uses a mock event store (does NOT import the real store) — mirrors the FX
// fx-sim-engine.test.ts convention so no permission-gate carve-out is needed.

import { describe, expect, it } from "bun:test";

import type { EventStore } from "../event-store/store";
import { MarketDataStore } from "../market-data/store";
import { MarketDataSources } from "../market-data/types";
import type { BondTradeBookBody } from "../markets/cdm/bond-book";
import type { BondSimCounterparty } from "./bond-sim-counterparties";
import { BondSimEngine } from "./bond-sim-engine";

const R186 = "ZAG000030108";

const CP: BondSimCounterparty[] = [
  {
    partyId: "urn:party:legal-entity:a",
    name: "Bank A",
    role: "counterparty",
    jurisdiction: "ZA",
    bic: "AAAAZAJJXXX",
    lei: "LEI-A",
    eligibleIsins: [R186],
  },
];

function bondEvent(
  isin: string,
  side: "buy" | "sell",
  nominalMinor: number,
): Record<string, unknown> {
  return {
    type: "BondTradeExecuted",
    entity: "LE-ZA-HOZ-BANK",
    payload: {
      tradeId: "T",
      bondIsin: isin,
      side,
      nominalMinor,
      cleanPricePercent: 101,
      accruedInterestMinor: 0,
      dirtyPricePercent: 101,
      settlementDate: "2026-06-10",
      portfolio: "trading-book",
      couponRate: 0.105,
      maturityDate: "2026-12-21",
      currency: "ZAR",
      counterpartyLei: "LEI-A",
      executedAt: "2026-06-07T10:00:00Z",
    },
  };
}

function mockStore(events: Record<string, unknown>[]): EventStore {
  return {
    append: () => {},
    replay: () => events,
  } as unknown as EventStore;
}

// R1m face value cap, in ZAR minor units.
const CAP = 1_000_000 * 100;

describe("BondSimEngine position guard", () => {
  it("is green with no positions", () => {
    const engine = new BondSimEngine(mockStore([]), { positionCapZarMinor: CAP });
    const g = engine.computeBondPositionDirection();
    expect(g.ragStatus).toBe("green");
    expect(g.mode).toBe("normal");
    expect(g.forcedSide).toBeUndefined();
  });

  it("forces SELL on a long position over the cap (red)", () => {
    // Long 50× cap → red.
    const engine = new BondSimEngine(mockStore([bondEvent(R186, "buy", CAP * 50)]), {
      seed: 7,
      positionCapZarMinor: CAP,
    });
    let forced = 0;
    let sells = 0;
    for (let i = 0; i < 50; i++) {
      const g = engine.computeBondPositionDirection();
      expect(g.ragStatus).toBe("red");
      expect(g.dominantIsin).toBe(R186);
      if (g.forcedSide) {
        forced++;
        if (g.forcedSide === "sell") sells++;
      }
    }
    expect(forced).toBeGreaterThan(0);
    expect(sells).toBe(forced); // every forced trade reduces the long → sell
  });

  it("forces BUY on a short position over the cap", () => {
    const engine = new BondSimEngine(mockStore([bondEvent(R186, "sell", CAP * 50)]), {
      seed: 3,
      positionCapZarMinor: CAP,
    });
    let forced = 0;
    let buys = 0;
    for (let i = 0; i < 50; i++) {
      const g = engine.computeBondPositionDirection();
      if (g.forcedSide) {
        forced++;
        if (g.forcedSide === "buy") buys++;
      }
    }
    expect(forced).toBeGreaterThan(0);
    expect(buys).toBe(forced);
  });
});

describe("BondSimEngine.fireTrade", () => {
  it("books through the executeBondTrade hook honouring the forced side", () => {
    const mdStore = new MarketDataStore(":memory:");
    mdStore.append({
      id: "t",
      source: MarketDataSources.BOND_SIM,
      instrument: R186,
      dataType: "bond-price",
      provenance: "simulated",
      asOf: "2026-06-07T10:00:00Z",
      payload: {
        cleanPrice: "101.50",
        yieldToMaturity: "0.08",
        bondCode: "R186",
        fixingVariant: "simulated-walk",
      },
    });
    const booked: BondTradeBookBody[] = [];
    const engine = new BondSimEngine(mockStore([]), {
      seed: 1,
      marketDataStore: mdStore,
      getCounterparties: () => CP,
      executeBondTrade: (body) => {
        booked.push(body);
      },
    });

    engine.fireTrade({ forcedSide: "sell", eligibleIsinsFilter: [R186] });

    expect(booked).toHaveLength(1);
    expect(booked[0]?.side).toBe("sell");
    expect(booked[0]?.isin).toBe(R186);
    expect(engine.getStatus().tradesGenerated).toBe(1);
  });

  it("skips gracefully when no counterparties are available", () => {
    const engine = new BondSimEngine(mockStore([]), {
      getCounterparties: () => [],
      executeBondTrade: () => {
        throw new Error("should not be called");
      },
    });
    expect(() => engine.fireTrade()).not.toThrow();
    expect(engine.getStatus().tradesGenerated).toBe(0);
  });
});
