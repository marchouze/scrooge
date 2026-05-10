// platform/reporting/ifrs-changes-in-equity.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 6 — IFRS Statement of
// Changes in Equity generator per IAS 1 §106.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 6.
//
// IAS 1 §106 requires reconciliation of opening to closing equity by
// component. Components per IAS 1 §108: share capital, retained earnings,
// each class of OCI reserve, other reserves.
//
// v0 rehearsal-grade: opening equity is supplied by the caller (defaults to
// zero — the build-phase posture for Hoz Bank pre-licence-day). Movement
// in retained earnings = period P&L; movement in OCI reserve = period OCI;
// movement in share capital = caller-supplied capital-raise/redemption
// activity (zero in build-phase).
//
// Per pack §6 Slice 6: per-entity (Hoz Bank only at v0).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; IFRS line-mapping owner) · Atlas (Core banking
//   platform architect, engineering — substrate consult).

import {
  IFRS_AFS_BASE_CITATIONS,
  IfrsGeneratorError,
  type IfrsGeneratorInput,
  type IfrsOpeningEquityComponents,
  type IfrsOutputMeta,
  assertIfrsBankEntity,
  assertIso4217,
  fingerprintIfrsClassifications,
  indexClassifications,
} from "./ifrs-types";

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export type EquityComponentKey =
  | "share-capital"
  | "retained-earnings"
  | "oci-reserve"
  | "other-reserves";

export interface EquityComponentMovement {
  readonly component: EquityComponentKey;
  readonly openingBalanceMinor: number;
  /** Total comprehensive income attribution (P&L for retained-earnings; OCI for oci-reserve; zero for others). */
  readonly comprehensiveIncomeMinor: number;
  /** Owner-transactions (capital raise / dividends / redemptions). v0 zero-default for build-phase. */
  readonly ownerTransactionsMinor: number;
  readonly closingBalanceMinor: number;
}

export interface IfrsChangesInEquityOutput {
  readonly meta: IfrsOutputMeta;
  readonly openingEquityTotalMinor: number;
  readonly profitOrLossMinor: number;
  readonly otherComprehensiveIncomeMinor: number;
  readonly totalComprehensiveIncomeMinor: number;
  readonly ownerTransactionsTotalMinor: number;
  readonly closingEquityTotalMinor: number;
  readonly components: readonly EquityComponentMovement[];
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

const ZERO_OPENING: IfrsOpeningEquityComponents = {
  shareCapitalMinor: 0,
  retainedEarningsMinor: 0,
  ociReserveMinor: 0,
  otherReservesMinor: 0,
};

/**
 * Generate the IFRS Statement of Changes in Equity. Pure function;
 * deterministic.
 *
 * Per IAS 1 §106(d): for each component of equity, present a
 * reconciliation between the carrying amount at the beginning and the end
 * of the period, separately disclosing changes resulting from (i) profit
 * or loss; (ii) other comprehensive income; (iii) transactions with owners
 * in their capacity as owners.
 *
 * v0 simplification: classifies the period P&L into retained earnings and
 * the period OCI into oci-reserve. Owner-transactions are zero unless the
 * caller supplies them via the optional `ownerTransactions` field on each
 * component (extension point for Slice 7+).
 */
export function generateIfrsChangesInEquity(input: IfrsGeneratorInput): IfrsChangesInEquityOutput {
  assertIfrsBankEntity(input.entity);
  assertIso4217(input.functionalCurrency, "functionalCurrency");
  if (input.comparativeAsOf !== undefined && input.comparativeAsOf >= input.asOf) {
    throw new IfrsGeneratorError(
      `IFRS Changes in Equity: comparativeAsOf (${input.comparativeAsOf}) must precede asOf (${input.asOf})`,
    );
  }
  const classMap = indexClassifications(input.classifications);
  const ccy = input.functionalCurrency;
  const placeholders: string[] = [];

  const opening = input.openingEquity ?? ZERO_OPENING;
  if (input.openingEquity === undefined) {
    placeholders.push(
      "[citation: TBC — SoCE opening equity not supplied; defaulting to zero (Hoz Bank build-phase posture per project_ai_driven_bank). Real opening balances populate at licence-day capital-call.]",
    );
  }

  // Period P&L = Σ income − Σ expense.
  let incomeTotal = 0;
  let expenseTotal = 0;
  let ociTotal = 0;
  for (const row of input.trialBalance) {
    if (row.currency !== ccy) continue;
    const c = classMap.get(row.leafAccountId);
    if (!c) continue;
    const stockMinor = Math.abs(row.amountMinor);
    if (c.accountClass === "income") incomeTotal += stockMinor;
    else if (c.accountClass === "expense") expenseTotal += stockMinor;
    else if (c.accountClass === "oci") ociTotal += stockMinor;
  }
  const plMinor = incomeTotal - expenseTotal;

  // Closing equity per the accounting equation: opening + TCI + owner-tx.
  // Build-phase: owner-tx = 0; the caller can extend at a later slice.

  const componentMap: Record<EquityComponentKey, EquityComponentMovement> = {
    "share-capital": {
      component: "share-capital",
      openingBalanceMinor: opening.shareCapitalMinor,
      comprehensiveIncomeMinor: 0,
      ownerTransactionsMinor: 0,
      closingBalanceMinor: opening.shareCapitalMinor,
    },
    "retained-earnings": {
      component: "retained-earnings",
      openingBalanceMinor: opening.retainedEarningsMinor,
      comprehensiveIncomeMinor: plMinor,
      ownerTransactionsMinor: 0,
      closingBalanceMinor: opening.retainedEarningsMinor + plMinor,
    },
    "oci-reserve": {
      component: "oci-reserve",
      openingBalanceMinor: opening.ociReserveMinor,
      comprehensiveIncomeMinor: ociTotal,
      ownerTransactionsMinor: 0,
      closingBalanceMinor: opening.ociReserveMinor + ociTotal,
    },
    "other-reserves": {
      component: "other-reserves",
      openingBalanceMinor: opening.otherReservesMinor,
      comprehensiveIncomeMinor: 0,
      ownerTransactionsMinor: 0,
      closingBalanceMinor: opening.otherReservesMinor,
    },
  };

  // Augment with any equity-classed accounts that signal additional
  // movement (build-phase: equity-classed credits in the trial balance
  // may indicate share-capital injection events; we surface them under
  // share-capital as owner transactions).
  for (const row of input.trialBalance) {
    if (row.currency !== ccy) continue;
    const c = classMap.get(row.leafAccountId);
    if (!c || c.accountClass !== "equity") continue;
    if (!c.equityComponent) {
      placeholders.push(
        `[citation: TBC — equity account '${row.leafAccountId}' has no equityComponent classification; movement not attributed to a SoCE component]`,
      );
      continue;
    }
    const stockMinor = Math.abs(row.amountMinor);
    if (c.equityComponent === "share-capital") {
      // Treat the trial-balance share-capital balance MINUS opening as an
      // owner transaction (capital raise). Build-phase rehearsal default.
      const ownerTx = stockMinor - opening.shareCapitalMinor;
      if (ownerTx !== 0) {
        const m = componentMap["share-capital"];
        componentMap["share-capital"] = {
          ...m,
          ownerTransactionsMinor: m.ownerTransactionsMinor + ownerTx,
          closingBalanceMinor: m.closingBalanceMinor + ownerTx,
        };
      }
    } else if (c.equityComponent === "retained-earnings") {
      // The retained-earnings TB balance reflects accumulated movement; we
      // do NOT double-count P&L. The TB balance MINUS (opening + plMinor)
      // is treated as an owner transaction (e.g. dividends declared).
      const ownerTx = stockMinor - opening.retainedEarningsMinor - plMinor;
      if (ownerTx !== 0) {
        const m = componentMap["retained-earnings"];
        componentMap["retained-earnings"] = {
          ...m,
          ownerTransactionsMinor: m.ownerTransactionsMinor + ownerTx,
          closingBalanceMinor: m.closingBalanceMinor + ownerTx,
        };
      }
    }
  }

  const components: EquityComponentMovement[] = [
    componentMap["share-capital"],
    componentMap["retained-earnings"],
    componentMap["oci-reserve"],
    componentMap["other-reserves"],
  ];

  const openingTotal =
    opening.shareCapitalMinor +
    opening.retainedEarningsMinor +
    opening.ociReserveMinor +
    opening.otherReservesMinor;
  const tciTotal = plMinor + ociTotal;
  const ownerTxTotal = components.reduce((acc, c) => acc + c.ownerTransactionsMinor, 0);
  const closingTotal = components.reduce((acc, c) => acc + c.closingBalanceMinor, 0);

  placeholders.push(
    "[citation: TBC — IAS 1 §108 individual reserve disclosure (revaluation reserve, FX-translation reserve, cash-flow-hedge reserve) — pending Camille's accounting-policy adoption]",
  );

  const meta: IfrsOutputMeta = {
    statement: "SoCE",
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
    openingEquityTotalMinor: openingTotal,
    profitOrLossMinor: plMinor,
    otherComprehensiveIncomeMinor: ociTotal,
    totalComprehensiveIncomeMinor: tciTotal,
    ownerTransactionsTotalMinor: ownerTxTotal,
    closingEquityTotalMinor: closingTotal,
    components,
    citations: [...IFRS_AFS_BASE_CITATIONS, "IAS 1 §106", "IAS 1 §108"],
    placeholders,
  };
}

export type {
  IfrsAccountClassification,
  IfrsGeneratorInput,
  IfrsOpeningEquityComponents,
} from "./ifrs-types";
