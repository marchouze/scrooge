/**
 * cancel-unseeded-fixture-fx-trades.ts
 *
 * Emits FxTradeCancelled for every FxTradeExecuted that carries
 * provenance.kind === "build-phase-fixture" but has NOT gone through the
 * proper trade lifecycle (i.e. has no matching FxTradeCancelled or
 * FxSettlementInstructed event).
 *
 * These are backfill artifacts emitted by Saskia's pre-substrate runs
 * (REG-PRIN-*, REG-LCC-*, REG-IDEMP-* IDs) — they were never booked via
 * the FX booking UI / Kai RFQ flow and were never settled. Simulated trades
 * (provenance.kind === "simulated") are untouched and remain in all risk calcs.
 *
 * Safe to run multiple times — idempotent via the existing FxTradeCancelled
 * check.
 *
 * Usage:
 *   bun run scripts/cancel-unseeded-fixture-fx-trades.ts
 *   BANK_SCENARIO_SHARED=1 bun run scripts/cancel-unseeded-fixture-fx-trades.ts
 */

import { eventStore } from "../platform/composition";
import { nowUtc } from "../platform/core/types";
import { makeFxTradeCancelled } from "../platform/event-store/event-types/fx-accounting";

const REASON =
  "build-phase-fixture trade not run through proper FX trade lifecycle " +
  "(no booking via Kai RFQ / FX UI, no settlement). " +
  "Cancelled by migration: cancel-unseeded-fixture-fx-trades.ts. " +
  "CEO-instructed cleanup 2026-05-23.";

const ACTOR = {
  type: "system" as const,
  id: "system:migration:cancel-unseeded-fixture-fx-trades",
  name: "Migration: cancel unseeded fixture FX trades",
} as const;

const CITATIONS = ["[citation: TBC — build-phase-fixture cleanup, CEO session 2026-05-23]"];

function run() {
  const allEvents = eventStore.replay({});

  // Index: tradeId → event_id for FxTradeExecuted with build-phase-fixture provenance
  const fixtureExecuted = new Map<string, string>(); // tradeId.value → event_id
  // Set of tradeIds already cancelled or settlement-instructed
  const closedTradeIds = new Set<string>();

  for (const ev of allEvents) {
    if (ev.type === "FxTradeExecuted") {
      const prov = ev.provenance as { kind?: string } | null | undefined;
      if (prov?.kind === "build-phase-fixture") {
        const tid = (ev.payload as { tradeId?: { value?: string } | string }).tradeId;
        const tradeIdValue = typeof tid === "string" ? tid : (tid as { value?: string })?.value;
        if (tradeIdValue) {
          fixtureExecuted.set(tradeIdValue, ev.event_id);
        }
      }
    }

    if (ev.type === "FxTradeCancelled") {
      const tid = (ev.payload as { tradeId?: string }).tradeId;
      if (tid) closedTradeIds.add(tid);
    }

    if (ev.type === "FxSettlementInstructed") {
      const tid = (ev.payload as { tradeId?: { value?: string } | string }).tradeId;
      const tradeIdValue = typeof tid === "string" ? tid : (tid as { value?: string })?.value;
      if (tradeIdValue) closedTradeIds.add(tradeIdValue);
    }
  }

  const toCancel = [...fixtureExecuted.entries()].filter(
    ([tradeId]) => !closedTradeIds.has(tradeId),
  );

  if (toCancel.length === 0) {
    console.log("Nothing to cancel — all build-phase-fixture FX trades are already closed.");
    return;
  }

  console.log(`Found ${toCancel.length} build-phase-fixture FX trade(s) to cancel.`);

  const asOf = nowUtc();
  let emitted = 0;
  let skipped = 0;

  for (const [tradeId, originalEventId] of toCancel) {
    try {
      const ev = makeFxTradeCancelled({
        asOf,
        entity: "LE-BANK-SA",
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId,
          reason: REASON,
          cancelledBy: ACTOR.id,
          originalEventId,
        },
      });
      eventStore.append(ev);
      console.log(`  cancelled: ${tradeId}`);
      emitted++;
    } catch (e) {
      console.warn(`  skipped ${tradeId}: ${(e as Error).message}`);
      skipped++;
    }
  }

  console.log(`\nDone. Cancelled: ${emitted}, skipped: ${skipped}.`);
}

run();
