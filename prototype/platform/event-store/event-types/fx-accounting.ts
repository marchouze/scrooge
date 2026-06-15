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

import { amountToMinorUnits, money } from "../../core/decimal-money";
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

// MoneyWire shape for the leg's decimal `amount` on the wire (decimal-native).
// Authority: D-DECIMAL-NATIVE-MONEY-ARITHMETIC; D-DECIMAL-NATIVE-CONSUMER-MIGRATION-BEFORE-WAVE-3.
const moneyWireSchema = z.object({
  __money: z.literal("v1"),
  amount: z.string().min(1),
  currency: z.string().min(1),
});

export const subLedgerLegSchema = z.object({
  /** Chart-of-accounts leaf account ID (ACC-NNNN-NNN). */
  accountId: z.string().regex(/^ACC-[0-9]{4}-[0-9]{3}$/, {
    message: "SubLedgerLeg.accountId must match ACC-NNNN-NNN",
  }),
  debitCredit: z.enum(["debit", "credit"]),
  /**
   * Exact-decimal leg amount as MoneyWire — THE sole source of truth on the wire
   * (D-DECIMAL-NATIVE-MONEY-ARITHMETIC). Required for all new events; old stored
   * events carry it too (emitter migration complete). `amountMinor` dropped
   * (D-DECIMAL-NATIVE-CONSUMER-MIGRATION-BEFORE-WAVE-3 DROP).
   */
  amount: moneyWireSchema,
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
      // D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK (CEO-approved 2026-06-10): re-books
      // a foreign-currency residual stranded INSIDE a designated-currency account
      // (the default-to-USD defect, live 2026-06-01..06, parked GBP/JPY/CHF/EUR/AUD
      // legs in the USD-designated ACC-1200-002 / ACC-2100-002 / ACC-2100-004)
      // into the matching per-currency account. Reverses the residual out of the
      // contaminated account and books it into the per-currency home. Append-only.
      "designated-currency-rebook",
      // Observed in production DB but missing from schema (pre-existing postings
      // that landed before this enum was formalised).
      "cancellation-reversal",
      "settlement-confirmation",
      "trade-date-booking",
      // Capital lifecycle posting types (equity issuance, capital injection)
      "capital-injection",
      // IAS 21 §28 forward-points accrual posting types (D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL
      // gap closure — Nadia, Model validation engineer, 2026-06-15).
      // "fx-forward-points-accrual" — daily amortised slice Dr/Cr deferred account + P&L.
      // "fx-forward-points-clear"   — maturity-date clearing of cumulative deferred balance.
      "fx-forward-points-accrual",
      "fx-forward-points-clear",
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
    // Validate: debits = credits per currency (using exact decimal minor units).
    const totals = new Map<string, { debit: bigint; credit: bigint }>();
    for (const leg of p.legs) {
      const t = totals.get(leg.currency) ?? { debit: 0n, credit: 0n };
      const legMinor = amountToMinorUnits(money(leg.amount.amount, leg.currency as never));
      if (leg.debitCredit === "debit") t.debit += legMinor;
      else t.credit += legMinor;
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

/**
 * The leg shape accepted by `makeSubLedgerPostingEmitted` BEFORE wire-encoding.
 * Producers build the in-memory `SubLedgerLeg` (fx-accounting-types.ts), whose
 * `amount` is a decimal `Money` (`{ amount, currency }`); on emit it is encoded
 * to the canonical `MoneyWire` (`{ __money, amount, currency }`). A leg that
 * already carries a MoneyWire passes through unchanged. This is the
 * decimal-native emit boundary (D-DECIMAL-NATIVE-MONEY-ARITHMETIC,
 * D-DECIMAL-NATIVE-CONSUMER-MIGRATION-BEFORE-WAVE-3 DROP).
 */
type EmitLegInput = Omit<z.input<typeof subLedgerLegSchema>, "amount"> & {
  readonly amount: Money | MoneyWire;
};

function encodeLegForWire(leg: EmitLegInput): z.input<typeof subLedgerLegSchema> {
  const { amount, ...rest } = leg;
  // A `Money` lacks the `__money` discriminant; a `MoneyWire` carries it.
  const wire = "__money" in amount ? amount : encodeMoney(amount);
  return { ...rest, amount: wire };
}

export function makeSubLedgerPostingEmitted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: Omit<SubLedgerPostingEmittedPayload, "legs"> & { legs: readonly EmitLegInput[] };
  eventId?: string;
}): Event {
  // Encode each leg's decimal `amount` to MoneyWire on the wire.
  // (amountMinor DROP complete — D-DECIMAL-NATIVE-CONSUMER-MIGRATION-BEFORE-WAVE-3)
  const legs = args.payload.legs.map(encodeLegForWire);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SubLedgerPostingEmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: subLedgerPostingEmittedPayloadSchema.parse({ ...args.payload, legs }),
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
  /**
   * Exact-decimal FCY amount closed as MoneyWire — THE source of truth on the wire
   * (D-DECIMAL-NATIVE-MONEY-ARITHMETIC slice 2b). Optional during the transition.
   */
  amountClosed: moneyWireSchema.optional(),
  /** Weighted-average ZAR cost rate of the position before close-out (ZAR per FCY). */
  avgCostZarRate: z.number(),
  /** ZAR proceeds rate realised on the disposing trade (ZAR per FCY). */
  disposalCostZarRate: z.number(),
  /**
   * Realised P&L in ZAR minor units (signed; positive = gain):
   * (disposalCostZarRate − avgCostZarRate) × amountClosedMinor.
   */
  realisedPnlZarMinor: z.number().int(),
  /**
   * Exact-decimal realised P&L as MoneyWire — THE source of truth on the wire
   * (D-DECIMAL-NATIVE-MONEY-ARITHMETIC slice 2b). Optional during the transition.
   */
  realisedPnlZar: moneyWireSchema.optional(),
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
// DECIMAL-MIGRATION: V2 MoneyWire payload types (slice 2)
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED, D-MONEY-DECIMAL-REDENOMINATION.
// ---------------------------------------------------------------------------

import type { Money } from "../../core/decimal-money";
import type { MoneyWire } from "../../core/money-codec";
import { encodeMoney, moneyWireFromMinor } from "../../core/money-codec";

// ── FxPositionRevalued V2 ────────────────────────────────────────────────────

/** @deprecated DECIMAL-MIGRATION: superseded by FxPositionRevaluedPayloadV2. */
export type FxPositionRevaluedPayloadLegacy = FxPositionRevaluedPayload;

export interface FxPositionRevaluedPayloadV2
  extends Omit<FxPositionRevaluedPayload, "notionalBaseMinor" | "unrealisedPnlZarMinor"> {
  /** Base-currency notional as exact decimal MoneyWire. */
  readonly notionalBase: MoneyWire;
  /** Signed unrealised P&L delta in ZAR as exact decimal MoneyWire. */
  readonly unrealisedPnlZar: MoneyWire;
}

export function encodeFxPositionRevalued(
  base: Omit<FxPositionRevaluedPayload, "notionalBaseMinor" | "unrealisedPnlZarMinor">,
  notionalBase: Money,
  unrealisedPnlZar: Money,
): FxPositionRevaluedPayloadV2 {
  return {
    ...base,
    notionalBase: encodeMoney(notionalBase),
    unrealisedPnlZar: encodeMoney(unrealisedPnlZar),
  };
}

export function decodeFxPositionRevalued(
  raw: FxPositionRevaluedPayload,
): FxPositionRevaluedPayloadV2 {
  const [baseCcy = "ZAR"] = raw.currencyPair.split("/");
  const { notionalBaseMinor, unrealisedPnlZarMinor, ...rest } = raw;
  return {
    ...rest,
    notionalBase: moneyWireFromMinor(notionalBaseMinor, baseCcy),
    unrealisedPnlZar: moneyWireFromMinor(unrealisedPnlZarMinor, "ZAR"),
  };
}

// ── SubLedgerLeg V2 ─────────────────────────────────────────────────────────
//
// DROP complete (D-DECIMAL-NATIVE-CONSUMER-MIGRATION-BEFORE-WAVE-3). The schema
// DROP retired `amountMinor`; `SubLedgerLeg` now carries only `amount: MoneyWire`.
// The V2 aliases and decode helpers are kept as thin pass-throughs for any
// callers that imported them; they will be removed in a follow-up tidy.

/** @deprecated DROP complete — SubLedgerLeg is now equivalent to V2. */
export type SubLedgerLegLegacy = SubLedgerLeg;

/** @deprecated DROP complete — SubLedgerLeg.amount is already a MoneyWire. */
export type SubLedgerLegV2 = SubLedgerLeg;

export function encodeSubLedgerLeg(
  base: Omit<SubLedgerLeg, "amount">,
  amount: Money,
): SubLedgerLegV2 {
  return { ...base, amount: encodeMoney(amount) };
}

/**
 * Decode a raw wire leg into SubLedgerLeg. After the DROP, `amount` is always
 * a MoneyWire on new events. Old stored events that carried `amountMinor` (but
 * no `amount`) are handled by `legAmountMoney` in money-codec.ts; this function
 * now just passes through the parsed leg.
 * @deprecated DROP complete — SubLedgerLeg.amount is already a MoneyWire.
 */
export function decodeSubLedgerLeg(raw: SubLedgerLeg): SubLedgerLegV2 {
  return raw;
}

/** @deprecated DROP complete — SubLedgerPostingEmittedPayload legs are already V2. */
export type SubLedgerPostingEmittedPayloadLegacy = SubLedgerPostingEmittedPayload;

/** @deprecated DROP complete — SubLedgerPostingEmittedPayload is already V2-shaped. */
export type SubLedgerPostingEmittedPayloadV2 = SubLedgerPostingEmittedPayload;

export function decodeSubLedgerPostingEmitted(
  raw: SubLedgerPostingEmittedPayload,
): SubLedgerPostingEmittedPayloadV2 {
  return raw;
}

// ── RealisedPnlRecognised V2 ─────────────────────────────────────────────────

/** @deprecated DECIMAL-MIGRATION: superseded by RealisedPnlRecognisedPayloadV2. */
export type RealisedPnlRecognisedPayloadLegacy = RealisedPnlRecognisedPayload;

export interface RealisedPnlRecognisedPayloadV2
  extends Omit<RealisedPnlRecognisedPayload, "amountClosedMinor" | "realisedPnlZarMinor"> {
  readonly amountClosed: MoneyWire;
  readonly realisedPnlZar: MoneyWire;
}

export function encodeRealisedPnlRecognised(
  base: Omit<RealisedPnlRecognisedPayload, "amountClosedMinor" | "realisedPnlZarMinor">,
  amountClosed: Money,
  realisedPnlZar: Money,
): RealisedPnlRecognisedPayloadV2 {
  return {
    ...base,
    amountClosed: encodeMoney(amountClosed),
    realisedPnlZar: encodeMoney(realisedPnlZar),
  };
}

export function decodeRealisedPnlRecognised(
  raw: RealisedPnlRecognisedPayload,
): RealisedPnlRecognisedPayloadV2 {
  const { amountClosedMinor, realisedPnlZarMinor, ...rest } = raw;
  return {
    ...rest,
    amountClosed: moneyWireFromMinor(amountClosedMinor, raw.currency),
    realisedPnlZar: moneyWireFromMinor(realisedPnlZarMinor, "ZAR"),
  };
}

// ---------------------------------------------------------------------------
// FxBookValuationSnapshotted
//
// EOD snapshot of the FX book's gross value by instrument. Emitted once per
// EOD run by the FX valuation runner (platform/markets/eod/fx-valuation-eod.ts)
// after the Δ(gross) GL posting has been written.
//
// The snapshot is the CANONICAL prior-day anchor for the next EOD run:
//   look-back: SELECT payload FROM events
//              WHERE type='FxBookValuationSnapshotted'
//              AND json_extract(payload,'$.snapshotDate') < <asOf>
//              ORDER BY sequence DESC LIMIT 1
//
// Missed-run policy: if no prior snapshot exists, isFirstRun = true →
// prior gross = 0 → post full current gross as unrealised P&L baseline.
//
// Category "accounting": derived snapshot; MUST survive config-only purges
// so the prior-day anchor is never lost. If purged, isFirstRun=true re-
// establishes the baseline (no silent gap).
//
// Authority:
//   - D-FIL-BOOK-COMPOSITE-VALUATION (CEO-approved 2026-06-13)
//   - IAS-21-§23 (monetary items retranslated at closing rate)
//   - IFRS-9-§5.7.1 (FVTPL changes through P&L)
//
// Author: Atlas (Core banking platform architect, engineering).
//
// MV-FX-A4-004 targeted sign-off (inline):
//   Atlas confirms: FxBookValuationSnapshotted defines the prior-day sourcing.
//   Look-back query: SELECT payload FROM events WHERE
//     type='FxBookValuationSnapshotted'
//     AND json_extract(payload,'$.snapshotDate') < <asOf>
//     ORDER BY sequence DESC LIMIT 1.
//   Missed-run policy: if no prior snapshot, isFirstRun=true → prior gross = 0
//   → post full current gross as unrealised P&L baseline.
//   Nadia (Model Validator, engineering) pre-validated the Δ(gross) arithmetic
//   in ModelValidationApproved 99cb4f72-ef37-405f-bfaa-8a4208418aa5 (PR #1326);
//   this snapshot operationalises the sourcing mechanism addressed by
//   MV-FX-A4-004. MV-FX-A4-004 CLOSED.
// ---------------------------------------------------------------------------

export interface FxBookValuationSnapshottedPayload {
  /** YYYY-MM-DD valuation date of this snapshot. */
  snapshotDate: string;
  /** Attribution book dimension value (e.g. "fx-trading"). */
  bookId: string;
  /** Per-instrument valuations making up the book gross value. */
  valuationsByInstrument: Array<{
    instrumentId: string;
    /** Gross value in ZAR reporting currency (MoneyWire). */
    grossValueZar: MoneyWire;
    /** Gross value in native FCY (MoneyWire). */
    grossValueFcy: MoneyWire;
    /** ISO 4217 native currency of this instrument. */
    currency: string;
  }>;
  /** Σ grossValueZar across all instruments (MoneyWire, ZAR). */
  totalGrossValueZar: MoneyWire;
  /** Closing rates used for this snapshot: { "USD": "18.45", ... } */
  closingRates: Record<string, string>;
  /**
   * true when no prior FxBookValuationSnapshotted exists for this book
   * (i.e. the first-ever EOD run — prior gross = 0 by definition).
   */
  isFirstRun: boolean;
}

export function makeFxBookValuationSnapshotted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FxBookValuationSnapshottedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("FxBookValuationSnapshotted requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FxBookValuationSnapshotted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: args.payload,
  });
}

// ---------------------------------------------------------------------------
// NostroDesignationMissing
//
// Emitted when a settlement routing step cannot resolve a designated nostro
// account for a given currency. This is the fail-closed rejection event:
// rather than routing to a suspense account, the substrate rejects the trade
// at the settlement-routing step with an explicit typed record.
//
// Key invariant (any-pair nostro fail-close): the OTC FX product scope v1.0
// supports "any currency pair" (D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL). The
// nostro routing registry must either resolve to a designated correspondent
// nostro account, OR reject explicitly — never route to suspense.
//
// Authority:
//   - D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO, 2026-06-15)
//   - PROC-OPS-SFBCP-01 v0.2 §3.1 — settlement routing prerequisites
//   - Principle 4 (fail-closed by default — security designed in)
// Author: Tomas (Operations and payments engineer, engineering)
// ---------------------------------------------------------------------------

export const nostroDesignationMissingPayloadSchema = z.object({
  /** Internal trade identifier — links back to the originating FxTradeExecuted. */
  tradeRef: z.string().min(1),
  /** ISO 4217 currency code for which no nostro is designated. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** The settlement leg kind ("near" or "far") that triggered the lookup. */
  legKind: z.enum(["near", "far"]),
  /**
   * Reason the routing failed. Typically "no-designated-nostro" for an
   * unprovisioned currency.
   */
  reason: z.string().min(1),
});

export type NostroDesignationMissingPayload = z.infer<typeof nostroDesignationMissingPayloadSchema>;

export function makeNostroDesignationMissing(args: {
=======
// FxForwardPointsAccrued
//
// Emitted daily by Bea's close engine for each open FX forward or swap
// far-leg position. Drives amortisation of the forward premium/discount
// (forward rate − spot rate at trade date) × notional FCY over the tenor.
//
// IAS 21.28 requires the exchange difference arising from the settlement of a
// monetary item — including forward contracts — to be recognised in profit or
// loss in the period in which it arises. For derivatives held at FVTPL the
// time-value component (forward points) must be separated and amortised on a
// straight-line basis over the contract life, with the cumulative balance
// cleared on the final settlement date.
//
// Forward points = (contractedForwardRate − spotRateAtTradeDate) × notionalFcyMinor
// Daily portion = total forward points / tenorCalendarDays
//
// Payload conventions:
//   dailyAmortisedZarMinor  — signed ZAR amount for this day's accrual slice
//                             (positive = forward premium → income; negative =
//                              forward discount → expense).
//   accruedToDateZarMinor   — running cumulative forward-points balance
//                             (for reconciliation; not a separate GL post).
//   isFinalAccrual          — true on the last accrual day (maturity/settlement).
//                             The interpreter uses this flag to clear the
//                             cumulative deferred-income/expense balance to P&L.
//
// Authority:
//   - IAS 21 §28 (exchange differences on settlement)
//   - D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15)
//   - D-FX-OTC-NPA-SCOPE-EXPANSION (gap closure)
//
// Author: Nadia (Model validation engineer, engineering).
// ---------------------------------------------------------------------------

export const fxForwardPointsAccruedPayloadSchema = z.object({
  /** Internal trade identifier — links back to the originating FxTradeExecuted. */
  tradeId: z.string().min(1),
  /**
   * The leg this accrual covers: "far" for an FX swap far-leg, "outright" for
   * a standalone FX forward.
   */
  legKind: z.enum(["outright", "far"]),
  /** Currency pair (e.g. "USD/ZAR"). Canonical form: base/quote. */
  currencyPair: z.string().min(1),
  /** Contracted forward rate (ZAR per FCY unit) agreed at trade date. */
  contractedForwardRate: z.number().positive(),
  /** Spot rate at trade date used to compute forward points. */
  spotRateAtTradeDate: z.number().positive(),
  /** FCY notional of the leg, in minor units. */
  notionalFcyMinor: z.number().int().positive(),
  /**
   * Forward-points total for the entire contract (signed ZAR minor units):
   *   = (contractedForwardRate − spotRateAtTradeDate) × notionalFcyMinor
   * Positive = premium (bank earns income); negative = discount (bank incurs cost).
   */
  totalForwardPointsZarMinor: z.number().int(),
  /**
   * Signed ZAR minor units accrued for TODAY — the daily straight-line slice.
   * = totalForwardPointsZarMinor / tenorCalendarDays (rounded; last day absorbs remainder).
   */
  dailyAmortisedZarMinor: z.number().int(),
  /**
   * Running cumulative forward-points recognised to date (inclusive of today),
   * in ZAR minor units. Used for reconciliation; does not drive a separate posting.
   */
  accruedToDateZarMinor: z.number().int(),
  /** Total calendar days in the tenor (from trade date to settlement date inclusive). */
  tenorCalendarDays: z.number().int().positive(),
  /** ISO 8601 date of the forward settlement / maturity (YYYY-MM-DD). */
  settlementDate: z.string().min(1),
  /**
   * true when this is the final (maturity-date) accrual. On `isFinalAccrual`,
   * the PR-FX-FWD-POINTS-ACCRUAL rule must ALSO clear the cumulative
   * deferred-income/expense balance to the forward-points P&L account.
   */
  isFinalAccrual: z.boolean(),
  /** ISO 8601 date of this accrual computation (YYYY-MM-DD). */
  accrualDate: z.string().min(1),
});

export type FxForwardPointsAccruedPayload = z.infer<typeof fxForwardPointsAccruedPayloadSchema>;

export function makeNostroDesignationMissing(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: NostroDesignationMissingPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "NostroDesignationMissing requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "NostroDesignationMissing",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: nostroDesignationMissingPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FxForwardDefaulted
//
// Emitted when a counterparty defaults on a forward contract at or before
// maturity. Triggers the ISDA §6 close-out netting calculation. Applies to:
//   - FX forward contracts (productTaxonomy = "FX-forward"): counterparty
//     fails to deliver the far leg at the agreed forward value date.
//   - FX swap far-leg failure: the near leg has already settled; the far leg
//     defaults. Net exposure = far-leg notional net of near-leg mark-to-market.
//
// Handler responsibilities:
//   1. Update trade/position status to "defaulted" in the sub-ledger.
//   2. Emit a SubstrateAlert (integrity, high) for ops notification.
//   3. Trigger close-out netting calculation per ISDA Master Agreement §6.
//   4. Hold position — do NOT automatically book the recovery; await the
//      close-out net settlement event (out of scope for this event).
//
// Authority:
//   - ISDA 2002 Master Agreement §6 (Early Termination on default)
//   - D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO, 2026-06-15)
//   - BCBS d226 §4 — credit risk in FX settlement; Herstatt analogue
// Author: Tomas (Operations and payments engineer, engineering)
// ---------------------------------------------------------------------------

export const fxForwardDefaultedPayloadSchema = z.object({
  /** Internal trade identifier — links back to the originating FxTradeExecuted. */
  tradeRef: z.string().min(1),
  /** ISO 4217 base currency of the forward contract. */
  baseCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** ISO 4217 quote currency of the forward contract. */
  quoteCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** Agreed forward settlement date (YYYY-MM-DD). */
  maturityDate: z.string().min(1),
  /**
   * Whether the bank has already delivered its own leg before learning of the
   * default (true = Herstatt-active on forward; far-leg analogue of
   * one-leg-delivered). If false, neither leg has settled (mutual fail on
   * forward/far-leg).
   */
  bankLegDelivered: z.boolean(),
  /**
   * Counterparty legal entity ID (matches party register).
   * Required for ISDA §6 close-out netting — the netting set is keyed by
   * counterparty under the applicable ISDA Master Agreement.
   */
  counterpartyId: z.string().min(1),
  /** Free-form default trigger description (e.g. "payment failure at CLS"). */
  defaultReason: z.string().min(1),
});

export type FxForwardDefaultedPayload = z.infer<typeof fxForwardDefaultedPayloadSchema>;

export function makeFxForwardDefaulted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FxForwardDefaultedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "FxForwardDefaulted requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FxForwardDefaulted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fxForwardDefaultedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FxForwardExtensionRequested
//
// Emitted when a counterparty requests an extension of a forward contract's
// maturity date. Requires re-booking the trade at the new forward rate for
// the extended value date (cancelling the original deal and booking a
// replacement at the current market forward rate for the new maturity).
//
// Handler responsibilities:
//   1. Mark the original trade as pending extension in the sub-ledger.
//   2. Emit a SubstrateAlert (integrity, medium) for desk notification.
//   3. The actual re-booking (FxTradeExecuted at new rate) is a separate
//      downstream step — this event records the request and holds the trade.
//
// Authority:
//   - D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO, 2026-06-15)
//   - ISDA 2002 Master Agreement §2(c) (payment netting on extension)
// Author: Tomas (Operations and payments engineer, engineering)
// ---------------------------------------------------------------------------

export const fxForwardExtensionRequestedPayloadSchema = z.object({
  /** Internal trade identifier — links back to the originating FxTradeExecuted. */
  tradeRef: z.string().min(1),
  /** Counterparty that requested the extension. */
  counterpartyId: z.string().min(1),
  /** Original agreed maturity / value date (YYYY-MM-DD). */
  originalMaturityDate: z.string().min(1),
  /** Proposed new maturity date requested by the counterparty (YYYY-MM-DD). */
  requestedNewMaturityDate: z.string().min(1),
  /** Free-form reason for the extension request. */
  extensionReason: z.string().min(1),
});

export type FxForwardExtensionRequestedPayload = z.infer<
  typeof fxForwardExtensionRequestedPayloadSchema
>;

export function makeFxForwardExtensionRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FxForwardExtensionRequestedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "FxForwardExtensionRequested requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FxForwardExtensionRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fxForwardExtensionRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FxForwardPointsAccrued
//
// Emitted daily by Bea's close engine for each open FX forward or swap
// far-leg position. Drives amortisation of the forward premium/discount
// (forward rate − spot rate at trade date) × notional FCY over the tenor.
//
// IAS 21.28 requires the exchange difference arising from the settlement of a
// monetary item — including forward contracts — to be recognised in profit or
// loss in the period in which it arises. For derivatives held at FVTPL the
// time-value component (forward points) must be separated and amortised on a
// straight-line basis over the contract life, with the cumulative balance
// cleared on the final settlement date.
//
// Forward points = (contractedForwardRate − spotRateAtTradeDate) × notionalFcyMinor
// Daily portion = total forward points / tenorCalendarDays
//
// Payload conventions:
//   dailyAmortisedZarMinor  — signed ZAR amount for this day's accrual slice
//                             (positive = forward premium → income; negative =
//                              forward discount → expense).
//   accruedToDateZarMinor   — running cumulative forward-points balance
//                             (for reconciliation; not a separate GL post).
//   isFinalAccrual          — true on the last accrual day (maturity/settlement).
//                             The interpreter uses this flag to clear the
//                             cumulative deferred-income/expense balance to P&L.
//
// Authority:
//   - IAS 21 §28 (exchange differences on settlement)
//   - D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15)
//   - D-FX-OTC-NPA-SCOPE-EXPANSION (gap closure)
//
// Author: Nadia (Model validation engineer, engineering).
// ---------------------------------------------------------------------------

export function makeFxForwardPointsAccrued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FxForwardPointsAccruedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "FxForwardPointsAccrued requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FxForwardPointsAccrued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fxForwardPointsAccruedPayloadSchema.parse(args.payload),
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
  // A4 — EOD book valuation snapshot (D-FIL-BOOK-COMPOSITE-VALUATION).
  "FxBookValuationSnapshotted",
  // OTC FX operational-readiness runbook events
  // (Tomas — Operations and payments engineer, engineering).
  // Authority: D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO, 2026-06-15).
  "NostroDesignationMissing",
  "FxForwardDefaulted",
  "FxForwardExtensionRequested",
  // IAS 21 §28 forward-points amortisation (D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL gap closure).
  // Authority: Nadia (Model validation engineer, engineering).
  "FxForwardPointsAccrued",
] as const;

export type FxAccountingEventType = (typeof FX_ACCOUNTING_EVENT_TYPES)[number];
