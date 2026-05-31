/**
 * cancel-wrong-counter-notional-trades.ts
 *
 * Emits FxTradeCancelled for every FxTradeExecuted where the notional currency
 * equals the quote currency of the pair — those were booked with counter-notional
 * computed as notional × rate (wrong; should be notional ÷ rate), overstating
 * the position by ≈rate² (~342× USD/ZAR, ~400× EUR/ZAR).
 *
 * Root cause: PR #945 (merged 2026-05-31) fixes bookFxTrade for future trades.
 * This script voids the 159 already-stored events so projections (MTM, P&L,
 * VAR, limit utilisation) stop reading the inflated counterNotional.amountMinor.
 *
 * Authority: D-CANCEL-WRONG-COUNTER-NOTIONAL (CEO-approved 2026-05-31 session).
 *
 * Idempotent: already-cancelled tradeIds are skipped.
 *
 * Usage:
 *   cd prototype && BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/cancel-wrong-counter-notional-trades.ts
 */

import { eventStore } from "../platform/composition";
import { nowUtc } from "../platform/core/types";
import { makeFxTradeCancelled } from "../platform/event-store/event-types/fx-accounting";
import { recordDecision } from "../runtime/decisions/record";

// ---------------------------------------------------------------------------
// 1. Record the CEO decision (idempotent — recordDecision deduplicates on
//    decisionId + phase + as_of, so re-runs are safe).
// ---------------------------------------------------------------------------

const DECISION_ID = "D-CANCEL-WRONG-COUNTER-NOTIONAL";
const DECISION_TIMESTAMP = "2026-05-31T11:00:00.000Z";

recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Mass-cancel 159 FX trades with wrong counter-notional (quote-currency notional × rate bug)",
    category: "engineering",
    recommendation:
      "Cancel all FxTradeExecuted events where notional.currency equals currencyPair.quote " +
      "— those had counterNotional stored as notional × rate instead of notional ÷ rate, " +
      "overstating the counter leg by ≈rate². Fix PR #945 corrects future bookings; " +
      "this cancellation clears the phantom positions from the existing event log.",
    rationale:
      "159 live (non-cancelled) FxTradeExecuted events contain wrong counterNotional.amountMinor " +
      "values. Projections read counterNotional directly (fx-revaluation.ts:289, daily-pnl.ts:277) " +
      "so the inflated values feed MTM, P&L, VAR, and limit-utilisation until the events are voided. " +
      "125 are SIM- (simulated), 30 are REG-PRIN/REG-LCC (regulatory-scenario seed), 4 are MAN- " +
      "(manually booked, small notionals; the two real ones will be rebooked via the corrected form). " +
      "CEO elected option 1: mass-cancel all 159 as the cleanest corrective path.",
    sourceDocHashes: [],
    citations: ["D-FX-QUOTING-CONVENTION", "ee60f11d"],
    recordedVia: "scrooge:session-delegation",
  },
  DECISION_TIMESTAMP,
);

console.log(`Decision ${DECISION_ID} recorded (approved).`);

// ---------------------------------------------------------------------------
// 2. Build the set of affected tradeIds (quote-currency notional, not yet
//    cancelled) and the map to their original event_id.
// ---------------------------------------------------------------------------

type TradeIdField = { value?: string } | string;
type LegShape = { legKind?: string; notional?: { currency?: string } };
type FxTradeExecutedish = {
  tradeId?: TradeIdField;
  currencyPair?: { base?: string; quote?: string };
  legs?: LegShape[];
};
type FxTradeCancelledish = { tradeId?: string };

const allEvents = eventStore.replay({});

const cancelled = new Set<string>();
for (const ev of allEvents) {
  if (ev.type === "FxTradeCancelled") {
    const tid = (ev.payload as FxTradeCancelledish).tradeId;
    if (tid) cancelled.add(tid);
  }
}

// tradeId → originalEventId
const toCancel = new Map<string, string>();
for (const ev of allEvents) {
  if (ev.type !== "FxTradeExecuted") continue;
  const p = ev.payload as FxTradeExecutedish;
  const rawId = p.tradeId;
  const tradeId = typeof rawId === "string" ? rawId : (rawId?.value ?? "");
  if (!tradeId) continue;
  if (cancelled.has(tradeId)) continue;

  const quote = p.currencyPair?.quote ?? "";
  const legs = p.legs ?? [];
  const near = legs.find((l) => l.legKind === "near") ?? legs[0];
  if (!near) continue;

  const notionalCcy = near.notional?.currency ?? "";
  if (notionalCcy === quote && quote !== "") {
    toCancel.set(tradeId, ev.event_id);
  }
}

console.log(`\nAffected (not yet cancelled): ${toCancel.size}`);

if (toCancel.size === 0) {
  console.log("Nothing to cancel — all affected trades already cancelled.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 3. Emit FxTradeCancelled for each.
// ---------------------------------------------------------------------------

const REASON =
  "Counter-notional stored as notional×rate instead of notional÷rate for quote-currency " +
  "notionals (pre-PR #945 bug). Overstates counterNotional.amountMinor by ≈rate² " +
  "(~342× USD/ZAR, ~400× EUR/ZAR). Cancelled per D-CANCEL-WRONG-COUNTER-NOTIONAL " +
  "(CEO-approved 2026-05-31). SIM/REG trades not rebooked; MAN trades to be rebooked " +
  "via the corrected booking form.";

const ACTOR = {
  type: "system" as const,
  id: "system:migration:cancel-wrong-counter-notional-trades",
  name: "Migration: cancel wrong counter-notional trades",
} as const;

const CITATIONS = ["D-CANCEL-WRONG-COUNTER-NOTIONAL", "D-FX-QUOTING-CONVENTION"];

const ENTITY = "LE-ZA-HOZ-BANK";

const asOf = nowUtc();
let emitted = 0;
let skipped = 0;

for (const [tradeId, originalEventId] of toCancel.entries()) {
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
