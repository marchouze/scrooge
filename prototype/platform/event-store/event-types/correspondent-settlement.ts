// platform/event-store/event-types/correspondent-settlement.ts
//
// Correspondent settlement event-payload schemas.
//
// W2.1 — Correspondent settlement interface stubs.
//
// Covers:
//   CorrespondentSettlementInstructionSent — outbound pacs.008 / pacs.009
//     instruction dispatched to the correspondent bank.
//   CorrespondentSettlementStatusReceived — pacs.002 status report received
//     from the correspondent (ACSC / RJCT / PDNG).
//   NostroStatementReceived — EOD camt.053 account statement received from
//     the correspondent for nostro reconciliation.
//
// These events wire the CorrespondentConnector interface (Deliverable 1)
// into the Principle 1 event log. Every outbound instruction and every
// inbound status / statement has an event-of-record. Projection consumers:
//   - Tomas's nostro reconciliation harness (PROC-PAY-RBH-01)
//   - Ravi's BCBS 248 intraday-liquidity monitoring
//   - Bea's nostro GL sub-ledger recon
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE (CEO-approved 2026-06-11).
// Citations: NPS-ACT-78-1998; SARB-NPSD; ISO-20022; SWIFT-CSP-2024;
//   Banks Act 94/1990; PROC-PAY-RBH-01; Principles/1-events-are-truth.md.
// Author: Tomas (Operations & payments engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// CorrespondentSettlementInstructionSent
// ---------------------------------------------------------------------------

export const correspondentSettlementInstructionSentPayloadSchema = z.object({
  /**
   * ISO 20022 MsgId from the pacs.008 or pacs.009 message dispatched to the
   * correspondent. Correlates to the inbound pacs.002 status report.
   */
  msgId: z.string().min(1),
  /** BIC of the creditor / receiving financial institution (8 or 11 chars). */
  creditorBIC: z
    .string()
    .min(8)
    .max(11)
    .regex(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/, {
      message: "creditorBIC must be a valid SWIFT BIC (8 or 11 chars)",
    }),
  /** Instructed amount in minor currency units (always positive). */
  instructedAmount: z.number().int().positive(),
  /** ISO 4217 currency code. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** ISO 8601 date (YYYY-MM-DD) — interbank settlement date. */
  settlementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "settlementDate must be ISO 8601 date YYYY-MM-DD",
  }),
  /** End-to-end reference (max 35 chars) for correlation. */
  endToEndId: z.string().min(1).max(35),
});

export type CorrespondentSettlementInstructionSentPayload = z.infer<
  typeof correspondentSettlementInstructionSentPayloadSchema
>;

export function makeCorrespondentSettlementInstructionSent(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CorrespondentSettlementInstructionSentPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "CorrespondentSettlementInstructionSent requires at least one citation (Principle 2). " +
        "Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CorrespondentSettlementInstructionSent",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: correspondentSettlementInstructionSentPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CorrespondentSettlementStatusReceived
// ---------------------------------------------------------------------------

export const correspondentSettlementStatusReceivedPayloadSchema = z.object({
  /**
   * MsgId from the original pacs.008 or pacs.009 instruction.
   * Correlates to the CorrespondentSettlementInstructionSent event.
   */
  originalMsgId: z.string().min(1),
  /**
   * Transaction status from pacs.002 TxSts element:
   *   ACSC — Accepted Settlement Completed (funds settled in SAMOS)
   *   RJCT — Rejected (rejectReason is mandatory)
   *   PDNG — Pending (instruction accepted; settlement not yet confirmed)
   */
  txStatus: z.enum(["ACSC", "RJCT", "PDNG"]),
  /**
   * ISO 20022 reject reason code (StsRsnInf/Rsn/Cd). Present when
   * txStatus === "RJCT". Common codes: AM04 (insufficient funds),
   * AC01 (incorrect account), FF01 (invalid file format), NARR (narrative).
   */
  rejectReason: z.string().optional(),
});

export type CorrespondentSettlementStatusReceivedPayload = z.infer<
  typeof correspondentSettlementStatusReceivedPayloadSchema
>;

export function makeCorrespondentSettlementStatusReceived(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CorrespondentSettlementStatusReceivedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "CorrespondentSettlementStatusReceived requires at least one citation (Principle 2). " +
        "Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CorrespondentSettlementStatusReceived",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: correspondentSettlementStatusReceivedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// NostroStatementReceived
// ---------------------------------------------------------------------------

export const nostroStatementReceivedPayloadSchema = z.object({
  /**
   * Account identifier at the correspondent (IBAN or proprietary).
   * Matches the `accountId` field in the camt.053 message.
   */
  accountId: z.string().min(1),
  /**
   * ISO 8601 date (YYYY-MM-DD) — the statement's `toDate` (end of period).
   * For EOD statements this is the business date.
   */
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "asOf must be ISO 8601 date YYYY-MM-DD",
  }),
  /** Closing balance in minor currency units at the end of the statement period. */
  closingBalance: z.number().int(),
  /** ISO 4217 currency of the account. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** Number of credit/debit entries in the statement (BCBS 248 Tool 1 input). */
  entryCount: z.number().int().nonnegative(),
});

export type NostroStatementReceivedPayload = z.infer<typeof nostroStatementReceivedPayloadSchema>;

export function makeNostroStatementReceived(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: NostroStatementReceivedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "NostroStatementReceived requires at least one citation (Principle 2). " +
        "Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "NostroStatementReceived",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: nostroStatementReceivedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const CORRESPONDENT_SETTLEMENT_TYPED_EVENT_TYPES = [
  "CorrespondentSettlementInstructionSent",
  "CorrespondentSettlementStatusReceived",
  "NostroStatementReceived",
] as const;

export type CorrespondentSettlementEventType =
  (typeof CORRESPONDENT_SETTLEMENT_TYPED_EVENT_TYPES)[number];
