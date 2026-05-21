---
policy-id: COUNTERPARTY-ONBOARDING-V1
title: Counterparty Onboarding Policy
version: "1"
status: IN FORCE
owner: Zara (Chief Compliance Officer, governance)
effective-from: "2026-05-14"
next-review: "2027-05-14"
citations:
  - "FSCA Conduct Standard 3 of 2018 §§3, 7: written trading-relationship agreement; client/counterparty categorisation and due diligence"
  - "Financial Intelligence Centre Act 38 of 2001: ss.21–22 (customer due diligence); s.29 (reporting suspicious transactions)"
  - "FAIS Act 37 of 2002: s.8 (client categorisation); GCC (BN 80/2003) s.8 (suitability)"
  - "Banks Act 94 of 1990: Reg 39 (outsourcing; third-party governance — counterparty vetting)"
  - "POPIA Act 4 of 2013: ss.9–11 (lawful grounds for processing); ss.19–22 (security safeguards)"
  - "ISDA Master Agreement 2002 (and 1992 ISDA): Sections 3–5 (representations; agreements; default events)"
  - "ICMA GMRA 2011: Paragraphs 2 (representations), 10 (default events)"
author: Mira (Compliance / RegTech engineer)
co-author: Zara (Chief Compliance Officer, governance)
date: 2026-05-14
summary: >
  Counterparty Onboarding Policy governing the end-to-end process for establishing,
  screening, categorising, and documenting new trading counterparties. Covers KYC/AML
  CDD, FSCA CS 3/2018 §7 categorisation, ISDA / GMRA documentation gate, sanctions
  screening, and ongoing monitoring. Closes obligations ORG-CS3-001, ORG-MK-06
  (documentation gate), ORG-MK-12 (CSA execution), ORG-MK-13 (GMRA execution).
  COMMENCEMENT-BIND for OTC; IN_FORCE for AML/CDD baseline.
decision-required: false
riskTaxonomy:
  - RT-CD.CC
  - RT-LR.CT
  - RT-FC
---

# Counterparty Onboarding Policy

> **Authors.** Zara (Chief Compliance Officer, governance) — lead; Mira (Compliance / RegTech engineer) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Authored under the events-first authoring rule and the no-pause dispatch rule — CLAUDE.md "Operating procedures".
> **Obligations closed.** `ORG-CS3-001` (written trading-relationship agreement per CS 3/2018 §3), `ORG-MK-06` (ISDA / GMRA documentation gate), `ORG-MK-12` (CSA execution), `ORG-MK-13` (GMRA SA schedule execution).
> **Status.** COMMENCEMENT-BIND for OTC derivative onboarding obligations (CS 3/2018 §§3, 7). AML/CDD baseline obligation (FICA ss.21–22) is IN_FORCE — applies from commencement of banking business.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Purpose and Scope

This policy governs the process by which the bank establishes new counterparty relationships for trading, financing, and other financial transactions. It defines the steps for due diligence, categorisation, documentation, and approval that must be completed before any transaction is executed with a new counterparty.

**In scope:**
- OTC derivative counterparties (requiring ISDA Master Agreement + CSA)
- Repo / reverse-repo counterparties (requiring GMRA 2011 + SA Schedule)
- Correspondent and sponsoring banks
- Institutional investors and asset managers
- Corporate treasury counterparties
- Brokers and prime brokers

**Out of scope:**
- Retail customers (the bank is institutional-only; retail onboarding activates at licence-day under the Niko lifecycle — paused per build-phase operating model)
- Intra-group transactions (governed by the Governance Framework and related-party transaction procedure)

---

## 2. Regulatory Framework

| Instrument | Obligation | Scope |
|---|---|---|
| FSCA Conduct Standard 3/2018 §§3, 7 | Written trading-relationship agreement before first OTC transaction; client/counterparty categorisation and due diligence | OTC Derivative Provider |
| FICA ss.21–22 | Customer due diligence (CDD); enhanced due diligence (EDD) for higher-risk counterparties | All counterparty types |
| FAIS Act s.8 + GCC s.8 | Counterparty categorisation for advice / intermediary services; suitability | Where FAIS-licensed services provided |
| POPIA Act 4/2013 ss.9–11 | Lawful processing of counterparty personal information (natural-person directors, beneficial owners) | Personal information collected at onboarding |
| Banks Act Reg 39 | Third-party governance — correspondent bank vetting | Correspondent / sponsor banks |

---

## 3. Counterparty Categorisation

### 3.1 FSCA CS 3/2018 §7 Categorisation

Before the first OTC derivative transaction, the bank must categorise each counterparty per CS 3/2018 §7:

| Category | Definition | Due Diligence Level |
|---|---|---|
| Eligible Counterparty | Banks, brokers, insurers, pension funds, collective investment schemes, large corporates (≥ ZAR 50m net assets) | Standard CDD + ISDA/GMRA documentation |
| Retail Client | All others | Enhanced — but bank is institutional-only; retail transactions require board approval |

The bank's operating posture is **institutional-only**. Any request to transact with a non-eligible counterparty is escalated to Zara (CCO) and Saskia (Head of Global Markets, governance) before proceeding.

### 3.2 FAIS Act Categorisation (where applicable)

Where the bank provides financial advice or intermediary services under its FSP licence:
- **Institutional clients:** Banks, insurers, collective investment scheme managers — categorised as professional clients
- **Corporate clients:** Assessed against GCC s.8 suitability criteria
- Categorisation is recorded in the counterparty record at onboarding

---

## 4. Onboarding Process

### Stage 1: Initial Screening

1. Niko (Sales / CRM engineer) or Saskia (Head of Global Markets, governance) initiates onboarding request via the onboarding workflow
2. Mira runs initial sanctions and PEP screening against:
   - OFAC SDN list
   - UN Security Council consolidated sanctions list
   - EU consolidated sanctions list
   - SARB FinSurv / FIC sanctions list
3. If any match: the onboarding is suspended and escalated to Zara (CCO) immediately; no transaction may proceed
4. Initial screening results are logged as a `CounterpartyScreeningEvent` in the event store

### Stage 2: KYC / CDD

The following minimum documentation is required for all counterparty types:

**Legal entities:**
- Certificate of incorporation / registration (CIPC or equivalent)
- Memorandum of incorporation / constitutional documents
- List of beneficial owners (≥ 25% shareholding threshold per FICA)
- Proof of registered address (≤ 3 months)
- Details of directors / authorised signatories
- Financial statements (most recent audited; or management accounts for private companies)
- Group structure chart (where applicable)

**Banks and regulated financial institutions:**
- Regulatory authorisation certificate (from home regulator)
- Correspondent banking questionnaire (Wolfsberg Group standard format)
- AML programme certification

**Enhanced Due Diligence (EDD)** applies where:
- Counterparty is in a high-risk jurisdiction (FATF grey/black list)
- Beneficial owner is a Politically Exposed Person (PEP)
- Complex group structure with intermediate holding entities in opaque jurisdictions
- Transaction volumes or notional sizes are materially above peer norms

EDD is approved by Zara (CCO) before onboarding proceeds.

### Stage 3: Documentation Execution

Before any transaction is executed, the following documentation must be fully executed:

| Document | Required For | Responsible |
|---|---|---|
| ISDA Master Agreement (2002 or 1992) + Schedule | OTC derivatives | Imani (Legal-as-code engineer) |
| Credit Support Annex (NY Law 1994 or English Law 1995) | OTC derivatives with margin obligations | Imani + Eitan (Treasurer) |
| GMRA 2011 + SA Jurisdiction Schedule | Repo / reverse-repo | Imani + Tomas (Operations & payments engineer) |
| GMSLA 2010 (if applicable) | Securities lending | Imani + Eitan |
| Netting opinion (SA law) | All bilateral netting | Imani + external counsel (at licence-application gate) |

The documentation gate is enforced by the onboarding workflow — no `CounterpartyApproved` event is emitted until all required documents are executed and uploaded to the document store.

### Stage 4: Onboarding Approval

- Completed onboarding files are reviewed by Zara (CCO) before final approval
- Approval is recorded as a `CounterpartyApproved` event in the event store
- The counterparty record is created in the Party Register (per `D-PARTY-REGISTER`, CEO-approved 2026-05-11)
- Counterparty is assigned a risk rating (Standard / Enhanced) by Helena (Chief Risk Officer, governance) based on CDD findings and credit assessment

---

## 5. Ongoing Monitoring

- **Annual refresh:** all counterparty KYC/CDD documentation refreshed annually (or triggered by material change)
- **Continuous sanctions screening:** all counterparties screened against sanctions lists daily; any new match triggers immediate suspension and Zara (CCO) escalation
- **Event-triggered review:** mergers, ownership changes, adverse news events, regulatory sanctions against the counterparty — trigger immediate out-of-cycle review
- **Activity monitoring:** Mira monitors transaction patterns against counterparty-level thresholds; anomalies escalated to Zara (CCO) and the FIC reporting function

---

## 6. Relationship with Collateral Management

Upon onboarding approval:
1. CSA eligibility schedule and haircut parameters are confirmed with Eitan (Treasurer)
2. MTA and threshold are negotiated and recorded
3. Initial margin calculation model (SIMM or schedule) is agreed
4. Collateral Management Policy provisions apply from the first transaction

---

## 7. Governance

| Role | Accountability |
|---|---|
| Zara (Chief Compliance Officer, governance) | Policy owner; EDD approval; final onboarding sign-off |
| Mira (Compliance / RegTech engineer) | Process engineering; sanctions screening; CDD quality review |
| Niko (Sales / CRM engineer) | Initial onboarding request; client relationship data capture |
| Saskia (Head of Global Markets, governance) | Counterparty categorisation (OTC); business approval |
| Imani (Legal-as-code engineer) | Documentation execution; netting-opinion coordination |
| Eitan (Treasurer, governance) | CSA / collateral parameter confirmation |
| Helena (Chief Risk Officer, governance) | Counterparty risk rating; credit limit assignment |
| Tomas (Operations & payments engineer) | Post-onboarding setup — settlement accounts; SSI registration |

### 7.1 Review Cadence

- **Annual review:** Zara (CCO) reviews policy and CDD standards by end of Q1 each year
- **Trigger review:** FATF mutual evaluation update; new FSCA guidance; material regulatory change
- **Board Risk Committee:** Quarterly counterparty onboarding metrics (new counterparties; EDD cases; rejections) tabled to the BRC

---

## 8. Data and Records

- All onboarding documentation is stored in the BLAKE3 content-addressed document store (per `D-RMS-PHASE-1`, CEO-approved 2026-05-09)
- Retention: minimum 5 years from end of counterparty relationship (FICA retention requirement)
- POPIA s.19–22: access to counterparty personal information restricted to onboarding team and compliance function; Iris (Information Officer, governance) oversight

---

## 9. Substrate Gaps

| Gap | Owner | Target |
|---|---|---|
| CounterpartyScreeningEvent and CounterpartyApproved event types | Atlas (Data infrastructure engineer) | Next substrate slice |
| Party Register counterparty-record linkage | Atlas (Data infrastructure engineer) | Phase 3 — party-register completion |
| Wolfsberg questionnaire digital template | Imani (Legal-as-code engineer) | Pre-commencement gate |
| SA netting-enforceability opinion | Imani + external counsel | Licence-application gate |

---

## 10. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| 1 | 2026-05-14 | Mira (Compliance / RegTech engineer) | Initial version — closes ORG-CS3-001, ORG-MK-06 (documentation gate), ORG-MK-12, ORG-MK-13 |
