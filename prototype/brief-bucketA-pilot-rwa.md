# Brief — Bucket A PILOT: RwaComputed → RwaComputedV2 (retired-by-construction)

**To:** Atlas (Core banking platform architect, engineering)
**From:** Scrooge (Chief of Staff)
**Workstream:** WS-V2-MIGRATION-BUCKET-A (money-bearing non-financial) — PILOT
**Priority:** now
**Authority:** `D-BANK-WIDE-V2-MIGRATION` + `D-V1-REMOVAL-FLIP-BASIS-RBC` (retired-by-construction flip basis) + `D-V2-CORE-MONEY-DECIMAL-NATIVE` (MoneyWire MAJOR-unit); Marc in-session pick of bucket A, 2026-06-16.
**Charter:** `D-ENGINEERING-INTEGRITY-CHARTER` ([`Engineering-Charter.md`](../../Engineering-Charter.md)) + the Dispatch discipline section of `CLAUDE.md`.

## Worktree (isolation — do NOT cd to /Users/marc/code/Bank)
Work ONLY inside: `/Users/marc/code/Bank/.claude/worktrees/atlas-bucketA-rwa`
Branch: `atlas/bucketA-pilot-rwa` (off origin/main @ #1400). Run `bun install` first. Commands from `prototype/`.

## Execute the design you already wrote
The full build spec is **`prototype/docs/bucket-a-money-bearing-nonfinancial-scope.md` §5** (you authored it in PR #1400). Implement §5.1–§5.5 exactly. Summary of the deliverable:

1. **`RwaComputedV2`** decimal-native event type — new `platform/event-store/event-types/regulatory-reporting-v2.ts`; payload identical to `RwaComputed` except the four `*Minor` integer fields (`creditRwaMinor`/`marketRwaMinor`/`operationalRwaMinor`/`totalRwaMinor`) become **MoneyWire** (`{__money, amount, currency}`, MAJOR-unit string). Register at all **three F-032 sites**: event-types module + `regulatory-reporting.ts` registry (as `v2-parallel`, `schemaVersion: 2`) + `provenance-category.ts` (regulatory/accounting category — do this BEFORE seeding or the seed is tagged simulated/scenario-required, per the S3 posture defect).
2. **V2 emission path** — `emitRwaComputedV2` (in `rwa-computed-engine-v2.ts` or extend the engine), decimal-native; re-point the single live caller `runtime/agents/bea-rwa-period-close.ts` (`emitRwaComputed` ~line 141) to the V2 emitter so the period-close run emits **only** `RwaComputedV2` (the RBC "V2 sole live path" condition).
3. **Idempotent backfill** — `scripts/backfill-rwa-computed-v2.ts` (copy `backfill-credit-limit-v2-dual-run.ts` shape): scan V1 `RwaComputed`, emit `RwaComputedV2` via the MoneyWire codec (`moneyWireFromMinor`), reuse source provenance + `bank:v1-source:<eventId>` tag, source-event-id idempotency key (INSERT OR IGNORE). Wire into `package.json` `ci:migrate` after V1 seeds. (Reality: 0 live `RwaComputed` events today → no-op now; exists for replay-safety.)
4. **`recon:rwa-computed-v2-parity`** (`platform/recon/rwa-computed-v2-parity.ts`, modelled on `posture-v2-parity.ts`): compare the latest-per-key RWA register V1 vs V2 on the **decoded decimal value** (NOT byte — unit change makes byte-compare meaningless; precedent `recon:fx-v2-parity`). Register in `run-recon-suite.ts`.
5. **FLIP — retired-by-construction.** Assert all four `D-V1-REMOVAL-FLIP-BASIS-RBC` conditions hold (each recorded on the registry row): (1) V1 un-emittable (trips `no-residual-minor-encoding`, verified); (2) V2 sole path produces — gate asserts ≥1 V2 event with a decoded RWA on the seeded store (seed at least one `RwaComputedV2` via the re-pointed emitter so condition 2 is non-vacuous); (3) V2 has own tests (parity + engine unit tests); (4) historical V1 replay-readable (schema + decoder stay registered). On all four holding on a CLEAN store: flip `RwaComputed` `v1-only → v2-replaced`, make `recon:rwa-computed-v2-parity` **enforcing**, and **harden the v1-removal ratchet −1 (481 → 480)**. Ratchets only harden (Charter cmd 3).

## Out of scope (do NOT do)
- ONLY `RwaComputed` this run — NOT OperationalLossEvent / V2RiskAppetiteSet (batch-2) and NOT any of the 10 emittable numeric-money types.
- Do NOT touch `CalculationPerformed` (separate decimal-correctness track, already flagged).
- NO equity work. Do NOT touch dispatch run-lifecycle events — Scrooge owns the run lifecycle.

## Definition of Done (Charter)
- Full `bun run ci` from `prototype/` EXIT 0 on a clean isolated store (full `bunx tsc --noEmit` + full recon — NOT partial). Note: the home store is polluted with legacy `*Minor` events; recon gates that fail locally there but pass on a fresh store / GitHub runner are home-store-state, not your code — verify on a fresh store (`BANK_EVENT_DB` + `BANK_V2_CONTROL_PLANE_DB` to fresh worktree-local tmp paths).
- New type at all 3 F-032 sites; `recon:runtime-handler-sync`, `no-residual-minor-encoding`, `no-float-money`, `v2-no-v1-import` green.
- Ratchet hardened to 480 and `recon:rwa-computed-v2-parity` enforcing + green.
- `bun run citation-gate` zero violations.

## Process (dispatch discipline)
- Scaffold-commit early (~min 10). Rebase-before-push: `bun run ci` → `git fetch origin main && git rebase origin/main` → re-run ci if changed → push. Push-retry on non-fast-forward (up to 5).
- ci:migrate may rewrite `scripts/migrate/backfill-triage-log.md` → `git checkout --` it before commit/push.
- Open a PR titled `feat(v2): Bucket A pilot — RwaComputed → RwaComputedV2 (retired-by-construction, ratchet 481→480)`, body citing `D-BANK-WIDE-V2-MIGRATION` + `D-V1-REMOVAL-FLIP-BASIS-RBC`, ending with the Claude Code attribution. **POLL CI THROUGH TO MERGE**; enable auto-merge if main churns (`gh pr merge --auto --squash`).

Report back to Scrooge: PR number+URL, confirmation the 4 RBC conditions held (with the condition-2 non-vacuous proof), final ratchet value, `bun run ci` exit status, and any friction surfaced that changes the batching plan for the rest of bucket A.
