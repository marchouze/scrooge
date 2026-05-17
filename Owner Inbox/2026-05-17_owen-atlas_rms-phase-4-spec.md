---
title: "RMS Phase 4 — Archive Cutover (Legacy Inboxes → archive/)"
date: 2026-05-17
authors:
  - name: Owen
    position: Company Secretary, governance
  - name: Atlas
    position: Core banking platform architect, engineering
status: GATED
gate-decision: D-RMS-PHASE-4-ARCHIVE-SCOPE
gate-status: open
cites:
  - D-RMS-PHASE-1
  - D-RMS-PHASE-2
  - D-RMS-PHASE-3
  - D-RMS-PHASE-2-4-AUTHORSHIP
decision-required: false
---

# RMS Phase 4 — Archive Cutover (Legacy Inboxes → archive/)

## 1. Status

**GATED** — Pending CEO decision `D-RMS-PHASE-4-ARCHIVE-SCOPE` (open).

Phase 4 cannot proceed until Marc decides the disposition of `actioned/` subdirectories and the
bulk-index migration approach. See §3 for the open question.

Gate conditions:
- Phase 2 ✅ (approved 2026-05-17, `D-RMS-PHASE-2`)
- Phase 3 ✅ (approved 2026-05-17, `D-RMS-PHASE-3`)
- `D-RMS-PHASE-4-ARCHIVE-SCOPE` — **open** (Marc to decide)

## 2. Purpose

Phases 1–3 established the events-first substrate and mandated its use for all new dispatches
and deliverables. Phase 4 completes the migration by:

1. Moving legacy inbox directories into `archive/`.
2. Emitting a one-time bulk-index `RecordFiled` event for every historical document.
3. Removing the legacy Owner Inbox feed parser from the dashboard.
4. Making the RMS register views (Document, Briefs / Dispatches) the sole canonical channel.

After Phase 4, the inboxes no longer exist as working directories. `archive/` is a read-only
historical store; the registers are the live working surface.

## 3. Open gate — D-RMS-PHASE-4-ARCHIVE-SCOPE

Before Phase 4 can be executed, Marc (CEO) must decide:

**Question A — actioned/ subdirectories:**
Do `Owner Inbox/actioned/` and `Team Inbox/actioned/` move to:
1. `archive/owner-inbox/actioned/` (preserving the subdirectory structure), or
2. `archive/owner-inbox/` flat (merged with their parents), or
3. Remain separately indexed as a distinct archive register tier?

**Question B — bulk-index migration scope:**
Should the one-time `RecordFiled` bulk-index event:
1. Cover all historical files in all four directories
   (`Owner Inbox/`, `Owner Inbox/actioned/`, `Team Inbox/`, `Team Inbox/actioned/`), or
2. Cover only the `Owner Inbox/` files (since Team Inbox files are brief-derived and
   already covered by `AgentBriefIssued` backfill in Phase 2)?

**Question C — Vera rms-overlap-parity:**
Vera's `recon/rms-overlap-parity` pipeline (if active) checks for overlap between the legacy
inboxes and the RMS registers. After Phase 4, the legacy inboxes are gone so this check is vacuous.
Should Vera:
1. Retire the pipeline (delete the file), or
2. Repurpose it as a `archive/` integrity check?

Owen (Company Secretary, governance) recommends: A-1, B-1, C-1.

## 4. Directory migration plan

On Phase 4 execution (after `D-RMS-PHASE-4-ARCHIVE-SCOPE` approved):

```
archive/
  owner-inbox/           # ← Owner Inbox/ (all files)
    actioned/            # ← Owner Inbox/actioned/ (if A-1)
  team-inbox/            # ← Team Inbox/ (all files)
    actioned/            # ← Team Inbox/actioned/ (if A-1)
```

Migration steps (to be executed by Atlas as a single atomic PR):

1. `git mv "Owner Inbox" archive/owner-inbox`
2. `git mv "Team Inbox" archive/team-inbox`
3. Update all hardcoded paths in `prototype/dashboard/derive.ts` and any other consumers.
4. Emit the bulk-index `RecordFiled` event batch (one event per file in scope, per §3 Question B).
5. Remove the legacy Owner Inbox feed parser from `prototype/dashboard/derive.ts` (§5).
6. Run `bun run ci` and `bun run citation-gate` — must pass before PR.

## 5. Dashboard change — remove legacy Owner Inbox feed parser

The dashboard (`prototype/dashboard/derive.ts`) contains a section that reads markdown files
directly from `Owner Inbox/` to build the "Owner Inbox" dashboard tile. After Phase 4:

- This section is **deleted** entirely.
- The dashboard reads the Document register projection instead (`/api/rms/document`).
- The Owner Inbox tile is retired; the Documents tile (already in the RMS dashboard pane) is
  the replacement.

Implementation: search `prototype/dashboard/derive.ts` for the Owner Inbox read section and
delete it in the Phase 4 migration PR.

## 6. Bulk-index migration event

At migration time, Atlas emits a single `RecordFiled` event per historical document (scoped per
`D-RMS-PHASE-4-ARCHIVE-SCOPE` Question B decision):

```ts
{
  recordId: <uuid>,
  registerKey: "documents",
  documentHash: blake3(fileContent),
  classification: "ceo-only",          // default for Owner Inbox docs
  retention: {
    citationRef: "D-RMS-PHASE-1",
    minimumYears: 7,
    archivalTier: "cool",              // historical docs go to cool tier
  },
  metadata: {
    title: <parsed from frontmatter or filename>,
    path: <archive/owner-inbox/... or archive/team-inbox/...>,
    category: "historical-inbox-migration",
    date: <parsed from filename YYYY-MM-DD prefix>
  }
}
```

This is a one-time idempotent migration. If re-run, the bulk-index script checks for existing
`RecordFiled` events by `documentHash` and skips duplicates.

## 7. Records Management Policy — RMP-001

Upon Phase 4 completion, Owen (Company Secretary, governance) files RMP-001 Records Management
Policy:

> The bank's records management practice is governed by the Records Management Substrate (RMS),
> a typed-event-first system implementing Principle 1 (events are the only source of truth).
> All correspondence, briefs, deliverables, decisions, feedback, agent-run records, and
> workstream artefacts are stored as typed events in the event log and surfaced via seven
> projection-derived registers. Legacy markdown inboxes are archived to `archive/` after
> Phase 4 cutover. The event log is the sole durable artefact; projections are queries, not
> state. Retention schedules follow `D-RMS-PHASE-1` minimums (7 years, tier escalation on
> access frequency).

This policy will be filed as `Policies/RMP-001-records-management.md` and registered via
`DocumentRegistered` event per the document-registration recon gate.

## 8. Vera — retire rms-overlap-parity

After Phase 4 (legacy dirs gone), Vera retires `recon/rms-overlap-parity`:

- If C-1 (retire): delete the pipeline file and remove from `bun run ci`.
- If C-2 (repurpose): update to assert `archive/` integrity instead.

Per `D-RMS-PHASE-4-ARCHIVE-SCOPE` Question C decision.

## 9. Phase 4 timeline

Phase 4 executes at the next scheduled Atlas substrate sprint after `D-RMS-PHASE-4-ARCHIVE-SCOPE`
approval. No wall-clock commitment; timeline in agent cadence.

## 10. Citations

- `D-RMS-PHASE-1` — Phase 1 substrate approved 2026-05-09
- `D-RMS-PHASE-2` — Phase 2 approved 2026-05-17
- `D-RMS-PHASE-3` — Phase 3 approved 2026-05-17
- `D-RMS-PHASE-2-4-AUTHORSHIP` — spec authorship brief (this delivery closes it fully)
