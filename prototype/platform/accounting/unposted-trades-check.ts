// platform/accounting/unposted-trades-check.ts
//
// MC2 — Pre-close check: unposted trades.
//
// Pure function that inspects the trade-event stream for any trade events
// with a value date within the closing period that have NOT yet been posted
// to the GL (i.e. have no matching SubLedgerPostingEmitted.sourceEventId).
//
// Consumed by the month-end close orchestration at step MC2 of
// PROC-FIN-MC-01 (month-end-close.md).
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
// Procedure: PROC-FIN-MC-01 §5 MC2
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille, CFO)

import type { SubLedgerPostingEmittedPayload } from "../event-store/event-types/fx-accounting";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Minimal shape of a trade event that MC2 checks against the posting stream.
 * Callers project the relevant fields from the full event type; this keeps
 * the function pure and decoupled from specific trade-event schemas.
 */
export interface UnpostedTradeEvent {
  /** The event_id of this trade event — matched against sourceEventId. */
  readonly eventId: string;
  /** Discriminator (e.g. "FxTradeExecuted", "BondTradeBooked"). */
  readonly eventType: string;
  /**
   * Value date in YYYY-MM-DD format. The check includes all trades whose
   * valueDate is on or before `periodEnd`.
   */
  readonly valueDate: string;
  /** Internal trade identifier for human-readable alerting. */
  readonly tradeId: string;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * A single trade that has no matching SubLedgerPostingEmitted in the posting
 * stream (i.e. was not posted to the GL at the time of the check).
 */
export interface UnpostedTrade {
  readonly eventId: string;
  readonly eventType: string;
  readonly valueDate: string;
  readonly tradeId: string;
}

/**
 * Result of the MC2 unposted-trades check.
 *
 * - `unposted`  — trades with value date ≤ periodEnd that have no GL posting.
 * - `ok`        — true iff `unposted` is empty (clear to proceed to MC4).
 * - `count`     — number of unposted trades (convenience).
 */
export interface UnpostedTradesResult {
  readonly unposted: readonly UnpostedTrade[];
  readonly ok: boolean;
  readonly count: number;
}

// ---------------------------------------------------------------------------
// checkUnpostedTrades
// ---------------------------------------------------------------------------

/**
 * MC2 — Pre-close unposted-trades check.
 *
 * For each trade event with `valueDate <= periodEnd`, verifies that at least
 * one `SubLedgerPostingEmitted` event exists whose `sourceEventId` matches the
 * trade's `eventId`. If no such posting exists, the trade is unposted and
 * blocks the close.
 *
 * Algorithm:
 *   1. Build a set of all `sourceEventId` values from the posting stream.
 *   2. Filter `tradeEvents` to those with `valueDate <= periodEnd`.
 *   3. For each such trade, check if its `eventId` is in the sourced set.
 *   4. Trades not in the set are unposted.
 *
 * Pure function — no I/O.
 *
 * Citations: PROC-FIN-MC-01 §5 MC2; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
 * Principle 1 (all state is a query over events).
 *
 * @param args.tradeEvents   — trade events to check (all event types, all periods).
 * @param args.postingEvents — SubLedgerPostingEmitted payloads for the period.
 * @param args.periodEnd     — YYYY-MM-DD last day of the closing period (inclusive).
 */
export function checkUnpostedTrades(args: {
  tradeEvents: readonly UnpostedTradeEvent[];
  postingEvents: readonly SubLedgerPostingEmittedPayload[];
  periodEnd: string;
}): UnpostedTradesResult {
  const { tradeEvents, postingEvents, periodEnd } = args;

  // Step 1: collect all source event IDs that have at least one GL posting.
  const postedSourceIds = new Set<string>();
  for (const posting of postingEvents) {
    if (posting.sourceEventId) {
      postedSourceIds.add(posting.sourceEventId);
    }
  }

  // Step 2 + 3: find trade events in the closing window with no posting.
  const unposted: UnpostedTrade[] = [];
  for (const tradeEvent of tradeEvents) {
    // Only consider trades whose value date falls within the closing period.
    if (tradeEvent.valueDate > periodEnd) continue;

    // Check if this trade has been posted.
    if (!postedSourceIds.has(tradeEvent.eventId)) {
      unposted.push({
        eventId: tradeEvent.eventId,
        eventType: tradeEvent.eventType,
        valueDate: tradeEvent.valueDate,
        tradeId: tradeEvent.tradeId,
      });
    }
  }

  return {
    unposted,
    ok: unposted.length === 0,
    count: unposted.length,
  };
}
