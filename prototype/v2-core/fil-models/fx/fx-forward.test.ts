// v2-core/fil-models/fx/fx-forward.test.ts
//
// Unit tests for FX Forward Valuable + Performable.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { Instant } from "../../fil-core/primitives.ts";
import type { MarketDataSlice } from "../../fil-facets/facets.ts";
import { fxForwardValuable, fxForwardPerformable } from "./forward/fx-forward-model.ts";
import type { FxForwardPosition } from "./shared/fx-positions.ts";

const ASOF = "2026-06-15T00:00:00.000Z" as Instant;

function marks(observables: Record<string, number>): MarketDataSlice {
  return { asOf: ASOF, observables };
}

const FWD_MARKS = {
  "USD/ZAR": 18.0,
  "USD/ZAR:fwd-points:30d": 0.1,
  "USD/ZAR:fwd-points:90d": 0.3,
  "USD/ZAR:fwd-points:180d": 0.6,
};

const LONG_FWD: FxForwardPosition = {
  kind: "forward",
  currency: "USD",
  signedNotionalMinor: 100_000_00n, // 100,000 USD
  bookedForwardRate: 18.2,
  maturityDate: "2026-09-15",
  remainingDays: 92,
  reporting: "ZAR",
};

describe("FX Forward Valuable", () => {
  test("MTM uses interpolated forward points (not just spot)", () => {
    const valuable = fxForwardValuable(LONG_FWD);
    const rec = valuable.value(marks(FWD_MARKS), ASOF);
    // At 92d: interpolated between 90d (0.3) and 180d (0.6)
    // t = (92-90)/(180-90) = 2/90 ≈ 0.0222; pts = 0.3 + 0.0222×0.3 ≈ 0.3067
    // allInRate ≈ 18.0 + 0.3067 = 18.3067
    // value ≈ 10,000,000 × 18.3067 = 183,067,000 cents (approx)
    expect(rec.value.currency).toBe("ZAR");
    // Verify it differs from pure spot (18.0 → 180,000,000 cents)
    expect(rec.value.minorUnits).toBeGreaterThan(180_000_000n);
  });

  test("valuationMethod is mark-to-market", () => {
    const valuable = fxForwardValuable(LONG_FWD);
    expect(valuable.valuationMethod()).toBe("mark-to-market");
  });

  test("requiredObservables includes both spot and fwd curve ref", () => {
    const valuable = fxForwardValuable(LONG_FWD);
    const obs = valuable.requiredObservables();
    expect(obs.some((o) => o.observableId === "USD/ZAR")).toBe(true);
    expect(obs.some((o) => o.kind === "curve")).toBe(true);
  });

  test("missing spot observable throws", () => {
    const valuable = fxForwardValuable(LONG_FWD);
    expect(() =>
      valuable.value(marks({ "USD/ZAR:fwd-points:90d": 0.3 }), ASOF),
    ).toThrow(/missing spot observable/i);
  });

  test("missing forward curve throws", () => {
    const valuable = fxForwardValuable(LONG_FWD);
    expect(() =>
      valuable.value(marks({ "USD/ZAR": 18.0 }), ASOF),
    ).toThrow(/no curve entries found/i);
  });

  test("at remainingDays=0, MTM converges toward spot (flat left extrapolation)", () => {
    const fwdAt0: FxForwardPosition = { ...LONG_FWD, remainingDays: 0 };
    const valuable = fxForwardValuable(fwdAt0);
    // At 0d, flat-left-extrapolation gives the 30d point value (0.1)
    const rec = valuable.value(marks(FWD_MARKS), ASOF);
    // allInRate = 18.0 + 0.1 = 18.1
    const expected = BigInt(Math.round(10_000_000 * 18.1));
    expect(rec.value.minorUnits).toBe(expected);
  });
});

describe("FX Forward Performable", () => {
  test("carry is positive for long position when forward at premium", () => {
    const perf = fxForwardPerformable(LONG_FWD);
    const carry = perf.carry(marks(FWD_MARKS), ASOF);
    // Forward rate > spot → positive carry for long position
    expect(carry.minorUnits).toBeGreaterThan(0n);
  });

  test("theta ≈ −carry for linear instruments", () => {
    const perf = fxForwardPerformable(LONG_FWD);
    const carry = perf.carry(marks(FWD_MARKS), ASOF);
    const theta = perf.theta(marks(FWD_MARKS), ASOF, LONG_FWD.remainingDays);
    expect(theta.minorUnits).toBe(-carry.minorUnits);
  });

  test("unrealised P&L accounts for forward-point difference", () => {
    const perf = fxForwardPerformable(LONG_FWD);
    const rec = perf.unrealisedPnl(marks(FWD_MARKS), ASOF, 0n);
    // bookedRate = 18.2, marketRate ≈ 18.307, so positive PnL on long
    expect(rec.unrealisedPnl.minorUnits).toBeGreaterThan(0n);
  });
});
