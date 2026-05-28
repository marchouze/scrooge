---
agent: Vera
trigger: overnight-recon
asOf: 2026-05-28T05:42:04.316Z
decision-required: false
---

# Vera — overnight recon, 2026-05-28

Autonomous run of Vera's continuous-controls pipelines per `Team/Vera.md` operating spec § 6 (Cadence) and § 7 (Triggers). Run by the agent runtime; no human-in-the-loop.

**Headline:** PASS — 3318 assertions; 0 fail violations; 14 warn violations across 9 pipelines.

## Pipeline results

| Pipeline | OK | Asserted | Fail | Warn |
|---|---|---|---|---|
| mandate-ownership-integrity | ✓ | 292 | 0 | 0 |
| decision-event-reconciliation | ✓ | 324 | 0 | 0 |
| dashboard-derivation-reconciliation | ✓ | 185 | 0 | 0 |
| no-prose-duplication-of-canonical-facts | ✓ | 161 | 0 | 0 |
| permission-gate-default | ✓ | 732 | 0 | 14 |
| event-type-registry-coverage | ✓ | 1511 | 0 | 0 |
| decision-required-event-pairing | ✓ | 36 | 0 | 0 |
| escalation-channel | ✓ | 76 | 0 | 0 |
| agent-scope | ✓ | 1 | 0 | 0 |

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

## Vera's narrative

**PASS** on the four reconciliation pipelines I own — mandate-ownership (292/0), decision-event (324/0), dashboard-derivation (185/0), and prose-duplication (161/0) all clean against canonical sources. Worth noting: decision-event reconciled fully this run, so the usual empty-event-store substrate condition on a fresh GitHub Actions runner did not bite — either the runner inherited state or the relevant decisions were resolvable from event-store contents present at recon time. Either way, no substrate-context noise to discount.

Two adjacent pipelines surface findings underneath. The **permission-gate-default** check raised 14 warn-severity violations: agent actors (`agent:tomas:settlement`, `agent:mira:engineering`, `agent:helena:cro`, `agent:rohan:market-risk-engineer`, and ten others) appended events without a published `PermissionPolicy`, contrary to T-12 enforcement under P4-SECURITY-DESIGNED-IN and ORG-CY-09 (ref: Owner Inbox 2026-05-10 Senna/Rashida agent-runtime substrate threat model, T-01; my own F-031/F-011). This is a real cluster — fourteen sub-agents on a single principle is the third recon in a row showing the same pattern; it needs publishing via `publish:sub-agent-policies` or an explicit `ACCEPTED_NO_POLICY_ACTORS` carve-out with citation. The **event-type-registry-coverage** check surfaced 207 info-level findings — factories exported in `event-types.ts` with no in-tree consumer (per Owner Inbox 2026-05-10 my codebase-quality-review F-032; P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE). At info severity these are housekeeping, not a control failure, but the volume is large enough that schema-freeze hygiene is drifting from the A0 freeze intent (Owner Inbox 2026-05-07 Atlas/Kai).

Routing: the 14 permission-policy warns are clustering now and cross my own prior findings — escalating to Thandiwe as a fail-track item even at warn severity, because three consecutive recons constitute a pattern. The 207 info-level dead-factory items stay in-track without escalation; they belong with Atlas as schema-registry owner via normal cadence. Recommend: continue overnight cadence, and Thandiwe to task an owner (Senna or Rashida) to either publish the missing sub-agent PermissionPolicies or register the carve-outs this week.

## Substrate

Pipelines invoked: `mandate-ownership`, `decision-event`, `dashboard-derivation`, `prose-duplication`, `permission-gate-default`, `event-type-registry-coverage`, `decision-required-event-pairing`, `escalation-channel`, `agent-scope`. Citation gate runs separately under `bun run citation-gate` / CI; future runs will wrap it here.

Events emitted: one `ReconResult` per pipeline (9); one `AuditFinding` per fail violation (0).

Routing: fail violations recommend owner `Thandiwe` (CAE) per Vera spec § 9. Warn violations are tracked but not escalated unless they cluster.
