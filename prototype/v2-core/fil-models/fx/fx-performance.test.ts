// v2-core/fil-models/fx/fx-performance.test.ts
//
// Unit tests for FX performance metrics registration and behaviour.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import { MetricRegistry } from "../../fil-attribution/metric.ts";
import type { Instant } from "../../fil-core/primitives.ts";
import type { MarketDataSlice } from "../../fil-facets/facets.ts";
import type { FilInstanceUrn } from "../../fil-core/urn.ts";
import {
  registerFxPerformanceMetrics,
  FX_UNREALISED_PNL_METRIC_ID,
  FX_CARRY_METRIC_ID,
  FX_DELTA_EXPOSURE_METRIC_ID,
} from "./performance/fx-performance-metrics.ts";
import { fxSpotPerformable, fxSpotValuable } from "./spot/fx-spot-model.ts";
import type { FxSpotPosition } from "./shared/fx-positions.ts";

const ASOF = "2026-06-15T00:00:00.000Z" as Instant;

function marks(observables: Record<string, number>): MarketDataSlice {
  return { asOf: ASOF, observables };
}

const SPOT_POS: FxSpotPosition = {
  kind: "spot",
  currency: "USD",
  signedNotionalMinor: 100_000_00n,
  bookedSpotRate: 18.0,
  settlementDate: "2026-06-17",
  reporting: "ZAR",
};

describe("registerFxPerformanceMetrics", () => {
  test("registers exactly 3 metrics in a fresh registry", () => {
    const registry = new MetricRegistry();
    registerFxPerformanceMetrics(registry);
    expect(registry.size).toBe(3);
    expect(registry.has(FX_UNREALISED_PNL_METRIC_ID)).toBe(true);
    expect(registry.has(FX_CARRY_METRIC_ID)).toBe(true);
    expect(registry.has(FX_DELTA_EXPOSURE_METRIC_ID)).toBe(true);
  });

  test("duplicate registration throws (fail-loud)", () => {
    const registry = new MetricRegistry();
    registerFxPerformanceMetrics(registry);
    expect(() => registerFxPerformanceMetrics(registry)).toThrow(/already registered/i);
  });
});

describe("fx-carry metric on spot position", () => {
  test("returns 0 carry for a spot position member", () => {
    const registry = new MetricRegistry();
    registerFxPerformanceMetrics(registry);
    const carryMetric = registry.get(FX_CARRY_METRIC_ID);
    if (!carryMetric) throw new Error("fx-carry metric not registered");

    const member = {
      instanceUrn: "fil:inst:LE-ZA-HOZ-BANK:spot-001" as FilInstanceUrn,
      stage: "active" as const,
      facets: {
        Performable: fxSpotPerformable(SPOT_POS),
        Valuable: fxSpotValuable(SPOT_POS),
      },
    };

    const result = carryMetric.evaluate(
      [member],
      marks({ "USD/ZAR": 18.5 }),
      ASOF,
    ) as { currency: string; minorUnits: bigint };
    expect(result.minorUnits).toBe(0n);
  });
});
