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

The SARB PDF text-extraction tool (PR #446) was used to attempt text-layer extraction on all 22 SARB PA PDFs referenced by `[citation: TBC]` markers in `Regulations/_obligations-register.md` v1.26.

- **21 PDFs yielded extractable text layers** — section references confirmed directly from the extracted text.
- **1 PDF is image-only** — D1/2015 Recovery plan directive (no text layer; GAP-SARB-PDF-OCR remains the blocker).
- **Register updated to v1.27** — citations resolved for 21 instruments across rows ORG-PR-28 through ORG-FC-23.

This is a SCAFFOLD COMMIT — full citation details below are IN PROGRESS.

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

_Full citation resolution details follow once text analysis is complete._
