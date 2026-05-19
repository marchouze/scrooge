// scripts/migrate/cancel-bad-fx-trades.ts
//
// Emits FxTradeCancelled for each of the 15 bad simulated FX trades that were
// booked with incorrect seed rates (book rates used wrong currency convention),
// producing a synthetic P&L loss of ZAR −759,908,692.
//
// Idempotent: re-running skips trades that already have a FxTradeCancelled
// event in the store.
//
// Authority: CEO instruction 2026-05-19 (brief:devon:fx-trade-cancellation-
//   substrate-cancel-15-bad-si:2026-05-19).
//
// Author: Devon (Chief Technology Officer, engineering)

import { eventStore } from "../../platform/composition";
import { nowUtc } from "../../platform/core/types";
import { makeFxTradeCancelled } from "../../platform/event-store/event-types/fx-accounting";
import type { Event } from "../../platform/event-store/types";

// ---------------------------------------------------------------------------
// The 15 bad trade IDs
// ---------------------------------------------------------------------------

const BAD_TRADE_IDS: string[] = [
  "SIM-1779130547186-FFEB7A59",
  "SIM-1779130553777-5987C15E",
  "SIM-1779130556905-44388214",
  "SIM-1779130560743-9CACA1CE",
  "SIM-1779130565886-0239889C",
  "SIM-1779130568387-BF52FEF7",
  "SIM-1779130573120-24BAF01F",
  "SIM-1779130575776-6D78F642",
  "SIM-1779130582813-4A35F4CD",
  "SIM-1779130586496-5EF52D23",
  "SIM-1779130649150-C089E71E",
  "SIM-1779130653368-1F327500",
  "SIM-1779130656455-26CD1F67",
  "SIM-1779130660382-E5209293",
  "SIM-1779130667952-B070755D",
];

const CANCELLATION_CITATIONS = [
  "D-FX-SALES-TRADING-FRONTEND",
  "D-MARKETS-SCHEMA-FOUNDATION",
  // CEO instruction: cancel 15 bad simulated trades (2026-05-19)
  "[CEO-instruction:2026-05-19:cancel-bad-sim-fx-trades]",
] as const;

// ---------------------------------------------------------------------------
// Build lookup: tradeId.value → event_id from FxTradeExecuted events
// ---------------------------------------------------------------------------

function buildTradeEventIdMap(events: Event[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of events) {
    if (e.type !== "FxTradeExecuted") continue;
    const p = e.payload as Record<string, unknown>;
    const tradeIdRaw = p.tradeId as Record<string, unknown> | string | undefined;
    const tradeIdValue =
      typeof tradeIdRaw === "string"
        ? tradeIdRaw
        : typeof tradeIdRaw?.value === "string"
          ? tradeIdRaw.value
          : null;
    if (tradeIdValue) {
      m.set(tradeIdValue, e.event_id);
    }
  }
  return m;
}

// ---------------------------------------------------------------------------
// Build set of already-cancelled trade IDs (idempotency guard)
// ---------------------------------------------------------------------------

function buildAlreadyCancelledSet(events: Event[]): Set<string> {
  const s = new Set<string>();
  for (const e of events) {
    if (e.type !== "FxTradeCancelled") continue;
    const p = e.payload as Record<string, unknown>;
    if (typeof p.tradeId === "string") {
      s.add(p.tradeId);
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("[cancel-bad-fx-trades] Starting cancellation script…");

  const allEvents = [...eventStore.replay()];
  const tradeEventIdMap = buildTradeEventIdMap(allEvents);
  const alreadyCancelled = buildAlreadyCancelledSet(allEvents);

  const asOf = nowUtc();
  let emitted = 0;
  let skippedAlreadyCancelled = 0;
  let skippedNotFound = 0;

  for (const tradeId of BAD_TRADE_IDS) {
    if (alreadyCancelled.has(tradeId)) {
      console.log(`  [skip] ${tradeId} — already cancelled`);
      skippedAlreadyCancelled++;
      continue;
    }

    const originalEventId = tradeEventIdMap.get(tradeId);
    if (!originalEventId) {
      console.log(`  [skip] ${tradeId} — no matching FxTradeExecuted in this store`);
      skippedNotFound++;
      continue;
    }

    const cancelEvent = makeFxTradeCancelled({
      asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:devon:cancel-bad-fx-trades" },
      citations: [...CANCELLATION_CITATIONS],
      payload: {
        tradeId,
        reason:
          "Seed rates used wrong currency convention (book rates applied inverse of intended ZAR/USD rate), producing synthetic P&L of ZAR −759,908,692. CEO-instructed cancellation 2026-05-19.",
        cancelledBy: "devon:cto:cancel-bad-fx-trades-script",
        originalEventId,
      },
    });

    eventStore.append(cancelEvent);
    console.log(`  [emit] FxTradeCancelled for ${tradeId} (originalEventId=${originalEventId})`);
    emitted++;
  }

  console.log(
    `[cancel-bad-fx-trades] Done. emitted=${emitted} skipped-already-cancelled=${skippedAlreadyCancelled} skipped-not-found=${skippedNotFound}`,
  );
}

main();
