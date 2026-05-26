// platform/payments/isda-confirm/irs-confirm.ts
//
// ISDA 2002 Master Agreement short-form IRS confirmation generator.
//
// Generates a structured confirmation record for a vanilla ZAR
// interest rate swap booking. The confirmation captures all material
// terms required by the ISDA 2002 Master Agreement short-form
// confirmation annex: trade date, effective date, maturity, notional,
// fixed rate, floating index, payment frequency, day count, and the
// paying leg for each party.
//
// Pattern mirrors platform/payments/swift-mt/mt300.ts:
//   generateIrsConfirm()        — pure; no side effects
//   generateAndEmitIrsConfirm() — emits OutboundMessageDispatched
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE · ISDA-2002-MASTER · ORG-PR-11.
// Author: Atlas (substrate) · Tomas (operations & payments engineer, engineering).

import { BANK_ZA_001 } from "@platform/core/types";
import { makeOutboundMessageDispatched } from "@platform/event-store/event-types/payments";
import type { EventStore } from "@platform/event-store/store";
import type { Event } from "@platform/event-store/types";
import type { Actor } from "@platform/event-store/types";
import type { IrsTradeBookedPayload } from "@platform/markets/cdm/ird";

// ---------------------------------------------------------------------------
// IRS Confirmation message type
// ---------------------------------------------------------------------------

/**
 * ISDA 2002 short-form IRS confirmation record.
 *
 * Captures all material trade terms required by the ISDA 2002 Master
 * Agreement short-form confirmation annex. This is a structured record,
 * not a free-text confirmation; it can be serialised to JSON, XML
 * (FPML-style), or rendered to a human-readable confirmation PDF.
 */
export interface IrsConfirmMessage {
  /** Unique confirmation ID: "isda-irs-" + tradeId value. */
  readonly confirmId: string;
  /** Protocol identifier — always "ISDA-2002-SHORT-FORM". */
  readonly protocol: "ISDA-2002-SHORT-FORM";
  /** Internal trade identifier (the tradeId.value from the booking event). */
  readonly tradeId: string;
  /** Trade date in ISO YYYY-MM-DD format. */
  readonly tradeDate: string;
  /** Effective date (when interest starts accruing) in ISO YYYY-MM-DD format. */
  readonly effectiveDate: string;
  /** Maturity date in ISO YYYY-MM-DD format. */
  readonly maturityDate: string;
  /** Notional principal amount. */
  readonly notional: {
    readonly amountMinor: number;
    readonly currency: string;
  };
  /** Fixed rate as a decimal (e.g. 0.085 = 8.5%). */
  readonly fixedRate: number;
  /** Floating benchmark index (e.g. "JIBAR-3M"). */
  readonly floatingIndex: string;
  /** Coupon payment frequency. */
  readonly paymentFrequency: string;
  /** Day count convention for interest accrual. */
  readonly dayCountConvention: string;
  /**
   * Which leg the bank pays — determines the bank's risk direction.
   * "fixed" → bank is fixed-rate payer (duration risk; benefits if rates fall).
   * "floating" → bank is floating-rate payer (benefits if rates rise).
   */
  readonly bankPays: "fixed" | "floating";
  /** Party A (the bank sending the confirmation). */
  readonly partyA: {
    readonly name: string;
    readonly lei: string;
  };
  /** Party B (the counterparty). */
  readonly partyB: {
    readonly name: string;
    readonly lei: string;
  };
  /** ISO 8601 datetime when this confirmation was generated. */
  readonly generatedAt: string;
}

// ---------------------------------------------------------------------------
// Pure generator
// ---------------------------------------------------------------------------

/**
 * Generate an ISDA 2002 short-form IRS confirmation from a booking payload.
 *
 * Pure function — no side effects, no event emission. The returned
 * {@link IrsConfirmMessage} is serialisable and can be stored, sent,
 * or used as input to generateAndEmitIrsConfirm().
 *
 * @param booking  The IrsTradeBooked payload from the event store.
 * @param opts     Party identity for the confirmation envelope.
 *                 Pass `asOf` to override the wall-clock timestamp (required
 *                 for deterministic scenarios; omit in production paths where
 *                 the event timestamp is the real generation time).
 */
export function generateIrsConfirm(
  booking: IrsTradeBookedPayload,
  opts: {
    partyAName: string;
    partyALei: string;
    partyBName: string;
    partyBLei: string;
    /** Override generation timestamp. Defaults to wall-clock (production). */
    asOf?: string;
  },
): IrsConfirmMessage {
  const tradeIdValue = booking.tradeId.value;

  return {
    confirmId: `isda-irs-${tradeIdValue}`,
    protocol: "ISDA-2002-SHORT-FORM",
    tradeId: tradeIdValue,
    tradeDate: booking.tradeDate.iso,
    effectiveDate: booking.effectiveDate.iso,
    maturityDate: booking.maturityDate.iso,
    notional: {
      amountMinor: booking.notional.amountMinor,
      currency: booking.notional.currency,
    },
    fixedRate: booking.fixedRate,
    floatingIndex: booking.floatingIndex,
    paymentFrequency: booking.paymentFrequency,
    dayCountConvention: booking.dayCountConvention,
    bankPays: booking.bankPays,
    partyA: {
      name: opts.partyAName,
      lei: opts.partyALei,
    },
    partyB: {
      name: opts.partyBName,
      lei: opts.partyBLei,
    },
    generatedAt: opts.asOf ?? new Date().toISOString(), // wall-clock: default; inject asOf for deterministic scenarios
  };
}

// ---------------------------------------------------------------------------
// Event-emitting wrapper
// ---------------------------------------------------------------------------

/**
 * Generate an ISDA 2002 IRS confirmation and emit an
 * OutboundMessageDispatched event to the event store (Principle 1
 * compliance — every message generation is visible in the event log).
 *
 * The pure {@link generateIrsConfirm} function is called internally;
 * its signature is unchanged. This wrapper is additive.
 *
 * @param booking    The IrsTradeBooked payload.
 * @param opts       Party identity for the confirmation envelope.
 * @param store      Event store to append to.
 * @param actor      Actor emitting the event (typically the ops service account).
 * @param citations  Principle 2 citations for the event.
 * @returns          The OutboundMessageDispatched Event appended to the store.
 */
export function generateAndEmitIrsConfirm(
  booking: IrsTradeBookedPayload,
  opts: {
    partyAName: string;
    partyALei: string;
    partyBName: string;
    partyBLei: string;
  },
  store: EventStore,
  actor: Actor,
  citations: string[],
): Event {
  const confirm = generateIrsConfirm(booking, opts);
  const serialisedMessage = JSON.stringify(confirm, null, 2);
  const asOf = confirm.generatedAt;

  const event = makeOutboundMessageDispatched({
    asOf,
    entity: BANK_ZA_001,
    actor,
    citations,
    payload: {
      tradeId: confirm.tradeId,
      messageId: confirm.confirmId,
      // ISDA-CONFIRM is not in the SWIFT FX enum; accepted as a plain string
      // per the OutboundMessageDispatched schema (messageStandard: z.string()).
      messageStandard: "ISDA-CONFIRM",
      direction: "outbound",
      serialisedMessage,
      correspondentBic: opts.partyBLei.slice(0, 11).padEnd(8, "X"),
      dispatchedAt: asOf,
      citations,
    },
  });

  store.append(event);

  return event;
}
