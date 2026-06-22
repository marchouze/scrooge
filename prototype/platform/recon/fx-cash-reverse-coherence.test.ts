// platform/recon/fx-cash-reverse-coherence.test.ts
//
// Tests for recon:fx-cash-reverse-coherence (D-FIL-CONSUMER-SURFACE-ARCHITECTURE).
//
// Proves the reverse cascade: a CANCELLED/TERMINATED FX whose derived cash is
// still effectively live FAILS; once the cascade voids that cash (the parent is
// terminal → `effectiveLiveCashInstances` drops it) the gate PASSES. Plus the
// MV-CASH-002 non-vacuity guard.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { FilInstanceLifecycleEvent } from "../../v2-core";
import { run } from "./fx-cash-reverse-coherence";

const FX_INSTANCE = "fil:inst:LE-ZA-HOZ-BANK:fx-1";
const CASH_RECEIVED = "fil:inst:LE-ZA-HOZ-BANK:fx-1:cash:received";

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

function fxTerminated(terminalStage: "settled" | "cancelled" | "terminated") {
  return {
    kind: "FilInstrumentTerminated",
    instance: FX_INSTANCE,
    type: "fil:type:fx:spot:otc-vanilla@1.0",
    tenant: "LE-ZA-HOZ-BANK",
    asOf: "2026-06-04T00:00:00.000Z",
    originatingEvent: { eventType: "TradeMatured", eventId: `e-${terminalStage}` },
    terminalStage,
  } as unknown as FilInstanceLifecycleEvent;
}

function cashCreated(): FilInstanceLifecycleEvent {
  return {
    kind: "FilInstrumentCreated",
    instance: CASH_RECEIVED,
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
      originatingInstrument: FX_INSTANCE,
    },
  } as unknown as FilInstanceLifecycleEvent;
}

function cashCancelled(): FilInstanceLifecycleEvent {
  return {
    kind: "FilInstrumentTerminated",
    instance: CASH_RECEIVED,
    type: "fil:type:cash:balance:vanilla@1.0",
    tenant: "LE-ZA-HOZ-BANK",
    asOf: "2026-06-04T00:00:00.000Z",
    originatingEvent: { eventType: "TradeMatured", eventId: "e-cash-cancel" },
    terminalStage: "cancelled",
  } as unknown as FilInstanceLifecycleEvent;
}

describe("recon:fx-cash-reverse-coherence", () => {
  test("empty FIL set → info, no fail", () => {
    const r = run({ filEvents: [] });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.severity === "info")).toBe(true);
  });

  test("VACUITY GUARD (MV-CASH-002): empty book + requireNonVacuousAnchor → FAIL", () => {
    const r = run({ filEvents: [], requireNonVacuousAnchor: true });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail" && v.subject === "anchor-book")).toBe(
      true,
    );
  });

  test("settled (non-terminal) FX with live cash → not policed (no terminal parent) → vacuous", () => {
    // A settled parent is NOT terminal; the cash is correctly live. The gate has
    // no cancelled-parent case to assert → flat-bench info (vacuous).
    const r = run({ filEvents: [fxCreated(), fxTerminated("settled"), cashCreated()] });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.subject === "anchor-book" && v.severity === "info")).toBe(
      true,
    );
  });

  test("BEFORE the cash is cancelled: CANCELLED parent + raw-live cash → FAILS (phantom-cash)", () => {
    // The defect: parent cancelled, derived cash NOT terminated — a phantom
    // holding with no standing trade behind it (the manual-reconcile gap this
    // workstream closes). The gate catches it fail-closed.
    const r = run({
      filEvents: [fxCreated(), fxTerminated("cancelled"), cashCreated()],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject.startsWith("phantom-cash:"))).toBe(true);
    expect(r.asserted).toBeGreaterThanOrEqual(1);
  });

  test("AFTER the cash is cancelled: CANCELLED parent + cancelled cash → PASSES", () => {
    // End-state: the derived cash is terminated alongside its parent. No phantom;
    // the cascade also voids it. Non-vacuous (a real cancelled-parent-with-cash
    // case was examined) so requireNonVacuousAnchor stays green.
    const r = run({
      filEvents: [fxCreated(), fxTerminated("cancelled"), cashCreated(), cashCancelled()],
      requireNonVacuousAnchor: true,
    });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.subject.startsWith("phantom-cash:"))).toBe(false);
    expect(r.violations.some((v) => v.subject.startsWith("cascade-leak:"))).toBe(false);
    // Vacuity guard did NOT fire — the case existed.
    expect(r.violations.some((v) => v.subject === "anchor-book")).toBe(false);
  });

  test("terminated parent + raw-live cash → FAILS (phantom-cash, same as cancelled)", () => {
    const r = run({ filEvents: [fxCreated(), fxTerminated("terminated"), cashCreated()] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject.startsWith("phantom-cash:"))).toBe(true);
  });
});
