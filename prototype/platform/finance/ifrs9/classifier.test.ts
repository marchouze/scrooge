// platform/finance/ifrs9/classifier.test.ts
//
// IFRS 9 classifier tests — FX Spot accounting cycle 5.
//
// Four test groups:
//   1. Sunny-day trade booking (fx-receivable + fx-payable)
//   2. Daily revaluation (fx-revaluation gain and loss)
//   3. Settlement close-out (fx-settlement-receive + fx-settlement-deliver)
//   4. Accounting identity — complete lifecycle: debits = credits per currency
//
// Authority: D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
// Authors: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";
import { FX_ACCOUNTS } from "../../accounting/posting-rules/fx-spot";
import type { SubLedgerRow } from "../../projections/markets/sub-ledger";
import { classifyFxSubLedger, computeIfrsTrialBalance } from "./classifier";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeRow(
  overrides: Partial<SubLedgerRow> & Pick<SubLedgerRow, "legKind" | "currency" | "cashAmountMinor">,
): SubLedgerRow {
  return {
    sourceEventId: overrides.sourceEventId ?? "evt-001",
    legKind: overrides.legKind,
    entity: overrides.entity ?? "LE-ZA-HOZ-BANK",
    asOf: overrides.asOf ?? "2026-05-16",
    instrumentId: overrides.instrumentId ?? "trade-001",
    bookId: overrides.bookId ?? "FX-BOOK-01",
    currency: overrides.currency,
    cashAmountMinor: overrides.cashAmountMinor,
    quantityAmount: overrides.quantityAmount ?? null,
    externalRef: overrides.externalRef ?? "trade-001",
    citations: overrides.citations ?? ["[citation: D-MARKETS-CAPITAL-TIME-SHAPE]"],
  };
}

// ---------------------------------------------------------------------------
// Test 1: Sunny-day trade booking
// ---------------------------------------------------------------------------

describe("classifyFxSubLedger — trade booking", () => {
  it("produces FVTPL journal entries for fx-receivable (ZAR)", () => {
    const rows: SubLedgerRow[] = [
      makeRow({ legKind: "fx-receivable", currency: "ZAR", cashAmountMinor: 1_000_000 }),
    ];
    const entries = classifyFxSubLedger(rows);

    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.ifrsRef).toBe("IFRS9-§4.1.4");
    expect(e.debitAccount).toBe(FX_ACCOUNTS.RECEIVABLE_ZAR);
    expect(e.creditAccount).toBe(FX_ACCOUNTS.PAYABLE_ZAR);
    expect(e.currency).toBe("ZAR");
    expect(e.amountMinor).toBe(1_000_000);
    expect(e.legKind).toBe("fx-receivable");
  });

  it("produces FVTPL journal entries for fx-receivable (USD)", () => {
    const rows: SubLedgerRow[] = [
      makeRow({ legKind: "fx-receivable", currency: "USD", cashAmountMinor: 50_000 }),
    ];
    const entries = classifyFxSubLedger(rows);

    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.debitAccount).toBe(FX_ACCOUNTS.RECEIVABLE_USD);
    expect(e.creditAccount).toBe(FX_ACCOUNTS.PAYABLE_USD);
    expect(e.currency).toBe("USD");
  });

  it("produces FVTPL journal entries for fx-payable", () => {
    const rows: SubLedgerRow[] = [
      makeRow({ legKind: "fx-payable", currency: "ZAR", cashAmountMinor: -1_000_000 }),
    ];
    const entries = classifyFxSubLedger(rows);

    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.ifrsRef).toBe("IFRS9-§4.1.4");
    expect(e.debitAccount).toBe(FX_ACCOUNTS.RECEIVABLE_ZAR);
    expect(e.creditAccount).toBe(FX_ACCOUNTS.PAYABLE_ZAR);
    // amountMinor is always positive
    expect(e.amountMinor).toBe(1_000_000);
  });

  it("produces two entries for a complete fx-receivable + fx-payable booking", () => {
    const rows: SubLedgerRow[] = [
      makeRow({ legKind: "fx-receivable", currency: "ZAR", cashAmountMinor: 1_000_000 }),
      makeRow({ legKind: "fx-payable", currency: "USD", cashAmountMinor: -50_000 }),
    ];
    const entries = classifyFxSubLedger(rows);

    expect(entries).toHaveLength(2);
    expect(entries[0].debitAccount).toBe(FX_ACCOUNTS.RECEIVABLE_ZAR);
    expect(entries[1].debitAccount).toBe(FX_ACCOUNTS.RECEIVABLE_USD);
  });

  it("generates deterministic entryId", () => {
    const rows: SubLedgerRow[] = [
      makeRow({ legKind: "fx-receivable", currency: "ZAR", cashAmountMinor: 500, externalRef: "T-42" }),
    ];
    const entries = classifyFxSubLedger(rows);
    expect(entries[0].entryId).toBe("T-42-fx-receivable-1");
  });
});

// ---------------------------------------------------------------------------
// Test 2: Daily revaluation
// ---------------------------------------------------------------------------

describe("classifyFxSubLedger — revaluation", () => {
  it("produces IAS21-§23 gain entry (Dr Receivable / Cr Unrealised P&L)", () => {
    const rows: SubLedgerRow[] = [
      makeRow({ legKind: "fx-revaluation", currency: "ZAR", cashAmountMinor: 5_000 }),
    ];
    const entries = classifyFxSubLedger(rows);

    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.ifrsRef).toBe("IAS21-§23");
    expect(e.debitAccount).toBe(FX_ACCOUNTS.RECEIVABLE_ZAR);
    expect(e.creditAccount).toBe(FX_ACCOUNTS.UNREALISED_PNL);
    expect(e.amountMinor).toBe(5_000);
  });

  it("produces IAS21-§23 loss entry (Dr Unrealised P&L / Cr Receivable)", () => {
    const rows: SubLedgerRow[] = [
      makeRow({ legKind: "fx-revaluation", currency: "ZAR", cashAmountMinor: -3_000 }),
    ];
    const entries = classifyFxSubLedger(rows);

    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.ifrsRef).toBe("IAS21-§23");
    expect(e.debitAccount).toBe(FX_ACCOUNTS.UNREALISED_PNL);
    expect(e.creditAccount).toBe(FX_ACCOUNTS.RECEIVABLE_ZAR);
    expect(e.amountMinor).toBe(3_000);
  });

  it("skips zero-amount revaluation rows", () => {
    const rows: SubLedgerRow[] = [
      makeRow({ legKind: "fx-revaluation", currency: "ZAR", cashAmountMinor: 0 }),
    ];
    const entries = classifyFxSubLedger(rows);
    expect(entries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Settlement close-out
// ---------------------------------------------------------------------------

describe("classifyFxSubLedger — settlement", () => {
  it("produces derecognition entry for fx-settlement-receive (Dr Nostro / Cr Receivable)", () => {
    const rows: SubLedgerRow[] = [
      makeRow({ legKind: "fx-settlement-receive", currency: "USD", cashAmountMinor: 50_000 }),
    ];
    const entries = classifyFxSubLedger(rows);

    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.ifrsRef).toBe("IFRS9-§3.2.3");
    expect(e.debitAccount).toBe(FX_ACCOUNTS.NOSTRO_USD);
    expect(e.creditAccount).toBe(FX_ACCOUNTS.RECEIVABLE_USD);
  });

  it("produces derecognition entry for fx-settlement-deliver (Dr Payable / Cr Nostro)", () => {
    const rows: SubLedgerRow[] = [
      makeRow({ legKind: "fx-settlement-deliver", currency: "ZAR", cashAmountMinor: -1_000_000 }),
    ];
    const entries = classifyFxSubLedger(rows);

    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.ifrsRef).toBe("IFRS9-§3.2.3");
    expect(e.debitAccount).toBe(FX_ACCOUNTS.PAYABLE_ZAR);
    expect(e.creditAccount).toBe(FX_ACCOUNTS.NOSTRO_ZAR);
    expect(e.amountMinor).toBe(1_000_000);
  });

  it("produces both settlement legs when both present", () => {
    const rows: SubLedgerRow[] = [
      makeRow({ legKind: "fx-settlement-receive", currency: "USD", cashAmountMinor: 50_000 }),
      makeRow({ legKind: "fx-settlement-deliver", currency: "ZAR", cashAmountMinor: -1_000_000 }),
    ];
    const entries = classifyFxSubLedger(rows);

    expect(entries).toHaveLength(2);
    const receive = entries.find((e) => e.legKind === "fx-settlement-receive");
    const deliver = entries.find((e) => e.legKind === "fx-settlement-deliver");
    expect(receive?.debitAccount).toBe(FX_ACCOUNTS.NOSTRO_USD);
    expect(deliver?.debitAccount).toBe(FX_ACCOUNTS.PAYABLE_ZAR);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Accounting identity — complete lifecycle
// ---------------------------------------------------------------------------

describe("classifyFxSubLedger — accounting identity", () => {
  it("sum(debits) === sum(credits) per currency for a complete trade lifecycle", () => {
    // Simulate a complete ZAR/USD trade:
    //   1. Trade booking: bank sells ZAR 1 000 000 / buys USD 50 000
    //   2. Revaluation: USD gains ZAR 5 000 (exchange rate moved)
    //   3. Settlement: receive USD 50 000, deliver ZAR 1 000 000
    const tradeId = "T-LIFECYCLE-001";
    const rows: SubLedgerRow[] = [
      // Booking legs
      makeRow({ legKind: "fx-receivable", currency: "ZAR", cashAmountMinor: 1_000_000, externalRef: tradeId }),
      makeRow({ legKind: "fx-payable", currency: "USD", cashAmountMinor: -50_000, externalRef: tradeId }),
      // Revaluation (gain)
      makeRow({ legKind: "fx-revaluation", currency: "ZAR", cashAmountMinor: 5_000, externalRef: tradeId }),
      // Settlement
      makeRow({ legKind: "fx-settlement-receive", currency: "USD", cashAmountMinor: 50_000, externalRef: tradeId }),
      makeRow({ legKind: "fx-settlement-deliver", currency: "ZAR", cashAmountMinor: -1_000_000, externalRef: tradeId }),
    ];

    const entries = classifyFxSubLedger(rows);
    const tb = computeIfrsTrialBalance(entries);

    // Each currency must balance: debitMinor === creditMinor
    for (const { currency, debitMinor, creditMinor } of tb.perCurrencyTotals) {
      expect(debitMinor).toBe(
        creditMinor,
        `Accounting identity violated for ${currency}: debit=${debitMinor} credit=${creditMinor}`,
      );
    }
  });

  it("computeIfrsTrialBalance returns empty for no entries", () => {
    const tb = computeIfrsTrialBalance([]);
    expect(tb.rows).toHaveLength(0);
    expect(tb.perCurrencyTotals).toHaveLength(0);
  });

  it("computeIfrsTrialBalance balances for a single revaluation gain", () => {
    const rows: SubLedgerRow[] = [
      makeRow({ legKind: "fx-revaluation", currency: "ZAR", cashAmountMinor: 10_000 }),
    ];
    const entries = classifyFxSubLedger(rows);
    const tb = computeIfrsTrialBalance(entries);

    expect(tb.perCurrencyTotals).toHaveLength(1);
    const { debitMinor, creditMinor } = tb.perCurrencyTotals[0];
    expect(debitMinor).toBe(creditMinor);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Non-FX rows are silently skipped
// ---------------------------------------------------------------------------

describe("classifyFxSubLedger — non-FX legs skipped", () => {
  it("ignores equity trade-acquisition legs", () => {
    const rows: SubLedgerRow[] = [
      makeRow({ legKind: "trade-acquisition" as never, currency: "ZAR", cashAmountMinor: -200_000 }),
    ];
    const entries = classifyFxSubLedger(rows);
    expect(entries).toHaveLength(0);
  });

  it("ignores rows with null cashAmountMinor", () => {
    const row: SubLedgerRow = {
      sourceEventId: "evt-null",
      legKind: "fx-receivable",
      entity: "LE-ZA-HOZ-BANK",
      asOf: "2026-05-16",
      instrumentId: null,
      bookId: null,
      currency: "ZAR",
      cashAmountMinor: null,
      quantityAmount: null,
      externalRef: null,
      citations: [],
    };
    const entries = classifyFxSubLedger([row]);
    expect(entries).toHaveLength(0);
  });
});
