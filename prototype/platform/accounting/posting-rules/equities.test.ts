// platform/accounting/posting-rules/equities.test.ts
//
// Tests for JSE equity lifecycle posting rules.
//
// Coverage:
//   PR-EQ-001: equityTradeBookingJournals (CDM EquityTradeExecuted)
//   PR-EQ-002: equityRevaluationJournals (CDM EquityPositionRevalued — gain/loss/zero)
//   PR-EQ-003: equityDividendJournals (with/without withholding tax)
//   PR-EQ-004: equitySaleJournals (FVTPL gain/loss/break-even; FVOCI
//              gain→retained-earnings, loss→retained-earnings, zero OCI)
//
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, test } from "bun:test";

import type {
  EquityPositionRevaluedPayload,
  EquityTradeExecutedPayload,
} from "../../markets/cdm/equity";
import type { SubLedgerLeg } from "../fx-accounting-types";
import {
  equityDividendJournals,
  equityRevaluationJournals,
  equitySaleJournals,
  equityTradeBookingJournals,
} from "./equities";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertBalanced(legs: SubLedgerLeg[]): void {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const leg of legs) {
    const t = totals.get(leg.currency) ?? { debit: 0, credit: 0 };
    if (leg.debitCredit === "debit") t.debit += leg.amountMinor;
    else t.credit += leg.amountMinor;
    totals.set(leg.currency, t);
  }
  for (const [ccy, t] of totals.entries()) {
    expect(t.debit).toBe(t.credit);
    void ccy;
  }
}

// CDM EquityTradeExecuted mock payload (only fields we use in posting rules)
// Cast to EquityTradeExecutedPayload since we only read consideration.*
function makeCdmTrade(amountMinor = 15_000_000): EquityTradeExecutedPayload {
  return {
    consideration: { currency: "ZAR", amountMinor },
  } as unknown as EquityTradeExecutedPayload;
}

// CDM EquityPositionRevalued mock payload
// Cast to EquityPositionRevaluedPayload since we only read unrealisedPnl.*
function makeCdmReval(amountMinor: number): EquityPositionRevaluedPayload {
  return {
    unrealisedPnl: { currency: "ZAR", amountMinor },
  } as unknown as EquityPositionRevaluedPayload;
}

// GL-specific EquityDividendAccrued mock payload
function makeDividend(overrides: Partial<Parameters<typeof equityDividendJournals>[0]> = {}) {
  return {
    tradeId: "EQ-001",
    instrumentId: "ZAE000015889",
    quantity: 1000,
    grossDividendPerShareMinor: 300,
    grossDividendTotalMinor: 300_000,
    withholdingTaxRate: 0.2,
    withholdingTaxMinor: 60_000,
    netDividendMinor: 240_000,
    exDividendDate: "2026-05-15",
    paymentDate: "2026-05-22",
    currency: "ZAR",
    ...overrides,
  };
}

// GL-specific EquitySold mock payload
function makeSale(overrides: Partial<Parameters<typeof equitySaleJournals>[0]> = {}) {
  return {
    tradeId: "EQ-001",
    instrumentId: "ZAE000015889",
    classification: "fvtpl" as const,
    quantity: 1000,
    salePricePerShareMinor: 16000,
    saleProceedsMinor: 16_000_000,
    carryingAmountAtSaleMinor: 15_500_000,
    realisedPnlMinor: 500_000,
    settlementDate: "2026-05-21",
    currency: "ZAR",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PR-EQ-001: Initial recognition
// ---------------------------------------------------------------------------

describe("PR-EQ-001: equityTradeBookingJournals", () => {
  test("CDM FVTPL buy: Dr Equity Asset (FVTPL) / Cr Nostro ZAR at consideration", () => {
    const legs = equityTradeBookingJournals(makeCdmTrade(15_000_000));
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    const dr = legs.find((l) => l.debitCredit === "debit");
    const cr = legs.find((l) => l.debitCredit === "credit");
    expect(dr?.accountId).toBe("ACC-3200-001");
    expect(cr?.accountId).toBe("ACC-1200-001");
    expect(dr?.amountMinor).toBe(15_000_000);
  });
});

// ---------------------------------------------------------------------------
// PR-EQ-002: Revaluation
// ---------------------------------------------------------------------------

describe("PR-EQ-002: equityRevaluationJournals — CDM FVTPL", () => {
  test("Gain: Dr Equity Asset (FVTPL) / Cr Unrealised P&L (FVTPL)", () => {
    const legs = equityRevaluationJournals(makeCdmReval(500_000));
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    const dr = legs.find((l) => l.debitCredit === "debit");
    const cr = legs.find((l) => l.debitCredit === "credit");
    expect(dr?.accountId).toBe("ACC-3200-001");
    expect(cr?.accountId).toBe("ACC-3200-003");
    expect(dr?.amountMinor).toBe(500_000);
  });

  test("Loss: Dr Unrealised P&L (FVTPL) / Cr Equity Asset (FVTPL)", () => {
    const legs = equityRevaluationJournals(makeCdmReval(-200_000));
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    const dr = legs.find((l) => l.debitCredit === "debit");
    const cr = legs.find((l) => l.debitCredit === "credit");
    expect(dr?.accountId).toBe("ACC-3200-003");
    expect(cr?.accountId).toBe("ACC-3200-001");
    expect(dr?.amountMinor).toBe(200_000);
  });

  test("Zero delta: returns []", () => {
    const legs = equityRevaluationJournals(makeCdmReval(0));
    expect(legs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PR-EQ-003: Dividend accrual
// ---------------------------------------------------------------------------

describe("PR-EQ-003: equityDividendJournals", () => {
  test("With WHT: Dr Receivable (net) + Dr WHT debit / Cr Dividend Income (gross)", () => {
    const legs = equityDividendJournals(makeDividend());
    expect(legs).toHaveLength(3);
    assertBalanced(legs);

    const receivable = legs.find((l) => l.accountId === "ACC-3200-005");
    const wht = legs.find((l) => l.accountId === "ACC-3200-007");
    const income = legs.find((l) => l.accountId === "ACC-3200-006");
    expect(receivable?.debitCredit).toBe("debit");
    expect(receivable?.amountMinor).toBe(240_000);
    expect(wht?.debitCredit).toBe("debit");
    expect(wht?.amountMinor).toBe(60_000);
    expect(income?.debitCredit).toBe("credit");
    expect(income?.amountMinor).toBe(300_000);
  });

  test("Without WHT: Dr Receivable / Cr Dividend Income", () => {
    const legs = equityDividendJournals(
      makeDividend({ withholdingTaxRate: 0, withholdingTaxMinor: 0, netDividendMinor: 300_000 }),
    );
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    const receivable = legs.find((l) => l.accountId === "ACC-3200-005");
    const income = legs.find((l) => l.accountId === "ACC-3200-006");
    expect(receivable?.amountMinor).toBe(300_000);
    expect(income?.amountMinor).toBe(300_000);
  });

  test("Zero gross: returns []", () => {
    const legs = equityDividendJournals(
      makeDividend({ grossDividendTotalMinor: 0, netDividendMinor: 0, withholdingTaxMinor: 0 }),
    );
    expect(legs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PR-EQ-004: Sale / derecognition
// ---------------------------------------------------------------------------

describe("PR-EQ-004: equitySaleJournals — FVTPL", () => {
  test("Gain: Dr Nostro / Cr Equity Asset / Cr Unrealised P&L", () => {
    const legs = equitySaleJournals(makeSale({ realisedPnlMinor: 500_000 }));
    expect(legs).toHaveLength(3);
    assertBalanced(legs);

    const pnlLeg = legs.find((l) => l.accountId === "ACC-3200-003");
    expect(pnlLeg?.debitCredit).toBe("credit");
    expect(pnlLeg?.amountMinor).toBe(500_000);
    for (const leg of legs) {
      expect(leg.accountId).not.toBe("ACC-5000-002");
    }
  });

  test("Loss: Dr Nostro + Dr Unrealised P&L / Cr Equity Asset", () => {
    const legs = equitySaleJournals(
      makeSale({
        realisedPnlMinor: -300_000,
        saleProceedsMinor: 15_200_000,
        carryingAmountAtSaleMinor: 15_500_000,
      }),
    );
    expect(legs).toHaveLength(3);
    assertBalanced(legs);

    const pnlLeg = legs.find((l) => l.accountId === "ACC-3200-003");
    expect(pnlLeg?.debitCredit).toBe("debit");
    expect(pnlLeg?.amountMinor).toBe(300_000);
  });

  test("Break-even: Dr Nostro / Cr Equity Asset (2 legs only)", () => {
    const legs = equitySaleJournals(
      makeSale({
        realisedPnlMinor: 0,
        saleProceedsMinor: 15_500_000,
        carryingAmountAtSaleMinor: 15_500_000,
      }),
    );
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    for (const leg of legs) {
      expect(leg.accountId).not.toBe("ACC-3200-003");
      expect(leg.accountId).not.toBe("ACC-3200-004");
      expect(leg.accountId).not.toBe("ACC-5000-002");
    }
  });
});

describe("PR-EQ-004: equitySaleJournals — FVOCI (no-recycling §5.7.5)", () => {
  test("Gain → OCI to retained earnings (NOT P&L)", () => {
    const legs = equitySaleJournals(
      makeSale({
        classification: "fvoci",
        realisedPnlMinor: 400_000,
        saleProceedsMinor: 15_900_000,
        carryingAmountAtSaleMinor: 15_900_000,
      }),
    );
    expect(legs).toHaveLength(4);
    assertBalanced(legs);

    const ociLeg = legs.find((l) => l.accountId === "ACC-3200-004");
    const retainedLeg = legs.find((l) => l.accountId === "ACC-5000-002");
    expect(ociLeg?.debitCredit).toBe("debit");
    expect(retainedLeg?.debitCredit).toBe("credit");
    for (const leg of legs) {
      expect(leg.accountId).not.toBe("ACC-3200-003");
    }
  });

  test("Loss → OCI loss to retained earnings debit (NOT P&L)", () => {
    const legs = equitySaleJournals(
      makeSale({
        classification: "fvoci",
        realisedPnlMinor: -200_000,
        saleProceedsMinor: 15_300_000,
        carryingAmountAtSaleMinor: 15_300_000,
      }),
    );
    expect(legs).toHaveLength(4);
    assertBalanced(legs);

    const ociLeg = legs.find((l) => l.accountId === "ACC-3200-004");
    const retainedLeg = legs.find((l) => l.accountId === "ACC-5000-002");
    expect(ociLeg?.debitCredit).toBe("credit");
    expect(retainedLeg?.debitCredit).toBe("debit");
    for (const leg of legs) {
      expect(leg.accountId).not.toBe("ACC-3200-003");
    }
  });

  test("Zero OCI balance: 2 legs only (no reclassification)", () => {
    const legs = equitySaleJournals(
      makeSale({
        classification: "fvoci",
        realisedPnlMinor: 0,
        saleProceedsMinor: 15_000_000,
        carryingAmountAtSaleMinor: 15_000_000,
      }),
    );
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    for (const leg of legs) {
      expect(leg.accountId).not.toBe("ACC-3200-003");
      expect(leg.accountId).not.toBe("ACC-3200-004");
      expect(leg.accountId).not.toBe("ACC-5000-002");
    }
  });
});
