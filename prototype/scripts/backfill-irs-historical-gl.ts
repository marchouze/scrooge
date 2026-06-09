// scripts/backfill-irs-historical-gl.ts
//
// Backfill — historical IRS book → GL (Principle 1: events are immutable).
//
// PR #1121 converged the IRS lifecycle onto the accounting `IrdSwap*` family:
// new bookings/revaluations now emit `IrdSwapTradeExecuted` /
// `IrdSwapPositionRevalued`, which the universal GL posting engine
// (`bea-gl-posting-engine.ts`) subscribes to (PR-IRS-001 / PR-IRS-002). But the
// IRS events booked BEFORE the cutover are markets-CDM-family events
// (`IrsTradeBooked` / `IrsPositionRevalued`) that NOTHING on the GL path
// consumes — so the historical IRS book posts NOTHING to the general ledger.
//
// This script reads each pre-cutover `Irs*` event and emits the corresponding
// `IrdSwap*` accounting event so the historical book posts to GL on the next
// posting-engine run. It is ADDITIVE (emits new events only; never mutates or
// deletes) and IDEMPOTENT (a deterministic per-source marker is checked against
// the store before each emit; a second run emits 0).
//
// ─── MAPPING (mirrors the merged engine, irs-revaluation.ts) ─────────────────
//   IrsTradeBooked    → IrdSwapTradeExecuted
//       instrumentType "irs"; role from bankPays (pay-fixed / receive-fixed);
//       notionalMinor / fixedRatePercent / dates / counterparty / currency from
//       the booking; npvMinor = 0 (at-market inception — the booking carries no
//       day-1 NPV, so PR-IRS-001 produces no day-1 GL posting, exactly as a live
//       at-market inception would); bookDesignation defaults to "trading".
//
//   IrsPositionRevalued → IrdSwapPositionRevalued (one per historical reval, in
//       chronological order):
//       npvClosingMinor = markToMarket.amountMinor (the historical fact, carried
//         forward — NOT recomputed);
//       npvOpeningMinor = the PRIOR reval's closing (0 for the first), exactly as
//         runEodIrsRevaluation derives the opening basis;
//       npvDeltaMinor   = closing − opening (drives PR-IRS-002);
//       revalDate       = the historical valuationDate;
//       dv01ByTenorBucket = reconstructed from the booking terms via the SHARED
//         engine helper computeIrsDv01ByTenorBucket (same bucketing rule the live
//         path uses). Omitted entirely if no band rounds to a non-zero
//         contribution (no fabricated empty grid).
//
// ─── IDEMPOTENCY ─────────────────────────────────────────────────────────────
//   Booking: skip if an IrdSwapTradeExecuted already exists for the tradeId.
//   Reval:   skip if an IrdSwapPositionRevalued already exists for
//            (tradeId, revalDate). Both keys are deterministic functions of the
//            source `Irs*` events, so re-running emits 0.
//
// ─── HOME-STORE SAFETY ───────────────────────────────────────────────────────
//   This script imports the shared-store boot shim (so Scrooge's home-store run
//   targets the canonical log). LOCALLY you MUST export BANK_EVENT_DB to a
//   tmpdir before running — BANK_EVENT_DB always takes precedence over the
//   home-default, so a tmp path keeps every dev / test run off the home store.
//
// Authority:
//   D-IRS-HISTORICAL-GL-BACKFILL
//   D-IRS-FAMILY-CONVERGE-ACCOUNTING (CEO-approved 2026-06-09)
//   IFRS-9-§4.1   (FVTPL classification)
//   IFRS-9-§5.7.1 (FVTPL revaluation through P&L)
//   D-MARKETS-SCHEMA-FOUNDATION
//   brief:mira:ws-ba-returns-irs-family-reconcile-idempotent-ba:2026-06-09
//
// Author: Mira (Regulatory reporting engineer, engineering)

// Opt into the shared HOME event-store BEFORE composition resolves its dbPath.
// BANK_EVENT_DB (set to a tmpdir in local/test runs) still wins over the home
// default, so this is safe: home-store on Scrooge's run, tmp on every dev run.
import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import {
  makeIrdSwapPositionRevalued,
  makeIrdSwapTradeExecuted,
} from "../platform/event-store/event-types/ird-accounting";
import type {
  IrsPositionRevaluedPayload,
  IrsTradeBookedPayload,
} from "../platform/markets/cdm/ird";
import { computeIrsDv01ByTenorBucket } from "../platform/markets/eod/irs-revaluation";
import { logger } from "../platform/observability/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:mira:backfill-irs-historical-gl" };
const BOOKING_CITATIONS = [
  "IFRS-9-§4.1",
  "D-IRS-FAMILY-CONVERGE-ACCOUNTING",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "brief:mira:ws-ba-returns-irs-family-reconcile-idempotent-ba:2026-06-09",
];
const REVAL_CITATIONS = [
  "IFRS-9-§5.7.1",
  "D-IRS-FAMILY-CONVERGE-ACCOUNTING",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "brief:mira:ws-ba-returns-irs-family-reconcile-idempotent-ba:2026-06-09",
];

// ---------------------------------------------------------------------------
// bankPays → IFRS swap role mapping (mirrors the merged engine).
// ---------------------------------------------------------------------------

function bankPaysToRole(bankPays: IrsTradeBookedPayload["bankPays"]): "pay-fixed" | "receive-fixed" {
  return bankPays === "fixed" ? "pay-fixed" : "receive-fixed";
}

export interface BackfillResult {
  /** IrdSwapTradeExecuted events emitted this run. */
  booked: number;
  /** IrdSwapPositionRevalued events emitted this run. */
  revals: number;
  /** Source Irs* events skipped because the IrdSwap* counterpart already exists. */
  skipped: number;
}

// ---------------------------------------------------------------------------
// Main backfill logic
// ---------------------------------------------------------------------------

export function runBackfill(asOf: string): BackfillResult {
  // 1. Collect IrsTradeBooked payloads keyed by tradeId.
  const trades = new Map<string, IrsTradeBookedPayload>();
  for (const e of eventStore.replay({ type: "IrsTradeBooked" })) {
    const p = e.payload as unknown as IrsTradeBookedPayload;
    trades.set(p.tradeId.value, p);
  }

  // 2. Collect IrsPositionRevalued payloads in replay (chronological) order.
  const revalsBySource: Array<{ eventId: string; payload: IrsPositionRevaluedPayload }> = [];
  for (const e of eventStore.replay({ type: "IrsPositionRevalued" })) {
    revalsBySource.push({
      eventId: e.event_id,
      payload: e.payload as unknown as IrsPositionRevaluedPayload,
    });
  }

  // 3. Idempotency indices over already-present IrdSwap* events.
  //    Booking marker: tradeId. Reval marker: `${tradeId}::${revalDate}`.
  const bookedTradeIds = new Set<string>();
  for (const e of eventStore.replay({ type: "IrdSwapTradeExecuted" })) {
    const p = e.payload as { tradeId?: string };
    if (typeof p.tradeId === "string") bookedTradeIds.add(p.tradeId);
  }
  const revaluedKeys = new Set<string>();
  for (const e of eventStore.replay({ type: "IrdSwapPositionRevalued" })) {
    const p = e.payload as { tradeId?: string; revalDate?: string };
    if (typeof p.tradeId === "string" && typeof p.revalDate === "string") {
      revaluedKeys.add(`${p.tradeId}::${p.revalDate}`);
    }
  }

  let booked = 0;
  let revals = 0;
  let skipped = 0;

  // 4. Backfill bookings.
  for (const [tradeId, trade] of trades) {
    if (bookedTradeIds.has(tradeId)) {
      skipped++;
      continue;
    }

    const event = makeIrdSwapTradeExecuted({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: BOOKING_CITATIONS,
      payload: {
        tradeId,
        instrumentType: "irs",
        role: bankPaysToRole(trade.bankPays),
        notionalMinor: trade.notional.amountMinor,
        // At-market inception: no day-1 NPV. PR-IRS-001 then produces no day-1
        // GL posting (correct for an at-market swap); the GL footprint comes from
        // the revaluations below.
        npvMinor: 0,
        fixedRatePercent: trade.fixedRate,
        tradeDate: trade.tradeDate.iso,
        startDate: trade.effectiveDate.iso,
        maturityDate: trade.maturityDate.iso,
        counterpartyLei: trade.counterparty.partyId,
        currency: trade.notional.currency,
        bookDesignation: "trading",
      },
      eventId: newEventId(),
    });
    eventStore.append(event);
    bookedTradeIds.add(tradeId);
    booked++;

    logger.info(
      { tradeId, sourceFamily: "IrsTradeBooked", emitted: "IrdSwapTradeExecuted" },
      "backfill-irs-historical-gl — booking backfilled",
    );
  }

  // 5. Backfill revaluations, chronologically per trade. priorClosing tracks the
  //    opening-NPV basis per trade EXACTLY as runEodIrsRevaluation does (the last
  //    closing seen — including any pre-existing IrdSwapPositionRevalued — is the
  //    next opening). Seed from any IrdSwap* revals already in the store so a
  //    partially-backfilled trade continues the delta chain correctly.
  const priorClosing = new Map<string, number>();
  for (const e of eventStore.replay({ type: "IrdSwapPositionRevalued" })) {
    const p = e.payload as { tradeId?: string; npvClosingMinor?: number };
    if (typeof p.tradeId === "string" && typeof p.npvClosingMinor === "number") {
      priorClosing.set(p.tradeId, p.npvClosingMinor);
    }
  }

  for (const { payload: reval } of revalsBySource) {
    const tradeId = reval.tradeId.value;
    const revalDate = reval.valuationDate;
    const key = `${tradeId}::${revalDate}`;

    if (revaluedKeys.has(key)) {
      skipped++;
      continue;
    }

    const trade = trades.get(tradeId);
    if (!trade) {
      logger.warn(
        { tradeId, revalDate },
        "backfill-irs-historical-gl — no IrsTradeBooked for revalued tradeId; skipping reval (cannot reconstruct DV01 buckets)",
      );
      skipped++;
      continue;
    }

    // Historical closing NPV = the recorded markToMarket (carried forward, not
    // recomputed). Opening = prior closing (0 for the first). Delta = diff.
    const npvClosingMinor = reval.markToMarket.amountMinor;
    const npvOpeningMinor = priorClosing.get(tradeId) ?? 0;
    const npvDeltaMinor = npvClosingMinor - npvOpeningMinor;

    // Reconstruct the per-tenor-bucket DV01 grid from the booking terms via the
    // SHARED engine helper (identical bucketing to the live reval path).
    const dv01ByTenorBucket = computeIrsDv01ByTenorBucket(trade, revalDate);
    const hasBuckets = Object.keys(dv01ByTenorBucket).length > 0;
    if (!hasBuckets) {
      logger.warn(
        { tradeId, revalDate },
        "backfill-irs-historical-gl — reval produced no reconstructable DV01 buckets (no remaining unsettled period rounds non-zero); emitting without buckets",
      );
    }

    const event = makeIrdSwapPositionRevalued({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: REVAL_CITATIONS,
      payload: {
        tradeId,
        npvDeltaMinor,
        npvClosingMinor,
        npvOpeningMinor,
        revalDate,
        currency: reval.markToMarket.currency,
        ...(hasBuckets ? { dv01ByTenorBucket } : {}),
      },
      eventId: newEventId(),
    });
    eventStore.append(event);
    revaluedKeys.add(key);
    priorClosing.set(tradeId, npvClosingMinor);
    revals++;

    logger.info(
      { tradeId, revalDate, npvClosingMinor, npvOpeningMinor, npvDeltaMinor, hasBuckets },
      "backfill-irs-historical-gl — revaluation backfilled",
    );
  }

  return { booked, revals, skipped };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): number {
  const asOf = new Date().toISOString();
  const result = runBackfill(asOf);
  logger.info(
    { booked: result.booked, revals: result.revals, skipped: result.skipped },
    `backfill-irs-historical-gl — complete: booked ${result.booked}, revals ${result.revals}, skipped ${result.skipped}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `backfill-irs-historical-gl: booked ${result.booked}, revals ${result.revals}, skipped ${result.skipped}`,
  );
  return 0;
}

// Run only when invoked directly (not when imported by the test).
if (import.meta.main) {
  process.exit(main());
}
