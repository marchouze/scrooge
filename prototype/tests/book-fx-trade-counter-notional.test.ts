// tests/book-fx-trade-counter-notional.test.ts
//
// Regression test for the base/quote inversion bug in bookFxTrade.
//
// Bug: counter-notional was always computed as notionalMinor × rate, but when
// the notional is in the quote currency (e.g. ZAR on a EUR/ZAR buy) the correct
// formula is notionalMinor / rate. The defect caused ~400× overstatement and
// produced the MAN-1780136862743-A7951042 phantom loss of −ZAR 113.85m.
//
// Authority: CEO-instructed fix 2026-05-31.

import { describe, expect, it } from "bun:test";
import { bookFxTrade } from "../dashboard/trade-book-view";
import { eventStore } from "../platform/composition";
import type { FxTradeExecutedPayload } from "../platform/markets/cdm/fx";

const BASE_BODY = {
  settlementDate: "2026-06-02",
  counterpartyName: "Test Cpty",
  counterpartyLei: "TESTLEI",
  traderRef: "test",
  provenanceMode: "simulated" as const,
};

async function bookAndFetch(body: Parameters<typeof bookFxTrade>[0]) {
  const result = await bookFxTrade(body);
  if (!result.ok) throw new Error(`booking failed: ${result.error}`);
  const events = eventStore.replay({ type: "FxTradeExecuted" });
  const ev = events.find((e) => {
    const p = e.payload as FxTradeExecutedPayload;
    const id = typeof p.tradeId === "string" ? p.tradeId : p.tradeId.value;
    return id === result.tradeId;
  });
  if (!ev) throw new Error("FxTradeExecuted event not found");
  const leg = (ev.payload as FxTradeExecutedPayload).legs[0];
  if (!leg) throw new Error("no leg on FxTradeExecuted event");
  return leg;
}

describe("bookFxTrade — counter-notional direction", () => {
  it("buy EUR/ZAR with ZAR notional: counter-notional is ZAR ÷ rate (EUR)", async () => {
    // EUR/ZAR rate 20. Pay ZAR 1,000,000 → receive EUR 50,000.
    const leg = await bookAndFetch({
      ...BASE_BODY,
      currencyPair: { base: "EUR", quote: "ZAR" },
      side: "buy",
      notionalAmount: 1, // 1 major unit = 1_000_000 minor
      notionalCurrency: "ZAR",
      rate: 20,
    });
    expect(leg.notional.currency).toBe("ZAR");
    expect(leg.notional.amountMinor).toBe(1_000_000);
    expect(leg.counterNotional.currency).toBe("EUR");
    // 1_000_000 / 20 = 50_000 EUR minor (NOT 20_000_000)
    expect(leg.counterNotional.amountMinor).toBe(50_000);
  });

  it("sell EUR/ZAR with EUR notional: counter-notional is EUR × rate (ZAR)", async () => {
    // EUR/ZAR rate 20. Pay EUR 50,000 → receive ZAR 1,000,000.
    const leg = await bookAndFetch({
      ...BASE_BODY,
      currencyPair: { base: "EUR", quote: "ZAR" },
      side: "sell",
      notionalAmount: 0.05, // 0.05 major EUR = 50_000 minor
      notionalCurrency: "EUR",
      rate: 20,
    });
    expect(leg.notional.currency).toBe("EUR");
    expect(leg.notional.amountMinor).toBe(50_000);
    expect(leg.counterNotional.currency).toBe("ZAR");
    expect(leg.counterNotional.amountMinor).toBe(1_000_000);
  });

  it("buy USD/ZAR with ZAR (quote) notional: counter-notional is ZAR ÷ rate (USD)", async () => {
    // USD/ZAR rate 18.5. buy = pay ZAR, receive USD. Notional in ZAR (pay/quote ccy).
    // Pay ZAR 185,000 minor → receive USD 10,000 minor.
    const leg = await bookAndFetch({
      ...BASE_BODY,
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      notionalAmount: 0.185, // 0.185 major ZAR = 185_000 minor
      notionalCurrency: "ZAR",
      rate: 18.5,
    });
    expect(leg.notional.currency).toBe("ZAR");
    expect(leg.notional.amountMinor).toBe(185_000);
    expect(leg.counterNotional.currency).toBe("USD");
    // 185_000 / 18.5 = 10_000 USD minor
    expect(leg.counterNotional.amountMinor).toBe(10_000);
  });
});
