---
title: Validation methodology — Tier-2 (v0.1)
author: Nadia
date: 2026-05-27
version: 0.1
status: populated
decision-id: D-PRODUCT-CONSTRUCTION-SLICES-4-8
summary: Tier-2 validation methodology covering pricing engines, risk sensitivities, and behavioural-deposit models. Seven validation dimensions specified; Tier-2 proportionate validation (conceptual soundness + sensitivity analysis + benchmark or challenger, one required); approval expiry 18 months; revalidation triggers on MethodologyChangeRequested, ModelDriftDetected, and material parameter change.
decision-required: false
maps-to-decision-id: D-PRODUCT-CONSTRUCTION-SLICES-4-8
tier: 2
inherits-from-policy: model-risk-policy
inherits-from-definitions: _tier-definitions-v0.1.md
last-published: 2026-05-27
owner: Nadia (Independent model-validation engineer)
published-as-event: ValidationMethodologyPublished
---

# Validation methodology — Tier-2 (v0.1)

> **Specification, not tutorial.** Read by Nadia at every Tier-2 validation, by Vera as the recon input for the validation-cycle pipeline, by Helena as the BRC challenge reference, by Rohan as the input requirement at submission. The seven dimensions and the disposition framework below are the contract. Versioned forward; supersession is a typed `ValidationMethodologyPublished` event with the next version label.

**Authority chain (binds every section).** RAS § B7 (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` lines 136–144), row 2 — pricing engines, risk sensitivities, behavioural-deposit models; SR 11-7 §V (validation — proportionate application to internal models with commercial but not direct-regulatory consequence) + §VI (documentation), *Guidance on Model Risk Management*, US Federal Reserve / OCC, 2011; SS 1/23 Principle 4 (model documentation and version control), Bank of England PRA, 2023; BCBS *Corporate Governance Principles for Banks* (2015 rev. 2024) Principles 6 + 8. Per-section additional citations as marked. Citations not yet in `Regulations/_obligations-register.md` are flagged `[register: route to Mira]` per the obligations-register gap-closure posture (`Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §5.5).

**Published-as-event.** `ValidationMethodologyPublished` is typed per the model-risk event-types module. The first event for this v0.1 methodology emits at first model-validation run governed by it (build-phase posture: synthetic positions only; no `ModelValidationApproved` until first real-position consumption for Tier-1 models; for Tier-2, the seed emits idempotently as methodology publication, not as validation approval).

---

## 1. Scope

### 1.1 Coverage

This methodology applies to every model classified as Tier-2 under RAS § B7 and `Procedures/validation/_tier-definitions-v0.1.md` §1.2. The Tier-2 model classes per `_tier-definitions-v0.1.md` §1.2:

- **Pricing engines.** Any model that drives the price the bank quotes to a customer or counterparty, or the price at which a trade is executed (OTC IRD pricing engine for ZAR quotes; benchmark-fixing consumer for execution; quote-engine outputs to FIX clients). The Tier-2 boundary applies where the pricing engine output does **not** also feed an audited financial-statement mark (if it does, Criterion C1.3 promotes the model to Tier-1).
- **Risk sensitivities (non-capital-bound).** Any model that produces risk sensitivities driving internal risk-management decisions but does **not** directly enter a capital ratio or BA-return cell — internal Greeks for trader-level risk; intraday-rebalance triggers; pre-trade VaR estimates that gate trade execution but are not the regulatory VaR.
- **Behavioural-deposit models.** Any model that forecasts customer behaviour (deposit decay; prepayment; drawdown rate) and drives an internal asset-liability management decision but is not itself the regulatory liquidity computation (where bank-specific behavioural assumptions are SARB-approved for NSFR computation, the model is promoted to Tier-1 by Criterion C1.2).

A model is in scope if **any** of the three RAS § B7 commercial-consequence criteria (C2.1, C2.2, C2.3 in `_tier-definitions-v0.1.md` §2.2) applies and **no** Tier-1 criterion applies. Boundary cases escalate to Helena per `_tier-definitions-v0.1.md` §3.4.

### 1.2 Cadence

- **Pre-deployment.** Independent validation required before any `ModelValidationApproved` event. Conceptual-soundness review alone is not sufficient at Tier-2; sensitivity analysis and at least one of benchmark or challenger is required.
- **18-month revalidation.** Full re-application of this methodology every 18 calendar months from the last `ModelValidationApproved` per model.

  > **Cadence note.** The tier-definitions file (`_tier-definitions-v0.1.md` §1.2) notes a reconciliation between the scoping brief (18-month) and RAS § B7 line 141 (biennial). This methodology adopts **18 months** as the more conservative default — in line with the scoping brief and the build-phase posture — and routes the residual inconsistency as a non-blocking note to Helena for alignment when the Model Risk Policy lands.

- **Trigger-driven re-runs.** `MethodologyChangeRequested` (Rohan), `ModelDriftDetected` (Rohan's monitoring), and material parameter change events each trigger a partial revalidation within the SLA in `Team/Nadia.md` §7.

---

## 2. Pre-validation requirements

Before Nadia begins a Tier-2 validation cycle, two event preconditions must be satisfied in the event store:

1. **`ModelSubmitted` must exist** for the model under review with the expected `modelId` and `version`. Nadia's registry call `registry.list()` confirms presence; if absent, validation cannot proceed and Nadia returns the model to Rohan for resubmission.
2. **`ModelTierClassified` must exist** for the model, with `tier: 2`. If the model is submitted at tier 2 but Nadia has not yet issued a `ModelTierClassified` event, Nadia issues classification first (per `Team/Nadia.md` §9) before proceeding to the validation dimensions. If the submitted tier is Tier-1 but the model's actual consequences are Tier-2 only, Nadia issues a correcting `ModelTierClassified` with `tier: 2` and documents the rationale.

These preconditions map to the `ModelRegistry.approveValidation` invariant (throws on missing `ModelSubmitted`) and the data-quality posture on tier classification.

---

## 3. Validation dimensions

Tier-2 validation applies seven dimensions. Dimensions 1 and 2 are REQUIRED at Tier-2. Dimension 3 (benchmark or challenger) requires ONE of the two sub-options. Dimensions 4–6 are expected practice (a finding is raised if omitted without documented justification). Dimension 7 (findings register) applies throughout.

### 3.1 Conceptual soundness review (REQUIRED)

Nadia reads the model specification (at `prototype/platform/risk/model-specs/<modelId>-spec.md`; the submission contract per `Team/Rohan.md` §11 and `Team/Nadia.md` §12). Review covers:

- **Theory alignment.** Does the modelling approach match the theoretical framework it claims? For a ZARONIA OIS IRD pricing engine, for example, the discount-curve construction from ZARONIA fixes must be consistent with OIS collateralisation conventions and the SARB ZARONIA reform timeline `[register: route to Mira — SARB ZARONIA reform]`.
- **Input / output specification.** Are all model inputs identified (market data feeds, contractual parameters, model parameters)? Are outputs unambiguous (MTM price, present value, sensitivity)?
- **Modelling assumptions.** Are assumptions documented and justified? Are limiting cases identified (e.g. zero-rate environments; negative-rate floors; day-count discrepancies)?
- **Citation chain.** Does the spec cite the primary theoretical references and applicable regulatory anchors?

Outcome: Nadia records a conceptual-soundness verdict in the validation report (satisfactory / conditionally satisfactory with findings / unsatisfactory). An "unsatisfactory" verdict at this dimension is a blocking finding — the model cannot proceed to approval.

### 3.2 Sensitivity analysis (REQUIRED)

Nadia perturbs key model parameters and input data and assesses output stability. Sensitivity analysis at Tier-2 is proportionate to the model's commercial consequence:

| Input dimension | Perturbation envelope | Pass / restrict / withhold criterion |
|---|---|---|
| Key market-data inputs (rates, spreads, FX rates, volatility surfaces) | ± 100 bp parallel shift (rates); ± 30% multiplicative on spreads; ± 15% on FX rates; ± 25% on vol surface | **Pass** if output changes monotonically with input direction; **restrict** if output is non-monotonic only in tail scenarios; **withhold** if non-monotonic under base-case perturbation |
| Model parameters (calibration coefficients, decay factors, discount-curve assumptions) | ± 20% on each material parameter individually | **Pass** if output change is bounded and documented; **restrict** if output sensitivity is disproportionate (> 5× the parameter perturbation expressed as ratio of output change); **withhold** if output diverges |
| Input data quality degradation (latency injection; stale-price substitution) | Substituting T-1 values for T market data on up to 25% of inputs | **Pass** if P&L impact from staleness is < 10 bp on the modelled instrument; **restrict** if 10–25 bp with documented threshold; **withhold** if > 25 bp without documented mitigation |

Perturbation runs are part of the validation cycle; they are not optional at Tier-2. Results are summarised in the sensitivity report section of the validation report.

### 3.3 Benchmark OR challenger model (ONE required)

Tier-2 requires **one** of: (a) an independent benchmark computation, or (b) a challenger model. Both are not required (in contrast to Tier-1, which requires both).

**(a) Independent benchmark computation.** Nadia constructs an independent computation of the model output using a well-established reference — for example:
- For an OTC IRD pricing engine: a textbook or vendor-library OIS pricing formula applied to the same inputs (ZARONIA curve; trade economics; day-count conventions). The benchmark need not match the production model to the last decimal; the purpose is to bound the range of plausible model values.
- For a risk-sensitivity engine: an analytic approximation (e.g. duration-based DV01 as a benchmark to the full repricing sensitivity) applied to the same position.
- For a behavioural-deposit model: a simple run-off curve (e.g. proportional decay) as a benchmark to the fitted model.

**(b) Challenger model.** Nadia constructs an alternative formulation of the same problem (e.g. an alternative discount-curve construction; an alternative calibration specification for the behavioural model) and compares outputs.

The benchmark or challenger result is reported in the validation report. Material divergence (> 10% on the modelled output across the range of test scenarios) triggers a finding; the finding severity is `medium` unless Nadia determines the divergence is attributable to a known model limitation that the model spec documents.

### 3.4 Data-lineage review

Nadia reviews the model's input data sources and confirms:

- Every data input is identified and sourced from a named canonical store (event store projection, market-data feed, or curated reference data — per Anya's data-contracts catalogue).
- Data lineage conforms to BCBS 239 risk-data-aggregation preconditions: complete, accurate, timely, adaptable. For Tier-2 models in the build phase, this review is performed against the seed data and synthetic market-data stores; Nadia documents any gaps as advisory findings.
- Where a Tier-2 model consumes SARB-published reference rates (e.g. ZARONIA daily fix from the SARB JIBAR transition publication), the data feed dependency is documented and a `[register: route to Mira]` flag placed if the obligation is not yet in the obligations register.

BCBS 239 conformance is asserted in the validation report as a signed affirmation; it is not a separate document at Tier-2.

### 3.5 Documentation review

Nadia confirms that the model's methodology documentation meets the SR 11-7 §VI standard proportionate to Tier-2:

- **Methodology spec** — the model-spec file at `prototype/platform/risk/model-specs/<modelId>-spec.md` is populated with: purpose; theoretical framework; key assumptions; inputs and outputs with data types and units; version and version history; owner (Rohan).
- **Version control** — the spec version matches the `version` field in the `ModelSubmitted` event payload; a change in methodology triggers a new `ModelSubmitted` with a new version and a new validation cycle.
- **Data dictionary** — all model inputs are named, typed, and sourced; all model outputs are named and typed.
- **Change log** — significant model changes are documented per SS 1/23 Principle 4 version-control expectations `[register: route to Mira — SS 1/23]`.

A finding (severity `medium`) is raised for each missing mandatory element. A missing methodology spec entirely is severity `blocking` (the conceptual soundness review cannot proceed without it, per dimension 3.1).

### 3.6 Edge-case coverage

Nadia enumerates at least 3 edge cases for the model and documents the expected vs actual model behaviour for each. Edge cases are model-class specific; examples:

| Model class | Illustrative Tier-2 edge cases |
|---|---|
| OTC IRD pricing engine (ZARONIA) | (1) Zero-coupon trade (single cash flow at maturity); (2) trade effective date = today (zero forward-start period); (3) OIS curve inversion (short-end rate > long-end rate) |
| FX forward pricing engine (IRP) | (1) Zero domestic interest rate; (2) zero foreign interest rate; (3) forward date = spot settlement date |
| Behavioural-deposit model | (1) All deposits redeem on demand (decay parameter = 1); (2) no redemptions for 24 months (decay parameter = 0); (3) stress scenario with instantaneous 50% deposit outflow |

Results are reported in the edge-case coverage section of the validation report. Edge cases where the model produces a result outside the documented envelope trigger a finding (severity `medium` unless the out-of-envelope result would cause commercial harm or misrepresentation, in which case `high`).

### 3.7 Findings register

All issues identified across dimensions 3.1–3.6 are raised as `ValidationFindingRaised` events with the appropriate severity:

| Severity | Definition at Tier-2 | Approval impact |
|---|---|---|
| `blocking` | The finding, if unresolved, means the model output cannot be relied upon for its stated commercial purpose. Examples: unsatisfactory conceptual soundness verdict; missing methodology spec; non-monotonic sensitivity under base-case perturbation; BCBS 239 conformance failure on a critical input. | **Blocks approval.** `ModelRegistry.approveValidation` enforces this invariant at the platform level — approval throws on any open blocking finding. |
| `high` | The finding represents a material limitation that affects the model's commercial reliability in specified scenarios. It does not block approval but must be documented in the approval event and actioned within 90 days. | **Non-blocking.** Nadia records the finding with deadline; Rohan owns remediation. |
| `medium` | The finding is a documentation gap, a sensitivity edge case, or a benchmark divergence that is explainable and bounded. It does not block approval. | **Non-blocking.** Nadia records the finding; remediation tracked. |
| `low` | Advisory observation; no impact on reliability or compliance. | **Non-blocking.** Recorded for completeness. |

`ValidationFindingRaised` events emit during the validation cycle (not at the end); findings are available for Vera's continuous-controls monitoring (Wave-4 #11, planned) as they are raised. `ValidationFindingClosed` emits when Rohan confirms remediation; Nadia verifies and records closure.

---

## 4. Disposition

### 4.1 Disposition authority

Nadia holds sole disposition authority at Tier-2. The disposition events are the same as Tier-1:

| Disposition | Trigger | Output event |
|---|---|---|
| `approve` | All 3 REQUIRED dimensions satisfied; no open blocking findings; benchmark or challenger satisfactory; edge-case coverage complete. | `ModelValidationApproved` |
| `withhold` | Any blocking finding open at the conclusion of the validation cycle; or conceptual-soundness verdict "unsatisfactory". | `ModelValidationWithheld` |
| `restrict-to-validated-envelope` | The model is fit for purpose within a documented envelope (e.g. validated for instruments with tenor ≤ 10Y, or for rate environments within ± 200 bp of the calibration point), but not outside it. | `ModelValidationApproved` with `envelope` field; `ProductionUseBoundary` schema (S7-Targeted slice 5) attached. |

### 4.2 Approval expiry

Tier-2 approvals expire **18 months** from the `asOf` date of the `ModelValidationApproved` event. The `expiryDate` field in the event payload records the expiry. Models with expired approvals are not `productionEligible()` per the registry's query logic.

The 18-month window reflects the Tier-2 revalidation cadence (§1.2). At the revalidation point, Nadia runs the full methodology again; if the model is unchanged and no drift has been detected, the revalidation may be expedited (dimensions 3.1 and 3.3 reviewed at reduced depth with documented justification, subject to no new blocking findings).

### 4.3 Escalation

Disposition disputes follow the same escalation channels as Tier-1 (`_methodology-tier-1.md` §7 escalation triggers) where applicable. Tier-2 specific escalation trigger:

- **Benchmark divergence > 30% with disputed explanation.** If Rohan disputes Nadia's characterisation of the divergence and the dispute cannot be resolved by evidence within 5 working days → `AgentEscalation` to Helena (Chief Risk Officer).

---

## 5. Revalidation triggers

A Tier-2 model must be revalidated (full or partial re-run of this methodology) on:

1. **`MethodologyChangeRequested`** — Rohan requests a change to the model methodology (theoretical framework, calibration approach, discount-curve construction). Full revalidation required within the SLA in `Team/Nadia.md` §7.
2. **`ModelDriftDetected`** — Rohan's monitoring pipeline (or Nadia's own periodic sample checks) detects drift in the model's behaviour (input-distribution shift, output-distribution shift, performance degradation). Partial revalidation (at minimum dimensions 3.1 + 3.2 + 3.3) required within 10 working days of detection.
3. **Material parameter change.** Any change to a model parameter documented in the methodology spec that alters the calibration by > 10% relative to the validated parameters, or any change to a key assumption (e.g. rate convention; day-count convention; collateral assumption). Nadia determines materiality at the time of change on Rohan's notification; a `MethodologyChangeRequested` event is the formal notification path.
4. **Approaching expiry.** Nadia initiates revalidation at least 30 calendar days before the approval's `expiryDate` to avoid a gap in validated status.

Trigger events are replay-queryable from the event store; Vera's continuous-controls pipeline (Wave-4 #11, planned) will automate detection and create findings when triggers are not actioned within SLA.

---

## Procedure-pair binding

This methodology is the substance half of the validation procedure-pair (per `Procedures/validation/_index.md`):

- **Cycle** — `Procedures/by-policy/model-validation.md` (`STUB`, owner Helena per `Procedures/_index.md`). The cycle moves a candidate model from `ModelSubmitted` through tier-classification, validation-testing, and disposition. The cycle step for validation-testing calls into this file.
- **Substance** — this methodology defines what "run the Tier-2 validation" means: which dimensions are applied, in what order, with what evidence, and with what disposition authorities.

Until Helena's cycle procedure lands, this methodology runs inline at each Tier-2 validation.

---

## Substrate dependencies

| Dependency | Status | Owner | Blocks |
|---|---|---|---|
| `ValidationMethodologyPublished` event type | **Typed** per `prototype/platform/event-store/event-types/model-risk.ts` | Atlas | Methodology publication event at first validation run |
| `ModelSubmitted`, `ModelTierClassified`, `ModelValidationApproved`, `ModelValidationWithheld`, `ValidationFindingRaised`, `ValidationFindingClosed` | **Typed** per `prototype/platform/event-store/event-types/model-risk.ts` | Atlas | Disposition events |
| `LocalModelRegistry` | **Implemented** per `prototype/platform/model-registry/registry.ts` | Nadia + Rohan | Registry operations |
| Model-spec template | **Landed** per PR #20 (`prototype/platform/risk/model-specs/_template.md`) | Nadia + Rohan | "Model spec read" step (dimension 3.1) |
| `ProductionUseBoundary` schema (typed envelope) | Planned (S7-Targeted slice 5) | Atlas + Nadia + Kai | `restrict-to-validated-envelope` typed envelope |
| Helena's cycle procedure | Planned (`Procedures/by-policy/model-validation.md`) | Helena | Canonical cycle orchestration |
| SARB ZARONIA reform reference data | `[register: route to Mira]` | Mira | OIS discount-curve conceptual-soundness anchor |
| Vera continuous-controls integration | Planned (Wave-4 #11) | Vera | Auto-detection of stale revalidation cycles |

---

## Authority

Full citation chain:

- **RAS § B7** — `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` lines 136–144. Row 2: Tier-2 model classes; 18-month (or biennial per RAS §B7 binding text) revalidation. Cited via `ORG-PR-21`.
- **SR 11-7 §V (validation) + §VI (documentation)** — *Guidance on Model Risk Management*, US Federal Reserve / OCC, 2011. Proportionate effective challenge; conceptual-soundness review; documentation artefact set. Referenced via `ORG-PR-21`.
- **SS 1/23 Principle 4** — *Model Risk Management Principles for Banks*, Bank of England PRA, 2023. Model documentation and version control. `[register: route to Mira — SS 1/23]`
- **BCBS *Corporate Governance Principles for Banks*** (2015 rev. 2024) Principles 6 + 8. Referenced via `ORG-GV-10` and `ORG-GV-18`.
- **`_tier-definitions-v0.1.md` §1.2** — Tier-2 definition (pricing engines, risk sensitivities, behavioural-deposit models; C2.1–C2.3 criteria; biennial cadence per RAS §B7 / 18-month per this methodology).
- **D-PRODUCT-CONSTRUCTION-SLICES-4-8** — CEO session-delegation 2026-05-26; authorises the model-validation sign-offs produced by the seed that references this methodology.
- **CLAUDE.md Principle 2** — single-graph discipline; Procedure-pair binding. This methodology is the substance node between RAS §B7 (policy layer) and the typed model-risk events (system capability layer).
- **CLAUDE.md Principle 6** — autonomous by default. The default actor at every validation step is `agent:nadia`; escalation to `agent:helena` is a named channel.

---

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-27 | Nadia (via Scrooge) | Initial Tier-2 methodology authored as Slice E of validation-methodology library v0. Seven validation dimensions specified; two REQUIRED (conceptual soundness + sensitivity analysis); one of benchmark or challenger required; data-lineage review, documentation review, and edge-case coverage as expected practice; findings register throughout. Approval expiry 18 months. Revalidation triggers: MethodologyChangeRequested, ModelDriftDetected, material parameter change, approaching expiry. Pre-validation preconditions: ModelSubmitted + ModelTierClassified must exist. Authority: D-PRODUCT-CONSTRUCTION-SLICES-4-8; RAS §B7; SR 11-7; SS 1/23 Principle 4; BCBS CG-Principles 6+8. |

—Nadia
