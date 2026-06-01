---
policy-id: RISK-STP-01
title: Stress Testing Policy v1
version: "1.0"
status: DRAFT
owner: Helena (Chief Risk Officer, governance)
effective-from: 2026-05-13
next-review: "2026-11-13"
citations:
  - "Banks Act 94 of 1990: s73 (risk management)"
  - "Regulations Relating to Banks 2012: reg.39(4) (ICAAP)"
  - "PA Directive D1/2019: stress testing requirements"
  - "SARB BA700: ICAAP return"
  - "PA ILAAP guidance (2019)"
  - "EBA Guidelines on institutions' stress testing (EBA/GL/2018/04) — industry standard"
author: Helena (Chief Risk Officer, governance)
date: 2026-05-13
summary: Establishes the bank's stress testing framework — scenarios, frequency, governance, and integration into ICAAP/ILAAP and recovery planning — in alignment with PA D1/2019 requirements.
decision-required: false
riskTaxonomy:
  - RISK-001
  - RISK-002
  - CAP-001
applies-at: LICENCE-BIND
obligations-closed:
  - ORG-PR-12
---

# Stress Testing Policy v1

> **Policy** | RISK-STP-01 v1.0 | Owner: Helena (Chief Risk Officer, governance) | Status: DRAFT | Effective: 2026-05-13

> **Authors.** Helena (Chief Risk Officer, governance) — lead and policy owner.
> **Standing authority.** Banks Act 94 of 1990 s73 (risk management framework); Regulations Relating to Banks reg.39(4) (ICAAP); PA Directive D1/2019 (stress testing); BA700 (ICAAP return). Complements `Policies/capital-management-policy-v1.md` and `Policies/liquidity-risk-policy-v1.md`; stress testing is the forward-looking dimension of both the capital adequacy and liquidity adequacy frameworks.
> **Obligations closed.** `ORG-PR-12` (conduct ICAAP-integrated stress testing per PA D1/2019; LICENCE-BIND).
> **Status.** LICENCE-BIND. The stress testing framework must be operationally ready before the PA will grant a banking licence; ICAAP submission (BA700) is a pre-licence requirement. Build-phase operationalisation is preparation for compliance, not compliance itself (per `project_rules_bind_at_commencement.md` memory, 2026-05-07).
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## Purpose

This policy governs Hoz Bank Limited's (the "Bank") stress testing framework. Stress testing is a forward-looking risk management tool that assesses the resilience of the Bank's capital base and liquidity position under adverse but plausible scenarios — extending beyond the scope of normal day-to-day risk measurement. The policy exists to ensure that:

(i) the Bank maintains a comprehensive, structured stress testing programme aligned with PA Directive D1/2019 requirements;
(ii) stress testing is fully integrated into the ICAAP (Internal Capital Adequacy Assessment Process) and ILAAP (Internal Liquidity Adequacy Assessment Process), which are submissions required for banking licence approval;
(iii) stress test results directly inform management decisions on capital planning, limit setting, recovery plan triggers, and risk appetite calibration;
(iv) governance over scenario design, model execution, and results review is clear, documented, and events-driven (Principle 1).

The policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). It cites the regulatory obligations above it; procedures under this policy (including `Procedures/by-policy/stress-testing-icaap.md`, `Procedures/by-policy/stress-testing-ilaap.md`, and `Procedures/by-policy/reverse-stress-test.md`) operationalise it; the stress scenario engine, capital projection model, and liquidity stress engine are the system capabilities that execute those procedures.

---

## Principles

- **Scenarios must be severe-but-plausible.** Stress scenarios are not designed to be the worst imaginable event; they are designed to be severe enough to be informative for capital and liquidity management, while remaining plausible given the Bank's business model and operating environment. The calibration of "severe-but-plausible" is Helena's professional judgement, informed by historical precedents and Rohan's (Market risk quantitative engineer, engineering) quantitative analysis.
- **Three-tier programme: regulatory, internal, and reverse.** The stress testing programme comprises three tiers: (i) regulatory stress tests (PA-mandated scenarios, used for ICAAP/ILAAP submission and BA700 filing); (ii) internal management stress tests (Bank-designed scenarios, used for management decision-making and risk appetite calibration); and (iii) reverse stress tests (backward from a point of non-viability, to identify the scenarios that most threaten the business model).
- **Integration is mandatory.** Stress test results are not standalone analytical outputs; they are integrated into ICAAP capital planning (Pillar 2A add-on calibration), ILAAP liquidity planning (survival horizon), and recovery planning (trigger identification). Unintegrated stress tests are Principle 2 findings.
- **Events-first stress accounting.** Stress scenario assumptions, model runs, and results are typed events in the event log, not spreadsheet outputs (Principle 1). The canonical stress test record is a `StressTestRunCompleted { programmeType, scenario, period, capitalImpact, liquidityImpact, findings[] }` event; the stress test report is a render of those events.
- **Model risk applies.** Stress test models are subject to the Model Risk Policy (RISK-MRP-01). All stress models are independently validated by Nadia (Independent-validation engineer, engineering) before use in an ICAAP/ILAAP submission or a PA-mandated exercise. Model limitations must be explicitly disclosed in every stress test report.
- **No gaming.** Scenarios are not designed to produce a predetermined capital adequacy conclusion. Helena presents scenarios to the CEO for approval; Rohan runs the quantitative models independently; Camille (Chief Financial Officer, governance) validates the financial impact. The CEO approves the results package, not the scenario calibration — that is Helena's domain.

---

## 1. Scope

This policy applies to:

- All entities within the Bank's legal entity perimeter at licence-day.
- All material risk types: credit risk, market risk, operational risk, liquidity risk, IRRBB, concentration risk, and business/strategic risk, as relevant to the scenario applied.
- All balance sheet items, off-balance-sheet exposures, and contingent obligations that are material to the Bank's capital or liquidity position.
- All three tiers of the stress testing programme: regulatory, internal management, and reverse.

The policy does not cover:

- Scenario analysis for individual trading positions or desks (governed by `Policies/market-risk-policy-v1.md` — FRTB back-testing and ES computation are not stress tests in the sense of this policy).
- Sensitivity analysis of individual financial models (governed by RISK-MRP-01).

---

## 2. Governance

**Owner:** Helena (Chief Risk Officer, governance) — owns the stress testing framework, proposes scenarios, and reviews results.
**Model execution:** Rohan (Market risk quantitative engineer, engineering — reports to Helena) — runs quantitative stress models, produces scenario output, files `StressTestRunCompleted` events.
**Financial impact validation:** Camille (Chief Financial Officer, governance) — validates the P&L and balance sheet impact of each scenario; produces the stressed capital and liquidity projections.
**CEO approval:** CEO approves the annual ICAAP and ILAAP stress results before PA submission; approves material changes to the scenario taxonomy.
**PA submission:** Camille files the BA700 (ICAAP return) incorporating stress test results, per the SARB reporting calendar.
**Model validation:** Nadia (Independent-validation engineer, engineering — peer-in-second-line under Helena) validates stress models before ICAAP/ILAAP submission and at least annually.
**Third-line assurance:** Vera (internal audit engineer — reports functionally to Thandiwe (Chief Audit Executive, governance)) provides assurance over the stress testing framework, scenario adequacy, and ICAAP/ILAAP integration at least annually.
**Secretariat:** Owen (Company Secretary, governance) manages governance event filing for stress test committee meetings and results approvals.

### 2.1 Governance Committee

The ICAAP / Stress Test Governance Forum (sub-committee of the Board Risk Committee) oversees the stress testing programme. Membership: Helena (chair), Camille, Eitan (Treasurer, governance), Rohan (technical secretary). CEO attends for results approval sessions. Nadia presents validation findings.

Standing agenda: (i) scenario taxonomy review; (ii) programme execution status; (iii) results — capital impact, liquidity impact, findings; (iv) ICAAP/ILAAP integration status; (v) PA observations / regulatory developments; (vi) model validation status.

### 2.2 Escalation

Any stress scenario result that shows the Bank falling below its regulatory capital minimum (Total Capital Requirement — TCR) or below a 30-day liquidity survival horizon must be escalated to the CEO and BRC immediately. Remediation options (capital raise, balance sheet reduction, recovery plan activation) are tabled within five business days of result. Helena is responsible for the escalation; Owen files the `StressTestEscalation { scenario, metric, impact, remediationOptions[] }` event.

---

## 3. Standards & Limits

### 3.1 Stress Test Programme Tiers

**Tier 1 — Regulatory stress tests (PA-mandated, ICAAP/ILAAP).** These are PA-prescribed or PA-influenced scenarios submitted as part of the BA700 return and the ICAAP/ILAAP. They include the PA's prescribed macroeconomic downturns and any ad-hoc scenarios required by the PA under D1/2019. The Bank runs the PA-prescribed scenarios without modification; Helena may add supplementary internal scenarios to the same submission to demonstrate additional depth of analysis.

**Tier 2 — Internal management stress tests.** Bank-designed scenarios to stress-test the Bank's specific business model vulnerabilities (concentrated institutional counterparty exposures, rates curve shifts, JSE liquidity deterioration, CLS/NPS indirect participant risks). Semi-annual cadence; results used for limit recalibration and risk appetite review. Scenarios are proposed by Helena, reviewed by Rohan for quantitative feasibility, approved by the CEO.

**Tier 3 — Reverse stress tests.** Backward from a defined point of non-viability (capital ratio below the PA's minimum TCR, or liquidity survival horizon below 5 days), the Bank identifies which scenario combinations could render the business model unviable. Annual cadence. Results are not for external submission but inform recovery planning triggers (`Policies/recovery-plan-v1.md` — planned) and board-level risk appetite deliberation.

### 3.2 Scenario Taxonomy

Scenarios are classified on two dimensions: (i) severity and (ii) type.

**Severity classification:**

| Severity Level | Description | Use |
|---|---|---|
| Mild | Below-trend growth; single risk-factor shock | Internal sensitivity checks only |
| Moderate | Cyclical downturn; multiple simultaneous risk-factor shocks | Internal management; Tier 2 programme |
| Severe | Severe-but-plausible systemic stress; PA-prescribed adverse scenario | ICAAP/ILAAP Tier 1; PA submission |
| Extreme | Severely adverse; near-worst-case; reverse stress boundary | Reverse stress test (Tier 3); recovery plan triggers |

**Type classification:**

| Scenario Type | Risk Drivers | Key Variables |
|---|---|---|
| Macroeconomic | SA GDP contraction, unemployment spike, rand depreciation, inflation surge | GDP growth rate, CPI, ZAR/USD, repo rate path |
| Market — rate shock | Parallel or non-parallel shift in the SA yield curve; SARB rate surprise | SA JIBAR, SA government bond curve, swap curve |
| Market — credit spread widening | Widening of institutional counterparty credit spreads; sovereign spread widening | SA CDS spreads, counterparty credit quality migration |
| Market — equity crash | JSE All Share Index decline; JSE equity liquidity deterioration | JSE ALSI, JSE sector indices, bid-offer spread expansion |
| Idiosyncratic | Bank-specific reputational shock, key counterparty default, operational failure | Single-name default, operational loss event, funding market closure |
| Combined | Macro + market + idiosyncratic simultaneously | Multiple drivers per above |

### 3.3 ICAAP Integration

The ICAAP stress test assesses the Bank's capital adequacy under stress, for the purpose of determining the Pillar 2A capital add-on. The ICAAP stress result is the key input to the Supervisory Review and Evaluation Process (SREP) capital add-on determination by the PA.

**Annual ICAAP stress cycle:**
1. Helena proposes the stress scenario set (Tier 1 regulatory + Tier 2 supplementary) to the ICAAP Governance Forum.
2. Rohan runs the quantitative capital impact models (credit risk migration, market risk P&L, operational loss estimates) for each scenario.
3. Camille produces the stressed capital projection — stressed RWA, stressed P&L, stressed CET1/Total Capital ratio — across the three-year ICAAP horizon.
4. Helena reviews results; flags any scenario where stressed capital falls below the PA's regulatory minimum or the Bank's internal capital buffer.
5. CEO approves the results package; Helena signs the ICAAP narrative.
6. Camille files the BA700 return incorporating the stress test results.

**Pillar 2A calibration:** The stressed capital shortfall (stressed capital requirement minus stressed available capital) under the PA's prescribed severe scenario is the primary input to Helena's recommendation of the Pillar 2A add-on. The Pillar 2A add-on is proposed by Helena, approved by CEO, and subject to PA review under the SREP.

**Capital floor under stress:** The Bank maintains a minimum stressed CET1 ratio of 7.0% (being the PA's 6.375% minimum CET1 requirement plus the Bank's 0.625% internal management buffer) under the PA's prescribed adverse scenario. Breach of the stressed CET1 floor requires immediate escalation per §2.2 of this policy and a capital restoration plan submitted to the PA within 30 business days.

### 3.4 ILAAP Integration

The ILAAP stress test assesses the Bank's liquidity adequacy under stress, for the purpose of determining the Pillar 2B liquidity add-on. The survival horizon (the number of days the Bank can survive in a combined market-wide and idiosyncratic stress scenario without central bank assistance) is the primary metric.

**Annual ILAAP liquidity stress cycle:**
1. Helena proposes the combined liquidity stress scenario (market-wide funding stress + idiosyncratic name-specific stress) to the ICAAP Governance Forum.
2. Rohan models the stressed cash flow profile: funding outflows (deposits withdrawn, REPO counterparties cutting lines, wholesale funding markets closing), funding inflows (asset maturities, eligible collateral monetisation via SARB open market operations), and liquidity buffer adequacy.
3. Eitan (Treasurer, governance) provides treasury assumptions on HQLA haircuts and funding market access under stress; Camille validates the P&L overlay.
4. Helena reviews the survival horizon estimate; flags any scenario where the horizon falls below 30 days.
5. CEO approves the ILAAP stress results; Helena signs the ILAAP narrative.

**LCR/NSFR under stress:** The stressed LCR (30-day) and stressed NSFR (structural) are computed for the Tier 1 adverse scenario. The Bank targets a stressed LCR of ≥ 100% under the moderate scenario and ≥ 80% under the severe scenario. A stressed LCR below 80% is an immediate escalation event per §2.2. The Bank targets a stressed NSFR of ≥ 100% under the moderate scenario.

**Survival horizon floor:** The Bank's minimum survival horizon under the severe combined scenario (Tier 1 adverse) is 30 days. This is the ILAAP commitment to the PA. Helena calibrates the liquidity buffer to ensure the 30-day floor is maintained at all times, not only at the point of ILAAP submission.

### 3.5 Recovery Planning Link

Stress test results feed directly into the Recovery Plan (planned: `Policies/recovery-plan-v1.md`). The following stress trigger thresholds, derived from Tier 1 and Tier 2 stress scenarios, activate recovery options:

| Trigger Metric | Recovery Alert | Recovery Action |
|---|---|---|
| Stressed CET1 ≤ 8.5% (pre-stress minimum: ≥ 10.5%) | Alert | Helena notifies CEO; capital restoration options reviewed within 5 days |
| Stressed CET1 ≤ 7.0% | Escalation | CEO and BRC notified; recovery options activated per Recovery Plan |
| Stressed LCR ≤ 120% (30-day) | Alert | Eitan activates contingency funding options; Helena notifies CEO |
| Stressed LCR ≤ 100% | Escalation | CEO and BRC notified; emergency liquidity options per Recovery Plan |
| Survival horizon ≤ 45 days | Alert | Eitan initiates HQLA monetisation planning; Helena notifies CEO |
| Survival horizon ≤ 30 days | Escalation | CEO and BRC notified; SARB notification; full Recovery Plan activation |

Recovery trigger values are reviewed annually as part of the ICAAP/ILAAP cycle and approved by the CEO.

### 3.6 Frequency

| Programme | Frequency | Trigger for Ad-Hoc Run |
|---|---|---|
| Tier 1 — Regulatory ICAAP stress | Annual (aligned to BA700 submission) | PA request; material change to business model or capital structure |
| Tier 1 — Regulatory ILAAP stress | Annual (aligned to ILAAP submission) | PA request; significant liquidity event |
| Tier 2 — Internal management | Semi-annual | Material market event (rate shock > 200bps; JSE ALSI decline > 20%; SA sovereign rating downgrade); Helena's judgement |
| Tier 3 — Reverse stress | Annual | Material change to business model; new product category approved |
| Ad-hoc | As required | PA request; board request; material market event; Tier 2 trigger conditions |

### 3.7 Reverse Stress Test

The reverse stress test identifies the scenario (or combination of scenarios) under which the Bank's business model becomes non-viable — where capital falls below the PA's minimum TCR or where the liquidity survival horizon falls below 5 days, and the Bank cannot take corrective action fast enough to avoid resolution.

**Process:**
1. Helena defines the non-viability endpoints: (a) capital non-viability — CET1 ratio below 4.5% (PA minimum) with no realistic capital restoration path; (b) liquidity non-viability — survival horizon below 5 days with no HQLA or emergency liquidity access.
2. Rohan performs a backward scenario identification exercise: which combinations of macroeconomic, market, and idiosyncratic shocks produce the non-viability outcomes within the Bank's three-year planning horizon?
3. The most plausible non-viability scenarios are selected (not necessarily the worst — the most plausible is the more informative for management).
4. Results are reviewed by Helena and Camille; tabled to the ICAAP Governance Forum; escalated to BRC.
5. Recovery Plan triggers are calibrated to provide early warning before non-viability scenarios materialise (§3.5 above).

The reverse stress test result is not submitted to the PA in the BA700 but is available for SREP discussion. A `ReverseStressTestCompleted { date, nonViabilityScenarios[], keyVulnerabilities[], recoveryPlanLinkage }` event is the canonical record.

---

## 4. Controls & Monitoring

### 4.1 Model Risk Controls

All stress test models are subject to RISK-MRP-01 (Model Risk Policy). Controls include:

- **Model documentation.** Every stress model is documented to the standard required by RISK-MRP-01 — purpose, methodology, assumptions, limitations, validation history. Documentation is a precondition for model use in an ICAAP/ILAAP submission.
- **Independent validation.** Nadia validates all stress models before first use in an ICAAP/ILAAP submission and at least annually. Validation findings are addressed before submission; unresolved material findings are disclosed in the ICAAP/ILAAP narrative with a remediation timeline.
- **Assumption challenge.** Helena chairs a scenario assumption challenge session before each Tier 1 and Tier 2 stress run. Camille and Rohan attend; the CEO is invited for the annual ICAAP cycle. Challenge session outcomes are filed as `StressScenarioAssumptionsApproved { scenario, date, challengeFindings[] }` events.
- **Conservatism in uncertainty.** Where model uncertainty is high (new risk types, limited historical data), Rohan applies conservative parameter choices. The degree of conservatism and its capital impact are disclosed in the stress test report.

### 4.2 Data Quality

Stress models consume position data, financial data, and market data. Data quality controls include:

- End-of-day position data sourced from the front-office system (the event log position projection is the canonical source — Principle 1).
- Market data (rates, credit spreads, equity prices) sourced from the market data feed; data quality checks (stale data, outlier detection) are Rohan's responsibility.
- Balance sheet data for ILAAP sourced from Camille's financial close; reconciliation to BA700 inputs is mandatory before submission.
- A `StressTestDataQualityCheck { date, programmeType, dataIssues[], resolution }` event is filed before each stress run; unresolved data issues block the run.

### 4.3 Ongoing Monitoring

Between formal stress test cycles, the following monitoring activities provide continuous early-warning signals:

- **Monthly capital trajectory.** Camille produces a monthly capital projection (non-stressed) that shows the distance of the current and projected CET1 ratio from the Tier 1 stress floor (§3.3). If the distance narrows to less than 100bps, Helena is notified and a mid-cycle internal management stress run is triggered.
- **Monthly LCR/NSFR monitoring.** Eitan monitors actual LCR and NSFR monthly. If actual LCR falls below 130% (pre-stressed; above the stressed floor of 120% — §3.4 alert threshold), Helena is notified and a mid-cycle ILAAP liquidity stress assessment is triggered.
- **Market event triggers.** The Tier 2 ad-hoc triggers (§3.6 table) are monitored by Rohan daily; any trigger breach is reported to Helena within one business day, and Helena decides whether to initiate an ad-hoc Tier 2 run.

---

## 5. Reporting

| Report | Frequency | Author | Recipients | Canonical Event |
|---|---|---|---|---|
| ICAAP stress test results | Annual | Helena + Rohan + Camille | CEO, BRC, PA (via BA700) | `StressTestRunCompleted { programmeType: "ICAAP-Tier1" }` |
| ILAAP liquidity stress results | Annual | Helena + Rohan + Eitan + Camille | CEO, BRC, PA | `StressTestRunCompleted { programmeType: "ILAAP-Tier1" }` |
| Internal management stress results | Semi-annual | Helena + Rohan | ICAAP Governance Forum, CEO | `StressTestRunCompleted { programmeType: "Internal-Tier2" }` |
| Reverse stress test report | Annual | Helena + Rohan | BRC, CEO | `ReverseStressTestCompleted { ... }` |
| Monthly capital trajectory (proximity to stress floor) | Monthly | Camille | Helena, Eitan, CEO | (integrated into monthly capital report) |
| Ad-hoc stress results | As required | Helena + Rohan | CEO, BRC, PA as applicable | `StressTestRunCompleted { programmeType: "AdHoc" }` |
| PA BA700 ICAAP return | Annual | Camille | PA | `RegulatoryReturnFiled { returnType: "BA700" }` |

All stress test reports are immutable point-in-time artefacts (per `feedback_dashboards_live_reports_as_of.md` memory) — they carry an as-of date and are not updated retrospectively. Corrections are filed as separate events with a reference to the original.

---

## 6. Exceptions & Escalation

### 6.1 Exception Process

Any deviation from this policy (e.g., a stress test not completed within the required frequency, a model used before independent validation, a PA-mandated scenario not run) is documented as a `StressTestPolicyException { exception, reason, remediationPlan, approver }` event. Helena approves exceptions; material exceptions (affecting ICAAP/ILAAP submission quality or PA commitments) require CEO approval. Vera is notified of all exceptions.

### 6.2 Escalation Ladder

| Condition | Escalation | Timeframe |
|---|---|---|
| Stressed CET1 below 7.0% floor | Helena → CEO → BRC; capital restoration plan | Immediate notification; plan within 5 days |
| Stressed LCR below 100% | Helena → CEO → BRC; contingency funding | Immediate notification; plan within 2 days |
| Survival horizon below 30 days | Helena → CEO → BRC → PA | Immediate notification; SARB contact within 1 day |
| PA ad-hoc stress request | Helena coordinates; CEO approves submission | PA timeline; typically 20 business days |
| Model fails validation before ICAAP submission | Helena → Nadia remediation → CEO | Resolve before submission or disclose in narrative |
| Tier 3 reverse stress reveals near-term non-viability | Helena → CEO → BRC; Recovery Plan activation | Within 48 hours of result |

---

## 7. Obligations Closure Table

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-PR-12` | Conduct ICAAP-integrated stress testing per PA D1/2019; LICENCE-BIND | **DRAFT** (LICENCE-BIND) — closed by this policy | §3.3 (ICAAP Integration), §3.4 (ILAAP Integration), §3.6 (Frequency) |

---

## 8. Substrate Dependencies and Gaps

Per the events-first authoring rule (Principle 1), gaps are named explicitly — not hidden.

### 8.1 Substrate under construction

- **Stress scenario engine (Rohan, under Helena).** Applies PA-prescribed and internally-designed scenarios to the balance sheet and P&L model. Discharge exit signal: `StressTestRunCompleted { programmeType, scenario, period, capitalImpact, liquidityImpact }` event on synthetic fixture.
- **Capital projection model (Rohan + Camille).** Three-year stressed RWA and capital ratio trajectory. Discharge exit signal: stressed CET1 time series output reconciled to BA700 template.
- **Liquidity stress engine (Rohan + Eitan).** Stressed cash flow projection and survival horizon computation. Discharge exit signal: survival horizon estimate and stressed LCR/NSFR output.
- **Reverse stress test model (Rohan).** Backward scenario identification from non-viability endpoints. Discharge exit signal: `ReverseStressTestCompleted { ... }` event with plausibility-ranked scenario list.

### 8.2 Procedures planned but not yet authored

- `Procedures/by-policy/stress-testing-icaap.md` — ICAAP annual stress cycle step-by-step.
- `Procedures/by-policy/stress-testing-ilaap.md` — ILAAP annual liquidity stress cycle.
- `Procedures/by-policy/reverse-stress-test.md` — reverse stress test methodology and non-viability endpoint calibration.

### 8.3 Policy dependencies (planned)

- `Policies/capital-management-policy-v1.md` — Pillar 2A add-on calibration and capital floor governance.
- `Policies/liquidity-risk-policy-v1.md` — ILAAP survival horizon governance and LCR/NSFR management.
- `Policies/recovery-plan-v1.md` — recovery trigger calibration sourced from this policy's §3.5.
- `RISK-MRP-01` (Model Risk Policy) — stress model validation framework.

### 8.4 Citation gaps (TBC)

Per Principle 2, no sub-clause indices are invented. The following are `[citation: TBC]` until Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate:

1. Regulations Relating to Banks — precise sub-clause indices for reg.39(4) ICAAP provisions.
2. PA Directive D1/2019 — full directive text, specific stress testing requirements by section.
3. SARB BA700 — specific stress test schedule and submission format requirements.
4. PA ILAAP guidance (2019) — survival horizon requirement confirmation (30-day floor).
5. Banks Act s73 — precise sub-section references for risk management framework requirements.

---

## 9. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | 2026-05-13 | Helena (Chief Risk Officer, governance) | Initial policy. Nine sections: Purpose; Principles (six); (1) Scope; (2) Governance — committee, roles, escalation ladder; (3) Standards & Limits — three-tier programme (regulatory, internal, reverse), scenario taxonomy (severity × type matrix), ICAAP integration with stressed CET1 floor, ILAAP integration with survival horizon ≥30 days and LCR/NSFR under stress, recovery planning triggers table, frequency table, reverse stress test methodology; (4) Controls — model risk, data quality, ongoing monitoring; (5) Reporting — six report types with canonical events; (6) Exceptions and escalation; (7) Obligations closure: ORG-PR-12; (8) Substrate and citation gaps. LICENCE-BIND. |
