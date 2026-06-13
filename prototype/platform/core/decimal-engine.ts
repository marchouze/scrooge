// platform/core/decimal-engine.ts
//
// Thin, single-purpose wrapper around the vetted big-decimal dependency
// (`decimal.js`). The rest of the money layer talks to THIS module, never to
// `decimal.js` directly, so the engine is swappable behind a stable contract:
// the contract is *exactness* (no IEEE-754 float drift), not the library.
//
// ── DEPENDENCY-SECURITY NOTE (Principle 4) — for Rashida ─────────────────────
//   New runtime dependency: decimal.js, pinned EXACTLY to 10.6.0 in
//   prototype/package.json (no caret/tilde). decimal.js is a widely-audited,
//   zero-transitive-dependency arbitrary-precision decimal library (MIT). This
//   wrapper is the SOLE import site (enforced by the `decimal-engine-sole-
//   import` boundary intent — slice 2 adds the lint gate). FLAGGED for Rashida
//   (Chief Information Security Officer, governance) SBOM + dependency-security
//   review per Principle 4 / Joint Standard 2 of 2024 secure-SDLC. If the lib
//   is disallowed on review, this module is the only file to swap for the
//   documented bigint fixed-point fallback (the public surface below is the
//   fallback's contract too).
// ─────────────────────────────────────────────────────────────────────────────
//
// Design spec §1.1 ("the contract is exactness, not the library").
//
// Author: Atlas (Core banking platform architect, engineering).

import Decimal from "decimal.js";

/**
 * Configure the shared decimal context once, at module load. We use a very
 * high precision so intermediate products/quotients never lose significance
 * before an *explicit* rounding boundary applies the currency scale. Rounding
 * is NEVER implicit here — `Decimal` is configured to throw rather than
 * silently round if precision is exceeded mid-flight is not a concern because
 * 60 significant digits dwarfs any realistic banking magnitude, but we keep
 * arithmetic exact and defer all rounding to `roundDecimal`.
 */
Decimal.set({
  precision: 60,
  // Default rounding only applies to the (high) precision ceiling, never to a
  // currency scale; explicit rounding goes through `roundDecimal`.
  rounding: Decimal.ROUND_HALF_EVEN,
  // Reject implicit float coercion: constructing from a non-integer JS number
  // is a programming error (money must come from a string). Guarded in
  // `toDecimal` below; this just hardens the engine.
  toExpNeg: -9e15,
  toExpPos: 9e15,
});

/** Opaque exact-decimal value. Callers treat it as a black box. */
export type DecimalValue = Decimal;

const CANONICAL_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$|^-?0?\.\d+$/;

/**
 * Parse a canonical decimal STRING into an exact decimal. Strings are the only
 * accepted text form for money (JSON numbers are banned — they are IEEE-754
 * floats). Throws on a non-finite or malformed string.
 */
export function toDecimal(value: string): DecimalValue {
  if (typeof value !== "string") {
    throw new TypeError(`decimal-engine: expected a string, got ${typeof value}`);
  }
  const trimmed = value.trim();
  if (!CANONICAL_DECIMAL.test(trimmed) && !/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new RangeError(`decimal-engine: not a valid decimal string: "${value}"`);
  }
  const d = new Decimal(trimmed);
  if (!d.isFinite()) {
    throw new RangeError(`decimal-engine: non-finite decimal: "${value}"`);
  }
  return d;
}

/**
 * Render an exact decimal back to its CANONICAL string form: plain notation
 * (never exponential), minus sign only when negative, no trailing-zero noise
 * beyond what the value carries. This is the only serialised form.
 */
export function toCanonicalString(d: DecimalValue): string {
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
 * Division WITHOUT rounding to a currency scale — produces a full-precision
 * quotient (bounded only by the engine precision). Every division is a
 * rounding SITE, but the rounding itself is applied explicitly by the caller
 * via `roundDecimal`; this keeps "divide" and "round" as separable steps so a
 * call site can carry working precision and round once at the boundary
 * (design spec §1.2 / §1.4).
 */
export function divD(a: DecimalValue, b: DecimalValue): DecimalValue {
  if (b.isZero()) {
    throw new RangeError("decimal-engine: division by zero");
  }
  return a.div(b);
}

export type DecimalRoundingMode = "HALF_UP" | "HALF_EVEN" | "DOWN" | "UP";

const ROUNDING_MODE_MAP: Record<DecimalRoundingMode, Decimal.Rounding> = {
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
  DOWN: Decimal.ROUND_DOWN,
  UP: Decimal.ROUND_UP,
};

/**
 * Round an exact decimal to `scale` decimal places using `mode`. This is the
 * ONLY function that reduces precision. Pure — returns a new value.
 */
export function roundDecimal(
  d: DecimalValue,
  scale: number,
  mode: DecimalRoundingMode,
): DecimalValue {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new RangeError(`decimal-engine: scale must be a non-negative integer, got ${scale}`);
  }
  return d.toDecimalPlaces(scale, ROUNDING_MODE_MAP[mode]);
}

/** Construct a decimal from an integer count of minor units at a given scale
 *  (e.g. 123456 minor @ scale 2 → 1234.56). Used only at the legacy boundary
 *  while bigint `*Minor` producers are migrated (slice 2). */
export function fromMinorUnits(minorUnits: bigint, scale: number): DecimalValue {
  const sign = minorUnits < 0n ? "-" : "";
  const abs = (minorUnits < 0n ? -minorUnits : minorUnits).toString();
  if (scale === 0) return new Decimal(`${sign}${abs}`);
  const padded = abs.padStart(scale + 1, "0");
  const whole = padded.slice(0, padded.length - scale);
  const frac = padded.slice(padded.length - scale);
  return new Decimal(`${sign}${whole}.${frac}`);
}

/** Inverse of `fromMinorUnits`: an exact decimal already rounded to `scale`
 *  → integer minor units. Throws if the value carries more precision than
 *  `scale` (i.e. it was not rounded first). */
export function toMinorUnits(d: DecimalValue, scale: number): bigint {
  if (d.decimalPlaces() > scale) {
    throw new RangeError(
      `decimal-engine: value ${d.toFixed()} has more than ${scale} dp; round before converting to minor units`,
    );
  }
  const scaled = d.times(new Decimal(10).pow(scale));
  return BigInt(scaled.toFixed(0));
}

export const ZERO_D = new Decimal(0);
