// platform/reporting/ba-400-sma-income-adapter.ts
//
// Derives the BA 400 SMA income-statement inputs from
// OperatingIncomeStatementSnapshotted events (the born-V2 income-statement
// snapshot). Fills the `Ba400SmaInput` component fields which were previously
// unavailable (no producer stream existed — the legacy BIA/TSA engine's
// `OpRiskGrossIncomeRow[]` input had no event source, so op-capital folded to
// honest-0).
//
// Design (mirrors ba-320-equity-events-adapter.ts):
//   OperatingIncomeStatementSnapshotted events ≤ periodEnd
//     → take the LATEST snapshot (by as_of, then sequence) per entity
//     → project its MoneyWire components onto Ba400SmaInput
//
// One snapshot fully determines the SMA inputs (the BI is computed by the SMA
// engine from these components — single derivation site; the adapter does NOT
// pre-net or pre-cap). Provenance is honoured via the default provenance filter
// (production read excludes simulated snapshots → op-RWA stays 0 pre-licence-day;
// a simulated-inclusive read drives the engine).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-CAPITAL-ASSET-CLASS-V1; OPE25 / BCBS SCO (SMA); SARB Reg 33 revised;
//   Principle 1 (events are truth).
//
// Author: Atlas (Core banking platform architect, engineering).

import type { OperatingIncomeStatementSnapshottedPayload } from "../event-store/event-types/operating-income-statement";
import type { EventStore } from "../event-store/store";
import type { ProvenanceFilter } from "../projections/filter";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import type { Ba400SmaInput, SmaBucketThresholdsMajor } from "./ba-400-sma-op-risk";

export interface Ba400SmaIncomeAdapterInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). */
  readonly entity: string;
  /** ISO 8601 — period-end. Snapshots with as_of ≤ periodEnd are considered. */
  readonly periodEnd: string;
  /** Period identifier (carried onto the SMA input). */
  readonly periodId: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;
  /** Event store — provides OperatingIncomeStatementSnapshotted. */
  readonly eventStore: EventStore;
  /**
   * Optional provenance filter. Defaults to `defaultProvenanceFilter()`
   * (production-only). Callers fold simulated snapshots by passing a
   * combined / simulated-inclusive filter — the same lens the rest of the
   * RWA fold applies, so production stays 0 pre-licence-day.
   */
  readonly provenanceFilter?: ProvenanceFilter;
  /** Optional SMA bucket thresholds override (passed through to the engine). */
  readonly bucketThresholds?: SmaBucketThresholdsMajor;
}

/**
 * Fold the latest in-window OperatingIncomeStatementSnapshotted into a
 * Ba400SmaInput. Returns `null` when no snapshot exists (honest no-data — the
 * caller surfaces op-RWA as 0, never a fabricated income statement).
 *
 * "Latest" = the snapshot with the greatest `as_of`; ties broken by the highest
 * event `sequence` (replay yields ascending sequence, so the last match wins).
 */
export function buildBa400SmaInput(input: Ba400SmaIncomeAdapterInput): Ba400SmaInput | null {
  const { eventStore, entity, periodEnd, periodId, functionalCurrency } = input;
  const provenanceFilter = input.provenanceFilter ?? defaultProvenanceFilter();

  let latest: { payload: OperatingIncomeStatementSnapshottedPayload; asOf: string } | null = null;
  for (const ev of eventStore.replay({
    entity,
    type: "OperatingIncomeStatementSnapshotted",
    asOf: periodEnd,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as OperatingIncomeStatementSnapshottedPayload;
    // Replay is ascending sequence; take the most recent as_of, last-wins on ties.
    if (latest === null || ev.as_of >= latest.asOf) {
      latest = { payload: p, asOf: ev.as_of };
    }
  }

  if (latest === null) return null;
  const p = latest.payload;

  return {
    entity,
    asOf: periodEnd,
    periodId,
    functionalCurrency,
    interestIncome: p.interestIncome,
    interestExpense: p.interestExpense,
    interestEarningAssets: p.interestEarningAssets,
    dividendIncome: p.dividendIncome,
    feeIncome: p.feeIncome,
    feeExpense: p.feeExpense,
    otherOperatingIncome: p.otherOperatingIncome,
    otherOperatingExpense: p.otherOperatingExpense,
    netPnlTradingBook: p.netPnlTradingBook,
    netPnlBankingBook: p.netPnlBankingBook,
    ...(input.bucketThresholds !== undefined ? { bucketThresholds: input.bucketThresholds } : {}),
  };
}
