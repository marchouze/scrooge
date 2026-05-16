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
//
// Authority:
//   - PROC-PAY-RBH-01 (three-way reconciliation procedure)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - NPS-ACT-78-1998, BANKS-ACT-94-1990
//
// Authors: Tomas (Operations & payments engineer, engineering),
//          Bea (Accounting & financial reporting engineer, engineering),
//          Atlas (Core Banking Platform Architect, engineering — substrate)

import {
  dailyReconciliationReportPayloadSchema,
  journalEntryPostedPayloadSchema,
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
];
