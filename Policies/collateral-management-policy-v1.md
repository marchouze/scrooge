---
policy-id: COLLATERAL-MANAGEMENT-V1
title: Collateral Management Policy
version: "1"
status: IN FORCE
owner: Eitan (Treasurer, governance)
effective-from: "2026-05-14"
next-review: "2027-05-14"
citations:
  - "Joint Standard 2 of 2020 — Margin Requirements for Non-Centrally Cleared OTC Derivative Transactions (as amended 9 June 2023): §§3–7 (VM, IM, eligible collateral, MTA)"
  - "ISDA Credit Support Annex — NY Law (1994) Paragraphs 1–13"
  - "ISDA Credit Support Annex — English Law (1995 Transfer) Paragraphs 1–11"
  - "ICMA Global Master Repurchase Agreement 2011: Paragraphs 1–20 + SA Jurisdiction Schedule"
  - "BCBS Large Exposures Framework (April 2014 + revisions): single-counterparty exposure caps"
  - "FSCA Conduct Standard 3 of 2018 §§3–9: OTC Derivative Provider conduct obligations"
  - "Banks Act 94 of 1990: Reg 28 (large exposures)"
author: Mira (Compliance / RegTech engineer)
co-author: Eitan (Treasurer, governance)
date: 2026-05-14
summary: >
  Collateral Management Policy covering eligible collateral types, haircut schedules,
  margin call mechanics (VM + IM), minimum transfer amounts, collateral disputes,
  rehypothecation restrictions, and governance. Closes obligations ORG-PR-16,
  ORG-MK-06, ORG-MK-12, ORG-MK-13, ORG-JS2-003. COMMENCEMENT-BIND for OTC;
  IN_FORCE for prudential large-exposures framework.
decision-required: false
riskTaxonomy:
  - RT-CR.CP
  - RT-CR.CC
  - RT-LR.CT
---

# Collateral Management Policy

> **Authors.** Eitan (Treasurer, governance) — lead; Mira (Compliance / RegTech engineer) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Authored under the events-first authoring rule and the no-pause dispatch rule — CLAUDE.md "Operating procedures".
> **Obligations closed.** `ORG-PR-16` (counterparty-credit exposure / netting under ISDA / GMRA), `ORG-MK-06` (ISDA / GMRA master agreements + collateral), `ORG-MK-12` (OTC CSA execution and margin-call mechanics), `ORG-MK-13` (GMRA repo / reverse-repo collateral), `ORG-JS2-003` (eligible collateral — JS 2/2020 §6).
> **Status.** COMMENCEMENT-BIND for OTC derivative collateral obligations (JS 2/2020 §§4–7). Prudential large-exposures netting framework (ORG-PR-16, ORG-PR-40) is IN_FORCE — obligation binds from commencement of banking business.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Purpose and Scope

This policy establishes the bank's framework for managing collateral across OTC derivative transactions, repurchase agreements, and other secured-financing activities. It defines eligible collateral types, haircut schedules, margin-call mechanics, dispute-resolution procedures, and governance accountabilities.

**In scope:**
- All OTC derivative transactions with a CSA (Credit Support Annex) attached to the governing ISDA Master Agreement
- Repurchase agreements and reverse-repurchase agreements under the ICMA GMRA 2011 with the South African jurisdiction schedule
- Bilateral secured lending and other collateralised facilities
- Initial Margin (IM) and Variation Margin (VM) under Joint Standard 2 of 2020 (as amended 9 June 2023)

**Out of scope:**
- Exchange-traded and centrally-cleared transactions (governed by CCP / JSE Clear rules — see `ORG-JSE-IRC-03`)
- Unsecured interbank credit facilities (governed by the Credit Risk Policy)

The bank is an indirect participant in critical market infrastructures (CLS, SAMOS). All collateral movements for centrally-cleared OTC positions are effected via the bank's sponsor / correspondent bank. The indirect-participant operating posture is recorded in memory `project_indirect_participant_posture.md`.

---

## 2. Regulatory Framework

| Instrument | Obligation | Scope |
|---|---|---|
| Joint Standard 2 of 2020 (as amended 9 June 2023) | VM and IM margin requirements; eligible collateral; MTA | OTC non-centrally-cleared derivatives |
| ISDA CSA (NY Law 1994; English Law 1995 Transfer) | Margin-call mechanics; collateral eligibility; dispute resolution | OTC derivatives |
| ICMA GMRA 2011 + SA Schedule | Transfer-of-title repo mechanics; margin maintenance | Repo / reverse-repo |
| Banks Act Reg 28 + BCBS Large Exposures | Single-counterparty exposure cap; netting recognition | Prudential consolidated |
| FSCA Conduct Standard 3/2018 §§3, 8 | Written trading-relationship agreement; valuation methodology | OTC Derivative Provider |

---

## 3. Eligible Collateral and Haircuts

### 3.1 OTC Derivative CSA — Eligible Collateral (per JS 2/2020 §6)

The following collateral types are eligible under the bank's standard CSA schedules:

| Collateral Type | Currency | Haircut (VM) | Haircut (IM) | Notes |
|---|---|---|---|---|
| Cash (ZAR) | ZAR | 0% | 0% | Standard; segregated for IM |
| Cash (USD / EUR / GBP) | Foreign | 0% | FX haircut per BCBS schedule | Subject to Excon approval for cross-border transfer |
| South African Government Bonds (SAGB) | ZAR | Per maturity band (below) | Per maturity band + 20% addon | Eligible per JS 2/2020 §6 as amended 2022 |
| Gold (LBMA spot) | USD | 15% | 15% | Per JS 2/2020 §6 |

**SAGB maturity haircut schedule (VM):**
- < 1 year residual maturity: 0.5%
- 1–5 years: 2%
- 5–10 years: 4%
- > 10 years: 8%

**IM haircut addon (above VM levels):**
- All non-cash collateral: +20% haircut over VM levels per BCBS non-cash IM haircut floor

### 3.2 Repo / Reverse-Repo (GMRA 2011)

- **Eligible purchased securities:** South African Government Bonds; JSE-listed corporate bonds rated ≥ A (S&P / Moody's SA scale); eligible international bonds per approved counterparty agreement
- **Margin maintenance:** initial margin per GMRA 2011 Paragraph 2; maintenance margin per agreed threshold
- **Substitution:** permitted per GMRA 2011 Paragraph 8; notification required 24 hours in advance

---

## 4. Margin Requirements — OTC Non-Centrally-Cleared Derivatives

### 4.1 Variation Margin (VM)

- **Frequency:** calculated and called daily as of market close
- **Valuation:** mark-to-market per FSCA CS 3/2018 §8 valuation methodology (daily; consistent pricing source; documented)
- **Settlement:** same-day (T+0) or next business day (T+1) per CSA paragraph 4(c) / equivalent
- **Currency:** as specified in the CSA schedule; ZAR preferred for domestic counterparties

### 4.2 Initial Margin (IM)

- **Phased applicability:** Final phase (September 2025) — applies to counterparty pairs where aggregate average notional exceeds ZAR 100bn. The bank monitors its phase-threshold status and applies IM requirements when triggered.
- **Methodology:** ISDA SIMM (Standard Initial Margin Model) — the bank uses an approved SIMM implementation. Alternatively, schedule-based IM per JS 2/2020 Annex A.
- **Segregation:** IM must be held in a tri-party segregated account, separate from the bank's proprietary assets and from the counterparty's assets. The bank's sponsor/correspondent bank operates the tri-party infrastructure.
- **Legal isolation:** IM segregation must be bankruptcy-remote from both parties per JS 2/2020 §5.

### 4.3 Minimum Transfer Amount (MTA)

- **MTA:** aggregate (VM + IM) ≤ ZAR 5,000,000 per counterparty, per JS 2/2020 §7
- **Rounding:** nearest ZAR 100,000 (or as specified in the CSA schedule)
- **Threshold:** ZAR zero (zero-threshold bilateral) for standard institutional counterparties. Non-zero thresholds require Eitan (Treasurer) and Helena (Chief Risk Officer, governance) sign-off.

---

## 5. Collateral Operations

### 5.1 Margin Call Process

1. Ravi (Treasury / ALM engineer) calculates daily MTM valuations and VM / IM requirements by 08:30 SAST
2. Margin calls are issued by 09:00 SAST via the agreed communication channel (SWIFT MT527 or email per CSA)
3. Counterparties have until 14:00 SAST to deliver (or until the CSA-specified settlement time, whichever is earlier)
4. Failed margin calls are escalated to Eitan (Treasurer) at 14:30 SAST; if unresolved by close of business, the event is escalated to Helena (CRO) and Zara (Chief Compliance Officer, governance) as a potential default or close-out trigger

### 5.2 Collateral Valuation

- Collateral is valued at market prices using the same pricing source as VM calculation (FSCA CS 3/2018 §8)
- SAGB prices: JSE Bond Exchange reference prices at T+0 close
- Gold prices: LBMA AM fix for IM; PM fix for same-day calls
- Foreign-currency collateral: SARB spot rate at close

### 5.3 Substitution Requests

- Counterparty substitution requests must be received by 11:00 SAST
- Ravi evaluates eligibility per section 3 above and confirms acceptance by 13:00 SAST
- Substitutions are documented as a collateral movement event in the event store

### 5.4 Rehypothecation

- The bank does **not** rehypothecate IM received from counterparties
- VM received in cash may be reused in the ordinary course (consistent with transfer-of-title characterisation under English-law CSA)
- Non-cash VM may not be rehypothecated without explicit counterparty consent documented in the CSA schedule
- Rehypothecation policy is reviewed annually by Eitan (Treasurer) and Helena (CRO)

---

## 6. Dispute Resolution

### 6.1 Valuation Disputes

1. A counterparty may dispute a margin call within the dispute period specified in the CSA (typically 1 business day after receipt)
2. The undisputed portion of the margin call is paid without delay
3. Ravi initiates the dispute-resolution process: compare pricing sources, identify discrepancy root cause
4. If unresolved within 5 business days, Eitan (Treasurer) escalates to Zara (CCO) and the matter is referred to the FSCA CS 3/2018 §6 dispute-resolution procedure
5. All disputes are logged in the dispute register maintained by Tomas (Operations & payments engineer) under `Procedures/by-policy/otc-dispute-resolution.md` (planned)

### 6.2 Eligibility Disputes

- Disputes over collateral eligibility are referred to Imani (Legal-as-code engineer) for CSA interpretation
- External counsel opinion is sought where the dispute cannot be resolved internally within 5 business days

---

## 7. Counterparty Credit Risk — Netting and Exposure

- The bank recognises close-out netting under legally enforceable ISDA Master Agreements (with SA legal-netting opinion from Imani and external counsel at the licence-application gate)
- GMRA 2011 netting is recognised per the SA Jurisdiction Schedule netting enforceability confirmation
- Net exposures (post-netting, post-collateral) are reported to Helena (CRO) as inputs to the Counterparty Credit Risk Policy's concentration and large-exposure calculations
- Single-counterparty exposure caps per Reg 28 + BCBS LEX Directive are enforced by Helena (CRO) using net exposures computed after eligible collateral netting

---

## 8. Governance

| Role | Accountability |
|---|---|
| Eitan (Treasurer, governance) | Policy owner; day-to-day collateral management oversight; margin call governance |
| Ravi (Treasury / ALM engineer) | Operational execution — VM / IM calculation, call issuance, dispute triage |
| Helena (Chief Risk Officer, governance) | Risk appetite for counterparty credit exposure; large-exposure sign-off |
| Zara (Chief Compliance Officer, governance) | Regulatory compliance oversight; escalation for unresolved disputes |
| Imani (Legal-as-code engineer) | CSA / GMRA legal interpretation; netting-opinion coordination |
| Tomas (Operations & payments engineer) | Settlement execution; collateral movement booking |
| Mira (Compliance / RegTech engineer) | Regulatory intelligence; JS 2/2020 and CS 3/2018 compliance monitoring |

### 8.1 Review Cadence

- **Annual review:** Eitan (Treasurer) and Helena (CRO) review eligible-collateral schedule, haircut levels, and MTA — by end of Q1 each year
- **Trigger review:** material change in regulation (JS 2/2020 amendment; PA directive) or counterparty default event triggers immediate policy review within 10 business days
- **Board Risk Committee:** Quarterly collateral-and-margin report tabled by Eitan to the BRC (interim: reported to the Interim Audit Forum under Owen's chairmanship until BRC is constituted)

---

## 9. Relationship with Other Policies

| Policy | Interaction |
|---|---|
| Credit Risk Policy | Counterparty credit exposure limits; netting recognition inputs |
| Market Risk Policy | VM calculation inputs; mark-to-market methodology |
| Liquidity Risk Management Policy | Collateral liquidity buffer; intraday liquidity for margin calls |
| Operational Resilience Policy | Business continuity for collateral operations (margin call execution) |
| Counterparty Onboarding Policy | Collateral eligibility confirmed at onboarding; CSA negotiation |
| Margin Policy | Detailed VM / IM calculation procedures (JS 2/2020 cluster) |
| AML / CFT Policy | Collateral counterparty KYC / sanctions screening at onboarding |

---

## 10. Substrate Gaps

| Gap | Owner | Target |
|---|---|---|
| Collateral movement event type in event store | Ravi (Treasury / ALM engineer) | Next markets-substrate slice |
| Tri-party segregation account integration (via correspondent) | Tomas (Operations & payments engineer) | Pre-commencement gate |
| SIMM model validation and approval | Rohan (Market risk engineer) | Before IM phase-in trigger |
| SA netting-enforceability legal opinion | Imani (Legal-as-code engineer) + external counsel | Licence-application gate |

---

## 11. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| 1 | 2026-05-14 | Mira (Compliance / RegTech engineer) | Initial version — authored to close ORG-PR-16, ORG-MK-06, ORG-MK-12, ORG-MK-13, ORG-JS2-003 |
