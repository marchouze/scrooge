---
agent: PAX
trigger: role-research
asOf: 2026-05-09T00:00:00.000Z
title: Role brief — Independent-validation function
author: PAX
date: 2026-05-09
summary: Role research for the independent model-validation function. Standing second-line agent that validates every model used in production (credit, market, liquidity, IFRS 9 ECL, capital), curates the model registry jointly with Rohan, and emits validation-decision events. Reports through Helena (CRO), functionally independent of all model builders. Closes the substrate gap Helena has flagged on every daily run since 2026-05-08; on the critical path for ICAAP / ILAAP signing authority and the bank's licence-day model-risk posture.
decision-required: false
---

# PAX — role brief: Independent-validation function

**From:** PAX (role researcher)
**To:** Marc (CEO) — via Scrooge.
**For decision:** None — CEO has already authorised the hire (CEO directive 2026-05-08 EOD; memory `project_open_workstreams_2026_05_08.md`). This brief executes the research that precedes Nolan's persona spec.
**Origin:** Helena's daily appetite watch has flagged the substrate gap on every run since 2026-05-08; named explicitly in `Team/Helena.md` § 16 ("Independent model-validation function — not staffed … Owner: PAX research / Nolan hire") and in Rohan's measurement-readiness map (`prototype/runtime/agents/rohan-risk-run.ts` line ~190, appetite line `appetite:model:tier-discipline`).

> *In-voice role research per CLAUDE.md operating rules. The bank is AI-driven (Principle 7); the independent-validation function is a standing autonomous agent, not an in-session voice. Brief follows the canonical role-brief shape established in `Owner Inbox/2026-05-07_pax_brand-design-role-brief.md`.*

## 1. Why this role exists

The Risk Appetite Statement & Framework § B7 (model-risk tiers) requires **independent validation** of every model used in production:

- **Tier 1** — regulatory capital RWA models, IFRS 9 ECL, AML monitoring core models — independent validation pre-deployment, **annual revalidation**, monitoring continuous.
- **Tier 2** — pricing engines, risk sensitivities, behavioural-deposit models — independent validation pre-deployment, **biennial revalidation**.
- **Tier 3** — operational analytics, customer-segmentation, non-decisioning models — internal review, sample audit.

The framework explicit: *"Rohan develops; an independent validation function reports to Helena. Validators do not also build (segregation)."* (RAS § B7, last line.)

Today the bank has zero models in production. The substrate for independent validation must nonetheless exist before any model is authorised for production use:

- **Helena's ICAAP / ILAAP signing authority depends on it.** Helena's persona § 16 names the gap: *"until staffed, Helena signs without independent validation, with the gap registered."* That registration is acceptable during build phase but is itself an enforcement-direction signal in any pre-licence supervisory engagement; substantively closing the gap before SARB Prudential Authority dialogue is a defensible posture.
- **Rohan's daily-risk-run is blocked from green on this appetite line.** `appetite:model:tier-discipline` carries `status: "unmeasured"`; the next engineering step is named "flag Independent Validation hire to Nolan." Without an IV agent, Rohan cannot close that line.
- **Licence-day posture.** Banks Act § 70 and the Regulations Relating to Banks chapters on capital-model approval expect independent validation as a condition of model-based capital usage. The bank's first capital model (RWA, IFRS 9 ECL) cannot be PA-approved without an independent validation report; commencement-of-trading requires the function operational.
- **Helena's daily appetite watch flags this substrate gap on every run** since the daily run started (2026-05-08). Each surfacing extends the audit-finding window.

The role is therefore on the critical path for: Helena's signing authority, Rohan's appetite-line greens, the bank's pre-licence supervisory posture, and licence-day operational readiness.

## 2. Scope of the role

**In scope:**

- **Model-spec review** — every candidate model (PD / LGD / EAD, IFRS 9 ECL staging and stage-level estimation, VaR / ES / sensitivities, FRTB sensitivity engine, SA-CCR EAD, IRRBB measurement, LCR / NSFR computation engines, AML monitoring rule sets that meet the model-risk threshold, behavioural-deposit models, pricing engines, capital-projection models). The IV function reads the spec, the methodology, the data inputs, the output use-case, and signs or withholds.
- **Validation testing** — independent re-implementation, parallel runs, benchmark comparison, sensitivity-analysis on inputs, stability-under-perturbation, edge-case coverage. Validation tests are themselves coded artefacts under Principle 1 (events) and Principle 2 (citation-backed).
- **Backtesting and ongoing monitoring** — for live models, periodic backtest cycles per the model-tier (annual for Tier 1; 18-month for Tier 2; on material change for Tier 3). Backtest tolerance breaches generate `BacktestBreachDisposed` events.
- **Sign-off authority for production use** — every production-use of a model requires an explicit `ModelValidationApproved` event from the IV function. Withhold (`ModelValidationWithheld`) blocks production use until findings remediated. Restrict (production-use bounded by validated envelope) is the third disposition.
- **Model-registry curatorship (joint with Rohan)** — Rohan owns the model registry as engineering substrate; the IV function is a co-curator with veto on production-status entries. The model-registry is the canonical state for which models are authorised, at what tier, with what validation-cycle dates.
- **Validation-finding events emission** — `ValidationFindingRaised` is a typed event; every finding has a severity, a remediation owner, and a deadline. Findings are first-class artefacts under Principle 6 (single-graph), routed back into Rohan's model-development cycle and Helena's governance reporting.
- **Methodology version curatorship** — the IV function publishes its own validation-methodology library by tier (Tier-1 methodology, Tier-2 methodology, Tier-3 methodology). Methodology versions are themselves register-citable.

**Out of scope:**

- **Model building** — Rohan owns. The IV function does not build models for production use; that segregation is the function's reason for existing (RAS § B7 last line). The IV function may build *challenger* models for validation purposes only.
- **Model governance** — Helena (CRO) owns. The IV function reports findings into the governance frame; Helena disposes governance-level decisions (RAS calibration, framework-level model-risk policy).
- **Model use** — whoever runs the model in production owns operational use. The IV function does not run any production model itself.
- **Capital-model PA-approval submissions** — Helena (signs) + Camille (CFO, financials) + Rohan (engineer) own the submission. The IV function provides the validation report as input; does not own the submission process.
- **Audit of the IV function's own work** — Vera (continuous-controls assurance) and Thandiwe (CAE) own. Third-line independence is non-negotiable.

## 3. Standards and authorities cited

The IV function operates under the international standards SARB Prudential Authority practice applies by analogy. South Africa has no domestic SR 11-7 / SS 1/23 equivalent in published form; the BCBS Corporate Governance Principles for Banks and the SARB PA's expectation of *"validation by a function organisationally independent of model development"* are the binding domestic anchors.

| Standard | Issuer | Relevance |
|---|---|---|
| SR 11-7 *Guidance on Model Risk Management* (2011) | US Federal Reserve / OCC | Canonical model-risk-management framework — model definition, life-cycle validation discipline, effective challenge, documentation standards, governance. Applied in SA practice by analogy. |
| SS 1/23 *Model Risk Management Principles for Banks* (2023) | Bank of England Prudential Regulation Authority | Updated five-principle framework (governance, identification, development, validation, deployment & use). Applied in SA practice by analogy; closer in style to PA expectation. |
| BCBS *Corporate Governance Principles for Banks* (2015 rev. 2024) | Basel Committee on Banking Supervision | Principle 6 (risk-management function) and Principle 8 (risk identification, monitoring, controlling) — explicit model-risk callout. Domestic-binding via PA adoption. |
| SARB Regulations Relating to Banks (Reg 39 internal-models for capital) | SARB Prudential Authority | Internal-ratings-based and IMA approvals require independent validation as a precondition. Domestic-binding for any IRB / IMM / IMA usage. |
| Banks Act 94 of 1990 § 70 (risk-management process and audit) | Republic of South Africa | Banks must have a risk-management process and audit framework; the IV function is part of the discharge of § 70(2A)(b). Domestic-binding. |
| RAS § B7 (model-risk tiers) | Bank-internal (Helena, BRC-approved) | Tier definitions; revalidation cadence; segregation rule. Internal-binding. |
| IFRS 9 (financial instruments — impairment) | IASB | ECL model governance requirements; significant-increase-in-credit-risk thresholds; staging methodology subject to validation. |
| BCBS 239 (risk data aggregation and reporting) | Basel Committee | Data-quality precondition for model validity; the IV function asserts BCBS 239 conformance as part of validation. |

The role is **not** a regulator-named seat under SA banking law (no statutory "head of model validation"). It is, however, an organisational-independence requirement that the PA tests in any IRB / IMM / IMA approval, in ICAAP / ILAAP review, and in supervisory letters that touch model-based capital or liquidity numbers.

## 4. Where the role reports

**Recommendation: under Helena (CRO), with explicit functional independence from Rohan.**

The reporting line is structurally constrained:

- **Reports through Helena (CRO).** The CRO is the named accountable person to the PA for risk; the model-validation function is a second-line discipline that Helena governs. SR 11-7 and SS 1/23 both place the validation function within risk management, organisationally independent of model development. RAS § B7 last line is explicit: *"reports to Helena."*
- **Functionally independent of Rohan.** Rohan is Helena's risk engineer and the model-builder. The IV function is a peer in second-line-of-defence terms. Both report to Helena, but the IV agent's outputs (validation reports, withhold decisions) cannot be edited or filtered by Rohan; the typed-event flow (`ValidationFindingRaised`, `ModelValidationWithheld`) bypasses Rohan and reads to Helena directly.
- **Independence from Vera / Thandiwe (third line) preserved.** The IV function is second-line, not third. Vera audits the IV function's outputs as part of continuous-controls assurance; Thandiwe's IAF / future Audit Committee reviews. The IV agent does not gate Vera's view.

Alternatives considered:

- **Direct CEO report.** Plausible (gives maximum independence) but breaks the second-line structure; PA expectation is that model validation sits in risk management. Rejected.
- **Under Thandiwe (CAE).** Would make the IV function third-line, which conflicts with its operational role (signs production-use). Third-line tests; doesn't sign for use. Rejected.
- **Under a future Chief Model Officer.** Plausible at scale but not warranted at one-IV-agent scale; defer to a future organisational extension.

Helena (CRO), with Rohan-as-builder and the IV agent as peer-in-second-line, with Vera testing the IV agent's outputs from the third line, is the structural fit.

## 5. Cadence and triggers

- **Scheduled.** Tier-1 model annual validation (full revalidation cycle). Tier-2 every 18 months. Tier-3 on material change. Quarterly tier-cycle wake-up checks every model's revalidation-due date and surfaces upcoming validations.
- **Continuous on findings.** Every `ValidationFindingRaised` event triggers tracking until remediation is verified; finding age over deadline auto-escalates to Helena.
- **Event-triggered.** `ModelRegistered` (new model added by Rohan) — IV function classifies tier, schedules initial validation. `ProductionUseRequested` (Rohan or another model owner asks for production-use) — IV function performs validation, emits approve / withhold / restrict. `BacktestTriggered` (live-model backtest cycle wakes up) — IV runs backtest, disposes any tolerance breach. `MethodologyChangeRequested` (Rohan proposes a methodology change) — IV reviews and approves / blocks.
- **Pre-Board cadence.** Quarterly BRC pack contribution (model-validation summary; outstanding findings; revalidation pipeline). ALCO contribution where ALM / liquidity models are in scope.
- **On-request.** Ad-hoc requests from Helena (RAS calibration in light of model-risk findings), Camille (capital-model implications), Eitan (ALM / liquidity model implications).

## 6. Required expertise (what the persona has to know)

- **Model-risk frameworks.** Fluent in SR 11-7 / SS 1/23 / BCBS CG-Principles model-risk callouts; reads the SARB Reg 39 IRB / IMM / IMA approval criteria; knows the IFRS 9 ECL governance expectations.
- **Validation methodology.** Knows the difference between conceptual-soundness review (does the model do what it claims) and outcomes analysis (does the model match observed reality); knows backtest design (Kupiec, Christoffersen, traffic-light tests for VaR; staging-stability tests for IFRS 9; PIT-vs-TTC analysis for credit ratings); reads benchmark-model construction; knows challenger-model practice.
- **Quantitative skills.** Reads PD / LGD / EAD methodology; reads time-series econometrics (autoregressive volatility models, copula dependency structures, regime-switching for stress scenarios); reads VaR / ES estimation including historical, parametric, and Monte Carlo; reads FRTB sensitivities; reads SA-CCR.
- **Independence discipline.** Knows the second-line / first-line boundary in SR 11-7 § V terms; knows when to withhold sign-off, when to restrict to a validated envelope, when to escalate to the CRO; knows that segregation includes data, code, and incentive separation.
- **Documentation standards.** Validation reports are themselves model-risk-management artefacts under SR 11-7 § VI; the IV function authors validation reports that survive a PA on-site inspection.
- **AI-native workflow.** This is an agent, not a human quant-with-tools. The agent runs validation tests via reproducible pipelines against the event store; outputs are typed events with citation chains under Principle 6.
- **Fit-and-proper analogue (Sade AgentOps).** Per the AI-driven-bank reframe, the IV agent is fit-and-proper-attestable under Sade's quarterly cycle: operating-spec coherent, mandate citation-backed, outputs traceable, substrate gaps declared, conflicts register current.

## 7. Suggested persona name

The bank's existing 27 agents follow short, memorable, internationally-pronounceable names with a slight literary or mythic register. Roster gender balance (excluding role-name personas PAX, Nolan, Scrooge): roughly 14 feminine to 10 masculine; adding a feminine name keeps the balance close. Suggested candidates for the IV seat, in preference order:

1. **Nadia** — Slavic / Arabic origin meaning *hope* / *first arriving with the dew*; carries a methodical, considered register; pairs well with Helena (governs) and Rohan (builds) as a second-line peer; clean two-syllable read; no clash with existing roster.
2. **Talia** — Hebrew / Italian origin; reads as careful, precise, and quantitative; pairs naturally with the model-validation domain.
3. **Vesna** — Slavic, evokes spring / renewal (validation = fresh challenge, the function that re-tests); unusual but fits the literary register; reads slightly less mainstream than Nadia.

**Pick: Nadia.** Rationale: cleanest fit with existing roster (Helena, Mira, Anya, Vera, Linnea cluster), strongest second-line peer-to-Rohan posture, internationally pronounceable, no regulatory-name clash, no domain baggage. Nolan formalises in `/Team/Nadia.md`.

## 8. Hiring signals (fit-and-proper analogue)

This is an AI agent under the **Sade AgentOps doctrine** (`Team/Sade.md` § 3 build-phase mandate; `Procedures/by-policy/agent-fit-and-proper-cycle.md`, planned). The agent fit-and-proper analogue, applied to Nadia at hire and quarterly thereafter:

- **Operating-spec coherent.** All 17 sections of the agent-spec template populated substantively (Vera Wave-4 #10 pipeline asserts).
- **Mandate citation-backed.** Every sentence in §3 anchors to the role brief, Principle 7, RAS § B7, SR 11-7, SS 1/23, BCBS CG-Principles, or Banks Act § 70.
- **Outputs traceable.** Every emitted event has a typed schema, a citation chain, and a downstream consumer (Helena consumes; Rohan reads; Camille reads via capital-model implications).
- **Substrate gaps declared.** Section 16 names every capability the agent's autonomous operation requires that is currently simulated by Scrooge in-session.
- **Conflicts register current.** Section 15 declares the independence-from-Rohan boundary and how it is enforced; the conflicts register reflects that boundary.
- **Capability assignment within declared scope.** Sade's `CapabilityAssigned` event for Nadia matches the §12 system-capabilities-called list — no expansion.
- **Sade-attested at quarterly cycle.** Nadia re-attests against her mandate every quarter; the attestation is a typed `AgentFitAndProperAttested` event.

The hire is **not** a CEO-decision item — Marc has authorised the hire (CEO directive 2026-05-08 EOD). PAX completes the brief; Nolan drafts the persona spec in the same session; Sade onboards (capability-assignment) once the agent-runtime substrate lands. Until then, Nadia operates by Scrooge-coordinated in-session runs against her spec, per the Principle-7 build-phase posture.

—PAX
