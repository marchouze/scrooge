---
policy-id: OPS-OUTSRC-01
title: Outsourcing and Third-Party Risk Policy v1
version: "1.0"
status: DRAFT
owner: Rashida (Chief Information Security Officer, governance) with Devon (Chief Operating Officer, governance)
effective-from: 2026-05-13
next-review: "2026-11-13"
citations:
  - "Banks Act 94/1990: s60 (management of a bank)"
  - "Regulations Relating to Banks: reg.39(17) (outsourcing requirements)"
  - "PA Directive D3/2016: cloud computing and outsourcing notification requirements"
  - "Joint Standard 2/2024: §8 (third-party risk management)"
  - "POPIA 4/2013: s19 (security measures), s20 (operator agreements), s21 (operator processing conditions)"
  - "POPIA 4/2013: s57 (information officer designation)"
author: Rashida (Chief Information Security Officer, governance) with Devon (Chief Operating Officer, governance)
date: 2026-05-13
summary: "Governs the bank's use of third-party service providers and cloud platforms, from due diligence and contract standards through ongoing monitoring and exit planning, ensuring PA outsourcing notification and POPIA operator obligations are met."
decision-required: false
riskTaxonomy:
  - "OPS-001"
  - "CY-001"
  - "GOV-002"
obligations-closed:
  - ORG-CY-06
  - ORG-CY-07
obligations:
  - ORG-CY-06
  - ORG-CY-07
applies-at: LICENCE-BIND
---

# Outsourcing and Third-Party Risk Policy v1

> **Policy** | OPS-OUTSRC-01 v1.0 | Owner: Rashida (Chief Information Security Officer, governance) with Devon (Chief Operating Officer, governance) | Status: DRAFT | Effective: 2026-05-13

> **Authors:** Rashida (Chief Information Security Officer, governance) as primary author and approving authority for vendor risk assessments; Devon (Chief Operating Officer, governance) as technical due diligence lead; Camille (CFO, governance) approves material contracts.
>
> **Obligations closed:** ORG-CY-06 (third-party and outsourcing risk management framework); ORG-CY-07 (POPIA operator agreement requirements).
>
> **Binding status:** LICENCE-BIND. The PA outsourcing notification requirements and the regulatory framework for material outsourcing apply from the point at which the bank commences regulated activities. The framework is authored and implemented during the build phase so that all vendor relationships are governed appropriately from day one of licence operations. Build-phase vendors (engineering tools, cloud infrastructure) are onboarded under this policy from its effective date.

---

## Purpose

This policy governs the bank's use of external third parties — including cloud service providers, technology vendors, data processors, and professional service firms — to deliver functions, services, or capabilities that support the bank's operations. It establishes a risk-based framework for the identification, assessment, onboarding, ongoing monitoring, and exit of third-party relationships, ensuring compliance with the Banks Act, PA outsourcing requirements, Joint Standard 2 of 2024, and POPIA operator obligations.

---

## Principles

1. **Risk-based proportionality.** Due diligence and oversight intensity is proportional to the materiality and risk profile of the outsourced function.
2. **No reduction in regulatory accountability.** Outsourcing does not reduce the bank's regulatory obligations or its accountability to the PA, SARB, or other regulators. The bank remains responsible for the outsourced function.
3. **Arm's-length governance.** Third-party relationships are governed by written agreements containing minimum standards per §3.4, regardless of whether the provider is a related entity.
4. **Concentration risk awareness.** Dependence on a single provider for critical functions is actively managed; fallback plans are maintained and tested.
5. **POPIA data protection.** Where a third party processes personal information on behalf of the bank, a POPIA-compliant operator agreement is in place before any personal information is transferred.
6. **Autonomous monitoring.** Devon (Chief Operating Officer, governance) runs continuous security-posture monitoring routines against the Critical Service Provider register. Rashida (Chief Information Security Officer, governance) reviews findings and escalates to Camille (CFO, governance) on material changes.

---

## 1. Scope

### 1.1 Entities and functions in scope

This policy applies to:

- **Hoz Bank Limited** — primary regulated entity; all outsourced functions.
- **Hoz Group Limited** — holding company; intra-group service agreements within scope.
- **Hoz Securities Limited** — FAIS-FSP entity (on FSP-authorisation date per `D-FSP-LICENCE-NECESSITY`); third-party arrangements within scope.

The policy covers outsourced functions regardless of whether the provider is:
- A third party at arm's length;
- A connected party (intra-group);
- A cloud service provider;
- An agent acting on behalf of the bank.

### 1.2 Relationship types in scope

| Type | Description | Examples |
|---|---|---|
| Cloud services | Infrastructure, platform, or software delivered via cloud | Microsoft Azure, GitHub, Anthropic API |
| Technology vendors | Licensed software; managed services; IT support | Core banking system; market data feeds |
| Data processors | Third parties processing personal information on behalf of the bank | KYC/identity verification providers |
| Professional services | Advisory, legal, audit, and consulting engagements | External auditors; tax counsel; SARB advisors |
| Financial market infrastructure | Exchanges, clearing houses, custodians, correspondent banks | JSE; Strate; SWIFT |
| Intra-group services | Services provided by Hoz Group to Hoz Bank or Hoz Securities | Shared technology platform; group treasury |

### 1.3 Out of scope

- Purchases of standardised goods or commodity services where the bank has no operational dependency (e.g. office supplies).
- Regulatory relationships (SARB, PA, FSCA, SARS) — managed under the Regulatory Reporting Policy.
- Employment relationships — governed by the HR framework (Sade, AgentOps).

---

## 2. Governance

### 2.1 Governance roles

| Role | Holder | Authority |
|---|---|---|
| Policy owner | Rashida (Chief Information Security Officer, governance) | Approves vendor risk assessments; owns the Critical Service Provider register; approves exceptions |
| Technical due diligence lead | Devon (Chief Operating Officer, governance) | Security posture assessments; architecture reviews; ongoing monitoring |
| Contract approval — material | Camille (CFO, governance) | Approves material outsourcing contracts >R1m annual value |
| Contract approval — non-material | Rashida (Chief Information Security Officer, governance) | Approves non-material contracts ≤R1m annual value |
| POPIA operator agreements | Iris (Information Officer, governance) | Co-signs POPIA operator agreements; maintains the operator register |
| PA outsourcing notification | Owen (Company Secretary, governance) | Files material-outsourcing notifications with the PA; maintains notification log |
| Internal audit | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, CAE, governance) | Annual outsourcing controls recon; spot-checks vendor risk assessments |

### 2.2 Outsourcing Committee

The Outsourcing and Vendor Risk Committee (OVRC) is a management-level forum:

- **Members:** Rashida (chair), Devon, Camille, Iris, Owen.
- **Cadence:** Quarterly in steady state; convened ad hoc for material new outsourcing decisions.
- **Mandate:** Approve material outsourcing arrangements; review Critical Service Provider register; assess concentration risk; approve exit-plan testing results.

Until a formal Board Risk Committee is constituted, material outsourcing decisions (as defined in §1) are escalated to the CEO for approval.

### 2.3 Board and CEO approval

This policy is approved at CEO level in the build phase. The Board Risk Committee reviews the Critical Service Provider register and the concentration-risk assessment annually at licence-day.

---

## 3. Standards and Limits

### 3.1 Outsourcing classification

**3.1.1 Material outsourcing**

An outsourcing arrangement is **material** (reg.39(17); PA D3/2016) if it involves functions that, if disrupted:
- Would materially affect the bank's ability to meet regulatory obligations;
- Would have a material impact on the bank's customers, operations, or reputation;
- Would require notification to the PA under reg.39(17)(b).

The classification is made by Rashida (Chief Information Security Officer, governance) at onboarding and reviewed annually.

**3.1.2 Non-material outsourcing**

All other outsourcing is classified as non-material. Reduced due-diligence procedures apply (§3.2.2).

**3.1.3 Cloud vs non-cloud**

Cloud arrangements (IaaS, PaaS, SaaS delivered via internet) are subject to D3/2016 requirements in addition to the reg.39(17) framework. All cloud arrangements are treated as at least non-material outsourcing; classification as material follows the §3.1.1 criteria.

**3.1.4 Critical Service Provider designation**

A subset of material outsourcing providers are designated **Critical Service Providers (CSPs)** where the function is operationally critical and no near-term substitute is available within 30 days. CSPs are listed in the Critical Service Provider register (§4.1) and subject to enhanced monitoring and exit-plan testing.

### 3.2 Due diligence

**3.2.1 Material outsourcing — full due diligence**

Before entering into a material outsourcing arrangement, the bank conducts full vendor due diligence covering:

| Dimension | Assessment content |
|---|---|
| Financial stability | Audited financial statements; credit rating where available; going-concern assessment |
| Security posture | SOC 2 Type II or ISO 27001:2022 certification (current); penetration-test report summary; vulnerability management programme |
| Business continuity | BCP/DRP documentation; recovery time objectives; historical incident record |
| Regulatory compliance | Licences and registrations; sanctions screening; POPIA processor capability |
| Sub-processor management | List of sub-processors; sub-processor agreements in place |
| Concentration risk | Market share; customer concentration; single-points-of-failure |
| Exit capability | Data portability; transition assistance provisions; contractual exit obligations |

Devon (Chief Operating Officer, governance) leads the technical dimensions; Rashida (Chief Information Security Officer, governance) leads the overall assessment and signs off.

**3.2.2 Non-material outsourcing — light due diligence**

For non-material arrangements, a simplified assessment is conducted covering:
- Vendor registration and legal existence;
- Security questionnaire (standardised 20-question form);
- POPIA processor capability where personal information is processed.

**3.2.3 POPIA operator due diligence**

Where a vendor processes personal information on behalf of the bank (POPIA s20 operator), due diligence must additionally include:
- Evidence of adequate technical and organisational measures (POPIA s19);
- Sub-processor disclosure and approval process;
- Data-breach notification capability (≤72-hour notification to the bank, per §3.5).

### 3.3 PA notification requirements

**3.3.1 Material outsourcing notification**

The bank must notify the PA of any material outsourcing arrangement **at least 90 days before commencement** of the outsourced function (reg.39(17)(b)). Owen (Company Secretary) files the notification with the PA in the prescribed form.

**3.3.2 Cloud notification — D3/2016**

The PA Directive D3/2016 requires notification of any cloud-computing arrangement used for banking operations. Devon (Chief Operating Officer, governance) maintains the cloud-services inventory; Owen files D3/2016 notifications for each new cloud service before the service goes live.

**3.3.3 Changes to material outsourcing**

Material changes to an existing outsourcing arrangement (change of provider; material change in service scope; sub-processor addition for a critical function) are notified to the PA within 30 days.

### 3.4 Contract minimum standards

Every outsourcing agreement must include the following minimum provisions:

| Clause | Content |
|---|---|
| Scope and SLA | Defined service scope; service levels with measurable KPIs; OLA for internal interfaces |
| Audit right | The bank (and the PA on request) has the right to audit the provider's systems and processes |
| Data localisation | Personal information of SA residents processed in SA or in a jurisdiction with adequate POPIA-equivalent protections; data residency requirements specified |
| Sub-processor controls | Prior written approval required for sub-processors; sub-processor agreements at least as protective as the primary agreement |
| Incident notification | Provider must notify the bank within 24 hours of a security incident affecting bank data |
| Business continuity | Provider BCP/DRP obligations; tested at least annually; results shared with bank |
| Data portability and return | On termination, all bank data returned in a machine-readable format within 30 days |
| Exit assistance | Provider provides transition assistance for 90 days post-termination |
| Regulatory access | PA and SARB inspection rights; provider must cooperate with regulatory inspections |
| Jurisdiction | SA law governs; SA courts have jurisdiction (or arbitration clause with SA seat) |
| Step-in rights | The bank can step in to perform the outsourced function directly in an emergency |

Contracts that do not meet these minimum standards are not executed. Exceptions require Rashida (Chief Information Security Officer, governance) approval with risk-acceptance documentation.

### 3.5 Azure as primary cloud provider

**3.5.1 Strategic partner designation**

Microsoft Azure is designated the bank's primary cloud provider and a Critical Service Provider. This designation is approved at CEO level and reviewed annually by the OVRC.

**3.5.2 Shared-responsibility model**

The shared-responsibility model applies per the Microsoft Azure Customer Agreement:
- Microsoft is responsible for: physical security; hypervisor security; network controls; underlying platform availability.
- The bank is responsible for: data classification and encryption; identity and access management; application-layer security; compliance configuration.

Devon (Chief Operating Officer, governance) maintains the shared-responsibility matrix and ensures bank-side controls are implemented and tested.

**3.5.3 Data residency — South Africa North**

All primary production data is stored in the Azure **South Africa North** region (Johannesburg). Disaster-recovery replicas may use Azure **South Africa West** (Cape Town). No customer personal information or material banking data is stored outside South Africa without Senna approval and POPIA s72 adequacy confirmation.

**3.5.4 Azure compliance posture**

Devon maintains the Azure Policy assignments enforcing:
- Encryption at rest (AES-256) and in transit (TLS 1.2+);
- Azure Key Vault (or Managed HSM) for key management;
- Azure Active Directory (Entra ID) enforcing MFA and conditional access;
- Microsoft Defender for Cloud at Standard tier with continuous-compliance assessment;
- Azure Monitor and Microsoft Sentinel for security event logging.

**3.5.5 Azure PA notification**

The Azure arrangement constitutes both a material outsourcing and a cloud arrangement. Owen maintains the D3/2016 and reg.39(17) notification log for Azure. Any material change (new Azure service category; region change; significant architecture change) triggers a new or updated notification.

### 3.6 Concentration risk

**3.6.1 Single-cloud risk**

The bank's primary dependence on Azure is a concentration risk. Mitigation measures:
- Critical workloads are designed for portability (containerised; cloud-neutral APIs where feasible);
- An annual cloud-exit feasibility assessment is conducted by Devon;
- The Azure SLA is monitored against the bank's operational RTO/RPO requirements.

**3.6.2 Critical Service Provider register**

Devon (Chief Operating Officer, governance) maintains the Critical Service Provider register covering:
- Provider name and service description;
- Materiality classification and CSP designation;
- PA notification date and reference;
- Contract expiry and renewal date;
- Last risk-assessment date and outcome;
- Fallback plan reference.

The register is reviewed quarterly by the OVRC and annually by the Board Risk Committee (at licence-day).

**3.6.3 Concentration limits**

No single third-party provider may account for more than 60% of total IT infrastructure spend without OVRC review and CEO approval. The OVRC reviews concentration metrics annually.

### 3.7 Ongoing monitoring

**3.7.1 Annual vendor review**

Each material outsourcing provider is subject to an annual review covering:
- Re-assessment of materiality classification;
- SLA performance against KPIs;
- Updated security posture check (SOC 2 Type II / ISO 27001 certificate currency; security-scorecard rating);
- Sub-processor changes;
- Financial stability update;
- Incident history and resolution.

Devon leads the technical re-assessment; Senna approves the outcome.

**3.7.2 Security scorecard**

Devon maintains automated security-scorecard ratings (e.g. SecurityScorecard or Bitsight) for all Critical Service Providers. Ratings are reviewed monthly. A rating drop of ≥10 points (100-point scale) triggers an immediate enhanced review.

**3.7.3 Incident notification**

Providers must notify the bank within 24 hours of any security incident (as defined in the contract). Devon triages incoming incident reports; Senna assesses regulatory notification obligations (Joint Standard 2/2024 §8; POPIA s22; PA cybersecurity notification).

---

## 4. Controls and Monitoring

### 4.1 Critical Service Provider register

Devon (Chief Operating Officer, governance) maintains the register as the canonical inventory of all material and critical outsourcing arrangements. The register is the source of truth for PA notifications, OVRC reviews, and Vera's audit recon.

### 4.2 Contract compliance monitoring

Rashida (Chief Information Security Officer, governance) maintains a contract-compliance checklist for each material provider, confirming that:
- Minimum contract standards (§3.4) are present in the signed agreement;
- Audit rights have been exercised (or waived with risk-acceptance) in the past 24 months;
- SLA performance reports are received and reviewed quarterly.

### 4.3 POPIA operator register

Iris (Information Officer, governance) maintains the POPIA operator register covering:
- All third parties processing personal information on behalf of the bank;
- POPIA s20 written agreement status (signed / pending / not required);
- Sub-processor list and approval status;
- Last review date.

The register is reconciled against the Critical Service Provider register quarterly.

### 4.4 Exit-plan testing

For each Critical Service Provider, Devon maintains a documented exit plan covering:
- Trigger conditions for activation;
- Data-extraction and portability procedures;
- Target alternative provider or in-house capability;
- Estimated transition timeline;
- Key personnel and responsibilities.

Exit plans are tested (tabletop exercise minimum; technical test for Tier 1 critical providers) annually. Results are presented to the OVRC.

### 4.5 Intra-group services

Intra-group service arrangements (Hoz Group providing services to Hoz Bank or Hoz Securities) are governed by formal Intra-Group Service Agreements (IGSAs). IGSAs must meet the same minimum contract standards (§3.4). Transfer pricing applies (per TAX-POL-01 §3.5). Senna reviews IGSAs annually.

### 4.6 Independent assurance

Vera (Internal audit / continuous-assurance engineer, engineering) performs:
- Annual outsourcing controls recon covering the Critical Service Provider register, POPIA operator register, and contract-compliance checklists;
- Spot-checks of vendor risk assessments (sample: 20% of material providers assessed in prior 12 months);
- PA notification log completeness check.

Findings are reported to Thandiwe (CAE, governance) and escalated to Rashida (Chief Information Security Officer, governance) and Camille (CFO) where material.

---

## 5. Reporting

### 5.1 OVRC reporting

The OVRC receives quarterly reports from Devon covering:
- Critical Service Provider register status;
- Security scorecard movement;
- SLA performance summary;
- Incident notifications received and triaged;
- New and terminated arrangements.

### 5.2 Board reporting

Senna presents an annual outsourcing risk report to the Board Risk Committee (or interim CEO) covering:
- Material outsourcing arrangements and classification;
- Concentration risk assessment;
- Exit-plan testing results;
- PA notifications filed;
- Material changes to the vendor landscape.

### 5.3 Regulatory reporting

Owen (Company Secretary) maintains a log of all PA notifications filed under reg.39(17) and D3/2016. The log is available to the PA on request. Any material change in an outsourcing arrangement is reported to the PA within 30 days per reg.39(17)(c).

### 5.4 POPIA breach reporting

Where a security incident at a provider results in a personal-information breach:
- Senna assesses the breach against POPIA s22 reporting thresholds within 24 hours;
- Iris (Information Officer) notifies the Information Regulator within 72 hours of confirmation that a reportable breach has occurred;
- Affected data subjects are notified by Iris as soon as reasonably practicable.

---

## 6. Exceptions and Escalation

### 6.1 Exception requests

Exceptions to minimum contract standards (§3.4), due-diligence requirements (§3.2), or data-localisation requirements (§3.5.3) must be:
- Documented in a risk-acceptance record;
- Approved by Rashida (Chief Information Security Officer, governance) for non-material arrangements;
- Approved by Senna and Camille (CFO) for material arrangements;
- Escalated to the CEO for Critical Service Provider exceptions.

Exceptions are time-limited (maximum 12 months) and reviewed at the next OVRC.

### 6.2 Escalation to CEO / Board

The following trigger CEO escalation:
- New Critical Service Provider designation;
- Concentration limit breach (>60% of IT infrastructure spend on a single provider);
- Material provider exit triggered (involuntary or planned);
- PA issuing a directive or instruction affecting a material outsourcing arrangement;
- Security incident at a Critical Service Provider assessed as Severity 1 (critical business impact).

Board Risk Committee escalation (at licence-day): annual concentration risk assessment; any CSP exit where an alternative is not confirmed within 30 days.

### 6.3 Provider failure contingency

Where a Critical Service Provider fails or terminates service unexpectedly:
- Devon activates the relevant exit plan within 4 hours;
- Senna convenes an emergency OVRC meeting within 24 hours;
- CEO is notified immediately;
- PA is notified if the failure materially affects the bank's ability to meet regulatory obligations (reg.39(17)(e));
- Business continuity plan (Operational Resilience Policy) is activated in parallel.

---

*Policy OPS-OUTSRC-01 v1.0 — Authored by Rashida (Chief Information Security Officer, governance) with Devon (Chief Operating Officer, governance) | Effective 2026-05-13*
