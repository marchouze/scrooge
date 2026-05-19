// platform/event-store/registry/climate-risk.ts
//
// Climate-risk event-type registry rows.
//
// Covers:
//   ClimateScenarioRun       — quarterly PA GN 1/2024 scenario stress run
//   ClimateExposureRevalued  — daily proxy climate VaR
//
// Authority: D-RAS-CLIMATE-SCENARIO-FRAMEWORK (CEO-approved 2026-05-19);
//   PA Guidance Note 1 of 2024; PROC-RISK-CR-01.
//
// Retention classification:
//   - ClimateScenarioRun → RETENTION_GOVERNANCE_7Y
//     (regulatory disclosure obligation once trading commences; PA GN 1/2024
//      mandates retention of scenario inputs and outputs for audit purposes)
//   - ClimateExposureRevalued → RETENTION_BANKING_5Y
//     (daily proxy metric; 5-year floor consistent with general prudential records)
//
// Author: Helena (Chief Risk Officer, governance)

import {
  climateExposureRevaluedPayloadSchema,
  climateScenarioRunPayloadSchema,
} from "../event-types/climate-risk";
import { RETENTION_BANKING_5Y, RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Climate-risk event-type registry rows.
 *
 * Subscribers:
 *   Helena (CRO) — scenario run outputs for RAS appetite measurement.
 *   Rohan (Risk engineer) — emits ClimateExposureRevalued; reads for risk dashboard.
 *   Camille (CFO) — climate risk for financial reporting and ICAAP.
 *   Atlas (platform) — substrate monitoring.
 */
export const CLIMATE_RISK_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "ClimateScenarioRun",
    class: "risk",
    issuer: "Helena",
    subscribers: ["Helena", "Rohan", "Camille", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: climateScenarioRunPayloadSchema,
    citationsHint: [
      "D-RAS-CLIMATE-SCENARIO-FRAMEWORK",
      "PA-GN1-2024",
      "PROC-RISK-CR-01",
    ],
    source: "platform/event-store/event-types/climate-risk.ts",
  },
  {
    type: "ClimateExposureRevalued",
    class: "risk",
    issuer: "Rohan",
    subscribers: ["Helena", "Rohan", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: climateExposureRevaluedPayloadSchema,
    citationsHint: [
      "D-RAS-CLIMATE-SCENARIO-FRAMEWORK",
      "PA-GN1-2024",
      "PROC-RISK-CR-01",
    ],
    source: "platform/event-store/event-types/climate-risk.ts",
  },
];
