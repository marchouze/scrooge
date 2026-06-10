---
recordId: record:documents:atlas:orphan-run-deliverable-state-classification-spec:2026-06-10
registerKey: documents
classification: engineering-seat
author: Atlas (Core banking platform architect, engineering)
workstream: WS-DISPATCH-LIFECYCLE-INTEGRITY
citations:
  - D-BEA-GOAL-LOOP-SINGLE-FLIGHT
  - D-PROACTIVE-ESCALATION-SURFACING
seedIncident: "run:bea:2026-06-10T06-49-16-147Z / PR #1154"
date: 2026-06-10
---

# Spec — Classify orphan dispatch runs by deliverable state: finished-but-didn't-return vs abandoned

**Author:** Atlas (Core banking platform architect, engineering)
**Authority:** `D-BEA-GOAL-LOOP-SINGLE-FLIGHT` (orphan detection); `D-PROACTIVE-ESCALATION-SURFACING` (decision-required routing). No new CEO decision required.
**Seed incident:** 2026-06-10 — Bea (Senior accountant, finance) run `run:bea:2026-06-10T06-49-16-147Z`, PR #1154.

## 1. Problem

On 2026-06-10 a dispatched agent (Bea) COMPLETED its work and pushed a fully CI-green PR (#1154), then DIED before `dispatch:close-run` emitted `AgentRunCompleted`. The result was an `AgentRunStarted` with no matching `AgentRunCompleted` — an orphan open run — *even though the deliverable existed and was mergeable*. No completion notification fired; the run hung. It was caught only because the CEO noticed the agent "appeared stuck" and Scrooge (Chief of Staff) manually investigated, found the PR done + green, merged it, and hand-emitted the close-run.

The pre-existing `recon:orphan-open-runs` (`platform/recon/orphan-run-detector.ts`) detects orphans (`AgentRunStarted` >2h with no `AgentRunCompleted` → `SubstrateAlert{integrity, high}`) but treats ALL orphans identically. It cannot distinguish:

- **finished-but-didn't-return** — a PR on the brief's branch/workstream exists and is merged-or-green; only the close-run event is missing. Low-effort resolution.
- **genuinely abandoned** — no PR, or PR red / draft / stale. Real high-severity loss.

This spec adds that classification + routing as an *enrichment* on top of (never a replacement for) `recon:orphan-open-runs`.

## 2. Design

### 2.1 Correlate run → brief → deliverable → PR

For each orphan open run, walk to its backing `AgentBriefIssued` (linked by `briefId`) and read:

- `workstreamId` — the brief's workstream.
- `title` — used to derive a branch-name guess (`slugifyTitle`) and as a PR-search fallback.
- `expectedOutputs` — whether a `code-pr` was expected.

Then resolve the PR fact via an **injected** lookup (`PrStateLookup`): given the correlation key, return `{ state, number?, url?, branch? }` where `state ∈ {merged, open-green, open-red, draft, none}`. The lookup is matched by branch convention first (any PR whose head branch contains the title slug), then by a title/workstream search.

**Determinism boundary (mirrors `orphan-run-detector`'s `asOf`):** the pipeline NEVER calls `gh`/the network itself. The lookup is a caller-supplied function. The CLI entrypoint wires a real `gh`-backed lookup (`orphan-run-gh-lookup.ts`); tests inject a fixture map. This keeps the classifier pure and unit-testable.

### 2.2 Classify disposition

| PR state | Disposition | `autoReconcilable` |
|---|---|---|
| `merged` | `deliverable-ready` | **true** (verifiable delivered fact) |
| `open-green` | `deliverable-ready` | false |
| `open-red` | `abandoned` | false |
| `draft` | `abandoned` | false |
| `none` | `abandoned` | false |

`deliverable-ready` ⇔ the run finished; only close-out is missing. Everything else is genuine loss.

### 2.3 Route by disposition

- **`deliverable-ready` + `merged`** → **auto-reconcile**: idempotently synthesise the missing `AgentRunCompleted{outcome:"delivered"}`. The synthetic event records, in `substrateGapsSurfaced`, that it was auto-reconciled (not hand-emitted) and cites the verified merged PR — the audit trail stays honest about provenance. The run self-heals; it is **not** a violation.
- **`deliverable-ready` + `open-green`** (or `merged` with `--auto-reconcile` disabled) → emit a **`low`-severity** `SubstrateAlert{alertClass:"integrity"}` carrying the marker prefix `alert:integrity:orphan-deliverable-ready-…` and the exact `dispatch:close-run` command in `details`. The decision-required surface promotes this (see §3) as a one-action item. The recon result also carries a `warn` violation (advisory, does not fail the gate).
- **`abandoned`** → unchanged: high-severity `SubstrateAlert{integrity, high}` + a `fail` violation. Identical to the legacy behaviour.

### 2.4 Anti-fabrication guard (critical)

Auto-emitting `AgentRunCompleted{outcome:"delivered"}` is gated on a **verifiable merged-PR fact**, never "a branch exists":

1. **Merged-only.** Only `state:"merged"` sets `autoReconcilable:true`. `open-green` is deliverable-ready but explicitly NOT auto-closed — a green-but-unmerged PR is not yet a delivered fact; it surfaces for confirmation instead.
2. **gh-unavailable ≠ no-PR.** If `gh` is unavailable or unauthenticated, the CLI runs in **advisory mode**: it cannot distinguish "no PR" from "couldn't look up", so it never auto-reconciles and never hard-fails. The deterministic hard gate for genuine orphans remains `recon:orphan-open-runs`.
3. **Emit-time idempotency re-check.** Immediately before appending the synthetic completion, the pipeline re-scans for an existing `AgentRunCompleted` for that `runId` and skips if one exists (a concurrent close-run or prior reconcile is never double-counted).
4. **Master switch.** `--auto-reconcile false` (or `autoReconcile:false`) forces even a verified-merged orphan to surface for human/Scrooge confirmation rather than auto-close — the conservative posture.

### 2.5 Consume, don't rebuild the escalation surface

The decision-required surface (`platform/escalation/decision-required-surface.ts`, PR #1138) is the single projection. This spec adds:

- a `low` tier to `SurfaceSeverity` (with rank below `high`); and
- a guarded promotion path **T2b**: a `low`-severity `SubstrateAlert` promotes ONLY when its `alertId` carries the `alert:integrity:orphan-deliverable-ready-` marker. Every other `low` alert stays below the line, so the surface is not flooded with routine low noise.

The surface, the digest render, and `bySeverity` counts gain a `low` column. No parallel surface is built.

## 3. Modules

| File | Role |
|---|---|
| `platform/recon/orphan-run-classifier.ts` | Pure correlation + classification (`buildCorrelationKey`, `classifyFromPr`, `slugifyTitle`, `closeRunCommand`). No I/O. |
| `platform/recon/orphan-run-deliverable-state.ts` | The recon pipeline: collect orphans, classify via injected `PrStateLookup`, route (auto-reconcile / surface low / high alert). CLI entrypoint wires the gh lookup + advisory mode. |
| `platform/recon/orphan-run-gh-lookup.ts` | The real `gh`-backed `PrStateLookup` + `ghAvailable()` probe. The ONLY network touchpoint; kept out of the pipeline module so it stays import-pure for tests. |
| `platform/escalation/decision-required-surface.ts` | Extended: `low` tier + T2b promotion of the orphan marker alert. |
| `recon:orphan-run-deliverable-state` | New `package.json` recon target; registered in the domain suite. |

## 4. Recon / test (seed case)

`platform/recon/orphan-run-deliverable-state.test.ts` proves, against the 2026-06-10 Bea #1154 seed case:

- **(a)** orphan + **merged** PR #1154 → `deliverable-ready`, `autoReconcilable:true`, a synthetic `AgentRunCompleted{delivered}` is appended, and NO high-severity alert is emitted for it.
- **(b)** orphan + **no** PR → `abandoned`, high-severity integrity alert, pipeline `ok:false`.
- **NOT conflated** — the two runs in one store resolve to different dispositions.
- **Anti-fabrication** — `open-green` is deliverable-ready but NOT auto-reconciled (surfaces a `low` marker alert with the close-out command); `autoReconcile:false` surfaces even a merged PR; auto-reconcile is idempotent against a pre-existing completion.
- the `low` marker alert flows onto the decision-required surface as a `low` one-action item.

## 5. Scope delivered

Spec **+ thin implementation** shipped in one PR: the classifier, the pipeline + gh lookup, the surface extension (`low` tier + T2b), the recon target registration, and the seed-case test. Auto-reconcile is **included** (merged-only, gated). The PR-state lookup is injected so the pipeline stays deterministic/testable; the CLI degrades to advisory mode when `gh` is unavailable.
