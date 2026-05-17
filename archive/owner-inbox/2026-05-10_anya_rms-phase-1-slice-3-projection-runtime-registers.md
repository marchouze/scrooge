---
title: RMS Phase 1 Slice 3 — projection runtime + 7 RMS register projections
author: Anya (Data / analytics engineer, engineering) + Atlas (Core banking platform architect, engineering — substrate consult)
date: 2026-05-10
summary: Slice 3 lands seven typed `Projection` definitions for the RMS register family (Decisions, Correspondence, Records-of-agent-runs, Document, Feedback, Briefs/Dispatches, Workstreams) with snapshot codecs and a provenance-filter helper for Slice-4 mode-aware reads.
decision-required: false
decision-id: D-RMS-PHASE-1-SLICE-3
decision-category: substrate-foundational
decision-owner: Anya (Data / analytics engineer, engineering) + Atlas (Core banking platform architect, engineering)
---

# RMS Phase 1 Slice 3 — projection runtime + 7 RMS register projections

> **Standing authority:** `D-RMS-PHASE-1` (CEO-approved 2026-05-09). Phase 1 is a five-slice build sequenced by Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering). Slice 3 dispatches under the no-pause rule — no new CEO decision required.
>
> **Spec:** [`Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`](2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md) §6 (register schemas), §13 Slice 3 (projection runtime).
>
> **Author:** Anya (Data / analytics engineer, engineering — projection-runtime + dashboard derivation curator). Atlas (Core banking platform architect, engineering) consults on event-store seams.

## Summary

Slice 3 lands the projection runtime for the seven RMS registers — the substrate spine that the Slice-4 dashboard render and the Slice-5 end-to-end round-trip will consume.

Each register is a typed `Projection<State, Event>` definition under `prototype/platform/rms-registers/`:

| Register | Module | Folds | Status taxonomy |
|---|---|---|---|
| Decisions | `decisions.ts` | `DecisionRequested`, `CeoDecision` | open / resolved / revision-requested / superseded |
| Correspondence | `correspondence.ts` | `RecordFiled` (registerKey="correspondence") | (supersedes / supersededBy chain) |
| Records-of-agent-runs | `agent-runs.ts` | `AgentRunStarted`, `AgentRunCompleted`, `BriefSuperseded` | in-flight / delivered / blocked / withdrawn |
| Document | `document.ts` | `AgentBriefIssued`, `AgentRunCompleted`, `DecisionRequested`, `Feedback`, `RecordFiled` | registered / not-yet-registered |
| Feedback | `feedback.ts` | `Feedback` | (grouped by `${subject.kind}:${subject.ref}`) |
| Briefs / Dispatches | `briefs-dispatches.ts` | `AgentBriefIssued`, `AgentRunStarted`, `AgentRunCompleted`, `BriefSuperseded` | issued / in-flight / delivered / blocked / withdrawn / superseded |
| Workstreams | `workstreams.ts` | `AgentBriefIssued`, `AgentRunStarted`, `AgentRunCompleted`, `BriefSuperseded` | active / complete / blocked |

A small `filterEventsByProvenance` helper (in `filter.ts`) gives the Slice-4 dashboard a composable way to narrow the event stream by `provenance.kind` / `scenario` / `variant` *before* folding (the projections themselves stay oblivious of provenance per the consumer-time-filter pattern set by `D-DATA-PROVENANCE-SUBSTRATE` PR #161).

## What good looks like (acceptance against spec §13 Slice 3)

- **Projection runtime per register.** Seven exports with named `Projection<State, Event>` definitions and `XxxRegisterRows()` row-listing helpers (sorted by activity timestamp). All seven live behind a single barrel export at `prototype/platform/rms-registers/index.ts`.
- **Pure / replayable / deterministic.** Each reducer is a `(state, event) → state` pure function. `tests/rms-registers.test.ts` asserts replay-from-zero produces the same state on each run (Principle 1 — events are the only source of truth; the projection is a query, not stored state).
- **Pair-coupled events handled correctly.** `DecisionRequested` ↔ `CeoDecision` pair-couple by `decisionId` (resolves the Decisions row); `AgentRunStarted` ↔ `AgentRunCompleted` pair-couple by `runId` (closes the Records-of-agent-runs row); `AgentBriefIssued` ↔ `BriefSuperseded` chain by `briefId` (terminal-status overrides for the Briefs row).
- **Out-of-order replay supported.** When `CeoDecision` arrives before its `DecisionRequested`, when `AgentRunCompleted` arrives before `AgentRunStarted`, when `BriefSuperseded` arrives before `AgentBriefIssued`, the projection materialises a stub row that the later event back-fills. Test cases assert this for the Decisions, Records-of-agent-runs, and Briefs registers.
- **Snapshot codecs.** Every projection ships `encodeSnapshot` / `decodeSnapshot`. `tests/rms-registers.test.ts` asserts round-trip equivalence for all seven registers; the Briefs register additionally goes through `Projector.projectFromSnapshot` and is asserted equal to the naive `build()` (the EvSS Slice-3 invariant).
- **Provenance filter.** `filterEventsByProvenance` admits `production` / `simulated` / scenario / variant filters and an explicit `includeUntagged` flag for legacy event streams that pre-date the substrate. Mode-aware reads compose with the runtime's `replay()` / `Projector.fold()` without changing the projection definitions.
- **Citation gate clean.** `bun run citation-gate` green.
- **CI green.** `bun run ci` green; 22 new tests / 78 expect() calls pass.

## API contour

The barrel export at `platform/rms-registers/index.ts` exposes:

```ts
import {
  decisionsRegisterProjection,        // Projection<DecisionsRegisterState, Event>
  decisionsRegisterRows,              // (state) => DecisionsRegisterRow[]
  decisionsRegisterByActor,           // (state, "CEO", status?) => DecisionsRegisterRow[]
  correspondenceRegisterProjection,
  correspondenceRegisterRows,
  agentRunsRegisterProjection,
  agentRunsRegisterRows,
  documentRegisterProjection,
  documentRegisterRows,
  feedbackRegisterProjection,
  feedbackRegisterRows,
  feedbackRegisterBySubject,
  briefsRegisterProjection,
  briefsRegisterRows,
  workstreamsRegisterProjection,
  workstreamsRegisterRows,
  filterEventsByProvenance,
} from "@platform/rms-registers";
```

The Slice-4 dashboard consumes these via the existing `LocalProjector`:

```ts
const projector = new LocalProjector(eventStore);
const decisionsState = projector.build(decisionsRegisterProjection);
const decisionsForCeo = decisionsRegisterByActor(decisionsState, "CEO", "open");
```

For mode-aware reads (e.g. the dashboard's "production-only" filter or a "rehearsal-2026-Q1" scenario view), Slice 4 pre-filters the event stream:

```ts
const productionEvents = filterEventsByProvenance(
  eventStore.replay(),
  { kinds: ["production"], includeUntagged: true },
);
let state = decisionsRegisterProjection.initial;
for (const e of productionEvents) {
  if (decisionsRegisterProjection.accepts(e)) {
    state = decisionsRegisterProjection.reduce(state, e);
  }
}
```

## Files added

- `prototype/platform/rms-registers/decisions.ts`
- `prototype/platform/rms-registers/correspondence.ts`
- `prototype/platform/rms-registers/agent-runs.ts`
- `prototype/platform/rms-registers/document.ts`
- `prototype/platform/rms-registers/feedback.ts`
- `prototype/platform/rms-registers/briefs-dispatches.ts`
- `prototype/platform/rms-registers/workstreams.ts`
- `prototype/platform/rms-registers/filter.ts`
- `prototype/platform/rms-registers/index.ts`
- `prototype/tests/rms-registers.test.ts`
- `prototype/scripts/record-d-rms-phase-1-slice-3.ts`

## Files NOT touched (per dispatch boundary)

- `prototype/platform/event-store/event-types.ts` — Slice 2 owns the typed payloads.
- `prototype/platform/event-store/registry.ts` — Slice 2 owns the registry rows.
- `prototype/platform/projections/runtime.ts` — consumed as-is.
- `prototype/platform/document-store/*` — consumed as-is.
- `prototype/platform/records/*` — Slice 2 record-helpers consumed by Slice 5.
- `prototype/dashboard/*` — Slice 4 dashboard render is a separate dispatch.
- `handlers-metadata.ts` / `handler-callables.ts` / `package.json` — collision-prone, not touched.

## Substrate gaps surfaced (Principle 7)

1. **Slice 4 dashboard render not yet built.** This slice exposes the typed projection API; the dashboard render that mounts the seven register views — alongside the legacy Owner Inbox / Team Inbox views (dual-render per spec §7.1 #5) — is a separate dispatch.
2. **Slice 5 end-to-end round-trip not yet wired.** A full chain through the substrate (`AgentBriefIssued → AgentRunStarted → AgentRunCompleted → DecisionRequested → CeoDecision`) without any Owner Inbox / Team Inbox file authored is the Slice-5 milestone.
3. **Vera recon pipelines (§14) ride on Slice 4+5.** The seven recon harnesses (`rms-event-projection-parity`, `rms-orphan-documents`, `rms-dangling-references`, `rms-supersession-resolution`, `rms-citation-coverage`, `rms-identity-pairing`, `rms-overlap-parity`) are sequenced after the dashboard render lands so the parity check has a live target.
4. **`workstreamId` on `DecisionRequested`.** Phase 2 will wire the workstream link directly into the `DecisionRequested` payload; today the Workstreams register only adds decisionIds via `AgentRunCompleted.followOnRoutes[kind="decision"]`. The reducer is forward-compatible with a future direct payload field.
5. **`projectFromSnapshot` for non-stream-keyed projections.** The current `Projector.projectFromSnapshot` API requires a `streamKey`; the RMS registers fold across multiple streams. Slice-4 dashboard work will choose between (a) a synthetic per-register stream key (e.g. `"projection/rms-decisions"`) or (b) a snapshot API extension that lets multi-stream projections snapshot at an event-store sequence checkpoint. Either is non-breaking against this slice's projection definitions.

## Dependencies consumed

- **RMS Slice 1** (PR #142) — `prototype/platform/document-store/` (BLAKE3 hashing, content-addressed local store). Document register reads from the spec-defined hash format; projections do not call the store directly (they consume events that already cite hashes).
- **RMS Slice 2** (PR #144) — `prototype/platform/records/helpers.ts` (record-helpers) + `prototype/platform/event-store/event-types.ts` (seven typed RMS payload schemas + `make<EventType>()` constructors). Projections consume the typed payload shapes via `event.payload as XxxPayload`.
- **EvSS Slice 2** (PR #143) — `EventStore.snapshot()` / `loadSnapshot()` / `replayFromSnapshot()`. The projection snapshot codecs serialise to the JSON-string payload the snapshot API expects.
- **EvSS Slice 3** (PR #148) — `LocalProjector.projectFromSnapshot()` / `maybeSnapshot()`. Consumed as-is; projections expose codecs so the runtime can call into them.
- **Provenance Slice 6+1** (PR #161) — `Event.provenance` / `provenanceTagSchema`. The filter helper reads `event.provenance` directly; projections do not.

## Decision: approve

Per the no-pause rule, this slice dispatches under standing `D-RMS-PHASE-1`. The CEO-decision-emitter script at `prototype/scripts/record-d-rms-phase-1-slice-3.ts` records `D-RMS-PHASE-1-SLICE-3` (action: `approve`) idempotently.

—Anya (Data / analytics engineer, engineering) · Atlas (Core banking platform architect, engineering)
