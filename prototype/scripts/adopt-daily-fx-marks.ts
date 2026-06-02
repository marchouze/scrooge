// scripts/adopt-daily-fx-marks.ts
//
// Adopt daily official FX marks for the whole production feed universe for one
// or more as-of days — decoupled from position revaluation.
//
// This is the standalone form of the step now wired into the daily MTM run
// (scripts/mtm-run.ts + runtime/agents/rohan-daily-mtm.ts). Use it to back-fill
// a day's official marks without re-running a full MTM (e.g. when a pair started
// trading after the last MTM run, leaving Product-Control P&L Attribution failing
// "missing input marketMoveMarks" for that pair). Idempotent: a pair already
// marked for the elected tick's day is skipped.
//
// Usage:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//   BANK_MARKET_DATA_DB=$HOME/.local/share/bank/market-data.db \
//   bun run scripts/adopt-daily-fx-marks.ts 2026-06-01 [2026-06-02 ...]
//
// Defaults to today (UTC) when no as-of day is given.
//
// Authority: D-EVENT-VIEW-BOUNDARY-WIRE; D-TRUSTED-FIGURES-PROGRAM-V1.

import { nowUtc } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import { resolveMarketDataDbPath } from "../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../platform/market-data/store";
import {
  adoptDailyOfficialFxMarks,
  resolveActivePolicyVersionRef,
} from "../platform/valuation/mark-adoption-engine";

function main(): void {
  const days = process.argv.slice(2).filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const asOfDays = days.length > 0 ? days : [nowUtc().slice(0, 10)];

  const eventDbPath = process.env.BANK_EVENT_DB;
  if (!eventDbPath) {
    console.error("[adopt-daily-fx-marks] ERROR: BANK_EVENT_DB not set.");
    process.exit(1);
  }
  const marketDbPath = resolveMarketDataDbPath().path;

  const store = new EventStore(eventDbPath);
  const mdStore = new MarketDataStore(marketDbPath);

  const policyVersionRef = resolveActivePolicyVersionRef(store);
  if (!policyVersionRef) {
    console.error(
      "[adopt-daily-fx-marks] ERROR: no active PolicyVersionActivated for domain=valuation. " +
        "Run `bun run backfill:policy-activations` first.",
    );
    mdStore.close();
    store.close();
    process.exit(1);
  }

  for (const asOf of asOfDays) {
    const res = adoptDailyOfficialFxMarks(store, mdStore, asOf, policyVersionRef);
    console.log(
      `[adopt-daily-fx-marks] ${asOf} — adopted ${res.adopted.length} (${res.adopted.join(", ") || "none"}), ` +
        `skipped ${res.skipped.length} already-marked, ${res.noRate.length} no-rate`,
    );
  }

  mdStore.close();
  store.close();
}

main();
