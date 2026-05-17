---
title: "RMS Phase 3 — Mandatory RecordFiled Deliverable"
date: 2026-05-17
authors:
  - name: Owen
    position: Company Secretary, governance
  - name: Atlas
    position: Core banking platform architect, engineering
status: APPROVED
decision: D-RMS-PHASE-3
approved-by: CEO (marc@tgv.co.za)
approved-date: 2026-05-17
effective: immediate
accelerated-by: D-RMS-PHASE-2-3-ACCELERATE
cites:
  - D-RMS-PHASE-1
  - D-RMS-PHASE-3
  - D-RMS-PHASE-2-3-ACCELERATE
  - D-RMS-PHASE-2-4-AUTHORSHIP
decision-required: false
---

# RMS Phase 3 — Mandatory RecordFiled Deliverable

## 1. Status

**APPROVED** — Decision `D-RMS-PHASE-3`, CEO-approved 2026-05-17.

One-agent-week soak period waived per `D-RMS-PHASE-2-3-ACCELERATE` (CEO-approved in-session 2026-05-17).
Phase 3 is **effective immediately** on approval.

## 2. Purpose

Phase 2 closes the dispatch side: every agent brief must be backed by an `AgentBriefIssued` event.
Phase 3 closes the deliverable side: every completed deliverable must be backed by a `RecordFiled`
event. Owner Inbox markdown becomes a *derived render* of the Document register projection, not the
canonical artefact.

This closes the second leg of the events-first authoring rule (CLAUDE.md §"Events-first authoring"):
a deliverable without a `RecordFiled` event is a Principle 1 violation, reportable by Vera.

## 3. Scope

Phase 3 governs all **agent deliverables** — every output an agent files to the Owner Inbox or
equivalent channel after completing a dispatched run.

- Every new deliverable filed after Phase 3 activation must emit a `RecordFiled` event.
- The `dispatch:close-run` CLI (called by Scrooge at run close) emits `RecordFiled` via the
  `--deliverable` flag, binding the deliverable document to the run lifecycle.
- Owner Inbox markdown files written after Phase 3 activation are *derived renders* of Document
  register entries; the event is canonical (Principle 1).
- Pre-Phase-3 Owner Inbox files (before 2026-05-17) are **historical** — expected to have no
  matching `RecordFiled` event; treated as `warn`, not `fail`, by the recon gate.

## 4. How it works — close-run with deliverable

When an agent completes its run, Scrooge calls:

```
cd prototype/
bun run dispatch:close-run \
  --run           <runId> \
  --brief         <briefId> \
  --agent-name    <agent-name> \
  --agent-position "<agent-position>" \
  --outcome       delivered \
  --deliverable   <path/to/deliverable.md>
```

The `dispatch:close-run` CLI:

1. Emits `AgentRunCompleted` (outcome = `"delivered"`), closing the run in the Agent Runs register.
2. For each `--deliverable` path:
   - Computes the BLAKE3 content hash.
   - Emits `RecordFiled` with:
     - `registerKey: "documents"`,
     - `documentHash`: BLAKE3 of file content,
     - `classification`: derived from agent type (governance → `"governance-seat"`, etc.),
     - `retention`: default `{ citationRef: "D-RMS-PHASE-1", minimumYears: 7, archivalTier: "hot" }`,
     - `metadata.title`, `metadata.path`, `metadata.author`, `metadata.date`.
3. The Document register projection indexes the event; the `/documents` dashboard route
   shows the new row immediately.

For Scrooge-authored deliverables (CEO briefs, decision records), Scrooge calls the CLI directly
without an agent intermediary.

## 5. Acceptance criterion

Phase 3 is accepted when:

1. Every new deliverable from 2026-05-17 onward has a matching `RecordFiled` event in the
   event store.
2. The `recon:rms-documents-parity` gate (§6) passes in CI — zero `fail`-severity violations.
3. The Document register view (`/documents` dashboard route) reflects all deliverables from
   Phase 3 activation onward.

## 6. Recon gate — `recon:rms-documents-parity`

A continuous-controls pipeline at `prototype/platform/recon/rms-documents-parity.ts`:

- **Pre-Phase-3 files (before 2026-05-17):** no matching `RecordFiled` event →
  `warn` severity (historical; expected gap).
- **Post-Phase-3 files (2026-05-17 or later):** no matching `RecordFiled` event →
  `fail` severity (Principle 1 violation; mandatory remediation).
- **Pass condition:** zero `fail` violations.

The pipeline is wired into `bun run recon:rms-documents-parity` and included in `bun run ci`.

## 7. Document register — RecordFiled event shape

The `RecordFiled` payload (from `platform/event-store/event-types/rms.ts`):

```ts
{
  recordId: string,          // UUID, generated at emit time
  registerKey: "documents",  // Phase 3 deliverables land here
  documentHash: string,      // BLAKE3 hex of file content
  classification:            // "ceo-only" | "governance-seat" | "engineering-seat"
                             // | "agent-internal" | "public-disclosure"
  retention: {
    citationRef: string,     // e.g. "D-RMS-PHASE-1"
    minimumYears: number,    // default 7
    archivalTier: "hot" | "cool" | "archive"
  },
  supersedes?: string,       // recordId of superseded record (for corrections)
  metadata?: {
    title: string,
    path: string,            // repo-relative path, e.g. "Owner Inbox/2026-05-17_..."
    category: string,
    author?: string,
    date?: string
  }
}
```

## 8. Vera enforcement

Vera (Internal audit engineer, engineering) enforces Phase 3 compliance:

- An Owner Inbox file created after 2026-05-17 without a matching `RecordFiled` event is a
  **Vera finding** (Principle 1 violation).
- Vera checks this via the `recon:rms-documents-parity` pipeline on every overnight recon run.
- First violation after Phase 3 activation → immediate brief to Owen (Company Secretary,
  governance) for remediation tracking.

## 9. Transition from Phase 1 / Phase 2

| Phase | Owner Inbox status | Event requirement |
|-------|-------------------|-------------------|
| 0/1   | Canonical artefact | None / optional dual-write |
| 2     | Canonical + events (briefs side closed) | RecordFiled optional |
| 3 ✅  | Derived render | Mandatory for new deliverables |
| 4     | Retired to `archive/` | Register view is sole canonical |

## 10. Citations

- `D-RMS-PHASE-1` — Phase 1 substrate approved 2026-05-09
- `D-RMS-PHASE-3` — Phase 3 approved 2026-05-17
- `D-RMS-PHASE-2-3-ACCELERATE` — soak period waived 2026-05-17
- `D-RMS-PHASE-2-4-AUTHORSHIP` — spec authorship brief (this delivery closes it partially)
