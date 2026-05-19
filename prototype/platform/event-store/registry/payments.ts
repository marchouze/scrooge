// platform/event-store/registry/payments.ts
//
// F-032 typed registry rows for the payments / settlement event family.
//
// Covers:
//   - SettlementInstructionReceived — trade-leg arriving from counterparty
//   - PaymentInitiated              — payment leg dispatched to correspondent
//   - PaymentSettled                — correspondent confirms cash exchange
//   - JournalEntryPosted            — ledger leg posted to GL
//   - ReconciliationBreak           — three-way match failure
//   - DailyReconciliationReport     — daily reconciliation summary
//   - OutboundMessageDispatched     — bank dispatches SWIFT/ISO 20022 message
//   - InboundMessageReceived        — bank receives SWIFT/ISO 20022 message
//   - MessageCorrelated             — outbound message matched to inbound reply
//
// Authority:
//   - PROC-PAY-RBH-01 (three-way reconciliation procedure)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-MESSAGE-EVENTS (CEO-approved 2026-05-19)
//   - NPS-ACT-78-1998, BANKS-ACT-94-1990
//
// Authors: Tomas (Operations & payments engineer, engineering),
//          Bea (Accounting & financial reporting engineer, engineering),
//          Atlas (Core Banking Platform Architect, engineering — substrate)

import {
  dailyReconciliationReportPayloadSchema,
  inboundMessageReceivedPayloadSchema,
  journalEntryPostedPayloadSchema,
  messageCorrelatedPayloadSchema,
  outboundMessageDispatchedPayloadSchema,
  paymentInitiatedPayloadSchema,
  paymentSettledPayloadSchema,
  reconciliationBreakPayloadSchema,
  settlementInstructionReceivedPayloadSchema,
} from "../event-types/payments";
import { type EventTypeMetadata, RETENTION_BANKING_5Y } from "./types";

export const PAYMENTS_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "SettlementInstructionReceived",
    class: "markets",
    issuer: "Tomas",
    subscribers: ["Tomas", "Bea"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: settlementInstructionReceivedPayloadSchema,
    source: "platform/event-store/event-types/payments.ts; PROC-PAY-RBH-01",
  },
  {
    type: "PaymentInitiated",
    class: "markets",
    issuer: "Tomas",
    subscribers: ["Tomas", "Bea"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: paymentInitiatedPayloadSchema,
    source: "platform/event-store/event-types/payments.ts; PROC-PAY-RBH-01",
  },
  {
    type: "PaymentSettled",
    class: "markets",
    issuer: "Tomas",
    subscribers: ["Tomas", "Bea"],
    replay: "idempotent-terminal",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: paymentSettledPayloadSchema,
    source: "platform/event-store/event-types/payments.ts; PROC-PAY-RBH-01",
  },
  {
    type: "JournalEntryPosted",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Tomas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: journalEntryPostedPayloadSchema,
    source: "platform/event-store/event-types/payments.ts; PROC-PAY-RBH-01",
  },
  {
    type: "ReconciliationBreak",
    class: "audit",
    issuer: "Tomas",
    subscribers: ["Tomas", "Bea", "Helena"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: reconciliationBreakPayloadSchema,
    source: "platform/event-store/event-types/payments.ts; PROC-PAY-RBH-01",
  },
  {
    type: "DailyReconciliationReport",
    class: "audit",
    issuer: "Tomas",
    subscribers: ["Tomas", "Bea", "Devon", "dashboard"],
    replay: "latest-wins-per-key",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: dailyReconciliationReportPayloadSchema,
    source: "platform/event-store/event-types/payments.ts; PROC-PAY-RBH-01",
  },
  // -------------------------------------------------------------------------
  // D-FX-MESSAGE-EVENTS (CEO-approved 2026-05-19)
  // Three event types that wire FX message generation into the event log,
  // closing the Principle 1 violation from PR #563.
  // -------------------------------------------------------------------------
  {
    type: "OutboundMessageDispatched",
    class: "markets",
    issuer: "Tomas",
    subscribers: ["Tomas", "Devon", "Bea", "dashboard"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: outboundMessageDispatchedPayloadSchema,
    source:
      "platform/event-store/event-types/payments.ts; D-FX-MESSAGE-EVENTS; D-FX-CLS-MEMBERSHIP",
  },
  {
    type: "InboundMessageReceived",
    class: "markets",
    issuer: "Tomas",
    subscribers: ["Tomas", "Devon", "Bea", "dashboard"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: inboundMessageReceivedPayloadSchema,
    source:
      "platform/event-store/event-types/payments.ts; D-FX-MESSAGE-EVENTS; D-FX-CLS-MEMBERSHIP",
  },
  {
    type: "MessageCorrelated",
    class: "markets",
    issuer: "Tomas",
    subscribers: ["Tomas", "Devon", "Bea"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: messageCorrelatedPayloadSchema,
    source: "platform/event-store/event-types/payments.ts; D-FX-MESSAGE-EVENTS; PROC-PAY-RBH-01",
  },
];
