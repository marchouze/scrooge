# OTC Derivatives Provider (ODP) Regulatory Framework

**Curator:** Mira · **Status:** POPULATED · **Last reviewed:** 2026-05-24

## Citation

- **Authority:** Financial Markets Act 19 of 2012 (FMA); Financial Sector Regulation Act 9 of 2017 (FSRA)
- **Regulators:** Financial Sector Conduct Authority (FSCA) + Prudential Authority (PA) (joint for margin)
- **Enabling regulation:** FMA Regulations 2018 (GN R.98, GG 41433 of 23 January 2018)
- **Source docs:** `Regulations/ODP/source-docs/`

## Instruments in scope

| Slug | Instrument | Effective | Status |
|---|---|---|---|
| `cs-1-2018` | CS 1 of 2018 — Criteria for Authorisation of ODPs | 2018 | Active |
| `cs-2-2018` | CS 2 of 2018 — Conduct Standard for Authorised ODPs | 2018 | Active |
| `cs-3-2018` | CS 3 of 2018 — Reporting Obligations re OTC Derivatives | 2018 | Active (reporting live 1 Mar 2027 via Strate) |
| `js-2-2020` | JS 2 of 2020 (as amended 9 Jun 2023) — Margin Requirements | 2020 (amend. 2023) | Active |
| `jn-2-2024` | JN 2 of 2024 — Margin Reporting via Umoja | 1 Apr 2025 | Active |

## Scope and applicability

The ODP framework governs any entity seeking or holding authorisation as an OTC Derivatives Provider under the FMA. Once authorised, the bank is bound by:

- **Conduct Standard 1 of 2018** — authorisation criteria (capital, fit-and-proper, risk management, compliance, BCP, record-keeping for 5 years; Form FM6 application)
- **Conduct Standard 2 of 2018** — ongoing conduct obligations (client categorisation, appropriateness, disclosure, ISDA-compatible agreements, timely confirmations, portfolio reconciliation, dispute resolution, portfolio compression, collateral safeguarding)
- **Conduct Standard 3 of 2018** — trade reporting obligations (all 5 asset classes to a licensed trade repository; 100 Annexure A data fields including LEI, UTI, UPI; T+1 reporting; 5-year record retention)
- **Joint Standard 2 of 2020** — margin requirements for non-centrally cleared OTC derivatives (IM phasing, VM daily exchange, MTA ≤ R5m aggregate, eligible collateral, segregation; Phase 5 permanent from Sep 2025: AANA > R100bn threshold)
- **Joint Notice 2 of 2024** — margin regulatory reporting via Umoja portal (daily T+1 by 16:00 SAST, effective 1 April 2025; applies regardless of thresholds)

The bank is **pre-licence** as of 2026-05-24. ODP authorisation applies when the bank commences OTC derivatives activity; obligations are designed-against now and activate at commencement of trading.

## Key obligations

### Authorisation (CS 1 of 2018)

- **s.4.1** — Minimum operational capital (quantum prescribed in Annexure 1; liquid assets only)
- **s.4.2** — Fit-and-proper requirements for key individuals (honesty, competence, experience; Form FM6 disclosure; all s.4.2.1–4.2.5 criteria)
- **s.4.3** — Risk management: independent risk function, risk appetite, counterparty credit risk controls, documented policies
- **s.4.4** — Compliance: dedicated compliance officer, compliance monitoring programme, regulatory breach reporting to FSCA
- **s.4.5** — BCP: documented business continuity and recovery plan tested at least annually
- **s.4.6** — Record-keeping: all OTC derivative transactions and related documents for ≥5 years post-termination

### Conduct (CS 2 of 2018)

- **s.4** — Categorise clients (eligible counterparty / professional client / retail client); appropriateness assessment for retail
- **s.6** — Pre-trade disclosure (product terms, risks, costs, conflicts of interest)
- **s.7** — Written client agreements; ISDA provisions required for covered transactions
- **s.8** — Timely trade confirmation: T+1 for IR and credit derivatives; T+2 for FX, equity, commodity derivatives; T+3 for structured products
- **s.9** — Portfolio reconciliation: daily (≥500 transactions), weekly (51–499), quarterly (≤50)
- **s.10** — Dispute resolution: escalation procedures; R100m threshold for formal escalation within 10 business days
- **s.11** — Portfolio compression: at least twice per year for portfolios ≥500 transactions

### Trade reporting (CS 3 of 2018)

- **s.3** — Report all OTC derivatives (commodity, credit, FX, equity, interest rate) to licensed trade repository
- **s.5 + Annexure A** — Report ≥100 data fields per trade including LEI, UTI, UPI, counterparty data, product data, clearing status, collateral, valuation
- **s.6** — Frequency: T+1 (new/modify/terminate); daily MTM valuation
- **s.7** — Identifiers: LEI for all counterparties; UPI for instruments; UTI for transactions (allocated by reporting provider; adopted by non-reporting counterparty)
- **s.9** — Transitional: 6 months from effective date to start reporting; 18-month back-load within 180 days
- **Licensed trade repository:** Strate (Pty) Ltd (licensed December 2024; live 1 March 2027)

### Margin (JS 2 of 2020)

- **s.3(3)** — Minimum transfer amount: aggregate IM + VM ≤ R5 million per netting set
- **s.4.1** — Initial margin threshold: ≤ R500 million per consolidated counterparty group
- **s.4.2** — Phase 5 (permanent from 1 Sep 2025): IM requirements apply if group AANA > R100 billion
- **s.5** — Variation margin: daily, full mark-to-market exposure, per netting set
- **s.6** — Eligible collateral: ZAR cash, major FX cash, SAGBs, gold, IG sovereign bonds, high-quality corporate bonds, major-index equities, qualifying CIS units (subject to regulatory haircuts)
- **s.7** — Segregation: IM must be segregated from collecting party's proprietary assets; no re-hypothecation
- **s.2.1(4)** — Exclusion: physically settled FX forwards and FX swaps excluded from IM and VM

### Margin regulatory reporting (JN 2 of 2024)

- **s.2** — Submit regulatory reporting metrics (MR Version 1 schema) to Umoja portal (Prudential Authority's secure portal)
- **s.3.1** — Transmission: Excel upload, in-portal, or machine-to-machine via Umoja API
- **s.3.3** — Frequency: daily T+1 by 16:00 South African time; public holidays → next business day
- **s.4.1** — Effective: 1 April 2025; applies regardless of IM/VM thresholds

## Fulfilment in the bank's policy stack

| ODP regulatory requirement | Fulfilment policy / procedure | Owner |
|---|---|---|
| CS 1 s.4.1 — Operational capital | Operational Capital Policy | Camille |
| CS 1 s.4.2 — Fit-and-proper | Fit-and-Proper Assessment Procedure | Sade / Nolan |
| CS 1 s.4.3 — Risk management | Market Risk Policy; Counterparty Credit Risk Policy | Helena |
| CS 1 s.4.4 — Compliance | Compliance Monitoring Programme | Rashida |
| CS 1 s.4.5 — BCP | Business Continuity Policy | Devon |
| CS 1 s.4.6 — Record-keeping (5 yr) | Records Management Policy; RMS substrate | Owen / Scrooge |
| CS 2 s.4–6 — Client categorisation and disclosure | Client Onboarding Policy; Product Suitability Procedure | Niko / Rashida |
| CS 2 s.7 — Client agreements (ISDA) | ISDA Negotiation Procedure; Legal Entity Policy | Imani |
| CS 2 s.8 — Timely confirmation | Trade Confirmation Procedure | Rashida |
| CS 2 s.9 — Portfolio reconciliation | Portfolio Reconciliation Procedure | Rashida |
| CS 2 s.10 — Dispute resolution | OTC Derivative Dispute Resolution Procedure | Rashida |
| CS 2 s.11 — Portfolio compression | Portfolio Compression Procedure | Rashida |
| CS 3 s.3–7 — Trade reporting (Strate) | Trade Reporting Procedure; Regulatory Reporting Policy | Rashida |
| JS 2 s.3–7 — Margin (IM, VM, collateral) | Margin Management Policy; Collateral Management Procedure | Helena / Rashida |
| JN 2/2024 — Umoja margin reporting | Margin Reporting Procedure (Umoja) | Rashida |

## Source text index

All raw PDFs, extracted text, and structured JSON are in `Regulations/ODP/source-docs/`:

| File | Description |
|---|---|
| `cs-1-2018.pdf` / `.txt` / `-structured.json` | CS 1 of 2018 — ODP authorisation criteria |
| `cs-2-2018.pdf` / `.txt` / `-structured.json` | CS 2 of 2018 — Conduct standard for ODPs |
| `cs-3-2018.pdf` / `.txt` / `-structured.json` | CS 3 of 2018 — Trade reporting (100-field Annexure A) |
| `js-2-2020.pdf` / `.txt` / `-structured.json` | JS 2 of 2020 (as amended Jun 2023) — Margin requirements |
| `jn-2-2024.pdf` / `.txt` / `-structured.json` | JN 2 of 2024 — Umoja margin reporting determination |

## Regulatory timeline (key dates)

| Date | Event |
|---|---|
| Oct 2018 | CS 1, CS 2, CS 3 of 2018 published |
| 2 Jun 2020 | JS 2 of 2020 published |
| 9 Jun 2023 | Amendment 1 of 2023 to JS 2 of 2020 effective (Phase re-dates; s.6A inserted) |
| 11 Dec 2024 | JN 2 of 2024 signed |
| Dec 2024 | Strate (Pty) Ltd licensed as trade repository |
| 1 Apr 2025 | JN 2 of 2024 (Umoja margin reporting) effective |
| 1 Sep 2025 | JS 2 Phase 5 permanent: AANA > R100bn threshold |
| 1 Mar 2027 | CS 3 trade reporting live via Strate |
