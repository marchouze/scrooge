---
title: RMS Phase 1 Slice 5 — end-to-end round-trip; Phase 1 substantively complete
author: Anya (Data / analytics engineer, engineering) + Owen (Company Secretary, governance)
date: 2026-05-10
summary: Slice 5 closes RMS Phase 1. A six-step round-trip — AgentBriefIssued → AgentRunStarted → AgentRunCompleted → DecisionRequested → CeoDecision → auto-archive RecordFiled — runs end-to-end through the typed event substrate + content-addressed document store + seven projection registers, with zero markdown files authored in `Owner Inbox/` or `Team Inbox/` during the run window. Phase 1 acceptance §7.1 #6 met. Phase 2 (dispatch routing) sequencing surfaced.
decision-required: false
decision-id: D-RMS-PHASE-1-SLICE-5
decision-category: substrate-foundational
decision-owner: Anya (Data / analytics engineer, engineering) + Owen (Company Secretary, governance)
---

# RMS Phase 1 Slice 5 — end-to-end round-trip

> **Standing authority:** `D-RMS-PHASE-1` (CEO-approved 2026-05-09). Per the no-pause rule, downstream slices of an approved decision dispatch without per-item CEO confirmation. `D-RMS-PHASE-1-SLICE-5` records the slice-level dispatch event for audit symmetry with Slices 1-4.
>
> **Spec:** [`Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`](2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md) §13 Slice 5.
>
> **Co-authors:** Anya (Data / analytics engineer, engineering — projection-runtime + dashboard derivation curator) leads the e2e test wiring + scenario runner; Owen (Company Secretary, governance) consults on records-lifecycle semantics (record-vs-draft, RecordFiled invariants, retention citations).

## 1. What landed

A self-contained round-trip exercise lives in two artefacts:

- **`prototype/scenarios/04-rms-phase-1-roundtrip.ts`** — runnable demo via `bun run scenarios/04-rms-phase-1-roundtrip.ts` (and `bun run scenario:rms-roundtrip`). Sets up an isolated event-store DB + isolated document-store root + isolated owner-inbox repo root, then runs the six-step chain and asserts the acceptance criteria.
- **`prototype/tests/rms-phase-1-e2e.test.ts`** — the same chain run under `bun test --isolate`, asserting the acceptance criteria as test expectations. CI-gated.

A small **`prototype/scripts/record-d-rms-phase-1-slice-5.ts`** emitter records the `D-RMS-PHASE-1-SLICE-5` `CeoDecision` event for audit symmetry (idempotent — skips if already recorded).

No production code changed. Slice 5 is a pure test slice that exercises the substrate Slices 1-4 already landed.

## 2. The chain — step by step

The fixture run dispatches a small Mira (Compliance / RegTech engineer) obligations-register-update brief — the suggested first round-trip per spec §7.1 #6.

### Step 1 — `AgentBriefIssued`

- **Emitter:** Scrooge (Chief of Staff / Orchestrator).
- **Helper:** `recordBriefIssued()` from `prototype/platform/records`.
- **Body:** the brief markdown ("Mira: refresh the FIC obligations register entry for s.42 reporting cadence …") goes into the document store via `documentStore.put()` and yields a BLAKE3 hash. The hash becomes `directiveDocumentHash` on the event payload.
- **Observable assertions:**
  - One `AgentBriefIssued` event in the store with `briefId === "brief:mira:obligations-refresh-2026-05-10"`.
  - The directive body resolves at the cited hash (`documentStore.exists(hash) === true`).
  - The Briefs / Dispatches register projects exactly one row with `status === "issued"`.

### Step 2 — `AgentRunStarted`

- **Emitter:** Mira (in steady-state via the agent runtime; pre-S8, Scrooge-coordinated under `substrate: "scrooge-coordinated-in-session"`).
- **Helper:** `recordAgentRunStarted()`.
- **Observable assertions:**
  - One `AgentRunStarted` event with `runId === "run:mira:obligations-refresh-2026-05-10"` and matching `briefId`.
  - The Records-of-agent-runs register projects one row with `outcome === "in-flight"`.
  - The Briefs register row flips to `status === "in-flight"`.

### Step 3 — `AgentRunCompleted`

- **Emitter:** Mira on completion.
- **Helper:** `recordAgentRunCompleted()`.
- **Body:** the obligations-register-refresh deliverable markdown is `put` into the document store; the resulting hash populates `deliverableDocumentHashes`. `followOnRoutes` cites the next step (`{ kind: "decision", target: "D-RMS-SLICE-5-OBLIGATION-CADENCE", directive: "refresh requires CEO sign-off on cadence change" }`).
- **Observable assertions:**
  - One `AgentRunCompleted` event with `outcome === "delivered"`, `deliverableDocumentHashes.length === 1`.
  - The deliverable resolves at the cited hash.
  - The Records-of-agent-runs register row closes (`outcome === "delivered"`, `completedAt` populated).
  - The Document Register projects one row for the new deliverable hash.
  - The Briefs register row flips to `status === "delivered"`.

### Step 4 — `DecisionRequested`

- **Emitter:** Mira (the deliverable's `followOnRoutes` triggers it; in the slice-5 demo the emit is explicit, since the auto-router lives downstream in S8 / Phase 2).
- **Helper:** `recordDecisionRequested()`.
- **Body:** the recommendation document (one paragraph, "Approve cadence shift to monthly per FIC s.42 update …") goes into the document store. The hash becomes `sourceDocumentHashes[0]`.
- **Observable assertions:**
  - One `DecisionRequested` event with `decisionId === "D-RMS-SLICE-5-OBLIGATION-CADENCE"`, `forActor === "CEO"`, `category === "near-term"`.
  - The recommendation body resolves at the cited hash.
  - The Decisions register projects one row with `status === "open"`.

### Step 5 — `CeoDecision`

- **Emitter:** the CEO via the Decisions Desk (in slice-5 fixture, via `recordCeoDecision()` directly).
- **Helper:** `recordCeoDecision()` from `prototype/runtime/decisions/record.ts` — unchanged surface; the Slice-2 RMS extension (`requestEventId`, `recordDocumentHashes`, `modifiedRecommendation`) is additive and back-compatible.
- **Note:** to exercise the auto-archive handler (Step 6), the fixture writes a small `decision-required: true` source card into the isolated owner-inbox-dir before emitting the `CeoDecision`, with `sourceDoc` pointing at it. This mirrors the half-automated lifecycle the archiver was built to close (the archiver subscribes to *every* `CeoDecision` going forward, and is the bridge between today's source-card workflow and the steady-state RMS-only flow).
- **Observable assertions:**
  - One `CeoDecision` event with `decisionId === "D-RMS-SLICE-5-OBLIGATION-CADENCE"`, `action === "approve"`, `sourceDoc` set.
  - The Decisions register row flips to `status === "resolved"`, `resolution.action === "approve"`.

### Step 6 — Auto-archive `RecordFiled`

- **Trigger:** the `CeoDecision` event from Step 5.
- **Handler:** `prototype/runtime/agents/scrooge-owner-inbox-archiver.ts` (PR #155).
- **In production:** the event-trigger bus dispatches the handler with the `CeoDecision` event in `ctx.trigger.triggeringEvents`.
- **In the e2e fixture:** the handler is called directly with a fixture `AgentRunContext` carrying the `CeoDecision` event — same code path, same assertions.
- **Observable assertions:**
  - The source card has been moved from `<repoRoot>/Owner Inbox/<filename>` to `<repoRoot>/Owner Inbox/actioned/<filename>` (atomic `renameSync`).
  - One `RecordFiled` event with `registerKey === "decisions"`, `classification === "ceo-only"`, `documentHash` matching the hash of the source-card body.
  - The Document Register projects a row for the archived hash.

### Acceptance assertion (the heart of slice 5)

After all six steps run, the test asserts:

> No new files have been created in `<repoRoot>/Owner Inbox/` (root level) or `<repoRoot>/Team Inbox/` *during the run window*, **other than** the fixture source card the test wrote in to exercise the archiver — and that fixture card has been *moved* (not duplicated) into `<repoRoot>/Owner Inbox/actioned/`.

The substrate's behaviour: the entire chain produces zero new authored markdown. The fixture-card pre-write is the slice-5 scaffolding to exercise PR #155; in steady state (Phase 3+), the archiver becomes a no-op (no source card to archive) because the deliverable lives in the document store and the decision lives in the Decisions register from the start.

## 3. What "RMS Phase 1 substantively complete" means now

Slice 5 closes the spec §7.1 acceptance criteria:

| # | Criterion | Status | Slice |
|---|---|---|---|
| 1 | All seven event types registered with typed payloads | landed | Slice 2 (PR #144) |
| 2 | Seven `record<EventType>()` helpers + `CeoDecision` extension | landed | Slice 2 (PR #144) |
| 3 | Document store live (BLAKE3, `put` / `get` / `exists` / `metadata`) | landed | Slice 1 (PR #142) |
| 4 | Projection runtime derives all seven registers from events | landed | Slice 3 (PR #166) |
| 5 | Dashboard renders all seven register views (dual-render) | landed | Slice 4 (PR #169) |
| 6 | **Round-trip end-to-end with no Owner / Team Inbox file authored** | **landed** | **Slice 5 (this)** |
| 7 | Vera recon pipelines pass for new substrate | partial — see §5 | Slices 2-3 + Wave-4 |
| 8 | `bun run citation-gate` passes including new event types | landed | Slice 2 |

Phase 1 is **substantively complete**: the substrate spine is built, every authoring channel has a typed-event home, every register projects from events, the dashboard renders both views (legacy + RMS), and the round-trip is closed under recon.

The full §7.1 #7 ticks-and-balances list (the planned Wave-4 RMS-specific recon pipelines from spec §14 #1-#7) lands incrementally with Vera's wave; the §5 below sequences which still owe.

## 4. What Phase 2 (dispatch routing) needs

Per spec §8: "All new agent dispatches issue an `AgentBriefIssued` event first; Scrooge-coordinated in-session dispatch is captured by Scrooge emitting the event before the run."

Phase 2 sequencing:

1. **Scrooge dispatch wrapper.** Every Scrooge-coordinated dispatch (today: a free-form prompt to a sub-agent) emits an `AgentBriefIssued` event before the dispatch fires. The Briefs / Dispatches register row appears synchronously; the receiving agent's `AgentRunStarted` follows when it picks up.
2. **Team Inbox file becomes a derived render.** The dashboard's Team Inbox view is rebuilt as a projection of the Briefs register filtered to non-superseded, non-completed rows. Authoring directly to `Team Inbox/` is recon-flagged.
3. **Substrate dependency:** S8 agent-runtime substrate (`D-AGENT-RUNTIME-AUTHORIZE`) Phase A2 — per-agent subscription. Pre-S8, Scrooge is the dispatcher of record under `substrate: "scrooge-coordinated-in-session"`; the events flow either way.
4. **Acceptance:** zero `Team Inbox/` files authored without a corresponding `AgentBriefIssued` event for one full agent-week.

Phase 2 is a separate dispatch — Owen + Atlas drafting the slice cards is the next move once Scrooge schedules it.

## 5. What Phase 3 (deliverable routing) needs

Per spec §8: "All new deliverables are stored in the document substrate, referenced by hash from `AgentRunCompleted`."

Phase 3 sequencing:

1. **Deliverable-routing wrapper.** Every agent-completed deliverable today written as a markdown file to `Owner Inbox/` is instead `put` into the document store; the hash flows into `AgentRunCompleted.deliverableDocumentHashes`; a `RecordFiled` event registers it under the appropriate register (typically `decisions` for decision-required, `documents` for informational).
2. **Owner Inbox view becomes a derived render.** The dashboard's Owner Inbox feed is rebuilt as a projection of the Document Register filtered to `RecordFiled` events with classification `ceo-only` or `governance-seat`. Authoring directly to `Owner Inbox/` is recon-flagged.
3. **Frontmatter convention deprecated.** Replaced by the typed payload of `AgentBriefIssued` / `RecordFiled` — `decision-required`, `decision-id`, `decision-category`, `decision-for-ceo`, `decision-recommendation`, `decision-owner` all become typed fields on `DecisionRequested.body` and the Decisions register row.
4. **Acceptance:** zero `Owner Inbox/` files authored without a corresponding `RecordFiled` event for one full agent-week.

## 6. What Phase 4 (cutover & archive) needs

Per spec §8: "Legacy `Owner Inbox/` and `Team Inbox/` directories are archived under `archive/owner-inbox/` and `archive/team-inbox/` …"

Phase 4 sequencing:

1. **Bulk-historical index event.** A one-time `RecordFiled` event captures every file under `Owner Inbox/` and `Team Inbox/` with filename, BLAKE3 hash, first-seen date, summary; classification `governance-seat`; cites this Phase 1 spec.
2. **Move directories under `archive/`.** `Owner Inbox/` → `archive/owner-inbox/`; `Team Inbox/` → `archive/team-inbox/`. Dashboard removes the legacy renderers (delete `parseOwnerInbox`, lines ~879-926 in `prototype/dashboard/derive.ts`).
3. **Frontmatter convention removed.** `Owner Inbox/_frontmatter-convention.md` archived.
4. **Auto-archive handler retired.** With no live source cards landing in `Owner Inbox/`, the `scrooge:owner-inbox-archiver` handler becomes a no-op and is removed from `runtime/handlers-metadata.ts`.
5. **Acceptance:** dashboard renders identically with legacy directories moved out of the build; CI green; no recon regression.

## 7. Substrate gaps surfaced by this slice

Per the P7 substrate-gap discipline:

1. **Auto-router (followOnRoutes → next-event materialisation) doesn't exist yet.** In the e2e fixture, Step 4's `DecisionRequested` is emitted explicitly. In steady state (Phase 2 / S8), `AgentRunCompleted.followOnRoutes[].kind === "decision"` should auto-fan into a `DecisionRequested` event without a second helper call. This is a Phase 2 substrate item; it does not block Phase 1.
2. **Scrooge's chat-intake handler doesn't yet emit `Feedback` events.** Spec §3.6 / §10.3 calls for chat → `Feedback` event with classification + auto-routing for `directive` classifications. The slice-5 fixture exercises `Feedback` indirectly via the `CeoDecision` audit trail; chat intake is a Phase 2+ item with its own slice card.
3. **Vera recon pipelines from spec §14 (RMS-specific) are partial.** `recon/rms-orphan-documents`, `recon/rms-dangling-references`, `recon/rms-supersession-resolution`, `recon/rms-event-projection-parity`, `recon/rms-citation-coverage`, `recon/rms-identity-pairing`, `recon/rms-overlap-parity` land alongside Vera's Wave-4. Today's recon set carries the general identity-pairing / citation-coverage discipline; the RMS-named pipelines are deferred to Wave-4 sequencing.
4. **`projector.fold(p, state, opts)` does not yet support a `from-event-id` cursor.** The fixture rebuilds projections from zero each step; in steady state, the dashboard would fold incrementally. Anya owns the cursor-fold extension under M2 cache work.

These gaps are roadmap items, not blockers. Phase 1's goal is the substrate spine; the gaps are the explicit naming of what Phases 2-4 + Wave-4 build on top.

## 8. Provenance

- **Authorship.** Anya (Data / analytics engineer, engineering — projection-runtime + dashboard derivation curator) led the e2e test wiring + scenario runner; Owen (Company Secretary, governance) consulted on records-lifecycle semantics. Slice authorisation under standing `D-RMS-PHASE-1` (CEO-approved 2026-05-09); slice-level event `D-RMS-PHASE-1-SLICE-5` recorded for audit symmetry.
- **Substrate consumed.** Slice 1 (PR #142) document store · Slice 2 (PR #144) event types + record helpers · Slice 3 (PR #166) projection runtime + seven register projections · Slice 4 (PR #169) dashboard register render · `D-OWNER-INBOX-AUTO-ARCHIVE` (PR #155) `scrooge:owner-inbox-archiver` handler · provenance substrate (PRs #161, #167) for event tagging.
- **Principle citations.** Principle 1 (events as truth) — every step in the chain emits a typed event; the markdown bodies are addressed by hash from those events. Principle 6 (single-graph discipline, downward) — registers are projections; the e2e demonstrates this end-to-end. Principle 7 (autonomous-by-default) — every persona reference pairs name + position; runs carry `substrate: "scrooge-coordinated-in-session"` per the P7 fallback discipline.
- **Adjacent decisions.** `D-RMS-PHASE-1` (parent), `D-RMS-PHASE-1-SLICE-{1,2,3,4}` (substrate built upon), `D-OWNER-INBOX-AUTO-ARCHIVE` (the auto-archive bridge exercised in Step 6), `D-AGENT-RUNTIME-AUTHORIZE` (S8, the steady-state emitter for AgentRunStarted / Completed), `D-DATA-PROVENANCE-SUBSTRATE` (the provenance carving the round-trip events also carry).

—Anya (Data / analytics engineer, engineering) + Owen (Company Secretary, governance)
