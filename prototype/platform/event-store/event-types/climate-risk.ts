// platform/event-store/event-types/climate-risk.ts
//
// Climate-risk domain event-payload schemas.
//
// Covers:
//   - ClimateScenarioRun  — quarterly PA GN 1 of 2024 scenario stress run
//   - ClimateExposureRevalued — daily proxy climate VaR
//
// Authority: D-RAS-CLIMATE-SCENARIO-FRAMEWORK (CEO-approved);
//   PA Guidance Note 1 of 2024; PROC-RISK-CR-01.
//
// Scenario IDs map to the three PA scenario pathways:
//   PA-GN1-2024-ORDERLY     — Orderly transition (1.5°C)
//   PA-GN1-2024-DISORDERLY  — Disorderly transition (~2°C)
//   PA-GN1-2024-HOT-HOUSE   — Hot house world (~4°C)
//
// Author: Helena (Chief Risk Officer, governance)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// ClimateScenarioRun
// ---------------------------------------------------------------------------
//
// Emitted once per scenario per quarterly run. Three events per full run —
// one per PA GN 1 of 2024 scenario pathway. The projection reads the latest
// ClimateScenarioRun event per scenarioId to compute `worstCaseStressLossPct`.

export const climateScenarioRunPayloadSchema = z.object({
  /** Stable scenario identifier — maps to a PA GN 1 of 2024 pathway.
   *  e.g. "PA-GN1-2024-ORDERLY" | "PA-GN1-2024-DISORDERLY" | "PA-GN1-2024-HOT-HOUSE" */
  scenarioId: z.string().min(1),
  /** Human-readable scenario name, e.g. "Orderly transition (1.5°C)" */
  scenarioName: z.string().min(1),
  /** ISO date of the run, e.g. "2026-07-01" */
  runDate: z.string().min(1),
  /** Portfolio snapshot at the time of the run */
  portfolioSnapshot: z.object({
    /** Total trading-book notional exposure in ZAR */
    totalExposureZAR: z.number().nonnegative(),
    /** Subset of total exposure in carbon-intensive sectors (energy, mining, heavy industry, aviation, shipping) */
    carbonIntensiveExposureZAR: z.number().nonnegative(),
    /** carbonIntensiveExposureZAR / totalExposureZAR × 100; 0–100 */
    carbonIntensivePct: z.number().min(0).max(100),
  }),
  /** Estimated stress loss under this scenario in ZAR.
   *  Methodology: carbonIntensiveExposureZAR × scenario stress multiplier
   *  (PROC-RISK-CR-01 §6.2). */
  stressLossZAR: z.number().nonnegative(),
  /** Scenario horizon in years (typically 10 for capital measurement; 30 for strategic risk) */
  scenarioHorizonYears: z.number().int().positive(),
  /** Must be "D-RAS-CLIMATE-SCENARIO-FRAMEWORK" — enforces citation chain */
  authority: z.literal("D-RAS-CLIMATE-SCENARIO-FRAMEWORK"),
});

export type ClimateScenarioRunPayload = z.infer<typeof climateScenarioRunPayloadSchema>;

export function makeClimateScenarioRun(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ClimateScenarioRunPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ClimateScenarioRun",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: climateScenarioRunPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ClimateExposureRevalued
// ---------------------------------------------------------------------------
//
// Optional daily proxy event. Emitted by Rohan (Risk engineer) during EOD
// when trading-book market data is available. Provides a forward-looking
// climate VaR proxy between quarterly full scenario runs.

export const climateExposureRevaluedPayloadSchema = z.object({
  /** ISO date of the valuation, e.g. "2026-07-15" */
  asOf: z.string().min(1),
  /** Climate VaR at 99th percentile, 1-day horizon, in ZAR.
   *  Build-phase: sector-level proxy from MSCI/TCFD-aligned models applied
   *  to sector-concentration vector. Post-live: instrument-level model. */
  climateVaR99pct: z.number().nonnegative(),
  /** Percentage of total trading-book exposure in carbon-intensive sectors (0–100) */
  carbonIntensiveExposurePct: z.number().min(0).max(100),
});

export type ClimateExposureRevaluedPayload = z.infer<typeof climateExposureRevaluedPayloadSchema>;

export function makeClimateExposureRevalued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ClimateExposureRevaluedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ClimateExposureRevalued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: climateExposureRevaluedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const CLIMATE_RISK_TYPED_EVENT_TYPES = [
  "ClimateScenarioRun",
  "ClimateExposureRevalued",
] as const;

export type ClimateRiskEventType = (typeof CLIMATE_RISK_TYPED_EVENT_TYPES)[number];
