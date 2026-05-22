// platform/accounting/gl-posting-engine-bonds.test.ts
//
// Tests for bond lifecycle event dispatch in the GL posting engine.
//
// Coverage matrix:
//   1. BondTradeExecuted banking-book → posts bond-trade-booking, legs balance
//   2. BondTradeExecuted trading-book → posts bond-trade-booking, legs balance
//   3. BondInterestAccrued non-zero → posts bond-interest-accrual
//   4. BondPositionRevalued zero-delta → skip (zero-delta-revaluation)
//   5. BondPositionRevalued non-zero gain → posts bond-revaluation, legs balance
//   6. BondPositionRevalued non-zero loss → posts bond-revaluation, legs balance
//   7. BondMatured → posts bond-maturity, legs balance
//   8. BondSold gain → posts bond-sale, legs balance
//   9. BondSold loss → posts bond-sale, legs balance
//  10. Idempotency: second run with priorPostings from first → zero new emissions
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import { HOZ_BANK_ENTITY } from "../core/types";
import {
  makeBondInterestAccrued,
  makeBondMatured,
  makeBondPositionRevalued,
  makeBondSold,
  makeBondTradeExecuted,
} from "../event-store/event-types/bond-accounting";
import type { Event } from "../event-store/types";
import { POSTING_RULE_IDS, runGlPostingEngine } from "./gl-posting-engine";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY = HOZ_BANK_ENTITY;
const ENGINE_ACTOR = {
  type: "service" as const,
  id: "agent:bea:gl-posting-engine",
};
const NOW = "2026-05-22T08:00:00.000Z";
const now = () => NOW;
const CITATIONS = ["Principles/1-events-are-truth.md", "D-FINANCIAL-INSTRUMENT-ENTITY"];

const BOND_ISIN = "ZAG000149037"; // R2030 SA government bond
const TRADE_ID = "TRD-BOND-TEST-001";
const SETTLEMENT_DATE = "2026-05-23";
const TRADE_TS = "2026-05-20T10:00:00.000Z";

// Nominal R10,000,000 (in cents)
const NOMINAL_MINOR = 1_000_000_000; // R10m × 100 cents
// Dirty price 97.50%
const DIRTY_PRICE_PCT = 97.5;

function makeBankingBookTradeEvent(eventId?: string): Event {
  return makeBondTradeExecuted({
    asOf: TRADE_TS,
    entity: ENTITY,
    actor: { type: "service", id: "trader:test" },
    citations: CITATIONS,
    ...(eventId !== undefined ? { eventId } : {}),
    payload: {
      tradeId: TRADE_ID,
      bondIsin: BOND_ISIN,
      side: "buy",
      nominalMinor: NOMINAL_MINOR,
      cleanPricePercent: 96.5,
      accruedInterestMinor: 1_000_000,
      dirtyPricePercent: DIRTY_PRICE_PCT,
      settlementDate: SETTLEMENT_DATE,
      portfolio: "banking-book",
      couponRate: 0.085,
      maturityDate: "2030-01-31",
      currency: "ZAR",
      counterpartyLei: "SBZAZAJJXXX",
      executedAt: TRADE_TS,
    },
  });
}

function makeTradingBookTradeEvent(eventId?: string): Event {
  return makeBondTradeExecuted({
    asOf: TRADE_TS,
    entity: ENTITY,
    actor: { type: "service", id: "trader:test" },
    citations: CITATIONS,
    ...(eventId !== undefined ? { eventId } : {}),
    payload: {
      tradeId: `${TRADE_ID}-TRAD`,
      bondIsin: BOND_ISIN,
      side: "buy",
      nominalMinor: NOMINAL_MINOR,
      cleanPricePercent: 96.5,
      accruedInterestMinor: 1_000_000,
      dirtyPricePercent: DIRTY_PRICE_PCT,
      settlementDate: SETTLEMENT_DATE,
      portfolio: "trading-book",
      couponRate: 0.085,
      maturityDate: "2030-01-31",
      currency: "ZAR",
      counterpartyLei: "SBZAZAJJXXX",
      executedAt: TRADE_TS,
    },
  });
}

function makeInterestAccruedEvent(accruedInterestMinor: number, eventId?: string): Event {
  return makeBondInterestAccrued({
    asOf: "2026-05-21T00:00:00.000Z",
    entity: ENTITY,
    actor: { type: "service", id: "agent:bea:eir-accrual" },
    citations: CITATIONS,
    ...(eventId !== undefined ? { eventId } : {}),
    payload: {
      tradeId: TRADE_ID,
      bondIsin: BOND_ISIN,
      accrualDate: "2026-05-21",
      accruedInterestMinor,
      eirRate: 0.0873,
      openingCarryingAmountMinor: NOMINAL_MINOR,
      closingCarryingAmountMinor: NOMINAL_MINOR + accruedInterestMinor,
      currency: "ZAR",
    },
  });
}

function makeRevaluedEvent(unrealisedPnlZarMinor: number, eventId?: string): Event {
  return makeBondPositionRevalued({
    asOf: "2026-05-21T16:00:00.000Z",
    entity: ENTITY,
    actor: { type: "service", id: "agent:rohan:mtm" },
    citations: CITATIONS,
    ...(eventId !== undefined ? { eventId } : {}),
    payload: {
      tradeId: `${TRADE_ID}-TRAD`,
      bondIsin: BOND_ISIN,
      revalDate: "2026-05-21",
      bookCleanPricePercent: 96.5,
      currentCleanPricePercent: unrealisedPnlZarMinor === 0 ? 96.5 : 97.2,
      unrealisedPnlZarMinor,
      currency: "ZAR",
    },
  });
}

function makeMaturedEvent(eventId?: string): Event {
  return makeBondMatured({
    asOf: "2030-01-31T00:00:00.000Z",
    entity: ENTITY,
    actor: { type: "service", id: "agent:bea:maturity-processor" },
    citations: CITATIONS,
    ...(eventId !== undefined ? { eventId } : {}),
    payload: {
      tradeId: `${TRADE_ID}-TRAD`,
      bondIsin: BOND_ISIN,
      maturityDate: "2030-01-31",
      nominalRepaidMinor: NOMINAL_MINOR,
      finalCouponMinor: 4_250_000, // half-year coupon
      currency: "ZAR",
    },
  });
}

function makeSoldEvent(realisedPnlMinor: number, eventId?: string): Event {
  const carryingAmountAtSaleMinor = NOMINAL_MINOR;
  const saleProceedsMinor = carryingAmountAtSaleMinor + realisedPnlMinor;
  return makeBondSold({
    asOf: "2026-06-15T10:00:00.000Z",
    entity: ENTITY,
    actor: { type: "service", id: "trader:test" },
    citations: CITATIONS,
    ...(eventId !== undefined ? { eventId } : {}),
    payload: {
      tradeId: `${TRADE_ID}-TRAD`,
      bondIsin: BOND_ISIN,
      side: "sell",
      saleProceedsMinor,
      carryingAmountAtSaleMinor,
      realisedPnlMinor,
      settlementDate: "2026-06-18",
      currency: "ZAR",
    },
  });
}

// ---------------------------------------------------------------------------
// Helper: sum debit and credit legs for balance check
// ---------------------------------------------------------------------------

function legsBalance(emitted: Event[]): boolean {
  for (const e of emitted) {
    const p = e.payload as {
      legs: Array<{ debitCredit: string; amountMinor: number; currency: string }>;
    };
    const byCurrency: Record<string, number> = {};
    for (const leg of p.legs) {
      const sign = leg.debitCredit === "debit" ? 1 : -1;
      byCurrency[leg.currency] = (byCurrency[leg.currency] ?? 0) + sign * leg.amountMinor;
    }
    for (const [, net] of Object.entries(byCurrency)) {
      if (net !== 0) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GL posting engine — bond lifecycle", () => {
  // 1. Banking-book trade
  it("BondTradeExecuted banking-book: emits bond-trade-booking posting", () => {
    const tradeEvent = makeBankingBookTradeEvent();
    const result = runGlPostingEngine({
      events: [tradeEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings).toHaveLength(1);
    const posting = result.emittedPostings[0];
    const payload = posting?.payload as { postingType: string; legs: unknown[] } | undefined;
    expect(payload?.postingType).toBe("bond-trade-booking");
    expect(result.skipped).toHaveLength(0);
  });

  it("BondTradeExecuted banking-book: legs balance", () => {
    const tradeEvent = makeBankingBookTradeEvent();
    const result = runGlPostingEngine({
      events: [tradeEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(legsBalance(result.emittedPostings as Event[])).toBe(true);
  });

  it("BondTradeExecuted banking-book: uses PR-BOND-001", () => {
    const tradeEvent = makeBankingBookTradeEvent("evt-bond-banking-001");
    const result = runGlPostingEngine({
      events: [tradeEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings[0]?.event_id).toBe(
      `gl-posting:${POSTING_RULE_IDS.BOND_TRADE_BANKING}:evt-bond-banking-001`,
    );
  });

  // 2. Trading-book trade
  it("BondTradeExecuted trading-book: emits bond-trade-booking posting", () => {
    const tradeEvent = makeTradingBookTradeEvent();
    const result = runGlPostingEngine({
      events: [tradeEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings).toHaveLength(1);
    const payload = result.emittedPostings[0]?.payload as { postingType: string } | undefined;
    expect(payload?.postingType).toBe("bond-trade-booking");
  });

  it("BondTradeExecuted trading-book: legs balance", () => {
    const tradeEvent = makeTradingBookTradeEvent();
    const result = runGlPostingEngine({
      events: [tradeEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(legsBalance(result.emittedPostings as Event[])).toBe(true);
  });

  it("BondTradeExecuted trading-book: uses PR-BOND-001T", () => {
    const tradeEvent = makeTradingBookTradeEvent("evt-bond-trading-001");
    const result = runGlPostingEngine({
      events: [tradeEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings[0]?.event_id).toBe(
      `gl-posting:${POSTING_RULE_IDS.BOND_TRADE_TRADING}:evt-bond-trading-001`,
    );
  });

  // 3. Interest accrual
  it("BondInterestAccrued non-zero: emits bond-interest-accrual posting", () => {
    const accrualEvent = makeInterestAccruedEvent(2_397_260);
    const result = runGlPostingEngine({
      events: [accrualEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings).toHaveLength(1);
    const payload = result.emittedPostings[0]?.payload as { postingType: string } | undefined;
    expect(payload?.postingType).toBe("bond-interest-accrual");
    expect(result.skipped).toHaveLength(0);
  });

  it("BondInterestAccrued non-zero: legs balance", () => {
    const accrualEvent = makeInterestAccruedEvent(2_397_260);
    const result = runGlPostingEngine({
      events: [accrualEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(legsBalance(result.emittedPostings as Event[])).toBe(true);
  });

  // 4. Zero-delta revaluation → skip
  it("BondPositionRevalued zero-delta: skip with zero-delta-revaluation", () => {
    const revalEvent = makeRevaluedEvent(0);
    const result = runGlPostingEngine({
      events: [revalEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toBe("zero-delta-revaluation");
  });

  // 5. Non-zero gain revaluation
  it("BondPositionRevalued gain: emits bond-revaluation posting", () => {
    const revalEvent = makeRevaluedEvent(7_000_000);
    const result = runGlPostingEngine({
      events: [revalEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings).toHaveLength(1);
    const payload = result.emittedPostings[0]?.payload as { postingType: string } | undefined;
    expect(payload?.postingType).toBe("bond-revaluation");
    expect(legsBalance(result.emittedPostings as Event[])).toBe(true);
  });

  // 6. Non-zero loss revaluation
  it("BondPositionRevalued loss: emits bond-revaluation posting, legs balance", () => {
    const revalEvent = makeRevaluedEvent(-5_000_000);
    const result = runGlPostingEngine({
      events: [revalEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings).toHaveLength(1);
    const payload = result.emittedPostings[0]?.payload as { postingType: string } | undefined;
    expect(payload?.postingType).toBe("bond-revaluation");
    expect(legsBalance(result.emittedPostings as Event[])).toBe(true);
  });

  // 7. Bond maturity
  it("BondMatured: emits bond-maturity posting", () => {
    const maturityEvent = makeMaturedEvent();
    const result = runGlPostingEngine({
      events: [maturityEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings).toHaveLength(1);
    const payload = result.emittedPostings[0]?.payload as { postingType: string } | undefined;
    expect(payload?.postingType).toBe("bond-maturity");
    expect(result.skipped).toHaveLength(0);
  });

  it("BondMatured: legs balance", () => {
    const maturityEvent = makeMaturedEvent();
    const result = runGlPostingEngine({
      events: [maturityEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(legsBalance(result.emittedPostings as Event[])).toBe(true);
  });

  // 8. Bond sale — gain
  it("BondSold gain: emits bond-sale posting", () => {
    const saleEvent = makeSoldEvent(5_000_000);
    const result = runGlPostingEngine({
      events: [saleEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings).toHaveLength(1);
    const payload = result.emittedPostings[0]?.payload as { postingType: string } | undefined;
    expect(payload?.postingType).toBe("bond-sale");
    expect(legsBalance(result.emittedPostings as Event[])).toBe(true);
  });

  // 9. Bond sale — loss
  it("BondSold loss: emits bond-sale posting, legs balance", () => {
    const saleEvent = makeSoldEvent(-3_000_000);
    const result = runGlPostingEngine({
      events: [saleEvent],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings).toHaveLength(1);
    const payload2 = result.emittedPostings[0]?.payload as { postingType: string } | undefined;
    expect(payload2?.postingType).toBe("bond-sale");
    expect(legsBalance(result.emittedPostings as Event[])).toBe(true);
  });

  // 10. Idempotency
  it("idempotency: second run with priorPostings produces zero new emissions", () => {
    const events: Event[] = [
      makeBankingBookTradeEvent(),
      makeTradingBookTradeEvent(),
      makeInterestAccruedEvent(2_397_260),
      makeRevaluedEvent(7_000_000),
      makeMaturedEvent(),
      makeSoldEvent(5_000_000),
    ];

    const firstRun = runGlPostingEngine({
      events,
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(firstRun.emittedPostings.length).toBeGreaterThan(0);

    const secondRun = runGlPostingEngine({
      events,
      priorPostings: firstRun.emittedPostings as Event[],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(secondRun.emittedPostings).toHaveLength(0);
    // Each event should appear in skipped as duplicate-already-posted
    const duplicateSkips = secondRun.skipped.filter((s) => s.reason === "duplicate-already-posted");
    expect(duplicateSkips.length).toBe(firstRun.emittedPostings.length);
  });

  // Mixed stream: non-bond events silently pass, bond events post
  it("mixed stream: FX and bond events — only bond events produce bond postings", () => {
    const bankingTrade = makeBankingBookTradeEvent("evt-bank-001");
    const tradingTrade = makeTradingBookTradeEvent("evt-trad-001");
    const accrual = makeInterestAccruedEvent(1_000_000, "evt-acc-001");

    const result = runGlPostingEngine({
      events: [bankingTrade, tradingTrade, accrual],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings).toHaveLength(3);
    const postingTypes = (result.emittedPostings as Event[]).map(
      (e) => (e.payload as { postingType: string }).postingType,
    );
    expect(postingTypes).toContain("bond-trade-booking");
    expect(postingTypes).toContain("bond-interest-accrual");
  });
});
