---
policy-id: operational-resilience-policy
title: Operational Resilience Policy v1
version: "1"
status: IN FORCE
owner: Devon (Chief Operating Officer, governance)
effective-from: "2026-05-13"
next-review: "2027-05-13"
citations:
  - Banks Act 94 of 1990
  - Regulations Relating to Banks 2012 (as amended)
  - PA D4/2023 (Operational Resilience Framework)
  - BCBS Principles for Operational Resilience (August 2021)
  - IOSCO Operational Resilience Guidance (2021)
author: Devon (Chief Operating Officer, governance) + Helena (Chief Risk Officer, governance)
date: 2026-05-13
summary: Standalone Operational Resilience Policy covering Important Business Service identification, impact tolerance calibration, severe-but-plausible scenario testing, annual self-assessment, relationship with BCP/DR and Operational Risk frameworks, third-party resilience assessment, and governance structure. Closes obligations ORG-PR-18 and ORG-PR-45. LICENCE-BIND.
decision-required: false
riskTaxonomy:
  - RT-OR
  - RT-BC
  - RT-CY
obligations:
  - ORG-CS1-004
  - ORG-CY-01
  - ORG-CY-03
  - ORG-CY-08
---

# Operational Resilience Policy v1

> **Authors.** Devon (Chief Operating Officer, governance) — lead; Helena (Chief Risk Officer, governance) — co-author (risk-framework integration, ICAAP resilience narrative).
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10); `D-MARKETS-SCHEMA-FOUNDATION` (CEO-approved 2026-05-07). Implements PA D4/2023 operational-resilience framework obligations per the no-pause rule — CLAUDE.md "Operating procedures".
> **Obligations closed.** `ORG-PR-18` (identify Important Business Services; set impact tolerances; test scenarios); `ORG-PR-45` (comply with PA D4/2023 operational resilience framework).
> **Status.** LICENCE-BIND. The PA D4/2023 framework and the Important Business Service mapping must be in place at the time of licence application. Build-phase operationalisation is the preparation for compliance, not compliance itself (per `project_rules_bind_at_commencement.md` memory, 2026-05-07). The resilience-substrate (IBS register, impact-tolerance events, scenario-test harness) is under construction per the W-phase roadmap.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Operational Resilience Policy — Overarching

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) — IBS list and impact tolerances require Board sign-off; the annual self-assessment requires Board attestation · **Cadence:** Annual IBS review + tolerance calibration; annual scenario test; annual self-assessment; triggered on material change to the Bank's business model, technology infrastructure, or third-party landscape · **Citation:** Banks Act 94 of 1990 (operational-risk management mandate) + Regulations Relating to Banks 2012 (as amended) — Reg 38 (Pillar 2 operational-risk governance) `[citation: TBC — precise Reg 38 sub-clause indices for operational resilience; Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate]` + PA Directive 4 of 2023 (D4/2023 — Operational Resilience Framework; `ORG-PR-45`) + BCBS *Principles for Operational Resilience* (August 2021) `[citation: TBC — precise BCBS document reference]` + IOSCO *Operational Resilience Guidance* (2021) `[citation: TBC]` + `ORG-PR-18` (IBS identification, tolerance-setting, scenario-testing obligations)

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") identifies, measures, manages, and tests its operational resilience — the ability of the Bank to prevent, adapt to, respond to, recover from, and learn from operational disruptions. The policy implements the PA D4/2023 Operational Resilience Framework and establishes the bank-specific governance structure for identifying Important Business Services (IBS), calibrating impact tolerances, conducting scenario testing, and submitting the annual self-assessment to the PA.

Operational resilience is an outcome-based discipline. The central question is not "what processes do we have to recover from disruption?" but "can we continue to deliver our Important Business Services within the impact tolerances our Board has set, even during a severe-but-plausible disruption?" This shifts the focus from the inputs (recovery time objectives, recovery point objectives, hot-standby systems) to the outcomes experienced by clients, market participants, and the financial system. BCP/DR capabilities (§6 of this policy) are the instruments that deliver resilient outcomes; this policy governs the outcomes.

The Bank is an institutional-only, global-markets trading bank. Its Important Business Services are not retail-payment-facing; they involve institutional counterparties operating in the OTC derivative, repo, and bond and equity markets. The impact of IBS disruption falls on: counterparties whose positions remain unhedged; market integrity (if the Bank is a price-maker in a thin market); the Bank's own financial soundness (if margin calls go unmet or regulatory returns are not submitted); and the PA's supervisory ability (if reporting is disrupted).

This policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). Procedures under this policy operationalise the IBS assessment, tolerance-testing, and scenario-testing processes. The resilience-substrate (IBS register in the event log, impact-tolerance calibration events, scenario-test harness) is the system capability layer. The policy does not reproduce regulatory text; it anchors management choices above the regulatory floor.

### Principles

- **Outcome-over-input discipline.** The Bank measures resilience by whether it can deliver IBS within impact tolerances during disruptions, not solely by whether recovery capabilities exist. Input-side metrics (RTO, RPO, system availability) are relevant but subordinate to the outcome question.
- **Board ownership of tolerances.** Impact tolerances are set by the Board (CEO interim under `D-THIN-HUMAN-LAYER-MINIMUM`). Management operates within Board-set tolerances; management does not set tolerances for itself. Tolerance recalibration requires Board approval.
- **Annual review cycle.** The IBS list and tolerance schedule are reviewed at least annually and on material change to the business model, technology stack, or third-party landscape. Board re-approval is required after each review, even where no changes are proposed.
- **Events-first resilience records.** All resilience governance events — IBS identification, tolerance calibration, scenario-test results, disruption incidents, remediation actions — are recorded as typed events in the event log (Principle 1). Markdown reports are renders of those events, not independent records.
- **Severe-but-plausible as the testing standard.** Scenario tests use scenarios that are severe but plausible — not the worst conceivable outcome, but stressful enough to challenge the Bank's resilience genuinely. The test programme is designed by Devon (Chief Operating Officer, governance) and Helena (Chief Risk Officer, governance) jointly, approved by the Board.
- **Third-party resilience is the Bank's responsibility.** A disruption at a critical vendor does not excuse the Bank from delivering its IBS within tolerances. The Bank assesses its critical vendors' resilience as part of the IBS tolerance assessment, maintains credible exit plans, and requires vendors to cooperate with scenario testing.
- **No siloed resilience planning.** The operational resilience framework is integrated with the Operational Risk Policy, the BCP/DR programme, the ICAAP operational-risk chapter, and the PA's supervisory engagement process. Siloed, non-integrated resilience planning is a governance failure.
- **Transparency to the PA.** The annual self-assessment is submitted to the PA on request and forms part of the SREP engagement. The Bank does not minimise or downplay resilience gaps in the self-assessment; honest identification of gaps with credible remediation plans is the basis for a productive PA relationship.

### Roles

Devon (Chief Operating Officer, governance) is the policy owner and chair of the Operational Resilience Sub-Committee (ORSC), a standing sub-committee of EXCO. Devon's responsibilities include: owning the IBS identification process; chairing the annual IBS review; commissioning and reviewing scenario tests; producing the annual self-assessment; reporting operational resilience status to EXCO and the Board. Devon is the first point of contact for the PA on D4/2023 compliance.

Helena (Chief Risk Officer, governance) is the co-author and holds the operational-risk dimension of the resilience framework. Helena's role includes: owning the RCSA (Risk and Control Self-Assessment) entries for IBS-specific risks; ensuring the ICAAP operational-risk chapter incorporates resilience findings; reviewing scenario-test designs against the broader stress-testing programme for coherence; and escalating resilience concerns to the BRC.

Raj (Platform reliability and infrastructure engineer, engineering — reports to Devon) is the system operator for the resilience substrate: the IBS register event store, the scenario-test harness, and the real-time IBS availability dashboard. Raj produces the `IbsAvailabilityMonitored { ibsId, status, toleranceUtilisation }` events in the event log.

Camille (Chief Financial Officer, governance) provides financial-impact input to IBS tolerance calibration, specifically where disruption to payment settlement or regulatory reporting creates financial exposures or capital-adequacy implications.

Imani (Legal-as-code engineer, engineering) provides legal-risk input to the third-party resilience assessment, specifically the exit-plan legal enforceability for critical vendor contracts.

Owen (Company Secretary, governance) manages the Board secretarial framework for IBS list approval and self-assessment attestation, and records all ORSC resolutions as typed events.

Vera (internal audit engineer, reports functionally to Thandiwe (Chief Audit Executive, governance)) provides third-line assurance that the operational resilience framework is being followed: IBS list is Board-approved, tolerances are calibrated, scenario tests are conducted annually, and the self-assessment is accurate.

Zara (Chief Compliance Officer, governance) owns the PA engagement process on D4/2023 and ensures the annual self-assessment is submitted within the timeframe required by the PA. Mira (Compliance / RegTech engineer, engineering — reports to Zara) monitors the regulatory landscape for updates to the D4/2023 framework and any new PA guidance.

### Breach

Breach taxonomy under this policy is three-severity:

- **Alert (Amber).** An IBS disruption that, if it continued, would breach an impact tolerance within 50% of the remaining tolerance window; or a critical vendor declaring a service degradation that affects an IBS; or a scenario-test finding that reveals a material gap in resilience capability. Immediate notification to Devon, Helena, and the ORSC. Incident response plan activated; tolerance utilisation monitored every 30 minutes.
- **Hard Breach (Red).** An IBS disruption that exceeds 80% of the impact tolerance window without recovery; or failure to conduct the annual scenario test within the Board-approved testing schedule; or failure to submit the annual self-assessment within the PA's required timeline. Immediate notification to Devon, Helena, EXCO, and CEO. Remediation actions initiated within four hours for an active disruption; corrective plan submitted to the Board within five business days for governance failures.
- **Critical (Critical-Red).** An IBS disruption that breaches the impact tolerance — i.e., the service has been unavailable beyond the tolerance period or has delivered below the tolerance threshold. Immediate CEO notification; PA notification under D4/2023 `[citation: TBC — D4/2023 reporting obligation and timeline; Imani + external counsel ratify at the licence-application gate]`; Board convened within 24 hours. A `IbsToleranceBreached { ibsId, disruptionStart, toleranceWindow, actualOutage }` event is emitted. Post-incident review is mandatory within 10 business days.

---

## 2. Important Business Services

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) — IBS list is a Board-owned document; changes require Board approval · **Cadence:** Annual review; triggered on material business model change · **Citation:** PA D4/2023 (`ORG-PR-18`, `ORG-PR-45`) + BCBS *Principles for Operational Resilience* 2021 (Principle 1 — IBS identification) `[citation: TBC]`

### Purpose

An Important Business Service (IBS) is a service that the Bank provides to its clients, counterparties, or the financial system, the disruption of which would cause intolerable harm to: (i) the Bank's counterparties and clients (inability to settle, margin calls unmet, positions unhedged); (ii) the integrity of the markets in which the Bank participates (price discovery disrupted, settlement gridlock); or (iii) the Bank's own financial soundness and regulatory standing (capital-ratio breach, regulatory return not submitted, PA supervisory access denied). The IBS list is the Bank's own judgment of where it matters most — it is not a system inventory.

### IBS Identification Methodology

The IBS identification process is conducted annually by Devon and Helena in consultation with the front office, technology, and legal functions, and approved by the Board. The process steps are:

1. **Business service mapping.** Identify all services the Bank provides (to counterparties, markets, the PA, and itself) and map them to underlying processes, technology systems, and critical vendors. The output is a business-service map, maintained as `BusinessServiceMapped { serviceId, name, counterpartyImpact, marketIntegrityImpact, regulatoryImpact }` events.
2. **Impact assessment.** For each service, assess the harm that would result from disruption at various durations (1 hour, 4 hours, 24 hours, 1 week). Harm categories are: financial loss to counterparties; operational disruption to counterparties; market-integrity harm; regulatory non-compliance by the Bank; financial-soundness harm to the Bank (capital, liquidity). The assessment is qualitative at v0; quantitative harm metrics are added as the substrate matures.
3. **IBS selection.** Services where disruption would cause intolerable harm within a short duration are designated IBS. The IBS designation requires ORSC recommendation and Board approval. The designation is recorded as `IbsDesignated { ibsId, name, rationaleForDesignation, boardApprovalDate }` event.
4. **IBS list Board approval.** The full IBS list is presented to the Board (CEO interim) annually for approval. The Board-approved `IbsListApproved { ibsIds[], boardApprovalDate, version }` event is the canonical reference for the current IBS list.

### Bank's Important Business Services (v1)

The Bank's v1 IBS list, approved by the Board (CEO interim), consists of the following five services:

**IBS-01: OTC Derivative Execution and Confirmation.** The service of transacting, confirming, and booking OTC derivative trades (interest rate swaps, FX forwards, credit default swaps, and any other OTC derivatives within the Bank's product set) on behalf of the Bank's institutional counterparties. Disruption to this service leaves counterparties' risk positions unhedged and the Bank with unbooked or unconfirmed trades, creating market-risk and counterparty-credit-risk exposure. The service encompasses: pre-trade credit-limit check; trade execution; trade confirmation via SWIFT or electronic confirmation platform; trade booking to the trade management system (TMS); post-trade ISDA Master Agreement and CSA reconciliation.

**IBS-02: Payments and Settlement.** The service of making and receiving payments to settle OTC derivative margin calls, bond and equity DVP settlements, and repo cash flows, via the Bank's payment agent (correspondent bank) using the NPS RTGS. Disruption to this service means the Bank cannot meet margin obligations (a default trigger under ISDA CSA terms), cannot settle bond or equity purchases, and cannot meet its payment-agent commitments. The service encompasses: margin-call computation and initiation; SWIFT payment instruction to the correspondent bank; RTGS payment via the correspondent bank; DVP settlement via the CSD (Strate) through the sponsor bank's CSD membership.

**IBS-03: Margin Management.** The service of computing variation margin (VM) and initial margin (IM) obligations under ISDA CSA / UMR (Uncleared Margin Rules) for all bilateral OTC derivative netting sets; making and receiving margin calls; and managing the collateral pool (eligible securities and cash). Disruption to this service means the Bank cannot compute its margin obligations (regulatory and contractual breach risk), cannot make calls (credit exposure builds uncollateralised), and cannot respond to counterparty calls (potential default). The service encompasses: daily mark-to-market of all netting sets; VM and IM computation (SA-CCR and SIMM `[citation: TBC — ISDA SIMM version reference]`); margin call initiation and monitoring; collateral eligibility check and substitution.

**IBS-04: Regulatory Reporting.** The service of producing and submitting all regulatory returns required by the PA and other regulators on the Bank's prescribed submission schedule. The returns in scope include: BA 100 (capital adequacy), BA 300 (market risk), BA 325/326 (counterparty credit risk), BA 600 (large exposures), BA 900 (liquidity), and any other SARB-prescribed returns as they become applicable. Disruption to this service means the Bank is in regulatory non-compliance and the PA loses supervisory visibility into the Bank's position, which is an independent harm distinct from any financial-market harm. The service encompasses: data extraction from the event log; BA-form generation; sign-off by Camille; submission to PA via the SARB SubmissionNET portal `[citation: TBC — SubmissionNET reference]`.

**IBS-05: Client Data Management.** The service of managing, securing, and providing access to institutional counterparty data — KYC records, signed legal agreements (ISDA Masters, GMRAs, CSAs), trade data, and position data — in a manner that preserves data integrity, confidentiality, and regulatory accessibility. Disruption to this service means the Bank cannot perform KYC checks (anti-financial-crime obligation breached), cannot verify netting enforceability (credit-risk mitigation invalidated), and cannot respond to PA or FIC data requests (supervisory non-compliance). The service encompasses: counterparty onboarding data store; ISDA/GMRA agreement register; position record access; event log data integrity; POPIA s.19–22 data-protection controls.

### IBS Mapping to Underlying Resources

For each IBS, the following resource mapping is maintained and reviewed annually:

| IBS | Critical systems | Critical third parties | Key processes | Data flows |
|---|---|---|---|---|
| IBS-01 OTC Derivative Execution | TMS, risk engine, SWIFT gateway | Confirmation platform, SWIFT network | Pre-trade limit check; booking | Trade confirmations, TMS events |
| IBS-02 Payments/Settlement | Payment instruction system, correspondent bank RTGS access | Sponsor bank (payment agent), NPS RTGS (via correspondent), Strate | SWIFT instruction, RTGS, DVP | SWIFT MT/MX messages, Strate DVP messages |
| IBS-03 Margin Management | SA-CCR engine, SIMM calculator, collateral system | Counterparties (margin agreement), custodian | Daily VM/IM run, call initiation | Margin call events, CSA data |
| IBS-04 Regulatory Reporting | BA-form generator, event log | SubmissionNET (SARB), PA | Data extraction, sign-off, submission | BA-form files, PA acknowledgement |
| IBS-05 Client Data | Event log, document store, POPIA controls | Cloud provider (Azure), identity provider | Counterparty onboarding, KYC, access control | Party register events, document store |

---

## 3. Impact Tolerances

**Owner:** Devon (Chief Operating Officer, governance) — tolerance calibration; Helena (Chief Risk Officer, governance) — risk-framework coherence · **Approval:** Board (CEO interim) — impact tolerances are Board-approved; management cannot set its own tolerances · **Cadence:** Annual calibration review; triggered on material change to an IBS or its underlying resources · **Citation:** PA D4/2023 (`ORG-PR-18`, `ORG-PR-45`; impact tolerance requirement) + BCBS *Principles for Operational Resilience* 2021 (Principle 2 — tolerance-setting) `[citation: TBC]`

### Purpose

An impact tolerance is the maximum level of disruption to an IBS that the Board is prepared to tolerate. It is expressed as a measurable outcome: the disruption duration and/or the degradation in service level beyond which the harm is intolerable. Impact tolerances are not recovery-time objectives (RTOs); they are Board-level limits on harm, not management-level system-restoration targets. Management operates within tolerances; internal RTOs and RPOs must be set substantially within the tolerance window to allow for realistic recovery time.

### Tolerance Framework

Impact tolerances are calibrated using the following dimensions:

- **Duration.** The maximum time for which the IBS may be unavailable or substantially degraded. Expressed as: "[IBS disruption of more than X hours in a single event] is intolerable."
- **Severity.** The maximum degradation in service quality during a partial-disruption scenario. Expressed as: "[throughput below Y% of normal capacity for more than Z hours] is intolerable."
- **Recovery point.** Where data integrity is a component of the IBS (particularly IBS-05), the maximum age of the last good data snapshot at the point of recovery. Expressed as: "data loss of more than W hours of transactions is intolerable."

### v1 Impact Tolerances (Board-Approved)

The following impact tolerances are the Bank's v1 calibration, Board-approved on 2026-05-13. The calibration is preliminary — the full quantitative calibration, informed by a first scenario-test cycle, will be submitted for Board re-approval after the initial scenario-testing is complete.

| IBS | Duration tolerance | Severity tolerance | Recovery point | Rationale |
|---|---|---|---|---|
| IBS-01 OTC Derivative Execution | Disruption > 4 hours on any trading day is intolerable | Throughput < 50% of normal booking capacity for > 2 hours is intolerable | N/A (trade booking is event-driven, not batch) | Unhedged positions build linearly with disruption duration; 4 hours is the period within which most intraday hedging corrections can be deferred without exceeding market-risk appetite |
| IBS-02 Payments/Settlement | Delay in any payment > 4 hours from the contractual payment time is intolerable | Any failure to settle > 10% of daily settlement value on a given day is intolerable | N/A (payment instruction events are real-time) | Margin-call default under ISDA CSA typically triggers a 2-business-day cure period; 4-hour tolerance provides buffer for sponsor-bank RTGS escalation |
| IBS-03 Margin Management | Failure to compute and initiate daily VM/IM calls by 12:00 SAST on any trading day is intolerable | Any systematic error in VM/IM computation affecting > 5% of netting sets is intolerable | N/A (computation is daily, event-driven) | CSA margin-call timing is contractually prescribed; a missed daily call is a CSA breach; 12:00 SAST allows time for dispute resolution before settlement cut-off |
| IBS-04 Regulatory Reporting | Failure to submit any BA-form return within the PA-prescribed deadline is intolerable | Any material error in a submitted return that requires resubmission within 24 hours is intolerable | Data loss of > 24 hours of transactions is intolerable for return accuracy | PA return deadlines are non-negotiable regulatory obligations; non-submission is an immediate regulatory breach |
| IBS-05 Client Data | Unavailability of counterparty KYC and agreement data for > 8 hours is intolerable | Data corruption affecting > 1% of Party register records is intolerable | Data loss of > 1 hour of onboarding events is intolerable | KYC and ISDA agreement data is needed for pre-trade credit-limit checks (feeds IBS-01 and IBS-03); 8-hour tolerance reflects the intraday trading-session window |

### Tolerance Calibration Principles

- **Board sets, management implements.** Tolerances are Board-level decisions, not management-level optimisation targets. Management may propose revisions to the Board based on evidence from scenario testing, operational experience, or changes to the underlying business; the Board retains decision authority.
- **Internal RTOs and RPOs must be within tolerance.** The BCP/DR programme (§6) must set internal RTOs substantially within the tolerance windows — typically at 50% of the tolerance duration to allow for realistic recovery time. An IBS-01 tolerance of 4 hours means the internal RTO for the TMS must be ≤ 2 hours.
- **Quantitative calibration deferred to first scenario cycle.** The v1 calibrations above are based on regulatory minimum-harm analysis and market-convention defaults. After the first scenario-test cycle (§4), Devon and Helena will produce a quantitative calibration brief for Board review, incorporating scenario-test outcomes and any operational incidents observed during the build phase.
- **Tolerance events in the log.** Each Board-approved tolerance calibration is recorded as a `IbsToleranceCalibrated { ibsId, durationTolerance, severityTolerance, recoveryPoint, boardApprovalDate, version }` event. The event is the canonical tolerance record; this policy is a render.

---

## 4. Scenario Testing

**Owner:** Devon (Chief Operating Officer, governance) — programme lead; Helena (Chief Risk Officer, governance) — scenario design and risk coherence · **Approval:** Board (CEO interim) for scenario-test programme design; EXCO for individual test execution · **Cadence:** Annual; triggered on material change to the IBS landscape or the Bank's technology/third-party profile · **Citation:** PA D4/2023 (`ORG-PR-18`; scenario-testing requirement) + BCBS *Principles for Operational Resilience* 2021 (Principle 5 — scenario testing) `[citation: TBC]`

### Purpose

Scenario testing is the mechanism by which the Bank verifies that it can deliver its Important Business Services within the Board-set impact tolerances during disruptions that are severe but plausible. Scenario testing is not a disaster-recovery drill; it tests the whole system — people, processes, technology, vendors, and governance — against the tolerance standard. The test programme must be challenging enough to reveal real weaknesses; a programme designed to pass is not a programme that serves the Bank's resilience.

The scenario test programme is conducted at least annually and its results inform: (i) the quantitative tolerance calibration (§3); (ii) the BCP/DR programme requirements (§6); (iii) the ICAAP operational-risk chapter (via Helena); and (iv) the PA annual self-assessment (§5). Scenario-test results are not managed-messaging; they are an honest assessment of the Bank's resilience gaps and the remediation actions planned to close them.

### Scenario Test Programme

The Bank's annual scenario test programme covers the following severe-but-plausible scenarios. The programme is designed jointly by Devon and Helena and approved by the Board (CEO interim) before execution.

**Scenario A — Cyber Attack on Core Infrastructure.** A ransomware or destructive-malware attack on the Bank's cloud-hosted core infrastructure (Azure tenant), disabling the TMS, event-store database, and payment-instruction system simultaneously. The scenario tests: time-to-detection; time-to-isolate affected systems; ability to restore IBS-01, IBS-02, and IBS-04 from clean backups within the tolerance windows; PA notification process; counterparty communication plan. The scenario is designed to test the boundary of the IBS-01 4-hour and IBS-02 4-hour tolerances. Cross-reference `Procedures/by-policy/severe-but-plausible-test.md` (planned) for the test execution procedure.

**Scenario B — Cloud Provider Outage.** A multi-hour outage of the Bank's primary Azure region (South Africa North), forcing failover to a secondary region (South Africa West) or to a degraded-capability operating mode. The scenario tests: failover trigger and governance; time-to-failover; capability in degraded mode; POPIA data-residency compliance during failover; sponsor-bank continuity coordination. The scenario challenges whether the Bank's Azure dependency is a single point of failure for IBS-01 through IBS-05, and whether the impact tolerances can be met if Azure region-level failover takes longer than the vendor SLA states.

**Scenario C — Key-Person Loss.** Simultaneous unavailability (planned or unplanned) of the personnel responsible for operating the SA-CCR engine, BA-form generator, and payment-instruction system — the core of IBS-02, IBS-03, and IBS-04. The scenario tests: documented run-books sufficient for a second-tier operator; cross-training coverage; escalation path if no operator is available within the tolerance window. Given the Bank's AI-agent-primary operating model (Principle 6), this scenario is designed to test the minimum-human-residual layer: which operations require a human decision and what is the fallback if that human is unavailable.

**Scenario D — Third-Party Failure — Sponsor Bank.** Disruption to the Bank's sponsor bank's payment-agency and CSD-access services, rendering IBS-02 and IBS-03 partially or fully inoperable. The scenario tests: the Bank's ability to divert payments to an alternative sponsor bank or correspondent; the time required to activate the exit plan; and whether the IBS-02 payment-settlement tolerance (4 hours) can be met given the practical time to switch sponsor banks. The sponsor-bank is a critical vendor for IBS-02; a credible exit plan is a tolerance-assessment requirement under D4/2023.

**Scenario E — Simultaneous IBS-01 and IBS-03 Degradation (Compound Disruption).** A scenario in which a market-stress event (sudden ZAR depreciation, SA sovereign spread widening) simultaneously increases OTC derivative mark-to-market values (driving up margin-call volumes beyond normal capacity for IBS-03) while a technology incident degrades the TMS booking rate for IBS-01. The compound scenario tests the interaction between IBSs: can the Bank manage a surge in IBS-03 while IBS-01 is degraded? Does the impact on IBS-03 tolerance worsen because IBS-01 is unavailable?

### Scenario Test Governance

- **Test design approval.** The ORSC recommends the annual test programme; the Board (CEO interim) approves it. A `ScenarioTestProgrammeApproved { year, scenarios[], boardApprovalDate }` event is emitted.
- **Pre-test baseline.** Before each test, Devon and Raj (Platform reliability and infrastructure engineer, engineering) confirm the current IBS availability baseline and the current state of the BCP/DR recovery capabilities. The pre-test baseline is a `ScenarioTestBaseline { scenarioId, ibsAvailabilityState, bcpDrReadiness }` event.
- **Test execution.** Each scenario is executed per the procedure in `Procedures/by-policy/severe-but-plausible-test.md` (planned). Test results are recorded as `ScenarioTestCompleted { scenarioId, testDate, ibsId, disruptionDuration, toleranceBreached: true | false, findingsCount }` events for each IBS tested in each scenario.
- **Post-test review.** Within 10 business days of each test, Devon and Helena produce a post-test review: what happened, whether tolerances were breached, root-cause analysis, and remediation actions with owners and timelines. The review is presented to ORSC and a summary to EXCO. A `ScenarioTestReviewApproved { scenarioId, findings[], remediationActions[], approvalDate }` event is emitted.
- **Remediation tracking.** Each remediation action from a scenario test is tracked to closure. The `RemediationActionClosed { actionId, scenarioId, closureDate, evidence }` event records closure. Open remediation actions are a standing agenda item at the ORSC monthly meeting.
- **Tolerance breach in testing.** If a scenario test reveals that the Bank cannot deliver an IBS within the Board-set tolerance, this is treated as a material resilience gap. Devon escalates immediately to the CEO and EXCO. The gap is disclosed in the annual self-assessment (§5). The Board (CEO interim) reviews the gap within 30 days of the test and either approves a remediation plan or recalibrates the tolerance to reflect the Bank's actual capability — with PA notification if the recalibration represents a material weakening.

---

## 5. Annual Self-Assessment

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** Board (CEO interim) attestation required before submission · **Cadence:** Annual; submitted to PA on request or per D4/2023 schedule `[citation: TBC — D4/2023 submission schedule; Zara (Chief Compliance Officer, governance) maintains the regulatory calendar]` · **Citation:** PA D4/2023 (`ORG-PR-45`; self-assessment submission obligation)

### Purpose

The annual self-assessment is the Bank's comprehensive account of its operational resilience: the IBS it has identified, the impact tolerances it has set, the scenario testing it has conducted, the gaps it has found, and the remediation actions it has planned. It is submitted to the PA on request and forms part of the SREP engagement on operational risk and resilience. The self-assessment is a Board-attested document; the Board's attestation records that the Board is satisfied the document accurately represents the Bank's resilience position, including its gaps.

### Self-Assessment Structure

The self-assessment comprises the following sections, authored by Devon with input from Helena (risk framework), Camille (financial-impact), and Zara (regulatory obligations mapping):

1. **IBS inventory.** The current Board-approved IBS list with the rationale for each designation and the business-service mapping to underlying processes, systems, and vendors.
2. **Impact tolerance schedule.** The Board-approved impact tolerances for each IBS, with the calibration basis and any changes from the prior year's assessment.
3. **Scenario testing outcomes.** A summary of the annual scenario test programme: scenarios tested, IBS outcomes, whether tolerances were breached, and the root-cause and remediation response to any breach.
4. **Resilience gaps and remediation plan.** An honest catalogue of known resilience gaps — IBS where the Bank's current capability does not yet meet the tolerance standard — with the remediation actions, owners, and target closure dates.
5. **Third-party resilience assessment.** An assessment of critical vendors' resilience and the Bank's exit-plan feasibility for each critical vendor (§7 of this policy).
6. **BCP/DR coverage summary.** A summary of BCP/DR programme coverage against each IBS and the internal RTO/RPO alignment with the impact tolerances (§6 of this policy).
7. **RCSA integration.** A summary of IBS-specific risk assessments from the RCSA (cross-reference to the Operational Risk Policy) and how they inform the tolerance calibration.

### Self-Assessment Governance

- **Board attestation.** The self-assessment is presented to the Board (CEO interim) before PA submission. The Board reviews the document, including any disclosed gaps, and attests to its accuracy. The attestation is recorded as a `OperationalResilienceSelfAssessmentAttested { year, boardAttestor, attestationDate, ibsIds[], tolerancesVersion, gaps[] }` event. No submission proceeds without this event in the log.
- **PA submission.** The self-assessment is submitted to the PA per the D4/2023 schedule `[citation: TBC]`. Zara manages the submission; Devon co-signs. A `OperationalResilienceSelfAssessmentSubmitted { year, submissionDate, documentHash }` event is emitted. The document is stored in the BLAKE3 content-addressed document store per `D-RMS-PHASE-1`.
- **Gap disclosure discipline.** The Bank does not suppress or minimise gaps in the self-assessment. Gaps are disclosed with the remediation plan and target dates. Helena and Vera independently verify that the gaps in the self-assessment are consistent with the scenario-test findings and the RCSA. A self-assessment gap list that is systematically less complete than the underlying evidence is a Vera Critical finding.
- **Annual cycle event.** The annual self-assessment cycle is anchored to the `OperationalResilienceCycleStarted { year }` event, emitted at the start of the annual review. The cycle ends with `OperationalResilienceSelfAssessmentSubmitted`. Owen manages the cycle secretarially.

---

## 6. Relationship with BCP/DR

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** Board (CEO interim) for the BCP/DR policy framework · **Cadence:** BCP/DR programme is maintained continuously; tested in conjunction with scenario tests · **Citation:** PA D4/2023 (`ORG-PR-45`) + Regulations Relating to Banks — Reg 38 `[citation: TBC]` + `ORG-PR-18` (IBS resilience outcomes)

### Purpose

Business Continuity Planning (BCP) and Disaster Recovery (DR) are the operational capabilities that enable the Bank to recover from disruptions and deliver its Important Business Services within the Board-set impact tolerances. This section describes the relationship between the operational-resilience outcome framework (this policy) and the BCP/DR capability programme.

### Principles

- **Resilience is the outcome; BCP/DR is the input.** The operational resilience framework asks: "can we deliver our IBS within tolerances during a disruption?" The BCP/DR programme asks: "how do we recover our processes and systems?" Both are required; neither is sufficient alone. A bank with excellent BCP/DR capabilities but miscalibrated impact tolerances may still cause intolerable harm. A bank with well-calibrated tolerances but inadequate BCP/DR will breach them.
- **IBS-to-RTO alignment.** For each IBS, the BCP/DR programme sets internal RTOs substantially below the Board-set impact tolerances. The alignment is reviewed annually by Devon and Raj (Platform reliability and infrastructure engineer, engineering) and disclosed in the annual self-assessment (§5). A misalignment — where the internal RTO is at or above the tolerance duration — is a material resilience gap.
- **BCP/DR testing within the scenario programme.** BCP/DR elements (failover, backup-restore, run-book execution) are tested as components of the annual scenario tests (§4). The scenario-test programme is designed to include a realistic test of each critical BCP/DR capability at least once per annual cycle.
- **Event-log resilience.** The Bank's event log is the canonical record of all business transactions and governance events (Principle 1). The BCP/DR programme must ensure the event log is recoverable to within the IBS-05 data-recovery-point tolerance (> 1 hour of data loss is intolerable). Azure Blob Storage replication and point-in-time restore capabilities (per `Principle 3 — cloud-native`) are the primary recovery mechanisms for the event log.
- **Minimum operating mode.** For each IBS, Devon and Raj define a minimum operating mode — the degraded-capability configuration in which the IBS can still deliver within tolerances. The minimum operating mode may involve manual workarounds, reduced throughput, or partial automation. The minimum operating mode is documented in the BCP plan and tested in the scenario programme.
- **Recovery from cloud-provider outage.** The Bank's Azure-primary posture (per `project_cloud_target_azure.md`) means that an Azure region-level outage is the most realistic multi-service failure scenario. The BCP/DR programme includes a documented and tested failover plan for each IBS to the Azure secondary region or to an alternative operating mode. Raj owns the failover engineering; Devon owns the governance framework.

---

## 7. Third-Party Resilience

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** BRC for the designation of critical vendors and approval of exit plans · **Cadence:** Annual third-party resilience assessment; exit-plan review every two years; triggered on vendor service degradation or contract renewal · **Citation:** PA D4/2023 (`ORG-PR-45`; third-party resilience obligation) + Regulations Relating to Banks — outsourcing provisions `[citation: TBC — precise outsourcing sub-clause in Regs Relating to Banks; Imani + external counsel ratify]` + BCBS *Principles for Operational Resilience* 2021 (Principle 6 — third-party dependencies) `[citation: TBC]`

### Purpose

The Bank's operational resilience is only as strong as its critical vendors' resilience. A disruption at the Bank's cloud provider, sponsor bank, or settlement infrastructure can prevent the Bank from delivering its IBS within tolerances — even if the Bank's own systems and processes are intact. This section establishes the Bank's approach to identifying critical vendors, assessing their resilience, managing contractual protections, and maintaining credible exit plans.

### Critical Vendor Identification

A vendor is designated a critical vendor where: (i) the vendor provides a service that is a significant dependency of one or more IBS; and (ii) the Bank could not reasonably substitute the vendor within the IBS impact-tolerance window without intolerable disruption. The critical vendor designation requires ORSC recommendation and BRC approval. A `CriticalVendorDesignated { vendorId, vendorName, ibsDependencies[], exitPlanFeasibility }` event is emitted on designation.

### v1 Critical Vendors

| Vendor | IBS dependency | Resilience concern | Exit-plan feasibility |
|---|---|---|---|
| Microsoft Azure (cloud provider) | IBS-01, IBS-02, IBS-03, IBS-04, IBS-05 | Multi-service dependency on a single cloud tenant; region-level outage affects all IBS simultaneously | Medium: Azure secondary-region failover available; full cloud-provider migration is 6–12 months. Mitigation: multi-region active-passive architecture |
| Sponsor bank (payment agent) | IBS-02, IBS-03 | NPS RTGS access (via correspondent) and CSD settlement depend on sponsor bank's own resilience; a sponsor bank failure or service suspension disrupts all payments | Low in short term: alternative sponsor bank requires 4–8 weeks to onboard; direct NPS participation not available to the Bank under the indirect-participant posture | 
| Strate (CSD) | IBS-02 | DVP settlement for SA bonds and equities operates through Strate's settlement system; Strate is an FMI with its own SARB-supervised resilience obligations | Not applicable: Strate is a designated FMI with no substitute; the Bank monitors Strate's own operational resilience disclosures |
| SWIFT network | IBS-01, IBS-02 | Trade confirmation and payment instruction delivery depend on SWIFT connectivity; a SWIFT gateway outage disrupts confirmation and payment channels | Medium: SWIFT has its own resilience framework; the Bank's direct fallback for payment instructions is sponsor-bank direct channel (non-SWIFT); trade confirmation fallback is bilateral phone + email (manual) |

### Third-Party Resilience Assessment

For each critical vendor, Devon produces an annual third-party resilience assessment covering:

1. **Vendor resilience review.** Review of the vendor's own resilience framework (PA regulatory status for supervised entities; SOC 2 Type II or equivalent for cloud providers; annual resilience report for FMIs). The review is based on publicly available disclosures, contractual audit rights, and direct vendor engagement.
2. **IBS impact analysis.** For each IBS that depends on the vendor, an assessment of the maximum tolerable outage at the vendor that would cause the Bank to breach its IBS impact tolerance. This calibrates the Bank's exposure to vendor disruption.
3. **Contractual protections.** Review of the Bank's contracts with the vendor for: uptime SLAs (and whether they align with the IBS tolerances); audit rights; resilience testing cooperation obligations; notification obligations in the event of a vendor-side disruption; and exit assistance on termination.
4. **Exit-plan assessment.** For each critical vendor, an assessment of whether the Bank can exit the vendor relationship and migrate to an alternative within a timeframe that does not permanently impair IBS delivery. Exit-plan feasibility is rated: High (< 4 weeks to viable alternative); Medium (4–12 weeks); Low (> 12 weeks or no viable alternative). Low-feasibility vendors are escalated to the BRC for risk-acceptance or remediation.

### Exit Plan Requirements

For each critical vendor, Devon maintains a documented exit plan. The exit plan includes: trigger conditions (when would exit be initiated?); the alternative vendor or capability (if one exists); the estimated migration timeline; the legal and contractual steps required to exit; and the minimum IBS operating mode during the migration period. Imani reviews exit plans for legal enforceability of termination provisions. Exit plans are reviewed every two years or on material vendor contract changes. A `ExitPlanApproved { vendorId, exitPlanVersion, brcApprovalDate, migrationTimeline }` event is emitted.

---

## 8. Relationship with Operational Risk Policy

**Owner:** Helena (Chief Risk Officer, governance) — Operational Risk Policy; Devon (Chief Operating Officer, governance) — Operational Resilience Policy · **Citation:** PA D4/2023 (`ORG-PR-45`) + Operational Risk Policy (planned)

### Principles

- **Operational resilience is a named sub-domain of operational risk.** Operational risk — the risk of loss from inadequate or failed processes, people, systems, or external events — includes operational resilience as a specific named risk category. The operational resilience framework governs the outcome dimension (can we deliver IBS within tolerances?); the operational risk framework governs the loss dimension (what is the frequency and severity of operational-risk losses?). Both are required; they are complementary, not alternative.
- **RCSA integration.** The IBS-specific risk and control assessments are incorporated into the Bank's Risk and Control Self-Assessment (RCSA) as a named sub-category. Helena ensures that IBS-specific risks are represented in the RCSA and that RCSA findings flow into the annual self-assessment (§5). The RCSA is owned by Helena; Devon provides the IBS operational context.
- **Operational risk capital.** The ICAAP operational-risk chapter (owned by Helena with Devon's input) includes the operational resilience framework as a material component of the Bank's operational-risk profile. Scenario-test findings that reveal material resilience gaps are incorporated into the operational-risk Pillar 2A self-assessment (as material risks not captured by the Pillar 1 SMA/BIA floor). This ensures that the capital framework reflects the Bank's actual operational resilience position.
- **Incident management overlap.** Operational-risk incidents (loss events, near-misses) and operational resilience incidents (IBS disruptions) overlap where the disruption also causes a financial loss. The Bank's incident management procedure (in `Procedures/by-policy/operational-risk-incident-management.md`, planned) handles both simultaneously: the incident is classified as an operational-risk event (for loss database and Pillar 2A purposes) and as an IBS disruption event (for tolerance monitoring and self-assessment purposes). Helena and Devon co-own the incident management framework.
- **Risk appetite alignment.** The Bank's Risk Appetite Statement (RAS) includes operational-resilience appetite lines (RT-OR and RT-BC) anchored to the IBS impact tolerances. The RAS tolerance lines are Helena's domain (CRO owns the RAS); the tolerance calibration is Devon's domain (COO owns the IBS assessment). The two must be consistent; Helena and Devon review alignment annually.

---

## 9. Governance and Reporting

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** Board (CEO interim) for governance framework · **Cadence:** ORSC monthly; EXCO monthly resilience dashboard; BRC quarterly; Board annual self-assessment · **Citation:** PA D4/2023 (`ORG-PR-45`) + Regulations Relating to Banks — Reg 38 `[citation: TBC]`

### Operational Resilience Sub-Committee (ORSC)

The Operational Resilience Sub-Committee (ORSC) is a standing sub-committee of EXCO, chaired by Devon (Chief Operating Officer, governance). The ORSC meets monthly and on an ad hoc basis for active disruption incidents. Members include: Devon (chair), Helena (Chief Risk Officer, governance), Raj (Platform reliability and infrastructure engineer, engineering), Zara (Chief Compliance Officer, governance), and the relevant front-office representative. Owen manages the secretarial framework; all ORSC resolutions are recorded as `OrscResolutionRecorded { meetingDate, resolutions[] }` events.

The ORSC is responsible for: monthly review of IBS availability metrics against tolerances; review of open scenario-test remediation actions; third-party resilience updates; escalation of active IBS disruptions to EXCO and the CEO.

### Reporting Cadence

- **Real-time.** IBS availability is monitored continuously by Raj's resilience substrate. A `IbsAvailabilityMonitored { ibsId, status: "normal" | "degraded" | "unavailable", toleranceUtilisation, timestamp }` event is emitted at least every 15 minutes during operating hours. Degraded or unavailable status triggers immediate escalation to Devon and Helena.
- **Monthly.** The ORSC meets monthly. Devon presents the monthly resilience dashboard: IBS availability metrics, tolerance headroom, open remediation actions, third-party incidents, and any new SWWR or concentration risks from Helena. A `OrscMonthlyReviewCompleted { month, ibsMetrics[], openRemediations[], alerts[] }` event is emitted.
- **Monthly to EXCO.** A summary operational-resilience report is provided to EXCO monthly. The report covers: IBS availability (RAG status against tolerances), material incidents in the month, critical vendor status, and scenario-test programme progress.
- **Quarterly to BRC.** The BRC receives a quarterly resilience report covering: tolerance calibration review; scenario-test programme status; third-party resilience assessment updates; RCSA integration outcomes; PA engagement updates. Helena presents the risk-framework integration elements; Devon presents the IBS and BCP/DR elements.
- **Annually to Board.** The annual self-assessment is presented to the Board (CEO interim) for attestation before PA submission (§5). The annual IBS list and tolerance schedule are presented for Board re-approval.
- **PA engagement.** Devon and Zara manage the PA relationship on D4/2023. The self-assessment is submitted per the D4/2023 schedule. Devon and Zara attend any PA-initiated resilience supervisory discussions. Material resilience incidents are notified to the PA per the D4/2023 notification obligation `[citation: TBC]`.

---

## 10. Exceptions and Escalation

**Owner:** Devon (Chief Operating Officer, governance) · **Cadence:** Event-triggered · **Citation:** PA D4/2023 (`ORG-PR-45`) + `ORG-PR-18`

### Principles

- **All IBS disruptions are recorded.** Any disruption to an IBS — whether or not it breaches a tolerance — is recorded as a `IbsDisruptionRecorded { ibsId, disruptionStart, disruptionEnd, cause, toleranceBreached: true | false, remediationActions[] }` event within one business day of the disruption ending. No disruption is oral-only.
- **Tolerance breach triggers PA notification.** Any tolerance breach triggers PA notification under D4/2023 `[citation: TBC]` within the prescribed period. Devon is responsible for notification; Zara manages the PA submission. The `PaNotificationSubmitted` event records the notification.
- **Post-incident review is mandatory.** Every tolerance breach, and any significant near-miss (disruption reaching > 80% of the tolerance window), triggers a mandatory post-incident review within 10 business days. Devon chairs the review; Helena provides the risk-framework integration. The review output is a `ScenarioTestReviewApproved` event (repurposed for incident reviews) or a purpose-built `IncidentReviewApproved { incidentId, rootCause, remediationActions[], ownerIds[], targetDates[] }` event.
- **Vera audit of unescalated disruptions.** Vera audits the event log for IBS disruptions not escalated per the escalation matrix. An unescalated tolerance breach is a Vera Critical finding reported to Thandiwe and the BRC.
- **Policy exception for planned maintenance.** Planned maintenance windows that would otherwise trigger a tolerance breach require ORSC pre-approval and counterparty notification where the IBS is client-facing. The maintenance window is recorded as a `PlannedMaintenanceApproved { ibsId, maintenanceWindow, orcApprovalDate }` event. PA notification is required if the planned maintenance window exceeds 50% of the tolerance duration.

---

## 11. Obligations Closure Table

The following obligations-register rows are closed by this policy.

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-PR-18` | Identify Important Business Services; set impact tolerances; test scenarios | **IN FORCE** — closed | §2 (IBS identification methodology and v1 IBS list), §3 (impact tolerances — framework and v1 calibration), §4 (scenario testing — programme and governance) |
| `ORG-PR-45` | Comply with PA D4/2023 operational resilience framework | **IN FORCE** — closed | §1 (Overarching Policy — D4/2023 citation and governance structure), §5 (self-assessment), §7 (third-party resilience), §9 (governance and PA engagement reporting) |

---

## 12. Substrate Dependencies and Gaps

Per the events-first authoring rule (Principle 1), gaps are not hidden; they are the work for downstream delivery phases.

### 12.1 Substrate currently under construction

- **IBS register and availability monitor (Raj, Platform reliability and infrastructure engineer, engineering).** Produces `IbsAvailabilityMonitored` events in real time for each IBS. Discharge exit signal: `IbsAvailabilityMonitored { ibsId: "IBS-01", status: "normal" }` event on a synthetic IBS fixture; recon `recon:ibs-availability-schema-validation` green.
- **Scenario-test harness (Raj + Devon).** Executes controlled disruption scenarios and records `ScenarioTestCompleted` events for each IBS. Discharge: `ScenarioTestCompleted { scenarioId: "A", ibsId: "IBS-01" }` event on a synthetic Scenario A dry run.
- **Self-assessment document generator (Devon + Zara).** Generates the annual self-assessment document from event-log state (IBS designations, tolerance calibrations, test results). Discharge: self-assessment document generated from synthetic events; document hash stored in BLAKE3 document store; `OperationalResilienceSelfAssessmentAttested` event emitted.

### 12.2 Procedures planned but not yet authored

- `Procedures/by-policy/severe-but-plausible-test.md` — scenario-test execution procedure for each of Scenarios A–E.
- `Procedures/by-policy/ibs-impact-tolerance-calibration.md` — annual tolerance review and calibration process.
- `Procedures/by-policy/third-party-resilience-assessment.md` — vendor resilience review and exit-plan assessment process.
- `Procedures/by-policy/operational-risk-incident-management.md` — incident classification and dual-reporting for operational-risk and resilience events.
- `Procedures/by-policy/bcp-dr-ibs-alignment.md` — BCP/DR RTO/RPO alignment review per IBS.

### 12.3 Citation gaps (TBC)

Per Principle 2, no sub-clause indices are invented. The following are `[citation: TBC]` until Imani + external counsel ratify at the licence-application gate:

1. Reg 38 sub-clause indices for operational resilience governance under Pillar 2.
2. PA D4/2023 — precise notification-deadline provision for IBS tolerance breaches; self-assessment submission schedule; full document citation.
3. BCBS *Principles for Operational Resilience* 2021 — precise document reference and individual principle numbering.
4. IOSCO Operational Resilience Guidance 2021 — precise document reference.
5. Regulations Relating to Banks — outsourcing sub-clause reference for critical-vendor obligations.
6. ISDA SIMM version reference for initial-margin computation in IBS-03.
7. SARB SubmissionNET portal reference for regulatory return submission in IBS-04.

---

## 13. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-13 | Devon (Chief Operating Officer, governance) + Helena (Chief Risk Officer, governance) | Initial policy authored. Twelve sections: (1) Overarching Policy — Banks Act + Reg 38 + PA D4/2023 + BCBS citations, eight principles (outcome-over-input, Board tolerance ownership, annual cycle, events-first, severe-but-plausible standard, third-party scope, no siloed planning, PA transparency), roles (Devon/Helena/Raj/Camille/Imani/Owen/Vera/Zara/Mira), three-severity breach taxonomy; (2) Important Business Services — identification methodology (business-service mapping → impact assessment → designation → Board approval), five v1 IBS (OTC derivative execution and confirmation, payments/settlement, margin management, regulatory reporting, client data management), IBS-to-resource mapping table; (3) Impact Tolerances — tolerance framework dimensions (duration/severity/recovery point), v1 Board-approved tolerance table for each IBS, calibration principles (Board-sets, RTO alignment, quantitative deferred to first scenario cycle); (4) Scenario Testing — five severe-but-plausible scenarios (cyber attack, cloud-provider outage, key-person loss, sponsor-bank failure, compound IBS-01+IBS-03 disruption), test governance (design approval, pre-test baseline, execution, post-test review, remediation tracking, tolerance-breach-in-testing escalation); (5) Annual Self-Assessment — seven-section structure (IBS inventory, tolerances, test outcomes, gaps, third-party, BCP/DR, RCSA), Board attestation event, PA submission event, gap-disclosure discipline; (6) BCP/DR Relationship — outcome-vs-input framing, IBS-to-RTO alignment, event-log resilience, minimum operating mode, Azure failover; (7) Third-Party Resilience — critical vendor identification, v1 critical vendor table (Azure, sponsor bank, Strate, SWIFT), annual assessment (resilience review, IBS impact, contractual protections, exit-plan feasibility), exit plan requirements; (8) Operational Risk Policy relationship — RCSA integration, operational risk capital, incident management overlap, RAS alignment; (9) Governance and Reporting — ORSC charter, real-time/monthly/monthly-EXCO/quarterly-BRC/annual-Board/PA-engagement reporting cadence; (10) Exceptions and Escalation — all disruptions recorded, tolerance breach → PA notification, post-incident review mandatory, Vera audit, planned maintenance window approval; (11) Obligations closure: ORG-PR-18, ORG-PR-45; (12) Substrate dependencies, planned procedures, citation gaps. LICENCE-BIND. Identity discipline per CLAUDE.md "Dispatch discipline" observed throughout. |
