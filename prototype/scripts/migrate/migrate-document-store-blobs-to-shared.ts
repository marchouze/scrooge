// scripts/migrate/migrate-document-store-blobs-to-shared.ts
//
// One-way, idempotent, re-runnable copy of content-addressed blobs from
// the per-worktree in-repo document store
// (`<repo>/prototype/data/documents/<algo>/<shard>/<rest>`) into the
// resolved SHARED document store (default
// `$HOME/.local/share/bank/documents`, per
// `platform/document-store/resolve-document-store.ts`).
//
// Deploy-time invocation (Scrooge, from the MAIN worktree, after the
// document-store-sync PR and Vera's blob-rescue PR have both merged):
//
//   cd /Users/marc/code/Bank/prototype && bun run migrate:document-store-blobs
//
// Safety contract:
//   - The source store is NEVER mutated — copy-only, no deletes, no
//     renames inside the source tree.
//   - NO frozen-source assumption: a parallel writer (e.g. Vera's
//     blob-rescue run) may be writing into the source store while this
//     script runs. Every run re-scans the full source tree; blobs that
//     appear between runs are picked up by the next run. A blob whose
//     bytes do not (yet) hash to their path — e.g. a file caught
//     mid-write — is reported as `corruptSource` and skipped, never
//     copied; a re-run picks it up once the write completes.
//   - Hash-verified both ways: source bytes are re-hashed before copy
//     (refuse to propagate corruption); a pre-existing destination blob
//     is re-hashed and a mismatch is reported as `corruptDest` (the
//     destination is content-addressed — a hash collision with different
//     bytes means store corruption, which must surface loudly, not be
//     papered over).
//   - Destination writes are atomic (temp file + rename) so a concurrent
//     reader never observes a half-written blob at a valid hash path.
//   - Idempotent: blobs already present (and verified) at the
//     destination are skipped (`alreadyPresent`). Running twice copies
//     nothing the second time.
//
// Exit code: 0 when no corruption was seen (copied / alreadyPresent are
// both fine); 1 when any `corruptSource` / `corruptDest` / `unreadable`
// entry was recorded — the summary JSON on stdout carries the detail.
//
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (CEO session-delegation
//            2026-05-21) — design precedent, extended to blob roots.
// Brief: brief:atlas:extend-cross-worktree-sync-to-document-store-blo:2026-06-10.
// Author: Atlas (Core banking platform architect, engineering)

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import { hashContent } from "../../platform/document-store/hash";
import {
  inRepoDocumentStoreRoot,
  resolveDocumentStoreRoot,
} from "../../platform/document-store/resolve-document-store";
import type { HashAlgo } from "../../platform/document-store/types";

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

export interface MigrationIssue {
  /** `<algo>:<hex>` reconstructed from the on-disk path. */
  readonly hash: string;
  /** Absolute path of the offending file. */
  readonly path: string;
  readonly kind: "corrupt-source" | "corrupt-dest" | "unreadable";
  readonly detail: string;
}

export interface MigrationSummary {
  readonly sourceRoot: string;
  readonly destRoot: string;
  /** Blob files seen under the source root. */
  readonly scanned: number;
  /** Verified-and-copied this run. */
  readonly copied: number;
  /** Already present (and verified) at the destination — skipped. */
  readonly alreadyPresent: number;
  /** Non-blob files ignored (e.g. `.gitkeep`, temp files). */
  readonly ignored: number;
  readonly issues: readonly MigrationIssue[];
  readonly ok: boolean;
}

// ---------------------------------------------------------------------------
// Source-tree walk
//
// Store layout is `<root>/<algo>/<first-2-hex>/<remaining-hex>`. Anything
// that does not match the layout (`.gitkeep`, editor droppings, temp
// files from in-flight atomic writes) is counted as `ignored`, never
// treated as a blob.
// ---------------------------------------------------------------------------

const SUPPORTED_ALGOS: readonly HashAlgo[] = ["blake3"];

interface SourceBlob {
  readonly algo: HashAlgo;
  readonly hex: string;
  readonly path: string;
}

function listSourceBlobs(sourceRoot: string): { blobs: SourceBlob[]; ignored: number } {
  const blobs: SourceBlob[] = [];
  let ignored = 0;
  if (!existsSync(sourceRoot)) return { blobs, ignored };

  for (const algoEntry of readdirSync(sourceRoot)) {
    const algoDir = join(sourceRoot, algoEntry);
    if (!statSync(algoDir).isDirectory()) {
      ignored++;
      continue;
    }
    if (!(SUPPORTED_ALGOS as readonly string[]).includes(algoEntry)) {
      ignored++;
      continue;
    }
    const algo = algoEntry as HashAlgo;
    for (const shardEntry of readdirSync(algoDir)) {
      const shardDir = join(algoDir, shardEntry);
      if (!statSync(shardDir).isDirectory() || !/^[0-9a-f]{2}$/.test(shardEntry)) {
        ignored++;
        continue;
      }
      for (const restEntry of readdirSync(shardDir)) {
        const blobPath = join(shardDir, restEntry);
        if (!statSync(blobPath).isFile() || !/^[0-9a-f]{62}$/.test(restEntry)) {
          // 64 hex chars total = 2 (shard) + 62 (rest) for blake3.
          ignored++;
          continue;
        }
        blobs.push({ algo, hex: `${shardEntry}${restEntry}`, path: blobPath });
      }
    }
  }
  return { blobs, ignored };
}

// ---------------------------------------------------------------------------
// Core migration (exported for tests)
// ---------------------------------------------------------------------------

export function migrateDocumentStoreBlobs(opts: {
  readonly sourceRoot: string;
  readonly destRoot: string;
}): MigrationSummary {
  const sourceRoot = resolve(opts.sourceRoot);
  const destRoot = resolve(opts.destRoot);

  if (sourceRoot === destRoot) {
    throw new Error(
      `migrate-document-store-blobs: source and destination resolve to the same root (${sourceRoot}) — refusing to run. Check BANK_DOCUMENT_STORE / --dest wiring.`,
    );
  }

  const { blobs, ignored } = listSourceBlobs(sourceRoot);
  const issues: MigrationIssue[] = [];
  let copied = 0;
  let alreadyPresent = 0;

  for (const blob of blobs) {
    const expectedHash = `${blob.algo}:${blob.hex}`;

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(readFileSync(blob.path));
    } catch (err) {
      issues.push({
        hash: expectedHash,
        path: blob.path,
        kind: "unreadable",
        detail: `read failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    // Verify the source bytes hash to their path BEFORE copying — never
    // propagate corruption (or a parallel writer's half-written file)
    // into the shared store.
    const actualHash = hashContent(bytes, blob.algo);
    if (actualHash !== expectedHash) {
      issues.push({
        hash: expectedHash,
        path: blob.path,
        kind: "corrupt-source",
        detail: `source bytes hash to ${actualHash}, expected ${expectedHash} — skipped (possibly a concurrent in-flight write; re-run picks it up once stable)`,
      });
      continue;
    }

    const destPath = join(destRoot, blob.algo, blob.hex.slice(0, 2), blob.hex.slice(2));

    if (existsSync(destPath)) {
      // Content-addressed: same hash must mean same bytes. Verify rather
      // than trust — a mismatch is store corruption and must surface.
      const destBytes = new Uint8Array(readFileSync(destPath));
      const destHash = hashContent(destBytes, blob.algo);
      if (destHash !== expectedHash) {
        issues.push({
          hash: expectedHash,
          path: destPath,
          kind: "corrupt-dest",
          detail: `destination bytes hash to ${destHash}, expected ${expectedHash} — NOT overwritten; investigate before re-running`,
        });
      } else {
        alreadyPresent++;
      }
      continue;
    }

    // Atomic write: temp file in the final directory, then rename. A
    // concurrent reader never sees a half-written blob at a valid hash
    // path, and a crashed run leaves only an ignorable `.tmp-` file.
    mkdirSync(dirname(destPath), { recursive: true });
    const tmpPath = `${destPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      writeFileSync(tmpPath, bytes);
      renameSync(tmpPath, destPath);
    } catch (err) {
      try {
        rmSync(tmpPath, { force: true });
      } catch {
        // best-effort temp cleanup only
      }
      issues.push({
        hash: expectedHash,
        path: destPath,
        kind: "unreadable",
        detail: `destination write failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }
    copied++;
  }

  return {
    sourceRoot,
    destRoot,
    scanned: blobs.length,
    copied,
    alreadyPresent,
    ignored,
    issues,
    ok: issues.length === 0,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
//
//   bun run migrate:document-store-blobs \
//     [--source <path>]   default: <repo>/prototype/data/documents
//     [--dest <path>]     default: shared resolution WITH home tier
//                         (--dest > BANK_DOCUMENT_STORE >
//                          BANK_DOCUMENT_STORE_PATH >
//                          BANK_HOME_DOCUMENT_STORE >
//                          $HOME/.local/share/bank/documents)
// ---------------------------------------------------------------------------

function argValue(argv: readonly string[], flag: string): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === flag) return argv[i + 1];
  }
  return undefined;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const sourceRoot = argValue(argv, "--source") ?? inRepoDocumentStoreRoot();
  const destFlag = argValue(argv, "--dest");
  const destResolution = resolveDocumentStoreRoot({ explicit: destFlag });

  const summary = migrateDocumentStoreBlobs({
    sourceRoot,
    destRoot: destResolution.root,
  });

  console.log(
    JSON.stringify({
      level: summary.ok ? "info" : "error",
      component: "migrate:document-store-blobs",
      destSource: destResolution.source,
      destShared: destResolution.shared,
      ...summary,
      msg: summary.ok
        ? `Migrated ${summary.copied} blob(s); ${summary.alreadyPresent} already present; ${summary.scanned} scanned. Source untouched; safe to re-run.`
        : `Migration completed with ${summary.issues.length} issue(s) — see detail. Copied ${summary.copied}; source untouched; safe to re-run after investigating.`,
    }),
  );

  if (!summary.ok) process.exit(1);
}
