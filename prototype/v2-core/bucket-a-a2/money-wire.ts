// v2-core/bucket-a-a2/money-wire.ts
//
// MoneyWire builders for the Bucket A batch-A2 store-tee codecs.
//
// The generic V1→v2 store-tee (`platform/event-store/v2-store-tee.ts`) passes
// each V1 payload through a registry-declared codec before persisting it on the
// v2 control-plane store. For the money-FREE batches the codec is `VERBATIM`.
// For the money-BEARING Bucket-A batch-A2 types the codec must lift the legacy
// numeric money field into the decimal-native `MoneyWire` shape
// (`{ __money: "v1", amount: <MAJOR-unit decimal string>, currency }`), the same
// on-the-wire shape the v1 platform decimal-native cutover uses
// (D-V2-CORE-MONEY-DECIMAL-NATIVE).
//
// WHY RE-DECLARE THE WIRE SHAPE HERE (not import platform/core/money-codec):
//   The codec lives on a v2-core registry row (the tee reads it from
//   `v2TeeCodecFor`). v2-core has a HARD no-v1-import boundary
//   (`recon:v2-no-v1-import`) — it may not import `platform/core/money-codec.ts`.
//   So this module re-declares the minimal MoneyWire builders the codecs need,
//   using the v2-core decimal engine (`fil-core/decimal.ts`) for exact,
//   IEEE-754-free conversion. The wire shape is byte-identical to the platform
//   `MoneyWire` (`platform/core/money-codec.ts` — `{ __money:"v1", amount, currency }`).
//
// CURRENCY SOURCING (Engineering Charter cmd 4 — source, don't hardcode;
// Principle 5 — multi-currency at the type level): every codec resolves the
// currency from the V1 payload itself. Types that carry a `currency` field use
// it verbatim. Types whose money field is structurally denominated by its schema
// (the `*ZAR` field-name suffix on ClimateScenarioRun; the schema-documented
// "ZAR minor units" on CounterpartyExposureCalculated; the statutory ZAR PAIA
// fee) source ZAR from that declared denomination — NOT a `?? "ZAR"` fallback
// default. Each per-type currency-source decision is recorded in `events.ts`.
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V2-CORE-MONEY-DECIMAL-NATIVE (MoneyWire MAJOR-unit).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:bucket-a-a2-emittable-numeric-money-types:2026-06-16.
// Principle 1 (events are truth); Principle 5 (multi-currency at the type level).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { decimalToString, divD, toDecimal } from "../fil-core/decimal";

/**
 * The on-the-wire shape of a money field in an event payload — byte-identical to
 * the platform `MoneyWire` (`platform/core/money-codec.ts`). The `__money`
 * discriminant lets the structural no-float walker detect money fields without a
 * field-name allowlist; `amount` is ALWAYS a decimal string (MAJOR units), never
 * a JSON number.
 */
export interface MoneyWire {
  readonly __money: "v1";
  readonly amount: string;
  readonly currency: string;
}

const MONEY_DISCRIMINANT = "v1" as const;

/**
 * Shared v2-core Zod schema for a `MoneyWire` money field. Byte-identical to the
 * platform `MoneyWire`. This is the REUSABLE control-plane money primitive: any
 * v2-native control-plane event that carries a decimal-native money field uses
 * this schema (e.g. `V2RiskAppetiteSet.floor`, the batch-A2 mirror payloads).
 * `amount` is a MAJOR-unit decimal string; `currency` is carried explicitly
 * (Principle 5 — multi-currency at the type level; no untyped currency default).
 */
export const moneyWireSchema: z.ZodType<MoneyWire> = z.object({
  __money: z.literal(MONEY_DISCRIMINANT),
  amount: z.string().min(1),
  currency: z.string().min(1),
});

/**
 * Build a `MoneyWire` from a MAJOR-unit decimal STRING (e.g. a register value
 * that is already a major-unit figure). The string is canonicalised through the
 * decimal engine — no IEEE-754 arithmetic. The caller resolves `currency`
 * explicitly from the value's declared denomination (no `?? "ZAR"` default).
 */
export function moneyWireFromMajorString(majorAmount: string, currency: string): MoneyWire {
  return {
    __money: MONEY_DISCRIMINANT,
    amount: decimalToString(toDecimal(majorAmount)),
    currency,
  };
}

/**
 * ISO 4217 minor-unit exponent table for the currencies that appear on the
 * MINOR-encoded Bucket-A batch-A2 types (CorrespondentSettlementInstructionSent,
 * NostroStatementReceived, CounterpartyExposureCalculated). All are 2-dp
 * currencies; the table is explicit (not a blanket constant) so an unexpected
 * currency fails closed rather than silently mis-scaling. ZAR/USD/EUR/GBP/USD-
 * family minor units = cents (10^2). Authority: ISO 4217; Principle 5.
 */
const MINOR_UNIT_EXPONENT: Readonly<Record<string, number>> = {
  ZAR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  AUD: 2,
  CAD: 2,
  CHF: 2,
  CNY: 2,
};

/**
 * Resolve the minor-unit exponent for `currency`, failing CLOSED on an
 * unrecognised code rather than guessing 2 — a mis-scaled money amount is a
 * silent correctness hole the Charter forbids (cmd 2 fail-closed, cmd 4 source).
 */
function minorExponentFor(currency: string): number {
  const exp = MINOR_UNIT_EXPONENT[currency];
  if (exp === undefined) {
    throw new Error(
      `bucket-a-a2 money-wire: no ISO 4217 minor-unit exponent registered for currency "${currency}". Add it to MINOR_UNIT_EXPONENT (fail-closed — never assume a scale). Authority: ISO 4217; Principle 5.`,
    );
  }
  return exp;
}

/**
 * Build a `MoneyWire` from a MAJOR-unit numeric amount (e.g. the plain
 * `z.number()` `amount` / `notional` / `fee` / `*ZAR` fields). The number is
 * stringified and canonicalised through the decimal engine — no IEEE-754
 * arithmetic. The caller has already resolved `currency` from the payload.
 */
export function moneyWireFromMajorNumber(majorAmount: number, currency: string): MoneyWire {
  return {
    __money: MONEY_DISCRIMINANT,
    amount: decimalToString(toDecimal(String(majorAmount))),
    currency,
  };
}

/**
 * Build a `MoneyWire` from a MINOR-unit integer amount (e.g. the
 * `instructedAmount` / `closingBalance` / `grossExposure` cents fields). Divides
 * by 10^exponent via the decimal engine (exact; no float). The caller has
 * already resolved `currency` from the payload.
 */
export function moneyWireFromMinorNumber(minorAmount: number, currency: string): MoneyWire {
  const exp = minorExponentFor(currency);
  const divisor = decimalToString(toDecimal(String(10 ** exp)));
  const major = divD(toDecimal(String(minorAmount)), toDecimal(divisor));
  return {
    __money: MONEY_DISCRIMINANT,
    amount: decimalToString(major),
    currency,
  };
}

/** True iff `v` is a well-formed MoneyWire object (string amount). */
export function isMoneyWire(v: unknown): v is MoneyWire {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.__money === MONEY_DISCRIMINANT &&
    typeof o.amount === "string" &&
    typeof o.currency === "string"
  );
}
