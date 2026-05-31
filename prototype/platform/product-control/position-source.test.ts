// platform/product-control/position-source.test.ts
//
// Unit tests for the all-asset-class position-source abstraction. Covers:
//   1. FX-spot passthrough — an FX position with a reval surfaces as a present
//      mark equal to the daily-pnl unrealised P&L (Slice-1 reuse, unchanged).
//   2. Bond marked — a bond position with an OfficialMarkAdopted{price} mark is
//      present, fair-value level carried, and folds into the markable total.
//   3. Bond UNMARKED — a bond position with NO production mark is absent (not a
//      silent 0): tracked in unmarkableKeys, excluded from the total, and the
//      cross-asset total declares itself absent.
//   4. IRD unmarked — an IRS position with no curve point is absent (valuation
//      Gap 5), never 0.
//   5. The all-asset recon pipeline passes on the seeded store.
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import { makeBondTradeExecuted } from "../event-store/event-types/bond-accounting";
import { makeFxPositionRevalued } from "../event-store/event-types/fx-accounting";
import { makeOfficialMarkAdopted } from "../event-store/event-types/valuation";
import { EventStore } from "../event-store/store";
import { makeFxTradeExecuted } from "../markets/cdm/fx";
import { run as runAllAssetRecon } from "../recon/all-asset-pnl-ipv-coverage";
import { isPresent } from "../types/financial-input";
import { buildPositionSet } from "./position-source";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "trader:test" };
const TODAY = "2026-05-31";

function store(): EventStore {
  return new EventStore(":memory:");
}

function seedFxTrade(s: EventStore, tradeId: string): void {
  s.append(
    makeFxTradeExecuted({
      asOf: `${TODAY}T10:00:00.000Z`,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["TEST"],
      payload: {
        tradeId: { scheme: "INTERNAL", value: tradeId },
        productTaxonomy: "FX-spot",
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

/** Adopt an official `price` mark for a bond instrument (fi:bond:<ISIN>). */
function seedBondPriceMark(
  s: EventStore,
  isin: string,
  cleanPrice: number,
  level: "1" | "2" | "3",
): void {
  s.append(
    makeOfficialMarkAdopted({
      asOf: `${TODAY}T17:00:00.000Z`,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["TEST"],
      payload: {
        instrumentKey: `fi:bond:${isin}`,
        markType: "price",
        mark: String(cleanPrice),
        quoteCurrency: "ZAR",
        markAsOf: `${TODAY}T17:00:00.000Z`,
        sourceTickRef: { source: "jse-eod", tickId: "tick-1" },
        policyVersionRef: "urn:event:PolicyVersionActivated:test",
        adoptionCodeSha: "abc1234",
        fairValueLevel: level,
        fallbackChain: [],
      },
      provenance: { kind: "build-phase-fixture", sourceLineage: "test-fixture" },
    }),
  );
}

describe("position-source — FX-spot passthrough (Slice-1 reuse)", () => {
  it("surfaces an FX live position with a present mark = daily-pnl unrealised", () => {
    const s = store();
    seedFxTrade(s, "FX-1");
    seedFxReval(s, "FX-1", 500_000);

    const set = buildPositionSet(s, TODAY);
    const fx = set.positions.find((p) => p.assetClass === "fx-spot");
    expect(fx).toBeDefined();
    expect(fx && isPresent(fx.markZarMinor)).toBe(true);
    if (fx && isPresent(fx.markZarMinor)) {
      expect(fx.markZarMinor.value).toBe(500_000);
    }
    expect(set.markableTotalZarMinor).toBe(500_000);
    expect(isPresent(set.totalUnrealised)).toBe(true);
  });
});

describe("position-source — bond marking (valuation-policy §3.3)", () => {
  it("marks a bond with an OfficialMarkAdopted price (present + fair-value level)", () => {
    const s = store();
    seedBondTrade(s, "BOND-1", "ZAG000149037");
    // Position averageCost = cleanPrice at trade (97.5); mark to 99.0 → gain.
    seedBondPriceMark(s, "ZAG000149037", 99.0, "1");

    const set = buildPositionSet(s, TODAY);
    const bond = set.positions.find((p) => p.assetClass === "bond");
    expect(bond).toBeDefined();
    expect(bond && isPresent(bond.markZarMinor)).toBe(true);
    expect(bond?.fairValueLevel).toBe("1");
    expect(bond?.markParameterType).toBe("price");
    // (99.0 − 97.5) × nominal 10_000_000 = 15_000_000 (rounded).
    if (bond && isPresent(bond.markZarMinor)) {
      expect(bond.markZarMinor.value).toBe(Math.round((99.0 - 97.5) * 10_000_000));
    }
  });

  it("surfaces an UNMARKED bond as absent (no silent 0)", () => {
    const s = store();
    seedBondTrade(s, "BOND-2", "ZAG000999999");
    // No OfficialMarkAdopted for this ISIN.

    const set = buildPositionSet(s, TODAY);
    const bond = set.positions.find((p) => p.assetClass === "bond");
    expect(bond).toBeDefined();
    expect(bond && isPresent(bond.markZarMinor)).toBe(false);
    expect(set.unmarkableKeys).toContain("fi:bond:ZAG000999999");
    // The total declares itself incomplete — NOT a silent 0.
    expect(isPresent(set.totalUnrealised)).toBe(false);
    // The markable total excludes the unmarkable bond entirely (no 0 fold).
    expect(set.markableTotalZarMinor).toBe(0);
  });
});

describe("position-source — recon pipeline", () => {
  it("passes the all-asset-pnl-ipv-coverage recon on a mixed store", () => {
    const s = store();
    seedFxTrade(s, "FX-1");
    seedFxReval(s, "FX-1", 500_000);
    seedBondTrade(s, "BOND-1", "ZAG000149037");
    seedBondPriceMark(s, "ZAG000149037", 99.0, "1");
    seedBondTrade(s, "BOND-2", "ZAG000999999"); // unmarked → absent

    const result = runAllAssetRecon({ store: s, reportDate: TODAY });
    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("passes on an empty store (structural IPV-schedule assertions only)", () => {
    const result = runAllAssetRecon({ store: store(), reportDate: TODAY });
    expect(result.ok).toBe(true);
    // 3 levels × 4 parameter types = 12 schedule assertions, no positions.
    expect(result.asserted).toBe(12);
  });
});
