// platform/document-store/local-fs.ts
//
// Local filesystem implementation of `DocumentStore`. Sits behind the clean
// `DocumentStore` interface so the M8 cloud-lift (Azure Blob + Managed-HSM
// key envelope, spec §4.1) can swap implementations without changing call
// sites.
//
// Layout:
//   <root>/<algo>/<first-2-hex>/<remaining-hex>
//
// Sharding by the first two hex characters gives us 256 second-level
// directories, capping any single directory at ~N/256 files. Without the
// shard, a flat 10k-document store hits filesystem inode-listing pain on
// most platforms; a flat 100k store is unworkable.
//
// Root resolution (D-CROSS-WORKTREE-EVENT-STORE-SYNC, extended to blob
// roots 2026-06-10 — see `resolve-document-store.ts` for the full ladder):
//   `opts.root` → `BANK_DOCUMENT_STORE` → `BANK_DOCUMENT_STORE_PATH`
//   (legacy alias) → `BANK_HOME_DOCUMENT_STORE` →
//   `<repo-root>/prototype/data/documents/` (per-worktree fallback).
//   The default constructor resolves with `excludeHomeDefault: true` —
//   the shared HOME store is opt-in via the boot shim
//   (`resolve-document-store-boot.ts`), exactly like the composition
//   root's event-store posture. The fallback is resolved from a stable
//   anchor (repo `CLAUDE.md` walk-up) — *not* `process.cwd()` — to avoid
//   the double-`prototype/prototype/` leak when a caller runs from inside
//   `prototype/` (e.g. `bun test`, `bun run scheduler:tick`).
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { hashContent, parseHash } from "./hash";
import { resolveDocumentStoreRoot } from "./resolve-document-store";
import {
  type DocumentHash,
  DocumentIntegrityError,
  type DocumentMetadata,
  type DocumentStore,
  DocumentStoreMissError,
  type HashAlgo,
  type PutOptions,
  type PutResult,
} from "./types";

export interface LocalFsDocumentStoreOptions {
  /**
   * Root directory. When omitted, resolution follows the shared ladder in
   * `resolve-document-store.ts` with the home-default tier excluded:
   * `BANK_DOCUMENT_STORE` → `BANK_DOCUMENT_STORE_PATH` (legacy alias) →
   * `BANK_HOME_DOCUMENT_STORE` → `<repo-root>/prototype/data/documents/`.
   */
  readonly root?: string;
  /**
   * If true (default), `get` re-hashes the bytes and throws
   * `DocumentIntegrityError` on mismatch. Recommended on for dev / test
   * and CI; can be disabled in latency-sensitive prod paths once the
   * underlying filesystem / blob store is itself integrity-checked
   * (Azure Blob exposes per-object MD5; Managed HSM envelope encryption
   * provides tamper-evidence).
   */
  readonly verifyOnRead?: boolean;
}

export class LocalFsDocumentStore implements DocumentStore {
  private readonly root: string;
  private readonly verifyOnRead: boolean;

  constructor(opts: LocalFsDocumentStoreOptions = {}) {
    // Shared resolution ladder (D-CROSS-WORKTREE-EVENT-STORE-SYNC, blob
    // extension): explicit opts.root → BANK_DOCUMENT_STORE →
    // BANK_DOCUMENT_STORE_PATH (legacy alias) → BANK_HOME_DOCUMENT_STORE →
    // repo-root-anchored in-repo fallback. `excludeHomeDefault: true`
    // mirrors the composition root's event-store posture: the singleton
    // must not silently adopt the shared HOME store — surfaces opt in via
    // the boot shim, which sets `BANK_DOCUMENT_STORE` ahead of this
    // module's load. Relative opts/env paths resolve against
    // `process.cwd()` (caller-controlled); the fallback is always
    // absolute via the repo-root walk, so it never collides with
    // cwd-shaped doubling like `prototype/prototype/...`.
    this.root = resolveDocumentStoreRoot({
      explicit: opts.root,
      excludeHomeDefault: true,
    }).root;
    this.verifyOnRead = opts.verifyOnRead ?? true;
  }

  public put(content: Uint8Array | string, opts: PutOptions = {}): PutResult {
    const algo: HashAlgo = opts.algo ?? "blake3";
    const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
    const hash = hashContent(bytes, algo);
    const path = this.pathFor(hash);

    if (existsSync(path)) {
      // Idempotent — bytes already present at this hash. Trust the hash;
      // do not rewrite (P3: immutable once written; cheap call).
      return {
        hash,
        path,
        isNew: false,
        size: bytes.length,
        algo,
      };
    }

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
    return {
      hash,
      path,
      isNew: true,
      size: bytes.length,
      algo,
    };
  }

  public get(hash: DocumentHash): Uint8Array {
    const path = this.pathFor(hash);
    if (!existsSync(path)) {
      throw new DocumentStoreMissError(hash);
    }
    const bytes = new Uint8Array(readFileSync(path));
    if (this.verifyOnRead) {
      const { algo } = parseHash(hash);
      const recomputed = hashContent(bytes, algo);
      if (recomputed !== hash) {
        throw new DocumentIntegrityError(hash, recomputed);
      }
    }
    return bytes;
  }

  public exists(hash: DocumentHash): boolean {
    try {
      const path = this.pathFor(hash);
      return existsSync(path);
    } catch {
      // Malformed hash → treat as not-present rather than throwing.
      return false;
    }
  }

  public metadata(hash: DocumentHash): DocumentMetadata {
    const path = this.pathFor(hash);
    if (!existsSync(path)) {
      throw new DocumentStoreMissError(hash);
    }
    const { algo } = parseHash(hash);
    const stat = statSync(path);
    // Birth time isn't reliable on all filesystems; fall back to mtime.
    const firstSeenAt = stat.birthtime?.toISOString?.() ?? stat.mtime.toISOString();
    return {
      hash,
      path,
      size: stat.size,
      algo: algo as HashAlgo,
      firstSeenAt,
    };
  }

  /** The configured root directory (absolute). Useful for tooling and tests. */
  public rootPath(): string {
    return this.root;
  }

  /**
   * Compute the on-disk path for a hash without checking existence. Throws
   * on a malformed hash.
   */
  public pathFor(hash: DocumentHash): string {
    const { algo, hex } = parseHash(hash);
    const shard = hex.slice(0, 2);
    const rest = hex.slice(2);
    return join(this.root, algo, shard, rest);
  }
}

/**
 * Default shared store, configured from env. Most callers should depend on
 * the `DocumentStore` interface and accept an injected instance; this
 * convenience export covers ad-hoc / scripted use.
 */
export const defaultDocumentStore: DocumentStore = new LocalFsDocumentStore();
