---
title: Capital Management Policy v1
author: Camille (Chief Financial Officer, governance) + Helena (Chief Risk Officer, governance)
date: 2026-05-11
summary: Standalone Capital Management Policy covering CET1/AT1/T2 structure, capital targets, RAS B1/B2 anchoring, ICAAP governance, Pillar 2A add-ons, capital conservation and countercyclical buffers, stress-testing cadence, and distribution controls. Closes obligations ORG-PR-01 through ORG-PR-05, ORG-PR-13, ORG-PR-37, ORG-PR-44. LICENCE-BIND.
decision-required: false
riskTaxonomy:
  - RT-CR
  - RT-LQ
  - RT-ST
---

# Capital Management Policy v1

> **Authors.** Camille (Chief Financial Officer, governance) — lead; Helena (Chief Risk Officer, governance) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10); `D-MARKETS-CAPITAL-TIME-SHAPE` (CEO-approved 2026-05-07). Implements Section 1.1 ICAAP column of [Owner Inbox/2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md](2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md) (W2 Slice 1) per the no-pause rule — CLAUDE.md "Operating procedures".
> **Obligations closed.** `ORG-PR-01` (capital adequacy minimum), `ORG-PR-02` (Pillar 2A add-ons), `ORG-PR-03` (capital conservation + CCyB), `ORG-PR-04` (RAS B2 management buffer — PARTIAL, B2 calibration deferred to W2 Slice 2), `ORG-PR-05` (leverage ratio), `ORG-PR-13` (ICAAP annual submission), `ORG-PR-37` (PA D5/2021 Capital Framework), `ORG-PR-44` (PA D3/2023 Regulatory treatment of accounting provisions).
> **Status.** LICENCE-BIND. Binding at commencement of trading. Build-phase operationalisation is the preparation for compliance, not compliance itself (per `project_rules_bind_at_commencement.md` memory, 2026-05-07). The policy substrate (RWA engine, stress-projection engine, BA-form generator) is under construction per W2 Slices 2–4 of `D-REGULATORY-READINESS-GATE-PLAN`.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Capital Management Policy — Overarching

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual; triggered on material change · **Citation:** Banks Act 94 of 1990 (capital-adequacy mandate) + Regulations Relating to Banks 2012 (as amended) — Reg 38 (Pillar 2 supervisory review process) `[citation: TBC — precise Reg 38 sub-clause indices; Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate]` + PA Directive 5 of 2021 (D5/2021 — Capital Framework for South Africa based on Basel III; `ORG-PR-37`) + BCBS Basel III/IV (*International Convergence of Capital Measurement and Capital Standards*, rev. 2017) + PA Directive 3 of 2023 (D3/2023 — Regulatory treatment of accounting provisions; `ORG-PR-44`)

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") identifies, measures, manages, and reports capital across all Pillar 1, Pillar 2, and internal-buffer dimensions. Its purpose is to ensure the Bank holds capital sufficient to support its risk profile, meet regulatory minima at all times, and absorb material stress without breaching the floors set by the Prudential Authority (PA) at SARB. The policy translates the regulatory capital-adequacy framework — Banks Act 94 of 1990, the Regulations Relating to Banks, and the BCBS Basel III/IV framework as operationalised in the Republic by the PA through PA D5/2021 — into an actionable governance and management structure for the Bank.

This policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). It cites the regulatory obligations above it; procedures under this policy (including `Procedures/by-policy/capital-ratio-monitoring.md`, `Procedures/by-policy/capital-framework-basel-iii.md`, and `Procedures/by-policy/capital-action-governance.md`) operationalise it; the RWA engine, BA-form generator, and stress-projection engine are the system capabilities that execute those procedures. The policy does not reproduce regulatory text; it anchors management choices above the regulatory floor.

The capital framework operates on a consolidated basis per the legal-entity tree at `Regulations/_legal-entity-tree.md` and `D-REGULATORY-PERIMETER` (CEO-approved 2026-05-09): both the standalone `Hoz Bank Limited` entity and the group-consolidated view (`Hoz Group Limited`, incorporating `Hoz Securities Limited`) are managed under this policy. Where the standalone and consolidated views diverge, the more conservative of the two ratios governs.

The policy covers the full capital-quality stack: Common Equity Tier 1 (CET1), Additional Tier 1 (AT1), and Tier 2 (T2) capital. At the build phase, the Bank's capital structure is CET1-dominant (R300m shareholder equity at licence-day; no AT1 or T2 envisaged at v1 per `Owner Inbox/2026-05-07_camille_capital-plan-v1.md`). The policy is written to govern the full stack, including the conditions under which AT1 and T2 are issued, maintained, and managed, so that the framework is complete from the first day of trading.

The policy incorporates the Internal Capital Adequacy Assessment Process (ICAAP) governance framework consistent with Section 1.1 of the ICAAP/ILAAP/Recovery triplet framework (W2 Slice 1). The ICAAP is not a separate document from the policy; it is the annual assessment cycle that tests whether the policy's capital targets remain adequate under stress and informs any recalibration.

### Principles

- **Regulatory-floor discipline.** The Bank maintains CET1, Tier 1, and Total capital ratios at not less than the PA-set minima at all times. Breach of any regulatory minimum is a Critical event (see §1.4 Breach). The PA minima are currently set by PA D5/2021 read with the Regulations Relating to Banks; the precise numerical floors are reproduced in `Procedures/by-policy/capital-ratio-monitoring.md` and updated each time a PA directive amends them.
- **Pillar 2A obedience.** Pillar 2A add-ons set by the PA through the Supervisory Review and Evaluation Process (SREP) are incorporated into the Bank's target ratios immediately upon PA communication. Pillar 2A is the PA's calibration of the bank-specific capital requirement above the Pillar 1 floor; the Bank does not dispute or defer Pillar 2A add-ons.
- **Conservation and countercyclical buffers.** The capital conservation buffer (CCB) — currently 2.5pp of CET1 per the Basel III/IV framework — and the countercyclical capital buffer (CCyB) as set by the PA per jurisdiction are held in full. The CCyB is monitored at each quarterly cycle; if the PA sets a positive CCyB rate for South Africa, the Bank incorporates it into its target ratios at the effective date.
- **Management buffer above all minima.** The Bank holds a CET1 management buffer above the sum of (PA minimum + Pillar 2A + CCB + CCyB) as set by the Risk Appetite Statement line RAS B2. The RAS B2 calibration (target: +1.5pp; calibration pending W2 Slice 2) ensures the Bank operates with genuine headroom above the Maximum Distributable Amount (MDA) framework, preserving distribution optionality and signalling financial strength to the PA and counterparties. The B2 calibration must pass the severely-adverse stress test without breaching the floor.
- **RAS B1 anchoring.** The RAS B1 line (CET1 ≥ regulatory minimum + Pillar 2A + CCB + CCyB) is the first line of defence. The RAS B2 line (+1.5pp above B1, pending calibration) is the management-buffer line. Breach of B2 initiates capital-action consideration; breach of B1 is a Critical escalation.
- **Leverage ratio discipline.** The Bank maintains the leverage ratio at not less than the PA-set minimum per the Regulations Relating to Banks, consistent with `ORG-PR-05`. The leverage ratio is a non-risk-based backstop; it is monitored monthly and reported in the ICAAP narrative.
- **Events-first capital accounting.** Capital ratios are computed as queries over the event log, not as stored balances in a parallel ledger (Principle 1). The RWA engine (W2 Slice 3, under Bea (Accounting & financial reporting engineer, engineering)) produces credit, market, and operational RWA from event substrates; the BA-form generator produces the PA-required BA 100/300/325/326 returns in the SARB-published schema.
- **IFRS 9 provisions read-through.** The regulatory treatment of IFRS 9 ECL accounting provisions in CET1 / Tier 2 / specific-vs-general reserve buckets follows PA D3/2023 (`ORG-PR-44`). Stage-1 and Stage-2 ECL general provisions (where within the Basel transitional cap) receive Tier 2 credit; Stage-3 specific provisions are a CET1 deduction. The transition arrangements per D3/2023 are applied until the full-adoption period ends.
- **Group read-through.** The Bank computes and manages capital ratios on both the standalone (`Hoz Bank Limited`) and consolidated (`Hoz Group Limited` group) basis per `D-REGULATORY-PERIMETER`. The consolidated ICAAP (`ORG-BNK-ICAAP-CONS`) aggregates risks across `Hoz Bank Limited` and `Hoz Securities Limited`; the standalone ICAAP (`ORG-PR-13`) covers the bank entity. Both are submitted to the PA annually.
- **Capital actions are governance events.** Any decision to issue capital, defer a distribution, call an AT1 instrument, or take a recovery-side capital action is a typed event in the event log, governed by the `capital-action-governance.md` procedure, and escalated to the Board (CEO interim under `D-THIN-HUMAN-LAYER-MINIMUM`) at the authority level appropriate to the action type.

### Roles

Camille (Chief Financial Officer, governance) is the policy owner and chair of the capital-management governance cycle. Camille's responsibilities include: owning the capital-adequacy target framework; chairing the ICAAP annual cycle on the capital side; commissioning and reviewing the BA-return suite; issuing capital-action instructions within Board-approved limits; presenting the capital position to ALCO and BRC. Helena (Chief Risk Officer, governance) is the co-author and holds the Risk Appetite Statement lines (B1 and B2) that anchor the policy's capital targets; Helena chairs the ICAAP narrative and stress-testing integration. Bea (Accounting & financial reporting engineer, engineering — reports to Camille) builds and operates the RWA engine and BA-form generator. Rohan (Risk engineer, engineering — reports to Helena) builds and operates the stress-projection engine. Owen (Company Secretary, governance) provides secretarial governance on the Board-approval pathway and cycle-event framework. Nadia (Independent-validation engineer, peer-in-second-line under Helena) validates the RWA engine and stress-projection engine models. Vera (internal audit engineer, reports functionally to Thandiwe (Chief Audit Executive, governance)) provides third-line assurance over the capital-management framework.

The ALCO (chaired by Eitan (Treasurer, governance)) receives the monthly capital-position report and reviews it against the liquidity-side. The BRC (Board Risk Committee; CEO interim pending constitution) reviews capital adequacy and stress-test results quarterly. The Board (CEO interim) approves the ICAAP, capital-target calibration, and any material capital actions.

### Breach

Breach taxonomy under this policy is three-severity:

- **Alert (Amber).** CET1 ratio within 50bps above the RAS B2 floor, or leverage ratio within 25bps above the PA minimum. Immediate notification to ALCO, BRC, and CEO. Capital action consideration initiated.
- **Hard Breach (Red).** CET1 ratio below RAS B2 floor but above RAS B1 floor. Capital action decision required within the timeframe specified in the `capital-action-governance.md` procedure. PA notification may be required depending on the duration and trajectory.
- **Critical (Critical-Red).** CET1 ratio below RAS B1 floor (i.e., below regulatory minimum + Pillar 2A + CCB + CCyB). Immediate CEO notification; immediate PA notification under Reg 38 `[citation: TBC]` + Banks Act reporting obligations; recovery-plan consideration per the Recovery Plan framework. This is a Board-level event; no agent may delay escalation.

A Critical breach of any regulatory minimum is also reportable as a typed event to the PA under the applicable notification obligation. The notification timeline is governed by the `capital-action-governance.md` procedure and the relevant Banks Act section `[citation: TBC — exact notification-deadline provision; Imani + external counsel ratify at the licence-application gate]`.

---

## 2. ICAAP Governance

**Owner:** Helena (Chief Risk Officer, governance) — narrative; Camille (Chief Financial Officer, governance) — capital + BA returns · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`); PA submission on the annual cycle · **Cadence:** Annual (calendar year-end); re-run on material change; recovery-indicator-trip re-assessment · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks — Reg 38 (Pillar 2 ICAAP obligation) `[citation: TBC — exact Reg 38 sub-clause indices on governance documentation, annual submission, PA communication; Imani + external counsel ratify at the licence-application gate]` + PA D5/2021 (`ORG-PR-37`) + BCBS Basel III/IV Pillar 2 supervisory-review text `[citation: TBC]` + `ORG-PR-13` (ICAAP annual submission obligation, IN FORCE)

### Purpose

The Internal Capital Adequacy Assessment Process (ICAAP) is the Bank's structured, governed, and documented process for assessing whether its capital is adequate to cover all material risks across the planning horizon. It is the Pillar 2 counterpart to the Pillar 1 regulatory minimum: where Pillar 1 sets formulaic floors, the ICAAP tests whether those floors are sufficient given the Bank's specific risk profile, business model, strategy, and operating environment. The ICAAP is submitted to the PA annually and re-run on material change; it is the primary vehicle through which the PA assesses whether to impose a Pillar 2A add-on.

The ICAAP is not a compliance exercise; it is a management tool. Helena and Camille use the ICAAP annual cycle to challenge whether the capital targets in this policy remain appropriate, whether the stress-test scenarios have been calibrated correctly, and whether the management buffer (RAS B2) absorbs the projected shortfall in the severely-adverse scenario. The ICAAP findings feed back into this policy's calibration; the policy anchors the ICAAP's starting position.

The ICAAP framework for `Hoz Bank Limited` is specified in full in the W2 Slice 1 framework document at [Owner Inbox/2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md](2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md), section §3.1. This policy section names the governance pathway, the ownership split, and the annual cycle; the per-section clause-by-clause mapping is in §3.1 of that framework. The two documents are read together.

The ICAAP is produced at both the standalone (`Hoz Bank Limited`) and consolidated (`Hoz Group Limited`) basis per §2.2 of the W2 framework spec. The consolidated ICAAP aggregates capital risks across `Hoz Bank Limited` and `Hoz Securities Limited`; `Hoz Securities Limited`'s market-conduct exposures contribute to the group operational-risk RWA add-on per BCBS group-supervision principles.

### Principles

- **Helena chairs the narrative; Camille chairs the capital and BA returns.** The ownership split is structural, not ad hoc. Helena owns the risk-identification, risk-measurement, stress-test integration, and ICAAP narrative sections; Camille owns the Pillar 1 ratio computation, BA-form generation, internal-capital-target setting, and capital-action-playbook sections. Both sign the final ICAAP document.
- **Annual cycle with a defined event-pattern.** The ICAAP cycle runs from `IcaapCycleStarted` to `IcaapDocumentSubmitted`. The intervening events — `IcaapDraftReviewed`, `IcaapBoardAttested` — are mandatory governance checkpoints. No ICAAP document is submitted to the PA without a `IcaapBoardAttested { attestor, asOf }` event in the log.
- **Board attestation is non-negotiable.** The ICAAP is a Board document. Under the interim governance structure (`D-THIN-HUMAN-LAYER-MINIMUM`), the CEO (Marc as CEO) provides the Board attestation; at steady-state the Board itself attests via the BRC. The attestation records that the Board (or CEO interim) is satisfied the ICAAP accurately represents the Bank's risk profile and capital adequacy, and that the capital targets are appropriate.
- **Material-change re-run.** A material change in business model, RWA composition (including a new product line passing the New Product Approval gate under `ORG-PR-25`), balance-sheet structure, or the legal-entity perimeter triggers a re-run. The trigger pattern is `MaterialChangeDeclared` → `IcaapMaterialChangeAssessed { reRunRequired: true | false }`.
- **PA submission is a typed event.** Submission of the ICAAP to the PA is recorded as a `IcaapDocumentSubmitted { boardAttestation, submissionDate, documentHash }` event in the event log. The document itself is stored in the BLAKE3 content-addressed document store per `D-RMS-PHASE-1`. The event is canonical; the markdown is a render.
- **ICAAP-to-ILAAP coherence.** The capital-stress scenarios used in the ICAAP must reconcile with the liquidity-stress scenarios in the ILAAP. The same stress-projection engine (W2 Slice 4, under Rohan) feeds both; the scenarios are run on a consistent basis. A divergent capital/liquidity stress assumption is a Vera finding.
- **Pillar 2A read-through.** The ICAAP produces an internal view of any additional capital needed above Pillar 1 (the internal Pillar 2A self-assessment). This internal assessment informs the PA's SREP calibration but does not substitute for it. If the PA sets a Pillar 2A add-on that differs from the Bank's self-assessment, the PA's add-on governs immediately; the ICAAP narrative explains the gap in the next cycle.
- **Independent validation.** The RWA engine and stress-projection engine underlying the ICAAP are validated by Nadia (Independent-validation engineer, peer-in-second-line under Helena) before each ICAAP submission. A `ModelValidationCompleted { modelId, modelVersion, findings[] }` event for each model is a prerequisite for `IcaapDocumentSubmitted`. Validation independence is a third-line assurance finding if Nadia builds what she validates.

### Roles

Helena (Chief Risk Officer, governance) is the ICAAP chair for the narrative sections: risk identification, risk measurement, Pillar-2 add-on computation (§3.1.5 of the W2 framework), stress-testing integration (§3.1.6), and the forward-looking capital trajectory (§3.1.7). Helena signs the ICAAP document as primary author and holds accountability for the completeness of the risk-identification. Camille is the ICAAP co-chair for the capital sections: Pillar-1 ratio computation (§3.1.4), internal capital target (§3.1.9), capital-management actions (§3.1.10), group-consolidated capital reading (§3.1.11), and the BA-return suite. Owen (Company Secretary, governance) manages the cycle secretarially — scheduling `IcaapCycleStarted`, circulating drafts for `IcaapDraftReviewed`, and filing the `IcaapBoardAttested` event on Board sign-off. Nadia validates models pre-submission. Vera provides third-line assurance that the ICAAP governance pathway is followed; any deviation from the event-pattern above is a Vera finding.

### Breach

Failure to complete a planned ICAAP annual cycle (including submission to the PA within the timeline required by Reg 38 `[citation: TBC — exact timeline provision]`) is a regulatory breach reportable to the BRC and the PA. If the ICAAP concludes that capital is materially inadequate, Helena and Camille trigger an immediate capital-action review per §4 of this policy (Capital Distribution Controls) and escalate to the CEO and Board. Any ICAAP finding that a severely-adverse scenario would breach the CET1 regulatory minimum (RAS B1) is a Board-level finding requiring a capital-action response within the timeframe set in the `capital-action-governance.md` procedure.

---

## 3. Capital Adequacy Targets

**Owner:** Camille (Chief Financial Officer, governance) with Helena (Chief Risk Officer, governance) on RAS anchoring · **Approval:** Board (CEO interim) — capital targets are Board-approved; RAS calibration follows the same pathway · **Cadence:** Annual (ICAAP cycle); triggered on PA SREP outcome or material change · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks — Reg 38 `[citation: TBC]` + PA D5/2021 (`ORG-PR-37`; minimum CET1 + Tier 1 + Total; Pillar 2A; D-SIB surcharge — Hoz not a D-SIB at v0; CCyB range; CCB range) + BCBS Basel III/IV minimum capital ratios + `ORG-PR-01` (capital adequacy minimum, IN FORCE) + `ORG-PR-02` (Pillar 2A add-ons, IN FORCE) + `ORG-PR-03` (CCB + CCyB, IN FORCE) + `ORG-PR-04` (RAS B2 management buffer — PARTIAL, B2 deferred) + `ORG-PR-05` (leverage ratio, IN FORCE)

### Purpose

This section sets out the specific capital-adequacy targets Hoz Bank Limited holds itself to. The targets are structured in three layers: (i) the regulatory floor (Pillar 1 + Pillar 2A + CCB + CCyB), which the Bank must not breach; (ii) the RAS B1 line, which equals the regulatory floor and is the Bank's first risk-appetite limit; and (iii) the RAS B2 management buffer, a further +1.5pp above the B1 floor (calibration pending W2 Slice 2), which provides genuine headroom and preserves distribution optionality. Operating within the management buffer is the normal operating condition; breaching B2 triggers capital-action consideration; breaching B1 is a Critical escalation.

The numerical targets below express the policy's intent. The exact PA-set values for Pillar 2A, CCyB, and D5/2021 minima are maintained in `Procedures/by-policy/capital-ratio-monitoring.md`, which is updated each time the PA revises them. This policy sets the *structure* (the three-layer architecture and the RAS anchoring); the procedure holds the *current numbers* in the PA-defined format.

### Principles

- **Pillar 1 minimum CET1.** The Bank maintains a CET1 ratio at not less than 6.000% of risk-weighted assets at all times, per the Regulations Relating to Banks and PA D5/2021. The Pillar 1 CET1 minimum is a hard floor; no management discretion applies below this line. `[Citation: PA D5/2021 (`ORG-PR-37`) + Regulations Relating to Banks Reg 38 `[citation: TBC — exact sub-clause for 6% CET1 floor]`]`.

- **Pillar 1 minimum Tier 1.** The Bank maintains a Tier 1 ratio at not less than 8.000% of risk-weighted assets per the same authority. AT1 instruments (if issued) are counted toward the Tier 1 ratio above the CET1 minimum to a maximum of 1.5pp, per BCBS Basel III/IV eligibility criteria `[citation: TBC]`.

- **Pillar 1 minimum Total capital.** The Bank maintains a Total capital ratio at not less than 10.000% of risk-weighted assets per the same authority. T2 instruments (if issued) are counted toward Total capital above the Tier 1 ratio to a maximum of 2pp, per BCBS Basel III/IV eligibility criteria `[citation: TBC]`.

- **Pillar 2A add-on (ORG-PR-02).** The Pillar 2A add-on is set by the PA through the SREP and added to all three minima above (CET1, Tier 1, Total). Pre-licence-day, the ICAAP carries a notional Pillar 2A placeholder of approximately 1.5pp, calibrated upward at licence-day from the SREP-class output of the paper ICAAP per Camille's Capital Plan v1 (`Owner Inbox/2026-05-07_camille_capital-plan-v1.md`). Post-licence-day, the PA-set Pillar 2A governs immediately upon communication; Camille updates `Procedures/by-policy/capital-ratio-monitoring.md` within 24 hours of PA notification.

- **Capital conservation buffer (CCB) — ORG-PR-03.** The Bank holds a CET1 capital conservation buffer of 2.5pp above the Pillar 1 minimum + Pillar 2A at all times, per BCBS Basel III/IV and PA D5/2021. Operating within the CCB (i.e., between the Pillar 1 + 2A floor and the Pillar 1 + 2A + CCB floor) triggers automatic MDA restrictions per the MDA framework in §4 of this policy.

- **Countercyclical capital buffer (CCyB) — ORG-PR-03.** The CCyB is set by the PA for South Africa and added to the CET1 requirement above the Pillar 1 + 2A + CCB floor. The Bank incorporates the current SA CCyB rate (presently 0% per PA D5/2021 calibration `[citation: TBC — precise current rate; Camille updates on each PA CCyB announcement]`) into its target ratios. If the PA activates a positive CCyB rate, it becomes a component of the MDA framework and is incorporated into the RAS B1 calculation immediately.

- **RAS B1 — the aggregate floor (ORG-PR-01).** RAS B1 is defined as: CET1 ≥ (Pillar 1 CET1 minimum + Pillar 2A + CCB + CCyB). This is the Bank's first risk-appetite limit, equal to the regulatory floor. Breaching B1 means breaching the regulatory minimum; this is a Critical event per §1.4 of this policy.

- **RAS B2 — the management buffer (ORG-PR-04, PARTIAL).** RAS B2 is defined as: CET1 ≥ RAS B1 + 1.5pp. The +1.5pp management buffer is the *target*; the W2 Slice 2 calibration brief (Helena and Rohan (Risk engineer, engineering — reports to Helena), with Bea) will defend this figure against: peer-bank management-buffer range (SA domestic mid-cap and small-cap banks; typical range +1.0pp to +2.5pp above the RAS B1 floor); stress-shortfall analysis (the +1.5pp must absorb the severely-adverse scenario without breaching B1); and commercial optionality considerations. If the Slice 2 analysis concludes the +1.5pp is insufficient, the calibration brief recommends a higher figure for CEO approval as `D-RAS-B2-CALIBRATION`. Until `D-RAS-B2-CALIBRATION` is issued, the +1.5pp working target is carried in the RAS register as `PARTIAL (B2 deferred)` and in this policy as the nominal management-buffer floor. The B2 obligation (`ORG-PR-04`) is closed to `IN FORCE` upon the `RasLineCalibrated { lineId: "B2" }` event in the log.

- **Leverage ratio (ORG-PR-05).** The Bank maintains the leverage ratio (Tier 1 capital / total leverage exposure) at not less than the PA minimum set in the Regulations Relating to Banks and PA D5/2021 `[citation: TBC — precise minimum leverage ratio; Camille updates on each PA revision]`. The leverage ratio is a non-risk-based backstop to the RWA-based capital ratios; it is monitored monthly and reported in the ICAAP. Breach within 25bps of the PA minimum is an Alert.

- **D-SIB surcharge — not applicable at v0.** Hoz Bank Limited is not a Domestically Systemically Important Bank (D-SIB) at v0 entity configuration. PA D5/2021 sets a D-SIB capital-surcharge bucketing approach; this becomes a conditional-bind under `WS-CONDITIONAL-BIND-TRACKING` if the Bank's balance-sheet passes the PA's systemic-importance thresholds post-licence-day. No surcharge is held at v0.

- **Target operating range.** The Bank's target operating CET1 ratio is: RAS B1 floor + management buffer (B2) + a further discretionary headroom of approximately 0.25pp to accommodate intra-quarter RWA movements before triggering capital-action consideration. In practice, the ICAAP and capital-trajectory projection (§3.1.7 of the W2 framework) maintain the CET1 ratio in the target range throughout the planning horizon under both base and adverse scenarios.

### Roles

Camille owns the capital-adequacy target calibration and the procedure update obligation. Helena owns the RAS B1 and B2 lines; any proposed recalibration of B1 or B2 is Helena's recommendation and Camille's capital-side concurrence, submitted to the CEO (Board interim) for approval. Bea computes the actual ratios from the RWA engine and publishes the BA-return suite. Rohan's stress-projection engine tests whether the targets are met in stressed scenarios. The ALCO and BRC receive the capital position monthly and quarterly respectively.

### Breach

Breach of RAS B1 (i.e., CET1 falls below the regulatory floor): Critical. Breach of RAS B2 (i.e., CET1 falls below the management buffer but above B1): Hard Breach; capital-action consideration triggered per §4. Approach within 50bps of B2 floor: Alert; ALCO + BRC notified.

---

## 4. Capital Distribution Controls

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim for any distribution decision during build phase) · **Cadence:** Distribution decisions are event-triggered; MDA calculation is computed quarterly as part of the BA-return suite · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks — Reg 38 `[citation: TBC — exact MDA / distribution restriction provisions]` + PA D5/2021 (`ORG-PR-37`; capital conservation buffer MDA framework) + BCBS Basel III/IV MDA restrictions + `ORG-PR-03` (capital conservation + CCyB, IN FORCE)

### Purpose

This section governs when and how the Bank may make capital distributions — including ordinary dividends, AT1 coupon payments, T2 instrument redemptions, discretionary staff variable remuneration from capital, and any other payment classified as a distribution under the MDA framework. The controlling principle is the Basel III/IV Maximum Distributable Amount (MDA) framework: when a bank's CET1 ratio falls within the capital conservation buffer range (i.e., above Pillar 1 + 2A + CCyB but below Pillar 1 + 2A + CCB + CCyB), the bank must restrict distributions by a percentage of earnings determined by how deeply into the buffer it is operating. Below the Pillar 1 + 2A floor (i.e., breaching B1), all distributions are suspended pending restoration of capital adequacy.

The distribution-control framework is a first-line execution mechanism, a second-line policy guardrail, and a third-line audit trail. Camille owns the first-line execution; Helena owns the second-line policy check; Vera provides third-line assurance. No distribution proceeds without a `CapitalDistributionApproved` typed event in the log, which records the pre-distribution capital ratios, the MDA calculation, and the approving authority.

At the build phase, Hoz Bank Limited holds no distributable reserves (no real capital at present; R300m is a licence-day target per `project_ai_driven_bank.md`). This section is authored for operational completeness at licence-day and for the ICAAP annual-cycle review.

### Principles

- **MDA calculation is quarterly.** The MDA is computed from the quarterly BA-return suite by Bea (using the RWA engine and BA-form generator, W2 Slice 3). The MDA is: (CET1 ratio − [Pillar 1 + 2A + CCyB]) expressed as a ratio of the CCB (2.5pp), applied to earnings available for distribution. A bank operating at the bottom quartile of the CCB (i.e., CET1 ratio within 0–0.625pp above the Pillar 1 + 2A + CCyB floor) may retain at minimum 100% of earnings and make no distributions. The four quartile MDA percentages are per BCBS Basel III/IV Table 1 `[citation: TBC — precise table reference in D5/2021 or Regs Relating to Banks]`.

- **AT1 coupon payment is discretionary.** AT1 instruments (if issued) carry discretionary coupon payments; the Bank may cancel an AT1 coupon at its sole discretion without constituting a default, per BCBS AT1 eligibility criteria `[citation: TBC]`. An AT1 coupon is cancelled whenever the MDA framework requires it or the CET1 ratio falls below the trigger level specified in the AT1 instrument terms. Camille initiates the cancellation event; Owen manages the AT1 holder notification per the contractual terms.

- **No distribution while breaching B1.** When the CET1 ratio breaches RAS B1 (i.e., falls below the regulatory minimum + Pillar 2A + CCB + CCyB), all distributions — dividends, AT1 coupons, discretionary variable remuneration attributable to capital — are automatically suspended. Suspension is effective on the date the B1 breach is identified in the BA-return computation. Reinstatement requires the CET1 ratio to exceed B1 for at least one full quarter, confirmed by the BRC. The CEO and Helena must sign off the reinstatement.

- **Distribution pre-approval is mandatory.** Any proposed capital distribution (dividend, AT1 coupon, share buyback) requires Camille to produce a Distribution Impact Assessment — a one-page summary of the pre-distribution and post-distribution CET1 ratios, the MDA calculation, and the stressed ratio under the most recent adversely-stressed ICAAP scenario — before submission to the Board (CEO interim) for approval. The Board-approved `CapitalDistributionApproved` event must be in the log before any cash outflow.

- **T2 instrument maturity / call management.** T2 instruments (if issued) must not reduce Total capital below the regulatory minimum. Camille monitors the maturity and call schedule of any T2 instruments and initiates replacement issuance in advance of maturity where the ratio trajectory requires it. A T2 call exercise requires Board approval and a pre-call MDA assessment.

- **Capital actions are preferred to distribution restrictions.** The Bank's preference hierarchy for managing capital adequacy is: (i) organic capital generation (retained earnings); (ii) RWA management (reducing risk exposures within the franchise mandate); (iii) capital issuance (CET1 equity, AT1 if efficient, T2 if efficient); (iv) distribution restriction (MDA application). Distribution restriction is the last resort before capital breach.

- **Recovery-plan linkage.** If the CET1 trajectory under stress approaches the B1 floor, Camille escalates to Helena (for Recovery Plan early-warning indicator assessment) and to the CEO. The Recovery Plan options inventory (§3.3.4 of the W2 framework) includes capital-side options: equity issuance, asset disposal, balance-sheet reduction. Activation of a Recovery Plan capital option is a Board decision (`RecoveryPlanActivated` event).

### Roles

Camille owns the MDA calculation and the Distribution Impact Assessment. Helena reviews the stressed-capital trajectory and signs off the Helena-side concurrence. Owen manages the Board-approval event and the AT1 holder notification framework. Bea produces the BA-return suite from which the MDA is derived. Vera audits the distribution governance pathway: a distribution proceeding without a `CapitalDistributionApproved` event is a Vera Critical finding.

### Breach

Any distribution made while the CET1 ratio is in breach of the MDA restriction is a regulatory breach reportable to the PA. Camille escalates immediately to Helena, Owen, and the CEO; the PA is notified under the applicable Banks Act provision `[citation: TBC]`. A `CapitalDistributionRestrictionBreached` event is emitted; the board is convened within the timeline set in the `capital-action-governance.md` procedure.

---

## 5. Stress-Testing Integration

**Owner:** Helena (Chief Risk Officer, governance) — programme; Camille (Chief Financial Officer, governance) — capital-side integration · **Approval:** BRC (CEO interim) for programme design; ICAAP cycle for scenario outcomes · **Cadence:** Annual full programme; quarterly at-a-glance update; triggered on material change · **Citation:** Banks Act 94 of 1990 + PA stress-testing guidance `[citation: TBC — Mira (Compliance / RegTech engineer, engineering — reports to Zara (Chief Compliance Officer, governance)) curatorship route for any discrete PA stress-testing directive]` + PA D4/2021 (`ORG-PR-38`; externally-facilitated liquidity stress simulation — reads across for scenario-coherence) + BCBS D295 *Stress testing principles* (October 2018) + `ORG-PR-12` (integrated stress testing, IN FORCE) + `ORG-PR-04` (RAS B2 management-buffer calibration is validated by the severely-adverse scenario)

### Purpose

Stress testing is the mechanism by which the Bank verifies that its capital targets remain adequate under conditions that are severe but plausible. It is not a backward-looking monitoring exercise; it is a forward-looking, prospective discipline that drives capital-target calibration (specifically, the B2 management-buffer sizing), informs the ICAAP narrative, and feeds the Recovery Plan early-warning indicators. The stress-testing programme is integrated across capital and liquidity: the same scenarios run on the stress-projection engine (W2 Slice 4) feed both the ICAAP capital narrative and the ILAAP liquidity narrative, ensuring coherence between the two documents.

This section defines the structure, governance, and linkage of the stress-testing programme as it relates to capital management. The full stress-testing programme — including market risk, credit risk, operational resilience, and climate scenarios — is governed under the Stress Testing Policy (per `ORG-PR-12`, IN FORCE). This section is the capital-management read-through of that programme: what the stress-testing programme produces that directly affects the capital targets, the ICAAP, and the distribution-control framework.

### Principles

- **Four-scenario set for capital-side testing.** The capital stress-testing programme runs four scenarios annually: (i) Base — current business plan; forward projection of RWA, earnings, and capital ratios under the budget plan; (ii) Adverse — a moderately severe shock calibrated against historical SA financial-sector stress periods (e.g., 2015–2016 currency crisis; 2020 COVID shock); (iii) Severely adverse — a severe shock representing a major SA or global financial-system event; calibrated to ensure it is the most demanding scenario the Bank faces without being implausibly extreme; (iv) Reverse — works backward from a threshold (CET1 breaching B1) to identify what combination of shocks would cause failure. The reverse stress test identifies key vulnerabilities and informs Risk appetite calibration.

- **Scenarios are consistent across capital and liquidity.** Per the W2 Slice 1 framework (§1.2), the capital-stress scenarios must reconcile with the liquidity-stress scenarios: a market shock that reduces CET1 also affects LCR (collateral values, rollover costs, counterparty credit stress). Rohan's stress-projection engine runs the scenarios on a single event-substrate, ensuring the capital-side and liquidity-side projections are the same scenario, not independently authored ones. Divergence between the ICAAP capital-stress projection and the ILAAP liquidity-stress projection for the same scenario is a Vera finding.

- **Three-year forward projection.** Capital ratios are projected over a three-year horizon under each scenario. The projection covers: RWA evolution (credit risk, market risk, operational risk); net income (net interest income, trading income, operating costs, provisions); capital distributions (under the MDA framework); and any assumed capital-action responses. The projection is produced by Bea's RWA engine and Rohan's stress-projection engine as `CapitalProjectionGenerated { horizonYears: 3, scenarios[] }` events.

- **B2 calibration validation.** The severely-adverse scenario is the primary test of the B2 management buffer. If the severely-adverse scenario projects the CET1 ratio below B1 at any point in the three-year horizon without a capital action, the B2 calibration is insufficient and must be revised upward. The Slice 2 calibration brief (Helena and Rohan, with Bea) uses the stress-projection engine output to size the buffer adequately. Post-licence-day, the annual ICAAP cycle re-tests the B2 buffer against the current severely-adverse scenario; if the buffer is consumed in the severely-adverse case, a recalibration is proposed to the CEO and BRC.

- **Pillar 2A self-assessment from stress.** The Pillar-2 add-on computation (§3.1.5 of the W2 framework) uses the stress-projection engine to quantify: (i) concentration risk (single-name + sector); (ii) IRRBB (interest rate risk in the banking book per BCBS D335 *Standards: IRRBB*, April 2016); (iii) model risk; (iv) residual operational risk above Pillar 1. The sum of these components is the Bank's internal Pillar 2A self-assessment, presented in the ICAAP narrative. Rohan authors the Pillar-2 add-on computation as `Pillar2AddonComputed { components[], totalAddon }` events.

- **Climate scenario analysis from year one.** Per PA Guidance Note 1 of 2024 (G1/2024, climate-risk prudential framework `[citation: TBC — Mira curatorship route; exact reference confirmed in obligations register as `ORG-PR-22`]`), the Bank includes climate scenario analysis in its stress-testing programme from the first ICAAP cycle. The climate scenario is initially qualitative (narrative-form) in the ICAAP; quantitative integration follows as the climate-risk substrate matures. Helena owns the climate scenario design; Rohan integrates it into the stress-projection engine.

- **Independent validation before ICAAP submission.** The stress-projection engine is a Tier 1 model under the Model Risk Policy (per `ORG-PR-12` and the Model Risk Policy's three-tier classification). Nadia validates the stress-projection engine before each ICAAP submission. The `ModelValidationCompleted { modelId: "stress-projection-engine", modelVersion, findings[] }` event is a prerequisite for the `IcaapBoardAttested` event. Any material model findings are disclosed in the ICAAP narrative.

- **Externally-facilitated PA stress simulation.** PA D4/2021 (`ORG-PR-38`) requires participation in PA-coordinated industry-wide liquidity stress simulations. The Bank's internally-run capital stress scenarios are designed to be compatible with the PA stress-simulation framework; where the PA prescribes specific scenario parameters for the industry simulation, those parameters are incorporated into the internally-run adverse or severely-adverse scenarios for coherence. Helena coordinates with the PA on scenario parameters per the annual PA-facilitated simulation schedule.

- **Stress results feed the ICAAP and the RAS.** The stress-projection outputs are not standalone; they feed back into: (a) the ICAAP capital narrative (§3.1.6 and §3.1.7 of the W2 framework); (b) the RAS B2 calibration (§5.4 of the W2 framework); (c) the Recovery Plan early-warning indicator thresholds (§3.3.3 of the W2 framework). The RAS is recalibrated if the stress results reveal that any RAS line is miscalibrated against the actual risk profile.

### Roles

Helena (Chief Risk Officer, governance) owns the stress-testing programme for the ICAAP integration: scenario design and calibration, Pillar-2 add-on computation, recovery-indicator linkage. Rohan (Risk engineer, engineering) builds and operates the stress-projection engine and produces the `CapitalProjectionGenerated` and `Pillar2AddonComputed` events. Camille integrates the stress outputs into the capital-side ICAAP sections: capital trajectory, MDA framework application, distribution-control implications. Nadia validates the stress-projection engine. Vera assures the stress-test governance pathway (scenario completion, validation pre-ICAAP, BRC review). Thandiwe (Chief Audit Executive, governance) receives the Vera stress-test assurance output through the Audit Forum.

### Breach

Failure to complete a planned stress-test cycle before the ICAAP submission deadline is reportable to the BRC. Failure of the severely-adverse scenario (i.e., the projection shows CET1 below B1 within the three-year horizon without a capital action) is a Board-level finding: Helena and Camille escalate immediately to the CEO with a capital-action proposal. A reverse stress finding that identifies a realistic path to capital failure requires a Board discussion and, if necessary, a modification of the Business Plan or the risk appetite.

---

## 6. Obligations Closure Table

The following obligations-register rows are closed or partially closed by this policy. Status and PARTIAL notation per the obligations-register convention.

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-PR-01` | Maintain capital adequacy ≥ PA regulatory minimum (CET1, AT1, T2) | **IN FORCE** — closed | §3 (Capital Adequacy Targets), §1 (Policy Principles), §1.4 (Breach) |
| `ORG-PR-02` | Apply Pillar 2A add-ons set by PA | **IN FORCE** — closed | §3 (Pillar 2A add-on principle), §2 (ICAAP governance — Pillar 2A self-assessment) |
| `ORG-PR-03` | Hold capital conservation buffer + CCyB where required | **IN FORCE** — closed | §3 (CCB and CCyB principles), §4 (MDA framework) |
| `ORG-PR-04` | CET1 management buffer ≥ +1.5pp above PA minima + 2A + CCB (RAS B2) | **PARTIAL** (B2 calibration deferred to W2 Slice 2) — partially closed | §3 (RAS B2 principle), §5 (B2 calibration validation principle) |
| `ORG-PR-05` | Maintain leverage ratio ≥ PA minimum | **IN FORCE** — closed | §3 (Leverage ratio principle), §1.4 (Breach taxonomy — Alert at 25bps) |
| `ORG-PR-13` | Submit annual ICAAP to PA | **IN FORCE** (annual cycle) — closed | §2 (ICAAP Governance — full section) |
| `ORG-PR-37` | PA D5/2021 Capital Framework (supersedes D4/2020); CET1/T1/Total minima; Pillar 2A; CCyB; CCB; D-SIB | **IN FORCE** — closed | §1, §3, §4, §5 throughout |
| `ORG-PR-44` | PA D3/2023 Regulatory treatment of accounting provisions (IFRS 9 ECL CET1/T2/specific-vs-general) | **IN FORCE** — closed | §1 (IFRS 9 provisions read-through principle) |

---

## 7. Substrate Dependencies and Gaps

Per the events-first authoring rule (Principle 1), gaps are not hidden; they are the work for downstream W2 slices.

### 7.1 Substrate currently under construction

- **RWA engine (W2 Slice 3, Bea and Camille).** Produces credit, market, and operational RWA from the event substrate; generates BA-100/300/325/326 returns in SARB schema. Discharge exit signal: `RwaComputed { creditRwa, marketRwa, operationalRwa }` event on synthetic Q4 fixture; recon `recon:ba-form-schema-validation` green.
- **Stress-projection engine (W2 Slice 4, Rohan and Helena and Nadia).** Produces 3-year forward capital projections under base/adverse/severely-adverse/reverse scenarios; Pillar-2 add-on computation. Discharge exit signal: `StressScenarioRun { scenarioId, horizon: 3y, severity }` event; `ModelValidationCompleted { modelId: "stress-projection-engine" }` event.
- **RAS B2 calibration (W2 Slice 2, Helena and Rohan and Bea).** Ratifies the +1.5pp management buffer against peer-bank range, stress-shortfall analysis, and commercial optionality. Discharge exit signal: `RasLineCalibrated { lineId: "B2" }` event; `ORG-PR-04` lifted to `IN FORCE`.

### 7.2 Procedures planned but not yet authored

- `Procedures/by-policy/capital-framework-basel-iii.md` — capital-framework procedure per `ORG-PR-37` research-findings doc §7.
- `Procedures/by-policy/capital-action-governance.md` — capital-action governance procedure (Camille § 13 from Capital Plan v1).
- `Procedures/by-policy/regulatory-treatment-of-accounting-provisions.md` — `ORG-PR-44` per research-findings doc §7.

### 7.3 Citation gaps (TBC)

Per Principle 2, no sub-clause indices or directive sub-sections are invented. The following are `[citation: TBC]` until Imani (Legal-as-code engineer, engineering) + external counsel ratify them at the licence-application gate:

1. Reg 38 sub-clause indices for the ICAAP governance, annual-submission, and PA-notification obligations.
2. Banks Act notification-deadline provision for capital-adequacy breaches.
3. PA D5/2021 precise MDA quartile-table reference and numerical minimum ratios.
4. BCBS AT1 and T2 eligibility criteria references within the Basel III/IV framework.
5. PA D5/2021 current CCyB rate for South Africa.
6. Any discrete PA stress-testing directive (per `ORG-PR-38` + Mira curatorship).

---

## 8. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-11 | Camille (Chief Financial Officer, governance) + Helena (Chief Risk Officer, governance) | Initial policy authored. Five sections: (1) Overarching Policy — Board approval, Banks Act + Reg 38 + PA D5/2021 + BCBS citation, ten principles, roles, three-severity breach taxonomy; (2) ICAAP Governance — Helena/Camille ownership split, annual event-pattern cycle, material-change re-run, PA submission as typed event, consolidated/standalone basis, independent validation pre-condition, eight governance principles; (3) Capital Adequacy Targets — three-layer architecture (Pillar 1 + 2A floor; RAS B1; RAS B2 +1.5pp pending calibration), nine target principles, leverage ratio, D-SIB surcharge conditional non-applicability; (4) Capital Distribution Controls — MDA quarterly computation, AT1 coupon discretion, B1 breach suspension, Distribution Impact Assessment requirement, T2 call governance, recovery-plan linkage, six distribution principles; (5) Stress Testing Integration — four-scenario set, capital/liquidity coherence, three-year projection horizon, B2 calibration validation, Pillar 2A self-assessment from stress, climate scenario, independent validation pre-condition, PA externally-facilitated simulation linkage. Obligations closure table: ORG-PR-01 to ORG-PR-05, ORG-PR-13, ORG-PR-37, ORG-PR-44. Substrate and citation gaps explicitly named per Principle 2. Identity discipline per CLAUDE.md "Dispatch discipline" observed throughout. |
