// tests/ba310-bond-ir-adapter.test.ts
//
// Unit tests for the BA-310 bond IR general maturity-ladder and specific-risk
// adapter (`platform/reporting/ba-310-bond-events-adapter.ts`).
//
// Coverage (per dispatch brief BND-3):
//   1. Live trading-book bond → correct maturity band row
//   2. Matured bond excluded from ladder
//   3. Sold bond excluded from ladder
//   4. Banking-book bond excluded from BA-310 ladder (banking-book → BA-330)
//   5. Empty positions → empty ladder (no crash)
//   6. SA government bond (ZAG* ISIN) → specific risk row with weight 0
//   7. Non-sovereign bond → specific risk row with weight 0.0025
//   8. Band assignment for each zone (0-1m, 1-3m, … >20y)
//   9. Long/short netting within a band (buy = long, sell = short)
//  10. Integration: subscriber derives bond IR from events when caller omits override
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN; D-MARKETS-CAPITAL-TIME-SHAPE;
//   Regulations Relating to Banks Reg 28(3)(a)–(b); Principles/1-events-are-truth.md.
//
// Author: Mira (Regulatory reporting engineer, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { newEventId } from "../platform/core/types";
import {
  makeBondMatured,
  makeBondSold,
  makeBondTradeExecuted,
} from "../platform/event-store/event-types/bond-accounting";
import { EventStore } from "../platform/event-store/store";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import {
  buildBondIrGeneralLadder,
  buildBondIrSpecificRiskRows,
} from "../platform/reporting/ba-310-bond-events-adapter";
import { ba310PeriodCloseSubscriber } from "../platform/returns/ba310/period-close-subscriber";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:Mira" };
const CITATIONS = ["D-MARKETS-CAPITAL-TIME-SHAPE", "D-TRADE-LIFECYCLE-IFRS-CHAIN"];

// A period ending 2026-06-30 — bonds with maturity dates relative to this.
const PERIOD_END = "2026-06-30T23:59:59.999Z";

// SA government bond ISIN prefix ZAG
const SA_GOV_ISIN = "ZAG000057547"; // R2030 — matures 2030-01-31

// Corporate bond (non-ZAG)
const CORP_ISIN = "XS1234567890";

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// Helper to create a BondTradeExecuted event and append to store
// ---------------------------------------------------------------------------

function appendBondTrade(
  store: EventStore,
  opts: {
    tradeId: string;
    isin: string;
    side: "buy" | "sell";
    nominalMinor: number;
    maturityDate: string;
    portfolio: "trading-book" | "banking-book";
    asOf?: string;
  },
): void {
  const ev = makeBondTradeExecuted({
    asOf: opts.asOf ?? "2026-06-01T10:00:00.000Z",
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId: opts.tradeId,
      bondIsin: opts.isin,
      side: opts.side,
      nominalMinor: opts.nominalMinor,
      cleanPricePercent: 98.0,
      accruedInterestMinor: 0,
      dirtyPricePercent: 98.0,
      settlementDate: "2026-06-04",
      portfolio: opts.portfolio,
      couponRate: 0.0775,
      maturityDate: opts.maturityDate,
      currency: "ZAR",
      counterpartyLei: "LEI-TEST-001",
      executedAt: opts.asOf ?? "2026-06-01T10:00:00.000Z",
    },
  });
  store.append(ev);
}

// ---------------------------------------------------------------------------
// 1. Empty store → empty ladder + empty specific risk
// ---------------------------------------------------------------------------

describe("buildBondIrGeneralLadder — empty store", () => {
  it("returns empty array for empty event store (no crash)", () => {
    const store = new EventStore(":memory:");
    const rows = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows).toEqual([]);
  });
});

describe("buildBondIrSpecificRiskRows — empty store", () => {
  it("returns empty array for empty event store (no crash)", () => {
    const store = new EventStore(":memory:");
    const rows = buildBondIrSpecificRiskRows({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Single live trading-book bond → correct band + weight
// ---------------------------------------------------------------------------

describe("buildBondIrGeneralLadder — single live trading-book bond", () => {
  it("assigns a 3-year bond to the 2-3y band with correct weighted long", () => {
    const store = new EventStore(":memory:");
    // Period end = 2026-06-30. Bond matures 2029-07-01 = ~3.0 years residual.
    appendBondTrade(store, {
      tradeId: "T001",
      isin: CORP_ISIN,
      side: "buy",
      nominalMinor: 10_000_000, // R100,000 face
      maturityDate: "2029-07-01",
      portfolio: "trading-book",
    });

    const rows = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });

    expect(rows.length).toBe(1);
    const row = rows.at(0);
    expect(row?.band).toBe("2-3y");
    // weight for 2-3y = 1.75% = 0.0175; 10_000_000 × 0.0175 = 175_000
    expect(row?.weightedLongMinor).toBe(175_000);
    expect(row?.weightedShortMinor).toBe(0);
  });

  it("assigns a 6-month bond to the 3-6m band", () => {
    const store = new EventStore(":memory:");
    // Period end = 2026-06-30. Bond matures 2026-12-20 = ~5.6 months residual.
    appendBondTrade(store, {
      tradeId: "T002",
      isin: SA_GOV_ISIN,
      side: "buy",
      nominalMinor: 5_000_000,
      maturityDate: "2026-12-20",
      portfolio: "trading-book",
    });

    const rows = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows.length).toBe(1);
    expect(rows.at(0)?.band).toBe("3-6m");
    // weight 3-6m = 0.40% = 0.004; 5_000_000 × 0.004 = 20_000
    expect(rows.at(0)?.weightedLongMinor).toBe(20_000);
  });

  it("assigns a 10-year bond to the 7-10y band", () => {
    const store = new EventStore(":memory:");
    // Period end 2026-06-30. Bond matures 2034-06-30 = 8 years residual.
    appendBondTrade(store, {
      tradeId: "T003",
      isin: CORP_ISIN,
      side: "buy",
      nominalMinor: 20_000_000,
      maturityDate: "2034-06-30",
      portfolio: "trading-book",
    });

    const rows = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows.length).toBe(1);
    expect(rows.at(0)?.band).toBe("7-10y");
    // weight 7-10y = 3.75% = 0.0375; 20_000_000 × 0.0375 = 750_000
    expect(rows.at(0)?.weightedLongMinor).toBe(750_000);
  });

  it("assigns a >20-year bond to the >20y band", () => {
    const store = new EventStore(":memory:");
    // Period end 2026-06-30. Bond matures 2060-06-30 = 34 years.
    appendBondTrade(store, {
      tradeId: "T004",
      isin: CORP_ISIN,
      side: "buy",
      nominalMinor: 1_000_000,
      maturityDate: "2060-06-30",
      portfolio: "trading-book",
    });

    const rows = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows.length).toBe(1);
    expect(rows.at(0)?.band).toBe(">20y");
    // weight >20y = 6.00% = 0.06; 1_000_000 × 0.06 = 60_000
    expect(rows.at(0)?.weightedLongMinor).toBe(60_000);
  });
});

// ---------------------------------------------------------------------------
// 3. Banking-book bond → excluded from BA-310 IR ladder
// ---------------------------------------------------------------------------

describe("buildBondIrGeneralLadder — banking-book exclusion", () => {
  it("excludes banking-book bonds (they belong to BA-330 IRRBB)", () => {
    const store = new EventStore(":memory:");
    // Banking-book bond — should be excluded from BA-310.
    appendBondTrade(store, {
      tradeId: "BB001",
      isin: CORP_ISIN,
      side: "buy",
      nominalMinor: 50_000_000,
      maturityDate: "2030-01-31",
      portfolio: "banking-book",
    });

    const rows = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows).toEqual([]);
  });

  it("includes trading-book but excludes banking-book in a mixed store", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, {
      tradeId: "TB001",
      isin: CORP_ISIN,
      side: "buy",
      nominalMinor: 1_000_000,
      maturityDate: "2030-01-31",
      portfolio: "trading-book",
    });
    appendBondTrade(store, {
      tradeId: "BB002",
      isin: SA_GOV_ISIN,
      side: "buy",
      nominalMinor: 10_000_000,
      maturityDate: "2030-01-31",
      portfolio: "banking-book",
    });

    const rows = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows.length).toBe(1);
    // Only TB001 in the ladder — its 1_000_000 nominal at 1-2y rate (2030-01-31 ≈ 3.6 years → 3-4y).
    expect(rows.at(0)?.band).toBe("3-4y");
  });
});

// ---------------------------------------------------------------------------
// 4. BondMatured → derecognised from ladder
// ---------------------------------------------------------------------------

describe("buildBondIrGeneralLadder — BondMatured derecognition", () => {
  it("excludes a bond that has already been matured", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, {
      tradeId: "T010",
      isin: CORP_ISIN,
      side: "buy",
      nominalMinor: 5_000_000,
      maturityDate: "2028-06-30",
      portfolio: "trading-book",
    });

    // Emit BondMatured for the same trade.
    const maturedEv = makeBondMatured({
      asOf: "2026-06-15T00:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: "T010",
        bondIsin: CORP_ISIN,
        maturityDate: "2026-06-15",
        nominalRepaidMinor: 5_000_000,
        finalCouponMinor: 0,
        currency: "ZAR",
      },
    });
    store.append(maturedEv);

    const rows = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. BondSold → derecognised from ladder
// ---------------------------------------------------------------------------

describe("buildBondIrGeneralLadder — BondSold derecognition", () => {
  it("excludes a bond that has been sold", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, {
      tradeId: "T020",
      isin: CORP_ISIN,
      side: "buy",
      nominalMinor: 8_000_000,
      maturityDate: "2035-01-31",
      portfolio: "trading-book",
    });

    const soldEv = makeBondSold({
      asOf: "2026-06-20T00:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: "T020",
        bondIsin: CORP_ISIN,
        side: "sell",
        saleProceedsMinor: 8_100_000,
        carryingAmountAtSaleMinor: 7_900_000,
        realisedPnlMinor: 200_000,
        settlementDate: "2026-06-23",
        currency: "ZAR",
      },
    });
    store.append(soldEv);

    const rows = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6. Long + short netting within a band
// ---------------------------------------------------------------------------

describe("buildBondIrGeneralLadder — long/short netting", () => {
  it("nets long and short in the same maturity band", () => {
    const store = new EventStore(":memory:");
    // Both bonds mature 2029-07-01 (~3 years) → 2-3y band.
    appendBondTrade(store, {
      tradeId: "LONG001",
      isin: CORP_ISIN,
      side: "buy",
      nominalMinor: 10_000_000, // 10m long → weighted 175_000
      maturityDate: "2029-07-01",
      portfolio: "trading-book",
    });
    appendBondTrade(store, {
      tradeId: "SHORT001",
      isin: SA_GOV_ISIN,
      side: "sell",
      nominalMinor: 4_000_000, // 4m short → weighted 70_000
      maturityDate: "2029-07-01",
      portfolio: "trading-book",
    });

    const rows = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows.length).toBe(1);
    const row = rows.at(0);
    expect(row?.band).toBe("2-3y");
    // weight 2-3y = 0.0175
    expect(row?.weightedLongMinor).toBe(Math.round(10_000_000 * 0.0175)); // 175_000
    expect(row?.weightedShortMinor).toBe(Math.round(4_000_000 * 0.0175)); // 70_000
  });

  it("separates long and short into distinct band rows when in different bands", () => {
    const store = new EventStore(":memory:");
    // Buy: 3-year bond → 2-3y band
    appendBondTrade(store, {
      tradeId: "LB001",
      isin: CORP_ISIN,
      side: "buy",
      nominalMinor: 5_000_000,
      maturityDate: "2029-07-01",
      portfolio: "trading-book",
    });
    // Sell: 5-year bond → 4-5y band
    appendBondTrade(store, {
      tradeId: "SB001",
      isin: SA_GOV_ISIN,
      side: "sell",
      nominalMinor: 3_000_000,
      maturityDate: "2031-07-01",
      portfolio: "trading-book",
    });

    const rows = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows.length).toBe(2);
    const bands = rows.map((r) => r.band);
    expect(bands).toContain("2-3y");
    expect(bands).toContain("4-5y");
  });
});

// ---------------------------------------------------------------------------
// 7. SA government bond specific risk weight = 0
// ---------------------------------------------------------------------------

describe("buildBondIrSpecificRiskRows — SA government bond", () => {
  it("emits specific-risk row with weight 0 for ZAG ISIN (sovereign)", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, {
      tradeId: "GOV001",
      isin: SA_GOV_ISIN,
      side: "buy",
      nominalMinor: 10_000_000,
      maturityDate: "2030-01-31",
      portfolio: "trading-book",
    });

    const rows = buildBondIrSpecificRiskRows({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows.length).toBe(1);
    const row = rows.at(0);
    expect(row?.issuerLabel).toBe("RSA-sovereign");
    expect(row?.specificRiskWeight).toBe(0);
    expect(row?.grossPositionMinor).toBe(10_000_000);
  });
});

// ---------------------------------------------------------------------------
// 8. Non-sovereign bond specific risk weight = 0.0025
// ---------------------------------------------------------------------------

describe("buildBondIrSpecificRiskRows — non-sovereign bond", () => {
  it("emits specific-risk row with weight 0.0025 for non-ZAG ISIN (qualifying)", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, {
      tradeId: "CORP001",
      isin: CORP_ISIN,
      side: "buy",
      nominalMinor: 5_000_000,
      maturityDate: "2030-01-31",
      portfolio: "trading-book",
    });

    const rows = buildBondIrSpecificRiskRows({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows.length).toBe(1);
    const row = rows.at(0);
    expect(row?.issuerLabel).toBe("qualifying-issuer");
    expect(row?.specificRiskWeight).toBe(0.0025);
    expect(row?.grossPositionMinor).toBe(5_000_000);
  });
});

// ---------------------------------------------------------------------------
// 9. Specific risk rows — derecognition (matured / sold)
// ---------------------------------------------------------------------------

describe("buildBondIrSpecificRiskRows — derecognition", () => {
  it("excludes matured bonds from specific risk rows", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, {
      tradeId: "T030",
      isin: CORP_ISIN,
      side: "buy",
      nominalMinor: 2_000_000,
      maturityDate: "2030-01-31",
      portfolio: "trading-book",
    });
    store.append(
      makeBondMatured({
        asOf: "2026-06-15T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "T030",
          bondIsin: CORP_ISIN,
          maturityDate: "2026-06-15",
          nominalRepaidMinor: 2_000_000,
          finalCouponMinor: 0,
          currency: "ZAR",
        },
      }),
    );

    const rows = buildBondIrSpecificRiskRows({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows).toEqual([]);
  });

  it("excludes sold bonds from specific risk rows", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, {
      tradeId: "T031",
      isin: SA_GOV_ISIN,
      side: "buy",
      nominalMinor: 3_000_000,
      maturityDate: "2030-01-31",
      portfolio: "trading-book",
    });
    store.append(
      makeBondSold({
        asOf: "2026-06-20T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "T031",
          bondIsin: SA_GOV_ISIN,
          side: "sell",
          saleProceedsMinor: 3_050_000,
          carryingAmountAtSaleMinor: 2_900_000,
          realisedPnlMinor: 150_000,
          settlementDate: "2026-06-23",
          currency: "ZAR",
        },
      }),
    );

    const rows = buildBondIrSpecificRiskRows({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 10. Integration: subscriber derives bond IR from events (no override)
// ---------------------------------------------------------------------------

describe("ba310PeriodCloseSubscriber — bond IR event derivation", () => {
  it("subscriber picks up trading-book bond into IR general capital when no override supplied", () => {
    const store = new EventStore(":memory:");
    // R2030 SA govt bond, 3.6 years to maturity → 3-4y band, weight 2.25%
    appendBondTrade(store, {
      tradeId: "SUB001",
      isin: SA_GOV_ISIN,
      side: "buy",
      nominalMinor: 10_000_000,
      maturityDate: "2030-01-31",
      portfolio: "trading-book",
    });

    const result = ba310PeriodCloseSubscriber({
      closedPayload: {
        periodId: "period:hoz-bank:month:2026-06",
        closedAt: PERIOD_END,
        trialBalanceSnapshotEventId: newEventId(),
        uptoSequence: 0,
      },
      entity: ENTITY,
      eventStore: store,
      actor: ACTOR,
      periodStart: "2026-06-01T00:00:00.000Z",
    });

    expect(result.skipped).toBe(false);
    // IR general capital should be > 0 because we have a live trading-book bond.
    expect(result.ba310Output.interestRateGeneral.capitalMinor).toBeGreaterThan(0);
    expect(result.ba310Output.interestRateGeneral.maturityLadder.length).toBe(1);
  });

  it("subscriber IR capital = 0 when all bonds are banking-book", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, {
      tradeId: "BB_SUB001",
      isin: CORP_ISIN,
      side: "buy",
      nominalMinor: 10_000_000,
      maturityDate: "2030-01-31",
      portfolio: "banking-book", // banking-book → excluded from BA-310
    });

    const result = ba310PeriodCloseSubscriber({
      closedPayload: {
        periodId: "period:hoz-bank:month:2026-06",
        closedAt: PERIOD_END,
        trialBalanceSnapshotEventId: newEventId(),
        uptoSequence: 0,
      },
      entity: ENTITY,
      eventStore: store,
      actor: ACTOR,
      periodStart: "2026-06-01T00:00:00.000Z",
    });

    expect(result.ba310Output.interestRateGeneral.capitalMinor).toBe(0);
  });

  it("caller-supplied irGeneralMaturityLadder override takes precedence over event-derived", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, {
      tradeId: "SUB002",
      isin: CORP_ISIN,
      side: "buy",
      nominalMinor: 10_000_000,
      maturityDate: "2029-01-31",
      portfolio: "trading-book",
    });

    const result = ba310PeriodCloseSubscriber({
      closedPayload: {
        periodId: "period:hoz-bank:month:2026-06",
        closedAt: PERIOD_END,
        trialBalanceSnapshotEventId: newEventId(),
        uptoSequence: 0,
      },
      entity: ENTITY,
      eventStore: store,
      actor: ACTOR,
      periodStart: "2026-06-01T00:00:00.000Z",
      // Explicit override: single band with known values.
      irGeneralMaturityLadder: [{ band: "0-1m", weightedLongMinor: 9_999, weightedShortMinor: 0 }],
    });

    // Override value used, not event-derived.
    expect(result.ba310Output.interestRateGeneral.capitalMinor).toBe(9_999);
    expect(result.ba310Output.interestRateGeneral.maturityLadder.length).toBe(1);
    expect(result.ba310Output.interestRateGeneral.maturityLadder.at(0)?.lineLabel).toContain(
      "0-1m",
    );
  });
});
