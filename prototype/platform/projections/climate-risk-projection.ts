// platform/projections/climate-risk-projection.ts
//
// Climate-risk RAS metric projection.
//
// Reads the latest ClimateScenarioRun events from the event store (one per
// scenario) and computes the worst-case stress loss metric for Helena's
// risk-appetite-watch handler. This closes the `appetite:climate:guidance-note-1-2024`
// unmeasured gap.
//
// Build-phase posture:
//   No ClimateScenarioRun events exist until the first quarterly run. The
//   projection returns `{ status: 'no-data' }` in this state. This is the
//   correct build-phase response — not a violation; the bank has no live
//   book, so there is nothing to stress.
//
// Live-data posture:
//   Once ClimateScenarioRun events flow (quarterly ticks), the projection
//   derives:
//     worstCaseStressLossPct = max(stressLossZAR / totalExposureZAR) × 100
//   across all scenarios for which the latest run is available.
//
// PA scenario IDs (PA GN 1 of 2024):
//   PA-GN1-2024-ORDERLY     — Orderly transition (1.5°C)
//   PA-GN1-2024-DISORDERLY  — Disorderly transition (~2°C)
//   PA-GN1-2024-HOT-HOUSE   — Hot house world (~4°C)
//
// Authority: D-RAS-CLIMATE-SCENARIO-FRAMEWORK (CEO-approved);
//   PA Guidance Note 1 of 2024; PROC-RISK-CR-01.
// Author: Helena (Chief Risk Officer, governance)

import type { EventStore } from "../event-store/store";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ClimateRiskMetricMeasured {
  readonly status: "measured";
  /** Worst-case stress loss as % of total exposure across all scenarios (0–100) */
  readonly worstCaseStressLossPct: number;
  /** ISO date of the most recent ClimateScenarioRun event */
  readonly latestRunDate: string;
  /** IDs of scenarios included in this metric */
  readonly scenariosRun: readonly string[];
}

export interface ClimateRiskMetricNoData {
  readonly status: "no-data";
  readonly note: string;
}

export type ClimateRiskMetric = ClimateRiskMetricMeasured | ClimateRiskMetricNoData;

// ---------------------------------------------------------------------------
// Internal: payload shape expected from ClimateScenarioRun events
// ---------------------------------------------------------------------------

interface ClimateScenarioRunPayloadRaw {
  scenarioId?: string;
  scenarioName?: string;
  runDate?: string;
  portfolioSnapshot?: {
    totalExposureZAR?: number;
    carbonIntensiveExposureZAR?: number;
    carbonIntensivePct?: number;
  };
  stressLossZAR?: number;
  scenarioHorizonYears?: number;
  authority?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the climate-risk RAS metric from the event store.
 *
 * Reads all ClimateScenarioRun events, keeps the latest per scenarioId
 * (highest `as_of`), and computes `worstCaseStressLossPct`.
 *
 * Returns `{ status: 'no-data' }` when no ClimateScenarioRun events exist —
 * this is the correct build-phase state (no live book, no quarterly run yet).
 *
 * @param store  - the event store to replay from.
 */
export function getClimateRiskMetric(store: EventStore): ClimateRiskMetric {
  // Keep latest run per scenarioId. Map: scenarioId → latest event payload.
  const latestPerScenario = new Map<
    string,
    { payload: ClimateScenarioRunPayloadRaw; asOf: string }
  >();

  for (const e of store.replay({ type: "ClimateScenarioRun" })) {
    const p = (e.payload ?? {}) as ClimateScenarioRunPayloadRaw;
    const scenarioId = p.scenarioId;
    if (!scenarioId) continue;

    const existing = latestPerScenario.get(scenarioId);
    // Keep the entry with the later as_of (ISO string comparison works for dates)
    if (!existing || e.as_of > existing.asOf) {
      latestPerScenario.set(scenarioId, { payload: p, asOf: e.as_of });
    }
  }

  if (latestPerScenario.size === 0) {
    return {
      status: "no-data",
      note: "No ClimateScenarioRun events yet — first run due at next quarterly tick. Build-phase posture: no live book, no portfolio to stress.",
    };
  }

  // Compute worst-case stress loss pct across all scenarios
  let worstCaseStressLossPct = 0;
  let latestRunDate = "";
  const scenariosRun: string[] = [];

  for (const [scenarioId, { payload, asOf }] of latestPerScenario) {
    const totalExposure = payload.portfolioSnapshot?.totalExposureZAR ?? 0;
    const stressLoss = payload.stressLossZAR ?? 0;

    scenariosRun.push(scenarioId);

    // Update latest run date
    if (!latestRunDate || asOf > latestRunDate) {
      latestRunDate = asOf;
    }

    // Compute this scenario's stress loss pct
    if (totalExposure > 0) {
      const stressLossPct = (stressLoss / totalExposure) * 100;
      if (stressLossPct > worstCaseStressLossPct) {
        worstCaseStressLossPct = stressLossPct;
      }
    }
  }

  return {
    status: "measured",
    worstCaseStressLossPct,
    latestRunDate,
    scenariosRun: scenariosRun.sort(),
  };
}
