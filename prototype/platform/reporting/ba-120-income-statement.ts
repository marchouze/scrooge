// platform/reporting/ba-120-income-statement.ts
//
// WS-FINANCE-BA-RETURNS-QUINTET — BA 120 (Income Statement) projection.
//
// Form-number authority: the SARB Excel form set — BA 120 = "Income Statement"
// (workbook tab A1). The prior "BA 610" label was a fabricated numbering
// artefact: BA 610 is actually "Foreign Operations of South African Banks".
// Re-numbered forward-only under D-BA-RETURN-NUMBERING-EXCEL-CANONICAL
// (CEO 2026-06-09); see Regulations/SARB-PA/ba-returns/_canonical-register.md.
// Internal `Ba610*` symbol names retained pending a separate symbol-rename pass.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), extended 2026-05-17 to add the BA-returns
// quintet (Marc's directive — `WS-FINANCE-BA-RETURNS-QUINTET`).
//
// This module is a *pure projection* over a period-delta `TrialBalance`
// (Slice 2) filtered to P&L accounts (income + expense classes) plus an
// explicit BA 610 line-classification map. No event side-effects; no
// document-store writes; no event-store reads. Callers (the CLI wrapper
// at `prototype/scripts/render-ba-610.ts`, downstream `ReportGenerated`
// event emitters) compose the inputs and consume the output.
//
// Pipeline (mirrors Slice 4's BA 100 architecture):
//
//   EVENT LOG          (Principle 1 — sole truth)
//      → PROJECTION RUNTIME    — folds events into balances
//      → PERIOD CLOSE          — Slice 2 — period-delta trial balance for P&L
//      → SEMANTIC LAYER        — IFRS Slice 6 + BA 610 line mapping (caller-side)
//      → BA 610 PROJECTION     — this module — pure function
//      → RENDER + STORE        — `ba-610-render.ts` + RMS doc store
//
// Computation per Banks Act 94 of 1990 §75 + Regulations Relating to
// Banks Reg 32 (monthly returns) + SARB BA 610 published schema +
// IAS 1 §82–§87 (Statement of Comprehensive Income):
//
//   interestIncome          = Σ |amount| over lines classified `interest-income`
//   interestExpense         = Σ |amount| over lines classified `interest-expense`
//   netInterestIncome       = interestIncome − interestExpense
//   feeIncome               = Σ |amount| over lines classified `fee-income`
//   tradingProfitLoss       = Σ signed-amount over lines classified `trading-pnl`
//                             (sign-preserving: trading P&L can be a loss)
//   operatingExpenses       = Σ |amount| over lines classified `operating-expense`
//   profitBeforeTax         = netInterestIncome + feeIncome + tradingProfitLoss
//                             − operatingExpenses
//
// FX P&L flows through the trial balance via the existing
// `FxPositionRevalued` posting rule (PR #472) — the FX P&L accounts get
// classified into `trading-pnl` (or a dedicated `fx-pnl` sub-category)
// at the call site, so no special handling is needed in the generator.
//
// Per-entity. Bank-licence-bound; only Hoz Bank `LE-ZA-HOZ-BANK` is in
// scope at v0. Securities-firm and group-consolidated BA 610 deferred
// under `D-REGULATORY-PERIMETER`.
//
// Substrate gaps surfaced (forward-link in the decision record):
//   - **BA 610 line-classification map** is supplied externally for now.
//     Chart-of-accounts schema does NOT yet have a `ba300Line` field; the
//     map lives at the call site. Mira's `WS-INSTRUMENT-ANALYSES` should
//     extend to publish SARB BA 610 line mapping; until then the map is
//     authored at the call site.
//   - **Income tax expense + profit-after-tax** deferred. Profit-before-
//     tax is the v0 bottom line; tax-effect accounting requires Yael's
//     CIT slice (paused until commencement-of-trading per build-phase
//     posture in CLAUDE.md `project_rules_bind_at_commencement`).
//   - **OCI (Other Comprehensive Income)** deferred. SARB BA 610 form
//     scope at v0 is profit-or-loss only; the IFRS Slice 6 SoCI carries
//     OCI separately.
//   - **Group-consolidated BA 610** (LE-ZA-HOZ-GROUP look-through per
//     Banks Act §60) deferred. Solo entity only at v0.
//   - **SARB BA 610 XML adapter** deferred to a downstream slice; this
//     module emits the canonical JSON contract only.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration; JSON-schema co-design).

import type { TrialBalanceSnapshotRow } from "../event-store/event-types";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * BA 610 line classification. Each P&L leaf account maps to exactly one
 * BA 610 line bucket. Accounts not in the map are surfaced in
 * `classificationGaps` (non-fatal) so the caller can iteratively resolve.
 *
 * Sign convention (mirrors IAS 1 / trial-balance convention from Slice 2):
 *   income / fee-income  : negative amountMinor = credit balance (typical)
 *   expense              : positive amountMinor = debit balance (typical)
 *   trading-pnl          : signed — credit balance = profit, debit balance = loss
 *
 * For `interest-income`, `interest-expense`, `fee-income`, and
 * `operating-expense` the generator takes absolute value and aggregates
 * as a positive magnitude. For `trading-pnl` the signed amount is
 * preserved (negate the trial-balance amount: credit = profit → flip
 * sign so profit reads positive in the output).
 */
export type Ba610LineCategory =
  | "interest-income"
  | "interest-expense"
  | "fee-income"
  | "trading-pnl"
  | "operating-expense"
  | "other-income"
  | "other-expense";

export interface Ba610LineClassification {
  readonly leafAccountId: string;
  readonly category: Ba610LineCategory;
  /**
   * Free-form sub-line label for the BA 610 form (e.g.
   * `interest-income.loans-and-advances`,
   * `trading-pnl.fx-revaluation`, `operating-expense.staff-costs`).
   */
  readonly lineLabel: string;
  /** Optional sub-category for further grouping within the line. */
  readonly subCategory?: string;
}

export type Ba610ClassificationMap = readonly Ba610LineClassification[];

/**
 * The complete generator input. The trial balance is the period-delta
 * P&L view (income + expense accounts only — caller filters upstream or
 * supplies the full TB and trusts the classification map to drop balance-
 * sheet accounts on the floor; unmatched rows surface in
 * `classificationGaps`).
 */
export interface Ba610GeneratorInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). */
  readonly entity: string;
  /** Period-start ISO 8601. */
  readonly periodStart: string;
  /** Period-end ISO 8601. */
  readonly periodEnd: string;
  /** Period identifier (`period:hoz-bank:month:2026-05`). */
  readonly periodId: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;
  /** Trial-balance rows (period-delta — P&L). */
  readonly trialBalance: readonly TrialBalanceSnapshotRow[];
  /** Per-account BA 610 classifications. */
  readonly classifications: Ba610ClassificationMap;
  /** Optional citation to source `TrialBalanceSnapshotted.event_id`. */
  readonly trialBalanceSnapshotEventId?: string;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface Ba610LineItem {
  readonly lineId: string;
  readonly lineLabel: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly contributingAccounts: readonly string[];
  readonly subCategory?: string;
  readonly note?: string;
}

export interface Ba610LineCategorySection {
  readonly category: Ba610LineCategory;
  readonly totalMinor: number;
  readonly lineItems: readonly Ba610LineItem[];
}

export interface Ba610ClassificationGap {
  readonly leafAccountId: string;
  readonly currency: string;
  readonly amountMinor: number;
}

export interface Ba610IncomeStatement {
  readonly meta: {
    readonly form: "BA 120";
    readonly formVersion: "v0.1-rehearsal";
    readonly entity: string;
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
    readonly generatorVersion: "v0.1";
    readonly trialBalanceSnapshotEventId?: string;
    readonly classificationsFingerprint: string;
  };
  readonly interestIncome: Ba610LineCategorySection;
  readonly interestExpense: Ba610LineCategorySection;
  readonly netInterestIncomeMinor: number;
  readonly feeIncome: Ba610LineCategorySection;
  readonly tradingProfitLoss: Ba610LineCategorySection;
  readonly operatingExpenses: Ba610LineCategorySection;
  readonly otherIncome: Ba610LineCategorySection;
  readonly otherExpenses: Ba610LineCategorySection;
  readonly profitBeforeTaxMinor: number;
  readonly classificationGaps: readonly Ba610ClassificationGap[];
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors + scope guard
// ---------------------------------------------------------------------------

export class Ba610GeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba610GeneratorError";
  }
}

export const BA_610_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entity: string): void {
  if (!BA_610_BANK_ENTITIES.includes(entity)) {
    throw new Ba610GeneratorError(
      `BA 610 (Income Statement) is bank-licence-bound; entity '${entity}' is not in BA_610_BANK_ENTITIES (${BA_610_BANK_ENTITIES.join(
        ", ",
      )}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the BA 610 (Income Statement) projection from a period-delta
 * trial balance + a caller-supplied line-classification map. Pure
 * function; deterministic.
 */
export function generateBa610IncomeStatement(input: Ba610GeneratorInput): Ba610IncomeStatement {
  assertBankEntity(input.entity);
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new Ba610GeneratorError(
      `BA 610 generator: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }
  if (!(input.periodStart < input.periodEnd)) {
    throw new Ba610GeneratorError(
      `BA 610 generator: periodStart (${input.periodStart}) must precede periodEnd (${input.periodEnd})`,
    );
  }

  const ccy = input.functionalCurrency;

  const classMap = new Map<string, Ba610LineClassification>();
  for (const c of input.classifications) {
    if (classMap.has(c.leafAccountId)) {
      throw new Ba610GeneratorError(
        `BA 610 generator: duplicate classification for account '${c.leafAccountId}'`,
      );
    }
    classMap.set(c.leafAccountId, c);
  }

  const tbInCurrency = input.trialBalance.filter((r) => r.currency === ccy);

  // Per-category line buckets.
  type Bucket = { lines: Ba610LineItem[]; total: number };
  const buckets: Record<Ba610LineCategory, Bucket> = {
    "interest-income": { lines: [], total: 0 },
    "interest-expense": { lines: [], total: 0 },
    "fee-income": { lines: [], total: 0 },
    "trading-pnl": { lines: [], total: 0 },
    "operating-expense": { lines: [], total: 0 },
    "other-income": { lines: [], total: 0 },
    "other-expense": { lines: [], total: 0 },
  };

  const classificationGaps: Ba610ClassificationGap[] = [];

  const sorted = [...tbInCurrency].sort((a, b) =>
    a.leafAccountId < b.leafAccountId ? -1 : a.leafAccountId > b.leafAccountId ? 1 : 0,
  );

  for (const row of sorted) {
    const c = classMap.get(row.leafAccountId);
    if (!c) {
      classificationGaps.push({
        leafAccountId: row.leafAccountId,
        currency: row.currency,
        amountMinor: row.amountMinor,
      });
      continue;
    }
    // Signed contribution. For trading-pnl we preserve the sign and flip
    // (credit balance on the TB = profit; flip so profit reads positive).
    // For all other categories we present absolute magnitude — the
    // direction is encoded in the category label (income vs expense).
    const signedContribution =
      c.category === "trading-pnl" ? -row.amountMinor : Math.abs(row.amountMinor);
    const note = signWarningForCategory(row.amountMinor, c.category);
    const lineItem: Ba610LineItem = {
      lineId: `${c.category}.${row.leafAccountId}`,
      lineLabel: c.lineLabel,
      amountMinor: signedContribution,
      currency: ccy,
      contributingAccounts: [row.leafAccountId],
      ...(c.subCategory ? { subCategory: c.subCategory } : {}),
      ...(note ? { note } : {}),
    };
    const bucket = buckets[c.category];
    bucket.lines.push(lineItem);
    bucket.total += signedContribution;
  }

  for (const row of input.trialBalance) {
    if (row.currency === ccy) continue;
    if (!classMap.has(row.leafAccountId)) {
      classificationGaps.push({
        leafAccountId: row.leafAccountId,
        currency: row.currency,
        amountMinor: row.amountMinor,
      });
    }
  }

  const netInterestIncomeMinor =
    buckets["interest-income"].total - buckets["interest-expense"].total;
  const profitBeforeTaxMinor =
    netInterestIncomeMinor +
    buckets["fee-income"].total +
    buckets["trading-pnl"].total +
    buckets["other-income"].total -
    buckets["operating-expense"].total -
    buckets["other-expense"].total;

  const placeholders: string[] = [];
  if (classificationGaps.length > 0) {
    placeholders.push(
      `[citation: TBC — BA 610: ${classificationGaps.length} trial-balance rows have no line classification; pending Mira's WS-INSTRUMENT-ANALYSES SARB BA 610 published-schema mapping]`,
    );
  }
  placeholders.push(
    "[citation: TBC — exact SARB BA 610 line-numbering pending Mira's WS-INSTRUMENT-ANALYSES schema ingestion]",
  );
  placeholders.push(
    "[citation: TBC — income tax expense + profit-after-tax deferred; bottom line is profit-before-tax at v0 (Yael's CIT slice paused until commencement-of-trading per CLAUDE.md project_rules_bind_at_commencement)]",
  );

  const classificationsFingerprint = fingerprintClassifications(input.classifications);

  const section = (cat: Ba610LineCategory): Ba610LineCategorySection => ({
    category: cat,
    totalMinor: buckets[cat].total,
    lineItems: buckets[cat].lines,
  });

  return {
    meta: {
      form: "BA 120",
      formVersion: "v0.1-rehearsal",
      entity: input.entity,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      periodId: input.periodId,
      functionalCurrency: ccy,
      generatorVersion: "v0.1",
      ...(input.trialBalanceSnapshotEventId
        ? { trialBalanceSnapshotEventId: input.trialBalanceSnapshotEventId }
        : {}),
      classificationsFingerprint,
    },
    interestIncome: section("interest-income"),
    interestExpense: section("interest-expense"),
    netInterestIncomeMinor,
    feeIncome: section("fee-income"),
    tradingProfitLoss: section("trading-pnl"),
    operatingExpenses: section("operating-expense"),
    otherIncome: section("other-income"),
    otherExpenses: section("other-expense"),
    profitBeforeTaxMinor,
    classificationGaps,
    citations: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "WS-FINANCE-BA-RETURNS-QUINTET",
      "Banks Act 94 of 1990 §75",
      "Regulations Relating to Banks Reg 32",
      "IAS 1 §82–§87 — Statement of Comprehensive Income",
    ],
    placeholders,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signWarningForCategory(
  amountMinor: number,
  category: Ba610LineCategory,
): string | undefined {
  if (amountMinor === 0) return undefined;
  // income / fee-income / other-income : credit-typical (negative)
  // expense / operating-expense / other-expense : debit-typical (positive)
  // trading-pnl : signed; both directions valid (profit or loss).
  switch (category) {
    case "interest-income":
    case "fee-income":
    case "other-income":
      if (amountMinor > 0) {
        return `warning: ${category} account has a debit balance — sign convention violated (typical: credit)`;
      }
      return undefined;
    case "interest-expense":
    case "operating-expense":
    case "other-expense":
      if (amountMinor < 0) {
        return `warning: ${category} account has a credit balance — sign convention violated (typical: debit)`;
      }
      return undefined;
    case "trading-pnl":
      return undefined;
  }
}

function fingerprintClassifications(classifications: Ba610ClassificationMap): string {
  const sorted = [...classifications].sort((a, b) =>
    a.leafAccountId < b.leafAccountId ? -1 : a.leafAccountId > b.leafAccountId ? 1 : 0,
  );
  return JSON.stringify(sorted);
}
