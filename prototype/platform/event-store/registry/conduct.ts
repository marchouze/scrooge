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
  bestExecutionBreachedPayloadSchema,
  bestExecutionVerifiedPayloadSchema,
  conductComplaintFiledPayloadSchema,
  conductComplaintResolvedPayloadSchema,
  conductDisclosureEmittedPayloadSchema,
  conductEventRecordedPayloadSchema,
  conductIncidentLoggedPayloadSchema,
  conductObligationFlaggedPayloadSchema,
  conflictOfInterestDisclosedPayloadSchema,
  faisClassificationSuitabilityCheckedPayloadSchema,
  feeDisclosureEventPayloadSchema,
  marketConductAlertRaisedPayloadSchema,
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
  // ---------------------------------------------------------------------------
  // Trade-level conduct risk event types (M3 Slice 9 extension)
  //
  // Emitted per-trade by `rohan:conduct-risk-events` on FxTradeExecuted.
  // Citations: FAIS Act 37/2002 §§16–17; Financial Markets Act 19/2012 §§78–82;
  //   FSRA §131; D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
  // Author: Rohan (Quant Risk Engineer, markets).
  // ---------------------------------------------------------------------------
  {
    type: "ConductObligationFlagged",
    class: "audit",
    issuer: "Rohan",
    subscribers: ["Mira", "Helena", "Devon"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: conductObligationFlaggedPayloadSchema,
    source: "platform/event-store/event-types/conduct.ts",
  },
  {
    type: "BestExecutionVerified",
    class: "audit",
    issuer: "Rohan",
    subscribers: ["Mira", "Kai"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: bestExecutionVerifiedPayloadSchema,
    source: "platform/event-store/event-types/conduct.ts",
  },
  {
    type: "BestExecutionBreached",
    class: "audit",
    issuer: "Rohan",
    subscribers: ["Mira", "Helena", "Devon", "Kai"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: bestExecutionBreachedPayloadSchema,
    source: "platform/event-store/event-types/conduct.ts",
  },
  {
    type: "MarketConductAlertRaised",
    class: "audit",
    issuer: "Rohan",
    subscribers: ["Mira", "Helena", "Devon"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: marketConductAlertRaisedPayloadSchema,
    source: "platform/event-store/event-types/conduct.ts",
  },
  {
    type: "FaisClassificationSuitabilityChecked",
    class: "audit",
    issuer: "Rohan",
    subscribers: ["Mira", "Kai"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: faisClassificationSuitabilityCheckedPayloadSchema,
    source: "platform/event-store/event-types/conduct.ts",
  },
  {
    type: "ConflictOfInterestDisclosed",
    class: "audit",
    issuer: "Rohan",
    subscribers: ["Mira", "Helena", "Devon"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: conflictOfInterestDisclosedPayloadSchema,
    source: "platform/event-store/event-types/conduct.ts",
  },
  // ---------------------------------------------------------------------------
  // ConductEventRecorded — counterparty conduct surveillance observation record.
  //
  // High-level conduct observation spanning multiple trades or raised by an
  // automated surveillance model. Primary input to the conduct surveillance
  // register and the recon:conduct-surveillance-coverage pipeline.
  //
  // Citations:
  //   Financial Markets Act 19 of 2012 §§78–82;
  //   FSRA §131; FSB TCF 2012; FAIS Act 37/2002 §§16–17;
  //   D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
  // Author: Atlas (Principal Software Engineer, engineering) +
  //   Mira (Compliance / RegTech engineer, engineering).
  // ---------------------------------------------------------------------------
  {
    type: "ConductEventRecorded",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Mira", "Helena", "Devon", "Rohan"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: conductEventRecordedPayloadSchema,
    source: "platform/event-store/event-types/conduct.ts",
    citationsHint: [
      "D-MARKET-CONDUCT",
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "FINANCIAL-MARKETS-ACT-19-2012-S78",
      "FSRA-S131",
    ],
  },
  // ---------------------------------------------------------------------------
  // FeeDisclosureEvent — fee / spread transparency disclosure record.
  //
  // Emitted by Zara (MLRO / conduct officer) per FAIS Act §8(1)(d)(i) +
  // General Code of Conduct §7. Records the pre-trade or post-trade
  // disclosure method, instrument, counterparty, and spread/fee charged.
  //
  // Citations:
  //   FAIS-ACT-37-2002-S8-1-D-I (disclosure of remuneration);
  //   FAIS-GCC-S7 (costs and charges);
  //   D-MARKET-CONDUCT; D-FX-SALES-TRADING-FRONTEND; PROC-PAY-RBH-01.
  // Author: Zara (MLRO / conduct officer, governance).
  // ---------------------------------------------------------------------------
  {
    type: "FeeDisclosureEvent",
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Mira", "Bea"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: feeDisclosureEventPayloadSchema,
    source:
      "platform/event-store/event-types/conduct.ts; PROC-PAY-RBH-01; Policies/valuation-policy-v1.md",
    citationsHint: [
      "FAIS-ACT-37-2002-S8-1-D-I",
      "FAIS-GCC-S7",
      "D-MARKET-CONDUCT",
      "D-FX-SALES-TRADING-FRONTEND",
      "PROC-PAY-RBH-01",
    ],
  },
];
