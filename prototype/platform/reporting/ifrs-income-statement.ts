// platform/reporting/ifrs-income-statement.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 6 — IFRS Statement of
// Profit or Loss and Other Comprehensive Income generator per IAS 1 §82.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 6.
//
// Computes per IAS 1 §82:
//   totalIncome    = Σ |amount| over rows classified as 'income'
//   totalExpense   = Σ |amount| over rows classified as 'expense'
//   profitOrLoss   = totalIncome − totalExpense (single-statement form)
//   totalOci       = Σ |amount| over rows classified as 'oci'
//   totalCompInc   = profitOrLoss + totalOci
//
// Per Marc's Q1 (rehearsal-grade with placeholders): single-statement form
// of IAS 1 §10A; tax line is a placeholder pending Yael's tax engine
// (per pack §8.2). Build-phase Hoz Bank holds no FVOCI positions so OCI
// generally renders as zero.
//
// Per pack §6 Slice 6: per-entity (Hoz Bank only at v0); consolidated
// is downstream.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; IFRS line-mapping owner) · Atlas (Core banking
//   platform architect, engineering — substrate consult).

import {
  IFRS_AFS_BASE_CITATIONS,
  IfrsGeneratorError,
  type IfrsGeneratorInput,
  type IfrsLineItem,
  type IfrsOutputMeta,
  assertIfrsBankEntity,
  assertIso4217,
  filterByClass,
  fingerprintIfrsClassifications,
  indexClassifications,
} from "./ifrs-types";

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface IfrsIncomeSection {
  readonly totalMinor: number;
  readonly comparativeTotalMinor: number | null;
  readonly lineItems: readonly IfrsLineItem[];
}

export interface IfrsIncomeStatementOutput {
  readonly meta: IfrsOutputMeta;
  readonly income: IfrsIncomeSection;
  readonly expense: IfrsIncomeSection;
  readonly profitOrLoss: {
    readonly amountMinor: number;
    readonly comparativeAmountMinor: number | null;
  };
  readonly otherComprehensiveIncome: IfrsIncomeSection;
  readonly totalComprehensiveIncome: {
    readonly amountMinor: number;
    readonly comparativeAmountMinor: number | null;
  };
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the IFRS Statement of Profit or Loss and Other Comprehensive
 * Income from a trial balance + IFRS classification map. Pure function;
 * deterministic.
 *
 * Single-statement form (IAS 1 §10A) — P&L and OCI in one statement.
 * Two-statement form is a Camille accounting-policy adoption choice
 * deferred to a downstream policy slice.
 */
export function generateIfrsIncomeStatement(input: IfrsGeneratorInput): IfrsIncomeStatementOutput {
  assertIfrsBankEntity(input.entity);
  assertIso4217(input.functionalCurrency, "functionalCurrency");
  if (input.comparativeAsOf !== undefined && input.comparativeAsOf >= input.asOf) {
    throw new IfrsGeneratorError(
      `IFRS Income Statement: comparativeAsOf (${input.comparativeAsOf}) must precede asOf (${input.asOf})`,
    );
  }
  const classMap = indexClassifications(input.classifications);
  const ccy = input.functionalCurrency;

  const comparativeByAccount = new Map<string, number>();
  if (input.comparativeTrialBalance) {
    for (const row of input.comparativeTrialBalance) {
      if (row.currency !== ccy) continue;
      comparativeByAccount.set(row.leafAccountId, Math.abs(row.amountMinor));
    }
  }

  const placeholders: string[] = [];

  function buildSection(
    accountClass: "income" | "expense" | "oci",
    expectSign: "debit" | "credit",
  ): IfrsIncomeSection {
    const filtered = filterByClass(input.trialBalance, classMap, accountClass, ccy);
    const lineItems: IfrsLineItem[] = [];
    let totalMinor = 0;
    let comparativeTotal = 0;
    let comparativeAvailable = false;

    for (const { row, classification } of filtered) {
      const stockMinor = Math.abs(row.amountMinor);
      const note = signWarning(row.amountMinor, expectSign);
      const compAmount = comparativeByAccount.get(row.leafAccountId) ?? null;
      if (compAmount !== null) {
        comparativeTotal += compAmount;
        comparativeAvailable = true;
      }
      const lineLabel = classification.lineLabel ?? `unclassified-${row.leafAccountId}`;
      if (!classification.lineLabel) {
        placeholders.push(
          `[citation: TBC — ${accountClass} account '${row.leafAccountId}' has no IFRS line-label; pending Camille's accounting-policy adoption]`,
        );
      }
      lineItems.push({
        lineId: `${accountClass}.${row.leafAccountId}`,
        lineLabel,
        amountMinor: stockMinor,
        comparativeAmountMinor: compAmount,
        currency: ccy,
        contributingAccounts: [row.leafAccountId],
        ...(note ? { note } : {}),
      });
      totalMinor += stockMinor;
    }

    return {
      totalMinor,
      comparativeTotalMinor:
        input.comparativeTrialBalance && comparativeAvailable ? comparativeTotal : null,
      lineItems,
    };
  }

  const income = buildSection("income", "credit");
  const expense = buildSection("expense", "debit");
  const oci = buildSection("oci", "credit");

  const plMinor = income.totalMinor - expense.totalMinor;
  const plComparative =
    income.comparativeTotalMinor !== null && expense.comparativeTotalMinor !== null
      ? income.comparativeTotalMinor - expense.comparativeTotalMinor
      : null;

  const tciMinor = plMinor + oci.totalMinor;
  const tciComparative =
    plComparative !== null && oci.comparativeTotalMinor !== null
      ? plComparative + oci.comparativeTotalMinor
      : null;

  placeholders.push(
    "[citation: TBC — Income tax expense per IAS 12; pending Yael's tax engine landing per pack §8.2]",
  );
  placeholders.push(
    "[citation: TBC — IAS 1 §99 income/expense classification by nature vs by function; pending Camille's accounting-policy adoption]",
  );

  const meta: IfrsOutputMeta = {
    statement: "P&L",
    statementVersion: "v0.1-rehearsal",
    entity: input.entity,
    asOf: input.asOf,
    periodId: input.periodId,
    functionalCurrency: ccy,
    generatorVersion: "v0.1",
    ...(input.comparativeAsOf ? { comparativeAsOf: input.comparativeAsOf } : {}),
    ...(input.trialBalanceSnapshotEventId
      ? { trialBalanceSnapshotEventId: input.trialBalanceSnapshotEventId }
      : {}),
    classificationsFingerprint: fingerprintIfrsClassifications(input.classifications),
  };

  return {
    meta,
    income,
    expense,
    profitOrLoss: { amountMinor: plMinor, comparativeAmountMinor: plComparative },
    otherComprehensiveIncome: oci,
    totalComprehensiveIncome: { amountMinor: tciMinor, comparativeAmountMinor: tciComparative },
    citations: [...IFRS_AFS_BASE_CITATIONS, "IAS 1 §82", "IAS 1 §82A", "IAS 1 §10A"],
    placeholders,
  };
}

function signWarning(amountMinor: number, expectSign: "debit" | "credit"): string | undefined {
  if (amountMinor === 0) return undefined;
  if (expectSign === "debit" && amountMinor < 0) {
    return "warning: account expected to carry a debit balance has a credit balance";
  }
  if (expectSign === "credit" && amountMinor > 0) {
    return "warning: account expected to carry a credit balance has a debit balance";
  }
  return undefined;
}

export type { IfrsAccountClassification, IfrsGeneratorInput } from "./ifrs-types";
