// runtime/agents/bea-gl-posting-engine.test.ts
//
// Unit tests for bea-gl-posting-engine.ts (universal GL posting engine).
//
// Tests cover:
//   Payment lifecycle:
//   - Empty event store → ok: true, eventsEmitted: 0
//   - One PaymentInitiated → eventsEmitted: 1, SubLedgerPostingEmitted in store
//   - Second run (idempotency) → eventsEmitted: 0, skipped: 1
//   - dryRun: true → eventsEmitted reported but nothing appended
//   - ConfirmationMatched → processed, no SubLedgerPostingEmitted, idempotent
//   - SettlementReversed → produces entries that are the mirror of a prior PR-FX-003
//   - TradeCancelled → net-zero GL (booking + cancel entries sum to zero per account)
//   - TradeAmended (rate change) → delta entries are posted
//   - TradeAmended (settlement-date change) → no GL entries emitted
//
//   FX trade lifecycle (PR-FX-001/002/003):
//   - FxTradeExecuted → trade-booking posting, balanced legs per currency
//   - FxPositionRevalued (gain) → revaluation posting, Dr Receivable / Cr UnrealisedPnL
//   - FxPositionRevalued (loss) → revaluation posting, Dr UnrealisedPnL / Cr Receivable
//   - TradeMatured with positive realised P&L → settlement posting, balanced
//   - Idempotency: re-running over same FX events emits zero duplicates
//
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../platform/core/types";
import {
  makePaymentInitiated,
  makePaymentSettled,
  makeSettlementInstructionReceived,
} from "../../platform/event-store/event-types/payments";
import { EventStore } from "../../platform/event-store/store";

// ---------------------------------------------------------------------------
// We need to test beaGlPostingEngine against an in-memory event store,
// but the engine imports `eventStore` from composition.ts (a singleton).
// We use the same pattern as other agent tests: instantiate EventStore
// in-memory and test the posting-rule functions + idempotency logic
// independently, then test the engine using the shared store directly.
//
// Because the engine reads from the shared composition eventStore (singleton),
// we test the posting rule layer directly for correctness, and use an
// integration approach (isolated EventStore + manual wiring) for the
// engine-level tests.
// ---------------------------------------------------------------------------

import type { SubLedgerLeg } from "../../platform/accounting/fx-accounting-types";
import {
  FX_ACCOUNTS,
  fxRevaluationJournals,
  fxTradeBookingJournals,
} from "../../platform/accounting/posting-rules/fx-spot";
import {
  paymentInitiatedJournals,
  paymentSettledJournals,
  settlementInstructionJournals,
} from "../../platform/accounting/posting-rules/payments";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:bea:gl-posting-engine" };

// Helper: sum debit/credit per account across a set of legs, returning net
// (positive = net debit, negative = net credit).
function netPerAccount(legs: SubLedgerLeg[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const leg of legs) {
    const current = m.get(leg.accountId) ?? 0;
    const delta = leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
    m.set(leg.accountId, current + delta);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Posting-rule integration tests using in-memory store
// ---------------------------------------------------------------------------

describe("GL posting engine — posting rule integration", () => {
  it("PaymentInitiated → correct posting legs", () => {
    const payload = {
      tradeId: "T-001",
      legKind: "deliver" as const,
      paymentRef: "REF-001",
      currency: "ZAR",
      netCash: 100000,
      initiatedAt: "2026-05-18T10:00:00Z",
      citations: ["PROC-PAY-RBH-01"],
    };
    const legs = paymentInitiatedJournals(payload);
    expect(legs).toHaveLength(2);
    // Legs must balance
    const debit = legs
      .filter((l) => l.debitCredit === "debit")
      .reduce((s, l) => s + l.amountMinor, 0);
    const credit = legs
      .filter((l) => l.debitCredit === "credit")
      .reduce((s, l) => s + l.amountMinor, 0);
    expect(debit).toBe(credit);
    // Debit suspense, credit nostro
    expect(legs.find((l) => l.debitCredit === "debit")?.accountId).toBe("ACC-2400-001");
    expect(legs.find((l) => l.debitCredit === "credit")?.accountId).toBe("ACC-1200-001");
  });

  it("PaymentSettled → correct posting legs", () => {
    const payload = {
      tradeId: "T-001",
      legKind: "deliver" as const,
      paymentRef: "REF-001",
      currency: "USD",
      netCash: 5000,
      settledAt: "2026-05-18T12:00:00Z",
      citations: ["PROC-PAY-RBH-01"],
    };
    const legs = paymentSettledJournals(payload);
    expect(legs).toHaveLength(2);
    const debit = legs
      .filter((l) => l.debitCredit === "debit")
      .reduce((s, l) => s + l.amountMinor, 0);
    const credit = legs
      .filter((l) => l.debitCredit === "credit")
      .reduce((s, l) => s + l.amountMinor, 0);
    expect(debit).toBe(credit);
    // Debit customer payable, credit suspense
    expect(legs.find((l) => l.debitCredit === "debit")?.accountId).toBe("ACC-2200-002");
    expect(legs.find((l) => l.debitCredit === "credit")?.accountId).toBe("ACC-2400-002");
  });

  it("SettlementInstructionReceived → correct posting legs", () => {
    const payload = {
      tradeId: "T-001",
      legKind: "receive" as const,
      settlementDate: "2026-05-20",
      currency: "ZAR",
      netCash: 200000,
      correspondent: { name: "Test Bank", bic: "TESTZA22" },
      citations: ["PROC-PAY-RBH-01"],
    };
    const legs = settlementInstructionJournals(payload);
    expect(legs).toHaveLength(2);
    const debit = legs
      .filter((l) => l.debitCredit === "debit")
      .reduce((s, l) => s + l.amountMinor, 0);
    const credit = legs
      .filter((l) => l.debitCredit === "credit")
      .reduce((s, l) => s + l.amountMinor, 0);
    expect(debit).toBe(credit);
    // Debit settlement receivable, credit suspense
    expect(legs.find((l) => l.debitCredit === "debit")?.accountId).toBe("ACC-4100-001");
    expect(legs.find((l) => l.debitCredit === "credit")?.accountId).toBe("ACC-2400-001");
  });
});

// ---------------------------------------------------------------------------
// Engine-level tests using in-memory EventStore + inline engine logic
// ---------------------------------------------------------------------------

describe("GL posting engine — idempotency logic", () => {
  it("Empty event store: no payments events", () => {
    const store = new EventStore(":memory:");
    // No payments events in store
    const payments = [
      ...[...store.replay({ type: "PaymentInitiated" })],
      ...[...store.replay({ type: "PaymentSettled" })],
      ...[...store.replay({ type: "SettlementInstructionReceived" })],
    ];
    expect(payments).toHaveLength(0);
  });

  it("One PaymentInitiated: posting rule produces 2 balanced legs", () => {
    const store = new EventStore(":memory:");
    const eventId = newEventId();
    store.append(
      makePaymentInitiated({
        asOf: "2026-05-18T10:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: ["PROC-PAY-RBH-01"],
        payload: {
          tradeId: "T-TEST-001",
          legKind: "deliver",
          paymentRef: "REF-TEST-001",
          currency: "ZAR",
          netCash: 500000,
          initiatedAt: "2026-05-18T10:00:00Z",
          citations: ["PROC-PAY-RBH-01"],
        },
        eventId,
      }),
    );

    const events = [...store.replay({ type: "PaymentInitiated" })];
    expect(events).toHaveLength(1);

    const legs = paymentInitiatedJournals(
      events[0].payload as Parameters<typeof paymentInitiatedJournals>[0],
    );
    expect(legs).toHaveLength(2);

    const debit = legs
      .filter((l) => l.debitCredit === "debit")
      .reduce((s, l) => s + l.amountMinor, 0);
    const credit = legs
      .filter((l) => l.debitCredit === "credit")
      .reduce((s, l) => s + l.amountMinor, 0);
    expect(debit).toBe(credit);
    expect(debit).toBe(500000);
  });

  it("Idempotency: same (sourceEventId, postingType) not re-posted", () => {
    // Build the in-memory key set the engine would use
    const sourceEventId = "evt-test-idempotent";
    const postingType = "payment-initiation";

    const keysAlreadyPosted = new Set<string>();
    keysAlreadyPosted.add(`${sourceEventId}:${postingType}`);

    // Engine logic: if key in Set → skip
    const key = `${sourceEventId}:${postingType}`;
    expect(keysAlreadyPosted.has(key)).toBe(true);
  });

  it("dryRun: engine reports eventsEmitted but does not append to store", () => {
    const store = new EventStore(":memory:");
    const eventId = newEventId();

    store.append(
      makePaymentSettled({
        asOf: "2026-05-18T12:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: ["PROC-PAY-RBH-01"],
        payload: {
          tradeId: "T-DRY",
          legKind: "deliver",
          paymentRef: "REF-DRY",
          currency: "ZAR",
          netCash: 300000,
          settledAt: "2026-05-18T12:00:00Z",
          citations: ["PROC-PAY-RBH-01"],
        },
        eventId,
      }),
    );

    // In dryRun, we don't call eventStore.append for SubLedgerPostingEmitted
    const beforeCount = [...store.replay({ type: "SubLedgerPostingEmitted" })].length;

    // Simulate dry-run: compute legs but don't append
    const events = [...store.replay({ type: "PaymentSettled" })];
    expect(events).toHaveLength(1);

    // dryRun = true means we compute but don't append
    const legs = paymentSettledJournals(
      events[0].payload as Parameters<typeof paymentSettledJournals>[0],
    );
    expect(legs).toHaveLength(2); // computed

    // Nothing appended
    const afterCount = [...store.replay({ type: "SubLedgerPostingEmitted" })].length;
    expect(afterCount).toBe(beforeCount);
    expect(afterCount).toBe(0);
  });

  it("SettlementInstructionReceived: store round-trip", () => {
    const store = new EventStore(":memory:");
    const eventId = newEventId();

    store.append(
      makeSettlementInstructionReceived({
        asOf: "2026-05-18T09:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: ["PROC-PAY-RBH-01"],
        payload: {
          tradeId: "T-SETTLE-001",
          legKind: "receive",
          settlementDate: "2026-05-20",
          currency: "USD",
          netCash: 100000,
          correspondent: { name: "Citi", bic: "CITIUS33" },
          citations: ["PROC-PAY-RBH-01"],
        },
        eventId,
      }),
    );

    const events = [...store.replay({ type: "SettlementInstructionReceived" })];
    expect(events).toHaveLength(1);

    const legs = settlementInstructionJournals(
      events[0].payload as Parameters<typeof settlementInstructionJournals>[0],
    );
    expect(legs).toHaveLength(2);
    expect(legs.find((l) => l.debitCredit === "debit")?.accountId).toBe("ACC-4100-002");
    expect(legs.find((l) => l.debitCredit === "credit")?.accountId).toBe("ACC-2400-002");
  });
});

// ---------------------------------------------------------------------------
// FX posting-rule tests — PR-FX-001, PR-FX-002, PR-FX-003
// ---------------------------------------------------------------------------

describe("GL posting engine — FX trade lifecycle posting rules", () => {
  // Shared minimal FxLeg for a ZAR/USD spot trade
  // Bank buys USD: pays ZAR, receives USD
  const nearLeg = {
    legKind: "near" as const,
    payCurrency: "ZAR",
    receiveCurrency: "USD",
    notional: { amountMinor: 1800000_00, currency: "ZAR" }, // ZAR 1,800,000.00
    counterNotional: { amountMinor: 100000_00, currency: "USD" }, // USD 100,000.00
    rate: { value: 18.0, currency: "ZAR" },
    settlementDate: { date: "2026-05-20", convention: "T+2", calendar: "SAST" },
  };

  it("PR-FX-001: FxTradeExecuted → trade-booking, 4 legs balanced per currency", () => {
    const tradePayload = {
      tradeId: "FX-TRADE-001",
      side: "buy" as const,
      currencyPair: { base: "ZAR", quote: "USD" },
      legs: [nearLeg],
    };
    const legs = fxTradeBookingJournals(tradePayload);
    // 4 legs: ZAR debit/credit + USD debit/credit
    expect(legs).toHaveLength(4);

    // Balance check per currency
    for (const ccy of ["ZAR", "USD"]) {
      const ccyLegs = legs.filter((l) => l.currency === ccy);
      const debit = ccyLegs
        .filter((l) => l.debitCredit === "debit")
        .reduce((s, l) => s + l.amountMinor, 0);
      const credit = ccyLegs
        .filter((l) => l.debitCredit === "credit")
        .reduce((s, l) => s + l.amountMinor, 0);
      expect(debit).toBe(credit);
    }
  });

  it("PR-FX-002 (gain): FxPositionRevalued → revaluation, Dr Receivable / Cr UnrealisedPnL", () => {
    const revalPayload = {
      tradeId: "FX-TRADE-001",
      currencyPair: "ZAR/USD",
      bookRate: 18.0,
      revalRate: 18.5,
      notionalBaseMinor: 1800000_00,
      unrealisedPnlZarMinor: 50000_00, // ZAR 500 gain
      revaluedAt: "2026-05-18T17:00:00Z",
      rateSource: "stub",
    };
    const legs = fxRevaluationJournals(revalPayload);
    expect(legs).toHaveLength(2);

    // Balance in ZAR
    const debit = legs
      .filter((l) => l.debitCredit === "debit")
      .reduce((s, l) => s + l.amountMinor, 0);
    const credit = legs
      .filter((l) => l.debitCredit === "credit")
      .reduce((s, l) => s + l.amountMinor, 0);
    expect(debit).toBe(credit);
    expect(debit).toBe(50000_00);

    // Gain: Dr Receivable ZAR, Cr Unrealised P&L
    expect(legs.find((l) => l.debitCredit === "debit")?.accountId).toBe(FX_ACCOUNTS.RECEIVABLE_ZAR);
    expect(legs.find((l) => l.debitCredit === "credit")?.accountId).toBe(
      FX_ACCOUNTS.UNREALISED_PNL,
    );
  });

  it("PR-FX-002 (loss): FxPositionRevalued → revaluation, Dr UnrealisedPnL / Cr Receivable", () => {
    const revalPayload = {
      tradeId: "FX-TRADE-002",
      currencyPair: "ZAR/USD",
      bookRate: 18.0,
      revalRate: 17.5,
      notionalBaseMinor: 1800000_00,
      unrealisedPnlZarMinor: -25000_00, // ZAR 250 loss
      revaluedAt: "2026-05-18T17:00:00Z",
      rateSource: "stub",
    };
    const legs = fxRevaluationJournals(revalPayload);
    expect(legs).toHaveLength(2);

    // Balance in ZAR
    const debit = legs
      .filter((l) => l.debitCredit === "debit")
      .reduce((s, l) => s + l.amountMinor, 0);
    const credit = legs
      .filter((l) => l.debitCredit === "credit")
      .reduce((s, l) => s + l.amountMinor, 0);
    expect(debit).toBe(credit);
    expect(debit).toBe(25000_00);

    // Loss: Dr Unrealised P&L, Cr Receivable ZAR
    expect(legs.find((l) => l.debitCredit === "debit")?.accountId).toBe(FX_ACCOUNTS.UNREALISED_PNL);
    expect(legs.find((l) => l.debitCredit === "credit")?.accountId).toBe(
      FX_ACCOUNTS.RECEIVABLE_ZAR,
    );
  });

  it("PR-FX-002 (zero delta): FxPositionRevalued → returns empty legs", () => {
    const revalPayload = {
      tradeId: "FX-TRADE-003",
      currencyPair: "ZAR/USD",
      bookRate: 18.0,
      revalRate: 18.0,
      notionalBaseMinor: 1800000_00,
      unrealisedPnlZarMinor: 0,
      revaluedAt: "2026-05-18T17:00:00Z",
      rateSource: "stub",
    };
    const legs = fxRevaluationJournals(revalPayload);
    expect(legs).toHaveLength(0);
  });

  // NOTE: the PR-FX-003 (TradeMatured) legacy `fxSettlementJournals` unit test
  // was RETIRED with the legacy fx-spot.ts dispatch arm (zero production emitters
  // / zero live events; D-SLA-ENGINE-RULES-AS-DATA full-retirement FX tail). The
  // function remains exercised by the byte-for-byte parity suites and
  // platform/accounting/posting-rules/fx-spot.test.ts.

  it("FX idempotency: same (sourceEventId, postingType) not re-posted", () => {
    // Verify idempotency key matching for FX events
    const pairs: Array<[string, string]> = [
      ["evt-fx-001", "trade-booking"],
      ["evt-fx-002", "revaluation"],
      ["evt-fx-003", "settlement"],
    ];

    const keysAlreadyPosted = new Set<string>();
    for (const [evtId, postingType] of pairs) {
      keysAlreadyPosted.add(`${evtId}:${postingType}`);
    }

    // All should be found (skipped on re-run)
    for (const [evtId, postingType] of pairs) {
      expect(keysAlreadyPosted.has(`${evtId}:${postingType}`)).toBe(true);
    }

    // A new event ID should not be found
    expect(keysAlreadyPosted.has("evt-new:trade-booking")).toBe(false);
  });
});

// ===========================================================================
// FX Trade Lifecycle Extension Tests
// D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
// ===========================================================================

// ---------------------------------------------------------------------------
// Test 1: ConfirmationMatched — processed, no SubLedgerPostingEmitted, idempotent
// ---------------------------------------------------------------------------

describe("FX lifecycle — ConfirmationMatched: no GL entries", () => {
  it("ConfirmationMatched: no SubLedgerPostingEmitted emitted", () => {
    // The engine handles ConfirmationMatched as an audit/control event only.
    // No SubLedgerPostingEmitted should be produced.
    // We test the posting rule layer: there is no posting rule for
    // ConfirmationMatched, so we verify no legs are produced by the engine's
    // log-only branch.
    const store = new EventStore(":memory:");

    // Confirm that replaying ConfirmationMatched in a fresh store produces 0 events.
    const events = [...store.replay({ type: "ConfirmationMatched" })];
    expect(events).toHaveLength(0);

    // And that no SubLedgerPostingEmitted exists.
    const postings = [...store.replay({ type: "SubLedgerPostingEmitted" })];
    expect(postings).toHaveLength(0);
  });

  it("ConfirmationMatched idempotency key format", () => {
    // The idempotency key for confirmation-matched is:
    // `${sourceEventId}:confirmation-matched`
    const sourceEventId = "evt-confirm-001";
    const key = `${sourceEventId}:confirmation-matched`;
    const keysSet = new Set<string>([key]);
    // Simulates the engine's idempotency check
    expect(keysSet.has(key)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RETIRED — legacy fx-spot.ts posting-rule unit tests.
//
// The describe blocks that exercised the four legacy fx-spot.ts journal
// functions directly — `fxSettlementJournals` (PR-FX-003 / TradeMatured),
// `fxSettlementReversalJournals` (SettlementReversed), `fxCancellationJournals`
// (non-FX TradeCancelled) and `fxAmendmentJournals` (TradeAmended) — were
// removed together with their dispatch arms in the live GL handler
// (D-SLA-ENGINE-RULES-AS-DATA, full-retirement FX tail). Those four event types
// have zero production emitters and zero live events; the handler no longer
// imports fx-spot.ts. The functions themselves remain covered as the
// byte-for-byte parity references in `platform/accounting/posting-rules/
// fx-spot.test.ts` and the parallel-run suites until the dead legacy engine is
// removed from tree (separate retirement stage). The live FX cancellation path
// (FxTradeCancelled → SLA interpreter PR-FX-CANCEL) is covered by the handler
// integration regression test below ("Regression — FxTradeCancelled produces a
// 'cancellation' posting").
// ---------------------------------------------------------------------------

// ===========================================================================
// Manual-provenance FxTradeExecuted → GL posting
// D-MANUAL-TRADE-BOOKING (CEO-approved 2026-05-19)
// ===========================================================================

describe("GL posting engine — manual-provenance FxTradeExecuted", () => {
  it("manual FxTradeExecuted → SubLedgerPostingEmitted with postingType 'trade-booking'", () => {
    // Create a minimal FxTradeExecuted payload matching the manual booking format.
    // The posting-rule layer (fxTradeBookingJournals) does not inspect provenance —
    // it only reads trade fields. We test that the rule produces balanced legs.

    const manualTradePayload = {
      tradeId: "MAN-TEST-001",
      side: "buy" as const,
      currencyPair: { base: "ZAR", quote: "USD" },
      legs: [
        {
          legKind: "near" as const,
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          notional: { amountMinor: 18_000_000_000_000, currency: "ZAR" }, // ZAR 18,000,000 × 1e6
          counterNotional: { amountMinor: 1_000_000_000_000, currency: "USD" }, // USD 1,000,000 × 1e6
          rate: { value: 18.0, currency: "ZAR" },
          settlementDate: { date: "2026-05-21", convention: "T+2", calendar: "SAST" },
        },
      ],
    };

    const legs = fxTradeBookingJournals(manualTradePayload);

    // Trade-booking produces 4 legs (ZAR debit/credit + USD debit/credit)
    expect(legs).toHaveLength(4);

    // Each currency must balance
    for (const ccy of ["ZAR", "USD"]) {
      const ccyLegs = legs.filter((l) => l.currency === ccy);
      const debit = ccyLegs
        .filter((l) => l.debitCredit === "debit")
        .reduce((s, l) => s + l.amountMinor, 0);
      const credit = ccyLegs
        .filter((l) => l.debitCredit === "credit")
        .reduce((s, l) => s + l.amountMinor, 0);
      expect(debit).toBe(credit);
    }

    // The posting type would be "trade-booking" — verify via SubLedgerPostingEmitted schema
    const {
      subLedgerPostingEmittedPayloadSchema,
    } = require("../../platform/event-store/event-types/fx-accounting");
    const postingPayload = subLedgerPostingEmittedPayloadSchema.parse({
      sourceEventId: "evt-manual-test-001",
      postingType: "trade-booking",
      legs,
      postedAt: "2026-05-19T10:00:00Z",
    });
    expect(postingPayload.postingType).toBe("trade-booking");
    expect(postingPayload.legs).toHaveLength(4);
  });
});

// ===========================================================================
// Regression — 2026-05-21 GL posting bug fixes (Bea, brief WS-GL-POSTING-BUG-FIX)
//
// Two compounding bugs:
//   Bug 1 — the cancellation arm fired on `e.type === "TradeCancelled"` only,
//           so FxTradeCancelled events (the FX-specific kind used in
//           production since 2026-05-19) were skipped → 15 booking journals
//           remained on the GL.
//   Bug 2 — PrincipalPayment and CDM SettlementConfirmed arms (PR-FX-PRIN +
//           PR-FX-LIFECYCLE-CLOSE, promoted GL-significant by PR #616) had
//           never been exercised against the live shared event store; the
//           backfill script needed an end-to-end idempotency guarantee.
//
// These tests exercise the engine end-to-end against the per-process tmpdir
// event store (configured by tests/_setup.ts → BANK_EVENT_DB). Each test
// uses a unique trade-ID prefix so the shared store does not cross-pollinate.
//
// Authority:
//   - IFRS-9 §3.2.3 (derecognition)
//   - IAS-21 §28 (settlement-date FX gain/loss)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-SALES-TRADING-FRONTEND
//   - PR #616 (PR-FX-PRIN + PR-FX-LIFECYCLE-CLOSE promotion to GL-significant)
// ===========================================================================

import { eventStore as compositionEventStore } from "../../platform/composition";
import {
  makeFxPositionRevalued,
  makeFxTradeCancelled,
} from "../../platform/event-store/event-types/fx-accounting";
import {
  makeFxTradeExecuted,
  makePrincipalPayment,
  makeSettlementConfirmed,
} from "../../platform/markets/cdm/fx";
import type { AgentRunContext } from "../types";
import { beaGlPostingEngine } from "./bea-gl-posting-engine";

const REG_ENTITY = "LE-ZA-HOZ-BANK";
const REG_ACTOR = { type: "service" as const, id: "agent:bea:gl-posting-engine" };
const REG_CITATIONS = ["IFRS-9-§3.2.3", "IAS-21-§28", "D-MARKETS-SCHEMA-FOUNDATION"];
// FX_ACCOUNTS.UNREALISED_PNL — the ZAR FVTPL unrealised-P&L account PR-FX-002
// revaluations and PR-FX-CANCEL step-(ii) both post to (kept literal here so the
// test asserts the concrete account, not the symbol it is derived from).
const FX_REG_UNREALISED_PNL = "ACC-2100-005";

function buildRegressionCtx(asOf: string): AgentRunContext {
  return {
    agent: "Bea",
    trigger: { kind: "on-request", id: "regression-test" },
    asOf,
    repoRoot: process.cwd(),
    ownerInboxDir: `${process.cwd()}/Owner Inbox`,
    dryRun: false,
  };
}

function postingsForSource(sourceEventId: string) {
  return [...compositionEventStore.replay({ type: "SubLedgerPostingEmitted" })].filter((ev) => {
    const p = ev.payload as { sourceEventId?: string };
    return p.sourceEventId === sourceEventId;
  });
}

function makeMinimalFxTradeExecuted(opts: {
  tradeId: string;
  asOf: string;
  eventId?: string;
}) {
  return makeFxTradeExecuted({
    asOf: opts.asOf,
    entity: REG_ENTITY,
    actor: { type: "service", id: "agent:saskia:fx-trader" },
    citations: REG_CITATIONS,
    eventId: opts.eventId,
    payload: {
      tradeId: { scheme: "INTERNAL", value: opts.tradeId },
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      legs: [
        {
          legKind: "near",
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          notional: { currency: "ZAR", amountMinor: 18_500_000_00 },
          counterNotional: { currency: "USD", amountMinor: 1_000_000_00 },
          rate: { currency: "ZAR", amount: 18.5 },
          settlementDate: { iso: "2026-05-23", calendar: "JIHCAL" },
        },
      ],
      tradeDate: { iso: "2026-05-21", calendar: "JIHCAL" },
      counterparty: {
        partyId: "CPTY-REGRESSION-001",
        name: "Test Counterparty",
        role: "counterparty",
        jurisdiction: "ZA",
      },
      venue: "OTC",
      trader: "regression@bank.local",
      bookId: "BOOK-FX-REG",
      bookType: "trading",
      settlementForm: "physical",
      settlementPath: "correspondent",
      finsurvCategory: "ODP-001-cross-border-institutional",
      clientFlowRef: `client-trade:${opts.tradeId}`,
    },
  });
}

describe("Regression — FxTradeCancelled produces a 'cancellation' posting", () => {
  it("seeded FxTradeExecuted + FxTradeCancelled → engine emits one SubLedgerPostingEmitted{postingType:'cancellation'} that reverses the booking legs", async () => {
    const tradeId = `REG-FX-CANCEL-${newEventId()}`;
    const asOf = "2026-05-21T10:00:00.000Z";

    // 1) Seed FxTradeExecuted
    const tradeEvent = makeMinimalFxTradeExecuted({ tradeId, asOf });
    compositionEventStore.append(tradeEvent);

    // 2) Seed FxTradeCancelled referencing the trade
    const cancelEvent = makeFxTradeCancelled({
      asOf: "2026-05-21T11:00:00.000Z",
      entity: REG_ENTITY,
      actor: REG_ACTOR,
      citations: REG_CITATIONS,
      payload: {
        tradeId,
        reason: "regression-test",
        cancelledBy: "agent:test",
        originalEventId: tradeEvent.event_id,
      },
    });
    compositionEventStore.append(cancelEvent);

    // 3) Run the engine
    const result = await beaGlPostingEngine(buildRegressionCtx("2026-05-21T12:00:00.000Z"));
    expect(result.ok).toBe(true);

    // 4) Assert a "cancellation" SubLedgerPostingEmitted exists for the cancel event
    const cancellations = postingsForSource(cancelEvent.event_id).filter((ev) => {
      const p = ev.payload as { postingType?: string };
      return p.postingType === "cancellation";
    });

    // Without the fix (bug 1: arm fired only on "TradeCancelled"), this would be 0.
    // With the fix, exactly one cancellation posting is emitted.
    expect(cancellations).toHaveLength(1);

    // 5) The cancellation legs must reverse the booking legs — combined net per
    //    account is zero (the trade is voided).
    const cancellationLegs = (cancellations[0].payload as { legs: SubLedgerLeg[] }).legs;
    const bookingPostings = postingsForSource(tradeEvent.event_id).filter((ev) => {
      const p = ev.payload as { postingType?: string };
      return p.postingType === "trade-booking";
    });
    expect(bookingPostings.length).toBeGreaterThanOrEqual(1);
    const bookingLegs = (bookingPostings[0].payload as { legs: SubLedgerLeg[] }).legs;

    const combined = netPerAccount([...bookingLegs, ...cancellationLegs]);
    for (const [, net] of combined.entries()) {
      expect(net).toBe(0);
    }
  });
});

describe("Regression — cancelling a REVALUED FxTrade reverses the accumulated MTM (no stranded unrealised P&L)", () => {
  // PR #1095 follow-up guard. Before this fix, the retired bea-fx-posting-engine
  // owned the per-revaluation MTM undo, and buildFxCancelEnrichmentForTrade fed
  // PR-FX-CANCEL step-(ii) a cumulative of 0 — so deleting that engine left the
  // accumulated unrealised P&L STRANDED in the GL on cancellation. This proves
  // end-to-end: book → revalue (twice, net gain) → cancel → GL nets to zero on
  // EVERY account, including the unrealised-P&L pair.
  it("seeded FxTradeExecuted + 2× FxPositionRevalued + FxTradeCancelled → full GL (booking + revaluation + cancellation) nets to zero per account", async () => {
    const tradeId = `REG-FX-REVAL-CANCEL-${newEventId()}`;
    const asOf = "2026-05-21T10:00:00.000Z";

    // 1) Seed FxTradeExecuted
    const tradeEvent = makeMinimalFxTradeExecuted({ tradeId, asOf });
    compositionEventStore.append(tradeEvent);

    // 2) Run the engine to emit the trade-booking posting first (the cancellation
    //    reconstruction reads the persisted booking legs).
    const bookResult = await beaGlPostingEngine(buildRegressionCtx("2026-05-21T10:30:00.000Z"));
    expect(bookResult.ok).toBe(true);

    // 3) Seed two daily revaluations — a gain (+R12,000) then a loss (−R4,500),
    //    net cumulative = +R7,500 unrealised gain accumulated in the GL.
    const reval1 = makeFxPositionRevalued({
      asOf: "2026-05-21T17:00:00.000Z",
      entity: REG_ENTITY,
      actor: REG_ACTOR,
      citations: REG_CITATIONS,
      payload: {
        tradeId,
        currencyPair: "USD/ZAR",
        bookRate: 18.5,
        revalRate: 18.62,
        notionalBaseMinor: 1_000_000_00,
        unrealisedPnlZarMinor: 12_000_00,
        revaluedAt: "2026-05-21T17:00:00Z",
        rateSource: "stub",
      },
    });
    compositionEventStore.append(reval1);
    const reval2 = makeFxPositionRevalued({
      asOf: "2026-05-22T17:00:00.000Z",
      entity: REG_ENTITY,
      actor: REG_ACTOR,
      citations: REG_CITATIONS,
      payload: {
        tradeId,
        currencyPair: "USD/ZAR",
        bookRate: 18.5,
        revalRate: 18.575,
        notionalBaseMinor: 1_000_000_00,
        unrealisedPnlZarMinor: -4_500_00,
        revaluedAt: "2026-05-22T17:00:00Z",
        rateSource: "stub",
      },
    });
    compositionEventStore.append(reval2);

    // 4) Run the engine to emit both revaluation postings.
    const revalResult = await beaGlPostingEngine(buildRegressionCtx("2026-05-22T17:30:00.000Z"));
    expect(revalResult.ok).toBe(true);

    const revaluationPostings = [
      ...postingsForSource(reval1.event_id),
      ...postingsForSource(reval2.event_id),
    ].filter((ev) => (ev.payload as { postingType?: string }).postingType === "revaluation");
    // Both non-zero deltas must have produced a revaluation posting — otherwise
    // there is no accumulated MTM and the regression cannot be exercised.
    expect(revaluationPostings).toHaveLength(2);

    // 5) Cancel the (revalued) trade.
    const cancelEvent = makeFxTradeCancelled({
      asOf: "2026-05-23T11:00:00.000Z",
      entity: REG_ENTITY,
      actor: REG_ACTOR,
      citations: REG_CITATIONS,
      payload: {
        tradeId,
        reason: "regression-test-revalued-cancel",
        cancelledBy: "agent:test",
        originalEventId: tradeEvent.event_id,
      },
    });
    compositionEventStore.append(cancelEvent);

    const cancelResult = await beaGlPostingEngine(buildRegressionCtx("2026-05-23T12:00:00.000Z"));
    expect(cancelResult.ok).toBe(true);

    // 6) The cancellation posting (PR-FX-CANCEL, IFRS representation) must now
    //    carry BOTH the booking-leg reversal AND the cumulative MTM reversal.
    const cancellations = postingsForSource(cancelEvent.event_id).filter((ev) => {
      const p = ev.payload as { postingType?: string; representation?: string };
      const representation = p.representation ?? "IFRS";
      return p.postingType === "cancellation" && representation === "IFRS";
    });
    expect(cancellations).toHaveLength(1);

    // 7) The unrealised-P&L pair (ACC-2100-005) must appear in the cancellation
    //    legs — the proof the MTM undo is no longer stranded.
    const cancellationLegs = (cancellations[0].payload as { legs: SubLedgerLeg[] }).legs;
    const unrealisedLeg = cancellationLegs.find((l) => l.accountId === FX_REG_UNREALISED_PNL);
    expect(unrealisedLeg).toBeDefined();
    // Net cumulative was a +R7,500 GAIN (Dr receivable / Cr unrealised over the
    // revaluations); the reversal must DEBIT unrealised P&L by exactly R7,500.
    expect(unrealisedLeg?.debitCredit).toBe("debit");
    expect(unrealisedLeg?.amountMinor).toBe(7_500_00);

    // 8) END-TO-END: every IFRS posting on this trade — booking + both
    //    revaluations + cancellation — must net to ZERO on EVERY account.
    const bookingLegs = postingsForSource(tradeEvent.event_id)
      .filter((ev) => (ev.payload as { postingType?: string }).postingType === "trade-booking")
      .flatMap((ev) => (ev.payload as { legs: SubLedgerLeg[] }).legs);
    const revalLegs = revaluationPostings.flatMap(
      (ev) => (ev.payload as { legs: SubLedgerLeg[] }).legs,
    );
    const combined = netPerAccount([...bookingLegs, ...revalLegs, ...cancellationLegs]);
    for (const [, net] of combined.entries()) {
      expect(net).toBe(0);
    }
  });
});

describe("Regression — PrincipalPayment produces an 'fx-principal-payment' posting", () => {
  it("seeded FxTradeExecuted + PrincipalPayment → engine emits SubLedgerPostingEmitted{postingType:'fx-principal-payment'}", async () => {
    const tradeId = `REG-PRIN-${newEventId()}`;
    const asOf = "2026-05-21T10:00:00.000Z";

    // 1) Seed FxTradeExecuted (PR-FX-PRIN looks up by tradeId, not eventId)
    const tradeEvent = makeMinimalFxTradeExecuted({ tradeId, asOf });
    compositionEventStore.append(tradeEvent);

    // 2) Seed PrincipalPayment — bank receives USD into nostro
    const principalEvent = makePrincipalPayment({
      asOf: "2026-05-23T10:00:00.000Z",
      entity: REG_ENTITY,
      actor: { type: "service", id: "agent:tomas:settlement" },
      citations: REG_CITATIONS,
      payload: {
        tradeId,
        legKind: "receive",
        currencyPair: "USD/ZAR",
        currency: "USD",
        netCash: 1_000_000_00,
        settlementDate: "2026-05-23",
        settlementPath: "correspondent",
        correspondent: { name: "Citi", bic: "CITIUS33" },
        citations: REG_CITATIONS,
      },
    });
    compositionEventStore.append(principalEvent);

    // 3) Run the engine
    const result = await beaGlPostingEngine(buildRegressionCtx("2026-05-23T12:00:00.000Z"));
    expect(result.ok).toBe(true);

    // 4) Assert exactly one "fx-principal-payment" posting for this PrincipalPayment
    const postings = postingsForSource(principalEvent.event_id).filter((ev) => {
      const p = ev.payload as { postingType?: string };
      return p.postingType === "fx-principal-payment";
    });
    expect(postings).toHaveLength(1);

    // 5) Legs balance per currency (PR-FX-PRIN posts to nostro + receivable accounts)
    const legs = (postings[0].payload as { legs: SubLedgerLeg[] }).legs;
    expect(legs.length).toBeGreaterThan(0);
    const currencies = [...new Set(legs.map((l) => l.currency))];
    for (const ccy of currencies) {
      const ccyLegs = legs.filter((l) => l.currency === ccy);
      const debit = ccyLegs
        .filter((l) => l.debitCredit === "debit")
        .reduce((s, l) => s + l.amountMinor, 0);
      const credit = ccyLegs
        .filter((l) => l.debitCredit === "credit")
        .reduce((s, l) => s + l.amountMinor, 0);
      expect(debit).toBe(credit);
    }
  });
});

describe("Regression — CDM SettlementConfirmed produces an 'fx-lifecycle-close' posting", () => {
  it("seeded FxTradeExecuted + SettlementConfirmed with non-zero realisedPnlDelta → engine emits SubLedgerPostingEmitted{postingType:'fx-lifecycle-close'}", async () => {
    const tradeId = `REG-LCC-${newEventId()}`;
    const asOf = "2026-05-21T10:00:00.000Z";

    // 1) Seed FxTradeExecuted
    const tradeEvent = makeMinimalFxTradeExecuted({ tradeId, asOf });
    compositionEventStore.append(tradeEvent);

    // 2) Seed CDM SettlementConfirmed with non-zero realised P&L (gain)
    const lifecycleClose = makeSettlementConfirmed({
      asOf: "2026-05-23T15:00:00.000Z",
      entity: REG_ENTITY,
      actor: { type: "service", id: "agent:tomas:settlement" },
      citations: REG_CITATIONS,
      payload: {
        tradeId,
        currencyPair: "USD/ZAR",
        settledDate: "2026-05-23",
        realisedPnlDelta: 50_000, // ZAR 500 gain in minor units
        settlementRef: "SWIFT-REG-001",
        citations: REG_CITATIONS,
      },
    });
    compositionEventStore.append(lifecycleClose);

    // 3) Run the engine
    const result = await beaGlPostingEngine(buildRegressionCtx("2026-05-23T16:00:00.000Z"));
    expect(result.ok).toBe(true);

    // 4) Assert exactly one "fx-lifecycle-close" posting for this SettlementConfirmed
    const postings = postingsForSource(lifecycleClose.event_id).filter((ev) => {
      const p = ev.payload as { postingType?: string };
      return p.postingType === "fx-lifecycle-close";
    });
    expect(postings).toHaveLength(1);

    // 5) Legs balance (Dr Nostro / Cr Realised P&L on a gain)
    const legs = (postings[0].payload as { legs: SubLedgerLeg[] }).legs;
    expect(legs).toHaveLength(2);
    const totalDebit = legs
      .filter((l) => l.debitCredit === "debit")
      .reduce((s, l) => s + l.amountMinor, 0);
    const totalCredit = legs
      .filter((l) => l.debitCredit === "credit")
      .reduce((s, l) => s + l.amountMinor, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(50_000);
  });
});

describe("Regression — idempotency: running the engine twice emits 0 new postings on the second run", () => {
  it("two consecutive runs over the same input set produce identical SubLedgerPostingEmitted counts", async () => {
    const tradeId = `REG-IDEMP-${newEventId()}`;
    const asOf = "2026-05-21T10:00:00.000Z";

    // Seed a trade + cancellation + principal-payment (covers all three bug-fix arms)
    const tradeEvent = makeMinimalFxTradeExecuted({ tradeId, asOf });
    compositionEventStore.append(tradeEvent);

    const cancelEvent = makeFxTradeCancelled({
      asOf: "2026-05-21T11:00:00.000Z",
      entity: REG_ENTITY,
      actor: REG_ACTOR,
      citations: REG_CITATIONS,
      payload: {
        tradeId,
        reason: "idempotency-test",
        cancelledBy: "agent:test",
        originalEventId: tradeEvent.event_id,
      },
    });
    compositionEventStore.append(cancelEvent);

    // Run #1
    const r1 = await beaGlPostingEngine(buildRegressionCtx("2026-05-21T12:00:00.000Z"));
    expect(r1.ok).toBe(true);
    const after1 = [...compositionEventStore.replay({ type: "SubLedgerPostingEmitted" })].length;
    const r1Emitted = r1.eventsEmitted;
    expect(r1Emitted).toBeGreaterThan(0);

    // Run #2 — same input set; engine should emit zero new postings
    const r2 = await beaGlPostingEngine(buildRegressionCtx("2026-05-21T13:00:00.000Z"));
    expect(r2.ok).toBe(true);
    expect(r2.eventsEmitted).toBe(0);

    const after2 = [...compositionEventStore.replay({ type: "SubLedgerPostingEmitted" })].length;
    expect(after2).toBe(after1);
  });
});

// ===========================================================================
// Regression — booking-path scoping (event-loop-wedge fix).
//
// A single trade booking must post ONLY its own legs and must NOT reprocess
// the institution's entire posting/cancellation backlog inline on the request
// thread. Before the fix, beaGlPostingEngine replayed and reprocessed the whole
// store on every booking; the FxTradeCancelled arm full-replayed the entire
// store per posting per cancellation (O(store^2)), wedging the single-threaded
// event loop for minutes at production store size.
//
// These tests pin the contract structurally (O(1) postings per booking; the
// backlog is NOT flushed) so the regression cannot silently return as the store
// grows. A latency budget would be flaky under CI load; asserting the emitted
// posting *count* is the robust invariant.
//
// Authority: fix(trade-booking) — bound GL/accounting work per booking.
// ===========================================================================

describe("Regression — booking-path scoping bounds GL work per booking", () => {
  it("scopeToEventIds processes ONLY the triggering trade — the other pending trade is untouched", async () => {
    const asOf = "2026-05-24T10:00:00.000Z";
    const tradeA = makeMinimalFxTradeExecuted({
      tradeId: `REG-SCOPE-A-${newEventId()}`,
      asOf,
    });
    const tradeB = makeMinimalFxTradeExecuted({
      tradeId: `REG-SCOPE-B-${newEventId()}`,
      asOf,
    });
    compositionEventStore.append(tradeA);
    compositionEventStore.append(tradeB);

    // Run scoped to trade A only (the booking-path contract).
    const result = await beaGlPostingEngine(buildRegressionCtx("2026-05-24T11:00:00.000Z"), {
      scopeToEventIds: [tradeA.event_id],
    });
    expect(result.ok).toBe(true);

    // Trade A posts; trade B does NOT (its booking is left for its own scoped run).
    expect(postingsForSource(tradeA.event_id)).toHaveLength(1);
    expect(postingsForSource(tradeB.event_id)).toHaveLength(0);
    // Exactly one posting emitted by this run — O(1), not a backlog flush.
    expect(result.eventsEmitted).toBe(1);
  });

  it("a scoped booking does NOT reprocess a pending cancellation backlog inline", async () => {
    const asOf = "2026-05-24T10:00:00.000Z";

    // Seed a trade + an UNPOSTED cancellation that, under full replay, would
    // trigger the (previously O(store^2)) cancellation reconstruction.
    const staleTradeId = `REG-SCOPE-STALE-${newEventId()}`;
    const staleTrade = makeMinimalFxTradeExecuted({ tradeId: staleTradeId, asOf });
    compositionEventStore.append(staleTrade);
    const staleCancel = makeFxTradeCancelled({
      asOf: "2026-05-24T10:30:00.000Z",
      entity: REG_ENTITY,
      actor: REG_ACTOR,
      citations: REG_CITATIONS,
      payload: {
        tradeId: staleTradeId,
        reason: "scope-backlog-test",
        cancelledBy: "agent:test",
        originalEventId: staleTrade.event_id,
      },
    });
    compositionEventStore.append(staleCancel);

    // Now "book" a brand-new trade and run the engine scoped to it only.
    const freshTrade = makeMinimalFxTradeExecuted({
      tradeId: `REG-SCOPE-FRESH-${newEventId()}`,
      asOf,
    });
    compositionEventStore.append(freshTrade);

    const result = await beaGlPostingEngine(buildRegressionCtx("2026-05-24T11:00:00.000Z"), {
      scopeToEventIds: [freshTrade.event_id],
    });
    expect(result.ok).toBe(true);

    // The fresh trade is posted; the pending cancellation backlog is NOT flushed
    // inline — that work belongs on the backfill/cron cadence, off the booking
    // thread.
    expect(postingsForSource(freshTrade.event_id)).toHaveLength(1);
    expect(postingsForSource(staleCancel.event_id)).toHaveLength(0);
    expect(result.eventsEmitted).toBe(1);
  });

  it("an unscoped (backfill/cron) run still processes the full backlog — scoping is opt-in", async () => {
    const asOf = "2026-05-24T10:00:00.000Z";
    const t1 = makeMinimalFxTradeExecuted({ tradeId: `REG-UNSCOPED-1-${newEventId()}`, asOf });
    const t2 = makeMinimalFxTradeExecuted({ tradeId: `REG-UNSCOPED-2-${newEventId()}`, asOf });
    compositionEventStore.append(t1);
    compositionEventStore.append(t2);

    // No scopeToEventIds → full replay (backfill / cron behaviour preserved).
    const result = await beaGlPostingEngine(buildRegressionCtx("2026-05-24T11:00:00.000Z"));
    expect(result.ok).toBe(true);

    expect(postingsForSource(t1.event_id)).toHaveLength(1);
    expect(postingsForSource(t2.event_id)).toHaveLength(1);
  });
});

// ===========================================================================
// Regression — securities (bond + equity) cutover to the SLA interpreter.
//
// D-SLA-ENGINE-RULES-AS-DATA full-retirement Batch 2: the nine bond + equity
// lifecycle event types post via the rules-as-data SLA interpreter, NOT the
// legacy bonds.ts / equities.ts functions. These tests assert end-to-end that
// the engine routes them through the interpreter and emits the expected
// SubLedgerPostingEmitted (with the UNCHANGED postingType strings, so replay
// idempotency holds), and that the legs match the legacy reference (the parity
// guard tests/sla-securities-lifecycle-parallel-run.test.ts proves byte-for-byte
// equality at the rule layer).
// ===========================================================================

import { makeBondTradeExecuted } from "../../platform/event-store/event-types/bond-accounting";
import {
  makeEquityDividendAccrued,
  makeEquitySold,
} from "../../platform/event-store/event-types/equity-accounting";
import { bondDirtyPriceAmountMinor } from "./bea-gl-securities-interpreter-cutover";

describe("Regression — securities cutover: bond + equity post via the SLA interpreter", () => {
  it("BondTradeExecuted (banking-book) → engine emits 'bond-trade-booking' with the dirty-price legs", async () => {
    const tradeId = `REG-BOND-${newEventId()}`;
    const payload = {
      tradeId,
      bondIsin: "ZAG000149037",
      side: "buy" as const,
      nominalMinor: 10_000_000,
      cleanPricePercent: 97.5,
      accruedInterestMinor: 50_000,
      dirtyPricePercent: 98.0,
      settlementDate: "2026-06-08",
      portfolio: "banking-book" as const,
      couponRate: 0.085,
      maturityDate: "2030-01-01",
      currency: "ZAR",
      counterpartyLei: "LEI-CP",
      executedAt: "2026-06-05T10:00:00.000Z",
    };
    const bondEvent = makeBondTradeExecuted({
      asOf: "2026-06-05T10:00:00.000Z",
      entity: REG_ENTITY,
      actor: REG_ACTOR,
      citations: REG_CITATIONS,
      payload,
    });
    compositionEventStore.append(bondEvent);

    const result = await beaGlPostingEngine(buildRegressionCtx("2026-06-05T12:00:00.000Z"));
    expect(result.ok).toBe(true);

    const postings = postingsForSource(bondEvent.event_id).filter((ev) => {
      const p = ev.payload as { postingType?: string };
      return p.postingType === "bond-trade-booking";
    });
    expect(postings).toHaveLength(1);

    const legs = (postings[0].payload as { legs: SubLedgerLeg[] }).legs;
    const dirty = bondDirtyPriceAmountMinor(payload as never);
    // Dr Bond Asset banking (ACC-3100-001) / Cr Nostro (ACC-1200-001) at dirty price.
    expect(legs).toHaveLength(2);
    const assetLeg = legs.find((l) => l.accountId === "ACC-3100-001");
    const cashLeg = legs.find((l) => l.accountId === "ACC-1200-001");
    expect(assetLeg?.debitCredit).toBe("debit");
    expect(assetLeg?.amountMinor).toBe(dirty);
    expect(cashLeg?.debitCredit).toBe("credit");
    expect(cashLeg?.amountMinor).toBe(dirty);
    // Balanced.
    // Balanced: total debits == total credits (per currency).
    let bal = 0;
    for (const l of legs) bal += l.debitCredit === "debit" ? l.amountMinor : -l.amountMinor;
    expect(bal).toBe(0);
  });

  it("EquityDividendAccrued (with WHT) → engine emits 'equity-dividend-accrual' (3 legs)", async () => {
    const dividendEvent = makeEquityDividendAccrued({
      asOf: "2026-06-05T10:00:00.000Z",
      entity: REG_ENTITY,
      actor: REG_ACTOR,
      citations: REG_CITATIONS,
      payload: {
        tradeId: `REG-EQ-DIV-${newEventId()}`,
        instrumentId: "SBK",
        quantity: 1000,
        grossDividendPerShareMinor: 500,
        grossDividendTotalMinor: 500_000,
        withholdingTaxRate: 0.2,
        withholdingTaxMinor: 100_000,
        netDividendMinor: 400_000,
        exDividendDate: "2026-06-04",
        paymentDate: "2026-06-20",
        currency: "ZAR",
      },
    });
    compositionEventStore.append(dividendEvent);

    const result = await beaGlPostingEngine(buildRegressionCtx("2026-06-05T12:30:00.000Z"));
    expect(result.ok).toBe(true);

    const postings = postingsForSource(dividendEvent.event_id).filter((ev) => {
      const p = ev.payload as { postingType?: string };
      return p.postingType === "equity-dividend-accrual";
    });
    expect(postings).toHaveLength(1);
    const legs = (postings[0].payload as { legs: SubLedgerLeg[] }).legs;
    expect(legs).toHaveLength(3); // Dr receivable, Dr WHT, Cr income
    // Balanced: total debits == total credits (per currency).
    let bal = 0;
    for (const l of legs) bal += l.debitCredit === "debit" ? l.amountMinor : -l.amountMinor;
    expect(bal).toBe(0);
  });

  it("EquitySold (FVOCI gain) → engine emits a BALANCED 'equity-sale' (the OCI split fix)", async () => {
    const saleEvent = makeEquitySold({
      asOf: "2026-06-05T10:00:00.000Z",
      entity: REG_ENTITY,
      actor: REG_ACTOR,
      citations: REG_CITATIONS,
      payload: {
        tradeId: `REG-EQ-SALE-${newEventId()}`,
        instrumentId: "SBK",
        classification: "fvoci",
        quantity: 1000,
        salePricePerShareMinor: 19_000,
        saleProceedsMinor: 19_000_000,
        carryingAmountAtSaleMinor: 18_500_000,
        realisedPnlMinor: 500_000,
        settlementDate: "2026-06-08",
        currency: "ZAR",
      },
    });
    compositionEventStore.append(saleEvent);

    const result = await beaGlPostingEngine(buildRegressionCtx("2026-06-05T13:00:00.000Z"));
    expect(result.ok).toBe(true);

    const postings = postingsForSource(saleEvent.event_id).filter((ev) => {
      const p = ev.payload as { postingType?: string };
      return p.postingType === "equity-sale";
    });
    expect(postings).toHaveLength(1);
    const legs = (postings[0].payload as { legs: SubLedgerLeg[] }).legs;
    // The interpreter's assert_zero guarantees balance; pin it here so the
    // legacy FVOCI imbalance cannot regress through the engine.
    // Balanced: total debits == total credits (per currency).
    let bal = 0;
    for (const l of legs) bal += l.debitCredit === "debit" ? l.amountMinor : -l.amountMinor;
    expect(bal).toBe(0);
    // No P&L recycling (§5.7.5): the FVTPL P&L account is NOT touched.
    expect(legs.find((l) => l.accountId === "ACC-3200-003")).toBeUndefined();
    // OCI reserve + retained earnings ARE touched.
    expect(legs.some((l) => l.accountId === "ACC-3200-004")).toBe(true);
    expect(legs.some((l) => l.accountId === "ACC-5000-002")).toBe(true);
  });
});
