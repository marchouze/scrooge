// scripts/dispatch/resolve-event-db.ts
//
// Cross-worktree event-store resolution for the dispatch CLIs
// (open-brief, start-run, close-run).
//
// Background. The Scrooge-coordinated-in-session dispatch model runs each
// agent in an isolated git worktree (per CLAUDE.md → Dispatch discipline →
// Worktree isolation). Until this module landed, each worktree's
// `dispatch:*` scripts wrote to a *per-worktree* `prototype/.local/event.db`
// — Scrooge's `AgentBriefIssued` event lived in the parent worktree's
// store; the dispatched agent's empty per-worktree store could not satisfy
// the `dispatch-sync-primitive` check in `close-run`. The workaround was
// `--force-close-bypass-sync true`, which was used 6× in a single session
// (2026-05-21) and broke `recon:dispatch-sync-integrity`'s ability to
// enforce reviewer→decider topology.
//
// Design choice — Option (A) shared event-store. A single canonical
// SQLite file at `$BANK_HOME_EVENT_DB` (default
// `$HOME/.local/share/bank/event.db`) is mounted by every worktree's
// `dispatch:*` CLI. Brief events written by Scrooge are immediately visible
// to the dispatched agent; lifecycle events written by the agent are
// immediately visible to recon. The cloud target (Principle 3, Azure
// Cosmos/Postgres) is the same model — a single shared store; the M8 cloud
// lift only changes the path.
//
// Why not (B) snapshot-and-sync. Sync-on-dispatch would require a
// bidirectional merge protocol when concurrent agents append to forked
// snapshots — exactly the complexity SQLite's WAL+lock already solves at
// the file-store layer when (A) is used. (B) also introduces a partial
// state during the agent run where recon sees the brief but not yet the
// agent's lifecycle events; the symmetry break is a Principle 1 erosion.
//
// Why not (C) seed-only events. A minimal `AgentBriefIssued`-only seed
// satisfies the immediate sync check but lifecycle events (`AgentRunStarted`,
// `AgentRunCompleted`) written in the agent's store never flow back to
// Scrooge's. The `recon:dispatch-sync-integrity` pipeline operating on
// Scrooge's store would still see "decider closed with no reviewer close",
// because the reviewer's close-event lives in the *reviewer's* worktree
// store. (A) is structurally cleaner.
//
// Resolution precedence (high → low):
//   1. `--event-db <path>` CLI flag (caller override; tests / scenarios)
//   2. `BANK_EVENT_DB` env var (already-set ambient)
//   3. `BANK_HOME_EVENT_DB` env var (custom home location)
//   4. `$HOME/.local/share/bank/event.db` (default shared store)
//   5. fallback to `.local/event.db` (per-worktree; CI, fresh-clone, error
//      recovery) — only when `$HOME` is unresolvable
//
// The resolver mutates `process.env.BANK_EVENT_DB` as a side-effect when
// it picks (3)/(4) so downstream `platform/composition.ts` (which reads
// `process.env.BANK_EVENT_DB` at import time) sees the resolved path. The
// resolved choice is printed once to stderr at INFO level for auditability.
//
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (CEO session-delegation,
// 2026-05-21). Brief: `brief:atlas:cross-worktree-event-store-sync-retire-force-clo:2026-05-21`.
//
// Author: Atlas (Core banking platform architect, engineering)

import { homedir } from "node:os";
import { resolve } from "node:path";

export interface ResolvedEventDb {
  /** Absolute path the dispatch CLI will use. */
  path: string;
  /** Which resolution rule fired. */
  source: "cli-flag" | "env-bank-event-db" | "env-bank-home-event-db" | "home-default" | "fallback";
  /** When true, this is a shared store; otherwise per-worktree. */
  shared: boolean;
}

const HOME_DEFAULT_SUBPATH = ".local/share/bank/event.db";

/**
 * Resolve which event-store path the dispatch CLI should use. Pure: does not
 * mutate env. Caller is responsible for `process.env.BANK_EVENT_DB = result.path`
 * before importing `platform/composition`.
 */
export function resolveDispatchEventDb(opts: {
  cliFlag?: string | undefined;
  envBankEventDb?: string | undefined;
  envBankHomeEventDb?: string | undefined;
  home?: string | undefined;
}): ResolvedEventDb {
  if (opts.cliFlag && opts.cliFlag.trim() !== "") {
    return { path: resolve(opts.cliFlag.trim()), source: "cli-flag", shared: false };
  }
  if (opts.envBankEventDb && opts.envBankEventDb.trim() !== "") {
    // Caller (tests, scenarios) set this explicitly — honour it. We can't
    // know from the env-var alone whether it points at a shared store or a
    // per-test temp dir, so mark `shared: false` conservatively.
    return { path: resolve(opts.envBankEventDb.trim()), source: "env-bank-event-db", shared: false };
  }
  if (opts.envBankHomeEventDb && opts.envBankHomeEventDb.trim() !== "") {
    return {
      path: resolve(opts.envBankHomeEventDb.trim()),
      source: "env-bank-home-event-db",
      shared: true,
    };
  }
  if (opts.home && opts.home.trim() !== "") {
    return {
      path: resolve(opts.home.trim(), HOME_DEFAULT_SUBPATH),
      source: "home-default",
      shared: true,
    };
  }
  return { path: resolve(".local/event.db"), source: "fallback", shared: false };
}

/**
 * Apply the resolution: read env + argv, mutate `process.env.BANK_EVENT_DB`,
 * print a one-line audit envelope to stderr, and return the result.
 *
 * Side effects:
 *   - `process.env.BANK_EVENT_DB` is set to the resolved path (idempotent).
 *   - One JSON line is written to stderr unless `silent: true`.
 *
 * MUST be called before importing `platform/composition`.
 */
export function applyDispatchEventDbResolution(opts?: {
  argv?: readonly string[];
  silent?: boolean;
}): ResolvedEventDb {
  const argv = opts?.argv ?? process.argv.slice(2);
  let cliFlag: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--event-db") {
      cliFlag = argv[i + 1];
      break;
    }
  }

  const result = resolveDispatchEventDb({
    cliFlag,
    envBankEventDb: process.env.BANK_EVENT_DB,
    envBankHomeEventDb: process.env.BANK_HOME_EVENT_DB,
    home: homedir(),
  });

  process.env.BANK_EVENT_DB = result.path;

  if (!opts?.silent) {
    console.error(
      JSON.stringify({
        level: "info",
        component: "dispatch:resolve-event-db",
        path: result.path,
        source: result.source,
        shared: result.shared,
        msg:
          result.source === "fallback"
            ? "Resolved to per-worktree fallback — $HOME unresolvable. Cross-worktree visibility will not work."
            : `Resolved event-store path (${result.source}, shared=${result.shared}).`,
      }),
    );
  }

  return result;
}
