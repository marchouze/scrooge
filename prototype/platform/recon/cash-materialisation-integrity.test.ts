// platform/recon/cash-materialisation-integrity.test.ts
//
// Tests for recon:cash-materialisation-integrity (Slice 3, D-CASH-ASSET-CLASS-V1).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { FilInstanceLifecycleEvent } from "../../v2-core";
import { run } from "./cash-materialisation-integrity";

const FX_INSTANCE = "fil:inst:LE-ZA-HOZ-BANK:fx-1";

function fxSettled(): FilInstanceLifecycleEvent[] {
  return [
    {
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
    },
    {
      kind: "FilInstrumentTerminated",
      instance: FX_INSTANCE,
      type: "fil:type:fx:spot:otc-vanilla@1.0",
      tenant: "LE-ZA-HOZ-BANK",
      asOf: "2026-06-03T00:00:00.000Z",
      originatingEvent: { eventType: "TradeMatured", eventId: "e2" },
      terminalStage: "settled",
    },
  ] as unknown as FilInstanceLifecycleEvent[];
}

function cashLeg(originatingInstrument: string | undefined): FilInstanceLifecycleEvent {
  return {
    kind: "FilInstrumentCreated",
    instance: "fil:inst:LE-ZA-HOZ-BANK:fx-1:cash:received",
    type: "fil:type:cash:balance:vanilla@1.0",
    tenant: "LE-ZA-HOZ-BANK",
    asOf: "2026-06-03T00:00:00.000Z",
    originatingEvent: { eventType: "TradeMatured", eventId: "e2" },
    initialStage: "active",
    economicTerms: {
      assetClass: "cash",
      notional: { currency: "USD", amount: "1000.00" },
      direction: "long",
      counterpartyId: "CP1",
      nettingSetId: "NS-CP1-USD",
      currency: "USD",
      settlementDate: "2026-06-03T00:00:00.000Z",
      hedgingSetTag: "USD/ZAR",
      ...(originatingInstrument ? { originatingInstrument } : {}),
    },
  } as unknown as FilInstanceLifecycleEvent;
}

describe("recon:cash-materialisation-integrity", () => {
  test("empty FIL set → info, no fail", () => {
    const r = run({ filEvents: [] });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.severity === "info")).toBe(true);
  });

  test("settled FX + materialised cash with back-ref → passes", () => {
    const r = run({ filEvents: [...fxSettled(), cashLeg(FX_INSTANCE)] });
    expect(r.ok).toBe(true);
    expect(r.violations.every((v) => v.severity !== "fail")).toBe(true);
    expect(r.asserted).toBeGreaterThanOrEqual(2);
  });

  test("(A) cash instance with NO originatingInstrument → fail-closed orphan", () => {
    const r = run({ filEvents: [...fxSettled(), cashLeg(undefined)] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject.startsWith("cash-orphan:"))).toBe(true);
  });

  test("(B) settled FX under a cash-materialising NPA with NO cash instance → fail-closed", () => {
    const r = run({ filEvents: fxSettled() });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject.startsWith("unmaterialised:"))).toBe(true);
  });
});
