// v2-core/fil-models/fx/fx-spot.test.ts
//
// Unit tests for FX spot Valuable + Performable.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { Instant } from "../../fil-core/primitives.ts";
import type { MarketDataSlice } from "../../fil-facets/facets.ts";
import { fxSpotValuable, fxSpotPerformable } from "./spot/fx-spot-model.ts";
import type { FxSpotPosition } from "./shared/fx-positions.ts";

const ASOF = "2026-06-15T00:00:00.000Z" as Instant;

function marks(observables: Record<string, number>): MarketDataSlice {
  return { asOf: ASOF, observables };
}

const LONG_USD: FxSpotPosition = {
  kind: "spot",
  currency: "USD",
  signedNotionalMinor: 100_000_00n, // 100,000 USD in cents
  bookedSpotRate: 18.0,
  settlementDate: "2026-06-17",
  reporting: "ZAR",
};

describe("FX Spot Valuable", () => {
  test("MTM value = notional × spot rate", () => {
    const valuable = fxSpotValuable(LONG_USD);
    const rec = valuable.value(marks({ "USD/ZAR": 18.5 }), ASOF);
    // 100,000 × 100 (cents) × 18.5 = 185,000 ZAR = 18,500,000 cents
    expect(rec.value.currency).toBe("ZAR");
    expect(rec.value.minorUnits).toBe(1_850_000_00n);
  });

  test("valuationMethod is mark-to-market", () => {
    const valuable = fxSpotValuable(LONG_USD);
    expect(valuable.valuationMethod()).toBe("mark-to-market");
  });

  test("requiredObservables includes spot pair", () => {
    const valuable = fxSpotValuable(LONG_USD);
    const obs = valuable.requiredObservables();
    expect(obs.some((o) => o.observableId === "USD/ZAR")).toBe(true);
  });

  test("missing spot observable throws", () => {
    const valuable = fxSpotValuable(LONG_USD);
    expect(() => valuable.value(marks({}), ASOF)).toThrow(/missing.*spot observable.*USD\/ZAR/i);
  });
});

describe("FX Spot Performable", () => {
  test("unrealised P&L positive when spot > booked rate (long position)", () => {
    const perf = fxSpotPerformable(LONG_USD);
    const rec = perf.unrealisedPnl(marks({ "USD/ZAR": 19.0 }), ASOF, 0n);
    // MTM = 190,000,000 cents; book = 180,000,000 cents; PnL = +10,000,000 cents
    expect(rec.unrealisedPnl.minorUnits).toBeGreaterThan(0n);
  });

  test("unrealised P&L negative when spot < booked rate (long position)", () => {
    const perf = fxSpotPerformable(LONG_USD);
    const rec = perf.unrealisedPnl(marks({ "USD/ZAR": 17.0 }), ASOF, 0n);
    expect(rec.unrealisedPnl.minorUnits).toBeLessThan(0n);
  });

  test("carry is zero for spot", () => {
    const perf = fxSpotPerformable(LONG_USD);
    const carry = perf.carry(marks({ "USD/ZAR": 18.5 }), ASOF);
    expect(carry.minorUnits).toBe(0n);
  });

  test("theta is zero for spot", () => {
    const perf = fxSpotPerformable(LONG_USD);
    const theta = perf.theta(marks({ "USD/ZAR": 18.5 }), ASOF, 0);
    expect(theta.minorUnits).toBe(0n);
  });

  test("missing spot observable throws in unrealisedPnl", () => {
    const perf = fxSpotPerformable(LONG_USD);
    expect(() => perf.unrealisedPnl(marks({}), ASOF, 0n)).toThrow(/missing.*spot observable/i);
  });
});
