// scripts/fx-forward-eod-revaluation.ts
//
// CLI wrapper for the EOD FX forward / swap / NDF mark-to-market revaluation.
//
// Usage:
//   bun run scripts/fx-forward-eod-revaluation.ts [--date YYYY-MM-DD]
//
// Options:
//   --date  Valuation date (default: today UTC date).
//
// Companion to scripts/fx-eod-revaluation.ts (spot). Run both together
// for a complete EOD FX mark-to-market cycle:
//   bun run scripts/fx-eod-revaluation.ts --date <date>
//   bun run scripts/fx-forward-eod-revaluation.ts --date <date>
//
// Authority:
//   IAS-21-§28
//   IFRS-9-§5.7.1
//   D-MARKETS-SCHEMA-FOUNDATION
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
//
// Authors: Bea (Accounting & financial reporting engineer, engineering)
//          Kai (Derivatives & structured products engineer, engineering)

import { EventStore } from "../platform/event-store/store";
import {
  runEodFxForwardRevaluation,
  staticForwardRateSource,
} from "../platform/markets/eod/fx-forward-revaluation";

const args = process.argv.slice(2);
const dateFlag = args.indexOf("--date");
const valuationDate =
  dateFlag >= 0 && args[dateFlag + 1] ? args[dateFlag + 1] : new Date().toISOString().slice(0, 10);

const dbPath = process.env.BANK_EVENT_DB_PATH ?? ".local/event.db";
const store = new EventStore(dbPath);

console.log(`[eod-fx-forward-revaluation] Running for valuationDate=${valuationDate}`);

const result = runEodFxForwardRevaluation(store, valuationDate, staticForwardRateSource);

if (result.errors.length > 0) {
  console.warn(`[eod-fx-forward-revaluation] Errors encountered:`);
  for (const err of result.errors) {
    console.warn(`  - ${err}`);
  }
}

console.log(
  `[eod-fx-forward-revaluation] Done — revalued=${result.revalued} skipped=${result.skipped} asOf=${result.asOf} errors=${result.errors.length}`,
);
