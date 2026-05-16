// platform/returns/ba700/generator.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 4 — BA 700 (Capital
// Adequacy Return) generator.  This module is the canonical entry point
// for the `returns/ba700/` package, mirroring the `returns/ba325/` pattern.
//
// The generator itself lives in `platform/reporting/ba-700-capital.ts` and
// `platform/reporting/ba-700-events-adapter.ts` (the P1-compliant
// events-first entry point).  This file:
//
//   1. Re-exports the public generator API from the canonical reporting
//      module so consumers import from one well-known location.
//   2. Provides the `BA700Return` typed alias that matches the mission
//      shape spec (`capitalAdequacy`, `balanceSheet`, `incomeStatement`,
//      `offBalanceSheet`, `status`).
//   3. Provides `generateBA700Return()` — a convenience wrapper that
//      queries `TrialBalanceSnapshotted` and `AccountingPeriodClosed` for
//      the period and delegates to the underlying generator.
//
// Design principle:
//   - All numeric fields use minor-unit integers (ISO 4217 convention used
//     throughout the BA 700 generator chain).
//   - `status` carries "compliant" | "breach" | "insufficient-data" so
//     downstream alerting has a typed signal without parsing the ratio.
//   - `carRatio` (Capital Adequacy Ratio) is the BCBS Total Capital Ratio
//     (= totalCapital / rwa), reported as a dimensionless fraction.
//
// Semantic cross-links (Principle 2 — single-graph discipline):
//   @platform/semantic `Balance` and `Exposure` semantic entries are
//   referenced here via their registry IDs and inform the field
//   descriptions.
//
// Citations:
//   - Banks Act 94 of 1990 §70
//   - Regulations Relating to Banks Reg 38
//   - BCBS Basel III §50–§90
//   - D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
//
// TODO: feed capitalAdequacy.tier1Capital from CapitalContributionRecorded
//       + SubLedgerPostingEmitted (CET1 + AT1 accounts classified per
//       AccountCapitalClassification map).
// TODO: feed capitalAdequacy.tier2Capital from SubLedgerPostingEmitted
//       (T2 accounts — subordinated debt + qualifying general provisions).
// TODO: feed capitalAdequacy.rwa from RwaComputed (W2 Slice 3 RWA engine).
// TODO: feed balanceSheet.totalAssets / totalLiabilities / equity from
//       TrialBalanceSnapshotted rows (Balance semantic entry, GL accounts).
// TODO: feed incomeStatement rows from TrialBalanceSnapshotted P&L accounts
//       (netInterestIncome, nonInterestIncome, operatingExpenses, netProfit).
// TODO: feed offBalanceSheet from OBS event types (guarantees, commitments,
//       derivative notional — Exposure semantic entry, BA 600 overlap).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Camille (Chief Financial Officer, governance — reports to CEO;
//   capital-stack accountable signer)
//   + Atlas (Core banking platform architect, engineering — generator input
//   contract for the W2 Slice 3 RWA-engine hand-off).

import type { TrialBalanceSnapshotRow } from "../../event-store/event-types";
import type { EventStore } from "../../event-store/store";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../../projections/filter";
import {
  BA_700_BANK_ENTITIES,
  BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS,
  Ba700GeneratorError,
  computeRequiredMinimums,
  generateBa700Capital,
} from "../../reporting/ba-700-capital";
import type {
  AccountCapitalClassification,
  Ba700Output,
  BufferRequirements,
  RegulatoryDeduction,
  RwaDecomposition,
} from "../../reporting/ba-700-capital";
import { generateBa700CapitalFromEvents } from "../../reporting/ba-700-events-adapter";

// Re-export for consumers that import from this package.
export {
  generateBa700Capital,
  generateBa700CapitalFromEvents,
  BA_700_BANK_ENTITIES,
  Ba700GeneratorError,
  BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS,
  computeRequiredMinimums,
};
export type {
  AccountCapitalClassification,
  Ba700Output,
  BufferRequirements,
  RegulatoryDeduction,
  RwaDecomposition,
};

// ---------------------------------------------------------------------------
// BA700Return — mission-spec typed output shape
// ---------------------------------------------------------------------------

/**
 * BA 700 Capital Adequacy return — mission-spec typed shape.
 *
 * This shape is intentionally simpler than `Ba700Output` (the full
 * generator output) — it exposes the four key sections required by the
 * mission spec in a flat, report-friendly form.  The full `Ba700Output`
 * is available from the underlying generator for audit/forensic use.
 *
 * Semantic cross-links (Principle 2):
 *   - `capitalAdequacy` ↔ SemanticEntry `CommonEquityTier1Capital`,
 *     `AdditionalTier1Capital`, `Tier2Capital`, `RiskWeightedAssets`,
 *     `TotalCapitalRatio` (all from `@platform/semantic` SLICE_4_CAPITAL_ENTRIES).
 *   - `balanceSheet` ↔ SemanticEntry `Balance` (SLICE_1_ENTRIES).
 *   - `offBalanceSheet` ↔ SemanticEntry `Exposure` (SLICE_1_ENTRIES).
 *
 * All money amounts are in the entity's functional-currency minor units
 * (e.g. ZAR cents).
 */
export interface BA700Return {
  readonly meta: {
    readonly form: "BA 700";
    readonly entity: string;
    readonly reportingDate: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
  };
  readonly capitalAdequacy: {
    /**
     * Net Tier 1 capital (CET1 + AT1 after deductions), in functional-currency
     * minor units.  Semantic ref: `CommonEquityTier1Capital` +
     * `AdditionalTier1Capital`.
     *
     * TODO: feed from SubLedgerPostingEmitted capital-classified accounts.
     */
    readonly tier1Capital: number;
    /**
     * Net Tier 2 capital after deductions, in functional-currency minor units.
     * Semantic ref: `Tier2Capital`.
     *
     * TODO: feed from SubLedgerPostingEmitted T2-classified accounts.
     */
    readonly tier2Capital: number;
    /**
     * Total Risk-Weighted Assets — credit + market + operational.
     * Semantic ref: `RiskWeightedAssets`.
     *
     * TODO: feed from RwaComputed event (W2 Slice 3 engine).
     */
    readonly rwa: number;
    /**
     * Total Capital Ratio = (Tier 1 + Tier 2) / RWA.  Dimensionless;
     * 0.12 = 12%.  Semantic ref: `TotalCapitalRatio`.
     */
    readonly carRatio: number;
  };
  readonly balanceSheet: {
    /**
     * Total balance-sheet assets, in functional-currency minor units.
     * Semantic ref: `Balance` (asset-side accounts).
     *
     * TODO: feed from TrialBalanceSnapshotted asset-account rows.
     */
    readonly totalAssets: number;
    /**
     * Total balance-sheet liabilities, in functional-currency minor units.
     * Semantic ref: `Balance` (liability-side accounts).
     *
     * TODO: feed from TrialBalanceSnapshotted liability-account rows.
     */
    readonly totalLiabilities: number;
    /**
     * Total equity (totalAssets - totalLiabilities).
     * Semantic ref: `Balance` (equity-side accounts).
     *
     * TODO: feed from TrialBalanceSnapshotted equity-account rows.
     */
    readonly equity: number;
  };
  readonly incomeStatement: {
    /**
     * Net interest income = interest received - interest paid.
     * Semantic ref: `Balance` (interest income / expense accounts).
     *
     * TODO: feed from TrialBalanceSnapshotted interest-income and
     *       interest-expense account rows.
     */
    readonly netInterestIncome: number;
    /**
     * Non-interest income (fees, commissions, trading gains).
     * Semantic ref: `Balance` (fee / trading income accounts).
     *
     * TODO: feed from TrialBalanceSnapshotted non-interest-income rows.
     */
    readonly nonInterestIncome: number;
    /**
     * Total operating expenses (staff, admin, depreciation).
     * Semantic ref: `Balance` (operating expense accounts).
     *
     * TODO: feed from TrialBalanceSnapshotted operating-expense rows.
     */
    readonly operatingExpenses: number;
    /**
     * Net profit = netInterestIncome + nonInterestIncome - operatingExpenses.
     * Semantic ref: `Balance` (P&L retained earnings contribution).
     *
     * TODO: feed from TrialBalanceSnapshotted P&L accounts.
     */
    readonly netProfit: number;
  };
  readonly offBalanceSheet: {
    /**
     * Guarantees issued — notional exposure.
     * Semantic ref: `Exposure` (guarantee kind).
     *
     * TODO: feed from guarantee-event types (off-balance-sheet substrate).
     */
    readonly guarantees: number;
    /**
     * Undrawn commitments — notional exposure.
     * Semantic ref: `Exposure` (commitment kind).
     *
     * TODO: feed from commitment-event types.
     */
    readonly commitments: number;
    /**
     * Derivatives — gross notional exposure (not CVA-adjusted).
     * Semantic ref: `Exposure` (derivative kind; CVA-adjusted BA 600).
     *
     * TODO: feed from FxSpotTraded / IrswapTraded notional accumulation.
     */
    readonly derivatives: number;
  };
  /**
   * "compliant"          — all three capital ratios ≥ their all-in
   *                        required minimums (base + buffers + Pillar 2A).
   * "breach"             — one or more ratio below the all-in required
   *                        minimum.
   * "insufficient-data"  — trial-balance or RWA inputs contain placeholder
   *                        zeros due to build-phase substrate gaps;
   *                        compliance verdict deferred.
   */
  readonly status: "compliant" | "breach" | "insufficient-data";
  /** Placeholder markers for build-phase cells not yet fed from primary events. */
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// generateBA700Return
// ---------------------------------------------------------------------------

/**
 * Input for `generateBA700Return`.
 *
 * The generator queries `TrialBalanceSnapshotted` (for the trial balance)
 * and `AccountingPeriodClosed` (for the period metadata) from the event
 * store and delegates to `generateBa700CapitalFromEvents`.
 *
 * v0 build-phase: capital-classification map, regulatory deductions, and
 * RWA decomposition are all caller-supplied (fixture-grade rehearsal).
 * Real inputs wire in as W2 Slice 3 (RWA engine) and Slice 6 (capital-
 * stack projection) land.
 */
export interface GenerateBA700ReturnInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). */
  readonly entityId: string;
  /** ISO 8601 — reporting-date (= period-end as-of). */
  readonly reportingDate: string;
  /** Period identifier (`period:hoz-bank:month:2026-05`). */
  readonly periodId: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;
  /** Event store — replayed for TrialBalanceSnapshotted + AccountingPeriodClosed. */
  readonly eventStore: EventStore;
  /**
   * ISO 8601 — start of the period window (for event replay).
   * Convention: AccountingPeriodOpened.periodStart.
   */
  readonly periodStart: string;
  /**
   * ISO 8601 — end of the period window (for event replay).
   * Convention: AccountingPeriodOpened.periodEnd (= reportingDate).
   */
  readonly periodEnd: string;
  /**
   * Per-account capital-tier classification.
   * TODO: derive from chart-of-accounts `capitalTier` field once
   * Mira's WS-INSTRUMENT-ANALYSES populates it.
   */
  readonly classifications: readonly AccountCapitalClassification[];
  /**
   * Regulatory deductions (CET1 / AT1 / T2).
   * Defaults to empty (gross = net) for build-phase rehearsal.
   */
  readonly deductions?: readonly RegulatoryDeduction[];
  /**
   * RWA decomposition — caller-supplied at v0.
   * TODO: wire from RwaComputed event (W2 Slice 3 engine).
   */
  readonly rwa: RwaDecomposition;
  /** Buffer requirements. Defaults to build-phase BCBS minimums + 2.5% CCB. */
  readonly bufferRequirements?: BufferRequirements;
}

/**
 * Generate the BA 700 return for (entityId, reportingDate).
 *
 * Queries the event store for:
 *   - `TrialBalanceSnapshotted` (kind: "close") to locate the trial-
 *     balance snapshot for the period.
 *   - `AccountingPeriodClosed` to confirm the period is closed.
 *
 * Then delegates to `generateBa700CapitalFromEvents` (P1-compliant
 * events-first entry point).
 *
 * Returns a `BA700Return` — the mission-spec typed shape — plus the
 * full `Ba700Output` for forensic / audit use.
 *
 * Principle 1 compliance:
 *   - Capital stock: folded from SubLedgerPostingEmitted +
 *     CapitalContributionRecorded events (via events-adapter).
 *   - RWA denominator: placeholder at v0 (caller-supplied fixture);
 *     events-first once RwaComputed lands.
 *   - Balance sheet / income statement / off-balance-sheet: placeholder
 *     zeros with TODO citations per mission-spec rehearsal-grade default.
 *
 * Semantic cross-links:
 *   `Balance` (urn:legal-entity:hoz:hoz-bank:v1) ↔ balanceSheet cells
 *   `Exposure` (urn:legal-entity:hoz:hoz-bank:v1) ↔ offBalanceSheet cells
 *
 * Citations:
 *   Banks Act 94 of 1990 §70
 *   Regulations Relating to Banks Reg 38
 *   BCBS Basel III §50–§90
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
 */
export function generateBA700Return(input: GenerateBA700ReturnInput): {
  readonly return: BA700Return;
  readonly rawOutput: Ba700Output;
} {
  const provenanceFilter = defaultProvenanceFilter();

  // -------------------------------------------------------------------------
  // Step 1: confirm AccountingPeriodClosed exists for (entity, periodId).
  // -------------------------------------------------------------------------
  let periodClosed = false;
  for (const ev of input.eventStore.replay({
    entity: input.entityId,
    type: "AccountingPeriodClosed",
    asOf: input.reportingDate,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as Record<string, unknown>;
    if (p.periodId === input.periodId) {
      periodClosed = true;
      break;
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: locate the TrialBalanceSnapshotted event for the period.
  // -------------------------------------------------------------------------
  let trialBalanceRows: readonly TrialBalanceSnapshotRow[] = [];
  for (const ev of input.eventStore.replay({
    entity: input.entityId,
    type: "TrialBalanceSnapshotted",
    asOf: input.reportingDate,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as Record<string, unknown>;
    if (p.periodId === input.periodId && p.snapshotKind === "close") {
      trialBalanceRows = (p.rows as TrialBalanceSnapshotRow[]) ?? [];
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: generate the capital-adequacy section via the events-first adapter.
  // -------------------------------------------------------------------------
  const rawOutput = generateBa700CapitalFromEvents(input.eventStore, {
    entity: input.entityId,
    asOf: input.reportingDate,
    periodId: input.periodId,
    functionalCurrency: input.functionalCurrency,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    classifications: input.classifications,
    deductions: input.deductions ?? [],
    rwa: input.rwa,
    bufferRequirements: input.bufferRequirements ?? BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS,
  });

  // -------------------------------------------------------------------------
  // Step 4: derive balance-sheet section from trial balance rows.
  // Build-phase: placeholder zeros; TODO markers cite feeding event types.
  // -------------------------------------------------------------------------
  const placeholders: string[] = [...rawOutput.placeholders];

  // Balance sheet — placeholder zeros: no account-to-IFRS-class mapping yet.
  // TODO: feed from TrialBalanceSnapshotted rows via chart-of-accounts IFRS mapping.
  const totalAssets = 0; // TODO: feed from Balance(asset-side accounts, AsOf=reportingDate)
  const totalLiabilities = 0; // TODO: feed from Balance(liability-side accounts)
  const equity = totalAssets - totalLiabilities; // TODO: feed from Balance(equity accounts)
  if (trialBalanceRows.length === 0 || !periodClosed) {
    placeholders.push(
      "[citation: TBC — balance-sheet section placeholder: TrialBalanceSnapshotted rows not yet mapped to IFRS asset/liability/equity lines; Mira's WS-INSTRUMENT-ANALYSES + chart-of-accounts IFRS-class field will resolve. Feed from Balance(entity=LE-ZA-HOZ-BANK) semantic entry once chart-of-accounts classification lands.]",
    );
  }

  // Income statement — placeholder zeros: no P&L account classification yet.
  // TODO: feed from TrialBalanceSnapshotted P&L account rows.
  const netInterestIncome = 0; // TODO: feed from TrialBalanceSnapshotted interest-income accounts
  const nonInterestIncome = 0; // TODO: feed from TrialBalanceSnapshotted fee / trading-gain accounts
  const operatingExpenses = 0; // TODO: feed from TrialBalanceSnapshotted operating-expense accounts
  const netProfit = netInterestIncome + nonInterestIncome - operatingExpenses; // TODO: from P&L accounts
  placeholders.push(
    "[citation: TBC — income-statement section placeholder: P&L accounts not yet classified in chart-of-accounts; feed from SubLedgerPostingEmitted income/expense accounts. Balance semantic entry + IFRS-classification-entries (netInterestIncome, nonInterestIncome, operatingExpenses).]",
  );

  // Off-balance-sheet — placeholder zeros: no OBS event types yet.
  // TODO: feed from guarantee / commitment / derivative notional events.
  const guarantees = 0; // TODO: feed from guarantee-event types (Exposure semantic entry)
  const commitments = 0; // TODO: feed from undrawn-commitment events
  const derivatives = 0; // TODO: feed from FxSpotTraded / IrswapTraded notional accumulation
  placeholders.push(
    "[citation: TBC — off-balance-sheet section placeholder: OBS event types not yet landed; Exposure semantic entry (urn:legal-entity:hoz:hoz-bank:v1) drives guarantee/commitment/derivative lines. Wires when OBS substrate merges.]",
  );

  // -------------------------------------------------------------------------
  // Step 5: derive status.
  // -------------------------------------------------------------------------
  const allPlaceholderZeros =
    totalAssets === 0 && totalLiabilities === 0 && equity === 0 && netProfit === 0;
  let status: "compliant" | "breach" | "insufficient-data";
  if (allPlaceholderZeros && rawOutput.rwa.source === "fixture-rehearsal") {
    status = "insufficient-data";
  } else if (
    rawOutput.ratios.cet1Compliant &&
    rawOutput.ratios.tier1Compliant &&
    rawOutput.ratios.totalCompliant
  ) {
    status = "compliant";
  } else {
    status = "breach";
  }

  const capitalAdequacy = {
    tier1Capital: rawOutput.capitalStack.netTier1Minor,
    tier2Capital: rawOutput.capitalStack.t2.netStockMinor,
    rwa: rawOutput.rwa.totalRwaMinor,
    carRatio: rawOutput.ratios.totalRatio,
  };

  const ba700Return: BA700Return = {
    meta: {
      form: "BA 700",
      entity: input.entityId,
      reportingDate: input.reportingDate,
      periodId: input.periodId,
      functionalCurrency: input.functionalCurrency,
    },
    capitalAdequacy,
    balanceSheet: { totalAssets, totalLiabilities, equity },
    incomeStatement: { netInterestIncome, nonInterestIncome, operatingExpenses, netProfit },
    offBalanceSheet: { guarantees, commitments, derivatives },
    status,
    placeholders,
  };

  return { return: ba700Return, rawOutput };
}
