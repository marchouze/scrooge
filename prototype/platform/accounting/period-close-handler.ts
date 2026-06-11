// platform/accounting/period-close-handler.ts
//
// M2 Slice 2 — period-close handler.
//
// Exports three public functions that wrap the core close orchestration
// in `period-close.ts` and plug into the agent-runtime handler pattern:
//
//   openPeriod(...)          — opens an accounting period, emitting
//                              `AccountingPeriodOpened`.
//
//   snapshotTrialBalance(...) — computes and appends a point-in-time
//                              `TrialBalanceSnapshotted` (kind: "interim")
//                              for the named period without closing it.
//
//   closePeriod(...)         — validates a balanced trial-balance snapshot
//                              exists for the period, then runs the full
//                              five-step close transaction (compute TB →
//                              optional doc-store write → TrialBalance-
//                              Snapshotted → EvSS snapshot → AccountingPeriod-
//                              Closed).
//
// All three functions are thin wrappers; the authoritative orchestration
// logic lives in `period-close.ts` (which is the canonical accounting
// module).  This handler file exists so the agent-runtime wiring
// (handler-callables.ts, bea.ts metadata) has a clean surface to import
// from without mixing agent-runtime concerns into the pure accounting
// module.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// Principles: P1-EVENTS-AS-TRUTH, Principle 2 (single-graph discipline)
// Author: Bea (Accounting & financial reporting engineer, engineering) +
//         Atlas (Platform Engineer, engineering)

import type { DocumentStore } from "../document-store";
import type { TrialBalanceSnapshottedPayload } from "../event-store/event-types";
import { makeTrialBalanceSnapshotted } from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";
import {
  type ClosePeriodArgs,
  type ClosePeriodResult,
  type OpenPeriodArgs,
  type OpenPeriodResult,
  type TrialBalance,
  closePeriod as _closePeriod,
  openPeriod as _openPeriod,
  computeTrialBalance,
} from "./period-close";

// ---------------------------------------------------------------------------
// Re-export core types for consumers that import from this handler surface.
// ---------------------------------------------------------------------------

export type { ClosePeriodArgs, ClosePeriodResult, OpenPeriodArgs, OpenPeriodResult, TrialBalance };

// ---------------------------------------------------------------------------
// openPeriod
// ---------------------------------------------------------------------------

/**
 * Open an accounting period for `entity` at `payload.periodId`.
 *
 * Emits `AccountingPeriodOpened`. Idempotent — returns the existing event
 * without appending if the period is already open with the same payload.
 * Throws for conflicts (already open with different payload; closed without
 * a reopenOf reopen; reopenOf mismatch).
 *
 * Delegates to `period-close.ts::openPeriod`.
 */
export function openPeriod(args: OpenPeriodArgs): OpenPeriodResult {
  return _openPeriod(args);
}

// ---------------------------------------------------------------------------
// snapshotTrialBalance
// ---------------------------------------------------------------------------

export interface SnapshotTrialBalanceArgs {
  readonly eventStore: EventStore;
  readonly entity: string;
  /** Must match a previously opened AccountingPeriodOpened.periodId. */
  readonly periodId: string;
  /** ISO 8601 — as-of time for the snapshot. */
  readonly snapshotAt: string;
  readonly actor: Actor;
  readonly citations: readonly string[];
  readonly documentStore?: DocumentStore;
}

export interface SnapshotTrialBalanceResult {
  readonly trialBalance: TrialBalance;
  readonly snapshotEvent: Event;
  readonly documentHash?: string;
}

/**
 * Compute and append a point-in-time `TrialBalanceSnapshotted` event
 * (kind: "interim") for the named period. Does NOT close the period —
 * use `closePeriod` for that. Useful for interim reporting, intra-period
 * sanity checks, and BA 110 harness inputs (Slice 3).
 *
 * Throws if no `AccountingPeriodOpened` exists for (entity, periodId).
 */
export function snapshotTrialBalance(args: SnapshotTrialBalanceArgs): SnapshotTrialBalanceResult {
  // Find the most recent open event for this period.
  let openedPayload:
    | { periodStart: string; periodEnd: string; functionalCurrency: string }
    | undefined;
  for (const e of args.eventStore.replay({
    entity: args.entity,
    type: "AccountingPeriodOpened",
  })) {
    const p = e.payload as Record<string, unknown>;
    if (p.periodId === args.periodId) {
      openedPayload = {
        periodStart: p.periodStart as string,
        periodEnd: p.periodEnd as string,
        functionalCurrency: p.functionalCurrency as string,
      };
    }
  }

  if (!openedPayload) {
    throw new Error(
      `snapshotTrialBalance: no AccountingPeriodOpened for (entity=${args.entity}, periodId=${args.periodId})`,
    );
  }

  const trialBalance = computeTrialBalance({
    eventStore: args.eventStore,
    entity: args.entity,
    periodStart: openedPayload.periodStart,
    periodEnd: openedPayload.periodEnd,
  });

  // Optionally write to document store.
  let documentHash: string | undefined;
  if (args.documentStore) {
    const json = JSON.stringify({
      entity: args.entity,
      periodId: args.periodId,
      snapshotKind: "interim",
      asOf: args.snapshotAt,
      uptoSequence: trialBalance.uptoSequence,
      rows: trialBalance.rows,
      perCurrencyTotals: trialBalance.perCurrencyTotals,
    });
    const put = args.documentStore.put(json);
    documentHash = put.hash;
  }

  const tbPayload: TrialBalanceSnapshottedPayload = {
    periodId: args.periodId,
    snapshotKind: "interim",
    snapshotAsOf: args.snapshotAt,
    uptoSequence: trialBalance.uptoSequence,
    rows: [...trialBalance.rows],
    perCurrencyTotals: [...trialBalance.perCurrencyTotals],
    ...(documentHash ? { documentHash } : {}),
  };

  const snapshotEvent = makeTrialBalanceSnapshotted({
    asOf: args.snapshotAt,
    entity: args.entity,
    actor: args.actor,
    citations: [...args.citations],
    payload: tbPayload,
  });

  args.eventStore.append(snapshotEvent);

  return {
    trialBalance,
    snapshotEvent,
    ...(documentHash !== undefined ? { documentHash } : {}),
  };
}

// ---------------------------------------------------------------------------
// closePeriod
// ---------------------------------------------------------------------------

/**
 * Close an accounting period. Runs the full five-step close transaction:
 *   (a) compute trial balance from the PostingEmitted stream
 *   (b) optionally write JSON to the document store (BLAKE3 hash)
 *   (c) append `TrialBalanceSnapshotted` (kind: "close")
 *   (d) call eventStore.snapshot() for EvSS Slice 2 caching
 *   (e) append `AccountingPeriodClosed`
 *
 * Throws if:
 *   - No `AccountingPeriodOpened` for (entity, periodId)
 *   - Period already closed (idempotent-terminal — use openPeriod with
 *     reopenOf to reopen)
 *
 * Delegates to `period-close.ts::closePeriod`.
 */
export function closePeriod(args: ClosePeriodArgs): ClosePeriodResult {
  return _closePeriod(args);
}

// ---------------------------------------------------------------------------
// Accounting index — what Slice 3 imports
// ---------------------------------------------------------------------------
//
// Slice 3 (BA 110 LCR harness — Bea + Eitan + Anya) imports:
//   import { closePeriod, openPeriod, snapshotTrialBalance } from
//     "@platform/accounting";
//
// The types it needs from the event-type layer:
//   import type { AccountingPeriodClosedPayload, TrialBalanceSnapshottedPayload }
//     from "@platform/event-store/event-types";
