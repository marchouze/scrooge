// platform/accounting/fx-accounting-types.ts
//
// Shared types for the FX accounting layer. Extracted to avoid circular
// imports between posting-rules/ and fx-calculators.ts.
//
// Authors: Camille (CFO, finance) + Bea (Accounting & financial reporting
//   engineer, engineering)

import { type Money, amountToMinorUnits, moneyFromMinorUnits } from "../core/decimal-money";
import type { Currency } from "../core/types";

/**
 * A single double-entry posting leg. Used by posting rule functions
 * (fx-spot.ts) and consumed by SubLedgerPostingEmitted event construction.
 *
 * DECIMAL-NATIVE SOURCE OF TRUTH (D-DECIMAL-NATIVE-MONEY-ARITHMETIC, slice 1).
 * `amount` is the exact-decimal `Money` the production layer computes; it is
 * THE source of truth. `amountMinor` is a DERIVED compat field —
 * `amountMinor === Number(amountToMinorUnits(amount))` by construction (asserted
 * by recon:sub-ledger-leg-decimal-parity). The 269 downstream consumers (trial
 * balance, GL projection, BA-300/400/700 renderers) keep reading the derived
 * `amountMinor` until a later slice migrates them to read `amount`; only then
 * does `amountMinor` retire (Nadia/Vera review at removal). Two parallel
 * computations of the same magnitude are NOT permitted — always construct a leg
 * through `subLedgerLegFromMoney` / `subLedgerLegFromMinor`, never by writing
 * `amount` and `amountMinor` independently.
 */
export interface SubLedgerLeg {
  /** Chart-of-accounts leaf account ID (ACC-NNNN-NNN). */
  readonly accountId: string;
  readonly debitCredit: "debit" | "credit";
  /**
   * Exact-decimal leg amount (always non-negative; `debitCredit` carries the
   * sign). The source of truth for the leg magnitude (Principle 1 exactness —
   * no float, no Math.round in its derivation).
   */
  readonly amount: Money<Currency>;
  /**
   * Amount in minor currency units (always positive). DERIVED from `amount` —
   * a compat field for the not-yet-migrated consumer surface. Never computed
   * independently of `amount`.
   */
  readonly amountMinor: number;
  /** ISO 4217 currency code. */
  readonly currency: string;
}

/** The non-amount axes of a leg — supplied by the producer, then paired with a
 *  magnitude by the constructor helpers below. */
type LegBase = Pick<SubLedgerLeg, "accountId" | "debitCredit"> & {
  readonly currency: string;
};

/**
 * Construct a leg from a decimal `Money` magnitude — the decimal-native path.
 * `amount` is the source of truth; `amountMinor` is derived via
 * `amountToMinorUnits` (it throws if `amount` carries more precision than the
 * currency scale, forcing the producer to round EXPLICITLY at its boundary
 * before constructing the leg — a leg may not silently truncate). `currency`
 * is taken from the money so the two cannot disagree.
 */
export function subLedgerLegFromMoney(
  base: Pick<SubLedgerLeg, "accountId" | "debitCredit">,
  amount: Money<Currency>,
): SubLedgerLeg {
  return {
    accountId: base.accountId,
    debitCredit: base.debitCredit,
    amount,
    amountMinor: Number(amountToMinorUnits(amount)),
    currency: amount.currency,
  };
}

/**
 * Construct a leg from an EXACT integer minor-unit magnitude (the legacy
 * producer shape: an already-integer `number`/`bigint` of cents). The integer
 * is losslessly lifted to the decimal `amount` source of truth
 * (`moneyFromMinorUnits`), then `amountMinor` is derived back from it — so the
 * figure is provably identical to the input integer (no rounding occurs: an
 * integer minor-unit value is exact at the currency scale). This is the
 * migration bridge for producers that already hold an integer magnitude
 * (fx-spot.ts, reconciliation deltas, rebook scripts).
 */
export function subLedgerLegFromMinor(base: LegBase, minor: number | bigint): SubLedgerLeg {
  const minorBig = typeof minor === "bigint" ? minor : BigInt(Math.trunc(minor));
  const magnitude = minorBig < 0n ? -minorBig : minorBig;
  const amount = moneyFromMinorUnits(magnitude, base.currency as Currency);
  return {
    accountId: base.accountId,
    debitCredit: base.debitCredit,
    amount,
    amountMinor: Number(amountToMinorUnits(amount)),
    currency: base.currency,
  };
}
