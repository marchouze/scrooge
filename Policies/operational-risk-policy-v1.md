---
policy-id: operational-risk-policy
title: Operational Risk Policy v1
version: "1"
status: IN FORCE
owner: Helena (Chief Risk Officer, governance)
effective-from: "2026-05-13"
next-review: "2027-05-13"
citations:
  - Banks Act 94 of 1990
  - Regulations Relating to Banks 2012 (as amended) — Reg 39
  - BCBS Principles for the Sound Management of Operational Risk (PSMOR) 2021
  - BCBS Basel III/IV — operational risk capital (Basic Indicator / Standardised Approach)
  - D-REGULATORY-READINESS-GATE-PLAN
author: Helena (Chief Risk Officer, governance) + Devon (Chief Operating Officer, governance)
date: 2026-05-13
summary: Standalone Operational Risk Policy covering the 12 BCBS PSMOR principles, RCSA, loss event database, KRI framework, BIA/SA/SMA capital approaches, three-lines-of-defence model, business continuity as sub-domain, material outsourcing risk, NPA operational-risk dimension, and Operational Risk Committee governance. Closes obligations ORG-PR-17, ORG-PR-24, ORG-PR-39. LICENCE-BIND.
decision-required: false
riskTaxonomy:
  - RT-OR
  - RT-BC
---

# Operational Risk Policy v1

> **Authors.** Helena (Chief Risk Officer, governance) — lead; Devon (Chief Operating Officer, governance) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Implements the operational risk management obligations under Reg 39 (Regulations Relating to Banks 2012, as amended) and the BCBS *Principles for the Sound Management of Operational Risk* (PSMOR, June 2011, revised 2021).
> **Obligations closed.** `ORG-PR-17` (operational risk identification, measurement, control framework), `ORG-PR-24` (documented operational-risk-management framework per Reg 39 + BCBS PSMOR), `ORG-PR-39` (comply with the 12-principle BCBS PSMOR framework).
> **Status.** LICENCE-BIND. The operational risk management framework must be in place at PA licence application. Capital measurement (BIA / Standardised Approach) commences at the first SARB reporting period after commencement of trading. Build-phase operationalisation is preparation for compliance, not compliance itself (per `project_rules_bind_at_commencement.md` memory, 2026-05-07). The supporting substrate (RCSA engine, loss event database, KRI monitoring platform) is under construction per `D-REGULATORY-READINESS-GATE-PLAN`.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Operational Risk Policy — Overarching

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual; triggered on material change to the operational risk profile, business model, or regulatory direction · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks 2012 (as amended) — Reg 39 (Operational risk management requirements; `ORG-PR-24`) `[citation: TBC — precise Reg 39 sub-clause indices; Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate]` + BCBS *Principles for the Sound Management of Operational Risk* (PSMOR, June 2011, revised 2021; `ORG-PR-39`) + BCBS Basel III/IV operational risk capital (BIA, TSA, SMA) `[citation: TBC — precise BCBS Basel III/IV chapter and paragraph references for operational risk capital approaches]` + PA Guidance Note `[citation: TBC — any discrete PA guidance on operational risk; Mira (Compliance / RegTech engineer, engineering — reports to Zara (Chief Compliance Officer, governance)) curatorship route for PA publications]`

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") identifies, assesses, monitors, controls, and capitalises operational risk across all business lines, support functions, and agent-operated processes. Its purpose is to ensure that: (i) the Bank complies with Reg 39 and the 12-principle BCBS PSMOR framework at licence application; (ii) operational risk is managed within the Board-approved risk appetite at all times; (iii) capital is held for operational risk commensurate with the Bank's risk profile; and (iv) governance structures are sufficient to satisfy the PA that operational risk management is embedded across all three lines of defence.

Operational risk is defined as the risk of loss resulting from inadequate or failed internal processes, people, and systems, or from external events. This definition includes legal risk but excludes strategic risk and reputational risk (which are managed under separate frameworks). Legal risk for this purpose is the risk of loss arising from breach of law, regulations, or contracts — it is an operational risk sub-category and is subject to the loss-event capture and RCSA processes in this policy.

This policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). It cites the regulatory obligations above it; procedures under this policy (including `Procedures/by-policy/rcsa-execution.md`, `Procedures/by-policy/loss-event-capture.md`, `Procedures/by-policy/kri-monitoring.md`, and `Procedures/by-policy/bcp-testing.md`) operationalise it; the RCSA engine, loss event database, and KRI monitoring platform are the system capabilities that execute those procedures. The policy does not reproduce regulatory text; it anchors management choices above the regulatory floor.

Hoz Bank Limited's labour force is AI-agent-operated (Principle 6). Operational risk management in an AI-agent institution must address the specific risk categories arising from AI agent behaviour: model output error, agent decision boundary violation, agent coordination failure, and adversarial manipulation of agent inputs. These AI-specific categories are captured within the Basel Level 1/2 operational risk taxonomy (specifically under "Systems" and "Execution, Delivery & Process Management") and are subject to the full operational risk framework under this policy.

### Principles

- **BCBS PSMOR as the governing standard.** The Bank implements all 12 principles of the BCBS PSMOR (2021) as its operational risk management framework, per `ORG-PR-39`. The 12 principles cover: governance (Principles 1–3), risk management environment (Principles 4–8), information and communications technology (Principle 9), business continuity (Principle 10), disclosure (Principle 11), and the role of supervisors (Principle 12). Each principle is given effect in the relevant section of this policy.
- **Three-lines-of-defence model.** The Bank operates a three-lines-of-defence model. The first line (Devon's COO function and the AI agent-operated processes) owns operational risk day-to-day; the second line (Helena's risk function) sets the framework, monitors, and challenges the first line's risk assessment; the third line (Vera, reporting functionally to Thandiwe (Chief Audit Executive, governance)) provides independent assurance. The second line is independent of the first; Vera is independent of both. This independence is non-negotiable and is monitored by Helena and Thandiwe.
- **Events-first operational risk accounting.** All operational risk events — loss events, RCSA findings, KRI threshold breaches, BCP test outcomes, and NPA operational risk assessments — are typed events in the event log (Principle 1). The loss event database, the RCSA register, and the KRI monitoring platform are event-derived projections, not separate authoritative stores. A loss event that exists only in a spreadsheet and not as an `OperationalLossEventRecorded` event in the log is a Vera finding.
- **Capital is a floor, not a target.** The operational risk capital charge (BIA initially; Standardised Approach as the Bank grows) is the regulatory floor. The Bank holds capital that meets or exceeds the floor at all times, as part of the total ICAAP capital adequacy assessment (cross-reference `Policies/capital-management-policy-v1.md`, §3). The ICAAP Pillar 2A self-assessment for operational risk is the vehicle through which Helena assesses whether the Pillar 1 floor is adequate for the Bank's specific risk profile.
- **Operational risk appetite is quantitatively anchored.** The Risk Appetite Statement (RAS) operational risk lines (OR-1 through OR-5, defined in §4 of this policy) express the maximum annual net operational loss the Board is willing to accept, the KRI amber/red thresholds, and the BCP recovery time objectives. Exceeding any RAS OR line is an escalation event.
- **Governance events are typed.** Operational Risk Committee meetings, RCSA cycle completions, loss event approvals, KRI threshold breaches, BCP test outcomes, and material outsourcing risk assessments are typed events in the event log. No governance decision is recorded as a prose minute without a corresponding typed event; a governance record without an event is a Vera finding.
- **AI-agent risks are first-class.** Because the Bank is AI-agent-operated, the operational risk framework explicitly addresses AI agent failure modes as a named risk category under "Systems" and "Execution, Delivery & Process Management." The RCSA (§4.2) includes a standing AI-agent risk dimension; the loss event database (§4.3) captures AI agent errors with a dedicated attribution field; KRIs (§4.4) include AI-specific indicators (agent error rate, agent boundary violation rate, model output drift).

### Roles

Helena (Chief Risk Officer, governance) is the policy owner and chairs the Operational Risk Committee (sub-committee of the Board Risk Committee). Helena's responsibilities include: owning the operational risk framework, RCSA programme, loss event database policy, and KRI library; challenging Devon's first-line risk self-assessments; reporting to the BRC and CEO; commissioning and reviewing independent validation of operational risk models. Devon (Chief Operating Officer, governance) is the co-author and first-line owner of operational risk for the Bank's agent-operated processes and support-function operations. Devon's responsibilities include: implementing the RCSA at the business-line and support-function level; maintaining the process register that feeds the RCSA; ensuring BCP plans are maintained and tested; managing material outsourcing arrangements' risk. Rohan (Market risk quantitative engineer, engineering — reports to Helena) builds the operational risk capital computation module (BIA and Standardised Approach) and provides quantitative support for RCSA and KRI calibration. Nadia (Independent-validation engineer, peer-in-second-line under Helena) validates the operational risk capital models. Vera (internal audit engineer — reports functionally to Thandiwe (Chief Audit Executive, governance)) provides third-line assurance. Owen (Company Secretary, governance) manages the Operational Risk Committee secretarially and files typed governance events. Zara (Chief Compliance Officer, governance) provides input on regulatory compliance-breach losses that qualify as operational risk events; compliance risk is a sub-category of operational risk for loss-event purposes.

### Breach

Breach taxonomy is three-severity:

- **Alert (Amber).** Any KRI reaches its amber threshold; a single operational loss event exceeds the amber materiality threshold set in `Procedures/by-policy/loss-event-capture.md`; a BCP test identifies a recovery-time-objective (RTO) gap. Immediate notification to Helena. Remediation plan required within the timeframe set in the relevant procedure.
- **Hard Breach (Red).** Any KRI reaches its red threshold; cumulative annual net operational losses exceed the RAS OR-1 annual loss tolerance; a BCP test reveals a Critical failure that cannot be remediated within 30 days. Immediate notification to Helena and Devon. Operational Risk Committee convened within one business day. Escalation to BRC and CEO if the breach is not remediated within the timeline set in `Procedures/by-policy/kri-monitoring.md`. PA notification if the breach constitutes a reportable operational risk event under Reg 39 `[citation: TBC — Imani confirms notification threshold and timeline]`.
- **Critical (Critical-Red).** A material operational failure causes the Bank to be unable to process client transactions for more than the critical RTO; a regulatory breach is confirmed (a loss event of type "Clients, Products & Business Practices" involving a regulatory fine exceeding the Critical threshold); or a cyber security incident disables a core system. Immediate CEO and BRC notification; PA notification per the applicable Banks Act provision `[citation: TBC — Imani + external counsel confirm]`; incident-management procedure activated.

---

## 2. BCBS PSMOR — 12 Principles Implementation (`ORG-PR-39`)

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim) for principles 1–3 (governance) and principle 10 (business continuity) which require Board-level endorsement · **Cadence:** Annual RCSA-cycle review of principle compliance; triggered on material change · **Citation:** BCBS PSMOR (2021) — 12 principles `[citation: TBC — precise paragraph references per principle; Imani curatorship route for BCBS publication]` + Reg 39 (`ORG-PR-24`)

### Purpose

The BCBS PSMOR (June 2011, revised 2021) sets 12 principles for the sound management of operational risk across four domains: governance (Principles 1–3), risk management environment (Principles 4–8), ICT risk (Principle 9), business continuity management (Principle 10), and disclosure (Principles 11–12). This section records how the Bank gives effect to each principle; it is not a reproduction of the BCBS text but a governance mapping of the Bank's framework choices to each principle. The section is updated at each annual RCSA cycle review.

### Principles 1–3: Governance

**Principle 1 — Board responsibility for the operational risk management framework.** The Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) is responsible for approving and periodically reviewing the operational risk management framework. The Board approves this policy, the Risk Appetite Statement's operational risk lines (OR-1 through OR-5), the RCSA programme, and the loss event materiality thresholds. A `OperationalRiskFrameworkApproved { version, approvedBy, approvalDate }` event is the Board approval record. The Board reviews the framework at least annually and on material change.

**Principle 2 — Senior management implementation.** Senior management (Devon as COO, first line; Helena as CRO, second line) is responsible for implementing the Board-approved framework consistently across all business lines and support functions. Devon maintains the process register and first-line RCSA; Helena maintains the second-line challenge framework and the RCSA aggregate view. The Operational Risk Committee is the primary senior-management governance mechanism; it provides the Board Risk Committee with a monthly operational risk report.

**Principle 3 — Three-lines-of-defence independence.** The second line (Helena) must be independent from the first line (Devon) in its assessment of operational risk. Helena does not report to Devon; both report independently to the CEO (interim). Helena's second-line challenge of Devon's first-line RCSA self-assessments is a structured governance process, not an advisory role. Any attempt to reduce second-line independence is a Vera Critical finding.

### Principles 4–8: Risk Management Environment

**Principle 4 — Identification and assessment.** The Bank identifies and assesses operational risk in all material products, activities, processes, and systems before their introduction or material change. The RCSA (§4.2) is the primary identification and assessment artefact; the NPA operational risk dimension (§4.6) is the product-level assessment gate. Every process in the process register (maintained by Devon) has a corresponding RCSA row.

**Principle 5 — Monitoring.** The Bank monitors operational risk exposures and loss events on an ongoing basis. The loss event database (§4.3) captures all events ≥ R5,000 within 5 business days of identification. KRIs (§4.4) are monitored monthly against amber/red thresholds. Helena produces a monthly operational risk monitoring report for the Operational Risk Committee.

**Principle 6 — Control and mitigation.** The Bank controls and mitigates operational risk through: documented process controls; system access controls and segregation of duties; agent boundary enforcement (for AI-operated processes); contractual protections in outsourcing arrangements; and insurance for insurable operational risks where cost-effective. Control gaps identified in the RCSA are remediated within the deadline set by Helena; overdue control remediations are escalated to Devon and the CEO.

**Principle 7 — Contingency and business continuity planning.** Business continuity and disaster recovery planning is a sub-domain of operational risk under this policy (§4.5). BCPs cover all critical processes with Recovery Time Objectives (RTOs) and Recovery Point Objectives (RPOs) set to meet the Bank's licensing obligations and client service commitments.

**Principle 8 — Role of disclosure and supervisory interaction.** Operational risk disclosures in the Pillar 3 report (annual) and the ICAAP submission to the PA include the operational risk capital methodology, the RCSA summary, material loss events above the disclosure threshold, and the KRI framework overview. Helena authors the operational risk chapter of the ICAAP. Disclosures are governed by the disclosure policy; this principle is cross-referenced to the Pillar 3 disclosure procedure.

### Principle 9: ICT Risk

**Principle 9 — ICT and cyber risk as operational risk sub-categories.** ICT risk (including cyber security risk) is a named sub-category of operational risk. The Information Security Policy (owned by the CISO, to be appointed per the Bank's governance structure) governs the technical controls; this policy governs the operational risk measurement and capital treatment of ICT and cyber losses. ICT loss events are captured in the loss event database under the Basel Level 1 category "Systems." The RCSA includes a standing ICT risk dimension covering: AI agent infrastructure, data integrity, system availability, and cyber-attack vectors. Helena and the CISO (once appointed) jointly review the ICT risk section of the RCSA annually.

Per Principle 9, the Bank ensures that ICT risk management is integrated into the operational risk framework, not siloed in a separate IT risk register that is not visible to Helena or the Operational Risk Committee. A standalone IT risk register that is not synchronised with the RCSA and the loss event database is a Vera finding.

### Principle 10: Business Continuity

**Principle 10 — Business continuity management.** See §4.5 (Business Continuity) of this policy. Business continuity is a named sub-domain of operational risk; BCPs are approved by the Board (CEO interim) and tested annually. Principle 10 requires that the Bank have plans in place to ensure ongoing or temporary resumption of critical operations if a severe disruption occurs; the BCPs must cover all critical business processes with defined RTOs and RPOs.

### Principle 11: Disclosure

**Principle 11 — Public disclosure.** The Bank publicly discloses information about its operational risk management framework, approach, and capital in the annual Pillar 3 report, consistent with BCBS Pillar 3 disclosure requirements `[citation: TBC — BCBS Pillar 3 disclosure requirements for operational risk]`. Disclosures include: a description of the operational risk management framework, the approach to operational risk capital (BIA / Standardised Approach), qualitative information on the RCSA and KRI programme, and summary-level loss data. Helena authors the operational risk disclosure chapter.

### Principle 12: Role of Supervisors

**Principle 12 — PA supervisory oversight.** The PA assesses the Bank's operational risk management framework through the SREP. The PA may require: additional information on specific loss events; review of the RCSA methodology; changes to the capital approach or the Pillar 2A add-on for operational risk; enhanced BCP testing. Helena is the primary liaison with the PA on operational risk matters. PA requests are filed as typed events; Helena responds within the PA-specified timeline. Responses to PA requests are stored in the BLAKE3 document store per `D-RMS-PHASE-1`.

---

## 3. Operational Risk Capital

**Owner:** Helena (Chief Risk Officer, governance) — methodology; Rohan (Market risk quantitative engineer, engineering) — computation; Camille (Chief Financial Officer, governance) — BA-return integration · **Approval:** Board (CEO interim) for capital approach election; PA notification for approach change · **Cadence:** Monthly capital computation for BA-return; quarterly ICAAP integration · **Citation:** BCBS Basel III/IV — BIA, TSA, SMA `[citation: TBC — BCBS Basel III/IV chapter and paragraph references]` + Regulations Relating to Banks — Reg 32 operational risk capital provisions `[citation: TBC — Reg 32 sub-clause for operational risk capital]` + `ORG-PR-17` (operational risk measurement framework)

### Purpose

The operational risk capital charge under Pillar 1 is a regulatory floor on the capital the Bank must hold for operational risk. The BCBS framework offers three approaches of increasing sophistication: Basic Indicator Approach (BIA), Traditional Standardised Approach (TSA), and the Advanced Measurement Approach (AMA, now replaced by the Standardised Measurement Approach — SMA — in Basel IV). The Bank adopts the BIA at commencement of trading, migrates to the TSA as gross income and business-line data accumulate, and considers the SMA at the appropriate scale. The capital computed under each approach feeds into the BA-return suite and the ICAAP.

### 3.1 Basic Indicator Approach (BIA) — Initial Capital Approach

The BIA capital charge equals 15% of the Bank's average annual gross income (GI) over the preceding three years. Gross income is defined per the Basel III/IV framework: net interest income plus net non-interest income, before provisions and operating expenses, excluding realized profits/losses from the sale of securities held to maturity, extraordinary items, and income from insurance (specific definition to be confirmed by Camille and Imani per the precise regulatory text `[citation: TBC]`). For the first three years, the average is computed over the available positive-GI years; years with negative GI are excluded per BCBS rules `[citation: TBC — BIA negative-year exclusion rule]`.

Rohan computes the BIA capital charge monthly from the event-derived income statement; the `OperationalRiskCapitalComputed { date, approach: "BIA", grossIncome, biaCap }` event is the canonical record. Camille integrates the BIA capital charge into the BA-100 return under the operational risk capital line. The ICAAP capital narrative includes a Pillar 2A operational risk self-assessment (Helena's view of whether the BIA floor is adequate given the Bank's AI-agent-specific risk profile); if the self-assessment indicates the BIA understates the true operational risk, a Pillar 2A add-on recommendation is made by Helena to the CEO and BRC.

### 3.2 Standardised Approach (TSA) — Target Capital Approach

Under the TSA, gross income is allocated to eight BCBS business lines: Corporate Finance, Trading & Sales, Retail Banking, Commercial Banking, Payment & Settlement, Agency Services, Asset Management, and Retail Brokerage. Each business line attracts a beta factor (ranging from 12% to 18%). The TSA capital charge is the three-year average of the sum of (GI × beta) across all positive-income business lines per year.

The Bank transitions from BIA to TSA when: (i) it has at least three full years of business-line-allocated gross income data; and (ii) the operational risk management framework is assessed by the PA as sufficiently sound to qualify for TSA `[citation: TBC — TSA qualifying criteria under PA / BCBS]`. The transition requires PA notification. Devon maintains the business-line allocation register; Rohan computes the TSA capital from it.

### 3.3 Standardised Measurement Approach (SMA) — Long-term Aspirational

The SMA (Basel IV) combines a Business Indicator Component (BIC — based on gross income) with an Internal Loss Multiplier (ILM — based on the Bank's own loss history). The SMA requires at least 10 years of operational loss data for the ILM to be calibrated. Helena plans for SMA adoption when the Bank has sufficient loss history and scale; the transition is a Board decision requiring PA approval. The loss event database (§4.3) is built from the first trade date to accumulate the loss history the SMA requires.

---

## 4. Risk and Control Self-Assessment (RCSA)

**Owner:** Devon (Chief Operating Officer, governance) — first line; Helena (Chief Risk Officer, governance) — second-line challenge · **Approval:** Board (CEO interim) endorses RCSA programme; Helena approves individual RCSA sign-off · **Cadence:** Annual full RCSA cycle; triggered on material process change, new product, or material loss event · **Citation:** BCBS PSMOR (2021) — Principle 4 (identification and assessment), Principle 5 (monitoring) + Reg 39 (`ORG-PR-24`) + `ORG-PR-17` (identification and measurement framework)

### Purpose

The RCSA is the Bank's primary mechanism for identifying operational risks, assessing the adequacy of controls, and producing an evidence base for the ICAAP Pillar 2A self-assessment. It is conducted annually across all business lines and support functions. The RCSA is not a compliance check-box; it is a substantive risk-management exercise that produces actionable findings. All RCSA findings (control gaps, risk ratings, remediation commitments) are typed events in the event log; the RCSA register is an event-derived projection.

### 4.1 RCSA Scope and Methodology

The RCSA covers every process in Devon's process register. The process register lists all material operational processes of the Bank — agent-operated trading processes, settlement processes, compliance monitoring processes, financial reporting processes, IT operations, third-party management, and support functions. Each process is assessed for: (i) inherent risk (the operational risk exposure before controls, rated Low / Medium / High / Critical on a qualitative scale calibrated by Helena); (ii) control adequacy (the adequacy of existing controls to mitigate the inherent risk, rated Adequate / Needs Improvement / Inadequate); and (iii) residual risk (the operational risk exposure after controls, derived from the inherent risk × control adequacy matrix).

Residual risk ratings drive the RCSA action plan: Critical residual risk requires immediate escalation to Helena and Devon; High residual risk requires a remediation plan within 90 days; Medium and Low residual risk are monitored via KRIs. The RCSA methodology is documented in `Procedures/by-policy/rcsa-execution.md`.

### 4.2 Annual RCSA Cycle

The annual RCSA cycle runs from `RcsaCycleStarted` to `RcsaCycleCompleted`. Key events in the cycle:

1. `RcsaCycleStarted { year, scope: "all-business-lines-and-support-functions" }` — Helena initiates at the start of each calendar year.
2. Devon's first-line self-assessment — each business line and support function head completes the RCSA template for their processes. Findings are filed as `RcsaProcessAssessmentSubmitted { processId, inherentRisk, controlAdequacy, residualRisk, owner }` events.
3. Helena's second-line challenge — Helena's team reviews each first-line assessment for completeness, consistency, and challenge adequacy. Challenged items are returned with `RcsaChallengeFiled { processId, challengeReason }` events; Devon must respond within 10 business days.
4. RCSA aggregate view — Helena produces the bank-wide RCSA aggregate, identifying: the top 10 residual operational risks, the control gaps requiring remediation, the areas of AI-agent-specific risk concentration.
5. `RcsaCycleCompleted { year, topRisks[], remediationPlan[], approvedBy: "helena", endorsedBy: "devon" }` — filed by Helena on completion.
6. Board Risk Committee endorsement of the annual RCSA findings — tabled at the next BRC meeting.

### 4.3 Loss Event Database

**Owner:** Devon (Chief Operating Officer, governance) — first-line capture; Helena (Chief Risk Officer, governance) — second-line governance · **Cadence:** Continuous capture ≥ R5,000; monthly reporting to ORC; quarterly aggregation for ICAAP · **Citation:** BCBS PSMOR — Principle 5 + `ORG-PR-17`

The loss event database captures all operational loss events at or above the capture threshold of R5,000 (threshold subject to BRC calibration annually). The capture threshold is not a materiality threshold for reporting; it is the minimum for database entry. All events above the threshold are captured regardless of whether the loss was recovered through insurance or other means; both gross and net loss figures are recorded.

Loss events are classified per the Basel Level 1 and Level 2 taxonomy:

**Basel Level 1 categories:**
1. Internal Fraud
2. External Fraud
3. Employment Practices and Workplace Safety
4. Clients, Products & Business Practices
5. Damage to Physical Assets
6. Business Disruption and System Failures
7. Execution, Delivery & Process Management

AI agent errors are classified primarily under categories 6 (system failures — if the agent infrastructure fails) and 7 (execution, delivery, and process management — if the agent produces an incorrect output or takes an incorrect action within a functioning system). Each loss event recorded in the database includes an AI-agent attribution field (`agentId`, `agentVersion`, `failureMode`) for AI-originated events, enabling trend analysis of AI-specific operational risk.

Loss event capture procedure (per `Procedures/by-policy/loss-event-capture.md`):
- Loss event identified by any team member (first line).
- `OperationalLossEventRecorded { eventId, date, discoveryDate, grossLoss, netLoss, baselL1Category, baselL2Category, processId, agentAttribution, description }` event filed within 5 business days of identification.
- Helena's second-line review of each event above the amber materiality threshold (set in the procedure); review filed as `OperationalLossEventReviewed { eventId, helenaReview, rootCause, controlFailure }`.
- Events above the Critical materiality threshold are reported to the Operational Risk Committee at the next meeting and, if required, to the BRC and CEO immediately.
- Quarterly aggregation of loss events for ICAAP Pillar 2A and BA-return inclusion by Rohan.

### 4.4 Key Risk Indicators (KRI)

**Owner:** Helena (Chief Risk Officer, governance) — KRI library design and threshold calibration; Devon (Chief Operating Officer, governance) — data sourcing · **Cadence:** Monthly monitoring; amber/red threshold breaches trigger immediate escalation · **Citation:** BCBS PSMOR — Principle 5 (`ORG-PR-39`) + `ORG-PR-17`

KRIs are quantitative indicators that provide early warning of operational risk exposure changes. The Bank maintains a Board-approved KRI library. The library is calibrated by Helena based on: the RCSA residual risk ratings; the loss event history; industry benchmarking; and AI-agent-specific risk indicators. KRI thresholds (amber and red) are calibrated to provide meaningful early warning rather than lagging confirmation of a loss event.

**Standing KRI categories:**

*Process and control KRIs:*
- Settlement failure rate (number of failed settlements / total settlements) — amber/red thresholds per `Procedures/by-policy/kri-monitoring.md`.
- Confirmation turnaround rate (% OTC confirmations outstanding > 2 days) — amber/red thresholds.
- Reconciliation break age (number of reconciliation breaks > 5 days outstanding) — amber/red thresholds.
- Error and correction rate (number of corrected trade bookings / total bookings) — amber/red thresholds.

*AI-agent-specific KRIs:*
- Agent error rate (number of agent output errors requiring manual correction / total agent-processed items) — amber/red thresholds calibrated to the expected AI-agent error baseline.
- Agent boundary violation rate (number of agent actions outside approved decision boundaries / total agent actions) — amber/red thresholds; zero-tolerance red threshold for decisions categorically outside agent mandate.
- Model output drift indicator (rolling 30-day deviation of agent model output from benchmark, where applicable) — amber/red thresholds per model type.

*ICT and cyber KRIs:*
- System availability rate (% uptime for critical systems) — red threshold at < 99.5% monthly.
- Cyber incident count (number of confirmed cyber security incidents per month) — amber/red thresholds.
- Patch currency rate (% critical patches applied within SLA) — red threshold at < 95%.

*People and process KRIs (including outsourcing):*
- Third-party SLA breach count (number of material outsourcing SLA breaches per quarter) — amber/red thresholds.
- Regulatory breach notifications (number of identified regulatory compliance breaches per quarter) — amber/red thresholds; notified to Helena and Zara simultaneously.

Monthly KRI monitoring by Rohan produces a `KriMonthlyReport { month, kris[], amberBreaches[], redBreaches[] }` event. Amber breaches are reported to Helena within 1 business day; red breaches trigger immediate escalation to Devon and Helena per §1.4 of this policy.

---

## 5. Business Continuity (`ORG-PR-39` — Principle 10)

**Owner:** Devon (Chief Operating Officer, governance) — BCP plan maintenance and testing; Helena (Chief Risk Officer, governance) — risk framework oversight · **Approval:** Board (CEO interim) for BCP programme; BRC review of annual test outcomes · **Cadence:** BCPs reviewed annually and on material change; BCPs tested annually per `Procedures/by-policy/bcp-testing.md` · **Citation:** BCBS PSMOR — Principle 10 (`ORG-PR-39`) + Reg 39 (`ORG-PR-24`) + PA Guidance `[citation: TBC — any PA BCP-specific guidance]`

### Purpose

Business continuity planning (BCP) and disaster recovery (DR) are named sub-domains of operational risk under this policy. The purpose is to ensure the Bank can resume or maintain critical operations following a severe disruption — including technology failure, cyber attack, infrastructure outage, natural disaster, or AI-agent infrastructure failure. The BCP framework is not a separate management domain from operational risk; BCP gaps identified in testing are RCSA findings and are subject to the same escalation and remediation governance as other operational risk control gaps.

### 5.1 BCP Scope

BCPs are required for every critical process identified in Devon's process register with an RTO of ≤ 24 hours. Critical processes at commencement of trading include (at minimum): trading system availability; settlement processing; regulatory reporting (BA-return generation); financial reporting; client onboarding (at licence-day); agent infrastructure (Anthropic API dependency; on-premises fallback plan). Each BCP identifies: the critical process, the maximum tolerable period of disruption (MTPD), the Recovery Time Objective (RTO), the Recovery Point Objective (RPO), the recovery procedure, and the responsible agent or human operator for the recovery action.

### 5.2 BCP Testing

BCPs are tested annually per `Procedures/by-policy/bcp-testing.md`. Testing methods include: desktop walkthrough (at minimum for every BCP); partial failover test (for systems with automated DR); and full DR test (for the Bank's most critical systems, at least once every three years). Test outcomes are filed as `BcpTestOutcomeRecorded { bcpId, testDate, testType, rto, rpa, passed, gaps[] }` events. Gaps identified in testing are RCSA findings; remediation deadlines are set by Helena. The annual BCP test summary is tabled at the BRC.

### 5.3 AI-Agent Infrastructure Business Continuity

The Bank's dependence on AI agent infrastructure (Anthropic API; local agent runner; event store) is a material BCP risk. Devon maintains a BCP for AI-agent infrastructure failure that covers: (i) fallback to human-supervised manual processing for critical decisions; (ii) queuing of agent-triggered processes for replay on infrastructure restoration; (iii) escalation of agent-boundary decisions to the CEO (interim) during an infrastructure outage. The AI-agent infrastructure BCP is tested annually alongside the core technology BCP.

---

## 6. New Product Approval — Operational Risk Dimension (`ORG-PR-17`)

**Owner:** Helena (Chief Risk Officer, governance) — operational risk gate; Devon (Chief Operating Officer, governance) — process-readiness assessment · **Approval:** Operational Risk Committee sign-off on operational risk dimension required before NPA Board approval · **Cadence:** Triggered by each NPA submission · **Citation:** `Policies/trading-mandate-v1.md` — NPA policy + BCBS PSMOR — Principle 4 (`ORG-PR-39`) + `ORG-PR-17`

### Purpose

Every new product or material product variant entering the Bank's franchise must pass an operational risk assessment before the NPA Board approval is granted. The operational risk dimension of the NPA gate ensures that: (i) the process infrastructure for the new product is identified and assessed in the RCSA before trading begins; (ii) AI agent capability is confirmed for the new product's execution, confirmation, settlement, and reporting workflows; (iii) relevant KRIs are calibrated for the new product; and (iv) BCPs are updated to cover the new product's critical processes.

### 6.1 Operational Risk Assessment in NPA

For each NPA submission (per `Policies/trading-mandate-v1.md`), Devon produces an operational risk assessment covering:

1. **Process identification.** All new or modified processes required to support the product are identified and added to the process register.
2. **RCSA pre-assessment.** An inherent risk and control adequacy assessment for each new process, filed as `RcsaProcessAssessmentSubmitted { processId, inherentRisk, controlAdequacy, residualRisk, owner }` events before trading begins.
3. **Agent capability confirmation.** Devon confirms that the AI agents responsible for executing the new product's workflows have been tested and validated for the product type. For products outside the existing agent capability perimeter, Devon confirms the agent training and testing plan.
4. **KRI additions.** Rohan proposes any additional KRIs for the new product type; Helena approves and adds to the KRI library.
5. **BCP update.** Devon updates the process register and BCPs to cover the new product's critical processes before the first trade.

Helena's second-line review of the operational risk assessment is required before the NPA is tabled at the Board. A `NpaOperationalRiskAssessmentApproved { npaId, productType, heleaApproval, residualRiskRating }` event is the canonical record of Helena's sign-off. Absence of this event is a block on NPA Board approval.

---

## 7. Outsourcing Risk

**Owner:** Devon (Chief Operating Officer, governance) — first line; Helena (Chief Risk Officer, governance) — second-line oversight · **Approval:** Board (CEO interim) for material outsourcing arrangements; Operational Risk Committee for non-material arrangements · **Cadence:** Annual review of all outsourcing arrangements; triggered on new or materially changed arrangement · **Citation:** Regulations Relating to Banks — Reg 39 (outsourcing provisions) `[citation: TBC — precise Reg 39 outsourcing sub-clauses; Imani confirms]` + BCBS PSMOR — Principle 6 (`ORG-PR-39`) + `ORG-PR-17`

### Purpose

The Bank's AI-agent model creates a specific outsourcing risk profile: the Anthropic API is a material third-party service upon which all agent-operated processes depend. This dependency is a concentration risk that must be assessed, documented, and managed under the operational risk framework. More broadly, all material outsourcing arrangements (including cloud infrastructure, market data services, settlement agent relationships, and legal/audit services at licence-day) are subject to operational risk assessment.

### 7.1 Materiality Assessment

An outsourcing arrangement is material if its failure would: (i) significantly impair the Bank's ability to continue critical operations; (ii) affect the Bank's ability to meet its regulatory obligations; or (iii) expose the Bank's clients to significant harm. Helena assesses materiality; the threshold criteria are calibrated in `Procedures/by-policy/outsourcing-risk-assessment.md`. Material arrangements require Board approval; non-material arrangements require Operational Risk Committee approval.

The Anthropic API is assessed as material. Devon maintains a BCP for Anthropic API unavailability (§5.3). Helena reviews the Anthropic API service concentration risk annually in the ICAAP Pillar 2A self-assessment.

### 7.2 Outsourcing Risk Assessment

For each material outsourcing arrangement, Devon produces and maintains an outsourcing risk assessment covering: service-provider financial stability; operational resilience and BCP; data security and POPIA/GDPR compliance; contractual protections (right to audit, data return, step-in rights); concentration risk (if multiple critical processes depend on the same provider). The assessment is filed as a typed event and reviewed annually. Helena challenges the first-line assessment.

---

## 8. Operational Risk Governance

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim) constitutes the Operational Risk Committee; BRC is the Board-level governance layer · **Cadence:** Operational Risk Committee meets monthly; annual RCSA and BCP test cycles · **Citation:** Banks Act 94 of 1990 + Reg 39 (`ORG-PR-24`) + BCBS PSMOR Principles 1–3 (`ORG-PR-39`)

### Purpose

The operational risk governance structure ensures that operational risk is managed within the approved appetite, that RCSA findings are remediated, that loss events are captured and reported, and that BCPs are maintained and tested. The Operational Risk Committee (ORC) is the primary governance body for operational risk.

### 8.1 Operational Risk Committee

The Operational Risk Committee is a sub-committee of the Board Risk Committee (BRC). Its membership includes: Helena (chair), Devon (first-line co-owner), Zara (compliance risk input), Eitan (Treasurer, governance — liquidity/operational risk interface), and the CISO (once appointed). Rohan attends as technical secretary. Owen manages the committee secretarially.

The ORC's standing agenda items:
1. Monthly loss event summary — Rohan's loss event report; events above amber materiality threshold discussed.
2. KRI monitoring results — amber/red breaches and remediation status.
3. RCSA open items — overdue control remediations, challenge responses.
4. BCP test outcomes — gaps and remediation deadlines.
5. Outsourcing risk — annual review tabled; material new arrangements approved.
6. NPA operational risk assessments — Helena's sign-off record tabled for ORC awareness.
7. Operational risk capital — Rohan's BIA/TSA capital computation and its contribution to the total capital position.
8. AI-agent risk dashboard — agent error rate, boundary violation rate, model drift KRIs.
9. Regulatory developments — Zara and Helena table any operational-risk-relevant PA or BCBS publications.

The ORC escalates to the BRC: monthly capital position; any red KRI breach not remediated within 30 days; any material loss event above the Critical threshold; material BCP gaps; new material outsourcing arrangements.

### 8.2 Reporting

- **Monthly:** Rohan produces the operational risk monthly report — KRI dashboard, loss event summary, RCSA open items, BIA capital charge. Tabled at ORC and included in the ALCO pack.
- **Quarterly:** Helena presents the operational risk position to the BRC. Includes RCSA highlights, KRI trends, cumulative annual loss data vs. RAS OR-1 tolerance, BCP test outcomes, outsourcing risk updates.
- **Annual:** The ICAAP chapter for operational risk (authored by Helena) includes: BIA / TSA capital, Pillar 2A self-assessment for operational risk, RCSA top-10 residual risks, three-year loss trend, BCP programme summary. Submitted to the PA as part of the annual ICAAP.
- **PA regulatory returns:** Operational risk capital (BIA / TSA) is included in the BA-100 return by Camille, per the SARB reporting calendar. Material operational risk events are reported to the PA per Reg 39 `[citation: TBC — precise reporting trigger and timeline]`.

### 8.3 Independent Validation

Nadia (Independent-validation engineer, peer-in-second-line under Helena) validates the operational risk capital model (BIA / TSA computation logic) at least annually and before each ICAAP submission. The validation confirms: correctness of gross income computation; business-line allocation for TSA (when applicable); NMRF / SES relevance (not applicable for BIA / TSA, but noted for SMA planning). A `ModelValidationCompleted { modelId: "operational-risk-capital", modelVersion, findings[] }` event is the canonical record.

---

## 9. Obligations Closure Table

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-PR-17` | Operational risk identification, measurement, control framework | **IN FORCE** (LICENCE-BIND) — closed | §1 (Overarching), §4 (RCSA), §4.3 (Loss Event Database), §4.4 (KRIs), §6 (NPA OR dimension), §7 (Outsourcing) |
| `ORG-PR-24` | Documented operational-risk-management framework per Reg 39 + BCBS PSMOR | **IN FORCE** (LICENCE-BIND) — closed | §1 (Overarching), §2 (PSMOR 12 Principles), §3 (Capital), §8 (Governance) |
| `ORG-PR-39` | Comply with the 12-principle BCBS PSMOR framework | **IN FORCE** (LICENCE-BIND) — closed | §2 (full section — all 12 principles mapped), §4 (RCSA implements Principles 4–5), §5 (BCP implements Principle 10), §8 (governance implements Principles 1–3) |

---

## 10. Substrate Dependencies and Gaps

Per the events-first authoring rule (Principle 1), gaps are not hidden; they are work for downstream substrate build.

### 10.1 Substrate currently under construction

- **RCSA engine (Devon, under Helena).** Manages the process register, RCSA template completion, second-line challenge workflow, and RCSA aggregate view. Discharge exit signal: `RcsaCycleCompleted { year }` event from the first annual RCSA cycle.
- **Loss event database (Devon, under Helena and Rohan).** Operational loss event capture, classification, and quarterly aggregation for ICAAP and BA-return. Discharge exit signal: `OperationalLossEventRecorded` events ingesting synthetic loss data; `recon:loss-event-schema-validation` green.
- **KRI monitoring platform (Rohan, under Helena).** Monthly KRI computation and threshold breach detection for the full KRI library. Discharge exit signal: `KriMonthlyReport { month, kris[], amberBreaches[], redBreaches[] }` event on synthetic fixture; `recon:kri-threshold-monitoring` green.
- **BIA / TSA capital computation (Rohan, under Helena and Camille).** Computes BIA and TSA operational risk capital from event-derived gross income; feeds BA-100 return. Discharge exit signal: `OperationalRiskCapitalComputed { date, approach, grossIncome, cap }` event.
- **Outsourcing risk assessment template (Devon, under Helena).** Structured template for Anthropic API and other material outsourcing arrangements, producing typed assessment events. Discharge exit signal: `OutsourcingRiskAssessmentCompleted { vendor, materiality, riskRating }` event for Anthropic API.

### 10.2 Procedures planned but not yet authored

- `Procedures/by-policy/rcsa-execution.md` — annual RCSA cycle procedure, template, second-line challenge protocol.
- `Procedures/by-policy/loss-event-capture.md` — capture procedure, classification guide, materiality thresholds.
- `Procedures/by-policy/kri-monitoring.md` — KRI library (with numerical thresholds), monthly monitoring checklist, breach escalation steps.
- `Procedures/by-policy/bcp-testing.md` — annual BCP test procedure, test types, gap remediation governance.
- `Procedures/by-policy/outsourcing-risk-assessment.md` — materiality criteria, assessment template, approval authority matrix.

### 10.3 Citation gaps (TBC)

Per Principle 2, no sub-clause indices are invented. The following are `[citation: TBC]` until Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate:

1. Reg 39 sub-clause indices for: (a) operational risk management requirements; (b) outsourcing provisions; (c) reportable operational risk event triggers and timelines.
2. Reg 32 sub-clause for operational risk capital requirement.
3. BCBS Basel III/IV chapter and paragraph references for BIA, TSA, and SMA.
4. BCBS PSMOR (2021) — precise paragraph references for each of the 12 principles.
5. BIA negative-year exclusion rule — precise BCBS reference.
6. TSA qualifying criteria under PA.
7. BCBS Pillar 3 disclosure requirements for operational risk.
8. Any discrete PA guidance note on operational risk or BCP (Mira curatorship route).

---

## 11. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-13 | Helena (Chief Risk Officer, governance) + Devon (Chief Operating Officer, governance) | Initial policy authored. Ten sections: (1) Overarching — BCBS PSMOR as governing standard, three-lines-of-defence model, events-first accounting, AI-agent risk as first-class, three-severity breach taxonomy; (2) BCBS PSMOR 12 Principles — all 12 principles mapped: governance (1–3), risk management environment (4–8), ICT (9), BCP (10), disclosure (11), supervisors (12); (3) Operational Risk Capital — BIA initial approach, TSA target approach, SMA aspirational, monthly BA-return integration; (4) RCSA — annual cycle event-pattern, scope methodology, loss event database (capture threshold R5,000, Basel L1/L2 taxonomy, AI-agent attribution field), KRI library (process, AI-agent, ICT, outsourcing KRIs with amber/red thresholds); (5) Business Continuity — BCP scope and RTOs, annual testing procedure, AI-agent infrastructure BCP; (6) NPA Operational Risk Dimension — process identification, RCSA pre-assessment, agent capability confirmation, KRI additions, BCP update prerequisites; (7) Outsourcing Risk — Anthropic API as material arrangement, materiality assessment, outsourcing risk assessment template; (8) Governance — Operational Risk Committee (ORC) composition and agenda, monthly/quarterly/annual/PA reporting cadence, independent validation. Obligations closure table: ORG-PR-17, ORG-PR-24, ORG-PR-39. Substrate and citation gaps explicitly named per Principle 2. Identity discipline per CLAUDE.md. |
