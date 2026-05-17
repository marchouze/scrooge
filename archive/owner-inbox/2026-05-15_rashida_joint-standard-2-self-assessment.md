---
title: "Joint Standard 2 of 2024 — Cybersecurity Self-Assessment"
author: Rashida (Chief Information Security Officer, governance)
date: 2026-05-15
decision-required: false
tags: [cybersecurity, joint-standard-2, ciso, governance, compliance]
---

# Joint Standard 2 of 2024 — Cybersecurity Self-Assessment

**Author:** Rashida (Chief Information Security Officer, governance)
**Date:** 2026-05-15
**Authority:** Principle 4 (Security designed in from the start); Joint Standard 2 of 2024 (PA/FSCA Joint Standard on Cybersecurity and Cyber Resilience Requirements); `Team/Rashida.md` § Cadence (quarterly programme review).
**Obligation anchors:** `ORG-BNK-CYBER-CONS` (consolidated cyber-resilience programme); `ORG-CY-01` through `ORG-CY-18` (Joint Standard 2 of 2024 obligation rows in `Regulations/_obligations-register.md`).

---

## 1. Assessment scope and status

Joint Standard 2 of 2024 is issued jointly by the Prudential Authority (PA) and the Financial Sector Conduct Authority (FSCA). It applies to all financial institutions regulated by either authority. As a bank-in-formation, the obligation binds at **commencement-of-trading** — not at this assessment date. The pre-licence build phase is the runway for installing rehearsed-readiness so that the programme is fully operational on switch-to-live. This document does not assert current compliance; it records the current posture against each domain and identifies the gaps that must close before commencement.

**Assessment coverage:** all five JS-2 domains — Governance, Identify, Protect, Detect, Respond and Recover — evaluated against the build-phase substrate as of 2026-05-15. Evidence drawn from: `Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md`; `Owner Inbox/2026-05-11_senna_security-substrate-state.md`; `Owner Inbox/2026-05-07_senna_state-of-platform-note-to-rashida.md`; `Owner Inbox/2026-05-11_rashida_cyber-resilience-snapshot.md`; `Regulations/_obligations-register.md` (ORG-CY-* rows).

**Binding date:** commencement-of-trading (date TBD; controlled by pre-licence go-live readiness gate, co-owned with Saskia and Devon (Chief Operating Officer, governance)).

---

## 2. Domain 1: Governance

### 2.1 CISO role and mandate

The CISO role is constituted. Rashida is the named accountable officer for cybersecurity and information security under Joint Standard 2 of 2024, reporting directly to the CEO (Marc). The mandate covers: information security and cyber-resilience policy ownership; the Joint Standard 2 programme (named accountability to PA and FSCA); the POPIA s.19–22 operational-security seam (partnered with Iris (Information Officer, governance)); threat-modelling and design-review gate; cyber and operational-resilience scenario testing; cryptographic-key governance; third-party / supply-chain security governance; incident command and the regulator interface for cyber events; and the combined-assurance interface with Vera (Audit Engineering, engineering) and Thandiwe (Chief Audit Executive, governance). The role brief is at `Team/Rashida.md`.

### 2.2 Information security policy status

The Information Security Policy and Cyber Resilience Policy were included in the core-policies batch authored in the build phase (per `Owner Inbox/2026-05-06_core-policies-infosec-ops.md`). These policies are first-draft versions — structurally complete with obligation citations but not yet ratified through the formal board/AC approval path (no Board Audit Committee exists in the build phase; interim approval authority rests with the CEO). Gap: **policies require a formal ratification event and a dated next-review schedule at governance level** (medium severity; target: pre-commencement).

### 2.3 Board and senior-management accountability

In the build phase, Marc (CEO) wears both the executive CEO hat and the interim board hat. Full board constitution (independent NEDs, Board Audit Committee) is a licence-day milestone, not a build-phase deliverable. Current accountability chain: CISO → CEO (Marc), who exercises interim board-level cyber-oversight. Joint Standard 2 requires senior-management accountability — that accountability is documented but the governance forum (BAC) that would formally receive the quarterly cyber-resilience report does not yet exist. **Gap: no standing governance forum to receive the CISO quarterly report** (medium severity; closes at licence-day with BAC constitution).

### 2.4 Risk appetite integration

Helena (Chief Risk Officer, governance) owns the Risk Appetite Statement (RAS). The RAS includes cyber-tier model B6 (T1–T4), calibrated for a SARB-licensed trading bank's cyber risk appetite. The severity calibration in the agent-runtime substrate threat model (`Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md`) anchors directly to the RAS B6 tier model. The CISO–CRO interface is operating at agent-spec level; formal joint Risk Forum cyber reporting (quarterly, per `Team/Rashida.md` § Cadence) is rehearsed but not yet running against live event flows. This integration is rated **adequate for build phase; go-live gate requires the first live joint Risk Forum report**.

---

## 3. Domain 2: Identify

### 3.1 Asset inventory

The primary information assets at this stage are: the autonomous AI agent fleet (27 agents registered in the agent runtime), the Anthropic API key (critical asset — the bank's primary compute interface), the local event store (`.local/event.db` — the single source of truth per Principle 1), agent identity keys (Ed25519 private keys in `.local/keys/<urn>.json`), substrate code (monorepo), and the CI/CD pipeline.

Agents-as-information-assets is a novel asset class. Each agent holds decision authority within its mandate scope (`AgentDecision` events), has cryptographic identity, and produces audit-trail events. The agent runtime registers them via `AgentRegistered` events — this doubles as the asset registry for agents. A formal ITAM (IT Asset Management) register for all substrate asset classes (AI agents, API tokens, key material, infrastructure, data stores) is not yet established as a standalone artefact. **Gap: no unified ITAM register across all asset classes** (medium severity; build-phase target).

The Anthropic API key is treated as a critical asset: stored in the environment only, never logged, never embedded in events (per Senna's (Security Architecture, engineering) platform convention and confirmed in `Owner Inbox/2026-05-07_senna_state-of-platform-note-to-rashida.md`). No formal key-criticality classification register exists yet.

### 3.2 Threat modelling cadence

A threat-model gate is operating. Senna (Security Architecture, engineering) runs STRIDE/LINDDUN analyses against substrate components; Rashida signs exceptions. One formal threat model has been executed: the agent-runtime substrate threat model (2026-05-10), cataloguing 12 threats (1 Critical, 5 High, 4 Medium, 2 Low). The gate is wired — `ThreatModelExceptionRequested` events trigger a 5-working-day decision SLA.

Gaps: threat-model artefacts are not stored in a dedicated `security/threat-models/` directory (noted as a substrate gap in `Owner Inbox/2026-05-11_senna_security-substrate-state.md`). No `ThreatModelGateDecision` events have been emitted to date (count = 0 across all snapshots). **Gap: threat-model artefact store not established; gate has not been exercised to the point of producing a gate-decision event** (medium severity; build-phase target).

### 3.3 Risk register integration

Cyber risks are partially indexed in the obligations register (`ORG-CY-*` rows: 18 rows as of 2026-05-11). The agent-runtime threat model maps its 12 threats to specific `ORG-CY-*` obligation rows. The broader IT/cyber risk register (distinct from the obligations register) is not yet a standalone deliverable. Integration with Helena's risk taxonomy (94 codes, live since 2026-05-11) is planned but not yet executed at the substrate level. **Gap: no standalone cyber risk register integrated with the broader risk taxonomy** (medium severity; build-phase target, co-owned with Helena).

---

## 4. Domain 3: Protect

### 4.1 Controls in place (build phase)

The following protective controls are active in the build-phase substrate:

**Credential and secret management.** The Anthropic API key is held in the environment only, never serialised into events, never logged via pino. This is the primary sensitive credential. The convention is enforced at the application layer (Senna's platform code) but not yet enforced by a automated secrets-scan gate that would block a merge introducing a token commit. The CI pipeline includes a secret-scan gate — this is the mechanical enforcement layer.

**Zero-trust design intent.** Zero-trust is the stated design posture (Principle 4). The agent-identity substrate implements zero-trust primitives: every agent has a cryptographic identity (Ed25519), signed tokens scoped to capabilities, and a permission policy (`PermissionPolicyPublished` events) defining what events each agent may emit. The permission gate (`PermissionGate`) exists and is well-formed. **Critical gap: the permission gate defaults to off (`BANK_PERMISSION_GATE_ENABLED=false`), meaning the zero-trust enforcement layer is currently advisory** (T-01 in the threat model; Critical severity; immediate build-phase target for Atlas).

**Least-privilege.** Per-agent `eventEmitAllowList` and `capabilityAllowList` are derived from the agent spec — structurally sound. Two of the four allow-list axes (`eventSubscribeAllowList`, `registerWriteAllowList`) return empty arrays due to a parser gap (T-03 in the threat model; High severity). Until those axes are populated and the gate is on, least-privilege is partial.

**Secure SDLC.** CI gates include: typecheck, lint, test, citation-gate, and 20 recon pipelines (as of 2026-05-11). SAST, SCA (dependency scan), and secret-scan are present in the pipeline per Senna's state-of-platform note. Signed-artefact deploy and SLSA-aligned provenance generation are in place. DAST is scaffolded with a minimal ruleset. SCA does not yet hard-block on critical CVE (raises a finding only). **Gap: DAST ruleset needs CISO standard before it widens; SCA CVE block needs escalation to hard-block** (medium severity; build-phase target).

**Cryptographic key management.** Agent identity keys are Ed25519 private keys stored at `mode 0600` in `.local/keys/<urn>.json`. Azure Key Vault Managed HSM (FIPS 140-2 Level 3) is the production target — the interface seam is HSM-shaped and the swap is a one-shot at the M8 cloud lift. Local substrate uses softHSM with a PKCS#11 façade. Key-rotation events (`IdentityKeyRotated`) are wired but the scheduler is not yet wired to call rotation on the documented cadence (7d local, 24h production). **Gap: no scheduled key-rotation cadence active; local FS key store is a soft target pre-M8 HSM lift** (High severity; target: pre-commencement for rotation cadence; M8 cloud lift for HSM).

### 4.2 Key gaps summary

The most material protective-control gap is the permission-gate default-off posture (T-01, Critical). Until the gate is default-on, the zero-trust architecture is designed but not enforced. All other protective controls in this domain are at build-phase-appropriate maturity.

---

## 5. Domain 4: Detect

### 5.1 Detection capability in place

**Structured logging.** The platform uses pino structured logging throughout the substrate. Log lines are machine-parseable and can be ingested by a SIEM when one is provisioned.

**Recon pipelines.** Vera's recon harness runs 20 pipelines including: `permission-gate-default` (detects if the gate is switched to non-default); `decision-event-recon` (decisions without paired events); `prose-duplication` (canonical-source drift); `agent-spec-cross-link` (agent-spec integrity); and `runtime-handler-sync` (handler registry drift). These are the closest thing to continuous-controls monitoring in the current build phase. The recon pipelines run on Vera's cadence (Thursday 07:37 UTC, weekly) — not in real time.

**Swallowed-error recon.** A dedicated recon for swallowed errors is listed in Senna's artefact (`recon:parallel-dispatch-divergence`). This provides a degree of anomaly detection for agent-dispatch failures.

**`SubstrateAlert` events.** The permission gate, bus, and identity issuer are all wired to emit `SubstrateAlert` events on anomalous conditions. These land in the event log and are queryable. There is no real-time subscriber consuming them.

### 5.2 Detection gaps

There is currently **no SIEM**. No centralised Security Information and Event Management platform is provisioned. All detection runs via periodic recon pipelines and manual event-log queries. There is **no anomaly detection** on agent behaviour (unusual event volumes, out-of-hours runs, unexpected event type sequences). There is **no real-time alerting** — SubstrateAlerts accumulate in the event log but do not trigger notifications. There is **no EDR or XDR** on the substrate hosts.

The combination of no SIEM + no real-time alerting means the dwell time for a security event is bounded by the recon cadence (up to 7 days) plus manual query time. For a build-phase with no real customer data this is tolerable; for a live bank this is not. **Gap: no SIEM, no real-time alerting, no anomaly detection** (High severity; target: before commencement-of-trading; Azure Sentinel is the production target per Rashida's domain expertise in `Team/Rashida.md` § Areas of expertise).

---

## 6. Domain 5: Respond and Recover

### 6.1 Incident response status

A full Incident Response Plan is not yet drafted. The procedure route is `Procedures/by-policy/incident-response.md` — this file is referenced in the threat model (as "extend" status for the agent-identity-compromise runbook) but has not been authored as a standalone procedure. The threat model identifies the IR procedure as a T-04 mitigation item. The CISO mandate (`Team/Rashida.md` § Mandate) includes incident command and the regulator interface for cyber events; the standing capability exists but the procedure document does not.

Event-triggered incident response is partially wired: `SecurityIncidentRaised` events trigger Rashida's handler (severity rating within 30 min; incident command per severity tier — per `Team/Rashida.md` § Triggers). The PA/FSCA notification path is designed (Joint Standard 2 of 2024 reportable events trigger the regulator-notification flow) but not tested against a real event. **Gap: IR plan not drafted; PA/FSCA notification pathway not rehearsed end-to-end** (High severity; target: build-phase, before commencement).

### 6.2 Disaster recovery and business continuity

A DR environment is not yet provisioned. The Azure production environment is the target; local substrate is the current environment. There is no secondary site, no RTO/RPO formally declared, no DR test executed. The bank's event-store design (append-only, content-addressed) is inherently restorable from a backup of the event log — but no backup procedure is formalised and no restore test has been run. **Gap: no DR environment, no documented RTO/RPO, no backup procedure, no restore test** (High severity; target: M8 cloud lift milestone for DR environment; backup procedure and RTO/RPO declaration are pre-commencement items).

### 6.3 Cyber resilience scenario testing

Scenario testing cadence is rehearsed against synthetic flows (per `Team/Rashida.md` § Cadence: monthly cyber-resilience scenario rehearsal). No live scenario test has been executed — the substrate is build-phase only. The scenario-test plan has not been formally documented as a procedure. **Gap: scenario test plan not documented; first live scenario test not executed** (medium severity; build-phase target).

---

## 7. Gap register summary

| Gap ID | Domain | Description | Severity | Target closure |
|--------|--------|-------------|----------|----------------|
| GAP-JS2-01 | Protect — Governance | Permission gate default-off: zero-trust enforcement is advisory (`BANK_PERMISSION_GATE_ENABLED=false`) | **High** | Build-phase / next A1-hardening sprint (Atlas) |
| GAP-JS2-02 | Protect | Agent key rotation not scheduled; local FS key store pre-HSM | **High** | Rotation cadence: build-phase; HSM lift: M8 cloud lift |
| GAP-JS2-03 | Detect | No SIEM, no real-time alerting, no anomaly detection | **High** | Pre-commencement (Azure Sentinel target) |
| GAP-JS2-04 | Respond | Incident Response Plan not drafted; PA/FSCA notification path not rehearsed end-to-end | **High** | Build-phase (before commencement) |
| GAP-JS2-05 | Recover | No DR environment, no RTO/RPO, no backup procedure, no restore test | **High** | DR environment: M8 cloud lift; RTO/RPO + backup: pre-commencement |
| GAP-JS2-06 | Identify | No unified ITAM register across all asset classes | **Medium** | Build-phase target |
| GAP-JS2-07 | Identify | Threat-model artefact store not established; no `ThreatModelGateDecision` events yet emitted | **Medium** | Build-phase target (Senna) |
| GAP-JS2-08 | Identify | No standalone cyber risk register integrated with risk taxonomy | **Medium** | Build-phase target (Rashida + Helena) |
| GAP-JS2-09 | Governance | Policies not ratified through a formal governance forum; no BAC yet constituted | **Medium** | Policy ratification: build-phase (CEO interim); BAC: licence-day |
| GAP-JS2-10 | Protect | SCA CVE block not escalated to hard-block; DAST ruleset not set to CISO standard | **Medium** | Build-phase target (Senna, requires CISO standard input from Rashida) |

**Mitigation ownership.** Gaps 01–02 route to Atlas (substrate) and Senna (procedures). Gaps 03, 05 route to Atlas (Azure lift, M8) and Devon (DR framework). Gap 04 routes to Rashida (IR plan authorship) and Owen (Company Secretary, governance) (procedure framing). Gaps 06–10 are CISO-owned with the named co-owners above.

---

## 8. Next review

This self-assessment will be refreshed at Rashida's next quarterly Joint Standard 2 programme review tick (per `Team/Rashida.md` § Cadence). The specific refresh triggers are: (a) any `SecurityIncidentRaised` event that meets the JS-2 reportability threshold; (b) any `ThreatModelGateDecision` event that changes the residual-risk posture; (c) the M8 cloud-lift milestone completion (will close GAP-JS2-02, GAP-JS2-05 in part); (d) any regulator enquiry (`RegulatorCyberInquiry` event) that requires a current posture statement.

The gap register above is the live input to Helena's risk register integration (GAP-JS2-08) and to the pre-licence security-readiness gate (co-owned with Saskia and Devon).

---

*Authored by Rashida (Chief Information Security Officer, governance) — 2026-05-15. Evidence base: event log queries, obligations-register ORG-CY-* rows, Senna's security-substrate-state snapshots, the agent-runtime substrate threat model (2026-05-10), and Senna's state-of-platform note (2026-05-07). This document is the quarterly programme review deliverable per `Team/Rashida.md` § Cadence. Next tick: next quarterly programme review handler run.*
