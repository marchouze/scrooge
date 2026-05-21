// tests/fx-settlement-subscriber.test.ts
//
// Fixture-driven tests for the FX settlement subscriber (Tomas — Correspondent
// banking & payments, engineering; internal pre-licence test variant).
//
// Validates:
//   - the four message outcomes (both-delivered, one-leg, neither-delivered,
//     operational-delay) emit the correct event sequence.
//   - every FxSettlementFailed is followed by a deterministic
//     SettlementFailureClassified event.
//   - idempotency: same input + same clock + same id factory ⇒ same output.
//   - empty feed ⇒ empty result.
//   - missing required fields raise the documented errors.
//
// Author: Tomas — PR for WS-MARKET-RISK-PROCEDURES.

import { describe, expect, it } from "bun:test";

import type { Actor } from "../platform/event-store/types";
import {
  type CorrespondentMessage,
  FX_SETTLEMENT_SUBSCRIBER_VARIANT,
  idempotencyKey,
  makeStaticCorrespondentFeed,
  runFxSettlementSubscriber,
} from "../platform/markets/settlement/fx-settlement-subscriber";
import {
  HAPPY_PATH_INVESTEC_ZA,
  HAPPY_PATH_STANDARD_BANK_ZA,
  HERSTATT_ACTIVE_FAILURE,
  INTERNAL_PRE_LICENCE_TEST_BATCH,
  MUTUAL_FAIL,
  OPERATIONAL_DELAY,
} from "./fixtures/correspondent-feed/internal-pre-licence-test";

// ---------------------------------------------------------------------------
// Test scaffolding — deterministic clock + id factory.
// ---------------------------------------------------------------------------

const TEST_ACTOR: Actor = {
  type: "service",
  id: "agent:tomas:fx-settlement-subscriber",
};

const TEST_ENTITY = "LE-ZA-HOZ-BANK";

const TEST_CITATIONS = [
  "pr:#636",
  "pr:#638",
  "Policies/trading-mandate-v1.md#6",
  "memory:project_indirect_participant_posture",
  "bcbs:d226",
  "banks-act:reg-39",
] as const;

function makeDeterministicConfig() {
  let tick = 0;
  let idCount = 0;
  return {
    now: () => {
      // Each invocation advances by one second from a fixed epoch.
      const base = new Date("2026-05-22T16:00:00Z").getTime();
      const t = new Date(base + tick * 1000);
      tick += 1;
      return t.toISOString();
    },
    actor: TEST_ACTOR,
    entity: TEST_ENTITY,
    citations: [...TEST_CITATIONS],
    newId: () => {
      idCount += 1;
      // UUID-shaped deterministic id.
      const n = idCount.toString(16).padStart(12, "0");
      return `00000000-0000-4000-8000-${n}`;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FxSettlementSubscriber — variant marker", () => {
  it("exports the simulated-feed variant marker", () => {
    expect(FX_SETTLEMENT_SUBSCRIBER_VARIANT).toBe("simulated");
  });
});

describe("FxSettlementSubscriber — both-delivered path", () => {
  it("emits TradeMatured (FX-spot) when both legs delivered (Standard Bank ZA)", () => {
    const feed = makeStaticCorrespondentFeed([HAPPY_PATH_STANDARD_BANK_ZA]);
    const result = runFxSettlementSubscriber(feed, makeDeterministicConfig());

    expect(result.outcomes).toEqual([
      { kind: "confirmed", tradeRef: HAPPY_PATH_STANDARD_BANK_ZA.tradeRef },
    ]);
    expect(result.events).toHaveLength(1);
    const ev = result.events[0];
    if (!ev) throw new Error("event 0 missing");
    expect(ev.type).toBe("TradeMatured");
    expect((ev.payload as { tradeId: string }).tradeId).toBe(HAPPY_PATH_STANDARD_BANK_ZA.tradeRef);
    const product = (ev.payload as { product: { currencyPair: string; correspondentRef?: string } })
      .product;
    expect(product.currencyPair).toBe("USD/ZAR");
    expect(product.correspondentRef).toBe("SBZ-MT300-CONF-20260522-00001");
  });

  it("emits TradeMatured (FX-spot) for Investec ZA EUR/ZAR fixture", () => {
    const feed = makeStaticCorrespondentFeed([HAPPY_PATH_INVESTEC_ZA]);
    const result = runFxSettlementSubscriber(feed, makeDeterministicConfig());
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.type).toBe("TradeMatured");
    expect(result.outcomes[0]?.kind).toBe("confirmed");
  });
});

describe("FxSettlementSubscriber — one-leg-delivered path (Herstatt-active)", () => {
  it("emits MissedExpectedReceipt → FxSettlementFailed → SettlementFailureClassified", () => {
    const feed = makeStaticCorrespondentFeed([HERSTATT_ACTIVE_FAILURE]);
    const result = runFxSettlementSubscriber(feed, makeDeterministicConfig());

    expect(result.outcomes).toEqual([
      { kind: "one-leg-delivered", tradeRef: HERSTATT_ACTIVE_FAILURE.tradeRef },
    ]);
    expect(result.events.map((e) => e.type)).toEqual([
      "MissedExpectedReceipt",
      "FxSettlementFailed",
      "SettlementFailureClassified",
    ]);

    const missed = result.events[0];
    if (!missed) throw new Error("event 0 missing");
    expect((missed.payload as { tradeRef: string }).tradeRef).toBe(
      HERSTATT_ACTIVE_FAILURE.tradeRef,
    );
    expect((missed.payload as { expectedCurrency: string }).expectedCurrency).toBe("ZAR");

    const failed = result.events[1];
    if (!failed) throw new Error("event 1 missing");
    expect((failed.payload as { failureKind: string }).failureKind).toBe("one-leg-delivered");
    expect(
      (failed.payload as { legStatus: { payLegDelivered: boolean; receiveLegDelivered: boolean } })
        .legStatus,
    ).toEqual({ payLegDelivered: true, receiveLegDelivered: false });

    const classified = result.events[2];
    if (!classified) throw new Error("event 2 missing");
    expect((classified.payload as { classification: string }).classification).toBe(
      "herstatt-active",
    );
    expect((classified.payload as { evidence: string[] }).evidence).toContain(
      `event:${failed.event_id}`,
    );
  });
});

describe("FxSettlementSubscriber — neither-delivered path", () => {
  it("emits FxSettlementFailed{neither-delivered} → SettlementFailureClassified{mutual-fail}", () => {
    const feed = makeStaticCorrespondentFeed([MUTUAL_FAIL]);
    const result = runFxSettlementSubscriber(feed, makeDeterministicConfig());

    expect(result.outcomes).toEqual([
      { kind: "neither-delivered", tradeRef: MUTUAL_FAIL.tradeRef },
    ]);
    expect(result.events.map((e) => e.type)).toEqual([
      "FxSettlementFailed",
      "SettlementFailureClassified",
    ]);
    expect((result.events[0]?.payload as { failureKind: string }).failureKind).toBe(
      "neither-delivered",
    );
    expect((result.events[1]?.payload as { classification: string }).classification).toBe(
      "mutual-fail",
    );
  });
});

describe("FxSettlementSubscriber — operational-delay path", () => {
  it("emits FxSettlementFailed{operational-delay} → SettlementFailureClassified{operational-delay}", () => {
    const feed = makeStaticCorrespondentFeed([OPERATIONAL_DELAY]);
    const result = runFxSettlementSubscriber(feed, makeDeterministicConfig());

    expect(result.outcomes).toEqual([
      { kind: "operational-delay", tradeRef: OPERATIONAL_DELAY.tradeRef },
    ]);
    expect(result.events.map((e) => e.type)).toEqual([
      "FxSettlementFailed",
      "SettlementFailureClassified",
    ]);
    expect((result.events[0]?.payload as { failureKind: string }).failureKind).toBe(
      "operational-delay",
    );
    expect((result.events[1]?.payload as { classification: string }).classification).toBe(
      "operational-delay",
    );
  });
});

describe("FxSettlementSubscriber — full internal pre-licence test batch", () => {
  it("processes 5 messages emitting 2 confirmations + 8 failure-related events", () => {
    const feed = makeStaticCorrespondentFeed(INTERNAL_PRE_LICENCE_TEST_BATCH);
    const result = runFxSettlementSubscriber(feed, makeDeterministicConfig());

    // 2 happy-paths × 1 event = 2
    // 1 herstatt-active × 3 events = 3
    // 1 mutual-fail   × 2 events = 2
    // 1 op-delay      × 2 events = 2
    // total = 9
    expect(result.events).toHaveLength(9);
    expect(result.outcomes.map((o) => o.kind)).toEqual([
      "confirmed",
      "confirmed",
      "one-leg-delivered",
      "neither-delivered",
      "operational-delay",
    ]);

    // Every FxSettlementFailed must be immediately followed by a
    // SettlementFailureClassified (sequencing invariant).
    for (let i = 0; i < result.events.length; i++) {
      if (result.events[i]?.type === "FxSettlementFailed") {
        expect(result.events[i + 1]?.type).toBe("SettlementFailureClassified");
      }
    }
  });

  it("is deterministic on replay (same input + same clock + same id factory)", () => {
    const feed1 = makeStaticCorrespondentFeed(INTERNAL_PRE_LICENCE_TEST_BATCH);
    const feed2 = makeStaticCorrespondentFeed(INTERNAL_PRE_LICENCE_TEST_BATCH);
    const r1 = runFxSettlementSubscriber(feed1, makeDeterministicConfig());
    const r2 = runFxSettlementSubscriber(feed2, makeDeterministicConfig());
    // Strip event_id (deterministic but different config instances would
    // produce the same sequence — assert equality directly).
    expect(r1.events).toEqual(r2.events);
    expect(r1.outcomes).toEqual(r2.outcomes);
  });
});

describe("FxSettlementSubscriber — citation discipline (Principle 2)", () => {
  it("throws when no citations are configured", () => {
    expect(() =>
      runFxSettlementSubscriber(makeStaticCorrespondentFeed([HAPPY_PATH_STANDARD_BANK_ZA]), {
        ...makeDeterministicConfig(),
        citations: [],
      }),
    ).toThrow(/Principle 2/);
  });

  it("propagates configured citations onto every emitted event", () => {
    const feed = makeStaticCorrespondentFeed(INTERNAL_PRE_LICENCE_TEST_BATCH);
    const result = runFxSettlementSubscriber(feed, makeDeterministicConfig());
    for (const ev of result.events) {
      expect(ev.citations).toEqual([...TEST_CITATIONS]);
    }
  });
});

describe("FxSettlementSubscriber — empty + error paths", () => {
  it("returns empty events/outcomes for an empty feed", () => {
    const result = runFxSettlementSubscriber(
      makeStaticCorrespondentFeed([]),
      makeDeterministicConfig(),
    );
    expect(result.events).toEqual([]);
    expect(result.outcomes).toEqual([]);
  });

  it("throws when one-leg-delivered message is missing expected-receive fields", () => {
    const {
      expectedReceiveCurrency: _omitA,
      expectedReceiveAmountMinor: _omitB,
      ...rest
    } = HERSTATT_ACTIVE_FAILURE;
    const bad: CorrespondentMessage = rest;
    expect(() =>
      runFxSettlementSubscriber(makeStaticCorrespondentFeed([bad]), makeDeterministicConfig()),
    ).toThrow(/expectedReceiveCurrency/);
  });

  it("throws when both-delivered message is missing settled amounts / nostros", () => {
    const { nostroAccountBase: _omit, ...rest } = HAPPY_PATH_STANDARD_BANK_ZA;
    const bad: CorrespondentMessage = rest;
    expect(() =>
      runFxSettlementSubscriber(makeStaticCorrespondentFeed([bad]), makeDeterministicConfig()),
    ).toThrow(/nostro/);
  });
});

describe("FxSettlementSubscriber — idempotency key derivation", () => {
  it("produces a stable key from (settlementInstructionRef, kind)", () => {
    expect(idempotencyKey(HERSTATT_ACTIVE_FAILURE, "one-leg-delivered")).toBe(
      "settlement-instruction:sbz-2026-05-20-00003-near:one-leg-delivered",
    );
    expect(idempotencyKey(HAPPY_PATH_STANDARD_BANK_ZA, "confirmed")).toBe(
      "settlement-instruction:sbz-2026-05-20-00001-near:confirmed",
    );
  });
});
