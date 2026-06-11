# Fixture-pollution selective archive extraction — run report

- **Author:** Atlas (Core banking platform architect, engineering)
- **Date executed:** 2026-06-11
- **Authority:** D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION (CEO-approved 2026-06-11)
- **Partition model precedent:** D-EVENT-STORE-SCALING-PHASE-5 (`prototype/platform/event-store/partitioned-store.ts`)
- **Brief:** `brief:atlas:selective-archive-extraction-fixture-pollution-r:2026-06-11`
- **Workstream:** WS-EVENT-STORE-HYGIENE
- **Target store:** canonical home event store (`$HOME/.local/share/bank/event.db`), 98,587 hot events pre-run
- **Pre-run backup:** `$HOME/.local/share/bank/event.db.pre-fixture-extraction-backup-2026-06-11` (sqlite `.backup`, WAL-checkpointed, 98,585 rows at backup time)

## 1. Scope

2,857 test-pollution rows (recorded 2026-05-26..29, all `build-phase-fixture`/
`simulated` provenance, zero GL/figure event types) sat in the canonical hot
store at sequences 229797–402688 — the full residual fail set of
`recon:entity-identity-coherence` after Bea (Accounting & financial reporting
engineer, engineering)'s LE-BANK-SA backfill (PR #1205 run report).

Identification rule (exactly three entity patterns):

```sql
entity LIKE 'BANK-FIXTURE-%' OR entity LIKE 'TEST-ENTITY-ANYA-M1%' OR entity = 'bank'
```

| Event type | Count |
|---|---|
| RiskRaised | 1,174 |
| BacktestRequested | 786 |
| BacktestRun | 740 |
| CdmBindingsRegenerated | 111 |
| SubstrateAlert | 39 |
| WorkstreamCompleted | 7 |
| **Total** | **2,857** |

18 distinct entity values: 15 × `BANK-FIXTURE-*` (2,738 rows), 2 ×
`TEST-ENTITY-ANYA-M1-*` (112 rows), bare `bank` (7 rows).

## 2. Mechanism (Principle 1 compliant — rows moved, never destroyed)

New event-store capability `EventStore.extractToArchivePartition(selection,
archivePath)` (`prototype/platform/event-store/store.ts`):

1. Selection by explicit event-id list **or** SQL predicate (bound params).
   Snapshot of matching rows taken first (cheap reads, ordered by sequence).
2. Rows copied — sequence, payload, provenance, all envelope columns
   preserved — into a NEW cold SQLite partition with the standard DDL.
   Sparse ranges are legal (precedent: partition 201112–201800 holds
   count=685 over a 689 span).
3. Archive count re-verified against the snapshot; SHA-256 computed on the
   final file bytes.
4. **Single short hot-store transaction** (`BEGIN IMMEDIATE`): register the
   `archive_partitions` row + delete EXACTLY the captured sequences (chunked
   IN-lists inside the one transaction). Launchd agents append concurrently;
   the delete targets the captured sequence list only, so concurrent inserts
   are untouched. Any mismatch rolls the whole transaction back and removes
   the archive file.
5. Events remain replayable via `PartitionedEventStore` (cold-first
   ordering); `verifyArchiveIntegrity()` covers the new partition.

### Read-only cold opens — latent Phase-5 defect found and fixed

While building the replay verification I found that
`PartitionedEventStore.openColdStore()` opened archives **read-write**, which
runs the `EventStore` open-time side effects (`PRAGMA journal_mode=WAL`, DDL
migrations, soft-tagger, dispatch-claim backfill). Verified empirically on a
copy of partition `d6256c35` — one replay flipped the journal-mode header
byte and permanently broke the registered SHA-256
(`44c75d…` → `aa5bf9…`). The existing 8 partitions still hash-verify only
because nothing had ever replayed them. Fix: `EventStore` gains a
`{ readonly: true }` mode (no PRAGMAs, no DDL, no migrations, zero byte
mutation) and all cold opens use it. Regression test:
`tests/extract-to-archive-partition.test.ts` ("hash integrity … still
verifies after replay").

## 3. Dry-run (captured 2026-06-11T07:09:47Z)

```
pre-scan: 2857 matching fixture-pollution rows in hot store
  mode=dry-run hotTotalBefore=98587 matching=2857 minSequence=229797 maxSequence=402688
  byType: RiskRaised=1174 BacktestRequested=786 BacktestRun=740
          CdmBindingsRegenerated=111 SubstrateAlert=39 WorkstreamCompleted=7
dry-run: no rows moved, no partition created
  wouldExtract=2857 hotTotalAfterWouldBe=95730
```

## 4. Live run (2026-06-11T07:09:58Z)

```
extracted 2857 rows to cold partition
  partitionId=8ceb321e-5287-4d8b-a3a9-7cdea294ded1
  archivePath=/Users/marc/.local/share/bank/archives/event-fixture-pollution-2026-06-11T07-09-58.db
  minSequence=229797 maxSequence=402688 eventCount=2857
  sha256=ff4b6fcaa9fbb5bdcdea56246e33a3e987215accb2df7f4a8ab577f8b1f8f4aa
```

Post-run verification (event-id-precise, `--verify-only`, exit 0):

| Check | Result |
|---|---|
| Matching rows remaining hot | **0** |
| Partition registered in `archive_partitions` | ✓ (count=2857, min=229797, max=402688) |
| New partition SHA-256 verifies | ✓ |
| All 9 partitions' SHA-256 verify | ✓ |
| `PartitionedEventStore.replay()` yields every extracted event_id | **2,857 / 2,857, each exactly once, 0 duplicates** |
| Total events hot+cold | 99,707 = 95,730 hot + 3,977 archived (unchanged through the move) |

**Verification note (first live run exited 1, extraction itself was clean).**
The initial post-run check compared a *pattern count* over the full
partitioned replay (2,977) against the extracted count (2,857) and flagged.
The 120-row difference is fixture-pollution rows that ALREADY sat in older
pre-floor partitions — swept below the hot floor by the Phase-5 cutoff
eviction job before this selective extraction existed (47 + 26 + 3 + 44 in
partitions `eed08aee`, `44e41b87`, `a570e169`, `bf7ed414`). The verification
was rewritten to be event-id-precise (every extracted id seen exactly once in
replay) with the pattern count retained as informational
(`preExistingColdMatchesByPattern: 120`). No data issue; no rows were lost.

## 5. Before/after measurements (fixed asOf = 2026-06-11T23:59:59.999Z)

Capture approach mirrors Bea's PR #1205 run report: dashboard-canonical calls
(`computeCapitalMetrics`, `getALMPositionSnapshot(store, asOf, 30,
"LE-ZA-HOZ-BANK")` + `computeLCR`/`computeNSFR`, `buildGlView` trial balance,
`buildRiskRegisterView`) against the home store, immediately before and after
the live run.

### Regulatory / GL figures — byte-identical (verified, not assumed)

| Figure | Before | After | Δ |
|---|---|---|---|
| Capital — available capital (minor) | 30,000,000,000 | 30,000,000,000 | 0 |
| Capital — TICR (minor) | 3,667,500,000 | 3,667,500,000 | 0 |
| Capital — headroom (ZAR) | 263,325,000 | 263,325,000 | 0 |
| Capital — total RWA (minor) | 26,196,360,449 | 26,196,360,449 | 0 |
| Capital — CET1 ratio | 114.52% (green) | 114.52% (green) | 0 |
| GL trial balance — ledger entries | 2,152 | 2,152 | 0 |
| GL trial balance — total debits (minor) | 161,986,651,406 | 161,986,651,406 | 0 (balanced before + after) |
| LCR (LE-ZA-HOZ-BANK scope) | 22,475.598451778533% | 22,475.598451778533% | 0 |
| LCR — HQLA (ZAR) | 2,247,559,845.177853 | 2,247,559,845.177853 | 0 |
| LCR — net 30d outflows (ZAR) | 10,000,000 | 10,000,000 | 0 |
| NSFR | 260.46642602145005% | 260.46642602145005% | 0 |
| NSFR — ASF (ZAR) | 300,000,000 | 300,000,000 | 0 |
| NSFR — RSF (ZAR) | 115,177,992.25889263 | 115,177,992.25889263 | 0 |

### Dashboard-feed deltas — measured (these changes are the intent)

| Feed input | Before | After | Δ |
|---|---|---|---|
| Hot store total events | 98,587 | 95,730 | **−2,857** |
| Archived total (Σ partition counts) | 1,120 | 3,977 | **+2,857** |
| Registered archive partitions | 8 | 9 | +1 |
| `RiskRaised` (hot) | 2,448 | 1,274 | −1,174 |
| `SubstrateAlert` (hot) | 1,321 | 1,282 | −39 |
| `BacktestRun` (hot) | 740 | **0** | −740 |
| `BacktestRequested` (hot) | 786 | **0** | −786 |
| `CdmBindingsRegenerated` (hot) | 115 | 4 | −111 |
| `WorkstreamCompleted` (hot) | 8 | 1 | −7 |
| Risk-register distinct findings | 16 (all simulated) | 7 (all simulated) | −9 |
| Risk-register production findings | 0 | 0 | 0 |

Notable: **every** `BacktestRun`/`BacktestRequested` event in the hot store
was fixture pollution — the backtest dashboard feed now reads empty until
real backtest runs land. The risk register loses 9 simulated fixture findings;
production findings were and remain 0. Hot min/max sequence unchanged
(222996 / 465384) — the extraction was interior-sparse.

## 6. Recon baselines before/after

### recon:entity-identity-coherence (home store)

| | Before | After | Δ |
|---|---|---|---|
| Events asserted | 98,585¹ | 95,730 | |
| fail-class violations | **2,857** | **0** | **−2,857** |
| warn-class violations | 0 | 0 | 0 |
| ok | false | **true** | |

¹ Captured minutes before the run; launchd appends moved the count to 98,587
by execution time. All 2,857 fails were the three fixture patterns.

### recon:event-store-append-only (home store)

Before (2026-06-11T07:08:33Z) — 1 fail:

```
[FAIL] archive_partitions:sequence-gap: Last pre-floor partition max_sequence=203831;
       hot store MIN(sequence)=222996. Expected hot floor at 203832.
```

After (2026-06-11T07:13:19Z) — **the same single fail, nothing else**:

```
[FAIL] archive_partitions:sequence-gap: … max_sequence=203831 … MIN(sequence)=222996 …
```

Plus a controlled demonstration of the new partition-aware semantics: seeding
the pipeline with the pre-extraction observation as baseline (hot=98,587,
archived=1,120) and re-running post-extraction yields:

```
[INFO] events:rowCount:archive-sanctioned: Hot row count decreased from 98587 to 95730
       (delta -2857) but the effective row count (hot + archived) held: 99707 → 99707.
       The decrease is covered by registered archive partitions (archived 1120 → 3977);
       rows moved cold, none destroyed.
[FAIL] archive_partitions:sequence-gap: …(the known historical gap, unchanged)…
```

i.e. the hot decrease is sanctioned **iff** exactly covered by newly
registered partitions (count reconciliation on the effective row count =
hot + archived), surfaced as a non-failing info note — never silent. An
uncovered decrease still fails (red-team tests in
`platform/recon/event-store-append-only.test.ts` prove a bare DELETE without
a partition fails, partial coverage fails, and a vanished partition fails).
Sequence-level coverage is asserted by two new file-level checks:
**registry-parity** (cold file count/min/max must match its registry row) and
**hot-overlap** (no sequence may live in both tiers).

### The known pre-existing gap — left failing, deliberately

Rows 203832–222995 (last pre-floor partition max 203831 vs hot floor 222996)
remain a **visible fail** before and after. The reworked boundary check
restricts itself to pre-floor partitions, so the new overlapping extraction
partition cannot mask it — and no formal "documented historical gap" record
was introduced: silently absorbing it via a registry entry without the actual
rows would weaken the invariant, so it stays failing until the rows are
recovered or a CEO-level decision formally writes the gap off. Observation
for that future triage: `$HOME/.local/share/bank/archives/` holds 7
**unregistered** archive files (2026-05-24..28) covering sequences 1–123431 —
they do NOT contain the missing range either; the gap rows are genuinely
unaccounted for on this machine. Local `bun run ci` in any worktree continues
to show this one failure against the home store; clean-store GitHub CI is
unaffected.

## 7. Root-cause guard

`tests/_setup.ts` has redirected `BANK_EVENT_DB` to a tmpdir unconditionally
since 2026-05-29 (the pollution dates 2026-05-26..29 predate exactly that
hardening). The residual hole — any code path constructing an `EventStore`
directly at the shared home path from inside a test process — is now closed
at the construction site: the `EventStore` constructor **refuses** to open
the home-default store (or the `BANK_HOME_EVENT_DB` location) when
`NODE_ENV === "test"` (bun test sets this automatically), unless
`BANK_TEST_USE_AMBIENT_DB=1` (the same explicit opt-in `tests/_setup.ts`
honours). Read-only opens are exempt (cannot pollute). Full suite passes with
the guard active.

## 8. Artefacts

- `prototype/platform/event-store/store.ts` — `extractToArchivePartition()`, `ExtractionSelection`/`ExtractionResult`, `{ readonly: true }` open mode, home-store-under-test guard (`forbiddenTestHomeStorePath`)
- `prototype/platform/event-store/partitioned-store.ts` — read-only cold opens
- `prototype/platform/recon/event-store-append-only.ts` — partition-aware effective-count/effective-max semantics, pre-floor boundary check, registry-parity + hot-overlap checks
- `prototype/scripts/archive-extract-fixture-pollution.ts` — operator CLI (`--dry-run`, `--verify-only`)
- `prototype/tests/extract-to-archive-partition.test.ts` — 19 tests
- `prototype/platform/recon/event-store-append-only.test.ts` — +12 partition-aware tests
- Cold partition `8ceb321e-5287-4d8b-a3a9-7cdea294ded1` at `$HOME/.local/share/bank/archives/event-fixture-pollution-2026-06-11T07-09-58.db` (2,857 events, SHA-256 `ff4b6fca…f4aa`)
