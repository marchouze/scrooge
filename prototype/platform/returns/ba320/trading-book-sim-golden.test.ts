// platform/returns/ba320/trading-book-sim-golden.test.ts
//
// SIMULATOR-FIRST TRADING BOOK — Phase 1 golden-case validation
// (D-BA-RETURN-SIMULATOR-FIRST).
//
// Drives the BA 320 standardised-position-risk engine to NON-ZERO outputs across
// the equity, commodity and IR risk classes via the born-V2 trading-book
// position event streams (equity / commodity adapters) + the existing bond
// adapter (IR), and asserts the engine lands on HAND-COMPUTED golden-case figures
// per Reg 28(3)(a) / BCBS D352 §718 — a domain-truth oracle, NOT internal
// consistency. A consistent-but-wrong charge is a finding.
//
// It ALSO proves the provenance boundary (the R300m-into-Prod lesson):
//   - PRODUCTION-ONLY read of a store of simulated positions → 0 charge.
//   - SIMULATED-inclusive read of the same store → the golden-case charges.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   Regulations Relating to Banks Reg 28(3)(a); BCBS D352 §718(xi)–(xv);
//   D-FRTB-TRADING-DESK-STRUCTURE; D-PROVENANCE-FILTER-ENFORCEMENT.
//
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { money } from "../../core/decimal-money";
import { encodeMoney } from "../../core/money-codec";
import { ZAR } from "../../core/types";
import { makeBondTradeExecuted } from "../../event-store/event-types/bond-accounting";
import {
  makeCommodityTradingPositionOpened,
  makeEquityTradingPositionOpened,
} from "../../event-store/event-types/trading-book-positions";
import { buildPhaseFixtureTag, simulatedTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import { eventSchema } from "../../event-store/types";
import { setDefaultProvenanceModeOverride } from "../../projections/filter";
import { buildCommodityRows } from "../../reporting/ba-320-commodity-events-adapter";
import { buildEquityRows } from "../../reporting/ba-320-equity-events-adapter";
import { generateBa320MarketRisk } from "../../reporting/ba-320-market-risk";
import { ba320PeriodCloseSubscriber } from "./period-close-subscriber";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:atlas:test" };
const CITES = ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-28"];
const PERIOD_END = "2026-06-30";
const TRADING_DESK = "desk:trading-desk:trading-desk-1";

const SIM = simulatedTag({
  scenario: "trading-book-sim-v1",
  sourceLineage: "platform/returns/ba320/trading-book-sim-golden.test.ts",
});

// ---------------------------------------------------------------------------
// Event-builders for the test book.
// ---------------------------------------------------------------------------

function equityEvent(args: {
  positionId: string;
  market: string;
  side: "long" | "short";
  marketValueMajor: string;
  liquidAndDiversified: boolean;
  isIndex?: boolean;
}) {
  return makeEquityTradingPositionOpened({
    asOf: PERIOD_END,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    eventId: `EQ-${args.positionId}`,
    provenance: SIM,
    payload: {
      positionId: args.positionId,
      instrumentId: `ISIN-${args.positionId}`,
      instrumentName: `${args.positionId} (sim)`,
      market: args.market,
      isIndex: args.isIndex ?? false,
      side: args.side,
      quantity: 1000,
      marketValue: encodeMoney(money(args.marketValueMajor, ZAR)),
      liquidAndDiversified: args.liquidAndDiversified,
      deskId: TRADING_DESK,
      bookType: "trading",
      openedDate: PERIOD_END,
    },
  });
}

function commodityEvent(args: {
  positionId: string;
  commodity: string;
  side: "long" | "short";
  marketValueMajor: string;
}) {
  return makeCommodityTradingPositionOpened({
    asOf: PERIOD_END,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    eventId: `CM-${args.positionId}`,
    provenance: SIM,
    payload: {
      positionId: args.positionId,
      commodity: args.commodity,
      commodityName: `${args.commodity} (sim)`,
      group: "precious-metals",
      side: args.side,
      quantity: 1000,
      marketValue: encodeMoney(money(args.marketValueMajor, ZAR)),
      deskId: TRADING_DESK,
      bookType: "trading",
      openedDate: PERIOD_END,
    },
  });
}

function bondEvent(args: {
  tradeId: string;
  bondIsin: string;
  nominalMajor: string;
  maturityDate: string;
  portfolio: "trading-book" | "banking-book";
}) {
  const base = makeBondTradeExecuted({
    asOf: PERIOD_END,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    eventId: `BD-${args.tradeId}`,
    payload: {
      tradeId: args.tradeId,
      bondIsin: args.bondIsin,
      side: "buy",
      nominalMinor: Math.round(Number(money(args.nominalMajor, ZAR).amount) * 100),
      cleanPricePercent: 100,
      accruedInterestMinor: 0,
      dirtyPricePercent: 100,
      settlementDate: PERIOD_END,
      portfolio: args.portfolio,
      couponRate: 0.085,
      maturityDate: args.maturityDate,
      currency: "ZAR",
      counterpartyLei: "SIM00000000000000TST1",
      executedAt: `${PERIOD_END}T00:00:00.000Z`,
      bookDesignation: args.portfolio === "trading-book" ? "trading" : "banking",
    },
  });
  return eventSchema.parse({ ...base, provenance: SIM });
}

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ===========================================================================
// EQUITY golden case (Reg 28(3)(a); BCBS D352 §718(xi)–(xii))
//
//   JSE: long R10,000,000 + short R4,000,000 single-names (NOT diversified)
//     net = R6,000,000 ; gross = R14,000,000
//     general  = 8% × |6,000,000| = R480,000
//     specific = 8% × 14,000,000  = R1,120,000   (not diversified → 8%)
//     equity charge = R1,600,000  (= 160,000,000 minor cents)
// ===========================================================================

describe("BA320 sim — EQUITY golden case (Reg 28(3)(a); §718(xi)–(xii))", () => {
  it("folds JSE single-name long/short to the hand-computed R1,600,000 charge", () => {
    const store = new EventStore(":memory:");
    store.append(
      equityEvent({
        positionId: "JSE-A-LONG",
        market: "JSE",
        side: "long",
        marketValueMajor: "10000000",
        liquidAndDiversified: false,
      }),
    );
    store.append(
      equityEvent({
        positionId: "JSE-B-SHORT",
        market: "JSE",
        side: "short",
        marketValueMajor: "4000000",
        liquidAndDiversified: false,
      }),
    );

    const rows = buildEquityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore: store });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.market).toBe("JSE");
    expect(rows[0]?.netLongMinusShortMinor).toBe(600_000_000); // R6,000,000 in cents
    expect(rows[0]?.grossLongPlusShortMinor).toBe(1_400_000_000); // R14,000,000 in cents
    expect(rows[0]?.liquidAndDiversified).toBe(false);

    const out = generateBa320MarketRisk({
      entity: ENTITY,
      asOf: PERIOD_END,
      periodId: "period:hoz-bank:month:2026-06",
      functionalCurrency: "ZAR",
      irGeneralMaturityLadder: [],
      irSpecificRisk: [],
      equity: rows,
      fxPositions: [],
      commodity: [],
    });

    // general 48,000,000 + specific 112,000,000 = 160,000,000 minor = R1,600,000
    expect(out.equity.capitalMinor).toBe(160_000_000);
  });

  it("a banking-book-style position is excluded (only trading enters BA 320)", () => {
    const store = new EventStore(":memory:");
    // Same market value but booked banking — the adapter must drop it.
    const bankingEv = makeEquityTradingPositionOpened({
      asOf: PERIOD_END,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      eventId: "EQ-BANKING",
      provenance: SIM,
      payload: {
        positionId: "BANKING",
        instrumentId: "ISIN-BANKING",
        instrumentName: "banking (sim)",
        market: "JSE",
        isIndex: false,
        side: "long",
        quantity: 1000,
        marketValue: encodeMoney(money("99000000", ZAR)),
        liquidAndDiversified: false,
        deskId: "desk:treasury-desk:treasury-desk-1",
        bookType: "banking-treasury",
        openedDate: PERIOD_END,
      },
    });
    store.append(bankingEv);
    const rows = buildEquityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore: store });
    expect(rows).toHaveLength(0);
  });
});

// ===========================================================================
// COMMODITY golden case (Reg 28(3)(a); BCBS D352 §718(xv) — simplified method)
//
//   XPT: long R5,000,000 + short R2,000,000 → net R3,000,000 ; gross R7,000,000
//     charge = 15% × |3,000,000| + 3% × 7,000,000 = 450,000 + 210,000 = R660,000
//            = 66,000,000 minor cents
// ===========================================================================

describe("BA320 sim — COMMODITY golden case (Reg 28(3)(a); §718(xv))", () => {
  it("folds platinum long/short to the hand-computed R660,000 charge", () => {
    const store = new EventStore(":memory:");
    store.append(
      commodityEvent({
        positionId: "XPT-LONG",
        commodity: "XPT",
        side: "long",
        marketValueMajor: "5000000",
      }),
    );
    store.append(
      commodityEvent({
        positionId: "XPT-SHORT",
        commodity: "XPT",
        side: "short",
        marketValueMajor: "2000000",
      }),
    );

    const rows = buildCommodityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore: store });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.commodity).toBe("XPT");
    expect(rows[0]?.netPositionMinor).toBe(300_000_000); // R3,000,000 cents
    expect(rows[0]?.grossPositionMinor).toBe(700_000_000); // R7,000,000 cents

    const out = generateBa320MarketRisk({
      entity: ENTITY,
      asOf: PERIOD_END,
      periodId: "period:hoz-bank:month:2026-06",
      functionalCurrency: "ZAR",
      irGeneralMaturityLadder: [],
      irSpecificRisk: [],
      equity: [],
      fxPositions: [],
      commodity: rows,
    });

    // 0.15×300,000,000 + 0.03×700,000,000 = 45,000,000 + 21,000,000 = 66,000,000
    expect(out.commodity.capitalMinor).toBe(66_000_000);
  });
});

// ===========================================================================
// IR general golden case (Reg 28(3)(a) Table A — maturity method)
//
//   SA gov bond, trading-book, R100,000,000 nominal, ~6y residual → band 5-7y
//   (riskWeight 0.0325). weighted = R3,250,000. One band, one side → no
//   disallowance. IR-general capital = R3,250,000 (= 325,000,000 minor cents).
//   SA gov specific weight 0 → IR-specific = R0.
// ===========================================================================

describe("BA320 sim — IR general golden case via the bond adapter (Reg 28(3)(a) Table A)", () => {
  it("drives a trading-book SA gov bond to the R3,250,000 IR-general charge", () => {
    const store = new EventStore(":memory:");
    store.append(
      bondEvent({
        tradeId: "RSA-R2032",
        bondIsin: "ZAG000150001",
        nominalMajor: "100000000",
        maturityDate: "2032-06-26",
        portfolio: "trading-book",
      }),
    );

    const result = ba320PeriodCloseSubscriber({
      closedPayload: {
        periodId: "period:hoz-bank:month:2026-06",
        closedAt: `${PERIOD_END}T00:00:00.000Z`,
        trialBalanceSnapshotEventId: "tb-test",
        uptoSequence: 0,
      },
      entity: ENTITY,
      eventStore: store,
      actor: ACTOR,
      periodStart: "2026-06-01T00:00:00.000Z",
    });

    // R100,000,000 × 0.0325 = R3,250,000 = 325,000,000 minor cents.
    expect(result.ba320Output.interestRateGeneral.capitalMinor).toBe(325_000_000);
    // SA gov specific weight 0 → no specific charge.
    expect(result.ba320Output.interestRateSpecific.capitalMinor).toBe(0);
  });

  it("a banking-book bond is excluded from BA 320 IR (it is IRRBB / BA 330)", () => {
    const store = new EventStore(":memory:");
    store.append(
      bondEvent({
        tradeId: "RSA-BANKING",
        bondIsin: "ZAG000150002",
        nominalMajor: "100000000",
        maturityDate: "2032-06-26",
        portfolio: "banking-book",
      }),
    );
    const result = ba320PeriodCloseSubscriber({
      closedPayload: {
        periodId: "period:hoz-bank:month:2026-06",
        closedAt: `${PERIOD_END}T00:00:00.000Z`,
        trialBalanceSnapshotEventId: "tb-test",
        uptoSequence: 0,
      },
      entity: ENTITY,
      eventStore: store,
      actor: ACTOR,
      periodStart: "2026-06-01T00:00:00.000Z",
    });
    expect(result.ba320Output.interestRateGeneral.capitalMinor).toBe(0);
  });
});

// ===========================================================================
// PROVENANCE BOUNDARY — production-only read = 0; simulated read = charges.
// (The R300m-into-Prod regression guard.)
// ===========================================================================

describe("BA320 sim — provenance boundary (production read stays 0)", () => {
  it("PRODUCTION-ONLY read of a simulated book folds to ZERO equity + commodity", () => {
    const store = new EventStore(":memory:");
    store.append(
      equityEvent({
        positionId: "JSE-PROD-TEST",
        market: "JSE",
        side: "long",
        marketValueMajor: "10000000",
        liquidAndDiversified: false,
      }),
    );
    store.append(
      commodityEvent({
        positionId: "XPT-PROD-TEST",
        commodity: "XPT",
        side: "long",
        marketValueMajor: "5000000",
      }),
    );

    // PRODUCTION-only read: the default provenance filter excludes simulated.
    setDefaultProvenanceModeOverride("production-only");
    const equityProd = buildEquityRows({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    const commodityProd = buildCommodityRows({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(equityProd).toHaveLength(0);
    expect(commodityProd).toHaveLength(0);

    // SIMULATED-inclusive read: the same store yields the positions.
    setDefaultProvenanceModeOverride("combined");
    const equitySim = buildEquityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore: store });
    const commoditySim = buildCommodityRows({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(equitySim.length).toBeGreaterThan(0);
    expect(commoditySim.length).toBeGreaterThan(0);
  });

  it("a real build-phase-fixture position WOULD survive the production read (boundary is on simulated, not on non-production)", () => {
    // Sanity: the boundary excludes SIMULATED, not build-phase-fixture. A genuine
    // build-phase position (not a scenario) is admitted by production-grade
    // filters — proving the filter discriminates on provenance KIND, not a blunt
    // "anything non-live = 0".
    const store = new EventStore(":memory:");
    const fixtureEv = eventSchema.parse({
      ...equityEvent({
        positionId: "JSE-FIXTURE",
        market: "JSE",
        side: "long",
        marketValueMajor: "1000000",
        liquidAndDiversified: false,
      }),
      provenance: buildPhaseFixtureTag({
        sourceLineage: "platform/returns/ba320/trading-book-sim-golden.test.ts",
      }),
    });
    store.append(fixtureEv);
    setDefaultProvenanceModeOverride("production-only");
    const rows = buildEquityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore: store });
    setDefaultProvenanceModeOverride("combined");
    expect(rows).toHaveLength(1);
  });
});
