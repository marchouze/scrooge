// platform/event-store/event-types/payments.ts
//
// Payments / settlement event-payload schemas — six typed events for the
// complete three-way reconciliation lifecycle (PROC-PAY-RBH-01):
//
//   - SettlementInstructionReceived — trade leg arrives from counterparty
//   - PaymentInitiated              — payment leg sent to correspondent
//   - PaymentSettled                — correspondent confirms cash exchange
//   - JournalEntryPosted            — ledger leg posted to GL
//   - ReconciliationBreak           — three-way match fails (timing/amount/nostro)
//   - DailyReconciliationReport     — daily summary of match results
//
// Authority:
//   - PROC-PAY-RBH-01 (three-way reconciliation procedure)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - NPS-ACT-78-1998, BANKS-ACT-94-1990, SWIFT-CSP-2024, ISO-20022,
//     PASA-SETTLEMENT-RULES
//
// Authors: Tomas (Operations & payments engineer, engineering),
//          Bea (Accounting & financial reporting engineer, engineering),
//          Atlas (Core Banking Platform Architect, engineering — substrate)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// SettlementInstructionReceived
//
// Emitted when a settlement instruction arrives from a counterparty
// (or the bank's own trading desk) for an FX spot trade leg.
// This is the trade-leg source for the three-way reconciliation.
// ---------------------------------------------------------------------------

export const settlementInstructionReceivedPayloadSchema = z.object({
  /** Internal trade identifier — links to the originating trade. */
  tradeId: z.string().min(1),
  /** Which leg of the trade this instruction covers. */
  legKind: z.enum(["receive", "deliver"]),
  /** ISO 8601 date (YYYY-MM-DD) on which settlement is due. */
  settlementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "settlementDate must be ISO 8601 date YYYY-MM-DD",
  }),
  /** ISO 4217 currency for this leg. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** Net cash amount in minor currency units (always positive; legKind indicates direction). */
  netCash: z.number().int().positive(),
  /** Correspondent bank details for this leg. */
  correspondent: z.object({
    name: z.string().min(1),
    bic: z
      .string()
      .min(8)
      .max(11)
      .regex(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/, {
        message: "bic must be a valid SWIFT BIC (8 or 11 chars)",
      }),
  }),
  /** Minimum 1 citation required (Principle 2). */
  citations: z.array(z.string().min(1)).min(1),
});

export type SettlementInstructionReceivedPayload = z.infer<
  typeof settlementInstructionReceivedPayloadSchema
>;

export function makeSettlementInstructionReceived(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SettlementInstructionReceivedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "SettlementInstructionReceived requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SettlementInstructionReceived",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: settlementInstructionReceivedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PaymentInitiated
//
// Emitted when a payment instruction is sent to the correspondent bank.
// Links back to the trade via tradeId and carries the payment reference.
// ---------------------------------------------------------------------------

export const paymentInitiatedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),
  /** Which leg of the trade this payment covers. */
  legKind: z.enum(["receive", "deliver"]),
  /** Correspondent bank payment reference. */
  paymentRef: z.string().min(1),
  /** ISO 4217 currency. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** Net cash amount in minor currency units (always positive). */
  netCash: z.number().int().positive(),
  /** ISO 8601 timestamp when payment was initiated. */
  initiatedAt: z.string().min(1),
  /** Minimum 1 citation required (Principle 2). */
  citations: z.array(z.string().min(1)).min(1),
});

export type PaymentInitiatedPayload = z.infer<typeof paymentInitiatedPayloadSchema>;

export function makePaymentInitiated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PaymentInitiatedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "PaymentInitiated requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PaymentInitiated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: paymentInitiatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PaymentSettled
//
// Emitted when the correspondent bank confirms that the payment has settled.
// This is the payment-leg source for the three-way reconciliation.
// ---------------------------------------------------------------------------

export const paymentSettledPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),
  /** Which leg of the trade this settlement covers. */
  legKind: z.enum(["receive", "deliver"]),
  /** Correspondent bank payment reference (matches PaymentInitiated). */
  paymentRef: z.string().min(1),
  /** ISO 4217 currency. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** Net cash amount actually settled in minor currency units. */
  netCash: z.number().int().positive(),
  /** ISO 8601 timestamp when settlement was confirmed. */
  settledAt: z.string().min(1),
  /** Minimum 1 citation required (Principle 2). */
  citations: z.array(z.string().min(1)).min(1),
});

export type PaymentSettledPayload = z.infer<typeof paymentSettledPayloadSchema>;

export function makePaymentSettled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PaymentSettledPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "PaymentSettled requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PaymentSettled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: paymentSettledPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// JournalEntryPosted
//
// Emitted when a journal entry is posted to the GL for a trade settlement.
// This is the ledger-leg source for the three-way reconciliation.
// ---------------------------------------------------------------------------

export const journalEntryPostedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),
  /** Chart-of-accounts ID for the debit leg (ACC-NNNN-NNN). */
  accountDebit: z.string().regex(/^ACC-[0-9]{4}-[0-9]{3}$/, {
    message: "accountDebit must match ACC-NNNN-NNN per chart-of-accounts",
  }),
  /** Chart-of-accounts ID for the credit leg (ACC-NNNN-NNN). */
  accountCredit: z.string().regex(/^ACC-[0-9]{4}-[0-9]{3}$/, {
    message: "accountCredit must match ACC-NNNN-NNN per chart-of-accounts",
  }),
  /** ISO 4217 currency. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** Amount posted in minor currency units (always positive; direction encoded in debit/credit accounts). */
  amountMinor: z.number().int().positive(),
  /** ISO 8601 timestamp when the journal entry was posted. */
  postedAt: z.string().min(1),
  /** Minimum 1 citation required (Principle 2). */
  citations: z.array(z.string().min(1)).min(1),
});

export type JournalEntryPostedPayload = z.infer<typeof journalEntryPostedPayloadSchema>;

export function makeJournalEntryPosted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: JournalEntryPostedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "JournalEntryPosted requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "JournalEntryPosted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: journalEntryPostedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ReconciliationBreak
//
// Emitted when the three-way match (trade leg ↔ payment leg ↔ ledger leg)
// fails for a given tradeId. The kind discriminator classifies the break:
//   - timing: a leg is missing but within the 4-hour tolerance window
//   - amount: netCash mismatch between trade and payment legs
//   - nostro:  payment settled but ledger leg missing >4h after settlement
// ---------------------------------------------------------------------------

export const reconciliationBreakKindSchema = z.enum(["timing", "amount", "nostro"]);
export type ReconciliationBreakKind = z.infer<typeof reconciliationBreakKindSchema>;

export const reconciliationBreakPayloadSchema = z.object({
  /** Internal trade identifier where the break was detected. */
  tradeId: z.string().min(1),
  /** Classification of the break. */
  kind: reconciliationBreakKindSchema,
  /** Human-readable description of the break. */
  description: z.string().min(1),
  /** Trade-leg expected cash amount (minor units). Present for amount breaks. */
  tradeAmount: z.number().int().positive().optional(),
  /** Payment-leg actual cash amount (minor units). Present for amount breaks. */
  paymentAmount: z.number().int().positive().optional(),
  /** ISO 8601 timestamp when the break was detected. */
  detectedAt: z.string().min(1),
  /** Minimum 1 citation required (Principle 2). */
  citations: z.array(z.string().min(1)).min(1),
});

export type ReconciliationBreakPayload = z.infer<typeof reconciliationBreakPayloadSchema>;

export function makeReconciliationBreak(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ReconciliationBreakPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "ReconciliationBreak requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ReconciliationBreak",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: reconciliationBreakPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// DailyReconciliationReport
//
// Emitted at the end of each reconciliation run as a summary of match results.
// Carries matched/break counts and a snapshot of all breaks detected.
// ---------------------------------------------------------------------------

/** Inline break summary used inside DailyReconciliationReport payload. */
export const reconciliationBreakSummarySchema = z.object({
  tradeId: z.string().min(1),
  kind: reconciliationBreakKindSchema,
  description: z.string().min(1),
  tradeAmount: z.number().int().positive().optional(),
  paymentAmount: z.number().int().positive().optional(),
  detectedAt: z.string().min(1),
});

export type ReconciliationBreakSummary = z.infer<typeof reconciliationBreakSummarySchema>;

export const dailyReconciliationReportPayloadSchema = z.object({
  /** ISO 8601 date (YYYY-MM-DD) this report covers. */
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "asOf must be ISO 8601 date YYYY-MM-DD",
  }),
  /** Number of trade-leg ↔ payment-leg ↔ ledger-leg three-way matches. */
  matchedCount: z.number().int().nonnegative(),
  /** Number of breaks detected (sum of all break kinds). */
  breakCount: z.number().int().nonnegative(),
  /** Break detail snapshot. */
  breaks: z.array(reconciliationBreakSummarySchema),
  /** Minimum 1 citation required (Principle 2). */
  citations: z.array(z.string().min(1)).min(1),
});

export type DailyReconciliationReportPayload = z.infer<
  typeof dailyReconciliationReportPayloadSchema
>;

export function makeDailyReconciliationReport(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DailyReconciliationReportPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "DailyReconciliationReport requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DailyReconciliationReport",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: dailyReconciliationReportPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Payments event-type registry
// ---------------------------------------------------------------------------

export const PAYMENTS_TYPED_EVENT_TYPES = [
  "SettlementInstructionReceived",
  "PaymentInitiated",
  "PaymentSettled",
  "JournalEntryPosted",
  "ReconciliationBreak",
  "DailyReconciliationReport",
] as const;

export type PaymentsEventType = (typeof PAYMENTS_TYPED_EVENT_TYPES)[number];
