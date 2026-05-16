// platform/returns/ba325/period-close-subscriber.ts
//
// M2 Slice 3 — AccountingPeriodClosed subscriber that triggers BA 325 (LCR)
// generation when an accounting period closes for a bank-licence entity.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 3.
//
// ## Design
//
// The subscriber wires the BA 325 generator to the period-close event stream.
// When `AccountingPeriodClosed` fires for `LE-ZA-HOZ-BANK`, the subscriber:
//   1. Reads the trial-balance rows from the event payload's referenced
//      `TrialBalanceSnapshotted` event_id (persisted in the event store).
//   2. Applies the default HQLA classification map (caller-supplied or
//      built-in default). The built-in default maps `ACC-1100-001` (Cash and
//      balances at SARB, per `CashAndBalancesAtSARB` semantic entry) to
//      HQLA Level-1.
//   3. Calls `generateBa325Lcr` with the event store, trial balance, and
//      classification map.
//   4. Returns the typed `Ba325Output` for the caller to render / store.
//
// ## Principle 1 compliance
//
// Cash flows (LCR denominator) are folded directly from
// `FxSettlementInstructed` and `FxSettlementConfirmed` events inside
// `generateBa325Lcr` — not from GL account balances. HQLA stock (numerator)
// uses the trial-balance rows from the period-close snapshot. This is the
// Principle 1 compliant architecture per `Principles/1-events-are-truth.md`
// (updated 2026-05-12).
//
// ## Cross-link to semantic registry
//
// The built-in default classification map is anchored to
// `CashAndBalancesAtSARB` from `@platform/semantic`. That entry carries the
// BA 325 regulatory cell: "HQLA Level 1 — central-bank reserves (LCR)".
// The account ID `ACC-1100-001` in the default classification map corresponds
// to the formula `Balance(account=ACC-1100-001, ...)` in the semantic entry.
//
// Citation: Principles/1-events-are-truth.md; D-MARKETS-SCHEMA-FOUNDATION;
//           D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping + subscriber owner)
//   + Eitan (Treasury & liquidity engineer, engineering — LCR methodology
//   owner)
//   + Anya (Projection Engineer, engineering — semantic-layer integration).

import type { AccountingPeriodClosedPayload, TrialBalanceSnapshottedPayload } from "../../event-store/event-types";
import type { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import {
  type AccountLiquidityClassification,
  type Ba325Output,
  BA_325_BANK_ENTITIES,
  generateBa325Lcr,
} from "../../reporting/ba-325-lcr";
import { cashAndBalancesAtSARB } from "../../semantic";

// ---------------------------------------------------------------------------
// Default HQLA classification map
// ---------------------------------------------------------------------------

/**
 * The SARB BA 325 account ID for Cash and balances at SARB (Hoz Bank).
 * Anchored to `CashAndBalancesAtSARB` semantic entry (Slice 1) which carries:
 *   formula: "Balance(account=ACC-1100-001, entity=urn:legal-entity:hoz:hoz-bank:v1, ...)"
 *   regulatoryCell: { form: "BA 325", line: "HQLA Level 1 — central-bank reserves (LCR)" }
 *
 * Citation: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN; platform/semantic/entries.ts.
 */
export const CASH_AT_SARB_ACCOUNT_ID = "ACC-1100-001";

/**
 * Default HQLA classification map derived from the `CashAndBalancesAtSARB`
 * semantic entry. This is the minimum production-grade map for Hoz Bank:
 * a single Level-1 HQLA account (SARB operational cash). Additional
 * Level-2A / Level-2B classifications are supplied at the call site as
 * the chart-of-accounts and instrument classifications mature (Slice 6+).
 *
 * The semantic entry is imported and referenced here so that the recon
 * pipeline can assert "the default map is consistent with the semantic
 * registry" — Principle 2 (single-graph discipline, bidirectional
 * traceability) and Principle 1 (events as truth; semantic registry
 * as the typed classification layer).
 */
export const DEFAULT_HQLA_CLASSIFICATIONS: readonly AccountLiquidityClassification[] = [
  {
    // Anchored to CashAndBalancesAtSARB semantic entry (Slice 1).
    // entry.id: cashAndBalancesAtSARB.id === "CashAndBalancesAtSARB"
    // entry.regulatoryCells[1]: { form: "BA 325", line: "HQLA Level 1 — central-bank reserves (LCR)" }
    leafAccountId: CASH_AT_SARB_ACCOUNT_ID,
    hqlaLevel: "level-1",
    subCategory: cashAndBalancesAtSARB.regulatoryCells?.find((c) => c.form === "BA 325")?.line ?? "level-1.cash-at-sarb",
  },
];

// ---------------------------------------------------------------------------
// Subscriber input / output
// ---------------------------------------------------------------------------

/**
 * Input to the `AccountingPeriodClosed` → BA 325 subscriber.
 */
export interface Ba325PeriodCloseSubscriberInput {
  /** The `AccountingPeriodClosed` event payload that triggered the subscriber. */
  readonly closedPayload: AccountingPeriodClosedPayload;
  /** The entity the period was closed for. Must be in `BA_325_BANK_ENTITIES`. */
  readonly entity: string;
  /**
   * Event store — provides access to:
   *   (a) `TrialBalanceSnapshotted` event rows (HQLA stock);
   *   (b) `FxSettlementInstructed` / `FxSettlementConfirmed` events (cash flows).
   */
  readonly eventStore: EventStore;
  /** Actor running the subscriber (typically the Bea agent). */
  readonly actor: Actor;
  /**
   * Optional override classifications. Defaults to `DEFAULT_HQLA_CLASSIFICATIONS`.
   * Use at the call site to add Level-2A / Level-2B entries when the
   * instrument classification map is populated (Slice 6+).
   */
  readonly classifications?: readonly AccountLiquidityClassification[];
  /**
   * ISO 8601 — start of the 30-day stress window for cash-flow folding.
   * Per BCBS D295 §31 the window is the 30 calendar days from the
   * reporting date. Convention: `AccountingPeriodOpened.periodStart`.
   */
  readonly periodStart: string;
}

/**
 * Result of the `AccountingPeriodClosed` → BA 325 subscriber.
 */
export interface Ba325PeriodCloseSubscriberResult {
  /** The generated BA 325 projection. Caller renders + stores this. */
  readonly ba325Output: Ba325Output;
  /** The trial-balance rows used as HQLA stock input. */
  readonly trialBalanceRows: readonly { leafAccountId: string; currency: string; amountMinor: number }[];
  /**
   * True if the entity was not in `BA_325_BANK_ENTITIES` and the subscriber
   * skipped generation. The caller can route non-bank-entity closes to other
   * subscribers without raising an error.
   */
  readonly skipped: boolean;
  readonly skipReason?: string;
}

// ---------------------------------------------------------------------------
// Subscriber
// ---------------------------------------------------------------------------

/**
 * `AccountingPeriodClosed` subscriber for BA 325 (LCR) generation.
 *
 * Triggered by `AccountingPeriodClosed` events for bank-licence entities.
 * Non-bank entities (e.g. `LE-ZA-HOZ-SECURITIES`, `LE-ZA-HOZ-GROUP`) are
 * silently skipped (`result.skipped = true`).
 *
 * **Principle 1 compliance**: this subscriber does NOT derive cash flows
 * from the trial balance. Cash flows (LCR denominator) are folded directly
 * from settlement events inside `generateBa325Lcr`.
 *
 * **Semantic cross-link**: the default classification map (`DEFAULT_HQLA_CLASSIFICATIONS`)
 * is anchored to `CashAndBalancesAtSARB` from `@platform/semantic`. The
 * semantic entry carries the BA 325 regulatory cell, so the classification
 * is traceable from regulation → policy → semantic entry → account → BA 325
 * cell (Principle 2 — single-graph discipline).
 *
 * Citations:
 *   Principles/1-events-are-truth.md (updated 2026-05-12);
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10);
 *   D-MARKETS-SCHEMA-FOUNDATION;
 *   Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 26;
 *   BCBS D295.
 */
export function ba325PeriodCloseSubscriber(
  input: Ba325PeriodCloseSubscriberInput,
): Ba325PeriodCloseSubscriberResult {
  // Guard: only bank-licence entities generate BA 325.
  if (!BA_325_BANK_ENTITIES.includes(input.entity)) {
    return {
      ba325Output: null as unknown as Ba325Output,
      trialBalanceRows: [],
      skipped: true,
      skipReason: `entity '${input.entity}' is not in BA_325_BANK_ENTITIES (${BA_325_BANK_ENTITIES.join(", ")}); BA 325 not generated`,
    };
  }

  // Resolve trial-balance rows from the TrialBalanceSnapshotted event.
  const tbEventId = input.closedPayload.trialBalanceSnapshotEventId;
  let trialBalanceRows: readonly { leafAccountId: string; currency: string; amountMinor: number }[] = [];

  if (tbEventId) {
    // Replay all events for the entity and find the TrialBalanceSnapshotted event
    // with this event_id. The trial-balance rows are carried in the event payload.
    for (const event of input.eventStore.replay({ entity: input.entity })) {
      if (event.event_id === tbEventId && event.type === "TrialBalanceSnapshotted") {
        const payload = event.payload as TrialBalanceSnapshottedPayload;
        trialBalanceRows = payload.rows;
        break;
      }
    }
  }

  const classifications = input.classifications ?? DEFAULT_HQLA_CLASSIFICATIONS;
  const periodEnd = input.closedPayload.closedAt;

  const ba325Output = generateBa325Lcr({
    entity: input.entity,
    asOf: periodEnd,
    periodId: input.closedPayload.periodId,
    functionalCurrency: "ZAR", // TODO: read from AccountingPeriodOpened.functionalCurrency (Slice 6+)
    eventStore: input.eventStore,
    periodStart: input.periodStart,
    periodEnd,
    trialBalance: trialBalanceRows,
    classifications,
    trialBalanceSnapshotEventId: tbEventId,
  });

  return {
    ba325Output,
    trialBalanceRows,
    skipped: false,
  };
}
