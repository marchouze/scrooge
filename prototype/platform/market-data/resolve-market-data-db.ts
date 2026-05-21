// platform/market-data/resolve-market-data-db.ts
//
// Shared market-data DB resolution helper — mirrors the pattern of
// platform/event-store/resolve-event-db.ts.
//
// Resolution precedence (high → low):
//   1. `BANK_MARKET_DATA_DB` env var
//   2. `$HOME/.local/share/bank/market-data.db` (home-default shared store)
//   3. `.local/market-data.db` (per-worktree fallback; CI / fresh-clone)
//
// The home-default means the dashboard, ingest scripts, and MTM run all
// converge on a single file regardless of which directory they start from,
// fixing the "worktree CWD drift" class of bug (2026-05-21 incident:
// vigilant-swanson dashboard read its own empty .local/market-data.db
// while the ingest plist wrote to prototype/.local/market-data.db).
//
// Author: Atlas (Core banking platform architect, engineering)

import { homedir } from "node:os";
import { resolve } from "node:path";

export interface ResolvedMarketDataDb {
  path: string;
  source: "env" | "home-default" | "fallback";
}

const HOME_DEFAULT_SUBPATH = ".local/share/bank/market-data.db";

export function resolveMarketDataDbPath(): ResolvedMarketDataDb {
  const env = process.env.BANK_MARKET_DATA_DB?.trim();
  if (env) return { path: resolve(env), source: "env" };

  const home = homedir();
  if (home) return { path: resolve(home, HOME_DEFAULT_SUBPATH), source: "home-default" };

  return { path: resolve(".local/market-data.db"), source: "fallback" };
}
