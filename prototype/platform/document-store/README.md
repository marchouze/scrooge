# Document Store — RMS Phase 1 Slice 1

Content-addressed binary store for the Records Management Substrate.

**Spec:** [`Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`](../../../Owner%20Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md), §4 (Document substrate) and §5 (implementation notes).
**Standing authority:** `D-RMS-PHASE-1` (CEO-approved 2026-05-09).
**Slice authorisation:** `D-RMS-PHASE-1-SLICE-1`.
**Authors:** Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering).

---

## What this is

A pure content-addressed store. Bytes go in; a `<algo>:<hex>` hash comes out; the hash is the canonical identifier; identical bytes always yield the same hash; no `delete`. Events in the RMS reference documents by hash — they never embed bytes. The store knows nothing about events.

```ts
import { LocalFsDocumentStore } from "@platform/document-store";

const store = new LocalFsDocumentStore();
const { hash, isNew } = store.put("# Hello\n");
// hash === "blake3:a1b2c3..."
const bytes = store.get(hash);
const exists = store.exists(hash);
const meta = store.metadata(hash);
```

## Hash function — BLAKE3

Per spec §4.1: BLAKE3 256-bit output, ~6× faster than SHA-256 on the markdown-sized payloads RMS handles, cryptographically sound, well-reviewed. Implementation via [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) — Paul Miller's audited zero-dependency TypeScript suite (same package family the Ethereum / Bitcoin TS ecosystems trust).

Hash strings carry the algorithm prefix: `blake3:<64-hex-chars>`. The prefix makes a future swap (e.g. post-quantum) non-breaking.

SHA-256 is reserved as a FIPS-only-context fallback (spec §4.1) but is **not** implemented in Slice 1. Add it when a FIPS-only deployment target lands.

## Directory sharding

```
<root>/<algo>/<first-2-hex>/<remaining-hex>
e.g. <root>/blake3/a1/b2c3...d4
```

The first two hex characters partition the namespace into 256 buckets. A flat directory of 10k+ documents triggers slow inode listings on most filesystems; sharding caps any single directory at ~N/256 entries. Two levels is the sweet spot for the order-of-magnitude this store will see in Phase 1 (briefs, run records, decision records, feedback bodies — low thousands per agent-month).

## Configuration — env var

```
BANK_DOCUMENT_STORE_PATH=<absolute-or-relative-path>
```

Defaults to `prototype/data/documents/` resolved against `process.cwd()`. The local store path is gitignored (`prototype/.gitignore` excludes `data/documents/`); the directory itself is created on first `put`.

## API surface

| Method | Behaviour |
|---|---|
| `put(content, opts?)` | Hashes bytes, writes if new, returns `{ hash, path, isNew, size, algo }`. Idempotent — re-putting identical bytes is a no-op against storage and returns `isNew: false`. |
| `get(hash)` | Returns the bytes. Throws `DocumentStoreMissError` on cache miss. Re-hashes the bytes by default (`verifyOnRead: true`); throws `DocumentIntegrityError` on mismatch. |
| `exists(hash)` | Returns `boolean`. Never throws. Used by Vera's `recon/rms-dangling-references` pipeline. |
| `metadata(hash)` | Returns `{ hash, path, size, algo, firstSeenAt }`. Throws `DocumentStoreMissError` on cache miss. |

There is **no `delete`**. Documents are immutable (spec §4.2). Supersession is an event (`RecordFiled` with `supersedes`), not a file replacement. Retention-driven redaction is a Phase 4+ concern, cited under POPIA s.14.

## Errors

- `DocumentStoreMissError` — hash not present in the store. Carries the hash. A dangling reference (event cites a hash with no document) is a **blocker** finding under Vera Wave-4 #14 (spec §14 #3).
- `DocumentIntegrityError` — bytes on disk no longer hash to the expected value (corruption or tamper). Carries `expected` and `actual` hashes.

## Azure Blob lift (M8)

The local-fs implementation sits behind the `DocumentStore` interface deliberately. The M8 cloud-lift target (spec §4.1) maps:

| Local | Azure |
|---|---|
| `LocalFsDocumentStore` constructor / root path | `azure-blob://<container>/documents/` |
| `put(bytes)` → write file at `<root>/<algo>/<shard>/<rest>` | `BlockBlobClient.upload(bytes)` to blob name `<algo>/<shard>/<rest>` |
| `get(hash)` → read file | `BlobClient.download()` |
| `exists(hash)` → `existsSync(path)` | `BlobClient.exists()` |
| `metadata(hash)` → `statSync(path)` | `BlobClient.getProperties()` |
| `verifyOnRead` re-hash | Azure Blob's per-object MD5 + Customer-Managed-Key envelope tamper-evidence |

Encryption: per spec §4.1, the cloud target uses **Azure Key Vault Managed HSM (FIPS 140-2 Level 3)** with envelope encryption — per-document data-encryption-key wrapped by the customer-managed key. This satisfies P3 (cloud-native, key material in HSM) and the cross-cutting cryptographic-key-material rule.

The interface deliberately exposes no transactional or batch primitives in Slice 1; the M8 lift will add `putBatch` / streaming-`get` if the metering shows we need them.

## What Slice 1 does **not** include

- The seven RMS event types (`AgentBriefIssued`, `AgentRunStarted`, `AgentRunCompleted`, `DecisionRequested`, `Feedback`, `BriefSuperseded`, `RecordFiled`) — Slice 2.
- Projection logic (the seven registers) — Slice 3.
- Dashboard rendering — Slice 4.
- End-to-end round-trip — Slice 5.
- Migration of historical Owner Inbox / Team Inbox files into the store — never (spec §15).
- Retention-driven redaction events — Phase 4+.
- A `documents` SQLite manifest table — Slice 1 keeps the filesystem itself as the catalogue (`firstSeenAt` derived from filesystem ctime); the manifest layer in spec §5 lands when a recon pipeline needs it.
- OpenTelemetry spans for `put` / `get` — wired in alongside Slice 2 once the runtime helpers route through the store.

## Tests

`prototype/tests/document-store.test.ts` covers: round-trip put/get on text + binary, idempotent re-put returns same hash + `isNew: false`, hash determinism across runs (BLAKE3 test vector for "hello"), `exists` behaviour, integrity-on-read failure, malformed-hash rejection, sharded path layout.
