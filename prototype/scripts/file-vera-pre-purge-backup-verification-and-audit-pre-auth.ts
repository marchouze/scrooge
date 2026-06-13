// scripts/file-vera-pre-purge-backup-verification-and-audit-pre-auth.ts
//
// RMS Phase 3 filing — Vera's pre-purge backup verification and audit
// pre-authorisation for the decimal-money config-only event-store purge.
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED (CEO-approved 2026-06-13);
//            D-MONEY-DECIMAL-REDENOMINATION (CEO-approved 2026-06-13).
// Brief: brief:vera:pre-purge-backup-verification-and-audit-pre-auth:2026-06-13
// Run: run:vera:2026-06-13T17-14-06-010Z
// Author: Vera (Internal audit engineer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID =
  "record:documents:vera:pre-purge-backup-verification-and-audit-pre-auth:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-vera-pre-purge-backup-verification] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# Pre-purge Backup Verification and Audit Pre-authorisation

**Author:** Vera (Internal audit engineer, governance)
**Date:** 2026-06-13
**Authority:** D-MONEY-DECIMAL-BUILD-PROCEED; D-MONEY-DECIMAL-REDENOMINATION (both CEO-approved 2026-06-13)
**Brief:** brief:vera:pre-purge-backup-verification-and-audit-pre-auth:2026-06-13
**Run:** run:vera:2026-06-13T17-14-06-010Z
**Design spec reviewed:** blake3:c24b1f4a3976116e12de5dad48f2a96d3e367110b89a402430c74206c6bab83a (RecordFiled seq 478069)
**PRs reviewed (slices 1–2, now merged):** #1321 (slice 1 — decimal Money foundation), #1322 (slice 2 — schema sweep, 33 transactional event types)

---

## 1. Pre-authorisation Decision

**SIGN-OFF WITH CONDITIONS**

The pre-purge backup verification and audit pre-authorisation is **granted** for
slices 3–6 (backup → purge + re-seed → recon re-baseline → FX A4 resume),
subject to the conditions enumerated in §6.

Slices 1–2 (non-destructive) are **already merged** (PR #1321, #1322). The
remaining gated conditions are binary: no destructive slice may begin until
every condition is met. The purge gate in the purge script MUST check for the
presence of a \`RecordFiled{title:"Pre-purge backup verified"}\` event — if absent,
the script MUST abort with a non-zero exit before touching the live store.

---

## 2. Audit Review of the Retention Manifest

### 2.1 Retained set — audit-integrity assessment

I have read the full design spec (blake3:c24b1f4a..., §§2–3) authored by
Atlas (Core banking platform architect, engineering) and co-authored by Bea
(Accounting & financial reporting engineer, engineering). My audit assessment:

**Governance provenance is preserved.** The retained set — Decisions, RMS
documents, AgentBriefIssued / AgentRunStarted / AgentRunCompleted (dispatch
ledger), Party register, legal-entity tree, Chart of Accounts, RAS/posture
registers, obligations/policies/procedures, regulatory library, model-validation
and threat-model governance events, InstrumentDimensionAssigned, SliceDefined,
OrgHierarchyEdgeAssigned — is sufficient to reconstruct who decided what, when,
under what authority, and to which workstream any decision was dispatched.
Governance accountability survives the purge intact.

**No regulatory-retention obligation is violated.** All 33 purged event types
are **build-phase simulated transactional events** — there are no real customers,
no real capital, no real counterparties. The bank is in its pre-licence build
phase. No statutory retention obligation (Banks Act, Regulations Relating to
Banks, POPIA, FIC Act) applies to simulated/test transactional data. The cold
archive preserves the true historical sequence for forensic and engineering
reference regardless.

**The purge classification rule is mechanically sound.** The rule — "purge iff
the event type carries a transactional money amount: a *Minor field, an amount*
field, or a Money-typed payload field denoting a position, posting, valuation,
or flow" — maps cleanly to the 33 explicitly enumerated event families. It is
not a heuristic; it is a structural property of the payload schema. I confirm
the rule does not over-reach into governance/config event types.

**Retained money edge cases (§2.3) are identified and handled.** The five
retained-money families (ifrs-policy-thresholds, RAS thresholds, Posture
thresholds, obligation/policy thresholds, CoA opening config) are correctly
classified as config-not-flow and are explicitly called out for re-seeding in
the decimal encoding. The \`recon:no-residual-minor-encoding\` gate provides
continuous enforcement once the fresh store is seeded.

**CoA definitions are retained; opening balances are not.** The Chart of Accounts
event definitions survive as config. Any seeded opening-balance events are
transactional and are purged; the re-seed regenerates them via the decimal Money
type. This is correct.

**Dangling citation handling is sound.** Retained Decisions that cite purged
transactional events preserve those citations verbatim as provenance (they remain
historically true), and the pre-purge backup serves as the forensic resolver for
any such citation. No live projection attempts to dereference a purged event.
The \`recon:retained-decision-citation-resolvability\` gate (to be authored in
slice 5) provides ongoing enforcement.

### 2.2 Additional event types in hot store not in original 33-family list

I reviewed the hot-store event census. Several event types in the hot store
that are not pure governance fall partially into the transactional zone:

- **BondPositionRevalued** (650 events in hot store) — transactional, carries
  monetary valuation. PURGE.
- **SubLedgerPostingEmitted** (1,269 events) — transactional, carries money.
  PURGE.
- **DailyPnLReportGenerated** (189 events) — contains monetary aggregates.
  PURGE.
- **FxSettlementInstructed** (62 events) — transactional payment instruction.
  PURGE.
- **FxTradeExecuted** (44 events), **FxPositionRevalued** (41 events) —
  transactional FX. PURGE.
- **PrincipalPayment** (50 events) — transactional cash. PURGE.
- **BondTradeExecuted** (172 events), **BondSettlementInstructed** (170 events),
  **BondCustodianSettlementConfirmed** (170 events) — transactional bond
  lifecycle. PURGE.
- **ValuationAdjustmentComputed** (66 events in hot; also in archive) —
  transactional valuation. PURGE.
- **IRRBBChecked** (120 events) — contains delta-EVE monetary amounts derived
  from the transactional book. PURGE (regenerated post re-seed by Ravi's ALM
  engine on the new decimal book).
- **CounterpartyBaselClassAssigned** (18 events in hot) — this is a CRO
  governance classification event, NOT a transactional balance. RETAIN. It
  carries no money fields; it maps counterparty to Basel class.
- **OfficialMarkAdopted** (581 events) — market-data marks, not a transactional
  book event. These carry rates/levels, not Money-typed amounts. RETAIN as
  market-data config; confirm with Atlas if any payload carries a MoneyWire field.

**Finding VERA-PRE-PURGE-001 (advisory):** The 33-family list in the spec may
not enumerate all transactional event types in the live store (BondPositionRevalued,
SubLedgerPostingEmitted, FxTradeExecuted, FxPositionRevalued, BondTradeExecuted,
DailyPnLReportGenerated, PrincipalPayment, etc. were in the hot store but not
named in the spec's representative list). The mechanical classification rule
(§2.2 of the spec) IS correct and covers all of these by structural property.
The purge script must apply the rule programmatically (scanning event-types
registry for *Minor fields / MoneyWire payloads) rather than matching against
a hand-written list of 33 names. This is how Atlas spec'd the rule; I confirm
it is the right approach.

### 2.3 Audit trail integrity summary

Verdict: **the retention manifest preserves full governance accountability** and
the purge is scoped exclusively to build-phase simulated transactional data.
No regulatory-retention obligation is breached. The pre-purge backup (§4)
provides forensic recovery for any purged transactional citation referenced
in retained governance events.

---

## 3. LE-Identity Re-authoring — Acceptability Statement

**I explicitly sign off that re-authoring retained events under the corrected
legal-entity identity is acceptable, for the following reasons:**

1. **The full pre-purge backup preserves the true historical sequence.** The
   original LE-ZA-HOZ-BANK-stamped governance events, their original event_ids,
   timestamps, and exact payload bytes are preserved in the content-addressed
   backup (§4) and in the 19 existing archive partitions registered in the
   archive_partitions table. No factual history is destroyed.

2. **The re-stamp is a declared transformation, not a silent mutation.**
   Transformation #2 (LE identity correction) is explicitly named in the
   re-seed manifest alongside transformation #1 (decimal encoding). The audit
   trail is: backup (true history) + fresh store (corrected genesis) + declared
   transformation manifest linking them. A forensic auditor can reconstruct
   the original from the backup; the fresh store is a correctly-attributed
   genesis, not a falsification.

3. **The alternative — carrying LE-ZA-HOZ-BANK through the immutable
   governance spine — would embed a known incorrect identity in the canonical
   record.** That is the worse outcome from a governance standpoint. The
   correction window is now, before licence-day, in the build phase with no
   real capital or customers.

4. **Without the backup, re-stamping immutable governance would be a
   Principle-1 violation.** The backup is therefore a hard prerequisite, not
   optional. The purge script gate (§5) enforces this mechanically.

**Condition:** the \`<CANONICAL_LE>\` value — the correct registered legal-entity
short-id and legalName — must be confirmed by the CEO before the purge script
runs. Until that input is provided, the re-seed's \`entity\` field is undefined
and no re-authoring may proceed (see §6, Condition 1).

---

## 4. Backup Procedure (Concrete Steps)

**Gate: The purge script MUST check for a \`RecordFiled{title:"Pre-purge backup verified"}\`
event in the live store before any destructive operation. If absent, the script
exits non-zero with a clear error message. No exceptions.**

### Step 1 — Stop all writers

Halt the dashboard server and any background agent processes that write to
\`$HOME/.local/share/bank/event.db\`. Confirm no writers are active. Check for
WAL sidecars (\`event.db-shm\`, \`event.db-wal\`): if WAL is non-zero bytes, a
writer is still active. Wait until WAL checkpoints to zero.

### Step 2 — Export the live hot store

\`\`\`bash
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="$HOME/.local/share/bank/backups"
mkdir -p "$BACKUP_DIR"

# SQLite online backup (safe, consistent snapshot)
sqlite3 "$HOME/.local/share/bank/event.db" \
  ".backup '$BACKUP_DIR/event-pre-purge-$TIMESTAMP.db'"
\`\`\`

### Step 3 — Compute SHA-256 hash of the backup file

\`\`\`bash
BACKUP_FILE="$BACKUP_DIR/event-pre-purge-$TIMESTAMP.db"
HASH=$(shasum -a 256 "$BACKUP_FILE" | awk '{print $1}')
echo "SHA-256: $HASH"
echo "File: $BACKUP_FILE"
\`\`\`

Record \`HASH\` and \`BACKUP_FILE\`. Both go into the RecordFiled verification event
(Step 6).

### Step 4 — Verify the backup round-trips

\`\`\`bash
# Open backup and run integrity check
sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" | grep -v "^ok$" && echo "INTEGRITY FAIL" && exit 1
# Verify event count matches live store
BACKUP_COUNT=$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM events;")
LIVE_COUNT=$(sqlite3 "$HOME/.local/share/bank/event.db" "SELECT COUNT(*) FROM events;")
if [ "$BACKUP_COUNT" != "$LIVE_COUNT" ]; then
  echo "COUNT MISMATCH: backup=$BACKUP_COUNT live=$LIVE_COUNT" && exit 1
fi
echo "Backup verified: $BACKUP_COUNT events, integrity OK"
\`\`\`

### Step 5 — Confirm cold archive partitions are retained as cold copies

The 19 existing archive partitions at \`$HOME/.local/share/bank/archives/\` MUST
NOT be deleted or overwritten. They are cold copies covering sequences 1–228241.
After the purge, the archive_partitions table in the fresh store must still
reference these files with their original SHA-256 hashes. The
\`verifyArchiveIntegrity()\` check must pass over them post-cutover.

**Cold-copy storage location:** \`$HOME/.local/share/bank/archives/\`
(the 19 existing .db files). No relocation needed — they remain in place.

The pre-purge backup (Step 2) is stored at \`$HOME/.local/share/bank/backups/\`
as an additional read-only cold copy. It is NOT registered as an archive
partition (it is the entire hot store snapshot, not a selective extraction).

### Step 6 — File the verification RecordFiled event

After Steps 1–5 pass, file a \`RecordFiled\` event with title
\`"Pre-purge backup verified"\` in the LIVE event store (BEFORE purging). This
event is the gate the purge script checks. It must carry:

- \`backupFile\`: the absolute path to the backup file
- \`sha256Hash\`: the SHA-256 hex digest from Step 3
- \`eventCount\`: the event count from Step 4
- \`effectiveMaxSequence\`: 478274 (pre-purge high-water mark)
- \`effectiveTotalRows\`: 187,493 (106,910 hot + 80,583 archived)
- \`archivePartitionCount\`: 19
- \`verifiedAt\`: ISO-8601 timestamp
- \`verifiedBy\`: "vera:internal-audit-engineer" (or the operator ID who ran the steps)

A template script (\`scripts/file-pre-purge-backup-verified.ts\`) should be
authored as part of slice 3 (backup slice). Vera reviews its output before
the purge slice begins.

---

## 5. Recon Gate Re-baseline Plan

The following gates are invalidated by the purge and require deliberate reset.
For each gate: current ratchet value → post-purge value → reset action.

### Gate 1: \`recon:event-store-append-only\`

**Current baseline values (from \`prototype/.local/recon/event-store-append-only.json\`):**
- rowCount: 61,944 (stale — this is the main-worktree baseline, not the home-store baseline)
- maxSequence: 427,621
- Home-store live: hot=106,910, hot_max=478,274, archived=80,583, archived_max=402,688
- Effective total: 187,493 rows; effective max: 478,274

**Post-purge value:** fresh store begins at sequence 1 (new AUTOINCREMENT);
hot row count drops to the number of re-authored retained events (~few thousand
governance events); archived max stays at 402,688 (cold archive files unchanged).

**Reset action:**
1. Delete \`prototype/.local/recon/event-store-append-only.json\` (the main
   worktree baseline file). Any other worktree baselines are also stale and
   should be deleted.
2. On the FIRST run of \`bun run recon:event-store-append-only\` against the
   fresh store, the gate self-initialises: \`asserted=1\`, baseline seeded from
   the fresh store's observation. Future runs ratchet forward from there.
3. The row-count "regression" (from ~187k effective rows to ~few thousand) is
   sanctioned by the cutover (D-MONEY-DECIMAL-BUILD-PROCEED). The pre-purge
   backup serves as the forensic record; the cold archive partitions remain
   registered and counted in the archived_count. Net: the effective count
   regression is exactly the purged transactional rows. Record this as an
   INFO note in the cutover checklist, not a violation.
4. The hot-overlap check (archive vs hot store) may trip if old archive
   partitions overlap the new hot range. In the fresh store, hot sequences
   start from 1; cold archive partitions cover the OLD sequence range
   (1–228241). There is no overlap by construction (new sequences are
   independent). Confirm by running \`recon:event-store-append-only\` after re-seed
   and asserting zero FAIL violations.

### Gate 2: \`recon:archive-span\` (archive partition registry)

**Current state:** 19 archive partitions registered (seq 1–228,241 in various
overlapping selective-extraction files). The 19 files are at
\`$HOME/.local/share/bank/archives/\`. The archive_partitions table in the hot
store carries their SHA-256 hashes.

**Post-purge requirement:** the 19 existing archive partitions are retained
as read-only cold copies and re-registered in the FRESH store's archive_partitions
table (same partition_id, same path, same min/max sequence, same sha256_hash).
The fresh store's hot range (new sequences starting at 1) is DISJOINT from the
cold archive range (1–228241 in the OLD sequence space). This is acceptable
because the purge creates a new genesis — the cold archive preserves the OLD
history, and the fresh store holds the new corrected history. The two sequence
namespaces are reconciled by the transformation manifest.

**Reset action:**
1. After the purge wipes the hot store's events table (and resets AUTOINCREMENT),
   re-insert the 19 archive_partitions rows into the fresh store (same data).
2. Run \`PartitionedEventStore.verifyArchiveIntegrity()\` — must pass green over
   all 19 cold files (SHA-256 hashes match, file bytes unchanged).
3. Additionally, register the pre-purge backup file (Step 4) as a cold-copy
   record (not an archive_partitions row, since it's the full hot snapshot,
   not a selective extraction) — record its path and SHA-256 in the
   \`RecordFiled{title:"Pre-purge backup verified"}\` event.

### Gate 3: \`recon:no-transactional-sim-events\` (NEW — to be authored in slice 5)

**Current posture:** does not exist yet. Authored as part of slice 5 (recon
re-baseline). On a fresh store with no seeded simulated transactions,
\`asserted = event count\`, \`violations = 0\` trivially.

**Assertion:** zero events in the live hot store carry
\`provenance.kind = "simulated"\` or \`"build-phase-fixture"\` in a
transactional event type family. Pure governance events (Decisions,
RecordFiled, etc.) that happen to carry a provenance field that is not
"sanctioned-entry" are excluded from the gate's scope.

**Baseline:** seed the gate on the first run against the fresh store. Expected
result: all-zero violations. Any transactional sim event appearing post-cutover
is a hard finding.

**Reset action:** author the gate in slice 5; run against the fresh store;
record baseline=0 violations.

### Gate 4: \`recon:no-legacy-le-identity\` (NEW — spec §3.3, to be authored in slice 5)

**Current posture:** does not exist yet. The existing
\`entity-identity-coherence\` gate tolerated pre-boundary BANK-ZA-001 events.
The new gate is stricter: ZERO occurrences of LE-ZA-HOZ-BANK, BANK-ZA-001,
LE-BANK-SA in any event in the fresh store.

**Baseline:** on a correctly re-seeded store, \`asserted = event count\`,
\`violations = 0\`. The only permitted entity value is \`<CANONICAL_LE>\` (plus
genuine counterparty short-ids from the active Party register).

**Reset action:** author the gate in slice 5 before re-seeding; run against the
fresh store post re-seed; confirm zero violations.

### Gate 5: \`recon:money-codec-no-float\` (authored in slice 1 — PR #1321)

**Current posture:** the gate exists as code (authored by Atlas in slice 1).
It asserts no money-bearing payload field serialises as a JSON number. On the
current live store (still carrying *Minor bigint fields), the gate's assertion
scope is the NEW decimal events only (slice 2 converted all 33 schema types;
existing events in the live store are legacy and excluded until the purge).

**Post-purge requirement:** on the fresh store, ALL events must pass the
no-float assertion. The gate should be re-run in full-coverage mode (no
legacy-exclusion carve-out) after re-seed.

**Reset action:** after purge + re-seed, run \`bun run recon:money-codec-no-float\`
in full-coverage mode against the fresh store. Confirm zero violations. Wire
into the CI recon suite at this point as a blocking gate with no carve-outs.

### Gate 6: \`recon:v2-saccr-parity\`

**Current posture:** asserts the V2 FIL-Model SA-CCR produces byte-identical
output to the V1 engine over the FULL anchor trade history. This gate reads live
FX and IRS events from the event store.

**Post-purge requirement:** the FX and IRS transactional history is purged.
The gate compares against the FRESHLY RE-SEEDED decimal book.

**Reset action:**
1. After re-seed, the regenerated decimal book provides the new oracle population.
2. Re-run \`recon:v2-saccr-parity\` against the fresh store. Confirm green.
3. Commit the gate's new baseline (now against the decimal book).

### Gate 7: \`recon:var-nop-exposure-parity\`

**Current posture:** asserts VaR engine NOP exposure matches B3 limit-utilisation
per-currency over the live FX book.

**Post-purge requirement:** with an empty FX book (fresh store, no seeded
FX positions), the gate's live-book parity assertion (b) downgrades to INFO
("flat bench detected — no NOP to reconcile") per its existing empty-store
posture logic. This is acceptable. The gate re-activates automatically when
FX trades enter via sanctioned entry.

**Reset action:** no active reset needed; the gate's empty-store posture handles
the zero-book case correctly. Confirm with \`bun run recon:var-nop-exposure-parity\`
after re-seed; expect INFO (not FAIL) for the live-parity assertion.

### Gate 8: \`recon:rms-briefs-parity\` and \`recon:rms-documents-parity\`

**Current posture:** asserts markdown files in Team Inbox / Owner Inbox have
matching AgentBriefIssued / RecordFiled events. These gates are file-system
scans + event-store lookups.

**Post-purge impact:** these gates are NOT invalidated by the purge. The
retained event set includes all AgentBriefIssued and RecordFiled events;
the archive directories are gone (Phase 4 complete, no Team Inbox / Owner Inbox
files in-tree). Both gates should continue passing green without reset.

**Reset action:** none required. Verify post-purge.

### Gate 9: \`recon:v2-decision-impact-sweep-coverage\`

**Current posture:** asserts every approved Decision since the W8 baseline
(D-W8-DECISION-IMPACT-SWEEP) has at least one DecisionImpactAssessed sweep.

**Post-purge requirement:** the re-authored Decisions in the fresh store need
their impact sweeps re-established. The re-seed must include re-running the
backfill (\`scripts/backfill-v2-decision-impact-sweeps.ts\`) over the re-authored
Decision set.

**Reset action:**
1. After re-seeding the retained Decisions, run
   \`scripts/backfill-v2-decision-impact-sweeps.ts\` (or equivalent) to emit
   DecisionImpactAssessed events for every re-authored approved Decision.
2. Confirm \`recon:v2-decision-impact-sweep-coverage\` is green post-backfill.

### Gate 10: \`recon:seed-manifest-parity\`

**Current posture:** asserts every seed in seeds/manifest.ts maps to a real
source file and is wired into the boot sequence.

**Post-purge impact:** the re-seed plan routes through the S15 onboarding path
(not the legacy seed manifest). If the anchor-bank re-seed introduces new seed
sources, they must be registered in seeds/manifest.ts. The gate enforces this.

**Reset action:** update seeds/manifest.ts to reflect any new decimal-encoded
seed sources introduced in slice 4. Re-run \`recon:seed-manifest-parity\`; confirm
green.

### Gate 11: \`recon:no-residual-minor-encoding\` (NEW — spec §2.3, to be authored in slice 5)

**Current posture:** does not exist. Asserts zero *Minor integer money fields
survive in the fresh store.

**Reset action:** author in slice 5; run against fresh store; confirm zero
violations.

### Gates that are data-level and reset to empty-store posture automatically

The following gates have explicit empty-store / zero-book postures that handle
a fresh store gracefully (no active reset needed; verify each is green post
re-seed):

- \`recon:gl-ledger-coverage\` — vacuous on empty GL (no postings, no FX events)
- \`recon:trade-lifecycle-parity\` — vacuous on empty trade book
- \`recon:counterparty-basel-classification-coverage\` — advisory; no CCR EAD
  events → zero worklist items (INFO)
- \`recon:recon-ba-returns-vs-gl-balances\` — vacuous (no AccountingPeriodClosed)
- \`recon:recon-liquidity-position-vs-settled-notional\` — vacuous
- \`recon:all-asset-pnl-ipv-coverage\` — vacuous on empty position set
- \`recon:rms-event-projection-parity\` — runs over retained events only;
  should pass green on fresh store (retained events are all well-formed)
- \`recon:ccr-single-emitter\` — vacuous on empty CCR population
- \`recon:mtm-reversal-paired-with-reval\` — vacuous
- \`recon:entity-identity-coherence\` — runs over retained events; must be
  green (all re-authored under \`<CANONICAL_LE>\`)

---

## 6. Conditions

The pre-authorisation is granted subject to the following conditions, all of which
must be met before slices 3–6 begin:

**Condition 1 — \`<CANONICAL_LE>\` provided by CEO (HARD BLOCK).**
The correct registered legal-entity short-id and legalName must be confirmed
by the CEO before any re-seed event is authored. No retained event is
re-stamped, and no seed event is issued, until this input is on record. The
purge script must embed this value at invocation time (not from a config
default), so the operator cannot accidentally proceed with an unresolved token.

**Condition 2 — Backup taken, hash registered (HARD BLOCK).**
A \`RecordFiled{title:"Pre-purge backup verified"}\` event with the backup file
path, SHA-256 hash, and event count must be appended to the LIVE event store
before the purge script is invoked. The purge script checks for this event and
aborts if absent. The backup procedure in §4 must be followed exactly.

**Condition 3 — Purge script applies the mechanical classification rule.**
The purge script must identify transactional event types programmatically (by
scanning the event-types registry for *Minor fields and MoneyWire-typed payload
fields), NOT by matching a hand-maintained list of 33 type names. This ensures
the BondPositionRevalued, SubLedgerPostingEmitted, FxTradeExecuted, and all other
transactional-but-unnamed types are caught. A dry-run mode (--dry-run) must be
available and must be run before the live purge, with its output reviewed.

**Condition 4 — Re-seed is config-only (no simulated transactions).**
The re-seed delivers ZERO seeded/demo/test transactional events. Balances and
transactions enter the fresh store ONLY via sanctioned entry (real trade-entry
endpoints, journal entry M5+, external feeds, explicit instruction). All
auto-simulators must be gated OFF by default. The \`recon:no-transactional-sim-
events\` gate (new, authored in slice 5) enforces this post re-seed.

**Condition 5 — Cold archive partitions verified intact post-cutover.**
After the purge and before the fresh-store re-seed, run
\`PartitionedEventStore.verifyArchiveIntegrity()\` over all 19 cold archive
partitions. All 19 must pass (SHA-256 hashes match, file bytes unchanged). This
is a hard gate; if any partition fails, halt and investigate before seeding.

**Condition 6 — Vera sign-off on the slice-3 backup output.**
Before the purge script (slice 4) begins, Vera (this seat) reviews the output
of the slice-3 backup script: the backup file path, its SHA-256 hash, its event
count, and the filing of the \`RecordFiled{title:"Pre-purge backup verified"}\`
event. Vera confirms or escalates. This sign-off is recorded as a RecordFiled
event authored by Vera.

---

## 7. Substrate Gaps

The following substrate gaps are surfaced as a result of this audit. Each is a
roadmap item:

**Gap VERA-PRE-PURGE-GAP-001 — No backup-verification gate in the purge script.**
The purge script (to be authored in slice 3) must implement the
\`RecordFiled{title:"Pre-purge backup verified"}\` check as a hard gate. Until
the script exists, this gate does not exist. The check must be authored as part
of slice 3 and is a condition of this pre-authorisation (Condition 2).

**Gap VERA-PRE-PURGE-GAP-002 — No \`recon:no-transactional-sim-events\` gate.**
The gate that asserts zero simulated/fixture transactional events in the live
store does not yet exist. It is a slice-5 deliverable.

**Gap VERA-PRE-PURGE-GAP-003 — No \`recon:no-legacy-le-identity\` gate.**
The gate that asserts zero legacy LE identity occurrences (LE-ZA-HOZ-BANK,
BANK-ZA-001, LE-BANK-SA) does not yet exist. It is a slice-5 deliverable.

**Gap VERA-PRE-PURGE-GAP-004 — No \`recon:no-residual-minor-encoding\` gate.**
The gate that asserts zero *Minor integer money fields in the fresh store does
not yet exist. It is a slice-5 deliverable.

**Gap VERA-PRE-PURGE-GAP-005 — Purge script's classification rule scope.**
The design spec names 33 event families; the hot store census reveals additional
transactional types (BondPositionRevalued, SubLedgerPostingEmitted, etc.) not
explicitly listed. The mechanical classification rule (§2.2 of the design spec)
is correct and covers these; Condition 3 above requires the script to apply it
programmatically. The explicit list in the spec is illustrative, not exhaustive.

**Gap VERA-PRE-PURGE-GAP-006 — S15 onboarding path untested at anchor-scale governance volume.**
The S15 onboarding path has not yet seeded an anchor-scale retained-governance
spine. This cutover is its first real exercise. Any path failures surface in
slice 4 and feed back to S15 as findings.

**Gap VERA-PRE-PURGE-GAP-007 — \`recon:money-codec-no-float\` running in partial-coverage mode.**
Gate exists (slice 1, PR #1321) but currently carries a legacy-exclusion
carve-out for pre-decimal events. Post-purge, the carve-out must be removed
and the gate must run in full-coverage mode. This is a slice-5 reset action.

---

## 8. Pre-authorisation Summary

| Item | Status |
|---|---|
| Retention manifest reviewed | APPROVED |
| Governance provenance preserved | CONFIRMED |
| No regulatory-retention obligation breached | CONFIRMED |
| LE re-authoring acceptable given backup | CONFIRMED (conditional on backup) |
| Config-only re-seed (zero simulated transactions) | CONFIRMED |
| Backup procedure specified | SPECIFIED (§4) |
| Recon gate re-baseline plan | SPECIFIED (§5) |
| Conditions enumerated | 6 conditions (§6) |
| Substrate gaps identified | 7 gaps (§7) |
| **Overall verdict** | **SIGN-OFF WITH CONDITIONS** |

The destructive purge (slice 4) may proceed once all 6 conditions in §6 are
satisfied. Slices 1–2 (non-destructive) are already merged and complete.
Slice 3 (backup) may begin immediately — it is the first step toward satisfying
Conditions 2 and 6.

**Vera (Internal audit engineer, governance)**
**2026-06-13**
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-MONEY-DECIMAL-BUILD-PROCEED",
      "D-MONEY-DECIMAL-REDENOMINATION",
      "D-RMS-PHASE-3",
      "D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION",
      "D-CROSS-WORKTREE-EVENT-STORE-SYNC",
    ],
    actor: {
      type: "service",
      id: "agent:vera:internal-audit-engineer",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Pre-purge Backup Verification and Audit Pre-authorisation",
      path: "2026-06-13_vera_pre-purge-backup-verification-and-audit-pre-auth.md",
      category: "audit-pre-authorisation",
      author: "Vera (Internal audit engineer, governance)",
      date: "2026-06-13",
    },
  },
  "2026-06-13T17:14:06.010Z",
);

console.log(JSON.stringify({ ok: true, recordId: RECORD_ID, eventId: result.eventId }, null, 2));
