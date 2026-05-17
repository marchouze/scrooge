---
title: Agent-runtime substrate — threat model (impersonation, escalation bypass, capability creep, +9 others)
author: Senna (Security engineer, engineering), Rashida (Chief Information Security Officer, governance)
date: 2026-05-10
summary: Twelve threats catalogued across the A0–A3 substrate; 1 Critical (permission-gate default-off), 5 High, 4 Medium, 2 Low. Top mitigations route to Atlas (substrate code), Owen (procedure), Vera (recon).
decision-required: false
---

# Agent-runtime substrate — threat model

**Authors:** Senna (Security engineer, engineering — reports to Rashida CISO) · Rashida (Chief Information Security Officer, governance — reports to CEO)
**Date:** 2026-05-10
**For:** Atlas (Core banking platform architect — substrate owner), Vera (Internal audit engineer — third-line read), Marc (CEO — oversight)
**Authority:** Principle 4 (Security designed in from the start); standing CEO decision `S8` (security baseline, approved 2026-05-08); CLAUDE.md "Operating procedures" §"No-pause rule" — no new CEO decision required.
**Routed by:** Atlas (Core banking platform architect) per `Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md` §11 → Senna + Rashida.

> **Derivation note (Principle 6 — downward).** This document sits at the *standard* layer (technical security analysis of an implemented substrate). It implements the Information Security Policy + Cyber Resilience Policy + Secure SDLC Policy requirements that Principle 4 binds. Citations name Joint Standard 1 of 2024 obligations (Domain CY rows in `Regulations/_obligations-register.md`) and POPIA s.19–22 (`ORG-PR(IV)-06`, `ORG-PR(IV)-07`). It does not author principle-level substance.

---

## Stage gate

The substrate is partly built — A0 schemas frozen, A1 (registry + identity issuer + permission policy + permission gate) substantially built but **the permission gate is default-off (env-var opt-in)**, A2 (scheduler + event-trigger bus) built, A3 (oversight UI) built. Atlas requested this threat model as the input for the next decisions on A1 hardening and A2/A3 controls. Per Principle 4 ("designed in, not bolted on") this is the threat-model gate before further hardening lands.

## Executive summary

- **12 threats catalogued** — 1 Critical, 5 High, 4 Medium, 2 Low.
- **The single Critical is `T-01 Permission gate default-off`** — `BANK_PERMISSION_GATE_ENABLED=false` is the production default; without the gate, the `eventEmitAllowList` in `PermissionPolicyPublished` is advisory text. Every other event-store threat in this doc compounds against this baseline.
- **Top three mitigations by leverage:**
  1. **Flip the permission gate to default-on, with an explicit allow-list of pre-A1-vintage event types whitelisted for the legacy backfill** (T-01; Atlas substrate change; Critical).
  2. **Bus runner must verify the dispatch carries a valid `SignedToken` for the `event-trigger-bus:dispatch` capability before invoking the handler** (T-02 impersonation, T-08 trigger-bus poisoning; Atlas substrate change; High).
  3. **Vera Wave-4 #11 (event-subscribe coverage) + Wave-5 capability-creep recon** must land before A2 hardens further — without them, `PermissionPolicyPublished` produces empty `eventSubscribeAllowList` / `registerWriteAllowList` arrays today, making capability-creep undetectable on those axes (T-03 capability creep; Vera substrate change; High).
- **Two open questions for Atlas** routed at the foot of this document — they are scope-clarifications, not blockers; we have produced the threat model on the safer assumption in each case.

---

## Scope

**In scope (per Atlas spec §11 and the dispatched substrate components):**
- `prototype/platform/agent-identity/issuer.ts` — `LocalAgentIdentityIssuer` (Ed25519 keys; signed tokens; rotate / verify / signAs).
- `prototype/platform/agent-identity/permission-policy.ts` — derivation + `LocalPermissionPolicyPublisher`.
- `prototype/platform/agent-runtime/registry.ts` — `LocalAgentRegistry`.
- `prototype/platform/event-store/permission-gate.ts` — `PermissionGate` and `BANK_PERMISSION_GATE_ENABLED` opt-in flag.
- `prototype/platform/scheduler/scheduler.ts` — `LocalScheduler` (cron map, tick, inactivity check).
- `prototype/platform/event-trigger-bus/bus.ts` — `LocalEventTriggerBus` (subscriptions, dispatch, BusDispatched audit).
- `prototype/dashboard/oversight.ts` — `listEscalations`, `buildFleetStatus`, `buildDecisionDrillDown`, POPIA s.71 standing notice.
- Event types in `prototype/platform/event-store/event-types.ts`: `AgentRegistered`, `AgentRetired`, `IdentityKeyRotated`, `PermissionPolicyPublished`, `AgentDecision`, `AgentEscalation` + 4 lifecycle events.

**Non-scope (deferred or out-of-mandate):**
- HSM-backed signing — software Ed25519 today; M8 cloud lift moves to Azure Key Vault Managed HSM (Atlas spec §3.1). The threat model treats the local keystore as the *current* attack surface and notes the M8 mitigation where the gap closes.
- Network-layer threats (TLS, mTLS at the bus, Azure Entra ID conditional-access). Local deployment is in-process; the network surface lands at M8.
- Supply-chain attacks on Anthropic API token / SDK — covered separately under `ORG-CY-13` (SLSA build-provenance, Senna + Atlas) and the Secure SDLC Policy. Out of scope here because the substrate's threat model focuses on what the substrate *can* defend; supply chain is a horizontal control.
- Adversarial-prompt injection of agents at the LLM layer. Covered separately under model-risk (Nadia) and the AI-controls Procedure (planned, Owen). The threat model here treats agents as black-box autonomous actors and focuses on the substrate primitives that constrain them.
- Pre-incident forensics tooling (audit-log queryability, replay UI). Covered under Vera's pipeline mandate.

---

## Threat-model framing

We anchor on STRIDE + the four substrate-specific attack surfaces Atlas named (impersonation, escalation bypass, capability creep, plus our additions: collusion, schedule manipulation, event-store tampering, trigger-bus poisoning, oversight-UI deception, key compromise, replay, denial-of-service via runaway agent).

**Severity calibration** — calibrated to a SARB-licensed bank's risk appetite (Helena's RAS B6 cyber tier model T1–T4 per `ORG-CY-11`):
- **Critical (≈ RAS T4 candidate):** existential to substrate integrity; would necessitate Regulator-notification per `ORG-CY-04` if exploited at commencement-of-trading.
- **High (≈ RAS T3):** breaks a load-bearing control; substrate continues but a determined adversary with agent-side compromise can act with elevated privileges.
- **Medium (≈ RAS T2):** weakens defence-in-depth; noise / detection burden rises but no single-step exploit.
- **Low (≈ RAS T1):** residual hygiene; substrate-correct but policy or operability gap.

**Build-phase posture.** The bank is pre-licence (per `project_ai_driven_bank` memory): no real customers, no real capital, no real personal information of clients. Today's exploit cost is reputational + substrate-debt; at commencement-of-trading the same exploit cost is regulatory + financial. Mitigations are sequenced so that everything Critical/High lands **before** real client data flows; Medium/Low items can land in-substrate-roadmap.

---

## Threats

### T-01 — Permission gate default-off (Critical)

**Threat scenario.** An adversary (or a faulty agent) emits an event type *not* in the agent's published `eventEmitAllowList`. Today the `PermissionGate` is opt-in via `BANK_PERMISSION_GATE_ENABLED=true` and defaults off (per `prototype/platform/event-store/permission-gate.ts:22`). Without the gate, the event-store's `append()` accepts every well-formed event regardless of the actor's permission policy. Every Critical / High threat below compounds against this baseline — the policies exist, but they aren't enforced at the only enforcement point.

**Affected substrate components.**
- `prototype/platform/event-store/permission-gate.ts:22` (`BANK_PERMISSION_GATE_ENABLED` flag).
- `prototype/platform/agent-identity/permission-policy.ts` (the policy is derived + published, but consumed by nothing if the gate is off).

**Existing controls.** The gate code path *exists* and is well-formed: it folds policy, denies on out-of-allow-list, emits `SubstrateAlert` (alertClass: integrity). Vera has a hardcoded read-only carve-out (`VERA_URN`). Tests exercise the deny path (`forceEnabled: true`). The gate is *runnable* today; only the default is off.

**Residual risk.** All event-store-level enforcement is currently advisory text. Joint Standard 1 of 2024 §"controls catalogue" (`ORG-CY-03`) and the Secure SDLC Policy fail-secure principle (`ORG-CY-12`, `ORG-CY-14`) both expect controls to be on by default with documented exception for off.

**Recommended mitigation (code).**
1. Flip the default in `permission-gate.ts:isGateEnabled()` so absent env-var means `true`. Add `BANK_PERMISSION_GATE_DISABLED=true` as the explicit *off* switch — opt-out, not opt-in. The semantic flip is the substrate-fix; the env-var rename is its API surface.
2. Add a one-time backfill allow-list (`LEGACY_PRE_A1_EVENT_TYPES`) for the small set of events whose actors pre-date the registry (the local `.local/event.db` carries them today). The gate skips enforcement for events in this list, with a `SubstrateAlert` of `severity: low` recording the bypass per event-type per actor — so we can drive the list to zero over the next few agent ticks.
3. Add a `recon:permission-gate-default` recon assertion (Vera) that the env-var defaults are the safe direction. Drift is a recon finding.

**Recommended mitigation (procedure).** Owen authors `Procedures/by-policy/permission-gate-operations.md` covering: who can flip the flag, the documented reason format, the change-management gate before flip, the audit trail (a `SubstrateAlert` of class `governance` is emitted on every flip, capturing actor + reason + as-of).

**Severity.** **Critical.** Calibration: RAS T4 candidate. At commencement-of-trading this is regulator-notifiable per `ORG-CY-04`; today it is substrate-debt.

**Routing.** Atlas (substrate change) — should land within the next A1-hardening sprint. Owen (procedure) — paired land with the substrate flip. Vera (recon) — adds the recon assertion in the same wave.

---

### T-02 — Cross-agent impersonation via the event-trigger bus runner seam (High)

**Threat scenario.** The bus's `BusRunner` seam (`prototype/platform/event-trigger-bus/bus.ts:61`) invokes a handler with `{ agent, trigger, triggeringEvents }`. The runner's job is to call `runAgent(...)` for the named agent. If the runner does not verify a signed token from the bus dispatch (and today it does not — the seam takes the agent name as a string), then any caller of `runner({ agent: "atlas", trigger: ..., events: [...] })` can run code under Atlas's identity. The bus dispatch is in-process today, so the threat is internal-substrate-bug-as-attacker, not network-attacker — but the post-M8 lift puts this seam on a network boundary.

**Affected substrate components.**
- `prototype/platform/event-trigger-bus/bus.ts:61–66` (`BusRunner` type).
- `prototype/runtime/run.ts` (the default runner, not in this scope but the consumer).

**Existing controls.** None at the bus → runner seam. The bus emits `BusDispatched` with `actor: agent:atlas:event-trigger-bus` (the bus's own service identity, not the dispatched agent's), which preserves the audit trail of *who dispatched* but not *who the dispatcher claimed they were authorised to dispatch as*.

**Residual risk.** A future refactor that exposes the runner as an API endpoint (the M8 cloud lift surface) would expose this seam to the network. Even in-process, an agent-side compromise that can call into the bus can run any other agent.

**Recommended mitigation (code).**
1. The bus must mint a `SignedToken` for capability `event-trigger-bus:dispatch` scoped to the dispatched agent (`agent:<name>`) before invoking the runner. The runner verifies the token before invocation. The token is short-lived (60s) and bound to the `(eventId, handlerKey)` pair so it cannot be replayed against other dispatches.
2. The dispatched agent's `runAgent` call must in turn verify the dispatch token and refuse to act if the token's `agentUrn` differs from its own identity.
3. Token verification is via the existing `LocalAgentIdentityIssuer.verify()` — this requires the bus to hold a *bus identity* (not the dispatched agent's identity), which it already has under `agent:atlas:event-trigger-bus`. Add a per-dispatch token shape to the issuer.

**Severity.** **High.** Calibration: RAS T3. The exploit requires an in-process attacker today; the M8 lift makes it a network-callable surface and elevates to Critical if unmitigated by then.

**Routing.** Atlas (substrate change — extends `BusRunner` contract + issuer). Pre-A2-hardening, before the runtime-handler set widens. Senna does the cryptographic review.

---

### T-03 — Capability creep on event-emit, event-subscribe, register-write (High)

**Threat scenario.** An agent's `PermissionPolicyPublished` event sets the four allow-lists (`capabilityAllowList`, `eventEmitAllowList`, `eventSubscribeAllowList`, `registerWriteAllowList`). Today's derivation function (`prototype/platform/agent-identity/permission-policy.ts:88, 103`) returns **empty arrays** for `eventSubscribeAllowList` and `registerWriteAllowList` — the parser doesn't yet expose §7 trigger text or §11 register lines. Empty allow-lists mean any subscription / register-write is "outside the policy"; if the gate enforced them strictly, every subscription would deny; if the gate is permissive on empty, capability creep is undetectable on those axes.

**Affected substrate components.**
- `prototype/platform/agent-identity/permission-policy.ts:88–106` (`deriveEventSubscribeAllowList`, `deriveRegisterWriteAllowList`).
- `prototype/platform/agent-runtime/spec-parser.ts` (the upstream gap — parser doesn't capture §7 / §11 details).
- Vera Wave-4 #11 (planned event-subscribe coverage) and Wave-5 (planned capability-creep recon).

**Existing controls.** `eventEmitAllowList` and `capabilityAllowList` *are* derived from the spec (§11 events emitted, §12 system capabilities). `policyHash` provides idempotency. `PermissionPolicyPublished` is in the event log, so any change is auditable. The spec-parser's gap is documented as a substrate gap in the source.

**Residual risk.** Until A1.1's parser is extended *and* Vera Wave-4 #11 lands, two of four allow-lists are blank. An agent could subscribe to an event class outside its mandate (e.g. Mira subscribing to `AgentEscalation` events with `sealed.reason: popia-incident` — IO-confidential) and the substrate would not flag it.

**Recommended mitigation (code).**
1. Extend `prototype/platform/agent-runtime/spec-parser.ts` to capture §7 trigger payload typing and §11 register-name lines. Substrate gap is named in the parser source — make it a line-item commit.
2. Once parser produces the lists, the publisher's policyHash flips and `PermissionPolicyPublished` re-fires for every agent. Add a recon assertion (`recon:agent-permission-policy-coverage`, Vera Wave-4 #11) that every agent's policy has non-empty subscribe + register-write lists.
3. Capability-creep recon (Vera Wave-5) — compares the agent's `PermissionPolicyPublished` allow-lists against the actor.id of every event the agent has ever emitted. Drift is a finding. Wire in the same wave as the parser extension.

**Recommended mitigation (procedure).** Owen's `agent-spec-evolution.md` (planned per Atlas spec §7) must require that every spec change (`AgentRegistered` with new `specHash`) emits a paired `PermissionPolicyPublished` *before* the agent's next run. The bus must refuse dispatch if the agent's policyHash is older than the latest registration's specHash.

**Severity.** **High.** Calibration: RAS T3. JS-1 §"controls catalogue" (`ORG-CY-03`) requires that controls be testable; an undetectable creep is by definition untestable.

**Routing.** Atlas (parser + publisher refresh). Vera (Wave-4 #11 + Wave-5 recon). Owen (procedure). Land before A2 widens further.

---

### T-04 — Identity-key compromise (High)

**Threat scenario.** The local keystore is `.local/keys/<urn>.json` mode 0600 (`prototype/platform/agent-identity/issuer.ts:445`). An adversary with read access to the laptop FS — or any process running under Marc's user — can read the private Ed25519 seed and sign arbitrary tokens as any agent indefinitely (the `verify()` path checks current key version; if the attacker reads the *current* key, signatures verify as the legitimate agent).

**Affected substrate components.**
- `prototype/platform/agent-identity/issuer.ts:439–446` (`saveKey` writes mode 0600 in `.local/keys/`).
- `prototype/platform/agent-identity/issuer.ts:307–347` (`rotate` — exists, supports `compromise` reason).

**Existing controls.** Mode 0600. Per-agent rotation supported (`reason: "compromise"`). `IdentityKeyRotated` event records every rotation including `previousKeyRevokedAt`. Spec-change → automatic rotation. The issuer interface is HSM-shaped (the M8 lift swaps `LocalAgentIdentityIssuer` for an HSM-backed one without consumer changes).

**Residual risk.** Local FS is a soft target; no detection path for "key was read but not yet rotated". No periodic rotation in the build phase (the spec calls for 24h prod / 7d local cadence, but the cadence runner is A2's scheduler — Atlas spec §3.1 — and we cannot find a wired rotation tick today).

**Recommended mitigation (code).**
1. Wire the scheduler to call `issuer.rotate(urn, "scheduled")` on the agent's documented cadence (7d local, 24h prod). Add a `keyRotationCadenceHours` field per agent — defaults from the issuer's config.
2. Add file-integrity monitoring (`fs.watch` on `.local/keys/`) that emits a `SubstrateAlert` of class `integrity` on any unexpected mtime change. Local-only; the M8 lift moves to Azure Key Vault audit logs.
3. M8 lift to Azure Key Vault Managed HSM (FIPS 140-2 Level 3) — Principle 3 + Principle 4 baseline. This closes the local-FS surface entirely; the issuer interface is already HSM-shaped per §3.1.

**Recommended mitigation (procedure).** Senna's `incident-response.md` extension (Atlas spec §7.205) must include the runbook: detected compromise → call `issuer.rotate(urn, "compromise")` → invalidate any in-flight tokens via short token TTL (T-12 mitigation paired) → notify Iris if PI-touching agent.

**Severity.** **High.** Calibration: RAS T3. Build-phase impact contained (no real client PI, no real capital); commencement-of-trading impact regulator-notifiable per `ORG-CY-04` + `ORG-PR(IV)-07` (POPIA s.22 if PI exposure).

**Routing.** Atlas (scheduler ↔ issuer wiring). Senna (procedure). Rashida (M8 HSM design — already in the M8 spec, this confirms priority).

---

### T-05 — Escalation-bypass: agent emits `AgentDecision` for an in-scope-but-spec-escalating decision (High)

**Threat scenario.** An agent's `/Team/<Name>.md` §10 lists "decisions in scope" and §11 lists "decisions that escalate". A compromised or misaligned agent could emit `AgentDecision` for a decision that §11 says should escalate, routing around the human overseer entirely. The substrate today does not bind §10 / §11 to the event-emit allow-list — `AgentDecision` is one event type, and the *which decisions are in scope* is prose in the persona file.

**Affected substrate components.**
- `prototype/platform/event-store/event-types.ts` (`AgentDecision` payload schema — has `decisionId`, but no `decisionClass` in `eventEmitAllowList`).
- `prototype/platform/agent-runtime/spec-parser.ts` (parser captures `decisionsInScopeCount` + `decisionsEscalateCount` as numbers, not the actual decision classes).
- Vera Wave-4 #15 (`AgentDecision` reconciliation, planned).

**Existing controls.** `AgentDecision` carries the actor + citations; the audit trail records the decision happened. `AgentEscalation` is a parallel event type, so there is *infrastructure* for the escalation path; the gap is enforcement of which path the agent must take.

**Residual risk.** The substrate cannot currently distinguish "agent decided in-scope" from "agent decided what should have escalated". Detection lands at the recon layer (Vera Wave-4 #15) — *after* the decision has been emitted and possibly downstream consumed.

**Recommended mitigation (code).**
1. Extend the spec-parser to capture the **decision-class identifiers** from §10 and §11 of the persona spec (already in the spec text; just not parsed). Add `decisionClassesInScope: string[]` and `decisionClassesEscalate: string[]` to `AgentSpec`.
2. Extend `AgentDecision` payload with a required `decisionClass: string` field.
3. Permission-gate enforcement: an `AgentDecision` whose `decisionClass` is in the agent's `decisionClassesEscalate` list is denied with reason `"decision class escalates per spec; emit AgentEscalation instead"`. SubstrateAlert emitted.
4. Vera Wave-4 #15 recon checks the converse: every decision class in the §10 list has at least one `AgentDecision` over the agent's run history (no silently-dropped in-scope decisions).

**Severity.** **High.** Calibration: RAS T3. This is the substrate-level expression of Principle 7's "humans oversee the residual" — escalation-bypass directly defeats the principle.

**Routing.** Atlas (parser + payload + gate). Vera (recon). Sequence: parser change first (T-03 also wants the parser change), then payload + gate.

---

### T-06 — Spec-tamper → registration loop (High)

**Threat scenario.** The registry derives identity + permission policy from the parsed `/Team/<Name>.md` spec via `specHash` (`prototype/platform/agent-runtime/registry.ts:179–220`). An adversary who can edit the persona file (anyone with write access to the repo) can re-register the agent with a wider allow-list, then have the agent emit events under the new policy. The CLI sync fires `AgentRegistered` + `IdentityKeyRotated` + `PermissionPolicyPublished` on the new spec. PR review is the only gate.

**Affected substrate components.**
- `prototype/platform/agent-runtime/registry.ts:179–220` (registration flow).
- `prototype/platform/agent-identity/issuer.ts:257–305` (`issue` re-runs on spec change).
- The CLI sync command (the consumer).

**Existing controls.** Every change is an event in the log (`AgentRegistered`, `IdentityKeyRotated`, `PermissionPolicyPublished`). PR review by humans (Marc + Atlas + reviewers). Vera Wave-4 #12 (mandate-coverage recon, planned) can compare the allow-list growth between specHash versions.

**Residual risk.** Speed of detection — Vera's recon runs on her cadence (07:37 Thu UTC; weekly), so a wide-then-revert exploit could fire many wide-policy events before detection. PR review is not perfect: a complex spec PR might widen capabilities subtly.

**Recommended mitigation (code).**
1. Add a substrate-side allow-list expansion alarm: every `PermissionPolicyPublished` whose allow-lists strictly add capabilities relative to the previous policy emits a `SubstrateAlert` of class `governance` *before* the policy takes effect. The alert routes to Marc + Rashida via the dashboard. The new policy still publishes (we do not block); the alert is the human-in-the-loop notification.
2. Add a recon assertion (`recon:permission-policy-expansion`, Vera) that every expansion-class `PermissionPolicyPublished` has a paired Marc / Rashida acknowledgement event within 24h.
3. PR-review playbook (CODEOWNERS) for `/Team/*.md` to require Atlas + Senna review on capability-section changes.

**Recommended mitigation (procedure).** Owen's `agent-spec-evolution.md` codifies the spec-change ceremony: capability-section changes require security-side review.

**Severity.** **High.** Calibration: RAS T3. Bank-internal threat model (insider) — supply-chain mitigations don't apply.

**Routing.** Atlas (substrate alert). Vera (recon). Owen (procedure). Senna (CODEOWNERS update).

---

### T-07 — Schedule manipulation: cron-map hijack (Medium)

**Threat scenario.** The scheduler's cron map (`prototype/platform/scheduler/scheduler.ts:65–91`) is a hardcoded TypeScript constant. An adversary with repo write access can: (a) add a new (agent, trigger) entry firing arbitrary handlers; (b) increase a sensitive agent's cadence (e.g. fire Mira's MLRO supervision every minute, exhausting downstream queues); (c) redirect an entry to a different agent.

**Affected substrate components.**
- `prototype/platform/scheduler/scheduler.ts:65–91` (`SCHEDULER_CRON_MAP`).
- `.github/workflows/agent-runtime-*.yml` (the parallel cron source).
- `prototype/runtime/handlers-metadata.ts` (the canonical handler registry).

**Existing controls.** The cron map is in code and goes through PR. Vera's planned cross-source recon will assert workflow-cron ↔ scheduler-cron-map agreement. The dispatch eventually hits the bus / handler registry; a hijack to a non-existent handler would surface a `parseFailures` row.

**Residual risk.** PR review again the only gate. No runtime alarm on cron-map churn.

**Recommended mitigation (code).**
1. Make the cron map a *projection* of `AgentRegistered` payloads (each `AgentRegistered` carries the agent's spec; spec §6 has the cadence; cadence → cron). Then the cron map is derived, not hand-edited. Drift is a Vera finding.
2. Until that lands, add a `SubstrateAlert` of class `governance` on every cron-map *entry change* — diff against the prior process snapshot at startup. Land in the scheduler's boot path.

**Severity.** **Medium.** Calibration: RAS T2. Operability impact (queue exhaustion) higher than confidentiality / integrity impact.

**Routing.** Atlas (derive-from-spec — sequence after T-03 parser extension, since the parser is the upstream). Vera (cross-source recon).

---

### T-08 — Trigger-bus poisoning: synthetic events trigger unintended runs (Medium)

**Threat scenario.** An adversary who can append events to the store can craft a synthetic event whose `type` matches a subscriber's `subscribesTo` list. The bus dispatches the subscriber's handler, treating the synthetic event as a legitimate trigger. The handler's downstream actions (event emissions, side effects) execute under the *handler's* permission policy — which may be wider than the synthetic-event-emitter's.

**Affected substrate components.**
- `prototype/platform/event-trigger-bus/bus.ts:213–321` (dispatch loop).
- `prototype/platform/event-store/permission-gate.ts` (the only point that constrains who can append what — and it's default-off; T-01).

**Existing controls.** `BusDispatched` records the (eventId, handlerKey) pair so the trail is preserved. `SubstrateAlert` on dispatch failure (the bus already emits these). The permission gate (T-01) — when on — would prevent synthetic events from being appended in the first place by an unauthorised actor.

**Residual risk.** Compounds with T-01: gate off → synthetic events appendable → bus dispatches → handler runs.

**Recommended mitigation (code).**
1. T-01's mitigation (gate default-on) is the primary mitigation. With the gate on, an adversary needs both an authorised actor AND that actor's `eventEmitAllowList` to include the target event type — substantially harder.
2. For high-sensitivity event types (`AgentEscalation`, `AgentDecision`, `IdentityKeyRotated`, `PermissionPolicyPublished`, `CeoDecision`), the bus *also* verifies that the source event's `actor.id` matches an `agent:<name>` whose policy includes that event type in `eventEmitAllowList`, *even if* the gate is bypassed for backward-compat. Defence in depth.

**Severity.** **Medium** as standalone (depends on T-01). **High** if T-01 is not mitigated within the same wave.

**Routing.** Atlas (bus-side defence-in-depth check). Sequenced after T-01.

---

### T-09 — Oversight UI deception: escalation displayed with falsified context (Medium)

**Threat scenario.** The oversight UI (`prototype/dashboard/oversight.ts`) renders escalations from the event log. An adversary who can append events can: (a) add `AgentEscalationAcknowledged` events that make an unaddressed escalation look acknowledged; (b) add `AgentEscalationDelegated` events to mis-route accountability; (c) emit duplicate `AgentEscalation` events with the same `escalationId` but altered `question` / `options` text — the projection's "first-event-wins" on `raisedAt` (`oversight.ts:88–94`) means the last-written `question` may not be what's displayed.

**Affected substrate components.**
- `prototype/dashboard/oversight.ts:51–115` (`listEscalations`, `toView`).
- `prototype/platform/event-store/event-types.ts` (`AgentEscalation*` payloads).
- `prototype/platform/escalation/channel.ts` (the channel — out of this dispatch's read scope, but the consumer).

**Existing controls.** `AgentEscalation` is a single-emit event per `escalationId` — the channel rejects duplicate IDs (per the schema's idempotency contract; we did not re-verify in this dispatch but Atlas spec §3.5 asserts it). The oversight UI displays all lifecycle events in `buildDecisionDrillDown` — the CEO can see if there's a duplicate-acknowledgement pattern. POPIA s.71 standing notice is rendered for every automated decision.

**Residual risk.** The "first-event-wins on raisedAt" pattern in `toView` (`oversight.ts:88–94`) means the displayed `question` text comes from the *first* `AgentEscalation` event found in the replay — but the replay order is sequence-order, so a later duplicate would not overwrite. We confirm this is safe under the channel's single-emit invariant. The remaining risk is the acknowledgement / delegation events — those *are* multi-emit per spec.

**Recommended mitigation (code).**
1. Bind T-01 + T-08 mitigations (gate on; bus actor-check) — these prevent unauthorised acknowledgement events.
2. Permission-policy enforcement: only humans (`actor.type === "human"`) and a hardcoded whitelist of overseer agents (Marc-as-CEO; future Audit Committee delegates) may emit `AgentEscalationAcknowledged` / `AgentEscalationDelegated` / `AgentEscalationDecided`. Add to permission-gate's special-case logic.
3. UI-side: every escalation card in the oversight UI shows the count of acknowledgements / delegations (already in `acknowledgementCount` / `delegationCount` projections — `oversight.ts:108–109`). Add a visual cue when count > 1 + a one-click "show all events" expansion.

**Severity.** **Medium.** Calibration: RAS T2. UI-deception is the human-side attack surface; mitigations layer on top of T-01 / T-08.

**Routing.** Atlas (gate special-case for escalation events). Anya (UI-side count display). Iris (POPIA s.71 already correct; no change).

---

### T-10 — Collusion: two compromised agents collude across decision boundaries (Medium)

**Threat scenario.** Two agents whose individual permission policies are correct can together compose a decision they could not individually authorise. Example: Agent A emits a `WorkstreamRegistered` event (in its allow-list) describing a new workstream that Agent B's permission policy treats as a trigger for `AgentDecision`. Neither agent violated its policy; together they constructed a decision path no single agent was authorised for.

**Affected substrate components.**
- All — collusion is a system-property, not a component-property.

**Existing controls.** Vera's third-line read (read-only carve-out on every event stream) provides ex-post detection. Permission policies are derived from spec, so the decision graph is statically inspectable.

**Residual risk.** No real-time collusion detection. The substrate has no notion of "this decision required collaboration of agents whose joint policy exceeds the allow-list of the resulting event".

**Recommended mitigation (code).**
1. Vera Wave-5 collusion-recon (planned in this threat-model output): produces a graph of (event-emitter → event-consumer) over a window, identifies emergent decision paths whose joint capability set exceeds policy. This is a recon at Vera's cadence, not a real-time control.
2. Procedure-side: the New Product Approval procedure (planned, Saskia) and the Records Management Substrate (per `D-RMS-PHASE-1`) both have multi-agent decision flows. Each must be reviewed for collusion-susceptibility at design time — Owen + Senna joint review.

**Severity.** **Medium.** Calibration: RAS T2. Sophisticated attacker required; ex-post detection by Vera bounds the dwell time.

**Routing.** Vera (recon). Owen + Senna (per-procedure design review).

---

### T-11 — Replay attack on signed tokens (Low)

**Threat scenario.** A signed token (`SignedToken`) carries `(agentUrn, keyVersion, capability, issuedAt, signature)` (`prototype/platform/agent-identity/issuer.ts:52–63`). The `verify()` path (lines 349–388) checks signature + key version + capability scope. It does **not** check `issuedAt` is recent. An adversary who captures a token can replay it indefinitely until the next key rotation.

**Affected substrate components.**
- `prototype/platform/agent-identity/issuer.ts:349–388` (`verify`).

**Existing controls.** Key rotation invalidates old tokens (`keyVersion` mismatch returns "key version superseded"). Capability scope check.

**Residual risk.** Token TTL is effectively the key rotation cadence (7d local, 24h prod). For high-value capabilities (event-emit on `CeoDecision`, `AgentEscalationDecided`, etc.) that's too wide.

**Recommended mitigation (code).**
1. Add a `maxAgeSeconds` parameter to `verify()` (default: 60s for capability tokens; configurable per capability). Reject when `now - issuedAt > maxAgeSeconds`.
2. Optional: per-capability nonce-cache for the very-high-value capabilities (CeoDecision-emit). Store a Bloom filter of consumed nonces; reject re-presentation.

**Severity.** **Low** today (in-process; no token-capture attack surface). **Medium** post-M8 (network surface).

**Routing.** Atlas (issuer change). Sequence with T-02 — the bus-runner mitigation needs short-TTL tokens.

---

### T-12 — Denial-of-service via runaway agent (Low)

**Threat scenario.** An agent with a permissive `eventEmitAllowList` enters a loop emitting many events per second — exhausts event-store, fills the bus dispatch queue, makes Vera's recon walks slow, and inflates the inactivity-SLA noise. Today's local store is SQLite-on-disk; saturating it is plausible.

**Affected substrate components.**
- `prototype/platform/scheduler/scheduler.ts` (no rate-limit on agent runs).
- `prototype/platform/event-trigger-bus/bus.ts:177–332` (no rate-limit on dispatches per source-event-type).
- The event store (no per-actor rate-limit).

**Existing controls.** The scheduler runs each handler at most once per scheduled tick (idempotency on `(agent, trigger, scheduledFor)`). The bus dedups on `(eventId, handlerKey)`. So no single tick can re-fire infinitely; the threat is "agent emits N events per legitimate run".

**Residual risk.** A bug in an agent (or an LLM hallucination loop) could emit many events in a single run. Substrate has no kill switch.

**Recommended mitigation (code).**
1. Per-actor per-event-type rate limit at the event-store append path (e.g. ≤ 100 events of any one type per agent per minute). Configurable via the same composition root that wires the gate. Breach emits `SubstrateAlert` of class `integrity` and rejects further appends from that actor for 60s.
2. `AgentRetired` event already exists — wire a substrate-emergency procedure (Owen) that lets Marc retire a runaway agent in-flight via a CEO-decision-record dispatch.

**Severity.** **Low** today. **Medium** at commencement-of-trading (real downstream consumers).

**Routing.** Atlas (rate-limit). Owen (emergency-retire procedure).

---

## Mitigation roadmap

| ID | Threat | Severity | Owner (substrate) | Owner (procedure) | Owner (recon) | Sequence |
|----|--------|----------|-------------------|-------------------|---------------|----------|
| T-01 | Permission gate default-off | **Critical** | Atlas | Owen | Vera | **Immediate** — before next A1 hardening |
| T-02 | Cross-agent impersonation via runner seam | High | Atlas + Senna | — | — | Pre-A2 hardening |
| T-03 | Capability creep on three of four allow-lists | High | Atlas | Owen | Vera (Wave-4 #11 + Wave-5) | Pre-A2 hardening |
| T-04 | Identity-key compromise | High | Atlas (rotation wiring) | Senna (incident-response extension) | — | Pre-commencement; M8 lift to HSM closes |
| T-05 | Escalation-bypass via in-scope `AgentDecision` | High | Atlas | Owen | Vera (Wave-4 #15) | Pre-A2 hardening |
| T-06 | Spec-tamper → wider policy | High | Atlas | Owen | Vera | Pre-commencement |
| T-07 | Cron-map hijack | Medium | Atlas | — | Vera | Sequence after T-03 (parser is upstream) |
| T-08 | Trigger-bus poisoning | Medium (compounds T-01) | Atlas | — | — | Defence-in-depth after T-01 |
| T-09 | Oversight UI deception | Medium | Atlas + Anya | — | — | Layer on T-01 / T-08 |
| T-10 | Collusion across decision boundaries | Medium | — | Owen + Senna | Vera (Wave-5) | Vera-led; ex-post |
| T-11 | Replay of signed tokens | Low (today) / Medium (M8) | Atlas | — | — | Sequence with T-02 |
| T-12 | DoS via runaway agent | Low (today) / Medium (commencement) | Atlas | Owen | — | Pre-commencement |

**Roadmap reading.**

**Immediate (next A1-hardening sprint, before A2 widens):**
- T-01 substrate flip + Owen procedure + Vera recon.
- T-03 parser extension (unblocks T-05, T-07).
- T-05 decisionClass payload + gate (paired with T-03 parser).
- T-02 bus-runner token check (paired with T-11 short-TTL tokens).

**Pre-commencement-of-trading (per `project_rules_bind_at_commencement`):**
- T-04 scheduler ↔ rotation wiring + M8 HSM lift.
- T-06 expansion-alarm + recon.
- T-12 rate-limit + emergency-retire procedure.

**Vera-led / ex-post:**
- T-10 collusion recon (Wave-5, planned).
- T-08 / T-09 — depend on T-01; lift after T-01 lands.

---

## Procedure binding

The substrate controls in this threat model bind to procedures Owen (Company Secretary, governance) authors / extends. None of these is currently in `Procedures/by-policy/`; they are the procedure-side counterparts to the substrate mitigations. Routing to Owen for the next governance-cycle prep tick.

| Procedure | Status | Threats addressed | Anchor citations |
|-----------|--------|-------------------|------------------|
| `permission-gate-operations.md` | New | T-01 | `ORG-CY-03`, `ORG-CY-12`, `ORG-CY-14` |
| `agent-spec-evolution.md` | New (referenced in Atlas spec §7 as "planned") | T-03, T-05, T-06 | `ORG-CY-03`, `ORG-CY-09`, `ORG-CY-14` |
| `incident-response.md` | Extend (per Atlas spec §7.205) — add agent-identity-compromise runbook | T-04 | `ORG-CY-04`, `ORG-CY-05`, `ORG-CY-11`, `ORG-PR(IV)-07` (POPIA s.22) |
| `agent-runtime-deploy.md` | New (referenced in Atlas spec §7) | T-01 (cross-cuts), T-12 | `ORG-CY-06` (cloud / outsourcing), `ORG-CY-13` (build provenance) |
| `agent-emergency-retire.md` | New | T-12 | `ORG-CY-05` (rehearsed runbooks) |
| `permission-policy-expansion-review.md` | New | T-06 | `ORG-CY-03`, `ORG-CY-14` |

---

## Cross-references to the obligations register

This threat model implements the substrate-side discharge for the following rows in `Regulations/_obligations-register.md`. Cited by ID per the v1.13 schema.

| Obligation ID | Citation anchor | Discharge in this threat model |
|---------------|-----------------|--------------------------------|
| `ORG-CY-01` | Joint Standard 1 of 2024 — cyber framework with named accountability | Whole-doc owner: Senna (engineering) + Rashida (CISO governance) |
| `ORG-CY-03` | Joint Standard 1 of 2024 — threat-modelling, risk-assessment, controls catalogue | T-01, T-03, T-05, T-06 (controls catalogue + threat model is this document) |
| `ORG-CY-04` | Joint Standard 1 of 2024 — incident reporting timelines | T-04 (key-compromise reporting), T-01 (Critical breach class) |
| `ORG-CY-05` | Joint Standard 1 of 2024 + BCBS Op-Resilience — tested IR with rehearsed runbooks | T-04 procedure (runbook extension), T-12 procedure (emergency-retire runbook) |
| `ORG-CY-09` | ISO/IEC 27001:2022 — ISMS aligned | T-03 (capability hygiene = access control A.5.15 / A.8.3) |
| `ORG-CY-11` | RAS B6 — cyber severity tier model T1–T4 | Whole-doc severity calibration |
| `ORG-CY-12` | NIST SP 800-218 (SSDF v1.1) — secure SDLC | T-01 (default-secure principle); T-06 (CODEOWNERS gate is SSDF "Protect the Software" practice) |
| `ORG-CY-13` | SLSA v1.0 — build provenance | T-04 (HSM-backed signing at M8 is provenance-side); cross-ref only — out of substrate scope |
| `ORG-CY-14` | ISO/IEC 27001:2022 Annex A.8.25–A.8.34 — secure-development controls | T-01 (system-acceptance), T-06 (separation of environments) |
| `ORG-PR(IV)-06` | POPIA ss.19–22 — security of personal information | T-04, T-09 (oversight UI sealed-reason routing for `popia-incident`) |
| `ORG-PR(IV)-07` | POPIA s.22 — compromise notification to Information Regulator + data subjects | T-04 (key-compromise procedure flows to Iris) |
| `ORG-BNK-CYBER-CONS` | Joint Standard 1 of 2024 — consolidated cyber-resilience programme | Whole-doc — Rashida is the consolidated programme owner |
| `ORG-CY-02-RECON-CRO-INDEPENDENCE` | Joint Standard 1/2024 §6 + §7 — responsible-person + operational-independence read-across | Author independence: Senna engineers; Rashida governs; Vera audits — three-line discipline preserved |

---

## Open questions for Atlas (do not block; surfaced inline)

These are scope-clarifications. We have produced the threat model on the safer assumption in each case; Atlas (Core banking platform architect) clarifies before the mitigation PRs land.

1. **Does the M8 cloud lift retain the in-process bus runner seam, or refactor to a network call?** Affects T-02 severity gradient. We assumed network-call (Critical at M8 if unmitigated); if it stays in-process, T-02 stays High at M8.
2. **Is the cron-map → spec-§6 derivation (T-07 mitigation) in-scope for A2 hardening, or is the cron-map authoritative until the M8 control-plane lands?** Affects sequencing of T-07. We assumed it's in scope for A2 hardening; if not, T-07 mitigation is the SubstrateAlert on cron-map churn alone, and the derivation lands at M8.

---

## Author notes

- Authored in worktree `agent-ae2cdd146f7e987f1` per CLAUDE.md "Dispatch discipline" worktree-isolation rule. No `cd` to `/Users/marc/code/Bank/`.
- This document is the canonical threat-model artefact for the agent-runtime substrate as of 2026-05-10. The next refresh tick is owned by Senna's `senna:security-substrate-state` cadence (Thu 07:37 UTC) — Wave-5 capability-creep recon outputs will refresh this doc's T-03 / T-10 entries.
- No new CEO decision authority required (per S8 standing baseline + Principle 4); each Critical / High mitigation routes via Atlas's standing substrate-change authority. If Marc / the Audit Forum want a paired `D-AGENT-RUNTIME-THREAT-MODEL-CRITICAL-MITIGATIONS` decision-record for the T-01 flip ceremony, raise via the dashboard and we will scaffold one — substrate-side the work is unblocked either way.

—Senna (Security engineer, engineering) · Rashida (Chief Information Security Officer, governance)
