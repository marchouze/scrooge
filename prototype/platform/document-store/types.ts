// platform/document-store/types.ts
//
// RMS Phase 1 Slice 1 — content-addressed document store interface.
//
// Authoritative spec:
//   Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md
//   §4 (Document substrate) and §5 (implementation notes).
//
// Standing authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09).
// Slice authorisation: D-RMS-PHASE-1-SLICE-1.
//
// The document store is a pure content-addressed binary store. Hashes are
// the canonical identifier; paths are derived; bytes are immutable; no
// `delete` (supersession is an event, not a file replacement — see §4.2 of
// the spec). This module deliberately knows nothing about events; events
// reference documents by hash, not the other way round.
//
// P1 — events are the source of truth; documents are the heavy bytes
//      events cite by hash.
// P3 — local-fs implementation behind a clean interface; Azure Blob +
//      Managed-HSM key envelope is the M8 cloud target (§4.1).
//
// Author: Atlas (Core banking platform architect, engineering)
//         + Owen (Company Secretary, governance)

import type { Brand } from "../core/types";

/**
 * Content-addressed hash of a document. Format: `<algo>:<hex-digest>`.
 *
 * The algorithm prefix makes a future hash-algorithm swap (e.g. BLAKE3 →
 * post-quantum) non-breaking. Today the only supported algorithm is
 * `blake3` (256-bit / 64 hex chars). `sha256` is reserved as a
 * FIPS-only-context fallback per spec §4.1; not implemented in Slice 1.
 */
export type DocumentHash = Brand<string, "DocumentHash">;

/** Supported hash algorithms. Slice 1 ships BLAKE3 only. */
export type HashAlgo = "blake3";

export interface PutResult {
  readonly hash: DocumentHash;
  /** Filesystem path (or future cloud URI) where the bytes live. */
  readonly path: string;
  /**
   * `true` iff this `put` created a new entry. `false` means the bytes
   * were already present at this hash (idempotent re-put). Callers can
   * use this to skip downstream work or count unique-document totals.
   */
  readonly isNew: boolean;
  /** Size of the content in bytes. */
  readonly size: number;
  /** Algorithm used to compute the hash. */
  readonly algo: HashAlgo;
}

export interface DocumentMetadata {
  readonly hash: DocumentHash;
  readonly path: string;
  readonly size: number;
  readonly algo: HashAlgo;
  /** ISO 8601 UTC. Filesystem birth/ctime; first-seen-by-this-store. */
  readonly firstSeenAt: string;
}

export interface PutOptions {
  /** Hash algorithm. Defaults to `blake3`. */
  readonly algo?: HashAlgo;
}

/**
 * Pure content-addressed document store.
 *
 * `put` is idempotent: writing the same bytes yields the same hash and
 * leaves any existing file untouched. `get` throws on cache miss (no
 * silent nulls — a dangling reference is a Vera blocker finding per
 * spec §14 #3, and the throw lets the caller surface it loudly).
 * `exists` is the read primitive recon pipelines use to assert
 * "every event-cited hash resolves" (§14 #3).
 *
 * The interface intentionally matches the M8 Azure-blob target: `put` /
 * `get` / `exists` / `metadata` map cleanly onto Blob `UploadBlob` /
 * `DownloadBlob` / `Exists` / `GetProperties`. The local-fs impl and
 * the future blob impl are call-site-compatible.
 */
export interface DocumentStore {
  /**
   * Store `content`. Returns the hash + path + isNew flag.
   *
   * - Strings are encoded UTF-8 before hashing.
   * - Existing entries are not overwritten (idempotent).
   * - The returned `path` is filesystem-local for the local-fs impl;
   *   for cloud impls it is the cloud URI.
   */
  put(content: Uint8Array | string, opts?: PutOptions): PutResult;

  /**
   * Fetch bytes by hash. Throws `DocumentStoreMissError` if the hash
   * is not present. Optionally verifies the bytes still hash to the
   * given hash (integrity-on-read; on by default in dev).
   */
  get(hash: DocumentHash): Uint8Array;

  /** Returns true iff the hash resolves to stored bytes. Never throws. */
  exists(hash: DocumentHash): boolean;

  /**
   * Returns metadata for the hash. Throws `DocumentStoreMissError` if
   * the hash is not present.
   */
  metadata(hash: DocumentHash): DocumentMetadata;
}

export class DocumentStoreMissError extends Error {
  public readonly hash: DocumentHash;
  constructor(hash: DocumentHash) {
    super(`document not found: ${hash}`);
    this.name = "DocumentStoreMissError";
    this.hash = hash;
  }
}

export class DocumentIntegrityError extends Error {
  public readonly expected: DocumentHash;
  public readonly actual: DocumentHash;
  constructor(expected: DocumentHash, actual: DocumentHash) {
    super(`document integrity check failed: expected ${expected}, recomputed ${actual}`);
    this.name = "DocumentIntegrityError";
    this.expected = expected;
    this.actual = actual;
  }
}
