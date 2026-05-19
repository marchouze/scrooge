// platform/projections/climate-risk-projection.test.ts
//
// Unit tests for the climate-risk projection.
//
// Tests fold ClimateScenarioRun events through an isolated EventStore and
// assert the projection's output shape and values.
//
// Authority: D-RAS-CLIMATE-SCENARIO-FRAMEWORK (CEO-approved 2026-05-19).
// Author: Helena (Chief Risk Officer, governance)

import { describe, expect, it } from "bun:test";
import { newEventId } from "../core/types";
import { EventStore } from "../event-store/store";
import { getClimateRiskMetric } from "./climate-risk-projection";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeStore(): EventStore {
  // Ephemeral in-memory SQLite store (no path arg = in-memory).
  return new EventStore();
}

/** Append a ClimateScenarioRun event to the store */
function appendScenarioRun(
  store: EventStore,
  overrides: {
    scenarioId: string;
    runDate: string;
    asOf?: string;
    totalExposureZAR?: number;
    carbonIntensiveExposureZAR?: number;
    carbonIntensivePct?: number;
    stressLossZAR?: number;
    scenarioHorizonYears?: number;
  },
): void {
  const totalExposureZAR = overrides.totalExposureZAR ?? 10_000_000;
  const carbonIntensiveExposureZAR = overrides.carbonIntensiveExposureZAR ?? 2_000_000;
  const carbonIntensivePct = overrides.carbonIntensivePct ?? 20;
  const stressLossZAR = overrides.stressLossZAR ?? 300_000;

  store.append({
    event_id: newEventId(),
    type: "ClimateScenarioRun",
    as_of: overrides.asOf ?? overrides.runDate,
    entity: "BANK-ZA-001",
    actor: { type: "service", id: "agent:helena:climate-risk-measurement" },
    citations: ["D-RAS-CLIMATE-SCENARIO-FRAMEWORK", "PA-GN1-2024"],
    payload: {
      scenarioId: overrides.scenarioId,
      scenarioName: `Scenario ${overrides.scenarioId}`,
      runDate: overrides.runDate,
      portfolioSnapshot: {
        totalExposureZAR,
        carbonIntensiveExposureZAR,
        carbonIntensivePct,
      },
      stressLossZAR,
      scenarioHorizonYears: overrides.scenarioHorizonYears ?? 10,
      authority: "D-RAS-CLIMATE-SCENARIO-FRAMEWORK",
    },
  });
}

// ---------------------------------------------------------------------------
// Tests: no-data state (build phase / empty store)
// ---------------------------------------------------------------------------

describe("getClimateRiskMetric — no-data state", () => {
  it("returns no-data when the store is empty", () => {
    const store = makeStore();
    const result = getClimateRiskMetric(store);
    expect(result.status).toBe("no-data");
    expect((result as { note: string }).note).toContain("No ClimateScenarioRun events yet");
  });

  it("returns no-data when only non-climate events exist", () => {
    const store = makeStore();
    // Append an unrelated event — should not affect climate metric
    store.append({
      event_id: newEventId(),
      type: "RiskRaised",
      as_of: "2026-07-01",
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:helena" },
      citations: ["RAS-FRAMEWORK-2026-05-06"],
      payload: {
        riskId: "risk-001",
        raisedBy: "Helena",
        description: "Test risk",
        category: "climate",
        severity: "low",
        likelihood: "unlikely",
        mitigation: "none",
      },
    });
    const result = getClimateRiskMetric(store);
    expect(result.status).toBe("no-data");
  });
});

// ---------------------------------------------------------------------------
// Tests: single scenario run
// ---------------------------------------------------------------------------

describe("getClimateRiskMetric — single scenario", () => {
  it("returns measured status with correct stress loss pct for one scenario", () => {
    const store = makeStore();
    // totalExposure = 10m, stressLoss = 1m → stressLossPct = 10%
    appendScenarioRun(store, {
      scenarioId: "PA-GN1-2024-ORDERLY",
      runDate: "2026-07-01",
      totalExposureZAR: 10_000_000,
      stressLossZAR: 1_000_000,
    });

    const result = getClimateRiskMetric(store);
    expect(result.status).toBe("measured");
    const measured = result as import("./climate-risk-projection").ClimateRiskMetricMeasured;
    expect(measured.worstCaseStressLossPct).toBeCloseTo(10, 5);
    expect(measured.latestRunDate).toBe("2026-07-01");
    expect(measured.scenariosRun).toEqual(["PA-GN1-2024-ORDERLY"]);
  });

  it("handles zero total exposure gracefully (no division by zero)", () => {
    const store = makeStore();
    appendScenarioRun(store, {
      scenarioId: "PA-GN1-2024-ORDERLY",
      runDate: "2026-07-01",
      totalExposureZAR: 0,
      stressLossZAR: 0,
    });

    const result = getClimateRiskMetric(store);
    expect(result.status).toBe("measured");
    const measured = result as import("./climate-risk-projection").ClimateRiskMetricMeasured;
    // 0 / 0 — stress loss pct stays at 0 (no positive stress possible with 0 exposure)
    expect(measured.worstCaseStressLossPct).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: three PA scenarios — worst-case selection
// ---------------------------------------------------------------------------

describe("getClimateRiskMetric — three PA scenarios", () => {
  it("selects the worst-case stress loss pct across all three PA scenarios", () => {
    const store = makeStore();
    const totalExposure = 100_000_000; // R100m

    // Orderly (1.5°C): 5% stress on carbon-intensive (20% of portfolio)
    // → 1% of total exposure
    appendScenarioRun(store, {
      scenarioId: "PA-GN1-2024-ORDERLY",
      runDate: "2026-07-01",
      totalExposureZAR: totalExposure,
      stressLossZAR: 1_000_000, // 1%
    });

    // Disorderly (~2°C): 15% stress → 3% of total exposure
    appendScenarioRun(store, {
      scenarioId: "PA-GN1-2024-DISORDERLY",
      runDate: "2026-07-01",
      totalExposureZAR: totalExposure,
      stressLossZAR: 3_000_000, // 3%
    });

    // Hot house (~4°C): 35% stress → 7% of total exposure (worst case)
    appendScenarioRun(store, {
      scenarioId: "PA-GN1-2024-HOT-HOUSE",
      runDate: "2026-07-01",
      totalExposureZAR: totalExposure,
      stressLossZAR: 7_000_000, // 7%
    });

    const result = getClimateRiskMetric(store);
    expect(result.status).toBe("measured");
    const measured = result as import("./climate-risk-projection").ClimateRiskMetricMeasured;
    expect(measured.worstCaseStressLossPct).toBeCloseTo(7, 5);
    expect(measured.latestRunDate).toBe("2026-07-01");
    expect(measured.scenariosRun).toHaveLength(3);
    expect(measured.scenariosRun).toContain("PA-GN1-2024-ORDERLY");
    expect(measured.scenariosRun).toContain("PA-GN1-2024-DISORDERLY");
    expect(measured.scenariosRun).toContain("PA-GN1-2024-HOT-HOUSE");
  });
});

// ---------------------------------------------------------------------------
// Tests: latest-wins-per-scenario behaviour
// ---------------------------------------------------------------------------

describe("getClimateRiskMetric — latest-wins-per-scenario", () => {
  it("uses the latest ClimateScenarioRun event per scenarioId (Q2 overrides Q1)", () => {
    const store = makeStore();

    // Q1 run: 5% stress loss
    appendScenarioRun(store, {
      scenarioId: "PA-GN1-2024-HOT-HOUSE",
      runDate: "2026-04-01",
      asOf: "2026-04-01",
      totalExposureZAR: 100_000_000,
      stressLossZAR: 5_000_000, // 5%
    });

    // Q2 run: portfolio grew; stress loss updated to 8%
    appendScenarioRun(store, {
      scenarioId: "PA-GN1-2024-HOT-HOUSE",
      runDate: "2026-07-01",
      asOf: "2026-07-01",
      totalExposureZAR: 200_000_000,
      stressLossZAR: 16_000_000, // 8%
    });

    const result = getClimateRiskMetric(store);
    expect(result.status).toBe("measured");
    const measured = result as import("./climate-risk-projection").ClimateRiskMetricMeasured;
    // Should use Q2 value (8%), not Q1 (5%)
    expect(measured.worstCaseStressLossPct).toBeCloseTo(8, 5);
    expect(measured.latestRunDate).toBe("2026-07-01");
    // Only one scenario in the set
    expect(measured.scenariosRun).toHaveLength(1);
  });

  it("tracks latest run date from the most recent event across all scenarios", () => {
    const store = makeStore();

    appendScenarioRun(store, {
      scenarioId: "PA-GN1-2024-ORDERLY",
      runDate: "2026-04-01",
      asOf: "2026-04-01",
      totalExposureZAR: 50_000_000,
      stressLossZAR: 500_000,
    });

    appendScenarioRun(store, {
      scenarioId: "PA-GN1-2024-HOT-HOUSE",
      runDate: "2026-07-01",
      asOf: "2026-07-01",
      totalExposureZAR: 50_000_000,
      stressLossZAR: 3_000_000,
    });

    const result = getClimateRiskMetric(store);
    expect(result.status).toBe("measured");
    const measured = result as import("./climate-risk-projection").ClimateRiskMetricMeasured;
    // Latest is the Q2 date
    expect(measured.latestRunDate).toBe("2026-07-01");
  });
});
