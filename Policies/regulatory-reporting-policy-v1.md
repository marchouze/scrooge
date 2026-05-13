---
policy-id: regulatory-reporting-policy
title: Regulatory Reporting Policy v1
version: "1"
status: IN FORCE
owner: Camille (Chief Financial Officer, governance)
effective-from: "2026-05-13"
citations:
  - Banks Act 94 of 1990 s.72
  - Regulations Relating to Banks 2012 (as amended) Reg 46
  - PA Directive 2 of 2024 (D2/2024 — BA returns under Reg 46)
  - PA Directive 4 of 2022 (D4/2022 — Risk Return)
  - PA Directive 3 of 2013 (D3/2013 — Regulatory reporting baseline directive)
author: Camille (Chief Financial Officer, governance) + Mira (Regulatory intelligence engineer, compliance)
date: "2026-05-13"
summary: Regulatory Reporting Policy establishing the governance framework for all prudential regulatory returns submitted to the Prudential Authority — the full BA-return suite (BA 100, 200, 300, 325, 326, 600, 700, 900) and the Risk Return — including CFO-attestation standards, data-lineage requirements, timeliness controls, and resubmission governance. Closes obligations ORG-PR-29, ORG-PR-41, ORG-PR-51. LICENCE-BIND.
decision-required: false
riskTaxonomy:
  - RT-RR
  - RT-OR
---

# Regulatory Reporting Policy v1

> **Authors.** Camille (Chief Financial Officer, governance) — lead; Mira (Regulatory intelligence engineer, compliance) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Implements the prudential-reporting obligations identified in the FSCA reg-to-policy coverage recon (`8a53901`) and the FAIS Act analysis (`3e2ce06`) per the no-pause rule — CLAUDE.md "Operating procedures".
> **Obligations closed.** `ORG-PR-29` (file BA returns per the form, frequency, and content prescribed by D2/2024); `ORG-PR-41` (submit the Risk Return per D4/2022); `ORG-PR-51` (monthly BA-series prudential return submission per D3/2013 regulatory reporting directive).
> **Status.** LICENCE-BIND. Binding from the first prudential reporting period after PA licence grant. Submission obligations attach as a condition of the licence; the first BA-return cycle runs from the end of the first full calendar month of licensed operation. The reporting substrate (BA-form generator, event-to-return data pipeline) is under construction per the regulatory-readiness gate plan. Build-phase operationalisation is preparation for compliance, not compliance itself (per `project_rules_bind_at_commencement.md` memory, 2026-05-07).
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Regulatory Reporting Policy — Overarching

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual policy review; triggered on PA directive amendment or material change to the return suite · **Citation:** Banks Act 94 of 1990 s.72 (statutory reporting obligation; failure to report is an offence) + Regulations Relating to Banks 2012 (as amended) Reg 46 (BA-return statutory basis; prescribes forms, frequency, and content) + PA Directive 2 of 2024 (D2/2024 — current directive governing BA returns under Reg 46; `ORG-PR-29`) + PA Directive 4 of 2022 (D4/2022 — Risk Return submission obligation; `ORG-PR-41`) + PA Directive 3 of 2013 (D3/2013 — Regulatory reporting baseline directive; `ORG-PR-51`)

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") prepares, reviews, attests, and submits all prudential regulatory returns to the Prudential Authority (PA) at the South African Reserve Bank (SARB). Its purpose is to ensure that every return submitted to the PA is accurate, complete, timely, and derived from the Bank's authoritative event-sourced data, so that the PA receives the information it needs to exercise its supervisory function effectively.

Regulatory reporting is a legal obligation, not an administrative task. Banks Act 94 of 1990 s.72 creates a statutory obligation to submit returns in the form, frequency, and content the Registrar prescribes; failure to submit — or submission of a materially false or misleading return — is a statutory offence. The PA has used Reg 46 of the Regulations Relating to Banks and a series of directives (currently D2/2024, D4/2022, D3/2013) to prescribe the specific returns, their content, and their submission timelines. This policy translates those obligations into a governance and management structure that makes late or inaccurate submission a managed exception rather than an operational failure.

This policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). It cites the regulatory obligations above it; procedures under this policy (including `Procedures/by-policy/ba-return-preparation.md`, `Procedures/by-policy/ba-return-attestation.md`, and `Procedures/by-policy/regulatory-return-resubmission.md`) operationalise it; the BA-form generator, the event-to-return data pipeline, and the PA portal integration are the system capabilities that execute those procedures. The policy does not reproduce the content of the BA forms or the Risk Return schedules; those are defined by D2/2024, D4/2022, and D3/2013, and rendered by the BA-form generator.

The policy covers all prudential returns submitted to the PA. It explicitly excludes: FSCA conduct-side regulatory reporting (governed by the Conduct Regulatory Reporting Policy, a separate instrument to be authored under Zara (Chief Compliance Officer, governance)); SARS tax returns and related filings (governed by the Tax Policy, a separate instrument to be authored under Yael (Tax engineer, engineering)); and SARB national payments system settlement reporting (governed by the Payments Policy, a separate instrument to be authored under Eitan (Treasurer, governance) and Elena (Payments engineer, engineering)).

The BA-return suite and the Risk Return are not operational management reports repurposed for the regulator; they are regulatory-specific forms computed from the Bank's event substrate on the timelines and to the content standards the PA prescribes. The regulatory-reporting substrate is therefore a first-class engineering component of the Bank's architecture, not a downstream aggregation layer.

### Principles

- **Statutory obligation — zero tolerance for late submission.** Every BA-return submission deadline is a hard constraint. A missed submission deadline is a potential Banks Act s.72 offence and a reportable breach to the PA. The Bank maintains a rolling 13-month submission calendar covering every return in the BA suite and the Risk Return; each deadline is monitored as a typed event; no deadline passes without a `ReturnSubmitted` event or an `ExtensionRequested` event preceded by PA approval.
- **Events-first data lineage.** Regulatory returns must be derived from the Bank's canonical event log (Principle 1). The BA-form generator consumes the event substrate — credit exposure events, market position events, funding and liquidity events, operational-loss events — to produce the PA-required return content. No regulatory return is populated from a parallel data source, a manual spreadsheet, or an unaudited management estimate without a documented exception approved by Camille and recorded as a typed event with a `ManualAdjustmentAuthorised` marker. The `ManualAdjustmentAuthorised` event records the return, the cell or schedule affected, the amount, the justification, and the authorising event ID.
- **Four-eyes review before attestation.** Every BA return and the Risk Return is subject to a four-eyes review before the CFO attestation is signed. The preparer (Bea (Accounting & financial reporting engineer, engineering — reports to Camille)) produces the draft return; the reviewer (a second qualified party, typically the second-line finance function or Camille directly) reviews it against the event-substrate inputs, the prior-period return, and any PA guidance on specific schedule interpretation. Only after the four-eyes review is the return presented to Camille for attestation. This sequence is enforced by the `ba-return-preparation.md` procedure.
- **CFO attestation is non-delegable.** Camille signs the CFO attestation on every BA return before submission. The attestation records that Camille is satisfied the return is accurate and complete to the best of the Bank's knowledge. The attestation is a typed event in the event log (`ReturnAttested { returnId, period, attestor: "Camille", timestamp }`) before the return is submitted to the PA portal. Camille may not delegate the attestation authority to another party; if Camille is unavailable, the return date is managed under the contingency provision in `Procedures/by-policy/ba-return-attestation.md`.
- **PA portal as the sole submission channel.** All BA returns and the Risk Return are submitted through the PA's official return-submission portal (the electronic regulatory reporting system as designated by the PA from time to time). No alternative submission channel (email, physical delivery) is used unless the PA has formally designated it as an alternative for a specific return cycle. The `ReturnSubmitted` event records the portal submission reference number, the submission timestamp, and the attestation event ID.
- **Materiality-adjusted accuracy standard.** The Bank applies the accuracy standard set by D2/2024 and D3/2013 for each schedule and cell. Where a schedule has a specific tolerance threshold set by the PA (e.g., rounding conventions, de minimis cells), that threshold applies. Where no tolerance is specified, the Bank's internal standard is: no single material error (defined as ≥ 1% of the relevant total or ≥ R1m, whichever is lower, for any individual schedule line). The internal accuracy standard does not substitute for the PA's legal accuracy requirement; it is the operating floor below which the Bank's own quality controls prevent submission.
- **Resubmission on material error — 24-hour notification.** If a material error in a submitted return is identified — whether discovered by the Bank or communicated by the PA — Camille must notify the PA within 24 hours of the error being confirmed. Notification is a typed event (`MaterialReturnErrorNotified { returnId, period, discoveryTimestamp, errorDescription, paNotificationTimestamp }`). The resubmission must include a root-cause analysis, a remediation plan, and a revised return. A material error in any return is a Board-level notification within 48 hours.
- **Governing-instrument change management.** When the PA amends or replaces a governing directive (e.g., if D2/2024 is superseded by a future directive), Mira (Regulatory intelligence engineer, compliance — reports to Zara) identifies the change, assesses its impact on the return suite and this policy, and produces a change-impact brief for Camille within the PA's implementation timeline. The policy is updated at the next available version cycle; the procedure and BA-form generator are updated before the effective date of the new directive. A directive change that requires structural changes to the BA-form generator is a priority substrate item managed under `D-REGULATORY-READINESS-GATE-PLAN`.
- **No gold-plating, no under-reporting.** The Bank reports exactly what the PA requires — no more, no less. Over-reporting (volunteering data not required by the PA schedule) creates residual risk of inconsistency and is discouraged. Under-reporting (omitting required cells or providing placeholder estimates without PA approval) is prohibited. Where a schedule requires data the Bank's current substrate cannot produce (e.g., a sub-category of operational-risk loss events not yet captured in the loss event taxonomy), this is disclosed to the PA in writing with a remediation timeline, not silently omitted or estimated.

### Roles

Camille (Chief Financial Officer, governance) is the policy owner and the signing authority on every return. Camille's responsibilities include: owning the return calendar and submission governance; signing the CFO attestation; approving any manual adjustment; receiving and actioning PA feedback on submitted returns; presenting regulatory reporting quality to ALCO and the Audit Committee. Mira (Regulatory intelligence engineer, compliance) is the co-author and regulatory-intelligence lead: Mira monitors for PA directive changes affecting the return suite, produces change-impact briefs, and maintains the obligations mapping between the BA-return schedules and the Bank's regulatory obligations register. Bea (Accounting & financial reporting engineer, engineering) builds and operates the BA-form generator and the event-to-return data pipeline; Bea is the preparer for the four-eyes review. Owen (Company Secretary, governance) manages the Board-level notification events and the secretarial record of any material reporting breach. Vera (internal audit engineer, reports functionally to Thandiwe (Chief Audit Executive, governance)) provides third-line assurance that the regulatory-reporting governance pathway is followed, including the four-eyes review, the attestation event, and the resubmission process.

The Audit Committee (CEO interim, pending formal constitution) receives an annual review of the regulatory-reporting control framework, including an assessment of the BA-form generator's accuracy against the event-substrate inputs, the four-eyes review quality, and any resubmissions in the period.

### Breach

Breach taxonomy under this policy is three-severity:

- **Alert (Amber).** Pre-deadline review gate shows the return will not be ready on time without escalation; or a non-material error is identified in a submitted return. Immediate escalation to Camille and Bea. Remediation tracked as a typed event.
- **Hard Breach (Red).** A submitted return contains a material error, or a return is submitted after the PA deadline without PA-approved extension. Camille notifies the PA within 24 hours. Board notified within 48 hours. Root-cause and remediation required. `MaterialReturnErrorNotified` event emitted.
- **Critical (Critical-Red).** Wilful or grossly negligent submission of a materially false return; or complete failure to submit a required return for a full period without PA approval. Immediate CEO and Board notification. PA notification required under Banks Act s.72. External counsel advice sought. Vera engaged immediately.

---

## 2. BA-Return Suite

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim) for suite-level governance; CFO attestation per return · **Cadence:** Monthly submission; post-submission quality review; annual governance review · **Citation:** Reg 46 of the Regulations Relating to Banks (statutory basis) + D2/2024 (`ORG-PR-29` — current directive prescribing form, frequency, and content of BA returns) + D3/2013 (`ORG-PR-51` — baseline reporting directive)

### Purpose

The BA-return suite is the PA's primary data-collection mechanism for prudential supervision of South African banks. Each form in the suite captures a specific dimension of the Bank's risk profile, capital position, or balance-sheet composition in a format the PA uses to compute industry-wide prudential metrics, compare across the supervised population, and identify emerging supervisory concerns. The accuracy and timeliness of the BA returns are not merely compliance obligations; they are the Bank's primary channel of communication with the PA on its prudential condition.

This section defines the scope, content, and governance of each return in the BA suite. The schedule-level detail — specific cells, calculation methodologies, cross-references between schedules — is maintained in `Procedures/by-policy/ba-return-preparation.md` and the BA-form generator's documentation. This policy section names the returns, their regulatory basis, and the governance standards that apply uniformly across the suite.

### 2.1 Return Inventory

The following returns constitute the Bank's BA-return suite under D2/2024 and Reg 46. Each return is a monthly obligation submitted by the prescribed deadline after each calendar month-end, unless the PA prescribes a different frequency for a specific return.

**BA 100 — Capital Adequacy Summary.** The BA 100 is the headline prudential return: it reports the Bank's CET1, AT1, T2, Tier 1, and Total capital ratios against RWA, the regulatory minima, Pillar 2A add-ons, and any buffers (CCB, CCyB). BA 100 is the return the PA uses to assess capital adequacy at a point in time. It is the summary of the more detailed RWA computations in BA 200, BA 300, and BA 325/326. Citation: D2/2024 Schedule 1 `[citation: TBC — exact schedule reference within D2/2024; Imani (Legal-as-code engineer, engineering) + external counsel to confirm]` + Reg 46 `[citation: TBC — exact Reg 46 sub-clause]` + `ORG-PR-29`.

**BA 200 — Credit Risk RWA.** The BA 200 reports risk-weighted assets for credit exposures — on-balance-sheet loans, off-balance-sheet commitments, and contingent liabilities — computed under the standardised approach (SA-CR) per Basel III/IV and the Regulations Relating to Banks. BA 200 is the largest single driver of RWA for most banks; for Hoz Bank, the composition will shift toward market-risk-heavy returns once the global-markets book scales. Citation: D2/2024 `[citation: TBC — schedule reference]` + `ORG-PR-29`.

**BA 300 — Market Risk RWA.** The BA 300 reports risk-weighted assets for market-risk positions — interest-rate risk, equity risk, foreign-exchange risk, and commodities risk in the trading book — computed under the standardised approach (SA-MR, the revised standardised approach per BCBS FRTB D352 as adopted by the PA through D2/2024). For Hoz Bank as an institutional global-markets trading bank, BA 300 will be a material return from the first trading period. Citation: D2/2024 `[citation: TBC]` + `ORG-PR-29`.

**BA 325 — Counterparty Credit Risk (SA-CCR).** The BA 325 reports counterparty credit risk (CCR) exposures computed under the Standardised Approach for Counterparty Credit Risk (SA-CCR), including replacement cost and potential future exposure for OTC derivatives. As an IRD and bond trading bank, Hoz Bank's OTC derivative portfolio will generate material CCR exposures. Citation: D2/2024 `[citation: TBC]` + `ORG-PR-29`.

**BA 326 — Central Counterparty Exposures.** The BA 326 reports exposures to central counterparties (CCPs) — qualifying CCPs (QCCPs) via the JSE Clear clearing house and any other CCPs used for cleared OTC derivatives. The capital treatment for QCCP exposures differs from bilateral CCR; BA 326 captures this separately. Citation: D2/2024 `[citation: TBC]` + `ORG-PR-29`.

**BA 600 — Large Exposures.** The BA 600 reports the Bank's large exposures — any single counterparty or group-of-connected-counterparties exposure exceeding 10% of eligible capital — against the large-exposure limit framework (Banks Act + Reg 46 + D2/2024 large-exposure provisions `[citation: TBC — exact large-exposure limit provision in Reg 46]`). For an institutional trading bank, concentration exposures to sovereign issuers, large financial institution counterparties, and cleared market-infrastructure entities are the primary large-exposure populations. Citation: D2/2024 `[citation: TBC]` + `ORG-PR-29`.

**BA 700 — Leverage Ratio.** The BA 700 reports the leverage ratio (Tier 1 capital / total leverage exposure), a non-risk-based backstop to the RWA-based capital ratios per BCBS Basel III/IV and PA D5/2021. The leverage ratio is monitored monthly and reported via BA 700; the capital-management policy governs the leverage ratio target and breach-response. Citation: D2/2024 `[citation: TBC]` + `ORG-PR-29`.

**BA 900 — Liquidity (LCR and NSFR).** The BA 900 reports the Liquidity Coverage Ratio (LCR) and the Net Stable Funding Ratio (NSFR) — the two Basel III liquidity standards as adopted by the PA. LCR measures 30-day stress liquidity; NSFR measures structural funding stability over a one-year horizon. The Liquidity Management Policy governs the LCR and NSFR targets and breach-response; this policy governs the reporting obligation. Citation: D2/2024 `[citation: TBC]` + `ORG-PR-29`.

### 2.2 Submission Calendar and Timeliness Controls

The PA prescribes a submission deadline for each BA return after each calendar month-end. The current deadline structure under D2/2024 is `[citation: TBC — exact deadline days-after-month-end per D2/2024; Mira to confirm and load into the submission calendar]`. Bea maintains the 13-month submission calendar as a structured data file in the engineering substrate; the calendar is not a manual document. Each approaching deadline triggers a `ReturnDeadlineApproaching` event at T-10, T-5, and T-1 business days before the deadline. If a `ReturnSubmitted` event has not been emitted by T-1, the `ReturnAtRisk` event escalates to Camille immediately.

The PA portal requires registration and authenticated access for each return cycle. Portal access-control governance — who may submit, authentication credentials, contingency access in the event of portal outage — is maintained under `Procedures/by-policy/ba-return-attestation.md`. A PA portal outage that would cause a missed submission is escalated to the PA via telephone (backup channel) and documented as a `PaPortalOutage` event. The Bank is not responsible for PA-side infrastructure failures if the submission was initiated before the deadline and the portal was unavailable.

Extension requests — where the Bank is unable to prepare an accurate return by the scheduled deadline — must be submitted to the PA before the deadline. An extension requested after the deadline is not an extension; it is a late submission. Extension requests require Camille's approval as a `ExtensionRequested` event and are tracked against the PA's response and the extended deadline.

### 2.3 Data Lineage and the BA-Form Generator

The BA-form generator is the engineering substrate that translates the Bank's event log into the PA-required return format. Its architecture follows Principle 1: the generator reads typed events (credit exposure events, market position events, funding events, operational-loss events) from the canonical event log and applies the regulatory computation rules prescribed by D2/2024 and D3/2013 to produce each schedule of each return. No intermediary data store, manual adjustment layer, or shadow system sits between the event log and the BA-form generator's output.

The computation rules applied by the BA-form generator — the RWA computation methodology for each risk type, the capital-deduction rules, the exposure-netting and collateral-recognition frameworks — are maintained as executable, version-controlled code in the engineering substrate under Bea's ownership. Regulatory changes (PA directive amendments, BCBS standard updates adopted by the PA) require a code change in the BA-form generator before the effective date of the change; a code change that goes into production without validation against a reference dataset is a Vera finding.

The BA-form generator produces a `ReturnDraftGenerated { returnId, period, draftTimestamp, sourceEventIds[] }` event when each return draft is ready. The `sourceEventIds[]` array records every event ID that contributed to the return computation; this is the Bank's full audit trail for each submitted figure.

### 2.4 Manual Adjustments

Manual adjustments to BA-return data — changes made to the generator output that are not derived from the event log — are a last resort. They may be necessary where: (a) the event substrate contains a known data-quality error that has not yet been corrected; (b) a regulatory interpretation is uncertain and a conservative position is applied pending Mira and Imani's confirmed reading; or (c) a PA instruction for a specific return cycle differs from the standard generator output.

Every manual adjustment requires: (i) Camille's written approval as a `ManualAdjustmentAuthorised { returnId, period, schedule, cell, amount, justification, authorisingEventId }` event; (ii) documentation of the underlying reason; (iii) a remediation plan (timeline for the underlying issue to be resolved so the adjustment is not needed in future cycles); and (iv) disclosure to the four-eyes reviewer and to Vera in the quarterly regulatory-reporting quality report. A manual adjustment made without a `ManualAdjustmentAuthorised` event is a Vera finding.

---

## 3. Risk Return (D4/2022)

**Owner:** Camille (Chief Financial Officer, governance) with Helena (Chief Risk Officer, governance) on risk-type inputs · **Approval:** CFO attestation per submission; Board (CEO interim) informed quarterly · **Cadence:** Quarterly submission · **Citation:** D4/2022 (`ORG-PR-41` — Risk Return submission obligation) + `ORG-PR-29` (cross-reference from BA-return suite directive) + Banks Act 94 of 1990 s.72 (general reporting obligation)

### Purpose

The Risk Return, introduced by D4/2022, is a quarterly PA submission that captures granular risk data beyond the capital-adequacy metrics reported in the monthly BA suite. Where the BA returns report capital ratios and RWA outcomes, the Risk Return provides the PA with the underlying risk drivers — operational risk loss events, market risk sensitivities, credit risk large-exposure movements — that explain the BA-return outcomes and enable the PA to conduct firm-specific and cross-industry risk analysis.

The Risk Return is not a substitute for the BA suite; it is a supplement. The two data sets are cross-referenced: BA-return capital computations must be consistent with the Risk Return's underlying risk data. Inconsistencies between the BA suite and the Risk Return — different figures for the same underlying exposure — are detected by the PA's analytics and generate supervisory queries. The Bank manages this consistency risk through the BA-form generator and the Risk Return generator being fed from the same event-sourced substrate.

### 3.1 Risk Return Content

The D4/2022 Risk Return comprises three principal data categories `[citation: TBC — precise D4/2022 schedule structure; Mira to confirm; the categories below reflect the obligations-register reading and must be validated against D4/2022 text]`:

**Operational risk loss events.** Operational risk loss events of at least R1m (or such threshold as D4/2022 prescribes `[citation: TBC]`) are reported individually, with event date, business line, Basel II loss event category (internal fraud, external fraud, employment practices, clients-products-business-practices, damage to physical assets, business disruption and systems failures, execution-delivery-process management), gross loss, recovery, and net loss. The operational loss event taxonomy in the Bank's event substrate must align with the D4/2022 categorisation; misalignment is corrected before the first Risk Return submission. Helena and Rashida (Operational risk engineer, engineering — reports to Helena) own the operational-loss event taxonomy; Bea generates the Risk Return schedule from the typed events.

**Market risk sensitivities.** Market risk sensitivity data — DV01, CS01, equity delta, FX delta — for the Bank's trading book positions, reported at the granularity D4/2022 prescribes `[citation: TBC]`. The market-risk sensitivity data is produced by the Bank's risk engine (under Devon (Markets engineer, engineering — reports to Helena)) from the position event substrate. Sensitivity data must be consistent with the BA 300 market risk RWA computation; the same underlying position data feeds both.

**Credit risk large-exposure movements.** Movements in the Bank's credit-risk large exposures — counterparties or groups of connected counterparties where the exposure exceeds 10% of eligible capital — reported quarter-on-quarter. The large-exposure data is the same population as BA 600; the Risk Return reports the quarterly delta and the current-quarter breakdown. Consistency with BA 600 is a prerequisite for submission.

### 3.2 Quarterly Submission Governance

The Risk Return submission follows the same four-eyes review and CFO attestation governance as the BA suite. The review and attestation sequence is: Bea and Devon and Rashida produce the draft Risk Return from the event substrate → four-eyes review by Camille and a second-line reviewer → Camille attests → submission to PA portal. The submission deadline under D4/2022 is `[citation: TBC — exact deadline after each quarter-end]`.

The Risk Return's quarterly cadence creates a three-to-one asymmetry with the monthly BA suite: the monthly BA returns establish a running view of the capital position; the quarterly Risk Return is a deeper-dive submission aligned with quarter-end. The two data sets must be internally consistent at the quarter-end overlap; Bea runs a cross-validation check between the BA-suite quarter-end returns and the Risk Return submission before attestation.

---

## 4. Accuracy and Completeness Standards

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim) for the standards framework; Camille attests per return · **Cadence:** Applied on every return cycle; reviewed annually · **Citation:** D2/2024 (`ORG-PR-29`) + D4/2022 (`ORG-PR-41`) + D3/2013 (`ORG-PR-51`) + Banks Act 94 of 1990 s.72 (offence for false or misleading returns)

### Purpose

The PA requires that returns be accurate and complete. This is not merely a best-endeavours standard; Banks Act s.72 creates a statutory offence for false or misleading returns. This section sets out the Bank's internal accuracy and completeness framework — the standards it applies to every return before submission, above and beyond the procedural controls in §2 and §3.

The Bank's internal accuracy standard is a floor, not a ceiling. Meeting the internal standard does not guarantee that a return is accurate; it establishes that the Bank has applied its best-available controls. Material errors identified after submission are handled under the resubmission process in §5 of this policy regardless of whether the internal accuracy standard was technically met.

### 4.1 Accuracy Standard

For each return, accuracy is assessed at three levels:

**Schedule-level accuracy.** Each schedule within a return is cross-referenced to its source events or sub-schedules. The BA-form generator's `sourceEventIds[]` audit trail enables Bea to trace every schedule total to its component events. A schedule-level accuracy check verifies that the total equals the sum of its components and that no source event has been omitted.

**Return-level consistency.** Cross-return consistency checks verify that a figure appearing in multiple returns is identical. BA 100 capital ratios must be consistent with BA 200, BA 300, BA 325, and BA 326 RWA totals. BA 600 large exposures must be consistent with the BA 200 credit-risk portfolio. BA 900 LCR and NSFR must be consistent with the liquidity-management event substrate. The BA-form generator runs automated cross-return consistency checks before generating the `ReturnDraftGenerated` event.

**Period-on-period plausibility.** Each return is reviewed against the prior-period return for material unexplained movements. A period-on-period movement of more than 10% in any material schedule line (defined as a line representing ≥ 5% of the relevant return total) without a documented explanatory event is flagged for the four-eyes review. Unexplained movements are resolved before the return is submitted; the explanation is documented in the four-eyes review record.

### 4.2 Completeness Standard

Every required schedule within each return is populated. Optional schedules prescribed by D2/2024 or D4/2022 are evaluated against the Bank's business activity; if the Bank has no activity of the type the optional schedule covers, the schedule is explicitly marked as zero or not-applicable per the PA's convention for that return `[citation: TBC — D2/2024 convention for zero-activity optional schedules]`. A schedule left blank without the PA-designated convention is treated as a completeness error.

Where the Bank's substrate does not yet produce data for a required schedule — a known gap during the build phase — the gap is declared to the PA in writing before the first submission in which it would appear, with a remediation timeline. A known substrate gap is not an omission; it is a disclosed limitation with a committed remediation. Declared gaps are tracked as `SubstrateGapDeclaredToPa { returnId, schedule, gapDescription, remediationTimeline }` events.

---

## 5. Resubmission Governance

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Camille initiates; Board notified within 48 hours · **Cadence:** Event-triggered (on material error discovery) · **Citation:** D2/2024 (`ORG-PR-29`) + Banks Act 94 of 1990 s.72 + PA supervisory expectations (general) `[citation: TBC — any specific PA resubmission-notification timeline provision in D2/2024 or D3/2013]`

### Purpose

A material restatement of a submitted return is a significant event. It signals either a data-quality failure, a process failure, or a regulatory-interpretation error. The Bank's policy is to proactively notify the PA and submit a corrected return as quickly as possible, with full transparency about what was wrong and how it will be prevented. The resubmission process is not adversarial; it is a demonstration of the Bank's governance culture.

### 5.1 Error Discovery and Classification

A material error in a submitted return is defined as: any error that changes a capital ratio by ≥ 5bps; any error that changes an RWA figure by ≥ 1% of total RWA; any error that changes a large-exposure figure by ≥ R5m; any error in the Risk Return's operational-loss data that affects the event-category totals by ≥ 10%; or any error that the Bank believes would be material to the PA's supervisory assessment, even if it does not meet the quantitative thresholds above.

An error discovered by Bea during the post-submission quality review, by the four-eyes reviewer during the following period's review, by Vera during an audit, or by the PA through a supervisory query is classified as material or non-material within 24 hours of discovery. Camille makes the materiality determination; Helena concurs on risk-data errors.

### 5.2 Notification and Resubmission Timeline

A material error triggers the following sequence:
1. Discovery → Camille notified immediately (same business day).
2. Materiality determination within 24 hours of discovery.
3. If material: PA notification within 24 hours of materiality determination. Notification is a written communication to the PA (submission of a `MaterialReturnErrorNotified` typed event and a PA notification letter prepared by Owen).
4. Corrected return submitted within the timeline agreed with the PA (default: 10 business days from PA notification; may be extended with PA agreement).
5. Root-cause analysis completed within 20 business days of the corrected return being submitted.
6. Board notified within 48 hours of the PA notification being sent.
7. Audit Committee informed at the next scheduled meeting; Vera commissioned to review if the root cause is systemic.

### 5.3 Root-Cause and Remediation

Every material resubmission requires a root-cause analysis documenting: what was wrong; when the error originated; which controls failed to detect it before submission; and what changes to the BA-form generator, the four-eyes review process, or the event substrate will prevent recurrence. The root-cause analysis is reviewed by Camille, Helena, and Vera. If the root cause is a substrate-level data-quality issue, Bea owns the technical remediation; if it is a process failure, Camille owns the process remediation; if it is a regulatory-interpretation error, Mira and Imani own the interpretation correction.

---

## 6. Reporting and Governance

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim) for governance framework; Audit Committee for annual assurance review · **Cadence:** Monthly operational reporting; quarterly to ALCO; annual governance review by Audit Committee · **Citation:** Banks Act 94 of 1990 + D2/2024 + D4/2022

### Purpose

This section governs how the Bank's regulatory-reporting performance is monitored and reported internally — separate from the external PA submissions. Internal governance of regulatory reporting quality is the mechanism by which Camille, ALCO, the Audit Committee, and the Board can satisfy themselves that the PA submissions are accurate, timely, and free from systematic error.

### 6.1 Internal Reporting

Camille receives a monthly regulatory-reporting quality summary after each BA return cycle: submission date vs deadline, any manual adjustments made, any four-eyes findings, any period-on-period plausibility flags and their resolution. The quality summary is produced by Bea and reviewed by Camille before the following month's submission cycle begins.

ALCO receives the regulatory-reporting quality summary quarterly as part of the capital and liquidity reporting pack. ALCO's focus is on the BA 900 (LCR/NSFR) and BA 100 (capital ratios) in the context of the liquidity and capital management framework.

### 6.2 Audit Committee Review

The Audit Committee (CEO interim) receives an annual review of the regulatory-reporting control framework. The annual review covers: submission performance (on-time rate against the 13-month calendar); manual-adjustment frequency and trend; four-eyes review findings; any PA supervisory queries and their resolution; any resubmissions in the period; and the external auditor's assessment of the BA-return accuracy controls (see §6.3 below).

The Audit Committee review is supported by a Vera internal-audit opinion on the completeness and accuracy of the regulatory-reporting process, commissioned annually. Vera's opinion is not a substitute for the external auditor's review; it is the third-line view on the adequacy of the first-line and second-line controls.

### 6.3 External Auditor Scope

The external auditor's scope includes the accuracy of the BA-return suite as part of the annual audit. The external auditor is not required to audit every cell of every return (that would be disproportionate); the scope is agreed annually between Camille, Thandiwe, and the external auditor based on the risk profile of the BA suite and any material changes in the Bank's business or the regulatory framework. The external auditor's findings on BA-return accuracy are reported to the Audit Committee.

---

## 7. Exceptions and Escalation

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Exceptions approved by Camille; escalated to CEO and Board per breach taxonomy · **Cadence:** Event-triggered · **Citation:** D2/2024 + Banks Act 94 of 1990 s.72

### Purpose

An exception under this policy is any deviation from the standards set out in §§1–6 that is not a breach — that is, a deviation that has been pre-approved, documented, and time-bounded, and that does not constitute a submission of an inaccurate return. Exceptions include: PA-approved extensions to submission deadlines; pre-disclosed substrate gaps; and manual adjustments approved per §2.4.

### 7.1 Exception Categories

**Deadline extension.** An approved PA extension to a submission deadline. The extension request must be submitted before the scheduled deadline; the extension approval from the PA must be confirmed in writing before the deadline passes. Documented as a `ExtensionRequested` event followed by a `ExtensionApproved { paReference, extendedDeadline }` event.

**Substrate gap.** A declared inability to populate a required schedule because the event substrate does not yet produce the data. Documented as `SubstrateGapDeclaredToPa` event. Requires a remediation timeline and PA awareness. Not treated as a breach; treated as a managed limitation. Tracked until the substrate gap is resolved and the schedule is fully populated.

**Manual adjustment.** Pre-approved deviation from the generator output per §2.4. Not treated as a breach; treated as a managed adjustment. Tracked for trend analysis in the monthly quality summary.

### 7.2 Escalation

Breaches (per §1.4) escalate as follows:
- Alert: Camille and Bea; ALCO notified at next scheduled session.
- Hard Breach: Camille initiates; CEO notified within 24 hours; Board notified within 48 hours; PA notified as required by D2/2024 and Banks Act s.72.
- Critical: Camille initiates; CEO and Board notified immediately; PA notified immediately; external counsel engaged; Vera engaged for independent review.

All escalations are typed events. No verbal-only escalation is sufficient; a `RegReportingBreachEscalated { severity, returnId, period, escalationTimestamp, recipients[] }` event must be in the event log before any verbal communication to the PA.

---

## 8. Obligations Closure Table

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-PR-29` | File BA returns per the form, frequency, and content prescribed by D2/2024 | **IN FORCE** — closed | §2 (BA-Return Suite — full section), §4 (Accuracy and Completeness Standards), §5 (Resubmission Governance) |
| `ORG-PR-41` | Submit the Risk Return per D4/2022 | **IN FORCE** — closed | §3 (Risk Return — full section), §4 (Accuracy and Completeness Standards), §5 (Resubmission Governance) |
| `ORG-PR-51` | Monthly BA-series prudential return submission per D3/2013 regulatory reporting directive | **IN FORCE** — closed | §2.2 (Submission Calendar and Timeliness Controls), §1 (Overarching Policy — statutory obligation principle) |

---

## 9. Substrate Dependencies and Gaps

Per the events-first authoring rule (Principle 1), substrate gaps are surfaced here as work items, not hidden.

### 9.1 Substrate Currently Under Construction

- **BA-form generator (Bea (Accounting & financial reporting engineer, engineering) and Camille).** Translates the event substrate into BA 100, 200, 300, 325, 326, 600, 700, 900 return format under D2/2024. Discharge exit signal: `ReturnDraftGenerated { returnId, period, sourceEventIds[] }` event on synthetic quarter-end fixture; cross-return consistency checks green; recon `recon:ba-form-schema-validation` passes against D2/2024 schedule schema.
- **Risk Return generator (Bea and Devon (Markets engineer, engineering) and Rashida (Operational risk engineer, engineering)).** Translates operational-loss events, market-risk sensitivities, and credit large-exposure events into D4/2022 Risk Return format. Discharge exit signal: `ReturnDraftGenerated { returnId: "risk-return", period }` event on synthetic quarter-end fixture.
- **Submission calendar data file.** Structured 13-month rolling calendar of PA deadlines per D2/2024; automated `ReturnDeadlineApproaching` events at T-10, T-5, T-1. Dependency: D2/2024 deadline schedule confirmed by Mira `[citation: TBC]`.
- **PA portal integration.** Authenticated submission channel; `ReturnSubmitted { portalReference, submissionTimestamp }` event generated on submission confirmation from portal. Dependency: PA portal access and authentication setup (operational task pre-licence-day).

### 9.2 Procedures Planned but Not Yet Authored

- `Procedures/by-policy/ba-return-preparation.md` — four-eyes review process, period-on-period plausibility checks, cross-return consistency checks per §4.
- `Procedures/by-policy/ba-return-attestation.md` — CFO attestation sequence, portal submission steps, contingency access per §2.2.
- `Procedures/by-policy/regulatory-return-resubmission.md` — material error classification, PA notification drafting, root-cause analysis per §5.

### 9.3 Citation Gaps (TBC)

Per Principle 2, no sub-clause indices or schedule references are invented. The following are `[citation: TBC]` until Mira and Imani ratify them at the licence-application gate:

1. Exact schedule references within D2/2024 for each BA return (BA 100, 200, 300, 325, 326, 600, 700, 900).
2. Exact submission deadline (days-after-month-end) per D2/2024 for each BA return.
3. Exact submission deadline (days-after-quarter-end) per D4/2022 for the Risk Return.
4. D2/2024 convention for zero-activity optional schedules.
5. D4/2022 operational-loss reporting threshold.
6. D4/2022 schedule structure for market risk sensitivities and credit large-exposure movements.
7. Reg 46 exact sub-clause that creates the BA-return obligation.
8. Any specific PA resubmission-notification timeline provision in D2/2024 or D3/2013.

---

## 10. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-13 | Camille (Chief Financial Officer, governance) + Mira (Regulatory intelligence engineer, compliance) | Initial policy authored. Nine sections: (1) Overarching Policy — statutory obligation zero-tolerance principle, events-first data lineage, four-eyes review, CFO attestation non-delegability, PA portal as sole channel, materiality-adjusted accuracy standard, resubmission 24-hour notification, governing-instrument change management, no-gold-plating principle, roles, three-severity breach taxonomy; (2) BA-Return Suite — inventory of BA 100/200/300/325/326/600/700/900 with purpose and citation, submission calendar and timeliness controls, BA-form generator architecture, manual adjustment governance; (3) Risk Return (D4/2022) — content categories (operational risk, market risk, credit large exposures), quarterly submission governance; (4) Accuracy and Completeness Standards — schedule-level accuracy, return-level consistency, period-on-period plausibility, completeness standard; (5) Resubmission Governance — error discovery and classification, notification and resubmission timeline, root-cause and remediation; (6) Reporting and Governance — monthly quality summary, ALCO reporting, Audit Committee annual review, external auditor scope; (7) Exceptions and Escalation — exception categories (deadline extension, substrate gap, manual adjustment), escalation framework; (8) Obligations closure table (ORG-PR-29, ORG-PR-41, ORG-PR-51); (9) Substrate dependencies and gaps (BA-form generator, Risk Return generator, submission calendar, PA portal integration, planned procedures, TBC citations). LICENCE-BIND. Identity discipline per CLAUDE.md "Dispatch discipline" observed throughout. |
