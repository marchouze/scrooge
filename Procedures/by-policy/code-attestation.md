---
policy-parent: Code of Conduct Policy (planned) · Owner Inbox/2026-05-06_core-policies-compliance-conduct.md
last-reviewed: 2026-05-16
procedureId: PROC-COND-CA-01
title: Annual code of conduct attestation
author: Owen (Company Secretary, governance) · Sade (AgentOps & token efficiency engineer)
date: 2026-05-16
owner: Owen (Company Secretary, governance) · Sade (AgentOps & token efficiency engineer)
status: POPULATED
policy-cited: Code of Conduct Policy (planned) · Owner Inbox/2026-05-06_core-policies-compliance-conduct.md
system-capability: "@platform/conduct/attestation-engine (PLANNED)"
---

# Procedure — Annual code of conduct attestation

**Procedure ID:** PROC-COND-CA-01
**Owner:** Owen (Company Secretary, governance) · Sade (AgentOps & token efficiency engineer)
**Approval:** CEO (annual attestation cycle approval) · Owen (attestation register)
**Cadence:** Annual (1 January — cycle opens; 31 January — deadline)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Code of Conduct Policy (planned; Owen to author; load-bearing at pre-licence go-live readiness gate).
- `Owner Inbox/2026-05-06_core-policies-compliance-conduct.md` §1 — Code of Conduct.
- FAIS General Code of Conduct (Board Notice 80 of 2003) — representatives of FSPs must act honestly and with integrity.

The obligation chain:

```
Regulation (FAIS General Code s.2 / FMCA s.78 / Banks Act s.60)
  → Code of Conduct Policy
    → PROC-COND-CA-01 (this procedure — annual attestation)
      → @platform/conduct/attestation-engine (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FAIS-01` (FAIS General Code of Conduct BN 80/2003 s.2 — general obligations) | All representatives must at all times act honestly, with integrity, and in the interests of clients. Annual attestation is the mechanism for confirming continued adherence. |
| `ORG-MKT-06` (FMCA s.78 — market conduct) | Persons authorised under the FMCA must maintain codes of conduct aligned with the FSCA's market integrity standards. |
| `ORG-PR-10` (Banks Act s.60 — risk management) | Board is responsible for conduct risk; annual attestation is a control within the conduct risk framework. |
| `ORG-CND-01` (PRECCA — conduct obligations) | Anti-corruption attestation is embedded in the code of conduct; PRECCA s.34 duty-to-report is acknowledged in each attestation. |

## 3. Purpose

Ensure all team members — human and agent — annually confirm that they have read, understood, and will comply with the bank's Code of Conduct. For agents: attestation is an automated event emitted by each agent's runtime confirming that the code is embedded in their operating spec (Team/ file) and that no conflicts or exceptions have been identified. For humans: manual attestation via the intranet. The attestation register provides the auditable record.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| Annual scheduler (agent tick, 1 January): attestation cycle opens | Full cycle — Steps 1–7 |
| New agent deployed (new `AgentRegistered` event) | On-boarding attestation — Steps 2–3 (agent) or Steps 4–5 (human) |
| Material Code of Conduct update | Out-of-cycle attestation — Steps 1–7 (full cycle) |
| `ConductIncidentIdentified` event | Breach investigation — Step 7 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Cycle open.** Sade emits `ConductAttestationCycleOpened { year, deadline, agentCount, humanCount }`. The attestation engine sends notifications to all agents (via their runtime trigger channel) and all human team members (via the intranet). Owen confirms the Code of Conduct text in effect for the year (version hash). | `agent` (Sade) | `@platform/conduct/attestation-engine` (`PLANNED`) | If the Code of Conduct was updated since the last attestation cycle, Owen confirms the current version hash; the attestation references the specific version being attested to. |
| 2 | **Agent attestation — operating spec check.** For each registered agent: the agent runtime (AgentRunner) automatically verifies that: (a) the agent's Team/ operating spec contains the Code of Conduct section; (b) the conduct provisions are current (match the version hash from Step 1); (c) no conflicts or exceptions are recorded in the agent's operating spec. | `system` (AgentRunner) | `@platform/agent-runtime/agent-runner` ✓ | AgentRunner is the automation substrate (landed in S8 Tier 1); it can introspect each agent's operating spec. If the spec lacks the conduct section: the agent is flagged as non-compliant and Sade notified. |
| 3 | **Agent attestation event emission.** For each compliant agent: the agent runtime emits `AgentConductAttestation { year, agentId, agentName, conductVersionHash, specVersionHash, attestedAt, conflicts: [] }`. For non-compliant agents: Sade updates the agent's operating spec and re-runs the check. | `system` (per-agent) | `@platform/conduct/attestation-engine` (`PLANNED`) | Conflicts: if any agent's operating spec records a potential conflict with the code (e.g. a constraint that limits reporting obligations), that conflict is logged and escalated to Owen. |
| 4 | **Human attestation — intranet workflow.** Each human team member receives an intranet notification with: (a) link to the current Code of Conduct; (b) attestation form (declaration of no conflicts, no breaches, acknowledgement of PRECCA s.34 duty-to-report); (c) deadline (31 January). | `system` | `@platform/intranet` (`PLANNED`) | Build-phase: no human employees yet (operating model `project_ai_driven_bank.md`). At licence-day, the human attestation path activates. The procedure covers both paths from day one. |
| 5 | **Human attestation recording.** Each human's signed attestation is recorded: `HumanConductAttestation { year, personId, name, role, conductVersionHash, attestedAt, declarationHash }`. The signed attestation document is archived in the RMS document store. | `system` | `@platform/conduct/attestation-engine` (`PLANNED`) + `@platform/rms/document-store` (`PLANNED`) | Wet signature or advanced electronic signature required for humans (ECTA discipline per `contract-execution.md` PROC-LEG-CE-01). |
| 6 | **Register compilation.** By 5 February: Owen compiles the attestation register — all agents and humans who have attested; outstanding attestations; exceptions; conflicts. Emit `ConductAttestationRegisterCompiled { year, totalExpected, attested, outstanding, conflicts[], exceptions[] }`. | `agent` (Owen) | `@platform/conduct/attestation-engine` (`PLANNED`) | Outstanding attestations after 31 January are escalated: agents → Sade + Helena (CRO, governance); humans → line manager + Owen + CEO. |
| 7 | **Exception and breach reporting.** Any conflict or breach disclosed in an attestation is assessed by Owen + Zara (Chief Compliance Officer, governance): (a) low-risk conflict → noted in register, managed; (b) high-risk conflict or disclosed breach → investigation opened; (c) PRECCA s.34 breach → FIC/DPCI reporting per `abc-due-diligence.md` (PROC-COND-ABC-DD-01). Emit `ConductConflictAssessed { year, subjectId, conflictType, disposition }`. | `agent` (Owen) + `agent` (Zara) | `@platform/conduct/attestation-engine` (`PLANNED`) | Conflicts disclosed in attestation are self-reported; they are treated less severely than concealed conflicts discovered through other means. Disclosure is actively encouraged. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Owen (Company Secretary, governance) | Attestation cycle governance; register compilation; exception and breach assessment; Code of Conduct version management |
| Sade (AgentOps & token efficiency engineer) | Agent attestation automation; non-compliant agent remediation; agent-runtime integration |
| Zara (Chief Compliance Officer, governance) | Co-assesses conflicts and breaches (Step 7) |
| CEO | Approves annual attestation cycle; notified of outstanding attestations and material conflicts |
| Each agent (via runtime) | Automated self-attestation via AgentRunner; operating spec maintenance |
| Each human (at licence-day) | Manual attestation; conflict disclosure |

## 7. Escalation

| Scenario | Escalation path |
|---|---|
| Agent attestation not completed by 31 January | Sade → Owen → CEO; agent suspended from operations until attestation complete |
| Human attestation outstanding after 31 January | Owen → line manager → CEO; access restricted until attestation complete |
| Material conflict disclosed | Owen + Zara assess; if unresolvable → CEO decision; disclosed to BRC if material |
| Breach of Code of Conduct identified | Owen + Zara + CEO; investigation; disciplinary (humans) or operating-spec remediation (agents); PRECCA s.34 if applicable |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/conduct/attestation-engine` | PLANNED | Cycle management, notifications, register compilation |
| `@platform/agent-runtime/agent-runner` | ✓ live | Agent spec introspection; attestation event emission |
| `@platform/intranet` | PLANNED | Human attestation workflow |
| `@platform/rms/document-store` | PLANNED | Human signed attestation archive |

## 9. Quality controls

- Vera recon: every registered agent has a current-year `AgentConductAttestation` event by 31 January.
- Vera recon: `ConductAttestationRegisterCompiled` event present for each year by 5 February.
- Vera recon: every `ConductConflictAssessed` event has a disposition within 10 business days.
- Owen: annual review of Code of Conduct to confirm currency; version update triggers an out-of-cycle attestation if changes are material.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `ConductAttestationCycleOpened`, `AgentConductAttestation`, `HumanConductAttestation`, `ConductAttestationRegisterCompiled`, `ConductConflictAssessed` events | Event log (P1) | 7 years | Confidential |
| Human signed attestation forms | RMS document store | 7 years | Confidential |
| Attestation register (annual) | RMS register projection | 7 years | Restricted |
| Conflict and breach assessment records | RMS document store | 10 years | Legal-confidential |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Owen + Sade | Initial draft — PLANNED → POPULATED; full 11-section procedure; agent attestation via AgentRunner; human attestation (activates at licence-day); conflict disclosure and breach pathway. |

## 12. Audit / assurance

- **Vera (annual):** attestation completeness recon; conflict-assessment timeliness; register vs agent registry reconciliation.
- **Thandiwe (CAE, governance):** annual conduct audit; sample testing of attestations and conflict disclosures; opinion to BRC.
- **FSCA (conduct supervision):** may request attestation register during FAIS or FMCA conduct review.
