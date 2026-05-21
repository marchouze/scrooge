// platform/event-store/resolve-event-db.ts
//
// Shared event-DB resolution helper used by every surface that needs to
// decide which SQLite file to talk to:
//
//   - The dispatch CLIs (`open-brief`, `start-run`, `close-run`) call
//     `applyDispatchEventDbResolution` (the wrapper at
//     `scripts/dispatch/resolve-event-db.ts`) at the top of each script,
//     BEFORE importing `platform/composition.ts`. The wrapper resolves
//     to the home-default shared store and mutates `BANK_EVENT_DB` so
//     composition picks it up.
//
//   - The interactive persona emission scripts (`approve-d-*.ts`,
//     `record-d-*.ts`, `file-*.ts`) opt into the shared HOME store by
//     importing the boot shim FIRST:
//
//       import "../platform/event-store/resolve-event-db-boot";
//
//     This is the fix for PR #695 (Helena (Chief Risk Officer,
//     governance)'s MR-1-FX IPV recalibration emission landed in the
//     per-worktree fallback because the script imported composition
//     directly without first resolving to the shared store).
//
//     EXCEPTION: the 8 `record-d-*` scripts referenced from
//     `migrate:decisions-backfill` in `package.json` DELIBERATELY do
//     NOT import the boot shim. They run as part of `bun run ci`, where
//     the rest of the tooling (backfill writers + recon readers +
//     citation gate) targets `prototype/.local/event.db`. Routing those
//     CI-chained scripts to the HOME store would split-brain the CI
//     event log. The interactive scripts (Helena's emission, Owen's
//     filing, etc.) keep the boot shim so end-users get the shared
//     store on their workstations.
//
//   - `platform/composition.ts` calls `resolveEventDbPath` directly with
//     `excludeHomeDefault: true`. The composition root must NOT silently
//     adopt the home-default store on its own — that would pollute the
//     CI fallback (`.local/event.db`) with events from other surfaces
//     and break recon pipelines (Atlas verified this empirically in the
//     2026-05-21 build of this slice). Callers that want the shared
//     store (dispatch CLIs, emission scripts) opt in by setting
//     `BANK_EVENT_DB` via the apply wrapper.
//
// Resolution precedence (high → low):
//   1. `opts.explicit` (e.g. `--event-db` CLI flag; caller override)
//   2. `BANK_EVENT_DB` env var (already-set ambient — tests, scenarios,
//      dispatch boot)
//   3. `BANK_HOME_EVENT_DB` env var (custom home location)
//   4. `$HOME/.local/share/bank/event.db` (home-default shared store;
//      SKIPPED when `excludeHomeDefault: true`)
//   5. fallback to `.local/event.db` (per-worktree; CI, fresh-clone)
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
  source: "explicit" | "env-bank-event-db" | "env-bank-home-event-db" | "home-default" | "fallback";
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
  /**
   * When `true`, the home-default tier is skipped — resolution jumps from
   * `BANK_HOME_EVENT_DB` straight to the per-worktree fallback. Used by
   * `platform/composition.ts` so the composition root does not silently
   * adopt the home store: dispatch CLIs + emission scripts opt in
   * explicitly via the apply wrapper.
   */
  excludeHomeDefault?: boolean;
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

  if (!opts.excludeHomeDefault) {
    const home = opts.home === undefined ? nonEmpty(homedir()) : nonEmpty(opts.home);
    if (home !== undefined) {
      return { path: resolve(home, HOME_DEFAULT_SUBPATH), source: "home-default", shared: true };
    }
  }

  return { path: resolve(".local/event.db"), source: "fallback", shared: false };
}

/**
 * Apply the home-default-enabled resolution + mutate `process.env.BANK_EVENT_DB`
 * so a downstream import of `platform/composition.ts` picks up the resolved
 * path. Intended for callers that want the shared HOME store: dispatch CLIs
 * and persona emission scripts (`approve-d-*.ts`, `record-d-*.ts`,
 * `file-*.ts`).
 *
 * MUST be called BEFORE the first import of `platform/composition.ts` —
 * composition reads `BANK_EVENT_DB` at module-load time.
 *
 * Returns the resolved descriptor. Idempotent: calling twice with the same
 * inputs yields the same result and leaves `process.env.BANK_EVENT_DB` set
 * to that path.
 *
 * Side-effect: mutates `process.env.BANK_EVENT_DB`. Does NOT print to
 * stderr; the dispatch-CLI variant
 * (`applyDispatchEventDbResolution` in `scripts/dispatch/resolve-event-db.ts`)
 * adds the audit log.
 */
export function applySharedEventDbResolution(opts?: { explicit?: string }): ResolvedEventDb {
  const result = resolveEventDbPath({ explicit: opts?.explicit });
  process.env.BANK_EVENT_DB = result.path;
  return result;
}
