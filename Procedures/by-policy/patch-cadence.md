---
procedureId: PROC-IS-PC-01
title: Vulnerability Management — Patch Cadence
author: Senna (CISO, governance)
date: 2026-05-15
owner: Senna (CISO, governance) · Devon (COO, governance)
status: POPULATED
policy-cited: Information Security Policy (in-force); Cyber Resilience Policy (in-force)
system-capability: "@platform/security/vulnerability-management (PLANNED)"
---

# Procedure — Vulnerability Management — Patch Cadence

**Procedure ID:** PROC-IS-PC-01
**Owner:** Senna (CISO, governance) — substantive owner · Devon (COO, governance) — operational availability and change-window coordination
**Approval:** Board Risk Committee (or Interim Audit Forum during build phase)
**Cadence:** Continuous (critical patches); weekly (high); monthly (medium / low); quarterly cadence review
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

> **Build-phase posture.** The vulnerability-management obligation (Joint Standard 2 of 2024) binds at commencement-of-trading; the patch-cadence procedure is also a prerequisite for the Secure SDLC control (`secure-sdlc.md`) and the DR test (`dr-test-execution.md`). It must be production-grade by the pre-licence go-live readiness gate.

## 1. Source policy

Information Security Policy (in-force); Cyber Resilience Policy (in-force). Patch deployment routes through the change-management procedure (`change-management.md`); this procedure defines the vulnerability-identification-to-patch-deployment cadence that feeds the change pipeline.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Joint Standard 2 of 2024 (Cybersecurity & Cyber Resilience) §§4–5 | Vulnerability management programme: identification, assessment, prioritisation, remediation, and verification of security vulnerabilities across all systems. |
| Joint Standard 2 of 2024 §6 | Third-party / supply-chain patch discipline included in the vulnerability-management scope. |
| PA Guidance Note 1/2022 (Operational Resilience) | Patch cadence must align with IBS impact tolerance; critical systems patched within defined SLA. |
| BCBS Operational Resilience (2021) §25 | Technology infrastructure supporting IBS must be maintained at vendor-supported patch levels. |

## 3. Purpose

Define the cadence at which the bank identifies, triages, and remediates known vulnerabilities in its technology estate. The procedure ensures:

- Critical vulnerabilities (CVSS ≥ 9.0) are patched or mitigated within 24 hours.
- High vulnerabilities (CVSS 7.0–8.9) are patched within 7 days.
- Medium vulnerabilities (CVSS 4.0–6.9) are patched within 30 days.
- Low vulnerabilities (CVSS < 4.0) are patched within 90 days or deferred with documented risk-acceptance.

The cadence is the upstream input to the change-management pipeline (`change-management.md`), which governs the deployment mechanics; this procedure governs the vulnerability-identification-to-remediation-decision step.

## 4. Trigger

Vulnerability events enter the pipeline from three sources:
1. **Automated scanning:** continuous scanner emits `VulnerabilityDetected { cveId, cvssScore, affectedAsset[], detectedAt }` on each new finding.
2. **Vendor advisory:** Atlas or Rashida emits `VendorAdvisoryReceived { advisoryRef, cvssScore, affectedComponent[], receivedAt }` when a vendor advisory arrives.
3. **Penetration test / red team:** Senna emits `PenTestFindingRaised { findingRef, severity, affectedAsset[], raisedAt }` on close of each exercise.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive vulnerability signal. Triage incoming `VulnerabilityDetected` / `VendorAdvisoryReceived` / `PenTestFindingRaised` events. Confirm CVSS score; cross-reference with the bank's asset inventory to determine IBS exposure. | Senna · Rashida | `@platform/security/vulnerability-management` (PLANNED) | IBS-exposed assets are escalated one severity tier (e.g., medium → high) if the affected asset is in the IBS critical path. |
| 2 | Assign remediation SLA. Apply the SLA matrix below; record `VulnerabilityTriaged { vulnRef, cvssScore, ibsExposed, effectiveSeverity, remediationDeadline, assignedTo, asOf }`. | Senna | `@platform/security/vulnerability-management` (PLANNED) | The `remediationDeadline` field is the binding SLA endpoint tracked by Vera. |
| 3 | Develop patch / mitigation. Atlas (substrate) or Rashida (third-party components) implements the patch or — where a patch is unavailable — a documented compensating control. | Atlas / Rashida | `@platform/platform/patch-deploy` (PLANNED) | Compensating controls require Senna sign-off and are time-limited; they do not reset the SLA clock. |
| 4 | Change-management submission. Submit the patch as a change request to `change-management.md` with `urgency` set to the effective severity. Critical changes route to the emergency-change path (no deferred approval window). | Atlas / Devon | `@platform/ops/change-management` | Emergency-change path per `change-management.md` Step 3 emergency track. |
| 5 | Deploy and verify. Atlas deploys the patch; runs regression and vulnerability-scanner post-check to confirm the vulnerability is remediated. | Atlas | `@platform/platform/patch-deploy` (PLANNED) | Event: `PatchDeployed { vulnRef, patchRef, deployedAt, verifiedBy }`. |
| 6 | Close vulnerability record. Senna closes the vulnerability record on scanner confirmation; emits `VulnerabilityRemediated { vulnRef, cvssScore, patchRef, deployedAt, closedAt, closedBy }`. | Senna | `@platform/security/vulnerability-management` (PLANNED) | SLA adherence is computed from `VulnerabilityTriaged.remediationDeadline` vs `VulnerabilityRemediated.closedAt`. |
| 7 | Risk-acceptance (deferred low-severity only). For CVSS < 4.0 items deferred beyond 90 days, Devon + Senna record a formal risk-acceptance event with expiry date. | Devon · Senna | `@platform/security/vulnerability-management` (PLANNED) | Event: `VulnerabilityRiskAccepted { vulnRef, cvssScore, acceptanceRationale, expiresAt, acceptedBy }`. Vera tracks open acceptances. |

### SLA matrix

| Effective severity | CVSS range | Baseline SLA | IBS-exposed uplift |
|---|---|---|---|
| Critical | ≥ 9.0 | 24 hours | 12 hours |
| High | 7.0–8.9 | 7 days | 3 days |
| Medium | 4.0–6.9 | 30 days | 14 days |
| Low | < 4.0 | 90 days | 45 days |

## 6. Reconciliation

- **Events produced:** `VulnerabilityDetected` / `VendorAdvisoryReceived` / `PenTestFindingRaised` (upstream); `VulnerabilityTriaged`, `PatchDeployed`, `VulnerabilityRemediated`, `VulnerabilityRiskAccepted`.
- **Reconciliation check:** (1) every `VulnerabilityDetected` event has a `VulnerabilityTriaged` event within 4 hours (triage SLA); (2) every `VulnerabilityTriaged` event has a `VulnerabilityRemediated` or `VulnerabilityRiskAccepted` event before `remediationDeadline`; (3) open risk-acceptances are within their expiry dates.
- **Failure mode:** SLA breach on a critical or high vulnerability is a Joint Standard 2 finding; Vera raises to Senna + Devon + CEO immediately.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `VulnerabilityTriaged` / `VulnerabilityRemediated` / `VulnerabilityRiskAccepted` | Event log (P1) | Indefinite | Internal — security |
| Scanner reports | `@platform/security/vulnerability-management` (PLANNED) | 3 years | Confidential — security |
| Penetration test reports | Owner Inbox (each test cycle) + artefact store | 5 years | Confidential — high |
| Risk-acceptance records | Event log + Owner Inbox | Until expiry + 3 years | Internal |

## 8. Manual steps

- IBS-exposure assessment (Step 1): Senna exercises judgment on whether an affected asset is in the critical path for an IBS; rationale captured in `VulnerabilityTriaged`.
- Compensating-control approval (Step 3): Senna signs off the compensating control; time-limit and residual-risk rationale recorded.
- Risk-acceptance (Step 7): Devon + Senna joint decision recorded as a typed event; not delegatable below Devon.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Critical vulnerability SLA breach | Vera recon: `VulnerabilityTriaged` with `effectiveSeverity = Critical` without `VulnerabilityRemediated` within 24 hours | Senna + Devon + CEO; emergency-change request initiated; incident may be raised |
| High vulnerability SLA breach | Vera recon: overdue `remediationDeadline` | Senna + Devon; weekly ops review escalation |
| Compensating control expired without remediation | Vera recon: `VulnerabilityRiskAccepted.expiresAt` passed without `VulnerabilityRemediated` | Senna + Devon; renewed risk-acceptance or escalation to emergency patch |
| Vulnerability scanner offline | Monitoring alert | Senna + Atlas; scanner restart; IBS manual review until restored |

## 10. Related procedures

- [`change-management.md`](change-management.md) — all patches are deployed via the change-management procedure; critical patches use the emergency-change track.
- [`incident-response.md`](incident-response.md) — exploited vulnerabilities are escalated to the IR pipeline; the `CyberEventDetected` event is the bridge.
- [`secure-sdlc.md`](secure-sdlc.md) — patch cadence for the bank's own code; dependency scanning and SCA gates are part of the Secure SDLC pipeline.
- [`cyber-incident-classification.md`](cyber-incident-classification.md) — active exploitation of an unpatched vulnerability triggers incident classification.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-15 | Senna + Devon (via Scrooge) | Initial POPULATED procedure. CVSS-based SLA matrix with IBS-exposure uplift; three vulnerability-signal sources; change-management integration; Vera SLA tracking. |

## 12. Audit / assurance

- Vera continuous-controls pipeline `@platform/recon/patch-cadence-coverage` (PLANNED) tests: triage SLA adherence; remediation SLA adherence by severity; open risk-acceptance count and expiry tracking.
- Senna reports vulnerability statistics (open by severity, SLA adherence, open risk-acceptances) to the Risk Forum at each quarterly sitting.
- Annual penetration test (Senna-commissioned); findings feed the pipeline as `PenTestFindingRaised` events; findings-closure rate is a BRC-reported metric.
- Board Risk Committee receives the vulnerability-management summary (open criticals, SLA adherence) at each quarterly BRC meeting.
