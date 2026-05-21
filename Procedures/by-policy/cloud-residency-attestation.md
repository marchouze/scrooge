---
procedureId: PROC-IS-CRA-01
title: Cloud data residency attestation — POPIA and PA requirements
author: Devon (Chief Operating Officer) · Senna (information security & cloud engineer)
date: 2026-05-16
owner: Devon (Chief Operating Officer) · Senna (information security & cloud engineer)
status: POPULATED
policy-cited: Cloud Computing Policy (planned) · Owner Inbox/2026-05-06_core-policies-infosec-cloud.md
system-capability: "@platform/infosec/cloud-residency-inventory (PLANNED)"
---

# Procedure — Cloud data residency attestation — POPIA and PA requirements

**Procedure ID:** PROC-IS-CRA-01
**Owner:** Devon (Chief Operating Officer) · Senna (information security & cloud engineer)
**Approval:** CEO (annual attestation sign-off) · Owen (Company Secretary, governance — POPIA s.72 transfer authorisations)
**Cadence:** Annual (Q3 — attestation cycle); triggered on any new cloud service adoption
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Cloud Computing Policy (planned; Devon + Senna to author; load-bearing at pre-licence go-live readiness gate).
- PA Joint Standard 2 of 2024 (Cybersecurity and Cyber Resilience) — annual cloud residency attestation requirement.
- POPIA s.72 — restrictions on cross-border transfer of personal information.

The obligation chain:

```
Regulation (POPIA s.72 / PA Joint Standard 2 of 2024 / Banks Act s.60)
  → Cloud Computing Policy
    → PROC-IS-CRA-01 (this procedure — annual cloud residency attestation)
      → @platform/infosec/cloud-residency-inventory (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PRIV-07` (POPIA s.72 — transborder information flows) | Personal information may only be transferred to a foreign country if that country has adequate data protection laws, or with data subject consent, or under a binding agreement ensuring equivalent protection; the IO must authorise any transfer. |
| `ORG-IS-01` (PA Joint Standard 2 of 2024 — cybersecurity and cloud) | Regulated institutions must annually attest that cloud services used meet the PA's cybersecurity and resilience standards; cloud data residency must be documented and attested. |
| `ORG-PR-10` (Banks Act s.60 — risk management) | Board is responsible for operational and technology risk; cloud residency is a component of the technology risk framework. |
| `ORG-PRIV-01` (POPIA s.19–22 — security safeguards) | Responsible party must secure the integrity and confidentiality of personal information; cloud configuration and residency controls are security safeguards. |

## 3. Purpose

Ensure that all cloud services used by the bank are inventoried, their data classifications confirmed, and that personal information remains within South Africa (or within an adequate jurisdiction with appropriate contracts) as required by POPIA s.72. Produce the PA Joint Standard 2 annual cloud residency attestation. Manage exceptions through the POPIA s.72 transfer authorisation process.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| Annual scheduler (agent tick, 1 July): attestation cycle opens | Full cycle — Steps 1–8 |
| `CloudServiceAdopted { serviceId, provider, regions, dataClassifications }` (Devon or Senna) | New-service residency check — Steps 1–3, 6 |
| `CloudServiceConfigChanged { serviceId, oldRegions, newRegions }` | Configuration-change residency check — Steps 2–3, 6 |
| PA enquiry regarding cloud residency | Out-of-cycle attestation — Steps 1–5, 7–8 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Cloud service inventory.** Senna enumerates all cloud services currently in use: service name, provider (Azure / other), data centre regions configured, service category (IaaS / PaaS / SaaS). Emit `CloudInventoryCompiled { inventoryDate, services[], totalCount }`. | `agent` (Senna) | `@platform/infosec/cloud-residency-inventory` (`PLANNED`) + Azure Resource Graph ✓ (via IaC) | Cloud infrastructure is Azure-primary (per `project_cloud_target_azure.md`); Azure South Africa North (Johannesburg) is the primary region. Any non-Azure SaaS services (e.g. Anthropic API) are catalogued separately. |
| 2 | **Data classification mapping.** For each cloud service: confirm which data classifications are processed or stored (Public / Internal / Confidential / Restricted / Personal Information). Mark all services that process or store Personal Information (POPIA-regulated) as POPIA-scope. Emit `DataClassificationMapped { serviceId, classifications[], popiaScope: boolean }`. | `agent` (Senna) | `@platform/infosec/cloud-residency-inventory` (`PLANNED`) | Personal Information definition per POPIA s.1: includes client data, employee data (if any), and agent operational logs that contain identifiable natural-person data. |
| 3 | **Residency confirmation.** For each POPIA-scope service: confirm the data centre region(s) where personal information is stored and processed. Flag any service where personal information is stored or processed outside South Africa. Emit `ResidencyConfirmed { serviceId, regions[], southAfricaResident: boolean, foreignRegions[] }`. | `agent` (Devon) | `@platform/infosec/cloud-residency-inventory` (`PLANNED`) + Azure Policy ✓ | Azure Policy is configured to enforce South Africa North residency; Devon confirms the policy is active and no exceptions exist (or documents known exceptions). |
| 4 | **POPIA s.72 transfer assessment.** For each service where personal information is stored or processed outside South Africa: (a) assess adequacy of the foreign jurisdiction (EU GDPR countries = adequate); (b) confirm binding contractual protections (Data Processing Agreement, Standard Contractual Clauses); (c) confirm the bank's IO has authorised the transfer. Emit `TransferAssessmentCompleted { serviceId, jurisdiction, adequacyBasis, contractualProtections[], ioAuthorised: boolean }`. | `agent` (Owen — IO authorisation) + `agent` (Senna) | `@platform/infosec/cloud-residency-inventory` (`PLANNED`) | Cross-reference `PROC-PRIV-CBT-01` (POPIA s.72 transfer assessment procedure). Owen as Information Officer (IO) provides the formal authorisation. |
| 5 | **Exceptions register.** Any POPIA-scope service with an unauthorised foreign residency is placed on the exceptions register. Devon + Senna produce a remediation plan (migrate to SA region, or obtain IO authorisation, or terminate service). Exceptions without an approved remediation plan are escalated to CEO. Emit `ResidencyExceptionRegistered { serviceId, foreignRegions[], remediationPlan, targetDate }`. | `agent` (Devon) + `agent` (Senna) + `human` (CEO — approve unresolved exceptions) | `@platform/infosec/cloud-residency-inventory` (`PLANNED`) | Any exception without a current remediation plan is a Vera finding (P1 if personal information at risk; P2 otherwise). |
| 6 | **PA Joint Standard 2 attestation package.** Senna compiles the attestation package: (a) cloud service inventory (Step 1); (b) data classification mapping (Step 2); (c) residency confirmation (Step 3); (d) POPIA s.72 transfer assessments (Step 4); (e) exceptions register with remediation status (Step 5); (f) Azure Policy compliance report; (g) penetration test results (where required). Package is content-addressed in the RMS document store. | `agent` (Senna) | `@platform/rms/document-store` (`PLANNED`) | PA Joint Standard 2 attestation is submitted to the PA with the ICAAP / annual prudential return. Devon confirms the attestation package is consistent with the live infrastructure state. |
| 7 | **CEO attestation.** CEO reviews and signs the PA Joint Standard 2 cloud residency attestation. Emit `CloudResidencyAttestation { year, attestedBy, attestedAt, packageHash, exceptionsCount, remediationPlansCount }`. | `human` (CEO — irreducible governance act) | `@platform/decisions/ceo-decision` ✓ | The CEO attestation is the load-bearing artefact for PA submission. It confirms the bank has conducted the required review and that residency controls are adequate (or that exceptions are under active remediation). |
| 8 | **Submission and archive.** Devon submits the attestation package to the PA (via the PA's regulatory reporting channel). Owen archives the package in the RMS document store. Emit `CloudResidencyAttestationSubmitted { year, paReferenceRef, submittedAt }`. | `agent` (Devon) + `agent` (Owen) | `@platform/regulatory/pa-reporting` (`PLANNED`) | If the PA requests follow-up: Devon + Senna respond; Helena (CRO, governance) is informed of any PA findings. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Devon (Chief Operating Officer) | Azure residency controls; IaC enforcement; attestation package co-author; PA submission |
| Senna (information security & cloud engineer) | Cloud service inventory; data classification mapping; attestation package compiler |
| Owen (Company Secretary, governance — Information Officer) | POPIA s.72 IO authorisation for cross-border transfers; archives attestation package |
| CEO | Final attestation sign-off |
| Helena (Chief Risk Officer, governance) | Informed of PA findings; technology risk oversight |

## 7. Escalation

| Scenario | Escalation path |
|---|---|
| Personal information found stored in non-SA, non-adequate jurisdiction without IO authorisation | Immediate suspension of service (or data migration); Senna + Devon + Owen + CEO; POPIA breach assessment (`popia-breach-notification.md`) |
| Exception without remediation plan | Vera P1 finding; Devon + CEO; BRC notification within 5 business days |
| PA finds attestation inadequate | Helena + Devon + CEO; response plan within 10 business days; remediated attestation resubmitted |
| Azure Policy breach (resource deployed outside SA region) | Automated alert to Senna; IaC correction within 1 business day; Vera finding if policy was disabled |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/infosec/cloud-residency-inventory` | PLANNED | Service inventory, classification mapping, residency tracking, exceptions register |
| Azure Resource Graph / Azure Policy | ✓ live (via IaC) | Enforces SA North residency; Devon manages policies |
| `@platform/rms/document-store` | PLANNED | Attestation package archive |
| `@platform/regulatory/pa-reporting` | PLANNED | PA submission channel |

## 9. Quality controls

- Vera recon: annual `CloudResidencyAttestation` event present for each calendar year by 30 September.
- Vera recon: every `ResidencyExceptionRegistered` has a current remediation plan with a target date.
- Vera recon: no POPIA-scope service has `southAfricaResident: false` and `ioAuthorised: false` simultaneously.
- Devon: Azure Policy compliance dashboard reviewed monthly; non-compliant resources trigger immediate remediation.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `CloudInventoryCompiled`, `DataClassificationMapped`, `ResidencyConfirmed`, `TransferAssessmentCompleted`, `ResidencyExceptionRegistered`, `CloudResidencyAttestation`, `CloudResidencyAttestationSubmitted` events | Event log (P1) | 7 years | Restricted |
| Cloud service inventory (all versions) | RMS document store | 7 years | Confidential |
| PA Joint Standard 2 attestation package | RMS document store | 7 years | Restricted |
| IO authorisation records (POPIA s.72) | RMS document store | 10 years | Legal-confidential |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Devon + Senna | Initial draft — PLANNED → POPULATED; full 11-section procedure; Azure-primary residency; POPIA s.72 transfer assessment; PA Joint Standard 2 attestation cycle. |

## 12. Audit / assurance

- **Vera (ongoing):** residency recon; exception-register staleness checks; Azure Policy compliance.
- **Thandiwe (CAE, governance):** annual cloud security audit; assesses residency controls adequacy; opinion to BRC.
- **PA (SREP / Joint Standard 2):** annual review of cloud residency attestation; may conduct independent cloud security assessment.
