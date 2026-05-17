---
title: Reporting & analysis capability — specification
author: Anya
date: 2026-05-06
summary: Original M-phase reporting-capability spec. Superseded — D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN + slices 2-6 are the canonical build plan today.
decision-required: false
superseded-by:
  - decision-id: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
    decision-date: 2026-05-10
    note: "M2-M3 build plan + slices 2-6 (period-close, BA-325 LCR, BA-700, BA-350-600 XML, IFRS statements) supersede the M-phase framing here."
  - decision-id: D-REPORTING-CAPABILITY-SLICE-2
    decision-date: 2026-05-10
    note: "Period-close slice landed."
  - decision-id: D-REPORTING-CAPABILITY-SLICE-3
    decision-date: 2026-05-10
    note: "BA-325 LCR slice landed."
  - decision-id: D-REPORTING-CAPABILITY-SLICE-4
    decision-date: 2026-05-10
    note: "BA-700 slice landed."
  - decision-id: D-REPORTING-CAPABILITY-SLICE-6
    decision-date: 2026-05-10
    note: "IFRS statements slice landed."
superseded-on: 2026-05-11
superseded-by-author: Owen (Company Secretary, governance) — sweep authorised by CEO 2026-05-11
---

# Reporting & analysis capability — specification

**Author:** Anya (data / analytics engineer — lead)
**Contributors:** Bea (accounting / IFRS / BA returns), Camille (CFO — signs FS + BA returns), Mira (regulatory submissions: FIC, FATCA / CRS), Helena (risk reports), Eitan (treasury / ALCO pack), Owen (board / committee packs), Vera (independent-assurance hooks), Atlas (platform integration)
**Date:** 2026-05-06
**For:** Marc (CEO)
**Status:** **Specification only — no build at this stage.** Build follows under domain leads, sequenced per §7 phasing.

> **Derivation note (Principle 6).** Every artefact this capability produces is a **summarised derivation** of the event log (Principle 6, downward chain). Nothing is independently authored; nothing is assembled from spreadsheets. Specifications, generators, and outputs trace through the chain `Reg → Policy → Procedure → System Capability` (Principle 6, upward chain). This document is itself a specification at the policy/standard layer; the build is the system-capability layer.

---

## 1. Purpose

Specify the bank's capability to produce, in a regulator-credible and audit-defensible way:

1. **Annual Financial Statements (AFS)** under IFRS as adopted in South Africa.
2. **Regulatory returns** to PA, FIC, FSCA, SARS, Information Regulator, Excon (Authorised Dealers), and other authorities as the bank's licensing footprint grows.
3. **Internal reporting** — Board, BRC, AC, RemCo, NomCo, S&E Committee, ALCO packs; executive and departmental MI; daily / intraday operational dashboards.
4. **Analysis functions** — risk, customer, conduct, operational, profitability, scenario, BCBS 239 risk-data aggregation, model-monitoring outputs.
5. **External disclosures** — public, market-facing, regulator-mandated.

The capability operationalises Principles 1, 2, 3, 6, 7 as a coherent system.

## 2. Scope — capability inventory

### 2.1 Annual Financial Statements (Camille / Bea)

The bank produces, signs, and (post-licence) files an annual set of IFRS-compliant financial statements:

- **Statement of Financial Position** (IAS 1).
- **Statement of Profit or Loss and Other Comprehensive Income** (IAS 1).
- **Statement of Changes in Equity** (IAS 1).
- **Statement of Cash Flows** (IAS 7).
- **Notes** discharging IFRS 7, IFRS 9, IFRS 13, IFRS 15, IFRS 16, IAS 12, IAS 19, IAS 21, IAS 24, IAS 36, IAS 37, IFRIC 23, and others as scope grows.
- **Director report**, **audit report wrapper**, **King IV / Companies Act disclosures**.
- **Banks Act / PA disclosures** — Pillar 3 equivalents per Regs Relating to Banks.
- **Group consolidation** per IFRS 10 / IFRS 12 once the legal-entity tree extends.

Half-year and quarterly internal close cycles produce the same artefacts at lower formality.

### 2.2 PA / SARB Banks-Act regulatory returns (Bea, with Helena + Eitan contributions)

Computed from the event log; signed by Camille; submitted to PA on prescribed cadence:

- **BA 100** — Capital and reserve funds.
- **BA 110** — Capital adequacy (Pillar 1).
- **BA 120** — Composition of capital.
- **BA 200** — Statement of financial position.
- **BA 210** — Income statement.
- **BA 300** — Off-balance-sheet activities.
- **BA 320** — Daily liquidity returns.
- **BA 325** — LCR.
- **BA 326** — NSFR.
- **BA 330** — Large exposures.
- **BA 340** — Operational risk.
- **BA 350** — Market risk.
- **BA 400** — Credit risk.
- **BA 410** — Credit risk concentration.
- **BA 500** — Equity.
- **BA 600** — Counterparty credit risk and CVA.
- **BA 700** — IRRBB.
- **BA 900** — Statistical returns.
- Any further BA / DI returns per current and future Banks Act Regulations — extensible by register entry, not code branch (P5).

### 2.3 FIC submissions (Mira / Zara MLRO)

- **STR / SAR** XML (FIC s.29).
- **CTR** XML (FIC s.28).
- **TPR** XML (FIC s.28A).
- **Annual RMCP** attestation submission.
- Ad-hoc PCC / GN responses.

### 2.4 SARS / tax returns (Yael)

- **IT14 / IT14SD** — corporate tax.
- **IRP6** — provisional tax.
- **VAT 201** — including FS-apportionment workings.
- **FATCA XML** — annual.
- **CRS XML** — annual.
- **WT / WTI / WTD** — withholding tax (cross-border).
- **EMP201 / EMP501 / IRP5 / IT3** — payroll-related.
- **DTR01 / DTR02** — dividend tax.

### 2.5 FSCA / conduct returns (Zara, post-FSP-licence)

- FAIS-related returns.
- TCF / conduct-data submissions per FSCA conduct standards.
- COFI-era submissions (forward-compatible).

### 2.6 Joint Standard / cyber returns (Senna / Devon — interim CISO function)

- Joint Standard 1 of 2024 self-assessment.
- Material-incident reports (T3 / T4 per RAS B6).
- Annual cyber-resilience attestation.

### 2.7 Information Regulator (Iris)

- POPIA s.22 breach notifications (per `popia-breach-notification.md`).
- POPIA Reg. 4 Information Officer designation maintenance.
- PAIA reporting (s.32 Annual Report).

### 2.8 Excon / Authorised Dealer reports (Eitan / Yael)

- BoP reporting under the Currency and Exchanges Manual.
- Excon classifications and approvals tracking.

### 2.9 Other statutory (Sade / Owen)

- **Employment Equity** — EEA2 / EEA4.
- **Skills Development** — WSP / ATR.
- **B-BBEE** — verification submissions per Financial Sector Code.
- **OHS** — incident reports.
- **CIPC** — annual return (Companies Act).
- **JSE Listings Requirements** — when listed.

### 2.10 Internal — Board and committees (Owen / domain leads)

- **Board pack** (quarterly initially; monthly as activity scales).
- **BRC pack** (monthly).
- **AC pack** (quarterly).
- **RemCo pack** (quarterly).
- **NomCo pack** (semi-annual).
- **S&E Committee pack** (semi-annual).
- **ALCO pack** (weekly initially; semi-monthly stabilised).
- **Credit Committee pack** (when CreCo stood up).

Each pack has standing items per its charter; substantive content is generated.

### 2.11 Internal — Executive / departmental MI

- CEO daily / weekly briefing.
- Domain-specific dashboards: Treasury (Eitan), Markets (Saskia), Operations (Devon / Tomas), Compliance (Zara / Mira), Privacy (Iris), Security (Senna), Finance (Camille / Bea), HR (Sade), Legal (Imani).
- Customer / commercial dashboards (Niko).

### 2.12 Internal — assurance (Vera, future CAE)

- Continuous-controls evidence projection.
- Audit findings and remediation tracker.
- Combined-assurance map.
- AC quarterly third-line opinion.

### 2.13 Analysis functions (cross-domain)

- **Risk:** stress testing, sensitivity, attribution, model-monitoring outputs.
- **Customer:** segmentation, behavioural, churn, CLV, cross-sell propensity (POPIA-minimised).
- **Conduct:** TCF KRIs, complaints root-cause, advice-suitability sample.
- **Operational:** incident analytics, SLO compliance, error budgets, third-party SLA monitoring.
- **Profitability:** per product, per segment, per channel, per FTP-curve scenario.
- **BCBS 239:** risk-data aggregation across the full risk taxonomy.
- **Scenario / what-if:** ad-hoc analysis runs against frozen-as-of event projections.

## 3. Architectural pattern

The capability sits on top of the platform substrate already specified in the prototype plan. The pipeline is:

```
Event log (P1)
   │
   ▼
Projection runtime (deterministic, replayable, idempotent)
   │
   ▼
Master-data projections (client, product, instrument, legal-entity, calendar, currency, rate)
   │
   ▼
Semantic layer (Anya — single citable definition of every named quantity)
   │
   ▼
Report generators (per output type — AFS, BA returns, FIC XML, FATCA / CRS XML, board packs, dashboards)
   │
   ▼
Output formats (PDF, XML, JSON, web dashboard, regulator portal payload)
   │
   ▼
Distribution (regulator submissions, board distribution, public disclosure, internal access)
```

### 3.1 Foundational layers (already specified in `Owner Inbox/2026-05-05_local-prototype-plan.md`)

- **Event log** — append-only, signed, citation-required at append (P2). Local: SQLite via `bun:sqlite`. Azure target: managed Postgres with logical decoding, or Event Hubs + Cosmos DB.
- **Projection runtime** — pure functions over event streams; idempotent; replayable; as-of-replay first-class (P1).
- **Reconciliation harness** — CI gate on every projection change. GL ↔ event-derived ↔ sub-ledger reconcile to zero.

### 3.2 Master-data projections

Every report depends on master-data projections. They are themselves projections over events:

- **Client master** (per `Owner Inbox/2026-05-06_client-master-and-continuous-kyc.md` — D1 approved).
- **Product master** — every product the bank offers, with parameters.
- **Instrument master** — every traded / held instrument with reference data.
- **Legal-entity master** — bank's own + counterparties + UBOs (per Imani's taxonomy).
- **Calendar master** — jurisdictional holidays.
- **Currency master** — currencies, decimals, fixings.
- **Rate master** — FX rates, interest curves (ZARONIA-first, JIBAR fall-back), market data with rate-source and rate-timestamp.

### 3.3 Semantic layer

Anya's semantic layer defines, exactly once, every "named quantity" the bank computes:

- **Balance** — by account, by entity, by currency, by as-of date.
- **Exposure** — credit, market, counterparty.
- **P&L** — accrual basis, transactional, FTP-attributed, by attribution dimension.
- **RWA** — credit, market, operational, total.
- **Capital** — CET1, AT1, T2, total, leverage, conservation buffer.
- **Liquidity** — HQLA, net cash outflow, LCR, NSFR, intraday position.
- **ECL** — Stage 1, 2, 3 by portfolio.
- **VaR** — historical, parametric, expected shortfall.
- **Conduct KRIs** — complaints rate, advice-suitability rate, fee-disclosure rate.
- **MI metrics** — every executive-level metric.

Each definition carries an obligations-register citation; consumers query the layer; the same number reaches the BA return, the AFS note, the BRC pack, and the regulator submission.

### 3.4 Report generators

A library of generators, one per output type:

- **AFS generator** — IFRS-aware; produces statements + notes from the semantic layer.
- **BA-return generator** — per return; produces XML / fixed-format text per PA spec.
- **FIC XML generator** — STR / CTR / TPR / RMCP submissions.
- **FATCA / CRS XML generator** — per SARS BRS.
- **Board / committee pack generator** — produces structured Markdown / HTML / PDF from standing-item queries.
- **Dashboard generator** — produces static HTML + JS dashboards from semantic-layer outputs.
- **Ad-hoc query interface** — for analysts (with audit logging for POPIA purpose-binding).

### 3.5 Output formats

- **PDF** — for human-readable artefacts; rendered via headless Chrome / equivalent. Hash recorded in event log.
- **XML** — for regulatory submissions; schema-validated against the regulator's published XSD before submission.
- **JSON** — for programmatic consumption (APIs, downstream tools).
- **CSV / Excel** — for spreadsheet consumption (downloadable; not authored).
- **Web dashboard** — for interactive consumption, with role-based access and audit logging.

### 3.6 Distribution

- **Regulator portals** — Out-of-system submissions today (PA, FIC, SARS portals); future-state automation as portals expose APIs. Each submission is a typed event with timestamp, content hash, submitter identity.
- **Board / committee distribution** — secure, time-bombed access per access-control policy; all reads audited.
- **Public disclosure** — bank website, JSE SENS (when listed), Information Regulator-required publications.
- **Internal access** — through the dashboard layer; purpose-bound; POPIA-aware for personal-information dimensions.

## 4. Operating model

### 4.1 Roles per artefact

Every report / return has:

- **Owner (signs)** — the named accountable executive. e.g., AFS → Camille; ICAAP → Helena + Camille; BRC pack → Helena (with Owen secretariat); STR → Zara (MLRO).
- **Producer (engineering)** — the team running the generator. e.g., Bea for BA returns; Mira for FIC XML; Anya / Atlas for the platform plumbing.
- **Reviewer (independent)** — challenger from a different line of defence. e.g., Helena reviews Camille's capital report; Vera reviews compliance MI; external auditor reviews AFS post-appointment.
- **Distribution path** — to whom, when, through what channel.
- **Cadence** — daily / weekly / monthly / quarterly / annual / on-trigger.

### 4.2 Generation as events

Every report-generation cycle produces typed events:

- `ReportGenerated { report_id, type, as_of, content_hash, generator_version }`.
- `ReportApproved { report_id, approver_id, approver_signature, citation }`.
- `ReportSubmitted { report_id, recipient, submitted_at, submission_ref }` (regulators).
- `ReportDistributed { report_id, audience, distributed_at, audit_hash }` (internal).

The events are themselves the audit trail.

### 4.3 Approval discipline

- Every report has at least one cryptographic approval signature from its named owner.
- High-stakes artefacts (AFS, ICAAP, ILAAP, board RAS pack) carry CRO + CFO concurrence per the interim governance arrangement (decision A3 approved 2026-05-06).
- Approval is gated by reconciliation: no approval until the rec harness passes.

### 4.4 Cadence summary

| Artefact | Cadence | Owner |
|---|---|---|
| Daily LCR / NSFR / CET1 | Daily 06:00 UTC | Camille (Bea) |
| Intraday liquidity | Continuous; intraday checkpoints | Eitan |
| ALCO pack | Weekly | Eitan (chair) |
| Trading P&L | Daily | Saskia |
| BRC pack | Monthly | Helena (Owen secretariat) |
| AC pack | Quarterly | Owen + future CAE |
| RemCo pack | Quarterly | Sade + Helena (RemCo) |
| S&E pack | Semi-annual | Owen + future CHRO |
| Board pack | Quarterly initially | Owen |
| BA returns | Per PA cadence (most monthly / quarterly) | Camille (Bea) |
| AFS | Annual | Camille |
| ICAAP / ILAAP | Annual | Helena + Camille / Helena + Eitan |
| FIC submissions | On-trigger (STR / CTR / TPR) and annual (RMCP) | Zara (MLRO) |
| FATCA / CRS | Annual | Yael (Mira) |
| Tax returns | Per SARS cadence | Yael |

## 5. Reconciliation chain (Principle 6 — upward chain)

Every report carries:

- **Source policy** — e.g., AFS → Accounting Policies (IFRS); BA 325 → Liquidity Risk Management Policy.
- **Source procedure** — e.g., AFS → `month-end-close.md` (planned) → `afs-generation.md` (planned); BA returns → `ba-return-generation.md` (planned); STR → `str-filing.md` (planned).
- **Source obligations-register entries** — `ORG-AC-13` / `ORG-AC-14` / `ORG-PR-06` etc.
- **System capabilities used** — the platform components (`@platform/event-store`, `@platform/projection`, `@domains/capital/projection`, `@domains/reporting/render`) listed in the relevant procedures.

Vera consumes the chain end-to-end as continuous-controls evidence. Given any report, the lineage from event → projection → semantic-layer definition → generator → signed output → distribution event is reproducible.

## 6. Tech-stack alignment

### 6.1 Local development (per Atlas's prototype plan + cloud-target memory)

- **Runtime:** Bun + TypeScript strict.
- **Event store:** SQLite (`bun:sqlite`) — append-only events table, JSON payload, signed citations.
- **Projection runtime:** `@platform/projection` — pure-function reducers over event streams.
- **Semantic layer:** `@platform/semantic` — typed query interface; per-quantity definition with citation.
- **Report generators:** `@domains/reporting/<type>` — each generator pure, deterministic.
- **PDF rendering:** headless Chrome (already used for the decision-pack pipeline).
- **XML schema validation:** `xmllint` + regulator-published XSD.
- **Dashboards:** static HTML + JS (the same approach used for the obligations register and decision pack).
- **Observability:** Pino structured logs; OpenTelemetry-shaped traces.

### 6.2 Azure target (per memory: cloud-target Azure)

- **Event store:** Azure Database for PostgreSQL (logical decoding) for the simple case; Event Hubs + Cosmos DB Change Feed for higher-throughput surfaces. Selection by Atlas at cloud lift.
- **Compute:** Azure Container Apps for the projection runtime and report generators; Azure Functions for short-lived event handlers; AKS reserved for components needing fine-grained networking.
- **Identity:** Azure Entra ID for human and workload identity.
- **HSM / KMS:** Azure Key Vault Managed HSM (FIPS 140-2 Level 3) for signing keys, encryption keys.
- **Storage:** Azure Storage (Blob) for rendered artefacts; Azure SQL or Cosmos DB for projection caches; Data Lake Storage for analytical workloads.
- **Observability:** Azure Monitor + Application Insights + Log Analytics.
- **IaC:** Bicep (Azure-native; selectable to Terraform if multi-cloud emerges).
- **Data residency:** SA regions (South Africa North / South Africa West) for SA customer data per SARB Directive 3 of 2018.

The lift is **configuration**, not rewrite — the same generator code runs locally and in Azure; the substrate swaps behind the same TypeScript interfaces.

## 7. Implementation phasing

**Sequencing principle (CEO directive 2026-05-06): full local build first, migrate to cloud as a single coherent phase.**

M1–M7 are built **fully locally** as a complete, end-to-end bank capability. M8 is the migration to Azure as a single coherent phase — substrate replacement, not capability development. No capability work happens in cloud until the local build is complete.

| Phase | Scope | Owner | Target horizon |
|---|---|---|---|
| **M1 — Walking skeleton (LOCAL)** | Event store + 1 sample BA cell generated end-to-end (e.g., a single BA 100 line from a synthetic event stream); CI rec harness; threat-model gate. | Atlas + Bea + Senna | Weeks |
| **M2 — Semantic layer v1 + 1 full return (LOCAL)** | Anya's semantic-layer first slice; BA 325 (LCR) generated end-to-end; daily projection running. | Anya + Bea + Eitan | Weeks |
| **M3 — Prudential return suite (LOCAL)** | BA 100 / 110 / 120 / 200 / 210 / 300 / 325 / 326 / 330 generated; AFS draft (statement of financial position + P&L) skeleton. | Bea + Anya + Helena | 1–2 quarters |
| **M4 — Compliance suite (LOCAL)** | RMCP submission; STR / CTR / TPR generators; FATCA / CRS generators; sanctions-screening events feeding the FIC pipeline. | Mira + Zara + Yael | 1–2 quarters |
| **M5 — Tax + Excon (LOCAL)** | SARS suite (IT14SD / VAT 201 / EMP501 / dividend / withholding); Excon BoP submissions. | Yael + Eitan | 1 quarter (parallel with M4) |
| **M6 — Board & committee packs (LOCAL)** | All committee packs as queries — BRC, AC, RemCo, NomCo, S&E, ALCO, board. P6 across the board. | Owen + Helena + domain leads | 1 quarter (parallel with M3 / M4) |
| **M7 — Analytics & BCBS 239 (LOCAL)** | Risk analytics, customer analytics (POPIA-minimised), conduct KRIs, profitability attribution, BCBS 239 readiness. | Anya + Helena + Niko + Iris | 2 quarters |
| **— END LOCAL —** | Complete bank capability runs end-to-end locally. All procedures executable. All reports generating. All regulator submissions producible. Reconciliation harnesses passing. | All | Marker, not a phase |
| **M8 — Cloud migration (Azure)** | Single coherent migration phase: substrate replacement only. SQLite → managed Postgres (or Event Hubs + Cosmos). Software-backed signing → Key Vault Managed HSM (FIPS 140-2 L3). Mock identity → Entra ID. Pino → Azure Monitor / Log Analytics. Static dashboards → Container Apps + Storage. IaC fully Bicep / Terraform. SA region residency per SARB Directive 3 of 2018. | Atlas + Devon + Senna | Single coherent phase, sequenced with SARB licensing readiness |

**Substrate-replacement seams** are designed in from M1 — every substrate-touching component sits behind a clean TypeScript interface; the cloud lift swaps implementations, never capability code. This is the operational expression of "local build first, migrate as one phase".

Phases M2–M7 run partly in parallel under their respective owners; the table is for dependency management, not strict sequencing. M8 follows complete local build, not parallel.

## 8. Audit / assurance posture

- **End-to-end lineage** — every report ties through to events; every event has a citation; every citation has a register entry; every register entry has a regulator instrument. Vera tests this chain quarterly.
- **External-auditor read access** — once the external auditor is appointed, they receive read access to the event log + projections + generators; the AFS audit becomes a far cleaner exercise than legacy "tie-out to general-ledger snapshot".
- **Regulator engagement** — machine-readable submissions where supported (XML returns); human-rendered PDFs where required; submission events captured. Regulators may be granted read access to the obligations register and the policy library.
- **Continuous controls** — Vera's evidence pipeline reads every `ReportGenerated`, `ReportApproved`, `ReportSubmitted` event and produces a quarterly third-line opinion to the AC.
- **BCBS 239** — risk-data aggregation principles tested as a CI invariant, not an annual exercise.

## 9. Open items for CEO awareness

This is a major engineering programme; the build will be sequenced over several quarters and lifts to Azure mid-way. None of these items requires a Round-2-style decision today, but they will surface as decisions in future packs:

1. **External-auditor selection** — separate AC-led process (post-licence application; pre-AFS sign-off).
2. **Regulator-portal automation** — out-of-system submissions today; future-state automation depends on PA / FIC / SARS portal API availability.
3. **Tier-1 model validation cadence** — the LCR / NSFR / RWA / IFRS 9 ECL models in the report stack are Tier 1 per RAS B7; independent validation is required pre-deployment + annually.
4. **Cloud-lift sequencing** — Atlas to recommend the order of substrate moves to Azure (event store first vs projections first); decision M8.
5. **BCBS 239 readiness sign-off** — post-M7; Helena + Vera + future CAE jointly attest.
6. **Public disclosure cadence** — Pillar 3-equivalent public disclosure timing once the bank is live; Camille-led.

## 10. Co-dependencies

- `Owner Inbox/2026-05-05_local-prototype-plan.md` — Atlas's foundational platform plan (Bun / TS / SQLite stack).
- `Owner Inbox/2026-05-06_governance-framework.md` — Reserved Matters (AFS, capital plan) and committee charters.
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` — RAS thresholds drive monitoring and breach reporting.
- `Owner Inbox/2026-05-06_core-policies-finance.md` §1–§3 — Capital Management, Accounting (IFRS), Tax — define WHAT we report.
- `Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §1, §2, §3 — RMCP, AML / CFT, Sanctions — define regulatory reporting flows.
- `Owner Inbox/2026-05-06_client-master-and-continuous-kyc.md` — client master is the substrate for KYC-related reporting.
- `Owner Inbox/2026-05-06_policy-register.md` — every report has a policy backing.
- `Regulations/_obligations-register.md` — every report cites at least one register entry.
- `Procedures/by-policy/capital-ratio-monitoring.md` — exemplar procedure feeding daily ratios into the report stack.
- `CLAUDE.md` Principles 1–7 — bind the entire spec.
- `prototype/` — the system-capability layer that this spec addresses.

## 11. What this specification does *not* do

- **Does not specify the build.** Engineering details (table schemas, function signatures, deployment topology) follow under Atlas / Bea / Mira / Anya in subsequent design documents per phase.
- **Does not select the Azure-substrate primitives.** The choice between managed Postgres logical decoding vs Event Hubs + Cosmos DB is deferred to Atlas at M8.
- **Does not commit a delivery date.** Phasing horizons are indicative; concrete dates depend on hiring, regulator engagement, and the bank's licensing path.
- **Does not authorise the build.** Authorisation will be a CEO decision in a future pack once phasing dates are firm.

This is a specification of *what* the capability is, *why* it is shaped as described, and *how* it relates to the rest of the bank. The build follows.
