// v2-core/fil-instances/cash-cascade.test.ts
//
// Tests for the derived-liveness cascade (D-FIL-CONSUMER-SURFACE-ARCHITECTURE).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { FilInstanceUrn } from "../fil-core/urn";
import {
  effectiveLiveCashInstances,
  isCashParentTerminal,
  isEffectivelyLiveCash,
  isParentTerminalStage,
} from "./cash-cascade";
import type { FilInstanceLifecycleEvent } from "./events";
import { foldFilInstances, liveInstances } from "./projection";

const FX_INSTANCE = "fil:inst:LE-ZA-HOZ-BANK:fx-1";
const CASH_RECEIVED = "fil:inst:LE-ZA-HOZ-BANK:fx-1:cash:received";
const CASH_PAID = "fil:inst:LE-ZA-HOZ-BANK:fx-1:cash:paid";

function fxCreated(): FilInstanceLifecycleEvent {
  return {
    kind: "FilInstrumentCreated",
    instance: FX_INSTANCE,
    type: "fil:type:fx:spot:otc-vanilla@1.0",
    tenant: "LE-ZA-HOZ-BANK",
    asOf: "2026-06-01T00:00:00.000Z",
    originatingEvent: { eventType: "FxTradeExecuted", eventId: "e1" },
    initialStage: "active",
    economicTerms: {
      assetClass: "fx",
      notional: { currency: "USD", amount: "1000.00" },
      direction: "long",
      counterpartyId: "CP1",
      nettingSetId: "NS-CP1-USD",
      currency: "USD",
      settlementDate: "2026-06-03",
      hedgingSetTag: "USD/ZAR",
    },
  } as unknown as FilInstanceLifecycleEvent;
}

function fxTerminated(terminalStage: "settled" | "cancelled" | "terminated", asOf: string) {
  return {
    kind: "FilInstrumentTerminated",
    instance: FX_INSTANCE,
    type: "fil:type:fx:spot:otc-vanilla@1.0",
    tenant: "LE-ZA-HOZ-BANK",
    asOf,
    originatingEvent: { eventType: "TradeMatured", eventId: `e-${terminalStage}` },
    terminalStage,
  } as unknown as FilInstanceLifecycleEvent;
}

function cashLeg(
  instance: string,
  side: "received" | "paid",
  originatingInstrument: string | undefined,
): FilInstanceLifecycleEvent {
  return {
    kind: "FilInstrumentCreated",
    instance,
    type: "fil:type:cash:balance:vanilla@1.0",
    tenant: "LE-ZA-HOZ-BANK",
    asOf: "2026-06-03T00:00:00.000Z",
    originatingEvent: { eventType: "TradeMatured", eventId: "e2" },
    initialStage: "active",
    economicTerms: {
      assetClass: "cash",
      notional: { currency: side === "received" ? "USD" : "ZAR", amount: "1000.00" },
      direction: side === "received" ? "long" : "short",
      counterpartyId: "CP1",
      nettingSetId: "NS-CP1-USD",
      currency: side === "received" ? "USD" : "ZAR",
      settlementDate: "2026-06-03T00:00:00.000Z",
      hedgingSetTag: side === "received" ? "USD/ZAR" : "ZAR/USD",
      ...(originatingInstrument ? { originatingInstrument } : {}),
    },
  } as unknown as FilInstanceLifecycleEvent;
}

describe("isParentTerminalStage", () => {
  test("cancelled and terminated are terminal", () => {
    expect(isParentTerminalStage("cancelled")).toBe(true);
    expect(isParentTerminalStage("terminated")).toBe(true);
  });
  test("settled / matured / active / proposed are NOT terminal (settled produces the cash)", () => {
    expect(isParentTerminalStage("settled")).toBe(false);
    expect(isParentTerminalStage("matured")).toBe(false);
    expect(isParentTerminalStage("active")).toBe(false);
    expect(isParentTerminalStage("proposed")).toBe(false);
  });
});

describe("effectiveLiveCashInstances — settled (non-terminal) parent keeps cash live", () => {
  test("settled FX → both cash legs effectively live (byte-identical to the raw live read)", () => {
    const events = [
      fxCreated(),
      fxTerminated("settled", "2026-06-03T00:00:00.000Z"),
      cashLeg(CASH_RECEIVED, "received", FX_INSTANCE),
      cashLeg(CASH_PAID, "paid", FX_INSTANCE),
    ];
    const register = foldFilInstances(events);
    const live = effectiveLiveCashInstances(register);
    expect(live.map((r) => String(r.instance)).sort()).toEqual([CASH_PAID, CASH_RECEIVED].sort());
    // The raw cash-live read agrees for a settled parent — no cascade drop.
    const rawCashLive = liveInstances(register).filter(
      (r) => r.economicTerms.assetClass === "cash",
    );
    expect(live.length).toBe(rawCashLive.length);
  });
});

describe("effectiveLiveCashInstances — CANCELLED parent voids the derived cash", () => {
  test("cancelled FX → derived cash dropped from the effectively-live set", () => {
    const events = [
      fxCreated(),
      fxTerminated("cancelled", "2026-06-04T00:00:00.000Z"),
      cashLeg(CASH_RECEIVED, "received", FX_INSTANCE),
      cashLeg(CASH_PAID, "paid", FX_INSTANCE),
    ];
    const register = foldFilInstances(events);

    // BEFORE the cascade view: the raw live read still shows both cash legs
    // (their OWN stage is active) — that is the phantom the cascade removes.
    const rawCashLive = liveInstances(register).filter(
      (r) => r.economicTerms.assetClass === "cash",
    );
    expect(rawCashLive.length).toBe(2);

    // AFTER the cascade: zero effectively-live cash.
    const live = effectiveLiveCashInstances(register);
    expect(live.length).toBe(0);

    const received = register.get(CASH_RECEIVED as FilInstanceUrn);
    expect(received).toBeDefined();
    if (received) {
      expect(isCashParentTerminal(received, register)).toBe(true);
      expect(isEffectivelyLiveCash(received, register)).toBe(false);
    }
  });

  test("terminated parent also voids the derived cash", () => {
    const events = [
      fxCreated(),
      fxTerminated("terminated", "2026-06-04T00:00:00.000Z"),
      cashLeg(CASH_RECEIVED, "received", FX_INSTANCE),
    ];
    const register = foldFilInstances(events);
    expect(effectiveLiveCashInstances(register).length).toBe(0);
  });
});

describe("as-of correctness", () => {
  test("AS OF before the cancellation, the parent is active → cash effectively live", () => {
    const events = [
      fxCreated(),
      cashLeg(CASH_RECEIVED, "received", FX_INSTANCE),
      fxTerminated("cancelled", "2026-06-10T00:00:00.000Z"),
    ];
    // Fold bounded to BEFORE the cancellation — parent reads back active.
    const asOfBefore = foldFilInstances(events, "2026-06-05T00:00:00.000Z");
    expect(effectiveLiveCashInstances(asOfBefore).length).toBe(1);

    // Fold AS OF after the cancellation — cascade voids the cash.
    const asOfAfter = foldFilInstances(events, "2026-06-11T00:00:00.000Z");
    expect(effectiveLiveCashInstances(asOfAfter).length).toBe(0);
  });
});

describe("orphan / absent-parent handling (the sibling gate's concern, not the cascade's)", () => {
  test("cash with no originatingInstrument is NOT parent-terminal (orphan handled elsewhere)", () => {
    const events = [cashLeg(CASH_RECEIVED, "received", undefined)];
    const register = foldFilInstances(events);
    const cash = register.get(CASH_RECEIVED as FilInstanceUrn);
    expect(cash).toBeDefined();
    if (cash) {
      expect(isCashParentTerminal(cash, register)).toBe(false);
      // Its own stage is active and parent absent → effectively live.
      expect(isEffectivelyLiveCash(cash, register)).toBe(true);
    }
  });

  test("cash whose parent is absent from the register is not voided", () => {
    const events = [cashLeg(CASH_RECEIVED, "received", "fil:inst:LE-ZA-HOZ-BANK:absent-fx")];
    const register = foldFilInstances(events);
    expect(effectiveLiveCashInstances(register).length).toBe(1);
  });
});
