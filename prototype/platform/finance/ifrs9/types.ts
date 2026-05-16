// platform/finance/ifrs9/types.ts
//
// IFRS 9 classifier output types for the FX Spot accounting pipeline.
//
// These types form the contract between the sub-ledger projection
// (fxSubLedgerProjection) and the trial balance / GL layer.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//   - IFRS 9 §4.1.4, §3.2.3
//   - IAS 21 §23
//
// Authors: Bea (Accounting & financial reporting engineer, engineering)

/**
 * A classified, double-entry journal entry produced by the IFRS 9
 * classifier from a SubLedgerRow. Each entry is in a single currency;
 * direction is determined by the debit/credit account pair.
 *
 * Accounting identity: the set of entries for a complete trade lifecycle
 * must be balanced (sum debits = sum credits) per currency.
 */
export type IfrsJournalEntry = {
  /** Deterministic: `${tradeId}-${legKind}-${sequenceNumber}` */
  readonly entryId: string;
  /** Internal trade / instrument identifier (from SubLedgerRow.externalRef or instrumentId). */
  readonly tradeId: string;
  /** Matches SubLedgerRow["legKind"]. */
  readonly legKind: string;
  /** Chart-of-accounts leaf account ID (ACC-NNNN-NNN). */
  readonly debitAccount: string;
  /** Chart-of-accounts leaf account ID (ACC-NNNN-NNN). */
  readonly creditAccount: string;
  /** ISO 4217 currency code. */
  readonly currency: string;
  /** Amount in minor currency units (always positive; direction set by debit/credit accounts). */
  readonly amountMinor: number;
  /** IFRS reference, e.g. "IFRS9-§4.1.4" or "IAS21-§23". */
  readonly ifrsRef: string;
  /** ISO 8601 date of classification (SubLedgerRow.asOf). */
  readonly classificationDate: string;
};

/**
 * A per-(account, currency) balance row in an IFRS trial balance.
 * Sign convention: positive = debit balance; negative = credit balance.
 */
export type IfrsTrialBalanceRow = {
  readonly leafAccountId: string;
  readonly currency: string;
  /** Signed amount in minor units. Positive = net debit; negative = net credit. */
  readonly amountMinor: number;
};

/**
 * IFRS trial balance computed from IfrsJournalEntry[].
 */
export type IfrsTrialBalance = {
  readonly rows: readonly IfrsTrialBalanceRow[];
  readonly perCurrencyTotals: readonly {
    readonly currency: string;
    readonly debitMinor: number;
    readonly creditMinor: number;
  }[];
};
