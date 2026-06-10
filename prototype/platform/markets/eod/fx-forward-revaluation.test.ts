// platform/markets/eod/fx-forward-revaluation.test.ts
//
// Tests for EOD FX forward / swap / NDF mark-to-market revaluation.
//
// Coverage:
//   TC-FWD-1:  FX-forward sunny-day — single open position, rate available
//   TC-FWD-2:  FX-forward idempotency — already revalued today → skip
//   TC-FWD-3:  FX-forward no positions → revalued=0
//   TC-FWD-4:  FX-forward missing rate → error captured, not thrown
//   TC-FWD-5:  FX-forward settled position excluded
//   TC-FWD-6:  FX-forward multiple positions, mix of settled and open
//   TC-FWD-7:  FX-forward tenor calculation drives rate lookup
//   TC-SWP-1:  FX-swap far leg valued as forward; near leg settled → skip near
//   TC-SWP-2:  FX-swap both legs open → value far leg
//   TC-SWP-3:  FX-swap fully settled (far leg confirmed) → excluded
//   TC-NDF-1:  NDF sunny-day — cash-settlement MtM
//   TC-NDF-2:  NDF idempotency
//   TC-NDF-3:  NDF settled → excluded
//   TC-MIX-1:  Mixed bag — forward + swap + NDF together
//   TC-SEED-1: forward-rate-seed linear interpolation
//   TC-SEED-2: forward-rate-seed clamping at boundaries
//
// Authority: IAS-21-§28, IFRS-9-§5.7.1, D-MARKETS-SCHEMA-FOUNDATION

import { describe, expect, it } from "bun:test";

import { makeTradeMatured } from "../../event-store/event-types/trade-matured";
import { EventStore } from "../../event-store/store";
import { makeFxTradeExecuted } from "../cdm/fx";
import { interpolateForwardRate, seedForwardRate } from "./forward-rate-seed";
import {
  type ForwardRateSource,
  makeStubForwardRateSource,
  runEodFxForwardRevaluation,
} from "./fx-forward-revaluation";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const AS_OF = "2026-05-17";
const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "test:fx-forward-reval" };
const CITATIONS = ["D-MARKETS-SCHEMA-FOUNDATION", "IAS-21-§28"];

// Stub rate source: 90d forward for USD/ZAR at 19_000_000 minor units (19.0)
function makeSimpleStub(pair = "USD/ZAR", tenorDays = 90, rate = 19_000_000n): ForwardRateSource {
  return makeStubForwardRateSource({ [pair]: { [tenorDays]: rate } });
}

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

/** Append an FX-forward trade with a near leg settling in ~90 days. */
function appendForwardTrade(
  store: EventStore,
  tradeId: string,
  bookRate = 18.7,
  settlementDate = "2026-08-15", // ~90 calendar days from AS_OF
  currencyPair = { base: "USD", quote: "ZAR" },
): void {
  store.append(
    makeFxTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "internal", value: tradeId },
        productTaxonomy: "FX-forward",
        currencyPair,
        // Canonical Option A (D-FX-QUOTING-CONVENTION): a SELL on the
        // canonical USD/ZAR pair pays USD (base) and receives ZAR (quote).
        side: "sell",
        legs: [
          {
            legKind: "near",
            payCurrency: currencyPair.base,
            receiveCurrency: currencyPair.quote,
            notional: { currency: currencyPair.base, amountMinor: 100_000_000 }, // USD 1m
            counterNotional: {
              currency: currencyPair.quote,
              amountMinor: Math.round(100_000_000 * bookRate),
            },
            rate: { currency: currencyPair.quote, amount: bookRate },
            settlementDate: { iso: settlementDate, calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: AS_OF, calendar: "JIHCAL" },
        counterparty: { partyId: "CP-FWD", name: "FWD Bank", role: "counterparty" },
        venue: "OTC",
        trader: "TRADER-001",
        bookType: "trading",
        bookId: "BOOK-FX-FWD",
        settlementForm: "physical",
        settlementPath: "correspondent",
        clientFlowRef: "client-trade:test-fwd-reval",
      },
    }),
  );
}

/** Append an FX-swap trade (near + far legs). */
function appendSwapTrade(
  store: EventStore,
  tradeId: string,
  nearSettleDate = "2026-05-19", // T+2 spot
  farSettleDate = "2026-08-19", // ~90d forward
  bookRateNear = 18.6,
  bookRateFar = 18.9,
): void {
  store.append(
    makeFxTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "internal", value: tradeId },
        productTaxonomy: "FX-swap",
        currencyPair: { base: "USD", quote: "ZAR" },
        // Canonical Option A: SELL USD/ZAR near; the far leg of a swap is
        // by definition the opposite direction (i.e. BUY USD/ZAR).
        side: "sell",
        legs: [
          {
            legKind: "near",
            // SELL near: pay USD (base), receive ZAR (quote).
            payCurrency: "USD",
            receiveCurrency: "ZAR",
            notional: { currency: "USD", amountMinor: 100_000_000 },
            counterNotional: {
              currency: "ZAR",
              amountMinor: Math.round(100_000_000 * bookRateNear),
            },
            rate: { currency: "ZAR", amount: bookRateNear },
            settlementDate: { iso: nearSettleDate, calendar: "JIHCAL" },
          },
          {
            legKind: "far",
            // BUY far (opposite to near): pay ZAR (quote), receive USD (base).
            payCurrency: "ZAR",
            receiveCurrency: "USD",
            notional: {
              currency: "ZAR",
              amountMinor: Math.round(100_000_000 * bookRateFar),
            },
            counterNotional: { currency: "USD", amountMinor: 100_000_000 },
            rate: { currency: "ZAR", amount: bookRateFar },
            settlementDate: { iso: farSettleDate, calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: AS_OF, calendar: "JIHCAL" },
        counterparty: { partyId: "CP-SWP", name: "Swap Bank", role: "counterparty" },
        venue: "OTC",
        trader: "TRADER-002",
        bookType: "trading",
        bookId: "BOOK-FX-SWP",
        settlementForm: "physical",
        settlementPath: "correspondent",
        clientFlowRef: "client-trade:test-swap-reval",
      },
    }),
  );
}

/** Append an NDF trade. */
function appendNdfTrade(
  store: EventStore,
  tradeId: string,
  bookRate = 18.8,
  settlementDate = "2026-08-19",
): void {
  store.append(
    makeFxTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "internal", value: tradeId },
        productTaxonomy: "NDF",
        currencyPair: { base: "USD", quote: "ZAR" },
        side: "sell",
        legs: [
          {
            legKind: "near",
            payCurrency: "USD",
            receiveCurrency: "ZAR",
            notional: { currency: "USD", amountMinor: 100_000_000 },
            counterNotional: {
              currency: "ZAR",
              amountMinor: Math.round(100_000_000 * bookRate),
            },
            rate: { currency: "ZAR", amount: bookRate },
            settlementDate: { iso: settlementDate, calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: AS_OF, calendar: "JIHCAL" },
        counterparty: { partyId: "CP-NDF", name: "NDF Bank", role: "counterparty" },
        venue: "OTC",
        trader: "TRADER-003",
        bookType: "trading",
        bookId: "BOOK-FX-NDF",
        settlementForm: "cash",
        settlementPath: "correspondent",
        ndfFixingSource: "SARB-ZAR-Fixing-1600-SAST",
        ndfSettlementCurrency: "USD",
        clientFlowRef: "client-trade:test-ndf-reval",
      },
    }),
  );
}

/** Append TradeMatured for a given tradeId and legKind. */
function appendSettlementConfirmed(
  store: EventStore,
  tradeId: string,
  legKind: "near" | "far" = "near",
): void {
  store.append(
    makeTradeMatured({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productKind: "fx-spot",
        tradeId,
        currencyPair: "USD/ZAR",
        legKind,
        settledBaseCurrencyMinor: 100_000_000,
        settledQuoteCurrencyMinor: 53_476,
        settledAt: new Date().toISOString(),
        nostroAccountBase: "ACC-1001-001",
        nostroAccountQuote: "ACC-1001-002",
        realisedPnlZarMinor: 0,
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// TC-FWD-1: FX-forward sunny-day
// ---------------------------------------------------------------------------

describe("TC-FWD-1: FX-forward sunny-day", () => {
  it("emits FxPositionRevalued and returns revalued=1", () => {
    const store = makeStore();
    appendForwardTrade(store, "FWD-001", 18.7, "2026-08-15");

    // 2026-08-15 is 90 days from 2026-05-17
    const stub = makeStubForwardRateSource({ "USD/ZAR": { 90: 19_000_000n } });
    const result = runEodFxForwardRevaluation(store, AS_OF, stub);

    expect(result.revalued).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.asOf).toBe(AS_OF);
    expect(result.errors).toHaveLength(0);

    let count = 0;
    let taxonomy: string | undefined;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      taxonomy = (e.payload as { productTaxonomy?: string }).productTaxonomy;
      count++;
    }
    expect(count).toBe(1);
    // Instrument-attribution: the emitted reval carries its real productTaxonomy
    // (D-FX-OTC-NPA-SCOPE-EXPANSION) — not mislabelled "FX-spot".
    expect(taxonomy).toBe("FX-forward");
  });

  it("P&L direction: rate up → positive pnlDelta (forward gain)", () => {
    const store = makeStore();
    // Book at 18.7; forward rate moves to 19.0 → gain for buyer.
    appendForwardTrade(store, "FWD-PNL", 18.7, "2026-08-15");

    const stub = makeStubForwardRateSource({ "USD/ZAR": { 90: 19_000_000n } });
    runEodFxForwardRevaluation(store, AS_OF, stub);

    let payload: { unrealisedPnlZarMinor: number; bookRate: number; revalRate: number } | undefined;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      payload = e.payload as typeof payload;
    }
    expect(payload).toBeDefined();
    // pnlDelta = (19_000_000 - 18_700_000) * 100_000_000 / 19_000_000
    //          = 300_000 * 100_000_000 / 19_000_000
    //          ≈ 1_578_947
    expect(payload?.unrealisedPnlZarMinor).toBeGreaterThan(0);
    expect(payload?.bookRate).toBeCloseTo(18.7, 2);
    expect(payload?.revalRate).toBeCloseTo(19.0, 2);
  });

  it("P&L direction: rate down → negative pnlDelta (forward loss)", () => {
    const store = makeStore();
    appendForwardTrade(store, "FWD-LOSS", 18.7, "2026-08-15");

    // Rate falls to 18.0
    const stub = makeStubForwardRateSource({ "USD/ZAR": { 90: 18_000_000n } });
    runEodFxForwardRevaluation(store, AS_OF, stub);

    let payload: { unrealisedPnlZarMinor: number } | undefined;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      payload = e.payload as typeof payload;
    }
    expect(payload?.unrealisedPnlZarMinor).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// TC-FWD-2: Idempotency
// ---------------------------------------------------------------------------

describe("TC-FWD-2: FX-forward idempotency", () => {
  it("second run on same date skips the already-revalued position", () => {
    const store = makeStore();
    appendForwardTrade(store, "FWD-IDEM", 18.7, "2026-08-15");
    const stub = makeStubForwardRateSource({ "USD/ZAR": { 90: 19_000_000n } });

    const r1 = runEodFxForwardRevaluation(store, AS_OF, stub);
    const r2 = runEodFxForwardRevaluation(store, AS_OF, stub);

    expect(r1.revalued).toBe(1);
    expect(r2.revalued).toBe(0);
    expect(r2.skipped).toBe(1);

    let count = 0;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      void e;
      count++;
    }
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-FWD-3: No positions
// ---------------------------------------------------------------------------

describe("TC-FWD-3: no non-spot positions", () => {
  it("returns revalued=0 when store is empty", () => {
    const store = makeStore();
    const stub = makeSimpleStub();
    const result = runEodFxForwardRevaluation(store, AS_OF, stub);
    expect(result.revalued).toBe(0);
    expect(result.skipped).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TC-FWD-4: Missing rate — error captured, not thrown
// ---------------------------------------------------------------------------

describe("TC-FWD-4: missing rate — error captured per trade", () => {
  it("captures the error in result.errors and does not throw", () => {
    const store = makeStore();
    appendForwardTrade(store, "FWD-NORATE", 18.7, "2026-08-15");

    // Rate source has no data for ZAR/USD.
    const stub = makeStubForwardRateSource({});
    const result = runEodFxForwardRevaluation(store, AS_OF, stub);

    expect(result.revalued).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("FWD-NORATE");
  });
});

// ---------------------------------------------------------------------------
// TC-FWD-5: Settled position excluded
// ---------------------------------------------------------------------------

describe("TC-FWD-5: settled forward excluded", () => {
  it("skips a forward with TradeMatured (near leg)", () => {
    const store = makeStore();
    appendForwardTrade(store, "FWD-SETTLED", 18.7, "2026-08-15");
    appendSettlementConfirmed(store, "FWD-SETTLED", "near");

    const stub = makeStubForwardRateSource({ "USD/ZAR": { 90: 19_000_000n } });
    const result = runEodFxForwardRevaluation(store, AS_OF, stub);

    expect(result.revalued).toBe(0);
    let count = 0;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      void e;
      count++;
    }
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TC-FWD-6: Multiple positions
// ---------------------------------------------------------------------------

describe("TC-FWD-6: multiple forward positions", () => {
  it("revalues open ones, skips settled ones", () => {
    const store = makeStore();
    appendForwardTrade(store, "FWD-A", 18.7, "2026-08-15");
    appendForwardTrade(store, "FWD-B", 18.5, "2026-08-15");
    appendForwardTrade(store, "FWD-C", 18.9, "2026-08-15");
    appendSettlementConfirmed(store, "FWD-C", "near"); // settle FWD-C

    const stub = makeStubForwardRateSource({ "USD/ZAR": { 90: 19_000_000n } });
    const result = runEodFxForwardRevaluation(store, AS_OF, stub);

    expect(result.revalued).toBe(2); // FWD-A, FWD-B
    expect(result.skipped).toBe(0);

    let count = 0;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      void e;
      count++;
    }
    expect(count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// TC-FWD-7: Tenor calculation drives rate lookup
// ---------------------------------------------------------------------------

describe("TC-FWD-7: tenor drives forward rate lookup", () => {
  it("uses correct tenorDays when looking up the forward rate", () => {
    const store = makeStore();
    // Settlement in 30 calendar days from AS_OF (2026-06-16).
    appendForwardTrade(store, "FWD-30D", 18.6, "2026-06-16");

    const queriedTenors: number[] = [];
    const recordingSource: ForwardRateSource = {
      getForwardRate(_pair, _date, tenorDays) {
        queriedTenors.push(tenorDays);
        return 18_700_000n;
      },
    };

    runEodFxForwardRevaluation(store, AS_OF, recordingSource);

    expect(queriedTenors).toHaveLength(1);
    // 2026-06-16 − 2026-05-17 = 30 calendar days
    expect(queriedTenors[0]).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// TC-SWP-1: FX-swap — near leg settled, far leg still open
// ---------------------------------------------------------------------------

describe("TC-SWP-1: FX-swap near leg settled — far leg valued", () => {
  it("emits revaluation for far leg when near leg is settled", () => {
    const store = makeStore();
    appendSwapTrade(store, "SWP-001", "2026-05-19", "2026-08-19", 18.6, 18.9);
    // Near leg confirmed.
    appendSettlementConfirmed(store, "SWP-001", "near");

    const stub = makeStubForwardRateSource({ "USD/ZAR": { 94: 19_100_000n } });
    const result = runEodFxForwardRevaluation(store, AS_OF, stub);

    expect(result.revalued).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TC-SWP-2: FX-swap — both legs open, values far leg
// ---------------------------------------------------------------------------

describe("TC-SWP-2: FX-swap — both legs open, far leg valued", () => {
  it("emits one FxPositionRevalued for the far leg", () => {
    const store = makeStore();
    appendSwapTrade(store, "SWP-OPEN", "2026-05-19", "2026-08-19");

    const stub = makeStubForwardRateSource({ "USD/ZAR": { 94: 19_100_000n } });
    const result = runEodFxForwardRevaluation(store, AS_OF, stub);

    expect(result.revalued).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-SWP-3: FX-swap — far leg confirmed (fully settled)
// ---------------------------------------------------------------------------

describe("TC-SWP-3: FX-swap fully settled — excluded", () => {
  it("skips trade when far leg TradeMatured exists", () => {
    const store = makeStore();
    appendSwapTrade(store, "SWP-FULL-SETTLED");
    appendSettlementConfirmed(store, "SWP-FULL-SETTLED", "far");

    const stub = makeStubForwardRateSource({ "USD/ZAR": { 94: 19_100_000n } });
    const result = runEodFxForwardRevaluation(store, AS_OF, stub);

    expect(result.revalued).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TC-NDF-1: NDF sunny-day
// ---------------------------------------------------------------------------

describe("TC-NDF-1: NDF sunny-day", () => {
  it("emits FxPositionRevalued with cash MtM and returns revalued=1", () => {
    const store = makeStore();
    // Settlement in 94 days; book rate 18.8.
    appendNdfTrade(store, "NDF-001", 18.8, "2026-08-19");

    // 2026-08-19 − 2026-05-17 = 94 days
    const stub = makeStubForwardRateSource({ "USD/ZAR": { 94: 19_200_000n } });
    const result = runEodFxForwardRevaluation(store, AS_OF, stub);

    expect(result.revalued).toBe(1);
    expect(result.errors).toHaveLength(0);

    let payload: { unrealisedPnlZarMinor: number; tradeId: string } | undefined;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      payload = e.payload as typeof payload;
    }
    expect(payload?.tradeId).toBe("NDF-001");
    // pnlDelta = (19_200_000 - 18_800_000) * 100_000_000 / 19_200_000
    //          = 400_000 * 100_000_000 / 19_200_000
    //          ≈ 2_083_333
    expect(payload?.unrealisedPnlZarMinor).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// TC-NDF-2: NDF idempotency
// ---------------------------------------------------------------------------

describe("TC-NDF-2: NDF idempotency", () => {
  it("second run skips the already-revalued NDF", () => {
    const store = makeStore();
    appendNdfTrade(store, "NDF-IDEM");
    const stub = makeStubForwardRateSource({ "USD/ZAR": { 94: 19_200_000n } });

    const r1 = runEodFxForwardRevaluation(store, AS_OF, stub);
    const r2 = runEodFxForwardRevaluation(store, AS_OF, stub);

    expect(r1.revalued).toBe(1);
    expect(r2.revalued).toBe(0);
    expect(r2.skipped).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-NDF-3: NDF settled → excluded
// ---------------------------------------------------------------------------

describe("TC-NDF-3: NDF settled — excluded", () => {
  it("skips NDF with TradeMatured", () => {
    const store = makeStore();
    appendNdfTrade(store, "NDF-SETTLED");
    appendSettlementConfirmed(store, "NDF-SETTLED", "near");

    const stub = makeStubForwardRateSource({ "USD/ZAR": { 94: 19_200_000n } });
    const result = runEodFxForwardRevaluation(store, AS_OF, stub);

    expect(result.revalued).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TC-MIX-1: Mixed forward + swap + NDF
// ---------------------------------------------------------------------------

describe("TC-MIX-1: mixed portfolio — forward + swap + NDF", () => {
  it("revalues all three types in a single run", () => {
    const store = makeStore();
    appendForwardTrade(store, "MIX-FWD", 18.7, "2026-08-15");
    appendSwapTrade(store, "MIX-SWP", "2026-05-19", "2026-08-19");
    appendNdfTrade(store, "MIX-NDF", 18.8, "2026-08-19");

    const stub = makeStubForwardRateSource({
      "USD/ZAR": {
        90: 19_000_000n, // FWD-MIX: 2026-08-15 = 90d from 2026-05-17
        94: 19_100_000n, // SWP far + NDF: 2026-08-19 = 94d
      },
    });

    const result = runEodFxForwardRevaluation(store, AS_OF, stub);

    expect(result.revalued).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    let count = 0;
    for (const e of store.replay({ type: "FxPositionRevalued" })) {
      void e;
      count++;
    }
    expect(count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// TC-SEED-1: forward-rate-seed linear interpolation
// ---------------------------------------------------------------------------

describe("TC-SEED-1: forward-rate-seed linear interpolation", () => {
  it("returns exact node value for a standard tenor", () => {
    const rate = seedForwardRate("ZAR/USD", 90);
    expect(rate).toBe(18_804_000n);
  });

  it("interpolates correctly between 30d and 60d nodes", () => {
    // Midpoint of 30d and 60d: (30+60)/2 = 45d
    // ZAR/USD: r_30 = 18_668_000, r_60 = 18_736_000
    // Interpolated = 18_668_000 + (18_736_000 - 18_668_000) × (45-30)/(60-30)
    //              = 18_668_000 + 68_000 × 15/30
    //              = 18_668_000 + 34_000 = 18_702_000
    const rate = seedForwardRate("ZAR/USD", 45);
    expect(rate).toBe(18_702_000n);
  });

  it("interpolateForwardRate helper matches direct calculation", () => {
    const r0 = 18_668_000n;
    const r1 = 18_736_000n;
    const result = interpolateForwardRate(45, 30, r0, 60, r1);
    expect(result).toBe(18_702_000n);
  });

  it("throws for unknown currency pair", () => {
    expect(() => seedForwardRate("ZAR/XYZ", 90)).toThrow(/ZAR\/XYZ/);
  });
});

// ---------------------------------------------------------------------------
// TC-SEED-2: forward-rate-seed boundary clamping
// ---------------------------------------------------------------------------

describe("TC-SEED-2: forward-rate-seed boundary clamping", () => {
  it("clamps to 7d node for tenorDays < 7", () => {
    const rate1 = seedForwardRate("ZAR/USD", 1);
    const rate7 = seedForwardRate("ZAR/USD", 7);
    expect(rate1).toBe(rate7);
  });

  it("clamps to 365d node for tenorDays > 365", () => {
    const rate400 = seedForwardRate("ZAR/USD", 400);
    const rate365 = seedForwardRate("ZAR/USD", 365);
    expect(rate400).toBe(rate365);
  });

  it("all 7 pairs resolve without error at 90d", () => {
    const pairs = ["ZAR/USD", "ZAR/EUR", "ZAR/GBP", "ZAR/JPY", "ZAR/CHF", "ZAR/AUD", "ZAR/CNY"];
    for (const pair of pairs) {
      expect(() => seedForwardRate(pair, 90)).not.toThrow();
    }
  });
});
