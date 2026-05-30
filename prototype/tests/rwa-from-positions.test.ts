// tests/rwa-from-positions.test.ts
//
// Tests for platform/projections/rwa-from-positions.ts
//
// Asserts:
//   1. Empty store → buildPhaseFallback: true, totalRwaMinor: 0, tradeCount: 0.
//   2. One BondTradeExecuted (ZAG gov bond) → non-zero credit RWA (0% weight → 0,
//      but trade IS counted; verify tradeCount > 0 and buildPhaseFallback: false).
//      NOTE: sovereign-domestic-currency has 0% RW — totalRwaMinor = 0 for a
//      gov-bond-only book is correct behaviour by CRE20 design.
//   3. One BondTradeExecuted (corporate, non-ZAG) → creditRwaMinor > 0 (65% weight).
//   4. One FxTradeExecuted → tradingBookPositions non-empty; market RWA > 0.
//   5. One RepoTradeOpened → creditRwaMinor > 0 (75% bank unrated weight).
//   6. One InterbankLoanPlaced (fixed-term) → creditRwaMinor > 0.
//   7. Mix of bond + FX → both credit and market RWA contribute; totalRwaMinor > 0.
//   8. computeCapitalMetrics on a store with trades returns buildPhase note
//      containing "live positions" RWA source message (not the ICAAP constant).
//   9. BondTradeExecuted side="sell" → not counted (no credit exposure on short).
//  10. toRwaDecomposition maps output to RwaDecomposition shape with correct source.
//
// Authority: D-RWA-LIVE-POSITIONS-PROJECTION-V1 (CEO-approved 2026-05-30)
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { newEventId } from "../platform/core/types";
import { makeBondTradeExecuted } from "../platform/event-store/event-types/bond-accounting";
import { makeRepoTradeOpened } from "../platform/event-store/event-types/repo-mmd-ibl";
import { makeInterbankLoanPlaced } from "../platform/event-store/event-types/repo-mmd-ibl";
import { EventStore } from "../platform/event-store/store";
import { makeFxTradeExecuted } from "../platform/markets/cdm/fx";
import { computeCapitalMetrics } from "../platform/projections/capital-metrics";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import {
  computeRwaFromPositions,
  toRwaDecomposition,
} from "../platform/projections/rwa-from-positions";

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-05-30T12:00:00.000Z";
const ACTOR = { type: "service" as const, id: "agent:test" };
const CITATIONS = ["D-RWA-LIVE-POSITIONS-PROJECTION-V1"];

// ---------------------------------------------------------------------------
// Provenance override — tests use untagged (simulated) events.
// ---------------------------------------------------------------------------

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function appendBondTrade(
  store: EventStore,
  opts: {
    isin?: string;
    nominalMinor?: number;
    side?: "buy" | "sell";
    counterpartyLei?: string;
  } = {},
): void {
  const isin = opts.isin ?? "ZAG000149037"; // SA gov bond default
  store.append(
    makeBondTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: `bond-${newEventId().slice(0, 8)}`,
        bondIsin: isin,
        side: opts.side ?? "buy",
        nominalMinor: opts.nominalMinor ?? 10_000_000_00, // R10m
        cleanPricePercent: 97.5,
        accruedInterestMinor: 100_000,
        dirtyPricePercent: 98.0,
        settlementDate: "2026-06-02",
        portfolio: "banking-book",
        couponRate: 0.085,
        maturityDate: "2030-01-31",
        currency: "ZAR",
        counterpartyLei: opts.counterpartyLei ?? "SBZAZAJJXXX",
        executedAt: AS_OF,
      },
    }),
  );
}

function appendRepoTrade(
  store: EventStore,
  opts: { startLegCashZar?: number; counterpartyLei?: string } = {},
): void {
  store.append(
    makeRepoTradeOpened({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: `repo-${newEventId().slice(0, 8)}`,
        counterpartyLei: opts.counterpartyLei ?? "ABSA-ZA-001",
        startLegSettlementDate: "2026-05-30",
        endLegSettlementDate: "2026-06-30",
        startLegCashZar: opts.startLegCashZar ?? 5_000_000_00, // R5m
        repurchasePriceZar: 5_020_000_00,
        repoRateDecimal: 0.0825,
        collateralIsin: "ZAG000149037",
        collateralFaceValue: 5_200_000_00,
        collateralHaircutPct: 2.0,
        bookId: "BOOK-TREASURY",
        traderRef: "trader:test",
        instrumentRef: "fi:repo:ZAR-001",
      },
    }),
  );
}

function appendIblTrade(
  store: EventStore,
  opts: { principalZar?: number; placementType?: "fixed-term" | "call" } = {},
): void {
  store.append(
    makeInterbankLoanPlaced({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        placementId: `ibl-${newEventId().slice(0, 8)}`,
        counterpartyLei: "NEDBANK-ZA-001",
        principalZar: opts.principalZar ?? 3_000_000_00, // R3m
        rateDecimal: 0.079,
        startDate: "2026-05-30",
        maturityDate: opts.placementType === "call" ? null : "2026-06-30",
        placementType: opts.placementType ?? "fixed-term",
        bookId: "BOOK-TREASURY",
        instrumentRef: "fi:ibl:ZAR-001",
      },
    }),
  );
}

function appendFxTrade(store: EventStore, opts: { notionalMinor?: number } = {}): void {
  store.append(
    makeFxTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "INTERNAL", value: `FX-TEST-${newEventId().slice(0, 8)}` },
        productTaxonomy: "FX-spot",
        currencyPair: { base: "USD", quote: "ZAR" },
        side: "buy",
        legs: [
          {
            legKind: "near",
            payCurrency: "ZAR",
            receiveCurrency: "USD",
            notional: { currency: "ZAR", amountMinor: opts.notionalMinor ?? 18_000_000 },
            counterNotional: { currency: "USD", amountMinor: 1_000_000 },
            rate: { currency: "ZAR", amount: 18 },
            settlementDate: { iso: "2026-06-01", calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: "2026-05-30", calendar: "JIHCAL" },
        counterparty: {
          partyId: "urn:party:legal-entity:standard-bank-za",
          name: "Standard Bank ZA",
          role: "counterparty",
          jurisdiction: "ZA",
        },
        venue: "OTC",
        trader: "trader:test",
        bookId: "BOOK-FX-MARKETS-LP",
        bookType: "trading",
        settlementForm: "physical",
        settlementPath: "correspondent",
        finsurvCategory: "ODP-001",
        clientFlowRef: "test:flow-001",
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// 1. Empty store → buildPhaseFallback
// ---------------------------------------------------------------------------

describe("rwa-from-positions — empty store", () => {
  it("returns buildPhaseFallback: true and tradeCount: 0", () => {
    const store = new EventStore(":memory:");
    const result = computeRwaFromPositions(store, AS_OF);

    expect(result.buildPhaseFallback).toBe(true);
    expect(result.tradeCount).toBe(0);
    expect(result.output.totalRwaMinor).toBe(0);
  });

  it("output has meta.engine = rwa-engine and totalRwaMinor = 0", () => {
    const store = new EventStore(":memory:");
    const result = computeRwaFromPositions(store, AS_OF);

    expect(result.output.meta.engine).toBe("rwa-engine");
    expect(result.output.meta.entityId).toBe("LE-ZA-HOZ-BANK");
    expect(result.output.totalRwaMinor).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. SA gov bond (ZAG ISIN) → 0% weight → credit RWA = 0, but trade counted
// ---------------------------------------------------------------------------

describe("rwa-from-positions — SA government bond (0% RW)", () => {
  it("books ZAG bond → tradeCount > 0, buildPhaseFallback: false", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, { isin: "ZAG000149037", nominalMinor: 10_000_000_00 });

    const result = computeRwaFromPositions(store, AS_OF);

    expect(result.buildPhaseFallback).toBe(false);
    expect(result.tradeCount).toBe(1);
  });

  it("ZAG bond contributes 0 credit RWA (sovereign-domestic-currency, 0% RW per CRE20)", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, { isin: "ZAG000149037", nominalMinor: 100_000_000_00 }); // R100m

    const result = computeRwaFromPositions(store, AS_OF);

    // 0% risk weight for SARB ZAR domestic sovereign → credit RWA = 0
    expect(result.output.credit.totalMinor).toBe(0);
    expect(result.output.totalRwaMinor).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Corporate bond (non-ZAG) → 65% RW → creditRwaMinor > 0
// ---------------------------------------------------------------------------

describe("rwa-from-positions — corporate bond (65% RW unrated IG)", () => {
  it("books corporate bond → creditRwaMinor = 65% of nominal", () => {
    const store = new EventStore(":memory:");
    const nominalMinor = 10_000_000_00; // R10m in cents
    appendBondTrade(store, { isin: "ZAR000123456", nominalMinor });

    const result = computeRwaFromPositions(store, AS_OF);

    expect(result.buildPhaseFallback).toBe(false);
    expect(result.tradeCount).toBe(1);
    // corporate-ig, unrated → RW = 0.65
    const expectedCreditRwa = Math.round(nominalMinor * 0.65);
    expect(result.output.credit.totalMinor).toBe(expectedCreditRwa);
    expect(result.output.totalRwaMinor).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. FxTradeExecuted → marketRwaMinor > 0
// ---------------------------------------------------------------------------

describe("rwa-from-positions — FX spot trade", () => {
  it("books FX spot trade → market RWA > 0, buildPhaseFallback: false", () => {
    const store = new EventStore(":memory:");
    appendFxTrade(store, { notionalMinor: 18_000_000 }); // R180,000 notional

    const result = computeRwaFromPositions(store, AS_OF);

    expect(result.buildPhaseFallback).toBe(false);
    expect(result.tradeCount).toBe(1);
    expect(result.output.market.totalMinor).toBeGreaterThan(0);
  });

  it("FX RWA = 12.5 × notional × FX-spot weight from registry", () => {
    const store = new EventStore(":memory:");
    const notionalMinor = 18_000_000;
    appendFxTrade(store, { notionalMinor });

    const result = computeRwaFromPositions(store, AS_OF);

    // market RWA = 12.5 × capitalCharge = 12.5 × notional × weight
    // The weight comes from the registry; just confirm > 0 and proportional.
    expect(result.output.market.totalMinor).toBeGreaterThan(0);
    // marketRWA / notionalMinor should equal 12.5 × weight (in some small range)
    const impliedWeight = result.output.market.totalMinor / (12.5 * notionalMinor);
    expect(impliedWeight).toBeGreaterThan(0);
    expect(impliedWeight).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 5. RepoTradeOpened → creditRwaMinor > 0 (bank 75% unrated)
// ---------------------------------------------------------------------------

describe("rwa-from-positions — repo trade (secured lending)", () => {
  it("books repo → creditRwaMinor > 0 (bank counterparty, 75% unrated long-term)", () => {
    const store = new EventStore(":memory:");
    const startLegCashZar = 5_000_000_00; // R5m
    appendRepoTrade(store, { startLegCashZar });

    const result = computeRwaFromPositions(store, AS_OF);

    expect(result.buildPhaseFallback).toBe(false);
    expect(result.tradeCount).toBe(1);
    // bank, unrated, long-term → RW = 0.75 per CRE20 (SCRA Grade B)
    const expectedCreditRwa = Math.round(startLegCashZar * 0.75);
    expect(result.output.credit.totalMinor).toBe(expectedCreditRwa);
  });
});

// ---------------------------------------------------------------------------
// 6. InterbankLoanPlaced → creditRwaMinor > 0
// ---------------------------------------------------------------------------

describe("rwa-from-positions — interbank loan placed", () => {
  it("fixed-term IBL → creditRwaMinor > 0 (bank, long-term, 75%)", () => {
    const store = new EventStore(":memory:");
    const principalZar = 3_000_000_00; // R3m
    appendIblTrade(store, { principalZar, placementType: "fixed-term" });

    const result = computeRwaFromPositions(store, AS_OF);

    expect(result.buildPhaseFallback).toBe(false);
    expect(result.tradeCount).toBe(1);
    const expectedCreditRwa = Math.round(principalZar * 0.75);
    expect(result.output.credit.totalMinor).toBe(expectedCreditRwa);
  });

  it("call IBL → creditRwaMinor > 0 (short-term, lower weight)", () => {
    const store = new EventStore(":memory:");
    const principalZar = 3_000_000_00;
    appendIblTrade(store, { principalZar, placementType: "call" });

    const result = computeRwaFromPositions(store, AS_OF);

    expect(result.buildPhaseFallback).toBe(false);
    // bank, unrated, short-term → RW = 0.50 per CRE20 (SCRA Grade B short-term)
    const expectedCreditRwa = Math.round(principalZar * 0.5);
    expect(result.output.credit.totalMinor).toBe(expectedCreditRwa);
  });
});

// ---------------------------------------------------------------------------
// 7. Mixed book: corporate bond + FX → both credit + market RWA
// ---------------------------------------------------------------------------

describe("rwa-from-positions — mixed book", () => {
  it("corporate bond + FX trade → credit RWA + market RWA both > 0", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, { isin: "ZAR000123456", nominalMinor: 10_000_000_00 });
    appendFxTrade(store, { notionalMinor: 18_000_000 });

    const result = computeRwaFromPositions(store, AS_OF);

    expect(result.buildPhaseFallback).toBe(false);
    expect(result.tradeCount).toBe(2);
    expect(result.output.credit.totalMinor).toBeGreaterThan(0);
    expect(result.output.market.totalMinor).toBeGreaterThan(0);
    expect(result.output.totalRwaMinor).toBe(
      result.output.credit.totalMinor +
        result.output.market.totalMinor +
        result.output.operational.totalMinor,
    );
  });
});

// ---------------------------------------------------------------------------
// 8. computeCapitalMetrics uses live RWA when trades are present
// ---------------------------------------------------------------------------

describe("rwa-from-positions — capital-metrics integration", () => {
  it("store with trades → capital metrics note contains 'live positions'", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, { isin: "ZAR000123456", nominalMinor: 10_000_000_00 });

    const metrics = computeCapitalMetrics(store, AS_OF);

    // With trades in the store, the RWA source should be "live-positions"
    // The note string contains the RWA source message.
    expect(metrics.note).toContain("live positions");
  });

  it("empty store → capital metrics falls back to ICAAP constant", () => {
    const store = new EventStore(":memory:");
    const metrics = computeCapitalMetrics(store, AS_OF);

    // No trades → fallback active → note contains fallback message
    expect(metrics.note).toContain("ICAAP v1");
  });
});

// ---------------------------------------------------------------------------
// 9. Bond side="sell" → not counted as credit exposure
// ---------------------------------------------------------------------------

describe("rwa-from-positions — bond sell not counted", () => {
  it("BondTradeExecuted side=sell → not included in credit exposures", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, { isin: "ZAR000123456", side: "sell", nominalMinor: 10_000_000_00 });

    const result = computeRwaFromPositions(store, AS_OF);

    // A sell does not create an asset credit exposure on the bank's books.
    expect(result.buildPhaseFallback).toBe(true);
    expect(result.tradeCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 10. toRwaDecomposition helper maps output correctly
// ---------------------------------------------------------------------------

describe("toRwaDecomposition", () => {
  it("buildPhaseFallback=true → source: 'fixture-rehearsal'", () => {
    const store = new EventStore(":memory:");
    const result = computeRwaFromPositions(store, AS_OF);

    const decomp = toRwaDecomposition(result);
    expect(decomp.source).toBe("fixture-rehearsal");
    expect(decomp.creditRwaMinor).toBe(0);
  });

  it("live positions → source: 'live-positions' and credit > 0", () => {
    const store = new EventStore(":memory:");
    appendBondTrade(store, { isin: "ZAR000123456", nominalMinor: 10_000_000_00 });

    const result = computeRwaFromPositions(store, AS_OF);
    const decomp = toRwaDecomposition(result);

    expect(decomp.source).toBe("live-positions");
    expect(decomp.creditRwaMinor).toBeGreaterThan(0);
  });
});
