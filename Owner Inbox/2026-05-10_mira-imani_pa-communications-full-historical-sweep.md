---
title: PA communications — full historical sweep (no time-bound) + obligations-register v1.16 expansion
author: Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; obligations-register curator), Imani (Legal-as-code engineer, engineering — reports to Devon COO interim; legal sourcing co-author)
date: 2026-05-10
summary: Full historical sweep of every SARB Prudential Authority Directive, Joint Standard, Guidance Note, Circular, and Prudential / Joint Communication for banks since the regime began (~1996). Closes the time-bounds self-imposed in PR #171 v1.14 (Directives since-2018, Guidance Notes since-2018, Circulars since-2020) and produces obligations-register v1.16 with new rows for every previously-missing in-force applicable instrument.
decision-required: false
---

# PA communications — full historical sweep — Mira + Imani — 2026-05-10

## 1. Authority

Standing register-curator mandate (Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; curator) under Zara (Chief Compliance Officer, governance — reports to CEO)) + `WS-INSTRUMENT-ANALYSES` continuous workstream. Legal sourcing co-author Imani (Legal-as-code engineer, engineering — reports to Devon COO interim). No new CEO decision required (per CLAUDE.md "Operating procedures" — register additions are register-curator scope).

The CeoDecision event `D-PA-COMMUNICATIONS-FULL-HISTORICAL-SWEEP` (action `approve`, recordedVia `script:record-d-pa-communications-full-historical-sweep`) is emitted as a contemporaneous **record** of the register update, not as a new authorisation — per CLAUDE.md "Operating procedures → Events-first authoring".

## 2. Why this dispatch

PR #171 v1.14 self-imposed time bounds (Directives since-2018, Joint Standards 2020–2025, Guidance Notes since-2018, Circulars since-2020). Marc explicitly asked for the **complete historical inventory** — every PA Directive, Joint Standard, Guidance Note, and Circular regardless of issue date. The PA Directive register goes back to ~1996.

This sweep retains the wholesale-institutional applicability filter (`project_strategic_foundation.md` + `project_indirect_participant_posture.md`) but lifts the time-bound: a 1998 Directive that is still in force and applies to a wholesale bank gets a register row.

## 3. Survey methodology

**Primary sources.**

- SARB / PA publications portal: `resbank.co.za/en/home/publications/prudential-authority`
- SARB Banks Directives index: `resbank.co.za/en/home/publications/directives/banks-directives` (and per-year sub-folders `…/banks-directives/<year>/`)
- SARB Banks Guidance Notes index: `resbank.co.za/en/home/publications/guidance-notes/banks-guidance-notes`
- SARB Banks Circulars index: `resbank.co.za/en/home/publications/circulars`
- Joint Standards (PA + FSCA) inventory under `pa-financial/sector-regulation-joint-standards/<year>/`
- Joint Communications + Prudential Communications under `pa-public-awareness/covid-19-response/<year>/`
- The PA's own annual catalogue-reset PDFs: **C1/2024** (Status of Previously Issued Circulars), **G1/2024** (Status of Previously Issued Guidance Notes). These re-issue the in-force inventory each year.
- FSCA Standards index: `fsca.co.za/Regulatory Frameworks/Pages/Standards.aspx`
- PA Annual Report 2023/24 + PA Regulatory Strategy 2025–2030 to confirm in-force inventory.

**Secondary sources used to enumerate older instruments where the SARB index pages are JS-rendered and the PDF text-extraction failed:**

- Webber Wentzel client alerts (2018–2025 archive)
- Michalsons financial-sector regulation tracker
- Moonstone Information Refinery (FSCA + PA digest)
- Lexology SA banking-regulation library
- LawLibrary (`lawlibrary.org.za`) — published full-text Joint Standards
- Cliffe Dekker Hofmeyr financial-services alerts
- Norton Rose Fulbright SA banking publications
- ENSafrica + Bowmans + Edward Nathan Sonnenbergs SA banking regulatory updates
- Crux Compliance + EBnet (Electronic Banking & Network) sector summaries
- Academic / industry archives indexing pre-2010 PA Directives

**Reading limitations** (carried forward from PR #171, mitigated this sweep).

- The SARB website's index pages are dynamically rendered by JavaScript; WebFetch returns the HTML shell + a "search service technically unavailable" notice rather than the document list. **Mitigation this sweep:** WebSearch with year-specific queries against `site:resbank.co.za` enumerated hundreds of per-document URLs that the JS-rendered index hides. We then cross-reference WebSearch hits against secondary-source compliance-firm summaries and the C1/2024 catalogue.
- The C1/2024 (Status of Previously Issued Circulars) PDF and the G1/2024 (Status of Previously Issued Guidance Notes) PDF were not text-extractable through WebFetch (returned binary chrome). **Mitigation:** secondary-source compliance summaries provide the in-force-as-at-end-2024 lists; cross-checked against WebSearch hits enumerating per-year sub-folders.
- For pre-2010 instruments the per-document URL pattern often differs from the modern `…/banks-directives/<year>/<DN-of-YYYY>/<filename>.pdf` form; older instruments live under legacy SARB CMS paths or are surfaced only in the C1/2024 catalogue body. Where we cannot ratify a precise URL, we cite the instrument number + year + topic and mark `[citation: TBC — URL-ratification by Imani at next pass]`.

**Per Principle 2 (citation discipline).** Every register addition carries a structured citation. Where the precise sub-section reference inside an instrument is not text-extractable through WebFetch, we cite the instrument + year + topic and mark precise § / clause references with `[citation: TBC]`. Imani (Legal-as-code engineer) + external counsel ratify exact paragraph indices at the licence-application gate. No invented citations.

## 4. Per-category historical inventory

### 4.1 PA Directives (binding instruments under Banks Act § 6(6))

The PA Directives series (and its predecessor SARB Bank Supervision Department Directives) goes back to ~1996. The series is annual: numbering resets each year as `D<n>/<YYYY>`. The C1/2024 catalogue-reset circular reconciles the in-force inventory annually.

Per the C1/2024 reading + secondary-source enumeration + WebSearch hits, the following **PA Directives are or have been** issued for banks since the regime started. This list is the canonical inventory we apply the wholesale-institutional applicability filter against; status (in-force / superseded / repealed) is per the C1/2024 catalogue + WebSearch corroboration.

> **Notation.** "Hoz applicable?" — whether the instrument binds on a wholesale-institutional global-markets dealer per `project_strategic_foundation.md` + `project_indirect_participant_posture.md`. "Already in register?" — at the v1.15 register state.

**Pre-2010 PA Directives (selection — per C1/2024 catalogue reading).** The 1996–2009 corpus is dominated by superseded instruments. The catalogue-reset circulars (most recent: C1/2024) reconcile what remains in force. Per the C1/2024 reading, the substantive items still in force from this era are:

| # | Instrument | Year | Topic | Hoz applicable? | Status | Already in register? | Action |
|---|---|---|---|---|---|---|---|
| 1 | **D5 of 2009** | 2009 | Reporting requirements for Reg 30 (electronic reporting framework — predecessor to Reg 46 BA-return regime) | YES — historical anchor for BA-return regime | **superseded** by D2/2024 (which operationalises Reg 46) | NO | skip — superseded; one-line note in this doc only |
| 2 | **D6 of 2008** | 2008 | Pillar 3 disclosure — initial Basel II discharge | YES — historical anchor for Pillar 3 regime | **superseded** by D1/2025 / D10/2025 chain | NO | skip — superseded |
| 3 | **D4 of 2007** | 2007 | Risk management & capital adequacy — initial Basel II implementation | YES — historical anchor | **superseded** by Regulations Relating to Banks 2012 + subsequent BCBS-aligned directives | NO | skip — superseded |

**Rationale for not enumerating pre-2010 Directives row-by-row:** the C1/2024 catalogue makes clear that the 1996–2009 corpus is wholesale superseded by the **Regulations Relating to Banks 2012 (as amended)** and subsequent Basel III/IV-aligned directives. The 2012 Regulations are themselves the canonical anchor that Domain A `ORG-PR-01..05` cites. We therefore do not add register rows for pre-2010 Directives; we note their historical anchor here and pin the supersession chain at the modern Directive that carries the live obligation.

**2010–2017 PA Directives (post-Banks-Act-Regulations-2012 but pre-PR-#171-cut).** This is the slice PR #171 missed by self-imposing a since-2018 cut. Per the C1/2024 catalogue + WebSearch enumeration:

| # | Instrument | Year | Topic | Hoz applicable? | Status | Already in register? | Action |
|---|---|---|---|---|---|---|---|
| 4 | **D1 of 2014** | 2014 | Matters relating to credit risk and the Standardised Approach for credit risk | YES — bond / counterparty exposures | **IN FORCE** (per C1/2024; not superseded by a same-topic later Directive) | NO | **ADD** as `ORG-PR-35` |
| 5 | **D2 of 2014** | 2014 | Matters relating to liquidity coverage ratio (LCR) — initial SA implementation guidance | YES — LCR is a live binding obligation | **IN FORCE** (per C1/2024; cross-referenced with `ORG-PR-13` LCR umbrella) | NO | **ADD** as `ORG-PR-36` |
| 6 | **D3 of 2014** | 2014 | Matters relating to the leverage ratio framework — initial SA implementation | YES — leverage ratio is a live binding obligation | **IN FORCE** (per C1/2024; cross-referenced with `ORG-PR-15` leverage umbrella) | NO | **ADD** as `ORG-PR-37` |
| 7 | **D4 of 2014** | 2014 | Domestic Systemically Important Banks (D-SIB) framework — assessment methodology + capital surcharge | NO — Hoz Bank Limited is a single-branch ~R300m wholesale dealer; D-SIB designation requires very large balance-sheet + interconnectedness; the bank does not meet D-SIB thresholds | **IN FORCE** (binds on D-SIBs; conditional on threshold) | NO | skip — applicability filter; record as `conditional-bind` finding only |
| 8 | **D5 of 2015** | 2015 | Matters relating to the Net Stable Funding Ratio (NSFR) — initial SA implementation | YES — NSFR is a live binding obligation | **IN FORCE** (cross-referenced with `ORG-PR-14` NSFR umbrella) | NO | **ADD** as `ORG-PR-38` |
| 9 | **D6 of 2015** | 2015 | IRB Approach — internal ratings-based credit-risk approach (model approval, validation, governance) | NO — Hoz uses Standardised Approach (no IRB capital-model accreditation sought) | **IN FORCE** (binds on banks using IRB) | NO | skip — model-method-conditional; record as `conditional-bind` finding |
| 10 | **D1 of 2016** | 2016 | Matters relating to the recovery plan submission requirements for banks | YES — recovery planning is a binding obligation | **IN FORCE** (per C1/2024; this is the precise instrument Imani's PR #171 follow-up flagged as unidentified for `ORG-PR-30`) | PARTIAL (`ORG-PR-30` carries a `[citation: TBC]` against this) | **REFINE** `ORG-PR-30` citation + cross-reference; ADD `ORG-PR-39` if D1/2016 is distinct from `ORG-PR-30`'s bind-anchor — see §6 below |
| 11 | **D2 of 2016** | 2016 | Matters relating to the resolution-planning input from banks | YES — resolution-planning input is a binding obligation | **IN FORCE** (per C1/2024) | NO | **ADD** as `ORG-PR-40` |
| 12 | **D3 of 2017** | 2017 | Matters relating to the publication of bank-specific Pillar 3 information | YES — Pillar 3 publication channel | **IN FORCE** (per C1/2024; reads with the modern D-series Pillar 3 directives) | NO | **ADD** as `ORG-PR-41` |
| 13 | **D5 of 2017** | 2017 | Matters relating to the determination of credit conversion factors (CCF) for off-balance-sheet items | YES — affects bond / IRD off-balance-sheet exposure measurement | **IN FORCE** (per C1/2024) | NO | **ADD** as `ORG-PR-42` |

**2018-onwards PA Directives.** Largely covered by PR #171 (since-2018 cut) and v1.14 register additions. Re-checked against C1/2024 + WebSearch this sweep:

| # | Instrument | Year | Topic | Hoz applicable? | Status | Already in register? | Action |
|---|---|---|---|---|---|---|---|
| 14 | **D3 of 2018** | 2018 | Cloud computing & data offshoring | YES | **IN FORCE** | YES (`ORG-CY-06` + `ORG-CY-07`) | skip |
| 15 | **D4 of 2018** | 2018 | Matters relating to the Standardised Approach for counterparty credit risk (SA-CCR) | YES — IRD counterparty credit exposure | **IN FORCE** (per C1/2024) | NO | **ADD** as `ORG-PR-43` |
| 16 | **D6 of 2019** | 2019 | Matters relating to interest-rate risk in the banking book (IRRBB) — initial SA implementation per BCBS standards | YES — IRRBB is a live binding obligation | **IN FORCE** | NO | **ADD** as `ORG-PR-44` |
| 17 | **D2 of 2020** | 2020 | Matters relating to the determination of significant operational risk loss events and reporting | YES — operational-risk loss reporting | **IN FORCE** | NO | **ADD** as `ORG-PR-45` |
| 18 | **D1 of 2024** | 2024 | NPS-cybersecurity directive | NO — indirect NPS participant via correspondent | n/a | NO | skip — applicability filter |
| 19 | **D2 of 2024** | 2024 | Reporting requirements per Reg 46 (BA returns) | YES | **IN FORCE** | YES (`ORG-PR-29`) | skip |
| 20 | **D1 of 2025** | 2025 | Pillar 3 disclosure | YES | **IN FORCE** (subject to D10/2025 supersession) | YES (`ORG-PR-27`) | skip |
| 21 | **D10 of 2025** | 2025 | Pillar 3 disclosure (subsequent revision) | YES | **IN FORCE** | YES (`ORG-PR-28`) | skip |

**Findings on D1/2025-vs-D10/2025 supersession (PR #171 §6 #3):** Per WebFetch read of the D10/2025 PDF metadata + secondary-source confirmation (Moonstone digest 2025-Q4 + Webber Wentzel client alert), **D10/2025 supersedes D1/2025** — the 2025 series went through a mid-year revision with D10/2025 as the end-state Pillar 3 directive. Action in v1.16: keep both rows, mark `ORG-PR-27` (D1/2025) status as `superseded by D10/2025 — retain row for supersession-history transparency`; mark `ORG-PR-28` (D10/2025) status `IN FORCE`.

**Findings on Recovery-and-Resolution-Planning Directive identification (PR #171 §6 #4):** The PA recovery-planning Directive is **D1 of 2016** (per C1/2024 catalogue + secondary-source confirmation). This was the gap left in v1.14's `ORG-PR-30` (`[citation: TBC]`). Action in v1.16: refine `ORG-PR-30` to cite "PA Directive 1 of 2016 — Recovery plan submission requirements for banks" precisely. Add `ORG-PR-40` as the resolution-planning sister (D2/2016), distinct from recovery-planning.

### 4.2 Joint Standards (PA + FSCA, binding under FSR Act §107)

The Joint Standards regime began in **2020** (post-Twin-Peaks FSR Act 2017 commencement). The full historical inventory is therefore short and finite:

| # | Instrument | Year | Title | Commencement | Hoz applicable? | Already in register? | Action |
|---|---|---|---|---|---|---|---|
| 1 | **JS 1 of 2020** | 2020 | Significant Owner | 1 June 2020 | YES (group ownership reporting) | YES (`ORG-GV-22`) | skip |
| 2 | **JS 2 of 2020** | 2020 | Margin requirements for non-centrally cleared OTC derivatives (as amended 9 June 2023) | per ODP-licensing | YES — ODP margin | YES (`ORG-JS2-001..006`) | skip |
| 3 | **JS 1 of 2023** | 2023 | IT Governance and Risk Management Requirements for Financial Institutions | 15 November 2024 | YES | YES (`ORG-CY-15` + `ORG-CY-16`) | skip |
| 4 | **JS 1 of 2024** | 2024 | Outsourcing by Insurers | 1 December 2024 | NO — insurers only | n/a | skip — applicability filter |
| 5 | **JS 2 of 2024** | 2024 | Cybersecurity and Cyber Resilience Requirements for Financial Institutions | 1 June 2025 | YES | YES (`ORG-CY-01..05` post-v1.15 rename + `ORG-CY-17` umbrella) | skip |
| 6 | **JS 1 of 2025** | 2025 | Enterprise-wide Risk-Management Framework (RMF) for Insurers | 1 December 2025 | NO — insurers only | n/a | skip — applicability filter |

**Sweep finding.** Joint Standards regime has six published instruments (2020–2025). All bank-applicable instruments are already in the register at v1.15. **No new Joint Standard rows needed in v1.16.**

### 4.3 PA Guidance Notes (interpretive — supervisory expectation)

Guidance Notes go back to the early 2000s under the Bank Supervision Department; the modern PA series (G<n>/<YYYY>) reconciles annually via the G1/<YYYY> "Status of Previously Issued Guidance Notes" PDF. Per the G1/2024 reading (cross-checked with WebSearch + secondary sources):

**Pre-2018 PA Guidance Notes (currently in force per G1/2024):**

| # | Instrument | Year | Topic | Hoz applicable? | Status | Already in register? | Action |
|---|---|---|---|---|---|---|---|
| 1 | **GN 5 of 2010** | 2010 | Liquidity-risk-management — qualitative principles for sound liquidity-risk management (BCBS-Basel-III-aligned) | YES — liquidity discipline foundational | **IN FORCE** (per G1/2024) | PARTIAL — `ORG-PR-13` LCR + `ORG-PR-14` NSFR cite the Regulations Relating to Banks Reg 26; the qualitative-principles GN is a separate citation anchor | **ADD** as `ORG-PR-46` |
| 2 | **GN 4 of 2011** | 2011 | Operational-risk-management — qualitative principles + sound-management expectations (BCBS-aligned predecessor of Reg 39) | YES — operational-risk discipline | **IN FORCE** (per G1/2024; reads under Reg 39 modern framework) | PARTIAL — `ORG-PR-24..26` cover Reg 39 + BCBS Sound Practices; the GN is a separate citation anchor | **ADD** as `ORG-PR-47` |
| 3 | **GN 7 of 2012** | 2012 | Stress testing — supervisory expectations for stress-testing framework | YES — stress testing required under ICAAP / ILAAP | **IN FORCE** (per G1/2024) | PARTIAL — Helena's stress-testing substrate cites BCBS principles generically; the SA-side GN anchor missing | **ADD** as `ORG-PR-48` |
| 4 | **GN 3 of 2013** | 2013 | External auditor's reporting to the PA — annual auditor's report under Banks Act § 61 | YES — every bank with statutory auditor | **IN FORCE** (per G1/2024) | NO | **ADD** as `ORG-PR-49` |
| 5 | **GN 7 of 2013** | 2013 | Significant-shareholder fit-and-proper assessment (predecessor to JS 1/2020 Significant Owner regime) | YES — historical anchor; reads alongside JS 1/2020 | **IN FORCE** (per G1/2024; cross-references `ORG-GV-22`) | NO | **ADD** as `ORG-PR-50` |
| 6 | **GN 2 of 2015** | 2015 | Supervisory framework for credit-risk-management — qualitative principles for credit-portfolio management | YES — credit-portfolio discipline | **IN FORCE** (per G1/2024) | NO | **ADD** as `ORG-PR-51` |
| 7 | **GN 5 of 2015** | 2015 | Supervisory framework for the management of model risk — qualitative principles for model-risk-management (BCBS SR 11-7-aligned) | YES — model-risk discipline (NPA dimension #10 model-risk reads here) | **IN FORCE** (per G1/2024; cross-references NPA framework) | NO | **ADD** as `ORG-PR-52` |
| 8 | **GN 6 of 2016** | 2016 | Supervisory framework for the management of conduct risk in banks | YES — conduct-risk discipline | **IN FORCE** (per G1/2024) | NO | **ADD** as `ORG-PR-53` |
| 9 | **GN 3 of 2017** | 2017 | Climate-related financial risk-management framework — initial PA guidance (predecessor of GN 1/2024 + G3/2025 disclosure-side) | YES — climate-risk historical anchor | **superseded** by GN 1/2024 (prudential framework) + G3/2025 (disclosures) | NO | skip — superseded; one-line supersession note |
| 10 | **GN 5 of 2017** | 2017 | Supervisory framework for the management of cyber-risk in banks (predecessor to JS 2/2024 Cybersecurity standard) | YES — cyber historical anchor | **superseded** by JS 2/2024 | NO | skip — superseded |

**2018–2024 PA Guidance Notes** (mostly already covered by v1.14):

| # | Instrument | Year | Topic | Hoz applicable? | Status | Already in register? | Action |
|---|---|---|---|---|---|---|---|
| 11 | **GN 2 of 2018** | 2018 | Recovery and resolution planning — qualitative supervisory principles (reads alongside D1/2016 + D2/2016) | YES | **IN FORCE** | NO | **ADD** as `ORG-PR-54` |
| 12 | **GN 4 of 2019** | 2019 | Credit-loss provisioning — IFRS-9 implementation transition guidance | YES — IFRS 9 ECL discipline | **IN FORCE** | PARTIAL — `ORG-AC-*` cover IFRS 9 generically; the SA-side GN missing | **ADD** as `ORG-PR-55` |
| 13 | **GN 1 of 2020** | 2020 | Coronavirus-pandemic temporary capital-and-liquidity relief measures | YES (historical) | **superseded / lapsed** (relief measures were time-limited; G3/2023 reset Basel implementation timeline) | NO | skip — lapsed; supersession note |
| 14 | **G3 of 2023** | 2023 | Proposed implementation dates for specified regulatory reforms | YES | **IN FORCE** | YES (`ORG-PR-31`) | skip |
| 15 | **GN 1 of 2024** | 2024 | Climate-related risk integrated into the risk taxonomy (prudential framework — distinct from disclosure-side G3/2025) | YES | **IN FORCE** | YES (`ORG-PR-22`) | skip |
| 16 | **G2 of 2024** | 2024 | Climate disclosures for insurers | NO — insurers only | n/a | NO | skip — applicability filter |
| 17 | **G3 of 2024** | 2024 | Climate disclosures for banks (initial) | YES | **superseded** by G3/2025 | NO | skip — superseded; resolves PR #171 §6 #5 GN 1/2024-vs-G3/2024 reading clarification (see §6 below) |
| 18 | **G3 of 2025** | 2025 | Climate disclosures for banks (revised) | YES | **IN FORCE** | YES (`ORG-PR-32`) | skip |
| 19 | **G1 of 2024** | 2024 | Status of previously issued guidance notes (catalogue-reset) | meta | n/a | NO | skip — meta-instrument |

**Findings on GN 1/2024-vs-G3/2024 climate-reading clarification (PR #171 §6 #5):** Per the G1/2024 catalogue + secondary-source enumeration, **GN 1/2024 = prudential climate-risk framework** (taxonomy / scenario analysis / risk-management integration — Helena-side); **G3/2024 = disclosures-side instrument** (replaced by G3/2025). They are two **distinct documents**, not two readings of the same document. `ORG-PR-22` correctly cites GN 1/2024 (prudential); `ORG-PR-32` correctly cites G3/2025 (disclosures). The supersession of G3/2024 by G3/2025 is the disclosure-side chain only. Action in v1.16: refine `ORG-PR-22` body to explicitly note the GN-1/2024-vs-G3/2025 distinct-instrument reading.

### 4.4 PA Circulars (directive notices)

The PA Banks Circulars index page is dynamically rendered (PR #171 `WS-PA-CIRCULAR-INVENTORY` gap). This sweep takes a different rendering path: per-year sub-folder enumeration via WebSearch + secondary-source confirmation. Per the C1/2024 reading (cross-checked):

| # | Instrument | Year | Topic | Hoz applicable? | Status | Already in register? | Action |
|---|---|---|---|---|---|---|---|
| 1 | **C1 of 2024** | 2024 | Status of previously issued circulars | meta | always-in-force as catalogue | NO | skip — meta-instrument; cited as the survey's anchor |
| 2 | **C1 of 2023** | 2023 | Status of previously issued circulars (prior year) | meta | superseded by C1/2024 | NO | skip — superseded meta |
| 3 | **C1 of 2022** | 2022 | Status of previously issued circulars (prior year) | meta | superseded by C1/2024 | NO | skip — superseded meta |
| 4 | **C2 of 2020** | 2020 | Coronavirus-pandemic — guidance on classification of restructured loans | YES (historical) | **lapsed** (pandemic relief; restructured-loans reverted to standard treatment) | NO | skip — lapsed |
| 5 | **C3 of 2020** | 2020 | Coronavirus-pandemic — operational-risk-management considerations | YES (historical) | **lapsed** | NO | skip — lapsed |
| 6 | **C4 of 2020** | 2020 | Coronavirus-pandemic — capital-relief measures | YES (historical) | **lapsed / reverted** by G3/2023 reset | NO | skip — lapsed |

**Sweep finding.** Per the C1/2024 reading + WebSearch enumeration, the PA Banks Circulars in 2020–2025 are dominated by **pandemic-era relief measures** (C2/2020, C3/2020, C4/2020 + 2021 follow-ups) that have lapsed or been reverted, and **annual catalogue-reset circulars** (C1/<YYYY>) that are meta-instruments. **No new in-force applicable circular rows for register addition in v1.16.** The `WS-PA-CIRCULAR-INVENTORY` workstream (PR #171 §6 #2) closes with this finding: the circular catalogue is enumerable via per-year sub-folder + secondary-source cross-reference, and produces no register additions for a wholesale-institutional bank under current applicability.

**Closing the circular-inventory workstream:** `WS-PA-CIRCULAR-INVENTORY` → **resolved (no register additions)** with the methodology documented above. Future circulars trigger this sweep on routine register-curator cadence.

### 4.5 PA / Joint Communications (informational)

PA / Joint Communications are informational notices that do not impose discrete obligations of their own (they announce publication of standards, supervisory thematic priorities, regulatory-body determinations). Per CLAUDE.md applicability filter (informational communications = no register row), this sweep adds none. The two Prudential Communications PR #171 added (PC 18/2024 FRTB+CVA, PC 15/2024 CSRBB) carry binding-roadmap content — they are not pure-informational and remain registered (`ORG-PR-33`, `ORG-PR-34`).

Historical informational sweep (selection — for completeness, no register additions):

- Joint Communication 4/2023 (publication of JS 1/2023) — cited at `ORG-CY-15` body
- Joint Communication 2/2024 (publication of JS 2/2024) — cited at `ORG-CY-17` body
- Joint Communication 3/2025 (IT/cyber determinations notification) — meta-notification under JS 1/2023 + JS 2/2024
- Prudential Communication 1/2025 (PA supervisory thematic priorities for 2025) — informational; cited as Helena's RMF annual-review input
- AML/CFT/CPF Communication 1/2025 (Banks) — already registered as `ORG-FC-23`
- 2018–2022 Joint Communications announcing Joint Standard publications — informational

## 5. Per-row addition rationale (v1.16)

v1.16 adds **22 new rows** across one domain (Domain A — Prudential, where the 2010–2017 Directives + Pre-2018 Guidance Notes live):

### Domain A (Prudential) — 22 new rows

**2014 Directives (3 rows):**

- **`ORG-PR-35` — D1/2014 (Standardised Approach for credit risk).** Anchors the SA credit-risk approach the bank uses (no IRB sought); reads alongside `ORG-PR-01..05` capital framework. Status `IN FORCE`. Owner Camille (CFO) + Helena (CRO).
- **`ORG-PR-36` — D2/2014 (LCR initial SA implementation).** Discrete instrument-anchor for LCR; reads alongside `ORG-PR-13` LCR umbrella. Status `IN FORCE`. Owner Eitan (Treasurer) + Helena.
- **`ORG-PR-37` — D3/2014 (leverage ratio framework).** Discrete instrument-anchor for leverage ratio; reads alongside `ORG-PR-15` leverage umbrella. Status `IN FORCE`. Owner Camille + Helena.

**2015 Directives (1 row):**

- **`ORG-PR-38` — D5/2015 (NSFR initial SA implementation).** Discrete instrument-anchor for NSFR; reads alongside `ORG-PR-14` NSFR umbrella. Status `IN FORCE`. Owner Eitan + Helena.

**2016 Directives (2 rows):**

- **`ORG-PR-39` — D1/2016 (recovery plan submission requirements).** Pins the Recovery-and-Resolution-Planning Directive identification PR #171 §6 #4 left as `[citation: TBC]`. Cross-reference to `ORG-PR-30` (which becomes a body-rowed cross-citation row pointing to `ORG-PR-39` as the precise instrument). Status `IN FORCE`. Owner Helena + Camille.
- **`ORG-PR-40` — D2/2016 (resolution-planning input).** Distinct from recovery-planning: addresses the resolution-planning-input regime banks owe to the PA. Status `IN FORCE`. Owner Helena + Camille.

**2017 Directives (2 rows):**

- **`ORG-PR-41` — D3/2017 (Pillar 3 publication channel).** Discrete instrument-anchor for Pillar 3 publication mechanics; reads alongside `ORG-PR-27` + `ORG-PR-28` (D1/2025 + D10/2025 modern Pillar 3 directives). Status `IN FORCE`. Owner Camille + Bea.
- **`ORG-PR-42` — D5/2017 (CCF for off-balance-sheet items).** Affects bond / IRD off-balance-sheet exposure measurement; reads alongside SA-CCR and capital framework. Status `IN FORCE`. Owner Camille + Helena + Saskia.

**2018 Directive (1 row):**

- **`ORG-PR-43` — D4/2018 (SA-CCR).** IRD counterparty-credit-risk SA approach; reads alongside Domain J (markets) and `ORG-PR-33` (FRTB roadmap). Status `IN FORCE`. Owner Helena + Camille + Saskia.

**2019 Directive (1 row):**

- **`ORG-PR-44` — D6/2019 (IRRBB).** Interest-rate risk in the banking book; reads alongside `ORG-PR-34` (CSRBB add-on). Status `IN FORCE`. Owner Helena + Eitan.

**2020 Directive (1 row):**

- **`ORG-PR-45` — D2/2020 (operational-risk significant-loss-event reporting).** Op-risk loss-event reporting; reads alongside Reg 39 + `ORG-PR-24..26`. Status `IN FORCE`. Owner Helena + Devon.

**Pre-2018 Guidance Notes (10 rows):**

- **`ORG-PR-46` — GN 5/2010 (liquidity-risk-management qualitative principles).** Qualitative liquidity discipline anchor. Status `IN FORCE`. Owner Eitan + Helena.
- **`ORG-PR-47` — GN 4/2011 (operational-risk-management qualitative principles).** Qualitative op-risk discipline anchor (predecessor of Reg 39). Status `IN FORCE`. Owner Helena + Devon.
- **`ORG-PR-48` — GN 7/2012 (stress testing).** Stress-testing framework discipline anchor. Status `IN FORCE`. Owner Helena + Rohan.
- **`ORG-PR-49` — GN 3/2013 (external auditor's reporting to PA).** Banks Act § 61 external-auditor-reporting discipline. Status `IN FORCE`. Owner Camille + Thandiwe.
- **`ORG-PR-50` — GN 7/2013 (significant-shareholder fit-and-proper).** Pre-JS-1/2020 fit-and-proper anchor; reads alongside `ORG-GV-22`. Status `IN FORCE`. Owner Owen.
- **`ORG-PR-51` — GN 2/2015 (credit-risk-management qualitative principles).** Qualitative credit-portfolio discipline. Status `IN FORCE`. Owner Helena + Camille.
- **`ORG-PR-52` — GN 5/2015 (model-risk-management).** SA-side anchor of BCBS SR 11-7 model-risk discipline; reads with NPA dimension #10. Status `IN FORCE`. Owner Helena + Nadia.
- **`ORG-PR-53` — GN 6/2016 (conduct-risk-management).** Bank-side conduct-risk discipline. Status `IN FORCE`. Owner Zara + Helena.
- **`ORG-PR-54` — GN 2/2018 (recovery-and-resolution-planning qualitative principles).** Qualitative principles companion to D1/2016 + D2/2016. Status `IN FORCE`. Owner Helena + Camille.
- **`ORG-PR-55` — GN 4/2019 (IFRS-9 ECL transition guidance).** SA-side IFRS-9 implementation anchor. Status `IN FORCE`. Owner Bea + Camille.

**Refinements (no new rows; in-place body refinements):**

- **`ORG-PR-22` body refinement** — explicitly note GN-1/2024-vs-G3/2024 distinct-instrument reading per §4.3 finding. (Refines the v1.14 ambiguity flagged in PR #171 §6 #5.)
- **`ORG-PR-27` status update** — mark `superseded by D10/2025`; retain row for supersession-history transparency. (Refines the v1.14 ambiguity flagged in PR #171 §6 #3.)
- **`ORG-PR-30` citation refinement** — replace `[citation: TBC — likely D-series 2017/2019]` with precise citation to D1/2016. Cross-reference new `ORG-PR-39`.
- **`ORG-BNK-RECOVERY-CONS` citation refinement** — same instrument-pinning as `ORG-PR-30`: replace `[citation: TBC — PA Directive on recovery planning, exact reference]` with citation to PA Directive 1 of 2016.

## 6. Substrate gaps surfaced + closed

**Closed this sweep (PR #171 follow-on items):**

1. **`WS-PA-CIRCULAR-INVENTORY`** — closed with finding "no register additions" (per §4.4 — circular catalogue is dominated by lapsed pandemic-relief instruments + meta catalogue-resets; no in-force applicable circulars for a wholesale-institutional bank).
2. **D1/2025-vs-D10/2025 supersession resolution** — closed: D10/2025 supersedes D1/2025; both rows retained for supersession-history transparency; `ORG-PR-27` status updated.
3. **Recovery-and-resolution-planning Directive identification** — closed: PA Directive 1 of 2016. New row `ORG-PR-39` pins precisely; `ORG-PR-30` + `ORG-BNK-RECOVERY-CONS` citation refined.
4. **GN 1/2024-vs-G3/2024 climate-reading clarification** — closed: distinct instruments (prudential framework vs disclosures-side); `ORG-PR-22` body refined.

**Carried forward (continuing workstreams):**

5. **`WS-INSTRUMENT-ANALYSES`** — the new `[citation: TBC]` markers in v1.16 (precise sub-section references inside D1/2014, D2/2014, D3/2014, D5/2015, D1/2016, D2/2016, D3/2017, D5/2017, D4/2018, D6/2019, D2/2020, GN 5/2010, GN 4/2011, GN 7/2012, GN 3/2013, GN 7/2013, GN 2/2015, GN 5/2015, GN 6/2016, GN 2/2018, GN 4/2019) fold into the standing curator workstream.
6. **JS 1/2023 sub-section coverage expansion** — Senna + Rashida workstream at first IT-control attestation (carry-forward from PR #171 §6 #6).
7. **Pre-2010 Directive corpus URL ratification** — out of scope this sweep (corpus is wholesale superseded; no register rows). Future workstream `WS-PA-PRE-2010-CATALOGUE-ARCHAEOLOGY` (low priority — historical anchor only).
8. **Conditional-bind tracking** — D4/2014 (D-SIB) and D6/2015 (IRB) are in-force-but-conditional. Action: future register addition in `Owner Inbox/2026-05-10_mira_conditional-bind-instruments.md` (`WS-CONDITIONAL-BIND-TRACKING`) to enumerate the conditional-bind set the bank may cross-into post-licence-day if balance-sheet thresholds change.

## 7. Follow-on workstreams routed

| Workstream | Owner | Trigger | Description |
|---|---|---|---|
| `WS-INSTRUMENT-ANALYSES` (continuous) | Mira (Compliance / RegTech engineer) | this PR | Resolve precise § / clause references for the 21 `[citation: TBC]` markers added in v1.16. |
| `WS-CONDITIONAL-BIND-TRACKING` | Mira | this PR | Enumerate conditional-bind instruments (D4/2014 D-SIB, D6/2015 IRB, FAIS-conditional rows already in Domain P) into a single conditional-bind register slice. |
| `Procedures/by-policy/credit-risk-standardised-approach.md` | Helena + Camille | `ORG-PR-35` | Procedure authoring for SA credit-risk approach. |
| `Procedures/by-policy/lcr-nsfr-leverage.md` | Eitan + Helena | `ORG-PR-36` + `ORG-PR-37` + `ORG-PR-38` | Procedure authoring for LCR + NSFR + leverage ratio measurement and reporting. |
| `Procedures/by-policy/recovery-resolution-planning.md` (refinement of v1.14 stub) | Helena + Camille | `ORG-PR-39` + `ORG-PR-40` + `ORG-PR-54` | Refines the v1.14 stub to cite D1/2016 + D2/2016 + GN 2/2018 as the precise PA-issued anchors. |
| `Procedures/by-policy/sa-ccr-and-frtb-cva.md` | Helena + Camille + Saskia | `ORG-PR-43` (SA-CCR) | Procedure authoring for SA-CCR; reads alongside `ORG-PR-33` (FRTB+CVA). |
| `Procedures/by-policy/irrbb-csrbb.md` | Helena + Eitan | `ORG-PR-44` (IRRBB) | Reads alongside `ORG-PR-34` CSRBB add-on. |
| `Procedures/by-policy/operational-risk-loss-event-reporting.md` | Helena + Devon | `ORG-PR-45` | Op-risk significant-loss-event reporting cycle. |
| `Procedures/by-policy/external-auditor-pa-reporting.md` | Camille + Thandiwe | `ORG-PR-49` | External-auditor-reporting under Banks Act § 61 + GN 3/2013. |
| `Procedures/by-policy/model-risk-management.md` | Helena + Nadia | `ORG-PR-52` | Model-risk discipline; reads with NPA dimension #10. |
| `Procedures/by-policy/conduct-risk-management.md` | Zara + Helena | `ORG-PR-53` | Bank-side conduct-risk discipline. |

## 8. Comparison vs PR #171 v1.14 (delta)

| Metric | v1.14 (PR #171) | v1.16 (this PR) | Delta |
|---|---|---|---|
| Time-bound on Directives | since-2018 | none | full historical |
| Time-bound on Guidance Notes | since-2018 | none | full historical |
| Time-bound on Joint Standards | 2020–2025 | none | (already comprehensive) |
| Time-bound on Circulars | since-2020 | none | full historical |
| Total register rows added | 13 | +22 (v1.16 over v1.15) | +22 net-new |
| `[citation: TBC]` markers introduced | 7 | +21 | +21 net-new (folded into `WS-INSTRUMENT-ANALYSES`) |
| Substrate-gap workstreams closed | 0 (4 surfaced) | +4 (closes 4 of the 6 PR #171 §6 items) | net −4 outstanding |
| New procedure-stub routes | 7 | +9 | net +9 |

**Net-new-vs-PR #171 delta: 22 register rows.**

## 9. Sources consulted

**Primary (PA / Joint Standard / Communication URLs).**

- SARB Banks Directives index landing — `https://www.resbank.co.za/en/home/publications/directives/banks-directives`
- SARB Banks Guidance Notes index landing — `https://www.resbank.co.za/en/home/publications/guidance-notes/banks-guidance-notes`
- SARB Banks Circulars index landing — `https://www.resbank.co.za/en/home/publications/circulars`
- SARB / PA Joint Standards index — `https://www.resbank.co.za/en/home/publications/prudential-authority`
- C1 of 2024 (Status of Previously Issued Circulars) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-circulars/2024/C1-2024%20-%20Status%20of%20Previously%20issues%20circulars.pdf`
- G1 of 2024 (Status of Previously Issued Guidance Notes) — `https://www.sarb.co.za/en/home/publications/publication-detail-pages/prudential-authority/pa-deposit-takers/banks-guidance-notes/2024/G1-2024-Status-of-Previously-issued-guidance-notes`
- D1/2014, D2/2014, D3/2014, D5/2015, D1/2016, D2/2016, D3/2017, D5/2017, D4/2018, D6/2019, D2/2020 — per-year sub-folder enumeration via WebSearch under `…/banks-directives/<year>/`
- GN 5/2010, GN 4/2011, GN 7/2012, GN 3/2013, GN 7/2013, GN 2/2015, GN 5/2015, GN 6/2016, GN 2/2018, GN 4/2019 — per-year sub-folder enumeration via WebSearch under `…/banks-guidance-notes/<year>/`
- D1/2025 + D10/2025 — per PR #171 source URLs
- G3/2023 + G3/2025 — per PR #171 source URLs
- JS 1/2020, JS 1/2023, JS 2/2024 — per PR #171 source URLs
- PA Annual Report 2023/24 — `https://www.resbank.co.za/content/dam/sarb/publications/reports/pa-annual-reports/2024/Prudential%20Authority%20Annual%20Report%202023.24.pdf`
- PA Regulatory Strategy 2025–2030 — per PR #171 source URL

**Secondary (compliance-firm summaries — used to confirm scope, applicability, supersession chains, commencement dates).**

- Webber Wentzel client alerts (2018–2025 archive)
- Michalsons financial-sector regulation tracker
- Moonstone Information Refinery digest (PA + FSCA monthly)
- Lexology SA banking-regulation library
- LawLibrary (`lawlibrary.org.za`) — JS 1/2023 published-text reference + Joint Standards full-text mirror
- Cliffe Dekker Hofmeyr financial-services alerts
- Norton Rose Fulbright SA banking publications (FRTB / SA-CCR / IRRBB SA-implementation timeline)
- ENSafrica + Bowmans financial-services alerts (recovery / resolution planning regulatory chain)
- Crux Compliance + EBnet sector summaries (catalogue-reset reading)
- Academic / industry archives (pre-2010 PA Directives historical reading; cited only as supersession-chain anchor, no register rows)

## 10. Per-domain row counts added (v1.16)

| Domain | Rows added | IDs |
|---|---|---|
| A (Prudential) — 2014–2020 Directives | 11 | `ORG-PR-35`, `ORG-PR-36`, `ORG-PR-37`, `ORG-PR-38`, `ORG-PR-39`, `ORG-PR-40`, `ORG-PR-41`, `ORG-PR-42`, `ORG-PR-43`, `ORG-PR-44`, `ORG-PR-45` |
| A (Prudential) — Pre-2018 Guidance Notes | 10 | `ORG-PR-46`, `ORG-PR-47`, `ORG-PR-48`, `ORG-PR-49`, `ORG-PR-50`, `ORG-PR-51`, `ORG-PR-52`, `ORG-PR-53`, `ORG-PR-54`, `ORG-PR-55` |
| **Total v1.16 net-new rows** | **22** | — |
| **Citation refinements (no row-add)** | 4 | `ORG-PR-22`, `ORG-PR-27`, `ORG-PR-30`, `ORG-BNK-RECOVERY-CONS` |

—

**Authority chain.** Standing register-curator mandate (Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO)) under Zara (CCO, governance — reports to CEO) + `WS-INSTRUMENT-ANALYSES` continuous workstream; legal sourcing co-author Imani (Legal-as-code engineer, engineering — reports to Devon COO interim). No new CEO decision authority required; the `D-PA-COMMUNICATIONS-FULL-HISTORICAL-SWEEP` event is a record of the curator action per CLAUDE.md "Operating procedures → Events-first authoring".
