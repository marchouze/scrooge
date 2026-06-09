// platform/event-store/registry/ecl-staging.ts
//
// Event-type registry rows for the exposure-level IFRS 9 impairment staging
// and ECL events (WS-BA-RETURNS-FOLLOWON).
//
// Covers:
//   - ImpairmentStageAssigned — IFRS 9 stage (1/2/3) per credit exposure.
//   - EclComputed — expected-credit-loss measurement per credit exposure.
//
// Both feed the events-first BA 200 credit-risk return
// (generateBa200CreditRiskFromEvents). IFRS 9 provisions are accounting
// records → 7-year retention per Banks Act §73 + SARB inspection.
//
// Authority:
//   - D-BA-RETURNS-FOLLOWON-BATCH (WS-BA-RETURNS-FOLLOWON)
//   - D-IFRS9-STAGING-V1 (CEO-approved 2026-05-28)
//   - IFRS 9 §5.5; Regulations Relating to Banks Reg 23 (Form BA 200)
//
// Author: Mira (Regulatory reporting engineer, engineering)

import {
  eclComputedPayloadSchema,
  impairmentStageAssignedPayloadSchema,
} from "../event-types/ecl-staging";
import { type EventTypeMetadata, RETENTION_ACCOUNTING_7Y } from "./types";

export const ECL_STAGING_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "ImpairmentStageAssigned",
    class: "governance",
    payloadSchema: impairmentStageAssignedPayloadSchema,
    issuer: "Helena",
    subscribers: ["Bea", "Helena", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "D-BA-RETURNS-FOLLOWON-BATCH",
      "D-IFRS9-STAGING-V1",
      "IFRS-9-§5.5",
      "Regulations Relating to Banks Reg 23",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "credit-assessment engine (per-exposure staging); build-phase: all exposures performing (Stage 1)",
  },
  {
    type: "EclComputed",
    class: "governance",
    payloadSchema: eclComputedPayloadSchema,
    issuer: "Helena",
    subscribers: ["Bea", "Helena", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "D-BA-RETURNS-FOLLOWON-BATCH",
      "D-IFRS9-STAGING-V1",
      "IFRS-9-§5.5",
      "Regulations Relating to Banks Reg 23",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    source: "ECL engine (per-exposure EAD × PD × LGD); build-phase: ECL ≈ 0 on high-quality book",
  },
];
