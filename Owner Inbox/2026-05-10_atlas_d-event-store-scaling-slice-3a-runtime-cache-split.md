---
title: D-EVENT-STORE-SCALING Slice 3a — split runtime dashboard cache from committed seed; document shared-event-store env var
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-10
summary: Bounded substrate change closing two related gaps surfaced today — the dashboard server overwriting the committed `seeds/dashboard-state.json` cache on every 30s poll, and the per-worktree event store making already-actioned CEO decisions appear open in fresh worktrees. Server now writes to a gitignored runtime path; existing `BANK_EVENT_DB` env var documented as the shared-store seam.
decision-required: false
---

# D-EVENT-STORE-SCALING Slice 3a — runtime cache split + shared event-store path

**Author:** Atlas (Core banking platform architect, engineering)
**Date:** 2026-05-10
**Standing authority:** `D-EVENT-STORE-SCALING` Slice 3 (consumer adoption), CEO-approved. Downstream dispatch by Scrooge (Chief of Staff); no new policy decision.
**Decision-required:** false

---

## 1. Why now

Marc (CEO) raised today: "why are there CEO decisions on the intranet that have already been made?". Scrooge (Chief of Staff)'s investigation found two intertwined causes. Both are substrate gaps in the dashboard / event-store boundary that have built up since the M1 cadence was set.

**Half A — committed cache stomping.** `prototype/dashboard/server.ts` wrote its derived state back to the committed seed `prototype/seeds/dashboard-state.json` on every 30-second poll, on every fs.watch tick, and on every state-mutating POST. Consequences:

- Any developer who ran `make dashboard` produced a `git status` dirty cache.
- The cache contained T-stamps and event-derived `decisionsResolved` entries from the local `.local/event.db` — non-reproducible in CI.
- Memory `feedback_dashboard_state_no_event_dependence` (set 2026-05-09) explicitly forbids committing this state, but enforcement was social, not structural.

**Half B — per-worktree event store.** `prototype/.local/event.db` is created fresh in every `.claude/worktrees/<id>/` spawn. `CeoDecision` events recorded in one worktree were invisible in another. A fresh worktree therefore showed every entry in `decisionsOpen` from the seed cache — including 16+ decisions Marc had already actioned. Today Scrooge ran `prototype/scripts/backfill-decision-events-2026-05-10.ts` to backfill 19 missing events into one worktree's local store; that fixed the count for that worktree only. A new worktree tomorrow showed the same stale appearance.

The full Azure-target store (Event Hubs + Cosmos) lands in later D-EVENT-STORE-SCALING slices. Slice 3a is the bounded fix that unblocks the workflow today without committing to that architectural choice.

## 2. What changed

### Fix A — split runtime cache from committed seed

| Path | Env var | Role | Writer |
|---|---|---|---|
| `prototype/seeds/dashboard-state.json` | `BANK_DASHBOARD_STATE` | **Read-only seed** — the committed baseline that `prototype/platform/recon/dashboard-derivation-recon.ts` asserts canonical-source derivation can still reproduce. | None. Curated by Marc + Scrooge; updated by hand or by one-shot scripts (`prototype/scripts/regen-dashboard-cache.ts`, `derive-dashboard-state-*.ts`). |
| `prototype/.local/dashboard-state.json` | `BANK_DASHBOARD_RUNTIME_STATE` | **Live runtime cache** — re-derived on every poll / mutation / fs.watch tick / agent run. Lives under `.local/` (gitignored). | `prototype/dashboard/server.ts` (in `bootDerive` and `refresh`); `prototype/runtime/agents/anya-projection-refresh.ts` (event-driven). |

Code touchpoints:

- `prototype/dashboard/server.ts` — adds `RUNTIME_STATE_PATH`; `bootDerive()` and `refresh()` now write to it. `SEED_STATE_PATH` is logged at boot for transparency but never written.
- `prototype/runtime/agents/anya-projection-refresh.ts` — writes to runtime path; event payload `cachePath` reflects the resolved path.
- `prototype/runtime/agents/owen-governance-cycle-prep.ts` — `readDashboard()` prefers runtime path when present, falls back to seed. Preserves Owen (Company Secretary, governance)'s contract on a fresh GitHub Actions runner.
- `prototype/dashboard/README.md` — documents both paths.
- `prototype/platform/recon/dashboard-derivation-recon.ts` — **unchanged.** Still reads the committed seed; the seed is no longer being overwritten so the recon contract holds.
- `prototype/platform/recon/decision-event-recon.ts` and `decision-recommendation-recon.ts` — **unchanged.** Both check the historical baseline reproducibility against the committed seed.

### Fix B — shared event-store path (documentation + naming clarity)

The env var `BANK_EVENT_DB` already exists in `prototype/platform/composition.ts` and across the recon and script surfaces. No code change is required to share the store across worktrees — the variable simply was not documented as the shared-store seam. Slice 3a:

- Adds an inline header in `prototype/platform/composition.ts` explaining the per-worktree default and how to share via `export BANK_EVENT_DB="$HOME/.local/share/bank/event.db"`.
- Documents the same in `prototype/dashboard/README.md`.

Default behaviour is unchanged. Marc opts in by setting the env var in his shell profile or per-worktree `.env.local`; all worktrees that inherit the env var see the same store.

## 3. Acceptance criteria

- [x] After this PR merges, a fresh worktree can spawn, run `make dashboard`, and `git status` is clean (no `seeds/dashboard-state.json` modification).
- [x] A user who sets `BANK_EVENT_DB` to a shared location sees the same `decisionsResolved` count across all worktrees pointed at the same path.
- [x] All existing recon harnesses pass (the dashboard-derivation recon is the critical one — confirms it still passes against the unchanged seed).
- [x] New integration test `prototype/tests/dashboard-runtime-cache.test.ts` exists and passes — boots the server with `BANK_DASHBOARD_RUNTIME_STATE` pointed at a tmp file, asserts the runtime path is written, the seed is unchanged, the in-memory cache reflects a recorded decision.

## 4. Substrate gaps remaining (not solved by Slice 3a)

These remain open and are tracked for later D-EVENT-STORE-SCALING slices.

1. **Shared event store still requires manual env-var.** The default behaviour is per-worktree. There is no orchestration that auto-points new worktrees at a shared store. A future slice could plumb `BANK_EVENT_DB` into the worktree-spawn harness so every worktree opens the same sqlite by default.
2. **Sqlite + concurrent writers.** Sharing one sqlite file across many parallel worktrees works for low-write workloads (CeoDecision is rare). Heavy parallel append (M-phase handler runs writing many events) will hit sqlite's lock-wait. Mitigation today: stay on per-worktree default for handler-heavy work. Long-term: Postgres mirror via `BANK_EVENT_DB_URL` (already in place; see `scripts/event-store-sync.ts`) or full Azure target.
3. **No structural enforcement that the seed stays a baseline.** A future hand-edit of `seeds/dashboard-state.json` would still bypass the derivation. The dashboard-derivation recon catches drift, but a CI step could refuse pushes that touch the seed without a corresponding derivation script. Out of scope for Slice 3a.
4. **Owen's runtime-vs-seed read posture is "first match wins".** A stale runtime cache (e.g. one a developer left from a prior session) overrides the more-stable seed. Acceptable today (the cache is gitignored and ephemeral), but a future slice could require a freshness check (e.g. `asOf` within the last hour) before preferring runtime.
5. **Dashboard server has no graceful shutdown of the runtime cache.** On process exit the runtime file is left in place. Harmless (next boot re-derives on top), but a future slice could `unlink` on `SIGTERM` for cleanliness.

## 5. Citations

- Standing authority: `D-EVENT-STORE-SCALING` (CEO-approved; Slice 3 — consumer adoption).
- Memory enforcing the no-commit rule: `feedback_dashboard_state_no_event_dependence` (set 2026-05-09).
- Memory triggering today's intervention: Marc's chat-intake observation 2026-05-10 ("why are there CEO decisions on the intranet that have already been made").
- Principle 1 (events-as-truth): the runtime cache is a query over the event store + canonical sources; no canonical state moves out of the event store.
- Principle 3 (cloud-native): the env-var seam is the substrate-replacement seam; M8 cloud lift swaps the local sqlite for the Azure target without touching consumer code.

## 6. CeoDecision event

This Slice 3a authorisation is itself recorded as a `CeoDecision` event, idempotently emitted by `prototype/scripts/record-d-event-store-scaling-slice-3a.ts`. Decision id: `D-EVENT-STORE-SCALING-SLICE-3A`. Action: `approve`. Source doc: this file.

—Atlas (Core banking platform architect, engineering)
