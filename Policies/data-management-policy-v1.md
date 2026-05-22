---
policy-id: data-management-policy
title: Data Management Policy v1
version: "1"
status: CORPORATE-BIND
owner: Devon (Chief Operating Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - POPIA s.19-22 (security safeguards for personal information)
  - Banks Act 94 of 1990 s.73 (books and records)
  - Regulations Relating to Banks 2012 (as amended) reg.39 (internal controls)
  - PA/FSCA Joint Standard 2 of 2024 (data governance for banks and insurers)
  - EDM Council DCAM (Data Management Capability Assessment Model — normative alignment per D-DCAM-TAXONOMY)
  - Principle 1 (events are the only source of truth)
author: Devon (Chief Operating Officer, governance) + Anya (Data/analytics engineer, engineering) + Atlas (Core banking platform architect, engineering)
date: 2026-05-22
summary: Data Management Policy establishing DCAM three-layer architecture alignment, data classification taxonomy (Public/Internal/Confidential/Restricted), data quality dimensions and thresholds, event-sourcing as canonical data architecture, master data domains (Party, Instrument, Account, Legal Entity), data lineage requirements for regulatory reporting, data quality breach reporting, SA data residency, and typed events DataQualityBreachDetected and MasterDataUpdated. CORPORATE-BIND.
decision-required: false
riskTaxonomy:
  - RT-OR
  - RT-TOR
---

# Data Management Policy v1

> **Authors.** Devon (Chief Operating Officer, governance) — lead; Anya (Data/analytics engineer, engineering) — co-author; Atlas (Core banking platform architect, engineering) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Implements POPIA s.19–22 security safeguards for personal information; Banks Act 94 of 1990 s.73 books-and-records obligations; PA/FSCA Joint Standard 2 of 2024 data governance requirements. Normative alignment with EDM Council DCAM per `D-DCAM-TAXONOMY` (CEO-approved). Operationalises Principle 1 (events are the only source of truth) at the data governance layer.
> **Obligations closed.** POPIA s.19 (security safeguards); s.20 (destruction/deletion); s.21 (information processed by operator); s.22 (notification of security compromises — data breach notification); Banks Act s.73 (accurate books and records); reg.39 (internal controls over data); PA/FSCA JS-2 (data governance).
> **Status.** CORPORATE-BIND. Data management applies immediately in the build phase. Every data entity produced in the build phase — event records, policy documents, team rosters, backfill scripts, procedure files — is subject to this policy. Data quality in the build phase is the foundation for regulatory data quality at commencement of trading; build-phase data debt compounds.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Data Management — Overarching

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual policy review; data quality monitoring is continuous · **Citation:** POPIA s.19–22 + Banks Act 94 of 1990 s.73 + PA/FSCA Joint Standard 2 of 2024 + DCAM (normative reference) + Principle 1

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") manages its data assets — from creation, through processing and storage, to destruction. Its purpose is to ensure that: (i) the Bank's data is accurate, complete, timely, and fit for regulatory reporting; (ii) personal information is handled lawfully and securely per POPIA; (iii) data architecture is grounded in the event-sourcing model (Principle 1); (iv) master data has a single canonical source per domain; and (v) data quality breaches are identified promptly and reported.

The Bank's data architecture is distinctive: the event log is the only source of truth (Principle 1). All financial positions, regulatory reporting data, customer records, and risk measures are projections derived from the event log. There are no "golden source" databases holding positions or balances independently of the event log. This architecture eliminates a class of reconciliation breaks common in traditional banking (event log vs. position database) and makes the data lineage inherently complete — every output can be traced to its input event(s).

The DCAM three-layer architecture (data strategy, data management capabilities, data governance) provides the normative framework for the Bank's data management capability, per `D-DCAM-TAXONOMY`. This policy is the data governance layer of that architecture; Anya's data quality monitoring and lineage tooling are the data management capability layer; the event-sourcing architecture is the data strategy layer.

### Principles

- **Event-sourcing is the canonical data architecture.** All state is derived from the event log (Principle 1). No shadow databases that aren't projections are permitted. Any system that holds a position or balance that is not derived from the event log is a Principle 1 violation, reportable by Vera. This applies to the GL, the positions register, the margin register, the client data store, and all regulatory reporting outputs.
- **Single canonical register per master data domain.** Each master data domain (Party, Instrument, Account, Legal Entity) has exactly one canonical register. All other systems that reference these domains cite the canonical register — they do not maintain independent copies. Drift between a system's copy of master data and the canonical register is a P3 reconciliation break per the Reconciliation and Break Management Policy.
- **Data quality is measurable and monitored.** Five quality dimensions are defined and monitored for every critical data set (§3). Anya reports data quality metrics to Devon monthly and emits `DataQualityBreachDetected` events when a threshold is breached.
- **Personal information receives enhanced safeguards.** Data classified as Confidential or Restricted that contains personal information (as defined by POPIA s.1) is subject to the safeguards in §5 (POPIA compliance). Processing of personal information by the Bank or any operator engaged by the Bank must comply with POPIA s.19–22.
- **Data residency is South Africa primary.** All production data (event log, projections, master data registers) resides in South Africa as the primary location. Cloud replication (per Principle 3 — Azure target) must keep a local replica and must comply with POPIA s.72 restrictions on cross-border data transfer. Any cross-border transfer of personal information requires Devon's approval and Zara's (Chief Compliance Officer, governance) compliance confirmation.
- **Retention is governed by the Records Management Policy.** Data retention periods for each data category are set in the Records Management Policy (Owen (Company Secretary, governance) is the owner). This policy integrates with the Records Management Policy for retention governance; it does not set its own retention periods.

### Roles

Devon (Chief Operating Officer, governance) is the policy owner and the Bank's designated data governance authority under PA/FSCA Joint Standard 2 of 2024.

Anya (Data/analytics engineer, engineering) is the operational data quality lead. Anya owns: data quality monitoring across all critical data sets; data lineage tooling; `DataQualityBreachDetected` event emission; data quality reporting to Devon.

Atlas (Core banking platform architect, engineering) owns the event store architecture, projection framework, and master data register implementations. Atlas ensures that all new capabilities are built on the event-sourcing model.

Owen (Company Secretary, governance) owns the Records Management Policy (retention governance) and the Party register (one of the four master data domains).

Imani (Legal-as-code engineer, engineering) owns the Legal Entity master data domain (legal entity tree).

Zara (Chief Compliance Officer, governance) owns POPIA compliance, including data breach notification obligations (POPIA s.22).

Vera (internal audit engineer — reports functionally to Thandiwe (Chief Audit Executive, governance)) audits data quality metrics, data lineage completeness, and POPIA compliance controls quarterly.

---

## 2. DCAM Architecture Alignment

**Owner:** Anya (Data/analytics engineer, engineering) · **Approval:** COO for DCAM alignment changes · **Cadence:** Annual DCAM capability maturity assessment · **Citation:** EDM Council DCAM + D-DCAM-TAXONOMY

### Layer 1 — Data Strategy

The Bank's data strategy is event-sourcing (Principle 1). The strategic direction is: build a complete, immutable, queryable event log as the single durable artefact; derive all outputs as projections; never write to derived views. This strategy is set by the CEO (build-phase authority) and is encoded in the architectural principles; it is not subject to annual recalibration.

### Layer 2 — Data Management Capabilities

Per DCAM, data management capabilities include: data architecture; data modelling; data quality; metadata management; data security; reference and master data management; data warehousing and business intelligence; document and content management; data governance.

Anya is responsible for maturing the Bank's capabilities across these dimensions. The current maturity target for each capability is defined in Anya's data quality roadmap (authored under Devon's direction). Maturity assessments use the DCAM capability maturity levels (1–5); the Bank's build-phase target is Level 2 (Proactive) across all capabilities by the pre-licence go-live readiness gate.

### Layer 3 — Data Governance

This policy is the data governance instrument. Governance responsibilities are assigned per the Roles section above. The data governance structure includes: policy ownership (Devon); data domain stewardship (Anya for quality; Atlas for architecture; Owen for Party; Imani for Legal Entity); compliance oversight (Zara for POPIA); audit (Vera).

---

## 3. Data Classification Taxonomy

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** COO for classification changes · **Cadence:** Applied to all new data assets; reviewed annually · **Citation:** POPIA s.19 (security safeguards appropriate to sensitivity) + PA/FSCA Joint Standard 2 of 2024

Four classification tiers apply to all data assets:

| Classification | Description | Examples | Access controls |
|---|---|---|---|
| **Public** | Data intended for public disclosure or already publicly available | Regulatory disclosures; published policies; press releases | No access restriction |
| **Internal** | Data for internal use; not for external disclosure; no personal information | Internal procedures; meeting minutes (non-PII); aggregated risk metrics | Bank staff and agents only |
| **Confidential** | Sensitive business data; restricted to need-to-know; may include personal information | Client trade data; ISDA agreement terms; AML/CFT investigation records; staff performance data | Named individuals / agent roles only; encrypted at rest and in transit |
| **Restricted** | Highest sensitivity; potential regulatory, legal, or safety consequence if disclosed | POPIA-regulated personal information identifying natural persons; key material; SARB non-public communications; law enforcement cooperation data | Strict need-to-know; additional logging of access; HSM-protected where cryptographic |

Every new data asset (event type, projection, report, document) is classified by its author at creation. Classification is a metadata field on the asset. Anya monitors classification completeness; unclassified data assets are a P3 break in the data quality framework.

---

## 4. Data Quality

**Owner:** Anya (Data/analytics engineer, engineering) · **Approval:** COO for threshold changes · **Cadence:** Continuous monitoring; monthly quality report to Devon · **Citation:** PA/FSCA Joint Standard 2 of 2024 + Banks Act 94 of 1990 s.73

### 4.1 Data Quality Dimensions

Five quality dimensions are monitored for every critical data set (critical data sets are: the event log; the position projection; the GL projection; the client/Party register; the instrument master; the regulatory reporting data feeds):

| Dimension | Definition | Minimum threshold |
|---|---|---|
| **Completeness** | All required fields are populated | ≥ 99% for regulatory reporting data; ≥ 95% for operational data |
| **Accuracy** | Data values are correct and conform to the source of truth | ≥ 99.9% for event log entries; ≥ 99% for projections (validated against event log) |
| **Timeliness** | Data is available within the required time window | Event log entries within T+0 (same event loop); projections within 5 minutes of event |
| **Consistency** | Data is consistent across all projections derived from the same event log | 100% — inconsistency between projections is a Principle 1 violation |
| **Uniqueness** | No duplicate records in master data domains | 100% — duplicate Party, Instrument, Account, or Legal Entity records are a P2 data break |

### 4.2 Data Quality Breach

A `DataQualityBreachDetected { dataSet, dimension, currentValue, threshold, detectedAt, severity }` event is emitted by Anya when any critical data set falls below its minimum threshold. Severity tiers: High (regulatory reporting data below threshold), Medium (operational data below threshold), Low (non-critical data below threshold). High severity breaches are notified to Devon and Helena immediately; Medium within 4 hours; Low in the daily data quality report.

---

## 5. Master Data Domains

**Owner:** Each domain has a named steward — see below · **Approval:** Domain steward for routine updates; COO for domain design changes · **Cadence:** Master data is maintained continuously; audited quarterly · **Citation:** Principle 2 (single-graph discipline — master data as the canonical node)

Four master data domains, each with a single canonical register:

| Domain | Canonical register | Steward | Event on update |
|---|---|---|---|
| **Party** | Party register (per `D-PARTY-REGISTER`) | Owen (Company Secretary, governance) | `MasterDataUpdated { domain: "party", partyId, changeType }` |
| **Instrument** | Financial instrument master (per `D-FINANCIAL-INSTRUMENT-ENTITY`) | Kai (Trading systems engineer, engineering) | `MasterDataUpdated { domain: "instrument", instrumentId, changeType }` |
| **Account** | Chart of accounts / account register | Bea (Accounting & financial reporting engineer, engineering) | `MasterDataUpdated { domain: "account", accountId, changeType }` |
| **Legal Entity** | Legal entity tree (per Imani's legal entity register) | Imani (Legal-as-code engineer, engineering) | `MasterDataUpdated { domain: "legal-entity", entityId, changeType }` |

No system may maintain an independent copy of master data in any of these four domains. All system references to a Party, Instrument, Account, or Legal Entity must be by the canonical identifier from the canonical register, not by a local copy.

---

## 6. Data Lineage

**Owner:** Anya (Data/analytics engineer, engineering) · **Approval:** COO for lineage requirement changes · **Cadence:** Lineage is recorded as part of every data transformation; audited annually · **Citation:** PA/FSCA Joint Standard 2 of 2024 + Banks Act 94 of 1990 s.73

All regulatory reporting data flows must have documented data lineage: the chain from source event(s) → projection(s) → report cell. Anya is responsible for maintaining and testing the data lineage documentation. Data lineage gaps for regulatory reporting data sets are P2 data quality breaks.

The event-sourcing architecture provides inherent lineage: every projection output is a deterministic function of the event log. Anya's lineage tooling codifies this by: (a) mapping each regulatory return cell to the event type(s) and projection(s) that produce it; (b) testing that re-running the projection against the event log reproduces the reported value; (c) maintaining a lineage register in the intranet.

---

## 7. Typed Events

This policy generates and consumes the following typed events (Principle 1):

| Event type | Trigger | Owner |
|---|---|---|
| `DataQualityBreachDetected` | Critical data set falls below quality threshold | Anya |
| `MasterDataUpdated` | Any master data domain record created or updated | Domain steward |

---

## 8. Substrate Dependencies and Gaps

- **Data quality monitoring harness (Anya).** Automated quality dimension measurement for all critical data sets. Discharge exit signal: `DataQualityBreachDetected` event auto-generated on threshold breach.
- **Data lineage register (Anya).** Documented and tested lineage for all regulatory reporting data flows. Discharge exit signal: lineage map in intranet; each regulatory return cell traces to source events.
- **DCAM maturity assessment (Anya).** Formal assessment of capability maturity against DCAM model. Scheduled pre-licence go-live readiness gate.
- **Master data domain APIs (Atlas + per-domain steward).** Canonical register queryable via API for all four domains. Status varies by domain — Party and instrument registers furthest advanced per build-phase substrate history.

---

## 9. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Devon (Chief Operating Officer, governance) + Anya (Data/analytics engineer, engineering) + Atlas (Core banking platform architect, engineering) | Initial policy authored. Seven operative sections: (1) Overarching — DCAM three-layer architecture, event-sourcing canonical model, single register per domain, POPIA safeguards, SA residency; (2) DCAM Architecture Alignment; (3) Data Classification — Public/Internal/Confidential/Restricted; (4) Data Quality — five dimensions with thresholds, DataQualityBreachDetected event; (5) Master Data Domains — Party/Instrument/Account/Legal Entity; (6) Data Lineage — regulatory reporting lineage requirement; (7) Typed events. |
