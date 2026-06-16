# Brief — Bucket A batch A2: 9 emittable numeric-money types → v2 via store-tee + MoneyWire codec

**To:** Atlas (Core banking platform architect, engineering)
**From:** Scrooge (Chief of Staff)
**Workstream:** WS-V2-MIGRATION-BUCKET-A — batch A2
**Priority:** now
**Authority:** `D-BANK-WIDE-V2-MIGRATION` + `D-V2-CORE-MONEY-DECIMAL-NATIVE` (MoneyWire MAJOR-unit); Marc "finish bucket A", 2026-06-16.
**Charter:** `D-ENGINEERING-INTEGRITY-CHARTER` ([`Engineering-Charter.md`](../../Engineering-Charter.md)) + the Dispatch discipline section of `CLAUDE.md`.

## Worktree (isolation — do NOT cd to /Users/marc/code/Bank)
Work ONLY inside: `/Users/marc/code/Bank/.claude/worktrees/atlas-bucketA-a2`
Branch: `atlas/bucketA-a2-emittable` (off origin/main @ #1401). Run `bun install` first. Commands from `prototype/`.

## Scope — the 9 EMITTABLE numeric-money types
From the bucket-A scope (`prototype/docs/bucket-a-money-bearing-nonfinancial-scope.md`), the 10 emittable numeric-money types carry money as a plain numeric field (NOT `*Minor`, so NOT gate-blocked, still emittable) and must be lifted to decimal-native MoneyWire. Migrate **9** of them this batch:

`ClimateScenarioRun`, `FeeDisclosureEvent`, `CorrespondentSettlementInstructionSent`, `NostroStatementReceived`, `CounterpartyExposureCalculated`, `STRCandidate`, `RelatedPartyTransactionProposed`, `InterEntityTransactionProposed`, `PAIARequest`.

**EXCLUDE `CalculationPerformed`** — its polymorphic `value` + string `unit` is a latent decimal-correctness hole over ~2193 live events; it is on a SEPARATE track (already flagged). Do NOT touch it.

## Pattern — store-tee + MoneyWire codec dual-write (the emittable path, cheaper than retired-by-construction)
These types CAN dual-write (they stay emittable). Use the generic store-tee mechanism (`platform/event-store/v2-store-tee.ts`, PR #1392) the money-free batches used, but with a money codec on the mirror:

For each type, per the "NEW DOMAIN ONBOARDING" recipe:
1. **Register in the V2 registry** with a `tee:{ codec: <moneyWire codec> }` block so the store-tee mirrors each V1 append into the v2 control-plane store, lifting the numeric money field(s) to MoneyWire. Investigate each type's actual money field name + **currency source** — if the V1 payload carries a currency, the codec MUST use it; if a type has NO currency field, fail-closed / resolve via the entity tree (#1382 `requireReporting`) — do NOT hardcode `?? "ZAR"` (the `no-hardcoded-reporting-currency` gate will catch it). If a type's money semantics are ambiguous (e.g. a notional vs a fee vs a threshold), get it right per-type; do not blanket-apply.
2. **Backfill** historical V1 events via `bun run backfill:v2-store-tee` (idempotent, source-event-id keyed). Most are data-empty → no-op, but wire it.
3. **`recon:bucket-a-a2-v2-parity`** (one gate for the batch, modelled on the money-free batch parity gates + the pilot's decoded-decimal compare): compare V1-store vs v2-store registers on the DECODED decimal value. **PASS-on-empty** where a type is data-empty (build phase) — most are; the gate is standing evidence, enforcing on decoded-parity where data exists. Register in `run-recon-suite.ts`.
4. **Flip** each type whose basis holds (dual-write wired + parity green/PASS-on-empty) `v1-only → v2-replaced`; **harden the ratchet by the number flipped** (480 → 480−N; expected N=9 → 471). Ratchets only harden.

If any individual type turns out NOT to cleanly migrate (e.g. money field is actually a non-money quantity on closer reading, or currency is genuinely underivable), EXCLUDE it, leave it v1-only, say so explicitly, and flip only the clean ones (adjust the ratchet to the real flipped count). No silent zero-fill, no forced flip.

## Out of scope (do NOT do)
- NOT `CalculationPerformed` (own track). NOT the 3 un-emittable `*Minor` types (RwaComputed already done; OperationalLossEvent + V2RiskAppetiteSet are batch A3).
- NO equity. Do NOT touch dispatch run-lifecycle events — Scrooge owns the run lifecycle.

## Definition of Done (Charter)
- Full `bun run ci` from `prototype/` EXIT 0 on a CLEAN ISOLATED store (full `bunx tsc --noEmit` + full recon — NOT partial). Home store is polluted with legacy `*Minor` events; gates failing locally there but passing on a fresh store / GitHub runner are home-store-state — verify on a fresh store (`BANK_EVENT_DB` + `BANK_V2_CONTROL_PLANE_DB` to fresh worktree-local tmp paths). NOTE: `recon:event-store-append-only` keeps a gitignored local baseline (`.local/recon/...`) — if it false-positives on a row-count delta after re-seeding, `rm` the stale local baseline (it is NOT in CI).
- New types registered at all 3 F-032 sites where applicable; `no-residual-minor-encoding`, `no-hardcoded-reporting-currency`, `v2-no-v1-import`, `runtime-handler-sync` green.
- Ratchet hardened to the real flipped count; the batch parity gate enforcing + green/PASS-on-empty.
- `bun run citation-gate` zero violations.

## Process (dispatch discipline)
- **Scaffold-commit early** (~min 10): first type registered + tee block + gate skeleton → commit & push (so work survives an agent death — three dispatches died on transient API 500s during the pilot; the early commit is what saved it).
- Rebase-before-push: `bun run ci` passes → `git fetch origin main && git rebase origin/main` → re-run ci if rebase changed anything → push. Push-retry on non-fast-forward (up to 5).
- New event types → all 3 F-032 sites + `recon:runtime-handler-sync` before push. ci:migrate may rewrite `scripts/migrate/backfill-triage-log.md` → `git checkout --` it before commit/push. `bunx biome check --write` on new files.
- Open a PR titled `feat(v2): Bucket A batch A2 — N emittable numeric-money types → v2 (store-tee + MoneyWire codec, ratchet 480→...)`, body citing `D-BANK-WIDE-V2-MIGRATION` + `D-V2-CORE-MONEY-DECIMAL-NATIVE`, ending with the Claude Code attribution. **POLL CI THROUGH TO MERGE**; enable auto-merge if main churns (`gh pr merge --auto --squash`).

Report back to Scrooge: PR number+URL, how many of the 9 flipped (and any excluded + why), the per-type currency-source decision, final ratchet value, `bun run ci` exit status, and any friction.
