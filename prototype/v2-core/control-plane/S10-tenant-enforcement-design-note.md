# V2 S10 — Tenant-axis enforcement + anchor migration rehearsal (design note)

**Author:** Atlas (Substrate Architect, engineering)
**Independent validation:** Vera (Internal Audit Engineer, governance — third line)
**Workstream:** WS-V2-BBAAS
**Authority:** D-V2-TENANCY-ARCHITECTURE (Option C — per-tenant stores + control-plane store; tenant axis enforced at Wave 3), D-FIL-SHARED-ALIAS-REGISTRY, D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Brief:** `brief:atlas:v2-s10-tenant-axis-enforcement-anchor-migration-:2026-06-13`

## 1. What S10 does

S10 is the highest-migration-risk slice of the v2 build. It does two things:

1. **Flips the tenant axis from dark to enforced.** S2 added `tenantId` as a required envelope field plus the `isAnchorTenantEvent` dark predicate, deliberately written so enforcement is a single seam flip, not a call-site retrofit. S10 activates routing and isolation by `tenantId`.
2. **Rehearses the anchor migration** — proves the anchor bank's v2 events can be migrated into a dedicated per-tenant store (Option C) with byte-equivalence and identical projection results, as a REHEARSAL against a scratch store, never a live destructive migration.

## 2. The enforcement seam (S2 → S10 flip)

`v2-core/control-plane/tenant-store.ts` introduces:

- **`TenantScopedStore`** — binds an underlying v2-events store to a single `tenantId`. Every read it yields is scoped to that tenant; a row whose tenant tag does not match is a cross-tenant bleed and is dropped + counted (defence-in-depth, so the isolation recon asserts non-vacuously). Every write is checked — a foreign-tenant write throws (fail-closed).
- **`TenantStoreResolver`** — routes a `tenantId` to its scoped store. An unknown/unregistered tenant is rejected with `UnknownTenantError` (fail-closed) — never silently defaulted to the anchor, never an empty store. The cross-tenant surface is the control-plane store (S1), NOT a per-tenant resolver.
- **The seam** resolves through the **shared FIL alias-registry** (`fil-core/alias-registry.ts`) under the namespaced key `control-plane:tenant-store-resolver`, consistent with the SA-CCR model alias and the composition-factory alias (`recon:v2-alias-registry-conformance` continues to pass). The eager default is **fail-closed on every tenant**; a concrete resolver (anchor-only today; a real multi-tenant resolver at Wave 3 S11+) is swapped in behind the same boundary without touching any caller — the single seam S2 prepared.

**Correctness-neutral for the anchor.** There is one tenant today (`tenant:za-bank`); every v2 event already carries it. `resolveTenantStore(ANCHOR_TENANT_ID)` returns the anchor's scoped store reading the same anchor events. Nothing about the anchor's reads changes. The gate is now ACTIVE (unknown tenant fails closed; cross-tenant bleed is caught) rather than dark. All existing v2 gates stay green.

## 3. Per-tenant store routing (Option C)

Store resolution routes by `tenantId` → that tenant's own event store. The anchor resolves to its store; an unregistered tenant fails closed. This is the Option-C topology: per-tenant isolated stores + one cross-tenant control-plane store. The shared-store path is structurally identical to the eventual Azure target (Principle 3) — the M8 lift swaps the file path for a Cosmos/Postgres URL without touching capability code.

## 4. Anchor migration rehearsal (scratch-only)

`scripts/v2-anchor-migration-rehearsal.ts` reads the v2 anchor store (`BANK_V2_ANCHOR_DB`, default `v2-anchor.db`) **strictly read-only**, migrates its events into a **scratch** per-tenant store under an OS temp dir (created with `mkdtempSync`, deleted at the end), and asserts:

1. **Count parity** — scratch row count == source row count.
2. **Byte-equivalence** — each event's canonical column tuple (event_id, type, as_of, entity, actor, citations, payload) hashes identically (keyed by event_id, order-independent).
3. **Projection parity** — folding both stores into a canonical standing-data summary (count-by-type + per-natural-key payloads for products / account-types / RAS lines / deprecations) yields byte-identical JSON.
4. **Enforcement-path parity** — the migration writes and reads back through the S10 tenant-scoped store, proving the enforced path returns the same events with zero cross-tenant bleed.

### Hard safety constraints (honoured)

- The source is opened **read-only**. The rehearsal **refuses** to run if the resolved source path is the v1 canonical store (`event.db`) — a guard against mis-pointing at the just-recovered canonical store.
- The target is a scratch temp file, deleted at the end. `liveStoreWritten` is structurally always `false`.
- Idempotent: a fresh scratch file each run.

### Rehearsal result (against the live anchor store, read-only)

`116 / 116` events migrated; count parity ✅; byte-equivalence ✅; projection parity ✅; cross-tenant bleed `0`; **live store written: false**.

## 5. Recon

- **`recon:v2-tenant-isolation` (ENFORCING)** — asserts: scoped reads isolate (a synthetic store polluted with two tenants' events is read for the anchor; the foreign rows MUST be dropped — admitted=2, bleedDropped=3 — so the assertion is non-vacuous); routing fails closed on an unknown tenant; cross-tenant writes throw; every event in the live anchor store is anchor-scoped (zero bleed). Wired into the `infra` suite. A regression that stopped the scoped read from filtering by tenant tag fails this gate (verified by sabotage).
- **`recon:v2-anchor-migration-rehearsal` (advisory)** — runs the rehearsal and asserts the parity result holds and the live store was never written. Wired into the `domain` suite.

## 6. Out of scope

Actual live anchor migration (rehearsal only; live cutover is a separate gated decision); onboarding a real second tenant (Wave 3 S11+); the cross-tenant learning / CSI gate (S12); v1 imports under v2-core.

## 7. Substrate gap

The v2 anchor store's `v2_events` rows do not yet carry a `tenantId` column — the tenant axis lives on the in-memory envelope (S2) and the per-tenant store binding (S10), and the anchor store is single-tenant by construction. When a real second tenant onboards (Wave 3), the per-tenant stores are physically separate files, so the tenant axis is the store boundary itself; a `tenantId` column inside a shared store is only needed if the topology ever moves from per-tenant-file to shared-table-with-tenant-column. That is a Wave-3 decision, tracked, not closed here.

---

## Vera's independent validation note

**Validator:** Vera (Internal Audit Engineer, governance — third line). Reports functionally to Thandiwe (CAE); administratively through the CEO.
**Scope of validation:** the parity assertion is real (not self-referential); the scratch-only constraint held (live store untouched); the isolation gate genuinely fails closed.

### V-1 — Parity assertion is real, not self-referential. ✅
The rehearsal does not compare a store to itself. It reads the SOURCE read-only, writes a SEPARATE scratch store via the enforced scoped-write path, then re-opens the scratch store INDEPENDENTLY (a fresh `Database` handle, not the in-memory write buffer) and compares hashes + projection folds keyed by `event_id`. I confirmed non-vacuity two ways: (a) the rehearsal test `parity assertion is NON-VACUOUS` builds two DIFFERENT sources and shows their folds/counts differ — the parity primitive distinguishes content rather than being trivially true; (b) the byte hash deliberately excludes `recorded_at`/`sequence` (storage metadata) and canonicalises JSON, so parity asserts on event CONTENT, which is the correct equivalence for a migration.

### V-2 — Scratch-only constraint held; live store untouched. ✅
The source is opened with `{ readonly: true }`. The target is a `mkdtempSync` temp file deleted via `rmSync` at the end. The `assertSourceIsNotCanonical` guard throws if the source resolves to `event.db` or the canonical path — I confirmed the guard fires (test `refuses to read the v1 canonical event store`, and a live invocation pointing `BANK_V2_ANCHOR_DB` at the canonical store was REFUSED). The test `NEVER writes the live canonical store` asserts the source row count is unchanged before/after and the scratch path is under `tmpdir()`. `liveStoreWritten` is structurally `false`. I am satisfied the canonical store (post-WAL-incident) is never opened writable nor read as the migration source.

### V-3 — Isolation fails closed. ✅
`recon:v2-tenant-isolation` is ENFORCING (fail-severity) and its isolation assertion is non-vacuous: it reads an anchor-scoped store over a store polluted with 3 foreign rows and asserts exactly those 3 are dropped. I independently confirmed the gate has teeth — when the scoped read's tenant filter is removed, the gate FAILS with "ISOLATION BROKEN … leaked 3 foreign-tenant event(s)". Fail-closed routing (`UnknownTenantError` on an unregistered tenant, no silent anchor default) and fail-closed cross-tenant writes are both asserted by the gate and the unit tests.

**Verdict: VALIDATED.** The enforcement flip is correctness-neutral for the anchor, the rehearsal proves migration parity against a scratch store without touching the live store, and the isolation gate fails closed. No findings raised. The live cutover remains a separate gated decision (correctly out of scope).
