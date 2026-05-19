// platform/event-store/event-types/fx-accounting.ts
//
// FX accounting event-payload schemas — three typed events for the
// complete FX Spot accounting lifecycle:
//
//   - FxPositionRevalued      — daily revaluation of an open FX position
//                               at closing mid-market rate (FVTPL through
//                               P&L per IFRS 9 §5.7.1).
//   - FxSettlementConfirmed   — T+2 cash exchange confirmed; derecognises
//                               the FX trading receivable/payable and
//                               recognises the nostro cash legs. Realised
//                               P&L crystallised on this event.
//   - SubLedgerPostingEmitted — generic double-entry posting emitted by
//                               the posting-rule engine. Consumed by
//                               computeTrialBalance in period-close.ts.
//                               (The accounting.ts slice covers
//                               bank-account / period-close events; FX
//                               posting events land here so the FX domain
//                               is self-contained.)
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//
// Authors: Camille (CFO, finance) + Bea (Accounting & financial reporting
//   engineer, engineering)
// FX Spot accounting spec: Owner Inbox/2026-05-12_camille-bea_fx-accounting-spec-v1.md

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// FxPositionRevalued
//
// Emitted daily by Bea's close engine for each open (unsettled) FX position.
// Drives unrealised P&L recognition at FVTPL (no OCI — trading book).
// Per IFRS 9 §5.7.1: changes in fair value of FVTPL financial instruments
// recognised in profit or loss.
// Per IAS 21 §28: monetary items retranslated at closing rate.
// ---------------------------------------------------------------------------

export const fxPositionRevaluedPayloadSchema = z.object({
  /** Internal trade identifier — links back to the originating FxTradeExecuted. */
  tradeId: z.string().min(1),
  /** Currency pair (e.g. "ZAR/USD"). Canonical form: base/quote. */
  currencyPair: z.string().min(1),
  /** Original agreed rate from the trade (receiveCurrency per payCurrency unit). */
  bookRate: z.number().positive(),
  /** Current closing mid-market rate at which the position is revalued. */
  revalRate: z.number().positive(),
  /** Base-currency notional in smallest unit (minor). */
  notionalBaseMinor: z.number().int(),
  /**
   * Signed unrealised P&L delta in ZAR minor units (positive = gain).
   * This is the *change* since last revaluation (or since trade date for
   * the first revaluation), not the cumulative amount.
   */
  unrealisedPnlZarMinor: z.number().int(),
  /** ISO 8601 timestamp of the rate fix used for revaluation. */
  revaluedAt: z.string().min(1),
  /**
   * Rate source identifier. Build-phase: "stub". Production: "reuters-wm-fix"
   * or "bloomberg-bfix" per Bea spec §7 rate-feed integration.
   */
  rateSource: z.string().min(1),
});

export type FxPositionRevaluedPayload = z.infer<typeof fxPositionRevaluedPayloadSchema>;

export function makeFxPositionRevalued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FxPositionRevaluedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "FxPositionRevalued requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FxPositionRevalued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fxPositionRevaluedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FxSettlementConfirmed
//
// T+2 (or T+N for non-spot) cash exchange confirmed by the correspondent
// bank. Derecognises the FX Trading Receivable/Payable (FVTPL) and
// recognises the nostro cash legs (amortised cost).
//
// Realised P&L = settled cash (ZAR equivalent) - carrying amount of the
// FVTPL asset. Any residual is credited/debited to ACC-2100-006 (Realised
// FX P&L). If daily revaluations were current, the residual is typically
// negligible (intraday rate movement only).
//
// Per IFRS 9 §3.2.3: derecognise a financial asset when the contractual
// rights to the cash flows expire or are transferred.
// ---------------------------------------------------------------------------

export const fxSettlementConfirmedPayloadSchema = z.object({
  /** The trade this settlement confirms. */
  tradeId: z.string().min(1),
  /** Currency pair. */
  currencyPair: z.string().min(1),
  /** Which leg of the trade (near / far for swaps; near for spot). */
  legKind: z.enum(["near", "far"]),
  /**
   * Settled base-currency amount in minor units (positive = bank received,
   * negative = bank paid).
   */
  settledBaseCurrencyMinor: z.number().int(),
  /**
   * Settled quote-currency amount in minor units (positive = bank received,
   * negative = bank paid).
   */
  settledQuoteCurrencyMinor: z.number().int(),
  /** ISO 8601 timestamp when settlement was confirmed by the correspondent. */
  settledAt: z.string().min(1),
  /** Chart-of-accounts ID for the nostro account receiving/paying base currency. */
  nostroAccountBase: z.string().regex(/^ACC-[0-9]{4}-[0-9]{3}$/),
  /** Chart-of-accounts ID for the nostro account receiving/paying quote currency. */
  nostroAccountQuote: z.string().regex(/^ACC-[0-9]{4}-[0-9]{3}$/),
  /**
   * Realised P&L in ZAR minor units. Computed as:
   *   (settledZarEquivalent) - (carryingAmountZar at last revaluation).
   * Positive = gain; negative = loss. Zero if revaluations were current
   * to the settlement rate.
   */
  realisedPnlZarMinor: z.number().int(),
  /** Correspondent bank message reference (SWIFT MT300 / pacs.009 reference). */
  correspondentRef: z.string().optional(),
});

export type FxSettlementConfirmedPayload = z.infer<typeof fxSettlementConfirmedPayloadSchema>;

export function makeFxSettlementConfirmed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FxSettlementConfirmedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "FxSettlementConfirmed requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FxSettlementConfirmed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fxSettlementConfirmedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SubLedgerPostingEmitted
//
// Generic double-entry posting event emitted by the posting-rule engine.
// Each event carries one or more balanced legs (debits = credits in each
// currency). Consumed by period-close.ts::computeTrialBalance.
//
// The existing period-close.ts::computeTrialBalance already folds events
// of type "SubLedgerPostingEmitted" (see period-close.ts line ~253). This
// schema formalises the payload shape so posting-rule calculators can
// construct type-safe events.
//
// postingType discriminator:
//   "trade-booking"         — FxTradeExecuted source; initial recognition
//   "revaluation"           — FxPositionRevalued source; FVTPL P&L movement
//   "settlement"            — FxSettlementConfirmed source; derecognition + nostro
//   "reversal"              — period-open reversal of a prior accrual/revaluation
//   "payment-initiation"    — PaymentInitiated source; suspense DR / nostro CR
//   "payment-settlement"    — PaymentSettled source; payable DR / suspense CR
//   "settlement-instruction"— SettlementInstructionReceived; receivable DR / suspense CR
// ---------------------------------------------------------------------------

export const subLedgerLegSchema = z.object({
  /** Chart-of-accounts leaf account ID (ACC-NNNN-NNN). */
  accountId: z.string().regex(/^ACC-[0-9]{4}-[0-9]{3}$/, {
    message: "SubLedgerLeg.accountId must match ACC-NNNN-NNN",
  }),
  debitCredit: z.enum(["debit", "credit"]),
  /** Amount in minor currency units (always positive; debitCredit indicates direction). */
  amountMinor: z.number().int().nonnegative(),
  /** ISO 4217 currency. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
});

export type SubLedgerLeg = z.infer<typeof subLedgerLegSchema>;

export const subLedgerPostingEmittedPayloadSchema = z
  .object({
    /** Event ID of the source business event that triggered this posting. */
    sourceEventId: z.string().min(1),
    postingType: z.enum([
      "trade-booking",
      "revaluation",
      "settlement",
      "reversal",
      "payment-initiation",
      "payment-settlement",
      "settlement-instruction",
      "settlement-reversal",
      "cancellation",
      "amendment",
      // Bond lifecycle posting types (D-TRADE-LIFECYCLE-IFRS-CHAIN Slice 4 PR A)
      "bond-trade-booking",
      "bond-interest-accrual",
      "bond-revaluation",
      "bond-maturity",
      "bond-sale",
      // Equity lifecycle posting types (D-TRADE-LIFECYCLE-IFRS-CHAIN Slice 4 PR B)
      "equity-trade-booking",
      "equity-revaluation",
      "equity-dividend-accrual",
      "equity-sale",
      // IRD swap lifecycle posting types (D-TRADE-LIFECYCLE-IFRS-CHAIN Slice 4 PR C)
      "ird-swap-trade-booking",
      "ird-swap-revaluation",
      "ird-swap-coupon-settlement",
      "ird-swap-termination",
    ]),
    legs: z.array(subLedgerLegSchema).min(2),
    /** ISO 8601 timestamp when the posting was generated. */
    postedAt: z.string().min(1),
  })
  .superRefine((p, ctx) => {
    // Validate: debits = credits per currency.
    const totals = new Map<string, { debit: number; credit: number }>();
    for (const leg of p.legs) {
      const t = totals.get(leg.currency) ?? { debit: 0, credit: 0 };
      if (leg.debitCredit === "debit") t.debit += leg.amountMinor;
      else t.credit += leg.amountMinor;
      totals.set(leg.currency, t);
    }
    for (const [ccy, t] of totals.entries()) {
      if (t.debit !== t.credit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `SubLedgerPostingEmitted unbalanced in ${ccy}: debit=${t.debit} credit=${t.credit}`,
          path: ["legs"],
        });
      }
    }
  });

export type SubLedgerPostingEmittedPayload = z.infer<typeof subLedgerPostingEmittedPayloadSchema>;

export function makeSubLedgerPostingEmitted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SubLedgerPostingEmittedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SubLedgerPostingEmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: subLedgerPostingEmittedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SettlementFailed
//
// Emitted when a scheduled settlement fails — counterparty default, nostro
// insufficient funds, or correspondent rejection. Settlement was never posted,
// so NO GL entries are generated. Triggers operational escalation.
//
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
// IFRS 9 §3.2.1 (derecognition only if substantially all risks transferred —
// a failed settlement means the asset/liability is NOT derecognised).
// ---------------------------------------------------------------------------

export const settlementFailedPayloadSchema = z.object({
  tradeId: z.string().min(1),
  legKind: z.enum(["near", "far", "spot"]),
  reason: z.enum([
    "counterparty-default",
    "nostro-insufficient-funds",
    "correspondent-rejection",
    "other",
  ]),
  failedAt: z.string().min(1),
  scheduledSettlementDate: z.string().min(1),
});

export type SettlementFailedPayload = z.infer<typeof settlementFailedPayloadSchema>;

export function makeSettlementFailed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SettlementFailedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SettlementFailed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: settlementFailedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SettlementReversed
//
// Emitted when a previously confirmed settlement is reversed — e.g. a T+2
// SWIFT recall is accepted. Triggers PR-FX-REV: full reversal of the
// original PR-FX-003 entries (debit↔credit swapped), re-opening the
// FX Trading Receivable/Payable that was derecognised.
//
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
// IFRS 9 §3.2.1 (derecognition reversed when conditions not met).
// ---------------------------------------------------------------------------

export const settlementReversedPayloadSchema = z.object({
  tradeId: z.string().min(1),
  /** Event ID of the original FxSettlementConfirmed event being reversed. */
  originalSettlementEventId: z.string().min(1),
  reversedAt: z.string().min(1),
  reason: z.string().min(1),
});

export type SettlementReversedPayload = z.infer<typeof settlementReversedPayloadSchema>;

export function makeSettlementReversed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SettlementReversedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SettlementReversed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: settlementReversedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FxTradeCancelled
//
// Emitted to cancel a previously-executed FX trade — typically to correct
// trades that were booked with incorrect seed rates (wrong currency convention)
// or data-quality errors in simulation runs.
//
// Once emitted, projections filter out the referenced tradeId from all
// FxTradeExecuted and FxPositionRevalued folds, effectively voiding the
// trade from positions, P&L, and limit utilisation.
//
// Authority:
//   - CEO instruction (2026-05-19): cancel 15 bad simulated trades with
//     synthetic P&L of ZAR −759,908,692 caused by wrong seed rate convention.
// ---------------------------------------------------------------------------

export const fxTradeCancelledPayloadSchema = z.object({
  /** The trade ID that is being cancelled (matches tradeId.value in FxTradeExecuted). */
  tradeId: z.string().min(1),
  /** Human-readable reason for the cancellation. */
  reason: z.string().min(1),
  /** Agent or human that authorised the cancellation. */
  cancelledBy: z.string().min(1),
  /** Event ID of the original FxTradeExecuted event being cancelled. */
  originalEventId: z.string().min(1),
});

export type FxTradeCancelledPayload = z.infer<typeof fxTradeCancelledPayloadSchema>;

export function makeFxTradeCancelled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FxTradeCancelledPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "FxTradeCancelled requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FxTradeCancelled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fxTradeCancelledPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FX accounting event-type registry
// ---------------------------------------------------------------------------

export const FX_ACCOUNTING_EVENT_TYPES = [
  "FxPositionRevalued",
  "FxSettlementConfirmed",
  "SubLedgerPostingEmitted",
  "SettlementFailed",
  "SettlementReversed",
  "FxTradeCancelled",
] as const;

export type FxAccountingEventType = (typeof FX_ACCOUNTING_EVENT_TYPES)[number];
