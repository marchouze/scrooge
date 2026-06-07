// platform/event-store/registry/alco.ts
//
// ALCO pack event-type registry rows.
//
// Covers:
//   ALCOPackGenerated            — monthly ALCO pack generation event.
//   IntradayHQLAStressProjection — intraday liquidity stress-scenario output.
//
// Note: ILAAPSummaryCompleted and ILAAPScenarioRun are registered in
// ilaap.ts (D-TREASURY-GAPS-WAVE1 ILAAP engine PR). The ALCO pack generator
// reads ILAAPSummaryCompleted from the event store using the ilaap.ts schema.
//
// Retention classification:
//   - ALCOPackGenerated            → RETENTION_GOVERNANCE_7Y
//     (ALCO governance record; Companies Act 71 of 2008 §24 — 7 years)
//   - IntradayHQLAStressProjection → RETENTION_BANKING_5Y
//     (intraday prudential record; Banks Act 94 of 1990 — 5 years)
//
// Authority: D-TREASURY-GAPS-WAVE1; BA 110; BA 120; BCBS d365;
//   Banks Act 94 of 1990; Companies Act 71 of 2008.
// Author: Atlas (Core banking platform architect, engineering)

import {
  alcoPackGeneratedPayloadSchema,
  intradayHQLAStressProjectionPayloadSchema,
} from "../event-types/alco";
import { RETENTION_BANKING_5Y, RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * ALCO pack event-type registry rows.
 *
 * Subscribers:
 *   Eitan (Treasurer, governance)  — primary ALCO pack consumer; chair.
 *   Helena (Chief Risk Officer, governance) — RAS / IRRBB / liquidity oversight.
 *   Camille (CFO, governance)      — capital / ICAAP inputs.
 *   Owen (Company Secretary, governance) — ALCO minutes and records.
 *   Ravi (Treasury/ALM Engineer, engineering) — ALM + intraday inputs.
 *   Anya (Liquidity & projections engineer, engineering) — LCR/NSFR inputs.
 *   Atlas (platform) — substrate monitoring.
 */
export const ALCO_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "ALCOPackGenerated",
    class: "governance",
    issuer: "Atlas",
    subscribers: ["Eitan", "Helena", "Camille", "Owen", "Ravi", "Anya", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: alcoPackGeneratedPayloadSchema,
    citationsHint: ["D-TREASURY-GAPS-WAVE1", "BA-110", "BA-120", "BCBS-D365-IRRBB"],
    source: "platform/event-store/event-types/alco.ts",
  },
  {
    type: "IntradayHQLAStressProjection",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Eitan", "Helena", "Tomas", "Anya", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: intradayHQLAStressProjectionPayloadSchema,
    citationsHint: ["BA-110", "BANKS-ACT-94-1990", "D-TREASURY-GAPS-WAVE1"],
    source: "platform/event-store/event-types/alco.ts",
  },
];
