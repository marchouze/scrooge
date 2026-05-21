// platform/markets/eod/fx-revaluation.test.ts
//
// Tests for the EOD FX position revaluation automation trigger.
//
// Coverage:
//   - TC-1: Sunny-day: one open position, rate available → FxPositionRevalued emitted
//   - TC-2: Idempotency: already revalued today → skipped
//   - TC-3: No open positions → revalued=0
//   - TC-4: Missing rate → throws clear error
//   - TC-5: Settled position excluded from revaluation
//   - TC-6: Multiple open positions — all revalued
//
// Authority: IAS-21-§28, IFRS-9-§5.7.1, D-MARKETS-CAPITAL-TIME-SHAPE

import { describe, expect, it } from "bun:test";

import { makeTradeMatured } from "../../event-store/event-types/trade-matured";
import { EventStore } from "../../event-store/store";
import { makeFxTradeExecuted } from "../cdm/fx";
import { type FxRateSource, runEodFxRevaluation } from "./fx-revaluation";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const AS_OF = "2026-05-16";
const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "test:fx-revaluation" };
const CITATIONS = ["D-MARKETS-SCHEMA-FOUNDATION", "IAS-21-§28"];

/** In-memory rate source for tests — avoids filesystem access. */
function makeTestRateSource(rates: Record<string, Record<string, number>>): FxRateSource {
  return {
    getRate(currencyPair: string, date: string): number {
      const pairRates = rates[currencyPair];
      if (!pairRates) throw new Error(`No rates for pair ${currencyPair}`);
      const rate = pairRates[date];
      if (rate === undefined) throw new Error(`No rate for ${currencyPair} on ${date}`);
      return rate;
    },
  };
}

/**
 * Append one FxTradeExecuted in canonical Option A form
 * (D-FX-QUOTING-CONVENTION):
 *   - pair USD/ZAR (canonical major-first per ACI Model Code §2)
 *   - side="sell" → bank pays USD (base), receives ZAR (quote)
 *   - rate.currency = ZAR (quote) and rate.amount is quote-per-base
 *   - notional in pay currency (USD)
 * The economic intent (bank holds a long-USD/short-ZAR position on the
 * back of receiving ZAR) is preserved; only the canonical-direction
 * framing changes.
 */
function appendFxTrade(store: EventStore, tradeId: string, bookRateAmount = 18.5): void {
  store.append(
    makeFxTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "internal", value: tradeId },
        productTaxonomy: "FX-spot",
        currencyPair: { base: "USD", quote: "ZAR" },
        side: "sell",
        legs: [
          {
            legKind: "near",
            payCurrency: "USD",
            receiveCurrency: "ZAR",
            // notional in pay currency (USD); 100_000_000 USD cents = USD 1m.
            notional: { currency: "USD", amountMinor: 100_000_000 },
            counterNotional: {
              currency: "ZAR",
              amountMinor: Math.round(100_000_000 * bookRateAmount),
            },
            rate: { currency: "ZAR", amount: bookRateAmount },
            settlementDate: { iso: AS_OF, calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: AS_OF, calendar: "JIHCAL" },
        counterparty: { partyId: "CP-ACME", name: "ACME Bank", role: "counterparty" },
        venue: "OTC",
        trader: "TRADER-001",
        bookType: "trading",
        bookId: "BOOK-FX-001",
        settlementForm: "physical" as const,
        settlementPath: "correspondent" as const,
        clientFlowRef: "client-trade:test-fx-reval",
      },
    }),
  );
}

/** Append one TradeMatured (FX-spot variant) for the given tradeId. */
function appendSettlementConfirmed(store: EventStore, tradeId: string): void {
  store.append(
    makeTradeMatured({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId,
        maturedAt: new Date().toISOString(),
        product: {
          productKind: "FX-spot",
          currencyPair: "USD/ZAR",
          legKind: "near",
          settledBaseCurrencyMinor: 1_000_000_00,
          settledQuoteCurrencyMinor: 54054,
          nostroAccountBase: "ACC-1001-001",
          nostroAccountQuote: "ACC-1001-002",
          realisedPnlZarMinor: 0,
        },
      },
    }),
  );
}

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

// ---------------------------------------------------------------------------
// TC-1: Sunny-day — one open position, rate available
// ---------------------------------------------------------------------------

describe("TC-1: sunny-day — one open position, rate available", () => {
  it("emits FxPositionRevalued and returns revalued=1", () => {
    const store = makeStore();
    appendFxTrade(store, "TRD-001", 18.5);

    // Rate is 18.6 on the valuation date.
    const rateSource = makeTestRateSource({ "USD/ZAR": { [AS_OF]: 18_600_000 } });

    const result = runEodFxRevaluation(store, AS_OF, rateSource);

    expect(result.revalued).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.asOf).toBe(AS_OF);

    // Verify an FxPositionRevalued event was appended.
    let revalCount = 0;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      void e;
      revalCount++;
    }
    expect(revalCount).toBe(1);
  });

  it("FxPositionRevalued payload has correct tradeId and P&L direction", () => {
    const store = makeStore();
    appendFxTrade(store, "TRD-002", 18.5);

    // Rate moved up → positive P&L (gain) if notional × (newRate - bookRate) > 0.
    const rateSource = makeTestRateSource({ "USD/ZAR": { [AS_OF]: 18_600_000 } });

    runEodFxRevaluation(store, AS_OF, rateSource);

    let payload: { tradeId: string; unrealisedPnlZarMinor: number } | undefined;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      payload = e.payload as { tradeId: string; unrealisedPnlZarMinor: number };
    }
    expect(payload?.tradeId).toBe("TRD-002");
    // (18.6 - 18.5) × 1M ZAR minor = 0.1 × 100_000_000 = 10_000_000
    expect(payload?.unrealisedPnlZarMinor).toBe(10_000_000);
  });
});

// ---------------------------------------------------------------------------
// TC-2: Idempotency — already revalued today → skip
// ---------------------------------------------------------------------------

describe("TC-2: idempotency — position already revalued today", () => {
  it("skips the position and returns skipped=1", () => {
    const store = makeStore();
    appendFxTrade(store, "TRD-IDEM", 18.5);

    const rateSource = makeTestRateSource({ "USD/ZAR": { [AS_OF]: 18_600_000 } });

    // First run — should revalue.
    const result1 = runEodFxRevaluation(store, AS_OF, rateSource);
    expect(result1.revalued).toBe(1);

    // Second run same day — should skip.
    const result2 = runEodFxRevaluation(store, AS_OF, rateSource);
    expect(result2.revalued).toBe(0);
    expect(result2.skipped).toBe(1);

    // Only one FxPositionRevalued event in store.
    let count = 0;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      void e;
      count++;
    }
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-3: No open positions → empty result
// ---------------------------------------------------------------------------

describe("TC-3: no open positions", () => {
  it("returns revalued=0, skipped=0 when no FxTradeExecuted events", () => {
    const store = makeStore();
    const rateSource = makeTestRateSource({ "USD/ZAR": { [AS_OF]: 18_600_000 } });

    const result = runEodFxRevaluation(store, AS_OF, rateSource);

    expect(result.revalued).toBe(0);
    expect(result.skipped).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TC-4: Missing rate — throws with clear error
// ---------------------------------------------------------------------------

describe("TC-4: missing rate — throws", () => {
  it("throws an informative error when the rate is not available", () => {
    const store = makeStore();
    appendFxTrade(store, "TRD-NORATE", 18.5);

    // Rate source has no data for the valuation date.
    const rateSource = makeTestRateSource({ "USD/ZAR": {} });

    expect(() => runEodFxRevaluation(store, AS_OF, rateSource)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-5: Settled position excluded
// ---------------------------------------------------------------------------

describe("TC-5: settled position excluded from revaluation", () => {
  it("skips positions with a matching TradeMatured (FX-spot)", () => {
    const store = makeStore();
    appendFxTrade(store, "TRD-SETTLED", 18.5);
    appendSettlementConfirmed(store, "TRD-SETTLED");

    const rateSource = makeTestRateSource({ "USD/ZAR": { [AS_OF]: 18_600_000 } });

    const result = runEodFxRevaluation(store, AS_OF, rateSource);

    expect(result.revalued).toBe(0);
    expect(result.skipped).toBe(0);

    // No FxPositionRevalued emitted.
    let count = 0;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      void e;
      count++;
    }
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TC-6: Multiple open positions — all revalued
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TC-7: FX Forward positions are revalued via the same EOD cycle as spot
// (forwards reuse FxTradeExecuted; the runner is product-agnostic).
// ---------------------------------------------------------------------------

/** Append one FX-forward FxTradeExecuted (USD/ZAR, T+90 settlement). */
function appendFxForwardTrade(
  store: EventStore,
  tradeId: string,
  bookRateAmount = 18.7,
  forwardSettleDate = "2026-08-12",
): void {
  store.append(
    makeFxTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "internal", value: tradeId },
        productTaxonomy: "FX-forward",
        currencyPair: { base: "USD", quote: "ZAR" },
        side: "sell",
        legs: [
          {
            legKind: "near",
            payCurrency: "USD",
            receiveCurrency: "ZAR",
            notional: { currency: "USD", amountMinor: 100_000_000 },
            counterNotional: {
              currency: "ZAR",
              amountMinor: Math.round(100_000_000 * bookRateAmount),
            },
            rate: { currency: "ZAR", amount: bookRateAmount },
            settlementDate: { iso: forwardSettleDate, calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: AS_OF, calendar: "JIHCAL" },
        counterparty: { partyId: "CP-FWD", name: "FWD Counterparty", role: "counterparty" },
        venue: "OTC",
        trader: "TRADER-FWD",
        bookType: "trading",
        bookId: "BOOK-FX-FWD-001",
        settlementForm: "physical" as const,
        settlementPath: "correspondent" as const,
        clientFlowRef: "client-trade:test-fwd",
      },
    }),
  );
}

describe("TC-7: FX Forward positions enter the EOD revaluation cycle", () => {
  it("revalues an open forward exactly like a spot (mid-life MtM)", () => {
    const store = makeStore();
    // Book a 3-month forward at 18.7; mid-life rate moves to 18.85.
    appendFxForwardTrade(store, "TRD-FWD-MID", 18.7);

    const rateSource = makeTestRateSource({ "USD/ZAR": { [AS_OF]: 18_850_000 } });
    const result = runEodFxRevaluation(store, AS_OF, rateSource);

    expect(result.revalued).toBe(1);
    expect(result.skipped).toBe(0);

    let payload: { tradeId: string; unrealisedPnlZarMinor: number } | undefined;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      payload = e.payload as { tradeId: string; unrealisedPnlZarMinor: number };
    }
    expect(payload?.tradeId).toBe("TRD-FWD-MID");
    // (18.85 - 18.70) × 1M ZAR minor = 0.15 × 100_000_000 = 15_000_000
    expect(payload?.unrealisedPnlZarMinor).toBe(15_000_000);
  });

  it("settled forward (at maturity) is excluded — closes the MtM cycle", () => {
    const store = makeStore();
    appendFxForwardTrade(store, "TRD-FWD-SETTLED", 18.7);
    appendSettlementConfirmed(store, "TRD-FWD-SETTLED");

    const rateSource = makeTestRateSource({ "USD/ZAR": { [AS_OF]: 18_850_000 } });
    const result = runEodFxRevaluation(store, AS_OF, rateSource);
    expect(result.revalued).toBe(0);
  });

  it("idempotency holds for forwards across multiple EOD runs on the same date", () => {
    const store = makeStore();
    appendFxForwardTrade(store, "TRD-FWD-IDEM", 18.7);

    const rateSource = makeTestRateSource({ "USD/ZAR": { [AS_OF]: 18_850_000 } });
    const first = runEodFxRevaluation(store, AS_OF, rateSource);
    const second = runEodFxRevaluation(store, AS_OF, rateSource);
    expect(first.revalued).toBe(1);
    expect(second.revalued).toBe(0);
    expect(second.skipped).toBe(1);
  });
});

describe("TC-6: multiple open positions — all revalued", () => {
  it("revalues all open positions and returns correct counts", () => {
    const store = makeStore();
    appendFxTrade(store, "TRD-M1", 18.5);
    appendFxTrade(store, "TRD-M2", 18.4);
    appendFxTrade(store, "TRD-M3", 18.6);
    // Settle TRD-M3.
    appendSettlementConfirmed(store, "TRD-M3");

    const rateSource = makeTestRateSource({ "USD/ZAR": { [AS_OF]: 18_600_000 } });

    const result = runEodFxRevaluation(store, AS_OF, rateSource);

    // TRD-M1 and TRD-M2 revalued; TRD-M3 settled → excluded.
    expect(result.revalued).toBe(2);
    expect(result.skipped).toBe(0);

    let count = 0;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      void e;
      count++;
    }
    expect(count).toBe(2);
  });
});
