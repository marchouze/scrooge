// platform/recon/fx-agreement-quad-integrity.test.ts
//
// Tests for recon:fx-agreement-quad-integrity (D-FX-INSTRUMENT-BUYSELL-QUAD).
//
// The recon gate reads FIL payloads as raw JSON off the v2 anchor store (the
// branded URN/Instant types are a compile-time fiction over plain strings), so
// the fixtures are built as plain objects cast through `unknown` — mirroring
// cash-materialisation-integrity.test.ts.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { FilInstanceLifecycleEvent } from "../../v2-core";
import { run } from "./fx-agreement-quad-integrity";

const FX_INSTANCE = "fil:inst:LE-ZA-HOZ-BANK:fx-1";

interface QuadOverrides {
  notional?: { currency: string; amount: string };
  fxAgreement?: {
    buy: { currency: string; amount: string };
    sell: { currency: string; amount: string };
  };
  omitQuad?: boolean;
}

/** An fx instance with a COHERENT long-USD-vs-ZAR quad, unless overridden. */
function fxInstance(overrides: QuadOverrides = {}): FilInstanceLifecycleEvent {
  const economicTerms: Record<string, unknown> = {
    assetClass: "fx",
    notional: overrides.notional ?? { currency: "USD", amount: "1000.00" },
    direction: "long",
    counterpartyId: "CP1",
    nettingSetId: "NS-CP1-USD",
    currency: "USD",
    settlementDate: "2026-06-03",
    hedgingSetTag: "USD/ZAR",
  };
  if (!overrides.omitQuad) {
    economicTerms.fxAgreement = overrides.fxAgreement ?? {
      buy: { currency: "USD", amount: "1000.00" },
      sell: { currency: "ZAR", amount: "18520.00" },
    };
  }
  return {
    kind: "FilInstrumentCreated",
    instance: FX_INSTANCE,
    type: "fil:type:fx:spot:otc-vanilla@1.0",
    tenant: "LE-ZA-HOZ-BANK",
    asOf: "2026-06-01T00:00:00.000Z",
    originatingEvent: { eventType: "FxTradeExecuted", eventId: "e1" },
    initialStage: "active",
    economicTerms,
  } as unknown as FilInstanceLifecycleEvent;
}

describe("recon:fx-agreement-quad-integrity", () => {
  test("PASS — fx instance carrying a coherent quad", () => {
    const r = run({ filEvents: [fxInstance()] });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(false);
    expect(r.asserted).toBeGreaterThan(0);
  });

  test("FAIL (negative) — fx instance with NO fxAgreement quad", () => {
    const r = run({ filEvents: [fxInstance({ omitQuad: true })] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail" && v.subject.startsWith("no-quad"))).toBe(
      true,
    );
  });

  test("FAIL (negative) — fx instance with an INCOHERENT quad (wrong notional)", () => {
    const r = run({
      filEvents: [fxInstance({ notional: { currency: "USD", amount: "9999.00" } })],
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.severity === "fail" && v.subject.startsWith("incoherent-quad")),
    ).toBe(true);
  });

  test("VACUITY — empty book is info (flat-bench), fail-closed under requireNonVacuousAnchor", () => {
    const passive = run({ filEvents: [] });
    expect(passive.ok).toBe(true);
    expect(passive.violations.some((v) => v.severity === "info")).toBe(true);

    const strict = run({ filEvents: [], requireNonVacuousAnchor: true });
    expect(strict.ok).toBe(false);
    expect(strict.violations.some((v) => v.severity === "fail")).toBe(true);
  });

  test("SCOPE — non-fx asset classes are skipped (cash carries no FX quad)", () => {
    const cash = {
      kind: "FilInstrumentCreated",
      instance: "fil:inst:LE-ZA-HOZ-BANK:cash-1",
      type: "fil:type:cash:balance:vanilla@1.0",
      tenant: "LE-ZA-HOZ-BANK",
      asOf: "2026-06-03T00:00:00.000Z",
      originatingEvent: { eventType: "FxTradeExecuted", eventId: "e1" },
      initialStage: "active",
      economicTerms: {
        assetClass: "cash",
        notional: { currency: "USD", amount: "1000.00" },
        direction: "long",
        counterpartyId: "CP1",
        nettingSetId: "NS-CP1-USD",
        currency: "USD",
        settlementDate: "2026-06-03",
        originatingInstrument: FX_INSTANCE,
      },
    } as unknown as FilInstanceLifecycleEvent;
    const r = run({ filEvents: [cash] });
    expect(r.violations.some((v) => v.subject.startsWith("no-quad"))).toBe(false);
  });
});
