// scripts/close-orphan-reg-prin-settlement-2026-05-29.ts
//
// One-off lifecycle repair. The build-phase-fixture trade
// REG-PRIN-5a36856c-e92e-4201-8630-028fa9c1363a was injected into the shared
// event store on 2026-05-29, AFTER the 2026-05-28 settlement backfill wave had
// already closed its 15 identical REG-PRIN siblings. As a result it carries an
// FxTradeExecuted + a single PrincipalPayment but never received a terminal
// SettlementConfirmed, so the daily MTM engine keeps treating it as an open
// position (settlement date 2026-05-23, six days overdue) and revalues it,
// producing phantom unrealised P&L.
//
// This script emits the missing SettlementConfirmed, matching the shape and
// realised P&L of its 15 identical siblings (buy USD/ZAR, USD 1,000,000
// notional, book rate 18.5, settled 2026-05-23 at the same ~16.453 mark →
// realised −ZAR 2,046,950). Idempotent: skips if already settled.
//
// Per IAS 21 §28 — exchange differences on settlement recognised in P&L.
//
// Authority: PR-FX-LIFECYCLE-CLOSE; D-MARKETS-SCHEMA-FOUNDATION.

import { eventStore, logger } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { makeSettlementConfirmed } from "../platform/markets/cdm/fx";

const TRADE_ID = "REG-PRIN-5a36856c-e92e-4201-8630-028fa9c1363a";
const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "scrooge:close-orphan-reg-prin-settlement" };

// Realised P&L matches all 15 identical settled siblings (same pair, notional,
// book rate, settlement date → same settlement-date mark).
const REALISED_PNL_DELTA_ZAR_MINOR = -204_695_000;

function alreadySettled(): boolean {
  for (const e of eventStore.replay({ type: "SettlementConfirmed" })) {
    if ((e.payload as { tradeId?: string }).tradeId === TRADE_ID) return true;
  }
  return false;
}

function main(): void {
  if (alreadySettled()) {
    logger.info({ tradeId: TRADE_ID }, "close-orphan-reg-prin: already settled — no-op");
    return;
  }

  const event = makeSettlementConfirmed({
    asOf: "2026-05-23",
    entity: ENTITY,
    actor: ACTOR,
    citations: ["IAS-21-§28", "D-MARKETS-SCHEMA-FOUNDATION", "PR-FX-LIFECYCLE-CLOSE"],
    payload: {
      tradeId: TRADE_ID,
      currencyPair: "USD/ZAR",
      settledDate: "2026-05-23",
      realisedPnlDelta: REALISED_PNL_DELTA_ZAR_MINOR,
      settlementRef: "BACKFILL-5a36856c",
      citations: ["IAS-21-§28", "D-MARKETS-SCHEMA-FOUNDATION", "PR-FX-LIFECYCLE-CLOSE"],
    },
    eventId: newEventId(),
  });

  // Match siblings' lineage exactly: build-phase-fixture / pre-substrate-backfill.
  const tagged = {
    ...event,
    provenance: { kind: "build-phase-fixture" as const, sourceLineage: "pre-substrate-backfill" },
  };

  eventStore.append(tagged);
  logger.info(
    { tradeId: TRADE_ID, realisedPnlDelta: REALISED_PNL_DELTA_ZAR_MINOR },
    "close-orphan-reg-prin: SettlementConfirmed emitted",
  );
}

main();
