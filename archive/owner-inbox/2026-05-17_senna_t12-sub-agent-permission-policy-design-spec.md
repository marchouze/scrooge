---
agent: Senna
trigger: security-substrate-state
asOf: 2026-05-17T09:45:00Z
decision-required: false
---

# T-12 — Per-sub-agent PermissionPolicy design specification

**Author:** Senna (Chief Information Security Officer, governance)
**Brief:** `brief:senna:t-12-per-sub-agent-permissionpolicy-threat-model:2026-05-17`
**Run:** `run:senna:2026-05-17T09-43-45-532Z`
**For:** Atlas (Core banking platform architect, engineering), Vera (Internal audit engineer, third-line), Rashida (CISO, governance — ratification)
**Authority:** Principle 4 (security designed in from the start); `Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md` (T-12 roadmap item); ORG-CY-09 (zero-trust, least-privilege).

> **Scope note.** The original T-12 threat (filed 2026-05-10) was titled "Denial-of-service via runaway agent" and rated **Low (today) / Medium (at commencement-of-trading)**. That threat remains a substrate gap. This document focuses on the *complementary* T-12 roadmap item that grew out of the same threat: the build-phase carve-out in `recon:permission-gate-default` (`ACCEPTED_NO_POLICY_ACTORS` — ~45 sub-agent task actors without published `PermissionPolicy` events). These two concerns share the T-12 ID because the carve-out was annotated "retire via Senna's T-12 mitigation" in the recon source. This document resolves the carve-out design gap; a future Atlas PR handles the DoS rate-limit substrate.

---

## 1. Threat analysis

### 1.1 What the carve-out allows today

`ACCEPTED_NO_POLICY_ACTORS` contains 45 sub-agent URNs spanning five categories (A–F). For each of these actors:

- The permission gate does **not** enforce `eventEmitAllowList` — any well-formed event append is accepted.
- `recon:permission-gate-default` reports the actor as `info` (not `fail` or `warn`), so the carve-out is silent in normal CI.
- The gate's Assertion 4 path (`hasPolicy: false`) records an info-severity finding, but nothing blocks the emission.

This is an intentional build-phase posture, not a bug. However, the posture means that every task sub-agent can today append any event type to the store without constraint — the same footgun that T-01 closed for persona-level agents remains open for task-level sub-agents.

### 1.2 Risk catalogue

**R-01 — Out-of-mandate event emission (data integrity)**

A sub-agent task actor that emits events outside its parent persona's §11 mandate creates records in the event log that no persona is accountable for. Examples:

- `agent:ravi:ftp-curve-publish` emitting `CeoDecision` — this would appear in the decisions register as a CEO decision; the projection has no way to distinguish it from a legitimate record.
- `agent:kai:fx-pricer` emitting `SecuritySubstrateSnapshot` — Senna's snapshot register would contain fabricated substrate state.
- `agent:vera:overnight-recon` emitting `PermissionPolicyPublished` — a fabricated policy publication for any agent.

Severity: **High** (RAS T3). At commencement-of-trading, a false `CeoDecision` or false `PermissionPolicyPublished` event could corrupt the governance event trail in a regulator-notifiable way.

**R-02 — Principle 1 violations (audit trail falsification)**

Events are the only source of truth (Principle 1). If a sub-agent emits an event outside its mandate, and that event is projected into a register (Decisions, Documents, Briefs), the register contains a false record with no principal accountability. The event cannot be "un-appended"; only a compensating event can mark it as an error, and only if the error is detected.

Detection today: Vera's `overnight-recon` sub-agent would need to cross-check the emitting actor of every event against a published allow-list — which does not yet exist for sub-agents. Without published policies, Vera cannot automatically surface the violation.

Severity: **High** (RAS T3). Undetectable falsification of the canonical audit trail is equivalent to the T-01 threat at the sub-agent layer.

**R-03 — Privilege escalation via task actor chaining**

A compromised or misaligned persona-level agent (whose `PermissionPolicyPublished` policy is enforced by the gate) cannot emit events outside its allow-list. But if it can *launch a task sub-agent* with an unconstrained identity, it can use the sub-agent as a relay. The sub-agent emits the disallowed event, which then triggers downstream handlers as if it came from a legitimate source.

This is the sub-agent layer of T-10 (collusion across decision boundaries). T-10's Vera Wave-5 recon detects ex-post; without per-sub-agent policies, the relay vector has no real-time control at all.

Severity: **Medium** (RAS T2). Requires agent-level compromise to initiate; the relay path is the residual gap.

**R-04 — DoS amplification (compound with original T-12)**

The original T-12 threat (runaway agent) applies equally to sub-agents. A sub-agent loop that emits unconstrained event types has a wider blast radius than one constrained to its parent's `eventEmitAllowList`, because each event type can trigger additional bus dispatches. Per-sub-agent policies impose a type-level ceiling on the bus-dispatch fan-out.

Severity: **Low (today) / Medium (commencement)**. Same rating as original T-12; this is a compound factor, not a new severity.

### 1.3 Risk ranking summary

| Risk | Severity | Detectability without T-12 | Detectability with T-12 |
|------|----------|---------------------------|------------------------|
| R-01 Out-of-mandate emission | High | Low (no allow-list to check) | High (gate enforces) |
| R-02 Audit trail falsification | High | Low (Vera manual review only) | High (gate enforces + Vera recon) |
| R-03 Privilege escalation via relay | Medium | None (silent relay) | Medium (gate blocks the relay event; relay attempt leaves `SubstrateAlert`) |
| R-04 DoS amplification | Low/Medium | Low | Medium (type ceiling limits fan-out) |

---

## 2. Policy derivation model

### 2.1 The parent-persona derivation principle

Every sub-agent task actor inherits its `eventEmitAllowList` from the parent persona's §11 **Events emitted** list, scoped to the subset relevant to the task.

Formally:

```
permittedEvents(sub-agent) ⊆ permittedEvents(parent-persona)
```

A sub-agent can never be granted permissions wider than its parent persona. This is the **containment invariant**.

For the majority of task actors, the sub-agent's permitted set is a strict subset — the task actor emits only the specific event types directly relevant to its named task, not the full persona scope.

### 2.2 Actor-to-parent mapping

The actor URN convention `agent:<persona>:<task>` encodes the parent directly. The first colon-delimited segment after `agent:` is the persona name (lowercase). The derivation pipeline uses this to look up the parent spec.

| Sub-agent actor URN | Parent persona | Task scope | Permitted emit subset (from parent §11) |
|---|---|---|---|
| `agent:kai:fx-pricer` | Kai (Markets Engineer) | FX rate derivation | Types from Kai's §11 related to pricing events (e.g. `FxRatePublished`, `FxPricingSnapshotEmitted`) |
| `agent:kai:fx-rfq` | Kai | RFQ gateway | FX trade lifecycle events in Kai's §11 |
| `agent:kai:m1-cdm-typescript-bindings` | Kai | CDM bindings generator | Build / schema events in Kai's §11 |
| `agent:helena:risk-appetite-watch` | Helena (CRO) | Risk appetite monitoring | `RiskAppetiteSnapshotEmitted`, `RiskRaised` (from Helena's §11) |
| `agent:devon:operational-resilience-snapshot` | Devon (COO) | Operational resilience snapshot | Devon's §11 snapshot event types |
| `agent:camille:financial-position-snapshot` | Camille (CFO) | Financial position snapshot | Camille's §11 snapshot types |
| `agent:anya:projection-refresh` | Anya (Data Engineer) | Projection refresh | Anya's §11 projection-refresh event types |
| `agent:anya:projection-drift` | Anya | Projection drift detection | Anya's §11 drift-detection types |
| `agent:owen:governance-cycle-prep` | Owen (CoSec) | Governance cycle preparation | Owen's §11 governance event types |
| `agent:rohan:risk-run` | Rohan (Quant Risk) | Risk calculation run | Rohan's §11 risk-run event types |
| `agent:mira:obligations-snapshot` | Mira (CCO) | Obligations snapshot | Mira's §11 obligations snapshot types |
| `agent:senna:security-substrate-state` | Senna (CISO) | Security substrate state | `SecuritySubstrateSnapshot`, `ThreatModelGateDecision` (Senna §11) |
| `agent:zara:mlro-supervision` | Zara (MLRO) | AML supervision | Zara's §11 AML monitoring types |
| `agent:thandiwe:audit-committee-prep` | Thandiwe (CAE) | Audit committee preparation | Thandiwe's §11 audit event types |
| `agent:rashida:cyber-resilience-snapshot` | Rashida (CISO) | Cyber resilience snapshot | Rashida's §11 snapshot types |
| `agent:iris:popia-controls-snapshot` | Iris (IO) | POPIA controls snapshot | Iris's §11 POPIA event types |
| `agent:eitan:liquidity-snapshot` | Eitan (Treasury) | Liquidity snapshot | Eitan's §11 liquidity snapshot types |
| `agent:saskia:markets-readiness-snapshot` | Saskia (Markets Ops) | Markets readiness snapshot | Saskia's §11 readiness types |
| `agent:bea:accounting-readiness` | Bea (Finance Engineer) | Accounting readiness | Bea's §11 accounting readiness types |
| `agent:scrooge:inbox-hygiene` | Scrooge (Chief of Staff) | Inbox hygiene sweep | Scrooge's §11 inbox sweep types |
| `agent:yael:tax-readiness` | Yael (Tax) | Tax readiness | Yael's §11 readiness types |
| `agent:tomas:payments-readiness` | Tomas (Payments) | Payments readiness | Tomas's §11 readiness types |
| `agent:imani:legal-readiness` | Imani (GC) | Legal readiness | Imani's §11 legal readiness types |
| `agent:ravi:alm-readiness` | Ravi (ALM) | ALM readiness | Ravi's §11 ALM types |
| `agent:ravi:ftp-curve-publish` | Ravi | FTP curve publication | Ravi's §11 FTP-related types |
| `agent:sade:agentops-readiness` | Sade (AgentOps) | Agent operations readiness | Sade's §11 agentops types |
| `agent:pax:role-research-queue` | PAX (Research) | Role research queue | PAX's §11 research types |
| `agent:vera:overnight-recon` | Vera (Audit Engineer) | Overnight recon run | Vera's §11 recon types (notably: read-only, emits recon summary events only) |
| `agent:vera:codebase-quality-review` | Vera | Codebase quality review | Vera's §11 quality review types |
| `agent:mira:fais-horizon-scan` | Mira | FAIS horizon scan | Mira's §11 regulatory horizon types |
| `agent:sade:performance-evaluator` | Sade | Performance evaluator | Sade's §11 performance evaluation types |

**Platform infrastructure actors (Category B, Group A):** The actors `agent:atlas:*` (substrate-runner, event-trigger-bus, registry, permission-policy, identity-issuer, scheduler, legacy-fanout-shadow, goal-loop-runner, scheduled-trigger-consumer, substrate-state) and the substrate-runner / permission-gate actors are **not** derived from persona specs. They are substrate-internal and require a separate mechanism — see §2.3.

### 2.3 Platform actor derivation — special treatment

Category A and B actors (substrate-internal, platform infrastructure) have no parent persona because they are substrate primitives authored by Atlas. Their permitted event types are defined by the component's function, not a persona spec:

| Actor | Component | Permitted event types (hand-authored) |
|---|---|---|
| `agent:substrate-runner` | Legacy pre-A1 invocations | Legacy event types in `LEGACY_PRE_A1_EVENT_TYPES` only |
| `agent:atlas:permission-gate` | Permission gate alert emitter | `SubstrateAlert` only |
| `agent:atlas:substrate-runner` | AgentRunner lifecycle wrapper | `AgentRunStarted`, `AgentRunCompleted`, `AgentRunFailed` |
| `agent:atlas:event-trigger-bus` | EventTriggerBus | `BusDispatched`, `SubstrateAlert` |
| `agent:atlas:registry` | AgentRegistry | `AgentRegistered`, `AgentRetired`, `SubstrateAlert` |
| `agent:atlas:permission-policy` | PermissionPolicyPublisher | `PermissionPolicyPublished`, `SubstrateAlert` |
| `agent:atlas:identity-issuer` | AgentIdentityIssuer | `IdentityKeyRotated`, `SubstrateAlert` |
| `agent:atlas:scheduler` | AgentScheduler | `ScheduledTick`, `SubstrateAlert` |
| `agent:atlas:legacy-fanout-shadow` | Dashboard legacy fanout | `SubstrateAlert` |
| `agent:atlas:goal-loop-runner` | Goal-loop runner | `AgentDecision`, `AgentEscalation`, `SubstrateAlert` |
| `agent:atlas:scheduled-trigger-consumer` | ScheduledTriggerConsumer | `ScheduledTick`, `SubstrateAlert` |
| `agent:atlas:substrate-state` | Substrate-state reporter | `SecuritySubstrateSnapshot`, `SubstrateAlert` |

These policies are **hand-authored** by Atlas (as per-component static declarations) and published via the same `PermissionPolicyPublished` event as persona-derived policies. They do not go through the spec-parser pipeline. Atlas must maintain them alongside the substrate code; Vera's capability-creep recon asserts actual emission matches the declared list.

---

## 3. Publication mechanism — two options evaluated

### Option A — Registry-time derivation ("registry:sync compiles sub-agent policies")

**Mechanism:** When `bun run registry:sync` (or `scripts/agent-registry-sync.ts`) runs, it:

1. Parses every parent persona spec (`/Team/<Name>.md`).
2. For each known sub-agent URN whose parent matches, derives a `PermissionPolicy` containing the intersection of the parent's `eventEmitAllowList` and a task-specific subset declaration (stored in a new `_sub-agents.json` manifest or inline in the persona spec §11 as a sub-agent table).
3. Publishes `PermissionPolicyPublished` events for each sub-agent URN.

**Pros:**
- Single authoritative publication point — policies are published as part of the sync ceremony that already publishes persona policies.
- Sub-agent policies are derivable from static artefacts (persona spec + manifest) without any runtime component.
- Fits within the existing `registry:sync` → `PermissionPolicyPublished` → gate enforcement flow.
- Atlas's existing `LocalPermissionPolicyPublisher.publish()` accepts any `AgentSpec`-shaped input; the sub-agent case can produce a synthetic `AgentSpec` from the manifest without changing the publisher interface.
- Idempotent: policyHash prevents re-publication on no change.

**Cons:**
- A new `AgentSpec`-shaped synthetic for sub-agents either requires extending `spec-parser.ts` to understand sub-agent entries, or a parallel derivation path that bypasses the parser — creating two derivation paths that must stay in sync.
- Platform actors (Category A/B) still need hand-authored policies that cannot be derived from any persona spec — `registry:sync` must know to include them separately.
- Sub-agent manifest (the task-to-permitted-types mapping) is an additional artefact that can drift from the actual task implementation. Vera needs a recon to assert the manifest stays accurate.

### Option B — Launch-time derivation ("sub-agent runner calls identity:issue on launch")

**Mechanism:** When the runtime launches a task sub-agent (via the `AgentRunner` or a handler), the launch path calls `identity:issue(spec)` and `permissionPolicy.publish(spec)` with a dynamically constructed spec for the sub-agent URN. The spec is derived from the parent persona's registered spec with the task-specific subset applied.

**Pros:**
- No separate sync step needed — policies are published exactly when the sub-agent is first launched.
- The dynamic construction happens at the time and place where the task is defined — locality of information.
- Platform actors can self-register on their first dispatch.

**Cons:**
- Publication is runtime-only — in a fresh environment (CI, recovery), no sub-agent policy exists until the sub-agent runs for the first time. The gate would block the first run of any new sub-agent if it enforces before the policy is published. This requires a "first-run bootstrap" carve-out — which is exactly the carve-out we are trying to retire.
- The permitted-event subset is compiled at launch time from runtime state (the parent spec), not from a committed artefact. A parent spec change between sync runs and the sub-agent launch could produce an inconsistent policy.
- Harder to audit: the gate cannot validate at sync time that a sub-agent's policy will be consistent with its parent.
- The "launch publishes policy" pattern couples the permission substrate to the runtime execution path — a failure in policy publication at launch time would either block the task or require a fallback to the carve-out.

### Recommendation: **Option A — Registry-time derivation**

**Rationale:**

The primary goal is to eliminate the `ACCEPTED_NO_POLICY_ACTORS` carve-out by ensuring policies exist in the event store **before** the sub-agent runs, so the gate can enforce them from the first append. Option A delivers this: `registry:sync` runs at deploy time (and in CI), so by the time any sub-agent appends an event, its policy is already published.

Option B has a circularity: the policy is published on the sub-agent's first run, but the gate must enforce on the first run. This requires the gate to tolerate policy-less actors on their first run — which is the carve-out pattern, just moved from `ACCEPTED_NO_POLICY_ACTORS` to a "first-run exempt" flag.

Option A requires a new sub-agent spec manifest (or §11 sub-agent table in persona specs), but this manifest is a **committed artefact** — it goes through PR review, is covered by the citation gate, and can be asserted by Vera's capability-creep recon. Drift between the manifest and actual task behaviour is detectable.

For platform actors (Category A/B), Option A is equally appropriate: Atlas hand-authors a `platform-actors-policy.json` (or equivalent) that `registry:sync` processes alongside the persona-derived sub-agent policies.

---

## 4. Retirement path for ACCEPTED_NO_POLICY_ACTORS

### 4.1 Retirement gate design

An actor URN is removed from `ACCEPTED_NO_POLICY_ACTORS` when:

1. A `PermissionPolicyPublished` event exists in the event store for that URN (published by `registry:sync` under Option A).
2. `recon:permission-gate-default` Assertion 4 reports `hasPolicy: true` for that URN.
3. The removal is in the same PR as the policy publication mechanism that ensures the policy will always exist in a fresh environment (i.e., `registry:sync` is wired to publish the policy, not just a one-time manual event).

**Verification gate (pre-push):**

After retiring entries from `ACCEPTED_NO_POLICY_ACTORS`, the following must pass in `bun run ci`:

```
bun run recon:permission-gate-default
```

The recon's Assertion 4 will attempt to resolve every actor that has appended events against a published policy. If any carve-out was removed prematurely (policy not yet published), the recon will report a `warn` finding — which does not fail `bun run ci` today, but Atlas should wire it to `fail` severity once T-12 is complete. Senna will file a roadmap item for Atlas to escalate the severity.

Additionally:
```
bun run citation-gate
```
must pass (zero violations) before any PR removing carve-out entries is pushed.

### 4.2 Baseline count discipline

`BASELINE_COUNT` in `platform/recon/code-quality/legacy-bypass-watch.ts` tracks the size of `LEGACY_PRE_A1_EVENT_TYPES`. A parallel constant `BASELINE_NO_POLICY_ACTORS_COUNT` should be added to `permission-gate-default.ts` (or a paired module) to track the size of `ACCEPTED_NO_POLICY_ACTORS`. Every PR that removes entries updates the baseline downward. The recon reports an `info` finding when the count shrinks (locking in the lower floor) and a `fail` finding if the count grows (regression).

This is Atlas's substrate change; Senna specifies it here, Atlas implements it.

---

## 5. Substrate gaps for Atlas

The following are the substrate items Atlas needs to build to implement the chosen mechanism (Option A, registry-time derivation).

**Gap T12-A — Sub-agent spec manifest**

Atlas defines the canonical form for declaring a sub-agent's task-to-permitted-event-types mapping. Options:

1. **Inline in persona spec §11** — add a sub-agent table to each persona's §11 section:
   ```markdown
   **Sub-agents:**
   | Sub-agent URN | Task | Permitted emit subset |
   |---|---|---|
   | `agent:helena:risk-appetite-watch` | Risk appetite monitoring | `RiskAppetiteSnapshotEmitted`, `RiskRaised` |
   ```
   The spec-parser's §11 section is extended to parse this table. This keeps all persona information in one place.

2. **Separate `_sub-agents.json` manifest** — a JSON file mapping sub-agent URNs to their parent persona and permitted types. `registry:sync` reads this alongside the persona files.

Senna's preference: **option 1 (inline)** — keeps the persona spec as the single source of truth for the agent's entire identity surface, consistent with the single-graph discipline (Principle 2). Atlas decides the implementation form.

**Gap T12-B — registry:sync sub-agent publication**

Extend `scripts/agent-registry-sync.ts` (or the sync CLI) to:

1. Read the sub-agent entries from each persona's parsed §11 (or the manifest if Gap T12-A uses option 2).
2. Construct a synthetic `AgentSpec`-shaped object for each sub-agent URN containing:
   - `agentUrn`: the sub-agent URN (e.g. `agent:helena:risk-appetite-watch`)
   - `eventsEmitted`: the task-specific permitted subset
   - `systemCapabilities`: the task-specific capability subset (empty initially; extend as capabilities are declared)
   - `triggerSubscriptions`: empty initially
   - `specHash`: SHA-256 of the parent spec hash + task name (stable, deterministic)
3. Call `permissionPolicy.publish(syntheticSpec)` for each sub-agent.

**Gap T12-C — Platform actor policy declaration**

Atlas authors `prototype/platform/agent-identity/platform-actor-policies.ts` (or equivalent) containing the hand-authored policy declarations for Category A and B actors (the table in §2.3 above). `registry:sync` reads this file and publishes `PermissionPolicyPublished` events for each platform actor.

This file is covered by the same Vera recon (capability-creep check) as persona-derived policies.

**Gap T12-D — ACCEPTED_NO_POLICY_ACTORS baseline tracking**

Add `BASELINE_NO_POLICY_ACTORS_COUNT` constant to `permission-gate-default.ts` with the initial value of 45. Wire it into the recon's Assertion 4 to emit `info` on shrink and `fail` on grow.

Escalate the no-policy actor finding from `info` to `warn` for actors *not* in the carve-out set (already correct — the recon reports `warn` for uncategorised actors). Once all carve-out entries are retired, escalate the `info` for carve-out actors to `warn` and then `fail` — Senna will file the escalation roadmap item once rollout is complete.

**Gap T12-E — Vera Wave-5 capability-creep recon for sub-agents**

Vera's capability-creep recon (Wave-5, referenced in T-03 and T-10) must include sub-agent actors. When `PermissionPolicyPublished` exists for a sub-agent URN, Vera's recon compares the actor's actual emit history against the published `eventEmitAllowList`. Drift is a finding (emit outside allow-list is an R-01 / R-02 finding; emit inside allow-list has no finding).

This is a Vera substrate change, not an Atlas one — but Atlas must complete T12-A through T12-D before Vera can assert against the published policies.

---

## 6. Rollout sequence — highest-risk first

The containment invariant (§2.1) means the gate becomes a net security gain the moment policies are published and enforced. Rollout therefore proceeds in risk-priority order, retiring carve-out entries in batches.

### Wave 0 — Platform actors (Category A, B) — highest risk

Platform infrastructure actors (`agent:atlas:permission-policy`, `agent:atlas:identity-issuer`, `agent:atlas:event-trigger-bus`, etc.) and the legacy substrate runner are the most dangerous unconstrained actors because they emit **governance-critical event types** (`PermissionPolicyPublished`, `IdentityKeyRotated`, `BusDispatched`). A compromised substrate actor can rewrite the permission surface for all other agents.

**Action:** Atlas completes Gap T12-C (platform actor policy declaration) and publishes policies for all Category A/B actors. Carve-out entries for these actors are removed in a single PR.

**Risk if delayed:** R-02 (audit trail falsification) at governance level. Any sub-agent or platform actor could emit a fraudulent `PermissionPolicyPublished` widening another agent's policy — the relay vector for R-03 is fully open at the substrate layer.

### Wave 1 — Security, audit, and identity-adjacent governance sub-agents — Critical

The following sub-agents emit events that directly affect the security and identity surface:

- `agent:senna:security-substrate-state` — can emit `SecuritySubstrateSnapshot`; a falsified snapshot deceives the oversight UI.
- `agent:vera:overnight-recon` — can emit recon summary events; a falsified recon suppresses findings.
- `agent:vera:codebase-quality-review` — same category as overnight-recon.
- `agent:rashida:cyber-resilience-snapshot` — cyber resilience posture snapshot.
- `agent:iris:popia-controls-snapshot` — POPIA controls snapshot; connects to the breach notification path.
- `agent:thandiwe:audit-committee-prep` — audit committee preparation; feeds the third-line oversight channel.
- `agent:zara:mlro-supervision` — AML supervision; connects to SARB reporting obligation.

**Action:** Atlas completes Gap T12-A and T12-B for these seven actors (parent persona §11 sub-agent tables populated, registry:sync extended). Policies published; carve-out entries removed.

### Wave 2 — CFO, CRO, COO, CoSec governance snapshot sub-agents

- `agent:helena:risk-appetite-watch`
- `agent:devon:operational-resilience-snapshot`
- `agent:camille:financial-position-snapshot`
- `agent:owen:governance-cycle-prep`
- `agent:mira:obligations-snapshot`
- `agent:mira:fais-horizon-scan`
- `agent:eitan:liquidity-snapshot`

These emit governance snapshot events that feed the dashboard and oversight registers. Lower risk than Wave 1 because they don't touch the identity/security substrate, but elevated relative to operational sub-agents because their events are consumed by the CEO oversight path.

### Wave 3 — Operational and engineering task sub-agents

The remaining Category C–F actors:

- `agent:kai:fx-pricer`, `agent:kai:fx-rfq`, `agent:kai:m1-cdm-typescript-bindings`
- `agent:anya:projection-refresh`, `agent:anya:projection-drift`
- `agent:rohan:risk-run`
- `agent:bea:accounting-readiness`
- `agent:scrooge:inbox-hygiene`
- `agent:yael:tax-readiness`
- `agent:tomas:payments-readiness`
- `agent:imani:legal-readiness`
- `agent:ravi:alm-readiness`, `agent:ravi:ftp-curve-publish`
- `agent:sade:agentops-readiness`, `agent:sade:performance-evaluator`
- `agent:pax:role-research-queue`
- `agent:saskia:markets-readiness-snapshot`

These are operational readiness and engineering task actors. Their event emissions are important but do not directly affect the governance, identity, or security substrate. Publish policies and retire carve-out entries in this final batch.

### Rollout gate per wave

Before submitting each wave's PR:

1. `bun run registry:sync` from `prototype/` completes with zero parse failures for the wave's parent personas.
2. `bun run ci` passes — which includes `recon:permission-gate-default` asserting `hasPolicy: true` for each retired actor.
3. `bun run citation-gate` passes (zero violations).
4. Atlas confirms via a PR comment that the `BASELINE_NO_POLICY_ACTORS_COUNT` constant has been updated to reflect the new lower count.

---

## 7. Containment invariant enforcement — gate escalation path

Once Wave 0–3 are complete and `ACCEPTED_NO_POLICY_ACTORS` is empty:

1. Atlas changes the severity of Assertion 4 in `permission-gate-default.ts` from `info` → `warn` for any actor without a policy (removing the "accepted" branch entirely).
2. Vera's Wave-5 capability-creep recon is wired to run as part of `bun run ci` (not just Vera's overnight cadence).
3. Any new sub-agent task actor added to the codebase must have a corresponding sub-agent entry in its parent persona's §11 **before** the first commit that references the actor URN. This is the sub-agent equivalent of the "agent-spec-before-code" rule in T-06.

Vera (third line) will assert the closed-set property as part of Wave-4 #11 (event-subscribe coverage) and Wave-5 (capability-creep recon). Senna will file the Vera routing brief after Atlas completes Wave 0.

---

## 8. Authority notes and escalation

This design specification is an engineering-level recommendation from Senna. Per §10 of Senna's agent spec, the following items require Rashida's (CISO) ratification before the substrate implementation proceeds:

- The choice of Option A (registry-time derivation) as the publication mechanism. Rashida confirms this meets the standing security standard for zero-trust identity publication.
- The wave sequencing in §6. Rashida confirms the risk prioritisation is consistent with the RAS B6 tier model.

No new CEO decision is required (authority: Principle 4 standing; S8 security baseline; T-12 roadmap item approved 2026-05-10 in the original threat model).

If Rashida or Atlas have material objections to any design decision in this document, they route via `AgentEscalation` event to Senna before the first Atlas implementation PR is opened.

---

## Citations

- `Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md` (T-01, T-12 threat model; source of the carve-out annotation)
- `prototype/platform/recon/permission-gate-default.ts` (ACCEPTED_NO_POLICY_ACTORS — the carve-out catalogue)
- `prototype/platform/agent-identity/permission-policy.ts` (PermissionPolicyPublisher — publication mechanism)
- `prototype/platform/agent-identity/issuer.ts` (AgentIdentityIssuer — identity substrate)
- `prototype/platform/agent-runtime/spec-parser.ts` (AgentSpec derivation — parser upstream)
- `Team/Senna.md` §11 (Senna agent spec — events emitted authority)
- `P4-SECURITY-DESIGNED-IN` (Principle 4)
- `ORG-CY-09` (ISO/IEC 27001:2022 — zero-trust, least-privilege)
- `JOINT-STANDARD-2-2024` (PA/FSCA Joint Standard 2 of 2024 — cyber resilience programme)
- `GOV-FRAMEWORK-CEO-RESERVED`

---

*Senna (Chief Information Security Officer, governance) — 2026-05-17*
