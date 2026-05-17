---
agent: Thandiwe (Chief Audit Executive, governance)
trigger: codebase-quality-review-triage
asOf: 2026-05-11T00:00:00.000Z
decision-required: false
sourceReview: Owner Inbox/2026-05-10_vera_codebase-quality-review.md
---

# Codebase quality review triage — 2026-05-11

Produced by Thandiwe (Chief Audit Executive, governance). Input: Vera's (Internal audit engineer, third-line) codebase-quality-review filed 2026-05-10. This document triages and routes findings only; no fixes are opened here.

## 1. Triage table

| Finding | Title (short) | Owner | Priority | Status | Notes |
|---|---|---|---|---|---|
| F-001 | `Date.now()` in `alertId` — `run.ts:850` | Atlas (Core banking platform architect, engineering) | P1 | Open | Scenario-clock rollout in-flight; wire `Clock` here |
| F-002 | Wall-clock cache in `dashboard/agent-runs.ts` | Anya (Data / analytics engineer, engineering) | P1 | Open | Key invalidation on event-store cursor, not `Date.now()` |
| F-003 | 27 `Date.now()` callsites across substrate | Atlas | P1 | Open | Recon `recon:wall-clock-callsite-coverage` not yet shipped |
| F-004 | `recon/harness.ts` named recon but is a self-test | Anya | P2 | Open | Rename to `recon-self-test.ts`; track GL trial-balance recon as gap |
| F-005 | Synthetic events use untyped citation `"RECON-HARNESS"` | Atlas | P2 | Open | Use URN form in fixture; citation-gate pass implied |
| F-006 | Hardcoded `currency: "ZAR"` in CDM agent stub | Kai (Markets systems engineer, engineering) | P3 | Open | Replace with `BANK_BASE_CURRENCY` constant |
| F-007 | RMS register snapshot decode without Zod re-validation | Owen (Company Secretary, governance) + Atlas | P1 | Open | Seven files, same pattern; fail-closed on corrupt snapshot |
| F-008 | `replay()` returns `Record<string, unknown>` — 144 occurrences | Atlas | P2 | Open | Roadmap item; tighten to discriminated union when type-filter set |
| F-009 | Three `as any` casts in lifecycle test | Atlas (test ownership) | P2 | Open | Swap for `@ts-expect-error` with runtime-enforcement comment |
| F-010 | `JSON.parse(...) as <Shape>` at shell / disk boundaries | Anya | P3 | Open | Add Zod parse; fail-closed |
| F-011 | `recon:permission-gate-default` promised but absent | Atlas + Vera | P1 | **Closed** | Landed PR #199 (2026-05-10) |
| F-012 | Weak `toBeDefined()` assertion in pre-trade gateway test | Kai | P2 | Open | Assert specific approval fields |
| F-013 | Eight `toBeDefined()`/`toBeTruthy()` weak assertions (various) | Atlas (test suite owner) | P2 | Open | Replace with shape assertions in next test refactor |
| F-014 | Scheduler silent `break` on `nextFireAfter` error | Atlas | P1 | Open | Emit `SubstrateAlert`; add `warn` log with `agentUrn` + `triggerId` |
| F-015 | Lifecycle event appends swallow failure — `run.ts:269-352` | Atlas | P1 | Open | Fall back to `SubstrateAlert`; hard-fail if both fail |
| F-016 | Scrooge CEO-decision-record agent silently skips corrupt files | Atlas (substrate) + Vera (audit channel) | P2 | Open | Route parse failures through `AgentEscalation` |
| F-017 | `recon/harness.ts` deferred GL comment long overdue | Anya | P2 | Open | Duplicate concern with F-004; rename/ship together |
| F-018 | 144 `Record<string, unknown>` intermediate casts in projections | Anya + Atlas | P3 | Open | Spot-audit during projection refactor; non-blocking |
| F-019 | 4 circular import cycles — cycle 3 runtime ↔ scrooge agent hot-path | Atlas | P1 | Open | Invert cycle 3 via DI; adopt madge in CI (see also F-034) |
| F-020 | `event-types.ts` is 4,960 lines — god file | Atlas | P1 | Open | Split per domain; unblocks parallel dispatch teams |
| F-021 | `registry.ts` is 2,015 lines | Atlas | P2 | Open | Split together with F-020 |
| F-022 | Five `TODO(#A...)` markers in FX end-to-end scenario | Anya + Bea (Accounting policy lead, engineering) | P2 | Open | Sweep when D-BANK-ACCOUNT-SUBSTRATE / D-SCENARIO-CLOCK land |
| F-023 | `permission-gate.ts` comment references rot-prone "T-01 mitigation date" | Atlas | P2 | Open | Replace with typed event-ID citation (`D-EVENT-STORE-SCALING`) |
| F-024 | Session-referenced slice number in `store.ts:14-18` comment | Atlas | P3 | Open | Drop slice number; cite decision ID only |
| F-025 | `runId` / `run_id` snake↔camel mapping ad-hoc in two places | Atlas | P2 | Open | Centralise as `rowToEvent()` adapter |
| F-026 | Inconsistent catch-variable names (`e` / `err` / `error`) | Atlas | P3 | Open | Pick `err`; add ESLint rule |
| F-027 | Full `eventStore.replay()` scan per dashboard request | Anya + Atlas | P1 | Open | Track snapshot-adoption per projection in recon; flag > 10×/min |
| F-028 | Synchronous `readFileSync` on critical-path agent handlers | Atlas | P2 | Open | Non-blocking now; flag for Azure cloud-lift (Principle 3) |
| F-029 | Dashboard server HTTP bodies not Zod-validated | Senna (Cyber security architect, engineering) | P1 | Open | Zod-parse every request body; 401/403 on bad input |
| F-030 | 90 `process.env` reads with no central config schema | Atlas | P2 | Open | Centralise in `platform/env.ts`; fail at boot on misconfig |
| F-031 | `recon:permission-gate-default` not implemented | Atlas + Vera | P1 | **Closed** | Landed PR #199 (2026-05-10) |
| F-032 | No event-type registry coverage recon | Atlas + Vera | P1 | **Partially closed** | Recon shipped PR #199; 7 of 21 gaps closed PR #201 (14 remain open) |
| F-033 | No decision-required → CeoDecision pairing recon | Vera | P1 | **Closed** | Landed PR #199 (2026-05-10) |
| F-034 | No madge circular-deps gate in CI | Devon (DevOps engineer, engineering) | P2 | Open | Add `bunx madge --circular` as PR-blocker; companion to F-019 |

## 2. Summary by owner

| Owner | P1 | P2 | P3 |
|---|---:|---:|---:|
| Atlas | 8 | 10 | 3 |
| Anya | 2 | 3 | 1 |
| Senna | 1 | — | — |
| Owen + Atlas | 1 | — | — |
| Kai | — | 1 | 1 |
| Bea (joint) | — | 1 | — |
| Devon | — | 1 | — |
| Vera | — | — | — |

## 3. Closed / partially-closed findings

| Finding | Closed by | PR | Date |
|---|---|---|---|
| F-011 | `recon:permission-gate-default` shipped | #199 | 2026-05-10 |
| F-031 | Same pipeline as F-011 | #199 | 2026-05-10 |
| F-033 | `recon:decision-required-event-pairing` shipped | #199 | 2026-05-10 |
| F-032 | Recon shipped (#199); 7 registry gaps closed (#201) — 14 gaps remain | #199 + #201 | 2026-05-10 |

## 4. CEO-decision gate

No finding here requires a new CEO decision. All remediation is straightforward engineering work within existing approved-decision scope (D-RMS-PHASE-1 for register/snapshot work; D-AGENT-AUTONOMY-OPERATIONAL for substrate telemetry; Principle 4 for Senna's dashboard validation). Owning engineers may close findings unilaterally. Exception: if the F-020 `event-types.ts` split is proposed as a multi-week refactor that delays other dispatches, Atlas should surface a brief for CEO awareness — but no decision card is required pre-emptively.

## 5. P1 items — narrative and recommended dispatch order

Fourteen P1 findings remain open after the PR #199–#201 wave closed four. The dominant cluster is Atlas-owned platform-substrate work: **F-019** (circular import cycle 3 — `runtime/handler-callables.ts` ↔ `scrooge-follow-on-router.ts`) is the single most dangerous item because it is a deterministic load-order trap on the hot-path agent runtime; fix it first. **F-020** (4,960-line `event-types.ts` god file) should follow immediately because every subsequent parallel dispatch that adds an event type collides on this file — the split unblocks the entire fleet. **F-014** and **F-015** (scheduler silent break; lifecycle-event swallow) are single-function fixes with high observability value; bundle them as one dispatch. The **F-001/F-002/F-003** `Date.now()` cluster continues the in-flight scenario-clock rollout and should be driven by Atlas's existing clock-rollout plan, not as a new dispatch. **F-007** (seven RMS snapshot decoders without Zod) and **F-029** (dashboard HTTP body validation) are independent and can run in parallel — Owen + Atlas own the former; Senna owns the latter. **F-027** (full-replay-per-request performance cliff) is a forecastable cliff, not an immediate fire, but should enter Anya's next sprint. Vera's remaining recon gap (F-032 partial) closes as Atlas and Kai add registry rows to the 14 outstanding event types.

Recommended dispatch order: F-019 → F-020 → {F-014 + F-015} → {F-007 ∥ F-029} → F-003 cluster → F-027 → F-032 remainder.

— Thandiwe (Chief Audit Executive, governance), 2026-05-11.
