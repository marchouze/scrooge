---
title: "Vera codebase-quality-review — triage routing"
author: Thandiwe (Chief Audit Executive, governance)
date: 2026-05-12
decision-required: false
---

# Vera codebase-quality-review triage — 2026-05-12

**Source review:** `Owner Inbox/2026-05-10_vera_codebase-quality-review.md`  
**Review as-of:** 2026-05-10  
**Triage as-of:** 2026-05-12  
**Findings:** 34 total (14 P1, 15 P2, 5 P3)  
**Already resolved (post-2026-05-10):** 2 (see §Resolution status)

This brief routes all 34 findings from Vera's (Internal audit / continuous-assurance engineer, third-line) read-only codebase audit to the correct owner-agent. No source changes are made here; this is a routing record only.

---

## Routing table

| Finding | Title | Severity | Owner | Status |
|---------|-------|----------|-------|--------|
| F-001 | `Date.now()` in alertId — `runtime/run.ts:850` | P1 | Atlas (Core banking platform architect, engineering) | Open |
| F-002 | Wall-clock-keyed agent-runs cache — `dashboard/agent-runs.ts` | P1 | Anya (Data / analytics engineer, engineering) | Open |
| F-003 | 27 `Date.now()` / `new Date()` callsites outside ScenarioClock | P1 | Atlas | Open |
| F-004 | `recon/harness.ts` misnamed — placeholder not recon pipeline | P2 | Atlas | Open |
| F-005 | Synthetic citation string `"RECON-HARNESS"` not URN-typed | P2 | Atlas | Open |
| F-006 | Hardcoded `currency: "ZAR"` in CDM bindings stub | P3 | Kai (Trading systems engineer, engineering) | Open |
| F-007 | RMS register snapshots decoded via `JSON.parse as {}` — no Zod | P1 | Atlas + Owen (Company Secretary, governance) | Open |
| F-008 | `Record<string,unknown>` payload in `store.ts:366` `replay()` | P2 | Atlas | Open (roadmap) |
| F-009 | Three `as any` casts in lifecycle test — use `@ts-expect-error` | P2 | Atlas | Open |
| F-010 | `JSON.parse as <Shape>` at trust boundaries in dashboard | P2 | Anya | Open |
| F-011 | `recon:permission-gate-default` promised but not implemented | P1 | Atlas + Vera | Open |
| F-012 | Weak `toBeDefined()` assertion in pre-trade gateway test | P2 | Kai | Open |
| F-013 | Eight `toBeDefined()` / `toBeTruthy()` weak assertions across tests | P2 | Vera (next wave) | Open |
| F-014 | Scheduler silently `break`s on `nextFireAfter` error — no log/event | P1 | Atlas | Open |
| F-015 | Lifecycle telemetry swallowed on append failure — Principle 1 gap | P1 | Atlas | Open |
| F-016 | Corrupted CEO-decision record parsed silently — no escalation | P2 | Atlas | Open |
| F-017 | `recon/harness.ts` "future GL trial balance" long-deferred | P2 | Atlas + Anya | Open (duplicate of F-004) |
| F-018 | Wide `Record<string,unknown>` intermediate shapes in projections | P3 | Anya | Open (non-blocking) |
| F-019 | 4 circular import cycles — `handler-callables` ↔ `scrooge-follow-on-router` most dangerous | P1 | Atlas | Open |
| F-020 | `event-types.ts` — 4960 lines, god file | P1 | Atlas | Open |
| F-021 | `registry.ts` — 2015 lines, long file | P2 | Atlas | Open (defer with F-020) |
| F-022 | 5 `TODO(#A...)` markers in FX rehearsal scenario | P2 | Anya + Bea (Accounting & financial reporting engineer, engineering) | Open |
| F-023 | `permission-gate.ts` heavy comment preamble with rotting refs | P2 | Atlas | Open |
| F-024 | `store.ts` comment cites slice number — drifts as build plan evolves | P3 | Atlas | Open |
| F-025 | `runId` vs `run_id` mapping duplicated across adapters | P2 | Atlas | Open |
| F-026 | `evt` / `e` / `err` / `error` inconsistency in `catch` clauses | P3 | Atlas | Open (lint rule) |
| F-027 | Full `eventStore.replay()` per dashboard request — snapshot not adopted | P1 | Anya + Atlas | Open |
| F-028 | `readFileSync` on critical agent-run path | P2 | Atlas | Open (defer to cloud lift) |
| F-029 | Dashboard server HTTP routes lack Zod body validation | P1 | Senna (Security engineer, engineering) | Open |
| F-030 | 90 `process.env` reads — no central validated config singleton | P2 | Atlas | Open |
| F-031 | `recon:permission-gate-default` missing (gate preamble claims it exists) | P1 | Atlas + Vera | Open (see F-011) |
| F-032 | No `recon:event-type-registry-coverage` | P1 | Atlas + Vera | Open |
| F-033 | No `recon:decision-required-event-pairing` | P1 | Vera | Open |
| F-034 | No `madge --circular` gate in CI | P2 | Devon (Chief Operating Officer, engineering) | Open |

---

## Resolution status

Two findings were resolved by PRs that landed on 2026-05-10 — the same day as the review — and are confirmed merged on `main`:

| Finding | Resolved by | Merged |
|---------|------------|--------|
| **F-023 (partial)** — `permission-gate.ts` T-01 bypass list left "open" | PR #168 `substrate(security): T-01 permission gate now secure-by-default` — closed the legacy bypass path; comment still has slice refs (Vera's F-023 prose note) but the functional gap is closed | 2026-05-10 11:32 |
| **F-002 (partial)** / cache-in-commit-graph anti-pattern | PR #157 `substrate(D-EVENT-STORE-SCALING Slice 3b): remove dashboard-state.json from commit graph` — the committed cache anti-pattern is gone; the in-memory `Date.now()`-keyed invalidation in `agent-runs.ts` itself remains open | 2026-05-10 09:59 |

F-002 (in-memory cache keying on `Date.now()` rather than event-store cursor) remains open even though the committed-cache variant was fixed.

---

## By owner

### Atlas (Core banking platform architect, engineering)

Primary owner for infrastructure, event-store, scheduler, runtime composition, and platform plumbing. Fourteen findings land here — recommended sequencing follows Vera's §4 priority order.

**P1 — action now:**

- **F-019** (P1) — Circular import: `runtime/handler-callables.ts` ↔ `runtime/agents/scrooge-follow-on-router.ts`. Invert the dependency; router should accept the callable map via DI from composition root. Also adopt `bunx madge` as a CI gate (Vera substrate gap #6).
- **F-031 + F-032** (P1 cluster, recon gaps) — Ship `recon:permission-gate-default` (asserts legacy bypass list count == snapshot; entries dated) and `recon:event-type-registry-coverage` (every `eventStore.append({ type: "X" })` callsite has a registry row + `make<X>` factory). Both are < 100 LOC. Can be a single dispatch with Vera.
- **F-020** (P1) — Split `platform/event-store/event-types.ts` (4960 lines, 74 schemas + 73 factories) into per-domain barrels: `event-types/{markets,accounting,governance,agent-lifecycle,rms,recon}.ts` with a thin re-export barrel. Defer `registry.ts` (F-021) to the same PR.
- **F-015** (P1) — Lifecycle telemetry append failures (`SubstrateAgentRunStarted / Completed / Failed`) currently log-and-swallow. Escalate to a `SubstrateAlert` append on failure; if that also fails, crash. Audit trail with a silent catch violates Principle 1.
- **F-014** (P1) — Scheduler `catch (_e) { break }` on `nextFireAfter`. One-line fix: log at `warn` with `agentUrn` + `triggerId` + error; emit `SubstrateAlert` at `severity: medium`.
- **F-007** (P1) — All seven RMS register projections decode snapshots via `JSON.parse(payload) as {...}`. Add a Zod schema per register row in `decodeSnapshot`; fail-closed on parse error. Co-own with Owen (register spec).
- **F-001** (P1) — `alertId: \`alert:integrity:bus-tick-${Date.now()}\`` in `runtime/run.ts:850`. Route through the substrate-resolved `Clock`; use `newEventId()` for the ID.
- **F-003** (P1) — 27 `Date.now()` / `new Date()` callsites. Stand up `recon:wall-clock-callsite-coverage`; fail when non-clock-aware files outside the per-module rollout allowlist contain raw callsites. Continuation of in-flight ScenarioClock rollout.
- **F-011** (P1) — Cross-reference with F-031; same recon. Close together.

**P2 — next sprint:**

- **F-004 + F-017** (P2, duplicate findings) — Rename `platform/recon/harness.ts` to `recon-self-test.ts`; the file's own header discloses it is a self-test, not a reconciliation pipeline. Track GL trial-balance recon as an Anya substrate gap.
- **F-005** (P2) — Harness synthetic events use `"RECON-HARNESS"` string citation; replace with `URN:internal:recon-harness:v1` to model correct form.
- **F-008** (P2, roadmap) — `replay()` returns `Record<string,unknown>`; tighten to discriminated union when type filter is set. Non-blocking; log as Atlas roadmap item.
- **F-009** (P2) — Three `as any` casts in `tests/substrate-agent-runner-lifecycle.test.ts:119,135,185`; swap for `// @ts-expect-error — runtime-enforcement probe`.
- **F-016** (P2) — `scrooge-ceo-decision-record.ts:104`: malformed CEO-decision record is silently skipped. Route parse failure through `AgentEscalation` channel.
- **F-021** (P2) — Split `registry.ts` (2015 lines) together with F-020.
- **F-023** (P2) — `permission-gate.ts` heavy comment preamble: replace "T-01 mitigation date" prose refs with typed event-ID citations (e.g. cite `D-EVENT-STORE-SCALING`) and remove slice numbers.
- **F-025** (P2) — Centralise snake↔camel row adapter into one `rowToEvent()` function (currently duplicated in `store.ts:359-369` and `postgres-sync.ts:113-115`).
- **F-028** (P2, cloud-lift deferred) — `readFileSync` on critical agent-run path in `anya-projection-drift.ts:128`, `owen-governance-cycle-prep.ts:70`, `senna-security-substrate-state.ts:73`. Flag for async blob-storage replacement at M8 cloud lift.
- **F-030** (P2) — Centralise 90 `process.env` reads into a `platform/env.ts` Zod-parsed config singleton; fail at boot on misconfig.

**P3 — lint / polish:**

- **F-024** (P3) — `store.ts:14-18` comment cites slice number; replace with "see D-EVENT-STORE-SCALING" without slice.
- **F-026** (P3) — Pick `err` as the canonical `catch` variable name; add ESLint rule.

---

### Anya (Data / analytics engineer, engineering)

- **F-002** (P1) — `dashboard/agent-runs.ts:167-208`: cache keyed on `Date.now()`; re-key invalidation on `eventStore.count()` (sequence cursor) instead.
- **F-010** (P2) — `JSON.parse(...) as <Shape>` at trust boundaries in `dashboard/agent-runs.ts:154`, `dashboard/derive.ts:359,517`, `dashboard/registry.ts:34`; add Zod parse at each.
- **F-017** (P2) — GL trial-balance reconciliation harness gap (surfaced by `recon/harness.ts` self-disclosure); own as a substrate gap roadmap item.
- **F-018** (P3, non-blocking) — Wide `Record<string,unknown>` intermediate shapes in `platform/projections/` and `dashboard/derive.ts`; spot-audit during the projection refactor.
- **F-022** (P2) — Five `TODO(#A...)` markers in `scenarios/03-fx-end-to-end-rehearsal.ts`; sweep once D-BANK-ACCOUNT-SUBSTRATE / D-FX-SALES-TRADING-FRONTEND / D-SCENARIO-CLOCK fully land. Co-own with Bea.
- **F-027** (P1) — Full `eventStore.replay()` per dashboard request; adopt the snapshot substrate (`store.ts:401-`) for all projection consumers; co-own recon with Atlas.

---

### Bea (Accounting & financial reporting engineer, engineering)

- **F-022** (P2) — Co-owner with Anya for `scenarios/03-fx-end-to-end-rehearsal.ts` TODO sweep.

---

### Owen (Company Secretary, governance)

- **F-007** (P1) — Co-owner with Atlas: define the per-register-row Zod schemas that the RMS register snapshot decoder must validate against. Owen owns the register data contract; Atlas owns the parser plumbing.

---

### Senna (Security engineer, engineering)

- **F-029** (P1) — `dashboard/server.ts:568` and surrounding HTTP route handlers lack Zod validation of request bodies. Zod-parse every request body; 401/403 on bad input. Principle 4 ("security designed in") binds during the build phase.
- **F-030** (P2) — Note: `ANTHROPIC_API_KEY`, `BANK_PERMISSION_GATE_DISABLED`, and related security-sensitive env vars are among the 90 unregistered reads; flag these for the `platform/env.ts` config singleton (primary owner Atlas, Senna co-reviews the security-sensitive vars).

---

### Kai (Trading systems engineer, engineering)

- **F-006** (P3) — Hardcoded `currency: "ZAR"` in `runtime/agents/kai-m1-cdm-typescript-bindings.ts:88-93`; replace with `BANK_BASE_CURRENCY` constant or fixture import.
- **F-012** (P2) — `tests/runtime-kai-pre-trade-gateway.test.ts:118`: `expect(approval).toBeDefined()` misses structural assertion; assert `expect(approval.outcome).toBe("approved")` or equivalent.

---

### Devon (Chief Operating Officer, engineering)

- **F-034** (P2) — Add `bunx madge --circular --extensions ts platform runtime dashboard domains` to the CI gate matrix; failure = PR blocker. Mechanical change; pairs with Atlas's F-019 fix.

---

### Vera (Internal audit / continuous-assurance engineer, third-line)

Vera owns the recon gaps she herself surfaced, and the test-pattern sweep:

- **F-011 + F-031** (P1) — `recon:permission-gate-default` implementation (co-owns with Atlas). Failure condition: legacy bypass list count differs from snapshot count; any entry without an add-date is a finding.
- **F-032** (P1) — `recon:event-type-registry-coverage` (co-owns with Atlas). Walk every `eventStore.append({ type: "X" })` callsite; assert `lookupEventType("X")` returns non-null and `make<X>` factory exists.
- **F-033** (P1) — `recon:decision-required-event-pairing` (Vera-only). Assert that every `Owner Inbox/` file with `decision-required: true` that is actioned-and-archived has a matching `CeoDecision` event in the store.
- **F-013** (P2) — Eight `toBeDefined()` / `toBeTruthy()` weak assertions in `tests/scheduler.test.ts`, `tests/scenarios-fx-end-to-end-phase-d.test.ts`, `tests/projections-snapshot.test.ts`, `tests/policy-register.test.ts`; replace with shape assertions in next test-quality wave.

---

## Substrate gaps (from Vera §5, for roadmap)

Vera surfaced nine substrate gaps that prevented fully-autonomous execution of this audit. These are registered here as roadmap items; Atlas and Vera co-own prioritisation:

| Gap | Description | Owner |
|-----|-------------|-------|
| SG-1 | No standing `recon:code-quality-metrics` harness | Vera |
| SG-2 | No `.github/CODEOWNERS` file — routing was manual | Devon |
| SG-3 | No `recon:permission-gate-default` | Atlas + Vera (= F-011/F-031) |
| SG-4 | No `recon:event-type-registry-coverage` | Atlas + Vera (= F-032) |
| SG-5 | No `recon:decision-required-event-pairing` | Vera (= F-033) |
| SG-6 | No `recon:circular-deps` CI gate | Devon (= F-034) |
| SG-7 | No `recon:wall-clock-callsite-coverage` | Atlas (= F-003) |
| SG-8 | No central `platform/env.ts` config schema | Atlas (= F-030) |
| SG-9 | No GL trial-balance reconciliation harness | Anya (= F-017) |

---

## Recommended dispatch sequence

Ordering follows Vera's §4 priority list, adjusted for findings already in-flight:

1. **Atlas: F-019** — break circular import (`handler-callables` ↔ `scrooge-follow-on-router`). Single PR; unblocks safe fleet expansion.
2. **Atlas + Vera: F-031 + F-032 + F-033** — three missing recons bundle well; each < 100 LOC. Ship as one or two PRs.
3. **Atlas: F-020 + F-021** — split `event-types.ts` + `registry.ts` per domain. Prerequisite for low-friction handler addition in all future dispatches.
4. **Atlas: F-015** — lifecycle telemetry: `SubstrateAlert` fallback instead of log-and-swallow.
5. **Atlas: F-014** — scheduler silent `break`; one-line observability fix.
6. **Atlas + Owen: F-007** — Zod snapshot decode for all seven RMS registers.
7. **Senna: F-029** — Zod validation on all dashboard HTTP route bodies.
8. **Atlas: F-001 + F-003** — ScenarioClock rollout continuation + `recon:wall-clock-callsite-coverage`.
9. **Devon: F-034** — `madge` CI gate (pairs with F-019 fix).
10. **Atlas: F-030** — centralise `process.env` into `platform/env.ts`.

— Thandiwe (Chief Audit Executive, governance), 2026-05-12
