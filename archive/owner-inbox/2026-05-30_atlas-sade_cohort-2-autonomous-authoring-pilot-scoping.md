---
title: "Cohort-2 Autonomous-Authoring Pilot — Scoping / Design Brief"
author: "Atlas (Core banking platform architect) + Sade (AgentOps & Token Efficiency Engineer)"
date: 2026-05-30
workstream: WS-AGENT-AUTONOMY-COHORT-2
decision: D-AGENT-AUTONOMY-COHORT-2-PILOT
status: scoping-design
kind: design-brief
supersedes: []
---

# Cohort-2 Autonomous-Authoring Pilot — Scoping / Design Brief

> **This is a scoping / design brief, not a build.** The only code committed in
> this run is this document plus its `RecordFiled` emission. No `platform/` or
> `runtime/` code is changed. Each part below decomposes into an
> independently-shippable follow-on listed in §7.

## 0. Context and thesis

Cohort-1 goal-loops (Atlas, Vera, Owen, Bea) already derive goals autonomously
and emit the full planning-trace event path (`AgentGoalEvaluated` →
`AgentGoalSelected` / `AgentGoalDeferred`) through
`LocalAgentGoalLoopRunner.runWithGoal` (`prototype/platform/agent-runtime/goal-loop.ts:170`).
But cohort-1 carries a hard constraint, stated verbatim in two places:

- The `GoalDeriver` type comment — *"cohort-1 implementations use a rule engine
  (no LLM calls)"* (`prototype/platform/agent-runtime/goal-loop.ts:102-103`).
- Vera's deriver header — *"no LLM calls — cohort constraint per spec §3.4
  'MUST NOT — LLM cost-cap'"* (`prototype/runtime/agents/vera-goal-loop.ts:11-13`).

Cohort-2 lifts exactly that constraint, for **one agent, on her lowest-blast-radius
surface**: it lets the goal-loop's "action warranted" branch call the existing
Anthropic wrapper `generateNarrative` (`prototype/runtime/claude.ts:409`) to
author a *net-new* deliverable, and land it via the existing RMS `RecordFiled`
flow. Everything else (validation gates, shadow-mode, event-store sync, metering)
is reused unchanged.

**Why Vera (Internal audit / continuous-assurance engineer) is the first agent.**
Vera's output *is* the recon safety-net. Her cohort-2 deliverable — a recon-finding
narrative or assurance note — is the same surface that the ~100 recon gates under
`prototype/platform/recon/` already police. If an autonomous Vera narrative is
wrong, the recon set she herself runs (`calc-no-silent-zero.ts`,
`expected-event-watchdog.ts`, `decision-record-event-symmetry.ts`) catches it on
the next overnight pass. Blast radius is bounded by the very mechanism we are
piloting. No money moves; no customer-facing artefact is touched; the worst
failure mode is a narrative that a downstream recon flags as a finding — which is
the system working.

---

## 1. Goal-loop → `claude.ts` authoring path for Vera (the pilot handler)

### 1.1 What exists today

Vera's run-handler (`prototype/runtime/agents/vera-goal-loop.ts`) already does
the hard part:

1. Parses her spec (`parseSpecFile(VERA_SPEC_PATH)`, line 471).
2. Materialises a `WorldStateSnapshot` (`getWorldStateReader().snapshot("agent:vera")`,
   line 483).
3. Runs `veraGoalDeriver` (a pure rule engine, lines 204-433) through
   `runWithGoal` (line 494), which validates goal-shape (T-NEW), escalation-class
   (T-05), and citation discipline (P2) before emitting `AgentGoalSelected`.
4. On a `decision` outcome with `shouldRunHandler === true` (line 511), it
   invokes the underlying `veraOvernightRecon(handlerCtx)` — but **dry-run-gated**
   in shadow mode (line 517).

The deriver's `GoalDecision` outcome (`goal-loop.ts:64-72`) already carries a
`rationale`, `mandateCitations`, `procedureCitations`, and `plannedEvents`. Today
the *action* that follows a selected goal is a mechanical recon run. Cohort-2
adds a second possible action: **author a net-new narrative deliverable**.

### 1.2 The cohort-2 action branch — concrete handler shape

A new goal label is added to Vera's spec §9 closed-set (so it passes the T-NEW
check in `goal-loop.ts:273-287`), e.g. **"Author assurance narrative for an open
recon finding"**. When `veraGoalDeriver` selects this label (e.g. Candidate 0a
already detects open `AuditFinding`s — `vera-goal-loop.ts:271`), the handler's
post-`runWithGoal` branch does the following, in order:

```
// pseudocode — the actual handler lives in vera-goal-loop.ts after line 511
if (goalOutcome?.kind === "decision"
    && goalOutcome.chosen === "Author assurance narrative for an open recon finding") {

  // (Guardrail b) Token-governor pre-check BEFORE any claude.ts call — see §2(b).
  const budget = sade.tokenGovernor.checkBudget({ agent: "vera", runId: iterationId });
  if (!budget.ok) { /* emit refusal alert, defer, return */ }

  // Graceful degradation — never fail the run on a missing key.
  if (!claudeAvailable()) {            // runtime/claude.ts:194
    // fall back to the mechanical overnight-recon path (today's behaviour)
  } else {
    const res = await tryGenerateNarrative({          // runtime/claude.ts:529
      stableSystem: VERA_PERSONA_PREFIX,              // byte-stable — see §1.3
      userInput: buildFindingContext(worldState, openFindingIds),
      effort: "high",
      maxTokens: 8_000,                               // assurance notes are short
      meta: { runId: iterationId, agent: "vera", dryRun: handlerCtx.dryRun },
    });
    if (res.ok) {
      // CI gate (Guardrail a) runs in the headless workflow before commit — see §2(a).
      // Land the narrative via the existing RMS RecordFiled flow:
      recordFiled({ registerKey: "documents", body: res.result.text, ... },
                  clock.now());        // platform/records/helpers.ts:576
    }
  }
}
```

Key real-API anchors:

- `tryGenerateNarrative` (`runtime/claude.ts:529`) is the right entry, **not**
  the raw `generateNarrative` — it returns `{ ok: false, error, retryable }`
  instead of throwing, so a Claude failure (rate-limit, credit-exhausted,
  bad-request) degrades the run to today's mechanical path rather than killing
  it. This matches the existing handler ethos ("the mechanical content is
  valuable on its own; the narrative is icing" — `claude.ts:526-527`).
- Metering is automatic: when `meta.runId` is set and `dryRun` is false,
  `generateNarrative` appends a `TokenUsageRecorded` event
  (`claude.ts:476-504`) via `makeTokenUsageRecorded`. The token-governor (§2(b))
  and Sade's daily token-usage analysis (`runtime/agents/sade-token-usage-analysis.ts`)
  both read this stream — no new metering plumbing is needed.

### 1.3 System-prompt / cache-prefix strategy

`NarrativeRequest` (`runtime/claude.ts:329-381`) is split into a **cached stable
prefix** (`stableSystem`) and a **volatile per-run tail** (`userInput`),
separated by the `cache_control: { type: "ephemeral" }` breakpoint placed on the
single system block (`claude.ts:441-447`).

- **`stableSystem` = Vera's persona spec, byte-stable.** Load `Team/Vera.md`
  (the same file `parseSpecFile` already reads) plus a frozen instruction
  preamble. The doc-comment is explicit: *"Keep this byte-stable across runs.
  No timestamps, no UUIDs, no per-request IDs"* (`claude.ts:336-339`) and the
  minimum cacheable prefix on Opus 4.7 is 4096 tokens (`claude.ts:340`). Vera's
  full spec comfortably clears that floor, so the prefix caches at ~10% input
  price on every repeat tick. The `specHash` Vera already pins in her mandate
  citations (`vera-goal-loop.ts:220`) is the natural cache-invalidation key:
  prefix changes ⇔ spec changes ⇔ new hash.
- **`userInput` = the per-run finding context** appended after the breakpoint:
  the open `AuditFinding` payloads, the offending `ReconResult` rows, the
  pipeline name, and the question ("write the assurance narrative for these
  findings"). Byte changes here do **not** invalidate the cached prefix
  (`claude.ts:346-348`), so the marginal cost of each autonomous narrative is
  dominated by output tokens, not re-reading the persona.

This is the single most important cost lever and it is already built — the pilot
just has to populate the two fields correctly.

### 1.4 Landing the deliverable (dispatch + RecordFiled flow)

Two filing paths exist; the pilot uses the **headless** one:

- **In-handler `recordFiled`** (`platform/records/helpers.ts:576`) — the same
  helper every recent deliverable uses (e.g.
  `scripts/file-helena-model-registry-scope-closure-slice-2-ecl-suite.ts:27`).
  The handler calls it directly with `registerKey: "documents"`, a content body
  of `res.result.text`, classification `governance-seat` (Vera is third-line),
  and citations including `D-AGENT-AUTONOMY-COHORT-2-PILOT`, the source
  `AuditFinding` IDs, and `D-RMS-PHASE-3`. This emits the canonical `RecordFiled`
  event (Principle 1); the markdown render is derived.
- The **dispatch CLI** (`scripts/dispatch/{open-brief,start-run,close-run}.ts`)
  is the *human-coordinated* path. `close-run` already files each deliverable as
  a `RecordFiled` event and folds the hash into `AgentRunCompleted`
  (`close-run.ts:4-12`). The autonomous handler does **not** go through the CLI
  — it is its own dispatcher, exactly as `vera-goal-loop.ts` invokes
  `veraOvernightRecon` directly to avoid the `run.ts` circular dependency
  (`vera-goal-loop.ts:54-57`). The brief-event for an autonomous run is the
  `AgentGoalSelected` planning trace, not an `AgentBriefIssued`.



## 2. Three guardrails (each independently shippable)

The autonomous-authoring branch ships *behind* three guardrails. Each is its own
PR; none blocks the others except where noted.

### (a) CI gate in the headless path — owner: Atlas

**Rule:** an autonomous run may only auto-commit a deliverable if `bun run ci`
passes in the agent worktree first. Red CI ⇒ emit `SubstrateAlert{integrity}`,
leave the brief / finding open, and **never land** the deliverable.

**Where it wraps.** The existing headless commit/push loop lives in
`.github/workflows/agent-runtime-atlas-goal-loop.yml`, steps "Run … goal-loop"
(line 52-54) → "Commit deliverable" (line 62-88). The Vera cohort-2 workflow is
modelled on this file. Guardrail (a) inserts a step **between** the goal-loop run
and the commit step:

```yaml
      - name: CI gate before commit          # NEW — guardrail (a)
        working-directory: prototype
        run: bun run ci                       # full-project tsc + recon (CLAUDE.md gate)
      - name: Commit deliverable              # existing, lines 62-88
        ...
```

Because GitHub Actions fails the job on a non-zero step exit, a red `bun run ci`
stops the workflow *before* the `git add`/`git commit`/`git push` loop ever runs
— the deliverable is authored in the run but never committed. The job's
post-failure hook emits `makeSubstrateAlert` (`platform/event-store/event-types/platform.ts:149`)
with `alertClass: "integrity"`, `severity: "high"`,
`alertId: "alert:integrity:vera-autoauthor-ci-red"`, and a `details` string
naming the failing pipeline. The open finding that triggered the run stays open
(no `AuditFindingDisposed` is emitted), so Vera's own Candidate-0a re-fires next
tick. This is the headless analogue of the local `bun run ci` dispatch gate in
CLAUDE.md "Dispatch discipline".

### (b) Token governor — owner: Sade *(co-authored guardrail with Atlas)*

**Rule:** before any `claude.ts` call, a budget check must pass. The governor
reads the `TokenUsageRecorded` stream and refuses to start a run that is over
budget.

**What it reads.** `TokenUsageRecorded` events
(`platform/event-store/event-types/agent-ops.ts:62`, `makeTokenUsageRecorded`),
the same stream Sade's daily analysis already folds
(`runtime/agents/sade-token-usage-analysis.ts`, `HIGH_SPEND_THRESHOLD = 50_000`).
No new event type is needed for the *input* side.

**Four levers:**
1. **Per-tick ceiling** — max tokens a single autonomous run may consume
   (e.g. 12,000). Enforced as the `maxTokens` cap on the `NarrativeRequest`
   (`claude.ts:355`) plus a post-hoc check.
2. **Daily spend cap** — sum `estimatedCostUsd` across today's
   `TokenUsageRecorded` (the field is already computed at
   `claude.ts:492` via `estimateCost`). Refuse when the projected run would
   cross the cap.
3. **Max-concurrent-runs** — count `AgentGoalSelected` events without a matching
   terminal run event in the last *N* minutes; refuse above the ceiling
   (pilot value: 1 — a single autonomous author at a time).
4. **Hard kill-switch env var** — `BANK_AUTOAUTHOR_DISABLED=1` short-circuits the
   governor to "refuse" unconditionally. This is the emergency stop; it mirrors
   the existing `BANK_CLAUDE_MODEL` / `BANK_CLAUDE_DISAMBIGUATE_OVERLOAD` env
   override convention in `claude.ts:43,216`.

**Call site.** The governor check is the **first** statement inside the cohort-2
action branch in `vera-goal-loop.ts` (see §1.2 pseudocode), strictly *before*
`tryGenerateNarrative`. On refusal it emits `SubstrateAlert{alertClass:"capacity",
severity:"medium", alertId:"alert:capacity:autoauthor-over-budget"}` (so a
refusal is observable, not silent), and the handler returns down the
deferred/mechanical path. A refusal is a normal, expected outcome — not a
failure — so it does **not** emit `severity:"high"`.

### (c) Per-agent path allowlist — owner: Atlas

**Rule:** an autonomous run may only write files inside its own domain. Vera may
write assurance notes under `archive/owner-inbox/` and her own findings register;
she may not touch `Policies/`, `prototype/runtime/`, another agent's spec, etc.

**Declaration.** The allowlist is a **new per-spec field** on the agent spec.
The agent-spec template (`Team/_agent-spec-template.md`, sections 1-17) gains a
machine-readable row — proposal: extend §16 "Substrate gaps" sibling with a
§7-adjacent `autonomousWriteAllowlist` block, or (cleaner) add the field to the
roster JSON `Team/_team-roster.json` keyed by agent, since that file is already
the canonical render source and is parsed programmatically. **Recommendation:
roster JSON**, because `parseSpecFile` already reads structured spec rows and a
JSON allowlist is trivially diffable in recon. The field is a list of
glob patterns, e.g. for Vera:
`["archive/owner-inbox/*_vera_*.md", "Procedures/by-policy/findings-tracking.md"]`.

**Enforcement (pre-commit).** Two layers:
1. **In-handler** — `recordFiled` is called with a `path` in `metadata`
   (`helpers.ts` filing pattern, cf. the `path:` field in the Helena filing
   script line 53). A guard checks the path against the allowlist before the
   `recordFiled` call; a violation throws and the run defers.
2. **In-workflow (headless)** — before the commit step in the Vera workflow,
   a step runs `git diff --cached --name-only` and asserts every staged path
   matches the agent's allowlist globs; a non-match fails the job and emits
   `SubstrateAlert{integrity,high}`. This is belt-and-suspenders against an
   in-handler bypass. A future `recon:autonomous-write-allowlist` pipeline
   asserts the same invariant retrospectively over `RecordFiled` events.



## 3. Async-approval model

**Goal:** move Marc (CEO) from *in-loop executor* (he is currently the runtime
that decides each escalation in-session) to *batch approver* (agents emit
`Decision(requested)` and park; Marc clears a batch from the decisions register
asynchronously, on his own cadence).

### 3.1 What already exists

- **`requestDecision`** (`runtime/decisions/record.ts:270`) — emits a `Decision`
  event at phase `"requested"`. This is the "park" primitive. An autonomous agent
  that reaches a decision it is *not* authorised to make (escalation-class per its
  spec §10, caught by `goal-loop.ts:290`) can call `requestDecision` instead of
  acting, and stop.
- **`recordDecision` / `recordDelegatedDecision`** (`record.ts:203,305`) — the
  approval primitive. Marc's in-session "y" becomes `Decision(approved)` via the
  session-delegation path (CLAUDE.md "Session delegation").
- **The Decisions register + dashboard** — the unified Decisions register already
  renders `requested` vs terminal phases; `decisionsOpen` is the queryable
  backlog. The dashboard surfaces open decisions today.
- **The escalation channel** — `GoalEscalation` (`goal-loop.ts:75-83`) is already
  a first-class typed outcome; `runWithGoal` records escalation intent
  (`goal-loop.ts:240-264`).

### 3.2 What is needed

1. **A batch-approval surface.** Today approval is one-at-a-time in-session. The
   needed delta is a register *view* (dashboard tile or CLI) that lists all
   `Decision(requested)` events with no terminal phase, lets Marc select N, and
   emits N `Decision(approved)` events in one action — each still attributed to
   `marc@tgv.co.za` via `recordDecision` (the session-delegation call signature
   in CLAUDE.md is unchanged; only the batching UX is new). This is a thin
   projection + action over primitives that already exist.
2. **Park-and-resume wiring in the handler.** When the cohort-2 deriver selects a
   goal whose downstream action needs approval, the handler emits
   `requestDecision({...})` and defers — it does **not** author. On a later tick,
   if the matching `Decision(approved)` exists in the store, the handler proceeds
   to author. This is a pure event-store read (mirrors how
   `vera-goal-loop.ts:121` reads open-vs-disposed findings).
3. **A standing authorisation for the low-risk class.** For the pilot, narratives
   *about already-open findings* are inside Vera's existing mandate (she already
   authors finding narratives mechanically). These do **not** need per-item
   approval — the standing `D-AGENT-AUTONOMY-COHORT-2-PILOT` decision authorises
   the class, exactly as CLAUDE.md's no-pause rule lets standing CEO decisions
   authorise downstream dispatch. Per-item `requestDecision` is reserved for
   anything that crosses Vera's spec §10 escalation classes.

**Net:** the async model is ~90% existing primitives. The only genuinely new
build is the batch-clear register view (one PR, COO/CoSec-class UX), plus the
park-and-resume read in the handler.



## 4. Shadow-soak gate

**Reuse, do not reinvent.** The shadow pattern already exists in two forms:

- **Workflow-level** — `agent-runtime-atlas-goal-loop.yml:8-9`: *"Shadow mode for
  first 2 ticks (handler runs with dryRun=true per spec §4). After 2 successful
  shadow ticks, the handler executes live."*
- **Handler-level** — `vera-goal-loop.ts:517`: the handler is run with
  `dryRun: ctx.dryRun || !shouldRunHandler`, so in shadow mode the planning-trace
  events still emit (testable) while the side-effecting action is suppressed
  (`vera-goal-loop.ts:37-41,455-460`).

### 4.1 Cohort-2 soak procedure

1. Vera's cohort-2 handler runs in **shadow** (`dryRun=true`): it derives the
   "author narrative" goal, **calls `tryGenerateNarrative` with `meta.dryRun:
   true`** (so no `TokenUsageRecorded` is appended and **no `recordFiled`** is
   emitted), and writes the generated text to the workflow log / a scratch
   artefact only. The narrative is produced but **not landed**.
2. Vera's own overnight recon (`vera-overnight-recon.ts`) runs the gate set over
   the resulting (non-landed) artefact and compares it against the live register.
3. Flip to **live** only after a clean soak of **N = 5 consecutive ticks**.

### 4.2 Why N = 5

Cohort-1 used 2 ticks because the action was a *mechanical, deterministic* recon
run. Cohort-2's action is *non-deterministic LLM output*, so the soak must be
longer to sample output variance. Five ticks gives at least five distinct
generated narratives across genuinely different finding states (Vera's deriver
fires on different candidates 0a/0b/0c/1/2/3 across ticks), which is enough to
observe whether the recon set ever flags an autonomous narrative. It is also
cheap: five short (~8K-token) assurance notes is a trivial token budget under the
governor.

### 4.3 Pass criteria (all must hold across the N ticks)

- **Zero recon regressions** — no `ReconResult` for any pipeline crosses from
  `ok`→`warn`/`fail` attributable to the shadow narrative; specifically
  `decision-record-event-symmetry`, `expected-event-watchdog`, and
  `calc-no-silent-zero` stay green.
- **Zero `SubstrateAlert{alertClass:"integrity", severity:"high"}`** emitted by
  guardrails (a) or (c) during the soak.
- **Token spend within governor budget** — every shadow tick's projected
  `estimatedCostUsd` stays under the daily cap; no `alert:capacity:autoauthor-over-budget`
  refusal that indicates a mis-sized budget (a refusal *for the right reason* is
  fine; a refusal that blocks legitimate work means the budget is wrong).
- **Citation discipline holds** — every shadow narrative that *would* have been
  filed carries a valid `RecordFiled` citation set (passes `bun run citation-gate`
  dry-run).

A single failed tick **resets the counter to zero** (not "N−1"): the soak proves
*consecutive* clean ticks. Flipping to live is itself a `Decision` — see §7.



## 5. Azure / M8 boundary

**The pilot does not depend on Azure / M8 at all.** This is load-bearing and is
stated verbatim in the substrate itself. The `claude.ts` header (lines 23-27):

> *"Substrate boundary (M8): the SDK call works on any host with the API key and
> outbound HTTPS. Post-cloud-lift, the key moves to Azure Key Vault; the surface
> here doesn't change. Per Senna / Rashida: the key is loaded from env only —
> never logged, never written to events, never echoed in deliverables."*

So:

### 5.1 What genuinely remains for Azure / M8 (NOT in scope for this pilot)

- **Event-store durability / HA.** Today the shared SQLite store
  (`$HOME/.local/share/bank/event.db`, with Neon sync in the headless workflows
  per `agent-runtime-atlas-goal-loop.yml:46-60`) is the durability story. The M8
  lift swaps the file path for a Cosmos/Postgres URL — *"structurally identical
  to the Azure cloud target … the M8 lift swaps the file path for a
  Cosmos/Postgres URL without touching capability code"* (CLAUDE.md
  cross-worktree event-store sync). The pilot's `TokenUsageRecorded`,
  `RecordFiled`, `SubstrateAlert`, and `Decision` events all land in this same
  store and inherit M8 durability for free.
- **Key Vault for `ANTHROPIC_API_KEY`.** Today the key is an env var
  (`claude.ts:194,320-325`). M8 moves it to Azure Key Vault Managed HSM. The
  `claudeAvailable()` / `new Anthropic()` surface does not change — only *where*
  the env var is populated from.

### 5.2 What does NOT depend on Azure / M8 (everything in this pilot)

The entire authoring path — `generateNarrative` / `tryGenerateNarrative`, the
prompt-cache prefix strategy, the goal-loop deriver, all three guardrails, the
shadow-soak gate, `recordFiled`, the `Decision`/`requestDecision` async-approval
primitives — runs today on the local substrate with an env-supplied key and
outbound HTTPS. **No part of the pilot waits on the cloud lift.** The pilot is
buildable, soakable, and live-flippable entirely pre-M8; M8 is a transparent
infra swap underneath it.



## 6. Substrate gap surfaced by this run

Per CLAUDE.md "steady-state vs current substrate", every Scrooge-coordinated run
surfaces the gap that prevented a fully-autonomous run. **This brief was authored
by a Scrooge-coordinated in-session run, not by an autonomous Atlas/Sade
goal-loop tick** — which is precisely the gap this workstream closes. Concretely:

1. **No LLM-authoring branch exists yet in any goal-loop.** Every cohort-1/2
   deriver is a pure rule engine by constraint (`goal-loop.ts:102-103`,
   `vera-goal-loop.ts:11-13`). An agent cannot today *author net-new prose* on
   its own tick — the wiring this brief specifies (§1.2) is the missing piece.
2. **No token governor gates the `claude.ts` call.** `generateNarrative` meters
   *after* the fact (`claude.ts:476`) but nothing refuses a run *before* spend.
   Guardrail (b) is net-new.
3. **No per-agent write allowlist.** Nothing structurally prevents an autonomous
   run from writing outside its domain. Guardrail (c) is net-new.
4. **No batch-approval surface.** `requestDecision`/`recordDecision` exist but
   approval is one-at-a-time in-session (§3.2). The batch-clear view is net-new.

Until these land, cohort-2 narratives remain Scrooge-coordinated. The gap is the
work — it is a roadmap item, not something hidden.

## 7. Independently-shippable follow-on decisions

The build phase decomposes into six independently-shippable follow-ons, in
dependency order:

1. **Pilot handler** (Atlas) — add the cohort-2 "author narrative" goal label to
   `Team/Vera.md` §9 + the LLM-authoring action branch in `vera-goal-loop.ts`
   (§1.2). Ships behind the kill-switch env var, default OFF.
2. **Guardrail (a) — CI gate in headless path** (Atlas) — the `bun run ci` step
   before commit in the Vera workflow + `SubstrateAlert{integrity}` on red (§2a).
3. **Guardrail (b) — token governor** (Sade) — budget-check call site before
   `tryGenerateNarrative` + refusal alert (§2b). *Blocks the pilot going live but
   not the handler PR.*
4. **Guardrail (c) — per-agent path allowlist** (Atlas) — roster-JSON field +
   in-handler + in-workflow enforcement + future `recon:autonomous-write-allowlist`
   (§2c).
5. **Async-approval batch-clear view** (COO/CoSec-class UX) — register view that
   emits N `Decision(approved)` in one action + park-and-resume read in the
   handler (§3.2).
6. **Shadow-soak activation → live flip** (Vera + CEO) — run the N = 5 shadow
   soak (§4); a clean soak is the evidence for a `Decision(approved)` that flips
   `BANK_AUTOAUTHOR_DISABLED` off / removes the dry-run gate. The flip is itself a
   CEO decision.

Recommended sequence: **1 → 2,3,4 (parallel) → 5 → soak → 6.** Guardrails (a),
(b), (c) are mutually independent and can land concurrently once the handler (1)
exists. None may be skipped before the live flip (6).

---

### Recommended pilot shape (one paragraph)

Wire Vera's existing goal-loop "action warranted" branch to call the existing
`tryGenerateNarrative` (`runtime/claude.ts:529`) with her byte-stable persona
spec as the cached prefix and the open-finding context as the volatile tail,
landing the result via the existing `recordFiled` flow — gated by three new,
independently-shippable guardrails (headless `bun run ci` gate, a
`TokenUsageRecorded`-driven token governor with a hard kill-switch, and a
per-agent write allowlist). Run it in the existing dryRun shadow mode for N = 5
consecutive clean ticks (zero recon regressions, zero `SubstrateAlert{integrity,
high}`, spend within budget), then flip to live via a CEO decision. Vera is
chosen because her output and the recon safety-net are the same surface, bounding
blast radius; the whole pilot runs on today's local substrate with an
env-supplied key — Azure/M8 only swaps the event-store URL and key source
underneath it, changing no capability code.

