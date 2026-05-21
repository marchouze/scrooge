// platform/markets/cdm/fx.ts
//
// CDM FX event types — M4 foundation slice. Four typed payload shapes:
//   - FxTradeExecuted          — an FX trade (Spot / Forward / Swap / NDF)
//                                 has been agreed and recorded. The
//                                 `bookType` discriminator is REQUIRED on
//                                 FX `TradeExecuted` payloads from M4
//                                 onwards (see citation §1 below).
//   - FxSettlementInstructed   — settlement instruction issued for an FX
//                                 trade leg; pairs with a downstream
//                                 Tomas-domain event (correspondent-bank
//                                 SWIFT MT202 / pacs.009 path per the
//                                 D-FX-CLS-MEMBERSHIP correspondent-routing
//                                 decision).
//
// Per CLAUDE.md Principle 1 (events as truth) — the typed payload is the
// canonical record of the trade; positions, P&L, FinSurv submissions, and
// IFRS sub-ledger postings are projections derived from this stream.
//
// Per CLAUDE.md Principle 5 (multi-currency from day one) — every FX
// shape carries its currency pair at the type level via
// `currencyPairSchema`; there is no default currency anywhere.
//
// Per CLAUDE.md Principle 2 (every action carries a citation) — every
// emitted FX event must carry its citation set on the envelope. This
// module does not enforce citation-content (that's the citation gate's
// job) but the call-sites in §6 of the FX product-family proposal carry
// the canonical citation seed.
//
// Authority:
//   §1. `Owner Inbox/2026-05-07_saskia-kai_fx-product-family.md` —
//       FX variants 1–4 (Spot, Forward, Swap, NDF), §3 (zero new event
//       types — FX uses `TradeExecuted` with discriminators), §4
//       (worked compositions), §10 (M4 phase placement).
//   §2. `Owner Inbox/2026-05-07_ceo-decisions_fx-sub-decisions.md` —
//       D-FX-BOOK-BOUNDARY (bookType required on FX TradeExecuted from
//       M4); D-FX-CLS-MEMBERSHIP (correspondent-routing for settlement);
//       D-FX-AD-STATUS (full Authorised Dealer — drives FinSurv reporting
//       on every cross-border FX flow).
//   §3. `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md`
//       §6 (TradeExecuted lifecycle).
//   §4. ORG-MK-08 — Currency and Exchanges Manual (Excon), Authorised
//       Dealer rules.
//   §5. ORG-EXCON-ODP-001 — non-resident counterparty OTC derivative
//       FinSurv reporting + AD compliance.
//
// Author: Saskia (Head of Global Markets) · Kai (trading systems engineer)
// — M4 foundation slice per D-MARKETS-SCHEMA-FOUNDATION (CEO approved
// 2026-05-07) and the FX sub-decisions (CEO approved 2026-05-07).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../../event-store/types";
import {
  bookTypeSchema,
  cdmDateSchema,
  currencyPairSchema,
  identifierSchema,
  moneySchema,
  partySchema,
  priceSchema,
} from "./primitives";

// ---------------------------------------------------------------------------
// FX product-taxonomy discriminator — names the M4 in-scope variants.
// CCS lives at M3 (per FX product-family §10) and is not part of M4.
// FX vanilla/exotic options ship at M5. This enum is M4-scoped.
// ---------------------------------------------------------------------------

export const fxProductTaxonomySchema = z.enum(["FX-spot", "FX-forward", "FX-swap", "NDF"]);

export type FxProductTaxonomy = z.infer<typeof fxProductTaxonomySchema>;

// ---------------------------------------------------------------------------
// Settlement-path discriminator — "correspondent" is the default per
// D-FX-CLS-MEMBERSHIP (correspondent routing for FX settlement; the bank
// does NOT join CLS directly). "bilateral" is reserved for the rare
// non-correspondent path (typically EM currency pairs the correspondent
// does not cover); each bilateral instance carries the `[citation: TBC]`
// gap until the Tomas Herstatt-risk runbook lands.
// ---------------------------------------------------------------------------

export const fxSettlementPathSchema = z.enum(["correspondent", "bilateral"]);

export type FxSettlementPath = z.infer<typeof fxSettlementPathSchema>;

// ---------------------------------------------------------------------------
// Settlement-form discriminator — physical (deliverable, both legs move)
// for Spot/Forward/Swap; cash (single-currency settlement against an NDF
// fixing) for NDF.
// ---------------------------------------------------------------------------

export const fxSettlementFormSchema = z.enum(["physical", "cash"]);

export type FxSettlementForm = z.infer<typeof fxSettlementFormSchema>;

// ---------------------------------------------------------------------------
// FxLeg — one currency leg of an FX trade. Spot/Forward/NDF have one or
// two legs depending on framing; Swap always has two legs in opposite
// directions (spot leg + forward leg). Per CDM §4.3 (FX product-family
// proposal), each leg carries its own settlement date and notional.
// ---------------------------------------------------------------------------

export const fxLegSchema = z.object({
  /**
   * Leg kind. For Spot/Forward/NDF a single "near" leg is used. For Swap,
   * exactly one "near" leg + one "far" leg, in opposite directions.
   */
  legKind: z.enum(["near", "far"]),
  /**
   * The currency this leg pays out in (one of the pair's two currencies).
   * The bank's perspective: positive `notional.amountMinor` means the
   * bank receives this currency at settlement.
   */
  payCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /**
   * The currency this leg pays for (the counter currency of the pay).
   * For Spot leg: payCurrency / receiveCurrency together form the pair.
   */
  receiveCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /**
   * Notional traded in the pay currency. notional.currency MUST equal
   * payCurrency. For a BUY trade on a major-first pair, this is the
   * quote-currency amount; for a SELL trade, the base-currency amount.
   */
  notional: moneySchema,
  /**
   * Counter-notional received in the receive currency.
   * counterNotional.currency MUST equal receiveCurrency. Always equal in
   * magnitude to notional × rate (within rounding to minor units).
   */
  counterNotional: moneySchema,
  /**
   * Agreed rate for this leg, expressed as quote-per-base — i.e. units of
   * currencyPair.quote per one unit of currencyPair.base. rate.currency
   * MUST equal currencyPair.quote. ACI Model Code §2;
   * D-FX-QUOTING-CONVENTION.
   */
  rate: priceSchema,
  /** Settlement date for this leg. */
  settlementDate: cdmDateSchema,
});

export type FxLeg = z.infer<typeof fxLegSchema>;

// ---------------------------------------------------------------------------
// FxTradeExecuted
//
// The canonical FX trade event. Per the FX sub-decision D-FX-BOOK-BOUNDARY,
// `bookType` is REQUIRED on every FX TradeExecuted from M4 onwards.
//
// One FxTradeExecuted covers Spot, Forward, Swap, and NDF — the
// `productTaxonomy` discriminator names which variant; the `legs` array
// carries the per-leg detail (1 leg for Spot/Forward/NDF, 2 legs for Swap).
// ---------------------------------------------------------------------------

export const fxTradeExecutedPayloadSchema = z
  .object({
    /** Stable trade identifier — internal trade-id with venue-id cross-reference. */
    tradeId: identifierSchema,
    /**
     * Product taxonomy — required discriminator. Drives downstream
     * dispatch (Bea IFRS classifier, Rohan FRTB risk-factor mapping,
     * Mira FinSurv categorisation, Tomas settlement-path routing).
     */
    productTaxonomy: fxProductTaxonomySchema,
    /**
     * Currency pair traded. Per Principle 5 — every FX shape is
     * multi-currency at the type level; no implicit "ZAR vs other".
     */
    currencyPair: currencyPairSchema,
    /** Side of the trade from the bank's perspective on the near leg. */
    side: z.enum(["buy", "sell"]),
    /**
     * Per-leg detail. Spot/Forward/NDF: exactly one "near" leg.
     * Swap: exactly one "near" + one "far" leg.
     */
    legs: z.array(fxLegSchema).min(1).max(2),
    /** Trade date (when agreed). */
    tradeDate: cdmDateSchema,
    /** Counterparty. */
    counterparty: partySchema,
    /** Trading venue (e.g. "OTC", "JSE-FX", "EBS", "Refinitiv"). */
    venue: z.string().min(1),
    /** Trader identifier (FIX SenderCompID equivalent). */
    trader: z.string().min(1),
    /** Book identifier — which trading book / strategy this is allocated to. */
    bookId: z.string().min(1),
    /**
     * Markets-vs-treasury book discriminator. REQUIRED on every FX
     * TradeExecuted from M4 onwards per D-FX-BOOK-BOUNDARY. Bea's IFRS
     * classification rules dispatch on this value; Rohan's risk-method
     * dispatch reads it; Camille's capital reporting reads it.
     */
    bookType: bookTypeSchema,
    /**
     * Settlement-form discriminator. Spot/Forward/Swap → "physical";
     * NDF → "cash" (single-currency settlement against fixing).
     */
    settlementForm: fxSettlementFormSchema,
    /**
     * Settlement-path discriminator. Default per D-FX-CLS-MEMBERSHIP is
     * "correspondent" (CLS-member correspondent bank settles via
     * SWIFT MT202 / pacs.009). "bilateral" is the exception path.
     */
    settlementPath: fxSettlementPathSchema,
    /**
     * NDF-only: the fixing source (e.g. "SARB-ZAR-Fixing-1600-SAST",
     * "EMTA-ZAR-FIX"). Required when productTaxonomy = "NDF"; ignored
     * otherwise.
     */
    ndfFixingSource: z.string().optional(),
    /**
     * NDF-only: the settlement currency (the currency the NDF cash-settles
     * in — typically the foreign-currency leg of the pair). Required when
     * productTaxonomy = "NDF"; ignored otherwise.
     */
    ndfSettlementCurrency: z
      .string()
      .length(3)
      .regex(/^[A-Z]{3}$/)
      .optional(),
    /**
     * SARB FinSurv category code per the Currency and Exchanges Manual
     * for Authorised Dealers. Required for ZAR-vs-foreign trades (FX
     * trades that touch ZAR are FinSurv-reportable; the bank as full
     * Authorised Dealer per D-FX-AD-STATUS reports directly).
     * `[citation: TBC]` for the URN cluster — Mira to populate at M4
     * substrate-completion.
     */
    finsurvCategory: z.string().optional(),
    /**
     * No-prop attribution — client-flow reference. Opaque pointer to the
     * client trade or RFQ this position offsets (e.g.
     * `client-trade:NK-2026-05-20-00041`). Exactly one of
     * `clientFlowRef` or `hedgeProgrammeRef` MUST be present — this is
     * the no-prop invariant at the type level. See refinement below.
     */
    clientFlowRef: z.string().min(1).optional(),
    /**
     * No-prop attribution — sanctioned-hedge reference. Opaque pointer
     * to a hedge programme the position implements (e.g.
     * `hedge-programme:fx-translation-zar-usd-2026Q2`). Exactly one of
     * `clientFlowRef` or `hedgeProgrammeRef` MUST be present — this is
     * the no-prop invariant at the type level. See refinement below.
     */
    hedgeProgrammeRef: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    // FX-Swap requires exactly two legs — one "near", one "far".
    if (data.productTaxonomy === "FX-swap") {
      if (data.legs.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "FX-swap requires exactly two legs (one near, one far)",
          path: ["legs"],
        });
        return;
      }
      const kinds = data.legs.map((l) => l.legKind).sort();
      if (kinds.join(",") !== "far,near") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "FX-swap requires one 'near' leg and one 'far' leg",
          path: ["legs"],
        });
      }
    } else {
      // Spot / Forward / NDF — exactly one "near" leg.
      if (data.legs.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${data.productTaxonomy} requires exactly one leg`,
          path: ["legs"],
        });
        return;
      }
      if (data.legs[0]?.legKind !== "near") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${data.productTaxonomy} leg must be of kind 'near'`,
          path: ["legs", 0, "legKind"],
        });
      }
    }

    // NDF requires fixing source + settlement currency.
    if (data.productTaxonomy === "NDF") {
      if (!data.ndfFixingSource) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "NDF requires ndfFixingSource",
          path: ["ndfFixingSource"],
        });
      }
      if (!data.ndfSettlementCurrency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "NDF requires ndfSettlementCurrency",
          path: ["ndfSettlementCurrency"],
        });
      }
      if (data.settlementForm !== "cash") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "NDF must have settlementForm = 'cash'",
          path: ["settlementForm"],
        });
      }
    }

    // Spot/Forward/Swap must be physical settlement.
    if (data.productTaxonomy !== "NDF" && data.settlementForm !== "physical") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${data.productTaxonomy} must have settlementForm = 'physical'`,
        path: ["settlementForm"],
      });
    }

    // -----------------------------------------------------------------
    // Quoting-convention invariants (D-FX-QUOTING-CONVENTION, Option A).
    //
    // The five-clause invariant that pins how price / notional /
    // counter-notional relate on every leg:
    //   (i)   payCurrency, receiveCurrency ∈ {currencyPair.base, currencyPair.quote}
    //         (with payCurrency ≠ receiveCurrency).
    //   (ii)  notional.currency = payCurrency.
    //   (iii) counterNotional.currency = receiveCurrency.
    //   (iv)  rate.currency = currencyPair.quote (rate is quote-per-base).
    //   (v)   Side coherence: side="buy" → payCurrency = quote,
    //         receiveCurrency = base; side="sell" → payCurrency = base,
    //         receiveCurrency = quote.
    //
    // Authority:
    //   - D-FX-QUOTING-CONVENTION (CEO-approved 2026-05-21)
    //   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
    //   - PR #654 (pair-direction precedent — ACI Model Code §2)
    //
    // Forward-only schema change. Pre-existing FxTradeExecuted events
    // that pre-date this refinement may fail re-parse; the
    // recon:fx-quoting-convention advisory pipeline surfaces them so
    // Slice 3b (Devon — sim generator simplification) can repair the
    // sim substrate without blocking CI on legacy events.
    // -----------------------------------------------------------------
    for (const [i, leg] of data.legs.entries()) {
      const { base, quote } = data.currencyPair;
      // (i) Pay/receive currencies must be the pair's two currencies.
      const pairCurrencies = new Set([base, quote]);
      if (!pairCurrencies.has(leg.payCurrency)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["legs", i, "payCurrency"],
          message: `payCurrency '${leg.payCurrency}' must be one of currencyPair {${base}, ${quote}}`,
        });
      }
      if (!pairCurrencies.has(leg.receiveCurrency)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["legs", i, "receiveCurrency"],
          message: `receiveCurrency '${leg.receiveCurrency}' must be one of currencyPair {${base}, ${quote}}`,
        });
      }
      if (leg.payCurrency === leg.receiveCurrency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["legs", i, "payCurrency"],
          message: "payCurrency and receiveCurrency must differ",
        });
      }
      // (ii) Notional must be in pay currency.
      if (leg.notional.currency !== leg.payCurrency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["legs", i, "notional", "currency"],
          message: `notional.currency '${leg.notional.currency}' must equal payCurrency '${leg.payCurrency}'`,
        });
      }
      // (iii) Counter-notional must be in receive currency.
      if (leg.counterNotional.currency !== leg.receiveCurrency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["legs", i, "counterNotional", "currency"],
          message: `counterNotional.currency '${leg.counterNotional.currency}' must equal receiveCurrency '${leg.receiveCurrency}'`,
        });
      }
      // (iv) Rate is quote-per-base; rate.currency must equal pair quote.
      if (leg.rate.currency !== quote) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["legs", i, "rate", "currency"],
          message: `rate.currency '${leg.rate.currency}' must equal currencyPair.quote '${quote}' (rate is quote-per-base; D-FX-QUOTING-CONVENTION)`,
        });
      }
      // (v) Side coherence: BUY → pay quote, receive base;
      //                     SELL → pay base, receive quote.
      const expectedPay = data.side === "buy" ? quote : base;
      const expectedReceive = data.side === "buy" ? base : quote;
      if (leg.payCurrency !== expectedPay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["legs", i, "payCurrency"],
          message: `side '${data.side}' requires payCurrency '${expectedPay}', got '${leg.payCurrency}'`,
        });
      }
      if (leg.receiveCurrency !== expectedReceive) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["legs", i, "receiveCurrency"],
          message: `side '${data.side}' requires receiveCurrency '${expectedReceive}', got '${leg.receiveCurrency}'`,
        });
      }
    }

    // -----------------------------------------------------------------
    // No-prop attribution invariant.
    //
    // Every FxTradeExecuted MUST carry exactly one of `clientFlowRef`
    // or `hedgeProgrammeRef`. Neither field present means a position
    // exists with no audit-time evidence that it is client-driven or
    // hedge-driven — i.e. it is indistinguishable from proprietary
    // risk-taking. Both fields present is incoherent (a single trade
    // cannot simultaneously offset a client RFQ AND implement a
    // sanctioned hedge programme — pick one).
    //
    // This refinement is the no-prop invariant at the type level.
    // Without it, `Policies/trading-mandate-v1.md` §5 (positive
    // enumeration; no proprietary positions) cannot be asserted from
    // the event store at audit time, and the downstream
    // `recon:no-prop-attribution` gate has no carrying field to read.
    //
    // Forward-only schema change. The production event store carries
    // no `FxTradeExecuted` events until the first live FX trade after
    // D-MARKETS-SCHEMA-FOUNDATION substrate goes live; no historical
    // backfill is required. Authority:
    //   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
    //   - Policies/trading-mandate-v1.md §5
    //   - Helena (Chief Risk Officer, governance) FX-spot-only
    //     market-risk scope review (2026-05-20) §6 gap G-3
    // -----------------------------------------------------------------
    const hasClientFlow = typeof data.clientFlowRef === "string";
    const hasHedgeProgramme = typeof data.hedgeProgrammeRef === "string";
    if (!hasClientFlow && !hasHedgeProgramme) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "FxTradeExecuted requires exactly one of clientFlowRef or hedgeProgrammeRef (no-prop invariant per trading-mandate-v1 §5)",
        path: ["clientFlowRef"],
      });
    } else if (hasClientFlow && hasHedgeProgramme) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "FxTradeExecuted must carry exactly one of clientFlowRef or hedgeProgrammeRef, not both (no-prop invariant per trading-mandate-v1 §5)",
        path: ["clientFlowRef"],
      });
    }
  });

export type FxTradeExecutedPayload = z.infer<typeof fxTradeExecutedPayloadSchema>;

export function makeFxTradeExecuted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FxTradeExecutedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "FxTradeExecuted requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FxTradeExecuted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fxTradeExecutedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FxSettlementInstructed
//
// Settlement instruction for an FX trade leg. Per D-FX-CLS-MEMBERSHIP, the
// default path is "correspondent" — a CLS-member correspondent bank handles
// the actual currency exchange via PvP within CLS, and the bank instructs
// via SWIFT MT202 / pacs.009. The "bilateral" path is the exception (the
// Tomas Herstatt-risk runbook is required before bilateral can be used —
// substrate gap surfaced in the M4 completion brief).
// ---------------------------------------------------------------------------

export const fxSettlementMessageStandardSchema = z.enum([
  "SWIFT-MT202",
  "SWIFT-MT103",
  "SWIFT-MT300",
  "SWIFT-MT940",
  "ISO-20022-pacs.008",
  "ISO-20022-pacs.009",
  "ISO-20022-pacs.002",
  "ISO-20022-camt.052",
  "ISO-20022-camt.053",
  "ISO-20022-camt.054",
]);

export type FxSettlementMessageStandard = z.infer<typeof fxSettlementMessageStandardSchema>;

export const fxSettlementInstructedPayloadSchema = z.object({
  /** The trade this settlement instruction settles. */
  tradeId: identifierSchema,
  /**
   * Which leg of the trade (matters for FX-Swap; for Spot/Forward/NDF the
   * single near leg). Spot/Forward/Swap-near settle on T+2 (typically);
   * Swap-far settles on the forward date; NDF settles in cash on the
   * fixing-date + 2 BD.
   */
  legKind: z.enum(["near", "far"]),
  /** Stable settlement instruction identifier. */
  settlementId: identifierSchema,
  /**
   * Settlement-path discriminator. Default "correspondent" per
   * D-FX-CLS-MEMBERSHIP. "bilateral" is exception-path only.
   */
  settlementPath: fxSettlementPathSchema,
  /**
   * Settlement form — "physical" (two PvP confirmations under
   * correspondent-routed CLS, or two non-CLS bilateral confirmations) or
   * "cash" (single-currency settlement at the NDF fixing).
   */
  settlementForm: fxSettlementFormSchema,
  /**
   * The correspondent bank handling settlement, when settlementPath =
   * "correspondent". Convention: party with role "settlement-agent".
   * Required when path = "correspondent"; ignored when "bilateral".
   * Per D-FX-CLS-MEMBERSHIP cross-cutting follow-up: primary +
   * named-backup correspondent design owned by Devon + Tomas.
   */
  correspondent: partySchema.optional(),
  /** Counterparty settlement details (BIC + account). */
  counterparty: partySchema,
  /** Cash to pay (negative) or receive (positive) at settlement, in the settlement currency. */
  netCash: moneySchema,
  /** Settlement date for this leg. */
  settlementDate: cdmDateSchema,
  /**
   * Wire-message standard. Default is SWIFT-MT202 today; the bank's
   * migration target is ISO-20022 pacs.009 (per FX product-family §5).
   */
  messageStandard: fxSettlementMessageStandardSchema,
});

export type FxSettlementInstructedPayload = z.infer<typeof fxSettlementInstructedPayloadSchema>;

export function makeFxSettlementInstructed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FxSettlementInstructedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "FxSettlementInstructed requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  // Cross-field check: correspondent path requires a correspondent party.
  const parsed = fxSettlementInstructedPayloadSchema.parse(args.payload);
  if (parsed.settlementPath === "correspondent" && !parsed.correspondent) {
    throw new Error(
      "FxSettlementInstructed with settlementPath = 'correspondent' requires a correspondent party (D-FX-CLS-MEMBERSHIP).",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FxSettlementInstructed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: parsed,
  });
}

// ---------------------------------------------------------------------------
// PrincipalPayment
//
// Emitted when a settlement leg is actioned by the correspondent bank.
// Per D-FX-CLS-MEMBERSHIP, the correspondent notifies the bank when cash
// moves; this event records that notification and closes the instruction
// loop. Two PrincipalPayment events are emitted per FX Spot trade (one for
// each leg: deliver ZAR, receive USD).
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — correspondent-routing for FX settlement
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   D-FX-AD-STATUS — FinSurv reporting (AD rules require confirmation of
//     cross-border payment execution)
// ---------------------------------------------------------------------------

export const principalPaymentPayloadSchema = z.object({
  /** The trade this payment settles. */
  tradeId: z.string().min(1),
  /**
   * Which leg is being actioned: "receive" (bank receives currency) or
   * "deliver" (bank pays currency).
   */
  legKind: z.enum(["receive", "deliver"]),
  /** Currency pair traded (e.g. "ZAR/USD"). */
  currencyPair: z.string().min(1),
  /** ISO 4217 currency code for this payment leg. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /**
   * Net cash amount in minor units (cents). Positive = inflow (receive);
   * negative = outflow (deliver). Convention must match `legKind`.
   */
  netCash: z.number().int(),
  /** Settlement date for this leg (ISO 8601). */
  settlementDate: z.string().min(1),
  /**
   * Settlement path. Per D-FX-CLS-MEMBERSHIP the default is "correspondent";
   * bilateral is exception-path only.
   */
  settlementPath: z.literal("correspondent"),
  /** Correspondent bank that actioned this leg. */
  correspondent: z.object({
    name: z.string().min(1),
    bic: z.string().min(1),
  }),
  /** Optional confirmation reference from the correspondent. */
  settlementConfirmationRef: z.string().optional(),
  /** Citations — must not be empty (Principle 2). */
  citations: z.array(z.string().min(1)).min(1),
});

export type PrincipalPaymentPayload = z.infer<typeof principalPaymentPayloadSchema>;

export function makePrincipalPayment(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PrincipalPaymentPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "PrincipalPayment requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  if (!args.payload.citations || args.payload.citations.length === 0) {
    throw new Error("PrincipalPayment payload.citations must not be empty (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PrincipalPayment",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: principalPaymentPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SettlementConfirmed
//
// Final lifecycle event for an FX Spot (or Forward/Swap) trade. Emitted
// once both PrincipalPayment events have been recorded and the correspondent
// confirms that both legs have settled. Closes the FX Spot lifecycle.
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — correspondent confirmation path
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   D-FX-AD-STATUS — FinSurv reporting (FinSurv ref carried as optional field)
// ---------------------------------------------------------------------------

export const settlementConfirmedPayloadSchema = z.object({
  /** The trade whose settlement is now confirmed. */
  tradeId: z.string().min(1),
  /** Currency pair traded (e.g. "ZAR/USD"). */
  currencyPair: z.string().min(1),
  /** Date settlement was confirmed (ISO 8601). */
  settledDate: z.string().min(1),
  /**
   * Realised P&L delta in ZAR minor units (cents). Positive = profit;
   * negative = loss. Computed from execution rate vs settlement rate
   * (mark-to-settlement). The IAS-21 translation gain/loss is a separate
   * accounting event.
   */
  realisedPnlDelta: z.number().int(),
  /** Correspondent settlement reference (SWIFT confirmation ref). */
  settlementRef: z.string().min(1),
  /**
   * SARB FinSurv reporting reference, if applicable. Required for
   * ZAR/USD and other cross-border FX trades reportable under the
   * Currency and Exchanges Manual (D-FX-AD-STATUS). Optional until
   * the Mira FinSurv reporting substrate is complete.
   */
  finsurvReportingRef: z.string().optional(),
  /** Citations — must not be empty (Principle 2). */
  citations: z.array(z.string().min(1)).min(1),
});

export type SettlementConfirmedPayload = z.infer<typeof settlementConfirmedPayloadSchema>;

export function makeSettlementConfirmed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SettlementConfirmedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "SettlementConfirmed requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  if (!args.payload.citations || args.payload.citations.length === 0) {
    throw new Error("SettlementConfirmed payload.citations must not be empty (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SettlementConfirmed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: settlementConfirmedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// NdfFixingObserved
//
// FX-Forward (NDF variant) only. The NDF settles in a single currency
// (`ndfSettlementCurrency`) against a fixing rate observed on the fixing
// date (typically T-2 before settlement). This event records the
// fixing-rate observation and the resulting net-cash settlement amount.
// It is emitted between FxTradeExecuted and FxSettlementInstructed on the
// NDF lifecycle, replacing the gross-principal exchange of a deliverable
// forward.
//
// Authority:
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   D-FX-AD-STATUS              — FinSurv reporting on NDF cross-border flows
//   ORG-EXCON-ODP-001           — Excon AD rules for OTC derivatives
//   IFRS-9-§3.2.3               — derecognition on settlement (cash leg only)
// ---------------------------------------------------------------------------

export const ndfFixingObservedPayloadSchema = z.object({
  /** The NDF trade this fixing applies to. */
  tradeId: z.string().min(1),
  /** Currency pair traded (canonical "BASE/QUOTE", e.g. "USD/ZAR"). */
  currencyPair: z.string().min(1),
  /**
   * Fixing source — the published rate the parties agreed to observe
   * (e.g. "SARB-ZAR-Fixing-1600-SAST", "EMTA-ZAR-FIX"). Must match the
   * `ndfFixingSource` on the originating FxTradeExecuted.
   */
  fixingSource: z.string().min(1),
  /** Date the fixing was observed (ISO 8601, fixingDate convention). */
  fixingDate: z.string().min(1),
  /** Observed fixing rate (receiveCurrency per pay-unit). */
  fixingRate: z.number().positive(),
  /** Agreed contract rate from the originating trade (for delta computation). */
  contractRate: z.number().positive(),
  /**
   * Settlement currency — the currency the NDF cash-settles in.
   * Must match `ndfSettlementCurrency` on the originating FxTradeExecuted.
   */
  settlementCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /**
   * Net cash settlement amount in `settlementCurrency` minor units.
   * Positive = bank receives; negative = bank pays. Computed at fixing as
   *   netCash = notional × (fixingRate − contractRate) / fixingRate
   * for a buy; sign-flipped for a sell. The exact formula is recorded in
   * the originating trade's NDF-fixing methodology citation.
   */
  netCashMinor: z.number().int(),
  /** Settlement date for the net cash leg (typically fixingDate + 2 BD). */
  settlementDate: z.string().min(1),
  /** Citations — must not be empty (Principle 2). */
  citations: z.array(z.string().min(1)).min(1),
});

export type NdfFixingObservedPayload = z.infer<typeof ndfFixingObservedPayloadSchema>;

export function makeNdfFixingObserved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: NdfFixingObservedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "NdfFixingObserved requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  if (!args.payload.citations || args.payload.citations.length === 0) {
    throw new Error("NdfFixingObserved payload.citations must not be empty (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "NdfFixingObserved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ndfFixingObservedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FX event-type registry — for runtime registration into the event store.
// ---------------------------------------------------------------------------

export const FX_EVENT_TYPES = [
  "FxTradeExecuted",
  "FxSettlementInstructed",
  "PrincipalPayment",
  "SettlementConfirmed",
  "NdfFixingObserved",
] as const;

export type FxEventType = (typeof FX_EVENT_TYPES)[number];
