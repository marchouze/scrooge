---
agent: Mira
trigger: ws-instrument-analyses-citation-tbc-resolution-run1
asOf: 2026-05-16T00:00:00.000Z
decision-required: false
tags: [obligations-register, ws-instrument-analyses, citation-tbc]
---

# Citation TBC Resolution — Run 1

**Mira (Compliance / RegTech engineer, engineering — reports to Zara (Chief Compliance Officer, governance))**
**Trigger:** ws-instrument-analyses-citation-tbc-resolution-run1
**Date:** 2026-05-16

## Summary

The SARB PDF text-extraction tool (PR #446 — `prototype/platform/tools/sarb-pdf-extract.ts`) was used to attempt text-layer extraction on all 22 SARB PA PDFs referenced by `[citation: TBC]` markers in `Regulations/_obligations-register.md` v1.26.

- **21 PDFs yielded extractable text layers** — section references confirmed directly from the extracted text.
- **1 PDF is image-only** — D1/2015 Recovery plan directive (no text layer; GAP-SARB-PDF-OCR remains the blocker).
- **Register updated to v1.27** — citations resolved for 21 instruments across rows ORG-PR-28 through ORG-GV-22.
- **Instrument misclassification corrected** — D4/2022, previously described as a prudential risk-return directive, is confirmed from the extracted PDF text to be an AML/CFT ML/TF/PF risk-return directive issued under FIC Act s.43A(3), not a Reg 46 BA-series return. ORG-PR-41 citation corrected accordingly; Imani + Mira routed for follow-up register reclassification.

---

## PDFs attempted — status

| PDF | Pages | Text extracted |
|-----|-------|---------------|
| D10-2025 Pillar 3 | 9 | YES |
| D2-2024 Regulation 46 Reporting | 3 | YES |
| G3-2023 Basel Implementation Dates | 5 | YES |
| G3-2025 Climate Disclosures | 9 | YES |
| PC18-2024 FRTB and CVA Roadmap | 13 | YES |
| PC15-2024 CSRBB Field Testing | 2 | YES |
| D1-2015 Recovery Plan | 7 | NO — image-only (GAP-SARB-PDF-OCR) |
| D6-2015 Revised LCR | 63 | YES |
| D5-2021 Capital Framework | 5 | YES |
| D4-2021 Liquidity Stress Simulation | 4 | YES |
| D9-2021 PSMOR | 3 | YES |
| D3-2022 LEX Annexure 1 | 1 | YES |
| D4-2022 Risk Return | 4 | YES |
| D7-2022 CBC Directors | 5 | YES |
| D1-2023 NSFR | 4 | YES |
| D3-2023 Accounting Provisions | 3 | YES |
| D4-2023 Operational Resilience | 3 | YES |
| D8-2023 Threshold Amounts | 6 | YES |
| D2-2025 Insurance Investments | 4 | YES |
| AML/CFT/CPF Comm 1 of 2025 | 13 | YES |
| Joint Communication 4 of 2023 IT Gov | 1 | YES |
| Joint Standard 1 of 2020 Significant Owner | 11 | YES |

---

## Citation resolution details — by register row

### ORG-PR-28 — D10/2025 Pillar 3
Confirmed from extracted text: §1–§2.28 (Pillar 3 disclosure requirements); §2.28 specific tables by risk type; Reg 43(1) cited as authorising regulation. Publication date confirmed from footer (supersedes D1/2025).

### ORG-PR-29 — D2-2024 Regulation 46 Reporting
Confirmed from extracted text: §1 scope; §2.1 reporting obligations; Annexure 1 audit matrix (line items for each BA-series return); reference to Reg 46 throughout.

### ORG-PR-31 — G3-2023 Basel Implementation Dates
Confirmed from extracted text: §2.1 implementation-date table listing revised SA + IRB (credit risk), LCR/NSFR (liquidity), IRRBB, FRTB, CVA, NSFR with effective dates.

### ORG-PR-32 — G3-2025 Climate Disclosures
Confirmed from extracted text: §4 governance; §5 strategy; §6 risk management; §7 risk categories (physical, transition, liability); §8 credit risk; §9 market risk; §10 quantitative templates; §13 implementation and effective dates. BCBS d597 confirmed from §1.3 footnote.

### ORG-PR-33 — PC18-2024 FRTB + CVA Roadmap
Confirmed from extracted text: Appendix A FRTB (SA-TB, IMA application, P&L attribution); Appendix B CVA (BA-CVA, SA-CVA); Appendix C regulatory reporting; Appendix D trading desk application process; Appendix E Umoja system build timeline.

### ORG-PR-34 — PC15-2024 CSRBB Field Testing
Confirmed from extracted text: §3 field-testing methodology; §4 submission requirements; Annexure A data template for CSRBB scenario simulations.

### ORG-PR-36 — D6-2015 Revised LCR
Confirmed from extracted text: §2 Amendment of Reg 26 (LCR definition, HQLA tiers, outflow rates, inflow rates); §4 Amendment of Reg 27 (LCR minimum ratio schedule). 63 pages confirming LCR amendments.

### ORG-PR-37 — D5-2021 Capital Framework
Confirmed from extracted text: §2 directive body; Annexure A capital-framework table (CET1, AT1, Tier 2 components); Annexure B phase-in arrangements; Reg 38(8)(b) and Reg 38(8)(e)(i)–(vii) cited as authorising regulations.

### ORG-PR-38 — D4-2021 Liquidity Stress Simulation
Confirmed from extracted text: §2.1–§2.9 externally-facilitated liquidity stress simulation requirements; Reg 39(5)(i)(iii) as authorising regulation; stress scenario design, submission format, confidentiality requirements.

### ORG-PR-39 — D9-2021 PSMOR
Confirmed from extracted text: §2.1–§2.5 principles for sound management of operational risk; Reg 39 as authorising regulation; 12 BCBS principles referenced (BCBS d515 confirmed from §1 footnote citing BIS d515 URL).

### ORG-PR-40 — D3-2022 LEX Annexure 1
Confirmed from extracted text: exposure limit table (single page) — non-D-SIB maximum 25% of eligible capital; D-SIB limits by counterparty type. No narrative sections — Annexure 1 is the limit table only.

### ORG-PR-41 — D4-2022 (Instrument misclassification corrected)
**Finding:** The register previously described ORG-PR-41 as a prudential risk-return directive under Reg 46. The extracted PDF text reveals D4/2022 is titled "Directive on the submission of a risk return" and is issued under **FIC Act s.43A(3)** — directing all banks to submit a quarterly ML/TF/PF risk return. This is an AML/CFT instrument, not a Reg 46 prudential BA-series return instrument. Citation corrected in v1.27 to FIC Act s.43A(3) + §2 of D4/2022 specifying quarterly submission cadence, template format, and first submission date.

### ORG-PR-42 — D7-2022 CBC Directors
Confirmed from extracted text: §1.3 Banks Act s.60(5)(a) + Reg 42 cited as authorising regulations; §2.1.1–§2.1.13 requirements for CBC directors (conduct, conflicts, independence, information access, meetings, record-keeping, remuneration governance).

### ORG-PR-43 — D1-2023 NSFR
Confirmed from extracted text: §2.1 NSFR calculation per Reg 26(14)(d); §2.2 ASF calibration; §2.2.5 ZAR-from-financial-corporates phase-out table (30%→20%→10%→0%, 2023–2028); §2.3 RSF factors. BCBS d295 confirmed from §1.2 footnote.

### ORG-PR-44 — D3-2023 Accounting Provisions
Confirmed from extracted text: §2.1.1 Stage 1 = GP (IFRS 9 s.5.5); §2.1.2 Stage 2 = GP; §2.1.3 Stage 3 = SP; §2.2 leverage ratio deduction for all stages. IFRS 9 s.5.5 confirmed explicitly from §2.1.1–§2.1.3.

### ORG-PR-45 — D4-2023 Operational Resilience
Confirmed from extracted text: §1.2 seven BCBS categories (governance; operational risk management; BCP and testing; mapping interconnections; third-party dependency management; incident management; resilient ICT including cyber security); §1.5 Reg 39 (corporate governance process); §1.7 Reg 38(4) (PA additional-capital power); §2.1.1–§2.1.5 directive requirements; §2.2 compliance deadline 31 December 2024. BCBS d516 confirmed from §1.1 footnote 1 (BIS URL cited directly).

### ORG-PR-46 — D8-2023 Threshold Amounts
Confirmed from extracted text with specific rand thresholds: §2.2.3 retail ≤R12.5m (Reg 23(6)(b)(iv)); §3.2 QRRE ≤R1.5m; §4.3 corporate SME firm-size >R60m–≤R600m; §5.2 corporate SME asset class ≤R600m; §6.2 AIRB cut-off >R15bn; §7.3 AVC ≥R1.2tn; §8.4 effective maturity FIRB; §9.2 securitisation retail <R12.5m; §10.2 LCR/NSFR small-business threshold <R12.5m; §11.3 IRRBB retail deposit <R12.5m. BCBS d424 confirmed from §1.2 footnote 1.

### ORG-PR-47 — D2-2025 Insurance Investments
Confirmed from extracted text: §1.1 Reg 36(10)(b)(ii) deduction requirement; §1.2 Reg 38(5)(a)(i)(M); §1.4 Reg 38(5)(b) + Circular 4/2013 threshold deduction subject to PA approval; §2.1.1–§2.1.6 directive requirements (no threshold deduction without PA approval; post-acquisition reserves excluded; historic cost basis; impairment adjustments permitted; biannual Annexure A reporting within 30 business days; board-approved dividends includable in CET1); §2.2 compliance deadline 31 July 2025.

### ORG-FC-23 — AML/CFT/CPF Communication 1 of 2025
Confirmed from extracted text: §4.1 FIC Act s.42(2)(q) (RMCP group-wide in foreign branches/subsidiaries — four sub-requirements); §4.2 FIC Act s.(qA) (group-wide programme for SA branches/majority-owned subsidiaries); Annexure A inspection findings (RMCP A.1, CDD A.2, ODD, EDD, CTR A.3, TPR A.4, STR A.5, IFTR A.6, training A.7, governance A.8, ML/TF/PF BRA A.9). Footnote 4 confirms D4/2022 is the quarterly ML/TF/PF risk return directive.

### ORG-CY-15 + ORG-CY-16 — Joint Communication 4 of 2023 (JS 1/2023 announcement)
Confirmed from extracted text (1-page communication): issued under FSR Act s.60(3)(b)(vi) and s.42(b)(vi); announces publication of Joint Standard 1 of 2023 IT Governance and Risk Management; commencement date 15 November 2024; also announces Statement of Need and Consultation Report. The Survey URL is the JC4/2023 announcement, not the Joint Standard body. Precise sub-section references (governance principles, risk taxonomy, control catalogue, third-party risk management, incident management, resilience testing) require the Joint Standard body — LawLibrary: https://lawlibrary.org.za/akn/za/act/standard/sarb/2023/1/eng@2024-11-15. Routed to Imani + external counsel for licence-application gate ratification.

### ORG-GV-22 — Joint Standard 1 of 2020 Significant Owner
Confirmed from extracted text (11 pages): §1 commencement 1 December 2020; §2 FSR Act ss.107 and 159(1) + ss.105, 106, 108 as legislative authority; §3 application scope; §5.1–§5.5 roles and responsibilities (annual attestation, 30-day notification obligations); §6.1–§6.4 fitness and propriety requirements; §6.2 prima facie disqualification factors (a)–(u) for natural-person significant owners; §7.1–§7.2 assessment factors; §8.1 5-percentage-point change threshold for FSR Act s.159(1)(b) notification.

---

## Unresolved — pending OCR substrate

| Row | Instrument | Reason |
|-----|-----------|--------|
| ORG-PR-35 | D1/2015 Recovery Plan — Recovery Plan obligation | Image-only PDF, no text layer |
| ORG-PR-30 | D1/2015 Recovery Plan cross-reference | Same instrument |
| ORG-BNK-RECOVERY-CONS | D1/2015 Recovery Plan (consolidated) | Same instrument |

Blocker: GAP-SARB-PDF-OCR. These three `[citation: TBC]` instances remain open until OCR substrate is available.

---

## Follow-on actions surfaced

1. **ORG-PR-41 reclassification** — D4/2022 is an AML/CFT instrument (FIC Act s.43A(3)), not a Reg 46 prudential return. Register row may need reclassification from Domain A (Prudential) to Domain B (Financial Crime), or at minimum a note added to the Fulfilment Policy column. Routed to Imani + Mira for next run.

2. **JS 1/2023 body text** — ORG-CY-15 and ORG-CY-16 still need precise sub-section references from the Joint Standard body (not the JC4/2023 announcement). Routed to Imani + external counsel at licence-application gate.

3. **GN 5/2013 (ORG-PR-48)** — Not included in this run; no Survey URL was available in the register at the time of the run. Remains `[citation: TBC]`.
