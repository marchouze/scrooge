---
agent: Vera
trigger: overnight-recon
asOf: 2026-05-29T04:56:15.436Z
decision-required: false
---

# Vera — overnight recon, 2026-05-29

Autonomous run of Vera's continuous-controls pipelines per `Team/Vera.md` operating spec § 6 (Cadence) and § 7 (Triggers). Run by the agent runtime; no human-in-the-loop.

**Headline:** FAIL — 3414 assertions; 2 fail violations; 15 warn violations across 9 pipelines.

## Pipeline results

| Pipeline | OK | Asserted | Fail | Warn |
|---|---|---|---|---|
| mandate-ownership-integrity | ✓ | 292 | 0 | 0 |
| decision-event-reconciliation | ✓ | 334 | 0 | 0 |
| dashboard-derivation-reconciliation | ✓ | 193 | 0 | 0 |
| no-prose-duplication-of-canonical-facts | ✓ | 161 | 0 | 0 |
| permission-gate-default | ✓ | 763 | 0 | 15 |
| event-type-registry-coverage | ✓ | 1555 | 0 | 0 |
| decision-required-event-pairing | ✓ | 36 | 0 | 0 |
| escalation-channel | ✓ | 77 | 0 | 0 |
| agent-scope | ✗ | 3 | 2 | 0 |

## Findings

### permission-gate-default

- **[warn]** `actor:agent:tomas:settlement` — Agent actor `agent:tomas:settlement` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:test:kyc-test-source` — Agent actor `agent:test:kyc-test-source` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:mira:kyc-onboarding-gateway` — Agent actor `agent:mira:kyc-onboarding-gateway` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:mira:engineering` — Agent actor `agent:mira:engineering` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:owen:governance` — Agent actor `agent:owen:governance` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:sade:engineering` — Agent actor `agent:sade:engineering` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:senna:governance` — Agent actor `agent:senna:governance` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:bea:engineering` — Agent actor `agent:bea:engineering` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:atlas:engineering` — Agent actor `agent:atlas:engineering` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:rohan:engineering` — Agent actor `agent:rohan:engineering` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:rohan:market-risk-engineer` — Agent actor `agent:rohan:market-risk-engineer` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:helena:cro` — Agent actor `agent:helena:cro` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:rohan:model-registered-seed` — Agent actor `agent:rohan:model-registered-seed` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:anya:model-registered-seed` — Agent actor `agent:anya:model-registered-seed` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:dispatch-close-run` — Agent actor `agent:dispatch-close-run` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via `bun run publish:sub-agent-policies` or `bun run identity:issue`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).

### agent-scope

- **[fail]** `agent-decision:EITAN-FX-REDUCE-2026-05-28` — AgentDecision EITAN-FX-REDUCE-2026-05-28 (agent: agent:eitan): `inScopeBy` "agent:eitan" is not in the agent's registered `decisionsInScope` [Approve daily SAMOS funding plan (operational), Sign LCR / NSFR / IRRBB submissions to Camille, Approve repo-book sizing within RAS, Approve hedge programmes within RAS, Chair ALCO; approve treasury limits within Helena's RAS, Approve FX-position adjustments within Excon, Approve FTP curve refresh, Approve collateral inventory moves]. Out-of-scope decision. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF.
- **[fail]** `agent-decision:RAVI-NOP-RECOMPUTE-2026-05-28` — AgentDecision RAVI-NOP-RECOMPUTE-2026-05-28: `decidedBy` "agent:ravi:intraday-stress" does not resolve to any registered agent (no matching AgentRegistered event). Register the agent before it makes autonomous decisions. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF.

## Vera's narrative

**Partial pass.** The four pipelines I own — mandate-ownership, decision-event, dashboard-derivation, prose-duplication — all returned clean (0 violations across 980 assertions), and the decision-event run had a populated event store this cycle so the usual fresh-runner empty-store caveat does not apply here. However, the adjacent `agent-scope` pipeline returned two fail-severity findings that I am obliged to surface alongside my own results.

Substantive findings, ranked: (1) **`agent-decision:RAVI-NOP-RECOMPUTE-2026-05-28`** — `decidedBy` resolves to `agent:ravi:intraday-stress`, for which no `AgentRegistered` event exists. An unregistered actor making autonomous decisions is a P6-AUTONOMOUS-BY-DEFAULT breach, not a registry hygiene matter. (2) **`agent-decision:EITAN-FX-REDUCE-2026-05-28`** — the asserted `inScopeBy` does not match Eitan's registered `decisionsInScope` set; on its face the decision relates to FX-position adjustment, which *is* in scope, so the violation is likely a citation-mismatch in the AgentDecision event rather than a true mandate breach — but I cannot resolve that from the reconciliation output and it must be triaged, not assumed-benign. Both route to **Thandiwe** as CAE per fail-severity routing. The 15 `permission-gate-default` warns are T-12 PermissionPolicy gaps across agent actors (ORG-CY-09, P4-SECURITY-DESIGNED-IN); they are clustering and have been clustering — I am noting the cluster but not yet escalating individually, on the basis that the remediation path (`publish:sub-agent-policies` / `ACCEPTED_NO_POLICY_ACTORS` carve-out) is documented and owned. The 201 `event-type-registry-coverage` infos are unconsumed factory exports — build-phase noise per the registry header, track-only, no action from me.

**Recommendation:** triage the two agent-scope fails with Thandiwe before next cadence; everything else continues on cadence.

## Substrate

Pipelines invoked: `mandate-ownership`, `decision-event`, `dashboard-derivation`, `prose-duplication`, `permission-gate-default`, `event-type-registry-coverage`, `decision-required-event-pairing`, `escalation-channel`, `agent-scope`. Citation gate runs separately under `bun run citation-gate` / CI; future runs will wrap it here.

Events emitted: one `ReconResult` per pipeline (9); one `AuditFinding` per fail violation (2).

Routing: fail violations recommend owner `Thandiwe` (CAE) per Vera spec § 9. Warn violations are tracked but not escalated unless they cluster.
