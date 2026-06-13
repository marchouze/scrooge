// platform/core/money-pilot.ts
//
// PILOT conversion (design spec §8, slice 1). Two representative event payload
// types are declared the NEW way — money fields typed as `MoneyWire` (decimal
// string), produced via `encodeMoney`, and read back in a projection via
// `decodeMoney` — proving the type → codec → projection-read path end-to-end.
//
// This is the TEMPLATE slice 2 follows when it sweeps the 33 real money-bearing
// schemas off `*Minor: bigint`. It is deliberately SELF-CONTAINED (no event
// store, no wiring into live producers) so slice 1 stays non-destructive: no
// production schema changes, no live emit path touched. The two shapes mirror
// the brief's suggestion — one FX accounting type, one simple amount type.
//
// Author: Atlas (Core banking platform architect, engineering).

import { type Money, convertFx } from "./decimal-money";
import { type MoneyWire, decodeMoney, encodeMoney } from "./money-codec";
import type { Currency } from "./types";

// ─────────────── Pilot type A: simple single-amount event ───────────────
//
// Mirrors a `*Minor: bigint` "amount" event (e.g. a fee charged, a deposit
// booked). The single money field becomes a `MoneyWire`.

export interface FeeChargedPayloadV2 {
  readonly feeId: string;
  readonly counterpartyId: string;
  /** money field — was `amountMinor: bigint`, now a decimal-string MoneyWire. */
  readonly amount: MoneyWire;
}

/** Producer: build the pilot payload from a typed `Money`. */
export function buildFeeCharged(
  feeId: string,
  counterpartyId: string,
  amount: Money,
): FeeChargedPayloadV2 {
  return { feeId, counterpartyId, amount: encodeMoney(amount) };
}

/** Projection read: decode the payload's money field back to exact `Money`. */
export function readFeeAmount(payload: FeeChargedPayloadV2): Money {
  return decodeMoney(payload.amount);
}

// ─────────────── Pilot type B: FX accounting event (two legs) ───────────────
//
// Mirrors an FX spot booking: a sold leg in the source currency and a bought
// leg in the target currency, plus the rate. Both money legs become
// `MoneyWire`. The bought leg is derived from the sold leg via the explicit
// FX conversion boundary (full-precision rate × amount, HALF_UP to target
// exponent), so the pilot also exercises the rounding policy.

export interface FxSpotBookedPayloadV2 {
  readonly tradeId: string;
  /** money field — the amount sold, source currency. */
  readonly soldAmount: MoneyWire;
  /** money field — the amount bought, target currency (derived via FX). */
  readonly boughtAmount: MoneyWire;
  /** dimensionless decimal rate string (target per 1 source). */
  readonly rate: string;
}

/** Producer: book an FX spot, deriving the bought leg through the FX boundary. */
export function buildFxSpotBooked<S extends Currency, T extends Currency>(
  tradeId: string,
  soldAmount: Money<S>,
  rate: string,
  target: T,
): FxSpotBookedPayloadV2 {
  const boughtAmount = convertFx(soldAmount, rate, target);
  return {
    tradeId,
    soldAmount: encodeMoney(soldAmount),
    boughtAmount: encodeMoney(boughtAmount),
    rate,
  };
}

/** Projection read: decode both legs back to exact `Money`. */
export function readFxSpotLegs(payload: FxSpotBookedPayloadV2): {
  sold: Money;
  bought: Money;
} {
  return {
    sold: decodeMoney(payload.soldAmount),
    bought: decodeMoney(payload.boughtAmount),
  };
}
