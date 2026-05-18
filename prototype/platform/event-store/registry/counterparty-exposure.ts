// platform/event-store/registry/counterparty-exposure.ts
//
// M3 Slice 10 — Counterparty-exposure event-type registry rows.
//
// Covers:
//   CounterpartyExposureCalculated
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
//   (CEO-approved 2026-05-10).
//
// Citations:
//   Banks Act 94 of 1990 §73 (large exposures);
//   RRB Regulation 23 (credit-risk large exposure limits);
//   BCBS 283 (large exposures framework, 2014);
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Authors: Atlas (Principal Software Engineer, engineering) +
//   Helena (Chief Risk Officer, governance — credit-risk limit authority).

import { counterpartyExposureCalculatedPayloadSchema } from "../event-types/counterparty-exposure";
import { RETENTION_BANKING_5Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Counterparty-exposure event-type registry rows.
 *
 * Retention classification:
 *   - CounterpartyExposureCalculated — RETENTION_BANKING_5Y
 *     (Banks Act s.60 + RRB Regulation 23 audit trail; 5-year floor).
 *
 * Subscribers:
 *   Helena (CRO) subscribes for large-exposure limit monitoring and RAS
 *     Tier-1 breach escalation.
 *   Rohan (Quant Risk Engineer, markets) subscribes for internal daily
 *     exposure feed and PFE model inputs.
 *   Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO)
 *     subscribes for regulatory large-exposure reporting (SARB BA 600).
 */
export const COUNTERPARTY_EXPOSURE_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "CounterpartyExposureCalculated",
    class: "audit",
    issuer: "Rohan",
    subscribers: ["Helena", "Rohan", "Mira"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: counterpartyExposureCalculatedPayloadSchema,
    source: "platform/event-store/event-types/counterparty-exposure.ts",
  },
];
