// platform/accounting/fx-accounting-types.ts
//
// Shared types for the FX accounting layer. Extracted to avoid circular
// imports between posting-rules/ and fx-calculators.ts.
//
// Authors: Camille (CFO, finance) + Bea (Accounting & financial reporting
//   engineer, engineering)

/**
 * A single double-entry posting leg. Used by posting rule functions
 * (fx-spot.ts) and consumed by SubLedgerPostingEmitted event construction.
 */
export interface SubLedgerLeg {
  /** Chart-of-accounts leaf account ID (ACC-NNNN-NNN). */
  readonly accountId: string;
  readonly debitCredit: "debit" | "credit";
  /** Amount in minor currency units (always positive). */
  readonly amountMinor: number;
  /** ISO 4217 currency code. */
  readonly currency: string;
}
