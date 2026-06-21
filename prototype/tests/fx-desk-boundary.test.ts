// tests/fx-desk-boundary.test.ts
//
// FRTB desk boundary integrity at the FX-trade schema level + simulator desk
// selection (D-FRTB-TRADING-DESK-STRUCTURE):
//
//   - the FxTradeExecuted refinement REJECTS a trading-book trade booked to the
//     banking-book Treasury Desk 1 (the negative test);
//   - it ACCEPTS a trading-book trade booked to Trading Desk 1;
//   - the FX simulator (generateSimTrade) defaults to Trading Desk 1;
//   - the simulator REJECTS a banking-book desk selection (the sim may only
//     book trading-book trades to trading-book desks).
//
// Authority: D-FRTB-TRADING-DESK-STRUCTURE; D-FX-BOOK-BOUNDARY.

import { describe, expect, it } from "bun:test";

import { fxTradeExecutedPayloadSchema } from "../platform/markets/cdm/fx";
import type { SimCounterparty } from "../platform/simulation/fx-sim-counterparties";
import { generateSimTrade } from "../platform/simulation/fx-sim-generator";
import { FxRateEngine } from "../platform/simulation/fx-sim-rates";

const TRADING_DESK = "urn:desk:trading-desk:trading-desk-1";
const TREASURY_DESK = "urn:desk:treasury-desk:treasury-desk-1";

const baseTradingPayload = {
  tradeId: { scheme: "internal", value: "T-1" },
  productTaxonomy: "FX-spot" as const,
  currencyPair: { base: "USD", quote: "ZAR" },
  side: "buy" as const,
  legs: [
    {
      legKind: "near" as const,
      payCurrency: "ZAR",
      receiveCurrency: "USD",
      notional: { currency: "ZAR", amountMinor: 1_900_000_000 },
      counterNotional: { currency: "USD", amountMinor: 100_000_000 },
      rate: { currency: "ZAR", amount: 19.0 },
      settlementDate: { iso: "2026-06-23", calendar: "JIHCAL" as const },
    },
  ],
  tradeDate: { iso: "2026-06-21", calendar: "JIHCAL" as const },
  counterparty: {
    partyId: "LEI-CP-1",
    name: "Test CP",
    role: "counterparty" as const,
    jurisdiction: "ZA",
  },
  venue: "OTC",
  trader: "trader-1",
  bookId: "BOOK-FX-MM",
  bookType: "trading" as const,
  settlementForm: "physical" as const,
  settlementPath: "correspondent" as const,
  clientFlowRef: "client-trade:test-1",
};

const TEST_COUNTERPARTIES: SimCounterparty[] = [
  {
    partyId: "urn:party:test:alpha-za",
    name: "Alpha Test Bank ZA",
    role: "counterparty",
    jurisdiction: "ZA",
    bic: "ALPTZAJJXXX",
    eligiblePairs: ["USD/ZAR"],
    minNotionalMinor: 100_000_00,
    maxNotionalMinor: 5_000_000_00,
  },
];

describe("FX trade FRTB desk boundary integrity (schema refinement)", () => {
  it("ACCEPTS a trading-book trade booked to Trading Desk 1", () => {
    expect(() =>
      fxTradeExecutedPayloadSchema.parse({ ...baseTradingPayload, deskId: TRADING_DESK }),
    ).not.toThrow();
  });

  it("REJECTS a trading-book trade booked to the banking-book Treasury Desk 1", () => {
    expect(() =>
      fxTradeExecutedPayloadSchema.parse({ ...baseTradingPayload, deskId: TREASURY_DESK }),
    ).toThrow(/boundary integrity/);
  });

  it("REJECTS a trade booked to an unregistered desk", () => {
    expect(() =>
      fxTradeExecutedPayloadSchema.parse({
        ...baseTradingPayload,
        deskId: "urn:desk:trading-desk:not-a-real-desk",
      }),
    ).toThrow(/does not resolve to a registered desk/);
  });

  it("REJECTS a trade with no deskId at all (required field)", () => {
    expect(() => fxTradeExecutedPayloadSchema.parse(baseTradingPayload)).toThrow();
  });
});

describe("FX simulator desk selection", () => {
  it("defaults the simulated trade to Trading Desk 1, and the payload round-trips", () => {
    const engine = new FxRateEngine();
    const payload = generateSimTrade(engine, TEST_COUNTERPARTIES, "BK-SIM", {
      rng: seededRng(1),
    });
    expect(payload.deskId).toBe(TRADING_DESK);
    expect(() => fxTradeExecutedPayloadSchema.parse(payload)).not.toThrow();
  });

  it("REJECTS a banking-book desk selection (sim books trading-book only)", () => {
    const engine = new FxRateEngine();
    expect(() =>
      generateSimTrade(engine, TEST_COUNTERPARTIES, "BK-SIM", {
        rng: seededRng(1),
        deskId: TREASURY_DESK as never,
      }),
    ).toThrow(/not a trading-book desk/);
  });
});

// Minimal deterministic RNG for the sim test.
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
