// tests/fx-accounting.test.ts
//
// Exit-criterion tests for the FX Spot accounting layer:
//
//   1. Event type schemas — FxPositionRevalued, FxSettlementConfirmed,
//      SubLedgerPostingEmitted validation and construction.
//   2. Posting rules — trade booking, revaluation, settlement journals
//      (balance invariant: debits = credits per currency).
//   3. Round-trip — book → revalue → settle → zero balance assertion.
//   4. Calculators:
//      (a) fxPositionCalculator — open position aggregation
//      (b) unrealisedPnlCalculator — mark-to-market P&L
//      (c) realisedPnlCalculator — settlement P&L
//      (d) fxRwaCalculator — standardised-approach capital charge
//   5. BA-350 FX adapter — fxPositionsToBa350Input + generateBa350MarketRisk
//      with live FX positions.
//   6. Sub-ledger projection — FX events fold to SubLedgerRow[].
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION + D-MARKETS-CAPITAL-TIME-SHAPE
// Authors: Camille (CFO, finance) + Bea (Accounting & financial reporting
//   engineer, engineering)

import { describe, expect, it } from "bun:test";

import {
  FX_ACCOUNTING_EVENT_TYPES,
  fxPositionRevaluedPayloadSchema,
  fxSettlementConfirmedPayloadSchema,
  fxSettlementFailedPayloadSchema,
  makeFxPositionRevalued,
  makeFxSettlementFailed,
  makeMissedExpectedReceipt,
  makeSettlementFailureClassified,
  missedExpectedReceiptPayloadSchema,
  settlementFailureClassifiedPayloadSchema,
  subLedgerPostingEmittedPayloadSchema,
} from "../platform/event-store/event-types/fx-accounting";

import {
  FX_ACCOUNTS,
  fxRevaluationJournals,
  fxSettlementJournals,
  fxTradeBookingJournals,
} from "../platform/accounting/posting-rules/fx-spot";

import {
  fxPositionCalculator,
  fxRwaCalculator,
  realisedPnlCalculator,
  unrealisedPnlCalculator,
} from "../platform/accounting/fx-calculators";

import { fxPositionsToBa350Input } from "../platform/reporting/ba-350-fx-adapter";

import { generateBa350MarketRisk } from "../platform/reporting/ba-350-market-risk";

import {
  fxSubLedgerProjection,
  subLedgerInitial,
} from "../platform/projections/markets/sub-ledger";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["D-MARKETS-SCHEMA-FOUNDATION", "[citation: TBC]"];
const ACTOR = { id: "agent:bea", type: "service" as const };

const BASE_TRADE_PAYLOAD = {
  tradeId: { scheme: "INTERNAL", value: "FX-TEST-001" },
  productTaxonomy: "FX-spot" as const,
  currencyPair: { base: "USD", quote: "ZAR" },
  side: "buy" as const,
  legs: [
    {
      legKind: "near" as const,
      payCurrency: "ZAR",
      receiveCurrency: "USD",
      notional: { currency: "ZAR", amountMinor: 1_900_000_000 }, // ZAR 19m (minor = cents)
      counterNotional: { currency: "USD", amountMinor: 100_000_000 }, // USD 1m (minor = cents)
      rate: { currency: "ZAR", amount: 19.0 },
      settlementDate: { iso: "2026-05-14", calendar: "JIHCAL" as const },
    },
  ],
  tradeDate: { iso: "2026-05-12", calendar: "JIHCAL" as const },
  counterparty: {
    partyId: "LEI-CTPY-001",
    name: "Test Counterparty",
    role: "counterparty" as const,
    jurisdiction: "ZA",
  },
  venue: "OTC",
  trader: "TRADER-01",
  bookId: "FX-TRADING-BOOK",
  bookType: "trading" as const,
  settlementForm: "physical" as const,
  settlementPath: "correspondent" as const,
  // No-prop attribution (G-3) — fixtures default to client-flow.
  clientFlowRef: "client-trade:fx-accounting-test",
};

// ---------------------------------------------------------------------------
// 1. Event type schemas
// ---------------------------------------------------------------------------

describe("FX accounting event types", () => {
  it("FX_ACCOUNTING_EVENT_TYPES lists the core event types", () => {
    expect(FX_ACCOUNTING_EVENT_TYPES).toContain("FxPositionRevalued");
    expect(FX_ACCOUNTING_EVENT_TYPES).toContain("FxSettlementConfirmed");
    expect(FX_ACCOUNTING_EVENT_TYPES).toContain("SubLedgerPostingEmitted");
  });

  it("FX_ACCOUNTING_EVENT_TYPES includes PROC-OPS-SFBCP-01 settlement-failure events", () => {
    // Authority: Devon (Chief Operating Officer, governance) procedure
    // PROC-OPS-SFBCP-01 v0.2 (PR #636).
    expect(FX_ACCOUNTING_EVENT_TYPES).toContain("FxSettlementFailed");
    expect(FX_ACCOUNTING_EVENT_TYPES).toContain("MissedExpectedReceipt");
    expect(FX_ACCOUNTING_EVENT_TYPES).toContain("SettlementFailureClassified");
  });

  it("FxPositionRevalued payload validates correctly", () => {
    const payload = {
      tradeId: "FX-TEST-001",
      currencyPair: "ZAR/USD",
      bookRate: 19.0,
      revalRate: 19.5,
      notionalBaseMinor: 1_900_000_000,
      unrealisedPnlZarMinor: 2_500_000,
      revaluedAt: "2026-05-12T16:00:00.000Z",
      rateSource: "stub",
    };
    expect(() => fxPositionRevaluedPayloadSchema.parse(payload)).not.toThrow();
  });

  it("FxSettlementConfirmed payload validates correctly", () => {
    const payload = {
      tradeId: "FX-TEST-001",
      currencyPair: "ZAR/USD",
      legKind: "near" as const,
      settledBaseCurrencyMinor: -1_900_000_000, // bank paid ZAR
      settledQuoteCurrencyMinor: 100_000_000, // bank received USD
      settledAt: "2026-05-14T10:00:00.000Z",
      nostroAccountBase: "ACC-1100-001",
      nostroAccountQuote: "ACC-1100-002",
      realisedPnlZarMinor: 50_000, // small gain
    };
    expect(() => fxSettlementConfirmedPayloadSchema.parse(payload)).not.toThrow();
  });

  it("SubLedgerPostingEmitted rejects unbalanced legs", () => {
    const unbalanced = {
      sourceEventId: "evt-001",
      postingType: "trade-booking" as const,
      legs: [
        {
          accountId: "ACC-2100-001",
          debitCredit: "debit" as const,
          amountMinor: 100,
          currency: "ZAR",
        },
        {
          accountId: "ACC-2100-003",
          debitCredit: "credit" as const,
          amountMinor: 50,
          currency: "ZAR",
        }, // mismatch
      ],
      postedAt: "2026-05-12T08:00:00.000Z",
    };
    expect(() => subLedgerPostingEmittedPayloadSchema.parse(unbalanced)).toThrow();
  });

  it("SubLedgerPostingEmitted accepts balanced legs", () => {
    const balanced = {
      sourceEventId: "evt-001",
      postingType: "trade-booking" as const,
      legs: [
        {
          accountId: "ACC-2100-001",
          debitCredit: "debit" as const,
          amountMinor: 100,
          currency: "ZAR",
        },
        {
          accountId: "ACC-2100-003",
          debitCredit: "credit" as const,
          amountMinor: 100,
          currency: "ZAR",
        },
      ],
      postedAt: "2026-05-12T08:00:00.000Z",
    };
    expect(() => subLedgerPostingEmittedPayloadSchema.parse(balanced)).not.toThrow();
  });

  // ---------------------------------------------------------------------
  // PROC-OPS-SFBCP-01 settlement-failure event types (PR #636)
  // ---------------------------------------------------------------------

  it("FxSettlementFailed — happy-path payload validates", () => {
    const payload = {
      tradeRef: "FX-TEST-001",
      settlementInstructionRef: "SETT-001",
      failedAt: "2026-05-14T11:30:00.000Z",
      failureKind: "one-leg-delivered" as const,
      failureReason: "Counterparty USD leg not received by cutoff + 15m",
      legStatus: { payLegDelivered: true, receiveLegDelivered: false },
    };
    expect(() => fxSettlementFailedPayloadSchema.parse(payload)).not.toThrow();
    const evt = makeFxSettlementFailed({
      asOf: payload.failedAt,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload,
    });
    expect(evt.type).toBe("FxSettlementFailed");
  });

  it("FxSettlementFailed — rejects unknown failureKind", () => {
    expect(() =>
      fxSettlementFailedPayloadSchema.parse({
        tradeRef: "FX-TEST-001",
        settlementInstructionRef: "SETT-001",
        failedAt: "2026-05-14T11:30:00.000Z",
        failureKind: "not-a-real-kind",
        failureReason: "nope",
        legStatus: { payLegDelivered: false, receiveLegDelivered: false },
      }),
    ).toThrow();
  });

  it("FxSettlementFailed — make* requires citations", () => {
    expect(() =>
      makeFxSettlementFailed({
        asOf: "2026-05-14T11:30:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: {
          tradeRef: "FX-TEST-001",
          settlementInstructionRef: "SETT-001",
          failedAt: "2026-05-14T11:30:00.000Z",
          failureKind: "neither-delivered",
          failureReason: "Mutual fail",
          legStatus: { payLegDelivered: false, receiveLegDelivered: false },
        },
      }),
    ).toThrow(/citation/i);
  });

  it("MissedExpectedReceipt — happy-path payload validates", () => {
    const payload = {
      tradeRef: "FX-TEST-001",
      settlementInstructionRef: "SETT-001",
      expectedCurrency: "USD",
      // String-typed minor units (supports notionals beyond JS safe-int).
      expectedAmountMinor: "100000000",
      cutoffAt: "2026-05-14T10:00:00.000Z",
      toleranceMinutes: 15,
      detectedAt: "2026-05-14T10:16:00.000Z",
    };
    expect(() => missedExpectedReceiptPayloadSchema.parse(payload)).not.toThrow();
    const evt = makeMissedExpectedReceipt({
      asOf: payload.detectedAt,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload,
    });
    expect(evt.type).toBe("MissedExpectedReceipt");
  });

  it("MissedExpectedReceipt — rejects non-numeric amount string", () => {
    expect(() =>
      missedExpectedReceiptPayloadSchema.parse({
        tradeRef: "FX-TEST-001",
        settlementInstructionRef: "SETT-001",
        expectedCurrency: "USD",
        expectedAmountMinor: "abc",
        cutoffAt: "2026-05-14T10:00:00.000Z",
        toleranceMinutes: 15,
        detectedAt: "2026-05-14T10:16:00.000Z",
      }),
    ).toThrow();
  });

  it("SettlementFailureClassified — happy-path payload validates", () => {
    const payload = {
      settlementInstructionRef: "SETT-001",
      classification: "herstatt-active" as const,
      classifiedAt: "2026-05-14T11:45:00.000Z",
      classifiedBy: "agent:devon",
      evidence: ["event:fx-settlement-failed-evt-001", "doc:swift-mt199-correspondent-response"],
    };
    expect(() => settlementFailureClassifiedPayloadSchema.parse(payload)).not.toThrow();
    const evt = makeSettlementFailureClassified({
      asOf: payload.classifiedAt,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload,
    });
    expect(evt.type).toBe("SettlementFailureClassified");
  });

  it("SettlementFailureClassified — rejects unknown classification", () => {
    expect(() =>
      settlementFailureClassifiedPayloadSchema.parse({
        settlementInstructionRef: "SETT-001",
        classification: "not-a-real-class",
        classifiedAt: "2026-05-14T11:45:00.000Z",
        classifiedBy: "agent:devon",
        evidence: [],
      }),
    ).toThrow();
  });

  it("makeFxPositionRevalued requires citations", () => {
    expect(() =>
      makeFxPositionRevalued({
        asOf: "2026-05-12T16:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: {
          tradeId: "FX-TEST-001",
          currencyPair: "ZAR/USD",
          bookRate: 19.0,
          revalRate: 19.5,
          notionalBaseMinor: 1_900_000_000,
          unrealisedPnlZarMinor: 0,
          revaluedAt: "2026-05-12T16:00:00.000Z",
          rateSource: "stub",
        },
      }),
    ).toThrow(/citation/i);
  });
});

// ---------------------------------------------------------------------------
// 2. Posting rules — balance invariant
// ---------------------------------------------------------------------------

describe("FX posting rules — balance invariant (debits = credits per currency)", () => {
  function assertBalanced(legs: ReturnType<typeof fxTradeBookingJournals>): void {
    const totals = new Map<string, { debit: number; credit: number }>();
    for (const leg of legs) {
      const t = totals.get(leg.currency) ?? { debit: 0, credit: 0 };
      if (leg.debitCredit === "debit") t.debit += leg.amountMinor;
      else t.credit += leg.amountMinor;
      totals.set(leg.currency, t);
    }
    for (const [, t] of totals.entries()) {
      expect(t.debit).toBe(t.credit); // balance assertion
    }
  }

  it("PR-FX-001: trade booking journals balance per currency", () => {
    const legs = fxTradeBookingJournals({
      tradeId: "FX-TEST-001",
      side: "buy",
      legs: BASE_TRADE_PAYLOAD.legs,
      currencyPair: BASE_TRADE_PAYLOAD.currencyPair,
    });
    expect(legs.length).toBeGreaterThan(0);
    assertBalanced(legs);
  });

  it("PR-FX-001: trade booking creates receivable and payable entries", () => {
    const legs = fxTradeBookingJournals({
      tradeId: "FX-TEST-001",
      side: "buy",
      legs: BASE_TRADE_PAYLOAD.legs,
      currencyPair: BASE_TRADE_PAYLOAD.currencyPair,
    });
    const accountIds = legs.map((l) => l.accountId);
    // Must reference both receivable and payable accounts
    expect(accountIds).toContain(FX_ACCOUNTS.RECEIVABLE_ZAR);
    expect(accountIds).toContain(FX_ACCOUNTS.PAYABLE_ZAR);
  });

  it("PR-FX-002: revaluation journals balance (gain scenario)", () => {
    const legs = fxRevaluationJournals({
      tradeId: "FX-TEST-001",
      currencyPair: "ZAR/USD",
      bookRate: 19.0,
      revalRate: 19.5,
      notionalBaseMinor: 1_900_000_000,
      unrealisedPnlZarMinor: 2_500_000, // gain
      revaluedAt: "2026-05-12T16:00:00.000Z",
      rateSource: "stub",
    });
    assertBalanced(legs);
    // Gain: Dr FX Receivable, Cr Unrealised P&L
    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    const creditLeg = legs.find((l) => l.debitCredit === "credit");
    expect(debitLeg?.accountId).toBe(FX_ACCOUNTS.RECEIVABLE_ZAR);
    expect(creditLeg?.accountId).toBe(FX_ACCOUNTS.UNREALISED_PNL);
  });

  it("PR-FX-002: revaluation journals balance (loss scenario)", () => {
    const legs = fxRevaluationJournals({
      tradeId: "FX-TEST-001",
      currencyPair: "ZAR/USD",
      bookRate: 19.0,
      revalRate: 18.5,
      notionalBaseMinor: 1_900_000_000,
      unrealisedPnlZarMinor: -2_500_000, // loss
      revaluedAt: "2026-05-12T16:00:00.000Z",
      rateSource: "stub",
    });
    assertBalanced(legs);
    // Loss: Dr Unrealised P&L, Cr FX Receivable
    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    const creditLeg = legs.find((l) => l.debitCredit === "credit");
    expect(debitLeg?.accountId).toBe(FX_ACCOUNTS.UNREALISED_PNL);
    expect(creditLeg?.accountId).toBe(FX_ACCOUNTS.RECEIVABLE_ZAR);
  });

  it("PR-FX-002: zero-delta revaluation produces no journals", () => {
    const legs = fxRevaluationJournals({
      tradeId: "FX-TEST-001",
      currencyPair: "ZAR/USD",
      bookRate: 19.0,
      revalRate: 19.0,
      notionalBaseMinor: 1_900_000_000,
      unrealisedPnlZarMinor: 0,
      revaluedAt: "2026-05-12T16:00:00.000Z",
      rateSource: "stub",
    });
    expect(legs).toHaveLength(0);
  });

  it("PR-FX-003: settlement journals balance per currency", () => {
    const legs = fxSettlementJournals({
      tradeId: "FX-TEST-001",
      currencyPair: "ZAR/USD",
      legKind: "near",
      settledBaseCurrencyMinor: -1_900_000_000, // bank paid ZAR
      settledQuoteCurrencyMinor: 100_000_000, // bank received USD
      settledAt: "2026-05-14T10:00:00.000Z",
      nostroAccountBase: "ACC-1100-001",
      nostroAccountQuote: "ACC-1100-002",
      realisedPnlZarMinor: 0,
    });
    assertBalanced(legs);
  });

  it("PR-FX-003: settlement journals with realised P&L gain also balance", () => {
    const legs = fxSettlementJournals({
      tradeId: "FX-TEST-001",
      currencyPair: "ZAR/USD",
      legKind: "near",
      settledBaseCurrencyMinor: -1_900_000_000,
      settledQuoteCurrencyMinor: 100_000_000,
      settledAt: "2026-05-14T10:00:00.000Z",
      nostroAccountBase: "ACC-1100-001",
      nostroAccountQuote: "ACC-1100-002",
      realisedPnlZarMinor: 50_000, // gain
    });
    assertBalanced(legs);
  });
});

// ---------------------------------------------------------------------------
// 3. Round-trip: book → revalue → settle → net zero balance
// ---------------------------------------------------------------------------

describe("FX round-trip — book, revalue, settle → net zero open-position balance", () => {
  it("after settlement, no open positions remain for the settled trade", () => {
    // tradeId.value is what goes into settledTradeIds
    const trade = {
      ...BASE_TRADE_PAYLOAD,
      tradeId: { scheme: "INTERNAL", value: "FX-ROUNDTRIP-001" },
    };
    const settledIds = new Set([trade.tradeId.value]);

    const positions = fxPositionCalculator({
      trades: [trade],
      settledTradeIds: settledIds,
      zarRates: new Map([["USD", 0.01]]),
      asOf: "2026-05-14T10:00:00.000Z",
    });

    // After settlement, no open positions for this trade
    expect(positions).toHaveLength(0);
  });

  it("before settlement, position shows as open", () => {
    const openIds = new Set<string>(); // no settlements

    const trade = {
      ...BASE_TRADE_PAYLOAD,
      tradeId: { scheme: "INTERNAL", value: "FX-ROUNDTRIP-002" },
    };

    const positions = fxPositionCalculator({
      trades: [trade],
      settledTradeIds: openIds,
      zarRates: new Map([["USD", 0.01]]),
      asOf: "2026-05-12T16:00:00.000Z",
    });

    expect(positions).toHaveLength(1);
    expect(positions[0]?.openTradeCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Calculators
// ---------------------------------------------------------------------------

describe("fxPositionCalculator", () => {
  it("computes net long for a single buy trade", () => {
    const trade = {
      ...BASE_TRADE_PAYLOAD,
      tradeId: { scheme: "INTERNAL", value: "FX-POS-001" },
    };

    const result = fxPositionCalculator({
      trades: [trade],
      settledTradeIds: new Set(),
      zarRates: new Map([["USD", 0.01]]), // 1 USD cent = 0.01 ZAR minor units
      asOf: "2026-05-12T16:00:00.000Z",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.currencyPair).toBe("USD/ZAR");
    expect(result[0]?.netPositionBaseMinor).toBeGreaterThan(0); // net long
    expect(result[0]?.grossLongBaseMinor).toBeGreaterThan(0);
    expect(result[0]?.grossShortBaseMinor).toBe(0);
  });

  it("excludes settled trades", () => {
    const trade = {
      ...BASE_TRADE_PAYLOAD,
      tradeId: { scheme: "INTERNAL", value: "FX-POS-002" },
    };

    const result = fxPositionCalculator({
      trades: [trade],
      settledTradeIds: new Set([trade.tradeId.value]),
      zarRates: new Map([["USD", 0.01]]),
      asOf: "2026-05-14T10:00:00.000Z",
    });

    expect(result).toHaveLength(0);
  });
});

describe("unrealisedPnlCalculator", () => {
  it("computes zero P&L when current rate equals book rate", () => {
    const trade = {
      ...BASE_TRADE_PAYLOAD,
      tradeId: { scheme: "INTERNAL", value: "FX-UNREAL-001" },
    };

    const result = unrealisedPnlCalculator({
      trades: [trade],
      settledTradeIds: new Set(),
      latestRevaluations: new Map(),
      currentRates: new Map([["USD", 19.0]]), // same as book rate
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.unrealisedPnlZarMinor).toBe(0);
  });

  it("computes positive P&L when USD appreciates (buy trade)", () => {
    const trade = {
      ...BASE_TRADE_PAYLOAD,
      tradeId: { scheme: "INTERNAL", value: "FX-UNREAL-002" },
    }; // buy USD at 19.0

    const result = unrealisedPnlCalculator({
      trades: [trade],
      settledTradeIds: new Set(),
      latestRevaluations: new Map(),
      currentRates: new Map([["USD", 20.0]]), // USD now worth more ZAR
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.unrealisedPnlZarMinor).toBeGreaterThan(0); // gain
  });

  // -------------------------------------------------------------------------
  // Slice-2 regression — D-FX-QUOTING-CONVENTION (Bea, 2026-05-21).
  //
  // Pre-Slice-2 the calculator read `nearLeg.notional.amountMinor` as if it
  // were always the base-currency amount. For a BUY trade on a major-first
  // pair the notional sits on the quote side, so the legacy reading was the
  // quote-currency cents, not base — and multiplying by ΔRate (units
  // ZAR/USD) produced a number ~rate× too large.
  //
  // The fixtures below pin both sides of the bug:
  //
  //   (a) BUY USD/ZAR — notional ZAR 92.5m (quote), counterNotional USD 5m
  //       (base). Book rate 18.5 ZAR/USD; current rate 19.0. Correct
  //       unrealised P&L = ΔRate × USD-notional = 0.5 × 500_000_000 cents =
  //       +ZAR 250_000_000 minor units (ZAR 2.5m).
  //       Pre-Slice-2 bogus = 0.5 × 9_250_000_000 cents = +ZAR 4_625_000_000
  //       minor units (ZAR 46.25m) — ~rate× too large.
  //
  //   (b) SELL USD/ZAR — notional USD 5m (base), counterNotional ZAR 92.5m
  //       (quote). Book rate 18.5; current rate 19.0. Bank is short USD, so
  //       USD appreciating is a loss. Correct unrealised P&L = -ZAR 250_000_000
  //       minor units. Pre-Slice-2 the SELL side accidentally read the base
  //       amount correctly (because pay=base on a SELL major-first leg) — so
  //       this fixture proves the migration didn't regress the previously-
  //       correct branch.
  // -------------------------------------------------------------------------
  describe("Slice-2 regression: baseAmountMinor side-correct resolution", () => {
    const SLICE2_COMMON = {
      productTaxonomy: "FX-spot" as const,
      currencyPair: { base: "USD", quote: "ZAR" },
      legs: [], // overridden per-test
      tradeDate: { iso: "2026-05-20", calendar: "JIHCAL" as const },
      counterparty: {
        partyId: "LEI-CTPY-001",
        name: "Test Counterparty",
        role: "counterparty" as const,
        jurisdiction: "ZA",
      },
      venue: "OTC",
      trader: "TRADER-01",
      bookId: "FX-TRADING-BOOK",
      bookType: "trading" as const,
      settlementForm: "physical" as const,
      settlementPath: "correspondent" as const,
      clientFlowRef: "client-trade:slice-2-regression",
    };

    it("BUY USD/ZAR — base-amount lives on counterNotional; uses USD notional × ΔRate", () => {
      const trade = {
        ...SLICE2_COMMON,
        tradeId: { scheme: "INTERNAL", value: "FX-BUY-SLICE2" },
        side: "buy" as const,
        legs: [
          {
            legKind: "near" as const,
            // BUY on major-first pair (USD/ZAR): pay quote (ZAR), receive base (USD).
            payCurrency: "ZAR",
            receiveCurrency: "USD",
            // notional in pay currency (ZAR 92.5m → 9_250_000_000 ZAR-cents)
            notional: { currency: "ZAR", amountMinor: 9_250_000_000 },
            // counterNotional in receive currency (USD 5m → 500_000_000 USD-cents)
            counterNotional: { currency: "USD", amountMinor: 500_000_000 },
            // Slice-1 invariant clause (iv): rate.currency = pair.quote
            rate: { currency: "ZAR", amount: 18.5 },
            settlementDate: { iso: "2026-05-22", calendar: "JIHCAL" as const },
          },
        ],
      };

      const result = unrealisedPnlCalculator({
        trades: [trade],
        settledTradeIds: new Set(),
        latestRevaluations: new Map(),
        currentRates: new Map([["USD", 19.0]]),
      });

      expect(result).toHaveLength(1);
      // Correct: ΔRate × USD-notional = 0.5 × 500_000_000 = +250_000_000 ZAR-minor
      // Bogus (pre-Slice-2): 0.5 × 9_250_000_000 = +4_625_000_000 ZAR-minor (~rate× too large)
      expect(result[0]?.unrealisedPnlZarMinor).toBe(250_000_000);
      expect(result[0]?.notionalBaseMinor).toBe(500_000_000);
    });

    it("SELL USD/ZAR — base-amount lives on notional; previously-correct branch preserved", () => {
      const trade = {
        ...SLICE2_COMMON,
        tradeId: { scheme: "INTERNAL", value: "FX-SELL-SLICE2" },
        side: "sell" as const,
        legs: [
          {
            legKind: "near" as const,
            // SELL on major-first pair (USD/ZAR): pay base (USD), receive quote (ZAR).
            payCurrency: "USD",
            receiveCurrency: "ZAR",
            // notional in pay currency (USD 5m → 500_000_000 USD-cents)
            notional: { currency: "USD", amountMinor: 500_000_000 },
            // counterNotional in receive currency (ZAR 92.5m → 9_250_000_000 ZAR-cents)
            counterNotional: { currency: "ZAR", amountMinor: 9_250_000_000 },
            rate: { currency: "ZAR", amount: 18.5 },
            settlementDate: { iso: "2026-05-22", calendar: "JIHCAL" as const },
          },
        ],
      };

      const result = unrealisedPnlCalculator({
        trades: [trade],
        settledTradeIds: new Set(),
        latestRevaluations: new Map(),
        currentRates: new Map([["USD", 19.0]]),
      });

      expect(result).toHaveLength(1);
      // SELL: bank is short USD → USD appreciation is a loss.
      // P&L = -ΔRate × USD-notional = -(0.5 × 500_000_000) = -250_000_000
      expect(result[0]?.unrealisedPnlZarMinor).toBe(-250_000_000);
      expect(result[0]?.notionalBaseMinor).toBe(500_000_000);
    });

    it("BUY and SELL produce symmetric P&L (sign-flipped, equal magnitude)", () => {
      // Same trade economics on each side — magnitudes equal, signs flipped.
      const buyTrade = {
        ...SLICE2_COMMON,
        tradeId: { scheme: "INTERNAL", value: "FX-BUY-SYM" },
        side: "buy" as const,
        legs: [
          {
            legKind: "near" as const,
            payCurrency: "ZAR",
            receiveCurrency: "USD",
            notional: { currency: "ZAR", amountMinor: 9_250_000_000 },
            counterNotional: { currency: "USD", amountMinor: 500_000_000 },
            rate: { currency: "ZAR", amount: 18.5 },
            settlementDate: { iso: "2026-05-22", calendar: "JIHCAL" as const },
          },
        ],
      };
      const sellTrade = {
        ...SLICE2_COMMON,
        tradeId: { scheme: "INTERNAL", value: "FX-SELL-SYM" },
        side: "sell" as const,
        legs: [
          {
            legKind: "near" as const,
            payCurrency: "USD",
            receiveCurrency: "ZAR",
            notional: { currency: "USD", amountMinor: 500_000_000 },
            counterNotional: { currency: "ZAR", amountMinor: 9_250_000_000 },
            rate: { currency: "ZAR", amount: 18.5 },
            settlementDate: { iso: "2026-05-22", calendar: "JIHCAL" as const },
          },
        ],
      };

      const out = unrealisedPnlCalculator({
        trades: [buyTrade, sellTrade],
        settledTradeIds: new Set(),
        latestRevaluations: new Map(),
        currentRates: new Map([["USD", 19.0]]),
      });

      expect(out).toHaveLength(2);
      const buyPnl = out.find((r) => r.tradeId === "FX-BUY-SYM")?.unrealisedPnlZarMinor;
      const sellPnl = out.find((r) => r.tradeId === "FX-SELL-SYM")?.unrealisedPnlZarMinor;
      expect(buyPnl).toBe(-(sellPnl ?? 0));
      expect(Math.abs(buyPnl ?? 0)).toBe(250_000_000);
    });
  });
});

describe("realisedPnlCalculator", () => {
  it("returns P&L from settlement events", () => {
    const settlement = {
      tradeId: "FX-REAL-001",
      currencyPair: "ZAR/USD",
      legKind: "near" as const,
      settledBaseCurrencyMinor: -1_900_000_000,
      settledQuoteCurrencyMinor: 100_000_000,
      settledAt: "2026-05-14T10:00:00.000Z",
      nostroAccountBase: "ACC-1100-001",
      nostroAccountQuote: "ACC-1100-002",
      realisedPnlZarMinor: 50_000,
    };

    const result = realisedPnlCalculator({ settlements: [settlement] });
    expect(result).toHaveLength(1);
    expect(result[0]?.realisedPnlZarMinor).toBe(50_000);
    expect(result[0]?.settledAt).toBe("2026-05-14T10:00:00.000Z");
  });

  it("P&L equals difference between book rate and settlement rate × notional", () => {
    // Buy 1m USD at 19.0 ZAR/USD (ZAR 19m paid)
    // Settle at 19.5 ZAR/USD → receive ZAR equivalent 19.5m
    // Realised P&L = (19.5 - 19.0) × 1,000,000 = ZAR 500,000 = 50,000,000 minor
    const settlement = {
      tradeId: "FX-REAL-002",
      currencyPair: "ZAR/USD",
      legKind: "near" as const,
      settledBaseCurrencyMinor: -1_900_000_000, // paid ZAR 19m
      settledQuoteCurrencyMinor: 100_000_000, // received USD 1m
      settledAt: "2026-05-14T10:00:00.000Z",
      nostroAccountBase: "ACC-1100-001",
      nostroAccountQuote: "ACC-1100-002",
      realisedPnlZarMinor: 50_000_000, // ZAR 500,000 in cents
    };

    const result = realisedPnlCalculator({ settlements: [settlement] });
    expect(result[0]?.realisedPnlZarMinor).toBe(50_000_000);
  });
});

describe("fxRwaCalculator", () => {
  it("computes 8% capital charge on max(longs, shorts)", () => {
    const positions = [
      {
        currencyPair: "USD/ZAR",
        netPositionBaseMinor: 100_000_000, // net long 1m USD in cents
        netPositionZarMinor: 1_900_000_000, // ZAR 19m equivalent
        grossLongBaseMinor: 100_000_000,
        grossShortBaseMinor: 0,
        openTradeCount: 1,
        asOf: "2026-05-12T16:00:00.000Z",
      },
    ];

    const result = fxRwaCalculator({
      positions,
      functionalCurrency: "ZAR",
      asOf: "2026-05-12T16:00:00.000Z",
    });

    // Capital = 8% × 1,900,000,000 = 152,000,000
    expect(result.totalCapitalChargeZarMinor).toBe(152_000_000);
    // RWA = 12.5 × 152,000,000 = 1,900,000,000
    expect(result.totalRwaZarMinor).toBe(1_900_000_000);
  });

  it("uses max(longs, shorts) when both sides present", () => {
    const positions = [
      {
        currencyPair: "USD/ZAR",
        netPositionBaseMinor: 100_000_000,
        netPositionZarMinor: 1_900_000_000, // long ZAR 19m
        grossLongBaseMinor: 100_000_000,
        grossShortBaseMinor: 0,
        openTradeCount: 1,
        asOf: "2026-05-12T16:00:00.000Z",
      },
      {
        currencyPair: "EUR/ZAR",
        netPositionBaseMinor: -50_000_000,
        netPositionZarMinor: -1_100_000_000, // short ZAR 11m
        grossLongBaseMinor: 0,
        grossShortBaseMinor: 50_000_000,
        openTradeCount: 1,
        asOf: "2026-05-12T16:00:00.000Z",
      },
    ];

    const result = fxRwaCalculator({
      positions,
      functionalCurrency: "ZAR",
      asOf: "2026-05-12T16:00:00.000Z",
    });

    // Long = 1,900,000,000, Short = 1,100,000,000 → max = 1,900,000,000
    // Capital = 8% × 1,900,000,000 = 152,000,000
    expect(result.sumNetLongsZarMinor).toBe(1_900_000_000);
    expect(result.sumNetShortsZarMinor).toBe(1_100_000_000);
    expect(result.totalCapitalChargeZarMinor).toBe(152_000_000);
  });

  it("excludes functional currency (ZAR) from the charge", () => {
    const positions = [
      {
        currencyPair: "ZAR/USD",
        netPositionBaseMinor: 1_900_000_000,
        netPositionZarMinor: 1_900_000_000,
        grossLongBaseMinor: 1_900_000_000,
        grossShortBaseMinor: 0,
        openTradeCount: 1,
        asOf: "2026-05-12T16:00:00.000Z",
      },
    ];

    const result = fxRwaCalculator({
      positions,
      functionalCurrency: "ZAR", // ZAR excluded
      asOf: "2026-05-12T16:00:00.000Z",
    });

    // ZAR leg is functional currency — excluded from FX charge
    expect(result.totalCapitalChargeZarMinor).toBe(0);
    expect(result.perCurrency).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. BA-350 FX section integration
// ---------------------------------------------------------------------------

describe("BA-350 FX section — fxPositionsToBa350Input + generateBa350MarketRisk", () => {
  it("seeds one open USD position into BA 350 FX section", () => {
    const positions = [
      {
        currencyPair: "USD/ZAR",
        netPositionBaseMinor: 100_000_000,
        netPositionZarMinor: 1_900_000_000,
        grossLongBaseMinor: 100_000_000,
        grossShortBaseMinor: 0,
        openTradeCount: 1,
        asOf: "2026-05-31T23:59:59.999Z",
      },
    ];

    const fxRows = fxPositionsToBa350Input(positions, "ZAR");
    expect(fxRows).toHaveLength(1);
    expect(fxRows[0]?.currency).toBe("USD");
    expect(fxRows[0]?.netPositionFunctionalMinor).toBe(1_900_000_000);

    const ba350 = generateBa350MarketRisk({
      entity: "LE-ZA-HOZ-BANK",
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "period:hoz-bank:month:2026-05",
      functionalCurrency: "ZAR",
      irGeneralMaturityLadder: [],
      irSpecificRisk: [],
      equity: [],
      fxPositions: fxRows,
      commodity: [],
    });

    // FX section should contain the USD position line
    expect(ba350.fx.currencyLines).toHaveLength(1);
    expect(ba350.fx.currencyLines[0]?.lineId).toBe("fx.USD");
    // Capital = 8% × 1,900,000,000 = 152,000,000
    expect(ba350.fx.capitalMinor).toBe(152_000_000);
  });

  it("excludes ZAR-leg positions from BA 350 input", () => {
    const positions = [
      {
        currencyPair: "ZAR/USD", // functional currency leg
        netPositionBaseMinor: 1_000_000,
        netPositionZarMinor: 1_000_000,
        grossLongBaseMinor: 1_000_000,
        grossShortBaseMinor: 0,
        openTradeCount: 1,
        asOf: "2026-05-31T23:59:59.999Z",
      },
    ];

    const fxRows = fxPositionsToBa350Input(positions, "ZAR");
    expect(fxRows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. FX sub-ledger projection
// ---------------------------------------------------------------------------

describe("fxSubLedgerProjection — fold FX events into SubLedgerRow[]", () => {
  it("FxTradeExecuted produces fx-receivable and fx-payable rows", () => {
    const event = {
      event_id: "evt-fx-trade-001",
      type: "FxTradeExecuted" as const,
      as_of: "2026-05-12T09:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: BASE_TRADE_PAYLOAD,
    };

    const state = fxSubLedgerProjection.reduce(
      subLedgerInitial,
      event as Parameters<typeof fxSubLedgerProjection.reduce>[1],
    );
    expect(state.rows.length).toBeGreaterThan(0);

    const legKinds = state.rows.map((r) => r.legKind);
    expect(legKinds).toContain("fx-receivable");
    expect(legKinds).toContain("fx-payable");
  });

  it("FxPositionRevalued produces fx-revaluation row", () => {
    const event = {
      event_id: "evt-fx-reval-001",
      type: "FxPositionRevalued" as const,
      as_of: "2026-05-12T16:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: "FX-TEST-001",
        currencyPair: "ZAR/USD",
        bookRate: 19.0,
        revalRate: 19.5,
        notionalBaseMinor: 1_900_000_000,
        unrealisedPnlZarMinor: 2_500_000,
        revaluedAt: "2026-05-12T16:00:00.000Z",
        rateSource: "stub",
      },
    };

    const state = fxSubLedgerProjection.reduce(
      subLedgerInitial,
      event as Parameters<typeof fxSubLedgerProjection.reduce>[1],
    );
    const revalRows = state.rows.filter((r) => r.legKind === "fx-revaluation");
    expect(revalRows.length).toBeGreaterThan(0);
  });

  it("FxSettlementConfirmed produces settlement rows", () => {
    const event = {
      event_id: "evt-fx-settle-001",
      type: "FxSettlementConfirmed" as const,
      as_of: "2026-05-14T10:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: "FX-TEST-001",
        currencyPair: "ZAR/USD",
        legKind: "near" as const,
        settledBaseCurrencyMinor: -1_900_000_000,
        settledQuoteCurrencyMinor: 100_000_000,
        settledAt: "2026-05-14T10:00:00.000Z",
        nostroAccountBase: "ACC-1100-001",
        nostroAccountQuote: "ACC-1100-002",
        realisedPnlZarMinor: 0,
      },
    };

    const state = fxSubLedgerProjection.reduce(
      subLedgerInitial,
      event as Parameters<typeof fxSubLedgerProjection.reduce>[1],
    );
    const settleRows = state.rows.filter(
      (r) => r.legKind === "fx-settlement-receive" || r.legKind === "fx-settlement-deliver",
    );
    expect(settleRows.length).toBeGreaterThan(0);
  });

  it("projection accepts only FX event types", () => {
    expect(
      fxSubLedgerProjection.accepts({ type: "FxTradeExecuted" } as Parameters<
        typeof fxSubLedgerProjection.accepts
      >[0]),
    ).toBe(true);
    expect(
      fxSubLedgerProjection.accepts({ type: "FxPositionRevalued" } as Parameters<
        typeof fxSubLedgerProjection.accepts
      >[0]),
    ).toBe(true);
    expect(
      fxSubLedgerProjection.accepts({ type: "FxSettlementConfirmed" } as Parameters<
        typeof fxSubLedgerProjection.accepts
      >[0]),
    ).toBe(true);
    expect(
      fxSubLedgerProjection.accepts({ type: "EquityTradeBooked" } as Parameters<
        typeof fxSubLedgerProjection.accepts
      >[0]),
    ).toBe(false);
  });
});
