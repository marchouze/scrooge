// platform/core/money.ts
//
// Typed money. Every monetary value carries its currency at the type level
// (P5). Arithmetic across currencies is rejected at runtime; FX conversion
// is an explicit event with a rate source, rate timestamp, and citation.
//
// Amounts are stored as bigint in minor units (cents for ZAR / USD / EUR /
// GBP) to avoid float drift. Higher-precision currencies that require more
// than 2 dp are not yet supported in the prototype.
//
// Author: Atlas

import type { Currency } from "./types";

export interface Money {
  readonly amount: bigint; // minor units
  readonly currency: Currency;
}

const DECIMALS: Record<string, number> = {
  ZAR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
};

function decimalsFor(currency: Currency): number {
  const d = DECIMALS[currency];
  if (d === undefined) throw new Error(`Unsupported currency: ${currency}. Add to DECIMALS.`);
  return d;
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
