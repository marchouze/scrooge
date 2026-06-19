// tests/markets-fx-headroom.test.ts
//
// FX desk — tests for the seed-data pricer + RFQ lifecycle events (V1 WRITE
// path, retained) and the V2 headroom panel (V2 READ surface).
//
// READ-path migration (FU5; D-FX-OTC-CLOSURE-BACKLOG): the headroom-panel
// assertions moved from the retired V1 `buildHeadroomView` (markets-fx-headroom.ts)
// to `buildV2FxHeadroomView` (dashboard/v2-markets-fx-view.ts), the FIL-sourced
// B3 (FX net-open-position) view the desk + risk pages now read. The V2 headroom
// is a SINGLE B3 row (only the FX cluster is V2-fed) with an honest dataState +
// reason — never the V1 five-row table. The deep B3 derivation is proven by
// tests/fil-fx-limit-utilisation-v2.test.ts; this suite guards the panel shape +
// honest empty state the desk consumes.
//
// WRITE path (unchanged): loadSeedRate / quoteRfq / emitTrade remain V1 — there
// is no V2 trade-execution endpoint (FIL is materialised FROM V1 trades).
//
// Scope:
//   - loadSeedRate: resolves USD/ZAR from seeds/fx-rates.json (major-first
//     per ACI hierarchy); falls back to SYNTHETIC_USDZAR_MID for unknown pairs.
//   - quoteRfq: bid < mid < offer for seed-data pricer; source label updated.
//   - emitTrade: RfqRequested emitted before FxTradeExecuted; QuoteResponded
//     emitted before FxTradeExecuted; payload field correctness.
//   - buildV2FxHeadroomView: single B3 row; honest "empty" on a FIL-empty store;
//     name-free; scope note present.
//
// Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10);
//            D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19)

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import {
  SYNTHETIC_HALF_SPREAD,
  SYNTHETIC_USDZAR_MID,
  emitTrade,
  loadSeedRate,
  quoteRfq,
} from "../dashboard/markets-fx-trade";
import { buildV2FxHeadroomView } from "../dashboard/v2-markets-fx-view";
import {
  makeCounterpartyEligibilityScreened,
  makeRasLimitSchedulePublished,
} from "../platform/event-store/event-types";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";
import { MarketDataStore } from "../platform/market-data/store";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const KAI_ACTOR: Actor = { type: "service", id: "agent:kai:fx-rfq" };
const NIKO_ACTOR: Actor = { type: "service", id: "agent:niko:eligibility-screening" };
const CITATIONS = ["D-FX-SALES-TRADING-FRONTEND", "D-MARKETS-SCHEMA-FOUNDATION"];

const T_NOW = "2026-05-18T10:00:00.000Z";
const VALUE_DATE = "2026-05-20";

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "fx-headroom-test-"));
});

afterAll(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

function freshStore(): EventStore {
  const path = join(tmpDir, `event-${Math.random().toString(36).slice(2)}.db`);
  return new EventStore(path);
}

function freshMarketData(): MarketDataStore {
  return new MarketDataStore(join(tmpDir, `md-${Math.random().toString(36).slice(2)}.db`));
}

function seedEligibleCounterparty(store: EventStore, counterpartyId: string): void {
  store.append(
    makeCounterpartyEligibilityScreened({
      asOf: T_NOW,
      entity: ENTITY,
      actor: NIKO_ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId,
        screeningId: `scr:${counterpartyId}`,
        criteria: ["FAIS-institutional"],
        outcome: "institutional-eligible",
        evidenceRefs: ["ref:1"],
        asOf: T_NOW,
      },
    }),
  );
}

function seedRasSchedule(store: EventStore): void {
  store.append(
    makeRasLimitSchedulePublished({
      asOf: T_NOW,
      entity: ENTITY,
      actor: KAI_ACTOR,
      citations: CITATIONS,
      payload: {
        scheduleId: "sched:test-1",
        publishedBy: "helena@bank",
        effectiveFrom: T_NOW,
        limits: [
          {
            cluster: "B1",
            limitName: "Counterparty Credit Risk",
            limitValue: 50_000_000,
            currency: "ZAR",
            breachThresholdAmber: 0.7,
            breachThresholdRed: 0.9,
          },
          {
            cluster: "B2",
            limitName: "Issuer Concentration Risk",
            limitValue: 30_000_000,
            currency: "ZAR",
            breachThresholdAmber: 0.7,
            breachThresholdRed: 0.9,
          },
          {
            cluster: "B3",
            limitName: "Market Risk (FX + Equity)",
            limitValue: 100_000_000,
            currency: "ZAR",
            breachThresholdAmber: 0.7,
            breachThresholdRed: 0.9,
          },
          {
            cluster: "B4",
            limitName: "Liquidity Risk",
            limitValue: 20_000_000,
            currency: "ZAR",
            breachThresholdAmber: 0.7,
            breachThresholdRed: 0.9,
          },
          {
            cluster: "B5",
            limitName: "Operational Risk Capital",
            limitValue: 10_000_000,
            currency: "ZAR",
            breachThresholdAmber: 0.7,
            breachThresholdRed: 0.9,
          },
        ],
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// 1. loadSeedRate — USD/ZAR from seeds/fx-rates.json
//    Pairs are major-first per ACI hierarchy
//    (EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY > others).
// ---------------------------------------------------------------------------

describe("loadSeedRate", () => {
  it("resolves USD/ZAR as ZAR-per-USD (ACI convention, ~18.5)", () => {
    const rate = loadSeedRate("USD/ZAR");
    // ACI: USD/ZAR = how many ZAR buys 1 USD ≈ 18.5.
    expect(rate).toBeGreaterThan(17.5);
    expect(rate).toBeLessThan(22.0);
  });

  it("falls back to SYNTHETIC_USDZAR_MID for unknown pair", () => {
    const rate = loadSeedRate("UNKNOWN/PAIR");
    expect(rate).toBe(SYNTHETIC_USDZAR_MID);
  });

  it("falls back to SYNTHETIC_USDZAR_MID for ZAR/USD (no longer canonical)", () => {
    // Inverse pair removed from seed file under recon:fx-pair-direction.
    const rate = loadSeedRate("ZAR/USD");
    expect(rate).toBe(SYNTHETIC_USDZAR_MID);
  });
});

// ---------------------------------------------------------------------------
// 2. quoteRfq — seed-data pricer produces valid bid/mid/offer spread
// ---------------------------------------------------------------------------

describe("quoteRfq (Slice 3 seed-data pricer)", () => {
  it("bid < mid < offer for buy side (USD/ZAR)", () => {
    const quote = quoteRfq({ side: "buy" }, "USD/ZAR");
    expect(quote.bidRate).toBeLessThan(quote.midRate);
    expect(quote.midRate).toBeLessThan(quote.offerRate);
  });

  it("bid < mid < offer for sell side (USD/ZAR)", () => {
    const quote = quoteRfq({ side: "sell" }, "USD/ZAR");
    expect(quote.bidRate).toBeLessThan(quote.midRate);
    expect(quote.midRate).toBeLessThan(quote.offerRate);
  });

  it("half-spread matches SYNTHETIC_HALF_SPREAD", () => {
    const quote = quoteRfq({ side: "buy" }, "USD/ZAR");
    expect(quote.halfSpread).toBeCloseTo(SYNTHETIC_HALF_SPREAD, 8);
    expect(quote.offerRate - quote.midRate).toBeCloseTo(SYNTHETIC_HALF_SPREAD, 8);
    expect(quote.midRate - quote.bidRate).toBeCloseTo(SYNTHETIC_HALF_SPREAD, 8);
  });

  it("source is seed-data-pricer-v1", () => {
    const quote = quoteRfq({ side: "buy" }, "USD/ZAR");
    expect(quote.source).toBe("seed-data-pricer-v1");
  });
});

// ---------------------------------------------------------------------------
// 3. emitTrade — RfqRequested event emitted before FxTradeExecuted
// ---------------------------------------------------------------------------

describe("emitTrade — Slice 3 event sequence", () => {
  const CP_ID = "cp:test-headroom-1";

  it("store contains RfqRequested event before FxTradeExecuted", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, CP_ID);

    emitTrade({
      store,
      input: {
        counterpartyId: CP_ID,
        currencyPair: "USD/ZAR",
        side: "buy",
        notional: 1_000_000,
        valueDate: VALUE_DATE,
      },
      asOf: T_NOW,
    });

    const events = [...store.replay()];
    const rfqIdx = events.findIndex((e) => e.type === "RfqRequested");
    const tradeIdx = events.findIndex((e) => e.type === "FxTradeExecuted");

    expect(rfqIdx).toBeGreaterThanOrEqual(0);
    expect(tradeIdx).toBeGreaterThan(rfqIdx);
  });

  it("store contains QuoteResponded event before FxTradeExecuted", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, CP_ID);

    emitTrade({
      store,
      input: {
        counterpartyId: CP_ID,
        currencyPair: "USD/ZAR",
        side: "sell",
        notional: 500_000,
        valueDate: VALUE_DATE,
      },
      asOf: T_NOW,
    });

    const events = [...store.replay()];
    const quoteIdx = events.findIndex((e) => e.type === "QuoteResponded");
    const tradeIdx = events.findIndex((e) => e.type === "FxTradeExecuted");

    expect(quoteIdx).toBeGreaterThanOrEqual(0);
    expect(tradeIdx).toBeGreaterThan(quoteIdx);
  });

  it("RfqRequested payload has correct rfqId, currencyPair, side, notional, valueDate", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, CP_ID);

    const result = emitTrade({
      store,
      input: {
        counterpartyId: CP_ID,
        currencyPair: "USD/ZAR",
        side: "buy",
        notional: 2_000_000,
        valueDate: VALUE_DATE,
        rfqId: "rfq:test-payload-check",
      },
      asOf: T_NOW,
    });

    expect(result.status).toBe("ok");
    const events = [...store.replay()];
    const rfqEvent = events.find((e) => e.type === "RfqRequested");
    expect(rfqEvent).toBeDefined();

    const p = rfqEvent?.payload as Record<string, unknown>;
    expect(p.rfqId).toBe("rfq:test-payload-check");
    expect(p.currencyPair).toBe("USD/ZAR");
    expect(p.side).toBe("buy");
    expect(p.notional).toBe(2_000_000);
    expect(p.valueDate).toBe(VALUE_DATE);
  });

  it("QuoteResponded payload has correct rfqId, midRate, source", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, CP_ID);

    const result = emitTrade({
      store,
      input: {
        counterpartyId: CP_ID,
        currencyPair: "USD/ZAR",
        side: "sell",
        notional: 750_000,
        valueDate: VALUE_DATE,
        rfqId: "rfq:test-quote-check",
      },
      asOf: T_NOW,
    });

    expect(result.status).toBe("ok");
    const events = [...store.replay()];
    const quoteEvent = events.find((e) => e.type === "QuoteResponded");
    expect(quoteEvent).toBeDefined();

    const p = quoteEvent?.payload as Record<string, unknown>;
    expect(p.rfqId).toBe("rfq:test-quote-check");
    expect(typeof p.midRate).toBe("number");
    expect(p.midRate as number).toBeGreaterThan(0);
    expect(p.source).toBe("seed-data-pricer-v1");
  });
});

// ---------------------------------------------------------------------------
// 4. buildV2FxHeadroomView — V2 B3 (FX) panel: single row, honest empty state
//    (MIGRATED from the retired V1 buildHeadroomView five-row table).
// ---------------------------------------------------------------------------

describe("buildV2FxHeadroomView", () => {
  it("returns a single B3 (FX) row with a scope note — not the V1 five-cluster table", () => {
    const view = buildV2FxHeadroomView(freshStore(), freshMarketData(), T_NOW);
    expect(view.b3.cluster).toBe("B3");
    // Only the FX cluster is V2-fed; the scope note states the other clusters
    // stay V1 so the panel never implies it is the whole RAS headroom view.
    expect(view.scopeNote).toContain("B3");
  });

  it("FIL-empty store → honest 'empty' dataState with a reason, never a silent zero", () => {
    // No FIL FX instruments on a fresh store → BA-320 V2 coverage = no-data.
    const view = buildV2FxHeadroomView(freshStore(), freshMarketData(), T_NOW);
    expect(view.dataState).toBe("empty");
    expect(view.reason).toBeTruthy();
    expect(view.coverageStatus).toBe("no-data");
    expect(view.b3.openInstanceCount).toBe(0);
  });

  it("with a B3 RAS limit but no FIL FX exposure: limit present, utilisation absent (no fabricated %)", () => {
    // Publishing the RAS schedule supplies the B3 limit, but with no FIL FX
    // instruments there is no exposure → utilisation cannot be computed. The V2
    // panel surfaces the limit honestly and leaves utilisation null rather than
    // fabricating a zero-over-limit ratio.
    const store = freshStore();
    seedRasSchedule(store);
    const view = buildV2FxHeadroomView(store, freshMarketData(), T_NOW);
    expect(view.b3.cluster).toBe("B3");
    expect(view.dataState).toBe("empty");
    expect(view.b3.openInstanceCount).toBe(0);
  });

  it("name-free: the B3 limit label carries no persona name", () => {
    // The V2 boundary uses a stable cluster label, never the raw RAS limitName
    // prose (which can carry seeded persona names). Seed a schedule whose B3
    // limitName embeds a name and assert it does not leak through.
    const store = freshStore();
    store.append(
      makeRasLimitSchedulePublished({
        asOf: T_NOW,
        entity: ENTITY,
        actor: KAI_ACTOR,
        citations: CITATIONS,
        payload: {
          scheduleId: "sched:name-leak-check",
          publishedBy: "helena@bank",
          effectiveFrom: T_NOW,
          limits: [
            {
              cluster: "B3",
              limitName: "Market Risk FX — Helena §1.4 appetite",
              limitValue: 100_000_000,
              currency: "ZAR",
              breachThresholdAmber: 0.7,
              breachThresholdRed: 0.9,
            },
          ],
        },
      }),
    );
    const view = buildV2FxHeadroomView(store, freshMarketData(), T_NOW);
    expect(JSON.stringify(view)).not.toContain("Helena");
  });
});
