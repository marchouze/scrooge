// platform/accounting/posting-rules/payments.ts
//
// Payment posting rules — three pure functions mapping payment lifecycle
// events to balanced double-entry GL postings.
//
// Posting rules implemented:
//   PR-PAY-001: paymentInitiatedJournals  — PaymentInitiated
//   PR-PAY-002: paymentSettledJournals    — PaymentSettled
//   PR-SET-001: settlementInstructionJournals — SettlementInstructionReceived
//
// All functions return SubLedgerLeg[] that balance per currency.
// Balance invariant: sum(debit.amountMinor) == sum(credit.amountMinor)
// per currency, per call.
//
// Chart-of-accounts references:
//   ACC-1200-001  Nostro — ZAR correspondent
//   ACC-1200-002  Nostro — USD correspondent
//   ACC-1200-003  Nostro — EUR correspondent
//   ACC-2200-001  Customer Payables — ZAR
//   ACC-2200-002  Customer Payables — USD
//   ACC-3100-001  Payment Suspense — ZAR
//   ACC-3100-002  Payment Suspense — USD
//   ACC-4100-001  Settlement Receivable — ZAR
//   ACC-4100-002  Settlement Receivable — USD
//
// Authority:
//   - PROC-PAY-RBH-01 (three-way reconciliation procedure)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - Banks Act 94 of 1990
//   - IAS 32 §11 (financial instrument recognition)
//   - IFRS 9 §3.1.1 (initial recognition)
//
// Authors: Bea (Accounting & financial reporting engineer, engineering)

import type {
  PaymentInitiatedPayload,
  PaymentSettledPayload,
  SettlementInstructionReceivedPayload,
} from "../../event-store/event-types/payments";
import type { SubLedgerLeg } from "../fx-accounting-types";

// ---------------------------------------------------------------------------
// Account ID constants — chart-of-accounts leaf IDs
// ---------------------------------------------------------------------------

export const PAYMENT_ACCOUNTS = {
  NOSTRO_ZAR: "ACC-1200-001",
  NOSTRO_USD: "ACC-1200-002",
  NOSTRO_EUR: "ACC-1200-003",
  CUSTOMER_PAYABLE_ZAR: "ACC-2200-001",
  CUSTOMER_PAYABLE_USD: "ACC-2200-002",
  SUSPENSE_ZAR: "ACC-3100-001",
  SUSPENSE_USD: "ACC-3100-002",
  SETTLEMENT_RECEIVABLE_ZAR: "ACC-4100-001",
  SETTLEMENT_RECEIVABLE_USD: "ACC-4100-002",
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map ISO 4217 currency code to the Nostro account ID for payment operations.
 * Throws for currencies without a dedicated account — per Principle 5 every
 * currency must have an explicit account; falling back to a catch-all is not
 * allowed in production code.
 */
export function nostroAccountForCurrency(ccy: string): string {
  switch (ccy) {
    case "ZAR":
      return PAYMENT_ACCOUNTS.NOSTRO_ZAR;
    case "USD":
      return PAYMENT_ACCOUNTS.NOSTRO_USD;
    case "EUR":
      return PAYMENT_ACCOUNTS.NOSTRO_EUR;
    default:
      throw new Error(
        `nostroAccountForCurrency: no nostro account for currency '${ccy}'. ` +
          `Add an ACC-1200-NNN entry to the chart of accounts (Principle 5).`,
      );
  }
}

/**
 * Map ISO 4217 currency code to the Payment Suspense account ID.
 * Throws for currencies without a dedicated suspense account.
 */
export function suspenseAccountForCurrency(ccy: string): string {
  switch (ccy) {
    case "ZAR":
      return PAYMENT_ACCOUNTS.SUSPENSE_ZAR;
    case "USD":
      return PAYMENT_ACCOUNTS.SUSPENSE_USD;
    default:
      throw new Error(
        `suspenseAccountForCurrency: no suspense account for currency '${ccy}'. ` +
          `Add an ACC-3100-NNN entry to the chart of accounts (Principle 5).`,
      );
  }
}

/**
 * Map ISO 4217 currency code to the Customer Payables account ID.
 * Throws for currencies without a dedicated payables account.
 */
export function customerPayableAccountForCurrency(ccy: string): string {
  switch (ccy) {
    case "ZAR":
      return PAYMENT_ACCOUNTS.CUSTOMER_PAYABLE_ZAR;
    case "USD":
      return PAYMENT_ACCOUNTS.CUSTOMER_PAYABLE_USD;
    default:
      throw new Error(
        `customerPayableAccountForCurrency: no customer payable account for currency '${ccy}'. ` +
          `Add an ACC-2200-NNN entry to the chart of accounts (Principle 5).`,
      );
  }
}

/**
 * Map ISO 4217 currency code to the Settlement Receivable account ID.
 * Throws for currencies without a dedicated receivable account.
 */
export function settlementReceivableAccountForCurrency(ccy: string): string {
  switch (ccy) {
    case "ZAR":
      return PAYMENT_ACCOUNTS.SETTLEMENT_RECEIVABLE_ZAR;
    case "USD":
      return PAYMENT_ACCOUNTS.SETTLEMENT_RECEIVABLE_USD;
    default:
      throw new Error(
        `settlementReceivableAccountForCurrency: no settlement receivable account for currency '${ccy}'. ` +
          `Add an ACC-4100-NNN entry to the chart of accounts (Principle 5).`,
      );
  }
}

/**
 * Validate that a set of legs balances per currency (debit total = credit
 * total per currency). Throws if not — this is a programming error, not a
 * data error.
 */
function assertBalanced(legs: SubLedgerLeg[], ruleId: string): void {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const leg of legs) {
    const t = totals.get(leg.currency) ?? { debit: 0, credit: 0 };
    if (leg.debitCredit === "debit") t.debit += leg.amountMinor;
    else t.credit += leg.amountMinor;
    totals.set(leg.currency, t);
  }
  for (const [ccy, t] of totals.entries()) {
    if (t.debit !== t.credit) {
      throw new Error(
        `${ruleId}: unbalanced in ${ccy}: debit=${t.debit} credit=${t.credit}. ` +
          `This is a programming error in the posting rule — fix the rule, not the data.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// PR-PAY-001: Payment initiation journals
//
// On PaymentInitiated (payment instruction sent to correspondent bank):
//
//   DR  Payment Suspense [ccy]   netCash  — liability side of payment in flight
//   CR  Nostro [ccy]             netCash  — correspondent nostro debited
//
// The suspense account captures the payment obligation until the correspondent
// confirms settlement (PR-PAY-002 clears it). Nostro is credited now because
// the bank's correspondent account is about to be debited.
//
// postingType: "payment-initiation"
// ---------------------------------------------------------------------------

export function paymentInitiatedJournals(payload: PaymentInitiatedPayload): SubLedgerLeg[] {
  const ccy = payload.currency;
  const amount = payload.netCash; // already minor units (z.number().int())

  const legs: SubLedgerLeg[] = [
    {
      accountId: suspenseAccountForCurrency(ccy),
      debitCredit: "debit",
      amountMinor: amount,
      currency: ccy,
    },
    {
      accountId: nostroAccountForCurrency(ccy),
      debitCredit: "credit",
      amountMinor: amount,
      currency: ccy,
    },
  ];

  assertBalanced(legs, "PR-PAY-001");
  return legs;
}

// ---------------------------------------------------------------------------
// PR-PAY-002: Payment settlement journals
//
// On PaymentSettled (correspondent bank confirms cash exchange):
//
//   DR  Customer Payables [ccy]  netCash  — obligation to customer discharged
//   CR  Payment Suspense [ccy]   netCash  — suspense cleared (payment confirmed)
//
// The suspense opened by PR-PAY-001 is now closed; the customer payable
// is discharged because the bank has delivered the funds.
//
// postingType: "payment-settlement"
// ---------------------------------------------------------------------------

export function paymentSettledJournals(payload: PaymentSettledPayload): SubLedgerLeg[] {
  const ccy = payload.currency;
  const amount = payload.netCash;

  const legs: SubLedgerLeg[] = [
    {
      accountId: customerPayableAccountForCurrency(ccy),
      debitCredit: "debit",
      amountMinor: amount,
      currency: ccy,
    },
    {
      accountId: suspenseAccountForCurrency(ccy),
      debitCredit: "credit",
      amountMinor: amount,
      currency: ccy,
    },
  ];

  assertBalanced(legs, "PR-PAY-002");
  return legs;
}

// ---------------------------------------------------------------------------
// PR-SET-001: Settlement instruction journals
//
// On SettlementInstructionReceived (trade leg arrives from counterparty):
//
//   DR  Settlement Receivable [ccy]  netCash  — asset: right to receive funds
//   CR  Payment Suspense [ccy]       netCash  — offsetting suspense liability
//
// The bank recognises a receivable at instruction date (IFRS 9 §3.1.1 trade-
// date recognition). The suspense is cleared when the nostro confirms receipt.
//
// postingType: "settlement-instruction"
// ---------------------------------------------------------------------------

export function settlementInstructionJournals(
  payload: SettlementInstructionReceivedPayload,
): SubLedgerLeg[] {
  const ccy = payload.currency;
  const amount = payload.netCash;

  const legs: SubLedgerLeg[] = [
    {
      accountId: settlementReceivableAccountForCurrency(ccy),
      debitCredit: "debit",
      amountMinor: amount,
      currency: ccy,
    },
    {
      accountId: suspenseAccountForCurrency(ccy),
      debitCredit: "credit",
      amountMinor: amount,
      currency: ccy,
    },
  ];

  assertBalanced(legs, "PR-SET-001");
  return legs;
}
