---
policy-id: RISK-MRP-01
title: Model Risk Policy v1
version: "1.0"
status: DRAFT
owner: Helena (Chief Risk Officer, governance)
effective-from: 2026-05-13
next-review: "2026-11-13"
citations:
  - "Banks Act 94 of 1990: s73 (risk management)"
  - "Regulations Relating to Banks 2012: reg.39(4) (model risk)"
  - "PA Guidance Note on ICAAP: model risk in capital adequacy self-assessment"
  - "IFRS 9 §B5.5: ECL model governance (expected credit loss)"
  - "SR 11-7 (Federal Reserve/OCC): supervisory guidance on model risk management — industry best practice reference"
author: Helena (Chief Risk Officer, governance)
date: 2026-05-13
summary: "Establishes the bank's model risk governance framework — model inventory, validation standards, use-test requirements, and sign-off thresholds — for all quantitative models used in risk measurement, pricing, and regulatory capital."
decision-required: false
applies-at: LICENCE-BIND
obligations-closed:
  - ORG-PR-21
  - ORG-PR(IV)-10
riskTaxonomy:
  - MOD-001
  - RISK-001
  - FIN-002
---

# Model Risk Policy v1

> **Policy** | RISK-MRP-01 v1.0 | Owner: Helena (Chief Risk Officer, governance) | Status: DRAFT | Effective: 2026-05-13

> **Standing authority.** CEO-approved regulatory readiness programme (`D-REGULATORY-READINESS-GATE-PLAN`). Implements Banks Act s73 (risk management), Regulations Relating to Banks reg.39(4) (model risk management), PA Guidance Note on ICAAP (model risk in capital adequacy self-assessment), IFRS 9 §B5.5 (ECL model governance), and SR 11-7 (Federal Reserve / OCC supervisory guidance on model risk management — adopted as industry best practice reference in the absence of a separate PA model-risk guidance note).
> **Obligations closed.** `ORG-PR-21` (documented model risk management framework including inventory, validation, monitoring), `ORG-PR(IV)-10` (model governance for privacy-impacting models and automated decision-making tools).
> **Status.** LICENCE-BIND. The model risk governance framework must be operational at PA licence application. The model inventory register, validation framework, and ongoing monitoring substrate are under construction per `D-REGULATORY-READINESS-GATE-PLAN`.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## Purpose

This policy establishes Hoz Bank Limited's (the "Bank's") model risk governance framework. Model risk is the risk of adverse consequences from decisions based on incorrect or misused quantitative models — including incorrect model outputs, model misapplication, and model use outside its validated scope. Model risk is a named sub-category of operational risk and is managed jointly by Helena (Chief Risk Officer, governance) and Rohan (Market risk quantitative engineer, engineering — reports to Helena).

The policy governs all quantitative models used in risk measurement, pricing, IFRS 9 expected credit loss (ECL) computation, stress testing, and regulatory capital. It establishes: (i) a model definition and inventory; (ii) a tiered model classification system; (iii) model lifecycle governance from development through retirement; (iv) independent validation standards; (v) ongoing model performance monitoring; (vi) escalation thresholds based on model tier and failure type; and (vii) specific governance for IFRS 9 ECL models.

The Bank's AI-agent labour force (Principle 6) creates a distinctive model risk profile: AI agent models (LLMs used for decision support, classification, and analytical tasks) are quantitative models within the scope of this policy where they produce outputs that feed into risk measurement, pricing, capital, or regulatory submissions. Non-risk-bearing LLM tasks (e.g., document drafting, communication) are out of scope.

---

## Principles

- **Independence of validation.** Model validation must be performed by a validator who was not involved in model development. No model enters production without a completed independent validation. Helena approves all Tier 1 and Tier 2 model validations.
- **Use-test requirement.** Models used in regulatory capital submissions (ICAAP, ILAAP, stress tests) must also be used in day-to-day risk management. A model used only for regulatory submission and not for internal management decisions is presumptive evidence of model misuse.
- **Documented limitations are mandatory.** Every model has a documented limitations log. An undocumented limitation is not a managed limitation — it is a model risk event. Rohan (Market risk quantitative engineer, engineering) maintains the limitations log for each model he builds; Nadia (Independent-validation engineer, peer-in-second-line under Helena) independently assesses completeness.
- **Events are the record of truth.** Every model lifecycle event — approval, validation, monitoring finding, limitation discovery, retirement — is a typed event in the event log (Principle 1). A model that is deployed without a `ModelApproved` event is an ungoverned model and a Vera (internal audit engineer) Critical finding.
- **Risk appetite drives escalation.** Aggregate model risk is managed within Helena's approved Model Risk Appetite Score (§6.2). A Tier 1 model failing validation is an immediate escalation event regardless of the aggregate score.
- **AI-agent models are in scope.** Where AI-agent models (LLMs, classifiers, embeddings) produce outputs that feed into risk measurement, capital computation, or regulatory submissions, they are Tier 1 or Tier 2 models and subject to the full lifecycle governance in this policy.

---

## 1. Scope

### 1.1 Model Definition

A **model** for the purposes of this policy is a quantitative method, system, or approach that: (i) applies statistical, economic, financial, or mathematical theories, techniques, or assumptions; (ii) processes input data to produce quantitative outputs; and (iii) is used to make or inform decisions about risk, pricing, capital, or regulatory compliance.

The definition includes:
- **Risk models:** VaR, SVaR, Expected Shortfall (market risk); PD, LGD, EAD (credit risk); operational risk capital models (BIA/TSA).
- **Pricing models:** derivative pricing models (IRD, FX); bond pricing; fair-value models for IFRS 9 and IFRS 13.
- **IFRS 9 ECL models:** staging logic (SICR assessment); PD/LGD/EAD parameter models; macroeconomic overlay models; ECL computation engine.
- **Stress-test models:** macroeconomic stress scenario transmission models; portfolio sensitivity models; ICAAP/ILAAP stress models.
- **Capital models:** ICAAP Pillar 2A capital self-assessment models; ILAAP liquidity stress models.
- **AI-agent risk models:** LLM classifiers or analytical outputs where they feed into regulated risk measurement, pricing, capital, or reporting.
- **Regulatory reporting models:** BA-return computation logic where it involves model-based estimation (not pure aggregation).

### 1.2 Out of Scope

- Pure algorithmic data aggregations (sum, count, weighted average without statistical assumptions).
- Qualitative judgement frameworks (e.g., credit committee scoring where quantification is not the output).
- LLM outputs used for document drafting, communication, or research tasks with no direct feed into risk, pricing, or capital computations.
- Excel workbooks used for management reporting where no model-based estimation is involved (subject to Rohan's assessment — borderline cases are escalated to Helena).

---

## 2. Model Tiering

### 2.1 Tier Classification

All models in the inventory are assigned to one of three tiers based on their use, regulatory materiality, and potential impact:

| Tier | Label | Criteria | Examples |
|---|---|---|---|
| **Tier 1** | Regulatory / Capital | Used in ICAAP, ILAAP, regulatory capital submissions, or SARB stress-test reporting; OR IFRS 9 ECL models affecting published financial statements | ICAAP Pillar 2A models, VaR/SVaR, IFRS 9 PD/LGD/EAD, ILAAP liquidity stress |
| **Tier 2** | Pricing / Valuation | Used to price financial instruments or determine fair value for IFRS 9/13 balance-sheet purposes; OR used in risk-limit monitoring | Derivative pricing models (IRD, FX), bond pricing, internal VaR limit models |
| **Tier 3** | MIS / Reporting | Used for management information, internal reporting, or performance measurement; not used in regulatory submissions or financial statement figures | Portfolio attribution models, MIS dashboards, management stress scenarios |

**Tiering authority:** Rohan (Market risk quantitative engineer, engineering) proposes tier classification for each model at the point of model registration; Helena (Chief Risk Officer, governance) approves or revises the classification. Tier reclassification (upward or downward) requires Helena's written approval and is recorded as a `ModelReclassified` event.

### 2.2 Tier-Differentiated Requirements

| Requirement | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Independent validation before deployment | Mandatory | Mandatory | Recommended (mandatory if Helena directs) |
| Helena sign-off for deployment | Yes | Yes | Rohan may approve |
| Ongoing performance monitoring frequency | Monthly | Quarterly | Annual |
| Annual validation review | Mandatory | Mandatory | Recommended |
| Board Risk Committee reporting | Yes | Quarterly | Material findings only |
| PIR on model failure | Mandatory | Mandatory | Helena directs |

---

## 3. Model Lifecycle

### 3.1 Development

Model development is Rohan's (Market risk quantitative engineer, engineering) responsibility for all risk and capital models; pricing model development may involve Eitan (Treasurer, governance) for treasury-specific models, with Rohan providing quantitative review.

Development requirements:
1. **Model specification document** — before development begins, a model specification document is produced covering: the problem the model solves; the mathematical/statistical methodology; data requirements; assumptions; known limitations at design stage; regulatory citations (e.g., IFRS 9 §B5.5 for ECL models).
2. **Development log** — a contemporaneous record of methodological choices made during development, including alternatives considered and rejected.
3. **Data governance** — input data sources are documented; data quality assessment is performed; POPIA personal-data handling is confirmed where the model processes personal information (cross-reference `Policies/popia-privacy-policy-v1.md`).
4. **Back-testing on development data** — initial model performance is assessed against historical data before validation.

Development produces a `ModelDevelopmentCompleted { modelId, modelVersion, methodology, dataInputs[], knownLimitations[], developedBy, completedAt }` event.

### 3.2 Documentation

Documentation is a mandatory precondition for validation. No validation may commence without complete model documentation. Helena enforces documentation completeness before commissioning validation.

Minimum documentation requirements:
- Model specification document (§3.1).
- Mathematical/statistical methodology description.
- Data dictionary for all model inputs and outputs.
- Assumptions log (all assumptions explicit and calibrated).
- Limitations log (all known limitations documented with materiality assessment).
- Validation results from development testing.
- Intended use statement (what the model is approved to be used for; what it is NOT approved for).

Documentation is stored in the BLAKE3 document store per `D-RMS-PHASE-1` and linked to the model inventory record.

### 3.3 Independent Validation

Independent validation is performed by Nadia (Independent-validation engineer, peer-in-second-line under Helena). Nadia must not have been involved in the development of the model being validated. For Tier 1 models, external validation (engaging an independent third-party quantitative firm) may be required by Helena at licence application or ICAAP submission — Helena decides on a model-by-model basis.

**Validation scope:**
1. **Conceptual soundness** — is the mathematical/statistical methodology appropriate for the intended use? Are the assumptions reasonable?
2. **Data quality** — are the input data sources appropriate? Is the data quality sufficient for the model's intended precision?
3. **Implementation verification** — does the coded implementation correctly implement the documented specification? Are there coding errors?
4. **Outcome analysis** — do model outputs behave as expected across a range of inputs? Are there instabilities, edge cases, or sensitivity concentrations?
5. **Limitations challenge** — are the documented limitations complete? Nadia independently assesses whether additional undocumented limitations exist.
6. **Intended-use boundary** — does the model produce reliable outputs within its intended use boundary? What happens outside that boundary?

Validation produces a `ModelValidationCompleted { modelId, modelVersion, validatedBy, validationDate, findings[], limitationsAssessed[], recommendedForApproval, conditions[] }` event. Findings are classified as Critical (blocks deployment), Major (conditions on deployment), or Minor (informational; remediate within agreed timeline).

### 3.4 Approval

Model approval is Helena's (Chief Risk Officer, governance) authority for Tier 1 and Tier 2 models. Tier 3 model approval may be delegated to Rohan (Market risk quantitative engineer, engineering).

Helena approves a model only if:
- No Critical validation findings are open.
- All Major findings have agreed remediation plans with deadlines.
- The model documentation is complete.
- The intended use statement is clear and limits are defined.
- For IFRS 9 ECL models: Camille (Chief Financial Officer, governance) has confirmed accounting treatment consistency.

`ModelApproved { modelId, modelVersion, approvedBy, approvalDate, tier, intendedUse, conditions[], validationRef }` is the canonical approval event. Deployment without this event is an ungoverned model (Vera Critical finding).

### 3.5 Deployment

Deployment (moving a model from development/validation environment to production) requires:
1. `ModelApproved` event confirmed.
2. Production environment differs from development environment in data but not in code (validated code is promoted, not rewritten).
3. A smoke-test on production data is performed immediately post-deployment to confirm consistent outputs.
4. The model inventory record is updated with production deployment date and environment.

`ModelDeployed { modelId, modelVersion, deployedAt, environment: "production", smokeTestPassed }` is the canonical deployment event.

### 3.6 Ongoing Monitoring

Ongoing model performance monitoring is Rohan's (Market risk quantitative engineer, engineering) responsibility, with oversight by Nadia (Independent-validation engineer, peer-in-second-line under Helena). Helena reviews monitoring reports per the tier frequency in §2.2.

Monitoring includes:
- **Backtesting:** comparing model predictions to actual outcomes over rolling periods. For VaR models: daily P&L backtesting with Basel traffic-light framework. For IFRS 9 ECL models: comparison of predicted default rates to actual default experience.
- **Stability testing:** checking that model outputs are stable in the face of minor input variations.
- **Drift detection:** for AI-agent models, monitoring output distribution for drift from the validated baseline.
- **Performance metrics:** model-specific metrics (e.g., Gini coefficient for PD models; model error distribution for pricing models).
- **Limit exceptions:** where model outputs feed into risk limits, tracking limit exceptions attributable to model output anomalies.

Monitoring reports are filed as `ModelMonitoringReportProduced { modelId, modelVersion, reportPeriod, backtestResult, driftDetected, limitExceptions[], findings[] }` events. Material findings (model underperformance, significant drift, new limitation discovered) trigger immediate escalation to Helena.

### 3.7 Model Retirement

A model is retired when it is replaced, the product or use case it serves is discontinued, or it has failed validation and no remediation is possible. Retirement requires Helena's (Chief Risk Officer, governance) approval for Tier 1 and Tier 2 models.

`ModelRetired { modelId, modelVersion, retiredAt, retiredBy, reason, replacedBy? }` is the canonical retirement event. Retired models are removed from production use immediately; historical model outputs and documentation are retained in the document store per the retention schedule.

---

## 4. Model Inventory

### 4.1 Model Inventory Register

Rohan (Market risk quantitative engineer, engineering) maintains the model inventory register — a live event-derived projection of all models across their lifecycle states (Development, Validation, Approved, Deployed, Monitoring, Retired). The register is the single canonical source of model inventory; shadow model registers maintained by individual business units are not recognised (Principle 2 — single graph, no orphans).

The inventory register records, for each model:

| Field | Description |
|---|---|
| `modelId` | Unique identifier |
| `modelName` | Human-readable name |
| `tier` | Tier 1, 2, or 3 |
| `status` | Development / Validation / Approved / Deployed / Retired |
| `owner` | Business owner (person responsible for use and inputs) |
| `developer` | Developer (Rohan or delegated) |
| `validator` | Validator (Nadia or delegated/external) |
| `approver` | Helena (Tier 1/2) or Rohan (Tier 3) |
| `intendedUse` | Precise statement of approved use |
| `regulatoryCitations` | Regulations or standards the model implements |
| `deployedVersion` | Version currently in production |
| `lastValidationDate` | Date of last completed independent validation |
| `nextReviewDate` | Scheduled next review date |
| `openFindings` | Count of open validation findings by severity |
| `limitationsLogRef` | Reference to limitations log in document store |

Helena reviews and approves the inventory register at each quarterly BRC report. Any model present in production but absent from the inventory register is a Vera Critical finding.

### 4.2 Tier Classification Approval

Helena (Chief Risk Officer, governance) reviews and approves tier classifications for all models in the inventory. Tier classification is reviewed annually and on any material change to the model's use. Helena's approval of the annual inventory register constitutes approval of the tier classifications contained in it.

---

## 5. IFRS 9 ECL Governance

### 5.1 Scope and Regulatory Context

IFRS 9 §B5.5 requires the Bank to measure expected credit losses using a forward-looking, probability-weighted estimate of credit losses over the expected life of a financial instrument (Lifetime ECL) or over 12 months (12-month ECL), depending on staging. The Bank applies IFRS 9 from the first reporting period after commencement of trading [citation: TBC — SARB effective date for IFRS 9 adoption by regulated entities; Imani (Legal-as-code engineer, engineering) confirms].

The IFRS 9 ECL governance framework is a sub-domain of this Model Risk Policy. The IFRS 9 ECL model suite is classified as Tier 1 (regulatory capital / financial statement impact).

### 5.2 IFRS 9 ECL Model Suite

The IFRS 9 ECL model suite comprises:

1. **Staging model** — classifies exposures into Stage 1 (12-month ECL), Stage 2 (Lifetime ECL — SICR but not credit-impaired), and Stage 3 (credit-impaired). The staging model implements the Significant Increase in Credit Risk (SICR) assessment per IFRS 9 §B5.5.17.
2. **PD model** — probability of default over the relevant horizon (12-month for Stage 1; lifetime for Stage 2/3). Must be point-in-time (PIT) and forward-looking.
3. **LGD model** — loss given default, expressed as a percentage of EAD. Must reflect economic-cycle variability and forward-looking conditions.
4. **EAD model** — exposure at default, including undrawn commitments and off-balance-sheet items (credit conversion factors).
5. **Macroeconomic overlay model** — adjusts PD/LGD/EAD parameters for macroeconomic scenarios. Requires multiple scenarios (base, upside, downside) with probability weightings.
6. **ECL computation engine** — aggregates PD × LGD × EAD across exposures and scenarios, discounted at the effective interest rate.

### 5.3 Staging Logic Governance

Staging logic is the most judgement-intensive component of the ECL model suite. The following governance rules apply:

1. **SICR assessment criteria** — the criteria for SICR (Significant Increase in Credit Risk) are documented in the staging model specification and reviewed by Nadia (Independent-validation engineer, peer-in-second-line under Helena) annually and on any material change to the credit portfolio composition.
2. **Quantitative vs qualitative criteria** — both quantitative (e.g., days past due, PD migration threshold) and qualitative (e.g., forbearance, watch-list) SICR criteria are documented.
3. **Backstop** — all exposures 30 days past due are classified as Stage 2; all exposures 90 days past due are classified as Stage 3, per the IFRS 9 rebuttable presumption `[citation: IFRS 9 §B5.5.19 (30-day) and §B5.5.28 (90-day)]`.
4. **Staging model change governance** — any change to the staging criteria (including recalibration of quantitative thresholds) constitutes a model change, requires full documentation update, Nadia validation, and Helena approval before deployment.

### 5.4 PD/LGD/EAD Parameter Governance

Parameter governance requirements:
- Parameters are calibrated to the Bank's own loss history (where available) or to external reference data with appropriate adjustments for portfolio composition differences.
- Parameters must be forward-looking; through-the-cycle (TTC) parameters are not acceptable for IFRS 9 (contrast with IRB regulatory capital which may use TTC PDs).
- Parameter recalibration triggers: annual (mandatory); material portfolio composition change; economic regime change (Helena's judgement); material deviation of actuals from model predictions (backtesting trigger).
- All parameter updates are treated as model changes, requiring documentation, validation (of the change, not necessarily full model re-validation), and Helena approval.

### 5.5 Macroeconomic Overlay Approval

The macroeconomic overlay model (scenario weights and macroeconomic variable paths) requires:
1. **Scenario set** — at minimum three scenarios (base, upside, downside) with probability weightings summing to 100%.
2. **Helena approval** — Helena approves the scenario set, probability weights, and macroeconomic variable paths at each quarterly ECL run.
3. **Camille (CFO) confirmation** — Camille (Chief Financial Officer, governance) confirms accounting treatment consistency before the ECL figure enters the financial statements.
4. **Audit trail** — the approved scenario set and probability weights are filed as `IfrsNineMacroOverlayApproved { reportingDate, scenarios[], weights[], approvedBy: "helena", cfoConfirmed: true }` events.

Changes to the scenario set or probability weights between quarterly runs (e.g., in response to a macroeconomic shock) require out-of-cycle approval by Helena and notification to Camille.

### 5.6 IFRS 9 ECL Governance Committee

Helena chairs the IFRS 9 ECL Governance Committee (a sub-forum of the Credit Risk Committee or, pending its constitution, of the Board Risk Committee). The committee meets quarterly before each ECL run and includes: Helena (chair), Rohan (model owner), Nadia (validator), Camille (Chief Financial Officer), and Eitan (Treasurer, governance — portfolio composition input). The committee reviews: backtesting results; parameter changes since last run; macroeconomic overlay proposals; staging model performance; any open validation findings.

`IfrsNineEclGovernanceCommitteeMeeting { meetingDate, attendees[], decisionsSummary[], overlayApproved, openFindings[] }` is the typed committee record.

---

## 6. Model Risk Appetite and Escalation

### 6.1 Model Risk Appetite

Model risk appetite is expressed as an **aggregate Model Risk Appetite Score (MRAS)** — a weighted score across the model inventory reflecting: the tier distribution of models; the count and severity of open validation findings; the proportion of models past their next review date; and the count of models with undocumented limitations.

The MRAS is computed by Rohan (Market risk quantitative engineer, engineering) quarterly and reported to Helena. The MRAS methodology and calibration are included in the model inventory register documentation.

| MRAS Zone | Definition | Action |
|---|---|---|
| **Green** | All Tier 1/2 models validated; no Critical findings open; < 3 Major findings open | Normal monitoring cadence |
| **Amber** | One or more Tier 2 models past review date; 3–5 Major findings open; MRAS composite score in amber band | Helena convenes review; action plan within 30 days |
| **Red** | Any Tier 1 model with open Critical finding; any Tier 1 model more than 6 months past review date; > 5 Major findings open | Immediate escalation to Marc (CEO) and BRC; suspension of regulatory use of the affected model pending remediation |

### 6.2 Tier 1 Model Failure — Immediate Escalation

A Tier 1 model "fails validation" if: Nadia's validation produces a Critical finding; or ongoing monitoring reveals that the model's actual performance has materially diverged from its validated performance envelope. Model failure triggers are:

1. `ModelValidationCompleted { ..., recommendedForApproval: false }` event.
2. `ModelMonitoringReportProduced { ..., criticalFinding: true }` event.

On Tier 1 model failure:
- Helena notifies Marc (CEO) within 24 hours.
- The affected model's regulatory use is suspended pending remediation (a conservative substitute methodology is used in the interim — Helena approves the substitute).
- Rohan begins root-cause analysis; remediation plan presented to Helena within 5 business days.
- BRC is notified at the next scheduled BRC meeting; if the impact is material, an extraordinary BRC notification is made within 48 hours.
- PA notification is assessed by Helena and Zara (Chief Compliance Officer, governance) — if the model failure has affected a regulatory submission, PA notification per the relevant reporting obligation is made `[citation: TBC — PA notification obligation for model failures affecting regulatory submissions; Imani confirms]`.

---

## 7. Reporting

### 7.1 Internal Reporting Cadence

- **Monthly:** Rohan produces the Model Risk Monitoring Report — all models with monitoring results for the period; MRAS update; open findings count by severity; models approaching review date.
- **Quarterly:** Helena presents the Model Risk Report to the Board Risk Committee — inventory summary by tier, MRAS status, IFRS 9 ECL governance committee outcomes, validation findings summary, open model risk actions.
- **Annual:** Helena produces the Annual Model Risk Review — full inventory review; tier classification review; validation programme completeness; backtesting aggregate results; model limitation completeness; MRAS trend over the year. Included in the ICAAP as the model risk chapter.
- **At each ICAAP submission:** Helena certifies model adequacy for all Tier 1 models used in the ICAAP. The certification is a `ModelIcaapCertification { submissionDate, tier1Models[], allValidated, openFindings[], certifiedBy: "helena" }` event.

### 7.2 Model Risk in ICAAP

Model risk is a named Pillar 2A risk in the ICAAP. Helena's self-assessment covers:
- Whether the Tier 1 regulatory capital models (VaR, IFRS 9 ECL, operational risk capital) are adequate for the Bank's risk profile.
- Whether model limitations are material enough to warrant a Pillar 2A model risk capital add-on.
- Whether the model validation programme meets SR 11-7 best-practice standards.

A material model risk Pillar 2A assessment (Helena's judgement that a capital add-on is warranted) is escalated to Marc (CEO) and Camille (CFO) before the ICAAP is submitted to the PA.

---

## 8. Exceptions and Escalation

### 8.1 Exception Process

Any deviation from this policy (e.g., deploying a model without completed independent validation; using a model outside its intended use boundary) requires:
1. Written justification from Rohan (Market risk quantitative engineer, engineering) or the relevant model owner.
2. Helena's written approval.
3. For Tier 1 models: Marc (CEO) written approval.
4. Filing as a typed `PolicyException { policyId: "RISK-MRP-01", exceptionId, modelId, justification, approvedBy, approvedAt, reviewDate }` event.
5. A compensating control documented in the exception record (e.g., parallel-running a validated alternative model while the exception-model is being validated).

Exceptions must specify a sunset date. Exceptions lasting more than 90 days for Tier 1 models require BRC awareness.

### 8.2 Escalation Matrix

| Trigger | Escalate to | Timeline |
|---|---|---|
| Tier 1 model fails validation | Helena → Marc (CEO) → BRC | 24 hours (CEO); next BRC (material: 48 hours) |
| MRAS reaches Red zone | Helena → Marc (CEO) | Immediately |
| Tier 1 model > 6 months past review date | Helena → Marc (CEO) → BRC | Immediately; BRC within 48 hours |
| IFRS 9 ECL macroeconomic overlay dispute (Rohan/Helena disagree) | Helena → Camille (CFO) for accounting view; Marc (CEO) for final call | Before ECL run |
| Open Tier 1 model exception > 90 days | Helena → BRC | Quarterly BRC meeting |
| Model used outside intended use boundary | Helena → Marc (CEO) | Immediately; model use suspended |
| PA requests model documentation or validation report | Helena → Marc (CEO) | Within 24 hours of PA request |

---

## 9. Obligations Closure Table

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-PR-21` | Documented model risk management framework including inventory, validation, monitoring | DRAFT (LICENCE-BIND) | §4 (Model Inventory), §3 (Model Lifecycle — development through retirement), §2 (Tiering), §6 (Risk Appetite and Escalation), §7 (Reporting) |
| `ORG-PR(IV)-10` | Model governance for privacy-impacting models and automated decision-making tools | DRAFT (LICENCE-BIND) | §1.1 (Model definition including AI-agent models), §3.1 (Development — POPIA personal-data handling), §5 (IFRS 9 ECL governance — data subject protection in credit modelling) |

---

## 10. Substrate Dependencies and Gaps

### 10.1 Substrate Under Construction

- **Model inventory register (Rohan, under Helena).** Event-derived projection of all models; live tier/status/finding tracking. Discharge exit signal: `ModelInventoryRegisterValidated { version, modelCount, allTier1Validated }` event from first annual inventory review.
- **Model performance monitoring platform (Rohan, under Helena).** Automated backtesting, drift detection, and KRI monitoring for all deployed models. Discharge exit signal: `ModelMonitoringReportProduced` event from synthetic model-performance fixture.
- **IFRS 9 ECL computation engine (Rohan, under Helena and Camille).** Full PD/LGD/EAD/staging/macroeconomic-overlay computation pipeline. Discharge exit signal: `EclComputationRun { reportingDate, totalEcl, stageDistribution[] }` event on synthetic portfolio fixture.
- **Validation framework (Nadia, under Helena).** Structured validation methodology, finding classification system, and validation report template. Discharge exit signal: `ModelValidationCompleted` event on first model in the inventory.

### 10.2 Procedures Planned but Not Yet Authored

- `Procedures/by-policy/model-development-procedure.md` — specification document template, development log requirements, data governance checklist.
- `Procedures/by-policy/model-validation-procedure.md` — validation scope definition, finding classification criteria, validation report template.
- `Procedures/by-policy/model-monitoring-procedure.md` — backtesting methodology by model type, drift detection thresholds, performance metric library.
- `Procedures/by-policy/ifrs9-ecl-governance-procedure.md` — staging logic review checklist, macroeconomic overlay approval protocol, ECL committee agenda template.

### 10.3 Citation Gaps (TBC)

Per Principle 2, no sub-clause indices are invented. The following are `[citation: TBC]` until Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate:

1. Regulations Relating to Banks reg.39(4) — precise sub-clause text for model risk management requirements.
2. PA Guidance Note on ICAAP — precise chapter and paragraph references for model risk in the capital adequacy self-assessment.
3. SARB effective date for IFRS 9 adoption by SARB-regulated entities (for ECL model suite go-live timing).
4. PA notification obligation — whether a Tier 1 model failure affecting a regulatory submission triggers a PA notification obligation and under which regulation.
5. SR 11-7 adoption status — whether the PA has issued a local equivalent to SR 11-7 or has formally endorsed it as the applicable best-practice standard; if local guidance differs, local guidance governs.

---

## 11. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | 2026-05-13 | Helena (Chief Risk Officer, governance) | Initial policy authored. Ten sections: (1) Scope — model definition (risk, pricing, IFRS 9 ECL, stress, capital, AI-agent risk models where feeding regulated outputs), out-of-scope carve-outs; (2) Model Tiering — Tier 1 (regulatory/capital), Tier 2 (pricing/valuation), Tier 3 (MIS/reporting) with tiering authority (Rohan proposes, Helena approves) and tier-differentiated requirements table; (3) Model Lifecycle — seven stages: Development (specification, development log, data governance, back-test), Documentation (mandatory precondition for validation), Independent Validation (Nadia or external; scope: conceptual soundness, data quality, implementation, outcome analysis, limitations challenge, intended-use boundary; Critical/Major/Minor finding classification), Approval (Helena for Tier 1/2; conditions enumerated), Deployment (smoke-test, inventory update), Ongoing Monitoring (backtesting, stability, drift, performance metrics, limit exceptions; tier-differentiated frequency), Retirement (Helena approval for Tier 1/2); (4) Model Inventory — register fields, Rohan maintenance, Helena quarterly approval, Vera Critical finding for ungoverned models; (5) IFRS 9 ECL Governance — model suite (staging, PD, LGD, EAD, macroeconomic overlay, ECL engine), staging logic governance (SICR criteria, quantitative/qualitative, backstop per IFRS 9 §B5.5.19/28), PD/LGD/EAD parameter governance (PIT forward-looking requirement), macroeconomic overlay approval (Helena quarterly; Camille CFO confirmation), IFRS 9 ECL Governance Committee (quarterly; typed committee event); (6) Model Risk Appetite — MRAS (Green/Amber/Red zone table), Tier 1 model failure escalation (Helena → CEO 24h → BRC 48h); (7) Reporting — monthly monitoring report, quarterly BRC, annual model risk review, ICAAP model adequacy certification event; (8) Exceptions and Escalation — exception process (Tier 1: CEO approval; BRC awareness > 90 days), escalation matrix; Obligations closure table: ORG-PR-21, ORG-PR(IV)-10. Substrate and citation gaps per Principle 2. Identity discipline per CLAUDE.md. |
