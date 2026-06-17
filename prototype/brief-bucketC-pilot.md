# Brief — Bucket C PILOT: agent-performance domain → v2 (store-tee, low blast radius)

**To:** Atlas (Core banking platform architect, engineering)
**From:** Scrooge (Chief of Staff)
**Workstream:** WS-V2-MIGRATION-BUCKET-C — PILOT
**Priority:** now
**Authority:** `D-BANK-WIDE-V2-MIGRATION`; Marc "continue as recommended", 2026-06-17.
**Charter:** `D-ENGINEERING-INTEGRITY-CHARTER` ([`Engineering-Charter.md`](../../Engineering-Charter.md)) + the Dispatch discipline section of `CLAUDE.md`.

## Worktree (isolation — do NOT cd to /Users/marc/code/Bank)
Work ONLY inside: `/Users/marc/code/Bank/.claude/worktrees/atlas-bucketC-pilot`
Branch: `atlas/bucketC-pilot-agentperf` (off origin/main @ #1406). Run `bun install` first. Commands from `prototype/`.

## Why this is the pilot
The bucket-C scope (`prototype/docs/bucket-c-substrate-scope.md`, #1405) recommends the **agent-performance domain** as the lowest-blast-radius pilot: money-free, dashboard-read-only, **zero coupling to the dispatch CLIs / run-lifecycle / RMS-parity gates** — worst-case failure is a stale dashboard tile, not a broken dispatch. It validates the bucket-C substrate migration pattern (money-free control-plane store-tee) before the ~195 remaining types are batched. All 197 bucket-C types are money-free control-plane → this same single path.

## Scope — 2 types
`AgentPerformanceEvaluated` + `AgentFeedbackIssued` (both `governance.ts`, v1-only, live emit sites `platform/agents/performance-runner.ts` / `performance-feedback.ts`, projection `agent-performance-projection.ts`, dashboard readers).

## Pattern — money-free store-tee verbatim mirror + parity + flip (the proven W2 path)
Use the generic store-tee (`platform/event-store/v2-store-tee.ts`, PR #1392) exactly as the money-free reference-data / posture batches did — NO live emit-site edits (the tee mirrors on append automatically):
1. **Register a `tee: {}` (verbatim, money-free) block** on each type's V2 registry row so the store-tee mirrors each V1 append into the v2 control-plane store (event_id reused = idempotent). Money-free → verbatim payload copy, no codec.
2. **Backfill** historical events via `bun run backfill:v2-store-tee` (idempotent, into `ci:migrate`).
3. **`recon:agent-performance-v2-parity`** — compare the V1-store vs v2-store agent-performance register (reuse the existing `agent-performance-projection.ts` fold via the W0 `v2StoreProjectionReader` adapter, as posture did — no new projection). Byte-clean where data exists, PASS-on-empty otherwise. Register in `run-recon-suite.ts`.
4. **Flip** both types `v1-only → v2-replaced` on byte-clean/PASS-on-empty parity; harden the ratchet **462 → 460**. Ratchets only harden.

This is read-side mirroring only — the dashboard keeps reading V1 (or dual-reads under an existing flag if one applies); do NOT change the dashboard read path or any emit site. The flip re-tags `v2Status` + lowers the ratchet; it does NOT change where anything writes or reads.

## Out of scope (do NOT do)
- ONLY these 2 types. NO run-lifecycle types (`AgentRunStarted`/`Completed`/`Failed`), NO RMS register events, NO dispatch-CLI changes — those are sequenced LAST and gated on a separate CEO checkpoint.
- NO emit-site edits, NO dashboard read-path change, NO equity. Do NOT touch dispatch run-lifecycle events — Scrooge owns the run lifecycle.

## Definition of Done (Charter)
- Full `bun run ci` from `prototype/` EXIT 0 on a CLEAN ISOLATED store (full `bunx tsc --noEmit` + full recon — NOT partial). Verify on fresh stores (`BANK_EVENT_DB` + `BANK_V2_CONTROL_PLANE_DB` to fresh worktree-local tmp). `recon:event-store-append-only` keeps a GITIGNORED local baseline — `rm .local/recon/event-store-append-only.json` if it false-positives (not in CI).
- `recon:agent-performance-v2-parity` enforcing + green/PASS-on-empty; `recon:v2-store-tee-coverage`, `v2-no-v1-import` green; ratchet hardened to 460.
- `bun run citation-gate` zero violations.

## Process (dispatch discipline)
- **Scaffold-commit early** (~min 10): tee blocks + parity skeleton → commit & push.
- Rebase-before-push: `bun run ci` → `git fetch origin main && git rebase origin/main` → re-run if changed → push; push-retry up to 5. ci:migrate may rewrite `scripts/migrate/backfill-triage-log.md` → `git checkout --` it before commit/push. `bunx biome check --write` on new files.
- Open a PR titled `feat(v2): Bucket C pilot — agent-performance domain → v2 (store-tee, ratchet 462→460)`, body citing `D-BANK-WIDE-V2-MIGRATION`, ending with the Claude Code attribution. **POLL CI THROUGH TO MERGE**; enable auto-merge if main churns (`gh pr merge --auto --squash`).

Report back to Scrooge: PR number+URL, parity result (V1 vs V2 counts), final ratchet value, `bun run ci` exit status, and confirmation the pattern is clean to batch the remaining ~195 bucket-C types (+ any friction that changes the batching plan).
