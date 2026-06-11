---
policy-id: trade-reporting-policy
title: OTC Derivative Trade Reporting Policy v1
version: "1"
status: IN FORCE
owner: Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) + Anya (data reporting / regulatory submissions engineer, engineering) + Tomas (payments and settlement engineer, engineering)
effective-from: "2026-05-17"
next-review: "2027-05-17"
citations:
  - Financial Markets Act 19 of 2012 ss.6, 59, 60
  - GN R.98/2018 — OTC Derivative Regulations (Reporting), reg 3 + Schedule
  - Conduct Standard 2 of 2018 (FSCA) — 169-element reporting schema; EMIR-aligned
  - Joint Notice 2/2024 (PA + FSCA) — OTC derivative margin reporting from 1 April 2025
  - D-POLICY-DOCUMENT-HOME
author: Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) + Anya (data reporting / regulatory submissions engineer, engineering) + Tomas (payments and settlement engineer, engineering)
date: 2026-05-17
summary: >
  Establishes Hoz Bank Limited's framework for complying with South African OTC derivative trade reporting obligations
  to the Strate Trade Repository, covering the 169-element CS 2/2018 schema for transaction reporting and Joint Notice
  2/2024 margin reporting to the PA. Closes obligations ORG-FMA-003, ORG-CS2-001, and ORG-JN2-2024. LICENCE-BIND.
  Also closes the FSCA CS 3/2018 reporting obligations ORG-ODP-RPT-001, ORG-ODP-RPT-002, ORG-ODP-RPT-003, ORG-ODP-RPT-004 and ORG-ODP-RPT-005, and the JN 2/2024 margin-reporting obligations ORG-MK-RPT-001, ORG-MK-RPT-002 and ORG-MK-RPT-003.
decision-required: false
riskTaxonomy:
  - RT-LR.RC
obligations:
  - ORG-FC-24
  - ORG-GRP-FINREP
  - ORG-GRP-RPT
  - ORG-MK-11
---

# OTC Derivative Trade Reporting Policy v1

> **Status:** IN FORCE (policy layer). Reporting pipeline substrate (169-element schema registry, Strate TR submission, margin reporting) tracked under Anya's reporting workstream. Build phase: substrate is built and tested; regulatory submissions activate at go-live per the LICENCE-BIND timeline.
>
> **Authors:** Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) leads compliance governance; Anya (data reporting / regulatory submissions engineer, engineering) leads the 169-element schema registry and reporting pipeline; Tomas (payments and settlement engineer, engineering) provides settlement confirmation event inputs.
>
> **LICENCE-BIND:** OTC derivative trade reporting obligations under GN R.98/2018 go live by 1 March 2027 per the regulatory implementation timeline. Joint Notice 2/2024 margin reporting started 1 April 2025 — the bank is in build phase and not yet active, but the substrate must be ready before go-live. This policy governs the build-phase design; reporting commences at go-live.

---

## 0. Policy overview

| Attribute | Value |
|---|---|
| Policy name | OTC Derivative Trade Reporting Policy |
| Version | v1 |
| Effective date | 2026-05-17 |
| Approval authority | Board Risk Committee (BRC) |
| Policy owner (compliance) | Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) |
| Policy owner (data / schema) | Anya (data reporting / regulatory submissions engineer, engineering) |
| Policy owner (settlement inputs) | Tomas (payments and settlement engineer, engineering) |
| Review cadence | Annual; triggered by FSCA Conduct Standard amendment, Joint Notice update, or Strate TR connectivity change |
| LICENCE-BIND | Yes — GN R.98 reporting live by 1 March 2027; JN 2/2024 margin reporting from 1 April 2025 |
| Obligations closed | [`ORG-FMA-003`](../Regulations/_obligations-register.md) (GN R.98/2018 — OTC trade reporting to Strate TR), [`ORG-CS2-001`](../Regulations/_obligations-register.md) (CS 2/2018 — 169-element reporting schema), [`ORG-JN2-2024`](../Regulations/_obligations-register.md) (JN 2/2024 — margin reporting to PA from 1 April 2025) |

---

## 1. Trade Reporting Governance and Authority

### 1.1 Purpose

This policy establishes Hoz Bank Limited's framework for meeting its South African OTC derivative trade reporting obligations. These obligations arise from the Financial Markets Act 19 of 2012 (FMA), the OTC Derivative Regulations made thereunder (GN R.98/2018), FSCA Conduct Standard 2 of 2018, and Joint Notice 2/2024 issued jointly by the Prudential Authority (PA) and the FSCA.

Trade reporting is a regulatory infrastructure obligation: every reportable OTC derivative transaction must be reported to a licensed Trade Repository (TR) — currently Strate, designated as the TR in December 2024. The bank's product set — interest rate derivatives (IRS, FRAs) and FX derivatives (FX forwards, FX swaps, NDFs) — falls squarely within the reporting scope.

The policy ensures that:
- Every new reportable transaction is reported to the Strate TR within T+1.
- All 169 data elements required by CS 2/2018 are populated for each report.
- Amendments and cancellations are reported within T+1 of the relevant lifecycle event.
- Margin calls (initial margin and variation margin) are reported to the PA per Joint Notice 2/2024.
- Submission SLAs are monitored and any missed submissions are escalated and remediated.

### 1.2 Statutory authority

This policy is adopted under and gives effect to:

**Financial Markets Act 19 of 2012 (FMA):**
- **s.6** — the FMA establishes the regulatory framework for financial markets including OTC derivatives.
- **s.59** — the FSCA may make regulations governing OTC derivatives.
- **s.60** — the FSCA may issue Conduct Standards binding on authorised users and market participants.

**OTC Derivative Regulations (GN R.98/2018) — the primary trade reporting instrument:**
- **Regulation 3** — every OTC derivative provider (counterparty) must report each OTC derivative transaction to a licensed trade repository.
- **Schedule** — specifies the mandatory data elements; CS 2/2018 elaborates the 169-element schema.
- **Implementation timeline:** trade reporting is live by **1 March 2027** per the FSCA's implementation roadmap.

**FSCA Conduct Standard 2 of 2018 (CS 2/2018):**
- Specifies the 169 data elements that must be reported for each OTC derivative transaction.
- Aligned with the European Market Infrastructure Regulation (EMIR) and EMIR Refit; the element set covers counterparty data, transaction economics, valuation, and collateral.
- Strate TR is the designated repository for submission; Strate's reporting schema implements CS 2/2018.

**Joint Notice 2/2024 (PA + FSCA — Margin Reporting):**
- Requires OTC derivative counterparties to report initial margin (IM) and variation margin (VM) to the PA.
- Effective **1 April 2025** — this predates the bank's anticipated go-live; the substrate must be ready from day one.
- Margin reporting is separate from transaction reporting; the reporting pipeline has a dedicated margin-reporting sub-channel (Tomas's settlement events feed this pipeline).

**Cross-reference:**
- Margin Policy ([`Policies/margin-policy-v1.md`](margin-policy-v1.md)) — governs IM/VM calculation and exchange; this policy governs the regulatory reporting of those margin flows.
- Market Risk Policy ([`Policies/market-risk-policy-v1.md`](market-risk-policy-v1.md)) — trading-book boundary; all reportable instruments are in the trading book.

Register rows: [`ORG-FMA-003`](../Regulations/_obligations-register.md), [`ORG-CS2-001`](../Regulations/_obligations-register.md), [`ORG-JN2-2024`](../Regulations/_obligations-register.md).

### 1.3 Entity scope and counterparty applicability

**Bank scope:** Hoz Bank Limited is an OTC derivative provider / financial counterparty under the FMA and GN R.98/2018. Reporting obligations apply to all OTC derivative transactions to which Hoz Bank Limited is a party.

**Product scope:** the bank's reportable product set:

| Product family | Products | Reporting basis |
|---|---|---|
| Interest rate derivatives | Interest Rate Swaps (IRS), Forward Rate Agreements (FRAs) | Both legs; each trade reported independently |
| FX derivatives | FX Forwards, FX Swaps, Non-Deliverable Forwards (NDFs) | Both legs; each trade reported independently |

Exchange-traded derivatives and spot FX transactions are out of scope for OTC TR reporting.

**Counterparty scope:** the reporting obligation is bilateral — both counterparties are required to report, but the bank does not rely on the counterparty to discharge its own obligation. The bank reports every transaction from its own side regardless of whether the counterparty reports.

**Delegated reporting:** the bank may use a delegated reporting arrangement (where a counterparty reports on the bank's behalf) only where: (a) a written delegation agreement is in place; (b) the bank retains regulatory responsibility for completeness and accuracy; (c) Mira monitors submission confirmations. Delegated reporting, where used, is documented as a typed event.

### 1.4 Governance and roles

| Role | Holder | Responsibility |
|---|---|---|
| Policy owner — compliance | Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) | Monitors submission SLAs; handles FSCA inquiries; compliance-gap detection |
| Policy owner — data / schema | Anya (data reporting / regulatory submissions engineer, engineering) | Owns 169-element schema registry; owns reporting pipeline; Strate TR connectivity |
| Policy owner — settlement inputs | Tomas (payments and settlement engineer, engineering) | Settlement confirmation events as inputs to reporting pipeline; margin event feed |
| Supervisory owner | Zara (Chief Compliance Officer, governance) | Regulatory accountability; FSCA engagement; policy oversight |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, CAE, governance) | Annual reporting-completeness audit; SLA-compliance recon |

### 1.5 Policy hierarchy

```
FMA s.59–60 / GN R.98/2018 / CS 2/2018 / JN 2/2024
    └── OTC Derivative Trade Reporting Policy (this document)
        ├── 169-Element Schema Registry (Anya; prototype/platform/reporting/trade-report-schema.ts)
        ├── Strate TR Submission Procedure (Procedures/by-policy/trade-reporting-*.md)
        ├── Margin Reporting Sub-procedure (JN 2/2024; co-owned Tomas + Anya)
        └── Reporting SLA Monitoring Dashboard (Mira; Vera recon gate)
```

### 1.6 Approval, review, and amendment

- **Initial approval:** Board Risk Committee, 2026-05-17.
- **Triggered review:** any FSCA Conduct Standard amendment; any Strate TR schema update; any Joint Notice amendment; any FSCA or PA supervisory finding on reporting quality; any submission failure incident. Review within 30 agent-cadence days of trigger.
- **Amendment discipline:** all policy changes are typed `PolicyAmended` events per Principle 1. The markdown file is a render of the event; the event is canonical.

---

## 2. Trade Reporting Requirements

### 2.1 What must be reported

Every OTC derivative transaction within the product scope (§1.3) that is:
- New (executed);
- Amended (material economic change);
- Terminated / cancelled (early termination or natural expiry with no settlement outstanding);
- Novated (counterparty change);
- Compressed (multilateral compression); or
- Corrected (error correction to a prior submission).

Each lifecycle event produces a separate report to the Strate TR. The report type field in the CS 2/2018 schema distinguishes new trades, modifications, and terminations.

### 2.2 The 169-element reporting schema (CS 2/2018)

Conduct Standard 2 of 2018 specifies **169 data elements** that must be populated for each report. Anya owns and maintains the **169-element schema registry** — a typed, versioned data contract (`prototype/platform/reporting/trade-report-schema.ts`) that maps each of the 169 CS 2/2018 elements to:

- Its canonical source in the bank's event store (which typed event carries the value and which field);
- Whether the element is mandatory or conditional on product type;
- The applicable format / validation rule (ISO 20022 field formats where applicable);
- The Strate TR API field name.

The schema registry is the single source of truth for element definitions. All changes to the schema registry (triggered by FSCA CS 2/2018 amendment or Strate TR schema update) are typed `TradeReportSchemaUpdated` events reviewed by Anya and approved by Mira before deployment.

**Element categories (illustrative groupings within the 169 elements):**

| Category | Examples |
|---|---|
| Counterparty identification | LEI of each counterparty; reporting counterparty flag; financial/non-financial counterparty designation |
| Trade identification | UTI (Unique Trade Identifier); prior UTI (for novations / compressions); venue of execution |
| Transaction economics | Notional amount; currency; start / end dates; fixed / floating rates; payment frequency; day count convention |
| Valuation | Mark-to-market value; valuation date; valuation currency; valuation methodology (e.g. mid-market) |
| Collateral / margin | Collateralisation flag; collateral type; collateral value; initial margin; variation margin |
| Clearing | Clearing obligation status; CCP (if centrally cleared); clearing member |
| Product classification | ISIN or CFI code; underlying (for FRAs: reference rate; for FX: currency pair) |

### 2.3 Reporting timeline

| Event type | Reporting deadline | Source event in bank's event store |
|---|---|---|
| New trade (execution) | T+1 (by close of business on the business day after execution) | `IrsTradeExecuted` / `FxForwardExecuted` / `FxSwapExecuted` / `NdfExecuted` |
| Amendment | T+1 after the amendment event | `TradeAmendmentConfirmed` |
| Early termination | T+1 after termination | `TradeTerminationConfirmed` |
| Natural expiry | T+1 after maturity date | Position lifecycle event at maturity |
| Novation | T+1 after novation | `TradeNovationConfirmed` |
| Compression | T+1 after compression confirmation | `CompressionConfirmed` |
| Error correction | T+1 after error detection | `TradeReportCorrectionInitiated` |

**T = execution date** (or the date of the lifecycle event for amendments/terminations). Business days are SA business days; Strate TR accepts submissions during its operating hours.

### 2.4 Reporting pipeline architecture

The reporting pipeline is owned by Anya and operates as follows:

1. **Source events ingested.** Trade lifecycle events from the markets substrate (Tomas's settlement confirmation events; trading-book events) are ingested by the reporting pipeline subscription.

2. **169-element population.** For each ingested event, the pipeline populates the 169-element report from the event payload and cross-referenced position data. Missing mandatory elements cause a `TradeReportPopulationFailed` event; Anya is notified immediately.

3. **Validation.** The populated report is validated against the CS 2/2018 schema registry. Validation failures halt submission and emit `TradeReportValidationFailed`; Mira is notified for remediation within 2 hours.

4. **Submission to Strate TR.** Valid reports are submitted via the Strate TR API. Successful submission emits `TradeReportSubmitted` with the Strate TR acknowledgement reference. Submission failures (API error, connectivity) emit `TradeReportSubmissionFailed`; auto-retry logic applies (§3.2).

5. **Confirmation and reconciliation.** Anya reconciles `TradeReportSubmitted` events against the trade register daily. Any trade with no paired `TradeReportSubmitted` within T+1 triggers a `TradeReportDeadlineBreached` event. Mira is notified immediately.

### 2.5 UTI (Unique Trade Identifier) generation and sharing

Each OTC derivative transaction requires a **Unique Trade Identifier (UTI)** — a globally unique identifier that both counterparties use when reporting the same trade. The BCBS/IOSCO UTI guidance (adopted by FSCA via CS 2/2018) defines the UTI format and the agreement protocol between counterparties.

- The bank generates UTIs for trades where it is the UTI-generating counterparty (i.e. the sell-side or the party agreed by convention to generate the UTI).
- Where the counterparty generates the UTI, the bank confirms receipt of the counterparty UTI before submission.
- UTI generation is handled by Anya's pipeline (`prototype/platform/reporting/uti-generator.ts`).
- All UTIs are stored in the event store (`TradeUtiAssigned` event) — the UTI is a field in all subsequent lifecycle reports for the trade.

### 2.6 Valuation reporting

CS 2/2018 requires daily mark-to-market (MTM) valuation reporting for outstanding positions:

- **Daily MTM reports** — the bank's market risk engine (market-risk pricing substrate, Eitan's valuation module) produces end-of-day valuations per position.
- **Valuation source** — mid-market valuation per the bank's model; CS 2/2018 prescribes the methodology (mid-market, not bid/offer).
- **Submission cadence** — daily, alongside any new trade or lifecycle event reports.
- **Anya** owns the valuation-report population and submission pipeline; valuation data is sourced from the `PositionValuationCalculated` event stream.

---

## 3. Margin Reporting (Joint Notice 2/2024)

### 3.1 Margin reporting obligation

Joint Notice 2/2024 (issued jointly by the PA and FSCA) requires that OTC derivative counterparties report margin information — both **Initial Margin (IM)** and **Variation Margin (VM)** — to the Prudential Authority.

**Effective date:** 1 April 2025. The bank is in build phase and will not be active as of that date, but the reporting substrate must be ready for go-live.

**Scope:** all OTC derivative transactions within the bank's product scope (§1.3) for which margin is exchanged. Given the bank's bilateral trading model (transactions with institutional counterparties under ISDA/CSA), margin is exchanged on most derivative positions.

**Reporting channel:** margin reports are filed with the PA via a PA-designated submission mechanism (API or structured data submission). Anya owns the submission pipeline; Tomas provides the underlying margin-event feeds.

### 3.2 Margin reporting data elements

Joint Notice 2/2024 specifies the margin reporting data elements (aligned with the Basel margin framework and IOSCO margin standards). Key elements:

| Element | Description |
|---|---|
| Trade / portfolio reference | UTI or portfolio-level identifier for netting set |
| IM posted | Initial margin posted by the bank to the counterparty (or CCP) |
| IM received | Initial margin received by the bank from the counterparty |
| VM posted | Variation margin posted by the bank |
| VM received | Variation margin received by the bank |
| Collateral type | Cash (ZAR / USD / EUR); eligible bonds |
| Reporting date | Date as of which the margin position is reported |
| Counterparty LEI | Both sides |

Anya maintains the margin reporting schema as a typed data contract in `prototype/platform/reporting/margin-report-schema.ts`.

### 3.3 Margin reporting pipeline

The margin reporting pipeline:

1. **Source events.** Tomas's settlement and margin substrate produces typed margin events: `InitialMarginPosted`, `InitialMarginReceived`, `VariationMarginPosted`, `VariationMarginReceived`, `MarginCallIssued`, `MarginCallSettled`.

2. **Daily aggregation.** Anya's pipeline aggregates margin events to the netting-set level per reporting date.

3. **PA submission.** Aggregated margin reports are submitted to the PA per the JN 2/2024 submission mechanism. Successful submission emits `MarginReportSubmitted`; failure emits `MarginReportSubmissionFailed`.

4. **Reconciliation.** Anya reconciles submitted margin positions against the margin event register daily. Discrepancies emit `MarginReportReconciliationFailed`; Mira is notified immediately.

### 3.4 Interaction with Margin Policy

This policy governs the **regulatory reporting** of margin. The calculation, call, and settlement of margin is governed by the Margin Policy ([`Policies/margin-policy-v1.md`](margin-policy-v1.md)). The two policies are complementary; the Margin Policy is the source of truth for margin economics; this policy is the source of truth for how those economics are reported to the PA.

---

## 4. Escalation and Incident Management

### 4.1 Submission failure escalation

| Failure type | Immediate action | Escalation path |
|---|---|---|
| `TradeReportValidationFailed` | Anya notified immediately; manual review | Anya → Mira within 2 hours; remediation and resubmission within T+1 if possible; else T+2 with FSCA notification if SLA breach |
| `TradeReportSubmissionFailed` (API error) | Auto-retry 3 times at 5-minute intervals | Anya → Mira if auto-retry exhausted; escalate to Zara (CCO) if Strate TR connectivity issue; FSCA notification if SLA breach |
| `TradeReportDeadlineBreached` (T+1 missed) | `CriticalIncidentRaised` event | Mira → Zara (CCO) within 1 hour; Zara → FSCA notification per supervisory obligation; Vera notified for independent review |
| `MarginReportSubmissionFailed` | Anya + Tomas notified immediately | Anya → Mira within 2 hours; PA notification if JN 2/2024 deadline breached |

### 4.2 FSCA and PA engagement

Mira (Compliance / RegTech engineer) is the primary contact for:
- FSCA data quality inquiries relating to trade reports;
- FSCA and PA audit data requests;
- Reconciliation requests from Strate TR.

All regulatory communications are logged as typed `RegulatoryCorrespondenceLogged` events.

### 4.3 Resubmission and correction procedure

Where a submitted report contains an error:

1. Anya prepares a corrected report with report type "correction" referencing the original UTI and Strate TR submission reference.
2. Mira reviews and approves the correction before submission.
3. The corrected report is submitted to Strate TR; successful submission emits `TradeReportCorrectionSubmitted`.
4. If the error was identified by the FSCA or Strate TR, Mira documents the root cause and implements a control improvement, reviewed at the next Vera effectiveness review.

---

## 5. Controls and Monitoring

### 5.1 Controls

| Control | Description | Owner | Frequency |
|---|---|---|---|
| 169-element completeness check | Validate all mandatory elements populated before submission | Anya (automated) | Per-report, pre-submission |
| T+1 deadline monitoring | Alert on any trade with no `TradeReportSubmitted` by T+1 close | Anya (automated) + Mira (review) | Daily |
| Submission reconciliation | Reconcile trade register against submitted reports | Anya | Daily |
| Margin report reconciliation | Reconcile margin event register against submitted margin reports | Anya + Tomas | Daily |
| Schema registry version control | All CS 2/2018 schema changes versioned as `TradeReportSchemaUpdated` events | Anya | On FSCA/Strate TR update |
| Strate TR connectivity test | Periodic connectivity test against Strate TR API | Anya (automated) | Daily |
| FSCA inquiry log | Log all FSCA/PA data-quality communications | Mira | Ongoing |
| Vera completeness recon | `recon:trade-report-completeness` — assert every `*TradeExecuted` event has a paired `TradeReportSubmitted` | Vera (continuous-assurance) | Daily automated; annual manual audit |

### 5.2 Key Performance Indicators

| KPI | Target | Owner |
|---|---|---|
| T+1 submission rate | ≥ 99.5% of reportable transactions submitted within T+1 | Anya + Mira |
| Validation failure rate | ≤ 0.5% of submitted reports fail validation pre-submission | Anya |
| Correction rate | ≤ 1% of submitted reports subsequently corrected | Anya + Mira |
| Margin report T+1 rate | ≥ 99.5% of daily margin positions submitted within T+1 | Anya + Tomas |
| Zero regulatory SLA breaches | Zero T+1 deadline breaches that are not self-reported to FSCA within the same business day | Mira + Zara |

KPIs are reported to Zara (CCO) monthly and to the BRC quarterly via Mira's compliance dashboard.

### 5.3 Annual Vera effectiveness review

Vera (Internal audit / continuous-assurance engineer) conducts an **annual trade reporting effectiveness review**, examining:

- Submission completeness: `recon:trade-report-completeness` results for the review period.
- Schema registry accuracy: sample of submitted reports vs CS 2/2018 element requirements.
- T+1 SLA compliance: historical `TradeReportDeadlineBreached` events; remediation adequacy.
- Margin reporting completeness: `MarginReportSubmitted` events vs margin event register.
- Correction root-cause analysis: whether corrections indicate systemic data-quality issues.
- Regulatory correspondence: whether any FSCA or PA inquiry was adequately resolved.

Vera's findings are reported to Thandiwe (CAE, governance) and to the BRC.

---

## 6. Related Documents

| Document | Location | Relationship |
|---|---|---|
| Margin Policy | [`Policies/margin-policy-v1.md`](margin-policy-v1.md) | Source of margin economics reported under JN 2/2024 |
| Market Risk Policy | [`Policies/market-risk-policy-v1.md`](market-risk-policy-v1.md) | Trading-book scope; product taxonomy |
| FAIS Compliance Policy | [`Policies/fais-compliance-policy-v1.md`](fais-compliance-policy-v1.md) | FSP authorisation for OTC derivative dealing |
| Excon Compliance Policy | [`Policies/excon-compliance-policy-v1.md`](excon-compliance-policy-v1.md) | FX derivatives — exchange control applicability |
| Obligations register | [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) | Rows ORG-FMA-003, ORG-CS2-001, ORG-JN2-2024 |
| Strate TR Submission Procedure | Procedures/by-policy/trade-reporting-strate-submission.md (planned) | Procedure-level step-by-step for Strate TR API submission |
| Margin Reporting Procedure | Procedures/by-policy/trade-reporting-margin-jn2.md (planned) | JN 2/2024 margin report preparation and submission |

---

## 7. Obligations closed by this policy

| Obligation ID | Obligation description | Policy section |
|---|---|---|
| [`ORG-FMA-003`](../Regulations/_obligations-register.md) | Report OTC derivative transactions to a licensed Trade Repository (Strate); 169 data elements; live by 1 March 2027 | §2 (reporting requirements), §4 (escalation), §5 (controls) |
| [`ORG-CS2-001`](../Regulations/_obligations-register.md) | CS 2/2018 — 169-element reporting schema; EMIR-aligned; Strate TR | §2.2 (169-element schema), §2.4 (pipeline), §5.1 (controls) |
| [`ORG-JN2-2024`](../Regulations/_obligations-register.md) | Joint Notice 2/2024 — initial margin and variation margin reporting to PA from 1 April 2025 | §3 (margin reporting) |

---

## 8. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1 | 2026-05-17 | Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) + Anya (data reporting / regulatory submissions engineer, engineering) + Tomas (payments and settlement engineer, engineering) | Initial version. Establishes OTC derivative trade reporting governance, 169-element CS 2/2018 schema, T+1 reporting timeline, Strate TR submission pipeline, UTI framework, valuation reporting, and JN 2/2024 margin reporting. Closes ORG-FMA-003, ORG-CS2-001, ORG-JN2-2024. LICENCE-BIND. |

---

*Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) + Anya (data reporting / regulatory submissions engineer, engineering) + Tomas (payments and settlement engineer, engineering)*
