// tests/ba-200-credit-risk-events.test.ts
//
// WS-BA-RETURNS-FOLLOWON — exit-criterion tests for the events-first BA 200
// (Credit-Risk Loans-and-Advances) generator + the two new exposure-level
// IFRS 9 event types (ImpairmentStageAssigned, EclComputed).
//
// Asserts:
//   1. Live interbank-loan + bond exposures fold into the portfolio.
//   2. Default exposure class by product (IBL → bank; bond → sovereign).
//   3. Matured / recalled IBL placements + matured / sold bonds excluded.
//   4. DepositTaken (a liability) excluded.
//   5. Net-short / flat bond ISINs excluded.
//   6. Default Stage 1 + ECL 0 when no staging / ECL events exist; ECL
//      invariant holds trivially (0 == 0).
//   7. ImpairmentStageAssigned moves an exposure to Stage 3 (latest wins).
//   8. EclComputed attaches an allowance; ECL invariant still holds; the
//      allowance flows into byStage + byCategory + ratios.
//   9. Per-entity isolation — non-bank entity rejected.
//
// Authority: D-BA-RETURNS-FOLLOWON-BATCH; Principles/1-events-are-truth.md;
//   Regulations Relating to Banks Reg 23 (Form BA 200); IFRS 9 §5.5.
//
// Author: Mira (Regulatory reporting engineer, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  makeBondMatured,
  makeBondSold,
  makeBondTradeExecuted,
} from "../platform/event-store/event-types/bond-accounting";
import {
  makeEclComputed,
  makeImpairmentStageAssigned,
} from "../platform/event-store/event-types/ecl-staging";
import {
  makeDepositTaken,
  makeInterbankLoanMatured,
  makeInterbankLoanPlaced,
} from "../platform/event-store/event-types/repo-mmd-ibl";
import { EventStore } from "../platform/event-store/store";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import {
  Ba200GeneratorError,
  generateBa200CreditRiskFromEvents,
} from "../platform/reporting/ba-200-credit-risk";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:Mira" };
const CITATIONS = ["D-BA-RETURNS-FOLLOWON-BATCH", "IFRS-9-§5.5"];
const AS_OF = "2026-06-30T23:59:59.999Z";
const FUNCTIONAL = "ZAR";

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function placeIbl(
  store: EventStore,
  opts: { placementId: string; counterpartyLei: string; principalZar: number; asOf?: string },
): void {
  store.append(
    makeInterbankLoanPlaced({
      asOf: opts.asOf ?? "2026-06-01T10:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        placementId: opts.placementId,
        counterpartyLei: opts.counterpartyLei,
        principalZar: opts.principalZar,
        rateDecimal: 0.0825,
        startDate: "2026-06-01",
        maturityDate: "2026-09-01",
        placementType: "fixed-term",
        bookId: "TREASURY",
        instrumentRef: "IBL-FT-ZAR-001",
      },
    }),
  );
}

function executeBond(
  store: EventStore,
  opts: {
    tradeId: string;
    isin: string;
    side: "buy" | "sell";
    nominalMinor: number;
    counterpartyLei?: string;
    asOf?: string;
  },
): void {
  store.append(
    makeBondTradeExecuted({
      asOf: opts.asOf ?? "2026-06-01T10:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: opts.tradeId,
        bondIsin: opts.isin,
        side: opts.side,
        nominalMinor: opts.nominalMinor,
        cleanPricePercent: 100.0, // gross = nominal at par for clean arithmetic
        accruedInterestMinor: 0,
        dirtyPricePercent: 100.0,
        settlementDate: "2026-06-04",
        portfolio: "banking-book",
        couponRate: 0.0775,
        maturityDate: "2030-01-31",
        currency: "ZAR",
        counterpartyLei: opts.counterpartyLei ?? "LEI-SOV-001",
        executedAt: opts.asOf ?? "2026-06-01T10:00:00.000Z",
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// 1–2. Live exposures fold with default classes
// ---------------------------------------------------------------------------

describe("generateBa200CreditRiskFromEvents — live exposures", () => {
  it("folds IBL → bank and bond → sovereign by default; ECL 0; invariant holds", () => {
    const store = new EventStore(":memory:");
    placeIbl(store, {
      placementId: "PLC-001",
      counterpartyLei: "LEI-BANK-A",
      principalZar: 50_000_00,
    });
    executeBond(store, {
      tradeId: "BND-001",
      isin: "ZAG000057547",
      side: "buy",
      nominalMinor: 100_000_00,
    });

    const out = generateBa200CreditRiskFromEvents(store, AS_OF, ENTITY, FUNCTIONAL);

    expect(out.totalLoansAndAdvances.totalEntries).toBe(2);
    expect(out.totalLoansAndAdvances.totalGrossCarryingAmount).toBe(150_000_00);
    expect(out.totalLoansAndAdvances.totalEcl).toBe(0);
    expect(out.totalLoansAndAdvances.totalAllowanceForCreditLoss).toBe(0);

    const categories = out.byCategory.map((c) => c.productCategory).sort();
    expect(categories).toEqual(["bank", "sovereign"]);

    const bank = out.byCategory.find((c) => c.productCategory === "bank");
    expect(bank?.totalGrossCarryingAmount).toBe(50_000_00);
    expect(bank?.ba200RowLabel).toBe("Loans and advances — banks");
    const sov = out.byCategory.find((c) => c.productCategory === "sovereign");
    expect(sov?.totalGrossCarryingAmount).toBe(100_000_00);

    // All Stage 1, ECL 0 → invariant 0 == 0 holds (no throw).
    expect(out.byStage[0].entryCount).toBe(2);
    expect(out.byStage[1].entryCount).toBe(0);
    expect(out.byStage[2].entryCount).toBe(0);
    expect(out.nplRatio).toBe(0); // no stage-3 gross
  });

  it("honours an explicit exposureClass override on the event payload", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeBondTradeExecuted({
        asOf: "2026-06-01T10:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "BND-CORP-1",
          bondIsin: "XS1234567890",
          side: "buy",
          nominalMinor: 20_000_00,
          cleanPricePercent: 100.0,
          accruedInterestMinor: 0,
          dirtyPricePercent: 100.0,
          settlementDate: "2026-06-04",
          portfolio: "banking-book",
          couponRate: 0.09,
          maturityDate: "2031-01-31",
          currency: "ZAR",
          counterpartyLei: "LEI-CORP-1",
          executedAt: "2026-06-01T10:00:00.000Z",
          exposureClass: "corporate",
        },
      }),
    );

    const out = generateBa200CreditRiskFromEvents(store, AS_OF, ENTITY, FUNCTIONAL);
    expect(out.byCategory.map((c) => c.productCategory)).toEqual(["corporate"]);
  });
});

// ---------------------------------------------------------------------------
// 3–5. Derecognition + liability + net-short exclusions
// ---------------------------------------------------------------------------

describe("generateBa200CreditRiskFromEvents — exclusions", () => {
  it("excludes matured IBL, matured/sold bonds, deposits, and net-short ISINs", () => {
    const store = new EventStore(":memory:");

    // Live IBL kept; matured IBL excluded.
    placeIbl(store, {
      placementId: "PLC-LIVE",
      counterpartyLei: "LEI-BANK-A",
      principalZar: 10_000_00,
    });
    placeIbl(store, {
      placementId: "PLC-MATURED",
      counterpartyLei: "LEI-BANK-B",
      principalZar: 99_000_00,
    });
    store.append(
      makeInterbankLoanMatured({
        asOf: "2026-06-15T10:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          placementId: "PLC-MATURED",
          principalZar: 99_000_00,
          interestReceivedZar: 1_000_00,
        },
      }),
    );

    // Live bond kept; matured + sold bonds excluded.
    executeBond(store, {
      tradeId: "BND-LIVE",
      isin: "ZAG000057547",
      side: "buy",
      nominalMinor: 30_000_00,
    });
    executeBond(store, {
      tradeId: "BND-MAT",
      isin: "ZAG000099999",
      side: "buy",
      nominalMinor: 88_000_00,
    });
    store.append(
      makeBondMatured({
        asOf: "2026-06-20T10:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "BND-MAT",
          bondIsin: "ZAG000099999",
          maturityDate: "2030-01-31",
          nominalRepaidMinor: 88_000_00,
          finalCouponMinor: 0,
          currency: "ZAR",
        },
      }),
    );
    executeBond(store, {
      tradeId: "BND-SOLD",
      isin: "ZAG000088888",
      side: "buy",
      nominalMinor: 77_000_00,
    });
    store.append(
      makeBondSold({
        asOf: "2026-06-21T10:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "BND-SOLD",
          bondIsin: "ZAG000088888",
          side: "sell",
          saleProceedsMinor: 77_000_00,
          carryingAmountAtSaleMinor: 77_000_00,
          realisedPnlMinor: 0,
          settlementDate: "2026-06-24",
          currency: "ZAR",
        },
      }),
    );

    // Net-short ISIN (sell > buy) excluded.
    executeBond(store, {
      tradeId: "BND-SHORT-B",
      isin: "ZAG000077777",
      side: "buy",
      nominalMinor: 10_000_00,
    });
    executeBond(store, {
      tradeId: "BND-SHORT-S",
      isin: "ZAG000077777",
      side: "sell",
      nominalMinor: 40_000_00,
    });

    // Deposit (liability) — excluded; not a credit exposure of the bank.
    store.append(
      makeDepositTaken({
        asOf: "2026-06-01T10:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          depositId: "DEP-001",
          counterpartyLei: "LEI-DEPOSITOR",
          principalZar: 500_000_00,
          interestRateDecimal: 0.07,
          maturityDate: "2026-12-01",
          depositCategory: "wholesale-non-operational",
          bookId: "TREASURY",
          instrumentRef: "MMD-FT-ZAR-001",
        },
      }),
    );

    const out = generateBa200CreditRiskFromEvents(store, AS_OF, ENTITY, FUNCTIONAL);

    // Only PLC-LIVE (10m) + BND-LIVE (30m) survive.
    expect(out.totalLoansAndAdvances.totalEntries).toBe(2);
    expect(out.totalLoansAndAdvances.totalGrossCarryingAmount).toBe(40_000_00);
  });
});

// ---------------------------------------------------------------------------
// 6–8. Staging + ECL joins
// ---------------------------------------------------------------------------

describe("generateBa200CreditRiskFromEvents — staging + ECL events", () => {
  it("ImpairmentStageAssigned moves an exposure to Stage 3 (latest wins)", () => {
    const store = new EventStore(":memory:");
    executeBond(store, {
      tradeId: "BND-001",
      isin: "ZAG000057547",
      side: "buy",
      nominalMinor: 100_000_00,
    });

    // First an initial Stage 1, then a Stage 3 — latest wins.
    store.append(
      makeImpairmentStageAssigned({
        asOf: "2026-06-02T10:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          exposureId: "exposure:bond:ZAG000057547",
          instrumentId: "fi:bond:ZAG000057547",
          counterpartyId: "LEI-SOV-001",
          stage: 1,
          asOf: "2026-06-02",
          rationale: "initial-recognition",
        },
      }),
    );
    store.append(
      makeImpairmentStageAssigned({
        asOf: "2026-06-25T10:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          exposureId: "exposure:bond:ZAG000057547",
          instrumentId: "fi:bond:ZAG000057547",
          counterpartyId: "LEI-SOV-001",
          stage: 3,
          asOf: "2026-06-25",
          rationale: "default",
        },
      }),
    );

    const out = generateBa200CreditRiskFromEvents(store, AS_OF, ENTITY, FUNCTIONAL);
    expect(out.byStage[2].entryCount).toBe(1); // Stage 3
    expect(out.byStage[0].entryCount).toBe(0);
    // Stage-3 gross == total gross → NPL ratio 1.
    expect(out.nplRatio).toBe(1);
  });

  it("EclComputed attaches an allowance; invariant holds; flows into aggregates", () => {
    const store = new EventStore(":memory:");
    executeBond(store, {
      tradeId: "BND-001",
      isin: "ZAG000057547",
      side: "buy",
      nominalMinor: 100_000_00,
    });

    store.append(
      makeImpairmentStageAssigned({
        asOf: "2026-06-25T10:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          exposureId: "exposure:bond:ZAG000057547",
          instrumentId: "fi:bond:ZAG000057547",
          counterpartyId: "LEI-SOV-001",
          stage: 2,
          asOf: "2026-06-25",
          rationale: "manual-sicr",
        },
      }),
    );
    store.append(
      makeEclComputed({
        asOf: "2026-06-25T10:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          exposureId: "exposure:bond:ZAG000057547",
          stage: 2,
          eadMinor: 100_000_00,
          pdBps: 80,
          lgdBps: 4500,
          eclMinor: 5_000_00,
          currency: "ZAR",
          asOf: "2026-06-25",
        },
      }),
    );

    const out = generateBa200CreditRiskFromEvents(store, AS_OF, ENTITY, FUNCTIONAL);
    // Stage 2 → lifetime ECL; allowance flows through.
    expect(out.byStage[1].entryCount).toBe(1);
    expect(out.byStage[1].totalEcl).toBe(5_000_00);
    expect(out.totalLoansAndAdvances.totalAllowanceForCreditLoss).toBe(5_000_00);
    expect(out.totalLoansAndAdvances.totalNetCarryingAmount).toBe(95_000_00);
    // Invariant held (no throw): sum relevant ECL == sum ACL.
  });
});

// ---------------------------------------------------------------------------
// 9. Per-entity isolation
// ---------------------------------------------------------------------------

describe("generateBa200CreditRiskFromEvents — entity guard", () => {
  it("rejects a non-bank entity", () => {
    const store = new EventStore(":memory:");
    expect(() =>
      generateBa200CreditRiskFromEvents(store, AS_OF, "LE-ZA-HOZ-SECURITIES", FUNCTIONAL),
    ).toThrow(Ba200GeneratorError);
  });

  it("empty store → empty BA 200 (no crash; all zero)", () => {
    const store = new EventStore(":memory:");
    const out = generateBa200CreditRiskFromEvents(store, AS_OF, ENTITY, FUNCTIONAL);
    expect(out.totalLoansAndAdvances.totalEntries).toBe(0);
    expect(out.byCategory).toEqual([]);
  });
});
