// platform/event-store/registry/ifrs9-staging.ts
//
// Event-type registry rows for IFRS 9 impairment staging events.
//
// Covers:
//   - Ifrs9StageAssigned — emitted by the IFRS 9 staging engine per
//     financial instrument per assessment cycle (build-phase: all instruments
//     performing, Stage 1; licence-day: real PD/LGD/EAD model).
//
// Authority:
//   - D-IFRS9-STAGING-V1 (CEO-approved 2026-05-28)
//   - D-IFRS-THRESHOLDS-V13 (SICR calibration, 2026-05-27)
//   - IFRS 9 §5.5.1–§5.5.17 (ECL impairment requirements)
//   - Regulations Relating to Banks Reg 23 (default definition)
//   - Banks Act 94/1990 §73 (record-keeping obligations)
//
// Author: Atlas (Core banking platform architect, engineering)

import { Ifrs9StageAssignedPayloadSchema } from "../event-types/ifrs9-staging";
import { type EventTypeMetadata, RETENTION_ACCOUNTING_7Y } from "./types";

export const IFRS9_STAGING_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    // D-IFRS9-STAGING-V1 — IFRS 9 impairment stage classification.
    // Emitted by `scripts/ifrs9-staging-run.ts` (build-phase batch runner)
    // and, post-licence, by the real-time credit-assessment engine on
    // TradeBooked / credit-review triggers.
    //
    // Idempotency at "same calendar day + tradeId": the staging run checks
    // for an existing same-day Ifrs9StageAssigned before emitting.
    //
    // M8 migration: batch runner replaced by event-triggered real-time
    // engine; this registry row is unchanged.
    type: "Ifrs9StageAssigned",
    class: "governance",
    payloadSchema: Ifrs9StageAssignedPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Bea", "Helena", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "D-IFRS9-STAGING-V1",
      "D-IFRS-THRESHOLDS-V13",
      "IFRS-9-§5.5",
      "Regulations Relating to Banks Reg 23",
    ],
    // IFRS 9 provisions are accounting records — 7-year retention per
    // Banks Act §73 + SARB inspection requirements.
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "scripts/ifrs9-staging-run.ts (build-phase batch); real-time credit-assessment engine (post-licence)",
  },
];
