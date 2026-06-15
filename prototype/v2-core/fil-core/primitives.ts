// v2-core/fil-core/primitives.ts
//
// FIL-Core v2-native primitives. The v2 core package is a FRESH code-line
// with a HARD no-v1-import boundary (D-V2-REPO-STRATEGY-REEXAMINATION): it
// MUST NOT import currency/instant/money types from v1 (`platform/`,
// `runtime/`, …). These minimal primitives are the v2-native vocabulary the
// kernel and facet contracts are expressed in. They are deliberately small —
// S0 is skeleton-only; richer money/curve machinery lands with the facet
// implementations in later slices (S7-FIL onward).
//
// Authority: D-V2-REPO-STRATEGY-REEXAMINATION; D-FIL-FRAMEWORK-UNIFICATION.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import { type DecimalValue, addD, decimalToString, subD, toDecimal } from "./decimal";

/**
 * An ISO-8601 instant. Kept as a branded string at the kernel level — the v2
 * core does not depend on any v1 clock; consumers thread their own instant in.
 */
export type Instant = string & { readonly __brand: "fil.Instant" };

export const instantSchema = z
  .string()
  .datetime({ offset: true })
  .transform((s) => s as Instant);

/**
 * Multi-currency from day one (Principle 5): money is amount + currency at the
 * type level, never a bare number.
 *
 * DECIMAL-NATIVE (D-V2-CORE-MONEY-DECIMAL-NATIVE, 2026-06-15): the amount is a
 * CANONICAL DECIMAL STRING in MAJOR units (e.g. `"1234.56"`), NEVER a JS `number`
 * (IEEE-754) and NEVER a minor-unit `bigint`. This mirrors the v1/platform
 * decimal-native cutover (D-DECIMAL-NATIVE-MONEY-ARITHMETIC, `MoneyWire`): minor-
 * unit encoding is GONE bank-wide. All arithmetic on money goes through the v2
 * decimal helper (`fil-core/decimal.ts`), the sole `decimal.js` import site —
 * never `amount * x` / `amount / x` (the no-float-money gate forbids it).
 */
export interface Money {
  readonly currency: string; // ISO-4217 alpha-3; validated by facet implementations, not the kernel
  /** Canonical decimal string in MAJOR units. NEVER a number; NEVER minor units. */
  readonly amount: string;
}

/** Canonical decimal-string refinement for the money amount (no JSON-number). */
const DECIMAL_STRING = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$|^-?0?\.\d+$/;

export const moneySchema: z.ZodType<Money> = z.object({
  currency: z.string().length(3),
  amount: z.string().refine((s) => DECIMAL_STRING.test(s.trim()), {
    message: "Money.amount must be a canonical decimal string (major units), never a number",
  }),
});

// ---------------------------------------------------------------------------
// Money constructors + decimal-native arithmetic helpers. These are the kernel
// vocabulary every v2 money site uses; raw struct literals are reserved for
// trivial zero/echo cases inside the kernel itself.
// ---------------------------------------------------------------------------

/** Construct money from a currency + canonical decimal string (validated). */
export function money(currency: string, amount: string): Money {
  // Validate the decimal string fail-closed; canonicalise (strip leading +, etc.).
  return { currency, amount: decimalToString(toDecimal(amount)) };
}

/** Construct money from a decimal value (canonical string serialisation). */
export function moneyFromDecimal(currency: string, d: DecimalValue): Money {
  return { currency, amount: decimalToString(d) };
}

/** Zero in a currency. */
export function zeroMoney(currency: string): Money {
  return { currency, amount: "0" };
}

function assertSameCurrency(label: string, a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Money ${label}: currency mismatch — ${a.currency} vs ${b.currency} (fail-closed)`,
    );
  }
}

/** a + b (same currency; fail-closed). Decimal-exact. */
export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency("add", a, b);
  return moneyFromDecimal(a.currency, addD(toDecimal(a.amount), toDecimal(b.amount)));
}

/** a − b (same currency; fail-closed). Decimal-exact. */
export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency("sub", a, b);
  return moneyFromDecimal(a.currency, subD(toDecimal(a.amount), toDecimal(b.amount)));
}

/** A typed citation pointer into the single graph (Principle 2). */
export type CitationRef = string & { readonly __brand: "fil.CitationRef" };

export const citationRefSchema = z
  .string()
  .min(1)
  .transform((s) => s as CitationRef);

/**
 * A methodology hash — the integrity/idempotency anchor for a FIL-Model
 * implementation version (D-MODEL-BINDING-CONTRACT-V1, absorbed into
 * D-FIL-FRAMEWORK-V1). Opaque at the kernel level.
 */
export type MethodologyHash = string & { readonly __brand: "fil.MethodologyHash" };

export const methodologyHashSchema = z
  .string()
  .min(1)
  .transform((s) => s as MethodologyHash);
