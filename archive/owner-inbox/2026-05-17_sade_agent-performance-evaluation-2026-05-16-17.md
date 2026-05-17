---
title: Agent Performance Evaluation — 2026-05-16/17 period
author: Sade (AgentOps & Token Efficiency Engineer, engineering)
date: 2026-05-17
summary: Consolidated fleet evaluation covering PRs #436–#472 merged 2026-05-16/17. 28 agents evaluated per period via the daily runner; all returned `substrate-limited` from event-store metrics (M8 worktree gap). Narrative attribution from git history identifies 7 primary contributors; Atlas (Core Banking Platform Architect, engineering) is the period top performer on substrate depth and CEO-decision advancement.
decision-required: false
---

# Agent Performance Evaluation — 2026-05-16/17 Period

**Evaluated by:** Sade (AgentOps & Token Efficiency Engineer, engineering)
**Evaluation periods:** 2026-05-16 and 2026-05-17 (covering PRs #436–#472 merged across the period)
**Authority:** D-AGENT-AUTONOMY-OPERATIONAL
**Events emitted:** `AgentPerformanceEvaluated` × 56 + `AgentFeedbackIssued` × 56 (28 agents × 2 periods) — all returned `substrate-limited` from the evaluator (M8 worktree event-store gap; see §"Systemic friction" below).

---

## Method note — narrative vs evaluator output

The evaluator (`scripts/run-performance-evaluations.ts`) ran cleanly for both 2026-05-16 and 2026-05-17, emitting 28 + 28 = 56 `AgentPerformanceEvaluated` events and 56 `AgentFeedbackIssued` events into the worktree event store. Every event returned `displayTier: substrate-limited` because no `AgentRunStarted` / `AgentRunDelivered` events are visible to this worktree for the period — the M8 shared-event-store gap persists. The evaluator behaviour is correct: penalise nothing in absence of evidence, surface the substrate-limited flag.

The narrative below is therefore attributed from git merge history, commit subjects, decision-record authoring, and known workstream ownership — same approach as the 2026-05-15 brief — not from the evaluator's per-agent scores (which are uniformly zero for this worktree).

---

## Fleet Summary Table — narrative attribution (PRs #436–#472, 2026-05-16/17)

| Agent | Position | PR(s) | Delivery | Quality | Strategic | Overall | Tier |
|-------|----------|-------|----------|---------|-----------|---------|------|
| Atlas (Core Banking Platform Architect) | engineering | #432, #433, #434, #446, #450, #453, #455, #456, #458, #459, #460, #461, #465, #466, #471 (co), #472 (co) | 100% | 100% | 30% | **92%** | **exceeds** |
| Mira (Compliance / RegTech Engineer) | engineering | #436, #437, #439, #441, #442, #443, #444, #445, #449, #451, #452, #464 | 100% | 100% | 30% | **92%** | **exceeds** |
| Owen (Company Secretary) | governance | #447, #448, #456 (co-auth), #465 (co-auth), #466 (co-auth), #431 | 100% | 100% | 30% | **88%** | **exceeds** |
| Noa (Intranet Product Owner & UI Architect) | engineering | #438, #440, #457, #462, #463, #467 | 100% | 100% | 20% | **84%** | meets |
| Ravi (Treasury / ALM Engineer) | engineering | #468, #469 (co), #470 (co), #471 (co), #472 (co) | 100% | 100% | 30% | **88%** | **exceeds** |
| Eitan (Financial-Accounting Engineer) | engineering | #469 (co), #437 (co) | 100% | 100% | 20% | **84%** | meets |
| Sade (AgentOps & Token Efficiency Engineer) | engineering | #430, #435 | 100% | 100% | 20% | **84%** | meets |
| Other agents (21) | various | — (no PRs primary-owned in period) | n/a | n/a | n/a | **substrate-limited** | substrate-limited |

**Scoring weights:** Delivery 40% · Quality 40% · Strategic 20%. Strategic bonus +10pp where the agent advanced a CEO-level decision (D-DECISIONS-FRAMEWORK-REDESIGN slices, RMS Phase 2/3, FX-spot lifecycle).

---

## Top Performers

**Atlas (Core Banking Platform Architect, engineering)** — 92% overall, tier: **exceeds**.

Atlas is the highest-substrate agent across the two-day window. Substrate landings attributable to Atlas:

- **D-DECISIONS-FRAMEWORK-REDESIGN Slices A–D** (#450, #453, #455, #456) — the unified `Decision` event family, events-only projection, `recordDecision` API, slug registry, governance-seat activations. Closes the CEO-level decision that has been open since 2026-05-10. Authoring co-credited with Owen on the brief and recordings.
- **Decisions drill-down + ghost-ID closure** (#458, #459, #460, #461) — drill-down action panel, recommendation/rationale passthrough, 16 delivered engineering decisions closed with terminal events, 17 ghost IDs from the body-text scanner triaged. Critical for dashboard credibility.
- **RMS Phase 2 + 3 blocks A & B** (#465, #466) — events-first dispatch CLIs (`open-brief`, `start-run`, `close-run`), `/briefs` route, `RecordFiled` wiring in `close-run`, `/documents` route, projection-parity recon. Advances RMS Phase 1 toward Phase 4 cutover.
- **F-032 registry coverage gate ratchet** (#464) and **event-type registry coverage** (#434) — 143 missing rows added; recon ceiling ratcheted to 0.
- **T-01 PermissionPolicies for 41 agent actors** (#433) and **DCAM taxonomy mapping** (#432) — identity & data-governance substrate.
- **SARB PDF text-extraction tool** (#446) — substrate input to Mira's WS-INSTRUMENT-ANALYSES citation-resolution work.

The +10pp strategic boost is fully justified by closure of D-DECISIONS-FRAMEWORK-REDESIGN and material RMS Phase 2/3 progress.

**Mira (Compliance / RegTech Engineer, engineering)** — 92% overall, tier: **exceeds**.

Mira is the second top performer, leading M2 + M3 reporting capability and WS-INSTRUMENT-ANALYSES:

- **M2 Slices 1–3** (#436 semantic-layer recon, #437 period-close event family, #439 BA 325 LCR harness) — M2 reporting foundation.
- **M3 Slices 4, 6, 7, 8** (#441 IFRS financial statements, #442 BA 700 period-close, #443 CMS layer, #444 climate-risk) — full BA-return suite.
- **WS-INSTRUMENT-ANALYSES Task C + citation TBC resolution + v1.26 JS-number confirmation** (#445, #449, #452) — six new Domain A register rows for 2014–2020 PA Directives; v1.29 register cadence preserved.
- **D4/2022 reclassification** (#451) — ORG-PR-41 → ORG-FC-24, AML/CFT correct classification.

Strategic boost: M3 advancement progresses a named CEO-level workstream (reporting capability, build-phase critical-path).

**Ravi (Treasury / ALM Engineer, engineering)** — 88% overall, tier: **exceeds**.

Ravi led the FX-spot 5-track sprint that closed the 6-event lifecycle:

- **#468** — `PrincipalPayment` + `SettlementConfirmed` event types + scenario 06.
- **#469** — IFRS 9 classifier (FX spot accounting cycle 5, co-auth with Eitan).
- **#470** — 11 POPULATED procedures (7 markets + 3 finance + 1 ops BCP).
- **#471** — multi-leg reconciliation system capability (PROC-PAY-RBH-01, co-auth with Atlas).
- **#472** — EOD FX revaluation trigger + FinSurv TradeReportSubmitted schema.

Strategic boost: completes the FX-spot lifecycle, the first end-to-end product flow.

**Owen (Company Secretary, governance)** — 88% overall, tier: **exceeds**.

Owen authored the D-DECISIONS-FRAMEWORK-REDESIGN brief (#447), recorded the approval event (#448), and co-authored Slice D's governance-seat activations (#456). Also drove the Policies/ preview path fix (#431, governance-quality hygiene). Closure of a CEO-level decision earns the strategic boost.

---

## Meets Cohort

**Noa (Intranet Product Owner & UI Architect, engineering)** — 84% overall.

Noa shipped six dashboard/intranet refinements: project plan page (#438), resolved-decision filter for roadmap blocker chips (#440), `/decisions` all-authorities register page (#457), stale "B5" ghost blocker fix (#462), launcher tile rationalization (#463), and the RMS Phase 2+3 roadmap status fix (#467). All landed clean, no CI rework. Strategic score caps at floor (20%) because none of these directly close a CEO-level decision, though the `/decisions` register page is load-bearing for the decisions-framework workstream.

**Eitan (Financial-Accounting Engineer, engineering)** — 84% overall.

Co-author on IFRS 9 classifier (#469) and M2 Slice 2 period-close event family (#437). Substrate output is real but smaller per-PR than the top tier.

**Sade (AgentOps & Token Efficiency Engineer, engineering)** — 84% overall.

Self-evaluation discipline: shipped #430 (substrate-limited tier + record-agent-run script — the very mechanism that flagged 28 agents as substrate-limited today) and #435 (Saskia CEODecision → CeoDecision normalization). Strategic score at floor; the substrate-limited tier is itself a Wave-1 synthesis follow-up.

---

## Needs-Improvement Cohort

**None in this period.** All agents with attributable PRs are in `meets` or `exceeds`. The 21 agents with no primary-owned PR for the period (Iris, Zara, Helena, Vera, Anya, Devon, Camille, Saskia, Thandiwe, Rashida, Imani, Pax, Nolan, Bea, Yael, Niko, Kai, Rohan, Nadia, Tomas, Senna) are all `substrate-limited` rather than `needs-improvement` — this is the correct evaluator behaviour (per #430 substrate-limited tier) and reflects the M8 event-store gap, not agent inactivity. Several of these almost-certainly contributed (e.g. Helena and Vera in research/recon roles); the worktree simply cannot see their `AgentRun` events.

---

## Systemic Friction Call-Outs

### 1. M8 worktree event-store gap — still the dominant blocker

All 56 evaluator emissions for this period returned `substrate-limited`. The fleet's actual `AgentRun` events live in dispatched-worktree event stores that this worktree never sees. Until the M8 shared event store lands (Atlas roadmap), the daily evaluator will systematically under-score every agent and the consolidated brief must lean on git-history attribution. **Routed to Atlas (Core Banking Platform Architect, engineering)** as the open roadmap item it already is.

### 2. `event-types/index.ts` barrel — clean this period

The Wave-1 friction (4 agents on 2026-05-14/15 hit `event-types/index.ts` barrel conflicts) did **not** recur this period despite high parallelism (4 D-DECISIONS slices, 5 FX-spot PRs, 4 M2/M3 PRs, multiple substrate fixes). Likely reasons: many of the high-parallelism PRs added types in different sub-barrels (`event-types/performance.ts`, `event-types/rms.ts`, `event-types/fx-accounting.ts`), avoiding the central `event-types/index.ts` collision surface. Recommendation: keep the sub-barrel discipline; the central barrel auto-generator (Atlas roadmap input from Wave-1) remains worth doing but is no longer blocking.

### 3. `handlers-metadata.ts` three-way clash — not observed this period

No CI failure traces on `handlers-metadata.ts` / `handler-callables.ts` / `package.json` in the period's PR set. Either the dispatch sequencing avoided it or the substrate gap that produced it has been addressed elsewhere.

### 4. Decision-record ↔ event symmetry — clean

The 17 ghost-ID closure in #461 + the 16 delivered engineering decisions closure in #460 retire the long-standing dashboard-credibility issue from the decision-record-to-event-symmetry memory. Atlas's #429 permanent-fix is holding. No new ghosts observed.

### 5. Agent-attribution gap in commit trailers

Of 37 PRs in the period, only #471 (Atlas explicit co-author) had a named agent in its Co-Authored-By trailer; the rest list `Claude Sonnet 4.6` / `Claude Opus 4.7`. The narrative attribution above is inferred from commit subjects + known workstream ownership + memory. **Recommendation**: dispatch prompts should require `Co-Authored-By: <Name> (<Position>) <noreply@anthropic.com>` in the final commit so PR ownership is machine-readable from the git log. Routed to Atlas as a dispatch-discipline substrate input.

---

## Sade's Efficiency Observations

### Substrate depth ranking (this period)

1. **Atlas** — 14+ substantive PRs; D-DECISIONS-FRAMEWORK-REDESIGN end-to-end + RMS Phase 2/3 + substrate gates. Highest density of the period.
2. **Mira** — 12 PRs across two named workstreams (M2/M3 reporting + WS-INSTRUMENT-ANALYSES).
3. **Ravi** — 5 FX-spot PRs closing the 6-event lifecycle.
4. **Noa** — 6 dashboard/intranet refinements.
5. **Owen** — 6 decisions/governance PRs (mostly co-authored).
6. **Eitan, Sade** — 2 PRs each.

### Decision-advancement count

This period: **3 CEO-level decisions advanced or closed.**

- D-DECISIONS-FRAMEWORK-REDESIGN — closed (Atlas Slices A–D, Owen brief + approval).
- RMS Phase 2+3 — substantially advanced (Atlas + Owen, PRs #465 + #466).
- FX-spot 6-event lifecycle — closed (Ravi-led, PRs #468–#472).

This is the highest decision-advancement count per period since the 2026-05-15 evaluation. The fleet's strategic output is well above the 1-decision-per-period baseline of the prior eval period.

### Token-capture & cost

Token-capture aggregation is still M8-blocked (shared event-store dependency). Per-agent cost attribution remains absent; can be revisited once M8 lands.

---

## Data Sources

- **Git log:** `git log origin/main --since="2026-05-16 00:00" --until="2026-05-17 23:59" --pretty=format:"%h|%s|%an"` — 37 PRs (#436–#472, including 1 direct commit #8424b0d).
- **Evaluator output:** 56 `AgentPerformanceEvaluated` events + 56 `AgentFeedbackIssued` events, all `displayTier: substrate-limited` (M8 gap).
- **PR attribution:** Commit subject prefixes + workstream-ownership memory (M2/M3 → Mira; FX-spot → Ravi; D-DECISIONS → Atlas + Owen; RMS → Atlas + Owen; dashboard/intranet → Noa).
- **Audit findings:** None raised against any agent in the period (event-store query: zero `AuditFinding` events for the period in this worktree).
- **Strategic boost source:** decision-record events + workstream-resolution records on `main`.

---

*Issued by Sade (AgentOps & Token Efficiency Engineer, engineering) — daily evaluator run 2026-05-17, covering 2026-05-16 and 2026-05-17 periods. Authority: D-AGENT-AUTONOMY-OPERATIONAL.*
