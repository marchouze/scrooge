// v2-core/fil-core/decimal.ts
//
// v2-NATIVE exact-decimal arithmetic — the SOLE `decimal.js` import site in the
// v2-core package.
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
//   v2-core has a HARD no-v1-import boundary (`recon:v2-no-v1-import`): it MUST
//   NOT import `platform/core/decimal-engine` (the v1 decimal wrapper) nor any
//   other `platform/` / `runtime/` / `domains/` module. But `decimal.js@10.6.0`
//   is an npm dependency (pinned EXACTLY in prototype/package.json) and a BARE
//   specifier — importing it directly is PERMITTED by the boundary (which forbids
//   the v1 code-line, not vetted npm packages). This module therefore mirrors the
//   public surface of `platform/core/decimal-engine.ts` (read for reference, NOT
//   imported) so the v2 money layer talks to THIS module, never to `decimal.js`
//   directly. It is the one place to swap should the library ever be disallowed.
//
//   The contract is *exactness* (no IEEE-754 float drift), NOT the library
//   (platform decimal-engine §1.1). Rounding is NEVER implicit — every reduction
//   in precision goes through `roundDecimal` at an explicit currency boundary.
//
// Authority: D-V2-CORE-MONEY-DECIMAL-NATIVE (CEO-approved 2026-06-15);
//   D-DECIMAL-NATIVE-MONEY-ARITHMETIC; D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Atlas (Chief Technology Officer / Core banking platform architect).

import Decimal from "decimal.js";

// Configure the shared decimal context once, at module load. High precision so
// intermediate products/quotients never lose significance before an EXPLICIT
// rounding boundary applies the currency scale (mirrors platform decimal-engine).
Decimal.set({
  precision: 60,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -9e15,
  toExpPos: 9e15,
});

/** Opaque exact-decimal value. Callers treat it as a black box. */
export type DecimalValue = Decimal;

const CANONICAL_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$|^-?0?\.\d+$/;

/**
 * Parse a canonical decimal STRING into an exact decimal. Strings are the only
 * accepted text form for money (JSON numbers are banned — IEEE-754 floats).
 * Throws on a non-finite or malformed string (fail-closed, Engineering Charter
 * command 2).
 */
export function toDecimal(value: string): DecimalValue {
  if (typeof value !== "string") {
    throw new TypeError(`v2 decimal: expected a string, got ${typeof value}`);
  }
  const trimmed = value.trim();
  if (!CANONICAL_DECIMAL.test(trimmed) && !/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new RangeError(`v2 decimal: not a valid decimal string: "${value}"`);
  }
  const d = new Decimal(trimmed);
  if (!d.isFinite()) {
    throw new RangeError(`v2 decimal: non-finite decimal: "${value}"`);
  }
  return d;
}

/**
 * Render an exact decimal back to its CANONICAL string form: plain notation
 * (never exponential), minus sign only when negative, no trailing-zero noise
 * beyond what the value carries. This is the only serialised form (mirrors
 * platform `toCanonicalString`).
 */
export function decimalToString(d: DecimalValue): string {
  return d.toFixed(); // plain, no exponent, full carried precision
}

// ---- exact arithmetic (never rounds) ----
export const addD = (a: DecimalValue, b: DecimalValue): DecimalValue => a.plus(b);
export const subD = (a: DecimalValue, b: DecimalValue): DecimalValue => a.minus(b);
export const negD = (a: DecimalValue): DecimalValue => a.negated();
export const mulD = (a: DecimalValue, b: DecimalValue): DecimalValue => a.times(b);
export const absD = (a: DecimalValue): DecimalValue => a.abs();
export const isZeroD = (a: DecimalValue): boolean => a.isZero();
export const isNegativeD = (a: DecimalValue): boolean => a.isNegative();
export const cmpD = (a: DecimalValue, b: DecimalValue): -1 | 0 | 1 => a.cmp(b) as -1 | 0 | 1;
export const eqD = (a: DecimalValue, b: DecimalValue): boolean => a.eq(b);

/**
 * Division WITHOUT rounding to a currency scale — a full-precision quotient
 * bounded by a fixed working precision (28 significant digits) so a
 * non-terminating quotient (e.g. premium ÷ days) is deterministic and stable
 * across replays, matching the platform decimal-engine's separable
 * divide-then-round design. The rounding itself is applied explicitly by the
 * caller via `roundDecimal`.
 */
export function divD(a: DecimalValue, b: DecimalValue): DecimalValue {
  if (b.isZero()) {
    throw new RangeError("v2 decimal: division by zero");
  }
  return a.div(b).toSignificantDigits(28);
}

export type DecimalRoundingMode = "HALF_UP" | "HALF_EVEN" | "DOWN" | "UP";

const ROUNDING_MODE_MAP: Record<DecimalRoundingMode, Decimal.Rounding> = {
  HALF_UP: Decimal.ROUND_HALF_UP, // half-away-from-zero
  HALF_EVEN: Decimal.ROUND_HALF_EVEN, // bankers'
  DOWN: Decimal.ROUND_DOWN,
  UP: Decimal.ROUND_UP,
};

/**
 * Round an exact decimal to `dp` decimal places using `mode`. The ONLY function
 * that reduces precision. Pure — returns a new value.
 */
export function roundDecimal(
  d: DecimalValue,
  dp: number,
  mode: DecimalRoundingMode,
): DecimalValue {
  if (!Number.isInteger(dp) || dp < 0) {
    throw new RangeError(`v2 decimal: dp must be a non-negative integer, got ${dp}`);
  }
  return d.toDecimalPlaces(dp, ROUNDING_MODE_MAP[mode]);
}

export const ZERO_D = new Decimal(0);
