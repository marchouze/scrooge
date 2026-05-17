---
title: RMS Phase 1 Slice 4 — dashboard register render (dual-render)
author: Anya (Data / analytics engineer, engineering) + Atlas (Core banking platform architect, engineering — substrate consult)
date: 2026-05-10
summary: Slice 4 lands the dashboard render of the seven RMS registers (Decisions, Correspondence, Records-of-agent-runs, Document, Feedback, Briefs/Dispatches, Workstreams) alongside the legacy Owner Inbox / Team Inbox folder views — Phase 1 dual-render per spec §13.
decision-required: false
decision-id: D-RMS-PHASE-1-SLICE-4
decision-category: substrate-foundational
decision-owner: Anya (Data / analytics engineer, engineering) + Atlas (Core banking platform architect, engineering)
---

# RMS Phase 1 Slice 4 — dashboard register render (dual-render)

> **Standing authority:** `D-RMS-PHASE-1` (CEO-approved 2026-05-09). Phase 1 is a five-slice build sequenced by Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering). Slice 4 dispatches under the no-pause rule — no new CEO decision required.
>
> **Spec:** [`Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`](2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md) §6 (register schemas), §13 Slice 4 (dashboard render — dual-render).
>
> **Author:** Anya (Data / analytics engineer, engineering — projection-runtime + dashboard derivation curator). Atlas (Core banking platform architect, engineering) consults on substrate composition.

## Summary

Slice 4 lands the **dashboard render** layer for the seven RMS registers built in Slice 3. The seven typed projections become live dashboard views at `/rms.html` and per-register pages at `/rms.html?register=<key>`, served by a single `/api/rms` endpoint family.

This is Phase 1 **dual-render**: the new register views render *alongside* the existing Owner Inbox feed (`/index.html` `decisionsOpen` + `decisionsResolved` + `ownerInboxFeed` + the existing `/agents.html` runtime-handler view). No legacy view is touched. No folder is archived. Phase 4 — when the legacy folders move to `archive/` — is out of scope.

## Acceptance against spec §13 Slice 4

- **Seven register views rendered.** `/rms.html` lands a launcher with one tile per register; each tile counts the rows currently in the register and links to `/rms.html?register=<key>`. The per-register view renders all rows in the register's row-helper sort order with the register's typed status taxonomy.
- **API endpoints.** `GET /api/rms` returns the catalogue + counts; `GET /api/rms/:register` returns the rows for one register. Validation rejects unknown register keys with 404.
- **Decisions Desk pull.** The Decisions register exposes the richer read-shape — pair-coupled `DecisionRequested` ↔ `CeoDecision` rows keyed by `decisionId`, with the full request envelope (recommendation, options, source-document hashes, citations) and the canonical `requestEventId` audit pin. The legacy `decisionsOpen` / `decisionsResolved` arrays remain the single source for `/index.html` until Phase 3 cutover.
- **Legacy view unchanged.** The existing Owner Inbox feed parser at `derive.ts:parseOwnerInbox()` is unchanged. The existing `/index.html` Owner Inbox section, the `/agents.html` runtime-handler view, and the `/escalations` page render exactly as they did pre-Slice-4.
- **Dual-render coexistence.** Both views are reachable from `/home.html` via separate launcher tiles. The RMS launcher tile lives in the Registers category and links to `/rms.html`; the legacy Owner Inbox tile in the Reports category continues to link at `/api/state`.
- **Smoke tests.** `tests/rms-dashboard-render.test.ts` asserts: derivation produces seven register views with correct counts; the `/api/rms` catalogue surface matches `RMS_REGISTER_CATALOGUE`; the per-register selector returns the right view; unknown register keys are rejected.
- **Citation gate clean.** `bun run citation-gate` green.
- **CI green.** `bun run ci` green.

## What good looks like — render shape per register

| Register | Render fields | Sort | Status taxonomy surfaced |
|---|---|---|---|
| Decisions | `decisionId`, `title`, `category`, `forActor`, `recommendation.stance`, `status`, `resolvedAt`, `requestEventId` | `requestedAt` ↑ | open / resolved / revision-requested / superseded |
| Correspondence | `correspondenceId`, `documentHash` (truncated 16 chars), `classification`, `retention.policy`, `correspondenceAt`, `supersedes`, `supersededBy` | `correspondenceAt` ↑ | (chain markers, no enum) |
| Records of agent runs | `runId`, `agent.name + position`, `briefId`, `outcome`, `startedAt`, `completedAt`, `worktree`, `briefSuperseded` | `startedAt` ↑ | in-flight / delivered / blocked / withdrawn |
| Document | `documentHash` (truncated), `recordId`, `classification`, `firstSeenAt`, `firstReferencedByEventType`, `registered`, `referencedByEventIds.length` | `firstSeenAt` ↑ | (registered / not-yet-registered toggle) |
| Feedback | `feedbackId`, `from.name + position`, `channel`, `subjectKey`, `classifications`, `intakeAt`, `routedTo` | `intakeAt` ↑ | (no enum — grouped by `subjectKey`) |
| Briefs / dispatches | `briefId`, `issuedTo.name + position`, `issuedBy.name + position`, `title`, `priority`, `workstreamId`, `status`, `runId`, `issuedAt` | `issuedAt` ↑ | issued / in-flight / delivered / blocked / withdrawn / superseded |
| Workstreams | `workstreamId`, `title`, `briefIds.length`, `runIds.length`, `decisionIds.length`, `documentHashes.length`, `status`, `firstActivityAt`, `lastActivityAt` | `firstActivityAt` ↑ | active / complete / blocked |

All renders show the count of rows at the top, paginate at 50 rows per page (server-side), and link `documentHash` columns to the (stub) document-detail panel that Phase 2 will materialise.

## API contract

`GET /api/rms`

```jsonc
{
  "asOf": "2026-05-10T12:00:00.000Z",
  "counts": {
    "decisions": 12,
    "correspondence": 0,
    "agentRuns": 0,
    "document": 28,
    "feedback": 0,
    "briefsDispatches": 0,
    "workstreams": 0
  },
  "catalogue": [
    { "key": "decisions", "title": "Decisions", "blurb": "...", "folds": [...], "statusTaxonomy": [...] },
    ...
  ]
}
```

`GET /api/rms/:register` (register ∈ {`decisions`, `correspondence`, `agent-runs`, `document`, `feedback`, `briefs-dispatches`, `workstreams`})

```jsonc
{
  "asOf": "2026-05-10T12:00:00.000Z",
  "register": "decisions",
  "rows": [ ...DecisionsRegisterRow[]... ]
}
```

Unknown `:register` → `404 { "error": "unknown register: <key>", "validKeys": [...] }`.

The endpoint is read-only; no event-emit side-effects. The `as_of` is captured at fold time. Server-side cache TTL is 5 seconds (matches the `BANK_DASHBOARD_REFRESH_MS` polling cadence).

## Dual-render coexistence

The dashboard now has two parallel views over the same canonical event log:

| View | Source path | Surface | Phase-1 status |
|---|---|---|---|
| Legacy Owner Inbox feed | `dashboard/derive.ts:parseOwnerInbox()` reads `Owner Inbox/*.md` files | `/index.html` `ownerInboxFeed` section | **Live** — unchanged by Slice 4. Retired at Phase 4. |
| Legacy CEO decisions | `dashboard/derive.ts:reduceCeoDecisions()` folds `CeoDecision` events | `/index.html` `decisionsOpen` + `decisionsResolved` | **Live** — unchanged by Slice 4. Retired at Phase 3 cutover (Decisions register replaces). |
| RMS Decisions register | `platform/rms-registers/decisions.ts` projection | `/rms.html?register=decisions` | **NEW (Slice 4)** — the richer read-shape; pair-coupled DecisionRequested + CeoDecision. |
| RMS Correspondence register | `platform/rms-registers/correspondence.ts` projection | `/rms.html?register=correspondence` | **NEW (Slice 4)** — RecordFiled with registerKey='correspondence'. |
| RMS Records-of-agent-runs register | `platform/rms-registers/agent-runs.ts` projection | `/rms.html?register=agent-runs` | **NEW (Slice 4)** — pair-coupled AgentRunStarted + AgentRunCompleted. |
| RMS Document register | `platform/rms-registers/document.ts` projection | `/rms.html?register=document` | **NEW (Slice 4)** — every documentHash ever cited by an RMS event. |
| RMS Feedback register | `platform/rms-registers/feedback.ts` projection | `/rms.html?register=feedback` | **NEW (Slice 4)** — Feedback events grouped by subject. |
| RMS Briefs / dispatches register | `platform/rms-registers/briefs-dispatches.ts` projection | `/rms.html?register=briefs-dispatches` | **NEW (Slice 4)** — AgentBriefIssued with derived status. |
| RMS Workstreams register | `platform/rms-registers/workstreams.ts` projection | `/rms.html?register=workstreams` | **NEW (Slice 4)** — workstreamId grouping. |

Both views remain visible until **Phase 4 cutover**. The legacy view's existence is *not* a bug — it is the dual-render contract. Drift between the two is not possible because Slice 4 does not duplicate any folding logic; the RMS register view reads the same event store. Vera Wave-4 #16 (planned, spec §14) will assert byte-identical-overlap parity for the Decisions register vs the legacy `decisionsResolved` array.

## Files landed

- `prototype/dashboard/rms-view.ts` — projection-runtime consumer; folds the EventStore through the seven Slice-3 projections; exports `RMS_REGISTER_KEYS`, `RMS_REGISTER_CATALOGUE`, `buildRmsRegistersFold`, `summariseFold`, `selectRegisterView`.
- `prototype/dashboard/server.ts` — two new endpoints: `GET /api/rms` (catalogue + counts) and `GET /api/rms/:register` (rows for one register). Pretty-URL `/rms` route serves `/rms.html`.
- `prototype/dashboard/public/rms.html` — register-hub launcher and per-register table view.
- `prototype/dashboard/public/rms.js` — fetch + render; reads `?register=<key>` from the URL to choose between the launcher and the table.
- `prototype/dashboard/public/rms.css` — register-page styles (additive; does not modify `styles.css`).
- `prototype/dashboard/public/home.js` — RMS launcher tile under the Registers category linking to `/rms.html`.
- `prototype/tests/rms-dashboard-render.test.ts` — smoke tests for derivation + API contract + selector.
- `prototype/scripts/record-d-rms-phase-1-slice-4.ts` — idempotent CeoDecision-emitter script for `D-RMS-PHASE-1-SLICE-4`.

## Substrate gaps surfaced (declared, not hidden — Principle 7)

1. **Slice 5 — end-to-end round-trip.** This Slice renders the registers; demonstrating the full chain (`AgentBriefIssued` → `AgentRunStarted` → `AgentRunCompleted` → `DecisionRequested` → `CeoDecision`) without any Owner Inbox / Team Inbox file authored is the next slice.
2. **Phase 2 dual-render maturation.** Decisions Desk (§10 of spec) keystroke-shortcut UI, side-panel record browser, mode-toggle filter chips, document-detail panel — all Phase 2.
3. **Phase 3 cutover.** When Phase 3 lands, `/index.html` `decisionsOpen` rendering switches to read from the Decisions register, and the legacy event-source path (`reduceCeoDecisions` in `derive.ts`) is retired.
4. **Phase 4 archive.** Legacy `Owner Inbox/` and `Team Inbox/` folders move to `archive/`; the seven RMS registers become the sole canonical view; `parseOwnerInbox` deletion lands at this gate.
5. **Vera Wave-4 #16 — byte-identical-overlap parity.** Spec §14 schedules a recon pipeline that asserts the new Decisions register and the legacy `decisionsResolved` array agree on the overlap set. Pipeline lands separately under Vera's recon-engineering work.
6. **Mode-aware reads UI.** The Slice-3 `filterEventsByProvenance` helper exists; Phase 1 renders the unfiltered view. The mode-toggle UI (production / simulated / scenario / variant) is Phase 2 §11.3.

## Coordination notes

Three other parallel dispatches today; collision posture confirmed:

- **Provenance Slice 2 (Anya — separate worktree).** Slice 2 extends the projection-runtime API. Slice 4 reads RMS Slice 3 register projections as-is — they accept provenance filter at runtime per PR #166. No collision; Slice 2 lands first naturally if both run, and the consumer here can rebase with no API surface change.
- **T-01 critical fix (Atlas — env-var rename).** No collision.
- **Reporting Slice 2 (Bea + Atlas — period-close events).** No collision.

No edits to `runtime/handlers-metadata.ts`, `runtime/handler-callables.ts`, or `package.json` (the three deterministic-collision files).

---

*This document is rendered by the dashboard's Owner Inbox feed under `decision-required: false`; it is an informational record of an in-progress substrate slice, not a CEO decision.*
