// platform/event-store/registry/cfp-triggers.ts
//
// WS-TREASURER-WAVE1-SUBSTRATE — CFP trigger event-type registry rows.
//
// Covers the seven Contingency Funding Plan trigger events named in
// LRM Policy v1 §5.2:
//   IntradayStressDetected, CriticalSettlementObligationAtRisk (Tier 1);
//   LcrRatioBreach (warning Tier 2 / critical Tier 3);
//   FundingConcentrationAlertTriggered, ExternalCreditEventDetected (Tier 2);
//   NsfrRatioBreach, RecoveryEarlyWarningTriggered (Tier 3).
//
// Standing authority:
//   - D-TREASURER-WAVE1-SUBSTRATE (CEO-approved 2026-06-11); parent
//     D-TREASURER-ROLE-DEFINITION-REVIEW.
//   - Liquidity Risk Management Policy v1 §5.2 (Camille (Chief Financial
//     Officer, governance) + Eitan (Treasurer, governance) + Helena
//     (Chief Risk Officer, governance), 2026-05-11).
//
// Citations:
//   Banks Act 94 of 1990 Reg 26 (liquidity-risk management + CFP);
//   BCBS 144 Principle 11 (contingency funding plans);
//   BCBS 248 (intraday liquidity monitoring tools);
//   Policies/liquidity-risk-management-policy-v1.md §5.2 + §4.5.
//
// Retention classification:
//   CFP trigger events are regulator-inspection-scope liquidity records
//   → RETENTION_BANKING_5Y.
//
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import {
  criticalSettlementObligationAtRiskPayloadSchema,
  externalCreditEventDetectedPayloadSchema,
  fundingConcentrationAlertTriggeredPayloadSchema,
  intradayStressDetectedPayloadSchema,
  lcrRatioBreachPayloadSchema,
  nsfrRatioBreachPayloadSchema,
  recoveryEarlyWarningTriggeredPayloadSchema,
} from "../event-types/cfp-triggers";
import { RETENTION_BANKING_5Y } from "./types";
import type { EventTypeMetadata } from "./types";

const CFP_TRIGGER_CITATIONS_HINT = [
  "BANKS-ACT-94-1990",
  "RRB-REG-26",
  "BCBS-144",
  "POLICY:liquidity-risk-management-policy-v1-S5.2",
];

/**
 * CFP trigger event-type registry rows.
 *
 * Subscribers:
 *   Eitan (Treasurer, governance) — every trigger; CFP first-line owner
 *     and Tier-1 same-day activation authority per LRM Policy v1 §5.3.
 *   Helena (Chief Risk Officer, governance) — every trigger; Tier-2/3
 *     activation requires CRO sign-off per §5.2; Recovery Plan owner.
 *   Camille (Chief Financial Officer, governance) — every trigger;
 *     funding-source hierarchy + capital-injection escalation per §5.3.
 *   Ravi (Treasury and ALM engineer) — every trigger; EWI monitor issuer.
 *   Anya (Liquidity & projections engineer) — LCR/NSFR triggers; upstream
 *     computation owner.
 *   Owen (Company Secretary, governance) — Tier-3 triggers; PA-engagement
 *     and Board-notification record-keeping per §5.3 Tier 3.
 *   Atlas (Core banking platform architect, engineering) — every trigger
 *     for substrate monitoring.
 */
export const CFP_TRIGGER_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "IntradayStressDetected",
    class: "audit",
    issuer: "Ravi",
    subscribers: ["Eitan", "Helena", "Camille", "Ravi", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: intradayStressDetectedPayloadSchema,
    source: "platform/event-store/event-types/cfp-triggers.ts",
    citationsHint: [...CFP_TRIGGER_CITATIONS_HINT, "BCBS-248-INTRADAY"],
  },
  {
    type: "CriticalSettlementObligationAtRisk",
    class: "audit",
    issuer: "Ravi",
    subscribers: ["Eitan", "Helena", "Camille", "Ravi", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: criticalSettlementObligationAtRiskPayloadSchema,
    source: "platform/event-store/event-types/cfp-triggers.ts",
    citationsHint: [...CFP_TRIGGER_CITATIONS_HINT, "BCBS-248-INTRADAY"],
  },
  {
    type: "LcrRatioBreach",
    class: "audit",
    issuer: "Ravi",
    subscribers: ["Eitan", "Helena", "Camille", "Ravi", "Anya", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: lcrRatioBreachPayloadSchema,
    source: "platform/event-store/event-types/cfp-triggers.ts",
    citationsHint: [...CFP_TRIGGER_CITATIONS_HINT, "BCBS-D295"],
  },
  {
    type: "NsfrRatioBreach",
    class: "audit",
    issuer: "Ravi",
    subscribers: ["Eitan", "Helena", "Camille", "Ravi", "Anya", "Owen", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: nsfrRatioBreachPayloadSchema,
    source: "platform/event-store/event-types/cfp-triggers.ts",
    citationsHint: [...CFP_TRIGGER_CITATIONS_HINT, "BCBS-D335", "RRB-REG-26A"],
  },
  {
    type: "FundingConcentrationAlertTriggered",
    class: "audit",
    issuer: "Ravi",
    subscribers: ["Eitan", "Helena", "Camille", "Ravi", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: fundingConcentrationAlertTriggeredPayloadSchema,
    source: "platform/event-store/event-types/cfp-triggers.ts",
    citationsHint: CFP_TRIGGER_CITATIONS_HINT,
  },
  {
    type: "ExternalCreditEventDetected",
    class: "audit",
    issuer: "Ravi",
    subscribers: ["Eitan", "Helena", "Camille", "Ravi", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: externalCreditEventDetectedPayloadSchema,
    source: "platform/event-store/event-types/cfp-triggers.ts",
    citationsHint: CFP_TRIGGER_CITATIONS_HINT,
  },
  {
    type: "RecoveryEarlyWarningTriggered",
    class: "audit",
    issuer: "Ravi",
    subscribers: ["Eitan", "Helena", "Camille", "Ravi", "Owen", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: recoveryEarlyWarningTriggeredPayloadSchema,
    source: "platform/event-store/event-types/cfp-triggers.ts",
    citationsHint: [...CFP_TRIGGER_CITATIONS_HINT, "ICAAP-ILAAP-RECOVERY-FRAMEWORK-S3.3.5"],
  },
];
