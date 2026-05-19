// platform/event-store/registry/ilaap.ts
//
// ILAAP event-type registry rows.
//
// Covers:
//   ILAAPScenarioRun      — per-scenario liquidity stress result
//   ILAAPSummaryCompleted — aggregated worst-case ILAAP assessment
//
// Authority: D-TREASURY-GAPS-WAVE1; Banks Act 94/1990; BA 325; PA ILAAP guidance.
//
// Retention classification:
//   - ILAAPScenarioRun → RETENTION_GOVERNANCE_7Y
//     (SARB prudential return / ILAAP documentation; 7-year minimum)
//   - ILAAPSummaryCompleted → RETENTION_GOVERNANCE_7Y
//     (ILAAP submission record; same reasoning)
//
// Author: Atlas (Core banking platform architect, engineering)

import {
  ilaapScenarioRunPayloadSchema,
  ilaapSummaryCompletedPayloadSchema,
} from "../event-types/ilaap";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * ILAAP event-type registry rows.
 *
 * Subscribers:
 *   Atlas (platform)    — emits; monitors adequacy status.
 *   Eitan (Treasurer)   — ALCO pack inputs; ILAAP sign-off.
 *   Helena (CRO)        — RAS appetite monitoring; stress review.
 *   Camille (CFO)       — ICAAP/ILAAP liquidity slice; capital plan.
 *   Anya (Liquidity)    — liquidity projection coordination.
 */
export const ILAAP_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "ILAAPScenarioRun",
    class: "governance",
    issuer: "Atlas",
    subscribers: ["Atlas", "Eitan", "Helena", "Camille", "Anya"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: ilaapScenarioRunPayloadSchema,
    citationsHint: ["D-TREASURY-GAPS-WAVE1", "BANKS-ACT-94-1990", "BA-325"],
    source: "platform/event-store/event-types/ilaap.ts",
  },
  {
    type: "ILAAPSummaryCompleted",
    class: "governance",
    issuer: "Atlas",
    subscribers: ["Atlas", "Eitan", "Helena", "Camille", "Anya"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: ilaapSummaryCompletedPayloadSchema,
    citationsHint: ["D-TREASURY-GAPS-WAVE1", "BANKS-ACT-94-1990", "BA-325"],
    source: "platform/event-store/event-types/ilaap.ts",
  },
];
