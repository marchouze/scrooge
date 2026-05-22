// platform/projections/markets/unified-position.test.ts
//
// Tests for the unified cross-asset position projection.
// Asserts reducer purity, event filtering, weighted-average cost algebra,
// and replay determinism across equity, bond, and IRS event types.
//
// Author: Anya (Data / analytics engineer, engineering) per
//   D-FINANCIAL-INSTRUMENT-ENTITY Slice 11 (CEO-approved 2026-05-22).

import { describe, expect, it } from "bun:test";

import type { Actor, Event } from "../../event-store/types";
import { makeEquityTradeBooked } from "../../markets/cdm/equity";
import { makeBondTradeExecuted } from "../../markets/cdm/fixed-income";
import { makeIrsTradeBooked } from "../../markets/cdm/ird";
import { unifiedPositionInitial, unifiedPositionProjection } from "./unified-position";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-05-22T10:00:00Z";
const ACTOR: Actor = { type: "system", id: "test-runner" };
const CITATIONS = ["D-FINANCIAL-INSTRUMENT-ENTITY"];

const TRADE_DATE = { iso: "2026-05-22", calendar: "JIHCAL" as const };
const SETTLE_DATE_EQ = { iso: "2026-05-25", calendar: "JIHCAL" as const };
const SETTLE_DATE_BOND = { iso: "2026-05-27", calendar: "JIHCAL" as const };
const EFFECTIVE_DATE_IRS = { iso: "2026-05-24", calendar: "JIHCAL" as const };
const MATURITY_DATE_IRS = { iso: "2028-05-24", calendar: "JIHCAL" as const };

const COUNTERPARTY_A = {
  partyId: "COUNTERPARTY-LEI-001",
  name: "Test Bank A",
  role: "counterparty" as const,
};
const COUNTERPARTY_B = {
  partyId: "COUNTERPARTY-LEI-002",
  name: "Test Bank B",
  role: "counterparty" as const,
};
const COUNTERPARTY_C = {
  partyId: "COUNTERPARTY-LEI-003",
  name: "Test Bank C",
  role: "counterparty" as const,
};

const baseEquityPayload = {
  tradeId: { scheme: "internal", value: "TRD-EQ-001" },
  instrument: {
    identifier: { scheme: "ISIN", value: "ZAE000149932" },
    class: "listed-equity" as const,
    currency: "ZAR",
  },
  instrumentId: "fi:equity:JSE:SOL",
  side: "buy" as const,
  quantity: { amount: 1000, unit: "share" as const },
  price: { amount: 230.0, currency: "ZAR" },
  consideration: { amountMinor: 230000, currency: "ZAR" },
  tradeDate: TRADE_DATE,
  settlementDate: SETTLE_DATE_EQ,
  counterparty: COUNTERPARTY_A,
  venue: "JSE",
  trader: "trader-001",
  bookId: "BOOK-EQ-01",
};

const baseBondPayload = {
  tradeId: { scheme: "internal", value: "TRD-BOND-001" },
  instrumentId: "fi:bond:ZAG000030108",
  isin: "ZAG000030108",
  side: "buy" as const,
  nominalAmount: { amountMinor: 10000000, currency: "ZAR" },
  cleanPrice: 98.5,
  accruedInterest: { amountMinor: 145000, currency: "ZAR" },
  consideration: { amountMinor: 9995000, currency: "ZAR" },
  tradeDate: TRADE_DATE,
  settlementDate: SETTLE_DATE_BOND,
  counterparty: COUNTERPARTY_B,
  venue: "JSE" as const,
  traderRef: "trader-002",
  bookId: "BOOK-BOND-01",
  yieldToMaturity: 0.0875,
};

const baseIrsPayload = {
  tradeId: { scheme: "internal", value: "TRD-IRS-001" },
  instrumentId: "fi:irs:TRD-IRS-001",
  counterparty: COUNTERPARTY_C,
  notional: { amountMinor: 100000000, currency: "ZAR" },
  fixedRate: 0.085,
  floatingIndex: "JIBAR-3M" as const,
  bankPays: "floating" as const,
  tradeDate: TRADE_DATE,
  effectiveDate: EFFECTIVE_DATE_IRS,
  maturityDate: MATURITY_DATE_IRS,
  paymentFrequency: "quarterly" as const,
  dayCountConvention: "ACT/365" as const,
  bookId: "BOOK-DERIV-01",
  traderRef: "trader-003",
};

function fold(events: Event[]) {
  return events.reduce(
    (s, e) => (unifiedPositionProjection.accepts(e) ? unifiedPositionProjection.reduce(s, e) : s),
    unifiedPositionInitial,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("unified-position projection", () => {
  it("starts with empty rows", () => {
    expect(unifiedPositionInitial.rows.size).toBe(0);
  });

  it("accepts EquityTradeBooked with instrumentId — creates equity row", () => {
    const event = makeEquityTradeBooked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: baseEquityPayload,
    });
    const state = fold([event]);
    expect(state.rows.size).toBe(1);
    const row = [...state.rows.values()].at(0);
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.assetClass).toBe("equity");
    expect(row.actusContractType).toBe("STK");
    expect(row.key.instrumentId).toBe("fi:equity:JSE:SOL");
    expect(row.quantity).toBe(1000);
    expect(row.averageCost).toBe(230.0);
    expect(row.currency).toBe("ZAR");
  });

  it("skips EquityTradeBooked WITHOUT instrumentId — state unchanged", () => {
    const { instrumentId: _omit, ...payloadWithoutId } = baseEquityPayload;
    const event = makeEquityTradeBooked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: payloadWithoutId,
    });
    const state = fold([event]);
    expect(state.rows.size).toBe(0);
  });

  it("accepts BondTradeExecuted — creates bond row with nominal quantity and clean price", () => {
    const event = makeBondTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: baseBondPayload,
    });
    const state = fold([event]);
    expect(state.rows.size).toBe(1);
    const row = [...state.rows.values()].at(0);
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.assetClass).toBe("bond");
    expect(row.actusContractType).toBe("PAM");
    expect(row.key.instrumentId).toBe("fi:bond:ZAG000030108");
    expect(row.quantity).toBe(10000000);
    expect(row.lastObservedPrice).toBe(98.5);
  });

  it("second BondTradeExecuted on same instrument accumulates quantity and updates weighted-average cost", () => {
    const e1 = makeBondTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: baseBondPayload,
    });
    const e2 = makeBondTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        ...baseBondPayload,
        tradeId: { scheme: "internal", value: "TRD-BOND-002" },
        nominalAmount: { amountMinor: 5000000, currency: "ZAR" },
        cleanPrice: 99.0,
      },
    });
    const state = fold([e1, e2]);
    expect(state.rows.size).toBe(1);
    const row = [...state.rows.values()].at(0);
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.quantity).toBe(15000000);
    const expectedAvg = (10000000 * 98.5 + 5000000 * 99.0) / 15000000;
    expect(row.averageCost).toBeCloseTo(expectedAvg, 5);
    expect(row.eventCount).toBe(2);
  });

  it("accepts IrsTradeBooked with instrumentId — creates IRS row with receive-fixed polarity", () => {
    const event = makeIrsTradeBooked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: baseIrsPayload,
    });
    const state = fold([event]);
    expect(state.rows.size).toBe(1);
    const row = [...state.rows.values()].at(0);
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.assetClass).toBe("irs");
    expect(row.actusContractType).toBe("IRS");
    expect(row.key.instrumentId).toBe("fi:irs:TRD-IRS-001");
    expect(row.quantity).toBe(100000000); // bankPays=floating → receive-fixed → positive
    expect(row.lastObservedPrice).toBe(0.085);
  });

  it("skips IrsTradeBooked WITHOUT instrumentId — state unchanged", () => {
    const { instrumentId: _omit, ...payloadWithoutId } = baseIrsPayload;
    const event = makeIrsTradeBooked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: payloadWithoutId,
    });
    const state = fold([event]);
    expect(state.rows.size).toBe(0);
  });

  it("two events on different instruments — two independent rows", () => {
    const eq = makeEquityTradeBooked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: baseEquityPayload,
    });
    const bond = makeBondTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: baseBondPayload,
    });
    const state = fold([eq, bond]);
    expect(state.rows.size).toBe(2);
    const assetClasses = [...state.rows.values()].map((r) => r.assetClass).sort();
    expect(assetClasses).toEqual(["bond", "equity"]);
  });

  it("replay determinism — same events produce identical state", () => {
    const events = [
      makeEquityTradeBooked({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: baseEquityPayload,
      }),
      makeBondTradeExecuted({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: baseBondPayload,
      }),
    ];
    const s1 = fold(events);
    const s2 = fold(events);
    expect(s1.rows.size).toBe(s2.rows.size);
    for (const [k, r1] of s1.rows) {
      const r2 = s2.rows.get(k);
      expect(r2).toBeDefined();
      if (!r2) continue;
      expect(r1.quantity).toBe(r2.quantity);
      expect(r1.averageCost).toBe(r2.averageCost);
      expect(r1.markToMarket).toBe(r2.markToMarket);
    }
  });

  it("pay-fixed IRS has negative quantity", () => {
    const payFixed = {
      ...baseIrsPayload,
      bankPays: "fixed" as const,
      tradeId: { scheme: "internal", value: "TRD-IRS-002" },
      instrumentId: "fi:irs:TRD-IRS-002",
    };
    const event = makeIrsTradeBooked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: payFixed,
    });
    const state = fold([event]);
    const row = [...state.rows.values()].at(0);
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.quantity).toBe(-100000000); // pay-fixed = negative
  });

  it("bond sell reduces nominal quantity", () => {
    const buy = makeBondTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: baseBondPayload,
    });
    const sell = makeBondTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        ...baseBondPayload,
        tradeId: { scheme: "internal", value: "TRD-BOND-003" },
        side: "sell" as const,
        nominalAmount: { amountMinor: 4000000, currency: "ZAR" },
      },
    });
    const state = fold([buy, sell]);
    const row = [...state.rows.values()].at(0);
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.quantity).toBe(6000000); // 10m - 4m
  });
});
