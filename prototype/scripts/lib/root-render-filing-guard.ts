// scripts/lib/root-render-filing-guard.ts
//
// Shared guard for one-shot scripts that file (or read) a root-level record
// render that has since been removed from the tree (WS-QUEUE-CLOSEOUT-RESIDUALS
// root-render sweep, 2026-06-10; precedent: the inline guard PR #1194 added to
// `scripts/file-bea-irs-tail-closure.ts`).
//
// Semantics, in order:
//   1. If a `RecordFiled` event with the given `recordId` already exists in
//      the resolved event store, the render is canonically filed — log and
//      exit 0 (idempotent skip). Against the canonical shared store this is
//      always the path taken, so the removed tree file is never read.
//   2. If the tree file is missing (fresh store + post-removal tree), exit 1
//      with a pointer to the canonical document-store blob: the body cannot
//      be reproduced from the tree, and the document store is the canonical
//      home (D-RMS-PHASE-4).
//   3. Otherwise return the file body for the caller to file.
//
// Callers MUST import `platform/event-store/resolve-event-db-boot` before
// importing this module (every one-shot filing script already does) so the
// event store resolves to the intended DB.
//
// Authority: D-RMS-PHASE-4; D-RMS-PHASE-3;
//            brief:vera:sweep-tracked-root-level-record-renders-into-rms:2026-06-10.
// Author: Vera (Internal audit / continuous-assurance engineer, engineering;
//         functionally to Thandiwe, Chief Audit Executive)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../../platform/composition";
import { type DocumentHash, defaultDocumentStore } from "../../platform/document-store";

/** Walk up from this module to the repo root (CLAUDE.md anchor). */
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("root-render-filing-guard: cannot locate repo root (CLAUDE.md not found)");
}

export interface RootRenderGuardOptions {
  /** Tag for log lines — usually the script name. */
  readonly scriptTag: string;
  /** Repo-root-relative filename of the (removed) root render. */
  readonly docName: string;
  /** `RecordFiled.payload.recordId` that canonically files this render. */
  readonly recordId: string;
  /** Canonical document-store blob hash (`blake3:<hex>`) for the pointer message. */
  readonly documentHash: string;
}

/**
 * Returns the render body when (re-)filing is still possible; otherwise
 * exits the process (0 = already filed, 1 = tree copy gone).
 */
export function readRootRenderOrExit(opts: RootRenderGuardOptions): string {
  const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
    (e) => (e.payload as { recordId?: string }).recordId === opts.recordId,
  );
  if (alreadyFiled) {
    console.log(`[${opts.scriptTag}] ${opts.recordId} already filed — skipping.`);
    process.exit(0);
  }

  const docPath = resolve(findRepoRoot(import.meta.dir), opts.docName);
  if (!existsSync(docPath)) {
    console.error(
      `[${opts.scriptTag}] ${opts.docName} is not in the tree (removed post-filing per the ` +
        `2026-06-10 root-render sweep; canonical copy = document store blob ${opts.documentHash} ` +
        `referenced by ${opts.recordId}). Nothing to re-file.`,
    );
    process.exit(1);
  }
  return readFileSync(docPath, "utf8");
}

/**
 * Read a (possibly removed) root render's body WITHOUT an already-filed
 * gate — for one-shot scripts whose job is not the RecordFiled itself
 * (e.g. `record-d-*` decision scripts that embed the card body). Resolution
 * order: tree copy → canonical document-store blob (D-RMS-PHASE-4 home) →
 * hard error.
 */
export function readRootRenderBody(opts: RootRenderGuardOptions): string {
  const docPath = resolve(findRepoRoot(import.meta.dir), opts.docName);
  if (existsSync(docPath)) return readFileSync(docPath, "utf8");
  if (defaultDocumentStore.exists(opts.documentHash as DocumentHash)) {
    console.log(
      `[${opts.scriptTag}] ${opts.docName} removed from tree (2026-06-10 root-render sweep) — ` +
        `reading canonical blob ${opts.documentHash} (RecordFiled ${opts.recordId}).`,
    );
    return new TextDecoder().decode(defaultDocumentStore.get(opts.documentHash as DocumentHash));
  }
  throw new Error(
    `[${opts.scriptTag}] ${opts.docName}: neither tree copy nor document-store blob ` +
      `${opts.documentHash} available (canonical record ${opts.recordId}).`,
  );
}
