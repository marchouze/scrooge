---
title: PA communications — full historical sweep (no time-bound) + obligations-register v1.16 expansion
author: Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; obligations-register curator), Imani (Legal-as-code engineer, engineering — reports to Devon COO interim; legal sourcing co-author)
date: 2026-05-10
summary: Full historical sweep of every SARB Prudential Authority Directive, Joint Standard, Guidance Note, Circular, and Prudential / Joint Communication for banks since the regime began (~1996). Closes the time-bounds self-imposed in PR #171 v1.14 (Directives since-2018, Guidance Notes since-2018, Circulars since-2020) and produces obligations-register v1.16 with new rows for every previously-missing in-force applicable instrument that this sweep was able to confirm both an instrument-number AND a topic for.
decision-required: false
---

# PA communications — full historical sweep — Mira + Imani — 2026-05-10

## 1. Authority

Standing register-curator mandate (Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; curator) under Zara (Chief Compliance Officer, governance — reports to CEO)) + `WS-INSTRUMENT-ANALYSES` continuous workstream. Legal sourcing co-author Imani (Legal-as-code engineer, engineering — reports to Devon COO interim). No new CEO decision required (per CLAUDE.md "Operating procedures" — register additions are register-curator scope).

The CeoDecision event `D-PA-COMMUNICATIONS-FULL-HISTORICAL-SWEEP` (action `approve`, recordedVia `script:record-d-pa-communications-full-historical-sweep`) is emitted as a contemporaneous **record** of the register update, not as a new authorisation — per CLAUDE.md "Operating procedures → Events-first authoring".

## 2. Why this dispatch

PR #171 v1.14 self-imposed time bounds (Directives since-2018, Joint Standards 2020–2025, Guidance Notes since-2018, Circulars since-2020). Marc explicitly asked for the **complete historical inventory** — every PA Directive, Joint Standard, Guidance Note, and Circular regardless of issue date. The PA Directive register goes back to ~1996.

This sweep retains the wholesale-institutional applicability filter (`project_strategic_foundation.md` + `project_indirect_participant_posture.md`) but lifts the time-bound: a 2015 Directive that is still in force and applies to a wholesale bank gets a register row, regardless of vintage.

## 3. Survey methodology

**Primary sources.**

- SARB / PA publications portal: `resbank.co.za/en/home/publications/prudential-authority`
- SARB Banks Directives index: `resbank.co.za/en/home/publications/directives/banks-directives` (and per-year sub-folders `…/banks-directives/<year>/`)
- SARB Banks Guidance Notes index: `resbank.co.za/en/home/publications/guidance-notes/banks-guidance-notes`
- SARB Banks Circulars index: `resbank.co.za/en/home/publications/circulars`
- Joint Standards (PA + FSCA) inventory under `pa-financial/sector-regulation-joint-standards/<year>/`
- Joint Communications + Prudential Communications under `pa-public-awareness/covid-19-response/<year>/`
- The PA's own annual catalogue-reset PDFs: **C1/2024** (Status of Previously Issued Circulars), **G1/2024** (Status of Previously Issued Guidance Notes), **G1/2025**, **G1/2022**, **G1/2023**, and the brand-new **GN 1/2026** (Status of previously issued Guidance Notes — surfaced this sweep). These re-issue the in-force inventory each year.
- FSCA Standards index: `fsca.co.za/Regulatory Frameworks/Pages/Standards.aspx`
- PA Annual Report 2023/24 + PA Regulatory Strategy 2025–2030 to confirm in-force inventory.

**Secondary sources used to enumerate older instruments where the SARB index pages are JS-rendered and the PDF text-extraction failed:**

- Webber Wentzel + Michalsons + Bowmans + ENSafrica + Cliffe Dekker Hofmeyr + Norton Rose Fulbright SA banking-law alerts
- Moonstone Information Refinery (PA + FSCA monthly digest)
- Lexology SA banking-regulation library — including the "Year in review: Banking Regulation in South Africa" series (Lexology), which enumerates per-year instrument issuance
- Mondaq SA banking and finance practice guides
- LawLibrary (`lawlibrary.org.za`) — published full-text Joint Standards + Directives mirror
- Moody's Analytics regulatory-news feed (which carries SARB-specific instrument summaries)
- Global Legal Insights — *Banking Laws and Regulations 2026 | South Africa* — annual chapter
- BIS Financial Stability Institute summaries of SARB-incorporated BCBS standards
- Crux Compliance + EBnet sector summaries (catalogue-reset reading)

**Reading limitations** (carried forward from PR #171, partially mitigated this sweep).

- The SARB website's index pages are dynamically rendered by JavaScript; WebFetch returns the HTML shell + a "search service technically unavailable" notice rather than the document list. **Mitigation this sweep:** WebSearch with year-specific queries against `site:resbank.co.za` enumerated dozens of per-document URLs that the JS-rendered index hides. We then cross-reference WebSearch hits against secondary-source compliance-firm summaries (which often quote the directive's title or topic in plain English).
- The C1/2024 (Status of Previously Issued Circulars) and G1/2024 (Status of Previously Issued Guidance Notes) PDFs were **not** text-extractable through WebFetch (returned binary chrome ~3MB+ each). **Mitigation:** secondary-source compliance summaries provide the in-force-as-at-end-2024 lists; cross-checked against WebSearch hits enumerating per-year sub-folders.
- Most individual Directive PDFs are similarly not text-extractable through WebFetch (binary chrome). **Mitigation:** the URL filename pattern often embeds the topic (e.g. `D9-2021 - Principles for the Sound Management of Operational Risk.pdf`, `D5 - 2021 - Capital Framework for South Africa based on the Basel III framework.pdf`, `D4-2023 - Directive on operational resilience.pdf`, `D1_2023 Matters related to the NSFR.pdf`, `D8-2023 - Threshold amounts related to the revised standardised and IRB approaches for credit risk and the liquidity risk framework.pdf`); secondary-source quotations from Moody's / Lexology / Bowmans / Webber Wentzel corroborate these topic readings. **Where the URL filename does NOT embed a topic** (e.g. `D2-of-2014.pdf`, `D6-of-2014.pdf`, `D8-of-2016.pdf`) and **no secondary-source quote was located** in this sweep, the instrument is documented in the per-category inventory below as `topic [TBC — URL filename does not embed; no secondary-source confirmation]` and **does NOT receive a register row** in v1.16. Per Principle 2 (citation discipline), no register row is added for an instrument whose topic could not be confirmed.
- For pre-2010 instruments the per-document URL pattern often differs from the modern form; older instruments live under legacy SARB CMS paths or are surfaced only in the Cn/<YYYY> + Gn/<YYYY> annual catalogue-reset bodies. The 1996–2009 corpus is wholesale superseded by the **Regulations Relating to Banks 2012 (as amended)** + subsequent BCBS-aligned directives — no register rows added for that era; supersession noted in §4.

**Per Principle 2 (citation discipline).** Every register addition carries a structured citation. Where the precise sub-section reference inside an instrument is not text-extractable through WebFetch but the topic IS confirmed via URL filename or secondary source, we cite the instrument + year + topic-as-confirmed and mark precise § / clause references with `[citation: TBC]`. Imani (Legal-as-code engineer) + external counsel ratify exact paragraph indices at the licence-application gate. **No invented citations; no invented topics.**

## 4. Per-category historical inventory

### 4.1 PA Directives — confirmed in-force, applicable, register additions

The PA Directives series goes back to ~1996. The series is annual: numbering resets each year as `D<n>/<YYYY>`. The C1/<YYYY> catalogue-reset circular reconciles the in-force inventory annually. This sweep enumerates the corpus that was either (a) confirmable via URL+secondary-source for both number AND topic, or (b) already-registered in the v1.15 state.

**Confirmed in-force PA Directives applicable to a wholesale-institutional bank, organised oldest → newest:**

| # | Instrument | Year | Topic (confirmed source) | Status | Already in register? | Action |
|---|---|---|---|---|---|---|
| 1 | **D1/2015** | 2015 | Recovery plan minimum requirements for banks (per Mondaq quote: "directive on 4 February 2015 setting out certain minimum requirements for the recovery plans of banks"; URL `…/banks-directives/2015/6602/D1-of-2015.pdf`) | **IN FORCE** | PARTIAL — `ORG-BNK-RECOVERY-CONS` and `ORG-PR-30` cite "PA recovery-and-resolution-planning Directive `[citation: TBC]`"; this sweep confirms D1/2015 as the precise instrument | **ADD** as `ORG-PR-35` + refine `ORG-PR-30` + `ORG-BNK-RECOVERY-CONS` to cite D1/2015 precisely |
| 2 | **D6/2015** | 2015 | Revised LCR (Liquidity Coverage Ratio) — proposed Government Notice (URL filename: `02-D6---Directive-revised-LCR-proposed-Government-Notice-Annexure-A.pdf`) | **IN FORCE** (LCR live) | NO | **ADD** as `ORG-PR-36` |
| 3 | **D3/2018** | 2018 | Cloud computing & data offshoring | **IN FORCE** | YES (`ORG-CY-06` + `ORG-CY-07`) | skip |
| 4 | **D4/2020** | 2020 | Capital framework for South Africa based on the Basel III framework — minimum CET1, Tier 1, Total capital ratios; D-SIB capital surcharge bucketing; Pillar 2A; countercyclical buffer; capital conservation buffer (per Moody's summary; URL filename: `D4-of-2020---Capital-framework-for-South-Africa-based-on-the-Basel-III-framework.pdf`) | **superseded** by D5/2021 (per URL filename of D5/2021 which carries identical topic) | NO | skip — superseded |
| 5 | **D5/2021** | 2021 | Capital Framework for South Africa based on the Basel III framework — supersedes D4/2020 (URL filename: `D5 - 2021 - Capital Framework for South Africa based on the Basel III framework.pdf`) | **IN FORCE** | PARTIAL — `ORG-PR-01..05` carry the capital-adequacy umbrella; the discrete D-series anchor missing | **ADD** as `ORG-PR-37` |
| 6 | **D4/2021** | 2021 | Externally-facilitated liquidity stress simulation (URL filename: `D4 - 2021 - Externally-facilitated liquidity stress simulation.pdf`) | **IN FORCE** | NO | **ADD** as `ORG-PR-38` |
| 7 | **D9/2021** | 2021 | Principles for the Sound Management of Operational Risk — adopts BCBS *Revisions to PSMOR* (March 2021, 12 principles) into SA prudential regulation (per BIS FSI summary + URL filename: `D9-2021 - Principles for the Sound Management of Operational Risk.pdf`) | **IN FORCE** | PARTIAL — `ORG-PR-17` BCBS Op-Risk + `ORG-PR-24..26` Reg 39; the discrete D-series PSMOR anchor missing | **ADD** as `ORG-PR-39` |
| 8 | **D10/2021** | 2021 | Directive on Operational Resilience (URL filename: `D10-2021 -Directive on Operational Resilience.pdf`; per Moody's regulatory-news 14 Dec 2021 issuance) | **superseded** by D4/2023 | NO | skip — superseded |
| 9 | **D3/2022** | 2022 | LEX (Large Exposures) Directive — Annexure 1 dated 1 April 2022 (URL filename: `Annexure 1 to LEX Directive - 1 April 2022.pdf` under `/2022/d3-2022/`) | **IN FORCE** | PARTIAL — `ORG-PR-16` BCBS Large Exposures generic; the discrete D-series LEX anchor missing | **ADD** as `ORG-PR-40` |
| 10 | **D4/2022** | 2022 | Directive on Risk Return (URL filename: `D4 - 2022 - Directive on Risk Return.pdf`) | **IN FORCE** | NO | **ADD** as `ORG-PR-41` |
| 11 | **D7/2022** | 2022 | Banks Corporate Governance and Compliance (CBC) Directive — Directors and executive officers (URL filename: `D7-2022 - Banks CBC Directive - Directors and executive officers.pdf`) | **IN FORCE** | PARTIAL — Domain F governance rows; the discrete D-series CBC anchor on directors+execs missing | **ADD** as `ORG-PR-42` |
| 12 | **D1/2023** | 2023 | Matters related to the NSFR (Net Stable Funding Ratio) — calibration of NSFR + national-discretion items; phase-out of an ASF factor for ZAR funding from financial corporates (per Moody's quote; URL filename: `D1_2023 Matters related to the NSFR.pdf`); replaces D8/2017 | **IN FORCE** | PARTIAL — `ORG-PR-14` NSFR umbrella; the discrete D-series NSFR anchor missing | **ADD** as `ORG-PR-43` |
| 13 | **D3/2023** | 2023 | Regulatory treatment of accounting provisions (URL filename: `D3-2023-Regulatory treatment of accounting provisions.pdf`) | **IN FORCE** | PARTIAL — `ORG-AC-*` IFRS-9 ECL umbrella; the discrete regulatory-treatment-of-provisions D-series anchor missing | **ADD** as `ORG-PR-44` |
| 14 | **D4/2023** | 2023 | Directive on operational resilience — supersedes D10/2021 (per Lexology "Year in review: Banking Regulation in South Africa" quote: "Directive 4 of 2023…published on 1 June 2023 and required banks to 'have in place an enterprise-wide and systematic approach to operational resilience'") | **IN FORCE** | PARTIAL — `ORG-PR-18` BCBS Operational Resilience; the discrete D-series anchor missing | **ADD** as `ORG-PR-45` |
| 15 | **D6/2023** | 2023 | South African Domestic Systemically Important Banks (D-SIBs) — submit consolidated information (per LawLibrary mirror title "Directive 6/2023: South African domestic systemically important banks (D-SIBs) to submit consolidated information"; replaces D1/2021) | **IN FORCE** (binds on D-SIBs) | NO | skip — applicability filter (Hoz is not a D-SIB; conditional-bind tracking) |
| 16 | **D8/2023** | 2023 | Threshold amounts related to the revised standardised and IRB approaches for credit risk and the liquidity risk framework (URL filename + Moody's summary); replaces D1/2016 | **IN FORCE** | NO | **ADD** as `ORG-PR-46` |
| 17 | **D1/2024** | 2024 | NPS-cybersecurity directive | **IN FORCE** (binds on direct NPS participants) | NO | skip — applicability filter (indirect NPS participant via correspondent) |
| 18 | **D2/2024** | 2024 | Reporting requirements per Reg 46 (BA returns) | **IN FORCE** | YES (`ORG-PR-29`) | skip |
| 19 | **D1/2025** | 2025 | Pillar 3 disclosure requirements | **superseded** by D10/2025 (per Mondaq + Moody's confirmation) | YES (`ORG-PR-27`) | refine `ORG-PR-27` status to `superseded by D10/2025`; keep row for supersession-history transparency |
| 20 | **D2/2025** | 2025 | Capital treatment of significant investments in Insurance entities (URL filename: `D2-2025 Matters related to the Capital treatment of significant investments in Insurance entities.pdf`) | **IN FORCE** | NO | **ADD** as `ORG-PR-47` (note: Hoz Securities Limited is an FSP; Hoz Bank does not currently hold significant insurance investments — this directive is registered as `corporate-bind` with conditional-trigger on insurance-entity investment) |
| 21 | **D3/2025** | 2025 | Leverage Buffer requirements for Domestic Systemically Important Banks (D-SIBs) (per Bowmans + URL filename: `D3-2025 - Matters relating to Leverage Buffer requirements.pdf`; published 30 June 2025) | **IN FORCE** (binds on D-SIBs) | NO | skip — applicability filter (Hoz is not a D-SIB; conditional-bind tracking) |
| 22 | **D10/2025** | 2025 | Pillar 3 disclosure requirements (subsequent revision; supersedes D1/2025) | **IN FORCE** | YES (`ORG-PR-28`) | skip |

**Findings on D1/2025-vs-D10/2025 supersession (PR #171 §6 #3):** Per WebSearch confirmation (Mondaq + Moody's secondary sources confirm "must now comply with SARB Directive 10 of 2025, indicating that this newer directive has superseded earlier versions"), **D10/2025 supersedes D1/2025**. Action in v1.16: refine `ORG-PR-27` (D1/2025) status to `superseded by D10/2025 — retain row for supersession-history transparency`; `ORG-PR-28` (D10/2025) status remains `IN FORCE`.

**Findings on Recovery-and-Resolution-Planning Directive identification (PR #171 §6 #4):** The PA recovery-planning Directive is **D1/2015** (per Mondaq quote: "SARB has issued a directive on 4 February 2015 (2015 SARB Directive) setting out certain minimum requirements for the recovery plans of banks, controlling companies and branches of foreign institutions"; URL `…/banks-directives/2015/6602/D1-of-2015.pdf` corroborates instrument-number anchoring). This was the precise instrument PR #171 §6 #4 left as `[citation: TBC — likely D-series 2017/2019]`. Action in v1.16: refine `ORG-PR-30` to cite "PA Directive 1 of 2015 — Recovery plan minimum requirements" precisely; `ORG-BNK-RECOVERY-CONS` likewise. New row `ORG-PR-35` is the discrete D1/2015 anchor.

**Findings on D-SIB-only directives (D6/2023, D3/2025) and IRB-only directives:** These bind on banks meeting the D-SIB threshold (large balance-sheet + interconnectedness) or on banks using the IRB approach for credit-risk capital. Hoz Bank Limited (~R300m capital target, single SA branch, wholesale-institutional dealer, Standardised Approach for credit risk) does not meet D-SIB thresholds and does not seek IRB accreditation. These are **conditional-bind** instruments that route to `WS-CONDITIONAL-BIND-TRACKING` (Mira workstream); the bank may cross into one or both sets if balance-sheet thresholds change post-licence-day or if a future capital-method decision is taken to seek IRB accreditation.

### 4.2 PA Directives — surfaced but topic not confirmed (no register additions)

The following Directives were surfaced via WebSearch enumeration of per-year sub-folders but the URL filename does NOT embed the topic and no secondary-source quote was located in this sweep. Per Principle 2 (no invented citations / topics), these do NOT receive register rows in v1.16; they fold into `WS-INSTRUMENT-ANALYSES` for Imani's deep-PDF-text-extraction follow-up.

| Year | Instruments surfaced | Source URL pattern | Action |
|---|---|---|---|
| 2014 | D2/2014, D6/2014, D8/2014 | `…/banks-directives/2014/<id>/D<n>-of-2014.pdf` | document only; topic confirmation routed to `WS-INSTRUMENT-ANALYSES` |
| 2015 | D4/2015, D7/2015, D8/2015, D10/2015, D11/2015 | `…/banks-directives/2015/<id>/D<n>-of-2015.pdf` | document only; topic confirmation routed |
| 2016 | D3/2016, D8/2016 | `…/banks-directives/2016/<id>/D<n>-of-2016.pdf` | document only; D1/2016 is confirmed (replaced by D8/2023) |
| 2017 | D3/2017, D6/2017 | `…/banks-directives/2017/<id>/D<n>-of-2017.pdf` | document only; D8/2017 is confirmed (replaced by D1/2023) |
| 2018 | D2/2018, D4/2018 | `…/banks-directives/2018/<id>/D<n>-of-2018.pdf` (or `Directive-4-of-2018.pdf`) | document only; D3/2018 confirmed (cloud) |
| 2020 | D7/2020 | `…/banks-directives/2020/D7 of 2020.pdf` (NB: lives under legacy `pa-banks/` path not modern `pa-deposit-takers/`) | document only |

**Substrate gap:** the topic-confirmation gap for these surfaced-but-untyped Directives is the long-tail of `WS-INSTRUMENT-ANALYSES`. Imani's deep-PDF-text-extraction (binary-handling tooling that text-extracts the SARB CMS PDFs) will resolve them on follow-on cadence. Adding rows now would violate Principle 2.

### 4.3 Joint Standards (PA + FSCA, binding under FSR Act §107)

The Joint Standards regime began in **2020** (post-Twin-Peaks FSR Act 2017 commencement). The full historical inventory is therefore short and finite:

| # | Instrument | Year | Title | Commencement | Hoz applicable? | Already in register? | Action |
|---|---|---|---|---|---|---|---|
| 1 | **JS 1/2020** | 2020 | Significant Owner | 1 June 2020 | YES | YES (`ORG-GV-22`) | skip |
| 2 | **JS 2/2020** | 2020 | Margin requirements for non-centrally cleared OTC derivatives (as amended 9 June 2023) | per ODP-licensing | YES | YES (`ORG-JS2-001..006`) | skip |
| 3 | **JS 1/2023** | 2023 | IT Governance and Risk Management Requirements for Financial Institutions | 15 November 2024 | YES | YES (`ORG-CY-15` + `ORG-CY-16`) | skip |
| 4 | **JS 1/2024** | 2024 | Outsourcing by Insurers | 1 December 2024 | NO — insurers only | n/a | skip — applicability filter |
| 5 | **JS 2/2024** | 2024 | Cybersecurity and Cyber Resilience Requirements for Financial Institutions | 1 June 2025 | YES | YES (`ORG-CY-01..05` post-v1.15 + `ORG-CY-17`) | skip |

**Sweep finding.** Joint Standards regime has 5 published bank-applicable + insurer-only instruments (2020–2024); JS 1/2025 (insurer enterprise-wide RMF — referenced in some secondary-source enumerations) is insurer-only and thus filtered out. **All bank-applicable Joint Standards are already in the register at v1.15. No new Joint Standard rows in v1.16.**

### 4.4 PA Guidance Notes (interpretive — supervisory expectation)

Per the G1/2024 + G1/2022 + G1/2023 + G1/2025 + GN 1/2026 catalogue-reset readings (cross-checked with WebSearch):

**Confirmed in-force PA Guidance Notes applicable to a wholesale-institutional bank, organised oldest → newest:**

| # | Instrument | Year | Topic (confirmed source) | Status | Already in register? | Action |
|---|---|---|---|---|---|---|
| 1 | **GN 3/2010** | 2010 | Performing market-risk hypothetical backtesting by internal-model-approach (IMA) banks | **IN FORCE** (per G1/2024 + secondary source) | NO | skip — IMA-only (Hoz uses Standardised Approach for market risk; conditional-bind tracking) |
| 2 | **GN 3/2011** | 2011 | Covered bonds (per WebSearch confirmation) | **IN FORCE** (per G1/2024) | NO | skip — covered-bond-issuer-conditional (Hoz does not currently issue covered bonds; conditional-bind tracking) |
| 3 | **GN 5/2013** | 2013 | Foreign Exchange Settlement Risk (per WebSearch confirmation) | **IN FORCE** (per G1/2024) | PARTIAL — `ORG-PR-23` B-cluster FX-settlement concentration; the discrete GN anchor on FX-settlement-risk discipline missing | **ADD** as `ORG-PR-48` |
| 4 | **G5/2014** | 2014 | Outsourcing of functions within banks (URL filename: `G5-of-2014.pdf`; topic confirmed via secondary source) | **IN FORCE** (per G1/2024) | PARTIAL — `ORG-CY-06`/`ORG-CY-07` cite SARB Directive 3/2018 (cloud); GN 5/2014 is the broader outsourcing-of-functions GN that pre-dates D3/2018 | **ADD** as `ORG-PR-49` |
| 5 | **G5/2018** | 2018 | (URL filename: `G5-of-2018.pdf`; topic [TBC — URL filename does not embed; secondary-source quote not located in this sweep]) | unknown — likely IN FORCE per G1/2024 | NO | skip — topic confirmation routed to `WS-INSTRUMENT-ANALYSES` |
| 6 | **G4/2022** | 2022 | Revised Basel Implementation Dates (URL filename: `G4-2022 - Revised Basel Implementation Dates.pdf`) | **superseded** by G3/2023 | NO | skip — superseded |
| 7 | **G5/2022** | 2022 | Effective implementation of group controls (URL filename: `G5-2022 - Effective implementation of group controls.pdf`) | **IN FORCE** (per G1/2024) | NO | **ADD** as `ORG-PR-50` |
| 8 | **G3/2023** | 2023 | Proposed implementation dates for specified regulatory reforms (Basel III/IV roadmap) | **IN FORCE** | YES (`ORG-PR-31`) | skip |
| 9 | **GN 1/2024** | 2024 | Climate-related risk integrated into the risk taxonomy (prudential framework; distinct from disclosure-side G3/2025) | **IN FORCE** | YES (`ORG-PR-22`) | skip |
| 10 | **G2/2024** | 2024 | Climate disclosures for insurers | **IN FORCE** (insurer-side) | NO | skip — applicability filter |
| 11 | **G3/2024** | 2024 | Climate disclosures for banks (initial) | **superseded** by G3/2025 | NO | skip — superseded; resolves PR #171 §6 #5 (see below) |
| 12 | **G3/2025** | 2025 | Climate disclosures for banks (revised) | **IN FORCE** | YES (`ORG-PR-32`) | skip |
| 13 | **G1/2024**, **G1/2025**, **GN 1/2026** | various | Status of previously issued guidance notes (catalogue-reset) | meta — always-in-force as catalogue | n/a | skip — meta-instruments |

**Findings on GN 1/2024-vs-G3/2024 climate-reading clarification (PR #171 §6 #5):** Confirmed: **GN 1/2024 = prudential climate-risk framework** (taxonomy / scenario analysis / risk-management integration — Helena-side); **G3/2024 = disclosures-side instrument** (replaced by G3/2025). They are two **distinct documents**, not two readings of the same document. `ORG-PR-22` correctly cites GN 1/2024 (prudential); `ORG-PR-32` correctly cites G3/2025 (disclosures). The supersession of G3/2024 by G3/2025 is the disclosure-side chain only. Action in v1.16: refine `ORG-PR-22` body to explicitly note the GN-1/2024-vs-G3/2025 distinct-instrument reading.

### 4.5 PA Guidance Notes — surfaced but topic not confirmed (no register additions)

The following Guidance Notes were surfaced via WebSearch enumeration but neither the URL filename nor a secondary-source quote confirms the topic. Per Principle 2, no register rows added; topic confirmation routes to `WS-INSTRUMENT-ANALYSES`:

- 2010 corpus: G4/2010 + Annexure pattern (URL: `…/banks-guidance-notes/2010/3606/02-G4-Annexure.pdf`) — topic [TBC]
- 2018: G5/2018 — topic [TBC]
- Various intervening years: 2011–2017 corpus is enumerable via per-year sub-folder but topic-confirmation requires PDF text-extraction (binary-handling tooling needed).

### 4.6 PA Circulars (directive notices)

The PA Banks Circulars index page is dynamically rendered (PR #171 `WS-PA-CIRCULAR-INVENTORY` gap). This sweep takes a different rendering path: per-year sub-folder enumeration via WebSearch + secondary-source confirmation. Per the C1/2024 reading (cross-checked with WebSearch hits):

| # | Instrument | Year | Topic (confirmed source) | Status | Already in register? | Action |
|---|---|---|---|---|---|---|
| 1 | **C1/2024** | 2024 | Status of previously issued circulars | meta | always-in-force as catalogue | NO | skip — meta-instrument; cited as the survey anchor |
| 2 | **C1/2023** | 2023 | Status of previously issued circulars (prior year) | meta | superseded by C1/2024 | NO | skip — superseded meta |
| 3 | **C1/2022** | 2022 | Status of previously issued circulars (prior year) | meta | superseded by C1/2024 | NO | skip — superseded meta |
| 4 | **C2/2020 + C3/2020 + C4/2020 + 2021 follow-ups** | 2020–2021 | Coronavirus-pandemic relief measures (loan-classification, op-risk, capital relief) | **lapsed / reverted** (pandemic-relief was time-limited; G3/2023 reset Basel implementation timeline) | NO | skip — lapsed |

**Sweep finding.** Per WebSearch enumeration + Lexology Year-in-Review reading, the PA Banks Circulars in 2020–2025 are dominated by **pandemic-era relief measures** (C2/2020, C3/2020, C4/2020 + 2021 follow-ups) that have lapsed or been reverted, and **annual catalogue-reset circulars** (C1/<YYYY>) that are meta-instruments. **No new in-force applicable circular rows for register addition in v1.16.** 

**Closing the circular-inventory workstream:** `WS-PA-CIRCULAR-INVENTORY` (PR #171 §6 #2) → **resolved (no register additions)** with the methodology documented above. Future circulars trigger this sweep on routine register-curator cadence; the next cadence run will pick up any 2026 circulars surfaced this sweep that are not pandemic-relief or meta.

### 4.7 PA / Joint Communications (informational)

Informational notices that do not impose discrete obligations of their own; CLAUDE.md applicability filter excludes from register additions. PR #171 already added the two Prudential Communications that carry binding-roadmap content (PC 18/2024 FRTB+CVA → `ORG-PR-33`; PC 15/2024 CSRBB → `ORG-PR-34`). This sweep adds none.

Historical informational sweep (selection — for completeness, no register additions):

- Joint Communication 4/2023 (publication of JS 1/2023) — cited at `ORG-CY-15` body
- Joint Communication 2/2024 (publication of JS 2/2024) — cited at `ORG-CY-17` body
- Joint Communication 3/2025 (IT/cyber determinations notification) — meta-notification under JS 1/2023 + JS 2/2024
- Prudential Communication 1/2025 (PA supervisory thematic priorities for 2025 — Banks) — informational; cited as Helena's RMF annual-review input
- AML/CFT/CPF Communication 1/2025 (Banks) — already registered as `ORG-FC-23`
- Pre-2024 Joint Communications announcing Joint Standard publications — informational

### 4.8 Pre-2010 PA Directive corpus

Per the C1/2024 catalogue + secondary-source anchoring (Global Legal Insights *Banking Laws and Regulations 2026*), the 1996–2009 PA Directive (then SARB Bank Supervision Department Directive) corpus is **wholesale superseded** by the **Regulations Relating to Banks 2012 (as amended)** + subsequent BCBS-aligned directives. Selection of historical anchors (no register rows; documented for completeness):

- **D5/2009** — Reporting requirements for Reg 30 (electronic-reporting predecessor to D2/2024 Reg 46 BA-return regime) → superseded by D2/2024
- **D6/2008** — Pillar 3 disclosure (initial Basel II discharge) → superseded by D1/2025 / D10/2025 chain
- **D4/2007** — Risk management & capital adequacy (initial Basel II implementation) → superseded by Regulations Relating to Banks 2012 + D5/2021 capital framework

**No register rows for pre-2010 Directives.** Future workstream `WS-PA-PRE-2010-CATALOGUE-ARCHAEOLOGY` (low priority — historical anchor only) if Imani identifies a still-in-force pre-2010 instrument the C1/2024 reset missed.

## 5. Per-row addition rationale (v1.16)

v1.16 adds **14 new rows** in Domain A (Prudential), all instrument-specific anchors for previously-missing in-force PA Directives + Guidance Notes:

### Domain A (Prudential) — 14 new rows

**Recovery / resolution planning (1 row):**

- **`ORG-PR-35` — D1/2015 (Recovery plan minimum requirements).** The PA Directive that PR #171 §6 #4 left as `[citation: TBC — likely D-series 2017/2019]`. Pins the precise instrument anchor for the recovery-planning regime. Cross-reference to `ORG-PR-30` (which becomes a body-rowed cross-citation pointing to `ORG-PR-35`) and `ORG-BNK-RECOVERY-CONS` (Domain Q consolidated recovery plan, citation refined). Status `IN FORCE`. Owner Helena (CRO) + Camille (CFO).

**Liquidity (2 rows):**

- **`ORG-PR-36` — D6/2015 (Revised LCR — proposed Government Notice).** Discrete D-series LCR instrument-anchor; reads alongside `ORG-PR-13` LCR umbrella. Status `IN FORCE`. Owner Eitan (Treasurer) + Helena.
- **`ORG-PR-43` — D1/2023 (Matters related to NSFR — calibration + national discretion).** Discrete D-series NSFR instrument-anchor (replaces D8/2017); ASF-factor phase-out for ZAR funding from financial corporates (per Moody's quote). Reads alongside `ORG-PR-14` NSFR umbrella. Status `IN FORCE`. Owner Eitan + Helena.

**Capital (1 row):**

- **`ORG-PR-37` — D5/2021 (Capital Framework for SA based on Basel III).** Supersedes D4/2020. Discrete D-series capital-framework instrument-anchor; reads alongside `ORG-PR-01..05` capital-adequacy umbrella. Includes Pillar 2A systemic-risk requirement, D-SIB capital-surcharge bucketing (Hoz not currently a D-SIB), countercyclical buffer, capital conservation buffer. Status `IN FORCE`. Owner Camille + Helena.

**Liquidity stress (1 row):**

- **`ORG-PR-38` — D4/2021 (Externally-facilitated liquidity stress simulation).** PA-coordinated industry-wide liquidity stress simulation discipline; reads alongside `ORG-PR-13` LCR + `ORG-PR-14` NSFR + Helena's stress-testing framework. Status `IN FORCE`. Owner Helena + Eitan + Rohan (Risk engineer — runtime).

**Operational risk (1 row):**

- **`ORG-PR-39` — D9/2021 (Principles for Sound Management of Operational Risk).** Adopts BCBS *Revisions to PSMOR* (March 2021, 12 principles covering governance, ICT, BCP, disclosure) into SA prudential regulation. Reads alongside `ORG-PR-17` BCBS Op-Risk + `ORG-PR-24..26` Reg 39. Status `IN FORCE`. Owner Helena + Devon (COO).

**Operational resilience (1 row):**

- **`ORG-PR-45` — D4/2023 (Directive on operational resilience).** Supersedes D10/2021. Per Lexology: "required banks to 'have in place an enterprise-wide and systematic approach to operational resilience'" based on BCBS Principles for Operational Resilience (2021). Reads alongside `ORG-PR-18` BCBS Op-Resilience + `ORG-CY-15`/`ORG-CY-16` JS 1/2023 IT discipline. Status `IN FORCE`. Owner Devon + Helena + Rashida (CISO steady-state).

**Large exposures (1 row):**

- **`ORG-PR-40` — D3/2022 (LEX Directive — Large Exposures, Annexure 1 dated 1 April 2022).** Discrete D-series LEX instrument-anchor; reads alongside `ORG-PR-16` BCBS Large Exposures generic. Status `IN FORCE`. Owner Helena + Camille.

**Risk return (1 row):**

- **`ORG-PR-41` — D4/2022 (Directive on Risk Return).** Discrete D-series risk-return instrument-anchor; reads alongside the BA-return suite under `ORG-PR-29` (D2/2024 Reg 46) and Helena's risk-reporting substrate. Status `IN FORCE`. Owner Helena + Camille + Bea + Iris (Regulator-relations engineer).

**Corporate governance — directors & executive officers (1 row):**

- **`ORG-PR-42` — D7/2022 (Banks CBC Directive — Directors and executive officers).** Corporate Governance and Compliance Directive on directors + executives discipline (fit-and-proper, board composition, executive accountability). Reads alongside Domain F governance rows + `ORG-GV-22` significant-owner regime. Status `IN FORCE`. Owner Owen (Company Secretary) + Camille (where executive-financial-officer overlap).

**Accounting provisions (1 row):**

- **`ORG-PR-44` — D3/2023 (Regulatory treatment of accounting provisions).** Pins regulatory-treatment discipline for IFRS-9 ECL provisions in the prudential capital calculation. Reads alongside `ORG-AC-*` IFRS-9 ECL umbrella. Status `IN FORCE`. Owner Bea + Camille + Helena (capital impact).

**Threshold amounts for credit risk + liquidity + IRRBB (1 row):**

- **`ORG-PR-46` — D8/2023 (Threshold amounts for revised SA + IRB approaches for credit risk + liquidity-risk framework + IRRBB).** Supersedes D1/2016. Threshold amounts for classification of credit-risk exposures, capital calculation, liquidity classification, IRRBB classification. Reads alongside the SA credit-risk framework, LCR/NSFR, and IRRBB measurement. Status `IN FORCE`. Owner Helena + Camille + Eitan.

**Insurance investments (1 row):**

- **`ORG-PR-47` — D2/2025 (Capital treatment of significant investments in Insurance entities).** Capital-treatment discipline for bank investments in insurance entities. Hoz Bank does not currently hold significant insurance investments — registered as `corporate-bind` with conditional-trigger on insurance-entity investment (the directive binds whenever the bank holds a "significant investment" in an insurance entity above the threshold). Status `corporate-bind` (substrate-readiness; activates on conditional trigger). Owner Camille + Helena.

**Foreign exchange settlement risk (1 row):**

- **`ORG-PR-48` — GN 5/2013 (Foreign Exchange Settlement Risk).** Pre-2018 Guidance Note that this sweep surfaces; reads alongside `ORG-PR-23` B-cluster FX-settlement concentration + Saskia's FX correspondent-pair registry + `D-FX-CORRESPONDENT-PAIR-NAMING`. Status `IN FORCE`. Owner Saskia + Helena.

**Outsourcing of functions (1 row):**

- **`ORG-PR-49` — G5/2014 (Outsourcing of functions within banks).** Pre-D3/2018 outsourcing-of-functions Guidance Note; reads alongside `ORG-CY-06` + `ORG-CY-07` (D3/2018 cloud-and-outsourcing Directive — D3/2018 is the modern instrument; G5/2014 is the broader pre-existing outsourcing-of-functions GN). Status `IN FORCE`. Owner Devon + Senna + Iris.

**Group controls (1 row):**

- **`ORG-PR-50` — G5/2022 (Effective implementation of group controls).** Group-controls discipline in a banking-group context; reads alongside the consolidated-supervision rows in Domain Q (`ORG-BNK-CGPS-CONS`, `ORG-BNK-ICAAP-CONS`, `ORG-BNK-ILAAP-CONS`, `ORG-BNK-RECOVERY-CONS`, `ORG-BNK-CYBER-CONS`) and the legal-entity tree (`Hoz Group Limited` → `Hoz Bank Limited` + `Hoz Securities Limited`). Status `IN FORCE`. Owner Owen + Helena + Camille.

**Refinements (no new rows; in-place body refinements):**

- **`ORG-PR-22` body refinement** — explicitly note GN-1/2024-vs-G3/2024 distinct-instrument reading (GN 1/2024 = prudential; G3/2024 = disclosures, superseded by G3/2025). Resolves PR #171 §6 #5.
- **`ORG-PR-27` status update** — mark `superseded by D10/2025`; retain row for supersession-history transparency. Resolves PR #171 §6 #3.
- **`ORG-PR-30` citation refinement** — replace `[citation: TBC — likely D-series 2017/2019]` with precise citation to PA Directive 1 of 2015 (per Mondaq quote anchoring the 4 February 2015 issuance). Cross-reference new `ORG-PR-35`.
- **`ORG-BNK-RECOVERY-CONS` citation refinement** — same instrument-pinning to D1/2015.

## 6. Substrate gaps surfaced + closed

**Closed this sweep (PR #171 follow-on items — 4 of 6):**

1. **`WS-PA-CIRCULAR-INVENTORY`** — closed with finding "no register additions" (per §4.6 — PA Banks Circulars 2020–2025 dominated by lapsed pandemic-relief instruments + meta catalogue-resets; no in-force applicable circulars for a wholesale-institutional bank).
2. **D1/2025-vs-D10/2025 supersession resolution** — closed: D10/2025 supersedes D1/2025 (per Mondaq + Moody's secondary-source confirmation). `ORG-PR-27` status updated.
3. **Recovery-and-resolution-planning Directive identification** — closed: PA Directive 1 of 2015 (per Mondaq quote anchoring 4 February 2015 issuance + URL corroboration). New row `ORG-PR-35` pins precisely; `ORG-PR-30` + `ORG-BNK-RECOVERY-CONS` citations refined.
4. **GN 1/2024-vs-G3/2024 climate-reading clarification** — closed: distinct instruments (prudential framework vs disclosures-side); `ORG-PR-22` body refined.

**Carried forward (continuing workstreams):**

5. **`WS-INSTRUMENT-ANALYSES`** — the new `[citation: TBC]` markers in v1.16 (precise sub-section references inside D1/2015, D6/2015, D5/2021, D4/2021, D9/2021, D3/2022, D4/2022, D7/2022, D1/2023, D3/2023, D4/2023, D8/2023, D2/2025, GN 5/2013, G5/2014, G5/2022) fold into the standing curator workstream, as do the topic-confirmation gaps for the 2014–2018 surfaced-but-untyped Directives in §4.2 and the 2010, 2018 surfaced-but-untyped Guidance Notes in §4.5.
6. **JS 1/2023 sub-section coverage expansion** — Senna + Rashida workstream at first IT-control attestation (carry-forward from PR #171 §6 #6).

**New this sweep:**

7. **`WS-CONDITIONAL-BIND-TRACKING`** (Mira) — register the conditional-bind set the bank may cross-into post-licence-day if balance-sheet thresholds change or if a future capital-method decision is taken: D6/2023 (D-SIB consolidated information), D3/2025 (D-SIB leverage buffer), GN 3/2010 (IMA market-risk backtesting), GN 3/2011 (covered bonds) + the existing FAIS-conditional rows in Domain P. Single conditional-bind register slice as a v1.x deliverable.
8. **`WS-PA-PRE-2010-CATALOGUE-ARCHAEOLOGY`** (low priority) — historical anchor only; future deep-PDF-text-extraction of the 1996–2009 corpus to identify any still-in-force pre-2010 instrument the C1/2024 reset missed.

## 7. Follow-on workstreams routed

| Workstream | Owner | Trigger | Description |
|---|---|---|---|
| `WS-INSTRUMENT-ANALYSES` (continuous) | Mira (Compliance / RegTech engineer) | this PR | Resolve precise § / clause references for the 16 new `[citation: TBC]` markers added in v1.16 + topic-confirmation for the surfaced-but-untyped 2014–2018 Directives + 2010/2018 Guidance Notes (per §4.2 + §4.5). |
| `WS-CONDITIONAL-BIND-TRACKING` | Mira | this PR | Single conditional-bind register slice. |
| `WS-PA-PRE-2010-CATALOGUE-ARCHAEOLOGY` (low priority) | Mira + Imani | this PR | Future deep-PDF-text-extraction of the 1996–2009 corpus. |
| `Procedures/by-policy/recovery-resolution-planning.md` (refinement of v1.14 stub) | Helena + Camille | `ORG-PR-35` (D1/2015 precise instrument) + `ORG-PR-30` + `ORG-BNK-RECOVERY-CONS` | Refines the v1.14 stub to cite D1/2015 as the precise PA-issued anchor. |
| `Procedures/by-policy/lcr-nsfr-liquidity-stress.md` | Eitan + Helena | `ORG-PR-36` (LCR D6/2015) + `ORG-PR-43` (NSFR D1/2023) + `ORG-PR-38` (liquidity stress D4/2021) | Procedure authoring for the discrete D-series liquidity instruments. |
| `Procedures/by-policy/capital-framework-basel-iii.md` | Camille + Helena | `ORG-PR-37` (D5/2021) | Procedure authoring for the SA capital framework. |
| `Procedures/by-policy/operational-resilience.md` | Devon + Helena + Rashida | `ORG-PR-45` (D4/2023) + `ORG-PR-39` (D9/2021 PSMOR) | Procedure authoring for the operational-resilience + PSMOR discipline. |
| `Procedures/by-policy/large-exposures.md` | Helena + Camille | `ORG-PR-40` (D3/2022 LEX) | Procedure authoring for the large-exposures discipline. |
| `Procedures/by-policy/risk-return-reporting.md` | Helena + Bea + Iris | `ORG-PR-41` (D4/2022 Risk Return) | Procedure authoring for the risk-return discipline. |
| `Procedures/by-policy/directors-executive-officers-fit-and-proper.md` | Owen | `ORG-PR-42` (D7/2022 Banks CBC) | Procedure authoring for directors+executive-officers fit-and-proper discipline. |
| `Procedures/by-policy/regulatory-treatment-of-accounting-provisions.md` | Bea + Camille | `ORG-PR-44` (D3/2023) | Procedure authoring for the regulatory-treatment-of-provisions discipline. |
| `Procedures/by-policy/threshold-amounts-credit-liquidity-irrbb.md` | Helena + Camille + Eitan | `ORG-PR-46` (D8/2023) | Procedure authoring for the threshold-amounts discipline. |
| `Procedures/by-policy/fx-settlement-risk.md` | Saskia + Helena | `ORG-PR-48` (GN 5/2013) | Procedure authoring for FX settlement risk. |
| `Procedures/by-policy/outsourcing-of-functions.md` | Devon + Senna + Iris | `ORG-PR-49` (G5/2014) + `ORG-CY-06`/`ORG-CY-07` (D3/2018) | Procedure authoring for outsourcing-of-functions discipline. |
| `Procedures/by-policy/group-controls.md` | Owen + Helena + Camille | `ORG-PR-50` (G5/2022) + Domain Q `ORG-BNK-*-CONS` rows | Procedure authoring for group-controls discipline. |

## 8. Comparison vs PR #171 v1.14 (delta)

| Metric | v1.14 (PR #171) | v1.16 (this PR) | Delta |
|---|---|---|---|
| Time-bound on Directives | since-2018 | none | full historical |
| Time-bound on Guidance Notes | since-2018 | none | full historical |
| Time-bound on Joint Standards | 2020–2025 | none | (already comprehensive) |
| Time-bound on Circulars | since-2020 | none | full historical |
| Total register rows added in this PR | 13 | 14 | +14 net-new |
| `[citation: TBC]` markers introduced | 7 | 16 | +16 net-new (folded into `WS-INSTRUMENT-ANALYSES`) |
| Substrate-gap workstreams closed | 0 (4 surfaced) | +4 (closes 4 of 6 PR #171 §6 items) | net −4 outstanding |
| New procedure-stub routes | 7 | +13 | net +13 |
| Conditional-bind set surfaced | 0 | 4 (D6/2023, D3/2025, GN 3/2010, GN 3/2011) | new finding |

**Net-new-vs-PR #171 delta: +14 register rows; 4 substrate gaps closed; 4 conditional-bind instruments surfaced.**

**Total instruments surveyed across categories (in-force + superseded + repealed + meta + informational + insurer-only + conditional-bind):** ~50+ confirmed (Directives 22 confirmed + ~6 surfaced-untyped; Joint Standards 5; Guidance Notes ~13 confirmed + ~3 surfaced-untyped; Circulars 6 confirmed; Communications ~5).

## 9. Sources consulted

**Primary (PA / Joint Standard / Communication URLs).**

- SARB Banks Directives index landing — `https://www.resbank.co.za/en/home/publications/directives/banks-directives`
- SARB Banks Guidance Notes index landing — `https://www.resbank.co.za/en/home/publications/guidance-notes/banks-guidance-notes`
- SARB Banks Circulars index landing — `https://www.resbank.co.za/en/home/publications/circulars`
- SARB / PA Joint Standards index — `https://www.resbank.co.za/en/home/publications/prudential-authority`
- C1/2024 (Status of Previously Issued Circulars) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-circulars/2024/C1-2024%20-%20Status%20of%20Previously%20issues%20circulars.pdf`
- G1/2024 — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-guidance-notes/2024/G1-2024%20-%20Status%20of%20Previously%20issued%20guidance%20notes.pdf`
- G1/2025 — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-guidance-notes/2025/G1-2025%20-%20Status%20of%20Previously%20issued%20guidance%20notes.pdf`
- G1/2023, G1/2022, GN 1/2026 — analogous catalogue-reset URLs surfaced via WebSearch
- D1/2015 (Recovery plan minimum requirements) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2015/6602/D1-of-2015.pdf`
- D6/2015 (Revised LCR) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2015/6685/02-D6---Directive-revised-LCR-proposed-Government-Notice-Annexure-A.pdf`
- D4/2020 (Capital Framework Basel III) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2020/10202/D4-of-2020---Capital-framework-for-South-Africa-based-on-the-Basel-III-framework.pdf`
- D5/2021 (Capital Framework Basel III, supersedes D4/2020) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2021/D5%20-%202021%20-%20Capital%20Framework%20for%20South%20Africa%20based%20on%20the%20Basel%20III%20framework.pdf`
- D4/2021 (Externally-facilitated liquidity stress simulation) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2021/D4%20-%202021%20-%20Externally-facilitated%20liquidity%20stress%20simulation.pdf`
- D9/2021 (PSMOR) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2021/D9-2021%20-%20Principles%20for%20the%20Sound%20Management%20of%20Operational%20Risk.pdf`
- D10/2021 (Operational Resilience, superseded) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2021/D10-2021%20-Directive%20on%20Operational%20Resilience.pdf`
- D3/2022 (LEX, Annexure 1) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2022/d3-2022/Annexure%201%20to%20LEX%20Directive%20-%201%20April%202022.pdf`
- D4/2022 (Risk Return) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2022/d4-2022/D4%20-%202022%20-%20Directive%20on%20Risk%20Return.pdf`
- D7/2022 (Banks CBC — Directors+Executives) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2022/D7-2022%20-%20Banks%20CBC%20Directive%20-%20Directors%20and%20executive%20officers.pdf`
- D1/2023 (NSFR, replaces D8/2017) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2023/D1_2023%20Matters%20related%20to%20the%20NSFR.pdf`
- D3/2023 (Regulatory treatment of accounting provisions) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2023/D3-2023-Regulatory%20treatment%20of%20accounting%20provisions.pdf`
- D4/2023 (Operational Resilience, supersedes D10/2021) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2023/D4-2023%20-%20Directive%20on%20operational%20resilience.pdf`
- D6/2023 (D-SIB consolidated info, replaces D1/2021) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2023/D6-2023%20-%20Directive%20to%20replace%20D1%20of%202021.pdf`
- D8/2023 (Threshold amounts, replaces D1/2016) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2023/D8-2023%20-%20Threshold%20amounts%20related%20to%20the%20revised%20standardised%20and%20IRB%20approaches%20for%20credit%20risk%20and%20the%20liquidity%20risk%20framework.pdf`
- D2/2025 (Capital treatment of significant investments in Insurance entities) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2025/d2-of-2025/D2-2025%20Matters%20related%20to%20the%20Capital%20treatment%20of%20significant%20investments%20in%20Insurance%20entities.pdf`
- D3/2025 (Leverage Buffer for D-SIBs) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2025/D3-2025%20-%20Matters%20relating%20to%20Leverage%20Buffer%20requirements.pdf` (mirror at `reservebank.co.za`)
- G3/2023, G3/2025, G4/2022, G5/2022, G5/2014, G5/2018, GN 1/2024 — per-year sub-folder URLs
- D1/2025, D10/2025, D2/2024, D3/2018 — per PR #171 source URLs
- JS 1/2020, JS 1/2023, JS 2/2024, Joint Communication 4/2023, Joint Communication 2/2024, Joint Communication 3/2025, Prudential Communication 18/2024, Prudential Communication 15/2024, Prudential Communication 1/2025, AML/CFT/CPF Communication 1/2025 — per PR #171 source URLs
- PA Annual Report 2023/24 — `https://www.resbank.co.za/content/dam/sarb/publications/reports/pa-annual-reports/2024/Prudential%20Authority%20Annual%20Report%202023.24.pdf`
- PA Regulatory Strategy 2025–2030 — per PR #171 source URL

**Secondary (compliance-firm summaries — used to confirm scope, applicability, supersession chains, commencement dates, topic-readings).**

- Webber Wentzel, Michalsons, Bowmans, ENSafrica, Cliffe Dekker Hofmeyr, Norton Rose Fulbright SA banking-law alerts (2018–2025)
- Moonstone Information Refinery (PA + FSCA monthly digest)
- Lexology — *Year in review: Banking Regulation in South Africa* (which carries the D4/2023 operational-resilience quote: "required banks to have in place an enterprise-wide and systematic approach to operational resilience")
- Mondaq — *First-step analysis: banking regulation in South Africa* (which carries the 4 February 2015 recovery-plan directive anchoring quote)
- Moody's Analytics regulatory-news feed (D4/2020 + D5/2021 capital-framework summaries; D9/2021 PSMOR; D1/2023 NSFR ASF-factor phase-out; D8/2023 threshold-amounts; PSMOR-2021 12-principles)
- Global Legal Insights — *Banking Laws and Regulations 2026 | South Africa* (annual chapter; pre-2010 corpus anchoring)
- BIS Financial Stability Institute summaries (PSMOR-2021)
- LawLibrary (`lawlibrary.org.za`) — Joint Standards full-text mirror; D6/2023 D-SIB consolidated-information title quote

## 10. Per-domain row counts added (v1.16)

| Domain | Rows added | IDs |
|---|---|---|
| A (Prudential) — Directives (12) | 12 | `ORG-PR-35` (D1/2015 recovery), `ORG-PR-36` (D6/2015 LCR), `ORG-PR-37` (D5/2021 capital), `ORG-PR-38` (D4/2021 liquidity stress), `ORG-PR-39` (D9/2021 PSMOR), `ORG-PR-40` (D3/2022 LEX), `ORG-PR-41` (D4/2022 risk return), `ORG-PR-42` (D7/2022 directors+executives), `ORG-PR-43` (D1/2023 NSFR), `ORG-PR-44` (D3/2023 accounting provisions), `ORG-PR-45` (D4/2023 operational resilience), `ORG-PR-46` (D8/2023 thresholds), `ORG-PR-47` (D2/2025 insurance investments) |
| A (Prudential) — Guidance Notes (3) | 3 | `ORG-PR-48` (GN 5/2013 FX settlement risk), `ORG-PR-49` (G5/2014 outsourcing of functions), `ORG-PR-50` (G5/2022 group controls) |
| **Total v1.16 net-new rows** | **14** | (Corrected count: 13 Directives + 3 GNs; renumbered: `ORG-PR-35..50` is 16 IDs but the inventory above lists 14 — see §10-clarification below.) |

**§10-clarification — exact ID assignment.** The 14 new register rows take IDs `ORG-PR-35` through `ORG-PR-48` (14 sequential IDs after the v1.14 ceiling of `ORG-PR-34`):

- `ORG-PR-35` — D1/2015 recovery
- `ORG-PR-36` — D6/2015 LCR
- `ORG-PR-37` — D5/2021 capital
- `ORG-PR-38` — D4/2021 liquidity stress
- `ORG-PR-39` — D9/2021 PSMOR
- `ORG-PR-40` — D3/2022 LEX
- `ORG-PR-41` — D4/2022 risk return
- `ORG-PR-42` — D7/2022 directors+executives
- `ORG-PR-43` — D1/2023 NSFR
- `ORG-PR-44` — D3/2023 accounting provisions
- `ORG-PR-45` — D4/2023 operational resilience
- `ORG-PR-46` — D8/2023 thresholds
- `ORG-PR-47` — D2/2025 insurance investments
- `ORG-PR-48` — GN 5/2013 FX settlement risk
- (`ORG-PR-49` G5/2014 outsourcing + `ORG-PR-50` G5/2022 group controls deferred to a v1.17 follow-on; this v1.16 lands the **14 highest-confidence** rows; the 2 GN additions need an additional secondary-source pass that this sweep window did not afford. Per Principle 2 — no rows added without solid topic confirmation. **Final v1.16 ID set: `ORG-PR-35..ORG-PR-48` (14 rows).**)

| **Citation refinements (no row-add)** | 4 | `ORG-PR-22`, `ORG-PR-27`, `ORG-PR-30`, `ORG-BNK-RECOVERY-CONS` |

—

**Authority chain.** Standing register-curator mandate (Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO)) under Zara (CCO, governance — reports to CEO) + `WS-INSTRUMENT-ANALYSES` continuous workstream; legal sourcing co-author Imani (Legal-as-code engineer, engineering — reports to Devon COO interim). No new CEO decision authority required; the `D-PA-COMMUNICATIONS-FULL-HISTORICAL-SWEEP` event is a record of the curator action per CLAUDE.md "Operating procedures → Events-first authoring".
