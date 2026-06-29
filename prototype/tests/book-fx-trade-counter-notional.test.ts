// tests/book-fx-trade-counter-notional.test.ts
//
// Regression test for the base/quote inversion bug in bookFxTrade, RE-EXPRESSED
// against the born-V2 booking spine (D-FX-E2E-CORRECTNESS-V1, Lane 1).
//
// Original bug (CEO-instructed fix 2026-05-31): the V1 counter-notional was
// always computed as notional × rate, but when the notional is in the QUOTE
// currency the correct counter is notional ÷ rate. The defect caused a ~400×
// overstatement (the MAN-1780136862743-A7951042 phantom −ZAR 113.85m loss).
//
// The V1 `FxTradeExecuted` booking path is now RETIRED — a manual booking emits a
// born-V2 `FilInstrumentCreated` carrying the SYMMETRIC BUY/SELL agreement quad
// (D-FX-INSTRUMENT-BUYSELL-QUAD). The SAME economic invariant the V1 test guarded
// — the counter leg amount is correct for the quoted notional currency — is now
// asserted on the quad: the bank BUYS one leg and SELLS the other, and the leg
// amounts must be the base notional and base × rate (the quote leg).

import { describe, expect, it } from "bun:test";
import type { FilInstrumentCreatedPayload } from "../../v2-core/fil-instances/events";
import { bookFxTrade } from "../dashboard/trade-book-view";
import { eventStore } from "../platform/composition";

const BASE_BODY = {
  tradeDate: "2026-06-02",
  settlementDate: "2026-06-04",
  counterpartyName: "Test Cpty",
  counterpartyLei: "TESTLEI",
  traderRef: "test",
  provenanceMode: "simulated" as const,
};

async function bookAndFetchQuad(body: Parameters<typeof bookFxTrade>[0]) {
  const result = await bookFxTrade(body);
  if (!result.ok) throw new Error(`booking failed: ${result.error}`);
  const events = [...eventStore.replay({ type: "FilInstrumentCreated" })];
  const ev = events.find((e) => {
    const p = e.payload as FilInstrumentCreatedPayload;
    return p.instance.endsWith(`:${result.tradeId}`);
  });
  if (!ev) throw new Error("FilInstrumentCreated event not found");
  const terms = (ev.payload as FilInstrumentCreatedPayload).economicTerms;
  if (!terms.fxAgreement) throw new Error("no fxAgreement quad on the FIL instance");
  return { terms, quad: terms.fxAgreement };
}

describe("bookFxTrade — born-V2 buy/sell quad direction", () => {
  it("buy EUR/ZAR with ZAR notional: bank buys EUR 50,000, sells ZAR 1,000,000", async () => {
    // EUR/ZAR rate 20. Pay ZAR 1,000,000 → receive EUR 50,000.
    const { quad } = await bookAndFetchQuad({
      ...BASE_BODY,
      currencyPair: { base: "EUR", quote: "ZAR" },
      side: "buy",
      notionalAmount: 1_000_000,
      notionalCurrency: "ZAR",
      rate: 20,
    });
    // buy side: bank receives the base (EUR), pays the quote (ZAR).
    expect(quad.buy.currency).toBe("EUR");
    expect(quad.buy.amount).toBe("50000");
    expect(quad.sell.currency).toBe("ZAR");
    expect(quad.sell.amount).toBe("1000000");
  });

  it("sell EUR/ZAR with EUR notional: bank sells EUR 50,000, buys ZAR 1,000,000", async () => {
    // EUR/ZAR rate 20. Pay EUR 50,000 → receive ZAR 1,000,000.
    const { quad } = await bookAndFetchQuad({
      ...BASE_BODY,
      currencyPair: { base: "EUR", quote: "ZAR" },
      side: "sell",
      notionalAmount: 50_000,
      notionalCurrency: "EUR",
      rate: 20,
    });
    // sell side: bank pays the base (EUR), receives the quote (ZAR).
    expect(quad.sell.currency).toBe("EUR");
    expect(quad.sell.amount).toBe("50000");
    expect(quad.buy.currency).toBe("ZAR");
    expect(quad.buy.amount).toBe("1000000");
  });

  it("buy USD/ZAR with ZAR (quote) notional: counter base leg is ZAR ÷ rate (USD)", async () => {
    // USD/ZAR rate 18.5. buy = pay ZAR, receive USD. Notional in ZAR (quote ccy).
    // Pay ZAR 185,000 → receive USD 10,000.
    const { quad } = await bookAndFetchQuad({
      ...BASE_BODY,
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      notionalAmount: 185_000,
      notionalCurrency: "ZAR",
      rate: 18.5,
    });
    // 185_000 ZAR ÷ 18.5 = 10_000 USD — the quote-currency-notional inversion the
    // original bug got wrong (it would have produced USD 3,422,500).
    expect(quad.buy.currency).toBe("USD");
    expect(quad.buy.amount).toBe("10000");
    expect(quad.sell.currency).toBe("ZAR");
    expect(quad.sell.amount).toBe("185000");
  });
});
