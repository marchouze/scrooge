---
title: "Obligations register v1.30 — Activity scope column corrections"
author: Mira (Compliance / RegTech engineer, engineering — reports to Zara, Chief Compliance Officer, governance)
date: 2026-05-17
version: "1.30"
decision-required: false
workstream: WS-INSTRUMENT-ANALYSES
---

# Obligations register v1.30 — Activity scope column corrections

**Author:** Mira (Compliance / RegTech engineer, engineering — reports to Zara (Chief Compliance Officer, governance))
**Date:** 2026-05-17
**Register version:** v1.30
**Scope:** Pure Activity scope (col 12) correction pass — no rows added or removed, no other columns touched.

---

## 1. Summary

This brief records the corrections made to the `Activity scope` column of the obligations register in v1.30. Nine targeted corrections were applied following a full-register domain sweep. The dispatch pre-analysis confirmed four primary issues; the domain sweep surfaced two additional issues (ORG-PR-34 and ORG-PR-40).

---

## 2. Corrections applied

### Issue 1 — ACT-BANK-DEPOSIT had zero uses (resolved)

**Rows corrected:** `ORG-PR-06`, `ORG-PR-07`, `ORG-PR-08`

The bank takes deposits under Banks Act s.11, and the LCR (ORG-PR-06), NSFR (ORG-PR-07), and intraday-liquidity (ORG-PR-08) ratios exist precisely because the bank is deposit-funded. `ACT-BANK-DEPOSIT` added to each row alongside existing codes.

| Row | Before | After |
|-----|--------|-------|
| ORG-PR-06 | `ACT-RISK-CAPITAL, ACT-RISK-LIQUIDITY, ACT-REPORT-PRUDENTIAL` | `ACT-BANK-DEPOSIT, ACT-RISK-CAPITAL, ACT-RISK-LIQUIDITY, ACT-REPORT-PRUDENTIAL` |
| ORG-PR-07 | `ACT-RISK-CAPITAL, ACT-RISK-LIQUIDITY, ACT-REPORT-PRUDENTIAL` | `ACT-BANK-DEPOSIT, ACT-RISK-CAPITAL, ACT-RISK-LIQUIDITY, ACT-REPORT-PRUDENTIAL` |
| ORG-PR-08 | `ACT-RISK-LIQUIDITY, ACT-REPORT-PRUDENTIAL` | `ACT-BANK-DEPOSIT, ACT-RISK-LIQUIDITY, ACT-REPORT-PRUDENTIAL` |

Capital adequacy rows (ORG-PR-01..05) were reviewed and confirmed correct — capital adequacy applies regardless of funding type; `ACT-BANK-DEPOSIT` was not added there.

### Issue 2 — ACT-TECH-KEY-MGMT had zero uses (resolved)

**Rows corrected:** `ORG-CY-01`, `ORG-CY-03`

JS 2/2024 (Cybersecurity and Cyber Resilience) includes cryptographic key management as a mandatory control category within the cybersecurity framework and controls catalogue. `ACT-TECH-KEY-MGMT` added to both rows.

| Row | Before | After |
|-----|--------|-------|
| ORG-CY-01 | `ACT-TECH-CYBER, ACT-TECH-IT` | `ACT-TECH-CYBER, ACT-TECH-IT, ACT-TECH-KEY-MGMT` |
| ORG-CY-03 | `ACT-TECH-CYBER, ACT-TECH-IT` | `ACT-TECH-CYBER, ACT-TECH-IT, ACT-TECH-KEY-MGMT` |

Incident-reporting rows (ORG-CY-04, ORG-CY-05) and audit rows were reviewed and confirmed correct — key management is not the primary activity in those rows.

### Issue 3 — ORG-CY-06 incorrectly classified as cybersecurity (resolved)

**Row corrected:** `ORG-CY-06`

PA Directive 3 of 2018 governs cloud computing and outsourcing governance — an operational risk obligation, not a cybersecurity technical obligation. The prior codes (`ACT-TECH-CYBER, ACT-TECH-IT`) misclassified this as a cyber-technical obligation. Corrected to align with sibling row ORG-CY-07 (material outsourcing PA notification — `ACT-RISK-OPERATIONAL, ACT-GOVERN-COMPLIANCE`).

| Row | Before | After |
|-----|--------|-------|
| ORG-CY-06 | `ACT-TECH-CYBER, ACT-TECH-IT` | `ACT-RISK-OPERATIONAL, ACT-TECH-IT` |

### Issue 4 — v1.29 new rows ORG-PR-61 to ORG-PR-66 reviewed (partially corrected)

| Row | Instrument | Before | After | Rationale |
|-----|-----------|--------|-------|-----------|
| ORG-PR-61 | D7/2015 Restructured credit | `ACT-RISK-CREDIT` | `ACT-RISK-CREDIT, ACT-REPORT-PRUDENTIAL` | PA directive requires periodic reporting of restructured exposures in addition to classification discipline |
| ORG-PR-62 | D8/2016 Outsourcing reporting | `ACT-RISK-OPERATIONAL, ACT-GOVERN-COMPLIANCE` | `ACT-RISK-OPERATIONAL, ACT-REPORT-PRUDENTIAL` | D8/2016 is a PA notification/reporting obligation; `ACT-GOVERN-COMPLIANCE` replaced with the more precise `ACT-REPORT-PRUDENTIAL` |
| ORG-PR-63 | D3/2017 Pledged assets | `ACT-TRADE-REPO, ACT-RISK-CAPITAL, ACT-REPORT-PRUDENTIAL` | `ACT-RISK-CAPITAL, ACT-REPORT-PRUDENTIAL` | `ACT-TRADE-REPO` is not a valid code in the 32-code activity taxonomy; removed |
| ORG-PR-64 | D6/2017 Capital issuances | `ACT-RISK-CAPITAL, ACT-CORP-ENTITY` | No change | Correct per brief |
| ORG-PR-65 | D2/2018 CCyB threshold | `ACT-RISK-CAPITAL, ACT-REPORT-PRUDENTIAL` | No change | Correct per brief |
| ORG-PR-66 | D7/2020 SA-CCR leverage | `ACT-RISK-CAPITAL, ACT-REPORT-PRUDENTIAL` | `ACT-RISK-CAPITAL, ACT-RISK-CREDIT` | D7/2020 prescribes the SA-CCR methodology for measuring derivative counterparty credit exposure — a credit/CCR measurement obligation. The primary reporting discharge is already covered by ORG-PR-60 (leverage ratio reporting); this row is about the measurement methodology |

### Issue 5 — Domain sweep additional findings (resolved)

**ORG-PR-34** (PC 15/2024 CSRBB Field Testing): The field-testing exercise requires submission of returns to the PA via the Umoja platform (§4.2–§4.3 of the extracted PDF). `ACT-REPORT-PRUDENTIAL` was missing. Added.

| Row | Before | After |
|-----|--------|-------|
| ORG-PR-34 | `ACT-RISK-MARKET, ACT-RISK-CAPITAL` | `ACT-RISK-MARKET, ACT-RISK-CAPITAL, ACT-REPORT-PRUDENTIAL` |

**ORG-PR-40** (D3/2022 LEX Directive): Large-exposure compliance requires monthly/daily measurement and reporting to the PA (the LEX framework is a reporting-and-limit discipline). `ACT-REPORT-PRUDENTIAL` was missing. Added.

| Row | Before | After |
|-----|--------|-------|
| ORG-PR-40 | `ACT-RISK-CREDIT` | `ACT-RISK-CREDIT, ACT-REPORT-PRUDENTIAL` |

---

## 3. Domain sweep — no-change findings

| Domain | Check | Finding |
|--------|-------|---------|
| Domain B (AML) | ORG-FC-07/08/09 (CTR/PAR/STR filing rows) — confirm `ACT-GOVERN-COMPLIANCE` present | Both `ACT-CLIENT-ONBOARD` and `ACT-GOVERN-COMPLIANCE` present. Correct. FIC filings are part of the AML compliance programme; `ACT-REPORT-PRUDENTIAL` is not appropriate for FIC filings. |
| Domain C (EXCON/FinSurv) | All FinSurv rows carry `ACT-REPORT-FINSURV` | Confirmed — all ORG-FX-FIN-* and ORG-EXCON-ODP-001 rows carry `ACT-REPORT-FINSURV`. |
| Domain F (Governance) | Board-level obligations carry `ACT-GOVERN-BOARD` | Confirmed — all ORG-GV-01..22 board rows carry `ACT-GOVERN-BOARD` where applicable. |
| Domain J (Markets) | OTC IRD rows carry `ACT-TRADE-OTC-IRD` | Confirmed — ORG-JSE-IRC-01/03, ORG-MK-09..14 OTC rows all carry `ACT-TRADE-OTC-IRD`. |
| Domain M (ODP) | FSCA Conduct Standards rows carry `ACT-REPORT-CONDUCT` where reporting | ORG-CS3-01 (market abuse) carries `ACT-REPORT-CONDUCT`. Confirmed. The FMA trade-reporting rows carry `ACT-REPORT-TRADE`. Correct. |
| Domain A ORG-PR-38 | D4/2021 externally-facilitated liquidity stress — missing `ACT-REPORT-PRUDENTIAL`? | Reviewed: §2.1–§2.9 of the extracted directive text — the obligation is to *participate* in PA-facilitated simulations, not to submit a separately-prescribed return. No separate PA submission prescribed. `ACT-RISK-LIQUIDITY, ACT-RISK-CAPITAL` is correct as-is. |

---

## 4. Taxonomy validation

After all corrections, `ACT-BANK-DEPOSIT` and `ACT-TECH-KEY-MGMT` both have non-zero uses. The invalid code `ACT-TRADE-REPO` (which appeared in ORG-PR-63) has been removed. All Activity scope cells in the register now use only codes from the 32-code canonical vocabulary in `Regulations/_activity-taxonomy.md` and `prototype/platform/activities/taxonomy.ts`, or the special value `universal`.

---

## 5. No substrate changes

This pass is a pure register-data correction. No schema changes, no TypeScript changes, no new rows, no row removals.
