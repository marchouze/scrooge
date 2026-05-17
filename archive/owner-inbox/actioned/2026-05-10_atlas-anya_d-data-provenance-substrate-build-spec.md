---
title: Data-provenance substrate — build spec + CEO decision pack (D-DATA-PROVENANCE-SUBSTRATE)
author: Atlas (Core banking platform architect, engineering — substrate) · Anya (Data / analytics engineer, engineering — projection runtime + watermark layer)
date: 2026-05-10
summary: Substrate for letting production data, simulated data, and finer-grained scenario / variant / counterfactual data coexist in one event store with read-time mode selection and watermarked output. Adds a typed multi-axis ProvenanceTag to the event envelope (kind + scenario + variant + sourceLineage), append-rejection of untagged events, cross-reference rule (production cannot reference simulated), three projection-runtime modes (production-only / simulated-only / combined) with structural per-provenance breakdown in combined-mode aggregations, recon-enforced output watermarking, and a backfill of all current events to `kind: 'simulated'`. Eight slices; Slices 1-3 buildable pre-M2 under Targeted budget. Cutover at licence-day deferred (per Marc) to a future workstream.
decision-required: true
decision-id: D-DATA-PROVENANCE-SUBSTRATE
decision-category: medium-term
decision-owner: Atlas (Core banking platform architect) · Anya (Data / analytics engineer)
decision-for-ceo: Approve the data-provenance substrate v1 design + authorise Slices 1-3 (envelope extension + append rule, projection-runtime mode selection, output watermarking) pre-M2 under the Targeted budget; sequence Slices 4-8 over subsequent windows; defer the licence-day cutover to a named future workstream.
decision-recommendation: Approve the v1 design and Slices 1-3 as drafted. The substrate is foundational — every event, every projection, every render acquires a typed provenance dimension — so it must land before licence-day introduces production data. v1 is engineered to be additive (append-rejection only enforced after the one-shot backfill lands; consumer-side filter defaults to `combined` for one slice to give callers time to migrate); no policy is locked-in by approving the substrate that is not already implied by `2026-05-09_scrooge_testing-strategy-simulated-data.md` §4 boundary discipline.
---

# Data-provenance substrate — build spec + CEO decision pack

**Authors:** Atlas (Core banking platform architect, engineering — substrate) leads §3, §4, §5, §10, §11, §12; Anya (Data / analytics engineer, engineering — projection runtime + watermark layer) leads §5 (mode-selection API), §6, §7 (consumer-side slices), §8, §9, §13. Both speak in §1, §2, §14.
**Reports through:** Devon (COO, governance) for the substrate slice; Saskia (Head of Global Markets, governance) and Owen (Company Secretary, governance) consulted as primary projection-runtime consumers.
**Date:** 2026-05-10
**For:** Marc (CEO).
**Authority:**
- CLAUDE.md Principle 1 (events are the only source of truth — provenance is a typed envelope dimension, never inferred)
- CLAUDE.md Principle 2 (every action traces to a source — provenance is a queryable citation axis)
- CLAUDE.md Principle 5 (multi-currency, multi-entity, multi-country from day one — provenance is a structurally similar typed dimension at the envelope level)
- CLAUDE.md Principle 6 (single-graph discipline — register-and-watermark renders are derived projections of the same canonical event log)
- CLAUDE.md "Operating model — what is real, deferred, paused" (build-phase has only simulated data; licence-day introduces production)
- `Owner Inbox/2026-05-06_ceo-decision_interim-operating-posture.md` (build-only; no live data until SARB licence)
- `Owner Inbox/2026-05-09_scrooge_testing-strategy-simulated-data.md` §4 (boundary discipline — five guard rails this spec promotes from convention to substrate)
- `D-EVENT-STORE-SCALING` (CEO-approved 2026-05-10) — substrate this spec extends
- `D-RMS-PHASE-1` (CEO-approved 2026-05-09) — substrate this spec extends
**Status:** Specification-only. No code lands on this brief. Approval governs the shape of subsequent slices.

> **Derivation note (Principle 6 — downward).** This brief sits at the *standard* layer: it specifies how the event-store and projection-runtime substrates carry, enforce, and surface a typed provenance dimension. It cites the operating-model section of CLAUDE.md (build-phase is simulated-only; licence-day introduces production), Principles 1, 2, 5, 6, the substrate decisions D-EVENT-STORE-SCALING + D-RMS-PHASE-1, and Scrooge's prior testing-strategy brief (which proposed the same shape at the convention level). No new principle-level substance.

---

## 1. Purpose + non-goals

### 1.1 Purpose

Add a **typed multi-axis provenance dimension** to every event in the event log so that production data, simulated data, and finer-grained scenario / variant / counterfactual data **coexist in one event store** without commingling, and so that every projection / aggregation / render selects its mode at read time and carries a visible watermark identifying the mode.

The substrate makes the boundary discipline from `2026-05-09_scrooge_testing-strategy-simulated-data.md` §4 — today carried by convention, env vars, and recon assertions — **first-class**: enforced at the event envelope, at the append API, at cross-reference, at the projection runtime, at every render.

### 1.2 Non-goals

This substrate is **not**:

- A multi-tenant isolation primitive. Tenant isolation (when it lands) is a different envelope axis owned by a separate decision.
- An environment-management framework. `BANK_PHASE` (per testing-strategy brief §4) and Azure environments (per `project_cloud_target_azure.md`) remain the env-management layer; provenance is per-event, env is per-process.
- A data-masking layer. POPIA-compliant synthetic-data generation patterns (Iris + Mira slice per testing-strategy brief §6 #6) are upstream of this substrate; the substrate carries the resulting tag, it does not generate or mask the underlying data.
- A retention or archival policy. Retention is owned by `D-EVENT-STORE-SCALING` Slice 1 (registry retention metadata, on `main` at commit `aa6d424`); this substrate adds a tag the retention slice can index against, not a new retention rule.
- An access-control layer. Senna's threat-model gate (per testing-strategy brief §6 #7) sits over this substrate; the substrate carries the tag the gate checks against, but the gate is the policy enforcement.
- A migration / cutover plan for licence-day (deferred per Marc — §14).

---

## 2. Why now

The build phase has **only simulated data**: every event in `prototype/seeds/event-store.json` and every event the agent runtime emits today is, by `2026-05-06_ceo-decision_interim-operating-posture.md`, simulated. Licence-day will introduce **production data** alongside the persistent simulated corpus (per `2026-05-09_scrooge_testing-strategy-simulated-data.md` §3.3 — synthetic data continues for regression and scenario testing post-licence). At licence-day, two regimes will coexist in one event store and the bank cannot tolerate ambiguity about which any given event belongs to.

Three concrete forcing functions:

1. **Read-amplification timing.** `D-EVENT-STORE-SCALING` Slice 2 (snapshot substrate, PR #143 merged 2026-05-10) and Slice 3 (consumer adoption, PR #148 merged 2026-05-10) just landed. Snapshots cache projection state per `(streamKey, asOf)`. If we add the provenance dimension *after* consumers (Rohan's backtest harness, Vera's recon, Anya's projection runtime) have started snapshotting, every snapshot becomes invalid the day the dimension lands — because a snapshot computed without a `provenanceFilter` is not equivalent to a snapshot computed with one. Adding the dimension now, before snapshot adoption deepens, means snapshot keys can include the filter from day one with no rework.
2. **RMS rollout timing.** `D-RMS-PHASE-1` (CEO-approved 2026-05-09) lands seven new event types over PRs #142, #144, and the next four slices. Every new RMS event type defined without a provenance field would have to be re-versioned the moment the substrate lands. Adding the dimension at the envelope now means every RMS event type — already and forthcoming — picks it up for free.
3. **Scrooge's strategy brief is convention-level only.** `2026-05-09_scrooge_testing-strategy-simulated-data.md` §4 lists five guard rails (synthetic flag on every event; separate event-log file; BANK_PHASE env var; Senna threat-model gate; Mira obligations register). Of these, **none are substrate-level** today: there is no append-rejection of untagged events, no cross-reference rule, no projection-runtime mode selection, no watermarking. Convention-only discipline does not survive the addition of production data. The brief itself names "synthetic envelope field" (§6 #1) as an Atlas substrate task; this spec is the design of that task plus the projection-runtime + render slices it implies.

---

## 3. Provenance type design

### 3.1 The typed multi-axis ProvenanceTag

Per Marc's resolution to open question #1 (richer than `production | simulated`), the tag is a typed object with one mandatory `kind` discriminator and four typed axes:

```ts
import type { Brand } from "../types/brand.ts";

export type ScenarioId = Brand<string, "ScenarioId">;
export type VariantId = Brand<string, "VariantId">;
export type SourceLineageRef = Brand<string, "SourceLineageRef">;

/**
 * Typed provenance tag carried by every event envelope. Mandatory for
 * every appended event from Slice-1 onwards (substrate-level enforced;
 * see §4). Immutable — set at append time, never mutated thereafter.
 *
 * Axes:
 *   kind            discriminator — production | simulated
 *   scenario        named scenario the event belongs to (e.g. "rehearsal-2026-Q1",
 *                   "stress-adverse"). Required for `kind: 'simulated'`; rejected
 *                   for `kind: 'production'`.
 *   variant         finer-grained sub-classification within a scenario
 *                   (e.g. "uat", "regression", "counterfactual", "what-if-rate-cut-50bp").
 *                   Optional for both kinds.
 *   sourceLineage   typed reference identifying the originating system or
 *                   process (e.g. "synthetic-bank-seed:v3", "scenario-runner:01-hello-bank",
 *                   "agent-runtime:atlas-2026-05-10", "live-fix-feed:saskia-trading").
 *                   Required for both kinds; substrate enforces non-empty.
 *   tags            free-form ReadonlyArray<string> for extensibility
 *                   (e.g. ["sandbox", "training-corpus", "audit-replay"]).
 *                   Optional; substrate does not interpret.
 */
export type ProvenanceKind = "production" | "simulated";

export interface ProvenanceTag {
  readonly kind: ProvenanceKind;
  readonly scenario?: ScenarioId;        // required iff kind === "simulated"
  readonly variant?: VariantId;
  readonly sourceLineage: SourceLineageRef;  // mandatory both kinds
  readonly tags?: ReadonlyArray<string>;
}
```

The shape mirrors Principle 5's treatment of currency / entity / jurisdiction at the envelope: **first-class typed dimensions**, not inferred from payload, not modelled as enums when richer typed structure is needed. Production-only axes (e.g. a future regulator-of-record dimension) and simulated-only axes (e.g. scenario) are unified in one shape so the runtime never branches on kind to read the tag.

### 3.2 Why finer than enum

Marc's resolution #1 is the right call for four reasons the design surfaces:

1. **Aggregations need filtering by scenario.** "Show me only the `rehearsal-2026-Q1` simulated balance sheet" is a routine query, not a one-off. An enum forces the query into prose-stripping the payload.
2. **Counterfactuals are first-class.** Rohan's backtest harness produces what-if-rate-cut events that need a `variant: "what-if-rate-cut-50bp"` tag so capital-planning aggregations can mask them in or out. Without the variant axis, every counterfactual would have to live in its own scenario.
3. **Provenance is also a debug surface.** `sourceLineage: "synthetic-bank-seed:v3"` lets Vera trace a recon failure to the seed version, not just to "simulated".
4. **Tags are extensible without schema migration.** When Iris needs to mark POPIA-test data with a `popia-synthetic-id-range` tag, no envelope change is required.

### 3.3 Envelope extension

Atlas's existing `EventEnvelope<TBody>` (per `prototype/platform/events/types.ts`) and the runtime `eventSchema` (per `prototype/platform/event-store/types.ts`) both gain one mandatory field: `provenance: ProvenanceTag`. The envelope-level type is read by every projection without having to know the event's body shape. The Zod schema gains a discriminated-union refinement enforcing the cross-axis rules in §4.1.

---

## 4. Substrate-level enforcement

### 4.1 Append-rejection rules

`eventStore.append(event)` — and `appendAll()` — rejects:

| Rule | Rejection |
|---|---|
| Missing `provenance` field | Hard reject at the Zod parse step (`provenance: z.object(...)` is required). |
| `kind: 'production'` with `scenario` set | Hard reject — production is not scenario-bound. |
| `kind: 'simulated'` without `scenario` | Hard reject — every simulated event must declare its scenario. |
| Empty `sourceLineage` | Hard reject — every event must trace to its originating system. |
| `sourceLineage` not matching the registered allow-list pattern | Soft reject (Vera-recon finding rather than runtime throw, to avoid coupling the runtime to a registry that may lag); registered patterns live in `prototype/platform/event-store/provenance-lineage.registry.ts`. |

The Zod schema enforces 1–4 at append time. The recon enforces 5 at every CI cycle.

### 4.2 Cross-reference rules

Hard rule, substrate-enforced at append time:

- A `kind: 'production'` event **may not** reference (in `citations`, `payload.refersTo`, `payload.sourceEventId`, or any structurally-discoverable EventId) a `kind: 'simulated'` event. Audit integrity: production state can never be downstream of a rehearsal.
- A `kind: 'simulated'` event **may** reference a `kind: 'production'` event. Use case: rehearsal scenarios that exercise pricing, settlement, or compliance flows against a real counterparty (post-licence, simulated trade against real client master data) are first-class.
- A `kind: 'simulated'` event with `scenario: A` may reference a `kind: 'simulated'` event with `scenario: B` only when B is declared a *base scenario* of A in the scenario registry (`prototype/scenarios/_registry.ts`, owner: per-domain scenario authors). Use case: `stress-adverse` builds on `baseline-2026`. Without declared base, cross-scenario references are a recon finding (not a runtime throw — too easy to false-positive on unrelated scenario IDs).

The substrate enforcement requires a **post-append integrity scan** (the EventId-graph traversal cannot be done at append time without serialising every append against a full graph load). The scan runs in two places:
- The Zod schema rejects the obvious surface-level cases (citation strings, `payload.sourceEventId` shape) at append.
- A new recon `recon:provenance-cross-reference-integrity.ts` (Vera, added at Slice 5) walks the full EventId graph in a CI cycle.

### 4.3 Recon assertions

Six new recon pipelines (Vera, owned across Slices 1, 4, 5, 6, 7):

| Pipeline | What it asserts |
|---|---|
| `recon:provenance-tag-coverage` | Every event in the store carries a `provenance` field (no silent unflagged events). Slice 1. |
| `recon:provenance-lineage-registered` | Every `sourceLineage` value matches a registered pattern. Slice 1. |
| `recon:provenance-cross-reference-integrity` | No production event references a simulated event; cross-scenario refs only via declared-base. Slice 5. |
| `recon:provenance-aggregation-breakdown` | Every combined-mode aggregation in dashboard / report code carries the per-provenance breakdown structure (no silent mixing). Slice 4. |
| `recon:provenance-badge-coverage` | Every dashboard tile, report, statement, and message carries a watermark badge. Slice 3. |
| `recon:provenance-mode-default` | Every projection-runtime call sites declares its mode (no implicit-default consumption). Slice 7. |

---

## 5. Projection-runtime mode selection

### 5.1 API surface

Anya extends the projection-runtime entry-point — today `projectFromSnapshot(streamKey, asOf, projection)` (per `prototype/platform/projection-runtime/`, slice 3 of D-EVENT-STORE-SCALING) — with a `provenanceFilter` option:

```ts
export type ProvenanceMode = "production-only" | "simulated-only" | "combined";

export interface ProvenanceFilter {
  readonly mode: ProvenanceMode;
  /** Restrict to specific scenario(s); applies in `simulated-only` and `combined`. */
  readonly scenarios?: ReadonlyArray<ScenarioId>;
  /** Restrict to specific variant(s); applies in `simulated-only` and `combined`. */
  readonly variants?: ReadonlyArray<VariantId>;
  /** Restrict to specific source-lineage values. Optional. */
  readonly sourceLineages?: ReadonlyArray<SourceLineageRef>;
}

export interface ProjectFromSnapshotOpts<TState> {
  readonly streamKey: string;
  readonly asOf: string;
  readonly projection: Projection<TState>;
  readonly provenanceFilter: ProvenanceFilter;     // mandatory from Slice 7
}
```

Snapshot keys (per Slice 2 of D-EVENT-STORE-SCALING) gain the `provenanceFilter` digest as a third axis: `(streamKey, asOf, provenanceFilterDigest)`. A snapshot computed under filter `{mode: 'production-only'}` is structurally distinct from one computed under `{mode: 'combined'}`. Re-snapshotting under a new filter is a no-op when the digest matches; different digests produce parallel snapshot rows under the same `(streamKey, asOf)`.

### 5.2 Default behaviour (CEO open question #4 resolved)

Per Marc's resolution to open question #4 (no governance/engineering split, single user-level mode toggle): the **default mode is `production-only`** at every consumer call site, *with one transitional exception*: during the build phase (until commencement-of-trading flips `BANK_PHASE`), the default mode is `simulated-only`. The default flips at `BANK_PHASE` change without code change — the default is computed from the env var, not hard-coded.

This is consistent across all consumers: dashboard tiles, regulator-submission generators, recon pipelines, financial-statement renderers, what-if-overlay views. **No persona-locked defaults; no governance-vs-engineering split.** The user-level toggle (Slice 7) overrides the default for the user's session.

### 5.3 Combined-mode aggregation rules

When a projection runs in `combined` mode and emits an aggregate (sum / count / weighted average / VaR / capital ratio), the aggregate is **structurally per-provenance**:

```ts
export interface ProvenanceAggregate<TValue> {
  readonly production: TValue;
  readonly simulated: TValue;
  readonly combined: TValue;     // total only when consumer explicitly opted in
  readonly breakdownByScenario?: ReadonlyMap<ScenarioId, TValue>;
  readonly breakdownByVariant?: ReadonlyMap<VariantId, TValue>;
}
```

Three rules:

1. The substrate **never silently sums production + simulated into a single scalar**. The `combined` field is `undefined` unless the consumer explicitly calls `.withCombinedTotal()` on the aggregate builder, which is a typed opt-in.
2. Recon `recon:provenance-aggregation-breakdown` rejects any `combined`-mode aggregate that is not a `ProvenanceAggregate<>` shape.
3. Renders that consume a `ProvenanceAggregate<>` must render the breakdown — they cannot pick `.combined` without also rendering `.production` and `.simulated` (Slice 6 watermarking enforces).

---

## 6. Output watermarking

### 6.1 Where badges render

Every rendered artefact carries a visible badge indicating its provenance mode. "Rendered artefact" means: dashboard tile, report row, financial statement section, regulator-submission bundle, message envelope (chat, email, agent-to-agent), markdown deliverable header.

### 6.2 Badge taxonomy

| Mode | Badge | Colour / Icon |
|---|---|---|
| `production-only` | `PRODUCTION` | green dot · solid border |
| `simulated-only` | `SIMULATED` | amber dot · dashed border |
| `combined` | `COMBINED (P + S)` | blue dot · double border · per-provenance subtotals adjacent |
| Filtered by scenario | `SIMULATED · scenario: <id>` | amber dot · scenario-name appended |
| Filtered by variant | `SIMULATED · scenario: <id> · variant: <id>` | amber dot · scenario + variant appended |

Light/dark mode equivalents in the dashboard CSS; printed PDF uses watermark text on every page footer + cover banner.

### 6.3 Recon enforcement

`recon:provenance-badge-coverage` (Vera, Slice 3) scans:
- All `prototype/dashboard/` JSX/TSX files for `<TileShell>` calls that don't include a `<ProvenanceBadge>` child.
- All `prototype/reporting/` PDF templates for cover-page / footer absence.
- All RMS `Correspondence` records for missing badge in the rendered body.

Findings are P1 severity (silent provenance is a regulator-facing risk).

---

## 7. Slice decomposition

Eight slices. Slices 1-3 are pre-M2 buildable under the Targeted budget (3 sessions/week per `2026-05-09_atlas_substrate-completeness-budget.md`); Slices 4-8 sequence into their natural windows.

| # | Name | Owner | Sessions | Exit criterion | Dependencies |
|---|---|---|---|---|---|
| 1 | **ProvenanceTag type + envelope extension + append-rejection** | Atlas (substrate) | 1.5 | `ProvenanceTag` exported from `prototype/platform/events/types.ts`; Zod schema in `prototype/platform/event-store/types.ts` enforces presence + cross-axis rules; `recon:provenance-tag-coverage` + `recon:provenance-lineage-registered` green. | None (after Slice 6 backfill — see ordering note). |
| 2 | **Projection-runtime mode selection + filtering** | Anya (projection-runtime) | 2 | `ProvenanceFilter` mandatory on `projectFromSnapshot`; snapshot keys include the filter digest; existing consumers updated (Rohan backtest, Vera recon, dashboard projections) to pass an explicit filter. | Slice 1. |
| 3 | **Output watermarking + recon** | Anya + dashboard layer | 1.5 | `<ProvenanceBadge>` renders on every dashboard tile; PDF templates carry watermarks; `recon:provenance-badge-coverage` green. | Slice 2. |
| 4 | **Combined-mode aggregation primitives** | Atlas (substrate) + Anya (consumer) | 1 | `ProvenanceAggregate<>` builder API in `prototype/platform/projection-runtime/aggregate.ts`; `recon:provenance-aggregation-breakdown` green; one consumer (capital-planning what-if overlay) migrated as proof. | Slice 2. |
| 5 | **Cross-reference rules + enforcement** | Atlas (substrate) | 1.5 | Zod schema rejects obvious cross-axis citations at append; `recon:provenance-cross-reference-integrity` walks the EventId graph; scenario-base registry stub in `prototype/scenarios/_registry.ts`. | Slice 1. |
| 6 | **Backfill script (existing events → simulated)** | Atlas (substrate) | 0.5 | One-shot `bun run provenance:backfill` rewrites the local event store and any committed seeds to carry `kind: 'simulated', scenario: 'pre-substrate-build-phase', sourceLineage: 'pre-substrate-backfill'`. Idempotent; no-ops if every event already tagged. | Slice 1. **Must run before Slice 1 hard-rejection lights up** — see ordering note. |
| 7 | **User-level mode toggle UX** | Anya + dashboard layer | 1 | Single user-level toggle in dashboard chrome; persists in user preferences (RMS `Feedback` event); applies as session default; CLI flag `--provenance-mode=<mode>` for scripted consumers. | Slices 2, 3. |
| 8 | **Recon hardening + first dry-run** | Vera (recon, dispatched) + Anya | 1 | Six recon pipelines green over a full CI cycle on a synthetic dataset that exercises every axis; one full dashboard rendered in each of the three modes for manual CEO review. | Slices 1-7. |

**Ordering note.** Slice 1's hard-rejection of untagged events would brick the local event store on first run because today's events have no `provenance` field. Sequence: ship Slice 6 (backfill, idempotent) **first as a soft tagger** that runs at store-open if untagged events are detected; ship Slice 1's hard-rejection second, gated on a `provenance-substrate-active` flag that flips `true` once backfill has run on the canonical seeds. This matches the D-EVENT-STORE-SCALING Slice-2 pattern of additive SQLite migrations via `CREATE TABLE IF NOT EXISTS`.

**Total Slices 1-3 budget:** ~5 sessions (1.5 + 2 + 1.5). Fits one Targeted-budget week with a session of slack.

---

## 8. CEO open questions resolved

Marc's five resolutions, recorded as part of the substrate spec for replay-friendliness:

| # | Question | Marc's resolution | Substrate impact |
|---|---|---|---|
| 1 | Provenance dimensions — enum vs richer typed structure? | **FINER.** Multi-axis tag — kind + scenario + variant + counterfactuals. | §3.1 typed `ProvenanceTag` with four axes plus extensible `tags`. |
| 2 | Test fixtures vs provenance — same concept or separate? | **DEFERRED to Atlas.** Recommendation in §12 below. | See §12. |
| 3 | Audit retention — compact simulated at licence-day or keep all? | **KEEP ALL forever.** Rehearsal history is part of the audit trail. | No compaction in the substrate; D-EVENT-STORE-SCALING retention metadata indexes on provenance but does not delete. |
| 4 | Default mode per persona / UI — split by role or uniform? | **NO LOCKS.** Single user-level toggle, applied uniformly. | §5.2 single env-derived default; user toggle overrides session-wide. |
| 5 | Migration / cutover at licence-day — design now or defer? | **DEFER.** Flag as future-tranche. | §14 — `WS-PROVENANCE-CUTOVER-AT-LICENCE-DAY` workstream named, not designed. |

---

## 9. New open questions for CEO

The design surfaces three new questions. We propose default-approve answers per the no-pause rule (CLAUDE.md "Dispatch discipline"). Marc may override at approval time.

### 9.1 Q-PROV-NEW-1 — Should `sourceLineage` be a free-form string or a typed registry-only enum?

**Trade-off.** Free-form is flexible (every new agent or seed can self-name); registry-only is safer (no typos, every value indexed). Atlas leans towards registry-only because the recon `recon:provenance-lineage-registered` would be load-bearing: a typo in `sourceLineage` is silent contamination.

**Recommendation (default-approve).** Free-form Brand<string>, validated against a registered allow-list pattern (recon-enforced, soft-fail at runtime to avoid blocking new agent dispatches). Registry lives in `prototype/platform/event-store/provenance-lineage.registry.ts`; new agents are added when they ship their first scaffold-commit (~minute 10 dispatch discipline).

### 9.2 Q-PROV-NEW-2 — Should historic decision records (CeoDecision events from build phase) be tagged `kind: 'simulated'`?

**Trade-off.** They were taken in the build phase against simulated state — but the *decisions themselves* (D-RMS-PHASE-1, D-EVENT-STORE-SCALING, etc.) are real architectural commitments with binding force. Tagging them `simulated` would be misleading for audit purposes.

**Recommendation (default-approve).** CeoDecision events are tagged `kind: 'production', sourceLineage: 'ceo-decision-record'` from Slice 1 onwards. The Slice-6 backfill applies this rule retroactively to all existing CeoDecision events (one of two carve-outs from the blanket "everything pre-substrate is simulated" rule; the other is `AgentBriefIssued` events tagged `kind: 'production'` because briefs are real instructions). Marc can revise either carve-out at approval.

### 9.3 Q-PROV-NEW-3 — Should `production` events be reject-on-append during the build phase (i.e., make production-tagged events impossible until BANK_PHASE flips)?

**Trade-off.** Belt-and-braces: prevents accidental production-tagging during build. But it would prevent CeoDecision events (Q-PROV-NEW-2 carve-out) from being tagged production today, and would prevent Slice-8 dry-runs that need to exercise the production path.

**Recommendation (default-approve).** **No** — do not gate production-tagging on BANK_PHASE. The carve-outs (Q-PROV-NEW-2) need it; the dry-run path needs it; and the recon `recon:provenance-tag-coverage` plus the Mira-owned obligations register entry per testing-strategy brief §6 #5 are the right enforcement layer for "no real production data during build phase". Belt-and-braces from the substrate is brittle here.

---

## 10. Substrate dependencies consumed

This spec extends — and depends on — the following existing substrate components:

| Component | Source | What this spec consumes |
|---|---|---|
| Event envelope (`EventEnvelope<TBody>`) | `prototype/platform/events/types.ts` | Adds `provenance: ProvenanceTag` field. |
| Runtime event schema + append API | `prototype/platform/event-store/types.ts` + `store.ts` | Extends `eventSchema` with provenance refinement; extends `append` rejection rules. |
| Event-type registry | `prototype/platform/event-store/registry.ts` | Adds `provenance-lineage.registry.ts` peer; reuses retention-metadata pattern from D-EVENT-STORE-SCALING Slice 1 (`aa6d424` on main). |
| Snapshot substrate | `EventStore.snapshot()` / `loadSnapshot()` / `replayFromSnapshot()` per PR #143 (D-EVENT-STORE-SCALING Slice 2, merged 2026-05-10) | Snapshot key triple becomes `(streamKey, asOf, provenanceFilterDigest)`; pre-existing snapshots are valid for `combined` mode only. |
| Projection runtime + consumer adoption | PR #148 (D-EVENT-STORE-SCALING Slice 3, merged 2026-05-10) | `projectFromSnapshot` gains mandatory `provenanceFilter`; existing consumer call-sites updated. |
| RMS document store + record-helpers | PR #142 (D-RMS-PHASE-1 Slice 1) + PR #144 (D-RMS-PHASE-1 Slice 2, merged 2026-05-10) | Every RMS event type (AgentBriefIssued, AgentRunStarted/Completed, DecisionRequested, Feedback, BriefSuperseded, RecordFiled) inherits the envelope-level provenance field on Slice 1 land; no per-type schema work. |
| Owen+Atlas Owner-Inbox auto-archive | PR #155 (`D-OWNER-INBOX-AUTO-ARCHIVE`, OPEN) | Auto-archive logic reads `provenance` to decide archival cadence (production decisions archive on the regulator-retention clock; simulated rehearsal decisions archive on a shorter clock — Slice 4 follow-on). |
| Anya semantic-layer registry | PR #156 (D-REPORTING-CAPABILITY-M2-M3 Slice 1, OPEN) | Semantic measures gain a per-provenance breakdown projection; the registry's `derivedFrom` field references the provenance filter the measure was computed under. |
| Bea+Atlas reporting-capability M2-M3 build proposal | `Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md` | Financial statements (M2) hard-code `production-only` mode; regulator-submission generators (M3) hard-code `production-only` and refuse to render in any other mode. |

Nine substrate touchpoints, all read-only-from-this-spec; no duplication.

---

## 11. Substrate gaps surfaced

Five gaps this design needs that don't yet exist. Each is a follow-on substrate task; none block Slices 1-3.

1. **Scenario-base registry.** `prototype/scenarios/_registry.ts` — declares which scenarios are derived from which base scenarios (per §4.2 cross-reference rule). Owner: per-domain scenario authors collectively; spec authored by Atlas in Slice 5. **Gap: structure exists, populated entries do not.**
2. **Source-lineage registry.** `prototype/platform/event-store/provenance-lineage.registry.ts` — typed allow-list of valid `sourceLineage` values. Owner: Atlas + Anya jointly; one entry per agent / seed / runner. **Gap: registry does not exist; recon `recon:provenance-lineage-registered` cannot fire until it does.**
3. **Per-provenance retention rules.** D-EVENT-STORE-SCALING Slice 1 added retention metadata; this substrate adds the dimension to index against. The two need to be joined: simulated events of scenario `pre-substrate-build-phase` (the Slice-6 backfill default) may have a different retention clock from production CeoDecision events. **Gap: retention-rule joiner is unspecified; Atlas + Mira slice once D-EVENT-STORE-SCALING Slice 4 (per-rule retention) lands.**
4. **POPIA-compliant synthetic personal-data envelope marker.** Iris (Information Officer, governance) needs to assert "every event carrying personal data PI in body is `kind: 'simulated'` until commencement-of-trading or carries an explicit lawful-basis citation". **Gap: PI-bearing-event marker doesn't exist as a typed substrate primitive; out of scope here, named as a future Iris workstream.**
5. **Cross-reference back-fill audit trail.** When the Slice-5 graph-walk recon discovers an existing cross-reference violation in the historical event log (likely zero today, but possible), there is no substrate path to *correct* the violation without violating event immutability (Principle 1). **Gap: needs a `ProvenanceCorrectionRecorded` compensating-event type — Owen + Atlas slice once a real violation is encountered.**

---

## 12. Test fixtures vs provenance — Atlas's recommendation (Marc's deferral)

Marc deferred this to substrate judgement. **Recommendation: keep test fixtures separate from the provenance dimension. Do not introduce a third `kind: 'test'` tier.**

### 12.1 Why

Three reasons:

1. **Test fixtures live outside the canonical event store.** `prototype/tests/fixtures/*.json` (per `2026-05-09_scrooge_testing-strategy-simulated-data.md` §2.2) are read by Bun test runners into in-memory `EventStore` instances created with `new EventStore(":memory:")` (per `prototype/platform/event-store/store.ts:155`). They never touch the canonical store on disk. A provenance tag on them would be carried only inside the test runner's memory and would never observe a cross-test invariant.
2. **A third tier would weaken the binary boundary.** The substantive boundary is **production / not-production** — that's the boundary regulators care about, the boundary financial statements respect, the boundary the watermark surfaces. Splitting "not-production" into "simulated" and "test" creates three modes where the consumer must reason about three (and combinatoric pairs), and gives test data a degree of audit-trail standing it doesn't deserve.
3. **CI test isolation is already enforced by event-store instance separation.** Each test creates `new EventStore(":memory:")`. The CI harness never reads test data into the canonical local store. `recon:provenance-tag-coverage` would not benefit from a `kind: 'test'` because tests never persist.

### 12.2 What we do instead

Test fixtures continue to use `kind: 'simulated'` with a designated scenario `scenario: 'unit-test'` and `sourceLineage: 'bun-test-runner:<test-file-path>'`. Recon `recon:provenance-tag-coverage` recognises the `unit-test` scenario as a valid simulated tag. No third tier needed.

**One sub-case worth noting.** Scenario tests under `prototype/scenarios/01-hello-bank.ts` etc. emit events the dashboard *can* render (per testing-strategy brief §2.3) — and those are `kind: 'simulated'` proper, with `scenario` set to the scenario name (e.g. `01-hello-bank`). They are not tests; they are rehearsals. The boundary is: in-memory ephemeral event-store = fixture (use `unit-test` scenario marker); persistent event-store entry = scenario rehearsal (use real scenario name).

---

## 13. Cross-cutting hooks

Six governance personas have load-bearing dependencies on this substrate. Each hook is a one-liner; deeper specs land in their own briefs as the substrate slices ship.

| Persona | Hook |
|---|---|
| **Helena (Chief Risk Officer, governance)** | Mixed-mode VaR / capital-ratio aggregations need explicit `combined` opt-in (§5.3 rule 1). RAS-B-cluster monitoring (per `D-REGULATORY-PERIMETER`) hard-codes `production-only` once licence-day flips; build-phase RAS uses `simulated-only`. Model-risk lifecycle (Nadia / Rohan) marks Tier-1 model outputs with `variant: 'tier-1-model:<modelId>'`. |
| **Owen (Company Secretary, governance)** | Audit trail integrity (§4.2 cross-reference rule) is the load-bearing assertion. CeoDecision events are `kind: 'production'` per Q-PROV-NEW-2 carve-out; minute-keeping and resolution-tracking projections hard-code `production-only`. Every record-of-agent-runs in RMS carries the agent run's source provenance. |
| **Bea (Chief Financial Officer, governance)** | Financial statements (IFRS) hard-code `production-only` mode with no override (§10 — Bea+Atlas reporting brief enforcement). Combined-mode statements are explicitly disallowed by the substrate (the rendering layer refuses to produce a P&L that mixes provenance). IFRS 10 consolidation substrate (per `2026-05-09_bea_ifrs10-consolidation-substrate-v0.md`) inherits the rule entity-by-entity. |
| **Mira (Compliance / RegTech engineer)** | All regulator-submission bundles (BA returns, FIC STR, FATCA, FAIS reports) hard-code `production-only` with explicit disclosure if any other mode is requested via API. Obligations-register URN cluster `urn:obligation:bank:test:synthetic-data:*` (per testing-strategy brief §6 #5) is updated to cite this substrate as the enforcement mechanism. |
| **Saskia (Head of Global Markets, governance)** | Pre-trade decisions (per `2026-05-09_saskia-kai-atlas_routing-policy-projection-v0.md`) need to read provenance: a pre-trade gateway routing a `kind: 'simulated'` order rejects it as a routing-violation if `BANK_PHASE === 'live'`. The product-construction substrate (per `2026-05-10_atlas-kai-saskia_product-construction-substrate.md`) carries provenance through to instrument lifecycle. |
| **Iris (Information Officer, governance — POPIA)** | Synthetic-personal-data POPIA assertion (per testing-strategy brief §6 #6) becomes substrate-level: events carrying PI in `kind: 'simulated'` must use the `popia-synthetic-id-range` tag (Iris-owned naming); events carrying PI in `kind: 'production'` must cite a lawful-basis URN. Substrate gap §11 #4 names the follow-on. |

Implicit hook: **every other governance persona** (Senna, Yael, Imani, Camille, Devon, Rashida, Thandiwe, Vera, Ayanda, Tomas) reads the provenance dimension transitively through the projection runtime; no per-persona spec change today.

---

## 14. Migration / cutover at licence-day — deferred

Per Marc's resolution to open question #5, the licence-day cutover is **not designed in this slice**. The substrate as specified here is licence-day-ready in the sense that:
- Production tagging is structurally possible from Slice 1 (`kind: 'production'`).
- The `BANK_PHASE` env var and the user-level toggle are the bridge primitives.
- The default mode flips automatically from `simulated-only` to `production-only` when `BANK_PHASE` flips.

But the **operational sequence** of cutover — which scenarios are retired, which corpora are quarantined, which dashboards rotate first, which regulator-submission generators are unlocked, what dry-run gates the cutover passes through, what the rollback path is if cutover surfaces a defect — is a separate workstream worth its own decision pack closer to licence-day.

**Future workstream:** `WS-PROVENANCE-CUTOVER-AT-LICENCE-DAY`, owner: Saskia + Devon + Rashida (per the existing pre-licence go-live readiness gate co-ownership) + Atlas (substrate); to be opened when the licence-day target date is set per `project_rules_bind_at_commencement.md`.

---

## 15. Slice-1 dispatch-ready brief (post-approval)

Embedded for fast dispatch on CEO approval, per acceptance criterion 2 ("After approval, Slice 1 has a dispatch-ready brief embedded").

**Brief.** Atlas (Core banking platform architect, engineering — substrate) is dispatched in an isolated worktree (CLAUDE.md "Dispatch discipline") to land Slice 1 of D-DATA-PROVENANCE-SUBSTRATE: the `ProvenanceTag` type + envelope extension + append-rejection.

**Scope.**
- Add `ProvenanceTag`, `ProvenanceKind`, `ScenarioId`, `VariantId`, `SourceLineageRef` types to `prototype/platform/events/types.ts`.
- Add `provenance` field to `EventEnvelope<TBody>`.
- Extend `eventSchema` in `prototype/platform/event-store/types.ts` with the discriminated-union refinement enforcing the §4.1 cross-axis rules.
- Create `prototype/platform/event-store/provenance-lineage.registry.ts` stub with at least these initial entries: `pre-substrate-backfill`, `ceo-decision-record`, `agent-runtime`, `bun-test-runner`, `synthetic-bank-seed`, `scenario-runner`.
- Create `recon:provenance-tag-coverage` and `recon:provenance-lineage-registered` under `prototype/platform/recon/`.
- **Prerequisite:** Slice 6 backfill ships first (in the same PR or a same-day predecessor PR) so the local event store does not brick on first run after merge.

**Out of scope for Slice 1.**
- Projection-runtime mode selection (Slice 2).
- Output watermarking (Slice 3).
- Combined-mode aggregation (Slice 4).
- Cross-reference enforcement at the graph level (Slice 5).
- User-level toggle UX (Slice 7).

**Exit criterion.** Both new recon pipelines green over a full CI cycle on the canonical seeds; one PR titled `substrate(D-DATA-PROVENANCE-SUBSTRATE Slice 1): provenance envelope + append-rejection`; merged on `main`.

**Dispatch discipline.** Worktree isolation, scaffold-commit at minute 10, push-retry on rejection, citation-gate before push, identity discipline.

---

## 16. Acceptance check (against this dispatch's brief)

| Criterion | Status |
|---|---|
| Marc can read the pack in <10 min and pick approve / approve-subset / defer | §0 frontmatter + §1-§2 + §7 slice table + §8 resolutions + §9 new questions |
| After approval, Slice 1 has a dispatch-ready brief embedded | §15 |
| Pack cites at least 6 existing substrate components | §10 lists 9 |
| Pack names at least 3 substrate gaps | §11 lists 5 |
| Test-fixtures recommendation made (per Marc's deferral) | §12 |
| Cross-cutting hooks named for at least 6 governance personas | §13 lists 6 named (Helena, Owen, Bea, Mira, Saskia, Iris) |

---

— Atlas (Core banking platform architect, engineering — substrate) · Anya (Data / analytics engineer, engineering — projection runtime + watermark layer)
