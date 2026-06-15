// v2-core/fil-models/fx/fx-ndf.test.ts
//
// Unit tests for FX NDF Valuable + Performable.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { Instant } from "../../fil-core/primitives.ts";
import type { MarketDataSlice } from "../../fil-facets/facets.ts";
import { fxNdfValuable, fxNdfPerformable } from "./ndf/fx-ndf-model.ts";
import type { FxNdfPosition } from "./shared/fx-positions.ts";

const ASOF = "2026-06-15T00:00:00.000Z" as Instant;

function marks(observables: Record<string, number>): MarketDataSlice {
  return { asOf: ASOF, observables };
}

const NDF_MARKS = {
  "USD/ZAR": 18.0, // spot (used in carry)
  "USD/ZAR:ndf-fwd:30d": 18.1,
  "USD/ZAR:ndf-fwd:90d": 18.3,
  "USD/ZAR:ndf-fwd:180d": 18.6,
};

const PRE_FIXING_NDF: FxNdfPosition = {
  kind: "ndf",
  currency: "USD",
  signedNotionalMinor: 100_000_00n, // 100,000 USD
  bookedNdfRate: 18.2,
  fixingDate: "2026-09-12",
  settlementDate: "2026-09-15",
  settlementCurrency: "ZAR",
  remainingDays: 90,
  reporting: "ZAR",
};

describe("FX NDF Valuable — pre-fixing", () => {
  test("value uses interpolated NDF curve", () => {
    const valuable = fxNdfValuable(PRE_FIXING_NDF);
    const rec = valuable.value(marks(NDF_MARKS), ASOF);
    // At exactly 90d: ndfRate = 18.3, netRate = 18.3 - 18.2 = 0.1
    // value = 10,000,000 cents × 0.1 = 1,000,000 cents
    expect(rec.value.currency).toBe("ZAR");
    expect(rec.value.minorUnits).toBe(1_000_000n);
  });

  test("valuationMethod is mark-to-model", () => {
    const valuable = fxNdfValuable(PRE_FIXING_NDF);
    expect(valuable.valuationMethod()).toBe("mark-to-model");
  });

  test("requiredObservables includes NDF curve ref", () => {
    const valuable = fxNdfValuable(PRE_FIXING_NDF);
    const obs = valuable.requiredObservables();
    expect(obs.some((o) => o.kind === "curve")).toBe(true);
  });

  test("missing NDF curve throws", () => {
    const valuable = fxNdfValuable(PRE_FIXING_NDF);
    expect(() => valuable.value(marks({ "USD/ZAR": 18.0 }), ASOF)).toThrow(
      /no curve entries found/i,
    );
  });
});

describe("FX NDF Valuable — post-fixing", () => {
  const POST_FIXING_NDF: FxNdfPosition = {
    ...PRE_FIXING_NDF,
    fixingRate: 18.4, // crystallised fixing rate
  };

  test("uses fixing rate, not curve (even if curve present in marks)", () => {
    const valuable = fxNdfValuable(POST_FIXING_NDF);
    const rec = valuable.value(marks(NDF_MARKS), ASOF);
    // fixingRate = 18.4, bookedRate = 18.2, netRate = 0.2
    // value = 10,000,000 × 0.2 = 2,000,000 cents
    expect(rec.value.minorUnits).toBe(2_000_000n);
  });

  test("requiredObservables is empty (crystallised)", () => {
    const valuable = fxNdfValuable(POST_FIXING_NDF);
    const obs = valuable.requiredObservables();
    expect(obs.length).toBe(0);
  });
});

describe("FX NDF Performable", () => {
  test("P&L = 0 when booked at current NDF forward rate", () => {
    // Book at exact market rate → zero unrealised PnL
    const atMarket: FxNdfPosition = { ...PRE_FIXING_NDF, bookedNdfRate: 18.3 };
    const perf = fxNdfPerformable(atMarket);
    const rec = perf.unrealisedPnl(marks(NDF_MARKS), ASOF, 0n);
    expect(rec.unrealisedPnl.minorUnits).toBe(0n);
  });
});
