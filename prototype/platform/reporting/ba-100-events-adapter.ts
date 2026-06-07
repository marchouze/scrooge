// platform/reporting/ba-100-events-adapter.ts
//
// P1 fix (C-3) — BA 100 (Capital Adequacy Return) entry point that folds
// primary trade events directly, without routing through the trial balance.
//
// Principle 1 violation addressed: the original BA 100 generator accepts
// a `trialBalance: TrialBalanceSnapshotRow[]` input. A trial balance is a
// *projection* of SubLedgerPostingEmitted events, not a primary event. A
// capital position exists (CapitalContributionRecorded, SubLedgerPostingEmitted)
// before a TrialBalanceSnapshotted event is produced by the period-close
// orchestration — coupling capital ratios to accounting-period timing is
// architecturally wrong and a P1 violation.
//
// Correct input chain per Principles/1-events-are-truth.md:
//   SubLedgerPostingEmitted (primary posting events)
//     → fold by account → capital-classified accounts only
//     → generateBa100Capital (pure generator)
//     → Ba100Output
//
// Additionally, risk-weight events (RwaComputed, once the W2 Slice 3 engine
// lands) feed the RWA denominator directly; until then the caller supplies a
// typed RwaDecomposition fixture (substrate gap surfaced in `placeholders`).
//
// Authority:
//   - Principles/1-events-are-truth.md (CEO-approved architecture)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//   - Banks Act 94 of 1990 §70
//   - Regulations Relating to Banks Reg 38
//   - BCBS Basel III §50–§90
//
// Authors: Atlas (Core banking platform architect, engineering — P1-fix
//   substrate; C-3 dispatch) + Bea (Accounting & financial reporting
//   engineer, engineering — BA-form generator inputs contract)
//   + Camille (CFO, finance — capital-stack methodology)

import type { EventStore } from "../event-store/store";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import type {
  AccountCapitalClassification,
  RegulatoryDeduction,
  RwaDecomposition,
} from "./ba-100-capital";
import { BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS, generateBa100Capital } from "./ba-100-capital";
import type { Ba100Output, BufferRequirements } from "./ba-100-capital";
import type { LeverageExposureDecomposition } from "./ba-400-leverage-ratio";

// ---------------------------------------------------------------------------
// Input contract for the events-first entry point.
// ---------------------------------------------------------------------------

/**
 * Input for `generateBa100CapitalFromEvents`.
 *
 * Capital stock is computed by folding `SubLedgerPostingEmitted` and
 * `CapitalContributionRecorded` events directly. The trial balance
 * is NOT consulted — capital positions exist in the event stream before
 * TrialBalanceSnapshotted is produced by the period-close orchestration
 * (P1 violation resolved).
 *
 * P1-compliance status:
 *   - Capital stock (numerator): COMPLIANT — folds SubLedgerPostingEmitted
 *     and CapitalContributionRecorded events directly.
 *   - RWA (denominator): PLACEHOLDER — caller-supplied RwaDecomposition at
 *     v0 pending W2 Slice 3 RWA engine. When the engine lands it emits a
 *     `RwaComputed` event whose ID threads through `rwa.rwaComputationEventId`
 *     for chain-of-custody under Principle 1.
 */
export interface Ba100FromEventsInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). Throws on non-bank. */
  readonly entity: string;
  /** ISO 8601 — period-end as-of date. */
  readonly asOf: string;
  /** Period identifier (`period:hoz-bank:month:2026-05`). */
  readonly periodId: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;
  /**
   * Period window for replaying capital posting events.
   * All `SubLedgerPostingEmitted` and `CapitalContributionRecorded` events
   * with `as_of` ≤ `periodEnd` are included (cumulative capital stock as
   * of period end, not just within-period movements).
   */
  readonly periodStart: string;
  readonly periodEnd: string;
  /**
   * Per-account capital-tier classification. The event-fold path queries
   * SubLedgerPostingEmitted events for accounts that appear in this map.
   * Same shape as the pure-generator's `classifications` field.
   */
  readonly classifications: readonly AccountCapitalClassification[];
  /** Regulatory deductions per tier. May be empty (gross == net). */
  readonly deductions: readonly RegulatoryDeduction[];
  /**
   * RWA decomposition. Caller-supplied at v0; the W2 Slice 3 RWA engine
   * produces this shape once it lands (forward-compatible).
   */
  readonly rwa: RwaDecomposition;
  /** Buffer requirements; defaults to `BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS`. */
  readonly bufferRequirements?: BufferRequirements;
  /**
   * Optional Basel III leverage-ratio exposure-measure decomposition
   * (per BCBS §147–§165). Forwarded to the pure generator unchanged.
   */
  readonly leverageExposureMeasure?: LeverageExposureDecomposition;
  /**
   * Upper bound (inclusive) on the event `sequence` column.
   * Sourced from `AccountingPeriodClosed.eventSequence` (frozen cursor).
   * When supplied, all event-store replays in this adapter are bounded
   * to prevent divergence from concurrent appends.
   * Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
   */
  readonly untilSequence?: number;
}

// ---------------------------------------------------------------------------
// Capital account fold — replays SubLedgerPostingEmitted to derive balances
// for capital-classified accounts only.
// ---------------------------------------------------------------------------

interface FoldedAccountBalance {
  readonly leafAccountId: string;
  readonly currency: string;
  /** Net balance in minor units. Credit-side entries (equity) are negative per GL convention. */
  readonly amountMinor: number;
}

/**
 * Fold SubLedgerPostingEmitted and CapitalContributionRecorded events to
 * derive capital account balances directly from the event stream.
 *
 * This is the P1-compliant replacement for reading TrialBalanceSnapshotted:
 * we fold the posting events that produce the trial balance, rather than
 * the snapshot projection of those events.
 *
 * Sign convention: debits are positive, credits are negative (standard
 * double-entry accounting GL convention). Capital instruments are credit-side
 * (equity / T2 liabilities); the BA 100 generator takes `Math.abs()` to
 * report gross stocks as positive magnitudes.
 */
function foldCapitalAccountBalances(
  eventStore: EventStore,
  entity: string,
  asOf: string,
  classifiedAccountIds: ReadonlySet<string>,
  functionalCurrency: string,
  untilSequence?: number,
): FoldedAccountBalance[] {
  // Accumulate debit/credit totals per (accountId, currency).
  const balances = new Map<string, number>(); // key: `${accountId}:${currency}`

  // Provenance filter: exclude simulated events from production projections.
  // Authority: D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12).
  const provenanceFilter = defaultProvenanceFilter();

  // Frozen-cursor opts: bound by untilSequence when supplied.
  // Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
  const frozenCursorOpts = untilSequence !== undefined ? { untilSequence } : {};

  // ---- Fold SubLedgerPostingEmitted events --------------------------------
  // Each posting carries balanced legs (debits = credits per currency).
  // We extract legs that touch capital-classified accounts.
  for (const ev of eventStore.replay({
    entity,
    type: "SubLedgerPostingEmitted",
    asOf,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const payload = ev.payload as {
      legs?: Array<{
        accountId?: string;
        debitCredit?: "debit" | "credit";
        amountMinor?: number;
        currency?: string;
      }>;
    };
    if (!Array.isArray(payload.legs)) continue;
    for (const leg of payload.legs) {
      const acctId = leg.accountId;
      const ccy = leg.currency;
      if (!acctId || !ccy) continue;
      if (!classifiedAccountIds.has(acctId)) continue;
      if (ccy !== functionalCurrency) continue; // multi-currency at Slice 6+
      const key = `${acctId}:${ccy}`;
      const current = balances.get(key) ?? 0;
      const delta = leg.debitCredit === "debit" ? (leg.amountMinor ?? 0) : -(leg.amountMinor ?? 0);
      balances.set(key, current + delta);
    }
  }

  // ---- Fold CapitalContributionRecorded events ----------------------------
  // These are the primary capital-injection events (pre-posting-rules substrate).
  // Shape: { accountId, currency, amountMinor, basis }
  // A capital contribution is a credit to the capital account (increases equity).
  for (const ev of eventStore.replay({
    entity,
    type: "CapitalContributionRecorded",
    asOf,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const payload = ev.payload as {
      accountId?: string;
      currency?: string;
      amountMinor?: number;
    };
    const acctId = payload.accountId;
    const ccy = payload.currency;
    const amount = payload.amountMinor;
    if (!acctId || !ccy || amount === undefined) continue;
    if (!classifiedAccountIds.has(acctId)) continue;
    if (ccy !== functionalCurrency) continue;
    const key = `${acctId}:${ccy}`;
    const current = balances.get(key) ?? 0;
    // Capital contributions are credit-side — negative in GL convention.
    balances.set(key, current - amount);
  }

  // Convert to FoldedAccountBalance[].
  const result: FoldedAccountBalance[] = [];
  for (const [key, amountMinor] of balances.entries()) {
    const colonIdx = key.lastIndexOf(":");
    const leafAccountId = key.slice(0, colonIdx);
    const currency = key.slice(colonIdx + 1);
    result.push({ leafAccountId, currency, amountMinor });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Generator — folds events, then delegates to the pure generator.
// ---------------------------------------------------------------------------

/**
 * Generate the BA 100 (Capital Adequacy Return) projection by folding primary
 * posting events directly from the event store.
 *
 * P1-compliant entry point (C-3 fix). Capital stock is computed from
 * `SubLedgerPostingEmitted` and `CapitalContributionRecorded` events directly
 * rather than from a TrialBalanceSnapshotted projection.
 *
 * Citations: Principles/1-events-are-truth.md, D-MARKETS-SCHEMA-FOUNDATION,
 * D-MARKETS-CAPITAL-TIME-SHAPE.
 */
export function generateBa100CapitalFromEvents(
  eventStore: EventStore,
  input: Ba100FromEventsInput,
): Ba100Output {
  // Build the set of classified account IDs for fast lookup during fold.
  const classifiedAccountIds = new Set(input.classifications.map((c) => c.leafAccountId));

  // Fold capital account balances from primary events.
  const foldedRows = foldCapitalAccountBalances(
    eventStore,
    input.entity,
    input.periodEnd,
    classifiedAccountIds,
    input.functionalCurrency,
    input.untilSequence,
  );

  // Delegate to the pure generator with the folded rows in lieu of the
  // trial-balance snapshot. The `trialBalance` field of Ba100GeneratorInput
  // accepts the same row shape — we pass the directly-folded rows.
  return generateBa100Capital({
    entity: input.entity,
    asOf: input.asOf,
    periodId: input.periodId,
    functionalCurrency: input.functionalCurrency,
    trialBalance: foldedRows,
    classifications: input.classifications,
    deductions: input.deductions,
    rwa: input.rwa,
    bufferRequirements: input.bufferRequirements ?? BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS,
    ...(input.leverageExposureMeasure
      ? { leverageExposureMeasure: input.leverageExposureMeasure }
      : {}),
    // No trialBalanceSnapshotEventId — capital stock came from primary events.
    // Provenance chain: SubLedgerPostingEmitted / CapitalContributionRecorded
    //   → foldCapitalAccountBalances → generateBa100Capital.
  });
}

// Re-export for convenience at call-sites that import from this module.
export type { Ba100Output };
