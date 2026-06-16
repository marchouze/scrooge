# Brief — WS-V2-AUTHORITATIVE S6: dashboard-shaped ALM-position-snapshot V2 projection

**To:** Atlas (Core banking platform architect, engineering)
**From:** Scrooge (Chief of Staff)
**Workstream:** WS-V2-AUTHORITATIVE (financial-FIL wave, bucket B)
**Priority:** now
**Authority:** `D-BANK-WIDE-V2-MIGRATION` + `D-V1-REMOVAL-PHASE-3B` (CEO-approved 2026-06-16); Marc in-session pick of bucket B (financial wave), 2026-06-16.
**Charter:** `D-ENGINEERING-INTEGRITY-CHARTER` ([`Engineering-Charter.md`](../../Engineering-Charter.md)) — ten no-shortcut commands + Definition of Done bind this work. Plus the Dispatch discipline section of `CLAUDE.md`.

## Worktree (isolation — do NOT cd to /Users/marc/code/Bank)
Work ONLY inside: `/Users/marc/code/Bank/.claude/worktrees/atlas-s6-alm`
Branch: `atlas/v2-auth-s6-alm` (already created off origin/main @ #1395).
Run `bun install` first (worktree needs deps). All commands run from `prototype/`.

## The gap S6 closes (verify on main first)
Phase 3b (#1383) already built: V2 money-market FIL models, V2 lifecycle events (`repo-mmd-ibl-v2.ts`), V2 GL handlers (`gl-posting-engine-v2-mm.ts`), and `recon:ba300-v2-parity` which compares the **LCR denominator** V1 vs V2.

What is MISSING, and is the entire S6 deliverable: there is **no `getALMPositionSnapshot`-shaped V2 projection**. As a result the dashboard ALM / LCR / NSFR route is one of the 5 routes still stuck V1-only at Phase 4 (`dashboard-v2-coverage` = 5/8). The existing V2 MM events feed a *ratio* parity, not the *snapshot shape* the dashboard reads.

## Deliverable (one slice, dashboard-shaped)
1. **`platform/projections/alm-positions-v2.ts`** — fold the V2-parallel money-market lifecycle events into the **exact same return shape** as `getALMPositionSnapshot()` (find its signature/shape in `platform/projections/alm-positions.ts` and mirror it field-for-field). Currency-agnostic via the #1382 `requireReporting` resolver — NO `?? "ZAR"`, no hardcoded reporting currency (the `recon:no-hardcoded-reporting-currency` gate will catch it). Use output-snapshot caching consistent with the other V2 projections.
2. **`recon:alm-snapshot-v2-parity`** (advisory) — byte/structural-compare the V1 `getALMPositionSnapshot()` against `getALMPositionSnapshotV2()` over the recorded MM population, via `runParityCheck`. Advisory because the V2 shadow has no live data in build phase (PASS on empty, WARN on gap) — Charter cmd 3 honoured. Register in `run-recon-suite.ts` domain.
3. **Dashboard dual-read** — wire the ALM / LCR / NSFR dashboard route to call the V2 snapshot when `useV2Store` is ON (flag default OFF = reversible), mirroring how Phase 4 (#1385) and W1/S5 (#1390) dual-read GL/market-risk/daily-pnl. Advance `recon:dashboard-v2-coverage` 5/8 → 6/8 (keep it ADVISORY — do not flip enforcing).

## Out of scope (do NOT do)
- No flip to `v2-replaced` and no ratchet change this slice (snapshot wiring, not retirement). The flip basis for ALM types is a later slice with its own Decision.
- No equity FIL work — equity is strategically OUT per `D-BANK-STRATEGY-V2`.
- Do NOT touch run-lifecycle events (`dispatch:start-run` / `close-run`) — Scrooge owns the run lifecycle. (Phase 3b lesson: an agent ran its own start/close and left Scrooge's run dangling.)

## Definition of Done (Charter)
- Full `bun run ci` from `prototype/` EXIT 0 on a clean isolated store (full `bunx tsc --noEmit`, full recon). Partial typechecks not accepted.
- `recon:no-hardcoded-reporting-currency`, `v2-no-v1-import`, and the v1-removal ratchet (held, not lowered) all green.
- New event types, if any, registered at all three F-032 sites (event-types barrel + registry domain + provenance-category). (S6 likely needs none — it's a projection over existing V2 events.)
- `bun run citation-gate` zero violations if the deliverable carries citations.

## Process (dispatch discipline)
- **Scaffold-commit early** (~min 10): frontmatter + projection skeleton + 1 substantive fold, then commit & push.
- **Rebase-before-push**: write code → `bun run ci` passes → `git fetch origin main && git rebase origin/main` → re-run `bun run ci` if rebase changed anything → `git push`. Push-retry on non-fast-forward (pull --rebase, up to 5).
- ci:migrate may rewrite `scripts/migrate/backfill-triage-log.md` timestamp → `git checkout --` it before commit/push.
- For local clean-store repro set `BANK_EVENT_DB` and `BANK_V2_CONTROL_PLANE_DB` to fresh worktree-local tmp paths.
- Open a PR titled `feat(v2): WS-V2-AUTHORITATIVE S6 — dashboard-shaped ALM-position-snapshot V2 projection (dual-read 6/8)`. **POLL CI THROUGH TO MERGE-READY** — do not end your turn on pending checks; wait, fix, re-push until green.

Report back to Scrooge: PR number, parity result, dashboard-v2-coverage count, and any substrate gap surfaced.
