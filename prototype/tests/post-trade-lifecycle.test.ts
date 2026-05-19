// tests/post-trade-lifecycle.test.ts
//
// Tests for runPostTradeLifecycle — verifies that the full post-trade
// production event chain is emitted after a sim FxTradeExecuted.
//
// Authority: D-FX-CLS-MEMBERSHIP; D-MARKETS-SCHEMA-FOUNDATION; D-FX-AD-STATUS.
// Author: Devon (Chief Operating Officer, engineering)

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { generateSimTrade } from "../platform/simulation/fx-sim-generator";
import { runPostTradeLifecycle } from "../platform/simulation/post-trade-lifecycle";
import { FxRateEngine } from "../platform/simulation/fx-sim-rates";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BANK_BIC = "BANKZAJJXXX";
const COUNTERPARTY_BIC = "SBZAZAJJXXX";
const AS_OF = "2026-05-19T10:00:00.000Z";

// Expected event types emitted by runPostTradeLifecycle (7+ types).
// The inbound simulator emits InboundMessageReceived + MessageCorrelated per message.
const EXPECTED_TYPES = new Set([
  "FxSettlementInstructed",
  "PrincipalPayment",
  "SettlementConfirmed",
  "OutboundMessageDispatched",
  "InboundMessageReceived",
  "MessageCorrelated",
]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runPostTradeLifecycle", () => {
  it("emits all required post-trade event types for a sim trade", () => {
    const store = new EventStore(":memory:");
    const rateEngine = new FxRateEngine();
    const trade = generateSimTrade(rateEngine, [
      {
        partyId: "SIMSAZA0000000001ZA",
        name: "Standard Simulated Bank SA",
        role: "counterparty",
        jurisdiction: "ZA",
        bic: COUNTERPARTY_BIC,
        eligiblePairs: ["ZAR/USD"],
        minNotionalMinor: 100_000_00,
        maxNotionalMinor: 5_000_000_00,
      },
    ], "BK-TEST");

    runPostTradeLifecycle(store, trade, AS_OF, BANK_BIC, COUNTERPARTY_BIC);

    const events = [...store.replay({})];
    const emittedTypes = new Set(events.map((e) => e.type));

    for (const expectedType of EXPECTED_TYPES) {
      expect(emittedTypes.has(expectedType)).toBe(true);
    }
  });

  it("emits exactly 2 FxSettlementInstructed events (pay + receive legs)", () => {
    const store = new EventStore(":memory:");
    const rateEngine = new FxRateEngine();
    const trade = generateSimTrade(rateEngine, [
      {
        partyId: "SIMSAZA0000000001ZA",
        name: "Standard Simulated Bank SA",
        role: "counterparty",
        jurisdiction: "ZA",
        bic: COUNTERPARTY_BIC,
        eligiblePairs: ["ZAR/USD"],
        minNotionalMinor: 100_000_00,
        maxNotionalMinor: 5_000_000_00,
      },
    ], "BK-TEST");

    runPostTradeLifecycle(store, trade, AS_OF, BANK_BIC, COUNTERPARTY_BIC);

    const events = [...store.replay({})];
    const settlementInstructed = events.filter((e) => e.type === "FxSettlementInstructed");
    expect(settlementInstructed).toHaveLength(2);
  });

  it("emits exactly 2 PrincipalPayment events (deliver + receive legs)", () => {
    const store = new EventStore(":memory:");
    const rateEngine = new FxRateEngine();
    const trade = generateSimTrade(rateEngine, [
      {
        partyId: "SIMSAZA0000000001ZA",
        name: "Standard Simulated Bank SA",
        role: "counterparty",
        jurisdiction: "ZA",
        bic: COUNTERPARTY_BIC,
        eligiblePairs: ["ZAR/USD"],
        minNotionalMinor: 100_000_00,
        maxNotionalMinor: 5_000_000_00,
      },
    ], "BK-TEST");

    runPostTradeLifecycle(store, trade, AS_OF, BANK_BIC, COUNTERPARTY_BIC);

    const events = [...store.replay({})];
    const principalPayments = events.filter((e) => e.type === "PrincipalPayment");
    expect(principalPayments).toHaveLength(2);
  });

  it("emits exactly 1 SettlementConfirmed event", () => {
    const store = new EventStore(":memory:");
    const rateEngine = new FxRateEngine();
    const trade = generateSimTrade(rateEngine, [
      {
        partyId: "SIMSAZA0000000001ZA",
        name: "Standard Simulated Bank SA",
        role: "counterparty",
        jurisdiction: "ZA",
        bic: COUNTERPARTY_BIC,
        eligiblePairs: ["ZAR/USD"],
        minNotionalMinor: 100_000_00,
        maxNotionalMinor: 5_000_000_00,
      },
    ], "BK-TEST");

    runPostTradeLifecycle(store, trade, AS_OF, BANK_BIC, COUNTERPARTY_BIC);

    const events = [...store.replay({})];
    const confirmed = events.filter((e) => e.type === "SettlementConfirmed");
    expect(confirmed).toHaveLength(1);
  });

  it("emits exactly 1 OutboundMessageDispatched event (MT300)", () => {
    const store = new EventStore(":memory:");
    const rateEngine = new FxRateEngine();
    const trade = generateSimTrade(rateEngine, [
      {
        partyId: "SIMSAZA0000000001ZA",
        name: "Standard Simulated Bank SA",
        role: "counterparty",
        jurisdiction: "ZA",
        bic: COUNTERPARTY_BIC,
        eligiblePairs: ["ZAR/USD"],
        minNotionalMinor: 100_000_00,
        maxNotionalMinor: 5_000_000_00,
      },
    ], "BK-TEST");

    runPostTradeLifecycle(store, trade, AS_OF, BANK_BIC, COUNTERPARTY_BIC);

    const events = [...store.replay({})];
    const outbound = events.filter((e) => e.type === "OutboundMessageDispatched");
    expect(outbound).toHaveLength(1);
  });

  it("PrincipalPayment pay leg has negative netCash, receive leg has positive netCash", () => {
    const store = new EventStore(":memory:");
    const rateEngine = new FxRateEngine();
    const trade = generateSimTrade(rateEngine, [
      {
        partyId: "SIMSAZA0000000001ZA",
        name: "Standard Simulated Bank SA",
        role: "counterparty",
        jurisdiction: "ZA",
        bic: COUNTERPARTY_BIC,
        eligiblePairs: ["ZAR/USD"],
        minNotionalMinor: 100_000_00,
        maxNotionalMinor: 5_000_000_00,
      },
    ], "BK-TEST");

    runPostTradeLifecycle(store, trade, AS_OF, BANK_BIC, COUNTERPARTY_BIC);

    const events = [...store.replay({})];
    const payments = events.filter((e) => e.type === "PrincipalPayment");
    const deliverLeg = payments.find((e) => (e.payload as { legKind: string }).legKind === "deliver");
    const receiveLeg = payments.find((e) => (e.payload as { legKind: string }).legKind === "receive");

    expect(deliverLeg).toBeDefined();
    expect(receiveLeg).toBeDefined();
    expect((deliverLeg?.payload as { netCash: number }).netCash).toBeLessThan(0);
    expect((receiveLeg?.payload as { netCash: number }).netCash).toBeGreaterThan(0);
  });

  it("emits 7+ total event types for a single trade (production chain completeness)", () => {
    const store = new EventStore(":memory:");
    const rateEngine = new FxRateEngine();
    const trade = generateSimTrade(rateEngine, [
      {
        partyId: "SIMSAZA0000000001ZA",
        name: "Standard Simulated Bank SA",
        role: "counterparty",
        jurisdiction: "ZA",
        bic: COUNTERPARTY_BIC,
        eligiblePairs: ["ZAR/USD"],
        minNotionalMinor: 100_000_00,
        maxNotionalMinor: 5_000_000_00,
      },
    ], "BK-TEST");

    runPostTradeLifecycle(store, trade, AS_OF, BANK_BIC, COUNTERPARTY_BIC);

    const events = [...store.replay({})];
    // Should have at least 7 events:
    // 2x FxSettlementInstructed + 2x PrincipalPayment + 1x SettlementConfirmed
    // + 1x OutboundMessageDispatched + 1+ InboundMessageReceived
    expect(events.length).toBeGreaterThanOrEqual(7);
  });
});
