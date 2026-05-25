// platform/market-data/resolve-market-data-db.ts
//
// Shared market-data DB resolution helper — mirrors the pattern of
// platform/event-store/resolve-event-db.ts.
//
// Resolution precedence (high → low):
//   1. `BANK_MARKET_DATA_DB` env var
//   2. `getBankConfig().marketDataDb` (centralized config store; default:
//      $HOME/.local/share/bank/market-data.db)
//
// The cwd-relative `.local/market-data.db` fallback has been removed — it
// was the source of the split-DB bug (2026-05-21 incident: vigilant-swanson
// dashboard read its own empty .local/market-data.db while the ingest plist
// wrote to prototype/.local/market-data.db). The centralized config store
// ensures all processes converge on a single file regardless of cwd.
//
// Authority: D-BANK-CONFIG-STORE (centralized config, 2026-05-25)
// Author: Atlas (Core banking platform architect, engineering)

import { resolve } from "node:path";
import { getBankConfig } from "../config/loader";

export interface ResolvedMarketDataDb {
  path: string;
  source: "env" | "config";
}

export function resolveMarketDataDbPath(): ResolvedMarketDataDb {
  const env = process.env.BANK_MARKET_DATA_DB?.trim();
  if (env) return { path: resolve(env), source: "env" };

  return { path: getBankConfig().marketDataDb, source: "config" };
}
