// scripts/backfill-fx-settlement-realised-pnl.ts
//
// Backfill script — Option A (Principle 1: events are immutable).
//
// Scans the event store for `SettlementConfirmed` events with
// `realisedPnlDelta === 0` (the historical substrate gap: the post-trade
// lifecycle emitter did not compute realised P&L at emission time). For each
// affected trade, recomputes the realised P&L from:
//
//   1. The original `FxTradeExecuted` payload (book rate, side, notional,
//      currency pair).
//   2. The effective settlement rate (priority order per brief §1):
//        (a) Explicit settlement rate on `SettlementConfirmed` upstream — not
//            applicable in the CDM `SettlementConfirmed` shape (no settlement
//            rate field); move directly to (b).
//        (b) Latest `OfficialMarkAdopted` for the pair on/before the
//            settlement date.
//        (c) Book rate fallback (zero P&L) — logs a substrate warning.
//
// Emits a `SettlementRealisedPnlCorrected` event for each affected trade.
// Idempotent: skips trades where a correction event already exists.
//
// Per IAS 21 §28: exchange differences on settlement of monetary items
// recognised in profit or loss. Severity: medium data-quality gap (no
// balance-sheet impact in the build phase per brief §3).
//
// Authority:
//   IAS 21 §28 — settlement exchange differences recognised in P&L.
//   PR-FX-LIFECYCLE-CLOSE — realised P&L crystallised on settlement.
//   D-FX-QUOTING-CONVENTION — side-aware rate convention.
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { eventStore } from "../platform/composition";
import type { OfficialMarkAdoptedPayload } from "../platform/event-store/event-types/valuation";
import { makeSettlementRealisedPnlCorrected } from "../platform/markets/cdm/fx";
import type { FxTradeExecutedPayload, SettlementConfirmedPayload } from "../platform/markets/cdm/fx";
import { baseAmountMinor } from "../platform/markets/cdm/fx-helpers";
import { logger } from "../platform/observability/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:bea:backfill-fx-settlement-realised-pnl" };
const CITATIONS = [
  "IAS-21-§28",
  "PR-FX-LIFECYCLE-CLOSE",
  "D-FX-QUOTING-CONVENTION",
  "brief:bea:compute-realised-p-l-on-fx-spot-settlement-backf:2026-05-21",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a map from tradeId → best settlement rate (decimal) and rateSource.
 * Sources checked: OfficialMarkAdopted (fx-rate) on/before the settlement date.
 */
function buildOfficialMarkIndex(): Map<
  string,
  { rate: number; markAsOf: string; instrumentKey: string }
> {
  const byPairAndDate = new Map<
    string, // "currencyPair:YYYY-MM-DD"
    { rate: number; markAsOf: string; instrumentKey: string }
  >();
  try {
    for (const e of eventStore.replay({ type: "OfficialMarkAdopted" })) {
      const m = e.payload as unknown as OfficialMarkAdoptedPayload;
      if (m.markType !== "fx-rate") continue;
      const key = `${m.instrumentKey}:${m.markAsOf.slice(0, 10)}`;
      const existing = byPairAndDate.get(key);
      if (!existing || m.markAsOf > existing.markAsOf) {
        byPairAndDate.set(key, {
          rate: parseFloat(m.mark),
          markAsOf: m.markAsOf,
          instrumentKey: m.instrumentKey,
        });
      }
    }
  } catch {
    // OfficialMarkAdopted not in store — will fall back to book rate for all trades.
  }
  return byPairAndDate;
}

/**
 * Find the latest official mark for a currency pair on/before a given date.
 * Scans backward from settlementDate across all available mark dates.
 */
function findSettlementRate(
  officialMarks: Map<string, { rate: number; markAsOf: string; instrumentKey: string }>,
  currencyPair: string,
  settlementDate: string,
): { rate: number; rateSource: "official-mark" | "book-rate-fallback" } | null {
  let best: { rate: number; markAsOf: string } | null = null;

  for (const [key, mark] of officialMarks.entries()) {
    // Key format: "currencyPair:YYYY-MM-DD"
    if (!key.startsWith(`${currencyPair}:`)) continue;
    const markDate = key.slice(currencyPair.length + 1);
    if (markDate <= settlementDate) {
      if (!best || markDate > best.markAsOf) {
        best = { rate: mark.rate, markAsOf: markDate };
      }
    }
  }

  if (best) {
    return { rate: best.rate, rateSource: "official-mark" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main backfill logic
// ---------------------------------------------------------------------------

function main(): number {
  // 1. Collect all FxTradeExecuted payloads keyed by tradeId.
  const tradeMap = new Map<string, FxTradeExecutedPayload>();
  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as unknown as FxTradeExecutedPayload;
    tradeMap.set(p.tradeId.value, p);
  }

  // 2. Collect all SettlementConfirmed events with realisedPnlDelta === 0.
  type SettlementRecord = {
    eventId: string;
    tradeId: string;
    currencyPair: string;
    settledDate: string;
    payload: SettlementConfirmedPayload;
  };
  const zeroSettlements: SettlementRecord[] = [];
  for (const e of eventStore.replay({ type: "SettlementConfirmed" })) {
    const p = e.payload as unknown as SettlementConfirmedPayload;
    if (typeof p.realisedPnlDelta === "number" && p.realisedPnlDelta === 0) {
      zeroSettlements.push({
        eventId: e.event_id,
        tradeId: p.tradeId,
        currencyPair: p.currencyPair,
        settledDate: p.settledDate,
        payload: p,
      });
    }
  }

  if (zeroSettlements.length === 0) {
    logger.info(
      {},
      "backfill-fx-settlement-realised-pnl — no zero-realised SettlementConfirmed events found; nothing to do",
    );
    return 0;
  }

  // 3. Collect already-corrected trade IDs (idempotency).
  const alreadyCorrected = new Set<string>();
  try {
    for (const e of eventStore.replay({ type: "SettlementRealisedPnlCorrected" })) {
      const p = e.payload as unknown as { tradeId: string };
      if (p.tradeId) alreadyCorrected.add(p.tradeId);
    }
  } catch {
    // SettlementRealisedPnlCorrected not yet in store — first run.
  }

  // 4. Build the official-mark index.
  const officialMarks = buildOfficialMarkIndex();

  // 5. Emit corrections.
  let emitted = 0;
  let skipped = 0;
  let fallbacks = 0;

  for (const sc of zeroSettlements) {
    if (alreadyCorrected.has(sc.tradeId)) {
      skipped++;
      continue;
    }

    const trade = tradeMap.get(sc.tradeId);
    if (!trade) {
      logger.warn(
        { tradeId: sc.tradeId, settlementEventId: sc.eventId },
        "backfill-fx-settlement-realised-pnl — no FxTradeExecuted found for tradeId; skipping",
      );
      skipped++;
      continue;
    }

    const nearLeg = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];
    if (!nearLeg) {
      logger.warn(
        { tradeId: sc.tradeId },
        "backfill-fx-settlement-realised-pnl — trade has no near leg; skipping",
      );
      skipped++;
      continue;
    }

    const bookRate = nearLeg.rate.amount;
    const notionalBaseMinor = baseAmountMinor(nearLeg, trade.currencyPair);
    const isBuy = trade.side === "buy";

    // Resolve settlement rate.
    const rateResult = findSettlementRate(officialMarks, sc.currencyPair, sc.settledDate);
    let settlementRate: number;
    let rateSource: "official-mark" | "book-rate-fallback";

    if (rateResult) {
      settlementRate = rateResult.rate;
      rateSource = rateResult.rateSource;
    } else {
      // Fallback: use book rate → zero P&L (substrate gap).
      settlementRate = bookRate;
      rateSource = "book-rate-fallback";
      fallbacks++;
      logger.warn(
        {
          tradeId: sc.tradeId,
          currencyPair: sc.currencyPair,
          settledDate: sc.settledDate,
        },
        "backfill-fx-settlement-realised-pnl — no OfficialMarkAdopted found for pair/date; using book-rate-fallback (IAS 21 §28 substrate gap)",
      );
    }

    // IAS 21 §28: (r_settle − r_book) × N_base_minor × sign(side).
    const rateDelta = settlementRate - bookRate;
    const realisedPnlZarMinor = Math.round(
      (isBuy ? 1 : -1) * rateDelta * Math.abs(notionalBaseMinor),
    );

    const correctionEvent = makeSettlementRealisedPnlCorrected({
      asOf: sc.settledDate,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: sc.tradeId,
        originalSettlementEventId: sc.eventId,
        currencyPair: sc.currencyPair,
        realisedPnlZarMinor,
        settlementRate,
        bookRate,
        notionalBaseMinor,
        rateSource,
        settledDate: sc.settledDate,
        citations: CITATIONS,
      },
    });

    eventStore.append(correctionEvent);
    alreadyCorrected.add(sc.tradeId);
    emitted++;

    logger.info(
      {
        tradeId: sc.tradeId,
        originalEventId: sc.eventId,
        correctionEventId: correctionEvent.event_id,
        currencyPair: sc.currencyPair,
        settledDate: sc.settledDate,
        bookRate,
        settlementRate,
        rateSource,
        realisedPnlZarMinor,
        isBuy,
      },
      "backfill-fx-settlement-realised-pnl — correction emitted",
    );
  }

  logger.info(
    {
      totalZeroSettlements: zeroSettlements.length,
      emitted,
      skipped,
      fallbacks,
    },
    "backfill-fx-settlement-realised-pnl — complete",
  );

  return 0;
}

const exitCode = main();
process.exit(exitCode);
