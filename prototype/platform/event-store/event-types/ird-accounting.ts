// platform/event-store/event-types/ird-accounting.ts
//
// IFRS 9 GL-specific OTC IRD swap accounting event-payload schemas.
//
// Events (4):
//   IrdSwapTradeExecuted   — initial recognition on trade date. OTC interest
//                            rate swaps (IRS, basis, OIS) are FVTPL per IFRS 9
//                            §4.1.4. Day-1 NPV is typically zero (at-market
//                            swap) so no net P&L posting on trade date unless
//                            an off-market premium/discount is paid.
//
//   IrdSwapPositionRevalued — periodic NPV re-measurement at mid-market rates
//                            (IFRS 9 §5.7.1). Positive NPV → asset; negative
//                            NPV → liability. Recognised in P&L.
//
//   IrdSwapCouponSettled   — net (or gross) coupon cash settlement on each
//                            payment date. Fixed leg vs floating leg net amount
//                            paid/received. Reduces the mark-to-market
//                            carrying value by the settled amount.
//
//   IrdSwapTerminated      — early or scheduled termination. Position
//                            derecognised (IFRS 9 §3.2.3). Any remaining NPV
//                            or unwind cost crystallised as realised P&L.
//
// Chart-of-accounts:
//   ACC-3300-001  Swap Asset — FVTPL (Positive NPV)   (asset, debit normal)
//   ACC-3300-002  Swap Liability — FVTPL (Negative NPV)(liability, credit normal)
//   ACC-3300-003  Unrealised P&L — IRD (FVTPL)         (income, credit normal)
//   ACC-1100-001  Nostro — ZAR (SARB operational)      (asset, debit normal)
//
// Authority:
//   - D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
//   - IFRS 9 §3.2.3, §4.1.4, §5.7.1
//   - IAS 21 §23 (monetary items at closing rate where CCY ≠ ZAR)
//   - Banks Act 94 of 1990
//   - JSE Debt Listings Requirements
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// IrdSwapTradeExecuted
//
// Emitted at trade date when the bank enters an OTC IRS, basis-swap, or OIS.
//
// OTC swaps are classified FVTPL (trading book) per IFRS 9 §4.1.4 because
// the contractual cash flows are not solely payments of principal and interest
// (SPPI test fails for variable-rate legs).
//
// Day-1 NPV is typically zero (at-market swap). Where an off-market premium
// or discount is paid upfront, npvMinor carries the signed initial value and
// the posting engine creates the corresponding asset/liability leg.
//
// Dr Swap Asset (if npvMinor > 0) / Cr Unrealised P&L (FVTPL)
// Dr Unrealised P&L (FVTPL) / Cr Swap Liability (if npvMinor < 0)
// Zero (if npvMinor == 0) → no posting
// ---------------------------------------------------------------------------

export const irdSwapTradeExecutedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),
  /** OTC swap instrument type. */
  instrumentType: z.enum(["irs", "basis-swap", "ois"]),
  /** Bank's role in the swap (payer of fixed, receiver of fixed). */
  role: z.enum(["pay-fixed", "receive-fixed", "pay-float", "receive-float"]),
  /** Notional amount in minor currency units. */
  notionalMinor: z.number().int().positive(),
  /**
   * Initial NPV at trade date in signed minor currency units.
   * Positive = asset (bank holds positive-value position).
   * Negative = liability (bank owes on net basis).
   * Zero = at-market swap (most common; no day-1 P&L).
   */
  npvMinor: z.number().int(),
  /** Fixed rate (e.g. 0.0750 = 7.50%). */
  fixedRatePercent: z.number().nonnegative(),
  /** ISO 8601 trade date. */
  tradeDate: z.string().min(1),
  /** ISO 8601 start (effective) date. */
  startDate: z.string().min(1),
  /** ISO 8601 maturity date. */
  maturityDate: z.string().min(1),
  /** Counterparty LEI or internal identifier. */
  counterpartyLei: z.string().min(1),
  /** ISO 4217 currency (typically "ZAR" for domestic OTC). */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
});

export type IrdSwapTradeExecutedPayload = z.infer<typeof irdSwapTradeExecutedPayloadSchema>;

export function makeIrdSwapTradeExecuted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IrdSwapTradeExecutedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("IrdSwapTradeExecuted requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IrdSwapTradeExecuted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: irdSwapTradeExecutedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IrdSwapPositionRevalued
//
// Periodic (daily/weekly/month-end) NPV re-measurement at mid-market rates.
// Signed delta: positive = NPV increased (gain), negative = NPV decreased
// (loss). Recognised in P&L per IFRS 9 §5.7.1.
//
// The posting rule uses the sign of npvDeltaMinor to flip between asset/
// liability accounts and the P&L account.
//
// Gain (+): Dr Swap Asset / Cr Unrealised P&L (FVTPL)
// Loss (−): Dr Unrealised P&L (FVTPL) / Cr Swap Liability
// Zero:     [] (no posting)
//
// If NPV sign flips (e.g. asset → liability), the posting engine must close
// the old account and open the new one in the same journal entry. The field
// `npvSignFlip` signals this to the engine.
// ---------------------------------------------------------------------------

export const irdSwapPositionRevaluedPayloadSchema = z.object({
  /** The originating trade identifier. */
  tradeId: z.string().min(1),
  /**
   * Signed NPV movement in minor currency units for this period.
   * Positive = gain (NPV improved); negative = loss.
   */
  npvDeltaMinor: z.number().int(),
  /**
   * Full NPV at the close of this revaluation period (signed).
   * Positive = net asset position; negative = net liability position.
   */
  npvClosingMinor: z.number().int(),
  /**
   * Full NPV at the opening of this revaluation period (signed).
   * Used to detect asset↔liability sign flips.
   */
  npvOpeningMinor: z.number().int(),
  /** Revaluation date (ISO 8601 date). */
  revalDate: z.string().min(1),
  /** ISO 4217 currency. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
});

export type IrdSwapPositionRevaluedPayload = z.infer<typeof irdSwapPositionRevaluedPayloadSchema>;

export function makeIrdSwapPositionRevalued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IrdSwapPositionRevaluedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("IrdSwapPositionRevalued requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IrdSwapPositionRevalued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: irdSwapPositionRevaluedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IrdSwapCouponSettled
//
// Net coupon cash settlement on a payment date. For a standard IRS, the fixed
// and floating legs are netted; the bank either pays or receives the net
// amount. For basis swaps, both legs may be floating.
//
// Settlement reduces (or increases) the carrying NPV by the net cash settled:
//   Bank receives net (netCashMinor > 0):
//     Dr Nostro ZAR  / Cr Swap Asset (FVTPL) — cash in, NPV carrying ↓
//   Bank pays net (netCashMinor < 0):
//     Dr Swap Liability (FVTPL) / Cr Nostro ZAR — cash out, NPV carrying ↓
// ---------------------------------------------------------------------------

export const irdSwapCouponSettledPayloadSchema = z.object({
  /** The originating trade identifier. */
  tradeId: z.string().min(1),
  /**
   * Net cash flow in signed minor currency units.
   * Positive = bank receives cash; negative = bank pays cash.
   */
  netCashMinor: z.number().int(),
  /** Fixed-leg coupon amount (absolute value, minor units). */
  fixedLegMinor: z.number().int().nonnegative(),
  /** Floating-leg coupon amount (absolute value, minor units). */
  floatingLegMinor: z.number().int().nonnegative(),
  /** Settlement date (ISO 8601 date). */
  settlementDate: z.string().min(1),
  /** Coupon period start date (ISO 8601 date). */
  periodStartDate: z.string().min(1),
  /** Coupon period end date (ISO 8601 date). */
  periodEndDate: z.string().min(1),
  /** ISO 4217 currency. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
});

export type IrdSwapCouponSettledPayload = z.infer<typeof irdSwapCouponSettledPayloadSchema>;

export function makeIrdSwapCouponSettled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IrdSwapCouponSettledPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("IrdSwapCouponSettled requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IrdSwapCouponSettled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: irdSwapCouponSettledPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IrdSwapTerminated
//
// Swap terminated early by mutual agreement or at scheduled maturity.
// Position derecognised per IFRS 9 §3.2.3. Any remaining NPV (unwind value)
// or termination payment crystallised as realised P&L.
//
// If the bank receives a termination payment (terminationPaymentMinor > 0):
//   Dr Nostro ZAR / Cr Swap Asset — derecognise asset, cash in
// If the bank pays a termination payment (terminationPaymentMinor < 0):
//   Dr Swap Liability / Cr Nostro ZAR — derecognise liability, cash out
// Residual P&L leg recognises gain/loss on close-out.
// ---------------------------------------------------------------------------

export const irdSwapTerminatedPayloadSchema = z.object({
  /** The originating trade identifier. */
  tradeId: z.string().min(1),
  /**
   * Close-out / termination payment in signed minor currency units.
   * Positive = bank receives cash; negative = bank pays cash.
   */
  terminationPaymentMinor: z.number().int(),
  /**
   * Carrying NPV (book value) at termination in signed minor currency units.
   * Positive = swap was an asset; negative = swap was a liability.
   */
  carryingNpvAtTerminationMinor: z.number().int(),
  /**
   * Realised P&L on termination in minor currency units.
   * = terminationPaymentMinor − carryingNpvAtTerminationMinor
   * Positive = gain; negative = loss.
   */
  realisedPnlMinor: z.number().int(),
  /** Termination date (ISO 8601 date). */
  terminationDate: z.string().min(1),
  /** ISO 4217 currency. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
});

export type IrdSwapTerminatedPayload = z.infer<typeof irdSwapTerminatedPayloadSchema>;

export function makeIrdSwapTerminated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IrdSwapTerminatedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("IrdSwapTerminated requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IrdSwapTerminated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: irdSwapTerminatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IRD accounting event-type registry
// ---------------------------------------------------------------------------

export const IRD_ACCOUNTING_EVENT_TYPES = [
  "IrdSwapTradeExecuted",
  "IrdSwapPositionRevalued",
  "IrdSwapCouponSettled",
  "IrdSwapTerminated",
] as const;

export type IrdAccountingEventType = (typeof IRD_ACCOUNTING_EVENT_TYPES)[number];
