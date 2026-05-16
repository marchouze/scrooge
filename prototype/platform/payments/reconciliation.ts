// platform/payments/reconciliation.ts
//
// Three-way reconciliation harness (PROC-PAY-RBH-01):
//   Trade leg  (SettlementInstructionReceived)
//     ↕
//   Payment leg (PaymentInitiated → PaymentSettled)
//     ↕
//   Ledger leg  (JournalEntryPosted)
//
// Algorithm:
//   1. Replay SettlementInstructionReceived → trade-legs map (by tradeId)
//   2. Replay PaymentSettled               → payment-legs map (by tradeId)
//   3. Replay JournalEntryPosted           → ledger-legs map (by tradeId)
//   4. For each tradeId in trade legs:
//      a. All three present AND amounts match → matched
//      b. Amount mismatch → ReconciliationBreak { kind: "amount" }
//      c. Payment or ledger missing, settlement date is today-or-future
//         → ReconciliationBreak { kind: "timing" } (self-correcting)
//      d. Payment settled but ledger missing, payment >4h ago
//         → ReconciliationBreak { kind: "nostro" }
//      e. Payment missing, settlement date is in the past
//         → ReconciliationBreak { kind: "nostro" }
//   5. Emit ReconciliationBreak events for each break found
//   6. Emit DailyReconciliationReport at end
//
// Authority:
//   - PROC-PAY-RBH-01 (three-way reconciliation procedure)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - NPS-ACT-78-1998, BANKS-ACT-94-1990
//
// Authors: Tomas (Operations & payments engineer),
//          Bea (Accounting & financial reporting engineer),
//          Atlas (Core Banking Platform Architect, engineering — substrate)

import { eventStore as compositionEventStore } from "../composition";
import { newEventId } from "../core/types";
import {
  type JournalEntryPostedPayload,
  type PaymentSettledPayload,
  type ReconciliationBreakKind,
  type ReconciliationBreakSummary,
  type SettlementInstructionReceivedPayload,
  makeDailyReconciliationReport,
  makeReconciliationBreak,
} from "../event-store/event-types/payments";
import type { EventStore } from "../event-store/store";

// Re-export types for external consumers.
export type { ReconciliationBreakKind, ReconciliationBreakSummary };

/** Four-hour tolerance window in milliseconds. */
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/** Citations required by Principle 2 for reconciliation events. */
const RECON_CITATIONS = ["PROC-PAY-RBH-01", "NPS-ACT-78-1998", "BANKS-ACT-94-1990"];

/** The actor that emits reconciliation events. */
const RECON_ACTOR = { type: "service" as const, id: "agent:tomas:daily-reconciliation" };

/** Entity the bank operates under. */
const BANK_ENTITY = "BANK-ZA-001";

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

export type ReconciliationResult = {
  /** Number of trade IDs where all three legs matched. */
  matchedCount: number;
  /** Number of trade IDs where one or more breaks were found. */
  breakCount: number;
  /** Detail of all breaks. */
  breaks: ReconciliationBreakSummary[];
  /** ISO 8601 date string this run covered. */
  asOf: string;
};

// ---------------------------------------------------------------------------
// Internal snapshot types — what we read from the event store
// ---------------------------------------------------------------------------

type TradeLeg = {
  tradeId: string;
  settlementDate: string;
  currency: string;
  netCash: number;
  asOf: string;
};

type PaymentLeg = {
  tradeId: string;
  netCash: number;
  settledAt: string;
};

type LedgerLeg = {
  tradeId: string;
  amountMinor: number;
  postedAt: string;
};

// ---------------------------------------------------------------------------
// Event store readers
// ---------------------------------------------------------------------------

function readTradeLegs(store: EventStore, asOf: string): Map<string, TradeLeg> {
  const map = new Map<string, TradeLeg>();
  for (const e of store.replay({ type: "SettlementInstructionReceived", asOf })) {
    const p = e.payload as unknown as SettlementInstructionReceivedPayload;
    // Keep the most recent instruction per tradeId (last-write-wins).
    map.set(p.tradeId, {
      tradeId: p.tradeId,
      settlementDate: p.settlementDate,
      currency: p.currency,
      netCash: p.netCash,
      asOf: e.as_of,
    });
  }
  return map;
}

function readPaymentLegs(store: EventStore, asOf: string): Map<string, PaymentLeg> {
  const map = new Map<string, PaymentLeg>();
  for (const e of store.replay({ type: "PaymentSettled", asOf })) {
    const p = e.payload as unknown as PaymentSettledPayload;
    map.set(p.tradeId, {
      tradeId: p.tradeId,
      netCash: p.netCash,
      settledAt: p.settledAt,
    });
  }
  return map;
}

function readLedgerLegs(store: EventStore, asOf: string): Map<string, LedgerLeg> {
  const map = new Map<string, LedgerLeg>();
  for (const e of store.replay({ type: "JournalEntryPosted", asOf })) {
    const p = e.payload as unknown as JournalEntryPostedPayload;
    map.set(p.tradeId, {
      tradeId: p.tradeId,
      amountMinor: p.amountMinor,
      postedAt: p.postedAt,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Break classification logic
// ---------------------------------------------------------------------------

/**
 * Returns true if the given ISO 8601 timestamp `anchorStr` is within 4 hours
 * of `nowStr`. Used to classify timing (self-correcting) vs nostro breaks
 * when payment has settled but the ledger leg is missing.
 */
function isWithin4HoursTimestamp(anchorStr: string, nowStr: string): boolean {
  const anchorMs = new Date(anchorStr).getTime();
  const nowMs = new Date(nowStr).getTime();
  return Math.abs(nowMs - anchorMs) <= FOUR_HOURS_MS;
}

/**
 * Returns true if the given settlementDate (YYYY-MM-DD) is today or in the future
 * relative to `nowStr` (ISO 8601 timestamp). Timing breaks are self-correcting;
 * nostro breaks require investigation.
 *
 * Business rationale: SAMOS/correspondent windows close same-day; a missing leg
 * for today's or a future settlement date is within the timing tolerance window.
 */
function isSettlementDateTodayOrFuture(settlementDate: string, nowStr: string): boolean {
  const todayStr = nowStr.slice(0, 10);
  return settlementDate >= todayStr;
}

// ---------------------------------------------------------------------------
// Main reconciliation runner
// ---------------------------------------------------------------------------

/**
 * Run the three-way reconciliation for the given `asOf` date.
 *
 * - Reads all trade, payment, and ledger legs from the event store up to `asOf`.
 * - Emits `ReconciliationBreak` events for each break found.
 * - Emits a `DailyReconciliationReport` summarising the run.
 * - Returns the result for the caller.
 *
 * @param asOf      ISO 8601 date string (YYYY-MM-DD) for the run.
 * @param dryRun    If true, reads event store but does NOT emit events.
 * @param store     EventStore to use (defaults to composition singleton).
 *                  Pass an in-memory store in tests.
 */
export function runThreeWayReconciliation(
  asOf: string,
  dryRun = false,
  store: EventStore = compositionEventStore,
): ReconciliationResult {
  const detectedAt = new Date().toISOString();

  const tradeLegs = readTradeLegs(store, asOf);
  const paymentLegs = readPaymentLegs(store, asOf);
  const ledgerLegs = readLedgerLegs(store, asOf);

  const breaks: ReconciliationBreakSummary[] = [];

  for (const [tradeId, trade] of tradeLegs) {
    const payment = paymentLegs.get(tradeId);
    const ledger = ledgerLegs.get(tradeId);

    // Case 1: all three legs present — check amounts.
    if (payment !== undefined && ledger !== undefined) {
      if (payment.netCash !== trade.netCash) {
        // Amount mismatch between trade instruction and what was actually settled.
        const breakSummary: ReconciliationBreakSummary = {
          tradeId,
          kind: "amount",
          description: `Amount mismatch: settlement instruction netCash=${trade.netCash} but payment settled netCash=${payment.netCash} (currency ${trade.currency})`,
          tradeAmount: trade.netCash,
          paymentAmount: payment.netCash,
          detectedAt,
        };
        breaks.push(breakSummary);
        if (!dryRun) {
          store.append(
            makeReconciliationBreak({
              asOf,
              entity: BANK_ENTITY,
              actor: RECON_ACTOR,
              citations: RECON_CITATIONS,
              payload: { ...breakSummary, citations: RECON_CITATIONS },
              eventId: newEventId(),
            }),
          );
        }
      }
      // Otherwise: all three present + amounts match → matched (no break emitted).
      continue;
    }

    // Case 2: payment settled but ledger missing.
    if (payment !== undefined && ledger === undefined) {
      const kind: ReconciliationBreakKind = isWithin4HoursTimestamp(payment.settledAt, detectedAt)
        ? "timing"
        : "nostro";
      const description =
        kind === "timing"
          ? `Ledger leg missing for tradeId=${tradeId} within 4h of settlement (${payment.settledAt}); self-correcting expected`
          : `Nostro break: payment settled at ${payment.settledAt} but no JournalEntryPosted after 4h; manual investigation required`;
      const breakSummary: ReconciliationBreakSummary = {
        tradeId,
        kind,
        description,
        detectedAt,
      };
      breaks.push(breakSummary);
      if (!dryRun) {
        store.append(
          makeReconciliationBreak({
            asOf,
            entity: BANK_ENTITY,
            actor: RECON_ACTOR,
            citations: RECON_CITATIONS,
            payload: { ...breakSummary, citations: RECON_CITATIONS },
            eventId: newEventId(),
          }),
        );
      }
      continue;
    }

    // Case 3: payment leg missing (whether ledger present or not).
    if (payment === undefined) {
      const kind: ReconciliationBreakKind = isSettlementDateTodayOrFuture(
        trade.settlementDate,
        detectedAt,
      )
        ? "timing"
        : "nostro";
      const description =
        kind === "timing"
          ? `Payment leg missing for tradeId=${tradeId}; settlementDate=${trade.settlementDate} is today or future — self-correcting expected`
          : `Nostro break: no PaymentSettled for tradeId=${tradeId}; settlementDate=${trade.settlementDate} is in the past — investigation required`;
      const breakSummary: ReconciliationBreakSummary = {
        tradeId,
        kind,
        description,
        detectedAt,
      };
      breaks.push(breakSummary);
      if (!dryRun) {
        store.append(
          makeReconciliationBreak({
            asOf,
            entity: BANK_ENTITY,
            actor: RECON_ACTOR,
            citations: RECON_CITATIONS,
            payload: { ...breakSummary, citations: RECON_CITATIONS },
            eventId: newEventId(),
          }),
        );
      }
    }
  }

  const matchedCount = tradeLegs.size - breaks.length;
  const breakCount = breaks.length;

  // Emit the daily summary.
  if (!dryRun) {
    store.append(
      makeDailyReconciliationReport({
        asOf,
        entity: BANK_ENTITY,
        actor: RECON_ACTOR,
        citations: RECON_CITATIONS,
        payload: {
          asOf,
          matchedCount,
          breakCount,
          breaks,
          citations: RECON_CITATIONS,
        },
        eventId: newEventId(),
      }),
    );
  }

  return { matchedCount, breakCount, breaks, asOf };
}
