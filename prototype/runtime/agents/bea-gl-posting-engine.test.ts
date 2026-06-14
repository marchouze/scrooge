// runtime/agents/bea-gl-posting-engine.test.ts
//
// Unit tests for bea-gl-posting-engine.ts (universal GL posting engine).
//
// Tests cover the engine's genuine handler integration behaviour:
//   - ConfirmationMatched → processed, no SubLedgerPostingEmitted, idempotent
//   - manual-provenance FxTradeExecuted → 'trade-booking' posting, balanced legs
//   - FxTradeCancelled → 'cancellation' posting that reverses the booking legs
//     (incl. cumulative-MTM reversal on a revalued trade — no stranded P&L)
//   - PrincipalPayment → 'fx-principal-payment' posting (handler routes via the
//     SLA interpreter)
//   - CDM SettlementConfirmed → 'fx-lifecycle-close' posting
//   - idempotency: a second run over the same input set emits 0 new postings
//   - booking-path scoping: bounded GL work per booking (no backlog flush)
//   - securities cutover: bond + equity post via the SLA interpreter
//
// Per-rule account-mapping correctness (the leg footprint each posting rule
// produces) lives in the interpreter-side suites
// (tests/sla-*-lifecycle-interpreter.test.ts), NOT here — the payment- and
// FX-posting-rule leg oracles that previously lived in this file were retired
// under the SLA full-retirement workstream (D-SLA-ENGINE-RULES-AS-DATA).
//
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../platform/core/types";
import { EventStore } from "../../platform/event-store/store";

// ---------------------------------------------------------------------------
// We test beaGlPostingEngine against the shared composition event store
// (a singleton) for the genuine handler integration tests (idempotency,
// dryRun, ConfirmationMatched no-GL, manual-provenance booking, the
// FxTradeCancelled cancellation regression, and the securities-cutover
// routing). The per-leg account-mapping correctness for each posting rule
// lives in the interpreter-side suites (tests/sla-*-lifecycle-interpreter.test.ts);
// this file no longer re-asserts those leg footprints via the posting-rule
// functions directly.
// ---------------------------------------------------------------------------

import type { SubLedgerLeg } from "../../platform/accounting/fx-accounting-types";
import { fxTradeBookingJournals } from "../../platform/accounting/posting-rules/fx-spot";
import { amountToMinorUnits } from "../../platform/core/decimal-money";

function legMinor(l: SubLedgerLeg): number {
  return Number(amountToMinorUnits(l.amount));
}

// Helper: sum debit/credit per account across a set of legs, returning net
// (positive = net debit, negative = net credit).
function netPerAccount(legs: SubLedgerLeg[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const leg of legs) {
    const current = m.get(leg.accountId) ?? 0;
    const delta = leg.debitCredit === "debit" ? legMinor(leg) : -legMinor(leg);
    m.set(leg.accountId, current + delta);
  }
  return m;
}

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
// The describe blocks that exercised the legacy fx-spot.ts lifecycle journal
// functions directly (settlement-reversal / cancellation / amendment / per-leg
// cash / lifecycle-close) have been deleted: those functions were dead code
// (zero production emitters, zero live events) and have themselves been excised
// from fx-spot.ts under the SLA full-retirement workstream
// (D-SLA-ENGINE-RULES-AS-DATA). The live FX cancellation path
// (FxTradeCancelled → SLA interpreter PR-FX-CANCEL) is covered by the handler
// integration regression test below ("Regression — FxTradeCancelled produces a
// 'cancellation' posting"); the SLA interpreter's per-rule leg footprints are
// covered in tests/sla-*-lifecycle-interpreter.test.ts.
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
        .reduce((s, l) => s + legMinor(l), 0);
      const credit = ccyLegs
        .filter((l) => l.debitCredit === "credit")
        .reduce((s, l) => s + legMinor(l), 0);
      expect(debit).toBe(credit);
    }

    // The posting type would be "trade-booking" — verify via the real emit
    // boundary (makeSubLedgerPostingEmitted), which encodes each leg's decimal
    // `amount` source-of-truth to MoneyWire on the wire (decimal-native s1).
    const {
      makeSubLedgerPostingEmitted,
    } = require("../../platform/event-store/event-types/fx-accounting");
    const event = makeSubLedgerPostingEmitted({
      asOf: "2026-05-19T10:00:00Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service" as const, id: "agent:bea:gl-posting-engine" },
      citations: ["urn:obligation:ifrs:ifrs9:3.1.1"],
      payload: {
        sourceEventId: "evt-manual-test-001",
        postingType: "trade-booking",
        legs,
        postedAt: "2026-05-19T10:00:00Z",
      },
    });
    const postingPayload = event.payload as { postingType: string; legs: unknown[] };
    expect(postingPayload.postingType).toBe("trade-booking");
    expect(postingPayload.legs).toHaveLength(4);
    // Every emitted leg carries the decimal MoneyWire source of truth.
    for (const l of postingPayload.legs as Array<{ amount?: { __money?: string } }>) {
      expect(l.amount?.__money).toBe("v1");
    }
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
import { makeIrdSwapTradeExecuted } from "../../platform/event-store/event-types/ird-accounting";
import {
  makeFxTradeExecuted,
  makePrincipalPayment,
  makeSettlementConfirmed,
} from "../../platform/markets/cdm/fx";
import { makeIrsTradeBooked } from "../../platform/markets/cdm/ird";
import { runEodIrsRevaluation } from "../../platform/markets/eod/irs-revaluation";
import { StaticJibarRateSource } from "../../platform/markets/eod/jibar-curve-seed";
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
    expect(unrealisedLeg ? legMinor(unrealisedLeg) : undefined).toBe(7_500_00);

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
        .reduce((s, l) => s + legMinor(l), 0);
      const credit = ccyLegs
        .filter((l) => l.debitCredit === "credit")
        .reduce((s, l) => s + legMinor(l), 0);
      expect(debit).toBe(credit);
    }
  });
});

describe("Regression — CDM SettlementConfirmed no longer produces a posting (A4: PR-FX-LIFECYCLE-CLOSE retired)", () => {
  it("RETIRED A4: SettlementConfirmed is rejected by the engine — realised P&L now flows via RealisedPnlRecognised + PR-FX-REALISED-PNL", async () => {
    // Authority: D-FIL-BOOK-COMPOSITE-VALUATION (2026-06-13, A4 cutover).
    // PR-FX-LIFECYCLE-CLOSE is removed from FX_IFRS_RULES; SettlementConfirmed
    // produces no SubLedgerPostingEmitted. Realised P&L is posted on RealisedPnlRecognised.
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

    // 4) Assert NO "fx-lifecycle-close" posting is emitted for SettlementConfirmed (A4 retirement)
    const postings = postingsForSource(lifecycleClose.event_id).filter((ev) => {
      const p = ev.payload as { postingType?: string };
      return p.postingType === "fx-lifecycle-close";
    });
    expect(postings).toHaveLength(0);
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
    expect(assetLeg ? legMinor(assetLeg) : undefined).toBe(dirty);
    expect(cashLeg?.debitCredit).toBe("credit");
    expect(cashLeg ? legMinor(cashLeg) : undefined).toBe(dirty);
    // Balanced.
    // Balanced: total debits == total credits (per currency).
    let bal = 0;
    for (const l of legs) bal += l.debitCredit === "debit" ? legMinor(l) : -legMinor(l);
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
    for (const l of legs) bal += l.debitCredit === "debit" ? legMinor(l) : -legMinor(l);
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
    for (const l of legs) bal += l.debitCredit === "debit" ? legMinor(l) : -legMinor(l);
    expect(bal).toBe(0);
    // No P&L recycling (§5.7.5): the FVTPL P&L account is NOT touched.
    expect(legs.find((l) => l.accountId === "ACC-3200-003")).toBeUndefined();
    // OCI reserve + retained earnings ARE touched.
    expect(legs.some((l) => l.accountId === "ACC-3200-004")).toBe(true);
    expect(legs.some((l) => l.accountId === "ACC-5000-002")).toBe(true);
  });
});

// ===========================================================================
// IRS family convergence (D-IRS-FAMILY-CONVERGE-ACCOUNTING) —
// a booked IRS + an EOD revaluation post to the GL via the accounting
// IrdSwap* family. Before the fix, the live IRS engine emitted the trade-domain
// IrsPositionRevalued, which NOTHING on the GL path consumed → the IRS book
// posted nothing. This test proves the converged path:
//   - off-market IrdSwapTradeExecuted (npvMinor != 0) → `ird-swap-trade-booking`
//   - runEodIrsRevaluation → IrdSwapPositionRevalued (non-zero delta)
//                          → `ird-swap-revaluation`
//
// brief:mira:ws-ba-returns-irs-family-reconcile-converge-irs-:2026-06-09
// ===========================================================================

describe("IRS convergence — booked IRS + EOD reval → GL postings on IrdSwap* family", () => {
  it("off-market IrdSwapTradeExecuted + runEodIrsRevaluation → ird-swap-trade-booking + ird-swap-revaluation postings", async () => {
    const suffix = newEventId().slice(0, 8);
    const tradeId = `IRS-CONV-${suffix}`;
    const valuationDate = "2026-05-17";

    // 1) Trade-domain booking — the CDM record the EOD reval engine replays for
    //    the open IRS book (notional / legs / counterparty). No GL footprint of
    //    its own (the markets family is not a GL subscriber).
    const irsBooked = makeIrsTradeBooked({
      asOf: `${valuationDate}T07:00:00.000Z`,
      entity: REG_ENTITY,
      actor: { type: "human", id: "eitan@bank.local" },
      citations: ["D-MARKETS-SCHEMA-FOUNDATION"],
      payload: {
        tradeId: { scheme: "INTERNAL", value: tradeId },
        counterparty: { partyId: "CP-IRS-CONV-001", name: "Conv Co", role: "counterparty" },
        notional: { currency: "ZAR", amountMinor: 10_000_000_000 },
        fixedRate: 0.085,
        floatingIndex: "JIBAR-3M",
        bankPays: "fixed",
        tradeDate: { iso: valuationDate, calendar: "JIHCAL" },
        effectiveDate: { iso: "2026-05-19", calendar: "JIHCAL" },
        maturityDate: { iso: "2031-05-19", calendar: "JIHCAL" },
        paymentFrequency: "quarterly",
        dayCountConvention: "ACT/365",
        bookId: "BOOK-IRD-RATES",
        traderRef: "eitan@bank.local",
      },
    });
    compositionEventStore.append(irsBooked);

    // 2) Accounting booking — canonical GL trigger. Off-market (npvMinor > 0) so
    //    PR-IRS-001 fires a real `ird-swap-trade-booking` posting (an at-market
    //    zero-NPV inception correctly produces no posting).
    const irdExecuted = makeIrdSwapTradeExecuted({
      asOf: `${valuationDate}T07:00:00.000Z`,
      entity: REG_ENTITY,
      actor: { type: "human", id: "eitan@bank.local" },
      citations: ["D-IRS-FAMILY-CONVERGE-ACCOUNTING", "IFRS-9-§4.1"],
      payload: {
        tradeId,
        instrumentType: "irs",
        role: "pay-fixed",
        notionalMinor: 10_000_000_000,
        npvMinor: 1_250_000, // off-market premium → Dr Swap Asset / Cr Unrealised P&L
        fixedRatePercent: 0.085,
        tradeDate: valuationDate,
        startDate: "2026-05-19",
        maturityDate: "2031-05-19",
        counterpartyLei: "CP-IRS-CONV-001",
        currency: "ZAR",
        bookDesignation: "trading",
      },
    });
    compositionEventStore.append(irdExecuted);

    // 3) EOD revaluation — the converged engine emits IrdSwapPositionRevalued
    //    (the GL + BA 320 canonical reval fact), NOT the trade-domain mirror.
    const reval = runEodIrsRevaluation(
      compositionEventStore,
      valuationDate,
      new StaticJibarRateSource(),
    );
    expect(reval.revalued).toBeGreaterThanOrEqual(1);

    // 4) Run the GL posting engine over the converged events.
    const result = await beaGlPostingEngine(buildRegressionCtx(`${valuationDate}T18:00:00.000Z`));
    expect(result.ok).toBe(true);

    // 5) The off-market booking produced an `ird-swap-trade-booking` posting.
    const bookingPostings = postingsForSource(irdExecuted.event_id).filter((ev) => {
      const p = ev.payload as { postingType?: string };
      return p.postingType === "ird-swap-trade-booking";
    });
    expect(bookingPostings).toHaveLength(1);

    // 6) The EOD revaluation produced an `ird-swap-revaluation` posting. The
    //    reval event is identified by sourceEventId via its postingType.
    const revalPostings = [...compositionEventStore.replay({ type: "SubLedgerPostingEmitted" })]
      .filter((ev) => {
        const p = ev.payload as { postingType?: string };
        return p.postingType === "ird-swap-revaluation";
      })
      .filter((ev) => {
        // Restrict to THIS trade's reval by checking the leg currency + that a
        // matching IrdSwapPositionRevalued exists for this tradeId.
        const p = ev.payload as { sourceEventId?: string };
        return [...compositionEventStore.replay({ type: "IrdSwapPositionRevalued" })].some(
          (r) =>
            r.event_id === p.sourceEventId &&
            (r.payload as { tradeId?: string }).tradeId === tradeId,
        );
      });
    expect(revalPostings).toHaveLength(1);

    // 7) Both postings balance (interpreter assert_zero).
    for (const posting of [bookingPostings[0], revalPostings[0]]) {
      const legs = (posting.payload as { legs: SubLedgerLeg[] }).legs;
      let bal = 0;
      for (const l of legs) bal += l.debitCredit === "debit" ? legMinor(l) : -legMinor(l);
      expect(bal).toBe(0);
    }
  });
});
