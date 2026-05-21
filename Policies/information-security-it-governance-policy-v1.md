---
policy-id: information-security-it-governance-policy
title: Information Security and IT Governance Policy v1
version: "1"
status: IN FORCE
owner: Senna (Security engineer, engineering)
effective-from: "2026-05-13"
next-review: "2027-05-13"
citations:
  - PA/FSCA Joint Standard 1 of 2023
  - Protection of Personal Information Act 4 of 2013
  - Banks Act 94 of 1990
  - PA/FSCA Joint Standard 2 of 2024
  - D-POLICY-DOCUMENT-HOME
author: Senna (Security engineer, engineering) + Devon (Chief Operating Officer, governance)
date: 2026-05-13
summary: Standalone Information Security and IT Governance Policy covering IT governance (board-approved IT strategy, IT performance, third-party IT risk) and IT risk management (IT risk appetite, identification/assessment, access controls, change management, asset management, cryptographic controls, monitoring, vulnerability management) per PA/FSCA Joint Standard 1 of 2023. Closes obligations ORG-CY-15 and ORG-CY-16. IN FORCE.
decision-required: false
riskTaxonomy:
  - RT-CY
  - RT-OR
  - RT-IT
---

# Information Security and IT Governance Policy v1

> **Authors.** Senna (Security engineer, engineering) — lead; Devon (Chief Operating Officer, governance) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10); `D-POLICY-DOCUMENT-HOME` (CEO-approved 2026-05-12). Implements the IT governance and IT risk management policy layer of the bank's information-security programme per PA/FSCA Joint Standard 1 of 2023 under the no-pause rule — CLAUDE.md "Operating procedures".
> **Obligations closed.** `ORG-CY-15` (IT governance framework per JS 1/2023: board-approved IT strategy, IT risk management integrated into enterprise risk, IT performance monitoring, third-party IT risk); `ORG-CY-16` (IT risk management per JS 1/2023: risk identification and assessment, IT risk appetite, risk treatment, monitoring and reporting).
> **Status.** IN FORCE. PA/FSCA Joint Standard 1 of 2023 is in force; the Bank's AI-native platform is a regulated IT system from the date of first productive use. The IT governance framework obligations bind from the point at which the bank operates regulated IT systems — which is now, in the build phase. Banking-specific capital and liquidity obligations bind at commencement of trading; IT governance obligations bind when the systems are active.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Information Security and IT Governance Policy — Overarching

**Owner:** Senna (Security engineer, engineering) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual; triggered on material change to IT architecture, threat landscape, or regulatory update · **Citation:** PA/FSCA Joint Standard 1 of 2023 (`JS 1/2023`) — IT Governance and IT Risk Management for Financial Institutions (Parts A and B); Protection of Personal Information Act 4 of 2013 (`POPIA`) — s.19 (security safeguards), s.20 (integrity and confidentiality of personal information), s.21 (third-party processing), s.22 (notification of information security compromise); PA/FSCA Joint Standard 2 of 2024 (`JS 2/2024`) — Cybersecurity Framework for Financial Institutions; Banks Act 94 of 1990 — Reg 39 (operational risk and IT systems) `[citation: TBC — precise Reg 39 sub-clause indices; Imani (Legal-as-code engineer, engineering) + external counsel to ratify at the licence-application gate]`; `D-POLICY-DOCUMENT-HOME` (policy-document-home decision, CEO-approved 2026-05-12)

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") manages its information technology governance, information security, and IT risk across the full technology estate — including the agent platform, cloud infrastructure (Azure), the event store and content-addressed document store (per `D-RMS-PHASE-1`), and all third-party technology vendors. Its purpose is to ensure the Bank meets the requirements of PA/FSCA Joint Standard 1 of 2023 for IT governance (Part A) and IT risk management (Part B); aligns its cybersecurity posture with JS 2/2024 and Principle 4 (`Principles/4-security-designed-in.md`); and protects the confidentiality, integrity, and availability of information assets in accordance with POPIA and the Banks Act.

This policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). It cites the regulatory obligations above it; procedures under this policy (including `Procedures/by-policy/change-management.md`, `Procedures/by-policy/access-control.md`, `Procedures/by-policy/vulnerability-management.md`, and `Procedures/by-policy/incident-response.md`) operationalise it; the zero-trust network architecture, HSM infrastructure, SIEM, and agent-identity framework are the system capabilities that execute those procedures. The policy does not reproduce regulatory text; it anchors management choices above the regulatory floor.

The Bank is an AI-native institution (Principle 6 — `Principles/6-autonomous-by-default.md`): its primary operational layer is a fleet of autonomous agents, not human staff. The IT governance and IT risk management framework must account for this: the AI-agent platform is itself a regulated IT system; agent behaviour is subject to the same change-management, access-control, and monitoring controls as any other system component; and the attack surface includes AI-specific risks (model manipulation, prompt injection, adversarial inputs, model exfiltration) that the framework must explicitly address.

The policy covers the full scope of information security: physical and logical access controls; network security; cryptographic controls; change management; asset management; vulnerability management; incident management; business continuity and resilience; and third-party IT risk. The Board (CEO interim) is the ultimate accountability owner for IT governance; Senna owns the policy and the IT risk register; Devon owns the operational systems.

### Principles

- **Board accountability for IT governance.** IT governance is a board-level accountability under JS 1/2023 Part A. The Board (CEO interim under `D-THIN-HUMAN-LAYER-MINIMUM`) approves the IT strategy, the IT risk appetite, and the IT governance framework. The Board receives quarterly IT performance and risk reports. IT governance cannot be delegated below the Board; management operates within the Board-approved framework.
- **Security designed in, not bolted on.** Per Principle 4, security is a design requirement, not a retrofit. Every platform component — agent runtime, event store, API layer, cloud infrastructure — is designed with threat modelling, zero-trust architecture, least-privilege access control, and defence-in-depth as structural requirements. Security controls are architectural properties of the system, not procedural overlays.
- **Zero-trust architecture is the default.** The Bank adopts a zero-trust network architecture (ZTNA): no implicit trust based on network location; every access request is authenticated, authorised, and encrypted regardless of the network segment from which it originates. Trust is never assumed; it is verified on every request.
- **Least-privilege access control.** Every system component, agent, and human user is granted the minimum access rights necessary to perform its function. Over-privileged access is a security finding. Access rights are reviewed quarterly; excess rights are revoked.
- **Events-first security logging.** All security-relevant events (access attempts, authentication events, privileged-access exercises, configuration changes, anomaly detections) are typed events in the event store or the SIEM. Security logging is structural: the platform is designed so that security-relevant events cannot occur without producing a log entry. Silent access is an architecture violation.
- **IT risk is an enterprise-risk dimension.** IT risk is a named dimension of the Bank's enterprise risk framework, governed by the Risk Appetite Statement and managed under the Risk and Control Self-Assessment (RCSA) process. IT risk appetite (availability, data integrity, confidentiality, cyber risk tolerance) is board-approved and reviewed annually. IT risk appetite calibration is driven by Senna's IT risk assessment; Helena (Chief Risk Officer, governance) integrates IT risk into the enterprise risk framework.
- **AI-platform risk is explicitly scoped.** The agent platform and AI-model layer are IT systems within the scope of this policy. AI-specific risks — model manipulation, prompt injection, adversarial inputs, agent identity spoofing, model exfiltration — are named in the IT risk register and assessed in the RCSA. Controls for AI-specific risks are part of the security-by-design requirement for the agent platform.
- **Third-party IT risk is owned, not transferred.** The Bank's use of third-party technology providers (cloud vendors, model API providers, data vendors, SaaS tools) does not transfer IT risk responsibility to the vendor. The Bank owns the IT risk from third-party technology; the vendor's controls are assessed as part of the Bank's IT risk management. Material vendor concentration risk is a named IT risk.
- **Continuous monitoring is the operational standard.** The Bank's IT environment is monitored continuously via the SIEM and the automated recon pipelines. Point-in-time assessments (penetration tests, vulnerability scans) supplement but do not substitute for continuous monitoring. Gaps in monitoring coverage are security findings.
- **Resilience is a design requirement.** The Bank's IT systems must meet the resilience targets set in the IT risk appetite (RTO/RPO). Resilience is tested via the business continuity and disaster-recovery programme. Recovery capabilities are confirmed by periodic simulation exercises; untested recovery capabilities are not relied upon.

### Roles

Senna (Security engineer, engineering) owns the Information Security and IT Governance Policy, the IT risk register, and the IT risk management programme. Senna chairs the Bank's information-security governance process; produces the quarterly IT performance and risk report for the Board (CEO interim); and owns the security-by-design requirement for every platform component. Senna reports to the Board (CEO interim) on IT risk and security posture.

Devon (Chief Operating Officer, governance) co-authors the policy and owns the operational IT systems: the cloud infrastructure (Azure), the event store, the content-addressed document store, the agent runtime platform, and the third-party vendor service relationships. Devon is responsible for ensuring the IT systems meet the availability, integrity, and confidentiality requirements of this policy; for operating the change-management process; and for coordinating with Senna on the security posture of the operational systems.

Atlas (Platform engineer, engineering) builds and operates the event store, content-addressed document store, agent runtime platform, and core infrastructure. Atlas implements the security controls specified by Senna and is responsible for the security of the infrastructure layer. Atlas participates in the change-management process for all platform changes.

Helena (Chief Risk Officer, governance) integrates IT risk into the enterprise risk framework: IT risk appetite calibration, RCSA IT-risk rows, and the IT-risk chapter in the ICAAP (operational risk section). Helena's integration ensures IT risk is not managed in isolation from the bank's enterprise risk profile.

Vera (internal audit engineer, engineering — reports functionally to Thandiwe (Chief Audit Executive, governance)) provides third-line assurance: annual IT governance and IT risk management audit, including assessment of the Board's IT-governance oversight, the IT risk management framework's effectiveness, and the security controls' design and operating effectiveness. Vera's IT audit findings are reported to Thandiwe through the Audit Forum.

Nadia (Independent-validation engineer, engineering — peer in second line under Helena) validates AI models and the agent-platform risk models that feed into the RCSA. Model-risk controls for AI systems are a named audit domain under Vera's Wave-4 mandate.

Imani (Legal-as-code engineer, engineering — acting General Counsel) provides legal-framework input: POPIA security-safeguards obligations, ECTA requirements, and any regulatory inquiry relating to IT systems or security incidents. Imani assesses the Bank's legal exposure in the event of a security breach; owns the notification-obligation assessment under POPIA s.22 and the Banks Act `[citation: TBC]`.

Zara (Chief Compliance Officer, governance) owns the POPIA-compliance overlay on the information-security framework: data-security safeguards (POPIA s.19–22), third-party processor agreements (s.21), and data-breach notification obligations (s.22). Zara and Senna co-own the POPIA-security intersection.

### Breach

Breach taxonomy under this policy is three-severity:

- **Alert (Amber).** Vulnerability scan identifies a medium-severity finding not remediated within the 30-day target; access-control review reveals a non-critical over-privileged account; SIEM alert for anomalous but non-critical access pattern; IT performance indicator falls below target for one reporting period. Senna notified; remediation tracked; Board informed at next quarterly report.
- **Hard Breach (Red).** Critical or high-severity vulnerability not remediated within the 14/30-day target; unauthorised privileged access exercised; change deployed to production without completing the change-management gate; third-party vendor access not revoked within the required timeframe after contract termination; security event log gap identified. Senna leads immediate response; Devon coordinates remediation; Board notified within 24 hours; Vera engaged for root-cause review.
- **Critical (Critical-Red).** Active cyberattack or security incident with confirmed or suspected data breach; ransomware or destructive malware affecting production systems; material availability incident (production system unavailable beyond RTO); POPIA s.22 reportable security compromise; PA notification obligation triggered. Senna invokes the incident-response procedure; CEO notified immediately; Devon leads system response; Imani and Zara assess notification obligations; PA/Information Regulator notification as required. The incident is a typed `SecurityIncident` event in the event store from the moment of detection.

---

## 2. IT Governance Framework (JS 1/2023 Part A)

**Owner:** Senna (Security engineer, engineering) — framework; Devon (Chief Operating Officer, governance) — operational systems · **Approval:** Board (CEO interim) — IT strategy and IT governance framework annually; IT performance report quarterly · **Cadence:** IT strategy reviewed annually; IT performance reported quarterly; third-party IT risk assessed at vendor onboarding and annually · **Citation:** JS 1/2023 Part A — IT Governance; Banks Act 94 of 1990 — Reg 39 `[citation: TBC]`; `D-THIN-HUMAN-LAYER-MINIMUM` (governance structure interim)

### Purpose

This section implements JS 1/2023 Part A — IT Governance. Part A requires financial institutions to establish a board-level IT governance framework covering: board accountability; an approved IT strategy aligned to business strategy; IT performance monitoring and reporting; and third-party IT risk management. This section defines the Bank's governance structure for each requirement.

### Principles

- **Board approval of the IT strategy.** The Board (CEO interim) must approve the IT strategy annually. The IT strategy covers: IT architecture (cloud-native on Azure; event-sourced; agent-platform first); cybersecurity posture (zero-trust; FIPS 140-2 Level 3 HSM; continuous monitoring); AI/agent platform strategy (Principle 6 autonomous-by-default; agent-identity framework; model risk management); cloud strategy (Azure as production; lift-compatible local development; geo-redundancy targets); and the IT investment plan for the year. The IT strategy is a typed document in the content-addressed document store; Board approval is recorded as a `CeoDecision` event (pending constitution of a formal Board). The IT strategy is aligned to the Bank's business strategy and Risk Appetite Statement.

- **IT strategy alignment to business strategy.** The IT strategy is derived from the Bank's business strategy: institutional global-markets trading bank (`project_strategic_foundation.md`); indirect-participant operating posture (`project_indirect_participant_posture.md`); AI-native labour force (Principle 6). The IT architecture choices directly implement these strategic choices: the event store implements the single-source-of-truth requirement (Principle 1); the agent platform implements the autonomous-by-default labour model (Principle 6); the cloud-native Azure infrastructure implements the cloud-native principle (Principle 3); the HSM-backed cryptographic infrastructure implements the security-designed-in principle (Principle 4). Strategy drift — a material IT architectural choice not traceable to the business strategy or risk appetite — is a Vera finding.

- **IT performance monitoring.** Senna owns the Bank's IT key performance indicators (KPIs). The KPI set covers: system availability (uptime percentage against RTO targets); incident metrics (mean time to detect, mean time to respond, mean time to recover); change success rate (changes deployed without rollback as a percentage of total changes); vulnerability remediation rate (percentage of critical/high findings remediated within 14/30 days); security metrics (number of security events, number of phishing simulations, access-control review completion rate). These KPIs are computed from the event store and SIEM; they are not manually collated. Senna reports the KPIs to the Board (CEO interim) quarterly in the IT governance report. A KPI falling below target for two consecutive quarters is an Alert.

- **IT governance report — quarterly.** Senna produces a quarterly IT governance report for the Board (CEO interim) covering: IT strategy execution status (milestones hit and missed); IT KPI performance against targets; IT risk register top-10 (open, residual risk, treatment status); material security incidents in the period; material change events in the period; third-party IT risk assessment status; and any regulatory IT-governance matters. The report is a typed document in the content-addressed document store; it references the relevant typed events for each item.

- **Third-party IT risk management.** All material technology vendors (cloud vendors, model API providers, data vendors, SaaS tools, outsourced IT services) are assessed for IT risk before engagement and annually thereafter. The assessment covers: the vendor's security certifications (ISO 27001, SOC 2 Type II, or equivalent); the vendor's business-continuity and disaster-recovery capabilities; data-sovereignty and data-residency compliance (POPIA, Azure region configuration); vendor concentration risk (reliance on a single vendor for a critical capability); and contractual protections (right to audit, security obligations, data-breach notification, exit terms). Material vendor IT risk assessments are owned by Devon; Senna provides the security-specific assessment; Imani reviews the contractual terms. The assessment outcome is a typed event; the contract is in the content-addressed document store.

- **IT governance is not delegated below the Board.** IT governance accountability sits with the Board (CEO interim). Management implements the Board-approved framework; it does not substitute for the Board's governance role. Any management decision that materially changes the IT architecture, IT risk appetite, or IT strategy requires Board (CEO interim) approval before implementation.

- **AI governance is an IT governance sub-domain.** The AI/agent platform is a regulated IT system. AI model selection, agent-platform architecture decisions, model risk management framework, and agent-identity infrastructure are IT governance matters subject to Board oversight. Senna's quarterly report includes an AI/agent platform section. Model risk management (Nadia's domain) is reported through the IT governance channel to the Board.

### Roles

Senna owns the IT strategy, the IT performance KPI framework, and the quarterly Board report. Devon owns the operational IT systems and the third-party vendor relationships. Nadia validates AI models and contributes the model-risk section to the IT governance report. Helena integrates the IT risk appetite into the enterprise RAS. Owen maintains the governance calendar and Board-report circulation. Vera audits the IT governance framework annually.

### Breach

Failure to produce the quarterly IT governance report within 15 days of quarter-end is an Alert. Material change to the IT architecture or IT risk appetite without Board (CEO interim) approval is a Hard Breach. A third-party vendor engaged without completing the IT risk assessment is a Hard Breach: Devon and Senna remediate immediately; the vendor relationship is suspended until the assessment is complete.

---

## 3. IT Risk Management Framework (JS 1/2023 Part B)

**Owner:** Senna (Security engineer, engineering) — IT risk register and programme; Helena (Chief Risk Officer, governance) — enterprise-risk integration · **Approval:** Board (CEO interim) — IT risk appetite; Helena — IT risk register additions and closures within appetite · **Cadence:** IT risk register updated continuously (typed events); formal quarterly review; RCSA annual; IT risk appetite reviewed annually · **Citation:** JS 1/2023 Part B — IT Risk Management; Banks Act 94 of 1990 — Reg 39 `[citation: TBC]`; BCBS operational risk principles `[citation: TBC — precise BCBS document reference; Imani to confirm]`; `ORG-CY-15` and `ORG-CY-16`

### Purpose

This section implements JS 1/2023 Part B — IT Risk Management. Part B requires financial institutions to identify, assess, treat, monitor, and report IT risks as part of their enterprise risk management framework. This section defines the Bank's IT risk management programme: the IT risk appetite; the risk identification and assessment process; the risk treatment options and tracking; and the monitoring and reporting cadence.

### Principles

- **IT risk appetite is board-approved.** The Board (CEO interim) approves the IT risk appetite statement — a sub-dimension of the enterprise risk appetite (Risk Appetite Statement). The IT risk appetite covers four dimensions: (i) Availability — the Bank's RTO (Recovery Time Objective) and RPO (Recovery Point Objective) targets for critical systems: RTO ≤ 4 hours and RPO ≤ 1 hour for the event store and agent platform (production-level targets, to be confirmed at licence-day operational specification); (ii) Data integrity — zero tolerance for undetected data corruption in the event store or financial records; (iii) Confidentiality — zero tolerance for unauthorised disclosure of client personal information or bank confidential information; (iv) Cyber risk tolerance — the Bank accepts residual cyber risk up to the level that can be managed within the operational resilience framework and the incident-response capability; material cyber risk above this threshold is escalated to the Board. The IT risk appetite is stated in the Board-approved RAS; Senna and Helena co-own the IT risk appetite rows.

- **IT risk identification covers technology-specific and AI-specific scenarios.** The IT risk identification process (as part of the RCSA) must include the following technology-specific risk scenarios at a minimum: (a) ransomware and destructive malware (data encryption, production system unavailability); (b) cloud outage or cloud vendor failure (Azure multi-region availability, vendor dependency); (c) data breach (unauthorised access to client personal information or bank confidential information); (d) model manipulation and adversarial AI inputs (prompt injection, adversarial examples, model exfiltration — specific to the AI-agent platform); (e) insider threat (privileged access misuse, data theft by an authorised user or agent); (f) supply-chain compromise (compromise of a third-party vendor or dependency that supplies code, models, or infrastructure); (g) agent identity spoofing (unauthorised actor assuming the identity of a bank agent in the event store). Senna owns the scenario library; Nadia contributes the AI-specific risk scenarios.

- **IT risk assessment uses a qualitative-quantitative hybrid.** Each IT risk scenario is assessed on: (i) likelihood (probability of occurrence in the next 12 months: Low / Medium / High / Very High); (ii) impact (impact on the Bank if the scenario materialises: Negligible / Minor / Moderate / Severe / Critical — assessed against availability, data integrity, confidentiality, financial, and regulatory dimensions); (iii) inherent risk rating (likelihood × impact); (iv) control effectiveness (the degree to which existing controls reduce likelihood or impact: Effective / Partially Effective / Ineffective); (v) residual risk rating (inherent risk adjusted for control effectiveness). Residual risk ratings above Medium are subject to quarterly review. Residual risk ratings of Severe or Critical are escalated to the Board (CEO interim).

- **IT risk treatment: four options.** For each assessed IT risk, the Bank selects a treatment: (a) Mitigate — implement controls to reduce likelihood or impact to within appetite; treatment plans are typed events in the event store, tracking control implementation status; (b) Accept — accept the residual risk within appetite, with explicit Board (CEO interim) sign-off for risk above Low; (c) Transfer — contract with a third party (e.g., cyber insurance, vendor SLA) to bear part of the financial impact; IT risk transfer does not transfer the Bank's regulatory accountability; (d) Avoid — discontinue the activity giving rise to the risk. Risk acceptance above Low residual rating requires explicit Helena (Chief Risk Officer) + Board (CEO interim) approval. Treatment plans are tracked as typed events; open treatments are in the IT risk register. A treatment with no progress event in 90 days is an Alert.

- **IT risk register.** Senna maintains the IT risk register as a projection of risk-related typed events in the event store. Each entry in the register records: risk scenario; inherent risk rating; controls in place; control effectiveness; residual risk rating; treatment option selected; treatment plan status; risk owner; and last review date. The register is the single source of truth for IT risk; Senna produces a top-10 residual-risk summary for the quarterly Board report. Helena reviews the register quarterly for integration with the enterprise risk register.

- **RCSA — IT risk rows.** The IT risk management programme integrates with the Bank's Risk and Control Self-Assessment (RCSA) process owned by Helena. IT risk scenarios are named RCSA rows; Senna is the risk owner for each IT/cyber row; Helena is the enterprise-risk integrator. The RCSA runs annually; IT risk rows are updated continuously on the register with quarterly formal review.

- **Monitoring and reporting.** IT risk monitoring is continuous via the SIEM, automated recon pipelines, and access-control monitoring. Senna receives automated alerts from the SIEM for: authentication anomalies; privileged access exercises; configuration changes outside the change-management window; vulnerability scan findings; and unusual agent-platform behaviour. Monitoring gaps (a class of events that cannot be detected) are named IT risk findings. Senna reports monitoring status to Devon quarterly.

### Roles

Senna owns the IT risk register, the risk identification and assessment process, and the monitoring programme. Helena integrates IT risk into the enterprise risk framework and co-owns the IT risk appetite rows in the RAS. Devon ensures the operational systems produce the events and metrics that feed the monitoring programme. Nadia contributes AI-specific risk scenarios and model-risk inputs. Vera audits the IT risk management programme annually. The Board (CEO interim) approves the IT risk appetite and reviews the top-10 residual risks quarterly.

### Breach

An IT risk treatment plan with no progress event in 90 days is an Alert. A residual risk rated Severe or Critical not escalated to the Board (CEO interim) within the quarterly reporting cycle is a Hard Breach. An IT risk scenario identified by a third-party penetration test but absent from the RCSA is a Hard Breach: Senna adds it within 5 business days of the penetration test report; Helena is notified.

---

## 4. Access Controls and Identity Management

**Owner:** Senna (Security engineer, engineering) · **Approval:** Devon (Chief Operating Officer, governance) for new privileged-access roles; Senna for access-right reviews · **Cadence:** Access rights reviewed quarterly; privileged access reviewed monthly; joiner/mover/leaver controls on event-trigger · **Citation:** JS 1/2023 Part B — IT Risk Management (access controls); JS 2/2024 — Cybersecurity Framework; POPIA — s.19 (security safeguards); Principle 4 (`Principles/4-security-designed-in.md`); Principle 6 (`Principles/6-autonomous-by-default.md`) — agent identity

### Purpose

This section governs how the Bank controls access to its IT systems, data, and infrastructure. Zero-trust architecture and least-privilege access control are the architectural defaults (Principle 4); this section operationalises those principles at the policy layer. The section covers human access controls, agent (AI) identity and access management, privileged access management, and joiner/mover/leaver controls.

### Principles

- **Zero-trust: verify every request.** No access request is trusted by default, regardless of the network segment from which it originates. Every access request — human or agent — is authenticated (verifying the identity of the requester), authorised (verifying that the requester has permission to access the resource), and encrypted (protecting the access in transit). The zero-trust architecture is implemented at the network, application, and data layers.

- **Least-privilege access control.** Every human user, agent, and system component has the minimum access rights required to perform its function. Access rights are defined by role (Role-Based Access Control, RBAC); no access rights are granted to individuals that exceed the role definition. Over-privileged access identified in a quarterly review is revoked within 5 business days. Devon approves access right additions above baseline role; Senna reviews quarterly.

- **Agent identity is a first-class security requirement.** The AI agent fleet (Principle 6) is an extended attack surface: a compromised or spoofed agent identity is a material security risk. Each agent has a unique, cryptographically verifiable identity in the agent-identity framework (managed by Atlas (Platform engineer, engineering) per the agent-identity substrate). Agent access to the event store, document store, and external APIs is governed by the agent's identity and the access rights attached to its role. An agent event store entry without a valid agent identity is a typed anomaly alert.

- **Privileged access management.** Privileged access (access to production infrastructure, database administration, cryptographic key material, security tooling) is subject to enhanced controls: hardware-enforced Multi-Factor Authentication (MFA); Privileged Access Management (PAM) tooling with session recording; dual-control for access to HSM key material; time-limited access grants (privileged sessions are not persistent). Senna maintains the list of privileged roles; Devon approves new privileged-role additions. Privileged access exercised outside a change-management window is an Alert.

- **Joiner/mover/leaver controls.** Access rights for new team members (joiners) are provisioned only on Senna's approval after the role definition is confirmed. Access rights for movers (role changes) are updated within 2 business days of the role change; old rights are revoked; new rights are provisioned. Access rights for leavers are revoked within 4 hours of departure confirmation. The joiner/mover/leaver events are typed; any access provisioned or active outside these windows is an Alert. In the build phase, the team is primarily AI agents; human joiners are the statutory minimum; the leaver-control standard applies to both.

- **MFA is mandatory for all human access.** Every human user accessing any Bank system (including the event store dashboard, cloud management plane, code repositories, and collaboration tools) must use hardware-backed MFA (FIDO2/WebAuthn or TOTP with a hardware token). Passwords alone are not a sufficient authentication factor for any Bank system. Senna enforces MFA as a platform-level control; non-compliant access attempts are blocked and logged as anomaly events.

- **Network segmentation and micro-segmentation.** The Bank's cloud infrastructure is segmented: production systems are in a separate network segment from development and testing systems; within production, the event store, agent runtime, and external-facing APIs are micro-segmented. Cross-segment communication is explicitly allowed or denied; implicit allow is rejected. Devon and Atlas own the network-segmentation design; Senna approves the segmentation architecture.

- **Session management.** Production system sessions are time-limited; idle sessions are terminated after 15 minutes. Long-running sessions (e.g., agent runtime sessions) are authenticated on a token-refresh basis; token refresh failures terminate the session. Session logs are events in the SIEM.

### Roles

Senna owns the access-control policy, the privileged-access management programme, and the quarterly access-right review. Devon approves privileged-role additions and owns the operational access-provisioning systems. Atlas builds the agent-identity framework and the platform-level access controls. Zara reviews the POPIA-security access controls (confirming that access to personal information is limited to role-need). Vera audits access controls annually — testing least-privilege compliance, MFA enforcement, and joiner/mover/leaver timeliness.

### Breach

MFA not enforced for a human user account accessing a Bank system is a Hard Breach: Senna revokes access immediately; Devon remediates the platform control gap; Vera logs a finding. Leaver access not revoked within 4 hours is a Hard Breach: Senna leads immediate revocation; incident recorded. Agent event store entry without a valid agent identity is a Critical anomaly: Atlas investigates; Senna leads security response.

---

## 5. Change Management

**Owner:** Devon (Chief Operating Officer, governance) — process; Senna (Security engineer, engineering) — security gate · **Approval:** Devon for standard changes; Senna for changes to security-critical systems; Board (CEO interim) for architecture-level changes · **Cadence:** Change management is continuous (event-triggered); change review cadence matches the Bank's release cycle · **Citation:** JS 1/2023 Part B — IT Risk Management; Principle 4 (`Principles/4-security-designed-in.md`); `Procedures/by-policy/change-management.md` (procedure)

### Purpose

This section governs the Bank's change-management framework for production IT systems. Change management is the primary control against unplanned configuration drift, untested changes, and changes that introduce new vulnerabilities. All changes to production systems — including infrastructure changes, platform code changes, agent-configuration changes, and model updates — are governed by the change-management process.

### Principles

- **All production changes are governed.** No change to a production system is made outside the change-management process. A change is any modification to the production environment: code deployment, infrastructure configuration change, agent-configuration update, model version change, network rule change, access-right addition, or certificate rotation. Unplanned production changes (changes made outside the change-management process) are security incidents.

- **Change types: standard, significant, and emergency.** Standard changes are pre-approved, low-risk, and follow a documented, tested procedure (e.g., routine certificate rotation, dependency patch within approved version bounds). Significant changes require a change-request with impact assessment, rollback plan, and testing confirmation before implementation; Devon approves significant changes; Senna approves significant changes to security-critical systems. Emergency changes (changes required to address a production incident or active security threat) may be implemented without pre-approval but must have a mandatory post-hoc review within 48 hours; Senna and Devon are notified immediately.

- **Security gate for security-critical systems.** Changes to security-critical systems (event store, agent-identity framework, HSM configuration, SIEM, network segmentation, authentication infrastructure) require explicit Senna approval before deployment. The security gate is an automated check in the CI/CD pipeline (`bun run ci` from `prototype/`) that confirms the change has been through the security review. A deployment to a security-critical system without the security-gate approval is a Hard Breach.

- **Rollback capability is mandatory.** Every significant change must have a tested rollback plan before deployment. The rollback plan is part of the change request; Devon confirms rollback capability before approving deployment. A change deployed without a tested rollback plan is a Hard Breach.

- **Change success rate as KPI.** The change success rate (changes deployed without requiring rollback as a percentage of total changes) is a KPI reported in the quarterly IT governance report. A change success rate below 95% for two consecutive quarters is an Alert; Senna and Devon investigate root causes.

- **Architecture-level changes require Board approval.** Any change that materially alters the IT architecture — e.g., adoption of a new cloud provider, migration of the event store to a different architecture, introduction of a new AI model API provider, changes to the zero-trust network boundary — requires Board (CEO interim) approval before implementation. Senna and Devon propose architecture changes; the Board approves; Atlas implements.

### Roles

Devon owns the change-management process and approves significant changes. Senna owns the security gate for security-critical-system changes. Atlas implements changes. Vera audits change management annually: reviewing whether unplanned production changes occurred, whether the security gate was bypassed, and whether rollback capabilities were tested.

### Breach

An unplanned production change (outside the change-management process) is a Hard Breach: Devon investigates; Senna assesses security impact; Vera is notified. A security-gate bypass (deployment to a security-critical system without Senna approval) is a Critical breach: Senna leads immediate incident response; the change is rolled back unless the rollback itself would cause greater harm.

---

## 6. Asset Management and Cryptographic Controls

**Owner:** Senna (Security engineer, engineering) · **Approval:** Devon for new asset-class additions; Senna for classification-level changes · **Cadence:** Asset inventory updated continuously (provisioning events); asset classification review annually; key rotation per schedule · **Citation:** JS 1/2023 Part B — IT Risk Management; JS 2/2024 — Cybersecurity Framework; Principle 4 (`Principles/4-security-designed-in.md`) — FIPS 140-2 Level 3 HSM; POPIA — s.19 (security safeguards)

### Purpose

This section governs the Bank's IT asset management and cryptographic controls. Asset management ensures that every IT asset is inventoried, classified by sensitivity, and managed with controls calibrated to its classification. Cryptographic controls ensure that key material is protected by FIPS 140-2 Level 3 Hardware Security Modules (HSMs) and managed under a formal key-management framework.

### Principles

- **All IT assets are inventoried.** Every IT asset — hardware (servers, network devices, workstations), software (platform code, third-party software, AI models), data assets (event store, document store, databases), and cloud resources (Azure subscriptions, resource groups, managed services) — is inventoried in the IT asset register. The asset register is a typed projection of provisioning and decommissioning events; it is not a manually-maintained spreadsheet. Atlas maintains the asset register; Senna reviews it quarterly.

- **Four-level classification.** IT assets are classified by sensitivity: (i) Public — no restriction on disclosure (e.g., public documentation, published APIs); (ii) Internal — restricted to bank personnel and authorised agents (e.g., internal procedures, agent-runtime configuration); (iii) Confidential — restricted to a defined group of personnel and agents (e.g., client personal information, financial records, compliance correspondence); (iv) Restricted — the most sensitive classification, restricted to the minimum number of individuals and agents necessary (e.g., HSM key material, regulatory submissions, board minutes, security tooling credentials). Controls are calibrated to classification: Restricted assets require hardware-backed access, dual-control where applicable, and enhanced audit logging.

- **FIPS 140-2 Level 3 HSM for all cryptographic key material.** All cryptographic key material (private keys, symmetric keys, key-encryption keys) is stored in and operated from FIPS 140-2 Level 3 Hardware Security Modules. No plaintext key material is stored outside the HSM. HSM access is controlled by the privileged-access management controls in §4; access to production HSM key material requires dual-control (two authorised individuals or agents). Key material generated outside the HSM boundary is a Critical security finding.

- **Key management framework.** The Bank's key management framework covers: key generation (within the HSM); key distribution (secure channel, no plaintext transmission); key rotation (scheduled rotation per key type — see below); key revocation (immediate revocation on suspected compromise, system upgrade, or personnel departure); key archival (keys used to encrypt archived data are retained for the archive retention period); and key destruction (secure HSM key deletion at end of key lifecycle). The key rotation schedule is: TLS certificates — 12 months (or 90 days for public-CA-issued certificates per CAB Forum requirements); signing keys — 12 months; encryption keys — 24 months; root CA keys — 5 years (HSM-held, dual-control). Senna owns the key management framework; Atlas operates the HSM infrastructure.

- **No plaintext credentials in code or configuration.** No cryptographic key, API credential, password, or secret is stored in plaintext in source code, configuration files, or environment variables accessible outside the secrets management system. All secrets are injected at runtime from the secrets management system (Azure Key Vault, backed by the HSM). A plaintext secret discovered in the codebase or configuration is a Critical security finding: immediate revocation and rotation required.

- **Data classification drives encryption requirements.** Confidential and Restricted data is encrypted at rest (AES-256 minimum) and in transit (TLS 1.3 minimum). Public and Internal data is encrypted in transit; at-rest encryption is a best practice but not a hard requirement for genuinely public data. Client personal information is always treated as Confidential; financial records are Confidential; HSM key material is Restricted. Devon's infrastructure configuration enforces encryption requirements; Senna audits quarterly.

### Roles

Senna owns the asset management policy, the cryptographic controls framework, and the key management framework. Devon owns the operational infrastructure that enforces classification-based controls. Atlas operates the HSM infrastructure and the secrets management system. Vera audits asset management and cryptographic controls annually: testing whether the asset register is complete, whether classification is correctly applied, and whether key rotation is on schedule.

### Breach

Plaintext key material outside the HSM boundary is a Critical breach: immediate revocation and rotation; Senna leads incident response; Devon conducts root-cause analysis. Key rotation schedule missed by more than 30 days is a Hard Breach: Senna schedules emergency rotation; the overdue key is flagged in the IT risk register. Asset not in the inventory (shadow IT) is a Hard Breach: Devon and Senna assess and remediate; Vera notified.

---

## 7. Security Monitoring, Vulnerability Management, and Incident Response

**Owner:** Senna (Security engineer, engineering) · **Approval:** Devon (Chief Operating Officer, governance) for monitoring infrastructure changes; CEO (interim) for PA notification decisions · **Cadence:** Monitoring is continuous; vulnerability scans quarterly; penetration test annually; incident response on event-trigger · **Citation:** JS 1/2023 Part B — IT Risk Management; JS 2/2024 — Cybersecurity Framework; POPIA — s.22 (notification of information security compromise); Banks Act 94 of 1990 `[citation: TBC — security incident reporting obligation]`; `Procedures/by-policy/incident-response.md` (procedure)

### Purpose

This section governs the Bank's continuous monitoring, vulnerability management, and incident response framework. Security monitoring detects threats and anomalies in real time; vulnerability management identifies and remediates weaknesses before they are exploited; incident response contains and recovers from security incidents. Together, these three disciplines form the Bank's detect-and-respond capability.

### Principles

- **All production system events are logged.** Every production system event that has security relevance — authentication, authorisation, configuration change, privileged access exercise, network connection, agent action — is a typed event in the SIEM or the event store. Coverage gaps (a class of events that cannot be detected) are named IT risk findings. Devon confirms that log shipping to the SIEM is operational for all production systems; Senna monitors the SIEM.

- **SIEM integration and alerting.** The SIEM aggregates log data from the event store, Azure infrastructure, agent runtime, network devices, and third-party services. The SIEM correlates events and applies detection rules to identify anomalies and security threats. Senna owns the detection rule set; Devon owns the SIEM infrastructure. SIEM alerts are typed events; alert disposition (true positive, false positive, escalated) is recorded. High-volume false positives are tuned out of the rule set; a detection rule with >80% false-positive rate is reviewed within 30 days.

- **Log retention per the Records Management Policy.** Security event logs are retained per `Policies/records-management-policy-v1.md` (Class 4 — Operational and platform records, 1-year minimum floor; longer where required by PA directive). Senna confirms the log-retention configuration aligns with the Records Management Policy.

- **Vulnerability scanning — quarterly.** All production systems are subject to quarterly vulnerability scans using an approved vulnerability scanning tool. Scan results are reviewed by Senna within 5 business days of scan completion. Findings are classified by severity (Critical / High / Medium / Low / Informational) and assigned to Devon or Atlas for remediation. The remediation SLA is: Critical — 7 days; High — 14 days; Medium — 30 days; Low — 90 days or next quarterly scan. Senna tracks open findings in the IT risk register.

- **Penetration testing — annual.** The Bank conducts an annual external penetration test of its production systems by a qualified third-party penetration testing provider. The penetration test scope is approved by Senna and Devon before engagement; it covers the external attack surface, internal privilege-escalation paths, AI-platform attack scenarios (prompt injection, model manipulation), and cloud-configuration review. Penetration test findings are treated as vulnerability findings; the same remediation SLA applies. The penetration test report is a Confidential document in the content-addressed document store; Senna presents the findings and remediation status to the Board (CEO interim) at the next quarterly report.

- **AI-platform specific monitoring.** The agent platform requires monitoring controls beyond standard IT monitoring: (a) agent behaviour anomaly detection — detection of agent actions outside the expected operational envelope (unusual event store write patterns, unexpected API calls, out-of-sequence event types); (b) prompt injection detection — monitoring for adversarial inputs that attempt to alter agent behaviour; (c) model output monitoring — statistical monitoring of model outputs for distributional shift that may indicate model manipulation. Senna and Nadia (Independent-validation engineer, engineering) co-own the AI-platform monitoring framework.

- **Incident response is event-triggered and typed.** A security incident is detected by the SIEM, a vulnerability scan, a penetration test, a third-party notification, or direct observation. The moment a security incident is identified, a `SecurityIncident { incidentId, severity, detectedAt, detectedBy, initialScope }` event is emitted in the event store. Senna leads the incident-response process per `Procedures/by-policy/incident-response.md`. The incident is contained, eradicated, and recovered; all steps are typed events. The post-incident review is a typed document in the content-addressed document store.

- **POPIA s.22 notification.** A security incident involving the compromise of personal information triggers a POPIA s.22 notification obligation: the Bank must notify the Information Regulator and, where required, the affected data subjects. Zara (Chief Compliance Officer, governance) and Imani (Legal-as-code engineer, engineering) assess the notification obligation within 72 hours of confirming the compromise. The notification decision is a typed event; the notification itself is filed in the content-addressed document store.

- **PA notification.** A material security incident (one that could affect the Bank's ability to meet its regulatory obligations or that involves a material breach of PA requirements) must be notified to the PA under the applicable Banks Act provision `[citation: TBC — precise notification obligation; Imani + external counsel to ratify at the licence-application gate]`. The CEO (interim) approves the PA notification; Imani prepares the notification; Owen files it.

### Roles

Senna owns the monitoring programme, the vulnerability management programme, and the incident-response framework. Devon owns the monitoring infrastructure (SIEM, log shipping) and the vulnerability scanning tools. Nadia contributes AI-platform monitoring design. Zara and Imani assess POPIA and regulatory notification obligations. The CEO (interim) approves PA notifications. Vera audits the monitoring programme and incident response annually: assessing monitoring coverage, vulnerability remediation timeliness, and incident-response completeness.

### Breach

Vulnerability scan not conducted within the quarterly schedule (>14 days late) is an Alert. A Critical or High vulnerability not remediated within the SLA is a Hard Breach: Senna escalates to Devon; the overdue finding is reported to the Board at the next quarterly report. A security incident where the `SecurityIncident` event was not emitted at the time of detection (i.e., the incident was managed without creating a typed event) is a Hard Breach: the incident record is remediated retrospectively; Vera is notified. POPIA s.22 notification obligation identified and not acted upon within 72 hours is a Critical breach: Zara and Imani lead the remediation; the Information Regulator is notified of the delay.

---

## 8. Obligations Closure Table

The following obligations-register rows are closed by this policy. Status per the obligations-register convention.

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-CY-15` | IT governance framework per JS 1/2023: board-approved IT strategy, IT risk management integrated into enterprise risk, IT performance monitoring, third-party IT risk | **IN FORCE** — closed | §1 (Overarching — Board accountability principle, IT governance is board-level), §2 (IT Governance Framework — full section: IT strategy, IT performance KPIs, quarterly board report, third-party IT risk) |
| `ORG-CY-16` | IT risk management per JS 1/2023: risk identification and assessment, IT risk appetite, risk treatment, monitoring and reporting | **IN FORCE** — closed | §3 (IT Risk Management Framework — full section: IT risk appetite, risk identification + AI-specific scenarios, risk assessment, four treatment options, IT risk register, RCSA integration, monitoring), §7 (Security Monitoring, Vulnerability Management, Incident Response) |

---

## 9. Substrate Dependencies and Gaps

Per the events-first authoring rule (Principle 1), gaps are not hidden; they are the work for downstream substrate phases.

### 9.1 Substrate currently under construction

- **Agent-identity framework (Atlas, Senna).** Cryptographically verifiable agent identities; agent access control in the event store; agent-action attribution. Discharge exit signal: `AgentIdentityRegistered { agentId, publicKey }` event in schema; all agent event store entries carry verified agent identity; Vera recon `recon:agent-identity-coverage` green.
- **SIEM integration (Devon, Atlas, Senna).** Aggregation of event store, Azure infrastructure, agent runtime, and network logs into the SIEM; detection rule set; automated alerting pipeline. Discharge exit signal: SIEM receiving logs from all production system types; detection rules producing typed alert events; recon `recon:siem-log-coverage` green.
- **Secrets management system (Atlas, Senna).** Azure Key Vault backed by HSM; runtime secret injection into agent platform and infrastructure. Discharge exit signal: no plaintext secrets in codebase or configuration confirmed by automated scan; all runtime secrets injected from Key Vault; HSM key generation confirmed.
- **IT risk register substrate (Senna, Helena).** Typed `ItRiskRegistered`, `ItRiskAssessed`, `ItRiskTreatmentUpdated` events; IT risk register projection for quarterly Board report. Discharge exit signal: IT risk register projection queryable; top-10 summary producible without manual intervention.

### 9.2 Procedures planned but not yet authored

- `Procedures/by-policy/access-control.md` — access-right provisioning, PAM, joiner/mover/leaver procedure, per §4.
- `Procedures/by-policy/vulnerability-management.md` — scan cadence, finding classification, remediation SLA tracking, per §7.
- `Procedures/by-policy/incident-response.md` — incident classification, containment, eradication, recovery, POPIA s.22 notification assessment, PA notification, per §7.
- `Procedures/by-policy/key-management.md` — key generation, rotation schedule, revocation, dual-control procedure, per §6.

### 9.3 Citation gaps (TBC)

Per Principle 2, no sub-clause indices are invented. The following are `[citation: TBC]` until Imani + external counsel ratify at the licence-application gate:

1. Precise Reg 39 sub-clause indices for IT systems and operational risk obligations under the Banks Act.
2. Banks Act provision for security incident reporting obligation to the PA.
3. BCBS operational risk principles document (precise title and publication date).
4. Information Regulator guidance on POPIA s.22 notification timelines and content requirements (precise GN reference).
5. Any PA-specific cybersecurity directive beyond JS 2/2024 (Mira curatorship route).

---

## 10. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-13 | Senna (Security engineer, engineering) + Devon (Chief Operating Officer, governance) | Initial policy authored. Nine sections: (1) Overarching Policy — Board approval, JS 1/2023 + JS 2/2024 + POPIA + Banks Act citations, ten principles (board accountability, security designed in, zero-trust, least-privilege, events-first security logging, IT risk as enterprise dimension, AI-platform risk explicitly scoped, third-party IT risk ownership, continuous monitoring, resilience as design), full roles including Senna/Devon/Atlas/Helena/Vera/Nadia/Imani/Zara, three-severity breach taxonomy; (2) IT Governance Framework (JS 1/2023 Part A) — board-approved IT strategy, alignment to business strategy, IT performance KPIs (availability/incidents/change-success/vulnerability/security), quarterly IT governance report, third-party IT risk assessment, governance non-delegation principle, AI governance as IT governance sub-domain; (3) IT Risk Management Framework (JS 1/2023 Part B) — board-approved IT risk appetite (availability RTO/RPO, data integrity, confidentiality, cyber tolerance), IT risk identification (seven named scenarios including AI-specific: model manipulation, prompt injection, agent spoofing), qualitative-quantitative hybrid assessment, four treatment options (mitigate/accept/transfer/avoid), IT risk register, RCSA integration, continuous monitoring and reporting; (4) Access Controls and Identity Management — zero-trust verify-every-request, least-privilege RBAC, agent identity as first-class security requirement, PAM with hardware MFA, joiner/mover/leaver controls, MFA mandatory for all human access, network micro-segmentation, session management; (5) Change Management — all production changes governed, standard/significant/emergency change types, security gate for security-critical systems, rollback capability mandatory, change-success-rate KPI, architecture-level Board approval; (6) Asset Management and Cryptographic Controls — full IT asset inventory, four-level classification (Public/Internal/Confidential/Restricted), FIPS 140-2 Level 3 HSM for all key material, key management framework (generation/distribution/rotation/revocation/archival/destruction), no plaintext credentials, encryption requirements by classification; (7) Security Monitoring, Vulnerability Management, Incident Response — all production events logged, SIEM integration, log retention per Records Management Policy, quarterly vulnerability scans, annual penetration test, AI-platform specific monitoring (agent behaviour anomaly / prompt injection / model output), typed SecurityIncident events, POPIA s.22 notification, PA notification; (8) Obligations Closure Table — ORG-CY-15 and ORG-CY-16 closed; (9) Substrate Dependencies and Gaps — agent-identity framework, SIEM integration, secrets management, IT risk register substrate (gaps named per Principle 2); citation gaps named. Identity discipline per CLAUDE.md observed throughout. |
