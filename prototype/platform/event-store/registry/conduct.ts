// platform/event-store/registry/conduct.ts
//
// M3 Slice 9 — Conduct event-type registry rows.
//
// Covers:
//   ConductComplaintFiled, ConductComplaintResolved, ConductIncidentLogged,
//   BestExecutionAnalysisCompleted, ConductDisclosureEmitted.
//
// Standing authority: D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
//   (CEO-approved 2026-05-10).
//
// Citations:
//   FSRA §131; FSB TCF 2012; FAIS Act 37/2002 §§16–17;
//   D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md; Principles/2-single-graph-discipline.md.
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Mira (Compliance / RegTech engineer, engineering).

import {
  bestExecutionAnalysisCompletedPayloadSchema,
  conductComplaintFiledPayloadSchema,
  conductComplaintResolvedPayloadSchema,
  conductDisclosureEmittedPayloadSchema,
  conductIncidentLoggedPayloadSchema,
} from "../event-types/conduct";
import { RETENTION_BANKING_5Y, RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Conduct event-type registry rows.
 *
 * Retention classification:
 *   - ConductComplaintFiled / Resolved / IncidentLogged — RETENTION_BANKING_5Y
 *     (Banks Act s.60 + FSCA conduct-record-keeping guidance; 5-year floor).
 *   - BestExecutionAnalysisCompleted — RETENTION_GOVERNANCE_7Y
 *     (FAIS §16 best-execution policy — regulatory audit trail; 7-year floor).
 *   - ConductDisclosureEmitted — RETENTION_GOVERNANCE_7Y
 *     (FSRA §131 conduct-reporting obligation; 7-year floor).
 *
 * Subscribers:
 *   Mira (CCO compliance desk) subscribes to all conduct events for
 *   CMS disclosure generation and FSCA reporting.
 *   Devon (COO) subscribes to high-severity incidents and breaches for
 *   TCF governance oversight.
 */
export const CONDUCT_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "ConductComplaintFiled",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Mira", "Devon"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: conductComplaintFiledPayloadSchema,
    source: "platform/event-store/event-types/conduct.ts",
  },
  {
    type: "ConductComplaintResolved",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Mira", "Devon"],
    replay: "pair-coupled",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: conductComplaintResolvedPayloadSchema,
    source: "platform/event-store/event-types/conduct.ts",
  },
  {
    type: "ConductIncidentLogged",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Mira", "Devon", "Helena"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: conductIncidentLoggedPayloadSchema,
    source: "platform/event-store/event-types/conduct.ts",
  },
  {
    type: "BestExecutionAnalysisCompleted",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Mira", "Devon", "Kai"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: bestExecutionAnalysisCompletedPayloadSchema,
    source: "platform/event-store/event-types/conduct.ts",
  },
  {
    type: "ConductDisclosureEmitted",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Mira", "Devon", "Owen"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: conductDisclosureEmittedPayloadSchema,
    source: "platform/event-store/event-types/conduct.ts",
  },
];
