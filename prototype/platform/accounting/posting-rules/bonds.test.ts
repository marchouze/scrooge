// platform/accounting/posting-rules/bonds.test.ts
//
// Unit tests for JSE bond lifecycle posting rules.
//
// Tests cover:
//   PR-BOND-001  : banking-book booking (buy)
//   PR-BOND-001T : trading-book booking (buy)
//   PR-BOND-EIR  : EIR interest accrual
//   PR-BOND-002  : trading-book revaluation (gain and loss)
//   PR-BOND-MAT  : bond maturity (banking-book)
//   PR-BOND-SALE : bond sale (positive P&L, loss, break-even)
//
// Authority:
//   - D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
//   - IFRS 9 §3.1.1, §3.2.3, §5.1.1, §5.4.1, §5.7.1
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import {
  BOND_ACCOUNTS,
  bondBankingBookJournals,
  bondInterestAccrualJournals,
  bondMaturityJournals,
  bondRevaluationJournals,
  bondSaleJournals,
  bondTradingBookJournals,
} from "./bonds";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertBalanced(legs: { debitCredit: string; amountMinor: number; currency: string }[]) {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const leg of legs) {
    const t = totals.get(leg.currency) ?? { debit: 0, credit: 0 };
    if (leg.debitCredit === "debit") t.debit += leg.amountMinor;
    else t.credit += leg.amountMinor;
    totals.set(leg.currency, t);
  }
  for (const [ccy, t] of totals.entries()) {
    expect(t.debit).toBe(t.credit);
    // Confirm via message
    if (t.debit !== t.credit) {
      throw new Error(`Unbalanced in ${ccy}: debit=${t.debit} credit=${t.credit}`);
    }
  }
}

// ---------------------------------------------------------------------------
// PR-BOND-001: Banking-book bond trade booking
// ---------------------------------------------------------------------------

describe("PR-BOND-001: Banking-book bond trade booking", () => {
  const event = {
    tradeId: "T-BOND-001",
    bondIsin: "ZAG000149037",
    side: "buy" as const,
    nominalMinor: 10_000_000, // R100,000 nominal (minor = cents * 100)
    cleanPricePercent: 97.5,
    accruedInterestMinor: 50_000,
    dirtyPricePercent: 98.0, // clean + accrued/nominal*100 = 97.5 + 0.5
    settlementDate: "2026-05-21",
    portfolio: "banking-book" as const,
    couponRate: 0.085,
    maturityDate: "2030-01-15",
    currency: "ZAR",
    counterpartyLei: "LEI-TEST-001",
    executedAt: "2026-05-18T10:00:00Z",
  };

  it("produces 2 balanced legs", () => {
    const legs = bondBankingBookJournals(event);
    expect(legs).toHaveLength(2);
    assertBalanced(legs);
  });

  it("debits Bond Asset — Banking Book (ACC-3100-001)", () => {
    const legs = bondBankingBookJournals(event);
    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    expect(debitLeg?.accountId).toBe(BOND_ACCOUNTS.BOND_ASSET_BANKING);
  });

  it("credits Nostro ZAR (ACC-1100-001)", () => {
    const legs = bondBankingBookJournals(event);
    const creditLeg = legs.find((l) => l.debitCredit === "credit");
    expect(creditLeg?.accountId).toBe(BOND_ACCOUNTS.NOSTRO_ZAR);
  });

  it("amount = nominal × dirtyPricePercent / 100", () => {
    const legs = bondBankingBookJournals(event);
    const expected = Math.round((event.nominalMinor * event.dirtyPricePercent) / 100);
    for (const leg of legs) {
      expect(leg.amountMinor).toBe(expected);
    }
  });

  it("currency is ZAR", () => {
    const legs = bondBankingBookJournals(event);
    for (const leg of legs) expect(leg.currency).toBe("ZAR");
  });
});

// ---------------------------------------------------------------------------
// PR-BOND-001T: Trading-book bond trade booking
// ---------------------------------------------------------------------------

describe("PR-BOND-001T: Trading-book bond trade booking", () => {
  const event = {
    tradeId: "T-BOND-002",
    bondIsin: "ZAG000149037",
    side: "buy" as const,
    nominalMinor: 5_000_000,
    cleanPricePercent: 99.0,
    accruedInterestMinor: 20_000,
    dirtyPricePercent: 99.4,
    settlementDate: "2026-05-21",
    portfolio: "trading-book" as const,
    couponRate: 0.085,
    maturityDate: "2030-01-15",
    currency: "ZAR",
    counterpartyLei: "LEI-TEST-002",
    executedAt: "2026-05-18T10:30:00Z",
  };

  it("produces 2 balanced legs", () => {
    const legs = bondTradingBookJournals(event);
    expect(legs).toHaveLength(2);
    assertBalanced(legs);
  });

  it("debits Bond Asset — Trading Book (ACC-3100-002)", () => {
    const legs = bondTradingBookJournals(event);
    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    expect(debitLeg?.accountId).toBe(BOND_ACCOUNTS.BOND_ASSET_TRADING);
  });

  it("credits Nostro ZAR (ACC-1100-001)", () => {
    const legs = bondTradingBookJournals(event);
    const creditLeg = legs.find((l) => l.debitCredit === "credit");
    expect(creditLeg?.accountId).toBe(BOND_ACCOUNTS.NOSTRO_ZAR);
  });
});

// ---------------------------------------------------------------------------
// PR-BOND-EIR: Effective interest rate accrual
// ---------------------------------------------------------------------------

describe("PR-BOND-EIR: EIR interest accrual", () => {
  const event = {
    tradeId: "T-BOND-001",
    bondIsin: "ZAG000149037",
    accrualDate: "2026-05-18",
    accruedInterestMinor: 23_100, // ~R231 daily accrual
    eirRate: 0.0873,
    openingCarryingAmountMinor: 9_750_000,
    closingCarryingAmountMinor: 9_773_100,
    currency: "ZAR",
  };

  it("produces 2 balanced legs", () => {
    const legs = bondInterestAccrualJournals(event);
    expect(legs).toHaveLength(2);
    assertBalanced(legs);
  });

  it("debits Accrued Interest Receivable (ACC-3100-003)", () => {
    const legs = bondInterestAccrualJournals(event);
    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    expect(debitLeg?.accountId).toBe(BOND_ACCOUNTS.ACCRUED_INTEREST_RECEIVABLE);
  });

  it("credits Interest Income EIR (ACC-4101-001)", () => {
    const legs = bondInterestAccrualJournals(event);
    const creditLeg = legs.find((l) => l.debitCredit === "credit");
    expect(creditLeg?.accountId).toBe(BOND_ACCOUNTS.INTEREST_INCOME_EIR);
  });

  it("amount equals accruedInterestMinor", () => {
    const legs = bondInterestAccrualJournals(event);
    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    expect(debitLeg?.amountMinor).toBe(event.accruedInterestMinor);
  });

  it("returns empty array when accrued interest is zero", () => {
    const legs = bondInterestAccrualJournals({ ...event, accruedInterestMinor: 0 });
    expect(legs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PR-BOND-002: Trading-book revaluation (FVTPL)
// ---------------------------------------------------------------------------

describe("PR-BOND-002: Trading-book revaluation", () => {
  it("gain: debits Bond Asset Trading, credits Unrealised P&L", () => {
    const event = {
      tradeId: "T-BOND-002",
      bondIsin: "ZAG000149037",
      revalDate: "2026-05-18",
      bookCleanPricePercent: 99.0,
      currentCleanPricePercent: 99.5,
      unrealisedPnlZarMinor: 25_000, // gain
      currency: "ZAR",
    };
    const legs = bondRevaluationJournals(event);
    expect(legs).toHaveLength(2);
    assertBalanced(legs);
    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    const creditLeg = legs.find((l) => l.debitCredit === "credit");
    expect(debitLeg?.accountId).toBe(BOND_ACCOUNTS.BOND_ASSET_TRADING);
    expect(creditLeg?.accountId).toBe(BOND_ACCOUNTS.UNREALISED_PNL);
    expect(debitLeg?.amountMinor).toBe(25_000);
  });

  it("loss: debits Unrealised P&L, credits Bond Asset Trading", () => {
    const event = {
      tradeId: "T-BOND-002",
      bondIsin: "ZAG000149037",
      revalDate: "2026-05-18",
      bookCleanPricePercent: 99.5,
      currentCleanPricePercent: 98.8,
      unrealisedPnlZarMinor: -35_000, // loss
      currency: "ZAR",
    };
    const legs = bondRevaluationJournals(event);
    expect(legs).toHaveLength(2);
    assertBalanced(legs);
    const debitLeg = legs.find((l) => l.debitCredit === "debit");
    const creditLeg = legs.find((l) => l.debitCredit === "credit");
    expect(debitLeg?.accountId).toBe(BOND_ACCOUNTS.UNREALISED_PNL);
    expect(creditLeg?.accountId).toBe(BOND_ACCOUNTS.BOND_ASSET_TRADING);
    expect(debitLeg?.amountMinor).toBe(35_000);
  });

  it("zero delta returns empty array", () => {
    const event = {
      tradeId: "T-BOND-002",
      bondIsin: "ZAG000149037",
      revalDate: "2026-05-18",
      bookCleanPricePercent: 99.0,
      currentCleanPricePercent: 99.0,
      unrealisedPnlZarMinor: 0,
      currency: "ZAR",
    };
    const legs = bondRevaluationJournals(event);
    expect(legs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PR-BOND-MAT: Bond maturity (derecognition)
// ---------------------------------------------------------------------------

describe("PR-BOND-MAT: Bond maturity", () => {
  it("produces balanced legs with final coupon", () => {
    const event = {
      tradeId: "T-BOND-001",
      bondIsin: "ZAG000149037",
      maturityDate: "2030-01-15",
      nominalRepaidMinor: 10_000_000,
      finalCouponMinor: 425_000,
      currency: "ZAR",
    };
    const legs = bondMaturityJournals(event, "banking-book");
    assertBalanced(legs);
    // Cash received = nominal + final coupon
    const cashLeg = legs.find(
      (l) => l.debitCredit === "debit" && l.accountId === BOND_ACCOUNTS.NOSTRO_ZAR,
    );
    expect(cashLeg?.amountMinor).toBe(10_000_000 + 425_000);
  });

  it("credits Bond Asset Banking Book", () => {
    const event = {
      tradeId: "T-BOND-001",
      bondIsin: "ZAG000149037",
      maturityDate: "2030-01-15",
      nominalRepaidMinor: 10_000_000,
      finalCouponMinor: 0,
      currency: "ZAR",
    };
    const legs = bondMaturityJournals(event, "banking-book");
    assertBalanced(legs);
    const assetLeg = legs.find(
      (l) => l.debitCredit === "credit" && l.accountId === BOND_ACCOUNTS.BOND_ASSET_BANKING,
    );
    expect(assetLeg?.amountMinor).toBe(10_000_000);
  });

  it("credits Bond Asset Trading Book when portfolio=trading-book", () => {
    const event = {
      tradeId: "T-BOND-002",
      bondIsin: "ZAG000149037",
      maturityDate: "2030-01-15",
      nominalRepaidMinor: 5_000_000,
      finalCouponMinor: 200_000,
      currency: "ZAR",
    };
    const legs = bondMaturityJournals(event, "trading-book");
    assertBalanced(legs);
    const assetLeg = legs.find(
      (l) => l.debitCredit === "credit" && l.accountId === BOND_ACCOUNTS.BOND_ASSET_TRADING,
    );
    expect(assetLeg?.amountMinor).toBe(5_000_000);
  });
});

// ---------------------------------------------------------------------------
// PR-BOND-SALE: Bond sale (derecognition)
// ---------------------------------------------------------------------------

describe("PR-BOND-SALE: Bond sale", () => {
  it("gain: cash proceeds > carrying amount — Cr Realised P&L", () => {
    const event = {
      tradeId: "T-BOND-002",
      bondIsin: "ZAG000149037",
      side: "sell" as const,
      saleProceedsMinor: 5_100_000,
      carryingAmountAtSaleMinor: 5_000_000,
      realisedPnlMinor: 100_000, // gain
      settlementDate: "2026-05-21",
      currency: "ZAR",
    };
    const legs = bondSaleJournals(event, "trading-book");
    assertBalanced(legs);
    expect(legs.find((l) => l.debitCredit === "debit")?.accountId).toBe(BOND_ACCOUNTS.NOSTRO_ZAR);
    expect(legs.find((l) => l.accountId === BOND_ACCOUNTS.REALISED_PNL)?.debitCredit).toBe(
      "credit",
    );
    expect(legs.find((l) => l.accountId === BOND_ACCOUNTS.BOND_ASSET_TRADING)?.debitCredit).toBe(
      "credit",
    );
  });

  it("loss: carrying amount > sale proceeds — Dr Realised P&L", () => {
    const event = {
      tradeId: "T-BOND-002",
      bondIsin: "ZAG000149037",
      side: "sell" as const,
      saleProceedsMinor: 4_900_000,
      carryingAmountAtSaleMinor: 5_000_000,
      realisedPnlMinor: -100_000, // loss
      settlementDate: "2026-05-21",
      currency: "ZAR",
    };
    const legs = bondSaleJournals(event, "trading-book");
    assertBalanced(legs);
    expect(legs.find((l) => l.accountId === BOND_ACCOUNTS.REALISED_PNL)?.debitCredit).toBe("debit");
    expect(legs.find((l) => l.accountId === BOND_ACCOUNTS.BOND_ASSET_TRADING)?.debitCredit).toBe(
      "credit",
    );
  });

  it("break-even: realisedPnlMinor = 0 — no P&L leg", () => {
    const event = {
      tradeId: "T-BOND-003",
      bondIsin: "ZAG000149037",
      side: "sell" as const,
      saleProceedsMinor: 5_000_000,
      carryingAmountAtSaleMinor: 5_000_000,
      realisedPnlMinor: 0,
      settlementDate: "2026-05-21",
      currency: "ZAR",
    };
    const legs = bondSaleJournals(event, "banking-book");
    assertBalanced(legs);
    expect(legs.find((l) => l.accountId === BOND_ACCOUNTS.REALISED_PNL)).toBeUndefined();
    // Should have exactly 2 legs (cash + asset)
    expect(legs).toHaveLength(2);
  });
});
