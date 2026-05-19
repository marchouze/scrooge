// platform/event-store/registry/liquidity.ts
//
// Liquidity projection event-type registry rows.
//
// Covers:
//   LCRComputed  — LCR computation result (BA 325 / Basel III)
//   NSFRComputed — NSFR computation result (BA 326 / Basel III)
//
// Authority: D-TREASURY-GAPS-WAVE1; BANKS-ACT-94-1990; BA 325; BA 326.
//
// Retention classification:
//   - LCRComputed → RETENTION_GOVERNANCE_7Y
//     (SARB prudential return BA 325 submissions require supporting computation
//      audit trail for at least 7 years)
//   - NSFRComputed → RETENTION_GOVERNANCE_7Y
//     (SARB prudential return BA 326; same reasoning as LCRComputed)
//
// Author: Anya (Liquidity & projections engineer, engineering)

import { lcrComputedPayloadSchema, nsfrComputedPayloadSchema } from "../event-types/liquidity";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Liquidity projection event-type registry rows.
 *
 * Subscribers:
 *   Anya (Liquidity & projections engineer) — emits + reads for projection dashboard.
 *   Eitan (Treasurer) — daily LCR/NSFR ratio review; ALCO pack inputs.
 *   Helena (CRO) — RAS appetite monitoring against LCR/NSFR floors.
 *   Camille (CFO) — ICAAP/ILAAP liquidity slice inputs.
 *   Atlas (platform) — substrate monitoring.
 */
export const LIQUIDITY_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "LCRComputed",
    class: "governance",
    issuer: "Anya",
    subscribers: ["Anya", "Eitan", "Helena", "Camille", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: lcrComputedPayloadSchema,
    citationsHint: ["D-TREASURY-GAPS-WAVE1", "BANKS-ACT-94-1990", "BA-325"],
    source: "platform/event-store/event-types/liquidity.ts",
  },
  {
    type: "NSFRComputed",
    class: "governance",
    issuer: "Anya",
    subscribers: ["Anya", "Eitan", "Helena", "Camille", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: nsfrComputedPayloadSchema,
    citationsHint: ["D-TREASURY-GAPS-WAVE1", "BANKS-ACT-94-1990", "BA-326"],
    source: "platform/event-store/event-types/liquidity.ts",
  },
];
