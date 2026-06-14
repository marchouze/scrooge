// platform/core/decimal-money.ts
//
// THE unified money primitive. Every monetary value is an EXACT major-unit
// decimal, serialised as a canonical STRING, with the currency carried at the
// type level (Principle 5). This module REPLACES both prior money types:
//
//   - `platform/core/money.ts`        — bigint minor units, 4-currency DECIMALS
//                                        stub that THREW on JPY/KRW/BHD.
//   - `platform/types/currency.ts`    — scale-agnostic bigint, no rounding
//                                        policy.
//
// Both re-export from here so the two converge to one type (design spec §1.1).
// Full consumer migration off the legacy bigint surface is slice 2; this slice
// lands the foundation + codec + a pilot conversion non-destructively.
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED, D-MONEY-DECIMAL-REDENOMINATION.
// Design spec: 2026-06-13_atlas_decimal-money-redenomination-design-spec.md.
//
// Author: Atlas (Core banking platform architect, engineering).
// Co-author (rounding policy, §"Rounding policy"): Bea (Accounting &
//   financial reporting engineer, engineering).

import {
  type DecimalValue,
  addD,
  cmpD,
  divD,
  eqD,
  fromMinorUnits,
  isNegativeD,
  isZeroD,
  mulD,
  negD,
  roundDecimal,
  subD,
  toCanonicalString,
  toDecimal,
  toMinorUnits,
} from "./decimal-engine";
import { scaleFor } from "./iso4217";
import type { Currency } from "./types";

/**
 * Exact major-unit money. The amount is a canonical decimal STRING carrying
 * full unrounded precision; the ISO 4217 exponent is applied only at
 * boundaries (rounding/settlement/display), never in storage.
 *
 * Examples: `"1234.56"` (ZAR), `"1000"` (JPY), `"1.234"` (BHD),
 * `"0.000000001"`. NEVER a float; NEVER a fixed minor-unit integer.
 */
export interface Money<C extends Currency = Currency> {
  /** EXACT major-unit decimal as a canonical string. */
  readonly amount: string;
  readonly currency: C;
}

// ───────────────────────── construction ─────────────────────────

/** Construct money from a major-unit decimal STRING. The string is validated
 *  and re-canonicalised (e.g. `" 1,?"` rejected; `"01.50"` → `"1.5"`). */
export function money<C extends Currency>(amount: string, currency: C): Money<C> {
  return { amount: toCanonicalString(toDecimal(amount)), currency };
}

/** Zero in a given currency. */
export function zeroMoney<C extends Currency>(currency: C): Money<C> {
  return { amount: "0", currency };
}

/** Internal: lift a Money to the decimal engine. */
function dec(m: Money): DecimalValue {
  return toDecimal(m.amount);
}

/** Internal: lower a decimal back to Money of a known currency. */
function lift<C extends Currency>(d: DecimalValue, currency: C): Money<C> {
  return { amount: toCanonicalString(d), currency };
}

// ───────────────────────── guards ─────────────────────────

function guardSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Currency mismatch: ${a.currency} vs ${b.currency}. Cross-currency arithmetic is rejected; FX requires an explicit FxConverted event with rate source + timestamp + citation (P5).`,
    );
  }
}

// ─────────────── exact arithmetic (never rounds) ───────────────

export function add<C extends Currency>(a: Money<C>, b: Money<C>): Money<C> {
  guardSameCurrency(a, b);
  return lift(addD(dec(a), dec(b)), a.currency);
}

export function sub<C extends Currency>(a: Money<C>, b: Money<C>): Money<C> {
  guardSameCurrency(a, b);
  return lift(subD(dec(a), dec(b)), a.currency);
}

export function neg<C extends Currency>(a: Money<C>): Money<C> {
  return lift(negD(dec(a)), a.currency);
}

/** Sum a list, all of the same currency. Empty list requires an explicit
 *  currency (so the zero is typed). */
export function sum<C extends Currency>(items: ReadonlyArray<Money<C>>, currency: C): Money<C> {
  let acc = zeroMoney(currency);
  for (const m of items) acc = add(acc, m);
  return acc;
}

export function eq(a: Money, b: Money): boolean {
  return a.currency === b.currency && eqD(dec(a), dec(b));
}

export function compare<C extends Currency>(a: Money<C>, b: Money<C>): -1 | 0 | 1 {
  guardSameCurrency(a, b);
  return cmpD(dec(a), dec(b));
}

export function isZero(m: Money): boolean {
  return isZeroD(dec(m));
}

export function isNegative(m: Money): boolean {
  return isNegativeD(dec(m));
}

/** Multiply a money amount by a dimensionless scalar (decimal string), WITHOUT
 *  rounding — the result carries full precision until an explicit round at a
 *  boundary. Use for quantity × price, notional × weight, etc. */
export function mulScalar<C extends Currency>(m: Money<C>, scalar: string): Money<C> {
  return lift(mulD(dec(m), toDecimal(scalar)), m.currency);
}

// ────────────────────── rounding policy (Bea) ──────────────────────
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ROUNDING POLICY — authored by Bea (Accounting & financial reporting       │
// │ engineer, engineering). Design spec §1.4.                                  │
// │                                                                            │
// │ Rounding is NEVER implicit. The exact-decimal arithmetic above carries     │
// │ full precision; rounding happens ONLY at a division/allocation boundary,   │
// │ and ONLY through an explicit `RoundingContext = { mode, scale }`. A        │
// │ reviewer can point at any posted residual and trace it to a declared       │
// │ context. Rounding mid-computation is a finding, not a convenience.         │
// │                                                                            │
// │ Mode per domain (the call site picks the matching mode):                   │
// │   • Interest accrual / EIR amortisation → HALF_EVEN (banker's), rounded    │
// │     once at the posting boundary (IFRS 9 effective-interest).              │
// │   • Settlement / payment instruction    → HALF_UP at the currency exponent;│
// │     the sub-unit residual is posted to a rounding-difference GL account     │
// │     (no value leaks — Bea owns the CoA line; §"rounding-difference leg").   │
// │   • Pro-rata allocation (fee splits,     → HALF_UP per slice PLUS a         │
// │     coupon-by-holding)                     largest-remainder reconciliation │
// │     so the slices sum EXACTLY to the total (`allocate`).                    │
// │   • FX conversion                        → full-precision rate × amount,    │
// │     then HALF_UP to the TARGET currency exponent at the conversion         │
// │     boundary.                                                              │
// │   • RWA / capital                        → HALF_UP at the publishing return │
// │     cell's scale.                                                          │
// └──────────────────────────────────────────────────────────────────────────┘

export type RoundingMode = "HALF_UP" | "HALF_EVEN" | "DOWN" | "UP";

/** The explicit rounding instruction every boundary carries. */
export interface RoundingContext {
  readonly mode: RoundingMode;
  /**
   * Decimal places to round to. Defaults to the currency's ISO 4217 exponent
   * (`scaleFor`) when omitted — but a call site may request a HIGHER working
   * scale (e.g. an interest accrual kept at 6 dp until the period-end
   * settlement boundary rounds to 2 dp). Carry-precision-then-round-once is
   * the rule.
   */
  readonly scale?: number;
}

/** Named policy presets — the domain → mode mapping above, as values a call
 *  site cites rather than re-deriving. `scale` defaults to the currency. */
export const ROUNDING = {
  /** Interest accrual / EIR amortisation. */
  INTEREST: { mode: "HALF_EVEN" } as const satisfies RoundingContext,
  /** Settlement / payment instruction. */
  SETTLEMENT: { mode: "HALF_UP" } as const satisfies RoundingContext,
  /** Pro-rata allocation slice rounding (see `allocate`). */
  PRO_RATA: { mode: "HALF_UP" } as const satisfies RoundingContext,
  /** FX conversion to the target currency. */
  FX: { mode: "HALF_UP" } as const satisfies RoundingContext,
  /** RWA / capital. */
  RWA: { mode: "HALF_UP" } as const satisfies RoundingContext,
} as const;

function resolveScale(currency: Currency, ctx: RoundingContext): number {
  return ctx.scale ?? scaleFor(currency);
}

/** Round a money value to its boundary scale under an explicit context. */
export function round<C extends Currency>(m: Money<C>, ctx: RoundingContext): Money<C> {
  const scale = resolveScale(m.currency, ctx);
  return lift(roundDecimal(dec(m), scale, ctx.mode), m.currency);
}

/**
 * Divide a money amount by a dimensionless integer/decimal divisor and round
 * the quotient at the boundary. This is the canonical "every division is a
 * rounding site" entry point: the division runs at full precision, then a
 * single explicit round applies.
 */
export function divideRounded<C extends Currency>(
  m: Money<C>,
  divisor: string,
  ctx: RoundingContext,
): Money<C> {
  const scale = resolveScale(m.currency, ctx);
  const quotient = divD(dec(m), toDecimal(divisor));
  return lift(roundDecimal(quotient, scale, ctx.mode), m.currency);
}

/**
 * FX conversion (design spec §1.4): full-precision `rate × amount`, then a
 * single HALF_UP round to the TARGET currency's exponent at the conversion
 * boundary. `rate` is a dimensionless decimal string (target per 1 source).
 * The currency type flips from source to target — this is the ONE sanctioned
 * cross-currency operation, and the caller is responsible for sourcing the
 * rate from an explicit FxConverted event (P5).
 */
export function convertFx<S extends Currency, T extends Currency>(
  source: Money<S>,
  rate: string,
  target: T,
  ctx: RoundingContext = ROUNDING.FX,
): Money<T> {
  const product = mulD(dec(source), toDecimal(rate));
  const scale = ctx.scale ?? scaleFor(target);
  return lift(roundDecimal(product, scale, ctx.mode), target);
}

/**
 * Largest-remainder pro-rata allocation. Splits `total` into `weights.length`
 * slices proportional to `weights`, each rounded to the boundary scale, such
 * that the slices sum EXACTLY to `total` — the rounding residual is
 * distributed by the largest-remainder method (the slices with the biggest
 * fractional drop-off each receive one extra minor unit). No value is created
 * or lost. Returns slices in weight order.
 *
 * This is the shared allocator the policy mandates — pro-rata splits must NOT
 * be done per-call ad-hoc (design spec §1.4).
 */
export function allocate<C extends Currency>(
  total: Money<C>,
  weights: ReadonlyArray<string>,
  ctx: RoundingContext = ROUNDING.PRO_RATA,
): Money<C>[] {
  if (weights.length === 0) return [];
  const scale = resolveScale(total.currency, ctx);
  const totalD = dec(total);
  const weightD = weights.map((w) => toDecimal(w));
  const weightSum = weightD.reduce((acc, w) => addD(acc, w), toDecimal("0"));
  if (isZeroD(weightSum)) {
    throw new RangeError("allocate: weights sum to zero");
  }

  // unit = 1 minor unit at this scale, e.g. 0.01 at scale 2.
  const unit = toDecimal(scale === 0 ? "1" : `0.${"0".repeat(scale - 1)}1`);

  // Floor each slice (ROUND_DOWN) to the scale, track the truncated remainder.
  const floored: DecimalValue[] = [];
  const remainders: { idx: number; rem: DecimalValue }[] = [];
  let allocated = toDecimal("0");
  weightD.forEach((w, i) => {
    const exact = divD(mulD(totalD, w), weightSum);
    const down = roundDecimal(exact, scale, "DOWN");
    floored.push(down);
    remainders.push({ idx: i, rem: subD(exact, down) });
    allocated = addD(allocated, down);
  });

  // The shortfall (total − Σ floored) is an exact integer number of minor
  // units; hand one unit each to the largest remainders.
  const shortfall = subD(totalD, allocated);
  // Number of whole units still to distribute.
  const unitsToDistribute = Number(roundDecimal(divD(shortfall, unit), 0, "HALF_UP").toFixed(0));
  remainders.sort((a, b) => cmpD(b.rem, a.rem) || a.idx - b.idx);
  for (let k = 0; k < unitsToDistribute; k++) {
    const entry = remainders[k % remainders.length];
    if (entry === undefined) break;
    const current = floored[entry.idx];
    if (current === undefined) continue;
    floored[entry.idx] = addD(current, unit);
  }

  return floored.map((d) => lift(d, total.currency));
}

/**
 * Settlement rounding with an explicit rounding-difference (Bea's GL line).
 * Rounds `m` to the currency exponent (HALF_UP by default) and returns BOTH
 * the rounded settlement amount AND the residual (`exact − rounded`) so the
 * caller posts the residual to the rounding-difference account. The two sum
 * back to the exact pre-rounding value — value conservation is provable.
 */
export function settleWithResidual<C extends Currency>(
  m: Money<C>,
  ctx: RoundingContext = ROUNDING.SETTLEMENT,
): { settled: Money<C>; roundingDifference: Money<C> } {
  const settled = round(m, ctx);
  const roundingDifference = sub(m, settled);
  return { settled, roundingDifference };
}

// ─────────────── minor-unit bridge (compat derivation) ───────────────
//
// The legacy `*Minor: number/bigint` integer surface (e.g. `SubLedgerLeg.
// amountMinor`) is DERIVED from the decimal `Money` during the strangler
// migration, so there is exactly ONE source of truth (the decimal amount) and
// the minor field cannot drift. These two functions are that bridge.

/**
 * Lower an exact-decimal `Money` to an integer count of minor units at the
 * currency's ISO 4217 exponent. The amount MUST already be rounded to (at most)
 * the currency scale — an over-precise amount throws (via the engine), because
 * silently truncating money at the minor-unit boundary is a rounding decision
 * that must be made EXPLICITLY upstream (`round`/`divideRounded`/`allocate`),
 * never here. Used to derive a compat `amountMinor` from the decimal source.
 */
export function amountToMinorUnits(m: Money): bigint {
  return toMinorUnits(toDecimal(m.amount), scaleFor(m.currency));
}

/**
 * Lift an integer count of minor units (already exact — e.g. an existing
 * `amountMinor`) to its exact-decimal `Money`. The result carries no rounding:
 * an integer minor-unit value is exact at the currency scale by definition, so
 * `amountToMinorUnits(moneyFromMinorUnits(n, c)) === n` for every `n`. This is
 * the lossless lift that lets a producer holding a legacy integer magnitude
 * make the decimal `amount` the source of truth without changing any figure.
 */
export function moneyFromMinorUnits<C extends Currency>(minor: bigint, currency: C): Money<C> {
  return lift(fromMinorUnits(minor, scaleFor(currency)), currency);
}

// ───────────────────────── display ─────────────────────────

/** Human-readable, rounded to the currency exponent. NOT a serialisation form
 *  (the codec is the serialisation form). */
export function format(m: Money, ctx: RoundingContext = { mode: "HALF_UP" }): string {
  const r = round(m, ctx);
  return `${m.currency} ${r.amount}`;
}
