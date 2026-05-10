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
// Env var:
//   BANK_DOCUMENT_STORE_PATH — absolute or relative root for the store.
//   Defaults to `<repo-root>/prototype/data/documents/`. The default is
//   resolved from a stable anchor (this module's own location, walked up
//   to the repo's `CLAUDE.md`) — *not* `process.cwd()` — to avoid the
//   double-`prototype/prototype/` leak when a caller runs from inside
//   `prototype/` (e.g. `bun test`, `bun run scheduler:tick`).
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { hashContent, parseHash } from "./hash";
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

/**
 * Walk up from `start` looking for the repo-root marker (`CLAUDE.md`).
 * Mirrors the helper in `platform/recon/runtime-handler-sync.ts` and
 * peers — the same anchor every other module uses. Bounded walk so a
 * malformed deployment fails fast rather than chewing the filesystem.
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
    "LocalFsDocumentStore: cannot locate repo root (CLAUDE.md not found by walking up)",
  );
}

/**
 * Default document-store root, anchored on the repo root rather than
 * `process.cwd()`. Resolved once at module-load time.
 */
function defaultRoot(): string {
  const repoRoot = findRepoRoot(import.meta.dir);
  return resolve(repoRoot, "prototype/data/documents");
}

export interface LocalFsDocumentStoreOptions {
  /**
   * Root directory. Defaults to `BANK_DOCUMENT_STORE_PATH` env var, then
   * `<repo-root>/prototype/data/documents/`.
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
    const envRoot = process.env.BANK_DOCUMENT_STORE_PATH;
    // Precedence: explicit opts.root → env var → repo-root-anchored default.
    // Only the env var / opts paths may be relative; in that case they
    // resolve against `process.cwd()` (caller-controlled). The default
    // path is *always* absolute via `findRepoRoot`, so it never collides
    // with cwd-shaped doubling like `prototype/prototype/...`.
    const rootRaw = opts.root ?? envRoot;
    if (rootRaw === undefined) {
      this.root = defaultRoot();
    } else {
      this.root = isAbsolute(rootRaw) ? rootRaw : resolve(process.cwd(), rootRaw);
    }
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
