---
policy-id: RMP-001
title: Records Management Policy v1
version: "1"
status: IN FORCE
owner: Owen (Company Secretary, governance)
effective-from: "2026-05-17"
citations:
  - D-RMS-PHASE-1
  - D-RMS-PHASE-2
  - D-RMS-PHASE-3
  - D-RMS-PHASE-4
  - D-RMS-PHASE-4-ARCHIVE-SCOPE
  - BANKS-ACT-94-1990
  - COMPANIES-ACT-71-2008
  - POPIA-4-2013
author: Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering)
date: 2026-05-17
summary: Records Management Policy governing the bank's typed-event-first RMS substrate. All correspondence, briefs, deliverables, decisions, feedback, agent-run records, and workstream artefacts are stored as typed events and surfaced via seven projection-derived registers. Legacy inbox directories archived to archive/ after Phase 4 cutover. CORPORATE-BIND.
decision-required: false
riskTaxonomy:
  - RT-OP.RC
---

# Records Management Policy v1 (RMP-001)

> **Status:** IN FORCE — Phases 1–4 complete as at 2026-05-17.
>
> **Owner:** Owen (Company Secretary, governance).
>
> **Authors:** Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering).
>
> **Authority:** D-RMS-PHASE-1 (approved 2026-05-09), D-RMS-PHASE-2 (approved 2026-05-17),
> D-RMS-PHASE-3 (approved 2026-05-17), D-RMS-PHASE-4 (approved 2026-05-17),
> D-RMS-PHASE-4-ARCHIVE-SCOPE (approved 2026-05-17).

---

## 1. Purpose and scope

The bank's records management practice is governed by the Records Management Substrate (RMS), a
typed-event-first system implementing Principle 1 (events are the only source of truth).

All correspondence, briefs, deliverables, decisions, feedback, agent-run records, and workstream
artefacts are stored as typed events in the event log and surfaced via seven projection-derived
registers. The event log is the sole durable artefact; projections are queries, not state.

This policy applies to all bank agents, processes, and substrate components that produce,
receive, or manage records during the build phase and at licence-day.

## 2. Governing principles

- **Principle 1 — Events are the only source of truth.** Every record is a typed event first.
  Markdown renders, register projections, and inbox tiles are derived views, not canonical
  artefacts. No markdown-without-event is authoritative.
- **Principle 2 — Single-graph discipline.** Every record carries a typed citation upward to its
  authorising policy or obligation. No orphan records.
- **Principle 6 — Autonomous by default.** Records are produced and managed by standing
  autonomous agents. Human-in-the-loop steps are typed escalations, not informal channels.

## 3. Seven RMS event kinds

| Event kind | Register | Description |
|---|---|---|
| `DecisionRequested` / `Decision` | decisions | CEO / Board decisions (requested → approved/deferred/modified/rejected) |
| `AgentBriefIssued` | briefs | Scrooge-dispatched agent instructions |
| `RecordFiled` | documents | Deliverables, policies, specs filed with BLAKE3 hash |
| `FeedbackRecorded` | feedback | Sade performance-evaluation events |
| `AgentRunStarted` / `AgentRunCompleted` | records-of-agent-runs | Agent execution lifecycle |
| `WorkstreamRegistered` / `WorkstreamStarted` / `WorkstreamCompleted` | workstreams | Workstream lifecycle |
| `Correspondence` | correspondence | Inbound / outbound correspondence |

## 4. Document store

All document bodies are stored in the BLAKE3 content-addressed document store
(`platform/document-store/`). A `RecordFiled` event cites the document by its `blake3:` hash.
The document store is append-only; documents are never deleted (only superseded via a new
`RecordFiled` event with the `supersedes` field set).

## 5. Phase history

| Phase | Status | Approved | Key deliverable |
|---|---|---|---|
| Phase 1 | COMPLETE | 2026-05-09 | Seven typed events + BLAKE3 store + seven registers |
| Phase 2 | COMPLETE | 2026-05-17 | `AgentBriefIssued` mandated for all dispatches; briefs register live |
| Phase 3 | COMPLETE | 2026-05-17 | `RecordFiled` mandated for all deliverables; documents register live |
| Phase 4 | COMPLETE | 2026-05-17 | Legacy `Owner Inbox/` + `Team Inbox/` → `archive/`; registers sole canonical |

## 6. Archive (Phase 4)

After Phase 4 cutover, legacy directories are preserved as a read-only historical store:

```
archive/
  owner-inbox/           # ← former Owner Inbox/ (all files)
    actioned/            # ← former Owner Inbox/actioned/
  team-inbox/            # ← former Team Inbox/ (all files)
    actioned/            # ← former Team Inbox/actioned/
```

All files in `archive/` are indexed into the RMS document register via the Phase 4 bulk-index
migration script (`scripts/rms-phase-4-bulk-index.ts`). The archive directories are read-only;
no new files are written there. New records route through the RMS event substrate.

## 7. Retention schedules

| Register key | Classification | Minimum retention | Archival tier |
|---|---|---|---|
| decisions | ceo-only | 7 years | archive |
| briefs | agent-internal | 5 years | cool |
| documents | governance-seat | 7 years | cool |
| documents | engineering-seat | 7 years | cool |
| feedback | agent-internal | 3 years | hot (recent) → cool |
| records-of-agent-runs | agent-internal | 5 years | cool |
| workstreams | governance-seat | 7 years | cool |

Retention floors are set per `D-RMS-PHASE-1` §6 and the obligations register:
- Directors' resolution records: ≥ 7 years (Companies Act s.24; URN `ORG-CS3-009`)
- Regulatory correspondence: ≥ 5 years (Banks Act; URN `ORG-FC-05`)
- POPIA data records: per data subject request; minimum 3 years (POPIA s.14)

## 8. Recon gates

The following recon pipelines enforce RMS compliance at CI time:

| Pipeline | Assertion |
|---|---|
| `recon:rms-briefs-parity` | Every brief dispatch has a backing `AgentBriefIssued` event |
| `recon:rms-documents-parity` | Every Owner-Inbox deliverable has a backing `RecordFiled` event |
| `recon:rms-event-projection-parity` | Seven projections reconcile against the event log |
| `recon:document-registration` | Policy documents in `Policies/` are registered via `RecordFiled` |

## 9. Authority and change control

Changes to this policy require a CEO decision (`Decision(requested)` → `Decision(approved)`).
Owen (Company Secretary, governance) is the change sponsor; Atlas (Core banking platform
architect, engineering) is the substrate co-author.

---

*Filed as `Policies/RMP-001-records-management.md` per D-POLICY-DOCUMENT-HOME (CEO-approved
2026-05-12). RMS register view: `/api/rms/documents`. Authority: D-RMS-PHASE-4.*
