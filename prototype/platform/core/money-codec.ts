// platform/core/money-codec.ts
//
// Event-payload codec for the decimal `Money` type. Money serialises as a
// `{ amount: <decimal-string>, currency: <code> }` object — `amount` is ALWAYS
// a JSON string, NEVER a JSON number (JSON numbers are IEEE-754 floats, banned
// for money). On read the codec parses the string back into the exact decimal
// `Money` (validating it round-trips).
//
// This module also defines HOW A SCHEMA DECLARES A MONEY FIELD: a field is a
// money field iff its serialised shape is `MoneyWire` (the `__money` discriminant
// + string amount). The `recon:money-codec-no-float` gate (authored in slice 1,
// enforced fully in slice 5) asserts no money-bearing payload field is a JSON
// number. This replaces the `*Minor: bigint` convention, which retires in
// slice 2.
//
// Design spec §1.5 ("JSON / event codec").
//
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { fromMinorUnits, mulD, roundDecimal, toCanonicalString, toDecimal } from "./decimal-engine";
import { type Money, money } from "./decimal-money";
import { isKnownCurrency, scaleFor } from "./iso4217";
import type { Currency } from "./types";

/**
 * The on-the-wire shape of a money field in an event payload. The `__money`
 * discriminant lets a generic walker (and the no-float recon gate) detect a
 * money field structurally, without a per-schema field-name allowlist.
 */
export interface MoneyWire {
  readonly __money: "v1";
  /** Canonical decimal string. NEVER a number. */
  readonly amount: string;
  readonly currency: string;
}

/** A schema declares a money field by typing it `MoneyWire` in its payload
 *  interface (and using `encodeMoney`/`decodeMoney` at the producer /
 *  projection boundary). Example:
 *
 *  ```ts
 *  interface FxSpotBookedPayload {
 *    readonly tradeId: string;
 *    readonly boughtAmount: MoneyWire;   // ← money field
 *    readonly soldAmount: MoneyWire;     // ← money field
 *  }
 *  ```
 */

const MONEY_DISCRIMINANT = "v1" as const;

/**
 * Zod schema for a `MoneyWire` field in an event payload. Use this in V2
 * payload schemas wherever a legacy `*Minor: z.number().int()` field is being
 * lifted to decimal money. The `amount` is asserted to be a STRING (never a
 * JSON number — IEEE-754 floats are banned for money); the `__money`
 * discriminant must be the literal "v1". Validates structurally so the
 * `recon:money-codec-no-float` / `recon:no-residual-minor-encoding` gates and
 * the factory-level parse agree on the wire shape.
 *
 * Authority: D-MONEY-DECIMAL-REDENOMINATION; WS-MONEY-DECIMAL-PURGE-REMEDIATION
 * Wave 2 (D-MONEY-DECIMAL-PURGE-REMEDIATION).
 */
export const moneyWireSchema: z.ZodType<MoneyWire> = z.object({
  __money: z.literal(MONEY_DISCRIMINANT),
  amount: z.string().min(1),
  currency: z.string().min(1),
});

/** Encode a `Money` into its wire form for an event payload. */
export function encodeMoney(m: Money): MoneyWire {
  // Re-canonicalise defensively so an externally-constructed Money cannot
  // smuggle a non-canonical or float-derived string onto the wire.
  return {
    __money: MONEY_DISCRIMINANT,
    amount: toCanonicalString(toDecimal(m.amount)),
    currency: m.currency,
  };
}

/** True if a value is a well-formed money wire object (string amount). */
export function isMoneyWire(v: unknown): v is MoneyWire {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.__money === MONEY_DISCRIMINANT &&
    typeof o.amount === "string" &&
    typeof o.currency === "string"
  );
}

/**
 * Decode a money wire object back into the exact decimal `Money`. Throws if the
 * amount is not a string (e.g. a JSON number slipped in — a float-money
 * violation), if the currency is unknown to ISO 4217, or if the decimal string
 * is malformed.
 */
export function decodeMoney<C extends Currency = Currency>(wire: unknown): Money<C> {
  if (!isMoneyWire(wire)) {
    // The single most important guard: reject a numeric amount loudly.
    if (
      typeof wire === "object" &&
      wire !== null &&
      typeof (wire as Record<string, unknown>).amount === "number"
    ) {
      throw new TypeError(
        "money-codec: amount is a JSON number — money must serialise as a decimal string (no IEEE-754 floats).",
      );
    }
    throw new TypeError(`money-codec: not a valid money wire object: ${JSON.stringify(wire)}`);
  }
  if (!isKnownCurrency(wire.currency as Currency)) {
    // Unknown currencies still decode (the ISO table degrades to a policy
    // default scale, never a throw), but we surface it for the no-float gate's
    // sibling currency-coverage check.
  }
  return money(wire.amount, wire.currency as C);
}

// ─────────────── Minor-unit bridge (slice 2 migration helper) ───────────────
//
// Legacy event schemas encode money as `*Minor: number` (integer minor units,
// e.g. ZAR cents). The V2 schemas use MoneyWire (decimal string major units).
// These helpers bridge between the two representations.

/**
 * Convert a minor-unit integer (e.g. ZAR cents: 10050 → R100.50) to the
 * canonical `MoneyWire`. The exponent is looked up from the ISO 4217 table
 * (`scaleFor`); a no-minor-unit currency defaults to 2 dp (policy default,
 * never throws). Used by decode* helpers in slice-2 V2 event types.
 */
export function moneyWireFromMinor(minorAmount: number, currency: string): MoneyWire {
  const scale = scaleFor(currency as Currency);
  // Use the Decimal engine's fromMinorUnits to avoid any IEEE-754 drift.
  const majorStr = toCanonicalString(fromMinorUnits(BigInt(Math.round(minorAmount)), scale));
  return {
    __money: MONEY_DISCRIMINANT,
    amount: majorStr,
    currency,
  };
}

/**
 * Convert a MoneyWire back to a minor-unit integer (rounding HALF_UP at the
 * currency exponent). Used for round-trip testing and legacy interface bridging.
 */
export function minorFromMoneyWire(wire: MoneyWire): number {
  const scale = scaleFor(wire.currency as Currency);
  const factor = 10 ** scale;
  const dec = toDecimal(wire.amount);
  const minorDec = mulD(dec, toDecimal(factor.toString()));
  return Number(toCanonicalString(roundDecimal(minorDec, 0, "HALF_UP")));
}

/** Re-export `scaleFor` so callers can check the currency scale without a
 *  second import from iso4217. */
export { scaleFor };

// ─────────────── SubLedgerLeg amount boundary (read-migration slice 1) ───────
//
// D-DECIMAL-NATIVE-CONSUMER-MIGRATION-BEFORE-WAVE-3 (CEO-approved 2026-06-14).
// The GL-reader consumers must source a leg's value from the decimal `amount`
// source of truth, not the derived `amountMinor` compat field. But the legs
// these readers replay come straight off the event store, where the on-wire
// shape is mixed:
//   - production/emitted legs carry `amount` (a MoneyWire) — THE source of truth;
//   - legacy events carry only `amountMinor: number`.
// `legAmountMoney` is the single boundary that normalises both to the exact
// decimal `Money`. It prefers the on-wire `amount` (lossless decode) and only
// lifts `amountMinor` when `amount` is absent (legacy fallback). The parity gate
// `recon:sub-ledger-leg-decimal-parity` guarantees `amountMinor ===
// toMinorUnits(amount)` for emitted legs, so the two paths yield identical cents.
//
// Consolidating the legacy `amountMinor` read HERE lets the reader files
// (gl-projection, period-close, suspense-report, designated-currency-ledger,
// gl-subledger-recon, fx-subledger-trade-reconciliation) drop their textual
// dependency on `.amountMinor`. `amountMinor` stays on the payload type until a
// later decider slice (Nadia/Vera) retires it.

/** Minimal structural view of a posted leg as it arrives off the event store. */
export interface RawLegMoney {
  /** Decimal amount source of truth (present on emitted legs). */
  readonly amount?: MoneyWire | unknown;
  /** Legacy derived minor-unit compat field (legacy events only). */
  readonly amountMinor?: number;
  /** ISO 4217 currency. */
  readonly currency?: string;
}

/**
 * Normalise a posted leg's value to the exact decimal `Money`, regardless of
 * whether it arrived with the decimal `amount` source of truth or only the
 * legacy `amountMinor` compat field. Prefers `amount`; falls back to lifting
 * `amountMinor` via `moneyWireFromMinor`. Throws (via `decodeMoney`) on a
 * float-money violation in the wire `amount`.
 */
export function legAmountMoney<C extends Currency = Currency>(leg: RawLegMoney): Money<C> {
  if (isMoneyWire(leg.amount)) {
    return decodeMoney<C>(leg.amount);
  }
  const minor = typeof leg.amountMinor === "number" ? leg.amountMinor : 0;
  const currency = typeof leg.currency === "string" ? leg.currency : "ZAR";
  return decodeMoney<C>(moneyWireFromMinor(minor, currency));
}

/**
 * Walk an arbitrary payload and report any field whose value is a money wire
 * object carrying a NUMERIC amount (a float-money violation), plus any bare
 * `amount`/`*Minor`-looking numeric leaf that should have been a `MoneyWire`.
 * Used by `recon:money-codec-no-float`. Returns dotted paths of violations.
 */
export function findFloatMoneyViolations(payload: unknown): string[] {
  const violations: string[] = [];
  const visit = (node: unknown, path: string): void => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((v, i) => visit(v, `${path}[${i}]`));
      return;
    }
    const o = node as Record<string, unknown>;
    // A money wire object with a numeric amount is a hard violation.
    if (o.__money !== undefined && typeof o.amount === "number") {
      violations.push(`${path}.amount`);
    }
    for (const [k, v] of Object.entries(o)) {
      visit(v, path ? `${path}.${k}` : k);
    }
  };
  visit(payload, "");
  return violations;
}
