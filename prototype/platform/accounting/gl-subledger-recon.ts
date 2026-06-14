// platform/accounting/gl-subledger-recon.ts
//
// GL ↔ sub-ledger reconciliation engine — five pure functions.
//
// Implements PROC-FIN-BSS-01 steps 3a–3d + 4:
//   tracePostingToSourceEvent  — Step 3a: source-event traceability per posting
//   verifyIfrsClassification   — Step 3b: IFRS classification in-force check
//   checkAgedItems             — Step 3c: clearance-horizon flag
//   assertZeroBalance          — Step 3d: zero-balance assertion for suspense accounts
//   triageException            — Step 4: exception classification
//
// All five functions are PURE — no event-store reads or writes.
// Callers supply all input data.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
// Procedure: PROC-FIN-BSS-01 — Balance sheet substantiation
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille, CFO)
// Co-author: Devon (COO, governance)

import { amountToMinorUnits } from "../core/decimal-money";
import { legAmountMoney } from "../core/money-codec";
import type { SubLedgerPostingEmittedPayload } from "../event-store/event-types/fx-accounting";
import type { TrialBalance } from "./period-close";

// ---------------------------------------------------------------------------
// ChartOfAccountsEntry
// ---------------------------------------------------------------------------

/**
 * Typed representation of a single row in the chart of accounts
 * (`prototype/platform/accounting/_chart-of-accounts.md`).
 *
 * - `ifrsClassification`     — "amortised-cost" | "fvtpl" | "fvoci" | …
 * - `ifrsClassificationStatus` — "in-force" | "superseded" | "under-review"
 * - `clearanceHorizonDays`   — maximum days a balance may age before being
 *                              flagged (suspense = 2, nostro = 0/same-day).
 *                              Absent means no clearance horizon applies.
 * - `shouldNetToZeroAtPeriodEnd` — true for suspense accounts (ACC-1100-004/005).
 * - `sourceEventTypes`       — the business event types whose postings should
 *                              resolve to this account (used for trace check).
 */
export interface ChartOfAccountsEntry {
  readonly accountId: string;
  readonly name: string;
  readonly currency: string;
  readonly ifrsClassification: string;
  /** Status of the IFRS classification itself — governs Step 3b. */
  readonly ifrsClassificationStatus: "in-force" | "superseded" | "under-review";
  /** Days a balance may remain before aging flag; undefined = no horizon. */
  readonly clearanceHorizonDays?: number;
  readonly shouldNetToZeroAtPeriodEnd?: boolean;
  /** Event types whose postings map to this account (for Step 3a trace). */
  readonly sourceEventTypes: readonly string[];
}

// ---------------------------------------------------------------------------
// Step 3a — tracePostingToSourceEvent
// ---------------------------------------------------------------------------

export interface TracedPosting {
  readonly postingEventSourceId: string;
  readonly accountId: string;
  readonly sourceEventType: string;
}

export interface UntracedPosting {
  readonly postingEventSourceId: string;
  readonly accountId: string;
  readonly reason: "null-source-id" | "unrecognised-source-type" | "phantom-source-event";
}

export interface TraceResult {
  readonly traced: readonly TracedPosting[];
  readonly untraced: readonly UntracedPosting[];
  /** True iff every posting was traced with no phantom or missing source events. */
  readonly ok: boolean;
}

/**
 * Step 3a of PROC-FIN-BSS-01 — source-event trace.
 *
 * For each account in the trial balance with a non-zero balance:
 *   (i)  Every `SubLedgerPostingEmitted` must have a non-empty `sourceEventId`.
 *   (ii) That `sourceEventId` must resolve to a known primary event in
 *        `primaryEvents` whose type is in the account's `sourceEventTypes`.
 *
 * Returns `ok: false` if any posting is untraced.
 *
 * Pure — no I/O.
 *
 * Citations: Principle 1; PROC-FIN-BSS-01 §5 step 3a; posting-rule register
 * at `prototype/platform/accounting/_posting-rules.md`.
 */
export function tracePostingToSourceEvent(args: {
  trialBalance: TrialBalance;
  postingEvents: readonly SubLedgerPostingEmittedPayload[];
  /** All primary events indexed by event_id. */
  primaryEvents: Map<string, { type: string; payload: unknown }>;
  /** accountId → expected source event types. */
  accountSourceMap: Map<string, readonly string[]>;
}): TraceResult {
  const { trialBalance, postingEvents, primaryEvents, accountSourceMap } = args;

  // Collect accountIds that have a non-zero balance in the trial balance.
  const activeAccountIds = new Set(trialBalance.rows.map((r) => r.leafAccountId));

  const traced: TracedPosting[] = [];
  const untraced: UntracedPosting[] = [];

  for (const posting of postingEvents) {
    // Determine which accounts this posting touches.
    const accountIdsInPosting = new Set(posting.legs.map((l) => l.accountId));

    // Only check postings that touch at least one account active in the TB.
    const relevantAccountIds = [...accountIdsInPosting].filter((id) => activeAccountIds.has(id));
    if (relevantAccountIds.length === 0) continue;

    const srcId = posting.sourceEventId;

    // (i) null / empty source ID — Principle 1 violation.
    if (!srcId) {
      for (const accountId of relevantAccountIds) {
        untraced.push({
          postingEventSourceId: "",
          accountId,
          reason: "null-source-id",
        });
      }
      continue;
    }

    // (ii) resolve the source event.
    const sourceEvent = primaryEvents.get(srcId);
    if (!sourceEvent) {
      for (const accountId of relevantAccountIds) {
        untraced.push({
          postingEventSourceId: srcId,
          accountId,
          reason: "phantom-source-event",
        });
      }
      continue;
    }

    // (iii) check the source event type is expected for each account.
    for (const accountId of relevantAccountIds) {
      const expectedTypes = accountSourceMap.get(accountId) ?? [];
      if (expectedTypes.length > 0 && !expectedTypes.includes(sourceEvent.type)) {
        untraced.push({
          postingEventSourceId: srcId,
          accountId,
          reason: "unrecognised-source-type",
        });
      } else {
        traced.push({
          postingEventSourceId: srcId,
          accountId,
          sourceEventType: sourceEvent.type,
        });
      }
    }
  }

  return {
    traced,
    untraced,
    ok: untraced.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Step 3b — verifyIfrsClassification
// ---------------------------------------------------------------------------

export interface ClassificationFinding {
  readonly accountId: string;
  readonly currency: string;
  readonly ifrsClassification: string;
  readonly ifrsClassificationStatus: string;
  readonly reason:
    | "classification-superseded"
    | "classification-under-review"
    | "account-not-in-chart";
}

export interface ClassificationResult {
  /** Account IDs that passed the classification check. */
  readonly passed: readonly string[];
  readonly failed: readonly ClassificationFinding[];
  readonly ok: boolean;
}

/**
 * Step 3b of PROC-FIN-BSS-01 — IFRS classification in-force check.
 *
 * For each account with a non-zero balance in the trial balance, verify that:
 *   - The account is present in the chart of accounts.
 *   - Its `ifrsClassificationStatus` is "in-force" (not "superseded" or
 *     "under-review").
 *
 * A "superseded" or "under-review" status without a corresponding
 * `IFRSClassificationAssigned` event in the period is a Principle 1
 * violation and maps to exception kind `unexplained` at step 4.
 *
 * Citations: PROC-FIN-BSS-01 §5 step 3b; IFRS 9 §4.1–§4.2; IAS 1 §54.
 */
export function verifyIfrsClassification(args: {
  trialBalance: TrialBalance;
  chartOfAccounts: readonly ChartOfAccountsEntry[];
}): ClassificationResult {
  const { trialBalance, chartOfAccounts } = args;

  const coaByAccountId = new Map(chartOfAccounts.map((e) => [e.accountId, e]));

  const passed: string[] = [];
  const failed: ClassificationFinding[] = [];

  for (const row of trialBalance.rows) {
    if (row.amountMinor === 0) continue;

    const entry = coaByAccountId.get(row.leafAccountId);

    if (!entry) {
      failed.push({
        accountId: row.leafAccountId,
        currency: row.currency,
        ifrsClassification: "unknown",
        ifrsClassificationStatus: "unknown",
        reason: "account-not-in-chart",
      });
      continue;
    }

    if (entry.ifrsClassificationStatus === "superseded") {
      failed.push({
        accountId: row.leafAccountId,
        currency: row.currency,
        ifrsClassification: entry.ifrsClassification,
        ifrsClassificationStatus: entry.ifrsClassificationStatus,
        reason: "classification-superseded",
      });
    } else if (entry.ifrsClassificationStatus === "under-review") {
      failed.push({
        accountId: row.leafAccountId,
        currency: row.currency,
        ifrsClassification: entry.ifrsClassification,
        ifrsClassificationStatus: entry.ifrsClassificationStatus,
        reason: "classification-under-review",
      });
    } else {
      passed.push(row.leafAccountId);
    }
  }

  return {
    passed,
    failed,
    ok: failed.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Step 3c — checkAgedItems
// ---------------------------------------------------------------------------

export interface AgedItem {
  readonly accountId: string;
  readonly currency: string;
  /**
   * Net OPEN (unconfirmed) residual outstanding in minor units — NOT the net
   * account balance. A confirmed standing cash balance nets to zero in the
   * open-residual space and is never reported here.
   */
  readonly amountMinor: number;
  /** Oldest posting date among the OPEN/unconfirmed legs that form the residual. */
  readonly oldestPostingDate: string;
  /** Number of calendar days the open residual has been outstanding. */
  readonly ageCalendarDays: number;
  readonly clearanceHorizonDays: number;
}

export interface AgedItemsResult {
  /** Account IDs (+ currencies) where no aging violation was found. */
  readonly clean: readonly string[];
  readonly aged: readonly AgedItem[];
  readonly ok: boolean;
}

/**
 * Posting types that represent a CONFIRMED / settled cash movement — the
 * correspondent (or central bank) has confirmed the leg, so the cash sitting
 * in the nostro is substantiated and must NOT be aged.
 *
 * These are the settlement-side posting types: the explicit
 * `settlement-confirmation` confirmation posting, the FX principal-payment and
 * lifecycle-close cash movements (which only post once the leg has settled),
 * the generic `settlement` posting, and the treasury funding movements
 * (repo / deposit / interbank placement) which represent confirmed cash in/out
 * of the nostro at value date.
 *
 * Authority: PROC-FIN-BSS-01 §5 step 3c — "aged only if outstanding beyond
 * same-day WITHOUT correspondent confirmation".
 */
const CONFIRMED_SETTLEMENT_POSTING_TYPES: ReadonlySet<string> = new Set([
  "settlement-confirmation",
  "settlement",
  "fx-principal-payment",
  "fx-lifecycle-close",
  "repo-trade-booking",
  "deposit-taken",
  "ibl-placement",
  // Append-only correcting entries neutralise prior open postings — they carry
  // a confirmed (resolved) status by construction.
  "duplicate-reversal-correction",
  "stale-revaluation-correction",
  "settlement-reversal",
  "cancellation-reversal",
]);

// The second confirmation signal — postings whose `sourceEventId` resolves to
// a settlement-confirmation primary event (`SettlementConfirmed` /
// `FxSettlementConfirmed` / `TradeMatured`) — is supplied by the caller as the
// `confirmedSourceEventIds` set on `checkAgedItems`. The seed/BSS runner builds
// that set by replaying those event types; keeping the type list in the caller
// avoids hard-coding event-type knowledge in this pure function.

/**
 * Parse a YYYY-MM-DD date string into a Date object (UTC midnight).
 * Throws if the format is invalid.
 */
function parseDate(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${dateStr}`);
  return d;
}

/**
 * Compute calendar days between two YYYY-MM-DD strings.
 * Returns Math.floor of the difference (whole days).
 */
function calendarDaysBetween(from: string, to: string): number {
  const msPerDay = 86_400_000;
  return Math.floor((parseDate(to).getTime() - parseDate(from).getTime()) / msPerDay);
}

/**
 * Decide whether a posting leg is CONFIRMED (settled/cleared) rather than OPEN
 * (unconfirmed / unsettled). Confirmation is determined per-posting from two
 * independent signals, either of which is sufficient:
 *
 *   1. `postingType` ∈ CONFIRMED_SETTLEMENT_POSTING_TYPES — the posting is a
 *      settlement-side cash movement (or an append-only correction).
 *   2. The posting's `sourceEventId` resolves, via the caller-supplied
 *      `confirmedSourceEventIds` set, to a settlement-confirmation primary
 *      event (`SettlementConfirmed` / `FxSettlementConfirmed` / `TradeMatured`).
 *
 * Anything else is treated as OPEN.
 */
function isConfirmedPosting(
  posting: SubLedgerPostingEmittedPayload,
  confirmedSourceEventIds: ReadonlySet<string>,
): boolean {
  if (CONFIRMED_SETTLEMENT_POSTING_TYPES.has(posting.postingType)) return true;
  if (posting.sourceEventId && confirmedSourceEventIds.has(posting.sourceEventId)) return true;
  return false;
}

/**
 * Step 3c of PROC-FIN-BSS-01 — aged-item check (PER-ITEM, CONFIRMATION-AWARE).
 *
 * The check ages only OPEN / UNCONFIRMED items, never the net confirmed cash
 * balance. For each aging-eligible account (one with a `clearanceHorizonDays`)
 * it nets ONLY the open/unconfirmed posting legs into a per-account+currency
 * open residual. A confirmed standing cash balance — e.g. a nostro holding
 * net confirmed settlement positions — nets to zero in this open-residual
 * space and is reported clean, not aged.
 *
 * An account+currency is flagged aged iff:
 *   (a) its net OPEN residual is non-zero, AND
 *   (b) the oldest OPEN posting contributing to that residual is older than
 *       the account's `clearanceHorizonDays`.
 *
 * Confirmation is sourced from the available settlement signal: the
 * `settlement-confirmation` posting type, the settlement-side cash-movement
 * posting types, and (when `confirmedSourceEventIds` is supplied) postings
 * whose `sourceEventId` resolves to a `SettlementConfirmed` event. See
 * `isConfirmedPosting` and CONFIRMED_SETTLEMENT_POSTING_TYPES.
 *
 * Accounts with no `clearanceHorizonDays` defined are never flagged.
 *
 * Citations: PROC-FIN-BSS-01 §5 step 3c; Accounting Policies v0.1 §3.4;
 * IFRS 9 §B3.1.3. Confirmation-aware redesign: PROC-FIN-BSS-01 §7.3 retiring
 * D-CFO-BSS-2026-05-SEED-NOSTRO-AGED-EXCEPTION; SubstrateAlert
 * alert:integrity:bss-aged-items-confirmed-leg-blind (Bea, Accounting &
 * financial reporting engineer, engineering).
 */
export function checkAgedItems(args: {
  trialBalance: TrialBalance;
  postingEvents: readonly SubLedgerPostingEmittedPayload[];
  chartOfAccounts: readonly ChartOfAccountsEntry[];
  /** YYYY-MM-DD — the substantiation as-of date. */
  asOf: string;
  /**
   * Optional set of `sourceEventId`s known to resolve to a settlement
   * confirmation primary event (`SettlementConfirmed` etc). Postings whose
   * source is in this set are treated as CONFIRMED even if their `postingType`
   * is not itself a settlement-side type. Defaults to empty — confirmation is
   * then driven entirely by posting type.
   */
  confirmedSourceEventIds?: ReadonlySet<string>;
}): AgedItemsResult {
  const { trialBalance, postingEvents, chartOfAccounts, asOf } = args;
  const confirmedSourceEventIds = args.confirmedSourceEventIds ?? new Set<string>();

  const coaByAccountId = new Map(chartOfAccounts.map((e) => [e.accountId, e]));

  // Aging-eligible accounts are those that carry a clearance horizon.
  const eligibleAccountIds = new Set(
    chartOfAccounts.filter((e) => e.clearanceHorizonDays !== undefined).map((e) => e.accountId),
  );

  // Per (account|currency) open-residual state: signed net amount of OPEN legs
  // (debit positive, credit negative) and the oldest OPEN posting date.
  interface OpenResidual {
    netMinor: number;
    oldestOpenDate: string | undefined;
  }
  const openByKey = new Map<string, OpenResidual>();

  for (const posting of postingEvents) {
    if (isConfirmedPosting(posting, confirmedSourceEventIds)) continue; // confirmed → not aged
    const postDate = posting.postedAt.slice(0, 10);
    for (const leg of posting.legs) {
      if (!eligibleAccountIds.has(leg.accountId)) continue;
      const key = `${leg.accountId}|${leg.currency}`;
      const state = openByKey.get(key) ?? { netMinor: 0, oldestOpenDate: undefined };
      const legMinor = Number(amountToMinorUnits(legAmountMoney(leg)));
      state.netMinor += leg.debitCredit === "debit" ? legMinor : -legMinor;
      if (!state.oldestOpenDate || postDate < state.oldestOpenDate) {
        state.oldestOpenDate = postDate;
      }
      openByKey.set(key, state);
    }
  }

  const clean: string[] = [];
  const aged: AgedItem[] = [];

  for (const row of trialBalance.rows) {
    if (row.amountMinor === 0) continue;

    const key = `${row.leafAccountId}|${row.currency}`;
    const entry = coaByAccountId.get(row.leafAccountId);
    if (!entry || entry.clearanceHorizonDays === undefined) {
      // No clearance horizon — not eligible for aging.
      clean.push(key);
      continue;
    }

    const residual = openByKey.get(key);
    if (!residual || residual.netMinor === 0 || !residual.oldestOpenDate) {
      // No open/unconfirmed residual — the balance is fully confirmed cash.
      clean.push(key);
      continue;
    }

    const ageDays = calendarDaysBetween(residual.oldestOpenDate, asOf);
    if (ageDays > entry.clearanceHorizonDays) {
      aged.push({
        accountId: row.leafAccountId,
        currency: row.currency,
        amountMinor: residual.netMinor,
        oldestPostingDate: residual.oldestOpenDate,
        ageCalendarDays: ageDays,
        clearanceHorizonDays: entry.clearanceHorizonDays,
      });
    } else {
      clean.push(key);
    }
  }

  return {
    clean,
    aged,
    ok: aged.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Step 3d — assertZeroBalance
// ---------------------------------------------------------------------------

export interface ZeroBalanceFinding {
  readonly accountId: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly reason: "non-zero-suspense";
}

export interface ZeroBalanceResult {
  /** Account IDs that are either zero or not marked as zero-balance required. */
  readonly passed: readonly string[];
  readonly failed: readonly ZeroBalanceFinding[];
  readonly ok: boolean;
}

/**
 * Step 3d of PROC-FIN-BSS-01 — cross-leg / zero-balance assertion.
 *
 * For any account that has `shouldNetToZeroAtPeriodEnd: true` in the chart
 * of accounts (ACC-1100-004, ACC-1100-005 — FX Settlement Suspense), assert
 * the trial-balance row's `amountMinor === 0`.
 *
 * A non-zero suspense balance is not an immediate exception — see step 4
 * triage where it becomes `timing-difference` (< 2bd) or `unexplained` (> 2bd).
 *
 * Citations: PROC-FIN-BSS-01 §5 step 3d; Accounting Policies v0.1 §3.4;
 * BA 610 Item 30 note.
 */
export function assertZeroBalance(args: {
  trialBalance: TrialBalance;
  chartOfAccounts: readonly ChartOfAccountsEntry[];
}): ZeroBalanceResult {
  const { trialBalance, chartOfAccounts } = args;

  const coaByAccountId = new Map(chartOfAccounts.map((e) => [e.accountId, e]));

  // Build a set of zero-balance-required account IDs.
  const zeroBalanceRequired = new Set(
    chartOfAccounts.filter((e) => e.shouldNetToZeroAtPeriodEnd === true).map((e) => e.accountId),
  );

  const passed: string[] = [];
  const failed: ZeroBalanceFinding[] = [];

  // Check every zero-balance-required account (whether or not it appears in TB).
  for (const accountId of zeroBalanceRequired) {
    const entry = coaByAccountId.get(accountId);
    if (!entry) continue; // Defensive — account is in the set so entry exists.

    // Find matching rows in trial balance (there may be multiple currencies).
    const rows = trialBalance.rows.filter((r) => r.leafAccountId === accountId);

    if (rows.length === 0) {
      // Account not in the trial balance → balance is zero → passed.
      passed.push(accountId);
      continue;
    }

    for (const row of rows) {
      if (row.amountMinor !== 0) {
        failed.push({
          accountId,
          currency: row.currency,
          amountMinor: row.amountMinor,
          reason: "non-zero-suspense",
        });
      } else {
        passed.push(`${accountId}|${row.currency}`);
      }
    }
  }

  return {
    passed,
    failed,
    ok: failed.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Step 4 — triageException
// ---------------------------------------------------------------------------

/**
 * An exception found in one of steps 3a–3d, to be classified at step 4.
 */
export interface ReconException {
  readonly accountId: string;
  readonly currency?: string;
  /** Amount outstanding in minor units (absolute value). */
  readonly amountMinorAbsolute: bigint;
  /**
   * Step that raised the exception.
   * "trace"         → step 3a (untraced posting — Principle 1 violation)
   * "classification" → step 3b (IFRS classification issue)
   * "aged"          → step 3c (balance beyond clearance horizon)
   * "zero-balance"  → step 3d (non-zero suspense at period-end)
   */
  readonly step: "trace" | "classification" | "aged" | "zero-balance";
  /**
   * Optional hint supplied by the source step to help the triage classifier.
   * For step 3a: "null-source-id" | "phantom-source-event" | "unrecognised-source-type"
   * For step 3b: "classification-superseded" | "classification-under-review" | "account-not-in-chart"
   * For step 3c: age (in days) as string e.g. "3"
   * For step 3d: empty string or clearance-horizon status
   */
  readonly hint?: string;
  /**
   * For zero-balance / aged exceptions, the number of calendar days the
   * balance has been outstanding (enables timing-difference vs unexplained
   * determination per step 3d).
   */
  readonly ageCalendarDays?: number;
  /** Clearance horizon in days for the account, if known. */
  readonly clearanceHorizonDays?: number;
}

export interface TriagedExceptionItem {
  readonly exception: ReconException;
  readonly exceptionKind: "timing-difference" | "substrate-gap" | "unexplained";
  readonly rationale: string;
}

export interface TriageResult {
  readonly timingDifference: readonly TriagedExceptionItem[];
  readonly substrateGap: readonly TriagedExceptionItem[];
  readonly unexplained: readonly TriagedExceptionItem[];
  /**
   * True if any `unexplained` exception exceeds the materiality threshold,
   * which requires immediate escalation to Camille (CFO, finance) per
   * PROC-FIN-BSS-01 §5 step 4.
   */
  readonly escalate: boolean;
}

/**
 * Step 4 of PROC-FIN-BSS-01 — exception triage.
 *
 * Classification rules (ordered by precedence):
 *
 * 1. `timing-difference` — balance outstanding within the account's
 *    clearance horizon (aged items < horizon days).
 *    Also: zero-balance suspense with `ageCalendarDays ≤ clearanceHorizonDays`.
 *
 * 2. `substrate-gap` — posting engine not wired for this event type.
 *    Detected when `hint` is "unrecognised-source-type" (step 3a).
 *    Not escalated to Camille unless above materiality; document as
 *    substrate gap + emit SubstrateAlert.
 *
 * 3. `unexplained` — all remaining items:
 *    - step 3a with "null-source-id" or "phantom-source-event" (Principle 1 violation)
 *    - step 3b with any failing classification status
 *    - step 3c aged items beyond horizon
 *    - step 3d non-zero suspense beyond clearance horizon
 *
 * Materiality: `escalate = true` iff any `unexplained` exception has
 *   `amountMinorAbsolute > materialityThresholdMinor`.
 *
 * Default threshold: ZAR 50,000 = 5_000_000_00n (minor units: ZAR × 100).
 *
 * Citations: PROC-FIN-BSS-01 §5 step 4; IAS 1 §29–§31 (materiality);
 * Companies Act §28 (true-and-fair); Accounting Policies v0.1 §1.
 */
export function triageException(args: {
  exceptions: readonly ReconException[];
  asOf: string;
  /** ZAR minor units. Default: 5_000_000_00n (ZAR 50,000). */
  materialityThresholdMinor?: bigint;
}): TriageResult {
  const { exceptions, materialityThresholdMinor = 5_000_000_00n } = args;

  const timingDifference: TriagedExceptionItem[] = [];
  const substrateGap: TriagedExceptionItem[] = [];
  const unexplained: TriagedExceptionItem[] = [];

  for (const exc of exceptions) {
    let kind: "timing-difference" | "substrate-gap" | "unexplained";
    let rationale: string;

    if (exc.step === "trace" && exc.hint === "unrecognised-source-type") {
      // Substrate gap — posting engine not wired for this event type.
      kind = "substrate-gap";
      rationale = `Account ${exc.accountId}: SubLedgerPostingEmitted source event type not in account's expected source types (PROC-FIN-BSS-01 §5 step 3a). Document as posting-rule substrate gap; emit SubstrateAlert.`;
    } else if (exc.step === "trace") {
      // null-source-id or phantom-source-event — Principle 1 violation.
      kind = "unexplained";
      rationale = `Account ${exc.accountId}: Principle 1 violation — ${
        exc.hint === "null-source-id"
          ? "SubLedgerPostingEmitted has no sourceEventId."
          : "sourceEventId resolves to a phantom (non-existent) event."
      } Immediate escalation to Camille (CFO, finance) required.`;
    } else if (exc.step === "classification") {
      // IFRS classification issue — unexplained (may be P1 violation).
      kind = "unexplained";
      const reason = exc.hint ?? "unknown classification issue";
      rationale = `Account ${exc.accountId}: IFRS classification check failed (${reason}). Per PROC-FIN-BSS-01 §5 step 3b — escalate to Camille. Do not proceed to sign-off until reclassification event is emitted and substantiated.`;
    } else if (exc.step === "aged" || exc.step === "zero-balance") {
      const ageDays = exc.ageCalendarDays ?? 0;
      const horizon = exc.clearanceHorizonDays ?? 0;

      if (ageDays <= horizon) {
        // Within the clearance window — timing difference (tolerated).
        kind = "timing-difference";
        rationale =
          `Account ${exc.accountId}: balance outstanding ${ageDays}d ≤ ` +
          `clearance horizon ${horizon}d. Timing difference — expect to clear next business day.`;
      } else {
        // Beyond horizon — unexplained.
        kind = "unexplained";
        rationale = `Account ${exc.accountId}: balance outstanding ${ageDays}d > clearance horizon ${horizon}d. Escalate to ${
          exc.step === "zero-balance"
            ? "Tomas (Operations & payments engineer) + Camille (CFO, finance)."
            : "Camille (CFO, finance)."
        }`;
      }
    } else {
      // Catch-all safety net.
      kind = "unexplained";
      rationale = `Account ${exc.accountId}: unclassified exception at step ${exc.step}.`;
    }

    const item: TriagedExceptionItem = { exception: exc, exceptionKind: kind, rationale };
    if (kind === "timing-difference") timingDifference.push(item);
    else if (kind === "substrate-gap") substrateGap.push(item);
    else unexplained.push(item);
  }

  const escalate = unexplained.some(
    (item) => item.exception.amountMinorAbsolute > materialityThresholdMinor,
  );

  return { timingDifference, substrateGap, unexplained, escalate };
}
