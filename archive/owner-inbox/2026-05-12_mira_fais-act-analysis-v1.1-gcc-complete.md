---
title: FAIS Regulatory Analysis v1.1 — FAIS Act + GCC complete; Domain P citations resolved
author: Mira (Compliance / RegTech engineer)
date: 2026-05-12
status: complete
decision-required: false
entity-scope: securities (Hoz Securities Limited)
---

# FAIS Regulatory Analysis v1.1 — Deliverable Note

**Author:** Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO)
**Date:** 2026-05-12
**Branch:** worktree-agent-a18d9a9c7d56269ba

---

## Summary

This run completed the FAIS regulatory-analysis milestone for Domain P (FAIS Posture A) in the obligations register. Two source PDFs were retrieved and extracted; two analysis files were fully populated; five `[citation: TBC]` gaps in the obligations register were resolved; and two stub/partial files were created for the instruments that could not be retrieved automatically.

---

## Source documents retrieved

| Instrument | File | Bytes | Source |
|---|---|---|---|
| FAIS Act 37 of 2002 | `Regulations/FSCA/source-docs/fais-act-37-2002.pdf` | 2,376,916 | gov.za (gcis_document/201409/a37-020.pdf) |
| FAIS Act 37 of 2002 (text) | `Regulations/FSCA/source-docs/fais-act-37-2002.txt` | 2,823 lines | pdftotext extraction |
| GCC — BN 80/2003 as amended BN 43/2008 | `Regulations/FSCA/source-docs/fais-general-code-of-conduct.pdf` | 73,241 | faisombud.co.za (WordPress hosted) |
| GCC (text) | `Regulations/FSCA/source-docs/fais-general-code-of-conduct.txt` | 1,388 lines | pdftotext extraction |

**Not retrieved (auth-gated):**
- BN 194 of 2017 (Fit and Proper Requirements) — FSCA authentication-gated; SAFLII Cloudflare-blocked
- BN 58 of 2010 (Conflict of Interest Code) — same; faisombud.co.za did not host the instrument

Manual retrieval instructions are embedded in each stub file and in `source-docs/README.md`.

---

## Analysis files created / populated

| File | Status | Coverage |
|---|---|---|
| `Regulations/FSCA/fais-act.md` | POPULATED | Full section analysis: ss.1, 7–8, 13–16, 17–19, 36; verbatim statutory text; application to Hoz Securities Limited; obligation-summary table |
| `Regulations/FSCA/fais-general-code-of-conduct.md` | POPULATED | Full 22-section analysis (Parts I–XIV); verbatim text for all operative sections; citation-precision update table closing all Domain P TBC items; suitability / fee-disclosure / complaints cross-references |
| `Regulations/FSCA/fais-fit-and-proper.md` | PARTIAL | Five-dimension structure from FAIS Act s.8(1) verbatim + secondary refs; Saskia-as-KI application; Category I/II analysis; all section refs TBC pending BN 194 retrieval |
| `Regulations/FSCA/fais-conflict-of-interest-code.md` | STUB | GCC s.3(1)(b) baseline conflict-disclosure obligation verbatim; known structure from secondary refs; full analysis pending BN 58 retrieval |

---

## Obligations register — Domain P citations resolved (v1.17)

| URN | Citation before | Citation after |
|---|---|---|
| `ORG-FAIS-RK-ADVICE` | `[citation: TBC — precise General Code sub-section on advice-record retention]` | `GCC (BN 80/2003) s.3(2)` + `GCC s.7(1)(a)–(c)` + `GCC s.9(1)(a)–(d)` |
| `ORG-FAIS-RK-SUITABILITY` | `[citation: TBC — precise General Code sub-section on suitability-assessment record requirements]` | `GCC s.8(1)(a)–(c)` + `GCC s.9(1)` |
| `ORG-FAIS-RK-FEE-DISCLOSURE` | `[citation: TBC — precise General Code sub-section on fee / charge disclosure pre-engagement]` | `GCC s.7(1)(c)(vi)` + `GCC s.3(1)(a)(vii)` |
| `ORG-FAIS-RK-COMPLAINT-HANDLING` | `[citation: TBC — precise FAIS subordinate-legislation reference for complaint-management]` | `FAIS Act s.18(b)` + `GCC ss.16–19` |
| `ORG-FAIS-RK-GENERAL-CODE` | `[citation: TBC — full General Code sub-section index]` | Full GCC section index (ss.2, 3(1), 3(2), 5, 7, 8, 9, 11–12, 14–15, 16–19, 21) |

Obligations register version bumped 1.16 → 1.17.

---

## Regulatory index updated

`Regulations/_index.md`: FAIS Act and GCC rows updated from `STUB` → `POPULATED`; Fit and Proper row added as `PARTIAL`; CoI row retained as `STUB`.

---

## Open items — manual action required

1. **BN 194 of 2017 (Fit and Proper):** Visit https://www.fsca.co.za/Legislation/ (FAIS > Subordinate Legislation) with an authenticated FSCA account; download; run pdftotext; update `fais-fit-and-proper.md` with verbatim section text and close all `[TBC]` references.

2. **BN 58 of 2010 (Conflict of Interest Code):** Same retrieval path; update `fais-conflict-of-interest-code.md`.

3. **GCC — BN 43/2008 amendment integration:** The GCC text was extracted from a consolidated BN 80/2003 + BN 43/2008 version. Confirm the amendment incorporated in the faisombud.co.za PDF is the current operative version vs the FSCA-hosted consolidated gazette version. If a later amendment exists, update source-docs and analysis files.

---

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.1 | 2026-05-12 | Mira (Compliance / RegTech engineer) | FAIS Act + GCC PDFs retrieved and extracted; fais-act.md and fais-general-code-of-conduct.md fully populated; five Domain P TBC citations resolved in obligations register v1.17; fais-fit-and-proper.md (PARTIAL) and fais-conflict-of-interest-code.md (STUB) created; _index.md updated |
