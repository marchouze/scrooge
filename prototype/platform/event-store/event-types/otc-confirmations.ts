// platform/event-store/event-types/otc-confirmations.ts
//
// OTC derivative confirmation event types — non-IRS products.
//
// SCOPE:
//   WS-ODP-ISDA-ANNEXURES (ORG-ODP-COND-005 · Regulation: urn:regulation:odp:cs-2-2018)
//
// Four confirmation event shapes (IRS confirmations ALREADY EXIST in
// `platform/markets/cdm/ird.ts` — these four reuse the same pattern
// and primitives):
//
//   - FraTradeBooked           — Forward Rate Agreement booking event.
//   - SwaptionTradeBooked      — Swaption (option on an IRS) booking event.
//   - BasisSwapTradeBooked     — Basis swap (float-to-float) booking event.
//   - CrossCurrencySwapTradeBooked — Cross-currency swap booking event.
//
// DESIGN DECISIONS:
//   1. Events-first (Principle 1) — each event IS the canonical confirmation.
//      Any generated PDF/FPML confirmation is a derived render.
//   2. Currency at the type level (Principle 5) — every monetary field and
//      every notional carries a currency code; no defaults assumed.
//   3. Pattern reuse — follow `IrsTradeBooked` shape from `cdm/ird.ts`
//      exactly. Consumers can dispatch on event type and handle each product
//      independently without structural surprises.
//   4. Non-IRS confirmations only — IRS is handled by `cdm/ird.ts`.
//
// Authority:
//   ORG-ODP-COND-005 (Derivatives Counterparty obligation)
//   urn:regulation:odp:cs-2-2018 §§ 3, 7, 14 (ODP Conduct Standard 2/2018)
//   ISDA 2002 Master Agreement (governing documentation)
//   ISDA 1997 Government Bond Option Definitions (for swaption)
//   ISDA 2006 Definitions §§ 7–14 (FRA, swaption confirmation templates)
//   ISDA 2000 Definitions §§ 3–11 (cross-currency swap)
//   BCBS d317 (SA-CCR §§ 5–7) — product classification and netting-set
//   Principles/1-events-are-truth.md
//   Principles/5-multi-currency-entity-country.md
//
// Author: Imani (General Counsel, legal)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";
import {
  cdmDateSchema,
  identifierSchema,
  moneySchema,
  partySchema,
} from "../../markets/cdm/primitives";

// ---------------------------------------------------------------------------
// Shared sub-schemas (local — extending the cdm/primitives pattern)
// ---------------------------------------------------------------------------

/**
 * PayReceive — the bank's leg direction.
 *   "pay"     = bank pays this leg to the counterparty
 *   "receive" = bank receives this leg from the counterparty
 */
const payReceiveSchema = z.enum(["pay", "receive"]);
type PayReceive = z.infer<typeof payReceiveSchema>;

/**
 * IrdFloatingIndex — permissible floating-rate indices for SA and major
 * cross-currency products. Extends the IRS-only list in `cdm/ird.ts`.
 */
const irdFloatingIndexSchema = z.enum([
  "JIBAR-3M",
  "JIBAR-1M",
  "ZARONIA",
  "SOFR",
  "EURIBOR-3M",
  "EURIBOR-6M",
  "SONIA",
  "TONAR",
  "BBSW-3M",
]);
type IrdFloatingIndex = z.infer<typeof irdFloatingIndexSchema>;

/**
 * DayCountConvention — aligned with IRS conventions.
 */
const dayCountConventionSchema = z.enum([
  "ACT/365",
  "ACT/360",
  "30/360",
  "ACT/ACT-ISDA",
]);

/**
 * BusinessDayConvention — date-adjustment rules for payment and reset dates.
 */
const businessDayConventionSchema = z.enum([
  "Following",
  "Modified-Following",
  "Preceding",
  "No-Adjustment",
]);

// ---------------------------------------------------------------------------
// FraTradeBooked
//
// A Forward Rate Agreement locks in a future interest rate for one period.
// Confirmation follows ISDA 2006 Definitions § 7 (FRA terms).
//
// Economic structure:
//   - Start date (the accrual start — typically T+2 for the forward period)
//   - End date   (accrual end — e.g. 3 months after start for a 3-month FRA)
//   - Fixing date (the date on which the floating-rate index is observed;
//     typically T-2 from start date per ISDA 2006 Definitions § 12.1)
//   - Contract rate (the agreed fixed rate)
//   - Reference notional (for settlement calculation only — no exchange of
//     principal)
//   - Settlement method: "cash" (standard) — difference between contract
//     rate and fixing rate, discounted to settlement date.
// ---------------------------------------------------------------------------

export const fraTradeBookedPayloadSchema = z.object({
  /** Stable internal trade identifier. */
  tradeId: identifierSchema,
  /** Counterparty (must have passed FAIS eligibility screening). */
  counterparty: partySchema,
  /**
   * Notional principal. The FRA settlement amount is calculated on this
   * notional but no exchange of principal occurs. Per Principle 5 —
   * currency tagged at the type level.
   */
  notional: moneySchema,
  /**
   * Contract rate (fixed rate) agreed between the parties, expressed as
   * a decimal (e.g. 0.085 = 8.5% per annum).
   */
  contractRate: z.number().positive(),
  /**
   * Floating reference index — the rate observed on the Fixing Date that
   * determines the settlement amount.
   */
  floatingIndex: irdFloatingIndexSchema,
  /** Which direction the bank is on the fixed rate. */
  bankPaysFixed: z.boolean(),
  /** Trade date (when the FRA was agreed). */
  tradeDate: cdmDateSchema,
  /**
   * Settlement date — the date on which the discounted net settlement
   * amount is exchanged (typically = start date of the reference period).
   */
  settlementDate: cdmDateSchema,
  /**
   * Fixing date — the date on which the floating reference index is
   * observed (typically 2 business days before settlement date).
   */
  fixingDate: cdmDateSchema,
  /**
   * Maturity date — the end of the reference period (e.g. settlement
   * date + 3 months for a 3×6 FRA). Used to compute the discount factor
   * and the accrual period for the settlement calculation.
   */
  maturityDate: cdmDateSchema,
  /**
   * Day count convention applied to the accrual period [settlementDate, maturityDate].
   */
  dayCountConvention: dayCountConventionSchema,
  /** Business-day convention for payment date adjustment. */
  businessDayConvention: businessDayConventionSchema,
  /** Trading book identifier. */
  bookId: z.string().min(1),
  /**
   * Financial Instrument entity reference (`"fi:fra:<tradeId>"`).
   * Optional; required from commencement-of-trading.
   */
  instrumentId: z.string().min(1).optional(),
  /** Trader reference. */
  traderRef: z.string().min(1),
  /**
   * UTI — Unique Trade Identifier per EMIR/ODP reporting.
   * Populated when the UTI has been allocated (post-execution).
   */
  uti: z.string().optional(),
});

export type FraTradeBookedPayload = z.infer<typeof fraTradeBookedPayloadSchema>;

export function makeFraTradeBooked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FraTradeBookedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "FraTradeBooked requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-005 and the relevant ISDA 2006 Definitions section.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FraTradeBooked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fraTradeBookedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SwaptionTradeBooked
//
// A Swaption is an option granting the holder the right (but not obligation)
// to enter into an underlying IRS on the expiry date. Confirmation follows
// ISDA 2006 Definitions §§ 13–16 (Swaption terms).
//
// Economic structure:
//   - Option buyer and seller (the bank may be buyer OR seller)
//   - Premium (paid on premium-payment date by the option buyer)
//   - Option style: European (standard) / American / Bermudan
//   - Expiry date: the date by which the option must be exercised
//   - Underlying IRS: the fixed-float IRS that would be entered if exercised
//   - Settlement method: physical (enter IRS) or cash-settled
//     (cash settlement using annuity or swap-rate method)
// ---------------------------------------------------------------------------

const swaptionStyleSchema = z.enum(["European", "American", "Bermudan"]);
const swaptionSettlementMethodSchema = z.enum(["physical", "cash-annuity", "cash-swap-rate"]);

export const swaptionTradeBookedPayloadSchema = z.object({
  /** Stable internal trade identifier. */
  tradeId: identifierSchema,
  /** Counterparty. */
  counterparty: partySchema,
  /**
   * Option style.
   * Bermudan swaptions have multiple exercise dates — see `bermudanExerciseDates`.
   */
  optionStyle: swaptionStyleSchema,
  /** Whether the bank is the option buyer (`true`) or seller (`false`). */
  bankIsBuyer: z.boolean(),
  /**
   * Premium paid by the option buyer to the option seller.
   * Currency-tagged per Principle 5.
   */
  premium: moneySchema,
  /** ISO 8601 date on which the premium is paid. */
  premiumPaymentDate: cdmDateSchema,
  /** Expiry date — the last date on which the option can be exercised. */
  expiryDate: cdmDateSchema,
  /**
   * Exercise times for Bermudan swaptions. Ignored for European / American.
   * Each entry is an ISO-8601 date.
   */
  bermudanExerciseDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
  /** Settlement method for option exercise. */
  settlementMethod: swaptionSettlementMethodSchema,

  // ---- Underlying IRS terms ----
  // The underlying swap is defined by the same key terms as IrsTradeBooked
  // (from cdm/ird.ts). Rather than embedding a sub-object, we flatten the
  // economically relevant terms here, as ISDA confirm templates do.

  /** Notional of the underlying IRS. */
  underlyingNotional: moneySchema,
  /** Fixed rate of the underlying IRS (decimal, e.g. 0.085 = 8.5%). */
  underlyingFixedRate: z.number().positive(),
  /** Floating index of the underlying IRS. */
  underlyingFloatingIndex: irdFloatingIndexSchema,
  /**
   * Whether the bank would PAY fixed (receiver swaption = bank receives
   * fixed) or RECEIVE fixed (payer swaption = bank pays fixed) if the
   * option is exercised.
   * "pay" = payer swaption (bank pays fixed on the underlying IRS)
   * "receive" = receiver swaption (bank receives fixed)
   */
  underlyingBankPaysFixed: payReceiveSchema,
  /** Effective date of the underlying IRS (the start of accrual if exercised). */
  underlyingEffectiveDate: cdmDateSchema,
  /** Maturity date of the underlying IRS. */
  underlyingMaturityDate: cdmDateSchema,
  /** Payment frequency of the underlying IRS. */
  underlyingPaymentFrequency: z.enum(["monthly", "quarterly", "semi-annual", "annual"]),
  /** Day count convention of the underlying IRS. */
  underlyingDayCountConvention: dayCountConventionSchema,
  /** Trade date. */
  tradeDate: cdmDateSchema,
  /** Trading book identifier. */
  bookId: z.string().min(1),
  /** Financial Instrument entity reference. Optional. */
  instrumentId: z.string().min(1).optional(),
  /** Trader reference. */
  traderRef: z.string().min(1),
  /** UTI (allocated post-execution). */
  uti: z.string().optional(),
});

export type SwaptionTradeBookedPayload = z.infer<typeof swaptionTradeBookedPayloadSchema>;

export function makeSwaptionTradeBooked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SwaptionTradeBookedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "SwaptionTradeBooked requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-005 and the relevant ISDA 2006 Definitions section.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SwaptionTradeBooked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: swaptionTradeBookedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BasisSwapTradeBooked
//
// A Basis Swap exchanges two floating-rate cashflow streams. The SA money-
// market basis swap is typically JIBAR-3M vs ZARONIA (overnight index). In
// cross-currency basis swaps the legs are in different currencies; same-
// currency basis swaps use the same base currency for both legs.
//
// Confirmation follows ISDA 2006 Definitions §§ 7, 11 (floating-rate terms).
//
// Economic structure:
//   - Two floating legs (Leg 1 and Leg 2) — each has its own index, spread,
//     and payment frequency. The bank pays one leg and receives the other.
//   - Same-currency: notional is single-currency (one `notional` field).
//   - Basis-point spread: one or both legs may carry a basis-point spread
//     added to the reference index (e.g. JIBAR-3M + 10bps).
// ---------------------------------------------------------------------------

export const basisSwapLegSchema = z.object({
  /** Floating index for this leg. */
  floatingIndex: irdFloatingIndexSchema,
  /**
   * Spread over (or under) the index in basis points. Positive = above
   * index; negative = below. 0 = flat to index (no spread).
   */
  spreadBps: z.number(),
  /** Reset frequency. */
  resetFrequency: z.enum(["daily", "monthly", "quarterly", "semi-annual", "annual"]),
  /** Payment frequency. */
  paymentFrequency: z.enum(["monthly", "quarterly", "semi-annual", "annual"]),
  /** Day count convention. */
  dayCountConvention: dayCountConventionSchema,
  /** Business-day convention for payment dates. */
  businessDayConvention: businessDayConventionSchema,
});

export type BasisSwapLeg = z.infer<typeof basisSwapLegSchema>;

export const basisSwapTradeBookedPayloadSchema = z.object({
  /** Stable internal trade identifier. */
  tradeId: identifierSchema,
  /** Counterparty. */
  counterparty: partySchema,
  /**
   * Notional amount. For same-currency basis swaps there is one notional.
   * Per Principle 5 — currency tagged.
   */
  notional: moneySchema,
  /** Trade date. */
  tradeDate: cdmDateSchema,
  /** Effective date (start of accrual). */
  effectiveDate: cdmDateSchema,
  /** Maturity date (end of accrual). */
  maturityDate: cdmDateSchema,
  /**
   * Leg 1 — the leg the bank PAYS. Basis swaps are symmetric economically
   * but the bank must designate its pay/receive direction to ensure clear
   * P&L attribution and SA-CCR asset-class classification.
   */
  payLeg: basisSwapLegSchema,
  /**
   * Leg 2 — the leg the bank RECEIVES.
   */
  receiveLeg: basisSwapLegSchema,
  /** Trading book identifier. */
  bookId: z.string().min(1),
  /** Financial Instrument entity reference. Optional. */
  instrumentId: z.string().min(1).optional(),
  /** Trader reference. */
  traderRef: z.string().min(1),
  /** UTI (allocated post-execution). */
  uti: z.string().optional(),
});

export type BasisSwapTradeBookedPayload = z.infer<typeof basisSwapTradeBookedPayloadSchema>;

export function makeBasisSwapTradeBooked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BasisSwapTradeBookedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "BasisSwapTradeBooked requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-005 and the relevant ISDA 2006 Definitions section.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BasisSwapTradeBooked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: basisSwapTradeBookedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CrossCurrencySwapTradeBooked
//
// A Cross-Currency Swap (CCS) exchanges cashflow streams in two different
// currencies, typically with exchange of notional at both the effective and
// maturity dates. The SA-regulated variant under ODP is typically
// ZAR vs USD / EUR / GBP. Confirmation follows ISDA 2000 Definitions §§ 3–11.
//
// Economic structure:
//   - Two legs in different currencies (Leg 1 = pay ccy, Leg 2 = receive ccy)
//   - Each leg may be fixed or floating (fixed-fixed, fixed-float, float-float)
//   - Initial exchange of notional at effective date (optional per election)
//   - Final re-exchange of notional at maturity
//   - FX rate for converting the notionals is locked in at trade date
//
// Currency at the type level (Principle 5) — each leg carries its own
// notional with currency; no assumption of ZAR on one leg.
// ---------------------------------------------------------------------------

const ccsLegTypeSchema = z.enum(["fixed", "floating"]);

export const ccsLegSchema = z.object({
  /** ISO 4217 currency of this leg. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** Notional in this leg's currency. */
  notional: moneySchema,
  /** Whether this leg pays a fixed rate or a floating index. */
  legType: ccsLegTypeSchema,
  /**
   * Fixed rate (when `legType === "fixed"`). Decimal e.g. 0.055 = 5.5%.
   * `null` when floating.
   */
  fixedRate: z.number().positive().nullable(),
  /**
   * Floating index (when `legType === "floating"`).
   * `null` when fixed.
   */
  floatingIndex: irdFloatingIndexSchema.nullable(),
  /**
   * Spread over index in basis points for floating legs.
   * 0 for flat; `null` for fixed legs.
   */
  spreadBps: z.number().nullable(),
  /** Payment frequency. */
  paymentFrequency: z.enum(["monthly", "quarterly", "semi-annual", "annual"]),
  /** Day count convention. */
  dayCountConvention: dayCountConventionSchema,
  /** Business-day convention. */
  businessDayConvention: businessDayConventionSchema,
});
export type CcsLeg = z.infer<typeof ccsLegSchema>;

export const crossCurrencySwapTradeBookedPayloadSchema = z
  .object({
    /** Stable internal trade identifier. */
    tradeId: identifierSchema,
    /** Counterparty. */
    counterparty: partySchema,
    /** Trade date. */
    tradeDate: cdmDateSchema,
    /** Effective date (start of accrual + initial notional exchange). */
    effectiveDate: cdmDateSchema,
    /** Maturity date (end of accrual + final notional re-exchange). */
    maturityDate: cdmDateSchema,
    /**
     * The leg the bank PAYS. Currency of this leg is the bank's pay currency.
     */
    payLeg: ccsLegSchema,
    /**
     * The leg the bank RECEIVES. Currency of this leg is the bank's receive currency.
     */
    receiveLeg: ccsLegSchema,
    /**
     * FX spot rate used to convert notionals at trade date (pay-currency /
     * receive-currency). Expressed as a decimal rate.
     */
    initialFxRate: z.number().positive(),
    /**
     * Whether notionals are exchanged at the effective date.
     * Standard CCS exchanges notional at both effective and maturity dates;
     * certain bespoke structures omit the initial exchange.
     */
    initialNotionalExchange: z.boolean().default(true),
    /**
     * Whether notionals are re-exchanged at the maturity date.
     * Almost always `true` for standard CCS.
     */
    finalNotionalExchange: z.boolean().default(true),
    /**
     * Mark-to-market (MTM) CCS flag. In an MTM-CCS the notional is reset
     * periodically to the then-current FX rate. Standard CCS is non-MTM.
     */
    markToMarketCcs: z.boolean().default(false),
    /**
     * Reset date convention for MTM-CCS. ISO-8601 dates or null for non-MTM.
     */
    mtmResetDates: z
      .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .default([]),
    /** Trading book identifier. */
    bookId: z.string().min(1),
    /** Financial Instrument entity reference. Optional. */
    instrumentId: z.string().min(1).optional(),
    /** Trader reference. */
    traderRef: z.string().min(1),
    /** UTI (allocated post-execution). */
    uti: z.string().optional(),
  })
  .refine(
    (d) => d.payLeg.currency !== d.receiveLeg.currency,
    { message: "CrossCurrencySwap payLeg and receiveLeg must have different currencies" },
  );

export type CrossCurrencySwapTradeBookedPayload = z.infer<
  typeof crossCurrencySwapTradeBookedPayloadSchema
>;

export function makeCrossCurrencySwapTradeBooked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CrossCurrencySwapTradeBookedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "CrossCurrencySwapTradeBooked requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-005 and the relevant ISDA 2000 Definitions section.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CrossCurrencySwapTradeBooked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: crossCurrencySwapTradeBookedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Type registry
// ---------------------------------------------------------------------------

export const OTC_CONFIRMATIONS_TYPED_EVENT_TYPES = [
  "FraTradeBooked",
  "SwaptionTradeBooked",
  "BasisSwapTradeBooked",
  "CrossCurrencySwapTradeBooked",
] as const;

export type OtcConfirmationEventType = (typeof OTC_CONFIRMATIONS_TYPED_EVENT_TYPES)[number];

// Re-export sub-schemas for consumer use
export type { PayReceive, IrdFloatingIndex };
