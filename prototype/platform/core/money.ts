// platform/core/money.ts
//
// Typed money. Every monetary value carries its currency at the type level
// (P5). Arithmetic across currencies is rejected at runtime; FX conversion
// is an explicit event with a rate source, rate timestamp, and citation.
//
// ── CONVERGENCE NOTICE (D-MONEY-DECIMAL-BUILD-PROCEED, slice 1) ───────────────
//   The CANONICAL money primitive is now the EXACT-DECIMAL `Money` in
//   `./decimal-money.ts` (string major-unit amount, complete ISO 4217 boundary
//   table, explicit RoundingContext at every division, codec at
//   `./money-codec.ts`). It is re-exported below under the `Decimal*` aliases
//   AND `decimal-money` is the import target new code should use directly.
//
//   The bigint MINOR-UNIT surface below (`Money` = { amount: bigint }, `minor`,
//   `decimalsFor` with the 4-entry `DECIMALS` stub) is RETAINED ONLY as the
//   legacy boundary for ~20 existing consumers; it is DEPRECATED and migrated
//   off in slice 2. No new code should import the bigint `Money` from here.
//   `platform/types/currency.ts` (the other divergent Money) also re-exports
//   the decimal type — the two have converged to one canonical definition.
// ─────────────────────────────────────────────────────────────────────────────
//
// Author: Atlas (Core banking platform architect, engineering).

import { scaleFor as scaleForExponent } from "./iso4217";
import type { Currency } from "./types";

// Re-export the canonical decimal money surface so the two prior money modules
// converge here. New code: prefer importing from `./decimal-money` directly.
export {
  type Money as DecimalMoney,
  type RoundingContext,
  type RoundingMode,
  ROUNDING,
  money as decimalMoney,
  zeroMoney,
  add as addDecimal,
  sub as subDecimal,
  neg as negDecimal,
  sum as sumDecimal,
  eq as eqDecimal,
  compare as compareDecimal,
  isZero as isZeroDecimal,
  isNegative as isNegativeDecimal,
  mulScalar,
  round as roundMoney,
  divideRounded,
  convertFx,
  allocate,
  settleWithResidual,
} from "./decimal-money";
export {
  type MoneyWire,
  encodeMoney,
  decodeMoney,
  isMoneyWire,
  findFloatMoneyViolations,
} from "./money-codec";
export {
  ISO4217_EXPONENTS,
  iso4217Exponent,
  scaleFor,
  isKnownCurrency,
  hasNoMinorUnit,
} from "./iso4217";

export interface Money {
  readonly amount: bigint; // minor units
  readonly currency: Currency;
}

/**
 * Number of minor-unit decimal places for a currency.
 *
 * As of the decimal-money convergence (slice 1) this delegates to the COMPLETE
 * ISO 4217 boundary table (`scaleFor`), so it no longer throws on JPY/KRW/BHD
 * or any other valid currency — the 4-entry `DECIMALS` stub is gone. A
 * no-minor-unit currency (metals) degrades to the policy-default scale rather
 * than throwing (design spec §1.3). Retained for legacy minor-unit consumers
 * (MT300 field-36, payments serialisers) until slice 2 migrates them.
 */
export function decimalsFor(currency: Currency): number {
  return scaleForExponent(currency);
}

/** Construct money from a major-unit number or numeric string. */
export function money(major: number | string, currency: Currency): Money {
  const dp = decimalsFor(currency);
  const factor = 10 ** dp;
  const n =
    typeof major === "string"
      ? Math.round(Number.parseFloat(major) * factor)
      : Math.round(major * factor);
  if (!Number.isFinite(n)) throw new Error(`Invalid money input: ${String(major)} ${currency}`);
  return { amount: BigInt(n), currency };
}

/** Construct money directly from minor units (e.g. cents). */
export function minor(amount: bigint | number, currency: Currency): Money {
  return { amount: BigInt(amount), currency };
}

export function add(a: Money, b: Money): Money {
  guardSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function sub(a: Money, b: Money): Money {
  guardSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function neg(a: Money): Money {
  return { amount: -a.amount, currency: a.currency };
}

export function eq(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amount === b.amount;
}

export function format(m: Money): string {
  const dp = decimalsFor(m.currency);
  const negative = m.amount < 0n;
  const abs = negative ? -m.amount : m.amount;
  const factor = 10n ** BigInt(dp);
  const major = abs / factor;
  const minorPart = abs % factor;
  const minorStr = minorPart.toString().padStart(dp, "0");
  return `${negative ? "-" : ""}${m.currency} ${major}.${minorStr}`;
}

function guardSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Currency mismatch: ${a.currency} vs ${b.currency}. FX conversions require an explicit FxConverted event (P5).`,
    );
  }
}
