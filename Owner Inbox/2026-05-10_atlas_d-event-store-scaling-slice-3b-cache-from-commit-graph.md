---
title: D-EVENT-STORE-SCALING Slice 3b — remove dashboard-state.json from commit graph; recon derives from sources directly
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-10
summary: Bounded substrate change that closes the cross-PR cache-drift friction surfaced by the multi-PR cache-regen episode (PR #150 / #151 / #152). The committed `prototype/seeds/dashboard-state.json` baseline is removed from the commit graph; the dashboard-derivation recon now derives + asserts internal consistency at recon time without comparing against a stored cache. Decision-event-recon and decision-recommendation-recon are refactored to derive on the fly from canonical sources + the live event store.
decision-required: false
---

# D-EVENT-STORE-SCALING Slice 3b — remove dashboard-state.json from commit graph; recon derives from sources directly

**Author:** Atlas (Core banking platform architect, engineering)
**Date:** 2026-05-10
**Standing authority:** `D-EVENT-STORE-SCALING` Slice 3 (consumer adoption), CEO-approved. Downstream dispatch by Scrooge (Chief of Staff); no new policy decision. Natural follow-on from Slice 3a (PR #138, 2026-05-10 morning).
**Decision-required:** false

---

## 1. Why now

Slice 3a (recorded 2026-05-10 morning) split the runtime cache (`prototype/.local/dashboard-state.json`, gitignored) from the committed seed (`prototype/seeds/dashboard-state.json`, read-only baseline). That stopped the dashboard server from dirtying `git status` on every poll. It did **not** stop the seed itself from drifting whenever the canonical-source counts changed — every Owner Inbox file lift, every CEO decision recorded, every persona-roster change moves the derivation output, and the committed seed has to be re-derived to keep the recon green.

That friction is now visible across multiple open PRs simultaneously. Atlas's earlier multi-PR cache-regen survey:

> "every Owner Inbox file lift requires a cache regen on every open PR that doesn't include it, OR the cache becomes a textbook three-way merge conflict… `prototype/seeds/dashboard-state.json` is a derived JSON cache committed to the repo. Every new Owner Inbox file changes `ownerInboxFeed` and possibly `decisionsOpen`, producing line-by-line cache deltas on every open PR."

Today (2026-05-10) three open PRs (#150, #151, #152) are dirty on this exact pattern. More cache regens are queued. The whack-a-mole stops only when the seed file leaves the commit graph.

## 2. Option chosen — (b): recon derives from sources directly

Two options were on the table:

- **(a) Gitignore the seed; CI regenerates it before recon.** Lower-friction transition (one-line CI wiring), but keeps the false framing that the cache *should* exist. The recon would still run "compare derived to file" — it would just regenerate the file in the same job, so the comparison can never fail.
- **(b) Refactor the recon to derive at recon time and assert internal consistency.** Honest framing — the dashboard cache is a *projection* (Principle 1: events/sources are truth, projections are queries). Recon stops needing a stored cache to compare against, and asserts the *invariants* of the projection instead.

**Option (b) chosen.** The committed cache file role is genuinely obsolete. Slice 3a already moved the *runtime* writer off the seed (server writes to `.local/`); Slice 3b moves the *recon reader* off it too. After Slice 3b nothing in the codebase needs the file to exist on disk, and the file is gitignored. (If a one-shot derivation artefact is useful for human inspection, `bun run scripts/regen-dashboard-cache.ts` still writes one to the runtime path under `.local/`.)

## 3. The recon refactor

Three pipelines previously read the committed seed:

| Pipeline | Old behaviour | New behaviour |
|---|---|---|
| `dashboard-derivation-recon` | Read the committed seed; derived from canonical sources; asserted file-vs-derivation equality on a list of paths. | Derives from canonical sources at recon time. Asserts **internal consistency** of the derivation: every `decisionsOpen[].id` reachable from an Owner Inbox file with `decision-required: true`; every ISO-timestamped `decisionsResolved[]` matched by a `CeoDecision` event; principles count matches `bank.metrics.principles`; etc. |
| `decision-event-recon` | Read the committed seed; reconciled `decisionsResolved` ↔ `CeoDecision` events. | Derives state from canonical sources + live event store at recon time; runs the same bidirectional reconciliation against the derived `decisionsResolved`. |
| `decision-recommendation-recon` | Read the committed seed; asserted every `decisionsOpen[]` has a `recommendation` or `brief.recommendation`. | Derives state from canonical sources at recon time; runs the same recommendation-presence assertion against the derived `decisionsOpen`. |

Internal-consistency assertions in `dashboard-derivation-recon` (new):

1. Derivation succeeds without throw.
2. Every `decisionsOpen[].id` resolves to either a `decisionId` declared in an Owner Inbox file (with `decision-required: true`) or a curated entry — no orphan IDs.
3. Every `decisionsResolved[]` row carries `id`, `title`, `actionedAt`. ISO-timestamped rows must match a `CeoDecision` event in the store; date-only rows are historical and require no event match.
4. `bank.metrics.principles` equals the count of `principles[]`.
5. `bank.metrics.directReports` equals the count of `directReports[]`.
6. `bank.metrics.openGovernanceSeats` equals the count of `openSeats[]`.
7. Every `inFlight[].owner` resolves to either an entry in `directReports[]` or to a known governance seat (parser side already tolerates both; the assertion matches that contract).

The total assertion budget is comparable to the old file-comparison budget; today's run yields zero violations on a clean checkout.

## 4. What this means for other consumers

A grep for `seeds/dashboard-state.json` returned the following sites; each is reviewed below.

| Site | Status |
|---|---|
| `prototype/dashboard/server.ts` | Slice 3a already wrote runtime to `.local/`; Slice 3b drops the now-unused `SEED_STATE_PATH` constant and stops logging it at boot. |
| `prototype/dashboard/registry.ts` | `loadState`/`saveState` default `REGISTRY_PATH` retargeted to `.local/dashboard-state.json` (no callers today; the constant is reserved for future use). The `BANK_DASHBOARD_STATE` env var is preserved as an override for backwards compatibility. |
| `prototype/dashboard/derive.ts` | Comment header updated; no behaviour change. |
| `prototype/runtime/agents/anya-projection-refresh.ts` | Already writes to `.local/` only. Comment updated to reflect Slice 3b — the seed is no longer the recon baseline; recon derives. |
| `prototype/runtime/agents/anya-projection-drift.ts` | Cache cross-check now reads the runtime path under `.local/` if present, else falls back to deriving on the fly. The "cache unreachable" branch becomes informational rather than a finding. |
| `prototype/runtime/agents/owen-governance-cycle-prep.ts` | Reads runtime path if present; falls back to deriving on the fly. Old fallback to seed path removed. |
| `prototype/runtime/agents/atlas-substrate-state.ts` | Comment text updated; the prose-substrate-gap entry reflects Slice 3b. |
| `prototype/runtime/agents/vera-overnight-recon.ts` | System-prompt text updated to describe the new internal-consistency contract. Cache-byte-stability protected by the prompt-cache breakpoint. |
| `prototype/scripts/regen-dashboard-cache.ts` | Now writes to `.local/dashboard-state.json` (gitignored) for ad-hoc human inspection. The scripted seed-regen role is gone. |
| `prototype/scripts/derive-dashboard-state-2026-05-09.ts`, `derive-dashboard-state-2026-05-09-fais-posture-a.ts`, `backfill-decision-events-2026-05-10.ts` | One-off scripts already executed; left in place as historical record. They write to the (now-gitignored) seed path; safe — git no longer tracks the file. |
| `prototype/biome.json` | Drops the `seeds/dashboard-state.json` ignore entry — file no longer in repo. |
| `prototype/tests/dashboard-runtime-cache.test.ts` | Refactored: the seed-byte-comparison invariant becomes a runtime-path-only-write invariant. The test no longer requires the seed to exist on disk before the run. |
| `prototype/tests/recon-pipelines.test.ts` | `decision-event-recon` test cases adjusted: the "missing registry path" case is replaced with a "no canonical sources" sanity case; the historical-decision and missing-event cases run against an injected `RegistryShape` via the new optional `state` opt. |

## 5. Acceptance

- `bun run ci` green from `prototype/`. The dashboard-derivation, decision-event, and decision-recommendation recons all pass without a committed seed.
- After merge no PR ever conflicts on `prototype/seeds/dashboard-state.json` again — the file is gitignored.
- Vera overnight-recon passes by deriving + asserting internal consistency, not by file comparison.
- Dashboard server still boots and serves correctly (Slice 3a runtime path under `.local/` is unchanged).

## 6. Coordination with parallel work

- **PR #151 (Mira+Zara, RMCP attestable spec)** — would otherwise need a cache regen. Obsoleted by this slice.
- **PR #152 (Anya+Atlas, Owner Inbox presentation)** — currently includes a 184/109 line cache delta; on rebase after Slice 3b the cache delta drops out. Their `derive.ts`/`types.ts` changes are orthogonal.
- **PR #154 (Kai+Atlas+Anya, FX sales front-end Slice 1)** — different files (`dashboard/public/markets/fx/`); no collision.
- **The in-flight cache-regen-for-#151 / #152 dispatches** become no-ops once Slice 3b lands.

## 7. Substrate trace

- **Standing authority:** `D-EVENT-STORE-SCALING` Slice 3 (consumer adoption, CEO-approved 2026-05-10).
- **Sub-decision:** `D-EVENT-STORE-SCALING-SLICE-3B`.
- **Emitter script:** `prototype/scripts/record-d-event-store-scaling-slice-3b.ts` (idempotent).
- **Principles:** P1 (events/sources are truth; projections are queries — the seed cache contradicted this); P6 (presentations derive downward from canonical data).

---

—Atlas (Core banking platform architect, engineering)
