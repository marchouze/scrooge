// tests/suspense-report.test.ts
//
// MC3 suspense-account report — exit-criterion tests for
// platform/accounting/suspense-report.ts.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
// Procedure: PROC-FIN-MC-01 §5 MC3
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import type { TrialBalance } from "../platform/accounting/period-close";
import { generateSuspenseReport } from "../platform/accounting/suspense-report";
import type { SuspenseChartEntry } from "../platform/accounting/suspense-report";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AS_OF = "2026-05-31";

function makeTrialBalance(
  rows: Array<{ accountId: string; currency: string; amountMinor: number }>,
): TrialBalance {
  return {
    rows: rows.map((r) => ({
      leafAccountId: r.accountId,
      currency: r.currency,
      amountMinor: r.amountMinor,
    })),
    perCurrencyTotals: [],
    uptoSequence: rows.length,
  };
}

const SUSPENSE_ENTRY: SuspenseChartEntry = {
  accountId: "ACC-1100-004",
  name: "FX Settlement Suspense ZAR",
  currency: "ZAR",
  isSuspenseAccount: true,
  clearanceHorizonDays: 3,
};

const NON_SUSPENSE_ENTRY: SuspenseChartEntry = {
  accountId: "ACC-1200-001",
  name: "Nostro — FNB ZAR",
  currency: "ZAR",
  isSuspenseAccount: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateSuspenseReport", () => {
  it("returns ok:true when all suspense accounts have zero balance", () => {
    const tb = makeTrialBalance([]); // no entries in TB means zero balance
    const chart: SuspenseChartEntry[] = [SUSPENSE_ENTRY];

    const result = generateSuspenseReport({
      trialBalance: tb,
      chartOfAccounts: chart,
      asOf: AS_OF,
    });

    expect(result.ok).toBe(true);
    expect(result.nonZero).toHaveLength(0);
    expect(result.aged).toHaveLength(0);
    // The suspense account should still appear in the list with amountMinor: 0
    expect(result.suspenseAccounts).toHaveLength(1);
    expect(result.suspenseAccounts[0]?.amountMinor).toBe(0);
  });

  it("returns ok:false when a suspense account has a non-zero balance", () => {
    const tb = makeTrialBalance([
      { accountId: "ACC-1100-004", currency: "ZAR", amountMinor: 50_000 },
    ]);
    const chart: SuspenseChartEntry[] = [SUSPENSE_ENTRY];

    const result = generateSuspenseReport({
      trialBalance: tb,
      chartOfAccounts: chart,
      asOf: AS_OF,
    });

    expect(result.ok).toBe(false);
    expect(result.nonZero).toHaveLength(1);
    expect(result.nonZero[0]?.amountMinor).toBe(50_000);
    expect(result.nonZero[0]?.accountId).toBe("ACC-1100-004");
  });

  it("ignores non-suspense accounts in the chart", () => {
    const tb = makeTrialBalance([
      { accountId: "ACC-1200-001", currency: "ZAR", amountMinor: 1_000_000 },
    ]);
    const chart: SuspenseChartEntry[] = [NON_SUSPENSE_ENTRY, SUSPENSE_ENTRY];

    const result = generateSuspenseReport({
      trialBalance: tb,
      chartOfAccounts: chart,
      asOf: AS_OF,
    });

    // NON_SUSPENSE_ENTRY should not appear in suspenseAccounts
    expect(result.suspenseAccounts.every((a) => a.accountId !== "ACC-1200-001")).toBe(true);
    expect(result.ok).toBe(true); // suspense account is zero
  });

  it("flags aged balances when oldestPostingDates map is supplied", () => {
    const tb = makeTrialBalance([
      { accountId: "ACC-1100-004", currency: "ZAR", amountMinor: 25_000 },
    ]);
    const chart: SuspenseChartEntry[] = [{ ...SUSPENSE_ENTRY, clearanceHorizonDays: 3 }];
    // Oldest posting is 5 days before AS_OF (2026-05-26) — exceeds 3-day horizon
    const oldestPostingDates = new Map([["ACC-1100-004", "2026-05-26"]]);

    const result = generateSuspenseReport({
      trialBalance: tb,
      chartOfAccounts: chart,
      asOf: AS_OF,
      oldestPostingDates,
    });

    expect(result.aged).toHaveLength(1);
    expect(result.aged[0]?.isAged).toBe(true);
    expect(result.aged[0]?.clearanceHorizonDays).toBe(3);
  });

  it("does not flag as aged when balance is within clearance horizon", () => {
    const tb = makeTrialBalance([
      { accountId: "ACC-1100-004", currency: "ZAR", amountMinor: 25_000 },
    ]);
    const chart: SuspenseChartEntry[] = [{ ...SUSPENSE_ENTRY, clearanceHorizonDays: 3 }];
    // Oldest posting is 2 days before AS_OF — within 3-day horizon
    const oldestPostingDates = new Map([["ACC-1100-004", "2026-05-29"]]);

    const result = generateSuspenseReport({
      trialBalance: tb,
      chartOfAccounts: chart,
      asOf: AS_OF,
      oldestPostingDates,
    });

    expect(result.aged).toHaveLength(0);
    expect(result.nonZero).toHaveLength(1);
    expect(result.nonZero[0]?.isAged).toBe(false);
  });

  it("handles multiple suspense accounts and multiple currencies", () => {
    const secondEntry: SuspenseChartEntry = {
      accountId: "ACC-1100-005",
      name: "FX Settlement Suspense USD",
      currency: "USD",
      isSuspenseAccount: true,
      clearanceHorizonDays: 3,
    };
    const tb = makeTrialBalance([
      { accountId: "ACC-1100-004", currency: "ZAR", amountMinor: 10_000 },
      { accountId: "ACC-1100-005", currency: "USD", amountMinor: 0 },
    ]);
    const chart: SuspenseChartEntry[] = [SUSPENSE_ENTRY, secondEntry];

    const result = generateSuspenseReport({
      trialBalance: tb,
      chartOfAccounts: chart,
      asOf: AS_OF,
    });

    expect(result.nonZero).toHaveLength(1);
    expect(result.nonZero[0]?.accountId).toBe("ACC-1100-004");
    expect(result.ok).toBe(false);
  });

  it("uses default 3-day clearance horizon when clearanceHorizonDays is not set", () => {
    const entryWithoutHorizon: SuspenseChartEntry = {
      accountId: "ACC-1100-006",
      name: "Trade Settlement Suspense",
      currency: "ZAR",
      isSuspenseAccount: true,
      // no clearanceHorizonDays — should default to 3
    };
    const tb = makeTrialBalance([
      { accountId: "ACC-1100-006", currency: "ZAR", amountMinor: 5_000 },
    ]);
    // 4 days old — exceeds the 3-day default
    const oldestPostingDates = new Map([["ACC-1100-006", "2026-05-27"]]);

    const result = generateSuspenseReport({
      trialBalance: tb,
      chartOfAccounts: [entryWithoutHorizon],
      asOf: AS_OF,
      oldestPostingDates,
    });

    expect(result.aged).toHaveLength(1);
    expect(result.aged[0]?.clearanceHorizonDays).toBe(3); // defaulted
  });

  it("returns empty report with no chart entries", () => {
    const tb = makeTrialBalance([]);
    const result = generateSuspenseReport({ trialBalance: tb, chartOfAccounts: [], asOf: AS_OF });

    expect(result.ok).toBe(true);
    expect(result.suspenseAccounts).toHaveLength(0);
    expect(result.nonZero).toHaveLength(0);
    expect(result.aged).toHaveLength(0);
  });

  it("ok:true when aged array empty but nonZero is empty", () => {
    const tb = makeTrialBalance([]);
    const chart: SuspenseChartEntry[] = [SUSPENSE_ENTRY];

    const result = generateSuspenseReport({
      trialBalance: tb,
      chartOfAccounts: chart,
      asOf: AS_OF,
    });

    expect(result.ok).toBe(true);
    expect(result.nonZero).toHaveLength(0);
    expect(result.aged).toHaveLength(0);
  });
});
