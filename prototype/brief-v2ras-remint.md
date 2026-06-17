# Brief — Bucket A residual: V2RiskAppetiteSet decimal-native re-mint (control-plane money pattern)

**To:** Atlas (Core banking platform architect, engineering)
**From:** Scrooge (Chief of Staff)
**Workstream:** WS-V2-MIGRATION-BUCKET-A — residual (closes bucket A's last migratable type)
**Priority:** now
**Authority:** `D-BANK-WIDE-V2-MIGRATION` + `D-V2-CORE-MONEY-DECIMAL-NATIVE`; Marc "continue as recommended", 2026-06-17.
**Charter:** `D-ENGINEERING-INTEGRITY-CHARTER` ([`Engineering-Charter.md`](../../Engineering-Charter.md)) + the Dispatch discipline section of `CLAUDE.md`.

## Worktree (isolation — do NOT cd to /Users/marc/code/Bank)
Work ONLY inside: `/Users/marc/code/Bank/.claude/worktrees/atlas-v2ras`
Branch: `atlas/bucketA-v2ras-remint` (off origin/main @ `961d2e62`). Run `bun install` first. Commands from `prototype/`.

## Why this slice (and why it matters beyond bucket A)
`V2RiskAppetiteSet` is the last migratable bucket-A residual. It is a **v2-core CONTROL-PLANE event** (`v2_events` store, in the v2-core banking union — emitted directly, NOT mirrored from a V1 type), but it is still tagged `v1-only` in the v1-removal registry because its single money field `floorZarMinor` (`z.number().int()`, optional, ZAR-only minor units; `v2-core/banking/events.ts:222`) is legacy minor-int rather than decimal-native. So the A3 agent correctly deferred it: the RBC and store-tee dual-write patterns don't apply — this needs an **in-v2 redenomination** to MoneyWire.

This establishes the **control-plane MoneyWire pattern** (a v2-native control-plane event carrying a decimal-native money field, with the store/seed/parity all handling it) — reusable for bucket C, which is heavy on control-plane substrate types.

## Deliverable
1. **Redenominate the schema** (`v2-core/banking/events.ts`): replace `floorZarMinor: z.number().int().nonnegative().optional()` with a decimal-native MoneyWire field (e.g. `floor: <moneyWire schema>.optional()`, MAJOR-unit string, currency carried — it is ZAR today but carry the currency explicitly, do NOT bake in ZAR as an untyped assumption; no `?? "ZAR"`). Use the existing v2-core money codec / MoneyWire schema (`v2-core/core/money-codec.ts` or wherever `moneyWireFromMinor` / the MoneyWire schema live — the same the A2 codecs and OperationalLossEventV2 used). Keep all non-money fields unchanged.
2. **Update the 3 consumers** to the decimal-native field:
   - `scripts/seed-v2-anchor-bank-standing-data.ts` — emit the MoneyWire floor (e.g. the intraday HQLA floor R50m → MoneyWire `{amount:"50000000", currency:"ZAR"}` MAJOR-unit, not `5_000_000_000` minor). Verify the exact lines + values against the v1 RAS register so the figure is byte-faithful after decode.
   - `platform/recon/v2-standing-data-seed-parity.ts` — compare on the decoded decimal value (the v1 RAS register floor vs the v2 MoneyWire floor), not the raw minor int.
   - `scripts/v2-anchor-migration-rehearsal.ts` — update any floor handling to the MoneyWire shape.
3. **Re-encode existing events / migration**: if any `V2RiskAppetiteSet` events already exist in the control-plane store with `floorZarMinor`, provide an idempotent re-encode (the control-plane store is seeded fresh in `ci:migrate` via the anchor seed, so on a clean store this is just the updated seed — confirm whether a historical re-encode of the home store is needed and, if so, wire it idempotently; if the seed is the only source, the updated seed suffices).
4. **Flip** `V2RiskAppetiteSet` `v1-only → v2-replaced` once it is genuinely decimal-native (no residual `*Minor`/minor-int money field) and the seed-parity recon is green. Harden the ratchet **470 → 469**. Ratchets only harden.
5. The existing `recon:v2-standing-data-seed-parity` is the standing evidence; ensure it asserts the decoded-decimal floor and stays enforcing. If a dedicated `*Minor`-residue check is warranted, note it — but the v2 `no-residual-minor-encoding` analogue should now pass for this type.

## Out of scope
- ONLY `V2RiskAppetiteSet`. NOT `CalculationPerformed` (separate decimal-correctness track). NO equity. Do NOT touch dispatch run-lifecycle events — Scrooge owns the run lifecycle.
- Do NOT rename the type identifier unless genuinely necessary — redenominating the money field is the goal, not a rename (a rename churns the union + registry + all consumers for no migration benefit). If you believe a rename is warranted, flag it and DON'T do it in this slice.

## Definition of Done (Charter)
- Full `bun run ci` from `prototype/` EXIT 0 on a CLEAN ISOLATED store (full `bunx tsc --noEmit` + full recon — NOT partial). Verify on fresh stores (`BANK_EVENT_DB` + `BANK_V2_CONTROL_PLANE_DB` to fresh worktree-local tmp). `recon:event-store-append-only` keeps a GITIGNORED local baseline — if it false-positives on a row-count delta after re-seeding, `rm .local/recon/event-store-append-only.json` (not in CI).
- `recon:v2-standing-data-seed-parity` green (decoded-decimal); `v2-no-v1-import`, `no-hardcoded-reporting-currency`, and the v2/no-residual-minor analogue green; ratchet hardened to 469.
- `bun run citation-gate` zero violations.

## Process (dispatch discipline)
- **Scaffold-commit early** (~min 10): schema redenomination + seed update → commit & push. (API overload killed several dispatches across this workstream — the early commit is what saves the work.)
- Rebase-before-push: `bun run ci` → `git fetch origin main && git rebase origin/main` → re-run if changed → push; push-retry on non-fast-forward (up to 5). ci:migrate may rewrite `scripts/migrate/backfill-triage-log.md` → `git checkout --` it before commit/push. `bunx biome check --write` on changed files.
- Open a PR titled `feat(v2): Bucket A residual — V2RiskAppetiteSet decimal-native re-mint (control-plane MoneyWire, ratchet 470→469)`, body citing `D-BANK-WIDE-V2-MIGRATION` + `D-V2-CORE-MONEY-DECIMAL-NATIVE`, ending with the Claude Code attribution. **POLL CI THROUGH TO MERGE**; enable auto-merge if main churns (`gh pr merge --auto --squash`).

Report back to Scrooge: PR number+URL, the decimal-native floor field shape + how the seed value was made byte-faithful, final ratchet value, confirmation bucket A is now fully closed (bar CalculationPerformed's separate track), `bun run ci` exit status, and any friction + a one-line note on whether the control-plane MoneyWire pattern is now cleanly reusable for bucket C.
