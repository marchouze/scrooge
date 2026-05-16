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

*[To be completed by web research agent — results will be appended]*

---

## Task C — Untyped directive topic confirmation

*[To be completed by web research agent — results will be appended]*

---

## Remaining open in WS-INSTRUMENT-ANALYSES

After this run, the following items remain open:

1. **[citation: TBC] markers** — 54 markers remain across the register pending PDF text extraction and Imani (Legal-as-code engineer) ratification. Tasks B results will reduce this count where PDFs are text-accessible.
2. **Instrument backlog** — 73 STUB instruments require full analysis runs (read, extract obligations, add rows, flag policy gaps).
3. **Surfaced-but-untyped directives** — 15 PA Directives from 2014–2020 pending topic confirmation (Task C results below).
4. **SARB XSD substrate** — `prototype/regulators/xsd/` empty; BA 325/350/600/700 XSD ingestion deferred to a follow-on run.
5. **Chart-of-accounts liquidity fields** — blocked on items 1+2.
6. **Real PA macro paths** — stress engine blocked on instrument analysis substream.
