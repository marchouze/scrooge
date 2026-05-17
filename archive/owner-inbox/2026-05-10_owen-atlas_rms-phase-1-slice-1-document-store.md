---
title: RMS Phase 1 Slice 1 — content-addressed document store + BLAKE3 hashing
author: Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering)
date: 2026-05-10
summary: First slice of D-RMS-PHASE-1 lands. Content-addressed document store with BLAKE3 hashing, sharded local-fs layout (`<root>/<algo>/<first-2>/<rest>`), `BANK_DOCUMENT_STORE_PATH` env var, integrity-on-read by default, 22 unit tests passing. Foundation for Slices 2–5; no event types or projections yet.
decision-required: false
decision-id: D-RMS-PHASE-1-SLICE-1
decision-category: substrate-foundational
decision-owner: Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering)
---

# RMS Phase 1 Slice 1 — content-addressed document store + BLAKE3 hashing

> **Standing authority:** `D-RMS-PHASE-1` (CEO-approved 2026-05-09). Slice authorisation: `D-RMS-PHASE-1-SLICE-1`. No new CEO decision required — this slice executes the substrate the parent decision authorised.
>
> **Spec:** [`Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`](2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md), §4 (Document substrate) and §5 (implementation notes).

## What landed

The first slice of the Records Management Substrate — the **content-addressed document store** that all subsequent slices depend on. Bytes go in; a `<algo>:<hex>` hash comes out; identical bytes always yield the same hash; no `delete`. Events in later slices reference documents by hash; the store knows nothing about events.

### Module — `prototype/platform/document-store/`

| File | Purpose |
|---|---|
| `types.ts` | `DocumentStore` interface, `DocumentHash` branded type, `PutResult` / `DocumentMetadata` shapes, `DocumentStoreMissError` / `DocumentIntegrityError` errors. |
| `hash.ts` | BLAKE3 `hashContent(content, algo?)` and `parseHash(hash)`. Hash format `blake3:<64-hex-chars>` with algorithm prefix for non-breaking future swaps. |
| `local-fs.ts` | `LocalFsDocumentStore` — local filesystem implementation behind the interface. Sharded layout, env-var configurable root, integrity-on-read by default. |
| `index.ts` | Public surface re-export. |
| `README.md` | Caller docs, hash-choice rationale, sharding rationale, Azure lift mapping, what Slice 1 deliberately does not include. |

### Tests — `prototype/tests/document-store.test.ts`

22 tests, 298 expectations. Coverage:

- Round-trip put/get for text + UTF-8 strings + binary payloads.
- Idempotent re-put returns same hash + `isNew: false`.
- Hash determinism across separate store instances (two stores agree).
- Hash matches the known BLAKE3 test vector for `"hello"`.
- `exists` returns boolean and never throws (including on malformed hashes).
- `metadata` shape (hash, path, size, algo, firstSeenAt).
- `get` throws `DocumentStoreMissError` on cache miss.
- Integrity-on-read catches on-disk corruption (`DocumentIntegrityError`).
- `verifyOnRead: false` skips the integrity check.
- Sharded layout: `<root>/blake3/<first-2>/<rest>`.
- `parseHash` rejects missing prefix, unsupported algo, non-hex, wrong length.
- `BANK_DOCUMENT_STORE_PATH` env var configures the root.
- Explicit `opts.root` overrides env var.

All 22 pass. `bun run typecheck` and `bun run lint` clean.

## BLAKE3 — implementation choice + rationale

**Picked:** [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) v2.2.0 — Paul Miller's audited zero-dependency TypeScript hashing suite (the package family the Ethereum / Bitcoin TS ecosystems trust). BLAKE3 import via `@noble/hashes/blake3.js`.

**Why BLAKE3** (per spec §4.1):
- 256-bit output, ~6× faster than SHA-256 on the markdown-sized payloads RMS handles.
- Cryptographically sound; well-reviewed.
- Native TS implementation — no FFI / native-binary dependency, so the local store is bun-native and CI-portable.
- Verified the implementation against the canonical BLAKE3-256("hello") test vector (`ea8f163d…`) — passes.

**Why not SHA-256:** the spec recommends BLAKE3 with SHA-256 reserved as a FIPS-only-context fallback. The bank has no FIPS-only deployment surface in Phase 1; adding SHA-256 now would be premature. The hash-string algorithm prefix (`blake3:` / future `sha256:`) makes the swap non-breaking when an Azure-MHSM-FIPS-mode deployment surface lands at M8.

**Why not the `bun:` native crypto** — Bun's `crypto.subtle` does not expose BLAKE3, only SHA family. We could shell out to a Rust-backed crate, but the audit pedigree of `@noble/hashes` is materially better than a one-off binding and the perf delta (pure-JS BLAKE3 vs. native) is irrelevant for the kilobyte-scale payloads RMS handles in Phase 1.

## Directory sharding — pattern + rationale

```
<root>/<algo>/<first-2-hex>/<remaining-hex>
e.g. <root>/blake3/a1/b2c3...d4
```

The first two hex characters partition the namespace into **256 buckets**. A flat directory of 10k+ documents triggers slow inode-listing and tab-completion pain on most filesystems; a flat 100k store is unworkable. Sharding caps any single directory at ~N/256 entries — for a Phase 1 horizon of, say, 5k documents that's <20 files per shard.

Two levels of sharding (`first-2` then `next-2`) was considered and rejected — for the order of magnitude RMS will see in Phase 1 (briefs, run records, decision records, feedback bodies — low thousands per agent-month), one level of 256-way sharding is sufficient. If we push past ~250k documents we revisit, but Azure Blob lift (M8) likely lands first and changes the question entirely.

## Env-var contract

```
BANK_DOCUMENT_STORE_PATH=<absolute-or-relative-path>
```

- **Default:** `prototype/data/documents/` resolved against `process.cwd()`.
- **Explicit constructor `opts.root` overrides the env var** (tests and recon harnesses use this to point at temp directories).
- The local store path is gitignored (`prototype/.gitignore` excludes `data/documents/*` with a `.gitkeep` exception); the directory is created on first `put`.

## Azure migration mapping (M8)

The local-fs implementation sits behind the `DocumentStore` interface deliberately. Per spec §4.1, the M8 cloud-lift swaps in an Azure Blob impl with **Azure Key Vault Managed HSM (FIPS 140-2 Level 3) envelope encryption** — per-document data-encryption-key wrapped by the customer-managed key.

| Local-fs (today) | Azure (M8) |
|---|---|
| `LocalFsDocumentStore` constructor / root path | `azure-blob://<container>/documents/` |
| `put(bytes)` → write file at `<root>/<algo>/<shard>/<rest>` | `BlockBlobClient.upload(bytes)` to blob name `<algo>/<shard>/<rest>` |
| `get(hash)` → `readFileSync` | `BlobClient.download()` |
| `exists(hash)` → `existsSync` | `BlobClient.exists()` |
| `metadata(hash)` → `statSync` | `BlobClient.getProperties()` |
| `verifyOnRead` re-hashes bytes | Azure Blob's per-object MD5 + Managed-HSM envelope tamper-evidence |

No call site changes at the swap. The interface deliberately exposes no transactional or batch primitives in Slice 1; the M8 lift will add `putBatch` / streaming-`get` if metering shows we need them.

## Substrate gaps remaining (Slices 2–5)

This slice is the foundation; the remaining four slices build on top. None of these are touched in Slice 1.

| Slice | Scope | Status |
|---|---|---|
| **Slice 2** — Event-type registration + record helpers | Seven new entries in `EVENT_TYPE_REGISTRY` (`AgentBriefIssued`, `AgentRunStarted`, `AgentRunCompleted`, `DecisionRequested`, `Feedback`, `BriefSuperseded`, `RecordFiled`); `make<EventType>()` constructors; `record<EventType>()` runtime helpers in `prototype/runtime/rms/record.ts`; backwards-compatible `CeoDecisionBody` extension (`requestEventId`, `recordDocumentHashes`, `modifiedRecommendation`). | Pending. |
| **Slice 3** — Projection runtime for the seven registers | `prototype/dashboard/derive-rms.ts` exporting seven projections: Decisions, Correspondence, Records-of-agent-runs, Document, Feedback, Briefs, Workstreams. | Pending. |
| **Slice 4** — Dashboard render (dual-render) | Seven new dashboard sections rendering the registers; Decisions Desk page; legacy Owner Inbox feed remains visible. | Pending. |
| **Slice 5** — End-to-end round-trip | One full chain through the substrate with no Owner Inbox / Team Inbox file authored. Suggested case: Mira (Compliance / RegTech engineer) obligations-register-update brief. | Pending. |

Other gaps surfaced by this slice:

1. **No OpenTelemetry spans on `put` / `get` yet.** Spec §5 calls for them. Wired in alongside Slice 2 when the runtime helpers route through the store and we have a real call volume to instrument; a no-op span infrastructure today would be premature.
2. **No `documents` SQLite manifest table.** Spec §5 reserves the option. Slice 1 keeps the filesystem itself as the catalogue (`firstSeenAt` derived from filesystem ctime). The manifest layer lands when a recon pipeline needs it (likely Slice 2 or 3).
3. **No Vera recon pipelines yet.** Spec §14 lists seven (`recon/rms-event-projection-parity`, `recon/rms-orphan-documents`, `recon/rms-dangling-references`, `recon/rms-supersession-resolution`, `recon/rms-citation-coverage`, `recon/rms-identity-pairing`, `recon/rms-overlap-parity`). All depend on events existing — wired in alongside Slice 2 onward.
4. **SHA-256 fallback not implemented.** Reserved in the type system; deferred until a FIPS-only context appears (likely M8 if the Azure target is FIPS-mode-only).
5. **`get` is sync.** Acceptable for the local-fs impl; the Azure impl will need an async surface. The interface will gain an async sibling at M8 — call sites that read large documents convert at the same time.

## Co-existence with parallel S8 A0

Atlas is also running **S8 A0** (`agent-runtime substrate schemas frozen`) in a separate worktree. That dispatch touches event-store schemas (`event-types.ts`, `registry.ts`, new `schemas/` dir) and a new `permission-policy.ts`. **This slice touches none of those files** — Slice 1 is purely `prototype/platform/document-store/` + `prototype/data/documents/` + the test file. No merge conflicts expected.

## Provenance

- **Authorship.** Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering). Both agents speak in the README and this record; Atlas leads the implementation files; Owen leads the records-management framing in the README and this provenance.
- **Parent decision.** `D-RMS-PHASE-1`, CEO-approved 2026-05-09, action `approve`, recorded in `Owner Inbox/actioned/2026-05-09_ceo-decisions-export.md`. The standing authority covers Phase 1 build sequencing including this slice; per the no-pause rule, no per-slice CEO confirmation needed.
- **Slice authorisation.** `D-RMS-PHASE-1-SLICE-1`, recorded by `prototype/scripts/record-d-rms-phase-1-slice-1.ts` (companion script committed alongside this record).
- **Citations.** Spec §4 (Document substrate), §4.1 (hash + cloud target), §4.2 (API surface), §5 (implementation notes), §14 (recon pipelines), §17 (substrate gaps); Principle 1 (events as truth — store knows nothing of events); Principle 3 (cloud-native — local-fs impl behind clean interface for M8 swap); Principle 7 (autonomous-by-default — Slice 1 is a pure substrate slice with no human-in-the-loop step).

—Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering)
