---
policy-id: three-lines-of-defence-policy
title: Three Lines of Defence Policy
version: 1.0.0
status: ACTIVE
owner: Owen Atlas (Company Secretary) + Helena (Chief Risk Officer) + Vera (Internal Audit Engineer)
effective-from: 2026-05-17
next-review: "2026-11-17"
citations:
  - "BCBS Corporate Governance Principles for Banks (2015) — Principles 6–8"
  - "Banks Act 94 of 1990 s.60 (risk management)"
  - "PA Guidance Note 2/2021 — Internal controls"
author: Owen Atlas (Company Secretary, governance)
date: 2026-05-17
summary: >
  Defines the bank's Three Lines of Defence model, establishing first-line business
  ownership of risk, second-line independent oversight, and third-line internal audit
  independence. Applies to all agents and residual human principals.
decision-required: false
riskTaxonomy: RT-ST.GV
---

# Three Lines of Defence Policy

> **Standing authority:** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). This policy closes obligation [`ORG-GV-18`](../Regulations/_obligations-register.md) — establishment of a documented three-lines-of-defence governance model — as required by **BCBS Corporate Governance Principles for Banks (2015) Principles 6–8** and **Banks Act 94 of 1990 s.60** and **PA Guidance Note 2/2021**.
>
> **Author:** Owen Atlas (Company Secretary, governance). Co-owners: Helena (Chief Risk Officer, governance); Vera (Internal Audit Engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance).
>
> **Obligation closed:** [`ORG-GV-18`](../Regulations/_obligations-register.md) — Three Lines of Defence model documentation.
>
> **Binding status:** LICENCE-BIND. These obligations apply in full from commencement-of-trading. This policy is authored now so that governance structures, agent operating specs, and escalation substrate are production-grade at licence-day.

---

## 1. Purpose and scope

### 1.1 Purpose

Hoz Bank Limited (the **Bank**) operates as an AI-driven institution in which autonomous agents are the primary operational actors and residual humans supervise only those decisions and actions that agents cannot make on their own (Principle 6 — Autonomous by default). This policy establishes the **Three Lines of Defence** (**3LoD**) model that structures how risk-taking, independent oversight, and independent assurance are separated and coordinated across the Bank's agent fleet and human principals.

The 3LoD model ensures that:

1. Risk is owned at the point of creation — by the agent or human principal that takes the risk-generating action.
2. Independent oversight functions challenge and constrain the first line without sharing its profit-and-loss incentives.
3. Internal audit provides objective, independent assurance over the design and operating effectiveness of both the first and second lines, reporting to governance without operational responsibility for either.

This structure is required by **BCBS Corporate Governance Principles for Banks (2015) Principles 6–8**, **Banks Act 94 of 1990 s.60** (adequate systems and controls for risk management), and **PA Guidance Note 2/2021** on internal controls. It is also foundational to the Bank's pre-licence go-live readiness gate under Saskia's substrate.

### 1.2 Scope

This policy applies to:

- **All agents** operating within the Bank's agent fleet, regardless of substrate maturity — from fully autonomous runtime agents to Scrooge-coordinated in-session runs.
- **All residual human principals** — Marc (CEO) and any other humans who hold formal roles under the minimum-human-layer model at licence-day.
- **All counterparties and external parties** interacting with the Bank to the extent that their interfaces cross into the Bank's internal control perimeter.
- **All product lines, asset classes, and jurisdictions** in which the Bank operates (Principle 5 — Multi-currency, multi-entity, multi-country from day one).
- **All legal entities** in the Hoz Group structure (Hoz Group Limited, Hoz Bank Limited, Hoz Securities Limited) per the legal-entity tree at [`Regulations/_legal-entity-tree.md`](../Regulations/_legal-entity-tree.md).

### 1.3 Relationship to other policies

The 3LoD model is the governance architecture within which all other risk and control policies operate. It does not duplicate those policies; it defines which line owns what. Key related policies:

| Policy | Line relationship |
|---|---|
| [`credit-risk-policy-v1.md`](credit-risk-policy-v1.md) | First-line ownership; second-line review and limit-setting; third-line assurance |
| [`market-risk-policy-v1.md`](market-risk-policy-v1.md) | First-line ownership; second-line VaR/DV01/Greek limits; third-line assurance |
| [`liquidity-risk-management-policy-v1.md`](liquidity-risk-management-policy-v1.md) | First-line ownership; second-line LCR/NSFR monitoring; third-line assurance |
| [`operational-risk-policy-v1.md`](operational-risk-policy-v1.md) | First-line ownership; second-line RCSA review; third-line assurance |
| [`model-risk-policy-v1.md`](model-risk-policy-v1.md) | First-line model development; second-line model validation; third-line assurance |
| [`aml-cft-policy-v1.md`](aml-cft-policy-v1.md) | First-line CDD execution; second-line AML oversight; third-line assurance |
| [`conflicts-of-interest-policy-v1.md`](conflicts-of-interest-policy-v1.md) | Cross-line independence constraints defined in §8 of this policy |
| [`internal-audit-charter-v1.md`](internal-audit-charter-v1.md) | Third-line mandate, authority, and resource detail |

### 1.4 Definitions

| Term | Definition |
|---|---|
| **First line** | Risk-taking units and frontline operational agents that own and manage risk within approved limits. |
| **Second line** | Independent risk and compliance oversight functions that set standards, challenge the first line, and monitor adherence. |
| **Third line** | Internal audit: provides objective assurance and advisory services to governance on the design and effectiveness of internal controls across both lines. |
| **Agent** | An autonomous standing agent operating under a persona spec in `/Team/` per Principle 6. |
| **Escalation event** | A typed event emitted by an agent when a control boundary is reached, a limit is breached, or an action requires cross-line or human-in-the-loop authorisation. |
| **Risk appetite** | The aggregate level and types of risk the Bank is willing to accept in pursuit of its strategic objectives, as set by the CEO and ratified by the Board at licence-day. |
| **RCSA** | Risk and Control Self-Assessment — the first-line process of identifying, assessing, and recording risks and the controls that mitigate them. |

---

## 2. First Line — Business ownership of risk

### 2.1 Definition and mandate

The **first line** comprises all agents and human principals that originate, execute, or administer transactions, products, services, and processes that create risk for the Bank. The first line **owns** the risk it creates — it is accountable for identifying, measuring, controlling, and reporting risk within its domain as the primary point of risk origination.

The default actor in every first-line procedure step is an **agent operating within its approved risk appetite and within approved system limits** (Principle 6). Human-in-the-loop steps in first-line procedures carry a Principle 2 citation and are reserved for the narrow set of decisions that regulation or internal policy requires a human to make.

### 2.2 First-line agents and their risk domains

| Agent | Position | Primary risk domain |
|---|---|---|
| Tomas (Payments / settlement engineer) | Engineering | Settlement risk, payment-execution risk, correspondent-bank counterparty risk |
| Mira (Compliance / RegTech engineer) | Engineering | Regulatory-change risk (first-line input); CDD execution risk |
| Niko (Client lifecycle agent) | Engineering (activates at licence-day) | Onboarding risk, KYC/CDD execution, client-data integrity risk |
| Devon (Core banking engineer) | Engineering | Ledger integrity risk, posting correctness, GL reconciliation |
| Atlas (Platform / infra engineer) | Engineering | Infrastructure risk, event-store integrity, availability risk |
| Camille (Capital / treasury engineer) | Engineering | Funding risk, collateral optimisation risk, treasury-execution risk |
| Quinn (Quant / risk engine engineer) | Engineering | Model implementation risk, quantitative risk measure correctness |
| Imani (Legal-as-code engineer) | Engineering | Legal documentation risk, contract-execution risk |

The full roster is at [`Team/_team-roster.json`](../Team/_team-roster.json). Every first-line agent has an operating spec in `/Team/` that records its designated risk domain, decision authority, and escalation triggers.

### 2.3 First-line responsibilities

Every first-line agent is responsible for:

1. **Executing within approved limits.** No agent may take a risk-generating action that exceeds its pre-approved risk appetite parameters. Limit parameters are set by the second line and encoded in the agent's operating spec and in the system-capability layer.

2. **Emitting typed events.** Every risk-generating action is recorded as a typed event in the event store (Principle 1 — Events are the only source of truth). No action is considered executed until the corresponding event is persisted. The event log is the sole durable artefact.

3. **Performing RCSA.** At each agent cadence cycle, the first-line agent reviews its own controls, identifies new risks arising from changes to its environment, and emits a `RCSACompleted` event with findings.

4. **Escalating promptly.** When a first-line agent encounters a control boundary, limit breach, or ambiguity that falls outside its autonomous authority, it emits a typed escalation event (see §7) and suspends the action pending resolution. Delayed or suppressed escalation is a first-line control failure.

5. **Maintaining procedure adherence.** Each agent operates according to the procedures in `/Procedures/` that govern its domain. Procedure deviations are flagged to the second line as `ProceduralDeviationDetected` events.

6. **Front-line training and awareness** (at licence-day). Human actors in the first line complete AML/CFT and conduct training per the RMCP ([`risk-management-and-compliance-policy-v1.md`](risk-management-and-compliance-policy-v1.md)). Agents maintain training-equivalent currency by operating against up-to-date procedure specifications.

### 2.4 First-line controls

The first line maintains the following types of controls:

- **Preventive controls** — embedded in agent logic: pre-execution limit checks, eligibility gates, approval-routing logic, and four-eyes-equivalent dual-agent confirmation where required.
- **Detective controls** — continuous reconciliation, position-to-trade blotter tie-out, GL-to-sub-ledger tie-out, event-store completeness assertions.
- **Corrective controls** — automated exception workflows, reversal-event sequences for erroneous postings, compensating transactions within approved parameters.

All controls are coded. Manual workarounds are not permitted as standing practice; any manual intervention is itself a typed event (`ManualInterventionOccurred`) that feeds the second-line deviation register.

---

## 3. Second Line — Independent oversight

### 3.1 Definition and mandate

The **second line** comprises the independent risk management and compliance functions that set standards, monitor adherence, and challenge the first line. The second line is **independent of the first-line P&L incentives** — no second-line agent or human principal shares in trading profit, origination volume, or other performance metrics that could compromise its objectivity.

The second line does not own or execute the first-line activities it oversees. Its authority is to **set limits, challenge actions, require remediation, and escalate to governance** when the first line does not respond adequately.

### 3.2 Second-line agents and their oversight domains

| Agent | Position | Second-line oversight domain |
|---|---|---|
| Helena (Chief Risk Officer) | Governance | Enterprise risk management; market risk; credit risk; liquidity risk; risk appetite framework |
| Zara (Chief Compliance Officer) | Governance | Regulatory compliance; AML/CFT; POPIA; FAIS; TCF; sanctions |
| Quinn (Quant / risk engine engineer) | Engineering — reports to Helena | Model validation; VaR/DV01/Greek computation; stress testing engine |
| Iris (Information Officer) | Governance | POPIA ss.13–22; information governance; data-subject rights |

Helena (Chief Risk Officer, governance) is the head of the second line. Zara (Chief Compliance Officer, governance) leads the compliance sub-function within the second line. Both report to the CEO; neither reports to nor is evaluated by any first-line unit.

### 3.3 Second-line responsibilities

The second line is responsible for:

1. **Setting the risk appetite framework.** Helena drafts the risk appetite statement, risk tolerances, and risk limits. The CEO approves (Board ratifies at licence-day). Limits are then encoded in first-line system capabilities.

2. **Independent monitoring.** Helena and Zara receive, in near-real-time, the typed events emitted by first-line agents. Second-line monitoring pipelines (`recon:risk-limits`, `recon:compliance-screening`) continuously assert that first-line actions fall within approved parameters.

3. **Challenging the first line.** Where monitoring detects a limit approach, breach, or anomaly, the second line emits a `SecondLineChallenge` event. The first-line agent must respond with either a corrective action or a documented exception. Unresolved challenges escalate to the CEO (and Board AC at licence-day).

4. **Model risk oversight.** Quinn (Quant / risk engine engineer) validates all quantitative models used by the first line. No model enters production without a `ModelValidationCompleted` event attesting to independent validation by Quinn under Helena's supervision. This is distinct from Quinn's first-line role of implementing the models — model *implementation* is first-line; model *validation* is second-line. The same agent occupies both roles but the validation function is operationally separated: Quinn's validation sign-off requires Helena's review and cannot be delegated back to the model's original developer (see §8 — conflicts of interest).

5. **Compliance monitoring.** Zara operates the compliance monitoring programme per [`aml-cft-policy-v1.md`](aml-cft-policy-v1.md) and [`risk-management-and-compliance-policy-v1.md`](risk-management-and-compliance-policy-v1.md). Continuous screening of transactions against sanctions lists, PEP databases, and adverse-media feeds is a second-line function. CDD *execution* is first-line (Niko, Mira); CDD *quality assurance and escalation* is second-line (Zara).

6. **Policy ownership.** The second line owns the risk and compliance policies listed in §1.3 (except where ownership is assigned to governance). Policy changes are proposed by the second line and approved by the CEO.

7. **Regulatory liaison.** Zara is the primary interface with the SARB Prudential Authority, FIC, and FSCA for regulatory correspondence. This channel is second-line because it involves presenting the Bank's risk and compliance posture to regulators independently of the first line's commercial perspective.

8. **Second-line reporting.** Helena and Zara each produce a quarterly risk report and compliance report, respectively, addressed to the CEO and (at licence-day) the Board Risk Committee and Audit Committee. Reports are typed events (`QuarterlyRiskReportEmitted`, `QuarterlyComplianceReportEmitted`) filed in the Records Management Substrate.

### 3.4 AML / CFT second-line function

AML/CFT oversight is a second-line sub-function under Zara. Specifically:

- **Transaction monitoring** — automated rule-based and ML-assisted screening; alerts routed to Zara for triage.
- **SAR/STR review** — Zara reviews and approves all Suspicious Activity Reports before filing with the FIC.
- **CDD quality assurance** — Zara spot-checks CDD records produced by Niko and Mira; findings feed the deviation register.
- **FATF Recommendation 18 compliance** — Zara's second-line function satisfies the requirement for an independent compliance function under FATF Rec. 18, distinct from the operational CDD/EDD function.

### 3.5 Model risk second-line function

Model risk management is a second-line sub-function under Helena and Quinn:

- **Model inventory** — all models in production are registered in the model inventory (`recon:model-inventory`). The inventory is a second-line register; additions require second-line approval.
- **Validation cadence** — each model is validated at deployment and at each major version change. Validation findings are typed events.
- **Use-test** — Quinn tests that models are being used for their validated purpose. First-line deviations from validated use trigger a `ModelUseTestFinding` event.
- **Ongoing monitoring** — Quinn monitors model performance continuously against backtesting benchmarks. Degradation beyond tolerance triggers re-validation.

---

## 4. Third Line — Internal Audit

### 4.1 Definition and mandate

The **third line** is internal audit: an independent, objective assurance and advisory function that evaluates and improves the effectiveness of the Bank's governance, risk management, and internal controls. The third line serves governance — not management — and has no operational responsibility for any activity it audits.

Internal audit is governed by the **Internal Audit Charter** ([`internal-audit-charter-v1.md`](internal-audit-charter-v1.md)), which is the canonical source for the third line's mandate, authority, scope, independence safeguards, and resource allocation. This policy describes the third line's position within the 3LoD model; the Charter governs its internal operations.

### 4.2 Third-line personnel

| Role | Holder | Reporting line |
|---|---|---|
| Chief Audit Executive (CAE) | Thandiwe (Chief Audit Executive, governance) | Functionally: Interim Audit Forum (Owen, chair); Administratively: CEO |
| Internal Audit Engineer | Vera (Internal Audit Engineer, engineering) | Reports to Thandiwe (CAE) |

**Functional independence** is preserved via the **Interim Audit Forum** — a governance body chaired by Owen (Company Secretary, governance) that acts in lieu of a Board Audit Committee until a full Board AC is constituted at licence-day. The CAE attends the Interim Audit Forum with direct access to Owen as chair and, through Owen, to the CEO. Thandiwe has a direct channel to the CEO for matters of material concern.

### 4.3 Third-line responsibilities

1. **Risk-based audit planning.** Thandiwe and Vera develop an annual (agent-cadence: quarterly) internal audit plan based on a risk assessment of all first- and second-line activities. The plan is approved by the Interim Audit Forum.

2. **Assurance over the first line.** Vera's recon pipelines continuously assert the operating effectiveness of first-line controls. Automated recon findings (`ReconFindingEmitted`) flow to Thandiwe for triage. Material findings are escalated to the Interim Audit Forum.

3. **Assurance over the second line.** Internal audit is independent of both the first and second lines. Vera audits the second line's risk monitoring processes, compliance programme, and model validation procedures. The adequacy of second-line challenge is itself an audit scope item.

4. **Audit reporting.** Thandiwe produces audit reports addressed to the Interim Audit Forum and (at licence-day) the Board Audit Committee. Each audit report is a typed event (`AuditReportEmitted`) in the Records Management Substrate. Management responses and remediation commitments are tracked as follow-on events.

5. **Recon pipeline ownership.** Vera owns and operates the continuous assurance recon pipelines defined in `@platform/recon/`. These pipelines are the automated, always-on component of the third line's assurance mandate. Recon findings are the primary input to Thandiwe's audit triage.

6. **Advisory services.** Internal audit may provide advisory services (guidance on control design, input to new product approval) provided these services do not compromise audit independence. Where audit participates in design, it cannot subsequently provide assurance over that specific design without disclosing the impairment (see §8).

7. **Regulatory interface.** Thandiwe liaises with external auditors (at licence-day) and with the SARB Supervision Department to the extent that regulatory examinations require coordination. This coordination is third-line; Zara (second line) manages ongoing PA/FSCA/FIC dialogue.

### 4.4 Vera recon pipelines — operational third line

Vera's automated recon pipelines are the primary operational expression of the third line in the Bank's current substrate. They run continuously (or on each agent-cadence tick) and emit structured findings. The current pipeline register includes:

| Pipeline | Purpose | Finding type |
|---|---|---|
| `recon:agent-spec-integrity` | Asserts that all persona files have sections 6–17 | `AgentSpecIntegrityFinding` |
| `recon:risk-limits` | Asserts first-line positions are within approved limits | `RiskLimitBreachFinding` |
| `recon:compliance-screening` | Checks AML/CDD completeness | `ComplianceFinding` |
| `recon:citation-gate` | Asserts all deliverables have valid citations | `CitationGateFinding` |
| `recon:prose-duplication` | Detects canonical-source violations (Principle 2) | `ProseduplicationFinding` |
| `recon:graph-ontology` | Validates regulatory knowledge graph integrity | `GraphOntologyFinding` |
| `recon:runtime-handler-sync` | Asserts handler registry completeness | `HandlerSyncFinding` |
| `recon:model-inventory` | Asserts model inventory completeness | `ModelInventoryFinding` |

Additional pipelines are added as the substrate matures. The pipeline register is maintained by Vera and reviewed by Thandiwe at each audit cadence cycle.

---

## 5. Application to autonomous agents

### 5.1 Agents in the 3LoD model

Every agent in the Bank's fleet is assigned to exactly one line of the 3LoD model at any given time for any given activity. An agent **cannot simultaneously occupy the first and second lines for the same activity** (the model-risk exception in §3.3(4) is constrained by mandatory second-line review by Helena). The line assignment is recorded in the agent's operating spec (`/Team/<Name>.md`) in Section 5 (Areas of expertise) and Section 6 (Cadence / operating parameters).

### 5.2 Principle 6 — Autonomous by default

Per Principle 6, every agent is a standing autonomous agent. The 3LoD model applies to autonomous agents as follows:

- **First-line agents** act within their approved parameters without human confirmation for routine risk-taking decisions. They escalate only when a typed escalation trigger fires.
- **Second-line agents** challenge autonomously — monitoring pipelines emit `SecondLineChallenge` events without requiring Helena or Zara to manually review every action. Helena and Zara triage challenge events and make judgment calls on material items.
- **Third-line agents** (Vera's recon pipelines) run continuously and autonomously. Thandiwe reviews findings and determines audit response; routine findings are handled without CEO escalation.

Human-in-the-loop steps in any line must carry a Principle 2 citation establishing the regulatory or policy basis requiring human involvement.

### 5.3 Cross-line escalation as typed events

All cross-line interactions — challenges, escalations, responses, remediation commitments — are **typed events in the event store**. The markdown representations in `/Owner Inbox/`, `/Team Inbox/`, and the Records Management Substrate are rendered views of these events; the events are canonical (Principle 1).

The typed event taxonomy for 3LoD cross-line interactions includes:

| Event type | Emitter | Consumer | Purpose |
|---|---|---|---|
| `FirstLineEscalationRaised` | First-line agent | Second-line agent / CEO | First line cannot resolve within autonomous authority |
| `SecondLineChallenge` | Second-line agent | First-line agent | Second line disputes a first-line action or position |
| `FirstLineChallengeResponse` | First-line agent | Second-line agent | First line responds to a second-line challenge |
| `SecondLineEscalationToGovernance` | Second-line agent | CEO / Interim Audit Forum | Second line cannot resolve with first line; escalates to governance |
| `ThirdLineFindingEmitted` | Vera / Thandiwe | Interim Audit Forum / CEO | Audit finding requiring management response |
| `ManagementResponseEmitted` | First or second line | Thandiwe | Response to an audit finding |
| `RemediationCommitmentMade` | First or second line | Vera / Thandiwe | Formal commitment to remediate an audit finding |
| `RemediationVerified` | Vera | Thandiwe | Vera confirms remediation is complete and effective |
| `ProceduralDeviationDetected` | First-line agent | Second-line agent | First-line deviation from an approved procedure |
| `ManualInterventionOccurred` | Human principal | Second line / third line | Manual workaround or intervention in a coded process |

### 5.4 Human-in-the-loop at escalation boundaries

The following escalation boundaries require human-in-the-loop confirmation:

| Boundary | Event | Human principal required |
|---|---|---|
| Limit breach above threshold tier 2 | `RiskLimitBreachFinding` (severity: HIGH) | CEO (build phase); Board Risk Committee (licence-day) |
| STR/SAR filing | `SARReviewRequired` | MLRO / Zara (Compliance Officer) |
| Material audit finding (RED) | `ThirdLineFindingEmitted` (severity: RED) | CEO + Interim Audit Forum chair |
| New product approval | `NPAGateRequired` | CEO (build phase pre-go-live; NPA gate under Devon) |
| Policy waiver | `PolicyWaiverRequested` | CEO |
| Cross-line independence impairment | `IndependenceImpairmentDeclared` | CEO + Thandiwe (CAE) |

Each boundary is recorded in the relevant operating spec and in the procedure that governs the activity. Boundaries that are not explicitly listed here revert to second-line judgment; where the second line is itself uncertain, it escalates to the CEO.

---

## 6. Reporting lines and independence safeguards

### 6.1 Reporting structure

```
CEO (Marc, build phase; human CEO, licence-day)
├── First-line agents (operational — report through engineering leads)
├── Helena (CRO, governance) — second line
│   └── Quinn (Quant/risk) — second-line validation sub-function
├── Zara (CCO, governance) — second line
│   └── Mira (RegTech) — first-line CDD execution; second-line monitoring pipelines
├── Thandiwe (CAE, governance) — third line (administrative)
│   └── Vera (Internal Audit Engineer) — third line (operational recon)
│       └── Functionally reports to: Interim Audit Forum (Owen, chair)
└── Owen (Company Secretary) — governance; chairs Interim Audit Forum
```

This structure preserves the functional independence of the third line: Thandiwe's performance evaluation, budget, and resource allocation are governed by the Interim Audit Forum — not by any first- or second-line manager whose work she audits.

### 6.2 Independence safeguards — second line

1. **No P&L sharing.** Helena and Zara do not participate in any bonus, fee, or incentive structure tied to first-line trading or origination volumes.
2. **Separate system access.** Second-line agents have read access to all first-line event streams and system states but have no write access to first-line ledgers or transaction systems. The second line challenges through the typed-event channel, not by overwriting first-line data.
3. **Veto rights.** The second line may suspend a first-line activity by emitting a `SecondLineSuspensionOrder` event. Suspension is in effect until the CEO reviews. The first-line agent must honour the suspension immediately.
4. **Direct escalation path.** Helena and Zara have a direct channel to the CEO for matters of material concern, without routing through any first-line manager.
5. **Regulatory access.** Zara has unimpeded access to regulators (PA, FIC, FSCA) for matters within her compliance mandate.

### 6.3 Independence safeguards — third line

1. **No operational responsibility.** Vera and Thandiwe have no responsibility for executing first- or second-line activities. Assurance over a process requires no prior involvement in its design (except as noted in §4.3(6)).
2. **Unrestricted access.** Vera has read access to all systems, event stores, procedure documents, and agent operating specs. No area of the Bank is out of scope for audit.
3. **Functional reporting to Interim Audit Forum.** Thandiwe's functional line bypasses the CEO for matters of CAE independence. The Interim Audit Forum may escalate directly to external parties (regulators, external auditors at licence-day) if internal escalation is blocked.
4. **Protected budget.** The audit budget is set by the Interim Audit Forum with input from Thandiwe. The CEO may not unilaterally reduce the audit budget below the level required to execute the annual audit plan.
5. **Whistleblower protection.** Any agent or human principal reporting a concern to internal audit is protected from retaliation. The anti-bribery and whistleblowing policy ([`anti-bribery-corruption-whistleblowing-policy-v1.md`](anti-bribery-corruption-whistleblowing-policy-v1.md)) is the primary instrument; this policy reinforces the protected channel.

---

## 7. Escalation paths between lines

### 7.1 First line to second line

| Trigger | First-line action | Second-line action |
|---|---|---|
| Limit approach (≥80% of approved limit) | Emit `LimitApproachAlert` | Monitor; optionally pre-position response |
| Limit breach (>100% of approved limit) | Suspend risk-taking action; emit `RiskLimitBreachFinding` | Review immediately; issue `SecondLineChallenge` or `SecondLineSuspensionOrder`; escalate to CEO if breach is material |
| Procedural deviation | Emit `ProceduralDeviationDetected` | Log in deviation register; assess materiality; require corrective action within agreed timeframe |
| New risk type (outside approved appetite) | Emit `FirstLineEscalationRaised` (type: NEW_RISK_TYPE) | Convene risk assessment; update risk appetite if appropriate; approve or prohibit activity |
| Regulatory inquiry directed at first line | Emit `RegulatoryInquiryReceived` | Zara takes ownership of response; first line provides facts |
| Model output diverges from expectation | Emit `ModelAnomalyDetected` | Quinn investigates; issues `ModelValidationFinding` if warranted |

### 7.2 Second line to governance

| Trigger | Second-line action | Governance action |
|---|---|---|
| Unresolved first-line challenge | Emit `SecondLineEscalationToGovernance` after 2 missed response windows | CEO reviews; directs first line; documents decision |
| Material compliance breach | Zara emits `MaterialComplianceBreachDetected` | CEO notified immediately; regulatory disclosure assessment; Board AC at licence-day |
| Risk appetite breach (enterprise level) | Helena emits `RiskAppetiteBreachDetected` | CEO emergency review; escalate to Board RC at licence-day if not resolved within 1 tick |
| Independence impairment | Helena or Zara emits `IndependenceImpairmentDeclared` | CEO and Interim Audit Forum review; remediation plan within 5 business days |
| Second-line resource constraint | Helena or Zara emits `SecondLineResourceConstraintAlert` | CEO (Interim Audit Forum for third line) reviews and resolves |

### 7.3 Third line to governance

| Trigger | Third-line action | Governance action |
|---|---|---|
| RED audit finding | Thandiwe issues formal audit report; `ThirdLineFindingEmitted` (severity: RED) | Interim Audit Forum convenes within 1 agent tick; management response required within 5 business days |
| AMBER audit finding | Thandiwe issues audit report; `ThirdLineFindingEmitted` (severity: AMBER) | Interim Audit Forum reviews at next scheduled meeting; management response required within 15 business days |
| Overdue remediation | Vera emits `RemediationOverdue` | Thandiwe escalates to Interim Audit Forum; CEO directed to resolve |
| Audit plan deviation | Thandiwe notifies Interim Audit Forum | Forum approves revised plan or directs additional resource |
| External audit coordination (licence-day) | Thandiwe coordinates with external auditors | Owen (Company Secretary) facilitates governance interface |

### 7.4 Escalation to CEO — direct channel

The following events always reach the CEO directly, regardless of which line emits them:

- `RiskLimitBreachFinding` (severity: HIGH or CRITICAL)
- `MaterialComplianceBreachDetected`
- `ThirdLineFindingEmitted` (severity: RED)
- `IndependenceImpairmentDeclared`
- `SARReviewRequired` (where MLRO judgment is required)
- `PolicyWaiverRequested`
- `SecondLineSuspensionOrder` (CEO confirmation required within 4 hours)

---

## 8. Conflicts of interest across lines

### 8.1 Cross-line conflicts — general principle

No agent or human principal may simultaneously exercise first-line risk-taking authority and second-line oversight authority over the **same activity**. Where the same agent occupies roles in different lines (as Quinn does), the roles must be operationally separated so that the second-line role is independently reviewable.

### 8.2 Identified conflicts and mitigations

| Conflict | Agents involved | Mitigation |
|---|---|---|
| Model implementation (first line) vs model validation (second line) | Quinn | Quinn's validation results are reviewed by Helena before sign-off; Quinn cannot self-approve. `ModelValidationCompleted` event requires Helena's countersignature event. |
| AML CDD execution (first line via Mira/Niko) vs AML oversight (second line via Zara) | Mira / Niko / Zara | CDD execution events are produced by first-line agents; Zara's QA events are separate and subsequent. Zara has no write access to CDD records. |
| Compliance monitoring pipelines (Mira builds, second-line use) | Mira / Zara | Pipeline code is authored by Mira (first line); pipeline configuration (thresholds, rules) is owned by Zara (second line). Code changes require second-line approval of rule changes. |
| Advisory services by audit (third line) vs assurance (third line) | Vera / Thandiwe | Any advisory engagement by Vera is recorded. For the same scope, Vera's assurance role is disclosed as impaired; a separate review mechanism is applied or the finding is escalated to Thandiwe for independent assessment. |
| CEO oversight of all three lines | Marc (CEO) | CEO's oversight role is governance, not operational. The Interim Audit Forum provides the independence layer for the third line; the CEO cannot override an Interim Audit Forum governance decision without recording a `CEOGovernanceOverride` decision event and notifying the Forum. |

### 8.3 Conflict declaration

Any agent or human principal who identifies a potential cross-line conflict not listed in §8.2 must emit a `ConflictOfInterestDeclared` event immediately. Helena, Zara, and Thandiwe are notified simultaneously. The CEO is notified if the conflict is material. Undeclared conflicts are a control failure and a finding under Vera's independence-assurance pipeline.

---

## 9. Review cadence

### 9.1 Policy review

This policy is reviewed at each agent-cadence quarterly run. The review is owned by Owen (Company Secretary, governance) in consultation with Helena (Chief Risk Officer, governance) and Thandiwe (Chief Audit Executive, governance).

The review assesses:

1. Whether the 3LoD structure remains fit for purpose given changes to the Bank's business model, risk profile, and agent fleet.
2. Whether any cross-line conflicts have emerged that are not captured in §8.
3. Whether the escalation paths in §7 have operated as designed or require adjustment.
4. Whether the list of human-in-the-loop escalation boundaries in §5.4 remains appropriate.
5. Whether new regulatory requirements (BCBS, PA, FSCA) necessitate updates to the model.

Review findings are documented as `PolicyReviewCompleted` events. Material changes are submitted to the CEO for approval (Board RC and Board AC at licence-day).

### 9.2 Operational review

Helena and Zara each conduct an operational review of their second-line functions at each agent cadence tick. Vera's recon pipelines run continuously; Thandiwe reviews pipeline output at each audit cadence cycle. All operational review outputs are typed events.

### 9.3 External review

At licence-day and annually thereafter:

- External auditors review the design and operating effectiveness of the 3LoD model as part of their annual audit. Their findings are reported to the Board Audit Committee.
- The SARB Prudential Authority may review the 3LoD model as part of its supervisory programme under the Banks Act 94 of 1990 and PA Guidance Note 2/2021. The Bank co-operates fully with such reviews.

---

## 10. Change control

### 10.1 Policy change authority

| Change type | Approval authority |
|---|---|
| Minor (formatting, reference updates, non-substantive) | Owen (Company Secretary) |
| Substantive (scope change, line-assignment change, new escalation path) | CEO approval required |
| Material (redefining lines, changing independence safeguards) | CEO approval + Interim Audit Forum endorsement (Board AC at licence-day) |

### 10.2 Change process

1. **Proposal.** Any agent, Thandiwe (CAE), Helena (CRO), or Zara (CCO) may propose a change by emitting a `PolicyChangeProposed` event with draft red-line text.
2. **Review.** Owen reviews for Principle 2 (single-graph) compliance and governance consistency. Helena and Thandiwe review for risk and audit implications.
3. **Approval.** The appropriate authority approves per §10.1. Approval is a `Decision` event in the Records Management Substrate with the applicable `decisionId`.
4. **Versioning.** The policy file is updated with an incremented version number. The effective date in the frontmatter is updated. The prior version is archived.
5. **Communication.** Owen publishes a `PolicyVersionPublished` event. All affected agents update their operating specs to reference the new version at their next cadence tick.

### 10.3 Interim guidance

Where a situation arises that is not covered by this policy and cannot wait for the next review cycle, Helena may issue interim guidance as a `SecondLineInterimGuidance` event. Interim guidance is binding from issuance until the next policy review incorporates it, at which point the event is superseded by the policy update.

---

## Appendix A — BCBS alignment matrix

| BCBS Principle | Section in this policy |
|---|---|
| Principle 6 — Risk management function | §3 (Second line — Independent oversight) |
| Principle 7 — Risk compliance function | §3.3(5) (Compliance monitoring) |
| Principle 8 — Internal audit | §4 (Third line — Internal audit) |
| Principle 9 — Compensation | §6.2(1) (No P&L sharing for second line) |
| Principle 10 — Disclosure and transparency | §9.3 (External review) |

---

## Appendix B — Regulatory citations

| Citation | Section reference |
|---|---|
| Banks Act 94 of 1990 s.60 — risk management systems | §1.1, §3.1 |
| PA Guidance Note 2/2021 — Internal controls | §1.1, §4.1, §9.3 |
| BCBS Corporate Governance Principles for Banks (2015) Principles 6–8 | §1.1, Appendix A |
| FIC Act 38 of 2001 s.42 (RMCP mandate) | §3.3(5) |
| FATF Recommendation 18 (independent compliance function) | §3.4 |
| POPIA s.19–22 (information security) | §3.2 (Iris — Information Officer) |

---

*Authored by Owen Atlas (Company Secretary, governance). Effective: 2026-05-17. Version 1.0.0.*
*Next scheduled review: at Owen's next quarterly agent-cadence run.*
*Obligation closed: [`ORG-GV-18`](../Regulations/_obligations-register.md).*
