# Brief — Bucket A batch A3 (FINAL): OperationalLossEvent (RBC) + V2RiskAppetiteSet (re-mint)

**To:** Atlas (Core banking platform architect, engineering)
**From:** Scrooge (Chief of Staff)
**Workstream:** WS-V2-MIGRATION-BUCKET-A — batch A3 (closes bucket A)
**Priority:** now
**Authority:** `D-BANK-WIDE-V2-MIGRATION` + `D-V1-REMOVAL-FLIP-BASIS-RBC` + `D-V2-CORE-MONEY-DECIMAL-NATIVE`; Marc "finish bucket A", 2026-06-16.
**Charter:** `D-ENGINEERING-INTEGRITY-CHARTER` ([`Engineering-Charter.md`](../../Engineering-Charter.md)) + the Dispatch discipline section of `CLAUDE.md`.

## Worktree (isolation — do NOT cd to /Users/marc/code/Bank)
Work ONLY inside: `/Users/marc/code/Bank/.claude/worktrees/atlas-bucketA-a3`
Branch: `atlas/bucketA-a3-final` (off origin/main @ #1402). Run `bun install` first. Commands from `prototype/`.

## Context
Bucket A = 13 money-bearing-non-financial types. Done: `RwaComputed` pilot (#1401, RBC), 9 emittable types A2 (#1402, store-tee+codec). `CalculationPerformed` is on a SEPARATE decimal-correctness track (do not touch). This batch migrates the **last 2 un-emittable `*Minor` types** and closes bucket A. Current ratchet **471**.

## Deliverable 1 — `OperationalLossEvent` → `OperationalLossEventV2` (retired-by-construction)
Identical pattern to the RwaComputed pilot (`recon:rwa-computed-v2-parity`, `regulatory-reporting-v2.ts`, `rwa-computed-engine-v2.ts` — use them as the template). `platform/event-store/event-types/operational-risk.ts` defines `OperationalLossEvent` with `grossLossMinor` / `recoveryMinor` (int `*Minor`) + a `currency` field — un-emittable (trips `no-residual-minor-encoding`). It ALREADY has a partial MoneyWire decode helper (`moneyWireFromMinor`, `grossLoss`/`recovery: MoneyWire`) — reuse it.
1. **`OperationalLossEventV2`** decimal-native — `grossLossMinor`/`recoveryMinor` → MoneyWire (`{__money, amount, currency}`), currency from the existing payload `currency` field (currency-agnostic, no `?? "ZAR"`). Register at all 3 F-032 sites (event-types + `operational-risk.ts` registry `v2-parallel` + provenance-category).
2. **V2 emission path** — find the live emitter (callsites: `runtime/` op-risk agent — Tomas; readers are `operational-loss-projection.ts`, `rwa-engine.ts`). Re-point the live emitter to emit `OperationalLossEventV2` (RBC "V2 sole live path"). The op-loss READERS (`operational-loss-projection.ts`, `rwa-engine.ts` op-RWA) must read V2 (or both) so they don't go blind after the flip — verify and wire.
3. **Idempotent backfill** `scripts/backfill-operational-loss-v2.ts` (source-event-id keyed, into `ci:migrate`).
4. **`recon:operational-loss-v2-parity`** — decoded-decimal compare V1 vs V2, PASS-on-empty (build-phase data-empty), enforcing on decoded-parity + the RBC construction conditions (V1 un-emittable, V2 path wired). Register in `run-recon-suite.ts`. The RWA>0/positive-figure proof, if needed, is the engine/emitter unit test — do NOT seed a forbidden legacy `*Minor` event to force non-vacuous (the pilot lesson).
5. **Flip** `OperationalLossEvent` v1-only→v2-replaced; ratchet −1.

## Deliverable 2 — `V2RiskAppetiteSet` decimal-native RE-MINT (heavier)
`V2RiskAppetiteSet` is a **mis-named legacy `*Minor` type** (V2-prefixed but NOT decimal-native; schema `v2RiskAppetiteSetSchema` in v2-core/banking). The fix is a decimal-native **re-mint**, NOT a rename: mint a correctly decimal-native replacement type (MoneyWire money fields), migrate the existing events (seeded via `seed:v2-helena-ras-postures` in ci:migrate — these are the anchor RAS lines), retire the mis-named type, flip.
- Investigate the schema's actual money fields + their encoding first. Re-point the seed (`seed:v2-helena-ras-postures` / its emitter) and any RAS-line reader to the re-minted type. Backfill + parity gate (decoded-decimal, PASS-on-empty) + flip −1.
- **If the re-mint proves too entangled with anchor standing-data seeds to land cleanly in this batch** (e.g. it forces churn across the RAS register / posture seeds beyond a contained change), do Deliverable 1 cleanly, EXCLUDE Deliverable 2, leave `V2RiskAppetiteSet` v1-only, and report it as needing its own dedicated slice with the specific blocker. Do NOT force a messy re-mint. Honest partial > forced whole.

## Expected ratchet
**471 → 469** if both land; **471 → 470** if the re-mint is deferred. Set the ratchet to the REAL flipped count. Ratchets only harden.

## Out of scope
- NOT `CalculationPerformed` (separate track). NO equity. Do NOT touch dispatch run-lifecycle events — Scrooge owns the run lifecycle.

## Definition of Done (Charter)
- Full `bun run ci` from `prototype/` EXIT 0 on a CLEAN ISOLATED store (full `bunx tsc --noEmit` + full recon — NOT partial). Verify on fresh stores (`BANK_EVENT_DB` + `BANK_V2_CONTROL_PLANE_DB` to fresh worktree-local tmp). `recon:event-store-append-only` keeps a GITIGNORED local baseline — if it false-positives on a row-count delta after re-seeding, `rm .local/recon/event-store-append-only.json` (not in CI). New `:memory:` tests need an F-031 `CONSTRUCTION_CARVE_OUT_FILES` entry.
- New types at all 3 F-032 sites + `recon:runtime-handler-sync` green; `no-residual-minor-encoding`, `no-hardcoded-reporting-currency`, `v2-no-v1-import` green; ratchet hardened to the real count; new parity gates enforcing + green/PASS-on-empty.
- `bun run citation-gate` zero violations.

## Process (dispatch discipline)
- **Scaffold-commit early** (~min 10): OperationalLossEventV2 type + 1 emit + commit & push (API overload killed 5 dispatches earlier this session — the early commit is what saves the work).
- Rebase-before-push: `bun run ci` → `git fetch origin main && git rebase origin/main` → re-run if changed → push; push-retry on non-fast-forward (up to 5). ci:migrate may rewrite `scripts/migrate/backfill-triage-log.md` → `git checkout --` it before commit/push. `bunx biome check --write` on new files.
- Open a PR titled `feat(v2): Bucket A batch A3 — OperationalLossEvent (+ V2RiskAppetiteSet re-mint) → v2 (ratchet 471→...)`, body citing `D-BANK-WIDE-V2-MIGRATION` + `D-V1-REMOVAL-FLIP-BASIS-RBC`, ending with the Claude Code attribution. **POLL CI THROUGH TO MERGE**; enable auto-merge if main churns (`gh pr merge --auto --squash`).

Report back to Scrooge: PR number+URL, whether the V2RiskAppetiteSet re-mint landed or was deferred (+ specific blocker if deferred), final ratchet value, confirmation bucket A is closed (or the residual), `bun run ci` exit status, and any friction.
