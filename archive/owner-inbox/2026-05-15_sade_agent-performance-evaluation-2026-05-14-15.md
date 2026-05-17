---
title: Agent Performance Evaluation — 2026-05-14/15 period, 9 agents
author: Sade (AgentOps & Token Efficiency Engineer, engineering)
date: 2026-05-15
summary: 9 agents evaluated for the 2026-05-14/15 period. Atlas (Core Banking Platform Architect) is the sole "exceeds" performer. 4 agents received CI violation penalties. All agents achieved 100% delivery.
decision-required: false
---

# Agent Performance Evaluation — 2026-05-14/15 Period

**Evaluated by:** Sade (AgentOps & Token Efficiency Engineer, engineering)  
**Evaluation period:** 2026-05-14 (covering PRs #387–#395 merged 2026-05-14/15)  
**Authority:** D-AGENT-AUTONOMY-OPERATIONAL  
**Events emitted:** AgentPerformanceEvaluated × 9 + AgentFeedbackIssued × 9

---

## Fleet Summary Table

| Agent | Position | PR | Delivery | Quality | Strategic | Overall | Tier |
|-------|----------|----|----------|---------|-----------|---------|------|
| Atlas (Core Banking Platform Architect) | engineering | #388 | 100% | 100% | 30% | **86%** | **exceeds** |
| Iris (Information Officer) | governance | #387 | 100% | 100% | 20% | **84%** | meets |
| Zara (Chief Compliance Officer) | governance | #389 | 100% | 100% | 20% | **84%** | meets |
| Mira (Compliance / RegTech Engineer) | engineering | #390 | 100% | 100% | 20% | **84%** | meets |
| Anya (Data / Analytics Engineer) | engineering | #394 | 100% | 100% | 20% | **84%** | meets |
| Sade (AgentOps & Token Efficiency Engineer) | engineering | #391 | 100% | 90% | 20% | **80%** | meets |
| Imani (Legal-as-Code Engineer) | engineering | #392 | 100% | 90% | 20% | **80%** | meets |
| Noa (Intranet Product Owner & UI Architect) | engineering | #393 | 100% | 90% | 20% | **80%** | meets |
| Ravi (Treasury / ALM Engineer) | engineering | #395 | 100% | 90% | 20% | **80%** | meets |

**Scoring weights:** Delivery 40% · Quality 40% · Strategic 20%

---

## Top Performer

**Atlas (Core Banking Platform Architect, engineering)** — 86% overall, tier: **exceeds**.

Atlas is the sole agent to exceed expectations in this period. The margin above the "meets" band comes from advancing a CEO-level decision (D-POLICY-DOCUMENT-HOME Option C) in addition to delivering PR #388 (policy register backfill + Document-Home scaffold commit). Advancing a decision adds 10 percentage points to the strategic score, lifting Atlas's overall from 84% to 86% — just over the 85% exceeds threshold. Clean merge with no event-types/index.ts conflict is a secondary contributor.

---

## Agents Meeting Expectations

**Iris (Information Officer, governance), Zara (Chief Compliance Officer, governance), Mira (Compliance / RegTech Engineer, engineering), Anya (Data / Analytics Engineer, engineering)** — all 84% overall, clean merges, zero violations.

These four agents delivered their PRs without conflict and with full operational discipline. The 16% gap to "exceeds" is purely strategic: none advanced a CEO-level decision or progressed a named workstream in the period. Their strategic score of 20% (0.2 × 1 PR) is the floor for any agent that delivers one PR.

**Sade (AgentOps & Token Efficiency Engineer, engineering), Imani (Legal-as-Code Engineer, engineering), Noa (Intranet Product Owner & UI Architect, engineering), Ravi (Treasury / ALM Engineer, engineering)** — all 80% overall, 1 CI violation each.

Each of these agents had an `event-types/index.ts` conflict requiring manual rebase before their PR could merge (PRs #391, #392, #393, #395). The 1-violation quality penalty (−10 percentage points on quality, weighted at 40%) costs 4 percentage points on the overall score relative to the clean cohort.

---

## Agents Needing Improvement

None in this period. All 9 evaluated agents are in the "meets" or "exceeds" tier.

---

## Sade's Efficiency Observations

### 1. Substrate output per PR

Ranked by substrate depth (complexity of deliverable per PR):

1. **Atlas** — policy-document-home scaffold + policy register backfill + decision advanced. Highest substrate density.
2. **Mira** — 5 policies in a single PR (#390). Second-highest per-PR volume.
3. **Sade** — 3 new event types + handler scaffolding + dashboard tile (#391).
4. **Ravi** — FTP attribution engine with 2 new event types + projection (#395).
5. **Imani** — event-trigger bus + legal-entity-tree (joint PR, #392).
6. **Noa** — 3 intranet typed events (#393).
7. **Anya** — semantic-layer quantity registry, 20 quantities (#394).
8. **Zara** — RMCP v1 scaffold (#389).
9. **Iris** — PAIA Manual v1 scaffold (#387).

Governance agents (Iris, Zara) produce statutory compliance documents; their output is not thinner than engineering agents — it binds at commencement-of-trading. The scaffold-vs-complete distinction matters: both are first-run scaffolds, not complete documents.

### 2. Rebase overhead cohort

Four agents (Sade, Imani, Noa, Ravi) shared a `event-types/index.ts` conflict. This is a known structural problem: every new event-type family must append a line to this barrel file. With 4+ agents running in parallel, conflict is nearly guaranteed.

**Root cause:** The `event-types/index.ts` barrel is a serialisation bottleneck. Any two parallel dispatches that add event types will collide.

**Recommendation (medium priority):** Consider a dynamic barrel generator (e.g. a glob-based auto-export or a code-generation step in CI) that eliminates the hand-edited barrel. Until that lands, dispatchers should sequence event-type-adding PRs serially or reserve a single "event-type catch-up" PR per batch.

**Token cost of manual rebase:** Each manual rebase requires the dispatching agent (Scrooge) to read the conflict, understand context, and re-push. Estimated overhead per conflict: ~15-30 min of session time. Four conflicts in one period = up to 2 hours of effective session time lost.

### 3. Decision-advancement gap

8 of 9 agents delivered PRs with no decision advanced. Decision advancement is the primary lever for reaching "exceeds" (adds 10+ points to strategic score). Agents with clear open decisions in their mandate should be dispatched with explicit decision IDs in their brief, not left to discover them via ambient context.

**Recommendation:** Future dispatches for Zara (CCO), Mira (RegTech), Helena (CRO), Owen (CoSec) should explicitly reference open decision IDs in the dispatch brief where the deliverable is intended to close a decision.

### 4. Idempotency

The evaluation script (`scripts/run-performance-evaluation.ts`) is idempotent. Re-running with `--force` re-emits events. The existing `scripts/run-performance-evaluations.ts` (plural) is the daily harness that reads metrics from the live event store; this point-in-time script is for the manual CEO-triggered run only.

---

## Data Sources

- **Git log:** `git log origin/main --oneline --since="2026-05-14" --until="2026-05-16"`
- **PR attribution:** PR titles and co-author attribution for PRs #387–#395
- **CI violations:** Dispatch brief §3 attribution for `event-types/index.ts` conflicts in PRs #391, #392, #393, #395
- **Audit findings:** None raised against any evaluated agent for the period (event store query: zero `AuditFinding` events for this period attributed to the evaluated agents)
- **Events emitted:** 18 events total — `AgentPerformanceEvaluated` × 9 + `AgentFeedbackIssued` × 9, all written to the local event store

---

*Issued by Sade (AgentOps & Token Efficiency Engineer, engineering) — manual CEO-triggered evaluation run, 2026-05-15.*
