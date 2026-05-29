// platform/market-risk/var-engine.test.ts
//
// Unit tests for the market-risk VaR / SVaR / ES historical-simulation engine.
// Covers the three loud-status paths (no-positions, insufficient-history,
// computed) and the historical-simulation core (VaR quantile, ES tail mean,
// SVaR ≥ VaR). Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 4.

import { describe, expect, it } from "bun:test";

import { EventStore } from "../event-store/store";
import { MarketDataStore } from "../market-data/store";
import { makeFxTradeExecuted } from "../markets/cdm/fx";
import {
  MIN_RETURN_OBSERVATIONS,
  computeMarketRisk,
  confidenceFor,
  historicalES,
  historicalVaR,
  simulatePnLDistribution,
} from "./var-engine";

function emptyStore(): EventStore {
  return new EventStore(":memory:");
}

function marketData(): MarketDataStore {
  return new MarketDataStore(":memory:");
}

/** Append `n` daily fx-quote ticks for a pair, walking the rate by +0.1% each day. */
function seedFxHistory(md: MarketDataStore, pair: string, n: number, start = 18): void {
  for (let i = 0; i < n; i++) {
    const day = String(i + 1).padStart(2, "0");
    md.append({
      id: `${pair}-${day}`,
      source: "fx-sim",
      instrument: pair,
      dataType: "fx-quote",
      provenance: "production",
      asOf: `2026-05-${day}T00:00:00.000Z`,
      payload: { mid: start * (1 + 0.001 * i) },
    });
  }
}

/** Append one live FX trade (buy USD/ZAR notional) so a net position exists. */
function seedFxTrade(store: EventStore): void {
  store.append(
    makeFxTradeExecuted({
      asOf: "2026-05-20T10:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "trader:test" },
      citations: ["TEST"],
      payload: {
        tradeId: { scheme: "INTERNAL", value: "FX-TEST-1" },
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
            settlementDate: { iso: "2026-05-22", calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: "2026-05-20", calendar: "JIHCAL" },
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

describe("confidenceFor", () => {
  it("returns the documented confidence levels", () => {
    expect(confidenceFor("var")).toBe(0.99);
    expect(confidenceFor("svar")).toBe(0.99);
    expect(confidenceFor("es")).toBe(0.975);
  });
});

describe("historical-simulation core", () => {
  it("VaR is the loss at the confidence quantile (positive magnitude)", () => {
    // Symmetric P&L: losses {1..100}. 99% VaR ≈ the 99th-percentile loss.
    const pnl = Array.from({ length: 100 }, (_, i) => -(i + 1));
    const v = historicalVaR(pnl, 0.99);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeGreaterThanOrEqual(99);
  });

  it("ES is the mean of the tail beyond the quantile and ≥ VaR", () => {
    const pnl = Array.from({ length: 100 }, (_, i) => -(i + 1));
    const v = historicalVaR(pnl, 0.975);
    const es = historicalES(pnl, 0.975);
    expect(es).toBeGreaterThanOrEqual(v);
  });

  it("returns 0 for an empty distribution (no scenarios)", () => {
    expect(historicalVaR([], 0.99)).toBe(0);
    expect(historicalES([], 0.975)).toBe(0);
  });

  it("simulatePnLDistribution applies per-factor returns to the exposure vector", () => {
    const exposures = [{ factor: "USD/ZAR", exposureZar: 1000, returnObservations: 2 }];
    const returns = new Map([["USD/ZAR", [0.1, -0.2]]]);
    const pnl = simulatePnLDistribution(exposures, returns);
    expect(pnl).toEqual([100, -200]);
  });
});

describe("computeMarketRisk — loud status paths (no silent zeros)", () => {
  it("flat book → status no-positions, figures absent", () => {
    const report = computeMarketRisk({
      eventStore: emptyStore(),
      marketData: marketData(),
      asOf: "2026-05-29T00:00:00.000Z",
    });
    expect(report.status).toBe("no-positions");
    expect(report.var.present).toBe(false);
    expect(report.svar.present).toBe(false);
    expect(report.es.present).toBe(false);
  });

  it("live position but too-short history → insufficient-history, figures absent", () => {
    const store = emptyStore();
    const md = marketData();
    seedFxTrade(store);
    seedFxHistory(md, "USD/ZAR", 5); // < MIN_RETURN_OBSERVATIONS returns
    const report = computeMarketRisk({
      eventStore: store,
      marketData: md,
      asOf: "2026-06-30T00:00:00.000Z",
    });
    expect(report.status).toBe("insufficient-history");
    expect(report.exposures.length).toBeGreaterThan(0);
    expect(report.minObservations).toBeLessThan(MIN_RETURN_OBSERVATIONS);
    expect(report.var.present).toBe(false);
    if (!report.var.present) expect(report.var.reason).toContain("insufficient");
  });

  it("live position + sufficient history → computed, figures present, SVaR ≥ VaR", () => {
    const store = emptyStore();
    const md = marketData();
    seedFxTrade(store);
    seedFxHistory(md, "USD/ZAR", MIN_RETURN_OBSERVATIONS + 5);
    const report = computeMarketRisk({
      eventStore: store,
      marketData: md,
      asOf: "2026-06-30T00:00:00.000Z",
    });
    expect(report.status).toBe("computed");
    expect(report.var.present).toBe(true);
    expect(report.svar.present).toBe(true);
    expect(report.es.present).toBe(true);
    if (report.var.present && report.svar.present && report.es.present) {
      expect(report.svar.value).toBeGreaterThanOrEqual(report.var.value);
      expect(report.es.value).toBeGreaterThanOrEqual(0);
    }
  });
});
