/**
 * cancel-oversized-manual-sim-trades-2026-06-01.ts
 *
 * Cancels 12 manually-booked simulated FX trades from the 2026-06-01 11:47 UTC
 * batch that have astronomically large notionals (ZAR 33–483bn, GBP/AUD/CHF/EUR
 * in the billions), likely caused by entering values in minor units or some other
 * input error via trade-book.html.
 *
 * Trade 1 of the batch (MAN-1780314446658-8E21600D, ZAR 124k CHF/ZAR) is normal
 * and is NOT cancelled.
 *
 * Authority: D-CANCEL-OVERSIZED-MANUAL-SIM-2026-06-01 (CEO-approved 2026-06-01 session).
 *
 * Idempotent: already-cancelled tradeIds are skipped.
 *
 * Usage:
 *   cd prototype && BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/cancel-oversized-manual-sim-trades-2026-06-01.ts
 */

import { eventStore } from "../platform/composition";
import { nowUtc } from "../platform/core/types";
import { makeFxTradeCancelled } from "../platform/event-store/event-types/fx-accounting";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-CANCEL-OVERSIZED-MANUAL-SIM-2026-06-01";
const DECISION_TIMESTAMP = "2026-06-01T12:00:00.000Z";

recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Cancel 12 oversized simulated manual FX trades booked 2026-06-01 with implausible notionals",
    category: "engineering",
    recommendation:
      "Cancel the 12 MAN-prefix simulated trades from the 11:47 UTC batch that have notionals " +
      "in the hundreds of billions (ZAR 33–483bn, GBP 7–21bn, AUD 18–40bn, CHF 7–12bn, EUR implied). " +
      "Retain MAN-1780314446658-8E21600D (ZAR 124k CHF/ZAR, normal size).",
    rationale:
      "13 simulated trades were booked via trade-book.html in a 40-second burst at 11:47 UTC. " +
      "Trade 1 had a plausible notional (ZAR 124k). Trades 2–13 had notionals 100,000–4,000,000× " +
      "larger, consistent with values entered in minor units rather than major units, or some other " +
      "input error. All 13 are provenance:simulated so no real positions are affected, but they " +
      "inflate exposure metrics, P&L reports, and limit-utilisation. CEO elected to cancel all 12 " +
      "oversized trades. No rebook needed (simulated).",
    sourceDocHashes: [],
    citations: [],
    recordedVia: "scrooge:session-delegation",
  },
  DECISION_TIMESTAMP,
);

console.log(`Decision ${DECISION_ID} recorded (approved).`);

const TRADE_IDS_TO_CANCEL = [
  "MAN-1780314468839-14F26A3A",
  "MAN-1780314469960-78B620B4",
  "MAN-1780314471554-42FFA579",
  "MAN-1780314472783-AECB8779",
  "MAN-1780314474706-0E12656B",
  "MAN-1780314476706-2D31E1C1",
  "MAN-1780314478238-894A2E72",
  "MAN-1780314480161-C473DB5F",
  "MAN-1780314481647-2DBEF78F",
  "MAN-1780314483308-CCA09D2C",
  "MAN-1780314485368-0318CE68",
  "MAN-1780314487169-6FDB38B3",
];

type TradeIdField = { value?: string } | string;
type FxTradeCancelledish = { tradeId?: string };
type FxTradeExecutedish = { tradeId?: TradeIdField };

const allEvents = Array.from(eventStore.replay({}));

const cancelled = new Set<string>();
for (const ev of allEvents) {
  if (ev.type === "FxTradeCancelled") {
    const tid = (ev.payload as FxTradeCancelledish).tradeId;
    if (tid) cancelled.add(tid);
  }
}

// Build tradeId → originalEventId map
const originalEventIds = new Map<string, string>();
for (const ev of allEvents) {
  if (ev.type !== "FxTradeExecuted") continue;
  const p = ev.payload as FxTradeExecutedish;
  const rawId = p.tradeId;
  const tradeId = typeof rawId === "string" ? rawId : (rawId?.value ?? "");
  if (TRADE_IDS_TO_CANCEL.includes(tradeId)) {
    originalEventIds.set(tradeId, ev.event_id);
  }
}

const REASON =
  "Oversized simulated manual trade from 2026-06-01 11:47 UTC batch. Notional implausibly large " +
  "(hundreds of billions) — likely input error via trade-book.html (values entered in minor units). " +
  "Cancelled per D-CANCEL-OVERSIZED-MANUAL-SIM-2026-06-01 (CEO-approved 2026-06-01). " +
  "Provenance: simulated; no rebook required.";

const ACTOR = {
  type: "system" as const,
  id: "system:migration:cancel-oversized-manual-sim-2026-06-01",
  name: "Migration: cancel oversized manual sim trades 2026-06-01",
} as const;

const CITATIONS = [DECISION_ID];
const ENTITY = "LE-ZA-HOZ-BANK";
const asOf = nowUtc();

let emitted = 0;
let skipped = 0;

for (const tradeId of TRADE_IDS_TO_CANCEL) {
  if (cancelled.has(tradeId)) {
    console.log(`  already cancelled: ${tradeId}`);
    skipped++;
    continue;
  }

  const originalEventId = originalEventIds.get(tradeId);
  if (!originalEventId) {
    console.warn(`  not found in event store: ${tradeId}`);
    skipped++;
    continue;
  }

  try {
    const ev = makeFxTradeCancelled({
      asOf,
      entity: ENTITY,
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
