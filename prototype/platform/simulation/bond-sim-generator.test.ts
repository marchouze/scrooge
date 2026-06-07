// platform/simulation/bond-sim-generator.test.ts

import { describe, expect, it } from "bun:test";

import { MarketDataStore } from "../market-data/store";
import { MarketDataSources } from "../market-data/types";
import type { BondSimCounterparty } from "./bond-sim-counterparties";
import { generateSimBondTrade } from "./bond-sim-generator";
import { BondPriceEngine } from "./bond-sim-prices";

const R186 = "ZAG000030108";
const R2040 = "ZAG000074989";

const CP: BondSimCounterparty[] = [
  {
    partyId: "urn:party:legal-entity:a",
    name: "Bank A",
    role: "counterparty",
    jurisdiction: "ZA",
    bic: "AAAAZAJJXXX",
    lei: "LEI-A",
    eligibleIsins: [R186, "ZAG000057547", R2040],
  },
];

describe("generateSimBondTrade", () => {
  it("returns a valid book body", () => {
    const body = generateSimBondTrade(new BondPriceEngine(), CP, { rng: () => 0.5 });
    expect(body.tradeId).toMatch(/^BSIM-/);
    expect(Number.isInteger(body.nominalMinor)).toBe(true);
    expect(body.nominalMinor).toBeGreaterThan(0);
    expect(body.cleanPricePct).toBeGreaterThan(0);
    expect(body.accruedInterestMinor).toBeGreaterThanOrEqual(0);
    expect(["trading-book", "banking-book"]).toContain(body.portfolio);
    expect(body.counterpartyLei).toBe("LEI-A");
    expect(body.provenanceMode).toBe("simulated");
    expect(body.actor?.id).toBe("agent:env:bond-sim-engine");
  });

  it("honours a forced side", () => {
    const e = new BondPriceEngine();
    expect(generateSimBondTrade(e, CP, { rng: () => 0.9, forcedSide: "buy" }).side).toBe("buy");
    expect(generateSimBondTrade(e, CP, { rng: () => 0.1, forcedSide: "sell" }).side).toBe("sell");
  });

  it("restricts the bond to the eligibleIsinsFilter", () => {
    const body = generateSimBondTrade(new BondPriceEngine(), CP, {
      rng: () => 0.5,
      eligibleIsinsFilter: [R2040],
    });
    expect(body.isin).toBe(R2040);
  });

  it("prices off the latest bond-price tick", () => {
    const store = new MarketDataStore(":memory:");
    store.append({
      id: "t1",
      source: MarketDataSources.BOND_SIM,
      instrument: R186,
      dataType: "bond-price",
      provenance: "simulated",
      asOf: "2026-06-07T10:00:00Z",
      payload: {
        cleanPrice: "110.00",
        yieldToMaturity: "0.07",
        bondCode: "R186",
        fixingVariant: "simulated-walk",
      },
    });
    const body = generateSimBondTrade(new BondPriceEngine(), CP, {
      rng: () => 0.5,
      marketDataStore: store,
      eligibleIsinsFilter: [R186],
      forcedSide: "buy",
    });
    expect(body.isin).toBe(R186);
    // Execution price ≈ 110 plus a small crossing spread + slip.
    expect(body.cleanPricePct).toBeGreaterThan(109);
    expect(body.cleanPricePct).toBeLessThan(111);
  });
});
