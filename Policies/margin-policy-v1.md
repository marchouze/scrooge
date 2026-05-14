---
policy-id: MARGIN-POLICY-V1
title: Margin Policy
version: "1"
status: IN FORCE
owner: Eitan (Treasurer, governance)
effective-from: "2026-05-14"
citations:
  - "Joint Standard 2 of 2020 — Margin Requirements for Non-Centrally Cleared OTC Derivative Transactions (as amended 9 June 2023): §§3–7 (governance; VM; IM; eligible collateral; MTA)"
  - "FSCA Joint Notice 2 of 2024: margin information reporting to the PA from 1 April 2025"
  - "BCBS/IOSCO Margin Requirements for Non-Centrally Cleared Derivatives (March 2015, updated)"
  - "ISDA SIMM Methodology (current published version)"
  - "Banks Act 94 of 1990: s60–69 (governance); Reg 33 (operational risk)"
author: Mira (Compliance / RegTech engineer)
co-author: Eitan (Treasurer, governance)
date: 2026-05-14
summary: >
  Margin Policy covering board-approved VM and IM policies and procedures for
  non-centrally-cleared OTC derivative transactions under Joint Standard 2 of 2020
  (as amended). Covers daily VM calculation, IM phasing, SIMM model approval,
  eligible collateral, MTA, margin reporting to the PA, and governance.
  Closes obligations ORG-JS2-001, ORG-JS2-002, ORG-JS2-004, ORG-JS2-005,
  ORG-JN2-2024. COMMENCEMENT-BIND.
decision-required: false
riskTaxonomy:
  - RT-CR.CP
  - RT-ST.GV
  - RT-LR.RC
---

# Margin Policy

> **Authors.** Eitan (Treasurer, governance) — lead; Mira (Compliance / RegTech engineer) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Authored under the events-first authoring rule and the no-pause dispatch rule — CLAUDE.md "Operating procedures".
> **Obligations closed.** `ORG-JS2-001` (VM daily calculation and exchange, JS 2/2020 §4), `ORG-JS2-002` (IM phased requirements, JS 2/2020 §5), `ORG-JS2-004` (MTA ≤ ZAR 5m, JS 2/2020 §7), `ORG-JS2-005` (board-approved policies and procedures, JS 2/2020 §3), `ORG-JN2-2024` (PA margin reporting from 1 April 2025).
> **Status.** COMMENCEMENT-BIND — all JS 2/2020 margin obligations activate at commencement of OTC derivative trading. The board-approved-policy requirement (§3) is in force from the date the bank begins any preparatory activity that falls within the JS 2/2020 scope.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Purpose and Scope

This policy establishes the bank's board-approved framework for margin requirements applicable to non-centrally-cleared OTC derivative transactions, in compliance with Joint Standard 2 of 2020 (as amended 9 June 2023) and the related BCBS/IOSCO margin framework.

**In scope:**
- All non-centrally-cleared OTC derivative transactions (interest rate derivatives, FX derivatives, credit derivatives, equity derivatives)
- All counterparties subject to JS 2/2020 margin requirements (financial counterparties and systemically important non-financial entities)

**Out of scope:**
- Physically settled FX forwards and FX swaps (exempt under JS 2/2020)
- Exchange-traded and centrally-cleared OTC transactions (subject to CCP / JSE Clear rules)
- Intragroup transactions (where applicable exemption conditions are met — assessed by Mira and Zara (CCO) prior to any intragroup trades)

---

## 2. Regulatory Framework

| Instrument | Requirement | Status |
|---|---|---|
| JS 2/2020 §3 | Board-approved policies and procedures | IN_FORCE (preparatory activity scope) |
| JS 2/2020 §4 | Daily VM: calculate and exchange against daily MTM | COMMENCEMENT-BIND |
| JS 2/2020 §5 | IM: phased by aggregate average notional; final phase Sept 2025 (> ZAR 100bn) | COMMENCEMENT-BIND (phase-in dependent) |
| JS 2/2020 §6 | Eligible collateral (cash, gold, SAGB as amended 2022) | COMMENCEMENT-BIND |
| JS 2/2020 §7 | MTA aggregate (VM + IM) ≤ ZAR 5,000,000 | COMMENCEMENT-BIND |
| Joint Notice 2/2024 | Margin information reporting to PA from 1 April 2025 | IN_FORCE |

---

## 3. Variation Margin (VM)

### 3.1 VM Calculation

- **Frequency:** Daily, as of market close (17:00 SAST)
- **Methodology:** Mark-to-market valuation of the net portfolio of in-scope OTC derivatives with each counterparty under the applicable netting set
- **Pricing source:** The bank uses a primary pricing source (agreed in the CSA schedule) and a secondary cross-check source. Where the sources differ by more than an agreed tolerance (typically 0.25% of notional), the discrepancy is investigated by Rohan (Market risk engineer) before the call is issued
- **Netting sets:** VM is calculated at the netting-set level defined in the ISDA Master Agreement; cross-product netting recognised where the CSA explicitly permits

### 3.2 VM Exchange

- **Settlement timing:** T+0 (same business day) for cash; T+1 for securities (unless CSA specifies otherwise)
- **Currency:** As specified in the CSA eligible-currency schedule; ZAR default for domestic counterparties
- **Communication:** Margin call notice issued via agreed channel (SWIFT MT527 or email) by 09:00 SAST; counterparty response deadline 14:00 SAST
- **Failed calls:** Escalation protocol per Collateral Management Policy §5.1

### 3.3 VM Model Governance

- The VM calculation engine is owned by Ravi (Treasury / ALM engineer)
- Monthly independent validation check by Rohan (Market risk engineer) against external pricing
- Material discrepancies (> 1%) are escalated to Eitan (Treasurer) and Helena (Chief Risk Officer, governance)

---

## 4. Initial Margin (IM)

### 4.1 Phase-In Thresholds

The IM requirement applies when the bank's aggregate average notional outstanding with a counterparty (averaged over March, April, and May of the relevant year) exceeds:

| Phase | Threshold | Effective Date |
|---|---|---|
| Phase 6 (final) | > ZAR 100 billion (c. USD 8bn) | 1 September 2025 |

Mira monitors the bank's phase-threshold status quarterly and reports to Eitan (Treasurer). The bank is expected to remain below the phase-6 threshold in early years; monitoring begins when aggregate OTC notional exceeds ZAR 50bn.

### 4.2 IM Methodology

**Option A — ISDA SIMM:**
The bank's preferred IM methodology is the ISDA Standard Initial Margin Model (SIMM). SIMM implementation:
- Model version: current published ISDA SIMM version
- Sensitivity inputs: per ISDA SIMM Methodology document
- Asset classes covered: Interest Rate, FX, Credit (qualifying and non-qualifying), Equity
- Calibration: updated per ISDA annual SIMM recalibration

**Option B — Schedule Method (fallback):**
Where SIMM is not operationally available or counterparty does not accept SIMM, the Schedule Method per JS 2/2020 Annex A is used (percentage of gross notional per asset class).

SIMM model validation is a precondition for use with any counterparty. Rohan (Market risk engineer) owns the model-validation file. Helena (CRO) approves the validation for production use.

### 4.3 IM Segregation

- IM must be held in a tri-party custodian account, segregated from the bank's proprietary assets and from the counterparty's assets
- The bank's sponsor / correspondent bank (indirect-participant posture per `project_indirect_participant_posture.md`) operates the tri-party infrastructure
- Legal isolation: the arrangement must be bankruptcy-remote from both parties; Imani (Legal-as-code engineer) obtains external counsel confirmation at the licence-application gate
- The bank may not commingle IM with VM or with own assets

---

## 5. Minimum Transfer Amount (MTA)

- MTA = aggregate (VM + IM) ≤ ZAR 5,000,000 per counterparty per JS 2/2020 §7
- Rounding: to the nearest ZAR 100,000 (or as specified in the CSA; never rounded up to exceed ZAR 5,000,000)
- The MTA is set to ZAR 0 (zero-threshold) for standard institutional counterparties unless Eitan (Treasurer) and Helena (CRO) specifically approve a non-zero threshold with documented rationale
- Non-zero thresholds are documented in the CSA schedule and reviewed annually

---

## 6. Eligible Collateral

Eligible collateral for margin purposes is governed by the Collateral Management Policy (§3). Summary:
- Cash (ZAR): zero haircut (VM); zero haircut (IM)
- Cash (foreign currency): zero haircut (VM); FX haircut per BCBS schedule (IM)
- South African Government Bonds: maturity-banded haircut per schedule; +20% addon for IM
- Gold (LBMA): 15% haircut (VM and IM)

The eligible-collateral schedule is reviewed annually and updated as required by JS 2/2020 §6 amendments.

---

## 7. Margin Reporting to the Prudential Authority

Per Joint Notice 2 of 2024, the bank must submit margin information to the PA from 1 April 2025:
- **Report content:** aggregate VM and IM outstanding; eligible-collateral breakdown; counterparty-level summary (where ≥ threshold)
- **Frequency:** monthly (or as prescribed by the PA)
- **Submission channel:** PA reporting portal via the regulatory-reporting infrastructure (Umoja sub-pipeline)
- **Owner:** Tomas (Operations & payments engineer) submits; Mira reviews for accuracy; Eitan (Treasurer) signs off
- **Substrate dependency:** the Trade Reporting Policy and Umoja sub-pipeline must be operational before the first submission

---

## 8. Governance

| Role | Accountability |
|---|---|
| Eitan (Treasurer, governance) | Policy owner; margin programme governance; sign-off on MTA / threshold decisions |
| Ravi (Treasury / ALM engineer) | VM / IM calculation engine; daily operational execution |
| Rohan (Market risk engineer) | SIMM model validation; independent MTM cross-check |
| Helena (Chief Risk Officer, governance) | IM model production approval; risk-appetite for uncollateralised exposure |
| Zara (Chief Compliance Officer, governance) | JS 2/2020 and Joint Notice 2/2024 regulatory compliance |
| Mira (Compliance / RegTech engineer) | Phase-threshold monitoring; PA reporting review; regulatory intelligence |
| Tomas (Operations & payments engineer) | PA margin-information submission |
| Imani (Legal-as-code engineer) | IM segregation legal isolation; CSA schedule documentation |

### 8.1 Board-Approval Requirement (JS 2/2020 §3)

This policy, the VM Procedure, and the IM Procedure constitute the "board-approved policies and procedures" required by JS 2/2020 §3. The policy is approved by the Board (interim: by Marc as sole director) and reviewed annually.

### 8.2 Review Cadence

- **Annual review:** Eitan (Treasurer) and Helena (CRO) by end of Q1 each year
- **Trigger review:** JS 2/2020 amendment; new PA guidance; SIMM recalibration; phase-threshold crossing
- **BRC reporting:** Quarterly margin programme summary tabled to the Board Risk Committee

---

## 9. Relationship with Other Policies

| Policy | Interaction |
|---|---|
| Collateral Management Policy | Eligible-collateral types, haircut schedules, margin-call operations |
| Market Risk Policy | MTM pricing methodology; VM pricing source |
| Credit Risk Policy | IM segregation credit risk; counterparty default scenarios |
| Liquidity Risk Management Policy | Margin-call liquidity buffer; HQLA encumbrance |
| Trade Reporting Policy | Margin information reporting to PA (Joint Notice 2/2024) |
| Counterparty Onboarding Policy | CSA margin parameters agreed at onboarding |

---

## 10. Substrate Gaps

| Gap | Owner | Target |
|---|---|---|
| VM calculation event type in event store | Ravi (Treasury / ALM engineer) | Next treasury-substrate slice |
| SIMM implementation and model-validation report | Rohan (Market risk engineer) | Before IM phase-in trigger |
| Joint Notice 2/2024 PA margin-reporting pipeline (Umoja) | Tomas (Operations & payments engineer) | Pre-commencement gate |
| Phase-threshold monitoring job (quarterly notional aggregation) | Mira (Compliance / RegTech engineer) | Next compliance-substrate slice |

---

## 11. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| 1 | 2026-05-14 | Mira (Compliance / RegTech engineer) | Initial version — closes ORG-JS2-001, ORG-JS2-002, ORG-JS2-004, ORG-JS2-005, ORG-JN2-2024 |
