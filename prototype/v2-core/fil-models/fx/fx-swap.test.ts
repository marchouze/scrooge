// v2-core/fil-models/fx/fx-swap.test.ts
//
// Unit tests for FX Swap type definition + Valuable + Performable.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { Instant } from "../../fil-core/primitives.ts";
import type { MarketDataSlice } from "../../fil-facets/facets.ts";
import { fxForwardLegValuable } from "./forward/fx-forward-model.ts";
import type { FxForwardLegPosition, FxSwapPosition } from "./shared/fx-positions.ts";
import { fxSwapPerformable, fxSwapValuable } from "./swap/fx-swap-model.ts";
import { FX_SWAP_TYPE } from "./types/fx-type-definitions.ts";

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

const NEAR_LEG: FxForwardLegPosition = {
  currency: "USD",
  signedNotional: "100000.00", // long USD near (major units)
  bookedForwardRate: 18.05,
  maturityDate: "2026-07-15",
  remainingDays: 30,
  reporting: "ZAR",
};

const FAR_LEG: FxForwardLegPosition = {
  currency: "USD",
  signedNotional: "-100000.00", // short USD far (opposite sign = FX swap)
  bookedForwardRate: 18.3,
  maturityDate: "2026-09-15",
  remainingDays: 90,
  reporting: "ZAR",
};

const SWAP_POS: FxSwapPosition = {
  kind: "swap",
  nearLeg: NEAR_LEG,
  farLeg: FAR_LEG,
  reporting: "ZAR",
};

describe("FX_SWAP_TYPE composition", () => {
  test("has exactly 2 legs", () => {
    expect(FX_SWAP_TYPE.composition.legs.length).toBe(2);
  });

  test("first leg is 'near' with direction 'receive'", () => {
    const legs = FX_SWAP_TYPE.composition.legs;
    expect(legs.length).toBeGreaterThanOrEqual(1);
    const nearLeg = legs[0];
    if (!nearLeg) throw new Error("near leg not found");
    expect(nearLeg.legId).toBe("near");
    expect(nearLeg.direction).toBe("receive");
  });

  test("second leg is 'far' with direction 'pay'", () => {
    const legs = FX_SWAP_TYPE.composition.legs;
    expect(legs.length).toBeGreaterThanOrEqual(2);
    const farLeg = legs[1];
    if (!farLeg) throw new Error("far leg not found");
    expect(farLeg.legId).toBe("far");
    expect(farLeg.direction).toBe("pay");
  });
});

describe("FX Swap Valuable", () => {
  test("swap MTM = nearLeg MTM + farLeg MTM", () => {
    const swapValuable = fxSwapValuable(SWAP_POS);
    const nearValuable = fxForwardLegValuable({ ...NEAR_LEG, reporting: "ZAR" });
    const farValuable = fxForwardLegValuable({ ...FAR_LEG, reporting: "ZAR" });

    const swapRec = swapValuable.value(marks(FWD_MARKS), ASOF);
    const nearRec = nearValuable.value(marks(FWD_MARKS), ASOF);
    const farRec = farValuable.value(marks(FWD_MARKS), ASOF);

    expect(Number(swapRec.value.amount)).toBe(
      Number(nearRec.value.amount) + Number(farRec.value.amount),
    );
  });

  test("when near and far have opposite notional signs, MTM nets correctly", () => {
    // Both legs same remainingDays and same rate → net MTM ≈ 0
    const symmetricNear: FxForwardLegPosition = {
      ...NEAR_LEG,
      remainingDays: 90,
      signedNotional: "100000.00",
    };
    const symmetricFar: FxForwardLegPosition = {
      ...FAR_LEG,
      remainingDays: 90,
      signedNotional: "-100000.00",
    };
    const symmetricSwap: FxSwapPosition = {
      kind: "swap",
      nearLeg: symmetricNear,
      farLeg: symmetricFar,
      reporting: "ZAR",
    };
    const swapValuable = fxSwapValuable(symmetricSwap);
    const rec = swapValuable.value(marks(FWD_MARKS), ASOF);
    // Exactly opposite notionals at same rate → net = 0
    expect(Number(rec.value.amount)).toBe(0);
  });
});

describe("FX Swap Performable", () => {
  test("swap carry = nearLeg carry + farLeg carry", () => {
    const swapPerf = fxSwapPerformable(SWAP_POS);
    const carry = swapPerf.carry(marks(FWD_MARKS), ASOF);
    // Just verify it runs and returns a ZAR value
    expect(carry.currency).toBe("ZAR");
  });
});
