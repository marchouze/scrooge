// platform/accounting/posting-rules/ird-swaps.test.ts
//
// Tests for OTC IRD swap lifecycle posting rules.
//
// Coverage:
//   PR-IRS-001: irdSwapTradeBookingJournals (at-market/positive/negative NPV)
//   PR-IRS-002: irdSwapRevaluationJournals (gain/loss/zero/sign-flip)
//   PR-IRS-003: irdSwapCouponJournals (receive/pay/zero)
//   PR-IRS-TERM: irdSwapTerminationJournals (asset-term/liability-term/zero-term/gain/loss)
//
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, test } from "bun:test";

import type { SubLedgerLeg } from "../fx-accounting-types";
import {
  irdSwapCouponJournals,
  irdSwapRevaluationJournals,
  irdSwapTerminationJournals,
  irdSwapTradeBookingJournals,
} from "./ird-swaps";

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

function makeTrade(overrides: Partial<Parameters<typeof irdSwapTradeBookingJournals>[0]> = {}) {
  return {
    tradeId: "IRS-001",
    instrumentType: "irs" as const,
    role: "pay-fixed" as const,
    notionalMinor: 100_000_000_00, // R100m in cents
    npvMinor: 0,
    fixedRatePercent: 0.075,
    tradeDate: "2026-05-18",
    startDate: "2026-05-20",
    maturityDate: "2031-05-20",
    counterpartyLei: "LEIFAKE0000000000001",
    currency: "ZAR",
    ...overrides,
  };
}

function makeReval(overrides: Partial<Parameters<typeof irdSwapRevaluationJournals>[0]> = {}) {
  return {
    tradeId: "IRS-001",
    npvDeltaMinor: 0,
    npvClosingMinor: 0,
    npvOpeningMinor: 0,
    revalDate: "2026-05-19",
    currency: "ZAR",
    ...overrides,
  };
}

function makeCoupon(overrides: Partial<Parameters<typeof irdSwapCouponJournals>[0]> = {}) {
  return {
    tradeId: "IRS-001",
    netCashMinor: 0,
    fixedLegMinor: 750_000_00,
    floatingLegMinor: 720_000_00,
    settlementDate: "2026-11-20",
    periodStartDate: "2026-05-20",
    periodEndDate: "2026-11-20",
    currency: "ZAR",
    ...overrides,
  };
}

function makeTerm(overrides: Partial<Parameters<typeof irdSwapTerminationJournals>[0]> = {}) {
  return {
    tradeId: "IRS-001",
    terminationPaymentMinor: 0,
    carryingNpvAtTerminationMinor: 0,
    realisedPnlMinor: 0,
    terminationDate: "2026-05-18",
    currency: "ZAR",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PR-IRS-001: Initial recognition
// ---------------------------------------------------------------------------

describe("PR-IRS-001: irdSwapTradeBookingJournals", () => {
  test("At-market swap (npv=0): returns []", () => {
    const legs = irdSwapTradeBookingJournals(makeTrade({ npvMinor: 0 }));
    expect(legs).toHaveLength(0);
  });

  test("Positive NPV (off-market): Dr Swap Asset / Cr Unrealised P&L", () => {
    const legs = irdSwapTradeBookingJournals(makeTrade({ npvMinor: 500_000 }));
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    const dr = legs.find((l) => l.debitCredit === "debit");
    const cr = legs.find((l) => l.debitCredit === "credit");
    expect(dr?.accountId).toBe("ACC-3300-001");
    expect(cr?.accountId).toBe("ACC-3300-003");
    expect(dr?.amountMinor).toBe(500_000);
  });

  test("Negative NPV (off-market): Dr Unrealised P&L / Cr Swap Liability", () => {
    const legs = irdSwapTradeBookingJournals(makeTrade({ npvMinor: -300_000 }));
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    const dr = legs.find((l) => l.debitCredit === "debit");
    const cr = legs.find((l) => l.debitCredit === "credit");
    expect(dr?.accountId).toBe("ACC-3300-003");
    expect(cr?.accountId).toBe("ACC-3300-002");
    expect(dr?.amountMinor).toBe(300_000);
  });
});

// ---------------------------------------------------------------------------
// PR-IRS-002: FVTPL NPV re-measurement
// ---------------------------------------------------------------------------

describe("PR-IRS-002: irdSwapRevaluationJournals", () => {
  test("Zero delta: returns []", () => {
    const legs = irdSwapRevaluationJournals(
      makeReval({ npvDeltaMinor: 0, npvOpeningMinor: 100_000, npvClosingMinor: 100_000 }),
    );
    expect(legs).toHaveLength(0);
  });

  test("Gain (asset side, no flip): Dr Swap Asset / Cr Unrealised P&L", () => {
    const legs = irdSwapRevaluationJournals(
      makeReval({ npvDeltaMinor: 200_000, npvOpeningMinor: 500_000, npvClosingMinor: 700_000 }),
    );
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    const dr = legs.find((l) => l.debitCredit === "debit");
    const cr = legs.find((l) => l.debitCredit === "credit");
    expect(dr?.accountId).toBe("ACC-3300-001");
    expect(cr?.accountId).toBe("ACC-3300-003");
    expect(dr?.amountMinor).toBe(200_000);
  });

  test("Loss (liability side, no flip): Dr Unrealised P&L / Cr Swap Liability", () => {
    const legs = irdSwapRevaluationJournals(
      makeReval({
        npvDeltaMinor: -150_000,
        npvOpeningMinor: -300_000,
        npvClosingMinor: -450_000,
      }),
    );
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    const dr = legs.find((l) => l.debitCredit === "debit");
    const cr = legs.find((l) => l.debitCredit === "credit");
    expect(dr?.accountId).toBe("ACC-3300-003");
    expect(cr?.accountId).toBe("ACC-3300-002");
    expect(dr?.amountMinor).toBe(150_000);
  });

  test("Sign flip asset→liability: 3-leg journal", () => {
    // Opening +400k asset, closing -100k liability → delta = -500k
    const legs = irdSwapRevaluationJournals(
      makeReval({
        npvDeltaMinor: -500_000,
        npvOpeningMinor: 400_000,
        npvClosingMinor: -100_000,
      }),
    );
    expect(legs).toHaveLength(3);
    assertBalanced(legs);

    const pnlDr = legs.find((l) => l.accountId === "ACC-3300-003" && l.debitCredit === "debit");
    const assetCr = legs.find((l) => l.accountId === "ACC-3300-001" && l.debitCredit === "credit");
    const liabCr = legs.find((l) => l.accountId === "ACC-3300-002" && l.debitCredit === "credit");
    expect(pnlDr?.amountMinor).toBe(500_000); // 400k + 100k
    expect(assetCr?.amountMinor).toBe(400_000);
    expect(liabCr?.amountMinor).toBe(100_000);
  });

  test("Sign flip liability→asset: 3-leg journal", () => {
    // Opening -200k liability, closing +300k asset → delta = +500k
    const legs = irdSwapRevaluationJournals(
      makeReval({
        npvDeltaMinor: 500_000,
        npvOpeningMinor: -200_000,
        npvClosingMinor: 300_000,
      }),
    );
    expect(legs).toHaveLength(3);
    assertBalanced(legs);

    const liabDr = legs.find((l) => l.accountId === "ACC-3300-002" && l.debitCredit === "debit");
    const assetDr = legs.find((l) => l.accountId === "ACC-3300-001" && l.debitCredit === "debit");
    const pnlCr = legs.find((l) => l.accountId === "ACC-3300-003" && l.debitCredit === "credit");
    expect(liabDr?.amountMinor).toBe(200_000);
    expect(assetDr?.amountMinor).toBe(300_000);
    expect(pnlCr?.amountMinor).toBe(500_000); // 200k + 300k
  });
});

// ---------------------------------------------------------------------------
// PR-IRS-003: Net coupon cash settlement
// ---------------------------------------------------------------------------

describe("PR-IRS-003: irdSwapCouponJournals", () => {
  test("Zero net cash: returns []", () => {
    const legs = irdSwapCouponJournals(makeCoupon({ netCashMinor: 0 }));
    expect(legs).toHaveLength(0);
  });

  test("Bank receives net (pay-fixed wins): Dr Nostro / Cr Swap Asset", () => {
    const legs = irdSwapCouponJournals(makeCoupon({ netCashMinor: 30_000_00 }));
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    const dr = legs.find((l) => l.debitCredit === "debit");
    const cr = legs.find((l) => l.debitCredit === "credit");
    expect(dr?.accountId).toBe("ACC-1100-001");
    expect(cr?.accountId).toBe("ACC-3300-001");
    expect(dr?.amountMinor).toBe(30_000_00);
  });

  test("Bank pays net (pay-fixed loses): Dr Swap Liability / Cr Nostro", () => {
    const legs = irdSwapCouponJournals(makeCoupon({ netCashMinor: -20_000_00 }));
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    const dr = legs.find((l) => l.debitCredit === "debit");
    const cr = legs.find((l) => l.debitCredit === "credit");
    expect(dr?.accountId).toBe("ACC-3300-002");
    expect(cr?.accountId).toBe("ACC-1100-001");
    expect(dr?.amountMinor).toBe(20_000_00);
  });
});

// ---------------------------------------------------------------------------
// PR-IRS-TERM: Termination / derecognition
// ---------------------------------------------------------------------------

describe("PR-IRS-TERM: irdSwapTerminationJournals", () => {
  test("Zero-NPV maturity: returns []", () => {
    const legs = irdSwapTerminationJournals(
      makeTerm({ terminationPaymentMinor: 0, carryingNpvAtTerminationMinor: 0 }),
    );
    expect(legs).toHaveLength(0);
  });

  test("Asset with gain termination: Dr Nostro / Cr Swap Asset / Cr P&L", () => {
    // Swap was an asset (+600k carrying), bank receives 700k termination payment → +100k gain
    const legs = irdSwapTerminationJournals(
      makeTerm({
        terminationPaymentMinor: 700_000,
        carryingNpvAtTerminationMinor: 600_000,
        realisedPnlMinor: 100_000,
      }),
    );
    expect(legs).toHaveLength(3);
    assertBalanced(legs);

    const nostroDr = legs.find((l) => l.accountId === "ACC-1100-001");
    const assetCr = legs.find((l) => l.accountId === "ACC-3300-001");
    const pnlCr = legs.find((l) => l.accountId === "ACC-3300-003");
    expect(nostroDr?.debitCredit).toBe("debit");
    expect(nostroDr?.amountMinor).toBe(700_000);
    expect(assetCr?.debitCredit).toBe("credit");
    expect(assetCr?.amountMinor).toBe(600_000);
    expect(pnlCr?.debitCredit).toBe("credit");
    expect(pnlCr?.amountMinor).toBe(100_000);
  });

  test("Asset with loss termination: Dr Nostro + Dr P&L / Cr Swap Asset", () => {
    // Swap was an asset (+600k carrying), bank receives 500k → -100k loss
    const legs = irdSwapTerminationJournals(
      makeTerm({
        terminationPaymentMinor: 500_000,
        carryingNpvAtTerminationMinor: 600_000,
        realisedPnlMinor: -100_000,
      }),
    );
    expect(legs).toHaveLength(3);
    assertBalanced(legs);

    const pnlDr = legs.find((l) => l.accountId === "ACC-3300-003");
    expect(pnlDr?.debitCredit).toBe("debit");
    expect(pnlDr?.amountMinor).toBe(100_000);
  });

  test("Liability termination: bank pays to close out", () => {
    // Swap was a liability (-400k carrying), bank pays 400k to close → break-even
    const legs = irdSwapTerminationJournals(
      makeTerm({
        terminationPaymentMinor: -400_000,
        carryingNpvAtTerminationMinor: -400_000,
        realisedPnlMinor: 0,
      }),
    );
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    const liabDr = legs.find((l) => l.accountId === "ACC-3300-002");
    const nostroCr = legs.find((l) => l.accountId === "ACC-1100-001");
    expect(liabDr?.debitCredit).toBe("debit");
    expect(liabDr?.amountMinor).toBe(400_000);
    expect(nostroCr?.debitCredit).toBe("credit");
    expect(nostroCr?.amountMinor).toBe(400_000);
  });

  test("Break-even asset termination: Dr Nostro / Cr Swap Asset (2 legs)", () => {
    const legs = irdSwapTerminationJournals(
      makeTerm({
        terminationPaymentMinor: 300_000,
        carryingNpvAtTerminationMinor: 300_000,
        realisedPnlMinor: 0,
      }),
    );
    expect(legs).toHaveLength(2);
    assertBalanced(legs);

    for (const leg of legs) {
      expect(leg.accountId).not.toBe("ACC-3300-003");
    }
  });
});
