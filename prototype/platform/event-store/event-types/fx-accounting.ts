// platform/event-store/event-types/fx-accounting.ts
//
// FX accounting event-payload schemas — typed events for the
// FX Spot accounting lifecycle (terminal `TradeMatured` lives in
// trade-matured.ts as a generic, asset-class-agnostic event):
//
//   - FxPositionRevalued      — daily revaluation of an open FX position
//                               at closing mid-market rate (FVTPL through
//                               P&L per IFRS 9 §5.7.1).
//   - SubLedgerPostingEmitted — generic double-entry posting emitted by
//                               the posting-rule engine. Consumed by
//                               computeTrialBalance in period-close.ts.
//                               (The accounting.ts slice covers
//                               bank-account / period-close events; FX
//                               posting events land here so the FX domain
//                               is self-contained.)
//
// The previous FX-specific lifecycle-terminal event was retired on
// 2026-05-21 in favour of `TradeMatured` (see trade-matured.ts; authority:
// brief:bea:tradematured-event-schema-and-retire-fxsettlemen:2026-05-21).
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
  /**
   * Optional reference to the FinancialInstrument entity. Mirrors the
   * `instrumentId` on the originating FxTradeExecuted; enables projection
   * queries to group revaluations by instrument.
   * Absent for legacy events emitted before D-FINANCIAL-INSTRUMENT-ENTITY landed.
   *
   * Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
   */
  instrumentId: z.string().min(1).optional(),
  /**
   * FX product taxonomy of the revalued position ("FX-spot" | "FX-forward" |
   * "FX-swap" | "NDF") — mirrors the originating FxTradeExecuted.productTaxonomy.
   * The SLA interpreter's flat-FX context builder derives `instrument_type` from
   * this for correct instrument-level attribution (P&L by instrument, BA-return
   * instrument splits). Optional + falls back to "FX-spot" for legacy events
   * emitted before this field landed (no posting impact — FX accounts resolve
   * per-currency, not per-instrument). Authority: D-FX-OTC-NPA-SCOPE-EXPANSION.
   */
  productTaxonomy: z.string().min(1).optional(),
  /**
   * The CCY/ZAR rate used to value the **base** currency leg against ZAR.
   * Per IAS-21-§28 + IAS-9-§5.7.1: each currency leg is independently
   * translated at the closing CCY/ZAR rate rather than via a cross rate.
   * Absent for legacy events emitted before the per-currency ZAR MTM change
   * (brief:bea:per-currency-zar-mtm-bycurrency-aggregation-full:2026-05-31).
   */
  zarRateBase: z.number().positive().optional(),
  /**
   * The CCY/ZAR rate used to value the **quote** currency leg against ZAR.
   * Zero when the quote currency IS ZAR (so the quote leg already values in
   * ZAR and no additional translation is needed). Absent for legacy events.
   */
  zarRateQuote: z.number().nonnegative().optional(),
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
//   "settlement"            — TradeMatured (fx-spot) source; derecognition + nostro
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
    /**
     * Event ID of the source business event that triggered this posting.
     * Optional for correction entries that use `correctsEventId` instead.
     */
    sourceEventId: z.string().min(1).optional(),
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
      // FX lifecycle posting types (D-MARKETS-SCHEMA-FOUNDATION, 2026-05-20
      // circularity fix — PR-FX-PRIN and PR-FX-LIFECYCLE-CLOSE became
      // GL-significant; PR-FX-003 deprecated).
      "fx-principal-payment",
      "fx-lifecycle-close",
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
      // Treasury lifecycle posting types (WS1-PR1a; IFRS 9 §3.1.1; IAS 39 §27)
      "repo-trade-booking",
      "deposit-taken",
      "ibl-placement",
      // Treasury full-lifecycle posting types (D-SLA-ENGINE-RULES-AS-DATA
      // full-retirement Batch 1, 2026-06-05) — the accrual / maturity / early-
      // termination / funding-line legs the SLA interpreter now owns in
      // production. The three opening types above keep their original strings so
      // the `${sourceEventId}:${postingType}` idempotency key is unchanged.
      "deposit-interest-accrual",
      "deposit-maturity",
      "deposit-cancellation",
      "funding-drawdown",
      "funding-repayment",
      "ibl-interest-accrual",
      "ibl-maturity",
      "ibl-recall",
      "repo-interest-accrual",
      "repo-maturity",
      "repo-cancellation",
      // Correction posting types — append-only correcting entries per Principle 1.
      // D-CORRECT-DUPLICATE-MTM-REVERSALS (2026-05-21): reverses duplicate MTM
      // reversal / stale revaluation entries without deleting events.
      "duplicate-reversal-correction",
      "stale-revaluation-correction",
      // D-SLA-REBOOK-SIMULATED-MISBOOKINGS (CFO-approved): re-books simulated FX
      // legs silently mis-booked to the USD slot (legacy default→USD fallback)
      // into their per-currency home account (ACC-2100-010..024). Append-only.
      "sla-rebook-simulated-misbooking",
      // D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved): re-books FX-spot
      // legs stranded in the unresolved-currency suspense (ACC-2100-007) for a
      // currency that now has a dedicated per-currency home account (e.g. a
      // pre-provisioning runtime run that posted GBP/JPY nostro legs to
      // suspense). Reverses out of suspense and re-books into the home account.
      // Append-only. Authority: D-PROACTIVE-ESCALATION-SURFACING.
      "sla-rebook-unresolved-currency-suspense",
      // Observed in production DB but missing from schema (pre-existing postings
      // that landed before this enum was formalised).
      "cancellation-reversal",
      "settlement-confirmation",
      "trade-date-booking",
      // Capital lifecycle posting types (equity issuance, capital injection)
      "capital-injection",
    ]),
    legs: z.array(subLedgerLegSchema).min(2),
    /** ISO 8601 timestamp when the posting was generated. */
    postedAt: z.string().min(1),
    // ── SLA rules-as-data lineage (D-SLA-ENGINE-RULES-AS-DATA, spec §8.1) ──
    // Additive + OPTIONAL: the `.passthrough()` schema already tolerated these
    // extras; Phase 4b formalises them so the versioning recon can assert that
    // every posted `ruleVersion` exists in the rule registry (temporal
    // reproducibility, spec §6.3). Legacy postings that predate the SLA
    // interpreter cutover carry none of these → they read as `representation:
    // IFRS` with no rule lineage, which the recon treats as out-of-scope (not a
    // violation) — the additivity guarantee (spec §2.2): NO replay/backfill of
    // existing postings is required.
    /** Accounting basis this posting serves; defaults to IFRS for legacy events. */
    representation: z.enum(["IFRS", "SARB-BA-RETURN", "ZA-TAX"]).optional(),
    /** The SLA rule that produced this posting (e.g. "PR-FX-001"). */
    ruleId: z.string().min(1).optional(),
    /** The exact rule version in force at the event's effective date (spec §6). */
    ruleVersion: z.number().int().min(1).optional(),
    /**
     * Basel III business-line classification for this posting.
     * Maps to the BCBS Operational Risk business-line taxonomy (d188) and is
     * used to classify GL postings for the BA 400 Op-Risk return.
     * Populated by the SLA interpreter's product-to-business-line map;
     * absent for legacy postings pre-WS-BA-RETURNS-P1-SOURCING.
     * Authority: D-BA-RETURN-NUMBERING-EXCEL-CANONICAL; BCBS d188 §§652-654.
     */
    baselBusinessLine: z.string().optional(),
  })
  .passthrough()
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
  /** Event ID of the original TradeMatured (fx-spot) event being reversed. */
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
// FxSettlementFailed
//
// Emitted when the correspondent reports settlement failure on a previously
// instructed FX trade leg. Distinct from `SettlementFailed` (above): this
// event carries the richer failure-kind taxonomy that Devon (Chief Operating
// Officer, governance) uses to classify the failure under PROC-OPS-SFBCP-01
// §2 (failure detection + initial triage). `SettlementFailed` is the older
// generic accounting-side event covering simple counterparty-default /
// nostro-insufficient-funds shapes; `FxSettlementFailed` is the
// settlement-monitor's structured output that feeds the BCP procedure.
//
// Authority:
//   - Devon's procedure: Procedures/operations/settlement-failure-bcp.md
//     (PROC-OPS-SFBCP-01 v0.2, PR #636) §2 — failure classification.
//   - Banks Act 94 of 1990 Reg 39 — documented BCP procedures for
//     settlement failures; Herstatt risk supervisory concern.
//   - BCBS d226 — Supervisory guidance for managing settlement risk in
//     foreign-exchange transactions.
// ---------------------------------------------------------------------------

export const fxSettlementFailedPayloadSchema = z.object({
  /** Internal trade identifier — links back to the originating FxTradeExecuted. */
  tradeRef: z.string().min(1),
  /** Link to the FxSettlementInstructed event whose instruction failed. */
  settlementInstructionRef: z.string().min(1),
  /** ISO 8601 timestamp when the correspondent reported the failure. */
  failedAt: z.string().min(1),
  /**
   * Failure-kind taxonomy. Matches Devon's PROC-OPS-SFBCP-01 §2:
   *   - "one-leg-delivered"  — Herstatt-active scenario (bank delivered
   *     one currency but the counterparty has not delivered the other).
   *   - "neither-delivered"  — mutual fail; neither leg has settled.
   *   - "operational-delay"  — settlement has not failed in substance but
   *     is delayed beyond the cut-off (typically resolves intra-day).
   */
  failureKind: z.enum(["one-leg-delivered", "neither-delivered", "operational-delay"]),
  /** Free-form explanation from the correspondent (SWIFT MT199 body, email text). */
  failureReason: z.string().min(1),
  /** Per-leg delivery status as reported by the correspondent. */
  legStatus: z.object({
    payLegDelivered: z.boolean(),
    receiveLegDelivered: z.boolean(),
  }),
});

export type FxSettlementFailedPayload = z.infer<typeof fxSettlementFailedPayloadSchema>;

export function makeFxSettlementFailed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FxSettlementFailedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "FxSettlementFailed requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FxSettlementFailed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fxSettlementFailedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MissedExpectedReceipt
//
// Emitted when the bank's pay-leg is confirmed delivered (cash has left the
// nostro) but the receive-leg has not landed by `cutoff + tolerance`. This
// is the structured trigger for Tomas (Operations & Payments Engineer)'s
// 15-minute confirmation window in PROC-OPS-SFBCP-01 step 1: the
// settlement-monitor emits this event the moment the bank's exposure
// crosses from "pre-Herstatt" (neither leg delivered) into "Herstatt-active"
// (bank's leg out, counterparty's leg unreceived).
//
// Authority:
//   - Devon's procedure: Procedures/operations/settlement-failure-bcp.md
//     (PROC-OPS-SFBCP-01 v0.2, PR #636) step 1 — failure detection.
//   - BCBS d226 §3 — settlement-risk exposure window definition.
// ---------------------------------------------------------------------------

export const missedExpectedReceiptPayloadSchema = z.object({
  /** Internal trade identifier — links back to the originating FxTradeExecuted. */
  tradeRef: z.string().min(1),
  /** Link to the FxSettlementInstructed event whose receive-leg has not landed. */
  settlementInstructionRef: z.string().min(1),
  /** ISO 4217 currency code of the expected (missing) receipt. */
  expectedCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /**
   * Expected receipt amount in minor units (cents). Stored as a string to
   * support amounts beyond JavaScript's safe-integer range (BCBS d226 does
   * not cap notional; FX receive legs in deep EM currencies can exceed
   * 2^53 in minor units).
   */
  expectedAmountMinor: z.string().regex(/^-?[0-9]+$/),
  /** ISO 8601 timestamp of the settlement cutoff (correspondent's value-date cutoff). */
  cutoffAt: z.string().min(1),
  /** Tolerance window in minutes beyond `cutoffAt` before the receipt is declared missed. */
  toleranceMinutes: z.number().int().nonnegative(),
  /** ISO 8601 timestamp when the missed-receipt was detected by the monitor. */
  detectedAt: z.string().min(1),
});

export type MissedExpectedReceiptPayload = z.infer<typeof missedExpectedReceiptPayloadSchema>;

export function makeMissedExpectedReceipt(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MissedExpectedReceiptPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "MissedExpectedReceipt requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MissedExpectedReceipt",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: missedExpectedReceiptPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SettlementFailureClassified
//
// Emitted when Devon (Chief Operating Officer, governance) — or the agent
// acting on his behalf — signs off the classification of a settlement
// failure per PROC-OPS-SFBCP-01 §2. The classification drives the
// downstream response path: "herstatt-active" forces the immediate
// position-freeze + nostro-funding-hold sequence; "mutual-fail" routes to
// the close-out-netting path under ISDA 2002 §6; "operational-delay" routes
// to intra-day reconciliation only with no BCP escalation.
//
// Authority:
//   - Devon's procedure: Procedures/operations/settlement-failure-bcp.md
//     (PROC-OPS-SFBCP-01 v0.2, PR #636) §2 — classification & sign-off.
//   - ISDA 2002 Master Agreement §6 — Events of Default and Termination
//     Events; close-out-netting path for mutual-fail.
// ---------------------------------------------------------------------------

export const settlementFailureClassifiedPayloadSchema = z.object({
  /** Link to the FxSettlementInstructed event whose failure is being classified. */
  settlementInstructionRef: z.string().min(1),
  /**
   * Classification taxonomy. Matches Devon's PROC-OPS-SFBCP-01 §2:
   *   - "herstatt-active"     — bank's leg delivered; counterparty's leg
   *     unreceived; full notional exposure. BCP position-freeze sequence
   *     fires immediately.
   *   - "mutual-fail"         — neither leg delivered; close-out-netting
   *     path under ISDA 2002 §6.
   *   - "operational-delay"   — delayed settlement only, no exposure
   *     escalation (typically resolves intra-day).
   */
  classification: z.enum(["herstatt-active", "mutual-fail", "operational-delay"]),
  /** ISO 8601 timestamp of classification sign-off. */
  classifiedAt: z.string().min(1),
  /**
   * Agent URN or human party reference of the classifier (Devon's
   * standing authority under PROC-OPS-SFBCP-01; agents may classify on
   * his behalf under the same authority).
   */
  classifiedBy: z.string().min(1),
  /**
   * Evidence references — links into the doc-store or event-store
   * (correspondent SWIFT responses, counterparty calls, internal triage
   * notes) that support the classification.
   */
  evidence: z.array(z.string().min(1)),
});

export type SettlementFailureClassifiedPayload = z.infer<
  typeof settlementFailureClassifiedPayloadSchema
>;

export function makeSettlementFailureClassified(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SettlementFailureClassifiedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "SettlementFailureClassified requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SettlementFailureClassified",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: settlementFailureClassifiedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RealisedPnlRecognised
//
// Emitted when a settled FX trade CLOSES OUT part or all of a desk's
// foreign-currency cash instrument (the `fi:csh:<CCY>:<bookId>` position
// accumulated from prior settled trades). Realised P&L crystallises on
// close-out — NOT at each settlement: an opening purchase of USD realises
// nothing (the desk still holds the USD); selling that USD back realises
// `(disposalCostZarRate − weighted-avg avgCostZarRate) × amountClosed`.
//
// This replaces the broken `SettlementConfirmed.realisedPnlDelta` (which was
// always 0 — see settle-matured-trades.ts) as the canonical realised-P&L
// source for the FX-spot desk. The cash instrument is a first-class
// FinancialInstrument (ACTUS CSH); its realised P&L is recorded here so the
// figure is a durable event, never a view-time calc (Principle 1).
//
// Authority:
//   - IAS 21 §28 (exchange differences on settlement of monetary items)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
//   - D-FINANCIAL-INSTRUMENT-ENTITY (CSH cash instrument)
//   - CEO instruction 2026-05-31 (FX cash as a financial instrument)
// ---------------------------------------------------------------------------

export const realisedPnlRecognisedPayloadSchema = z.object({
  /** The CSH cash instrument whose close-out crystallised this P&L. */
  instrumentId: z.string().min(1),
  /** Owning trading book / desk. */
  bookId: z.string().min(1),
  /** ISO 4217 foreign currency of the cash instrument. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /**
   * Amount of the FCY position closed out, in minor units (always positive —
   * the magnitude of the reduction).
   */
  amountClosedMinor: z.number().int().nonnegative(),
  /** Weighted-average ZAR cost rate of the position before close-out (ZAR per FCY). */
  avgCostZarRate: z.number(),
  /** ZAR proceeds rate realised on the disposing trade (ZAR per FCY). */
  disposalCostZarRate: z.number(),
  /**
   * Realised P&L in ZAR minor units (signed; positive = gain):
   * (disposalCostZarRate − avgCostZarRate) × amountClosedMinor.
   */
  realisedPnlZarMinor: z.number().int(),
  /** The settled trade whose settlement disposed of (part of) the position. */
  sourceTradeId: z.string().min(1),
  /** ISO 8601 timestamp the close-out was recognised. */
  recognisedAt: z.string().min(1),
});

export type RealisedPnlRecognisedPayload = z.infer<typeof realisedPnlRecognisedPayloadSchema>;

export function makeRealisedPnlRecognised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RealisedPnlRecognisedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "RealisedPnlRecognised requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RealisedPnlRecognised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: realisedPnlRecognisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FX accounting event-type registry
// ---------------------------------------------------------------------------

export const FX_ACCOUNTING_EVENT_TYPES = [
  "FxPositionRevalued",
  "RealisedPnlRecognised",
  "SubLedgerPostingEmitted",
  "SettlementFailed",
  "SettlementReversed",
  "FxTradeCancelled",
  // PROC-OPS-SFBCP-01 settlement-failure BCP event types
  // (Devon — Chief Operating Officer, governance; PR #636).
  // Authority: Banks Act 94 Reg 39, BCBS d226.
  "FxSettlementFailed",
  "MissedExpectedReceipt",
  "SettlementFailureClassified",
] as const;

export type FxAccountingEventType = (typeof FX_ACCOUNTING_EVENT_TYPES)[number];
