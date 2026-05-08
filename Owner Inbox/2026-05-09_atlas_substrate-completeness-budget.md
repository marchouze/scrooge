---
title: Substrate-completeness budget — unit, rate, options for closing the gap to autonomy
author: Atlas
date: 2026-05-09
summary: Companion to S8 (agent-runtime substrate spec). Proposes a unit of measure (Anthropic-token-spend within Marc-attention-bounded sessions), names today's consumption rate from the 2026-05-08 landing, and offers three named options (Lean / Targeted / Aggressive) for budgeting the remaining substrate work to close gaps that block fully-autonomous operation.
decision-required: false
maps-to-decision-id: S7
note: Brief written 2026-05-08 in parallel with CEO approval of curated S7 via dashboard /api/decide at 09:21:56Z. Duplicate ID retired; substantive analysis preserved as supporting artefact for resolved S7. Recommendation (Targeted: ≈3 sessions/week, ≤4M tokens/session, ordered gap-closure Vera #13 → A2.2 Phase 1 cutover → Nadia methodology → backtest harness → pre-trade gateway) stands as the source-of-record for the budget Atlas operates against.
---

# Substrate-completeness budget — unit, rate, options for closing the gap to autonomy

**Author:** Atlas (Core banking platform architect)
**Reports through:** Devon (COO)
**Pair brief:** S8 — `Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md` (the specification of *what* substrate exists). This brief is S7 — *how much* substrate work remains and what it costs to close.
**Date:** 2026-05-09
**For:** Marc (CEO)
**Authority:**
- `D-AGENT-RUNTIME-AUTHORIZE` (resolved 2026-05-07; A0–A3 build authorised)
- `D-FLEET-ROLLOUT-SEQUENCING` (resolved 2026-05-08; first-three handlers + parallel build sequence)
- `D-A22-RETIRE-LEGACY` Phase 1 (resolved 2026-05-08; gating-window discipline established)
- Principle 7 (Autonomous by default; humans oversee the residual) — CLAUDE.md, set 2026-05-07
- Operating-model note "Steady-state vs current substrate" — CLAUDE.md
**Status:** Specification-only. Approval of a budget shape; no further code changes commit on this brief alone. The budget governs what subsequent slices look like.

> **Derivation note (Principle 6 — downward).** This brief sits at the *standard* layer: the budget is a specification of how the substrate-build standard consumes the bank's two real build-phase resources (Marc's attention; Anthropic API spend). It cites the operating-model section of CLAUDE.md, the substrate-state runs of 2026-05-07 and 2026-05-08, the fleet-rollout sequencing of 2026-05-08, and the open-workstreams memory at session-end 2026-05-08. No new principle-level substance.

---

## 1. Why a budget exists at all

Principle 7 fixes the destination: the bank is autonomous by default and humans oversee the residual. The bank is not yet at that destination. The substrate-state runs name the gap inventory (`Owner Inbox/2026-05-08_atlas_substrate-state.md` §"Substrate gaps"; expanded in `Owner Inbox/2026-05-08_atlas-scrooge_fleet-rollout-sequencing.md` §7 with twelve numbered items). Each gap is closed by a specific slice of build work. Each slice consumes the two real build-phase resources CLAUDE.md names:

1. **Marc's attention.** The binding human resource. Every slice that lands as a CEO-decision-required brief, every escalation that surfaces a gap, every Phase-2 confirmation in a multi-phase cutover — all consume Marc-attention.
2. **Anthropic API spend.** The largest current real cost. Every slice authored, every recon pass run with narrative generation, every agent run that calls Claude — all consume tokens billable to the bank.

The substrate is not optional tooling — the bank does not become AI-driven without it. Per CLAUDE.md's operating-model section, "the engineering substrate, real recon harnesses, real event store, real persona specs" are real engineering work *now*; the obligations bind at licence-day, but the substrate must be production-grade by then. Principle 7 makes the runtime "foundational substrate alongside the event store (P1), obligations register (P2), and IaC (P3)." A budget exists because closing the gaps is not free, the resources to close them are bounded, and Marc has to choose pace.

Without a budget, the failure mode is one of two extremes:

- **Under-spend.** The substrate stalls between the current state (handlers and dispatchers running, but on a coupling that requires a parent process to tick the bus and on cron files that drift independently) and the steady-state. Agents continue to operate in degraded mode; recon catches drift but cannot close it; gap inventory grows because new slices reveal new gaps faster than old ones close.
- **Over-spend.** Token spend or attention spend runs ahead of gap-closure rate. Marc's review queue saturates; LLM cost compounds; sessions land code that the next session has to revert because the integration-test surface was not covered.

The S8 brief specifies what the substrate *is*. This brief specifies how much we spend to finish it, in what units, at what rate, and with which gaps closed in which order. Approving S8 without S7 leaves pace undefined. Approving both gives Atlas a unit-economics frame to bring back at every subsequent decision point.

---

## 2. Unit of measure

Three candidate units. Each measures a different thing.

### 2.1 Sessions

A "session" is a Scrooge-coordinated stretch of attention from Marc, ending when Marc steps away. Today this is the operational unit Scrooge bills against. Sessions are countable and they correlate with deliverables (a session typically produces between zero and a dozen Owner Inbox files).

**Strengths.** Visible to Marc; aligns with calendar; easy to retrospect.

**Weaknesses.** Inconsistent in duration (a 30-minute session and a 6-hour session both count as one). Does not capture spend on sessions that ran heavy because of Claude-token consumption. Does not capture work done by autonomous agent runs *outside* sessions — and that is the work Principle 7 is asking the budget to grow into.

### 2.2 Agent runs

An "agent run" is a single invocation of an agent's handler — a `runAgent(...)` call landing an `AgentRunStarted` / `AgentRunCompleted` pair in the event store. Today the substrate-state shows ~28 handlers across 24 personas (`project_open_workstreams_2026_05_08.md`); a fleet-cycle includes 14+ scheduled runs from the daily and weekly handlers plus event-driven follow-ons. An agent-run unit naturally aligns to Principle 7 because Principle 7 *is* the agent-run discipline.

**Strengths.** Aligns to substrate intent. Countable from the event store directly. Asymptotes well: the steady-state is "X agent runs per fleet-cycle, every one of them autonomous." A budget in agent runs is a budget toward the destination.

**Weaknesses.** Today most slices that land are *substrate code* (PRs to `prototype/platform/`), not *agent runs* against the substrate. A budget in agent runs measures the destination, not the path. It also does not capture cost — a recon run with narrative generation costs ~10× a recon run without, but is one agent run either way.

### 2.3 Anthropic token spend

Total Anthropic tokens billed to the bank's account, per unit time. The 2026-05-07 substrate-state notes Claude integration "rolled out" across all seven runtime handlers; every narrative pass calls the API with a cached persona-prompt prefix and a per-run state suffix. The 2026-05-08 landing — 9 PRs merged, ~28 handlers, 9 recon pipelines — was a single session of ≈4M tokens-spent, dominated by the substrate-build slices themselves rather than by the runtime narrative passes.

**Strengths.** It is the actual binding resource. CLAUDE.md names it as the largest current real cost. It captures *both* substrate-build authorship (heavy slice → heavy spend) *and* runtime narrative generation (light slice → light spend per run, multiplied by handler count). The unit is comparable across both kinds of work.

**Weaknesses.** Per-token cost depends on model choice (Opus vs Sonnet vs Haiku). Cache-hit rate moves the effective cost. Marc does not see token spend in real time today — the dashboard does not yet surface it.

### 2.4 The proposal — token-spend, with sessions as the bounding envelope

Use **Anthropic token spend per session** as the unit. Sessions remain the natural attention-pacing envelope (a session is Marc opening the Bank). Token spend within the session captures the actual binding cost. The two combine as a budget pair: *N sessions per week, ≤K tokens per session*.

This pair is:

- **Real-cost-tracking.** Token spend is the bank's largest real expense in the build phase.
- **Attention-bounded.** Sessions cap the rate at which Marc can review and decide.
- **Gap-closure-aligned.** Each session is asked to close named substrate gaps; success is measured in gaps-closed not tokens-spent, but tokens-spent is the unit that constrains how many gaps can land per session.

The dashboard does not surface token spend today — that is a substrate gap (catalogue it as `New-T1`, owner Atlas, closes when the dashboard projection adds a `tokens-spent-per-session` reading derived from the Anthropic console export). For now, Atlas estimates token spend per session from the session's commit volume and the count of narrative-generating runs invoked; a ±25% margin is acceptable.

---

## 3. Today's consumption rate

The 2026-05-08 session is the cleanest reference point because the open-workstreams memory recorded its outputs precisely:

| Output | Count | Source |
|---|---|---|
| PRs merged | 9 | `project_open_workstreams_2026_05_08.md` |
| Persona files with operating spec | 28 / 28 | `Owner Inbox/2026-05-08_atlas_substrate-state.md` |
| Runtime handlers registered | ~28 across 24 personas | `project_open_workstreams_2026_05_08.md` |
| Recon pipelines live | 9 (3 self-paying — caught real drift on first run) | same |
| Substrate components landed | A1.1, A1.2, A2.1, A2.2, A3.1, A3.2 + model-registry skeleton | same |

That is one session. The substrate-state at the start of 2026-05-08 had A0 frozen, ~14 runtime handlers, 4 recon pipelines (the citation gate, the dashboard recon, the prose-duplication recon, the runtime-handler-sync recon). The end of the session had everything in the table above. The session closed 4 of the 12 substrate-gap rows in the 2026-05-08 sequencing brief and surfaced 3 new ones (`Owner Inbox/2026-05-09_atlas_a22-dispatcher-retire-legacy-spec.md` §7, items New-1 through New-3).

**Token estimate for that session: ≈4M tokens.** This is a back-of-envelope from the commit volume (9 PRs × ~3 round-trips per PR including review × ~150K tokens per round-trip including cache) plus 14 narrative-generating agent runs at ~50K tokens each. The estimate is ±25%; the actual is in the Anthropic console export Atlas does not have direct access to.

**Cadence today: ~3 sessions/week.** The session distribution is event-triggered rather than scheduled — Marc opens the bank when he has attention to spend on it. Three is the observed mean over the trailing three weeks.

**Combined consumption rate: ~12M tokens/week, ~36 PRs/week, ~12 substrate-gap closures/week** (with 3–6 new gaps surfacing per week as work reveals them). Of those gap closures, ~50% are substrate-code slices (Atlas + Senna + Vera authorship); ~50% are agent-run slices (handler authorship, recon pipeline authorship, persona-spec rollout).

**Gap-closure-rate observation.** The 2026-05-08 session closed 4 of 12 named substrate gaps in one day. At that rate, the inventory would clear in ~3 sessions — but that is a misleading projection. New gaps surface at roughly the same rate as old ones close, because each closed slice exposes the next one (closing the cross-process bus surfaced the cross-workflow bus; closing the agent registry surfaced the auto-derived gap register). The gap-closure rate is therefore the right unit, but the *terminal* state is not "zero gaps" — it is "no gap blocks an autonomous-by-default agent run."

The terminal-state condition for the substrate-completeness budget is, precisely: **every persona in `/Team/` has a registered handler that runs on its declared cadence in `runtime/handlers-metadata.ts`, emits decisions through the typed channel, escalates through `AgentEscalation`, and clears the recon pipelines green over a full fleet-cycle.** That is the budget's exit condition — not gap count.

---

## 4. Three named options

Each option is a (unit, rate, ceiling, ordering) tuple. Each closes the same terminal-state gap but does so at a different cost profile.

### 4.1 Option A — Lean (~2 sessions/week, ≤2M tokens/session)

**Profile.** Halve the observed cadence. Halve the per-session ceiling. Sessions are short, narrowly-scoped, single-slice. Each session lands one gap; the next gap waits.

**Time to terminal state.** At ~12 substrate-gaps remaining (the 6 substrate gaps still open from the 2026-05-08 sequencing brief plus the 6 net-new gaps the 2026-05-09 dispatcher-retire and other slices surface), and a closure rate of 1 gap per session × 2 sessions/week = 2 gaps/week, terminal state reaches in ~6 weeks of agent-time.

**Cost.** ~4M tokens/week. ~32M tokens to terminal state. At observed unit cost (Atlas does not see the per-token rate; estimate from the Anthropic enterprise-tier ranges: ~$3 per million input + ~$15 per million output, cache-hit rate ~50%) — order-of-magnitude USD low-three-figures total.

**Strengths.** Predictable. Marc's attention bounded. No oversaturation.

**Weaknesses.** Under-runs the licence-day readiness gate. The pre-licence go-live readiness gate (Saskia's substrate, co-owned with Rashida and Devon — CLAUDE.md operating-model section) requires substrate-complete *before* the gate lights green. At Lean cadence the substrate finishes after the gate is needed. The licence-day timeline is in agent-cadence not weeks (per CLAUDE.md "Timelines are agent-time, not weeks") so this is not a wall-clock fail — it is a sequencing fail with the gate.

**Recommended only if.** Marc's attention budget is constrained for the next ~2 months by something outside the bank (other CEO duties, travel, family). In that case Lean is correct; the bank pauses some non-substrate slices to preserve substrate cadence within the 2 sessions.

### 4.2 Option B — Targeted (~3 sessions/week, ≤4M tokens/session)

**Profile.** Maintain the observed cadence. Cap the per-session ceiling at the 2026-05-08 high-water mark. Sessions land 2–4 substrate gaps each. Atlas + Scrooge enforce the ceiling — if a session is approaching 4M tokens before all in-flight slices land, the remaining slices defer to the next session.

**Time to terminal state.** At 2–4 gaps/session × 3 sessions/week = 6–12 gaps/week, terminal state reaches in ~2 weeks of agent-time. The variance is dominated by which gaps surface in which order — a session that lands the auto-derived substrate-gap register (Vera Wave-4 #13) closes the gap and *also* makes subsequent gap-discovery cheap; a session that lands cross-workflow event bus does not arrive at all in the build phase (it is M8, post-licence).

**Cost.** ~12M tokens/week. ~24M tokens to terminal state. Lower than Lean's *total* because the work compounds: closing the gap-register first means subsequent sessions need less hand-curation.

**Strengths.** Lands substrate-complete inside the licence-readiness gate's planning horizon. Preserves the observed cadence which Marc has already calibrated his attention to. Caps per-session spend at a known boundary.

**Weaknesses.** Requires Atlas to enforce the per-session ceiling, which is hand-estimated until the dashboard surfaces token spend. A session that *under*-runs the ceiling is fine; a session that runs ~50% over — say 6M — is a finding, but not a breach (the ceiling is a target, not a hard cap).

**Recommended ordering of remaining gaps under Targeted.**

| Order | Gap | Why this position | Source |
|---|---|---|---|
| 1 | Vera Wave-4 #13 — `parallel-dispatch-divergence` recon | Gates `D-A22-RETIRE-LEGACY` Phase 2; once green, every subsequent gap-closure is auto-detected | `project_open_workstreams_2026_05_08.md` substrate gaps |
| 2 | A2.2 Phase 1 cutover code (`runtime/run.ts` legacy-shadow flag + `LegacyFanoutShadowed` event) | Unblocks Phase 2 path of an already-approved decision; reversible in one commit | `Owner Inbox/2026-05-09_atlas_a22-dispatcher-retire-legacy-spec.md` §3.1 |
| 3 | Validation-methodology authoring | Nadia's first methodology spec — gates her first `ModelValidationApproved` event; without it the second-line is structurally incomplete | `project_open_workstreams_2026_05_08.md` |
| 4 | Backtest harness | Rohan + Atlas; gates real model validation; chained with #3 | same |
| 5 | Pre-trade gateway envelope-aware enforcement (Kai-side) | Pre-licence target; Saskia's readiness-gate co-dependency | same |
| 6 | Stale decision-required briefs hygiene | Cheap; Scrooge `inbox-hygiene` slice that the human-attention budget would otherwise re-pay every session | same |
| 7 | Auto-derived substrate-gap register (Vera Wave-4 #13's broader form) | Closes the meta-gap that today's gap-list is hand-curated; once it lands, this brief's update cycle is also automated | `Owner Inbox/2026-05-08_atlas_substrate-state.md` §"Provenance" |

Items 1–5 are the substrate-complete critical path. Items 6–7 are hygiene that compounds — every session not run against them re-pays their cost.

### 4.3 Option C — Aggressive (~5 sessions/week, ≤6M tokens/session)

**Profile.** Increase the cadence to ~daily. Raise the per-session ceiling 50% above the 2026-05-08 high-water mark. Treat the build phase as a sprint to substrate-complete; spend whatever attention and tokens the sprint requires.

**Time to terminal state.** At 4–8 gaps/session × 5 sessions/week = 20–40 gaps/week, terminal state reaches in ~1 week of agent-time. The variance is dominated by gap-discovery rate at this pace — the sprint outpaces gap-surfacing for a few days, then hits a wall when a slice surfaces 3+ new gaps that need their own slices.

**Cost.** ~30M tokens/week. ~30M tokens to terminal state, but front-loaded into one calendar week. At the same unit cost estimate, order-of-magnitude USD mid-three-figures for the sprint.

**Strengths.** Compresses the substrate-build into a single visible push. Lower total spend than Lean because compounding is steeper. Easier to retrospect — one sprint, one outcome.

**Weaknesses.** Marc-attention saturation. Five sessions/week of substrate-build is a heavy ask if Marc's calendar is not pre-cleared for it; a missed session converts into a Lean week with the higher per-session ceiling, which is the worst combination. Token spend is front-loaded into a single week's invoice. Recon-coverage lags behind — the 9 recon pipelines today catch drift on a daily cadence; at 5 substrate-build sessions/week, drift has fewer hours to accumulate before it is reverted, but also fewer hours to be caught.

**Recommended only if.** A specific licence-day readiness deadline crystallises in agent-time (Saskia's gate lights up; SARB sets a regulator-engagement date; counsel binds a date for licence application) and the budget needs to compress to fit. Otherwise the Aggressive profile front-loads spend without proportionate gap-closure.

### 4.4 Option comparison

| Profile | Cadence | Per-session ceiling | Time to terminal state | Total tokens | Risk profile |
|---|---|---|---|---|---|
| Lean | 2 sessions/week | ≤2M tokens | ~6 weeks | ~32M | Under-runs licence-day readiness gate sequencing |
| Targeted | 3 sessions/week | ≤4M tokens | ~2 weeks | ~24M | Requires Atlas to enforce ceiling; tractable |
| Aggressive | 5 sessions/week | ≤6M tokens | ~1 week | ~30M | Marc-attention saturation; front-loaded spend |

---

## 5. Recommendation

**Adopt Option B — Targeted.**

- **Unit:** Anthropic token spend per session, with sessions as the bounding envelope.
- **Rate:** ~3 sessions/week.
- **Ceiling:** ≤4M tokens/session (the observed 2026-05-08 high-water mark, used as a target rather than a hard cap; sessions running ~50% over are a finding but not a breach).
- **Ordering:** As §4.2 — Vera Wave-4 #13 first; A2.2 Phase 1 cutover code second; Nadia methodology third; backtest harness fourth; pre-trade gateway envelope fifth; hygiene + meta-gap-register last.

The reasoning is in §4.2: Targeted matches the observed cadence Marc has already calibrated to, lands substrate-complete inside the licence-readiness gate's planning horizon, and orders the gap-closures so each one compounds the next. Lean under-runs the gate. Aggressive front-loads spend without gap-closure proportionate.

The recommendation includes one substrate addition Atlas commits to as part of accepting the budget: surface the running session's token spend on the dashboard (gap `New-T1` named in §2.4). Without that surface, the ceiling is hand-estimated. The slice is small — one new derived projection over the Anthropic console export the bank's account already produces — and lands inside Targeted's first session.

---

## 6. Substrate gaps the budget cannot close

Even at Targeted cadence, the following gaps are **not** closed by spending more sessions or tokens. They are named here because hiding them under a budget conversation is exactly the failure CLAUDE.md's operating-model section forbids ("Every run produces both the deliverable *and* surfaces the substrate gap that prevented a fully-autonomous run — the gap is a roadmap item, not something to hide").

### 6.1 Cross-workflow event bus (gap #4 in the 2026-05-08 sequencing brief)

**What it is.** Today's bus dispatches in-process within a single GitHub Actions workflow. Cross-workflow dispatch — parent run in workflow A, subscriber needs to fire in workflow B — requires Azure Event Hubs + Service Bus. It is M8 cloud-lift work.

**Why the budget cannot close it.** It is gated on the cloud-lift phase, which is post-licence. No amount of build-phase token spend brings it forward. The decision to defer is in CLAUDE.md's "full local build first, then migrate to cloud as a single coherent phase" implementation sequence.

**Operational consequence today.** Event-driven handlers must be co-scheduled with their parent in the same workflow, or converted to scheduled. The ceiling is preserved by the A2.2 dispatcher cutover (`Owner Inbox/2026-05-09_atlas_a22-dispatcher-retire-legacy-spec.md` §4.4 first bullet).

### 6.2 Permission-policy enforcement gate (`BANK_PERMISSION_GATE_ENABLED`)

**What it is.** A1.2 lands the identity issuer and permission-policy publisher, but the event-store gate that *enforces* policy violations is feature-flagged off (`project_open_workstreams_2026_05_08.md`). Today every agent can append every event type — the policy is published, not enforced.

**Why the budget cannot close it (yet).** The gate must enable simultaneously across the fleet, and the fleet is still being assembled. Enabling the gate before the last handler's permission policy is correct produces false-positive rejections; enabling it after the last handler is correct is the decision to flip the flag. That flag-flip is one slice — but it gates on every other handler being in. Per Targeted ordering, this slice lands as the *last* substrate slice before terminal state, not first.

**Operational consequence today.** The `Vera read-only carve-out` (substrate spec §3.1) and the per-agent permission policy are published as events but advisory — Vera's recon would catch a violation, but the substrate doesn't reject one. The risk is contained in the build phase because all current actors are bank-owned; risk would surface at licence-day if the gate were still off.

### 6.3 Hardening conditions §5.1 / §5.2 on the Neon event store (gap #12 in the 2026-05-08 sequencing brief)

**What it is.** The build-phase event store runs on Neon Postgres under exception `TM-NEON-EVENT-STORE-001` (Owen's substrate-exception register). The exception's hardening conditions — role downgrade to SELECT+INSERT, IP allowlist — are deferred *while events remain non-sensitive*.

**Why the budget cannot close it (yet).** The hardening is conditioned on sensitive-data events being introduced. Until the customer-onboarding flow lands (commencement of trading, post-licence), the event corpus is genuinely non-sensitive (substrate-state, recon findings, governance prep). Closing the conditions now is premature; they are slated for the slice that introduces the first sensitive-data event type.

**Operational consequence today.** None — the exception is registered, threat-modelled, and time-boxed. The risk surfaces if a domain-engineering slice introduces a sensitive event type without first triggering the hardening procedure. That trigger is itself an audit pipeline (planned, owner Vera).

### 6.4 The auto-derived substrate-gap register (gap #7 in the 2026-05-08 sequencing brief — Vera Wave-4 #13)

**What it is.** This brief's gap inventory is hand-curated. The auto-derived register reads gap entries from substrate-state event streams and produces the canonical list — the version of this brief's §6 that survives Atlas not being in the room.

**Why the budget cannot fully close it.** The register *substrate* lands in Targeted's slice ordering (§4.2 item 7). But the *populating* — every substrate-emitted gap typed as a `SubstrateGap` event with the right citations — is a discipline that retrofits over time as new gaps surface. The budget closes the substrate; the discipline closes the operational practice; the practice closes only with continued usage.

**Operational consequence today.** Gap inventory survival depends on Atlas's substrate-state run repeating the curation each week. A missed run loses gap-rows. The recon-pipeline #13 (planned) detects loss; closing the loop fully needs the typed `SubstrateGap` event to land before Atlas next runs.

### 6.5 Marc-attention surface for the budget itself

**What it is.** This brief proposes a budget. The budget needs a *surface* — a place in the dashboard where Marc sees consumption-vs-budget at a glance. Today the dashboard surfaces escalations, fleet status, and decision drill-down (A3.2). It does not surface session-cadence-vs-target, token-spend-vs-ceiling, or gap-closure-rate.

**Why the budget cannot close it.** The budget is the *input* to that surface; the surface is itself a substrate slice. It is a small slice — three derived projections over the existing Anthropic console export and the existing `CeoDecision` event stream — but it is a slice, not a side-effect of approving the budget.

**Operational consequence today.** Atlas reports consumption-vs-budget in plain prose at each substrate-state run until the surface lands. The slice is not in the §4.2 critical path (it is hygiene); under Targeted it lands in week 2.

---

## 7. Procedure binding (Principle 6 — upward)

The budget binds to:

- **`Procedures/by-policy/change-management.md`** — owner Atlas. Source policy: Change Management Policy. Each substrate slice that lands under the budget is a change-managed event tuple (`ChangeRequestSubmitted` / `ChangeApproved` / `ChangeImplemented`).
- **`Procedures/by-policy/agent-runtime-deploy.md`** (planned, per `Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md` §7) — owner Atlas. Each substrate-component slice in the §4.2 ordering deploys under this procedure.
- **`Procedures/by-policy/event-schema-evolution.md`** (planned) — owner Atlas. Slices that introduce or retire event types (Vera #13's `SubstrateGap`; the 2026-05-09 brief's `LegacyFanoutShadowed`) follow this procedure.
- **`Procedures/by-policy/budget-management.md`** (new, planned, owner Atlas + Camille). Source policy: Financial Management Policy (planned, owner Camille). Covers the bank's standing budget-management discipline, of which this substrate-completeness budget is one instance. Tabled at the next IAF reading; not a prerequisite for approving the budget itself — change-management and the agent-runtime-deploy procedures are sufficient.

---

## 8. Dependencies on other personas

| Dependency | Persona | What I need from them, and by when |
|---|---|---|
| Acceptance of the §4.2 ordering | Vera | One-line confirmation that Wave-4 #13 (`parallel-dispatch-divergence`) is in fact next-up in Vera's queue and not blocked on a prerequisite Atlas hasn't named |
| Token-spend surface on dashboard | Anya | Add three derived projections (`tokens-per-session`, `cadence-vs-target`, `gap-closure-rate`) to the dashboard projection; substrate spec §3.6 surfaces |
| Confirmation of session-cadence cap | Scrooge | Scrooge enforces the per-week session count under Targeted; one-line confirmation Scrooge can hold to ~3 sessions/week without dropping CEO-decision-record latency |
| Operational-resilience treatment of the budget | Devon | Confirm the budget-management procedure (planned, §7) is BCP/DR-tier-classified appropriately; not load-bearing for Phase 1 |
| Threat-model gate for the dashboard token-spend surface | Senna + Rashida | The new projection reads from the Anthropic console export — confirm no new external attack surface is introduced; one-line gate before slice 1 lands |
| CFO-side budget-management procedure | Camille | Author the parent budget-management procedure (planned) covering all bank budgets, of which substrate-completeness is one. Substrate procedure is bounded; CFO-side is not |
| CEO-decision lift | Scrooge | Run `agent:anya-projection-refresh` after this brief commits so the dashboard projection lifts `D-SUBSTRATE-COMPLETENESS-BUDGET` into the open-decisions queue |

---

## 9. The decision asked

**D-SUBSTRATE-COMPLETENESS-BUDGET — adopt a substrate-completeness budget: unit of measure, target consumption rate, ceiling, and ordering for closing the remaining gaps to autonomous-by-default operation.**

If approved as recommended (Targeted):

1. Atlas treats Targeted as the standing pacing rule for substrate-build slices. Reports consumption-vs-budget in each substrate-state run.
2. Scrooge enforces the per-week session count and the per-session ceiling at the session-coordination layer. A session approaching 4M tokens defers remaining slices to the next session; a week approaching 4 sessions defers Marc-attention items to the next week.
3. Atlas's next slice is Vera Wave-4 #13 (`parallel-dispatch-divergence` recon) per §4.2 ordering. The slice unblocks the A2.2 Phase 2 path that was approved 2026-05-08.
4. The token-spend dashboard surface (gap `New-T1`) lands in Targeted's first or second session as a sub-slice of the `parallel-dispatch-divergence` PR or the next.
5. The §4.2 ordering is not a contract — substrate-state runs may re-order if a gap surfaces that pre-empts the named ordering. Re-orderings are reported, not authorised.

If a different option is preferred:

- **Lean.** Atlas re-spaces the §4.2 ordering across ~6 weeks of agent-time. Substrate-completeness lands after the Saskia / Rashida / Devon licence-readiness gate; the gate's sequencing is renegotiated.
- **Aggressive.** Marc pre-clears ~5 sessions/week of attention. Atlas + Scrooge compress the §4.2 ordering into one calendar week. Token spend and recon-coverage lag are flagged as risks; rollback is one commit per slice.
- **Different unit.** If sessions or agent-runs is the preferred unit (rather than token spend bounded by sessions), Atlas re-publishes with the chosen unit; recommendation does not change in shape, only in measurement.

If the budget is **not** adopted, the consumption rate continues at observed cadence with no ceiling; substrate-completeness lands when it lands. The risk surface is the failure modes named in §1 — under-spend (substrate stalls) or over-spend (attention saturates, token cost compounds).

---

## 10. Open items routed elsewhere

- **To Vera:** confirm Wave-4 #13 (`parallel-dispatch-divergence`) is in fact next-up in Vera's queue. Build slice spec is in the 2026-05-09 dispatcher-retire brief §4.3; nothing new from this brief.
- **To Anya:** add `tokens-per-session`, `cadence-vs-target`, `gap-closure-rate` derived projections to the dashboard. Spec is light; landing in Targeted's first or second session.
- **To Senna + Rashida:** threat-model gate for the dashboard token-spend surface (small — read-only projection over the Anthropic console export). One-line confirmation expected.
- **To Camille:** parent budget-management procedure (planned, §7). Not a prerequisite for approving the substrate-completeness budget; tabled for the next IAF reading.
- **To Devon:** operational-resilience treatment of the budget-management procedure when Camille tables it. Not Phase 1.
- **To Scrooge:** enforce per-week session count and per-session ceiling under Targeted; run `agent:anya-projection-refresh` after this brief commits so the dashboard lifts `D-SUBSTRATE-COMPLETENESS-BUDGET`. Pick up the resolved decision via `ceo-decision-record` when Marc decides; route §4.2 slice 1 to Atlas via `follow-on-router`.
- **To Marc (CEO):** the decision in §9. Adopt Targeted, or counter-propose Lean / Aggressive / a different unit.

—Atlas
