---
title: "Agent performance evaluation — Wave 1 synthesis (2026-05-13 to 2026-05-15)"
author: Scrooge (Chief of Staff)
date: 2026-05-16
summary: Synthesis of 84 individual daily performance-feedback files covering 28 agents over three evaluation days. Fleet is healthy. One systemic substrate friction identified. Individual files moved to actioned/.
decision-required: false
---

# Agent Performance Evaluation — Wave 1 Synthesis

**Period:** 2026-05-13 – 2026-05-15  
**Files synthesised:** 84 individual `sade_perf-feedback-<agent>.md` files (28 agents × 3 days)  
**Canonical reference:** [`2026-05-15_sade_agent-performance-evaluation-2026-05-14-15.md`](2026-05-15_sade_agent-performance-evaluation-2026-05-14-15.md)  
**Authority:** D-AGENT-AUTONOMY-OPERATIONAL

---

## Fleet Health Summary

| Metric | Value |
|--------|-------|
| Agents evaluated (most recent batch, May 14/15) | 9 |
| Delivery rate (most recent batch) | **100%** |
| Agents tier "exceeds" | 1 (Atlas) |
| Agents tier "meets" | 8 |
| Agents tier "needs improvement" | 0 |

**Overall fleet status: healthy.** All evaluated agents in the May 14/15 batch achieved 100% delivery. No agents are currently in "needs improvement" tier.

---

## Top Performer

**Atlas (Core Banking Platform Architect, engineering)** — 86%, tier: exceeds. Advanced D-POLICY-DOCUMENT-HOME in addition to delivering PR #388 (policy register backfill). The only agent to cross the 85% exceeds threshold in the period.

---

## Systemic Friction: `event-types/index.ts` Barrel Conflicts

Four agents (Sade, Imani, Noa, Ravi) each incurred a −10% quality penalty from an `event-types/index.ts` merge conflict requiring manual rebase before their PRs could merge (PRs #391–#393, #395).

This is the **handlers-metadata three-way clash pattern** (feedback memory: `feedback_handlers_metadata_three_way_clash.md`). When multiple agents add event types in parallel, the shared barrel file always conflicts. The penalty is 4 percentage points off the overall score for each affected agent.

**Routing:** Atlas to note as a substrate-sprint roadmap item — a shared barrel auto-merge tool or a dedicated event-type registration event (rather than a static export barrel) would eliminate this class of conflict. Not urgent; affects quality score, not delivery.

---

## Token-Capture Infrastructure Status

The per-run token capture infrastructure is **already implemented** in `runtime/claude.ts` (lines 187–215). `generateNarrative` emits `TokenUsageRecorded` after every Claude API call when `meta.runId` and `meta.agent` are provided — all agent handlers that use `tryGenerateNarrative` already pass these (confirmed in `runtime/agents/anya-projection-drift.ts` and peers).

The gap Sade flagged in her substrate-gap inventory is the **shared event store**: agents run in isolated worktrees and their `TokenUsageRecorded` events write to local worktree stores, not to the central store. Central aggregation requires M8 (shared event store / Azure). No new code needed today; this is a deployment architecture gap, not a harness gap.

**Status:** implementation complete; blocked on M8. No dispatch needed.

---

## Disposition

- 84 individual `sade_perf-feedback-<agent>.md` files moved to `Owner Inbox/actioned/` — this synthesis is the canonical record.
- The May 15 consolidated report (`2026-05-15_sade_agent-performance-evaluation-2026-05-14-15.md`) remains in Owner Inbox as the formal period-close artefact.
- `event-types/index.ts` conflict pattern routed to Atlas as roadmap input.
