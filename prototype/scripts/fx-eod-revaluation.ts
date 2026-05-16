// scripts/fx-eod-revaluation.ts
//
// CLI wrapper for the EOD FX position revaluation trigger.
//
// Usage:
//   bun run scripts/fx-eod-revaluation.ts [--date YYYY-MM-DD]
//
// Options:
//   --date  Valuation date (default: today UTC date).
//
// Authority: IAS-21-§28, IFRS-9-§5.7.1, D-MARKETS-CAPITAL-TIME-SHAPE
// Author: Anya (Data / analytics engineer, engineering)

import { EventStore } from "../platform/event-store/store";
import { runEodFxRevaluation, staticRateSource } from "../platform/markets/eod/fx-revaluation";

const args = process.argv.slice(2);
const dateFlag = args.indexOf("--date");
const valuationDate =
  dateFlag >= 0 && args[dateFlag + 1] ? args[dateFlag + 1] : new Date().toISOString().slice(0, 10);

const dbPath = process.env.BANK_EVENT_DB_PATH ?? ".local/event.db";
const store = new EventStore(dbPath);

console.log(`[eod-fx-revaluation] Running for valuationDate=${valuationDate}`);

const result = runEodFxRevaluation(store, valuationDate, staticRateSource);

console.log(
  `[eod-fx-revaluation] Done — revalued=${result.revalued} skipped=${result.skipped} asOf=${result.asOf}`,
);
