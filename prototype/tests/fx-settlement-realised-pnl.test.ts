// tests/fx-settlement-realised-pnl.test.ts
//
// Unit tests for the realised P&L computation at FX-spot settlement.
//
// Validates:
//   1. buy-USD/sell-ZAR at 18.50, settled at 18.60 on USD 1m notional
//      → realisedPnlZarMinor = ZAR +100,000 in minor (10,000,000 ZAR-cents).
//      Canonical brief test case (brief §1).
//   2. sell-USD/buy-ZAR at 18.60, settled at 18.50 on USD 1m notional
//      → realisedPnlZarMinor = ZAR +100,000 (bank sold high, settled low).
//   3. buy-USD at 18.50, settled at 18.40 → ZAR -100,000 (loss).
//   4. Zero P&L when settlement rate equals book rate.
//   5. SettlementRealisedPnlCorrected schema round-trip.
//   6. makeSettlementRealisedPnlCorrected produces a well-formed event.
//   7. Citation requirement enforced on factory.
//   8. daily-pnl projection folds SettlementRealisedPnlCorrected, superseding
//      the original zero P&L from SettlementConfirmed.
//   9. Last correction wins (idempotent re-run pattern).
//
// Authority: IAS 21 §28; PR-FX-LIFECYCLE-CLOSE; D-FX-QUOTING-CONVENTION.
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { beforeEach, describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import {
  makeFxTradeExecuted,
  makeSettlementConfirmed,
  makeSettlementRealisedPnlCorrected,
  settlementRealisedPnlCorrectedPayloadSchema,
} from "../platform/markets/cdm/fx";
import { computeDailyPnL } from "../platform/product-control/daily-pnl";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["IAS-21-§28", "PR-FX-LIFECYCLE-CLOSE", "D-FX-QUOTING-CONVENTION"];
const ACTOR = { id: "agent:bea:test", type: "service" as const };

/** USD 1,000,000 notional expressed in USD minor units (cents). */
const USD_1M_MINOR = 100_000_000; // 1,000,000 × 100 cents/dollar

// ---------------------------------------------------------------------------
// Helpers — pure realised P&L formula for assertion
// ---------------------------------------------------------------------------

/**
 * IAS 21 §28 formula (side-aware):
 *   realisedPnlZarMinor = (isBuy ? +1 : -1) × (r_settle − r_book) × |N_base_minor|
 */
function computeRealisedPnl(opts: {
  side: "buy" | "sell";
  bookRate: number;
  settlementRate: number;
  notionalBaseMinor: number;
}): number {
  const sign = opts.side === "buy" ? 1 : -1;
  return Math.round(
    sign * (opts.settlementRate - opts.bookRate) * Math.abs(opts.notionalBaseMinor),
  );
}

// ---------------------------------------------------------------------------
// Shared trade payload builder (includes all required fields)
// ---------------------------------------------------------------------------

function makeBuyUsdTrade(tradeId: string) {
  return makeFxTradeExecuted({
    asOf: "2026-05-19",
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId: { scheme: "INTERNAL", value: tradeId },
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      bookType: "trading",
      venue: "OTC",
      trader: "bea@bank.local",
      tradeDate: { iso: "2026-05-19", calendar: "JIHCAL" },
      settlementPath: "correspondent",
      settlementForm: "physical",
      counterparty: {
        partyId: "CP-TEST-001",
        name: "Test Counterparty",
        role: "counterparty",
        jurisdiction: "ZA",
      },
      legs: [
        {
          legKind: "near",
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          // BUY USD: pay ZAR (notional in payCurrency = ZAR)
          notional: { currency: "ZAR", amountMinor: 1_850_000_000 }, // ZAR 18.5m
          counterNotional: { currency: "USD", amountMinor: USD_1M_MINOR }, // USD 1m
          rate: { amount: 18.5, currency: "ZAR" },
          settlementDate: { iso: "2026-05-21", calendar: "JIHCAL" },
        },
      ],
      bookId: "FX-SPOT-BOOK",
      clientFlowRef: `client-trade:pnl-test-${tradeId}`,
    },
  });
}

// ---------------------------------------------------------------------------
// Part 1 — Pure P&L formula tests (IAS 21 §28)
// ---------------------------------------------------------------------------

describe("FX realised P&L formula (IAS 21 §28)", () => {
  it("buy-USD at 18.50, settle at 18.60, USD 1m → ZAR +100,000 gain (canonical brief test)", () => {
    // 0.10 ZAR/USD × 100,000,000 USD-cents = 10,000,000 ZAR-cents = ZAR 100,000
    const pnl = computeRealisedPnl({
      side: "buy",
      bookRate: 18.5,
      settlementRate: 18.6,
      notionalBaseMinor: USD_1M_MINOR,
    });
    expect(pnl).toBe(10_000_000);
  });

  it("sell-USD at 18.60, settle at 18.50, USD 1m → ZAR +100,000 gain", () => {
    // sign = -1; delta = 18.50 − 18.60 = -0.10; pnl = -1 × -0.10 × 100m = +10,000,000
    const pnl = computeRealisedPnl({
      side: "sell",
      bookRate: 18.6,
      settlementRate: 18.5,
      notionalBaseMinor: USD_1M_MINOR,
    });
    expect(pnl).toBe(10_000_000);
  });

  it("buy-USD at 18.50, settle at 18.40, USD 1m → ZAR -100,000 loss", () => {
    // 18.40 − 18.50 = -0.10; sign = +1; pnl = -10,000,000
    const pnl = computeRealisedPnl({
      side: "buy",
      bookRate: 18.5,
      settlementRate: 18.4,
      notionalBaseMinor: USD_1M_MINOR,
    });
    expect(pnl).toBe(-10_000_000);
  });

  it("zero P&L when settlement rate equals book rate", () => {
    const pnl = computeRealisedPnl({
      side: "buy",
      bookRate: 18.5,
      settlementRate: 18.5,
      notionalBaseMinor: USD_1M_MINOR,
    });
    expect(pnl).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — SettlementRealisedPnlCorrected schema
// ---------------------------------------------------------------------------

describe("SettlementRealisedPnlCorrected schema", () => {
  it("round-trips a valid correction payload", () => {
    const payload = {
      tradeId: "SIM-TEST-001",
      originalSettlementEventId: "evt-original-001",
      currencyPair: "USD/ZAR",
      realisedPnlZarMinor: 10_000_000,
      settlementRate: 18.6,
      bookRate: 18.5,
      notionalBaseMinor: USD_1M_MINOR,
      rateSource: "official-mark" as const,
      settledDate: "2026-05-21",
      citations: CITATIONS,
    };
    expect(() => settlementRealisedPnlCorrectedPayloadSchema.parse(payload)).not.toThrow();
    const parsed = settlementRealisedPnlCorrectedPayloadSchema.parse(payload);
    expect(parsed.realisedPnlZarMinor).toBe(10_000_000);
    expect(parsed.rateSource).toBe("official-mark");
  });

  it("makeSettlementRealisedPnlCorrected produces a well-formed event", () => {
    const event = makeSettlementRealisedPnlCorrected({
      asOf: "2026-05-21",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: "SIM-TEST-001",
        originalSettlementEventId: "evt-original-001",
        currencyPair: "USD/ZAR",
        realisedPnlZarMinor: 10_000_000,
        settlementRate: 18.6,
        bookRate: 18.5,
        notionalBaseMinor: USD_1M_MINOR,
        rateSource: "official-mark" as const,
        settledDate: "2026-05-21",
        citations: CITATIONS,
      },
    });
    expect(event.type).toBe("SettlementRealisedPnlCorrected");
    expect(event.entity).toBe(ENTITY);
    const p = event.payload as { realisedPnlZarMinor: number };
    expect(p.realisedPnlZarMinor).toBe(10_000_000);
  });

  it("requires at least one citation on the factory", () => {
    expect(() =>
      makeSettlementRealisedPnlCorrected({
        asOf: "2026-05-21",
        entity: ENTITY,
        actor: ACTOR,
        citations: [], // empty — should throw Principle 2 error
        payload: {
          tradeId: "SIM-TEST-001",
          originalSettlementEventId: "evt-original-001",
          currencyPair: "USD/ZAR",
          realisedPnlZarMinor: 10_000_000,
          settlementRate: 18.6,
          bookRate: 18.5,
          notionalBaseMinor: USD_1M_MINOR,
          rateSource: "official-mark" as const,
          settledDate: "2026-05-21",
          citations: CITATIONS,
        },
      }),
    ).toThrow("requires at least one citation");
  });
});

// ---------------------------------------------------------------------------
// Part 3 — daily-pnl projection folds SettlementRealisedPnlCorrected
// ---------------------------------------------------------------------------

describe("daily-pnl projection folds SettlementRealisedPnlCorrected", () => {
  let store: EventStore;

  beforeEach(() => {
    store = new EventStore(":memory:");
  });

  it("totalRealisedPnlZarMinor is non-zero after correction event (canonical brief scenario)", () => {
    // Step 1: book the trade.
    store.append(makeBuyUsdTrade("SIM-PNLTEST-001"));

    // Step 2: emit SettlementConfirmed with realisedPnlDelta: 0 (historical gap).
    const settlementEvent = makeSettlementConfirmed({
      asOf: "2026-05-21",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: "SIM-PNLTEST-001",
        currencyPair: "USD/ZAR",
        settledDate: "2026-05-21",
        realisedPnlDelta: 0,
        settlementRef: "SWIFT-CONF-PNLTEST-001",
        citations: CITATIONS,
      },
    });
    store.append(settlementEvent);

    // Before correction: P&L should be zero.
    const beforeResult = computeDailyPnL(store, "2026-05-21");
    expect(beforeResult.payload.totalRealisedPnlZarMinor).toBe(0);

    // Step 3: emit the correction — buy at 18.50, settled at 18.60 → ZAR +100,000.
    const correctionEvent = makeSettlementRealisedPnlCorrected({
      asOf: "2026-05-21",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: "SIM-PNLTEST-001",
        originalSettlementEventId: settlementEvent.event_id,
        currencyPair: "USD/ZAR",
        realisedPnlZarMinor: 10_000_000, // ZAR 100,000 in minor units (cents)
        settlementRate: 18.6,
        bookRate: 18.5,
        notionalBaseMinor: USD_1M_MINOR,
        rateSource: "official-mark",
        settledDate: "2026-05-21",
        citations: CITATIONS,
      },
    });
    store.append(correctionEvent);

    // After correction: P&L should be ZAR 100,000 (10,000,000 minor units).
    const afterResult = computeDailyPnL(store, "2026-05-21");
    expect(afterResult.payload.totalRealisedPnlZarMinor).toBe(10_000_000);

    // The trade should appear as settled with non-zero realised P&L.
    const tradeRow = afterResult.trades.find((t) => t.tradeId === "SIM-PNLTEST-001");
    expect(tradeRow).toBeDefined();
    expect(tradeRow?.status).toBe("settled");
    expect(tradeRow?.realisedPnlZarMinor).toBe(10_000_000);
  });

  it("last correction event wins (idempotent re-run pattern)", () => {
    store.append(makeBuyUsdTrade("SIM-PNLTEST-002"));

    const settlementEvent = makeSettlementConfirmed({
      asOf: "2026-05-21",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: "SIM-PNLTEST-002",
        currencyPair: "USD/ZAR",
        settledDate: "2026-05-21",
        realisedPnlDelta: 0,
        settlementRef: "SWIFT-CONF-PNLTEST-002",
        citations: CITATIONS,
      },
    });
    store.append(settlementEvent);

    // First correction at 18.60 → ZAR +100,000.
    store.append(
      makeSettlementRealisedPnlCorrected({
        asOf: "2026-05-21",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "SIM-PNLTEST-002",
          originalSettlementEventId: settlementEvent.event_id,
          currencyPair: "USD/ZAR",
          realisedPnlZarMinor: 10_000_000,
          settlementRate: 18.6,
          bookRate: 18.5,
          notionalBaseMinor: USD_1M_MINOR,
          rateSource: "official-mark",
          settledDate: "2026-05-21",
          citations: CITATIONS,
        },
      }),
    );

    // Second correction at 18.70 → ZAR +200,000 (revised rate source).
    store.append(
      makeSettlementRealisedPnlCorrected({
        asOf: "2026-05-21",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "SIM-PNLTEST-002",
          originalSettlementEventId: settlementEvent.event_id,
          currencyPair: "USD/ZAR",
          realisedPnlZarMinor: 20_000_000,
          settlementRate: 18.7,
          bookRate: 18.5,
          notionalBaseMinor: USD_1M_MINOR,
          rateSource: "official-mark",
          settledDate: "2026-05-21",
          citations: CITATIONS,
        },
      }),
    );

    // The projection should use the last correction (20,000,000 = ZAR 200,000).
    const result = computeDailyPnL(store, "2026-05-21");
    expect(result.payload.totalRealisedPnlZarMinor).toBe(20_000_000);
  });
});
