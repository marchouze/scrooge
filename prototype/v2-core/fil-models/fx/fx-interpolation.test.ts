// v2-core/fil-models/fx/fx-interpolation.test.ts
//
// Unit tests for interpolateCurve.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { Instant } from "../../fil-core/primitives.ts";
import type { MarketDataSlice } from "../../fil-facets/facets.ts";
import { interpolateCurve } from "./shared/fx-interpolation.ts";

function marks(observables: Record<string, number>): MarketDataSlice {
  return { asOf: "2026-06-15T00:00:00.000Z" as Instant, observables };
}

const USD_ZAR_FWD = {
  "USD/ZAR:fwd-points:30d": 100,
  "USD/ZAR:fwd-points:90d": 250,
  "USD/ZAR:fwd-points:180d": 450,
};

describe("interpolateCurve", () => {
  test("exact tenor match returns the tenor value", () => {
    const m = marks(USD_ZAR_FWD);
    const result = interpolateCurve(m, "USD/ZAR:fwd-points:", 90);
    expect(result).toBe(250);
  });

  test("interior interpolation is linear", () => {
    const m = marks(USD_ZAR_FWD);
    // Between 30d (100) and 90d (250): at 60d → 100 + (60-30)/(90-30) × (250-100) = 100 + 75 = 175
    const result = interpolateCurve(m, "USD/ZAR:fwd-points:", 60);
    expect(result).toBeCloseTo(175, 5);
  });

  test("left extrapolation is flat at shortest tenor", () => {
    const m = marks(USD_ZAR_FWD);
    // Below 30d → flat at 100
    const result = interpolateCurve(m, "USD/ZAR:fwd-points:", 7);
    expect(result).toBe(100);
  });

  test("right extrapolation is flat at longest tenor", () => {
    const m = marks(USD_ZAR_FWD);
    // Above 180d → flat at 450
    const result = interpolateCurve(m, "USD/ZAR:fwd-points:", 365);
    expect(result).toBe(450);
  });

  test("empty curve throws fail-closed", () => {
    const m = marks({ "EUR/ZAR:fwd-points:30d": 50 }); // wrong prefix
    expect(() => interpolateCurve(m, "USD/ZAR:fwd-points:", 30)).toThrow(/no curve entries found/);
  });
});
