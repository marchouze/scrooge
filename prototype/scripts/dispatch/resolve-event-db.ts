// scripts/dispatch/resolve-event-db.ts
//
// Dispatch-CLI boot adapter around the shared event-DB resolver.
//
// Pure resolution lives at `platform/event-store/resolve-event-db.ts` and is
// shared with the composition root (so persona emission scripts and dispatch
// CLIs cannot drift — the root cause that surfaced in PR #695, Helena (Chief
// Risk Officer, governance)'s MR-1-FX IPV recalibration). This file adds the
// dispatch-specific side-effects:
//
//   1. Parse `--event-db <path>` out of argv.
//   2. Mutate `process.env.BANK_EVENT_DB` to the resolved path BEFORE any
//      downstream import of `platform/composition.ts` (so composition's
//      module-load-time read sees the resolved value).
//   3. Print one JSON envelope to stderr at INFO level for auditability.
//
// Re-exported `resolveDispatchEventDb` is a thin wrapper kept for
// backward-compatibility with any existing imports — it just delegates to
// `resolveEventDbPath`.
//
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21).
// Author: Atlas (Core banking platform architect, engineering)

import { homedir } from "node:os";
import {
  type ResolveEventDbInputs,
  type ResolvedEventDb as SharedResolvedEventDb,
  resolveEventDbPath,
} from "../../platform/event-store/resolve-event-db";

/**
 * Dispatch-CLI-shaped result. Identical to the shared helper's
 * `ResolvedEventDb` except the `"explicit"` rule is reported as `"cli-flag"`
 * — the dispatch-CLI vocabulary, preserved for compatibility with stderr
 * envelopes and any external log scrapers.
 */
export interface ResolvedEventDb {
  path: string;
  source: "cli-flag" | "env-bank-event-db" | "env-bank-home-event-db" | "home-default" | "fallback";
  shared: boolean;
}

/**
 * Backward-compatible thin wrapper. Existing callers (the dispatch CLIs and
 * their tests) pass explicit values for every channel and expect the
 * resolver to consider ONLY those channels (i.e. `undefined` = "not
 * supplied", NOT "read from `process.env`"). The shared helper reads env by
 * default when a key is `undefined`; this wrapper short-circuits that by
 * coercing every undefined to empty-string.
 *
 * New code in the composition root and emission scripts should call
 * `resolveEventDbPath` directly with `{ explicit }` and let it read env
 * defaults — that's the whole point of consolidating resolution.
 */
export function resolveDispatchEventDb(opts: {
  cliFlag?: string | undefined;
  envBankEventDb?: string | undefined;
  envBankHomeEventDb?: string | undefined;
  home?: string | undefined;
}): ResolvedEventDb {
  const inputs: ResolveEventDbInputs = {
    explicit: opts.cliFlag ?? "",
    envBankEventDb: opts.envBankEventDb ?? "",
    envBankHomeEventDb: opts.envBankHomeEventDb ?? "",
    home: opts.home ?? "",
  };
  const result = resolveEventDbPath(inputs);
  return mapToDispatchShape(result);
}

function mapToDispatchShape(result: SharedResolvedEventDb): ResolvedEventDb {
  if (result.source === "explicit") {
    return { path: result.path, source: "cli-flag", shared: result.shared };
  }
  return { path: result.path, source: result.source, shared: result.shared };
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
