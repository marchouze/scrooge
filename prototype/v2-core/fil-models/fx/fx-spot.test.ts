// v2-core/fil-models/fx/fx-spot.test.ts
//
// Unit tests for FX spot Valuable + Performable.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { Instant } from "../../fil-core/primitives.ts";
import type { MarketDataSlice } from "../../fil-facets/facets.ts";
import type { FxSpotPosition } from "./shared/fx-positions.ts";
import { fxSpotPerformable, fxSpotValuable } from "./spot/fx-spot-model.ts";

const ASOF = "2026-06-15T00:00:00.000Z" as Instant;

function marks(observables: Record<string, number>): MarketDataSlice {
  return { asOf: ASOF, observables };
}

const LONG_USD: FxSpotPosition = {
  kind: "spot",
  currency: "USD",
  signedNotional: "100000.00",
  bookedSpotRate: 18.0,
  settlementDate: "2026-06-17",
  reporting: "ZAR",
};

describe("FX Spot Valuable", () => {
  test("MTM value = notional × spot rate", () => {
    const valuable = fxSpotValuable(LONG_USD);
    const rec = valuable.value(marks({ "USD/ZAR": 18.5 }), ASOF);
    // 100,000 × 18.5 = 1,850,000 ZAR
    expect(rec.value.currency).toBe("ZAR");
    expect(Number(rec.value.amount)).toBe(1850000);
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
    const rec = perf.unrealisedPnl(marks({ "USD/ZAR": 19.0 }), ASOF, {
      currency: "ZAR",
      amount: "0",
    });
    // MTM = 1,900,000 ZAR; book = 1,800,000 ZAR; PnL = +100,000 ZAR
    expect(Number(rec.unrealisedPnl.amount)).toBeGreaterThan(0);
  });

  test("unrealised P&L negative when spot < booked rate (long position)", () => {
    const perf = fxSpotPerformable(LONG_USD);
    const rec = perf.unrealisedPnl(marks({ "USD/ZAR": 17.0 }), ASOF, {
      currency: "ZAR",
      amount: "0",
    });
    expect(Number(rec.unrealisedPnl.amount)).toBeLessThan(0);
  });

  test("carry is zero for spot", () => {
    const perf = fxSpotPerformable(LONG_USD);
    const carry = perf.carry(marks({ "USD/ZAR": 18.5 }), ASOF);
    expect(Number(carry.amount)).toBe(0);
  });

  test("theta is zero for spot", () => {
    const perf = fxSpotPerformable(LONG_USD);
    const theta = perf.theta(marks({ "USD/ZAR": 18.5 }), ASOF, 0);
    expect(Number(theta.amount)).toBe(0);
  });

  test("missing spot observable throws in unrealisedPnl", () => {
    const perf = fxSpotPerformable(LONG_USD);
    expect(() => perf.unrealisedPnl(marks({}), ASOF, { currency: "ZAR", amount: "0" })).toThrow(
      /missing.*spot observable/i,
    );
  });
});
