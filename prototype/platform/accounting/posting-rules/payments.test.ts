// platform/accounting/posting-rules/payments.test.ts
//
// Unit tests for the three payment posting rules:
//   PR-PAY-001: paymentInitiatedJournals
//   PR-PAY-002: paymentSettledJournals
//   PR-SET-001: settlementInstructionJournals
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import {
  PAYMENT_ACCOUNTS,
  customerPayableAccountForCurrency,
  nostroAccountForCurrency,
  paymentInitiatedJournals,
  paymentSettledJournals,
  settlementInstructionJournals,
  suspenseAccountForCurrency,
} from "./payments";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePaymentInitiatedPayload(
  overrides: Partial<{
    currency: string;
    netCash: number;
  }> = {},
) {
  return {
    tradeId: "TRADE-001",
    legKind: "deliver" as const,
    paymentRef: "REF-001",
    currency: overrides.currency ?? "ZAR",
    netCash: overrides.netCash ?? 100000,
    initiatedAt: "2026-05-18T10:00:00Z",
    citations: ["PROC-PAY-RBH-01"],
  };
}

function makePaymentSettledPayload(
  overrides: Partial<{
    currency: string;
    netCash: number;
  }> = {},
) {
  return {
    tradeId: "TRADE-001",
    legKind: "deliver" as const,
    paymentRef: "REF-001",
    currency: overrides.currency ?? "ZAR",
    netCash: overrides.netCash ?? 100000,
    settledAt: "2026-05-18T12:00:00Z",
    citations: ["PROC-PAY-RBH-01"],
  };
}

function makeSettlementInstructionPayload(
  overrides: Partial<{
    currency: string;
    netCash: number;
  }> = {},
) {
  return {
    tradeId: "TRADE-001",
    legKind: "receive" as const,
    settlementDate: "2026-05-20",
    currency: overrides.currency ?? "ZAR",
    netCash: overrides.netCash ?? 100000,
    correspondent: {
      name: "Test Bank",
      bic: "TESTZA22",
    },
    citations: ["PROC-PAY-RBH-01"],
  };
}

function sumByDebitCredit(legs: ReturnType<typeof paymentInitiatedJournals>) {
  let debit = 0;
  let credit = 0;
  for (const leg of legs) {
    if (leg.debitCredit === "debit") debit += leg.amountMinor;
    else credit += leg.amountMinor;
  }
  return { debit, credit };
}

// ---------------------------------------------------------------------------
// PR-PAY-001: paymentInitiatedJournals
// ---------------------------------------------------------------------------

describe("PR-PAY-001: paymentInitiatedJournals", () => {
  it("ZAR: correct accounts + balanced legs", () => {
    const payload = makePaymentInitiatedPayload({ currency: "ZAR", netCash: 500000 });
    const legs = paymentInitiatedJournals(payload);

    expect(legs).toHaveLength(2);

    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    const creditLeg = legs.find((l) => l.debitCredit === "credit");

    expect(debitLeg?.accountId).toBe(PAYMENT_ACCOUNTS.SUSPENSE_ZAR);
    expect(debitLeg?.currency).toBe("ZAR");
    expect(debitLeg?.amountMinor).toBe(500000);

    expect(creditLeg?.accountId).toBe(PAYMENT_ACCOUNTS.NOSTRO_ZAR);
    expect(creditLeg?.currency).toBe("ZAR");
    expect(creditLeg?.amountMinor).toBe(500000);

    const { debit, credit } = sumByDebitCredit(legs);
    expect(debit).toBe(credit);
  });

  it("USD: correct accounts + balanced legs", () => {
    const payload = makePaymentInitiatedPayload({ currency: "USD", netCash: 10000 });
    const legs = paymentInitiatedJournals(payload);

    expect(legs).toHaveLength(2);

    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    const creditLeg = legs.find((l) => l.debitCredit === "credit");

    expect(debitLeg?.accountId).toBe(PAYMENT_ACCOUNTS.SUSPENSE_USD);
    expect(debitLeg?.currency).toBe("USD");

    expect(creditLeg?.accountId).toBe(PAYMENT_ACCOUNTS.NOSTRO_USD);
    expect(creditLeg?.currency).toBe("USD");

    const { debit, credit } = sumByDebitCredit(legs);
    expect(debit).toBe(credit);
  });
});

// ---------------------------------------------------------------------------
// PR-PAY-002: paymentSettledJournals
// ---------------------------------------------------------------------------

describe("PR-PAY-002: paymentSettledJournals", () => {
  it("ZAR: suspense cleared, customer payable debited, legs balanced", () => {
    const payload = makePaymentSettledPayload({ currency: "ZAR", netCash: 500000 });
    const legs = paymentSettledJournals(payload);

    expect(legs).toHaveLength(2);

    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    const creditLeg = legs.find((l) => l.debitCredit === "credit");

    // Suspense is cleared (credited) and customer payable is discharged (debited)
    expect(debitLeg?.accountId).toBe(PAYMENT_ACCOUNTS.CUSTOMER_PAYABLE_ZAR);
    expect(debitLeg?.currency).toBe("ZAR");
    expect(debitLeg?.amountMinor).toBe(500000);

    expect(creditLeg?.accountId).toBe(PAYMENT_ACCOUNTS.SUSPENSE_ZAR);
    expect(creditLeg?.currency).toBe("ZAR");
    expect(creditLeg?.amountMinor).toBe(500000);

    const { debit, credit } = sumByDebitCredit(legs);
    expect(debit).toBe(credit);
  });

  it("USD: suspense cleared, customer payable debited, legs balanced", () => {
    const payload = makePaymentSettledPayload({ currency: "USD", netCash: 10000 });
    const legs = paymentSettledJournals(payload);

    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    const creditLeg = legs.find((l) => l.debitCredit === "credit");

    expect(debitLeg?.accountId).toBe(PAYMENT_ACCOUNTS.CUSTOMER_PAYABLE_USD);
    expect(creditLeg?.accountId).toBe(PAYMENT_ACCOUNTS.SUSPENSE_USD);

    const { debit, credit } = sumByDebitCredit(legs);
    expect(debit).toBe(credit);
  });
});

// ---------------------------------------------------------------------------
// PR-SET-001: settlementInstructionJournals
// ---------------------------------------------------------------------------

describe("PR-SET-001: settlementInstructionJournals", () => {
  it("ZAR: receivable debited, suspense credited, legs balanced", () => {
    const payload = makeSettlementInstructionPayload({ currency: "ZAR", netCash: 750000 });
    const legs = settlementInstructionJournals(payload);

    expect(legs).toHaveLength(2);

    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    const creditLeg = legs.find((l) => l.debitCredit === "credit");

    expect(debitLeg?.accountId).toBe(PAYMENT_ACCOUNTS.SETTLEMENT_RECEIVABLE_ZAR);
    expect(debitLeg?.currency).toBe("ZAR");
    expect(debitLeg?.amountMinor).toBe(750000);

    expect(creditLeg?.accountId).toBe(PAYMENT_ACCOUNTS.SUSPENSE_ZAR);
    expect(creditLeg?.currency).toBe("ZAR");
    expect(creditLeg?.amountMinor).toBe(750000);

    const { debit, credit } = sumByDebitCredit(legs);
    expect(debit).toBe(credit);
  });

  it("USD: receivable debited, suspense credited, legs balanced", () => {
    const payload = makeSettlementInstructionPayload({ currency: "USD", netCash: 5000 });
    const legs = settlementInstructionJournals(payload);

    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    const creditLeg = legs.find((l) => l.debitCredit === "credit");

    expect(debitLeg?.accountId).toBe(PAYMENT_ACCOUNTS.SETTLEMENT_RECEIVABLE_USD);
    expect(creditLeg?.accountId).toBe(PAYMENT_ACCOUNTS.SUSPENSE_USD);

    const { debit, credit } = sumByDebitCredit(legs);
    expect(debit).toBe(credit);
  });
});

// ---------------------------------------------------------------------------
// Account helper edge cases
// ---------------------------------------------------------------------------

describe("account helpers — unknown currency", () => {
  it("nostroAccountForCurrency throws for unknown currency", () => {
    expect(() => nostroAccountForCurrency("GBP")).toThrow();
  });

  it("suspenseAccountForCurrency throws for unknown currency", () => {
    expect(() => suspenseAccountForCurrency("GBP")).toThrow();
  });

  it("customerPayableAccountForCurrency throws for unknown currency", () => {
    expect(() => customerPayableAccountForCurrency("GBP")).toThrow();
  });

  it("paymentInitiatedJournals throws for unknown currency", () => {
    const payload = makePaymentInitiatedPayload({ currency: "GBP" });
    expect(() => paymentInitiatedJournals(payload)).toThrow();
  });

  it("paymentSettledJournals throws for unknown currency", () => {
    const payload = makePaymentSettledPayload({ currency: "JPY" });
    expect(() => paymentSettledJournals(payload)).toThrow();
  });

  it("settlementInstructionJournals throws for unknown currency", () => {
    const payload = makeSettlementInstructionPayload({ currency: "CHF" });
    expect(() => settlementInstructionJournals(payload)).toThrow();
  });
});
