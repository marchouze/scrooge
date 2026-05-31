// platform/market-risk/valuation-adjustment-engine.test.ts
//
// Unit tests for the valuation-adjustment / prudent-valuation reserve engine.
// Covers: close-out reserve (present / absent-no-positions / absent-unknown-pair),
// day-1 deferral reserve, CVA fold, market-price-uncertainty AVA from IPV
// variances, and the AVA umbrella additivity + no-silent-zero contract.
// Authority: Camille (CFO) R2; IFRS 13; CRR Art 105; D-TRUSTED-FIGURES-PROGRAM-V1.

import { describe, expect, it } from "bun:test";

import { makeIpvExceptionRaised } from "../event-store/event-types/mtm";
import { makeDay1PnLDeferralRecorded } from "../event-store/event-types/valuation-adjustment";
import { EventStore } from "../event-store/store";
import { MarketDataStore } from "../market-data/store";
import { makeFxTradeExecuted } from "../markets/cdm/fx";
import { isPresent, requireValue } from "../types/financial-input";
import {
  computeCloseOutReserve,
  computeDay1DeferralReserve,
  computeMarketPriceUncertaintyAva,
  computeValuationAdjustments,
} from "./valuation-adjustment-engine";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "trader:test" };
const ASOF = "2026-05-31T17:00:00.000Z";

function emptyStore(): EventStore {
  return new EventStore(":memory:");
}
function marketData(): MarketDataStore {
  return new MarketDataStore(":memory:");
}

/** Book a live FX-spot trade with a ZAR notional and a currency pair. */
function seedFxSpot(
  store: EventStore,
  opts: { tradeId: string; base: string; quote: string; zarNotionalMinor: number },
): void {
  store.append(
    makeFxTradeExecuted({
      asOf: "2026-05-30T10:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: ["TEST"],
      payload: {
        tradeId: { scheme: "INTERNAL", value: opts.tradeId },
        productTaxonomy: "FX-spot",
        currencyPair: { base: opts.base, quote: opts.quote },
        side: "buy",
        legs: [
          {
            legKind: "near",
            payCurrency: "ZAR",
            receiveCurrency: opts.base,
            notional: { currency: "ZAR", amountMinor: opts.zarNotionalMinor },
            counterNotional: { currency: opts.base, amountMinor: 1_000_000 },
            rate: { currency: "ZAR", amount: 18 },
            settlementDate: { iso: "2026-06-02", calendar: "JIHCAL" },
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

describe("close-out / bid-offer reserve", () => {
  it("is absent (not 0) when there are no live FX-spot positions", () => {
    const r = computeCloseOutReserve({ eventStore: emptyStore(), asOf: ASOF });
    expect(isPresent(r.amount)).toBe(false);
    if (!isPresent(r.amount)) {
      expect(r.amount.reason).toContain("no live FX-spot positions");
    }
  });

  it("computes (half-spread × |ZAR notional|) for a known pair", () => {
    const store = emptyStore();
    // USD/ZAR half-spread = 5 bps = 0.0005; notional 100,000,000 minor (R1m).
    seedFxSpot(store, {
      tradeId: "T-1",
      base: "USD",
      quote: "ZAR",
      zarNotionalMinor: 100_000_000,
    });
    const r = computeCloseOutReserve({ eventStore: store, asOf: ASOF });
    expect(isPresent(r.amount)).toBe(true);
    expect(requireValue(r.amount)).toBe(Math.round(0.0005 * 100_000_000)); // 50,000
    expect(r.ifrs13Level).toBe("level-2");
  });

  it("degrades (absent, not 0) when a position's pair has no documented spread", () => {
    const store = emptyStore();
    // JPY/ZAR is not in the half-spread table → loud requireWeight miss.
    seedFxSpot(store, { tradeId: "T-2", base: "JPY", quote: "ZAR", zarNotionalMinor: 50_000_000 });
    const r = computeCloseOutReserve({ eventStore: store, asOf: ASOF });
    expect(isPresent(r.amount)).toBe(false);
    if (!isPresent(r.amount)) {
      expect(r.amount.reason).toContain("no documented half-spread");
    }
  });
});

describe("day-1 P&L deferral reserve", () => {
  it("is absent (not 0) when no deferrals recorded", () => {
    const r = computeDay1DeferralReserve({ eventStore: emptyStore(), asOf: ASOF });
    expect(isPresent(r.amount)).toBe(false);
  });

  it("sums |deferred day-1 P&L| over recorded Level-3 deferrals", () => {
    const store = emptyStore();
    store.append(
      makeDay1PnLDeferralRecorded({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: ["IFRS-13"],
        payload: {
          deferralId: "D-1",
          valuationDate: "2026-05-31",
          instrumentId: "INSTR-L3-1",
          instrumentDescription: "bespoke structured note",
          day1PnlZarMinor: -250_000, // unrecognised loss; |.| = 250k
          unobservableInputReason: "no observable vol surface for the embedded option",
          recordedAt: ASOF,
          recordedBy: "agent:valuation-adjustment-engine",
        },
      }),
    );
    const r = computeDay1DeferralReserve({ eventStore: store, asOf: ASOF });
    expect(isPresent(r.amount)).toBe(true);
    expect(requireValue(r.amount)).toBe(250_000);
    expect(r.ifrs13Level).toBe("level-3");
  });
});

describe("market-price-uncertainty AVA (IPV linkage)", () => {
  it("is absent (not 0) when no IPV variances exist", () => {
    const r = computeMarketPriceUncertaintyAva({ eventStore: emptyStore(), asOf: ASOF });
    expect(isPresent(r.amount)).toBe(false);
  });

  it("sums |IPV divergence| over IpvExceptionRaised events", () => {
    const store = emptyStore();
    store.append(
      makeIpvExceptionRaised({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: ["pricing-policy-v1-§5.2"],
        payload: {
          positionId: "POS-1",
          instrument: "USD/ZAR",
          primaryRate: 18.5,
          secondaryRateSource: "Refinitiv",
          secondaryRate: 18.45,
          divergencePct: 0.27,
          divergenceZar: 30_000, // R30k variance
          notional: 100_000_000,
          currency: "ZAR",
        },
      }),
    );
    const r = computeMarketPriceUncertaintyAva({ eventStore: store, asOf: ASOF });
    expect(isPresent(r.amount)).toBe(true);
    expect(requireValue(r.amount)).toBe(Math.round(30_000 * 100)); // ZAR → minor
  });
});

describe("AVA umbrella aggregation", () => {
  it("always exists and sums populated categories; total == Σ present", () => {
    const store = emptyStore();
    seedFxSpot(store, {
      tradeId: "T-1",
      base: "USD",
      quote: "ZAR",
      zarNotionalMinor: 100_000_000,
    });
    const report = computeValuationAdjustments({
      eventStore: store,
      marketData: marketData(),
      asOf: ASOF,
    });

    // Umbrella always present.
    expect(isPresent(report.totalAva)).toBe(true);

    // Additivity: total == Σ present category lines.
    const presentSum = report.avaCategories
      .filter((c) => c.present)
      .reduce((s, c) => s + c.amountZarMinor, 0);
    expect(requireValue(report.totalAva)).toBe(presentSum);

    // close-out is populated; the un-eventised categories are absent (not 0).
    const closeOut = report.avaCategories.find((c) => c.adjustmentType === "close-out-bid-offer");
    expect(closeOut?.present).toBe(true);
    const modelRisk = report.avaCategories.find((c) => c.adjustmentType === "model-risk");
    expect(modelRisk?.present).toBe(false);
    expect(modelRisk?.absentReason).toBeTruthy();
  });

  it("exists with total 0 when no category populated (all absent, explicit)", () => {
    const report = computeValuationAdjustments({
      eventStore: emptyStore(),
      marketData: marketData(),
      asOf: ASOF,
    });
    expect(isPresent(report.totalAva)).toBe(true);
    expect(requireValue(report.totalAva)).toBe(0);
    // Every category recorded as absent with a reason.
    for (const c of report.avaCategories) {
      expect(c.present).toBe(false);
      expect(c.absentReason).toBeTruthy();
    }
  });
});
