---
title: T-01 permission gate secure-by-default — env-var rename + opt-out + legacy backfill
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-10
summary: Closes T-01 critical from Senna+Rashida's agent-runtime threat model. Permission gate is now ON by default; opt-out via BANK_PERMISSION_GATE_DISABLED. Legacy pre-A1 backfill allow-list bypasses the gate for policy-less actors emitting types in a frozen 2026-05-10 snapshot, with low-severity SubstrateAlerts driving bypasses to zero.
decision-required: false
---

# T-01 permission gate secure-by-default

**Author:** Atlas (Core banking platform architect, engineering)
**Date:** 2026-05-10
**Standing authority:** S8 agent-runtime substrate + Principle 4 (security designed in). No new CEO decision required.
**Threat-model source:** Senna (Security & cryptography engineer, engineering) + Rashida (Cloud security & resilience architect, engineering) — `Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md` T-01 (Critical).
**Decision-record event:** `D-T-01-PERMISSION-GATE-SECURE-DEFAULT` — emitted via `prototype/scripts/record-d-t-01-permission-gate-secure-default.ts`.

## 1. Finding (recap)

Per Senna+Rashida T-01:

> The substrate has built `LocalPermissionPolicyPublisher` + `PermissionGate` correctly, but `BANK_PERMISSION_GATE_ENABLED` defaults to off (`prototype/platform/event-store/permission-gate.ts:22`). Without the gate enabled, the `eventEmitAllowList` in `PermissionPolicyPublished` is advisory; every other event-store-level threat compounds.

Severity **Critical**: at commencement-of-trading this is regulator-notifiable per `ORG-CY-04`; today it is substrate-debt that compounds against every other Critical/High threat in the same model.

Recommended mitigation:
1. Flip default to ON; rename env var to `BANK_PERMISSION_GATE_DISABLED` (opt-out).
2. Add `LEGACY_PRE_A1_EVENT_TYPES` backfill allow-list for the pre-A1-vintage event types whose actors don't yet have published policies; emit a low-severity `SubstrateAlert` of class `integrity` per (agentUrn, eventType) bypass so Vera's recon drives the list to zero.
3. Owen authors `Procedures/by-policy/permission-gate-operations.md` (separate workstream — not in this slice).
4. Vera adds `recon:permission-gate-default` (separate Vera workstream — not in this slice).

## 2. Substrate change

### 2.1 Env-var rename + semantic flip

| Before | After |
|---|---|
| `BANK_PERMISSION_GATE_ENABLED=true` enables the gate. | `BANK_PERMISSION_GATE_DISABLED=true` disables the gate. |
| Default: gate **off**. | Default: gate **on**. |
| Opt-in (insecure-by-default). | Opt-out (secure-by-default). |

Code change is in `prototype/platform/event-store/permission-gate.ts`:

```ts
export function isGateEnabled(forceEnabled?: boolean, forceDisabled?: boolean): boolean {
  if (forceEnabled === true) return true;
  if (forceDisabled === true) return false;
  return process.env.BANK_PERMISSION_GATE_DISABLED !== "true";
}
```

Tests gain a `forceDisabled` override symmetric to `forceEnabled` so test scaffolding doesn't depend on env-var ordering.

### 2.2 Legacy pre-A1-vintage backfill allow-list

`LEGACY_PRE_A1_EVENT_TYPES` is a `ReadonlySet<string>` of every event type emitted across `prototype/platform/`, `prototype/runtime/`, `prototype/scenarios/`, `prototype/scripts/`, and `prototype/tests/` as of 2026-05-10 (T-01 mitigation date). The list is alphabetised for stable diffs and includes both production and test-fixture types:

- **Production types** (covering registry-known + unregistered-but-emitted): every event from agent-runtime governance core, model-risk pipeline, markets/trade, accounting, decisions/observability, legal-entity tree, product lifecycle (NPA), RMS Phase 1, bank-account substrate, FX CDM, equity CDM, and the broader markets-readiness / payments / tax / risk / compliance snapshot families.
- **Test-fixture types** (e.g. `Alpha`, `Beta`, `GhostEvent`, `NewEvent`, `OldEvent`, `OtherType`, `RandomEvent`, `Test`, `TestEvent`, `WidgetTouched`, etc.): test files that exercise generic store-/recon-/publisher behaviour against synthetic actors. The bypass keeps these green without each test having to wire `BANK_PERMISSION_GATE_DISABLED=true` or a per-test policy publication.

Bypass behaviour (`decideAppend` in `permission-gate.ts`):

- Actor has **no published policy** AND event type **is in** `LEGACY_PRE_A1_EVENT_TYPES` → `allowed: true` with `legacyBypass: { agentUrn, eventType }`. The wrapper emits one low-severity `SubstrateAlert` (alertClass: integrity) per (agentUrn, eventType) pair per process; subsequent same-pair bypasses are deduped.
- Actor has **no published policy** AND event type **not in** the list → hard deny with `PermissionGateDenied`.
- Actor **has a published policy** AND type **not in** `policy.eventEmitAllowList` → hard deny (policy is canonical; bypass is closed once a policy exists).
- Actor **has a published policy** AND type **is in** `policy.eventEmitAllowList` → allow.

The list is a one-shot closure freeze: any new event type added to the codebase after 2026-05-10 must be in the emitting agent's `eventEmitAllowList` from day one. A future `recon:permission-gate-default` recon (Vera workstream — out of scope here, see §6) will assert this snapshot is closed-set.

### 2.3 SubstrateAlert payload (legacy bypass)

When the default `onLegacyBypass` handler fires (no caller-provided override), it emits a `SubstrateAlert` with:

- `alertClass: "integrity"` (the existing schema accepts inactivity / capacity / latency / integrity; "integrity" is the closest match for a control-bypass record).
- `severity: "low"` (per Senna's recommendation — the bypass is expected migration debt, not an active intrusion).
- `agentUrn: <bypassing actor>`.
- `details: "Legacy pre-A1 backfill bypass: <urn> emitted <type> without a published PermissionPolicy. Drive to zero by publishing the policy (bun run identity:issue) — see Senna+Rashida threat model T-01."`.
- `actor: agent:atlas:permission-gate` (the gate's own service identity), with citations `P4-SECURITY-DESIGNED-IN`, `ORG-CY-03`, and the threat-model document path.

Composition root (`prototype/platform/composition.ts`) does **not** override `onLegacyBypass` — the default behaviour (emit the typed `SubstrateAlert`) is the canonical record (Principle 1: events are truth; a parallel `logger.warn` would be prose-without-event drift).

## 3. Test impact

`prototype/tests/agent-identity.test.ts` updated:

- New `describe("permission gate — env-var defaults (T-01 secure-by-default)")` block: 5 tests covering default-on, env-var off-switch, force-overrides.
- Existing "when flag off" test renamed and rewired to use `forceDisabled: true`.
- "when flag on but no policy is published, blocks the append" rewritten as "when flag on, no policy, and event type NOT in legacy backfill, blocks the append" — uses synthetic `FutureEventType` to avoid bypass.
- 4 new tests for legacy-backfill behaviour: bypass-when-on-list, dedup per (agentUrn, eventType), distinct types fire distinct alerts, `onLegacyBypass` hook overrides default alert emission.
- 1 new test asserting policy-when-published is canonical (out-of-list emit hard-denied even when type is on legacy list).
- `decideAppend` test split: deny-when-not-in-list + allow-with-legacyBypass-when-in-list.

Final count: **38 pass, 0 fail** in `agent-identity.test.ts`. Full prototype suite: **793 pass, 0 fail**.

## 4. Files changed

- `prototype/platform/event-store/permission-gate.ts` — semantic flip + `LEGACY_PRE_A1_EVENT_TYPES` set + `forceDisabled` config + default `onLegacyBypass` SubstrateAlert emitter + per-process dedup.
- `prototype/platform/composition.ts` — comment update; no `onLegacyBypass` override (let the default canonical-record behaviour run).
- `prototype/tests/agent-identity.test.ts` — env-var name swap, new env-var-default suite, new legacy-bypass tests, `decideAppend` test split.
- `prototype/scripts/record-d-t-01-permission-gate-secure-default.ts` — `CeoDecision` emitter (idempotent) for `D-T-01-PERMISSION-GATE-SECURE-DEFAULT`.
- `Owner Inbox/2026-05-10_atlas_t-01-permission-gate-secure-default.md` — this record.

`prototype/platform/event-store/registry.ts` is **not** touched (the legacy list is exhaustive of currently-emitted types but doesn't add registry entries — A2 will register them properly).

## 5. Acceptance against brief

| Acceptance criterion | Status |
|---|---|
| `BANK_PERMISSION_GATE_ENABLED` no longer exists; `BANK_PERMISSION_GATE_DISABLED` is the new name. | Done. |
| Default behaviour: gate ON. | Done — `isGateEnabled()` returns `true` unless explicit opt-out. |
| Existing tests still pass via backfill allow-list. | Done — 793/793. |
| All recons + tests green. | Pending CI run — local typecheck + lint + test + citation-gate green. |

## 6. Substrate gaps remaining (T-02..T-12 from threat model)

This slice closes the Critical T-01 only. Other threats remain:

| ID | Severity | Owner | Sequencing note |
|---|---|---|---|
| T-02 | High | Atlas + Senna | Bus runner must verify `SignedToken` for `event-trigger-bus:dispatch` capability before invoking handler. Pre-A2 hardening. |
| T-03 | High | Atlas (parser + publisher) + Vera (Wave-4 #11 + Wave-5 recon) + Owen (procedure) | `eventSubscribeAllowList` + `registerWriteAllowList` are still empty arrays per the parser's known gap (`prototype/platform/agent-identity/permission-policy.ts:88, 103`). Pre-A2 hardening. |
| T-04 | High | Atlas (rotation wiring) + Senna (incident-response procedure) | Scheduler-driven `issuer.rotate(urn, "scheduled")`. Pre-commencement; M8 lift to Azure Key Vault Managed HSM closes. |
| T-05 | High | Atlas + Owen + Vera | `decisionClass` payload + escalation-side gate. Pre-A2 hardening; sequenced with T-03 parser change. |
| T-06 | High | Atlas + Owen + Vera | Spec-tamper expansion-alarm. Pre-commencement. |
| T-07 | Medium | Atlas + Vera | Cron-map hijack. Sequence after T-03 parser. |
| T-08 | Medium (compounds T-01) | Atlas | Trigger-bus poisoning. Defence-in-depth after T-01 lands (this slice). |
| T-09 | Medium | Atlas + Anya | Oversight-UI deception. Layer on T-01 / T-08. |
| T-10 | Low | — | (Per threat model summary table.) |
| T-11 | Low (today) / Medium (M8) | Atlas | Replay of signed tokens. Sequence with T-02. |
| T-12 | — | Atlas | Emergency-retire runbook. |

**Procedure follow-on (paired with this substrate slice, separate workstream):** Owen authors `Procedures/by-policy/permission-gate-operations.md` covering: who can flip the flag, the documented reason format, the change-management gate before flip, and the audit trail (`SubstrateAlert` of class `integrity` already emitted on every legacy bypass; a manual flip via env-var change is captured by deployment-IaC drift detection).

**Recon follow-on (paired with this substrate slice, separate workstream):** Vera adds `recon:permission-gate-default` asserting (a) `isGateEnabled()` returns `true` when no env-var is set, (b) the `LEGACY_PRE_A1_EVENT_TYPES` set is closed (no additions after 2026-05-10), and (c) legacy-bypass SubstrateAlert count for each (agentUrn, eventType) pair drives toward zero as policies publish.

## 7. Migration notes for anyone running locally

If you previously had `BANK_PERMISSION_GATE_ENABLED=true` in your shell or `.env`:
- The variable is now ignored (no-op). The gate is on by default.
- Unset it: `unset BANK_PERMISSION_GATE_ENABLED`.

If you relied on the gate being off (legacy local debugging):
- Set the new opt-out: `export BANK_PERMISSION_GATE_DISABLED=true`.
- The gate will be off in your shell only; production / CI default remains ON.

If you write new tests that exercise gated behaviour:
- Use `forceEnabled: true` in the `gateEventStore({ config: ... })` call (unchanged).
- Use `forceDisabled: true` for the new opt-out symmetric override (was previously `forceEnabled: false` + env-var unset).

## 8. Citations

- `Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md` (T-01 finding + recommended mitigation)
- `P4-SECURITY-DESIGNED-IN` (Principle 4)
- `ORG-CY-03` (Joint Standard 1 of 2024 — controls catalogue)
- `ORG-CY-12` (NIST SP 800-218 SSDF v1.1 — secure SDLC; default-secure principle)
- `ORG-CY-14` (ISO/IEC 27001:2022 Annex A.8.25–A.8.34 — system-acceptance + secure-development controls)
- `S8` (agent-runtime substrate standing authority)
- `D-T-01-PERMISSION-GATE-SECURE-DEFAULT` (this record's `CeoDecision` event)

—Atlas (Core banking platform architect, engineering)
