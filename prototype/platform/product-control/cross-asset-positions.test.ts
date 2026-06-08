// platform/product-control/cross-asset-positions.test.ts
//
// Unit tests for the cross-asset Product Control breakdown. Covers:
//   1. FX byte-parity — an FX Spot live position surfaces in the "fx" bucket
//      with unrealised = the daily-pnl reval, folded into the markable total.
//   2. FX Forward — an FX-forward trade lands in the SAME "fx" bucket (Marc's
//      requirement: the FX asset class spans Spot AND Forward), carrying its
//      taxonomy so the UI can distinguish them.
//   3. Bond UNMARKED — a bond with no production mark is absent (no silent 0):
//      in unmarkableKeys, excluded from the total, and the total + its book both
//      declare themselves incomplete.
//   4. Book aggregation — instrument rows roll up to one row per book.
//   5. Empty store — present(0) total, no rows.
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import { makeBondTradeExecuted } from "../event-store/event-types/bond-accounting";
import { makeFxPositionRevalued } from "../event-store/event-types/fx-accounting";
import { EventStore } from "../event-store/store";
import { type FxProductTaxonomy, makeFxTradeExecuted } from "../markets/cdm/fx";
import { isPresent } from "../types/financial-input";
import { buildCrossAssetBreakdown } from "./cross-asset-positions";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "trader:test" };
const TODAY = "2026-05-31";

function store(): EventStore {
  return new EventStore(":memory:");
}

function seedFxTrade(
  s: EventStore,
  tradeId: string,
  taxonomy: FxProductTaxonomy = "FX-spot",
  bookId = "BOOK-FX-MARKETS-LP",
): void {
  s.append(
    makeFxTradeExecuted({
      asOf: `${TODAY}T10:00:00.000Z`,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["TEST"],
      payload: {
        tradeId: { scheme: "INTERNAL", value: tradeId },
        productTaxonomy: taxonomy,
        currencyPair: { base: "USD", quote: "ZAR" },
        side: "buy",
        legs: [
          {
            legKind: "near",
            payCurrency: "ZAR",
            receiveCurrency: "USD",
            notional: { currency: "ZAR", amountMinor: 18_000_000 },
            counterNotional: { currency: "USD", amountMinor: 1_000_000 },
            rate: { currency: "ZAR", amount: 18 },
            settlementDate: { iso: "2026-06-02", calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: TODAY, calendar: "JIHCAL" },
        counterparty: {
          partyId: "urn:party:legal-entity:standard-bank-za",
          name: "Standard Bank ZA",
          role: "counterparty",
          jurisdiction: "ZA",
        },
        venue: "OTC",
        trader: "trader:test",
        bookId,
        bookType: "trading",
        settlementForm: "physical",
        settlementPath: "correspondent",
        finsurvCategory: "ODP-001",
        clientFlowRef: "test:flow-001",
      },
    }),
  );
}

function seedFxReval(s: EventStore, tradeId: string, unrealisedZarMinor: number): void {
  s.append(
    makeFxPositionRevalued({
      asOf: `${TODAY}T17:00:00.000Z`,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["TEST"],
      payload: {
        tradeId,
        currencyPair: "USD/ZAR",
        notionalBaseMinor: 1_000_000,
        bookRate: 18,
        revalRate: 18.5,
        revaluedAt: `${TODAY}T17:00:00.000Z`,
        unrealisedPnlZarMinor: unrealisedZarMinor,
        rateSource: "production:test-feed",
      },
    }),
  );
}

function seedBondTrade(s: EventStore, tradeId: string, isin: string): void {
  s.append(
    makeBondTradeExecuted({
      asOf: `${TODAY}T10:00:00.000Z`,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["TEST"],
      payload: {
        tradeId,
        bondIsin: isin,
        side: "buy",
        nominalMinor: 10_000_000,
        cleanPricePercent: 97.5,
        accruedInterestMinor: 50_000,
        dirtyPricePercent: 98.0,
        settlementDate: "2026-06-03",
        portfolio: "trading-book",
        couponRate: 0.085,
        maturityDate: "2031-05-31",
        currency: "ZAR",
        counterpartyLei: "529900T8BM49AURSDO55",
        executedAt: `${TODAY}T10:00:00.000Z`,
      },
    }),
  );
}

describe("cross-asset — FX Spot & Forward in one bucket", () => {
  it("surfaces an FX Spot live position with unrealised = the daily-pnl reval", () => {
    const s = store();
    seedFxTrade(s, "FX-1", "FX-spot");
    seedFxReval(s, "FX-1", 500_000);

    const bd = buildCrossAssetBreakdown(s, TODAY);
    const fx = bd.instruments.find((r) => r.assetClass === "fx");
    expect(fx).toBeDefined();
    expect(fx?.fxTaxonomy).toBe("FX-spot");
    expect(fx && isPresent(fx.unrealised)).toBe(true);
    if (fx && isPresent(fx.unrealised)) expect(fx.unrealised.value).toBe(500_000);
    expect(bd.markableUnrealisedZarMinor).toBe(500_000);
    expect(isPresent(bd.totalUnrealised)).toBe(true);
  });

  it("places an FX Forward trade in the SAME fx asset class, carrying its taxonomy", () => {
    const s = store();
    seedFxTrade(s, "FWD-1", "FX-forward");
    seedFxReval(s, "FWD-1", 250_000);

    const bd = buildCrossAssetBreakdown(s, TODAY);
    const fxRows = bd.instruments.filter((r) => r.assetClass === "fx");
    expect(fxRows.length).toBe(1);
    expect(fxRows[0]?.fxTaxonomy).toBe("FX-forward");
    expect(isPresent(bd.totalUnrealised)).toBe(true);
    expect(bd.markableUnrealisedZarMinor).toBe(250_000);
  });
});

describe("cross-asset — no-silent-zero", () => {
  it("surfaces an UNMARKED bond as absent and propagates incompleteness to the book + total", () => {
    const s = store();
    seedBondTrade(s, "BOND-2", "ZAG000999999"); // no OfficialMarkAdopted

    const bd = buildCrossAssetBreakdown(s, TODAY);
    const bond = bd.instruments.find((r) => r.assetClass === "bond");
    expect(bond).toBeDefined();
    expect(bond?.markStatus).toBe("no-mark");
    expect(bond && isPresent(bond.unrealised)).toBe(false);
    expect(bd.unmarkableKeys).toContain("fi:bond:ZAG000999999");
    expect(isPresent(bd.totalUnrealised)).toBe(false);
    // The bond's book inherits the absence (no silent 0).
    const book = bd.books.find((b) => b.assetClasses.includes("bond"));
    expect(book && isPresent(book.unrealised)).toBe(false);
  });
});

describe("cross-asset — book aggregation", () => {
  it("rolls instrument rows up to one row per book", () => {
    const s = store();
    seedFxTrade(s, "FX-1", "FX-spot", "BK-A");
    seedFxReval(s, "FX-1", 100_000);
    seedFxTrade(s, "FWD-1", "FX-forward", "BK-B");
    seedFxReval(s, "FWD-1", 200_000);

    const bd = buildCrossAssetBreakdown(s, TODAY);
    expect(bd.books.map((b) => b.bookId)).toEqual(["BK-A", "BK-B"]);
    const a = bd.books.find((b) => b.bookId === "BK-A");
    expect(a?.instrumentCount).toBe(1);
    if (a && isPresent(a.unrealised)) expect(a.unrealised.value).toBe(100_000);
  });
});

describe("cross-asset — empty store", () => {
  it("returns no rows and a present(0) total", () => {
    const bd = buildCrossAssetBreakdown(store(), TODAY);
    expect(bd.instruments).toHaveLength(0);
    expect(bd.books).toHaveLength(0);
    expect(isPresent(bd.totalUnrealised)).toBe(true);
    if (isPresent(bd.totalUnrealised)) expect(bd.totalUnrealised.value).toBe(0);
  });
});
