// platform/event-store/registry/operational-risk.ts
//
// Operational-risk loss-event registry rows (F-032: every typed event MUST be
// registered).
//
// Covers:
//   OperationalLossEvent — capture of an internal operational loss (event date,
//     gross loss minor + currency, Basel business line, BCBS loss-event-type
//     category, recovery, status). Capture substrate ONLY — the op-RWA capital
//     computation (BIA/TSA/LDA) stays gross-income-blocked (revenue-start,
//     Camille CFO; platform/reporting/ba-400-op-risk.ts).
//
// Retention classification:
//   - OperationalLossEvent → RETENTION_GOVERNANCE_7Y. Internal loss data is a
//     risk-governance record retained for the loss-data history that future
//     loss-distribution approaches require (Banks Act 94 of 1990; Reg 33).
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; Basel II Annex 9 / BCBS D196 §644;
//   Reg 33 (operational risk).
// Author: Tomas (Operations & payments engineer, engineering) — governance
//   owner Devon (Chief Operating Officer, governance; op-risk seat).

import { operationalLossEventPayloadSchema } from "../event-types/operational-risk";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Operational-risk loss-event registry rows.
 *
 * Subscribers:
 *   Tomas (Operations & payments engineer, engineering) — primary author / capture.
 *   Devon (Chief Operating Officer, governance) — op-risk seat owner.
 *   Helena (Chief Risk Officer, governance) — op-risk methodology / loss-data oversight.
 *   Bea (Accounting & financial reporting engineer, engineering) — BA 400 / capital linkage.
 *   Atlas (Core banking platform architect, engineering) — substrate monitoring.
 */
export const OPERATIONAL_RISK_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "OperationalLossEvent",
    class: "governance",
    issuer: "Tomas",
    subscribers: ["Tomas", "Devon", "Helena", "Bea", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: operationalLossEventPayloadSchema,
    citationsHint: ["D-FX-HELD-DIMS-SEAT-SWEEP", "BCBS-D196-§644", "REG-33"],
    source: "platform/event-store/event-types/operational-risk.ts",
    v2Status: "v1-only",
  },
];
