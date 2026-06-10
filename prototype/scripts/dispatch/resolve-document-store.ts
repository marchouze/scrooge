// scripts/dispatch/resolve-document-store.ts
//
// Dispatch-CLI boot adapter around the shared document-store resolver —
// the blob-root twin of `scripts/dispatch/resolve-event-db.ts`.
//
// Pure resolution lives at
// `platform/document-store/resolve-document-store.ts` and is shared with
// the `LocalFsDocumentStore` default constructor (so persona emission
// scripts and dispatch CLIs cannot drift). This file adds the
// dispatch-specific side-effects:
//
//   1. Parse `--document-store <path>` out of argv.
//   2. Mutate `process.env.BANK_DOCUMENT_STORE` to the resolved root
//      BEFORE any downstream import of `platform/document-store` (so the
//      `defaultDocumentStore` singleton's module-load-time read sees the
//      resolved value).
//   3. Print one JSON envelope to stderr at INFO level for auditability.
//
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21) — design
//            precedent, extended to blob roots per
//            brief:atlas:extend-cross-worktree-sync-to-document-store-blo:2026-06-10.
// Author: Atlas (Core banking platform architect, engineering)

import {
  type ResolvedDocumentStore as SharedResolvedDocumentStore,
  resolveDocumentStoreRoot,
} from "../../platform/document-store/resolve-document-store";

/**
 * Dispatch-CLI-shaped result. Identical to the shared helper's
 * `ResolvedDocumentStore` except the `"explicit"` rule is reported as
 * `"cli-flag"` — the dispatch-CLI vocabulary, matching the event-store
 * wrapper's stderr envelopes.
 */
export interface ResolvedDocumentStore {
  root: string;
  source:
    | "cli-flag"
    | "env-bank-document-store"
    | "env-bank-document-store-path"
    | "env-bank-home-document-store"
    | "home-default"
    | "fallback";
  shared: boolean;
}

function mapToDispatchShape(result: SharedResolvedDocumentStore): ResolvedDocumentStore {
  if (result.source === "explicit") {
    return { root: result.root, source: "cli-flag", shared: result.shared };
  }
  return { root: result.root, source: result.source, shared: result.shared };
}

/**
 * Apply the resolution: read env + argv, mutate
 * `process.env.BANK_DOCUMENT_STORE`, print a one-line audit envelope to
 * stderr, and return the result.
 *
 * Side effects:
 *   - `process.env.BANK_DOCUMENT_STORE` is set to the resolved root
 *     (idempotent).
 *   - One JSON line is written to stderr unless `silent: true`.
 *
 * MUST be called before importing `platform/document-store` (use the
 * boot-shim import chain — `./resolve-event-db-boot` chains into this).
 */
export function applyDispatchDocumentStoreResolution(opts?: {
  argv?: readonly string[];
  silent?: boolean;
}): ResolvedDocumentStore {
  const argv = opts?.argv ?? process.argv.slice(2);
  let cliFlag: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--document-store") {
      cliFlag = argv[i + 1];
      break;
    }
  }

  const result = mapToDispatchShape(resolveDocumentStoreRoot({ explicit: cliFlag }));

  process.env.BANK_DOCUMENT_STORE = result.root;

  if (!opts?.silent) {
    console.error(
      JSON.stringify({
        level: "info",
        component: "dispatch:resolve-document-store",
        root: result.root,
        source: result.source,
        shared: result.shared,
        msg:
          result.source === "fallback"
            ? "Resolved to per-worktree in-repo document store — $HOME unresolvable. Blobs written here will NOT be visible cross-worktree; RecordFiled documentHash references may dangle after worktree prune."
            : `Resolved document-store root (${result.source}, shared=${result.shared}).`,
      }),
    );
  }

  return result;
}
