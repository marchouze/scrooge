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

  test("a settled FX instance + its materialised cash leg pass (value_pre == value_post)", () => {
    // Slice 2 (D-CASH-ASSET-CLASS-V1): the HISTORY proof pairs the settled FX
    // INSTRUMENT-OF-RECORD with the REAL cash instance the settlement
    // materialised (linked by economicTerms.originatingInstrument), not a phantom
    // projection-time position.
    const fxInstance = "fil:inst:LE-ZA-HOZ-BANK:fx-1";
    const created: FilInstanceLifecycleEvent = {
      kind: "FilInstrumentCreated",
      instance: fxInstance,
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
    const terminated: FilInstanceLifecycleEvent = {
      kind: "FilInstrumentTerminated",
      instance: fxInstance,
      type: "fil:type:fx:spot:otc-vanilla@1.0",
      tenant: "LE-ZA-HOZ-BANK",
      asOf: "2026-06-03T00:00:00.000Z",
      originatingEvent: { eventType: "TradeMatured", eventId: "e2" },
      terminalStage: "settled",
    } as unknown as FilInstanceLifecycleEvent;
    // The materialised received cash leg in the SAME currency (USD), carrying the
    // same notional and the originating FX instance back-ref.
    const cashLeg: FilInstanceLifecycleEvent = {
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
        originatingInstrument: fxInstance,
      },
    } as unknown as FilInstanceLifecycleEvent;

    const r = run({ filEvents: [created, terminated, cashLeg] });
    expect(r.ok).toBe(true);
    expect(r.asOf).toContain("1 settled FX instance");
    expect(r.violations.every((v) => v.severity !== "fail")).toBe(true);
  });

  test("VACUITY GUARD (MV-CASH-001): empty population + requireNonVacuousHistory → FAIL (fail-closed)", () => {
    // The CLI / on-anchor path requires a non-zero compared population. An empty
    // anchor book must FAIL the gate (not pass with an info note) — this is the
    // crux of Nadia's HIGH finding: a degenerate proof that asserts nothing.
    const r = run({ filEvents: [], requireNonVacuousHistory: true });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail" && v.subject === "anchor-book")).toBe(
      true,
    );
  });

  test("a settled FX instance with NO materialised cash leg fails (instrument-of-record continuity broken)", () => {
    const fxInstance = "fil:inst:LE-ZA-HOZ-BANK:fx-2";
    const created: FilInstanceLifecycleEvent = {
      kind: "FilInstrumentCreated",
      instance: fxInstance,
      type: "fil:type:fx:spot:otc-vanilla@1.0",
      tenant: "LE-ZA-HOZ-BANK",
      asOf: "2026-06-01T00:00:00.000Z",
      originatingEvent: { eventType: "FxTradeExecuted", eventId: "e3" },
      initialStage: "active",
      economicTerms: {
        assetClass: "fx",
        notional: { currency: "EUR", amount: "2000.00" },
        direction: "long",
        counterpartyId: "CP2",
        nettingSetId: "NS-CP2-EUR",
        currency: "EUR",
        settlementDate: "2026-06-03",
        hedgingSetTag: "EUR/ZAR",
      },
    } as unknown as FilInstanceLifecycleEvent;
    const terminated: FilInstanceLifecycleEvent = {
      kind: "FilInstrumentTerminated",
      instance: fxInstance,
      type: "fil:type:fx:spot:otc-vanilla@1.0",
      tenant: "LE-ZA-HOZ-BANK",
      asOf: "2026-06-03T00:00:00.000Z",
      originatingEvent: { eventType: "TradeMatured", eventId: "e4" },
      terminalStage: "settled",
    } as unknown as FilInstanceLifecycleEvent;

    const r = run({ filEvents: [created, terminated] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
  });
});
