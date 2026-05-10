---
title: Owner Inbox auto-archive on CeoDecision (D-OWNER-INBOX-AUTO-ARCHIVE)
author: Atlas (Core banking platform architect, engineering), Owen (Company Secretary, governance)
date: 2026-05-10
summary: New event-driven runtime handler `scrooge:owner-inbox-archiver` subscribes to CeoDecision and atomically moves the source decision-required card from `Owner Inbox/` to `Owner Inbox/actioned/`, emitting a typed `RecordFiled` event for the archival. Closes the half-automated lifecycle Marc surfaced 2026-05-10.
decision-required: false
---

# Owner Inbox auto-archive on CeoDecision (D-OWNER-INBOX-AUTO-ARCHIVE)

**Authors:** Atlas (Core banking platform architect, engineering) · Owen (Company Secretary, governance)
**Authority:** standing — D-RMS-PHASE-1 (CEO-approved 2026-05-09); slice-level dispatch under no-pause rule (CLAUDE.md "Operating procedures").
**Date:** 2026-05-10

## Problem

Marc (CEO) flagged the lifecycle of a CEO-decision card as half-automated. Today:

- Marc decides on a `decision-required: true` card from `Owner Inbox/`.
- Scrooge's `scrooge:ceo-decision-record` handler emits the typed `CeoDecision` event and writes a sibling `_ceo-decision-record_*.md` audit file. Both event-driven.
- The original *source card* — the file Marc decided on — stays in `Owner Inbox/` indefinitely until someone manually `git mv`s it to `Owner Inbox/actioned/`.

Result: ~25 entries in the dashboard's `ownerInboxFeed` show resolved (`decisionStatus = resolved` because a CeoDecision event exists with the matching `decisionId`) but remain in the open feed because the file never moved. Per `feedback_decisions_workflow.md` and `feedback_team_inbox_hygiene.md`, processed items should auto-move to `actioned/`.

## Solution

A new event-driven runtime handler — `scrooge:owner-inbox-archiver` — subscribes to `CeoDecision` events on the event-trigger bus (per A2.2). On each event:

1. Reads the event payload's `sourceDoc` field (canonical pointer to the source card).
2. If `sourceDoc` resolves to a real file under `Owner Inbox/` (and is not already in `actioned/` or another sub-folder) **AND** the file's frontmatter declares `decision-required: true`:
   - Atomically moves the file to `Owner Inbox/actioned/<original-filename>` via `renameSync` (POSIX atomic on same-volume rename).
   - Emits a typed `RecordFiled` event (RMS Slice 2, PR #144) with the BLAKE3 `documentHash` of the file body, `registerKey: "decisions"`, classification `ceo-only`, retention citing the records-management obligation, and `recordId` of the form `record:decisions:<source-card-slug>:actioned`.
3. Idempotent: if the source file is already in `actioned/`, no-op + emit no event.
4. Failure-tolerant: if `sourceDoc` is missing or doesn't resolve, log a warning + emit no event (do not fail the bus).

## Handler API

Wired into `runtime/handlers-metadata.ts` as:

```ts
entry("Scrooge", "owner-inbox-archiver", "event-driven", {
  subscribesTo: ["CeoDecision"],
});
```

Handler file: `prototype/runtime/agents/scrooge-owner-inbox-archiver.ts`. Callable registered at `runtime/handler-callables.ts` under key `scrooge:owner-inbox-archiver`. Invoked by the `LocalEventTriggerBus` once per `CeoDecision` event, per the bus's `(eventId, handlerKey)` idempotency contract.

## File-move semantics

- **Atomic move only.** The handler does NOT rewrite the file body or frontmatter. Per `Owner Inbox/_frontmatter-convention.md`, `decision-status` is *derived* (`resolved` iff a `CeoDecision` event exists). The move *is* the resolution signal — the dashboard's `ownerInboxFeed` derivation drops the card on next derivation tick because the file no longer sits in the open `Owner Inbox/` listing.
- **Scope: only `Owner Inbox/` source cards.** `sourceDoc` paths outside `Owner Inbox/` (Team Inbox, Procedures, etc.) are ignored — those have their own lifecycle owners (Team Inbox: `scrooge:inbox-hygiene`; Procedures: out of scope here).
- **Scope: only `decision-required: true` source cards.** The audit `_ceo-decision-record_*.md` files have `decision-required: false` and so wouldn't move regardless, but the handler is explicit: it parses the source file's frontmatter at handler time and skips anything without `decision-required: true`. Belt-and-braces against accidental mass-archival.
- **No backfill.** The handler operates on *new* CeoDecision events going forward (the bus is run-coupled per `runtime/run.ts` Phase-1 wiring). A separate one-shot script can backfill historical resolutions if Marc later wants the existing ~25-entry backlog cleaned in one pass.

## Idempotency design

Three layers:

1. **Bus-level.** `LocalEventTriggerBus.tick()` folds `BusDispatched` events into a `(eventId, handlerKey)` set; a re-tick on the same event won't re-invoke the handler.
2. **Handler-level.** When the bus *does* invoke the handler twice (e.g. across a process restart that lost the in-memory dedupe before the `BusDispatched` audit landed), the handler checks: is the source file already in `actioned/`? If yes, no-op and emit no `RecordFiled`. The handler's read of the actual filesystem state is the second-line check.
3. **Document-store-level.** Even if both prior layers failed and the handler did re-invoke `recordFiled`, `documentStore.put` is content-addressed — the same bytes always yield the same hash and the existing on-disk file is preserved. The downside is a duplicate `RecordFiled` event; mitigated by layers 1 and 2.

## Integration with RMS Slice 2 (RecordFiled)

The handler is the first runtime caller of `recordFiled()` (the helper from `prototype/platform/records/helpers.ts` landed in PR #144 / D-RMS-PHASE-1-SLICE-2). Each archival emits one `RecordFiled` event with payload:

```json
{
  "recordId": "record:decisions:<source-card-slug>:actioned",
  "registerKey": "decisions",
  "documentHash": "blake3:<64-hex-chars>",
  "classification": "ceo-only",
  "retention": {
    "citationRef": "urn:obligation:bank:org:gv:director-decision-retention:v1",
    "minimumYears": 7,
    "archivalTier": "archive"
  }
}
```

Per the spec §3.8 (Owen's note), `RecordFiled` is the event that turns a markdown into a *record* in the governance sense. Pairing it with the auto-archive move means: the file isn't just *moved*, it's *filed* — the audit trail names the move as the formal records-management act.

## Failure handling

- **`sourceDoc` field missing on the CeoDecision event.** Log + skip. Older `recordCeoDecision` callers (pre-2026-05-07) often omitted `sourceDoc`; their decisions don't auto-archive (intentional — manual one-shot backfill is the right path for legacy).
- **`sourceDoc` doesn't resolve to a real file.** Log warn (`scrooge:owner-inbox-archiver — sourceDoc not found`) + skip. The bus-level outcome is still `ok` — we don't fail the dispatch on a missing source, because the substrate gap is recoverable (re-author the card, re-emit the event).
- **`sourceDoc` is outside `Owner Inbox/` or already in `actioned/`.** Log + skip (no-op).
- **Source file's frontmatter lacks `decision-required: true`.** Log + skip (not a decision card).
- **Atomic move fails (permissions, cross-volume rename).** Log error, do NOT emit `RecordFiled` (would be misleading — file isn't actually filed), surface as a finding via the handler's `ok: true` summary so Vera's audit pipelines see the count.

## Substrate gaps remaining

Captured here so the next slice can pick them up — none of these block this PR:

1. **One-shot backfill script for historical resolved-but-unmoved cards.** ~25 items. Easy follow-on (~1h work): walk every `Owner Inbox/` card with `decision-required: true`, look up the matching `CeoDecision` event, move the file + emit a `RecordFiled` if the event exists. Out of scope here per the brief.
2. **Dashboard re-render trigger on RecordFiled.** The dashboard's `ownerInboxFeed` is derived per derivation tick (file-system walk + event-store fold). It naturally drops archived items on next tick — no special trigger needed under the current pull-model. When the dashboard moves to push (substrate gap noted in `feedback_dashboards_live_reports_as_of.md`), `RecordFiled` becomes the trigger.
3. **`registerKey: "actioned"` not in the schema.** The brief's draft mentioned this. The current `recordFiledPayloadSchema` enum is `"decisions" | "correspondence" | "agent-runs" | "documents" | "feedback" | "workstreams" | "briefs"`. We use `"decisions"` (the source card *is* a CEO-decision card; archival is a state transition within the decisions register, not a different register). If Owen later wants a distinct "archived" register key, that's an additive enum extension — RMS Slice 3 territory.
4. **CeoDecision events authored via dashboard `/api/decide`.** They emit `sourceDoc` only when the front-end passes it. Today the dashboard route does pass it; no gap. If a future authoring path forgets, the handler quietly skips — which is correct (no harm), but Vera's continuous-controls programme should add a recon check that every resolved decision has a corresponding `RecordFiled` within N ticks.

## Coordination with parallel work

- **Anya (Projection runtime, engineering) + Atlas Owner Inbox presentation fix** is in flight (touches `dashboard/derive.ts` and `dashboard/public/`). This work is in `prototype/runtime/agents/` — different files, low collision risk. They handle the *presentation* (how the open feed renders); this handles the *lifecycle* (when items leave the open feed).
- **Mira (Obligations engineer) + Zara (MLRO, governance) W1 Slice 1**, **Helena (CRO, governance) + Camille (CFO, governance) W2 Slice 1**, **Kai (Markets engineer) + Atlas + Anya FX Slice 1** — none touch `runtime/` event subscribers. No collision.

The only concurrency hot-spot is `runtime/handlers-metadata.ts` and `runtime/handler-callables.ts` (per `feedback_handlers_metadata_three_way_clash.md`). Adding a single row at the *end* of each minimises clash; we run `bun run recon:runtime-handler-sync` before push.

## Acceptance

- After merge, when a `CeoDecision` event fires (via the dashboard `/api/decide`, the `scrooge:ceo-decision-record` handler, or any future caller of `recordCeoDecision`), the source `Owner Inbox/<file>.md` auto-moves to `Owner Inbox/actioned/<file>.md` within one bus-tick.
- A typed `RecordFiled` event is appended to the event store recording the archival, with the BLAKE3 `documentHash` of the body, `registerKey: "decisions"`, `relatedEventIds: [<the CeoDecision event id>]` (carried as the `RecordFiled` envelope's `actor` + payload `recordId` lineage; the formal `relatedEventIds` field is RMS Slice 3 work).
- The dashboard's `ownerInboxFeed` naturally drops the resolved item on next derivation tick.
- Idempotent on re-fire: a second tick on the same `CeoDecision` event does not re-move (file is already in `actioned/`) and does not re-emit `RecordFiled`.
- All recons + tests green.

## Provenance

Substrate change authored by Atlas + Owen against the dispatch brief from Scrooge (Chief of Staff / Orchestrator), 2026-05-10. Authority: D-RMS-PHASE-1 (standing). No new policy decision required — this is downstream substrate dispatch under the no-pause rule (CLAUDE.md "Dispatch discipline"). The CeoDecision event for `D-OWNER-INBOX-AUTO-ARCHIVE` is recorded via `prototype/scripts/record-d-owner-inbox-auto-archive.ts` for the audit trail.
