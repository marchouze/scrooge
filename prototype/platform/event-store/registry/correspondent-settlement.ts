// platform/event-store/registry/correspondent-settlement.ts
//
// F-032 typed registry rows for the correspondent settlement event family.
//
// Covers:
//   - CorrespondentSettlementInstructionSent — outbound pacs.008 / pacs.009
//     instruction dispatched to the correspondent bank (SAMOS settlement)
//   - CorrespondentSettlementStatusReceived  — pacs.002 status report from
//     the correspondent (ACSC / RJCT / PDNG)
//   - NostroStatementReceived               — EOD camt.053 account statement
//     from the correspondent (nostro reconciliation feed)
//
// Authority:
//   - D-TREASURER-WAVE2-SUBSTRATE (CEO-approved 2026-06-11)
//   - NPS-ACT-78-1998 (National Payment System Act)
//   - SARB-NPSD (SARB National Payment System Directive)
//   - PROC-PAY-RBH-01 (three-way reconciliation procedure)
//   - ISO-20022 (pacs.008 / pacs.009 / pacs.002 / camt.053)
//
// Author: Tomas (Operations & payments engineer, engineering)

import {
  correspondentSettlementInstructionSentPayloadSchema,
  correspondentSettlementStatusReceivedPayloadSchema,
  nostroStatementReceivedPayloadSchema,
} from "../event-types/correspondent-settlement";
import { type EventTypeMetadata, RETENTION_BANKING_5Y } from "./types";

export const CORRESPONDENT_SETTLEMENT_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  // -------------------------------------------------------------------------
  // CorrespondentSettlementInstructionSent
  //
  // Emitted by Tomas whenever an outbound pacs.008 (customer credit transfer)
  // or pacs.009 (FI transfer) instruction is dispatched to the correspondent.
  // The event_of_record for every outbound SAMOS settlement instruction.
  // Consumers: Tomas (reconciliation), Ravi (BCBS 248 outflow tracking),
  // Bea (GL nostro posting), Vera (audit).
  // -------------------------------------------------------------------------
  {
    type: "CorrespondentSettlementInstructionSent",
    class: "markets",
    issuer: "Tomas",
    subscribers: ["Tomas", "Ravi", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: correspondentSettlementInstructionSentPayloadSchema,
    source: "platform/event-store/event-types/correspondent-settlement.ts",
    citationsHint: ["D-TREASURER-WAVE2-SUBSTRATE"],
    v2Status: "v1-only",
  },
  // -------------------------------------------------------------------------
  // CorrespondentSettlementStatusReceived
  //
  // Emitted by Tomas when a pacs.002 status report is received from the
  // correspondent. Closes the instruction-sent / status-received loop for
  // each SAMOS settlement. RJCT status triggers Tomas's exception-handling
  // path and surfaces as a ReconciliationBreak.
  // -------------------------------------------------------------------------
  {
    type: "CorrespondentSettlementStatusReceived",
    class: "markets",
    issuer: "Tomas",
    subscribers: ["Tomas", "Ravi", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: correspondentSettlementStatusReceivedPayloadSchema,
    source: "platform/event-store/event-types/correspondent-settlement.ts",
    citationsHint: ["D-TREASURER-WAVE2-SUBSTRATE"],
    v2Status: "v1-only",
  },
  // -------------------------------------------------------------------------
  // NostroStatementReceived
  //
  // Emitted by Tomas when the EOD camt.053 account statement is received from
  // the correspondent. Triggers the nostro reconciliation pass (PROC-PAY-RBH-01)
  // and feeds Ravi's BCBS 248 Tool 1 (available-at-start-of-day-of-business).
  // The closing balance here is the authoritative nostro balance for the date.
  // -------------------------------------------------------------------------
  {
    type: "NostroStatementReceived",
    class: "markets",
    issuer: "Tomas",
    subscribers: ["Tomas", "Ravi", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: nostroStatementReceivedPayloadSchema,
    source: "platform/event-store/event-types/correspondent-settlement.ts",
    citationsHint: ["D-TREASURER-WAVE2-SUBSTRATE"],
    v2Status: "v1-only",
  },
];
