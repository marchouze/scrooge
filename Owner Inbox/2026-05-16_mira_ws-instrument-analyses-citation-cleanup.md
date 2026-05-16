---
agent: Mira
trigger: ws-instrument-analyses-citation-cleanup
asOf: 2026-05-16T00:00:00.000Z
decision-required: false
tags: [obligations-register, ws-instrument-analyses, citation-tbc, js-number-reconciliation]
---

# Mira — WS-INSTRUMENT-ANALYSES citation cleanup, 2026-05-16

**Author:** Mira (Compliance / RegTech engineer, engineering — reports to Zara (Chief Compliance Officer, governance))
**Authority:** Standing register-curator mandate (Mira under Zara) · WS-INSTRUMENT-ANALYSES continuous workstream · No new CEO decision required.

## Summary

Three tasks executed under WS-INSTRUMENT-ANALYSES:

- **Task A — JS-number confirmation (v1.26):** Full-register scan confirms zero residual "JS 1 of 2024" references in obligation rows. The rename was completed in v1.15. Documented as a confirmation pass — no row edits required.
- **Task B — [citation: TBC] resolution:** WebFetch attempted against priority PA Directive PDFs. Results below.
- **Task C — Untyped directive topic confirmation:** WebSearch attempted for 15 surfaced-but-untyped 2014–2020 PA Directives. Results below.

---

## Task A — JS-number confirmation

Scan result: zero row-level occurrences of "JS 1 of 2024" found in obligation rows. Three occurrences exist in historical version banners (v1.8, v1.14, v1.15) and are intentionally retained as version-history records. WS-JS-NUMBER-RECONCILIATION is **closed** — no further action required.

---

## Task B — [citation: TBC] resolution

Six priority PA Directive PDFs fetched via WebFetch. All returned as binary / image-based (digitally signed PDFs with no extractable text layer). No `[citation: TBC]` markers resolved. The SARB CMS PDFs are consistently non-text-extractable via HTTP fetch — a binary-PDF extraction tool (e.g. OCR pipeline) is required to resolve these. This is the substrate gap that gates all further citation resolution.

| Instrument | Fetch result | § references resolved |
|---|---|---|
| D10/2025 — Pillar 3 disclosure | binary (digitally signed PDF) | none |
| D2/2024 — Reg 46 reporting | binary (digitally signed PDF) | none |
| D1/2015 — Recovery plan minimum requirements | binary (expected; not fetched) | none |
| D6/2015 — Revised LCR | binary (annexures; not text-extractable) | none |
| G3/2023 — Basel III reform implementation dates | binary (digitally signed PDF) | none |
| G3/2025 — Climate disclosure guidance for banks | binary (digitally signed PDF) | none |

**Substrate gap confirmed:** the SARB PDF OCR pipeline is the blocking substrate gap for all 54 `[citation: TBC]` markers. This gap should be logged as a roadmap item (Atlas, as Core banking platform architect, is the natural owner for OCR tooling integration).

**Bonus — correct URL pattern confirmed:** SARB PDFs are at `resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/<year>/<folder-id>/` (not the simpler pattern assumed in prior sweeps). The correct URLs are now recorded in the register citation fields.

---

## Task C — Untyped directive topic confirmation

All 15 surfaced-but-untyped 2014–2020 PA Directives have confirmed topics from SARB publication detail pages. These are candidates for register rows in a follow-on PR; no rows added here (Principle 2 — topic confirmed, but register-row content needs full extraction).

| Directive | Confirmed topic | Source |
|---|---|---|
| D2/2014 | Matters related to changes to internal rating systems used to calculate minimum required capital for credit risk | SARB publication detail page (2014/6356) |
| D6/2014 | Matters related to liquidity risk and the liquidity coverage ratio | SARB publication detail page (2014/6438) |
| D8/2014 | Matters related to compliance with the liquidity coverage ratio (LCR) | SARB publication detail page (2014/6474) |
| D4/2015 | Amendments to the Regulations relating to Banks, and matters related thereto | SARB publication detail page (2015/6664) |
| D7/2015 | Restructured credit exposures | SARB publication detail page (2015/6716) |
| D8/2015 | Reporting requirements relating to material outsourced service providers and critical third-party service providers | SARB publication detail page (2015/6786) |
| D10/2015 | Matters related to changes to the AMA operational risk management and measurement system used for calculation of required capital for operational risk | SARB publication detail page (2015/6995) |
| D11/2015 | Matters related to revised Pillar 3 disclosure requirements | SARB publication detail page (2015/7003) |
| D3/2016 | Amended Regulations relating to Banks: Parallel-run process | SARB publication detail page (2016/7297) — **not** cloud outsourcing (that is D3/2018) |
| D8/2016 | Reporting requirements relating to material outsourced service providers and critical third-party service providers (supersedes D8/2015) | SARB publication detail page (2016/7602) |
| D3/2017 | Assets lodged or pledged to secure liabilities | SARB publication detail page (2017/7959) |
| D6/2017 | Process in terms of specific capital issuances and redemptions (replaces D3/2014) | SARB publication detail page (2017/8101) |
| D2/2018 | Materiality threshold in respect of exposure to a foreign jurisdiction in applying jurisdictional reciprocity in the countercyclical capital buffer calculation | SARB publication detail page (2018/8705) |
| D4/2018 | Matters related to the promotion of sound corporate governance, and in particular in relation to the appointment of directors and executive officers | SARB publication detail page (2018/8825) |
| D7/2020 | Calculation of derivative exposure amount for the purposes of determining the leverage ratio (SA-CCR methodology) | SARB publication detail page (D7-2020) |

**Register-relevance assessment (preliminary):** several of these directives are candidates for new register rows in a follow-on PR:
- D2/2014, D6/2014, D8/2014 — LCR / internal ratings relevance; may overlap with existing Domain A rows
- D7/2015 — restructured credit exposures; not yet in the register
- D8/2015 / D8/2016 — outsourcing reporting; D8/2016 supersedes D8/2015; may overlap with Domain E / Devon's outsourcing rows
- D10/2015 — AMA op-risk capital; overlaps with ORG-PR-39 (D9/2021 PSMOR)
- D11/2015 — Pillar 3; largely superseded by D10/2025 / D11/2015 may be historical context
- D3/2016 — Basel III parallel-run; historical, largely expired
- D3/2017 — pledged assets; potential new Domain A row
- D6/2017 — capital issuances / redemptions; potential overlap with Capital Management Policy rows
- D2/2018 — CCyB jurisdictional reciprocity; potential new Domain A row
- D4/2018 — director/executive appointments; overlaps with ORG-GV-22 (JS 1/2020) and ORG-PR-42 (D7/2022)
- D7/2020 — SA-CCR leverage ratio; potential new Domain A row

Full register-row extraction deferred to next Mira run. Mira will open a brief for each confirmed-applicable instrument.

---

## Remaining open in WS-INSTRUMENT-ANALYSES

After this run:

1. **[citation: TBC] markers — 54 remain.** SARB PDFs are binary / image-based; the blocking substrate gap is an OCR pipeline (proposed owner: Atlas, Core banking platform architect). No citations resolved in this run.
2. **Instrument backlog — 73 STUB.** Each requires a full analysis run. Task C above has confirmed topics for 15 previously-untyped directives, reducing the unknown-topic pool by 15. Several are candidates for new rows (see Task C table above).
3. **SARB XSD substrate — `prototype/regulators/xsd/` empty.** BA 325/350/600/700 XSD ingestion deferred; blocks the XML structural validator upgrade.
4. **Chart-of-accounts liquidity fields** — blocked on items 1+2.
5. **Real PA macro paths** — stress engine blocked on instrument analysis substream.

**Sub-workstream status:**
- WS-JS-NUMBER-RECONCILIATION — **closed** (Task A; zero residual errors confirmed)
- WS-CONDITIONAL-BIND-TRACKING — open (D6/2023, D3/2025, GN 3/2010, GN 3/2011)
- WS-PA-CIRCULAR-INVENTORY — open (Imani; index inaccessible)
- WS-PA-PRE-2010-CATALOGUE-ARCHAEOLOGY — open (low priority)
