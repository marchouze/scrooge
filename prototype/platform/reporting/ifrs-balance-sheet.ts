// platform/reporting/ifrs-balance-sheet.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 6 — IFRS Statement of
// Financial Position (Balance Sheet) generator per IAS 1 §54.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 6.
//
// Pipeline (mirrors BA 700 Slice 4 architecture):
//
//   EVENT LOG (P1) → PROJECTION RUNTIME → PERIOD CLOSE (Slice 2)
//      → SEMANTIC LAYER (Slice 6 IFRS entries)
//      → THIS GENERATOR
//      → ifrs-render.ts (JSON renderer)
//
// Computes per IAS 1 §54:
//   totalAssets       = Σ |amount| over rows classified as 'asset'
//   totalLiabilities  = Σ |amount| over rows classified as 'liability'
//   totalEquity       = totalAssets − totalLiabilities (the accounting equation)
//
// Per Marc's Q1 (rehearsal-grade with placeholders): the line decomposition
// uses the supplied `lineLabel` from each classification; missing labels
// surface as `unclassified` lines flagged with `[citation: TBC]` markers.
//
// Per pack §6 Slice 6: per-entity (Hoz Bank only at v0); consolidated
// (Hoz Group via IFRS 10 elimination) is downstream.
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

export interface IfrsBalanceSheetSection {
  readonly totalMinor: number;
  readonly comparativeTotalMinor: number | null;
  readonly lineItems: readonly IfrsLineItem[];
}

export interface IfrsBalanceSheetOutput {
  readonly meta: IfrsOutputMeta;
  readonly assets: IfrsBalanceSheetSection;
  readonly liabilities: IfrsBalanceSheetSection;
  readonly equity: IfrsBalanceSheetSection;
  readonly accountingEquationCheck: {
    readonly totalAssetsMinor: number;
    readonly totalLiabilitiesPlusEquityMinor: number;
    readonly differenceMinor: number;
    readonly balanced: boolean;
  };
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the IFRS Statement of Financial Position from a trial balance +
 * IFRS classification map. Pure function; deterministic.
 *
 * Sign convention: trial-balance rows carry signed amounts (positive = debit
 * = asset/expense; negative = credit = liability/equity/income/oci). The
 * generator takes absolute value for stock-line presentation and flags rows
 * whose sign violates the class convention with a warning note.
 *
 * The accounting-equation check (assets ≡ liabilities + equity) is by
 * construction since equity is computed as assets − liabilities; the check
 * field exists for forensic-transparency reporting and downstream recon
 * harnesses.
 */
export function generateIfrsBalanceSheet(input: IfrsGeneratorInput): IfrsBalanceSheetOutput {
  assertIfrsBankEntity(input.entity);
  assertIso4217(input.functionalCurrency, "functionalCurrency");
  if (input.comparativeAsOf !== undefined) {
    if (input.comparativeAsOf >= input.asOf) {
      throw new IfrsGeneratorError(
        `IFRS Balance Sheet: comparativeAsOf (${input.comparativeAsOf}) must precede asOf (${input.asOf})`,
      );
    }
  }
  const classMap = indexClassifications(input.classifications);
  const ccy = input.functionalCurrency;

  // Build comparative-amount lookup: account → comparative absolute amount.
  const comparativeByAccount = new Map<string, number>();
  if (input.comparativeTrialBalance) {
    for (const row of input.comparativeTrialBalance) {
      if (row.currency !== ccy) continue;
      comparativeByAccount.set(row.leafAccountId, Math.abs(row.amountMinor));
    }
  }

  const placeholders: string[] = [];

  function buildSection(
    accountClass: "asset" | "liability",
    expectSign: "debit" | "credit",
  ): IfrsBalanceSheetSection {
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
          `[citation: TBC — ${accountClass} account '${row.leafAccountId}' has no IFRS line-label; pending Camille's accounting-policy adoption per Owner Inbox/2026-05-06_core-policies-finance.md]`,
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

  const assets = buildSection("asset", "debit");
  const liabilities = buildSection("liability", "credit");

  // Equity: derived as totalAssets − totalLiabilities by the accounting
  // equation; per-component decomposition (share capital, retained
  // earnings, OCI reserve, other reserves) is taken from the equity
  // classifications when present, with a residual line capturing any
  // imbalance between the equity classifications and the derived total.
  const equityRows = filterByClass(input.trialBalance, classMap, "equity", ccy);
  const equityLineItems: IfrsLineItem[] = [];
  let equityClassifiedTotal = 0;
  let equityComparativeTotal = 0;
  let equityComparativeAvailable = false;

  for (const { row, classification } of equityRows) {
    const stockMinor = Math.abs(row.amountMinor);
    const note = signWarning(row.amountMinor, "credit");
    const compAmount = comparativeByAccount.get(row.leafAccountId) ?? null;
    if (compAmount !== null) {
      equityComparativeTotal += compAmount;
      equityComparativeAvailable = true;
    }
    const lineLabel =
      classification.lineLabel ??
      classification.equityComponent ??
      `unclassified-${row.leafAccountId}`;
    equityLineItems.push({
      lineId: `equity.${classification.equityComponent ?? "unspecified"}.${row.leafAccountId}`,
      lineLabel,
      amountMinor: stockMinor,
      comparativeAmountMinor: compAmount,
      currency: ccy,
      contributingAccounts: [row.leafAccountId],
      ...(note ? { note } : {}),
    });
    equityClassifiedTotal += stockMinor;
  }

  const derivedEquityTotal = assets.totalMinor - liabilities.totalMinor;
  const residualMinor = derivedEquityTotal - equityClassifiedTotal;
  if (residualMinor !== 0) {
    equityLineItems.push({
      lineId: "equity.derivation-residual",
      lineLabel: "Derivation residual (assets − liabilities − classified equity)",
      amountMinor: residualMinor,
      comparativeAmountMinor: null,
      currency: ccy,
      contributingAccounts: [],
      note: "Residual line — equity classifications did not sum to (assets − liabilities); flag for Bea's accounting-policy review.",
    });
    placeholders.push(
      `[citation: TBC — Balance Sheet: equity classifications sum (${equityClassifiedTotal}) ≠ assets − liabilities (${derivedEquityTotal}); residual ${residualMinor} surfaced as a derivation-residual line]`,
    );
  }

  const equity: IfrsBalanceSheetSection = {
    totalMinor: derivedEquityTotal,
    comparativeTotalMinor:
      input.comparativeTrialBalance && equityComparativeAvailable ? equityComparativeTotal : null,
    lineItems: equityLineItems,
  };

  const totalLiabsPlusEquity = liabilities.totalMinor + equity.totalMinor;
  const accountingEquationCheck = {
    totalAssetsMinor: assets.totalMinor,
    totalLiabilitiesPlusEquityMinor: totalLiabsPlusEquity,
    differenceMinor: assets.totalMinor - totalLiabsPlusEquity,
    balanced: assets.totalMinor === totalLiabsPlusEquity,
  };

  if (input.classifications.length === 0) {
    placeholders.push(
      "[citation: TBC — IFRS Balance Sheet generated with no classifications; build-phase rehearsal posture per pack §6 Slice 6]",
    );
  }
  placeholders.push(
    "[citation: TBC — IAS 1 §60 current/non-current classification pending chart-of-accounts maturity-bucket field — Mira's WS-INSTRUMENT-ANALYSES]",
  );

  const meta: IfrsOutputMeta = {
    statement: "SoFP",
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
    assets,
    liabilities,
    equity,
    accountingEquationCheck,
    citations: [...IFRS_AFS_BASE_CITATIONS, "IAS 1 §54", "IAS 1 §60"],
    placeholders,
  };
}

function signWarning(amountMinor: number, expectSign: "debit" | "credit"): string | undefined {
  // Trial-balance convention: positive = debit, negative = credit. Zero
  // amounts are dropped upstream so we treat them as conformant.
  if (amountMinor === 0) return undefined;
  if (expectSign === "debit" && amountMinor < 0) {
    return "warning: account expected to carry a debit balance has a credit balance";
  }
  if (expectSign === "credit" && amountMinor > 0) {
    return "warning: account expected to carry a credit balance has a debit balance";
  }
  return undefined;
}

// Re-export the classification helpers — generators in this slice share
// them via this module so consumers only need one import path.
export type {
  IfrsAccountClassification,
  IfrsGeneratorInput,
  IfrsOpeningEquityComponents,
} from "./ifrs-types";
export { IFRS_BANK_ENTITIES, IfrsGeneratorError } from "./ifrs-types";
