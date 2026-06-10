// tests/sa-ccr-positions-to-summaries.test.ts
//
// buildFxSaCcrTradeSummaries — maps live FX trades to SA-CCR TradeSummary rows
// grouped by ZAR netting set (D-FX-OTC-NPA-SCOPE-EXPANSION). Driver end-to-end
// (emit CcrEadComputed → CreditRWA) is verified via the register + run scripts.
//
// Author: Rohan (counterparty-risk engineer) — Scrooge-coordinated session.

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { makeFxTradeExecuted, makeSettlementConfirmed } from "../platform/markets/cdm/fx";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import { buildFxSaCcrTradeSummaries } from "../platform/risk/sa-ccr/positions-to-summaries";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:test" };
const CITES = ["D-FX-OTC-NPA-SCOPE-EXPANSION"];
const AS_OF = "2026-06-11T17:00:00.000Z";

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

function appendFx(
  store: EventStore,
  opts: {
    tradeId: string;
    cp: string;
    base: string;
    quote: string;
    side: "buy" | "sell";
    payCcy: string;
    recvCcy: string;
    payMinor: number;
    recvMinor: number;
    settle?: string;
  },
): void {
  store.append(
    makeFxTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: {
        tradeId: { scheme: "INTERNAL", value: opts.tradeId },
        productTaxonomy: "FX-spot",
        currencyPair: { base: opts.base, quote: opts.quote },
        side: opts.side,
        legs: [
          {
            legKind: "near",
            payCurrency: opts.payCcy,
            receiveCurrency: opts.recvCcy,
            notional: { currency: opts.payCcy, amountMinor: opts.payMinor },
            counterNotional: { currency: opts.recvCcy, amountMinor: opts.recvMinor },
            rate: { currency: opts.quote, amount: 18 },
            settlementDate: { iso: opts.settle ?? "2026-06-13", calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: "2026-06-11", calendar: "JIHCAL" },
        counterparty: { partyId: opts.cp, name: opts.cp, role: "counterparty", jurisdiction: "ZA" },
        venue: "OTC",
        trader: "trader:test",
        bookId: "FX-BOOK",
        bookType: "trading",
        settlementForm: "physical",
        settlementPath: "correspondent",
        clientFlowRef: `cf:${opts.tradeId}`,
      },
    }),
  );
}

describe("buildFxSaCcrTradeSummaries", () => {
  it("maps a live ZAR-leg FX trade to an fx TradeSummary in NS-<cp>-ZAR", () => {
    const store = new EventStore(":memory:");
    // buy USD/ZAR: pay ZAR (notional), receive USD
    appendFx(store, {
      tradeId: "T1",
      cp: "CP-A",
      base: "USD",
      quote: "ZAR",
      side: "buy",
      payCcy: "ZAR",
      recvCcy: "USD",
      payMinor: 18_000_000,
      recvMinor: 1_000_000,
    });
    const groups = buildFxSaCcrTradeSummaries(store, AS_OF);
    const grp = groups.get("NS-CP-A-ZAR");
    expect(grp).toBeDefined();
    expect(grp?.currency).toBe("ZAR");
    const t = grp?.trades[0];
    expect(t?.assetClass).toBe("fx");
    expect(t?.direction).toBe("long");
    expect(t?.hedgingSetTag).toBe("USD/ZAR");
    expect(Number(t?.notional.amount)).toBe(18_000_000);
    store.close();
  });

  it("uses the ZAR counter-notional when the pay leg is the foreign ccy (sell side → short)", () => {
    const store = new EventStore(":memory:");
    // sell USD/ZAR: pay USD, receive ZAR (counterNotional in ZAR)
    appendFx(store, {
      tradeId: "T2",
      cp: "CP-B",
      base: "USD",
      quote: "ZAR",
      side: "sell",
      payCcy: "USD",
      recvCcy: "ZAR",
      payMinor: 1_000_000,
      recvMinor: 18_000_000,
    });
    const t = buildFxSaCcrTradeSummaries(store, AS_OF).get("NS-CP-B-ZAR")?.trades[0];
    expect(Number(t?.notional.amount)).toBe(18_000_000);
    expect(t?.direction).toBe("short");
    store.close();
  });

  it("skips a cross pair with no ZAR leg (EUR/USD)", () => {
    const store = new EventStore(":memory:");
    appendFx(store, {
      tradeId: "T3",
      cp: "CP-C",
      base: "EUR",
      quote: "USD",
      side: "buy",
      payCcy: "USD",
      recvCcy: "EUR",
      payMinor: 1_100_000,
      recvMinor: 1_000_000,
    });
    expect(buildFxSaCcrTradeSummaries(store, AS_OF).size).toBe(0);
    store.close();
  });

  it("excludes a settled trade", () => {
    const store = new EventStore(":memory:");
    appendFx(store, {
      tradeId: "T4",
      cp: "CP-D",
      base: "USD",
      quote: "ZAR",
      side: "buy",
      payCcy: "ZAR",
      recvCcy: "USD",
      payMinor: 18_000_000,
      recvMinor: 1_000_000,
    });
    store.append(
      makeSettlementConfirmed({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          tradeId: "T4",
          currencyPair: "USD/ZAR",
          settledDate: AS_OF.slice(0, 10),
          realisedPnlDelta: 0,
          settlementRef: "stl:T4",
          citations: CITES,
        },
      }),
    );
    expect(buildFxSaCcrTradeSummaries(store, AS_OF).size).toBe(0);
    store.close();
  });

  it("groups multiple trades to the same counterparty netting set", () => {
    const store = new EventStore(":memory:");
    appendFx(store, {
      tradeId: "T5",
      cp: "CP-E",
      base: "USD",
      quote: "ZAR",
      side: "buy",
      payCcy: "ZAR",
      recvCcy: "USD",
      payMinor: 18_000_000,
      recvMinor: 1_000_000,
    });
    appendFx(store, {
      tradeId: "T6",
      cp: "CP-E",
      base: "GBP",
      quote: "ZAR",
      side: "buy",
      payCcy: "ZAR",
      recvCcy: "GBP",
      payMinor: 23_000_000,
      recvMinor: 1_000_000,
    });
    expect(buildFxSaCcrTradeSummaries(store, AS_OF).get("NS-CP-E-ZAR")?.trades).toHaveLength(2);
    store.close();
  });
});
