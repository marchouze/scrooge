---
policy-parent: Secure SDLC Policy (in-force); Information Security Policy (in-force)
last-reviewed: 2026-05-15
procedureId: PROC-SDLC-TM-01
title: Threat Model Review (Secure SDLC sub-procedure)
author: Rashida (Chief Information Security Officer, governance)
date: 2026-05-15
owner: Rashida (Chief Information Security Officer, governance) · Senna (Security engineer, engineering)
status: POPULATED
policy-cited: Secure SDLC Policy (in-force); Information Security Policy (in-force)
system-capability: "@platform/security/threat-modelling (PLANNED)"
---

# Procedure — Threat Model Review (Secure SDLC sub-procedure)

**Procedure ID:** PROC-SDLC-TM-01
**Owner:** Rashida (Chief Information Security Officer, governance) — substantive owner · Senna (Security engineer, engineering) — technical execution
**Approval:** Rashida (per-model approval at each gate); BRC (policy-level annual review)
**Cadence:** On-trigger (Step 1 of `secure-sdlc.md` — concept-to-design gate); on material architecture change; annual review of approved models
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

> **Build-phase posture.** Threat modelling is one of the earliest-binding security controls: it gates every new substrate component (per `secure-sdlc.md`) and must be in place before the pre-licence go-live readiness gate, as PA / FSCA supervisory review will expect evidence of systematic threat analysis.

## 1. Source policy

Secure SDLC Policy (in-force); Information Security Policy (in-force). This procedure is the detailed expansion of Step 1 of the parent `secure-sdlc.md` procedure (threat-model gate at concept-to-design stage).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Joint Standard 2 of 2024 (Cybersecurity & Cyber Resilience) §4 | Security-by-design requirements including threat analysis as part of the design lifecycle for material systems. |
| Joint Standard 2 of 2024 §6 | Supply-chain risk; third-party component threat vectors must be assessed. |
| PA Guidance Note 1/2022 (Operational Resilience) | IBS-supporting systems must have documented threat and risk assessments as part of the operational-resilience framework. |
| POPIA s.19 | Security safeguards are to be implemented having regard to the risks; threat modelling is the standard mechanism for assessing those risks in a system context. |

## 3. Purpose

Produce a formal threat model for every new system component, integration, or material architecture change before build begins. The model identifies:

- **Trust boundaries** and data flows (STRIDE / DREAD baseline).
- **Threats** specific to the bank's context (FX settlement rails, institutional client data, cryptographic key custody, regulator data submissions).
- **Mitigations** required before production deployment (accepted into the codebase as typed `SecurityControl` events).
- **Residual risks** accepted by Rashida with rationale.

The output gates entry into the build stage of `secure-sdlc.md`; a component without an approved `ThreatModelApproved` event cannot merge to main.

## 4. Trigger

A `ThreatModelRequired { componentRef, description, ibs_overlap[], designDocRef }` event is emitted at Step 1 of `secure-sdlc.md` when a new component crosses the concept-to-design gate. Triggers also include:

- Material architecture change to an existing component (data-flow or trust-boundary change).
- Annual review of a previously approved model (Senna emits `ThreatModelReviewDue` 11 months after previous approval).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive `ThreatModelRequired`. Senna opens the threat-model artefact and populates the data-flow diagram (DFD) from the design document. | Senna | `@platform/security/threat-modelling` (PLANNED) | DFD identifies: entry points, trust boundaries, data stores, external interactors. Bank-specific trust zones: external (internet / SWIFT / JSE), DMZ, internal (event bus / HSM). |
| 2 | STRIDE analysis per trust-boundary crossing. Senna applies STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) to each identified data flow. Each threat is documented with a DREAD severity score. | Senna | `@platform/security/threat-modelling` (PLANNED) | Event: `ThreatIdentified { componentRef, threatId, stride_category, dreadScore, affectedFlow, asOf }` per threat. |
| 3 | Bank-context amplification. Rashida supplements the STRIDE output with bank-specific threat scenarios: (a) FX-settlement tampering; (b) cryptographic-key exfiltration from HSM; (c) regulatory-submission data integrity attacks; (d) institutional-client data exfiltration; (e) supply-chain injection. | Rashida | `@platform/security/threat-modelling` (PLANNED) | Each amplification scenario is a `ThreatIdentified` event with `source = bank-context-amplification`. |
| 4 | Mitigation mapping. For each identified threat, Senna proposes a mitigation: (1) existing control already in codebase; (2) new security control to be implemented before production merge; (3) compensating control with rationale and expiry; (4) risk-acceptance. | Senna | `@platform/security/threat-modelling` (PLANNED) | Event: `ThreatMitigationProposed { componentRef, threatId, mitigationType, mitigationRef, proposedBy, asOf }`. |
| 5 | Rashida review and approval. Rashida reviews the complete DFD, threat list, and mitigation mapping. Escalates to Senna for iteration on any gap. Approves or rejects the model. | Rashida | `@platform/security/threat-modelling` (PLANNED) | Event: `ThreatModelApproved { componentRef, modelRef, threatCount, mitigationCount, residualRisks[], approvedBy, asOf }` — or `ThreatModelRejected { componentRef, rejectionReason, asOf }` requiring rework. |
| 6 | Gate signal to Secure SDLC. On `ThreatModelApproved`, the Secure SDLC pipeline allows the component to proceed to the build stage. `ThreatModelRejected` blocks progress until the model is re-submitted and approved. | system (gate check) | `@platform/security/secure-sdlc-gate` (PLANNED) | The gate check is automated: no `ThreatModelApproved` for the `componentRef` → build pipeline blocked. |
| 7 | Mitigation implementation tracking. Required mitigations (type 2) are tracked as open items until the implementing PR is merged and the `SecurityControlImplemented` event is emitted. | Atlas / Senna | `@platform/security/vulnerability-management` (PLANNED) | Mitigations not implemented before production merge are blocking; Vera tracks open mitigation items against production-merge events. |
| 8 | Annual model refresh. Senna reviews the approved model against any architecture change or new threat-intelligence input; emits `ThreatModelRefreshed { componentRef, changesSummary, reapprovedBy, asOf }`. | Senna · Rashida | `@platform/security/threat-modelling` (PLANNED) | No material change → re-approval with unchanged model. Material change → re-run Steps 2–6. |

## 6. Reconciliation

- **Events produced:** `ThreatModelRequired` (upstream), `ThreatIdentified` (per threat), `ThreatMitigationProposed` (per mitigation), `ThreatModelApproved` / `ThreatModelRejected`, `ThreatModelRefreshed` (annual).
- **Reconciliation check:** (1) every component in production has a `ThreatModelApproved` event; (2) every required mitigation (type 2) has a `SecurityControlImplemented` event before the production-merge event; (3) no approved model is older than 12 months without a `ThreatModelRefreshed` event.
- **Failure mode:** production component without `ThreatModelApproved` is a Joint Standard 2 finding; Vera raises to Rashida + Devon + CEO; component is subject to emergency threat-model review.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `ThreatModelApproved` / `ThreatModelRejected` / `ThreatModelRefreshed` | Event log (P1) | Indefinite | Internal — security |
| `ThreatIdentified` (per threat) | Event log (P1) | Indefinite | Confidential — security |
| DFD and STRIDE analysis document | Owner Inbox + artefact store | For component lifetime + 5 years | Confidential — high |
| Residual-risk register (per `ThreatModelApproved.residualRisks[]`) | `@platform/security/vulnerability-management` (PLANNED) | For component lifetime + 5 years | Confidential — security |

## 8. Manual steps

- DFD construction (Step 1): Senna draws the data-flow diagram with manual input from Atlas (for substrate components) and the responsible engineer.
- Bank-context amplification (Step 3): Rashida applies judgment on bank-specific threat scenarios relevant to the component's function.
- Rashida review (Step 5): approval requires Rashida's sign-off; this is a non-delegatable governance act captured as a typed event.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Component in production without `ThreatModelApproved` | Vera recon: `ProductionDeployEvent` without matching `ThreatModelApproved` | Rashida + Devon + CEO; emergency threat-model review; component quarantine if high-risk |
| Required mitigation not implemented before production merge | Vera recon: open `ThreatMitigationProposed` (type 2) at merge time | Atlas + Rashida; merge blocked; PR fails CI gate |
| Annual model refresh overdue | Vera recon: `ThreatModelApproved` older than 12 months without `ThreatModelRefreshed` | Senna → Rashida; review scheduled within 30 days |
| `ThreatModelRejected` without resubmission within 5 business days | Vera recon: open rejection without re-submission | Rashida → Devon; component-build paused |

## 10. Related procedures

- [`secure-sdlc.md`](secure-sdlc.md) — parent procedure; this is the detailed expansion of Step 1 (threat-model gate).
- [`change-management.md`](change-management.md) — material architecture changes that trigger re-threat-modelling route through change management first.
- [`patch-cadence.md`](patch-cadence.md) — vulnerabilities discovered during threat modelling that affect existing components feed the patch-cadence pipeline.
- [`incident-response.md`](incident-response.md) — if a threat scenario identified in a model is exploited, the IR pipeline activates.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-15 | Rashida + Senna (via Scrooge) | Initial POPULATED procedure. STRIDE/DREAD methodology; bank-context amplification scenarios; gating integration with Secure SDLC; annual refresh cadence. |

## 12. Audit / assurance

- Vera continuous-controls pipeline `@platform/recon/threat-model-coverage` (PLANNED) tests: all production components have approved models; no required mitigations outstanding at merge; annual refresh on cadence.
- Rashida presents the threat-model coverage metrics (components with current approved models; open mitigations; models due for refresh) to the Risk Forum quarterly.
- Annual independent review of the threat-modelling methodology by Senna against OWASP Threat Dragon / STRIDE evolution; methodology updates routed through Rashida approval.
- Board Risk Committee receives a summary of material threat models approved and any T1/T2 residual risks accepted during the year.
