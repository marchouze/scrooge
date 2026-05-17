// platform/accounting/suspense-report.ts
//
// MC3 — Pre-close check: suspense account report.
//
// Pure function that scans the chart of accounts for suspense accounts
// (`isSuspenseAccount: true`), looks up their balances in the trial balance,
// and flags any non-zero or aged suspense balances before the GL freeze (MC4).
//
// Consumed by the month-end close orchestration at step MC3 of
// PROC-FIN-MC-01 (month-end-close.md).
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
// Procedure: PROC-FIN-MC-01 §5 MC3
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille, CFO)

import type { TrialBalance } from "./period-close";

// ---------------------------------------------------------------------------
// ChartOfAccountsEntry extension
// ---------------------------------------------------------------------------
// NOTE: `isSuspenseAccount` is added here. The canonical ChartOfAccountsEntry
// definition lives in gl-subledger-recon.ts; that type does not yet carry
// this field. This module defines its own minimal input interface so it stays
// pure and decoupled. When gl-subledger-recon.ts is extended to include
// `isSuspenseAccount`, callers can pass the same objects to both functions.

/**
 * Minimal chart-of-accounts entry shape required by the suspense report.
 *
 * `isSuspenseAccount` is `true` for accounts that are expected to clear
 * by period-end (e.g. FX Settlement Suspense ACC-1100-004/005).
 * Accounts without this flag are ignored by this function.
 */
export interface SuspenseChartEntry {
  readonly accountId: string;
  readonly name: string;
  readonly currency: string;
  /** When true, this account is a suspense account subject to MC3 clearance checks. */
  readonly isSuspenseAccount?: boolean;
  /**
   * Clearance horizon in calendar days. Balances older than this are flagged
   * as aged. Default: 3 calendar days at v0 per procedure MC3 spec.
   */
  readonly clearanceHorizonDays?: number;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * A suspense account with a non-zero balance at the pre-close check point.
 */
export interface SuspenseAccountFinding {
  readonly accountId: string;
  readonly name: string;
  readonly currency: string;
  /** Balance in minor currency units (non-zero by definition). */
  readonly amountMinor: number;
  /**
   * True if the account's oldest posting date is more than `clearanceHorizonDays`
   * calendar days before `asOf`. Aged items require documented clearing
   * instructions before close can proceed.
   */
  readonly isAged: boolean;
  /** Clearance horizon in days applied (from chart entry, or default 3). */
  readonly clearanceHorizonDays: number;
}

/**
 * Result of the MC3 suspense-account report.
 *
 * - `suspenseAccounts` — all suspense accounts identified in the chart.
 * - `nonZero`          — suspense accounts with a non-zero balance.
 * - `aged`             — subset of nonZero where balance is older than the
 *                        clearance horizon (default 3 calendar days).
 * - `ok`               — true iff no non-zero suspense accounts (clear to freeze).
 */
export interface SuspenseReportResult {
  /** All suspense accounts from the chart (whether zero or non-zero). */
  readonly suspenseAccounts: readonly SuspenseAccountFinding[];
  /** Subset with non-zero balance — must have clearing instruction before MC4. */
  readonly nonZero: readonly SuspenseAccountFinding[];
  /** Subset of non-zero where balance age > clearanceHorizonDays. */
  readonly aged: readonly SuspenseAccountFinding[];
  /** True iff no suspense account has a non-zero balance. */
  readonly ok: boolean;
}

// ---------------------------------------------------------------------------
// generateSuspenseReport
// ---------------------------------------------------------------------------

const DEFAULT_CLEARANCE_HORIZON_DAYS = 3;

/**
 * Parse a YYYY-MM-DD date string into ms-since-epoch (UTC midnight).
 */
function parseDateMs(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00.000Z`).getTime();
}

/**
 * Compute calendar days between two YYYY-MM-DD strings (from → to).
 * Returns floor of the difference.
 */
function calendarDaysBetween(from: string, to: string): number {
  const MS_PER_DAY = 86_400_000;
  return Math.floor((parseDateMs(to) - parseDateMs(from)) / MS_PER_DAY);
}

/**
 * MC3 — Pre-close suspense account report.
 *
 * Filters `chartOfAccounts` for entries with `isSuspenseAccount: true`,
 * looks up each account's balance in `trialBalance`, and flags:
 *   - any non-zero balance (must have a documented clearing instruction).
 *   - any non-zero balance older than `clearanceHorizonDays` calendar days
 *     (default 3) — flagged as aged (per PROC-FIN-MC-01 §5 MC3).
 *
 * The `asOf` date is used only for the aged-flag calculation. The function
 * does not inspect individual posting dates; the aged flag requires the
 * caller to supply the oldest posting date for each account via the
 * `oldestPostingDates` optional map. If the map is absent or an account
 * has no entry, `isAged` defaults to `false` (conservative — the posting
 * date information is not always available at pre-close check time).
 *
 * Pure function — no I/O.
 *
 * @param args.trialBalance       — trial balance from period-close.ts::computeTrialBalance.
 * @param args.chartOfAccounts    — chart entries (only those with isSuspenseAccount: true are checked).
 * @param args.asOf               — YYYY-MM-DD as-of date for aged-flag calculation.
 * @param args.oldestPostingDates — optional map of accountId → oldest posting YYYY-MM-DD.
 */
export function generateSuspenseReport(args: {
  trialBalance: TrialBalance;
  chartOfAccounts: readonly SuspenseChartEntry[];
  asOf: string;
  /** Optional: oldest known posting date per account (for aged-flag calculation). */
  oldestPostingDates?: Map<string, string>;
}): SuspenseReportResult {
  const { trialBalance, chartOfAccounts, asOf, oldestPostingDates } = args;

  // Index trial-balance rows by accountId for fast lookup.
  // Multiple rows may exist per account (different currencies).
  const tbByAccount = new Map<string, number[]>();
  for (const row of trialBalance.rows) {
    const existing = tbByAccount.get(row.leafAccountId) ?? [];
    existing.push(row.amountMinor);
    tbByAccount.set(row.leafAccountId, existing);
  }

  // Index TB rows by (accountId, currency) for per-currency balance lookup.
  const tbByCurrencyKey = new Map<string, number>();
  for (const row of trialBalance.rows) {
    tbByCurrencyKey.set(`${row.leafAccountId}|${row.currency}`, row.amountMinor);
  }

  const suspenseAccounts: SuspenseAccountFinding[] = [];

  for (const entry of chartOfAccounts) {
    if (!entry.isSuspenseAccount) continue;

    const horizon = entry.clearanceHorizonDays ?? DEFAULT_CLEARANCE_HORIZON_DAYS;

    // Determine the balance for this account from the trial balance.
    // If the account appears in multiple currencies, emit one finding per currency.
    // If the account does not appear in the TB at all, balance = 0.
    const tbRows = trialBalance.rows.filter((r) => r.leafAccountId === entry.accountId);

    if (tbRows.length === 0) {
      // Zero balance — still include in suspenseAccounts list (for complete visibility),
      // but with amountMinor = 0.
      suspenseAccounts.push({
        accountId: entry.accountId,
        name: entry.name,
        currency: entry.currency,
        amountMinor: 0,
        isAged: false,
        clearanceHorizonDays: horizon,
      });
      continue;
    }

    for (const row of tbRows) {
      // Determine if the balance is aged.
      let isAged = false;
      if (row.amountMinor !== 0 && oldestPostingDates) {
        const oldestDate = oldestPostingDates.get(entry.accountId);
        if (oldestDate) {
          const ageDays = calendarDaysBetween(oldestDate, asOf);
          isAged = ageDays > horizon;
        }
      }

      suspenseAccounts.push({
        accountId: entry.accountId,
        name: entry.name,
        currency: row.currency,
        amountMinor: row.amountMinor,
        isAged,
        clearanceHorizonDays: horizon,
      });
    }
  }

  const nonZero = suspenseAccounts.filter((a) => a.amountMinor !== 0);
  const aged = nonZero.filter((a) => a.isAged);

  return {
    suspenseAccounts,
    nonZero,
    aged,
    ok: nonZero.length === 0,
  };
}
