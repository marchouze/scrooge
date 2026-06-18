// platform/recon/fx-cash-gl-recognition-integrity.test.ts
//
// Tests for recon:fx-cash-gl-recognition-integrity (D-CASH-ASSET-CLASS-V1,
// WS-CASH-ASSET-CLASS). The gate ties FX-settlement GL cash recognition to the
// materialised Cash FIL instrument-of-record (Principle 1).
//
// The anchor-fixture proof (received USD +100,000 / paid ZAR −1,852,000) is
// reproduced in-test as the canonical happy path.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";
import type { FilInstanceLifecycleEvent } from "../../v2-core";
import { run } from "./fx-cash-gl-recognition-integrity";

const TENANT = "LE-ZA-HOZ-BANK";
const FX_INSTANCE = `fil:inst:${TENANT}:S1-FX-FIXTURE-USD-SETTLED-001`;
const FX_TYPE = "fil:type:fx:spot:otc-vanilla@1.0";
const CASH_TYPE = "fil:type:cash:balance:vanilla@1.0";

// A settled FX instance governed by the FX OTC NPA (cash-materialising, bothLegs).
function fxSettled(): FilInstanceLifecycleEvent[] {
  return [
    {
      kind: "FilInstrumentCreated",
      instance: FX_INSTANCE,
      type: FX_TYPE,
      tenant: TENANT,
      asOf: "2026-06-01T00:00:00.000Z",
      originatingEvent: { eventType: "FxTradeExecuted", eventId: "e1" },
      initialStage: "active",
      economicTerms: {
        assetClass: "fx",
        notional: { currency: "USD", amount: "100000.00" },
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
      type: FX_TYPE,
      tenant: TENANT,
      asOf: "2026-06-03T00:00:00.000Z",
      originatingEvent: { eventType: "TradeMatured", eventId: "e2" },
      terminalStage: "settled",
    },
  ] as unknown as FilInstanceLifecycleEvent[];
}

// One materialised cash leg. side="received" → direction long (Dr nostro);
// side="paid" → direction short (Cr nostro).
function cashLeg(args: {
  side: "received" | "paid";
  currency: string;
  amount: string;
  origin?: string | undefined;
  direction?: "long" | "short";
}): FilInstanceLifecycleEvent {
  const direction = args.direction ?? (args.side === "received" ? "long" : "short");
  return {
    kind: "FilInstrumentCreated",
    instance: `${FX_INSTANCE}-cash-${args.side}`,
    type: CASH_TYPE,
    tenant: TENANT,
    asOf: "2026-06-03T00:00:00.000Z",
    originatingEvent: { eventType: "TradeMatured", eventId: "e2" },
    initialStage: "active",
    economicTerms: {
      assetClass: "cash",
      notional: { currency: args.currency, amount: args.amount },
      direction,
      counterpartyId: "CP1",
      nettingSetId: "NS-CP1-USD",
      currency: args.currency,
      settlementDate: "2026-06-03T00:00:00.000Z",
      hedgingSetTag: `${args.currency}/ZAR`,
      ...(args.origin === undefined ? {} : { originatingInstrument: args.origin }),
    },
  } as unknown as FilInstanceLifecycleEvent;
}

// The canonical anchor-fixture cash legs: received USD +100,000, paid ZAR −1,852,000.
function fixtureCashLegs(): FilInstanceLifecycleEvent[] {
  return [
    cashLeg({ side: "received", currency: "USD", amount: "100000.00", origin: FX_INSTANCE }),
    cashLeg({ side: "paid", currency: "ZAR", amount: "1852000.00", origin: FX_INSTANCE }),
  ];
}

describe("recon:fx-cash-gl-recognition-integrity", () => {
  test("empty FIL set → info, no fail (gate still ran)", () => {
    const r = run({ filEvents: [] });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.severity === "info")).toBe(true);
  });

  test("VACUITY GUARD (MV-CASH-001): empty book + requireNonVacuousAnchor → FAIL (fail-closed)", () => {
    const r = run({ filEvents: [], requireNonVacuousAnchor: true });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail" && v.subject === "anchor-book")).toBe(
      true,
    );
  });

  test("anchor fixture: USD +100k / ZAR −1,852k → both legs recognised, passes", () => {
    const r = run({ filEvents: [...fxSettled(), ...fixtureCashLegs()] });
    expect(r.ok).toBe(true);
    expect(r.violations.every((v) => v.severity !== "fail")).toBe(true);
    // 2 determinacy asserts (one per leg) + 1 two-sided + 1 non-vacuity.
    expect(r.asserted).toBeGreaterThanOrEqual(4);
  });

  test("(A) cash leg with zero notional → fail-closed indeterminate recognition", () => {
    const r = run({
      filEvents: [
        ...fxSettled(),
        cashLeg({ side: "received", currency: "USD", amount: "0", origin: FX_INSTANCE }),
        cashLeg({ side: "paid", currency: "ZAR", amount: "1852000.00", origin: FX_INSTANCE }),
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject.startsWith("indeterminate-recognition:"))).toBe(true);
  });

  test("(B) only the received side materialised → fail-closed one-legged recognition", () => {
    const r = run({
      filEvents: [
        ...fxSettled(),
        cashLeg({ side: "received", currency: "USD", amount: "100000.00", origin: FX_INSTANCE }),
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject.startsWith("one-legged-recognition:"))).toBe(true);
  });

  test("(B) only the paid side materialised → fail-closed one-legged recognition", () => {
    const r = run({
      filEvents: [
        ...fxSettled(),
        cashLeg({ side: "paid", currency: "ZAR", amount: "1852000.00", origin: FX_INSTANCE }),
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject.startsWith("one-legged-recognition:"))).toBe(true);
  });

  test("(C) both legs same currency netting to zero → fail-closed vacuous recognition", () => {
    // received USD +100k and paid USD −100k → nets to zero in the only currency.
    const r = run({
      filEvents: [
        ...fxSettled(),
        cashLeg({ side: "received", currency: "USD", amount: "100000.00", origin: FX_INSTANCE }),
        cashLeg({ side: "paid", currency: "USD", amount: "100000.00", origin: FX_INSTANCE }),
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject.startsWith("vacuous-recognition:"))).toBe(true);
  });

  test("orphan cash (no originatingInstrument) is ignored here → settled FX has no legs → info-only, no recognition fail", () => {
    // This gate does NOT own the orphan failure (cash-materialisation-integrity does);
    // an orphan cash leg simply does not tie to the FX, so the FX has zero legs and
    // this gate emits no recognition fail for it.
    const r = run({
      filEvents: [
        ...fxSettled(),
        cashLeg({ side: "received", currency: "USD", amount: "100000.00", origin: undefined }),
        cashLeg({ side: "paid", currency: "ZAR", amount: "1852000.00", origin: undefined }),
      ],
    });
    expect(r.violations.every((v) => v.severity !== "fail")).toBe(true);
  });
});
