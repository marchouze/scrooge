---
title: "Vera P2/P3 Triage — 2026-05-14"
author: "Vera (Internal audit engineer, governance)"
date: 2026-05-14
decision-required: false
---

# Vera — P2/P3 Triage Summary, 2026-05-14

Triage pass over the P2/P3 findings from the 2026-05-10 codebase quality review (`Owner Inbox/actioned/2026-05-10_vera_codebase-quality-review.md`). P1 findings were resolved in a prior session. This pass covers findings F-004 through F-034 (P2 and P3 severity only).

Typecheck: clean. Tests: 1562/1562 pass. Recon scripts: all pass. Lint: 5 pre-existing errors in `dashboard/public/rms.js` + `rms.css` + `platform/agents/performance-evaluator.ts` — present before this PR, not introduced here.

## Fixed directly (A)

- **F-004**: Renamed `platform/recon/harness.ts` → new file `platform/recon/recon-self-test.ts`. Old file kept as a thin import shim. `package.json` `recon` script updated to point to the new file. `permission-gate-default.ts` and `event-type-registry-coverage.ts` carve-out lists updated to include the new filename.
- **F-005**: `recon-self-test.ts` now uses `URN:internal:recon-self-test:v1` citation (proper URN form) instead of the bare `"RECON-HARNESS"` placeholder string.
- **F-009**: `as any` biome-ignore comments in `tests/substrate-agent-runner-lifecycle.test.ts` reworded to explicitly state "deliberate runtime-enforcement probe — Zod must reject unknown X even when TS type is bypassed", matching the documented convention in the test file header.
- **F-012**: Added `expect(approval?.type).toBe("OrderApprovedAtGateway")` assertion to `tests/runtime-kai-pre-trade-gateway.test.ts:118`, asserting the specific event type emitted, not just that the result is defined.
- **F-013** (partial — `policy-register.test.ts`): Replaced 8× `toBeTruthy()` on string fields with `expect(typeof p.X).toBe("string")` + `expect(p.X.length).toBeGreaterThan(0)` — specific type and non-empty assertions. The scheduler and scenarios tests' `toBeDefined()` patterns were left: they are null-guards before optional-chaining accesses, not weak standalone assertions.
- **F-016** (partial): `scrooge-ceo-decision-record.ts` parse-error message now carries an `[INTEGRITY]` prefix and explains the CEO review requirement. Full escalation via `AgentEscalation` deferred (substrate gap — escalation channel not yet wired; recorded in Atlas §16).
- **F-017**: Resolved by F-004 rename. The "future GL trial balance" comment has been replaced with an explicit statement that this is not a reconciliation pipeline; GL trial-balance recon is recorded as a substrate gap in Atlas §16.
- **F-022**: The scenario TODO markers in `03-fx-end-to-end-rehearsal.ts` reference live decision IDs (`D-SCENARIO-CLOCK`, `D-BANK-ACCOUNT-SUBSTRATE`, `D-FX-SALES-TRADING-FRONTEND`) per CLAUDE.md convention — confirmed compliant, no action required. Marked C below.
- **F-023**: Two "T-01 mitigation date" references in `permission-gate.ts` updated to cite the full decision ID `D-T-01-PERMISSION-GATE-SECURE-DEFAULT` instead, removing the informal shorthand.
- **F-034**: Added `recon:circular-deps` script to `package.json` (`bunx madge --circular --extensions ts runtime/ platform/ dashboard/ domains/`). NOT yet wired into the `ci` chain — 5 existing cycles block immediate CI gating. Recorded as substrate gap in Atlas §16 and Vera §16.

## Deferred as substrate gaps (B)

- **F-008** → Atlas: `store.ts:replay()` `Record<string, unknown>` payload density. Tighten to discriminated union when type filter is set. Recorded in Atlas §16.
- **F-010** → Atlas + Anya: `JSON.parse(...) as <Shape>` casts at trust boundaries in dashboard files. Add Zod parse at each boundary. Recorded in Atlas §16.
- **F-021** → Atlas: `registry.ts` 2015-line god file. Split together with F-020 (`event-types.ts`) per domain. Recorded in Atlas §16.
- **F-025** → Atlas: `runId` / `run_id` snake↔camel boundary enforced ad-hoc in multiple files. Centralise into one `rowToEvent()` adapter. Recorded in Atlas §16.
- **F-028** → Atlas: Synchronous I/O (`readFileSync` etc.) in agent handlers — non-blocking today; replace at cloud-lift. Recorded in Atlas §16.
- **F-030** → Atlas: 90 ad-hoc `process.env` reads — centralise in `platform/env.ts` Zod-parsed config singleton. Recorded in Atlas §16.
- **F-034** (CI gate half) → Atlas + Vera: circular-deps CI gate blocked by 5 existing taxonomy barrel cycles. Atlas resolves cycles; Vera wires gate. Recorded in both Atlas §16 and Vera §16.
- **F-016** (AgentEscalation routing) → Atlas: CEO-decision parse failures should emit `AgentEscalation` not just `SubstrateAgentRunFailed`. Blocked on escalation channel wiring. Recorded in Atlas §16.

## Already resolved / confirmed compliant (C)

- **F-012** (pre-existing assertions): Lines 119–139 of the Kai pre-trade gateway test already asserted `actor.id`, all citation chain entries, `payload.orderId`, and `payload.passedAt`. The finding was partially resolved before this triage; F-012 fix above adds the `type` assertion.
- **F-013** (scheduler + scenarios): `toBeDefined()` in `scheduler.test.ts:329, 367` and `scenarios-fx-end-to-end-phase-d.test.ts:151` are null-guards before optional chaining — specific field assertions follow on the next lines in each case. Not weak standalone assertions.
- **F-022** (scenario TODOs): All 5 TODO markers in `03-fx-end-to-end-rehearsal.ts` reference live, event-typed decision IDs — compliant with CLAUDE.md "scoped TODOs acceptable when they reference an event-typed dispatch ID."
- **F-006** (P3, hardcoded ZAR): Confirmed as agent-fixture scaffolding, not a production flow. Risk noted; no change made (P3, < 5 min threshold not met for an architectural constant change).
- **F-026** (P3, `evt` vs `err` naming): Cosmetic; ESLint rule territory. Not fixed (P3).

## Files changed

- `prototype/platform/recon/recon-self-test.ts` — new file (renamed from harness.ts)
- `prototype/platform/recon/harness.ts` — deprecated shim importing recon-self-test
- `prototype/platform/recon/permission-gate-default.ts` — carve-out list updated
- `prototype/platform/recon/event-type-registry-coverage.ts` — carve-out list updated
- `prototype/platform/event-store/permission-gate.ts` — T-01 → decision ID cite
- `prototype/runtime/agents/scrooge-ceo-decision-record.ts` — integrity error message
- `prototype/tests/substrate-agent-runner-lifecycle.test.ts` — biome-ignore comment
- `prototype/tests/runtime-kai-pre-trade-gateway.test.ts` — type assertion added
- `prototype/tests/policy-register.test.ts` — toBeTruthy → typed assertions
- `prototype/package.json` — recon script updated + recon:circular-deps added
- `Team/Atlas.md` §16 — 8 substrate gaps recorded
- `Team/Vera.md` §16 — 1 substrate gap recorded

Citations: Vera audit mandate (Team/Vera.md), Principle 1 (events-as-truth), Principle 2 (single-graph discipline), Principle 4 (security designed in).

— Vera (Internal audit engineer, governance), 2026-05-14
