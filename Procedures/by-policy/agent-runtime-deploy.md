---
status: POPULATED
---
# Procedure — Agent-runtime deploy

**Procedure ID:** PROC-OPS-AR-01
**Owner:** Atlas (substrate) · Senna + Rashida (security policy review) · Vera (audit visibility)
**Approval:** BRC (under Change Management Policy + Secure SDLC Policy + Information Security Policy)
**Cadence:** Per-deploy; runs whenever the agent-runtime substrate is modified (event schemas, identity issuer, registry, scheduler, trigger bus, escalation channel, oversight UI)
**Version:** v0.1 — 2026-05-07
**Status:** **In force (build-phase scope, A0 + A1-starter slice)** — covers the substrate components landed today; extends as A2 (scheduler + trigger bus) and A3 (escalation + oversight UI) land

## 1. Source policy

- [`Procedures/by-policy/change-management.md`](change-management.md) — release approval & deployment gate.
- [`Procedures/by-policy/secure-sdlc.md`](secure-sdlc.md) — idea-to-merge lifecycle including threat-model gate, supply chain, signed builds.
- Information Security Policy (in `Owner Inbox/2026-05-06_core-policies-infosec-ops.md`) — substrate-level security envelope.
- Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md — design specification this procedure operationalises.

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| `ORG-CY-*` (Joint Standard 2 of 2024 — cyber resilience) | Cyber-resilient operational substrate. | Substrate threat-model gate + signed builds + zero-trust agent identity. |
| `ORG-PR-18` | Operational Resilience — Important Business Services. | Substrate is itself an IBS once domain agents host on it. |
| BCBS Operational Resilience (2021) (direct standard) | Identify IBS; impact tolerances; scenario testing. | A4 fleet-rollout adds the substrate to Devon's BCP / DR scope. |
| PA Directive 3 of 2018 (post-M8) | Cloud-computing posture. | M8 cloud lift binds the substrate to PA-D3 evidence. |

## 3. Purpose

Govern every change to the agent-runtime substrate — the platform on which every persona in `/Team/` runs as a standing autonomous agent (Principle 6). Without this procedure, substrate changes happen ad-hoc; with it, every change is threat-modelled, audit-visible, and reproducible.

In the build phase the procedure runs against the local-first substrate (per the implementation sequence in CLAUDE.md Principle 3). At licence-day with the cloud lift (M8), the same procedure runs against the Azure deployment without architectural change — the steps adapt where they reference local-vs-cloud primitives.

## 4. Trigger

- A pull request modifies anything under `prototype/platform/agent-runtime/`.
- A pull request adds / removes / renames a typed substrate event in `prototype/platform/event-store/event-types.ts` (specifically a member of `SUBSTRATE_EVENT_TYPES`).
- An agent's `/Team/<Name>.md` spec changes section 11 (events emitted), section 12 (capabilities), or section 7 (event-driven triggers) — those changes flow through to derived permission policies.
- A new persona file lands in `/Team/`.
- The runtime substrate is invoked manually (e.g., `bun run agent-runtime:bootstrap`).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Threat-model gate. Substrate changes that introduce a new trust boundary, a new authoritative-state risk, or alter ordering / durability / replay semantics require a Senna-led threat model before merge. | Senna · Atlas | `@platform/secure-sdlc` (per [`secure-sdlc.md`](secure-sdlc.md)) | Per Atlas spec §10 — these are escalation criteria. |
| 2 | Spec validation. Each persona spec (`/Team/<Name>.md`) parses against the loader; sections 11 / 12 / 7 are extractable; H1 matches filename; version reads from §17. | Atlas / system | `@platform/agent-runtime/spec-loader` | Vera Wave-4 #10 (planned) catches drift continuously; this step catches it pre-merge. |
| 3 | Permission-policy derivation. Run `derivePermissionPolicy(spec)` on every modified spec; review the diff against the previous policy. Material changes (new capability classes, new emit types, new subscriptions) escalate to Senna + Rashida. | Atlas + Senna + Rashida | `@platform/agent-runtime/permission-policy` | Pure-function derivation — same spec content yields the same policy. |
| 4 | Citation gate. The substrate citation slot (Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md#3-1) must resolve; Mira's `mira:citation-gate` handler asserts. | Mira (citation gate) | `@platform/citation/gate.ts` | CI-gated. |
| 5 | Bootstrap registry. Run `bun run agent-runtime:bootstrap` against a fresh event store to confirm all 28 personas register successfully with no failures. | system | `scripts/agent-runtime-bootstrap.ts` | Idempotent on matching sha256; output is a deterministic event sequence. |
| 6 | Test substrate. `bun test tests/agent-runtime.test.ts` plus the full `bun test` suite must pass. Tests cover spec loader, policy derivation, registry idempotency, identity round-trip, Vera carve-out. | Atlas / CI | `bun test` | Required by Atlas spec §15 — Vera independence boundary tested. |
| 7 | Recon. `bun run citation-gate` + `bun run recon:prose-duplication` + (when Wave-4 lands) `recon:agent-discipline` must be green. | Vera (recon) | `@platform/recon/*` | Recon failure blocks deploy. |
| 8 | Deploy. In build-phase: `git push` to merge; substrate is in force. In cloud (M8): IaC pipeline applies the change; the new composition root is in force. | Atlas | `@platform/change-management` | Pre-merge if pre-licence; pre-deploy if cloud. |
| 9 | Audit. Vera's quarterly opinion-pack covers agent-discipline (per Atlas spec §17 A5 phase). Deployment events feed Wave-3 / Wave-4 pipelines. | Vera (read-only carve-out) | `@platform/recon/*` | Independence boundary; Vera does not gate deploys, but findings flow back. |

## 6. Reconciliation

- **Events produced (per registered agent):** `PermissionPolicyPublished`, `AgentRegistered`. On retire: `AgentRetired`. On runtime activity (post-A2/A3): `ScheduledTrigger`, `AgentRunStarted`, `AgentRunCompleted`/`AgentRunFailed`, `AgentEscalation`, `AgentEscalationDecided`.
- **Reconciliation check:** for every persona in `/Team/<Name>.md` (excluding `_agent-spec-template.md`), there is exactly one `AgentRegistered` event whose `specSha256` matches the current file content. Drift between `specSha256` and the live file is a finding (Vera Wave-4 #10).
- **Failure mode:** registration failure on any spec causes the bootstrap to exit non-zero. The substrate refuses to host an agent whose spec does not parse.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `AgentRegistered` event | Event log | Indefinite (P1) | Internal |
| `PermissionPolicyPublished` event | Event log | Indefinite | Internal — captures the agent's authority surface |
| Threat-model evidence | Senna's threat-model register | Per Senna policy | Confidential — security |
| Bootstrap output | CI logs | Per CI retention | Internal |

## 8. Manual steps

- **Threat-model gate (Step 1)** is human-led by Senna. Automated decomposition of substrate changes into threat-model deltas is roadmap (Senna's domain).
- **Permission-policy review (Step 3)** is automated derivation + human review on material changes. The review itself is captured as an `AgentDecision` event by Senna.
- **A2 / A3 / A4 components** are not yet deployed; this procedure extends as they land. Today the in-force scope is A0 (event schemas frozen) + A1-starter (registry + identity).

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Spec doesn't parse | Step 2 | Spec author — fix; if persona structure has drifted, propose `_agent-spec-template.md` update via Owen |
| Material capability / emit / subscribe change | Step 3 | Senna + Rashida — pre-merge per Atlas spec §10 |
| New trust boundary / authoritative-state risk | Step 1 | Devon + Rashida per Atlas spec §10 — pre-build |
| Independence-affecting change (Vera carve-out, audit access) | Pre-deploy | Thandiwe per Atlas spec §10 — pre-deploy |
| Cloud-substrate selection / migration (M8 phase) | Pre-commit | Devon + Camille per Atlas spec §10 — pre-commit |
| Threat-model gate flagged | Step 1 | Rashida per Atlas spec §10 — pre-merge |
| Bootstrap registers fewer than 28 personas (count drift) | Step 5 | Atlas — investigate; non-zero exit blocks deploy |

## 10. Related procedures

- [`Procedures/by-policy/change-management.md`](change-management.md) — **populated (Devon + Atlas + Senna co-owned)** — the parent procedure this one operationalises for substrate changes.
- [`Procedures/by-policy/secure-sdlc.md`](secure-sdlc.md) — **populated (Senna + Rashida + Atlas co-owned)** — idea-to-merge lifecycle the substrate follows.
- `Procedures/by-policy/event-schema-evolution.md` — **planned (Atlas-owned)** — covers the SUBSTRATE_EVENT_TYPES set; intersects this procedure when substrate event schemas change.
- `Procedures/by-policy/dr-test-execution.md` — **planned (Atlas + Devon co-owned)** — substrate DR scope binds at A4 / M8.
- `Procedures/by-policy/incident-response.md` — **populated (Senna-owned)** — extended (Senna + Iris + Zara) to cover agent-runtime incidents per the substrate spec §7.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Atlas (via Scrooge) | Initial draft alongside the A0 + A1-starter substrate landing. Covers the components in force today (event-type schemas, agent registry, identity issuer); extends as A2 / A3 / A4 land. |

## 12. Audit / assurance

Vera's planned Wave-4 #10 (agent-spec integrity recon), #12 (mandate-ownership recon), #14 (decision-event recon for `AgentDecision`), and #15 (escalation recon for `AgentEscalation`) all consume substrate-emitted events directly. The substrate guarantees the streams' integrity; Vera's pipelines assert the streams' shape. Findings flow to Atlas; structural findings (an `AgentRegistered` whose `specSha256` no longer matches the live file) flow to Atlas + Owen.
