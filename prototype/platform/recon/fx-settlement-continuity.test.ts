// platform/recon/fx-settlement-continuity.test.ts
//
// Tests for recon:fx-settlement-continuity (V2 A2).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { FilInstanceLifecycleEvent } from "../../v2-core";
import { run } from "./fx-settlement-continuity";

describe("recon:fx-settlement-continuity", () => {
  test("structural proof passes (5 cases) on an empty FIL set → info, no fail", () => {
    const r = run({ filEvents: [] });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBeGreaterThanOrEqual(5);
    // No settled FX instances → flat-bench info, never a fail.
    expect(r.violations.every((v) => v.severity !== "fail")).toBe(true);
    expect(r.violations.some((v) => v.severity === "info")).toBe(true);
  });

  test("a settled FX instance is checked and passes (value_pre == value_post)", () => {
    const created: FilInstanceLifecycleEvent = {
      kind: "FilInstrumentCreated",
      instance: "fil:inst:LE-ZA-HOZ-BANK:fx-1",
      type: "fil:type:fx:spot:otc-vanilla@1.0",
      tenant: "LE-ZA-HOZ-BANK",
      asOf: "2026-06-01T00:00:00.000Z",
      originatingEvent: { eventType: "FxTradeExecuted", eventId: "e1" },
      initialStage: "active",
      economicTerms: {
        assetClass: "fx",
        notional: { currency: "USD", minorUnits: 100_000n },
        direction: "long",
        counterpartyId: "CP1",
        nettingSetId: "NS-CP1-USD",
        currency: "USD",
        settlementDate: "2026-06-03",
        hedgingSetTag: "USD/ZAR",
      },
    } as unknown as FilInstanceLifecycleEvent;
    const terminated: FilInstanceLifecycleEvent = {
      kind: "FilInstrumentTerminated",
      instance: "fil:inst:LE-ZA-HOZ-BANK:fx-1",
      type: "fil:type:fx:spot:otc-vanilla@1.0",
      tenant: "LE-ZA-HOZ-BANK",
      asOf: "2026-06-03T00:00:00.000Z",
      originatingEvent: { eventType: "TradeMatured", eventId: "e2" },
      terminalStage: "settled",
    } as unknown as FilInstanceLifecycleEvent;

    const r = run({ filEvents: [created, terminated] });
    expect(r.ok).toBe(true);
    expect(r.asOf).toContain("1 settled FX instance");
    expect(r.violations.every((v) => v.severity !== "fail")).toBe(true);
  });
});
