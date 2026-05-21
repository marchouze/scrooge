// platform/accounting/gl-posting-engine.test.ts
//
// Fixture tests for the `bea-gl-posting-engine` autonomous subscriber.
//
// Coverage matrix:
//   1. Happy path  — FxTradeExecuted + FxPositionRevalued + PrincipalPayment
//      (receive + deliver) + SettlementConfirmed → expected sequence of
//      SubLedgerPostingEmitted events with correct postingTypes.
//   2. Herstatt   — FxSettlementFailed{one-leg-delivered} → 4-leg
//      PR-FX-005 posting; engine resolves receive-leg context from the
//      originating FxTradeExecuted.
//   3. Mutual    — FxSettlementFailed{neither-delivered} → zero postings;
//      skipped[] populated with reason "fvtpl-out-of-ecl-scope".
//   4. Op-delay  — FxSettlementFailed{operational-delay} → zero postings;
//      skipped[] populated with reason "fvtpl-out-of-ecl-scope".
//   5. Idempotency — run twice with priorPostings from first run; second
//      run emits zero new events, skipped[] tags duplicates.
//   6. Mixed stream — ordered emission preserves input order; non-FX
//      events silently passed over.
//   7. Memo events (FxSettlementInstructed, TradeReportSubmitted) →
//      zero postings; skipped[] populated with "intentional-no-gl-impact".
//   8. Deterministic event_id — same source-event produces the same
//      posting event_id across runs.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import { HOZ_BANK_ENTITY } from "../core/types";
import { makeFxPositionRevalued } from "../event-store/event-types/fx-accounting";
import { makeFxSettlementFailed } from "../event-store/event-types/fx-accounting";
import type { Event } from "../event-store/types";
import {
  makeFxSettlementInstructed,
  makeFxTradeExecuted,
  makePrincipalPayment,
  makeSettlementConfirmed,
} from "../markets/cdm/fx";
import { POSTING_RULE_IDS, deriveGlPostingEventId, runGlPostingEngine } from "./gl-posting-engine";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY = HOZ_BANK_ENTITY;
const ENGINE_ACTOR = {
  type: "service" as const,
  id: "agent:bea:gl-posting-engine",
};
const NOW = "2026-05-21T08:00:00.000Z";
const now = () => NOW;
const CITATIONS = ["Principles/1-events-are-truth.md", "pr:#663"];

const TRADE_ID = "TRD-FX-SPOT-TEST-001";
const TRADE_DATE = "2026-05-20";
const SETTLEMENT_DATE = "2026-05-22";
const TRADE_TS = "2026-05-20T10:00:00.000Z";
const USD_500K_MINOR = 50_000_000;
const SPOT_RATE = 18.524;
const ZAR_AMOUNT_MINOR = Math.round(USD_500K_MINOR * SPOT_RATE);

const COUNTERPARTY = {
  partyId: "urn:party:legal-entity:standard-bank-za",
  name: "Standard Bank ZA",
  role: "counterparty" as const,
  jurisdiction: "ZA",
};

function makeTradeEvent(): Event {
  return makeFxTradeExecuted({
    asOf: TRADE_TS,
    entity: ENTITY,
    actor: { type: "service", id: "trader:test" },
    citations: ["pr:#663", "Principles/1-events-are-truth.md"],
    payload: {
      tradeId: { scheme: "INTERNAL", value: TRADE_ID },
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      legs: [
        {
          legKind: "near",
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          notional: { currency: "ZAR", amountMinor: ZAR_AMOUNT_MINOR },
          counterNotional: { currency: "USD", amountMinor: USD_500K_MINOR },
          rate: { currency: "ZAR", amount: SPOT_RATE },
          settlementDate: { iso: SETTLEMENT_DATE, calendar: "JIHCAL" },
        },
      ],
      tradeDate: { iso: TRADE_DATE, calendar: "JIHCAL" },
      counterparty: COUNTERPARTY,
      venue: "OTC",
      trader: "trader:test",
      bookId: "BOOK-FX-MARKETS-LP",
      bookType: "trading",
      settlementForm: "physical",
      settlementPath: "correspondent",
      finsurvCategory: "ODP-001",
      clientFlowRef: "test:flow-001",
    },
  });
}

function makeRevalEvent(deltaZar: number): Event {
  return makeFxPositionRevalued({
    asOf: "2026-05-21T17:00:00.000Z",
    entity: ENTITY,
    actor: { type: "service", id: "agent:bea:fx-revaluation" },
    citations: ["Policies/valuation-policy-v1.md"],
    payload: {
      tradeId: TRADE_ID,
      currencyPair: "USD/ZAR",
      bookRate: SPOT_RATE,
      revalRate: SPOT_RATE + 0.01,
      notionalBaseMinor: USD_500K_MINOR,
      unrealisedPnlZarMinor: deltaZar,
      revaluedAt: "2026-05-21T17:00:00.000Z",
      rateSource: "stub",
    },
  });
}

function makePrincipalPaymentEvent(args: {
  legKind: "receive" | "deliver";
  currency: string;
  netCash: number;
}): Event {
  return makePrincipalPayment({
    asOf: `${SETTLEMENT_DATE}T16:00:00.000Z`,
    entity: ENTITY,
    actor: { type: "service", id: "tomas:settlement-subscriber" },
    citations: ["pr:#663"],
    payload: {
      tradeId: TRADE_ID,
      legKind: args.legKind,
      currencyPair: "USD/ZAR",
      currency: args.currency,
      netCash: args.netCash,
      settlementDate: SETTLEMENT_DATE,
      settlementPath: "correspondent",
      correspondent: {
        name: "Simulated Correspondent",
        bic: "TESTBICXXX",
      },
      citations: ["pr:#663"],
    },
  });
}

function makeSettlementConfirmedEvent(realisedPnlDelta: number): Event {
  return makeSettlementConfirmed({
    asOf: `${SETTLEMENT_DATE}T16:30:00.000Z`,
    entity: ENTITY,
    actor: { type: "service", id: "tomas:settlement-subscriber" },
    citations: ["pr:#663"],
    payload: {
      tradeId: TRADE_ID,
      currencyPair: "USD/ZAR",
      settledDate: SETTLEMENT_DATE,
      realisedPnlDelta,
      settlementRef: `CONF-${TRADE_ID}`,
      citations: ["pr:#663"],
    },
  });
}

function makeFailedEvent(
  failureKind: "one-leg-delivered" | "neither-delivered" | "operational-delay",
): Event {
  return makeFxSettlementFailed({
    asOf: `${SETTLEMENT_DATE}T16:45:00.000Z`,
    entity: ENTITY,
    actor: { type: "service", id: "tomas:settlement-subscriber" },
    citations: ["pr:#638"],
    payload: {
      tradeRef: TRADE_ID,
      settlementInstructionRef: "set-instr-test",
      failedAt: `${SETTLEMENT_DATE}T16:45:00.000Z`,
      failureKind,
      failureReason: `Test fixture failure: ${failureKind}`,
      legStatus:
        failureKind === "one-leg-delivered"
          ? { payLegDelivered: true, receiveLegDelivered: false }
          : { payLegDelivered: false, receiveLegDelivered: false },
    },
  });
}

function makeInstructionEvent(): Event {
  return makeFxSettlementInstructed({
    asOf: TRADE_TS,
    entity: ENTITY,
    actor: { type: "service", id: "settlement-ops" },
    citations: ["pr:#663"],
    payload: {
      tradeId: { scheme: "INTERNAL", value: TRADE_ID },
      legKind: "near",
      settlementId: { scheme: "INTERNAL", value: `STL-${TRADE_ID}` },
      settlementPath: "correspondent",
      settlementForm: "physical",
      correspondent: {
        partyId: "urn:party:legal-entity:correspondent",
        name: "Sim Correspondent",
        role: "settlement-agent",
        jurisdiction: "ZA",
      },
      counterparty: COUNTERPARTY,
      netCash: { currency: "USD", amountMinor: USD_500K_MINOR },
      settlementDate: { iso: SETTLEMENT_DATE, calendar: "JIHCAL" },
      messageStandard: "SWIFT-MT202",
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runGlPostingEngine — happy path", () => {
  it("emits trade-booking + revaluation + 2x principal-payment + lifecycle-close postings", () => {
    const trade = makeTradeEvent();
    const reval = makeRevalEvent(50_000); // +ZAR 500
    const receivePay = makePrincipalPaymentEvent({
      legKind: "receive",
      currency: "USD",
      netCash: USD_500K_MINOR,
    });
    const deliverPay = makePrincipalPaymentEvent({
      legKind: "deliver",
      currency: "ZAR",
      netCash: -ZAR_AMOUNT_MINOR,
    });
    const close = makeSettlementConfirmedEvent(25_000);

    const result = runGlPostingEngine({
      events: [trade, reval, receivePay, deliverPay, close],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings.length).toBe(5);

    const types = result.emittedPostings.map(
      (e) => (e.payload as { postingType: string }).postingType,
    );
    expect(types).toEqual([
      "trade-booking",
      "revaluation",
      "fx-principal-payment",
      "fx-principal-payment",
      "fx-lifecycle-close",
    ]);

    // Each posting cites its source event.
    expect((result.emittedPostings[0]?.payload as { sourceEventId: string }).sourceEventId).toBe(
      trade.event_id,
    );
    expect((result.emittedPostings[1]?.payload as { sourceEventId: string }).sourceEventId).toBe(
      reval.event_id,
    );

    // Deterministic event_ids.
    expect(result.emittedPostings[0]?.event_id).toBe(
      deriveGlPostingEventId({
        postingRuleId: POSTING_RULE_IDS.TRADE_BOOKING,
        sourceEventId: trade.event_id,
      }),
    );

    // Engine actor identity propagated.
    expect(result.emittedPostings[0]?.actor.id).toBe("agent:bea:gl-posting-engine");

    expect(result.skipped.length).toBe(0);
  });

  it("uses source-event as_of for postedAt, not engine now()", () => {
    const trade = makeTradeEvent();
    const result = runGlPostingEngine({
      events: [trade],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });
    const posting = result.emittedPostings[0];
    expect(posting).toBeDefined();
    expect((posting?.payload as { postedAt: string }).postedAt).toBe(trade.as_of);
    // Envelope as_of carries engine run-time so emission lineage is timestamped.
    expect(posting?.as_of).toBe(NOW);
  });
});

describe("runGlPostingEngine — Herstatt (one-leg-delivered)", () => {
  it("emits 4-leg PR-FX-005 posting using receive-leg context from FxTradeExecuted", () => {
    const trade = makeTradeEvent();
    const failed = makeFailedEvent("one-leg-delivered");

    const result = runGlPostingEngine({
      events: [trade, failed],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings.length).toBe(2); // trade + failed

    const failedPosting = result.emittedPostings.find(
      (e) => (e.payload as { sourceEventId: string }).sourceEventId === failed.event_id,
    );
    expect(failedPosting).toBeDefined();
    expect((failedPosting?.payload as { postingType: string }).postingType).toBe("settlement");
    const legs = (failedPosting?.payload as { legs: { accountId: string }[] }).legs;
    expect(legs.length).toBe(4);

    // ECL allowance leg present (ZAR functional).
    const eclLeg = legs.find((l) => l.accountId === "ACC-2300-003");
    expect(eclLeg).toBeDefined();
    const sfReceivableLeg = legs.find((l) => l.accountId === "ACC-2300-002");
    expect(sfReceivableLeg).toBeDefined();
  });

  it("skips when receive-leg context cannot be resolved (no matching FxTradeExecuted)", () => {
    const failed = makeFailedEvent("one-leg-delivered");

    const result = runGlPostingEngine({
      events: [failed], // no FxTradeExecuted in the stream
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });

    expect(result.emittedPostings.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]?.reason).toBe("missing-failed-receive-leg-context");
  });
});

describe("runGlPostingEngine — FVTPL-out-of-ECL-scope branches", () => {
  it("neither-delivered → zero postings; skipped[] populated", () => {
    const failed = makeFailedEvent("neither-delivered");
    const result = runGlPostingEngine({
      events: [failed],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });
    expect(result.emittedPostings.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]?.reason).toBe("fvtpl-out-of-ecl-scope");
    expect(result.skipped[0]?.detail).toBe("neither-delivered");
  });

  it("operational-delay → zero postings; skipped[] populated", () => {
    const failed = makeFailedEvent("operational-delay");
    const result = runGlPostingEngine({
      events: [failed],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });
    expect(result.emittedPostings.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]?.reason).toBe("fvtpl-out-of-ecl-scope");
    expect(result.skipped[0]?.detail).toBe("operational-delay");
  });
});

describe("runGlPostingEngine — idempotency", () => {
  it("second run with priorPostings emits zero new events", () => {
    const trade = makeTradeEvent();
    const receivePay = makePrincipalPaymentEvent({
      legKind: "receive",
      currency: "USD",
      netCash: USD_500K_MINOR,
    });
    const events = [trade, receivePay];

    const first = runGlPostingEngine({
      events,
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });
    expect(first.emittedPostings.length).toBe(2);

    const second = runGlPostingEngine({
      events,
      priorPostings: first.emittedPostings,
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });
    expect(second.emittedPostings.length).toBe(0);
    expect(second.skipped.length).toBe(2);
    for (const s of second.skipped) {
      expect(s.reason).toBe("duplicate-already-posted");
    }
  });

  it("deterministic event_ids — same source produces same id across runs", () => {
    const trade = makeTradeEvent();
    const a = runGlPostingEngine({
      events: [trade],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });
    const b = runGlPostingEngine({
      events: [trade],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });
    expect(a.emittedPostings[0]?.event_id).toBe(b.emittedPostings[0]?.event_id);
  });
});

describe("runGlPostingEngine — mixed stream and memo events", () => {
  it("preserves input ordering of emitted postings", () => {
    const trade = makeTradeEvent();
    const reval = makeRevalEvent(100_000);
    const close = makeSettlementConfirmedEvent(50_000);
    const result = runGlPostingEngine({
      events: [trade, reval, close],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });
    const sourceIds = result.emittedPostings.map(
      (e) => (e.payload as { sourceEventId: string }).sourceEventId,
    );
    expect(sourceIds).toEqual([trade.event_id, reval.event_id, close.event_id]);
  });

  it("memo events (FxSettlementInstructed) → no posting; recorded in skipped[]", () => {
    const instr = makeInstructionEvent();
    const result = runGlPostingEngine({
      events: [instr],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });
    expect(result.emittedPostings.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]?.reason).toBe("intentional-no-gl-impact");
  });

  it("zero-delta revaluation → no posting; recorded in skipped[]", () => {
    const reval = makeRevalEvent(0);
    const result = runGlPostingEngine({
      events: [reval],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });
    expect(result.emittedPostings.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]?.reason).toBe("zero-delta-revaluation");
  });

  it("zero realised-PnL lifecycle-close → no posting; recorded in skipped[]", () => {
    const close = makeSettlementConfirmedEvent(0);
    const result = runGlPostingEngine({
      events: [close],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });
    expect(result.emittedPostings.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]?.reason).toBe("zero-realised-pnl");
  });

  it("silently passes over non-FX events (not in skipped[])", () => {
    // Construct a non-FX event by hand (bypassing schemas) — the engine
    // should ignore it entirely, not surface it in skipped[].
    const trade = makeTradeEvent();
    const fakeNonFx = {
      ...trade,
      event_id: "evt-non-fx",
      type: "SomeUnrelatedEvent",
    } as Event;
    const result = runGlPostingEngine({
      events: [trade, fakeNonFx],
      now,
      actor: ENGINE_ACTOR,
      entity: ENTITY,
      citations: CITATIONS,
    });
    expect(result.emittedPostings.length).toBe(1);
    expect(result.skipped.length).toBe(0);
  });
});
