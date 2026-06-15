// platform/risk/sa-ccr/v2-money-bridge.ts
//
// v1 ↔ v2 Money bridge for the SA-CCR / FX-valuation v2-model boundary.
//
// v1 Money is `{ amount: bigint, currency }` where `amount` is INTEGER MINOR
// units (cents). v2 Money is now DECIMAL-NATIVE
// (D-V2-CORE-MONEY-DECIMAL-NATIVE): `{ amount: string, currency }` where `amount`
// is a canonical decimal string in MAJOR units (e.g. `"1234.56"`).
//
// This is V1-SIDE infrastructure (it imports v2-core; the v2→v1 boundary forbids
// only the reverse). It is the single place the two money encodings are bridged
// so the SA-CCR/FX recon harnesses and the production CCR emitter convert
// consistently. The bridge pins 2dp (the anchor-book convention; all SA-CCR/FX
// currencies are carried at 2dp for v1 byte-parity).
//
// Author: Atlas (Chief Technology Officer / Core banking platform architect).

import type { Money as V2Money } from "../../../v2-core/fil-core/primitives";
import { roundDecimal, toCanonicalString, toDecimal } from "../../core/decimal-engine";
import { type Money as V1Money, minor as v1Minor } from "../../core/money";
import type { Currency } from "../../core/types";

const DP = 2;
const SCALE = 100n; // 10 ** DP

/** v1 Money (integer minor bigint) → v2 decimal-native Money (major decimal string). */
export function v1ToV2Money(m: V1Money): V2Money {
  return { currency: String(m.currency), amount: minorBigintToMajorString(m.amount) };
}

/** v2 decimal-native Money (major decimal string) → v1 Money (integer minor bigint). */
export function v2ToV1Money(m: V2Money): V1Money {
  return v1Minor(v2MoneyToMinor(m), m.currency as Currency);
}

/** v2 decimal-native Money → integer minor units (2dp). Fail-closed on >2dp. */
export function v2MoneyToMinor(m: V2Money): bigint {
  return majorStringToMinorBigint(m.amount);
}

/**
 * A legacy event field that carries integer MINOR units as a JS `number`
 * (e.g. `npvClosingMinor`, `unrealisedPnlZarMinor` on the v1 `*Revalued`
 * events) → canonical MAJOR-unit decimal string. Routes through the decimal
 * engine — NO float arithmetic (`recon:no-float-money-arithmetic`): the number
 * is parsed as a decimal string, rounded to whole minor units (HALF_UP,
 * defensive against any float representation), then shifted to major units.
 */
export function legacyMinorNumberToMajorString(value: number): string {
  const wholeMinor = roundDecimal(toDecimal(String(value)), 0, "HALF_UP");
  return minorBigintToMajorString(BigInt(toCanonicalString(wholeMinor)));
}

/** Integer minor units (2dp) → canonical major-unit decimal string. */
export function minorBigintToMajorString(minorUnits: bigint): string {
  const neg = minorUnits < 0n;
  const abs = (neg ? -minorUnits : minorUnits).toString().padStart(DP + 1, "0");
  const whole = abs.slice(0, abs.length - DP);
  const frac = abs.slice(abs.length - DP);
  const body = frac === "00" ? whole : `${whole}.${frac}`;
  return neg && body !== "0" ? `-${body}` : body;
}

/** Canonical major-unit decimal string (≤2dp) → integer minor units. Fail-closed. */
export function majorStringToMinorBigint(amount: string): bigint {
  const trimmed = amount.trim();
  const neg = trimmed.startsWith("-");
  const unsigned = neg ? trimmed.slice(1) : trimmed;
  const parts = unsigned.split(".");
  const whole = parts[0] ?? "0";
  const frac = parts[1] ?? "";
  if (frac.length > DP) {
    throw new RangeError(`v2-money-bridge: amount ${amount} carries more than ${DP}dp`);
  }
  const fracPadded = frac.padEnd(DP, "0");
  const magnitude = BigInt(whole === "" ? "0" : whole) * SCALE + BigInt(fracPadded || "0");
  return neg ? -magnitude : magnitude;
}
