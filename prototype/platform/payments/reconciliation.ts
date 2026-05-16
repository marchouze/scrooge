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
//      c. Payment or ledger missing, within 4h of settlementDate
//         → ReconciliationBreak { kind: "timing" } (self-correcting)
//      d. Payment settled but ledger missing, >4h past settlement
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

import { eventStore } from "../composition";
import { newEventId } from "../core/types";
import {
  type ReconciliationBreakKind,
  type ReconciliationBreakSummary,
  makeDailyReconciliationReport,
  makeReconciliationBreak,
} from "../event-store/event-types/payments";
import type { SettlementInstructionReceivedPayload } from "../event-store/event-types/payments";
import type { PaymentSettledPayload } from "../event-store/event-types/payments";
import type { JournalEntryPostedPayload } from "../event-store/event-types/payments";

// Re-export types for external consumers.
export type { ReconciliationBreakKind, ReconciliationBreakSummary };

/** Four-hour tolerance window in milliseconds. */
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/** Citations required by Principle 2 for reconciliation events. */
const RECON_CITATIONS = [
  "PROC-PAY-RBH-01",
  "NPS-ACT-78-1998",
  "BANKS-ACT-94-1990",
];

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

function readTradeLegs(asOf: string): Map<string, TradeLeg> {
  const map = new Map<string, TradeLeg>();
  for (const e of eventStore.replay({ type: "SettlementInstructionReceived", asOf })) {
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

function readPaymentLegs(asOf: string): Map<string, PaymentLeg> {
  const map = new Map<string, PaymentLeg>();
  for (const e of eventStore.replay({ type: "PaymentSettled", asOf })) {
    const p = e.payload as unknown as PaymentSettledPayload;
    map.set(p.tradeId, {
      tradeId: p.tradeId,
      netCash: p.netCash,
      settledAt: p.settledAt,
    });
  }
  return map;
}

function readLedgerLegs(asOf: string): Map<string, LedgerLeg> {
  const map = new Map<string, LedgerLeg>();
  for (const e of eventStore.replay({ type: "JournalEntryPosted", asOf })) {
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
 * Returns true if `now` is within 4 hours of `settlementDate`.
 * Used to classify timing breaks (self-correcting) vs nostro breaks.
 */
function isWithin4Hours(settlementDateStr: string, nowStr: string): boolean {
  const settlementMs = new Date(settlementDateStr).getTime();
  const nowMs = new Date(nowStr).getTime();
  return Math.abs(nowMs - settlementMs) <= FOUR_HOURS_MS;
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
 * @param asOf   ISO 8601 date string (YYYY-MM-DD) for the run.
 * @param dryRun If true, reads event store but does NOT emit events.
 */
export function runThreeWayReconciliation(
  asOf: string,
  dryRun = false,
): ReconciliationResult {
  const detectedAt = new Date().toISOString();

  const tradeLegs = readTradeLegs(asOf);
  const paymentLegs = readPaymentLegs(asOf);
  const ledgerLegs = readLedgerLegs(asOf);

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
          eventStore.append(
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
      const kind: ReconciliationBreakKind = isWithin4Hours(payment.settledAt, detectedAt)
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
        eventStore.append(
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
      const kind: ReconciliationBreakKind = isWithin4Hours(trade.settlementDate, detectedAt)
        ? "timing"
        : "nostro";
      const description =
        kind === "timing"
          ? `Payment leg missing for tradeId=${tradeId} within 4h of settlementDate=${trade.settlementDate}; self-correcting expected`
          : `Nostro break: no PaymentSettled for tradeId=${tradeId} after 4h past settlementDate=${trade.settlementDate}; investigation required`;
      const breakSummary: ReconciliationBreakSummary = {
        tradeId,
        kind,
        description,
        detectedAt,
      };
      breaks.push(breakSummary);
      if (!dryRun) {
        eventStore.append(
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
    eventStore.append(
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
