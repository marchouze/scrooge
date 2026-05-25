// scripts/backfill-credit-limits-sim-2026-05-25.ts
//
// One-time backfill: emit a CreditLimitLoaded event for each counterparty
// that has risk-attracting trade events but no prior CreditLimitLoaded in
// the shared event store. Simulation counterparties were booked via the FX
// simulator before the credit-limit engine (D-CREDIT-LIMIT-ENGINE-BUILD) was
// operational; this backfill retroactively loads the limits.
//
// Idempotent: checks the event store for an existing CreditLimitLoaded for
// each counterpartyId before emitting — safe to re-run.
//
// How to run (from prototype/):
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/backfill-credit-limits-sim-2026-05-25.ts
//
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../platform/composition";
import { BANK_ZA_001, newEventId } from "../platform/core/types";
import {
  type CreditLimitLoadedPayload,
  makeCreditLimitLoaded,
} from "../platform/event-store/event-types/credit-limit";
import { logger } from "../platform/observability/logger";

// ---------------------------------------------------------------------------
// Counterparty extraction — mirrors credit-limit-no-trade-without-loaded.ts
// ---------------------------------------------------------------------------

const TRADE_EVENT_TYPES = [
  "TradeBooked",
  "TradeExecuted",
  "FxTradeExecuted",
  "FxTradeBooked",
  "OrderFilled",
  "OrderAccepted",
] as const;

function extractCounterpartyId(payload: Record<string, unknown>): string | null {
  const cpid = payload.counterpartyId;
  if (typeof cpid === "string" && cpid.length > 0) return cpid;
  const lei = payload.counterpartyLei;
  if (typeof lei === "string" && lei.length > 0) return lei;
  const cp = payload.counterparty;
  if (cp && typeof cp === "object") {
    const partyId = (cp as Record<string, unknown>).partyId;
    if (typeof partyId === "string" && partyId.length > 0) return partyId;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  // Build set of counterparties already loaded.
  const alreadyLoaded = new Set<string>();
  for (const e of eventStore.replay({ type: "CreditLimitLoaded" })) {
    const cpid = (e.payload as Record<string, unknown>).counterpartyId;
    if (typeof cpid === "string") alreadyLoaded.add(cpid);
  }

  // Collect earliest trade timestamp per counterparty.
  const earliestTrade = new Map<string, string>();
  for (const type of TRADE_EVENT_TYPES) {
    for (const e of eventStore.replay({ type })) {
      const cpid = extractCounterpartyId((e.payload ?? {}) as Record<string, unknown>);
      if (!cpid) continue;
      const cur = earliestTrade.get(cpid);
      if (!cur || e.as_of < cur) earliestTrade.set(cpid, e.as_of);
    }
  }

  let emitted = 0;
  let skipped = 0;

  for (const [cpid, firstTradeAt] of earliestTrade) {
    if (alreadyLoaded.has(cpid)) {
      logger.info({ counterpartyId: cpid }, "backfill-credit-limits — skipped (already loaded)");
      skipped += 1;
      continue;
    }

    // Back-date the load to 1 minute before the first trade.
    const tradeMs = new Date(firstTradeAt).getTime();
    const loadedAt = new Date(tradeMs - 60_000).toISOString();

    const payload: CreditLimitLoadedPayload = {
      counterpartyId: cpid,
      limit: 50_000_000,
      currency: "ZAR",
      loadedAt,
      effectiveFrom: loadedAt,
      loadedBy: "backfill:atlas",
    };

    const event = makeCreditLimitLoaded({
      asOf: loadedAt,
      entity: BANK_ZA_001 as string,
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["D-CREDIT-LIMIT-ENGINE-BUILD"],
      payload,
      eventId: newEventId(),
    });

    eventStore.append(event);
    logger.info(
      { counterpartyId: cpid, loadedAt, limit: 50_000_000 },
      "backfill-credit-limits — CreditLimitLoaded emitted",
    );
    emitted += 1;
  }

  logger.info({ emitted, skipped, total: earliestTrade.size }, "backfill-credit-limits — complete");

  return 0;
}

process.exit(main());
