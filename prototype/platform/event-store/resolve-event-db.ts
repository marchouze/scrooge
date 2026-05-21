// platform/event-store/resolve-event-db.ts
//
// Shared event-DB resolution helper used by every surface that needs to
// decide which SQLite file to talk to:
//
//   - `platform/composition.ts` (the canonical composition root — anyone
//     who imports `eventStore` / `clock` automatically targets the
//     resolved store)
//   - The dispatch CLIs (`open-brief`, `start-run`, `close-run`) call
//     `applyDispatchEventDbResolution` (the wrapper at
//     `scripts/dispatch/resolve-event-db.ts`) at the top of each script,
//     before importing `platform/composition`
//   - The `approve-d-*.ts` / `record-d-*.ts` / `file-*.ts` emission
//     scripts (indirectly — they import from composition)
//
// Why this lives at `platform/event-store/` rather than `scripts/dispatch/`.
// Before this slice, the only callsite was the dispatch CLIs, so the
// resolver sat under `scripts/dispatch/`. PR #695 (Helena's MR-1-FX IPV
// recalibration) surfaced the cost: persona emission scripts that import
// from `platform/composition.ts` used a *different* (looser) precedence
// chain. Helena's events landed in the per-worktree fallback while
// dispatch CLI events landed in the home-default store — silent
// mis-targeting. The fix is to make the same resolver authoritative for
// every consumer; lifting it into `platform/event-store/` reflects that.
//
// Resolution precedence (high → low):
//   1. `opts.explicit` (e.g. `--event-db` CLI flag; caller override)
//   2. `BANK_EVENT_DB` env var (already-set ambient — tests, scenarios)
//   3. `BANK_HOME_EVENT_DB` env var (custom home location)
//   4. `$HOME/.local/share/bank/event.db` (default shared store)
//   5. fallback to `.local/event.db` (per-worktree; CI, fresh-clone, error
//      recovery) — only when `$HOME` is unresolvable. The caller is
//      expected to log a warning when this fires.
//
// The helper is pure: it does NOT mutate `process.env`, does NOT print to
// stderr, does NOT touch the filesystem. Side-effects belong to the
// caller (`applyDispatchEventDbResolution` in `scripts/dispatch/`, or
// the composition root's one-line debug log).
//
// Authority:
//   - D-CROSS-WORKTREE-EVENT-STORE-SYNC (CEO session-delegation, 2026-05-21)
//   - brief:atlas:shared-event-db-resolution-across-dispatch-clis-:2026-05-21
//
// Author: Atlas (Core banking platform architect, engineering)

import { homedir } from "node:os";
import { resolve } from "node:path";

export interface ResolvedEventDb {
  /** Absolute path the caller should open. */
  path: string;
  /** Which resolution rule fired. */
  source:
    | "explicit"
    | "env-bank-event-db"
    | "env-bank-home-event-db"
    | "home-default"
    | "fallback";
  /**
   * `true` when this is a shared store (home-default or BANK_HOME_EVENT_DB);
   * `false` for explicit / BANK_EVENT_DB / fallback — those may or may not
   * be shared and we cannot know from the path alone, so we conservatively
   * mark them non-shared.
   */
  shared: boolean;
}

/**
 * Inputs to the resolver. All optional; environment defaults are read in
 * `resolveEventDbPath` itself if you do not provide them, which is the
 * usual mode. The injectable shape exists for tests + the boot shim.
 */
export interface ResolveEventDbInputs {
  /** `--event-db` CLI flag or any other caller-supplied override. */
  explicit?: string | undefined;
  /** Read from `process.env.BANK_EVENT_DB` by default. */
  envBankEventDb?: string | undefined;
  /** Read from `process.env.BANK_HOME_EVENT_DB` by default. */
  envBankHomeEventDb?: string | undefined;
  /** Read from `os.homedir()` by default. */
  home?: string | undefined;
}

const HOME_DEFAULT_SUBPATH = ".local/share/bank/event.db";

function nonEmpty(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Resolve the event-store path. Pure: never mutates env, never writes.
 *
 * Default mode (no inputs supplied) reads `process.env.BANK_EVENT_DB`,
 * `process.env.BANK_HOME_EVENT_DB`, and `os.homedir()` — the production
 * resolution. Tests inject everything explicitly to exercise the
 * precedence ladder without environment leakage.
 */
export function resolveEventDbPath(opts: ResolveEventDbInputs = {}): ResolvedEventDb {
  const explicit = nonEmpty(opts.explicit);
  if (explicit !== undefined) {
    return { path: resolve(explicit), source: "explicit", shared: false };
  }

  const envBankEventDb =
    opts.envBankEventDb === undefined
      ? nonEmpty(process.env.BANK_EVENT_DB)
      : nonEmpty(opts.envBankEventDb);
  if (envBankEventDb !== undefined) {
    return { path: resolve(envBankEventDb), source: "env-bank-event-db", shared: false };
  }

  const envBankHomeEventDb =
    opts.envBankHomeEventDb === undefined
      ? nonEmpty(process.env.BANK_HOME_EVENT_DB)
      : nonEmpty(opts.envBankHomeEventDb);
  if (envBankHomeEventDb !== undefined) {
    return {
      path: resolve(envBankHomeEventDb),
      source: "env-bank-home-event-db",
      shared: true,
    };
  }

  const home = opts.home === undefined ? nonEmpty(homedir()) : nonEmpty(opts.home);
  if (home !== undefined) {
    return { path: resolve(home, HOME_DEFAULT_SUBPATH), source: "home-default", shared: true };
  }

  return { path: resolve(".local/event.db"), source: "fallback", shared: false };
}
