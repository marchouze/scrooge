// platform/document-store/resolve-document-store.ts
//
// Shared document-store root resolution — the BLAKE3 content-addressed
// blob store's twin of `platform/event-store/resolve-event-db.ts`.
//
// WHY THIS EXISTS (the dangling-record gap, surfaced by Vera (Internal
// audit engineer, third line) in PR #1194). D-CROSS-WORKTREE-EVENT-STORE-SYNC
// mounts ONE shared SQLite event store across all dispatch worktrees, but
// the document store kept resolving per-worktree
// (`<repo>/prototype/data/documents`). An agent in an ephemeral worktree
// emitted `RecordFiled` into the SHARED event store while the blob landed
// in the worktree's LOCAL document store — prune the worktree and the
// canonical record's `documentHash` dangles. This module gives the blob
// root the exact same resolution ladder the event store got: swap the
// SQLite file path for a blob root directory, nothing else changes
// (design precedent: D-CROSS-WORKTREE-EVENT-STORE-SYNC, CEO
// session-delegation 2026-05-21).
//
// Resolution precedence (high → low), mirroring the event store tiers:
//   1. `opts.explicit` (e.g. `--document-store` CLI flag; `opts.root` on
//      `LocalFsDocumentStore`; caller override)
//   2. `BANK_DOCUMENT_STORE` env var (primary ambient — mirrors
//      `BANK_EVENT_DB`; tests / scenarios / dispatch boot)
//   3. `BANK_DOCUMENT_STORE_PATH` env var (legacy alias from RMS Phase 1
//      Slice 1 — kept at its own tier directly below the primary so every
//      existing test / scenario / config-loader caller keeps working)
//   4. `BANK_HOME_DOCUMENT_STORE` env var (custom home location — mirrors
//      `BANK_HOME_EVENT_DB`)
//   5. `$HOME/.local/share/bank/documents` (home-default shared store via
//      `getBankConfig().documentStoreRoot`; SKIPPED when
//      `excludeHomeDefault: true`)
//   6. fallback `<repo-root>/prototype/data/documents` (per-worktree
//      in-repo store; CI, fresh-clone — repo-root-anchored, never
//      cwd-relative, to avoid the `prototype/prototype/` leak)
//
// Posture split (identical to the event store):
//   - `LocalFsDocumentStore`'s default constructor resolves with
//     `excludeHomeDefault: true` — the singleton `defaultDocumentStore`
//     must NOT silently adopt the home store on its own (that would
//     pollute the per-worktree CI store with blobs from other surfaces).
//   - Surfaces that want the shared HOME store (dispatch CLIs, persona
//     emission scripts, the dashboard) opt in by importing the boot shim
//     (`resolve-document-store-boot.ts`), which mutates
//     `process.env.BANK_DOCUMENT_STORE` BEFORE the document-store module
//     loads. The platform event-store boot shim chains into this one so
//     "shared event store" always implies "shared document store" — the
//     pairing IS the invariant that prevents dangling records.
//
// Authority:
//   - D-CROSS-WORKTREE-EVENT-STORE-SYNC (CEO session-delegation, 2026-05-21)
//     — design precedent (file path → blob root).
//   - brief:atlas:extend-cross-worktree-sync-to-document-store-blo:2026-06-10
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface ResolvedDocumentStore {
  /** Absolute blob-root directory the caller should mount. */
  root: string;
  /** Which resolution rule fired. */
  source:
    | "explicit"
    | "env-bank-document-store"
    | "env-bank-document-store-path"
    | "env-bank-home-document-store"
    | "home-default"
    | "fallback";
  /**
   * `true` when this is a shared store (home-default or
   * BANK_HOME_DOCUMENT_STORE); `false` for explicit / BANK_DOCUMENT_STORE /
   * BANK_DOCUMENT_STORE_PATH / fallback — those may or may not be shared
   * and we cannot know from the path alone, so we conservatively mark
   * them non-shared. Mirrors `ResolvedEventDb.shared`.
   */
  shared: boolean;
}

/**
 * Inputs to the resolver. All optional; environment defaults are read in
 * `resolveDocumentStoreRoot` itself if you do not provide them, which is
 * the usual mode. The injectable shape exists for tests + the boot shims
 * (same contract as `ResolveEventDbInputs`: `undefined` = "read the
 * ambient default", empty string = "explicitly not supplied").
 */
export interface ResolveDocumentStoreInputs {
  /** `--document-store` CLI flag / `opts.root` or any caller override. */
  explicit?: string | undefined;
  /** Read from `process.env.BANK_DOCUMENT_STORE` by default. */
  envBankDocumentStore?: string | undefined;
  /** Read from `process.env.BANK_DOCUMENT_STORE_PATH` (legacy alias) by default. */
  envBankDocumentStorePath?: string | undefined;
  /** Read from `process.env.BANK_HOME_DOCUMENT_STORE` by default. */
  envBankHomeDocumentStore?: string | undefined;
  /** Read from `os.homedir()` / config store by default. */
  home?: string | undefined;
  /**
   * When `true`, the home-default tier is skipped — resolution jumps from
   * `BANK_HOME_DOCUMENT_STORE` straight to the per-worktree in-repo
   * fallback. Used by `LocalFsDocumentStore`'s default constructor so the
   * `defaultDocumentStore` singleton does not silently adopt the home
   * store: dispatch CLIs + emission scripts opt in explicitly via the
   * boot shims.
   */
  excludeHomeDefault?: boolean;
  /**
   * Injectable fallback root for tests. Production default is the
   * repo-root-anchored in-repo store
   * (`<repo>/prototype/data/documents`).
   */
  fallbackRoot?: string | undefined;
}

function nonEmpty(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Walk up from `start` looking for the repo-root marker (`CLAUDE.md`).
 * Same bounded-walk helper as `local-fs.ts` / `recon/runtime-handler-sync.ts`.
 */
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    "resolveDocumentStoreRoot: cannot locate repo root (CLAUDE.md not found by walking up)",
  );
}

/**
 * The per-worktree in-repo fallback root, anchored on the repo root rather
 * than `process.cwd()` (avoids the `prototype/prototype/` doubling when a
 * caller runs from inside `prototype/`).
 */
export function inRepoDocumentStoreRoot(): string {
  return resolve(findRepoRoot(import.meta.dir), "prototype/data/documents");
}

/**
 * Resolve the document-store blob root. Mirrors `resolveEventDbPath`:
 * never mutates env; the only filesystem touches are the repo-root walk
 * (fallback tier) and the lazy config-store read (home-default tier).
 *
 * Default mode (no inputs supplied) reads `process.env.BANK_DOCUMENT_STORE`,
 * `process.env.BANK_DOCUMENT_STORE_PATH`,
 * `process.env.BANK_HOME_DOCUMENT_STORE`, and
 * `getBankConfig().documentStoreRoot` — the production resolution. Tests
 * inject everything explicitly to exercise the precedence ladder without
 * environment leakage.
 */
export function resolveDocumentStoreRoot(
  opts: ResolveDocumentStoreInputs = {},
): ResolvedDocumentStore {
  const explicit = nonEmpty(opts.explicit);
  if (explicit !== undefined) {
    return { root: resolve(explicit), source: "explicit", shared: false };
  }

  const envBankDocumentStore =
    opts.envBankDocumentStore === undefined
      ? nonEmpty(process.env.BANK_DOCUMENT_STORE)
      : nonEmpty(opts.envBankDocumentStore);
  if (envBankDocumentStore !== undefined) {
    return {
      root: resolve(envBankDocumentStore),
      source: "env-bank-document-store",
      shared: false,
    };
  }

  const envBankDocumentStorePath =
    opts.envBankDocumentStorePath === undefined
      ? nonEmpty(process.env.BANK_DOCUMENT_STORE_PATH)
      : nonEmpty(opts.envBankDocumentStorePath);
  if (envBankDocumentStorePath !== undefined) {
    return {
      root: resolve(envBankDocumentStorePath),
      source: "env-bank-document-store-path",
      shared: false,
    };
  }

  const envBankHomeDocumentStore =
    opts.envBankHomeDocumentStore === undefined
      ? nonEmpty(process.env.BANK_HOME_DOCUMENT_STORE)
      : nonEmpty(opts.envBankHomeDocumentStore);
  if (envBankHomeDocumentStore !== undefined) {
    return {
      root: resolve(envBankHomeDocumentStore),
      source: "env-bank-home-document-store",
      shared: true,
    };
  }

  if (!opts.excludeHomeDefault) {
    // opts.home is injectable for tests (no config-store reads needed).
    if (opts.home !== undefined) {
      const home = nonEmpty(opts.home);
      if (home !== undefined) {
        return {
          root: resolve(home, ".local", "share", "bank", "documents"),
          source: "home-default",
          shared: true,
        };
      }
    } else {
      // Production path: derive from the centralized config store (lazy
      // call to avoid circular init — do NOT hoist to module level).
      const { getBankConfig } = require("../config/loader") as typeof import("../config/loader");
      const configRoot = getBankConfig().documentStoreRoot;
      if (configRoot) {
        return { root: configRoot, source: "home-default", shared: true };
      }
    }
  }

  const fallbackRoot = nonEmpty(opts.fallbackRoot) ?? inRepoDocumentStoreRoot();
  return { root: resolve(fallbackRoot), source: "fallback", shared: false };
}

/**
 * Apply the home-default-enabled resolution + mutate
 * `process.env.BANK_DOCUMENT_STORE` so a downstream import of
 * `platform/document-store` constructs `defaultDocumentStore` against the
 * resolved root. Intended for callers that want the shared HOME store:
 * dispatch CLIs, persona emission scripts and the dashboard.
 *
 * MUST be called BEFORE the first import of `platform/document-store` —
 * `defaultDocumentStore` reads `BANK_DOCUMENT_STORE` at module-load time.
 * Use the boot shim (`resolve-document-store-boot.ts`) to guarantee
 * ordering under import hoisting.
 *
 * Idempotent: calling twice with the same inputs yields the same result
 * and leaves `process.env.BANK_DOCUMENT_STORE` set to that root.
 */
export function applySharedDocumentStoreResolution(opts?: {
  explicit?: string;
}): ResolvedDocumentStore {
  const result = resolveDocumentStoreRoot({ explicit: opts?.explicit });
  process.env.BANK_DOCUMENT_STORE = result.root;
  return result;
}
