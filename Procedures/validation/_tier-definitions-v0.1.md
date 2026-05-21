---
title: Validation methodology — tier definitions (v0.1)
author: Nadia
date: 2026-05-09
version: 0.1
status: locked-for-slice-A
decision-id: D-S7-TARGETED-3-5-OPEN-QUESTIONS
summary: Slice A of validation-methodology library v0. Locks the Tier-1 / Tier-2 / Tier-3 definitions, classification criteria, disambiguation rules at the boundaries, and the taxonomy of what counts as a "model" for tier purposes. Does not author per-tier methodology content (Slices C / E / F) and does not author the model-spec contract (Slice B). Anchors RAS § B7 as the binding tier definition for the build phase; codified Model Risk Policy is the named-but-deferred successor.
maps-to-decision-id: D-S7-TARGETED-3-5-OPEN-QUESTIONS
owner: Nadia (Independent model-validation engineer)
---

# Validation methodology — tier definitions (v0.1)

> **Slice A artefact.** This file locks the tier definitions, the classification criteria behind each tier, the disambiguation rules at the tier boundaries, and the taxonomy of what counts as a "model" for the validation-methodology library. It is the structural anchor that the per-tier methodology pages (`_methodology-tier-1.md`, future `_methodology-tier-2.md`, `_methodology-tier-3.md`) inherit from. Authority pack: sub-decision A of `D-S7-TARGETED-3-5-OPEN-QUESTIONS` (CEO-approved 2026-05-08, `Owner Inbox/2026-05-08_scrooge_ceo-decision-record_d-s7-targeted-3-5-open-questions.md`); scoping brief `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md`.

**Curator:** Nadia (Independent model-validation engineer; reports to Helena (CRO); functionally independent of Rohan)
**Status:** `locked-for-slice-A` — definitions are binding for the build phase. Supersession is a typed `ValidationMethodologyPublished` event with the next version label (v0.2 → forward).
**Authority chain (binds every section).**
- **RAS § B7** — `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` lines 136–144. Three-tier model-risk default; cited via `ORG-PR-21` in `Regulations/_obligations-register.md` (in force).
- **SR 11-7 §V (validation) + §VI (documentation)** — *Guidance on Model Risk Management*, US Federal Reserve / OCC, 2011. Effective challenge; conceptual-soundness review; outcome analysis; documentation artefact set. Referenced via `ORG-PR-21` (RAS B7 / SR 11-7 idiom).
- **SS 1/23 Principle 1** — *Model Risk Management Principles for Banks*, Bank of England PRA, 2023. Model identification and risk classification. `[citation: TBC — route to Mira; SS 1/23 not yet a typed obligations-register row, per scoping brief §5.5]`
- **BCBS *Corporate Governance Principles for Banks*** (2015 rev. 2024) Principles 6 + 8. Referenced via `ORG-GV-10` and `ORG-GV-18`.
- **Banks Act 94 of 1990 § 70(2A)(b)** — risk-management process and audit. `[citation: TBC — route to Mira for explicit sub-clause register row]`
- **CLAUDE.md Principle 2** — every action traces to a source; placeholders flagged `[citation: TBC]` resolve before publication of substantive Tier-N methodology pages.
- **CLAUDE.md Principle 2** — single-graph discipline; this file sits between RAS § B7 (appetite layer) and the per-tier methodology pages (substance layer).
- **CLAUDE.md Principle 6** — autonomous by default; the default actor at every tier-classification step is `agent:nadia`; escalation to `agent:helena` (CRO) per `Team/Nadia.md` §10.

**Slice scope.** This file is Slice A of the validation-methodology library v0 per `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §7.1. Slice B (model-spec contract co-authored with Rohan) and Slice C (Tier-1 methodology v0.1) are the immediate successors. This file does **not** author per-tier methodology content; it locks the structural definitions that those slices build on.

---

## 1. Tier definitions

The validation-methodology library has three tiers, mirroring RAS § B7. Each tier prescribes a **minimum** validation discipline; a model may always be validated more rigorously than its tier requires (a Tier-2 model may receive Tier-1 treatment if Nadia judges the rigour warranted), but never less rigorously.

### 1.1 Tier-1 — definition

| Field | Value |
|---|---|
| **Model classes (RAS § B7 examples)** | Regulatory capital RWA models; IFRS 9 ECL models; AML monitoring core models. |
| **Classification rule (binding criteria)** | A model is Tier-1 if it satisfies **any** of the four regulatory-consequence criteria in §2.1 below. |
| **Severity** | Highest. A Tier-1 model failure has direct regulatory, capital / liquidity, financial-statement, or AML consequences. |
| **Validation cadence — pre-deployment** | Independent validation **required** before any `ModelValidationApproved` event. Conceptual-soundness review alone is insufficient (SR 11-7 §V.1 effective challenge). |
| **Validation cadence — revalidation** | **Annual** full revalidation from last `ModelValidationApproved`. Trigger-driven partial revalidation on `MethodologyChangeRequested`, `ModelDriftDetected`, or `RiskPolicyChange` events affecting RAS § B7. |
| **Validation cadence — monitoring** | **Continuous** via the backtest harness (S7-Targeted item #4). Backtest breaches dispositioned within 10 working days. |
| **Who validates** | `agent:nadia` (independent of `agent:rohan`); functionally reports to `agent:helena` (CRO). Re-implementation runs in Nadia's pipeline against the event store; never inside Rohan's development environment. |
| **Evidence required (the SR 11-7 §VI artefact set)** | Model spec read; conceptual-soundness review; **independent re-implementation** for capital RWA + IFRS 9 ECL (scenario-based independent challenger for AML monitoring core); parallel-run report; benchmark report; challenger report; sensitivity-analysis report; edge-case coverage report; BCBS 239 conformance assertion; findings register at point-in-time; disposition with envelope (where `restrict-to-validated-envelope`); full citation chain. Report survives a SARB Prudential Authority on-site inspection. |
| **Disposition authority** | Nadia (per `Team/Nadia.md` §9): `approve` → `ModelValidationApproved`; `withhold` → `ModelValidationWithheld`; `restrict-to-validated-envelope` → `ModelValidationApproved` with `envelope` field per `ProductionUseBoundary` schema (S7-Targeted slice 5). |
| **RAS § B7 anchor** | RAS § B7 row 1 (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` line 140). |
| **Methodology page** | `Procedures/validation/_methodology-tier-1.md` — substantive content authored as Slice C (already landed via PR #25). |

### 1.2 Tier-2 — definition

| Field | Value |
|---|---|
| **Model classes (RAS § B7 examples)** | Pricing engines; risk sensitivities (incl. FRTB sensitivity engines); behavioural-deposit models. |
| **Classification rule (binding criteria)** | A model is Tier-2 if it satisfies **any** of the three commercial-consequence criteria in §2.2 below **and does not** satisfy any Tier-1 criterion. |
| **Severity** | Material. A Tier-2 model failure has direct commercial / risk-management consequence (mispricing; misattribution of risk; misforecast of liquidity behaviour) but does **not** directly enter a regulatory submission, capital ratio, financial-statement provision, or AML decision. |
| **Validation cadence — pre-deployment** | Independent validation **required** before any `ModelValidationApproved` event. Re-implementation is **not** mandatory at Tier-2; conceptual-soundness review + sensitivity analysis + benchmark-or-challenger (one of the two) is the minimum. |
| **Validation cadence — revalidation** | **Biennial** (every 24 months) full revalidation from last `ModelValidationApproved`, calibrated to RAS § B7 (note: the scoping brief uses "18-month"; RAS § B7 line 141 says "biennial"; the binding text is RAS § B7 — biennial). Trigger-driven partial revalidation on `MethodologyChangeRequested`, `ModelDriftDetected`. |
| **Validation cadence — monitoring** | Periodic via the backtest harness; cadence per model class (per Tier-2 methodology, Slice E). |
| **Who validates** | `agent:nadia`; functionally reports to `agent:helena`. |
| **Evidence required** | Model spec read; conceptual-soundness review; sensitivity-analysis report; benchmark **or** challenger report (both not required at Tier-2); edge-case coverage report; BCBS 239 conformance assertion; findings register at point-in-time; disposition. Documentation standard is SR 11-7 §VI proportionate (full report; not all artefacts of the Tier-1 set are required). |
| **Disposition authority** | Nadia. Same disposition events as Tier-1. |
| **RAS § B7 anchor** | RAS § B7 row 2 (line 141). |
| **Methodology page** | `Procedures/validation/_methodology-tier-2.md` — `PLANNED` (Slice E). |

> **Cadence reconciliation note.** The scoping brief §1 names Tier-2 revalidation as "18-month"; RAS § B7 line 141 names "biennial". RAS § B7 is the higher-authority document (CEO-approved appetite). This file binds **biennial** as the Tier-2 default and routes the inconsistency in the scoping brief as a non-substantive editorial fix. The Tier-2 methodology page (Slice E) will inherit "biennial" from this file.

### 1.3 Tier-3 — definition

| Field | Value |
|---|---|
| **Model classes (RAS § B7 examples)** | Operational analytics; customer-segmentation; non-decisioning models. |
| **Classification rule (binding criteria)** | A model is Tier-3 if it satisfies **none** of the Tier-1 criteria and **none** of the Tier-2 criteria, and its outputs are **either** human-reviewed before action **or** strictly informational (no automated downstream consumption). See §2.3. |
| **Severity** | Lower. A Tier-3 model failure has indirect or contained consequences; outputs are informational or pass through a human gate before driving a decision. |
| **Validation cadence — pre-deployment** | **Internal review** by Nadia is sufficient (no full independent validation cycle). Conceptual-soundness review + sample-output audit. |
| **Validation cadence — revalidation** | **On material change** only — i.e. on `MethodologyChangeRequested` or `ModelDriftDetected`. No fixed calendar revalidation. |
| **Validation cadence — monitoring** | **Sample audit** — Nadia samples outputs per cadence specified in the Tier-3 methodology (Slice F). No continuous backtest. |
| **Who validates** | `agent:nadia`; functionally reports to `agent:helena`. Nadia may delegate the sample-audit step to Vera's continuous-controls assurance pipeline once Wave-4 #11 lands; pre-delegation, Nadia performs directly. |
| **Evidence required** | Model spec read; conceptual-soundness review; sample-output audit report; findings register at point-in-time; disposition. Documentation is materially shorter than Tier-1 / Tier-2 — the report is the audit record. |
| **Disposition authority** | Nadia. Same disposition events as Tier-1 / Tier-2 for consistency, even though Tier-3 dispositions are typically `approve` (the `restrict-to-validated-envelope` pathway is rarely needed at Tier-3 because outputs are not directly consumed). |
| **RAS § B7 anchor** | RAS § B7 row 3 (line 142). |
| **Methodology page** | `Procedures/validation/_methodology-tier-3.md` — `PLANNED` (Slice F). |

---

## 2. Classification criteria (the rule behind the examples)

RAS § B7 names the tiers by **example** (capital RWA, pricing engines, operational analytics). This section codifies the classification **rule**: the dimensions on which a model is classified, with the regulatory and commercial logic that places a candidate into Tier-1 / Tier-2 / Tier-3. Per scoping brief §4.2, this is the rule the Model Risk Policy will eventually carry; until that policy lands (`Owner Inbox/2026-05-06_policy-register.md` lists Model Risk Policy as `PLANNED`, B7 approved), this section is the binding classification rule.

### 2.1 Tier-1 criteria — any one is sufficient

A model is **Tier-1** if **any** of the following criteria applies to its outputs:

| Criterion | Description | Anchoring authority |
|---|---|---|
| **C1.1 — Regulatory submission** | An output appears in a regulatory submission (BA returns; IFRS-disclosed numbers; FATCA / CRS XML; PA stress-test submissions; ICAAP / ILAAP packs). | Banks Act § 70(2A)(b) `[citation: TBC]`; Reg 39 (internal-models capital approval) `[citation: TBC — route to Mira for explicit Reg 39 register row]`; IFRS 9 §5.5 (cited via `ORG-AC-02`). |
| **C1.2 — Capital / liquidity ratio** | An output enters a capital ratio (CET1, AT1, T2, leverage) or a liquidity coverage computation (LCR, NSFR). | `ORG-PR-01` to `ORG-PR-08` (capital + liquidity prudential obligations); BCBS Basel III `[citation: TBC — output floor adoption status]`. |
| **C1.3 — Financial-statement provision** | An output enters an audited financial statement balance — staging-driven ECL provisions, fair-value-through-P&L marks where the model produces the mark, derivative valuation adjustments where the model produces the adjustment. | IFRS 9 §5.5; IFRS 13 (fair-value measurement) `[citation: TBC — IFRS 13 register row]`; `ORG-AC-02`. |
| **C1.4 — AML / financial-crime decision** | An output drives an automated AML decision — transaction-monitoring alert generation; sanctions screening; PEP detection; STR / CTR / TPR triage. | FIC Act ss.21–28 (cited via `ORG-FC-01` / `ORG-FC-02` / `ORG-FC-07` / `ORG-FC-09`); FATF Recommendation 10 (`ORG-FC-02`); FIC GN 7 (`ORG-FC-03` / `ORG-FC-06`). |

If the model satisfies any of C1.1 — C1.4, it is Tier-1, regardless of how "small" or "non-critical" it appears. The rule is conservative on purpose.

### 2.2 Tier-2 criteria — any one is sufficient (and no Tier-1 criterion applies)

A model is **Tier-2** if **no Tier-1 criterion applies** and **any** of the following applies:

| Criterion | Description | Anchoring authority |
|---|---|---|
| **C2.1 — Customer / counterparty / trade pricing** | An output drives the price the bank quotes a customer or counterparty, or the price at which a trade is executed (pricing engine for OTC quotes; benchmark fixings the bank consumes for execution; quote-engine outputs to FIX clients). | `ORG-PR-19` (FRTB market-risk standard — pricing inputs); SS 1/23 Principle 1 `[citation: TBC]`. |
| **C2.2 — Risk sensitivities (non-capital-bound)** | An output produces risk sensitivities that drive **internal** risk-management decisions but do **not** themselves enter a capital ratio or BA-return cell — internal greeks for trader-level risk; intraday-rebalance triggers; pre-trade VaR estimates that gate trade execution but are not the regulatory VaR. | `ORG-PR-19`; `Team/Rohan.md` §16 (FRTB-sensitivity engines mid-build). |
| **C2.3 — Behavioural / forecast model driving asset-liability decisions** | An output forecasts customer behaviour (deposit decay; prepayment; drawdown rate) and drives an internal asset-liability management decision but is not itself the regulatory liquidity computation. | `ORG-PR-11` (IRRBB); `ORG-PR-15` (sound liquidity-risk management); BCBS D368 `[citation: TBC for explicit row]`. |

### 2.3 Tier-3 criteria — neither Tier-1 nor Tier-2, and either §2.3.A or §2.3.B applies

A model is **Tier-3** if **no Tier-1 or Tier-2 criterion applies** and **either**:

- **§2.3.A — Human-reviewed before action.** A named human reviews every output of the model before any action follows (e.g. an LLM-assisted draft of a clause that Imani approves before binding; a customer-segmentation cluster that a marketing manager reviews before campaign launch). The human review is documented and auditable — Vera's recon (Wave-4 #11) will assert reviewer-presence at audit time.
- **§2.3.B — Strictly informational.** The output is consumed by humans for situational awareness only and never feeds an automated downstream system (operational dashboards, MI-pack analytics, exploratory data-science outputs surfaced to Helena's BRC). "Never feeds an automated downstream" is verifiable by Anya's data-contracts catalogue: no consumer is named.

If neither §2.3.A nor §2.3.B applies, the model defaults to Tier-2 (commercial-consequence assumption) and the scope review is escalated to Helena per §3.4.

---

## 3. Disambiguation rules at the boundaries

The classification rule in §2 is conservative but cannot eliminate every borderline case. This section codifies the disambiguation rules.

### 3.1 Tier-1 vs Tier-2 — the boundary

The Tier-1 / Tier-2 boundary is **regulatory consequence**. If an output enters a regulatory submission, capital ratio, financial statement, or AML decision (any one of C1.1 — C1.4), the model is Tier-1 — even if its primary use is internal pricing or risk management.

**Worked examples (binding):**

| Candidate | Primary use | Other consumers | Tier | Rationale |
|---|---|---|---|---|
| FRTB sensitivity engine | Internal risk management of the trading book | Output flows into BA-325 market-risk cells | **Tier-1** | C1.1 (regulatory submission) applies via the BA-325 consumer; primary internal use does not override. |
| OTC IRD pricing engine — bank's own quotes | Customer-quote generation | None (quote is the price; not a sensitivity feed) | **Tier-2** | C2.1 applies; no Tier-1 criterion. |
| OTC IRD pricing engine — same engine, but its output also feeds the daily fair-value mark of the trading-book derivative inventory | Customer-quote generation | Mark-to-market of the trading-book inventory feeds IFRS 9 fair-value-through-P&L | **Tier-1** | C1.3 (financial-statement provision) applies via the fair-value mark consumer. |
| IFRS 9 PD model | ECL stage classification | None | **Tier-1** | C1.3 directly. |
| Behavioural-deposit decay model | IRRBB internal management | None (does not enter the regulatory NSFR computation; SARB Reg uses standardised behavioural assumptions for NSFR; the model is bank-internal) | **Tier-2** | C2.3 applies; the standardised-NSFR-assumption split shields this from Tier-1. |
| Behavioural-deposit decay model — variant where SARB has approved bank-specific behavioural assumptions for NSFR computation | NSFR computation | None | **Tier-1** | C1.2 applies; bank-specific behavioural assumption enters the regulatory liquidity ratio. |
| Customer-segmentation model | Marketing campaign targeting | Reviewed by marketing manager before campaign launch | **Tier-3** | §2.3.A applies. |
| Customer-segmentation model — variant feeding automated credit-decisioning | Credit-decisioning | None human in loop | **Tier-1** | C1.4-adjacent (decisioning; if it determines the customer's contractual outcome, it is at minimum Tier-2 by C2.1; if combined with FIC enhanced-due-diligence triggers, Tier-1 by C1.4). Boundary case: escalate per §3.4 if EDD-triggering. |
| AML rule-engine — single rule, low-volume, advisory output reviewed by MLRO before STR filing | AML triage | MLRO reviews | **Tier-1** | C1.4 applies. The MLRO review is part of the FIC Act discipline; it does not downgrade the model from Tier-1. The rule-engine *output* is the input to the FIC-mandated decision; the MLRO is the actor; the model is the engine being validated. (Distinct from §2.3.A's "human reviews and that's the end of the story" — here the human review is itself the regulatory step, and the model still drives it.) |

### 3.2 Tier-2 vs Tier-3 — the boundary

The Tier-2 / Tier-3 boundary is **whether the output feeds an automated downstream**. If a human reviews and signs off every output before any action, Tier-3. If even one downstream consumer is automated and reads the output without a human gate, Tier-2 by default (and possibly Tier-1 if any §2.1 criterion applies).

**Worked examples (binding):**

| Candidate | Tier | Rationale |
|---|---|---|
| Operational MI dashboard regression | **Tier-3** | Strictly informational (§2.3.B). |
| Same dashboard, but the regression output drives an automated alert that pages an on-call SRE | **Tier-2** | Automated downstream consumer (the alerting system); §2.3.B fails. The alert action does not have customer-pricing or risk-management direct consequence per §2.2; but the rule is conservative — defaults to Tier-2 because an automated consumer exists. The methodology owner (Nadia) may downgrade to Tier-3 with documented justification if the alert is purely operational and bears no Tier-2 consequence; default is Tier-2. |
| LLM-assisted clause drafter (Imani's pipeline) | **Tier-3** | §2.3.A applies — Imani reviews every drafted clause before binding. |
| Same LLM, but auto-publishing draft clauses into the clause library without a review step | **Tier-2 / Tier-1** | §2.3.A fails; depending on whether the clause-library output feeds an automated contract-binding decision (Tier-1 by C1.4-adjacent if it drives ECTA-bound electronic contracting), or merely an internal reference (Tier-2 by C2.1 if pricing-related). Escalation per §3.4 likely. |

### 3.3 Build-phase synthetic-position carve-out

Per sub-decision A.2 of `D-S7-TARGETED-3-5-OPEN-QUESTIONS`: in the build phase (no real customers, no real trading), every model classified as Tier-1 / Tier-2 runs against synthetic positions and emits validation findings as **advisory** — no `ModelValidationApproved` events emit until first real-position consumption. The tier classification itself is not paused — Nadia performs `ModelTierClassified` against this file's criteria for every `ModelSubmitted` event in the build phase. The **classification** is real and binding from day one; the **disposition events** activate at first real-position consumption per `project_rules_bind_at_commencement`.

### 3.4 Novel model class — escalation rule

If a candidate model does not fit any of the worked examples in §3.1 / §3.2 and the application of the §2 criteria is genuinely ambiguous, Nadia escalates to Helena per `Team/Nadia.md` §10 ("Novel model class outside existing tier definitions") **before** issuing a `ModelTierClassified` event. The escalation:

- Carries the candidate, the §2 criteria evaluation, and Nadia's recommended tier.
- Routes to Helena (Chief Risk Officer).
- Is sealed if the candidate is itself sensitive (e.g. an AML-typology-detection model whose existence the bank does not advertise).
- Resolution lands as a binding precedent — added to the worked-example tables in §3.1 / §3.2 in a future v0.N revision of this file.

---

## 4. What counts as a "model" for tier purposes

The classification rule in §2 presumes a definition of "model" that is broader than "code that produces a number from inputs". This section locks the taxonomy.

A **model** is, for the purposes of this library:

> A quantitative method, statistical method, or rule-based algorithm that produces an output (numeric, categorical, or boolean) from input data, where the output is **consumed by a downstream actor (human or automated)** and the **bank relies on the output for a decision, valuation, classification, or report.**

This definition tracks SR 11-7's definition of "model" (any quantitative method, system, or approach that applies statistical, economic, financial, or mathematical theories and assumptions to process input data into quantitative estimates) and SS 1/23 Principle 1 (model identification — "any quantitative method, system, or approach"). `[citation: TBC — SR 11-7 §I and SS 1/23 Principle 1 explicit register rows; route to Mira]`

### 4.1 In scope (a "model" for tier purposes)

- **Statistical and ML models.** Regressions, GLMs, time-series models, neural networks, gradient-boosted trees, clustering, classification, regime-switching models, copula-based dependency models, autoregressive volatility models.
- **Deterministic quantitative methods.** Closed-form pricing formulas (Black-Scholes; HJM); analytical IRB capital calculators; analytical duration / convexity computations; deterministic stress-application kernels.
- **Rule-based algorithms.** AML transaction-monitoring rule engines; sanctions-screening match algorithms; PEP-detection rule sets; staging classification rules in IFRS 9 (where SARB Directive 5/2017 elections drive a rule set rather than a statistical model). `[citation: TBC — SARB Directive 5/2017]`
- **Hybrid systems.** Pricing engines that combine deterministic formulas with statistical calibration (vol surface fitting; PD-curve calibration); ML-assisted alert-generation engines that combine deterministic rules with statistical scoring.
- **LLM-assisted decisioning.** Where an LLM produces an output that drives a decision, the LLM is a "model" for tier purposes. The validation discipline at Tier-1 / Tier-2 / Tier-3 applies; the methodology pages will specify how the seven validation dimensions instantiate for LLM-assisted models (Slice C+ work). `[citation: TBC — BCBS / SARB guidance on AI-assisted models is emerging; route to Mira for tracking]`

### 4.2 Out of scope (not a "model" for tier purposes)

- **Pure data-transformation pipelines.** ETL / ELT; format conversion; record-de-duplication driven by exact-match keys; aggregation queries (SUM, COUNT, AVG over the event store with no statistical inference). These are **data engineering**, not models. Anya's data-contracts catalogue governs them.
- **Reporting layouts.** A BA-return formatter that maps named quantities into the regulator's XML schema is not a model — it is a renderer (Principle 2 downward). The named quantities themselves are model outputs (where applicable) and are validated as Tier-1 candidates.
- **Static configuration.** Threshold tables hand-set by Helena's policy-approval that the rule engine reads — the table is a policy artefact, not a model; the rule engine that consumes the table is the model.
- **Software bugs.** A coding error in a validated model is a software defect, not a model risk; remediation routes through Atlas's defect-remediation process, not Nadia's revalidation cycle. (A defect *discovered through validation* may still trigger a `ValidationFindingRaised` event under Nadia's discipline — the validation discipline catches the bug; the bug fix is engineering's.)

### 4.3 Boundary cases

| Candidate | Model? | Tier consequence |
|---|---|---|
| A SQL view that joins three event-store projections to produce a "current obligor exposure" number consumed by the RWA computation | **Not a model** — pure data transformation. | But the **RWA computation** that consumes it is Tier-1 by C1.2; the SQL view's correctness is part of the BCBS 239 risk-data-aggregation precondition Nadia asserts at Tier-1 validation. |
| A SQL view with a CASE statement that classifies obligors into rating buckets based on hand-set thresholds | **Borderline** — if the thresholds are policy-approved (a static configuration), the view is not a model; if the thresholds are statistically calibrated and refit periodically, the calibration is a model. | Refer to §3.4 (escalation) if ambiguous. |
| A spreadsheet macro that an analyst uses for ad-hoc analysis of a portfolio | **Not a model** for tier purposes — but it should not be driving any C1.1 — C1.4 decision. If it is, the spreadsheet is a Tier-1 model and the bank has an unregistered Tier-1 model, which is itself a finding. | EUC (end-user computing) discipline — separate from this library; routes through Vera's continuous-controls assurance for unregistered-model detection (Wave-4 #11+ planned). |

---

## 5. Procedure-pair binding

Per CLAUDE.md Principle 2, this file sits in the upward chain Reg → Policy → Procedure → System Capability:

- **Regulation** — SR 11-7; SS 1/23; BCBS CG-Principles; Banks Act § 70(2A)(b); Reg 39; FIC Act ss.21–28; IFRS 9 §5.5.
- **Policy** — Model Risk Policy (`PLANNED` per `Owner Inbox/2026-05-06_policy-register.md`); RAS § B7 binds in the interim.
- **Procedure** — `Procedures/by-policy/model-validation.md` (the **cycle**, owner Helena per `Procedures/_index.md` line 27, status `PLANNED`); `Procedures/validation/_methodology-tier-N.md` (the **substance**, owner Nadia).
- **System capability** — `prototype/platform/model-registry/registry.ts`; `prototype/platform/event-store/event-types.ts` (typed events); the backtest harness (S7-Targeted item #4); the pre-trade gateway (S7-Targeted item #5 with `ProductionUseBoundary` envelope); Vera's continuous-controls recon pipelines (Wave-4 #11+).

This file is the **substance-side anchor** for the procedure-pair: the cycle (Helena's procedure) calls into the methodology library (Nadia's substance) at every validation step. Helena's cycle procedure is `[awaiting Helena: procedure-pair completion per follow-on route]` per the CEO decision record's follow-on routes to `agent:Helena`.

The methodology library register at `Procedures/validation/_index.md` already records this pairing; this file reaffirms it and locks the tier definitions the per-tier methodology pages inherit.

---

## 6. Substrate gaps surfaced by Slice A

| # | Gap | Owner | Blocks | Status |
|---|---|---|---|---|
| 1 | Model Risk Policy with codified tier-classification rules | Helena (with Nadia input) | First novel-model-class candidate. Methodology defers to the §2 criteria of this file until the policy lands. | `PLANNED` per policy register |
| 2 | Helena's cycle procedure `Procedures/by-policy/model-validation.md` | Helena | Canonical cycle orchestration; methodology pages run inline-from-self until cycle lands. | `PLANNED` per `Procedures/_index.md` line 27 |
| 3 | Model-spec contract (Slice B) | Rohan + Nadia (co-authored) | "Model spec read" step in every methodology page; without it, validation is structurally weak. | Slice B follow-up; Rohan-side cadence below |
| 4 | Obligations-register entries for SR 11-7 §I, SS 1/23 Principle 1, Banks Act § 70(2A)(b), Reg 39 explicit row, IFRS 13, BCBS Basel III output floor adoption status, SARB Directive 5/2017 | Mira | Citation-chain closure for Slices C / E / F. Slice A binds with `[citation: TBC]` markers per CLAUDE.md Principle 2 (no invented citations). | Mira S3 follow-on per scoping brief §5.5 |
| 5 | Vera continuous-controls recon for unregistered models (per §4.3 boundary cases) | Vera | Detection of EUC / spreadsheet-driven models that meet C1.1 — C1.4 but lack a `ModelSubmitted` event. | Wave-4 #11+ |
| 6 | `ProductionUseBoundary` schema | Atlas + Nadia + Kai | `restrict-to-validated-envelope` typed envelope; pre-trade gateway envelope enforcement. | S7-Targeted slice 5 |

Gaps 1, 2, 4 are the load-bearing dependencies for substantive methodology authoring in Slices C / E / F; Slice A itself is **not** blocked by them — Slice A is the structural anchor that those slices will inherit from.

---

## 7. Slice cadence — what comes next after Slice A

| Slice | Scope | Owner | Dependency |
|---|---|---|---|
| **A — locked here** | Tier definitions, classification criteria, disambiguation, model taxonomy. | Nadia | None — this file is independent. |
| **B — model-spec contract** | The seven dimensions + frontmatter contract for `prototype/platform/risk/model-specs/<modelId>-spec.md` that Rohan submits at every `ModelSubmitted`. | Nadia + Rohan (co-authored — Rohan's input on Tier-1 dimensions is load-bearing) | Slice A. **Rohan is gated on Slice A landing** per CEO follow-on route. |
| **C — Tier-1 methodology v0.1** | Substantive Tier-1 methodology; seven dimensions worked through; per-class test catalogue (capital RWA, IFRS 9 ECL, AML monitoring core). | Nadia | Slices A + B; **already landed via PR #25** as `Procedures/validation/_methodology-tier-1.md`. v0.1 may be patched in a v0.2 minor revision once Slice A's locked definitions are reconciled with the Tier-1 page content. |
| **D — procedure-pair completion** | Helena authors `Procedures/by-policy/model-validation.md` (the cycle) at minimum-viable depth. | Helena | Slice A (this file) gives Helena the substance-side anchor to call into. |
| **E — Tier-2 methodology v0.1** | Substantive Tier-2 methodology; pricing engines, FRTB sensitivities, behavioural-deposit. | Nadia | Slices A + B; ideally after D. |
| **F — Tier-3 methodology v0.1** | Substantive Tier-3 methodology; minimum-viable depth (sample-audit + on-material-change revalidation). | Nadia | Slices A + B; ideally after D. |

**Slice B model-spec contract co-author cadence with Rohan.** Per CEO follow-on routes (`Owner Inbox/2026-05-08_scrooge_ceo-decision-record_d-s7-targeted-3-5-open-questions.md`), Rohan's backtest-harness work is gated on Nadia's methodology v0 — and conversely Slice B is gated on Slice A landing. The handshake: Slice A lands (this PR); Nadia drafts the model-spec contract template at `prototype/platform/risk/model-specs/_template.md` (the template already exists at PR #20 per the Tier-1 page §227 — Slice B reconciles with the existing template and is not a fresh authoring pass); Rohan reviews and the contract becomes binding on next `ModelSubmitted`. Target cadence: one session co-author pass between Nadia and Rohan, sequenced after this PR merges and before any further Tier-N methodology version-up.

---

## 8. Authority — full citation chain

- **RAS § B7** — `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` lines 136–144. The three-tier model-risk default; binding tier definition for the build phase. Cited via `ORG-PR-21` (`Regulations/_obligations-register.md`).
- **SR 11-7** — *Guidance on Model Risk Management*, US Federal Reserve / OCC SR Letter 11-7 / OCC Bulletin 2011-12, 2011. §I (definition of "model"); §V (validation); §VI (documentation). Referenced via `ORG-PR-21` (RAS B7 / SR 11-7 idiom; in force). Explicit register row `[citation: TBC — Mira S3]`.
- **SS 1/23** — *Model Risk Management Principles for Banks*, Bank of England Prudential Regulation Authority, May 2023. Principle 1 (model identification); Principle 4 (model documentation and version control). `[citation: TBC — Mira S3]`
- **BCBS *Corporate Governance Principles for Banks*** (2015 rev. 2024) Principles 6 + 8. Referenced via `ORG-GV-10` (board-approved risk-management framework) and `ORG-GV-18` (effective second line) — verify exact register-row IDs before publication of dependent slices.
- **Banks Act 94 of 1990 § 70(2A)(b)** — risk-management process and audit. `[citation: TBC — Mira S3, explicit sub-clause register row]`
- **SARB Regulations Relating to Banks Reg 39** — internal-models capital approval pathway (IRB / IMM / IMA). `[citation: TBC — Mira S3, explicit register row]`
- **IFRS 9 §5.5** — expected credit losses. Cited via `ORG-AC-02`.
- **IFRS 13** — fair-value measurement. `[citation: TBC — Mira S3]`
- **FIC Act 38/2001 ss.21–28** — risk-based-approach CDD; CTR / STR / PAR. Cited via `ORG-FC-01` / `ORG-FC-02` / `ORG-FC-07` / `ORG-FC-09`.
- **FATF Recommendation 10** — CDD risk-based approach. Cited via `ORG-FC-02`.
- **FIC GN 7** — risk-based approach guidance. Cited via `ORG-FC-03` / `ORG-FC-06`.
- **Decision record** — `Owner Inbox/2026-05-08_scrooge_ceo-decision-record_d-s7-targeted-3-5-open-questions.md` (sub-decision A approved as drafted).
- **Scoping brief** — `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §1, §4, §7.1 (Slice A scope; tier examples; sequencing).
- **CLAUDE.md Principle 2** — every action traces to a source; placeholders flagged `[citation: TBC]` resolve before publication of dependent slices (C / E / F).
- **CLAUDE.md Principle 2** — single-graph discipline; Slice A is the structural anchor of the upward chain Reg → Policy → Procedure → System Capability for model validation.
- **CLAUDE.md Principle 6** — autonomous by default; the default actor at every classification step is `agent:nadia`; escalation channel typed to `agent:helena` per `Team/Nadia.md` §10.

---

## 9. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Nadia (via Scrooge) | Slice A authored. Locks Tier-1 / Tier-2 / Tier-3 definitions, classification criteria (§2.1 / §2.2 / §2.3), disambiguation rules at the boundaries (§3.1 / §3.2 / §3.3 / §3.4), and the taxonomy of what counts as a "model" for tier purposes (§4). Anchors RAS § B7 as the binding tier definition for the build phase; Model Risk Policy named as deferred-but-named successor. Reconciles a cadence inconsistency: Tier-2 revalidation is **biennial** per RAS § B7 (the scoping brief's "18-month" is a non-substantive editorial drift; this file binds biennial). Procedure-pair partner reference recorded (Helena's `Procedures/by-policy/model-validation.md` cycle, `PLANNED`). Substrate gaps inventoried (§6); slice cadence to Slices B / C / D / E / F named (§7). All citations marked `[citation: TBC]` where the obligations-register row is pending Mira S3; no invented citations per CLAUDE.md Principle 2. |

—Nadia
