// scenarios/08-equity-trade.test.ts
//
// End-to-end test for the equity trade scenario (scenario 08).
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION, IFRS-9-§4.1, STRATE-RULE-7, JSE-EQUITIES-RULES

import { describe, expect, it } from "bun:test";

import { EventStore } from "@platform/event-store/store";
import { makeEquitySettlementConfirmed, makeEquityTradeBooked } from "@platform/markets/cdm/equity";
import {
  type EquityRateSource,
  runEodEquityRevaluation,
} from "@platform/markets/eod/equity-revaluation";
import {
  SCENARIO_ID,
  buildEquityTradeScenarioEvents,
  runEquityTradeScenario,
} from "./08-equity-trade";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AS_OF = "2026-05-17";
const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "test:equity-revaluation" };
const CITATIONS = ["D-MARKETS-SCHEMA-FOUNDATION"];
const NPN_ISIN = "ZAE000015889";

function makeInstrument(isin: string) {
  return {
    identifier: { scheme: "ISIN", value: isin },
    class: "listed-equity" as const,
    venue: "JSE",
    currency: "ZAR",
  };
}

/** In-memory price source for tests — avoids filesystem access. */
function makeTestPriceSource(prices: Record<string, number>): EquityRateSource {
  return {
    getClosingPriceZAR(isin: string, date: string): number {
      const price = prices[isin];
      if (price === undefined) {
        throw new Error(
          `Test price source: no closing price for ISIN "${isin}" on date "${date}". ` +
            `Available: ${Object.keys(prices).join(", ")}`,
        );
      }
      return price;
    },
  };
}

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

/** Append one EquityTradeBooked (buy side). */
function appendEquityTrade(
  store: EventStore,
  tradeId: string,
  isin: string,
  quantity: number,
  priceZAR: number,
): void {
  const totalMinor = Math.round(quantity * priceZAR * 100);
  store.append(
    makeEquityTradeBooked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "INTERNAL", value: tradeId },
        instrument: makeInstrument(isin),
        side: "buy",
        quantity: { unit: "share", amount: quantity },
        price: { currency: "ZAR", amount: priceZAR },
        consideration: { currency: "ZAR", amountMinor: totalMinor },
        tradeDate: { iso: AS_OF, calendar: "JIHCAL" },
        settlementDate: { iso: "2026-05-20", calendar: "JIHCAL" },
        counterparty: {
          partyId: "CP-TEST",
          name: "Test Counterparty",
          role: "counterparty",
          jurisdiction: "ZA",
        },
        venue: "JSE",
        trader: "kai@bank.local",
        bookId: "BOOK-EQ-TRADING",
      },
    }),
  );
}

/** Append one EquitySettlementConfirmed for the given ISIN. */
function appendEquitySettlement(store: EventStore, isin: string): void {
  store.append(
    makeEquitySettlementConfirmed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "INTERNAL", value: "TRD-001" },
        settlementDate: { iso: "2026-05-20", calendar: "JIHCAL" },
        securitiesLeg: {
          direction: "receive",
          quantity: { unit: "share", amount: 1000 },
          instrument: makeInstrument(isin),
        },
        cashLeg: {
          direction: "pay",
          amount: { currency: "ZAR", amountMinor: 1_000_000_00 },
        },
        confirmedAt: "2026-05-20T10:30:00.000Z",
        strateRef: "STRATE-TEST-001",
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Scenario integration tests
// ---------------------------------------------------------------------------

describe("scenario 08 — equity trade lifecycle", () => {
  it("runEquityTradeScenario completes with ok=true and correct event count", () => {
    const result = runEquityTradeScenario({
      dbPath: ":memory:",
      cleanup: false,
    });

    expect(result.ok).toBe(true);
    expect(result.emitted).toBe(5); // TradeExecuted + TradeBooked + SettlementInstructed + SettlementConfirmed + PositionRevalued
    expect(result.ticker).toBe("NPN");
  });

  it("all events carry the correct scenario provenance tag", () => {
    const events = buildEquityTradeScenarioEvents();
    for (const e of events.all) {
      expect(e.provenance?.kind).toBe("simulated");
      expect((e.provenance as { scenario: string })?.scenario).toBe(SCENARIO_ID);
    }
  });

  it("scenario emits all 5 expected event types", () => {
    const events = buildEquityTradeScenarioEvents();
    const types = new Set(events.all.map((e) => e.type));
    expect(types.has("EquityTradeExecuted")).toBe(true);
    expect(types.has("EquityTradeBooked")).toBe(true);
    expect(types.has("EquitySettlementInstructed")).toBe(true);
    expect(types.has("EquitySettlementConfirmed")).toBe(true);
    expect(types.has("EquityPositionRevalued")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EOD equity revaluation tests
// ---------------------------------------------------------------------------

describe("runEodEquityRevaluation — open position revalued correctly", () => {
  it("emits EquityPositionRevalued with correct P&L when price moves up", () => {
    const store = makeStore();
    // Buy 1000 shares at R100 = R100,000 total
    appendEquityTrade(store, "TRD-001", NPN_ISIN, 1000, 100.0);

    // Close at R110 = R110,000 → unrealised P&L = R10,000
    const priceSource = makeTestPriceSource({ [NPN_ISIN]: 110.0 });
    const result = runEodEquityRevaluation(store, AS_OF, priceSource);

    expect(result.revalued).toBe(1);
    expect(result.skipped).toBe(0);

    let payload:
      | { unrealisedPnl: { amountMinor: number }; marketValue: { amountMinor: number } }
      | undefined;
    for (const e of store.replay({ type: "EquityPositionRevalued" })) {
      payload = e.payload as typeof payload;
    }
    // Market value: 1000 × 110 × 100 = 11,000,000 cents
    expect(payload?.marketValue.amountMinor).toBe(11_000_000);
    // Unrealised P&L: 11,000,000 − 10,000,000 = 1,000,000 cents = R10,000
    expect(payload?.unrealisedPnl.amountMinor).toBe(1_000_000);
  });

  it("emits negative unrealised P&L when price falls", () => {
    const store = makeStore();
    appendEquityTrade(store, "TRD-002", NPN_ISIN, 1000, 100.0);

    // Close at R90 → loss of R10,000
    const priceSource = makeTestPriceSource({ [NPN_ISIN]: 90.0 });
    const result = runEodEquityRevaluation(store, AS_OF, priceSource);

    expect(result.revalued).toBe(1);
    let payload: { unrealisedPnl: { amountMinor: number } } | undefined;
    for (const e of store.replay({ type: "EquityPositionRevalued" })) {
      payload = e.payload as typeof payload;
    }
    expect(payload?.unrealisedPnl.amountMinor).toBe(-1_000_000); // −R10,000
  });
});

describe("runEodEquityRevaluation — idempotency", () => {
  it("already-revalued position is skipped on second run", () => {
    const store = makeStore();
    appendEquityTrade(store, "TRD-IDEM", NPN_ISIN, 1000, 100.0);

    const priceSource = makeTestPriceSource({ [NPN_ISIN]: 110.0 });

    const first = runEodEquityRevaluation(store, AS_OF, priceSource);
    expect(first.revalued).toBe(1);
    expect(first.skipped).toBe(0);

    const second = runEodEquityRevaluation(store, AS_OF, priceSource);
    expect(second.revalued).toBe(0);
    expect(second.skipped).toBe(1);

    // Only one EquityPositionRevalued in store
    let count = 0;
    for (const e of store.replay({ type: "EquityPositionRevalued" })) {
      void e;
      count++;
    }
    expect(count).toBe(1);
  });
});

describe("runEodEquityRevaluation — settlement confirmed removes from open book", () => {
  it("settled position is not revalued", () => {
    const store = makeStore();
    appendEquityTrade(store, "TRD-SETTLED", NPN_ISIN, 1000, 100.0);
    appendEquitySettlement(store, NPN_ISIN);

    const priceSource = makeTestPriceSource({ [NPN_ISIN]: 110.0 });
    const result = runEodEquityRevaluation(store, AS_OF, priceSource);

    expect(result.revalued).toBe(0);
    expect(result.skipped).toBe(0);

    let count = 0;
    for (const e of store.replay({ type: "EquityPositionRevalued" })) {
      void e;
      count++;
    }
    expect(count).toBe(0);
  });
});

describe("runEodEquityRevaluation — missing closing price throws", () => {
  it("throws a meaningful error when ISIN has no price", () => {
    const store = makeStore();
    appendEquityTrade(store, "TRD-NOPRICE", NPN_ISIN, 1000, 100.0);

    const priceSource = makeTestPriceSource({}); // no prices at all
    expect(() => runEodEquityRevaluation(store, AS_OF, priceSource)).toThrow(/no closing price/i);
  });
});

describe("runEodEquityRevaluation — previously-emitted EquityPositionRevalued is idempotent across date changes", () => {
  it("revalues again on a new date", () => {
    const store = makeStore();
    appendEquityTrade(store, "TRD-NEWDATE", NPN_ISIN, 1000, 100.0);

    const priceSource = makeTestPriceSource({ [NPN_ISIN]: 110.0 });

    const day1 = runEodEquityRevaluation(store, "2026-05-17", priceSource);
    const day2 = runEodEquityRevaluation(store, "2026-05-18", priceSource);

    expect(day1.revalued).toBe(1);
    expect(day2.revalued).toBe(1); // different date → new revaluation

    let count = 0;
    for (const e of store.replay({ type: "EquityPositionRevalued" })) {
      void e;
      count++;
    }
    expect(count).toBe(2);
  });
});
