// platform/reporting/ifrs-cash-flow.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 6 — IFRS Statement of Cash
// Flows generator per IAS 7 (indirect method per IAS 7 §18(b)).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 6.
//
// Per Marc's Q1 (rehearsal-grade with placeholders): indirect-method
// derivation. v0 derives operating cash flow from period P&L plus working-
// capital movements (change in current assets/liabilities); investing and
// financing cash flow from movements in investing-classed and financing-
// classed accounts respectively. Bank-specific classification of interest
// received/paid + dividend received per IAS 7 §31–§34 is a Camille
// accounting-policy adoption choice deferred — interest treated as
// operating at v0 (the most common bank convention).
//
// Per pack §6 Slice 6: per-entity (Hoz Bank only at v0).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; IFRS line-mapping owner) · Atlas (Core banking
//   platform architect, engineering — substrate consult).

import {
  IFRS_AFS_BASE_CITATIONS,
  type IfrsAccountClassification,
  type IfrsCashFlowClass,
  IfrsGeneratorError,
  type IfrsGeneratorInput,
  type IfrsLineItem,
  type IfrsOutputMeta,
  assertIfrsBankEntity,
  assertIso4217,
  fingerprintIfrsClassifications,
  indexClassifications,
} from "./ifrs-types";

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface IfrsCashFlowSection {
  readonly netCashMinor: number;
  readonly comparativeNetCashMinor: number | null;
  readonly lineItems: readonly IfrsLineItem[];
}

export interface IfrsCashFlowOutput {
  readonly meta: IfrsOutputMeta;
  readonly profitOrLossStartingPoint: {
    readonly amountMinor: number;
    readonly comparativeAmountMinor: number | null;
  };
  readonly operating: IfrsCashFlowSection;
  readonly investing: IfrsCashFlowSection;
  readonly financing: IfrsCashFlowSection;
  readonly netChangeInCash: {
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
 * Generate the IFRS Statement of Cash Flows from a trial balance + IFRS
 * classification map (with cashFlowClass annotations per leaf account) +
 * comparative trial balance (when supplied) for working-capital movements.
 *
 * Indirect method per IAS 7 §18(b): operating cash flow starts from period
 * P&L (income − expense) and adjusts for working-capital movements
 * computed as comparative-to-current changes on operating-classed
 * asset/liability accounts. v0 rehearsal-grade — when no comparative is
 * supplied, working-capital movements render as zero with a placeholder
 * marker.
 *
 * Investing / financing cash flow: net of period movements on accounts
 * classified `investing` / `financing` per IAS 7 §16 / §17. v0 derives
 * change as (current period − comparative period); when no comparative is
 * supplied, falls back to period current balance as a build-phase
 * approximation (flagged with a placeholder).
 *
 * The generator is pure / deterministic.
 */
export function generateIfrsCashFlow(input: IfrsGeneratorInput): IfrsCashFlowOutput {
  assertIfrsBankEntity(input.entity);
  assertIso4217(input.functionalCurrency, "functionalCurrency");
  if (input.comparativeAsOf !== undefined && input.comparativeAsOf >= input.asOf) {
    throw new IfrsGeneratorError(
      `IFRS Cash Flow: comparativeAsOf (${input.comparativeAsOf}) must precede asOf (${input.asOf})`,
    );
  }
  const classMap = indexClassifications(input.classifications);
  const ccy = input.functionalCurrency;
  const placeholders: string[] = [];
  const hasComparative = input.comparativeTrialBalance !== undefined;

  // Comparative-amount lookup: account → signed comparative amountMinor.
  const comparativeByAccount = new Map<string, number>();
  if (input.comparativeTrialBalance) {
    for (const row of input.comparativeTrialBalance) {
      if (row.currency !== ccy) continue;
      comparativeByAccount.set(row.leafAccountId, row.amountMinor);
    }
  } else {
    placeholders.push(
      "[citation: TBC — Cash Flow generated without comparative period; movements are absolute current-period values rather than period-on-period change. Camille's accounting-policy adoption defines comparative-period requirements.]",
    );
  }

  // Compute period P&L (the indirect-method starting point).
  let incomeTotal = 0;
  let expenseTotal = 0;
  let incomeComparative = 0;
  let expenseComparative = 0;
  for (const row of input.trialBalance) {
    if (row.currency !== ccy) continue;
    const c = classMap.get(row.leafAccountId);
    if (!c) continue;
    const stockMinor = Math.abs(row.amountMinor);
    if (c.accountClass === "income") incomeTotal += stockMinor;
    else if (c.accountClass === "expense") expenseTotal += stockMinor;
  }
  if (input.comparativeTrialBalance) {
    for (const row of input.comparativeTrialBalance) {
      if (row.currency !== ccy) continue;
      const c = classMap.get(row.leafAccountId);
      if (!c) continue;
      const stockMinor = Math.abs(row.amountMinor);
      if (c.accountClass === "income") incomeComparative += stockMinor;
      else if (c.accountClass === "expense") expenseComparative += stockMinor;
    }
  }
  const plMinor = incomeTotal - expenseTotal;
  const plComparative = hasComparative ? incomeComparative - expenseComparative : null;

  // Bucket operating/investing/financing accounts. Working-capital
  // movements: change in current-period absolute balance vs comparative.
  // v0 simplification: each cashFlowClass-tagged account contributes
  // (current_signed_amount − comparative_signed_amount) as the cash effect.
  // For asset accounts, an increase consumes cash; for liability accounts,
  // an increase generates cash. Sign-convention helper handles the flip.
  function cashFlowEffectOfDelta(
    classification: IfrsAccountClassification,
    deltaMinor: number,
  ): number {
    // For an asset (debit-side): increase in balance → cash outflow.
    // For a liability/equity (credit-side, stored negative): increase in
    // |credit balance| → cash inflow. The trial-balance sign convention
    // means: signed delta negative for an asset that grew (became more
    // debit) flips to positive cash outflow only when class is asset.
    // Simpler form: cash effect = -delta_for_asset, +(-delta) for liab.
    switch (classification.accountClass) {
      case "asset":
        // Asset balance increased → cash decreased.
        // signed delta positive (became more debit) → cash effect negative.
        return -deltaMinor;
      case "liability":
      case "equity":
        // Stored as negative for credits. Increase in credit balance ⇒
        // signed delta becomes more negative ⇒ delta < 0 ⇒ cash effect positive.
        // Therefore cash effect = -delta also (same formula).
        return -deltaMinor;
      default:
        // Income/expense/oci threaded through P&L in indirect method;
        // direct cash effect is handled by the P&L starting point + non-
        // cash adjustments.
        return 0;
    }
  }

  // Account universe: union of (current trial balance accounts) +
  // (comparative trial balance accounts). Both directions of movement
  // matter.
  const universe = new Map<string, { current: number; comparative: number | null }>();
  for (const row of input.trialBalance) {
    if (row.currency !== ccy) continue;
    universe.set(row.leafAccountId, { current: row.amountMinor, comparative: null });
  }
  if (input.comparativeTrialBalance) {
    for (const row of input.comparativeTrialBalance) {
      if (row.currency !== ccy) continue;
      const existing = universe.get(row.leafAccountId);
      if (existing) {
        existing.comparative = row.amountMinor;
      } else {
        universe.set(row.leafAccountId, { current: 0, comparative: row.amountMinor });
      }
    }
  }

  // Stable iteration.
  const accounts = [...universe.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));

  function buildSection(target: IfrsCashFlowClass): IfrsCashFlowSection {
    const lineItems: IfrsLineItem[] = [];
    let netCashMinor = 0;
    let comparativeAvailable = false;

    for (const [accountId, balances] of accounts) {
      const c = classMap.get(accountId);
      if (!c) continue;
      // Income/expense/oci don't carry cashFlowClass — skip.
      if (c.accountClass === "income" || c.accountClass === "expense" || c.accountClass === "oci") {
        continue;
      }
      const cashFlowClass = c.cashFlowClass;
      if (!cashFlowClass) {
        // Account has no cashFlowClass — skip the line; placeholder added below
        // by the section caller (the operating section already surfaces these).
        continue;
      }
      if (cashFlowClass !== target) continue;

      const compAmount = balances.comparative;
      const deltaSigned = balances.current - (compAmount ?? 0);
      // For the no-comparative fallback, use current-period signed
      // balance as the "delta from zero" proxy (already flagged by the
      // hasComparative placeholder at the top of the generator).
      const cashEffect = hasComparative
        ? cashFlowEffectOfDelta(c, deltaSigned)
        : cashFlowEffectOfDelta(c, balances.current);

      if (cashEffect === 0) continue;
      const lineLabel = c.lineLabel ?? `unclassified-${accountId}`;
      if (!c.lineLabel) {
        placeholders.push(
          `[citation: TBC — Cash Flow account '${accountId}' (${cashFlowClass}) has no IFRS line-label; pending Camille's accounting-policy adoption]`,
        );
      }
      lineItems.push({
        lineId: `${cashFlowClass}.${accountId}`,
        lineLabel,
        amountMinor: cashEffect,
        comparativeAmountMinor: compAmount,
        currency: ccy,
        contributingAccounts: [accountId],
      });
      netCashMinor += cashEffect;
      if (compAmount !== null) comparativeAvailable = true;
    }
    return {
      netCashMinor,
      // Comparative-net cash flow is not derived at v0 — needs a pre-prior
      // period to compute deltas-of-deltas. Render as null when no real
      // comparative is computable; otherwise leave at zero for the
      // structural placeholder (downstream slices can extend).
      comparativeNetCashMinor: hasComparative && comparativeAvailable ? 0 : null,
      lineItems,
    };
  }

  const operating = buildOperatingSection(
    input,
    classMap,
    ccy,
    plMinor,
    plComparative,
    accounts,
    cashFlowEffectOfDelta,
    hasComparative,
    placeholders,
  );
  const investing = buildSection("investing");
  const financing = buildSection("financing");

  const netChange = operating.netCashMinor + investing.netCashMinor + financing.netCashMinor;
  const netChangeComparative =
    operating.comparativeNetCashMinor !== null &&
    investing.comparativeNetCashMinor !== null &&
    financing.comparativeNetCashMinor !== null
      ? operating.comparativeNetCashMinor +
        investing.comparativeNetCashMinor +
        financing.comparativeNetCashMinor
      : null;

  placeholders.push(
    "[citation: TBC — IAS 7 §31–§34 bank-specific classification of interest received/paid + dividend received pending Camille's accounting-policy adoption]",
  );

  const meta: IfrsOutputMeta = {
    statement: "SCF",
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
    profitOrLossStartingPoint: {
      amountMinor: plMinor,
      comparativeAmountMinor: plComparative,
    },
    operating,
    investing,
    financing,
    netChangeInCash: { amountMinor: netChange, comparativeAmountMinor: netChangeComparative },
    citations: [...IFRS_AFS_BASE_CITATIONS, "IAS 7 §10", "IAS 7 §16", "IAS 7 §17", "IAS 7 §18(b)"],
    placeholders,
  };
}

/**
 * Operating section uses the indirect method: starts from P&L and adjusts
 * for working-capital movements (changes in operating-classed asset and
 * liability accounts). v0 rehearsal-grade: each `operating`-tagged
 * non-income/expense account contributes its working-capital effect (the
 * delta or current-period proxy when no comparative).
 */
function buildOperatingSection(
  _input: IfrsGeneratorInput,
  classMap: Map<string, IfrsAccountClassification>,
  ccy: string,
  plMinor: number,
  plComparative: number | null,
  accounts: ReadonlyArray<readonly [string, { current: number; comparative: number | null }]>,
  cashFlowEffectOfDelta: (classification: IfrsAccountClassification, deltaMinor: number) => number,
  hasComparative: boolean,
  placeholders: string[],
): IfrsCashFlowSection {
  const lineItems: IfrsLineItem[] = [
    {
      lineId: "operating.starting-point.profit-or-loss",
      lineLabel: "Profit (loss) for the period — indirect-method starting point",
      amountMinor: plMinor,
      comparativeAmountMinor: plComparative,
      currency: ccy,
      contributingAccounts: [],
      note: "IAS 7 §18(b) — operating cash flow derived indirectly from P&L.",
    },
  ];
  let netCashMinor = plMinor;
  let comparativeAvailable = plComparative !== null;

  for (const [accountId, balances] of accounts) {
    const c = classMap.get(accountId);
    if (!c) continue;
    if (c.accountClass === "income" || c.accountClass === "expense" || c.accountClass === "oci") {
      continue;
    }
    if (c.cashFlowClass !== "operating") continue;

    const compAmount = balances.comparative;
    const deltaSigned = balances.current - (compAmount ?? 0);
    const cashEffect = hasComparative
      ? cashFlowEffectOfDelta(c, deltaSigned)
      : cashFlowEffectOfDelta(c, balances.current);

    if (cashEffect === 0) continue;
    const lineLabel = c.lineLabel
      ? `Working-capital movement — ${c.lineLabel}`
      : `Working-capital movement — unclassified-${accountId}`;
    if (!c.lineLabel) {
      placeholders.push(
        `[citation: TBC — Operating-cash-flow account '${accountId}' has no IFRS line-label]`,
      );
    }
    lineItems.push({
      lineId: `operating.working-capital.${accountId}`,
      lineLabel,
      amountMinor: cashEffect,
      comparativeAmountMinor: compAmount,
      currency: ccy,
      contributingAccounts: [accountId],
    });
    netCashMinor += cashEffect;
    if (compAmount !== null) comparativeAvailable = true;
  }

  return {
    netCashMinor,
    comparativeNetCashMinor: hasComparative && comparativeAvailable ? (plComparative ?? 0) : null,
    lineItems,
  };
}

export type { IfrsAccountClassification, IfrsGeneratorInput } from "./ifrs-types";
