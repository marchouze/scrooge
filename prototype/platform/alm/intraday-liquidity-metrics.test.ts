// platform/alm/intraday-liquidity-metrics.test.ts
//
// Guardrails for the BCBS 248 seven-tool computation
// (WS-TREASURER-WAVE1-SUBSTRATE):
//
//   - Build-phase zero-position posture: zero projection → measured zeros /
//     no-flows, structural N/A for tools 5–6, null peak usage, overall
//     "no-positions". No synthetic values (Principle 1).
//   - Live-flows fold: tool 1 peak usage, tool 3 gross totals, tool 7
//     throughput, and the headline `peakUsagePctOfAvailable` all derive
//     correctly from a synthetic projection.
//   - Tool 4: time-specific obligations totalled from the feed.
//
// Authority: D-TREASURER-WAVE1-SUBSTRATE; BCBS 248 §§16–22;
//   LRM Policy v1 §4.2.
// Author: Ravi (Treasury and ALM engineer, engineering).

import { describe, expect, it } from "bun:test";

import { computeIntradayLiquidityMetrics } from "./intraday-liquidity-metrics";
import {
  type IntradayStressResult,
  type IntradayWindowResult,
  SETTLEMENT_WINDOWS,
} from "./intraday-stress";

const AS_OF = "2026-06-11T06:00:00.000Z";

/** Build a synthetic projection from per-window (inflow, outflow) pairs. */
function syntheticProjection(
  startingHQLAZar: number,
  flows: ReadonlyArray<readonly [number, number]>,
): IntradayStressResult {
  let cumulative = 0;
  const bau: IntradayWindowResult[] = SETTLEMENT_WINDOWS.map((windowLabel, i) => {
    const [inflowZar, outflowZar] = flows[i] ?? [0, 0];
    cumulative += inflowZar - outflowZar;
    return {
      windowLabel,
      scenario: "BAU",
      inflowZar,
      outflowZar,
      cumulativeNetZar: cumulative,
      startingHQLAZar,
      projectedHQLAZar: startingHQLAZar + cumulative,
      floorZar: 50_000_000,
      status: startingHQLAZar === 0 ? "no-positions" : "green",
      currency: "ZAR",
    };
  });
  return {
    asOf: AS_OF,
    bau,
    stress: bau.map((w) => ({ ...w, scenario: "stress" })),
    startingHQLAZar,
    floorZar: 50_000_000,
    currency: "ZAR",
  };
}

describe("computeIntradayLiquidityMetrics — build-phase zero-position posture", () => {
  const result = computeIntradayLiquidityMetrics(AS_OF, {
    projection: syntheticProjection(0, []),
  });

  it("reports overall no-positions with null peak usage", () => {
    expect(result.overallStatus).toBe("no-positions");
    expect(result.peakUsagePctOfAvailable).toBeNull();
  });

  it("returns exactly seven tools in BCBS 248 order", () => {
    expect(result.metrics.map((m) => m.toolNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("measured tools report true zeros (no synthetic values)", () => {
    const byTool = new Map(result.metrics.map((m) => [m.tool, m]));
    expect(byTool.get("daily-max-usage")?.value).toBe(0);
    expect(byTool.get("available-at-start")?.value).toBe(0);
    expect(byTool.get("total-payments")?.value).toBe(0);
    expect(byTool.get("time-specific-obligations")?.value).toBe(0);
  });

  it("tools 5 and 6 are structurally not-applicable with reasons", () => {
    for (const tool of ["customer-payments-on-behalf", "intraday-credit-lines"] as const) {
      const m = result.metrics.find((x) => x.tool === tool);
      expect(m?.status).toBe("not-applicable");
      expect(m?.value).toBeNull();
      expect(m?.reason).toBeDefined();
      expect(m?.reason?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("throughput is no-flows when the day has zero outflows", () => {
    const m = result.metrics.find((x) => x.tool === "throughput");
    expect(m?.status).toBe("no-flows");
    expect(m?.value).toBeNull();
    expect(result.throughputByWindow.every((w) => w.cumulativeOutflowPct === null)).toBe(true);
  });
});

describe("computeIntradayLiquidityMetrics — live flows", () => {
  // 100m HQLA at start; outflows 60m then 30m, inflow 40m at 15:00.
  const projection = syntheticProjection(100_000_000, [
    [0, 60_000_000],
    [0, 30_000_000],
    [40_000_000, 0],
    [0, 0],
  ]);
  const result = computeIntradayLiquidityMetrics(AS_OF, { projection });

  it("tool 1 — daily max usage is the peak net cumulative outflow", () => {
    // Cumulative net: -60m, -90m, -50m, -50m → peak usage 90m.
    const m = result.metrics.find((x) => x.tool === "daily-max-usage");
    expect(m?.value).toBe(90_000_000);
    expect(m?.status).toBe("measured");
  });

  it("tool 2 — available at start = HQLA buffer (+ undrawn credit lines)", () => {
    const m = result.metrics.find((x) => x.tool === "available-at-start");
    expect(m?.value).toBe(100_000_000);
  });

  it("tool 3 — total payments = gross sent + gross received", () => {
    const m = result.metrics.find((x) => x.tool === "total-payments");
    expect(m?.value).toBe(130_000_000);
  });

  it("tool 7 — throughput folds cumulative outflow share by window", () => {
    // Outflows 60m / 30m / 0 / 0 of 90m total → 66.67%, 100%, 100%, 100%.
    const pcts = result.throughputByWindow.map((w) => w.cumulativeOutflowPct);
    expect(pcts[0]).toBeCloseTo(66.6667, 3);
    expect(pcts[1]).toBe(100);
    expect(pcts[3]).toBe(100);
    const m = result.metrics.find((x) => x.tool === "throughput");
    expect(m?.value).toBe(100);
    expect(m?.status).toBe("measured");
  });

  it("headline peak usage % of available feeds the §4.5 stress rule", () => {
    expect(result.peakUsagePctOfAvailable).toBeCloseTo(90, 5);
    expect(result.overallStatus).toBe("measured");
  });

  it("tool 4 — time-specific obligations totalled from the feed", () => {
    const withObligations = computeIntradayLiquidityMetrics(AS_OF, {
      projection,
      timeSpecificObligations: [
        { obligationRef: "BSV-CUTOFF-1", deadline: "2026-06-11T10:00:00.000Z", requiredZar: 5e6 },
        { obligationRef: "MT202COV-1", deadline: "2026-06-11T13:00:00.000Z", requiredZar: 7e6 },
      ],
    });
    const m = withObligations.metrics.find((x) => x.tool === "time-specific-obligations");
    expect(m?.value).toBe(12_000_000);
    expect(m?.status).toBe("measured");
  });

  it("undrawn intraday credit lines extend tool 2 availability", () => {
    const withCredit = computeIntradayLiquidityMetrics(AS_OF, {
      projection,
      undrawnIntradayCreditLinesZar: 50_000_000,
    });
    const m = withCredit.metrics.find((x) => x.tool === "available-at-start");
    expect(m?.value).toBe(150_000_000);
    expect(withCredit.peakUsagePctOfAvailable).toBeCloseTo(60, 5);
  });
});
