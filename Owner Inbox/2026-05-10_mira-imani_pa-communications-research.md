---
title: PA communications survey + obligations-register v1.14 expansion
author: Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; obligations-register curator), Imani (Legal-as-code engineer, engineering — reports to Devon COO interim)
date: 2026-05-10
summary: Web survey of SARB Prudential Authority Directives, Joint Standards (PA + FSCA), Guidance Notes, Circulars and ad-hoc Prudential / Joint Communications applicable to a wholesale-institutional global-markets bank; new obligations rows added to the register at v1.14.
decision-required: false
---

# PA communications research — Mira + Imani — 2026-05-10

## 1. Authority

Standing register-curator mandate (Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; curator) under Zara (Chief Compliance Officer, governance — reports to CEO)) + `WS-INSTRUMENT-ANALYSES` continuous workstream. Legal sourcing co-author Imani (Legal-as-code engineer, engineering — reports to Devon COO interim). No new CEO decision required (per CLAUDE.md "Operating procedures" — register additions are register-curator scope; downstream policy authoring routes to Zara / Helena / Camille as named below).

The CeoDecision event `D-PA-COMMUNICATIONS-REGISTER-UPDATE` (action `approve`, recordedVia `script:record-d-pa-communications-register-update`) is emitted as a contemporaneous **record** of the register update, not as a new authorisation — per CLAUDE.md "Operating procedures → Events-first authoring" and the events-first rule that every register / curator action lands as a typed event first.

## 2. Survey methodology

**Sources searched.** WebSearch + WebFetch against:

- SARB / Prudential Authority publications portal (`resbank.co.za/en/home/publications/prudential-authority`).
- SARB Banks Directives index (`resbank.co.za/en/home/publications/directives/banks-directives`).
- SARB Banks Guidance Notes index (`resbank.co.za/en/home/publications/guidance-notes/banks-guidance-notes`).
- SARB Banks Circulars index (`resbank.co.za/en/home/publications/circulars`).
- SARB Joint Communications + Prudential Communications inventory (under `pa-public-awareness/covid-19-response/<year>/`).
- FSCA Standards index (`fsca.co.za/Regulatory Frameworks/Pages/Standards.aspx` — page returned 404; cross-referenced via secondary sources Webber Wentzel, Michalsons, Moonstone, EBnet, Crux Compliance, Lexology, and the published Joint Standards themselves).
- The PA Annual Report 2024/25 + PA Regulatory Strategy 2025–2030 to confirm the inventory of currently-in-force communications.
- The two annual "Status of previously issued circulars" / "Status of previously issued guidance notes" PDFs (C1/2024, G1/2024) as the PA's own canonical inventory.

**Date range.** Directives — every applicable instrument currently in force (no time-cap; PA Directive register goes back to 1996 but the register slice we curate is `since 2018` for Directives, since the older instruments are overwhelmingly superseded). Joint Standards — every PA + FSCA Joint Standard issued (2020–2025; six instruments total). Guidance Notes — 2018-onwards (~7 years). Circulars — 2020-onwards (~5 years). Per-category counts and applicability filtering follow in §4.

**Reading limitations.** The SARB website's index pages are dynamically rendered by JavaScript; WebFetch returns the HTML shell + a "search service technically unavailable" notice rather than the document list. The C1/2024 + G1/2024 PDFs ("Status of Previously issued circulars / guidance notes") were not text-extractable through WebFetch (returned binary PDF chrome). The survey therefore reconciles WebSearch results, secondary-source compliance-firm summaries (Webber Wentzel, Michalsons, Moonstone, Lexology), the PA Annual Report 2024/25, and the publicly-cited document URLs against each other; per-document section / clause references are pinned where the source quotes them, otherwise carry `[citation: TBC — pending Imani / external counsel ratification]` per Principle 2 (citation discipline) and the convention established at v1.6.

## 3. Per-category survey

### 3.1 PA Directives (binding instruments under Banks Act § 6(6))

| # | Instrument | Year | Topic | Applicable to wholesale bank? | Already in register? | Action |
|---|---|---|---|---|---|---|
| 1 | **D1 of 2025** | 2025 | Pillar 3 disclosure requirements — supersedes D9 of 2025 (the previous Pillar 3 directive) | YES — Pillar 3 binds every bank (Banks Act + BCBS standardised) | NO (Pillar 3 obligations exist in Domain A umbrella; instrument-specific row missing) | **ADD** as `ORG-PR-27` |
| 2 | **D10 of 2025** | 2025 | Pillar 3 disclosure requirements (subsequent revision per the published PDF; supersedes D1/2025 — the v1.13 register reading must reconcile to "current Pillar 3 directive = D10/2025" once the supersession chain is fully sourced) `[citation: TBC — Imani confirm whether D1/2025 is in force or already superseded by D10/2025]` | YES | NO | **ADD** as `ORG-PR-28` (separate row from `ORG-PR-27` to track supersession history; status `IN FORCE` with a `supersedes: D9/2025` cross-reference; will collapse to a single row once Imani ratifies the supersession chain) |
| 3 | **D2 of 2024** | 2024 | Reporting requirements in terms of Regulation 46 (BA returns) | YES — every BA-return filing | NO (BA returns referenced in Domain L but no instrument-specific row) | **ADD** as `ORG-PR-29` |
| 4 | **PA Directive 3 of 2018** | 2018 | Cloud computing & data offshoring | YES | YES (`ORG-CY-06` + `ORG-CY-07`) | skip — already registered |
| 5 | **PA Directive on recovery & resolution planning** | TBC year | Recovery plan obligations for banks | YES | PARTIAL — `ORG-BNK-RECOVERY-CONS` references "PA recovery-and-resolution-planning guidance `[citation: TBC]`" but no dedicated row for the PA-issued directive itself | **ADD** as `ORG-PR-30` with `[citation: TBC — Imani identify the specific PA Directive number, likely D-series 2017 / 2019]` |

**Outside scope (not added):** D1/2024 (cybersecurity within national payment system) — bank is an indirect NPS participant via correspondent (`project_indirect_participant_posture.md`); the NPS-cybersecurity directive binds on direct participants and is therefore look-through via the correspondent's compliance, not a direct obligation on `Hoz Bank Limited`. D2/2024 NPS EFT directives — same logic. PA Directives applicable to mutual / co-operative banks only — out of scope (different licence type).

### 3.2 Joint Standards (PA + FSCA, binding under FSR Act §107)

| # | Instrument | Year | Title | Commencement | Applicable to wholesale bank? | Already in register? | Action |
|---|---|---|---|---|---|---|---|
| 1 | **JS 1 of 2020** | 2020 | Significant Owner | 1 June 2020 | YES (group ownership reporting) | NO | **ADD** as `ORG-CS-JS1` (Domain JS — joint-standards prefix; or `ORG-JS1-001` parallel to `ORG-JS2-001..006` pattern) |
| 2 | **JS 2 of 2020** | 2020 | Margin requirements for non-centrally cleared OTC derivatives | per ODP-licensing | YES — ODP-margin | YES (`ORG-JS2-001..006`) | skip |
| 3 | **JS 1 of 2023** | 2023 | IT Governance and Risk Management Requirements for Financial Institutions | 15 November 2024 | YES — banks explicit in scope | NO | **ADD** as `ORG-CY-08` + `ORG-CY-09` (governance + risk-management split; the standard itself runs to ~30 sections — two umbrella rows now, fine-grain expansion at first IT-control attestation under Senna+Rashida) |
| 4 | **JS 1 of 2024** | 2024 | Outsourcing by Insurers | 1 December 2024 | NO — insurers only (the standard's title and §1 scope explicitly limit it to insurers) | not applicable | skip — note the title-collision with the bank's existing `JS 1 of 2024` reading at `ORG-CY-01..05` (which our register actually cites for the **cybersecurity** standard — see correction note in §6 below) |
| 5 | **JS 2 of 2024** | 2024 | Cybersecurity and Cyber Resilience Requirements for Financial Institutions | 1 June 2025 | YES — banks explicit in scope | PARTIAL — register currently cites "Joint Standard 1 of 2024" against `ORG-CY-01..05` and `ORG-BNK-CYBER-CONS`. Per the survey, the cybersecurity Joint Standard is **JS 2 of 2024 (commenced 1 June 2025)**, not JS 1 of 2024 (which is Outsourcing by Insurers). The mis-citation is a long-standing register error — see §6 "Substrate gaps" and the v1.14 banner. | **ADD** as `ORG-CY-10` (the standard binds in its own right with explicit governance/IR/third-party/resilience-testing sub-sections; rather than re-thread `ORG-CY-01..05` mid-flight in this PR, we land a new `ORG-CY-10` umbrella row pinning JS 2 of 2024 correctly, mark the existing `ORG-CY-01..05` rows with a Vera follow-on `WS-JS-NUMBER-RECONCILIATION` finding, and let a future single-purpose PR rename the citation. This avoids touching ~15 rows in a survey-PR.) |

**Outside scope (not added):** Insurance-only Joint Standards (significant-owner-of-insurer if a separate one exists; insurer outsourcing JS 1/2024). Joint Communications (informational notices announcing publication of standards — the standard itself is the binding instrument).

### 3.3 PA Guidance Notes (interpretive — not strictly binding but supervisory expectation)

| # | Instrument | Year | Topic | Applicable to wholesale bank? | Already in register? | Action |
|---|---|---|---|---|---|---|
| 1 | **G1/2024** | 2024 | Status of Previously issued guidance notes | meta-instrument | YES (always in force) | NO | skip — meta-document, no obligation per se; tracked as a citation source |
| 2 | **G3/2023** | 2023 | Proposed implementation dates in respect of specified regulatory reforms | YES — Basel implementation roadmap | NO | **ADD** as `ORG-PR-31` (Basel implementation-date reference; cross-references existing capital/liquidity rows) |
| 3 | **G4/2022** | 2022 | Revised Basel Implementation Dates | YES | NO | skip — superseded by G3/2023 |
| 4 | **G2/2024** | 2024 | Climate-related disclosures for insurers (replaced) | NO — insurer-side; banks-side is G3/2024 | not applicable | skip |
| 5 | **G3/2024** | 2024 | Climate-related disclosures for banks (replaced by G3/2025) | YES — but superseded | PARTIAL — Domain A `ORG-PR-22` exists for "PA Guidance Note 1 of 2024 — Climate-related risk integrated into the risk taxonomy", which appears to be the original prudential framework GN; the disclosure-side instrument is separate and was G3/2024 → G3/2025 | skip — superseded; see G3/2025 |
| 6 | **G3/2025** | 2025 | Climate Disclosures for banks — supersedes G3/2024 + G2/2024; framework across four pillars (governance, strategy, risk-mgmt, metrics-and-targets) | YES — direct supervisory expectation on `Hoz Bank Limited` for climate-related disclosures aligned with IFRS standards | NO | **ADD** as `ORG-PR-32` |

**Outside scope (not added):** Mutual-bank guidance notes; insurer guidance notes; G2/2024 (insurer climate disclosures).

### 3.4 PA Circulars (directive notices)

| # | Instrument | Year | Topic | Applicable to wholesale bank? | Already in register? | Action |
|---|---|---|---|---|---|---|
| 1 | **C1/2024** | 2024 | Status of Previously issued circulars | meta-instrument | YES | NO | skip — meta-document |
| 2 | **C1/2023** | 2023 | Status of previously issued circulars (prior year version) | meta-instrument | YES | NO | skip — superseded by C1/2024 |

**Survey gap.** The SARB Banks Circulars index page is dynamically rendered and returned no document list via WebFetch. WebSearch surfaced only the meta "Status of previously issued circulars" PDFs (annual reconciliation circulars). To enumerate the 2020–2025 circular catalogue, Imani's follow-on work (`WS-PA-CIRCULAR-INVENTORY`) needs either (a) a manual scrape via a different rendering path or (b) extraction from the C1/2024 PDF body text (which WebFetch could not extract — the binary returned without text-layer parsing). **No circular rows added in v1.14**; the survey-gap is a finding, not a register row.

### 3.5 PA / Joint Communications (informational, but referencing binding obligations)

| # | Instrument | Year | Topic | Applicable to wholesale bank? | Already in register? | Action |
|---|---|---|---|---|---|---|
| 1 | **Prudential Communication 18 of 2024** | 2024 | FRTB and CVA implementation roadmap | YES — directly affects market-risk capital posture | PARTIAL — FRTB/CVA capital exists in Domain A as a generic Basel reading; instrument-specific row missing | **ADD** as `ORG-PR-33` |
| 2 | **Prudential Communication 15 of 2024** | 2024 | CSRBB (Credit-Spread Risk in the Banking Book) Field testing | YES — interest-rate-risk-in-the-banking-book add-on | NO | **ADD** as `ORG-PR-34` |
| 3 | **Prudential Communication 1 of 2025** | 2025 | "Flavour of the year" — PA supervisory thematic priorities for 2025 (Banks) | YES — supervisory-engagement framing | NO | skip — informational thematic, not a discrete obligation. Tracked as a citation source for Helena's Risk Management Framework annual review. |
| 4 | **AML/CFT/CPF Communication 1 of 2025** | 2025 | Banks AML/CFT/CPF guidance — proliferation-financing, post-FATF-greylisting compliance expectations | YES | PARTIAL — FIC Act AML/CFT obligations cover the substrate; the PA-issued AML/CFT communication adds banks-specific supervisory expectations on top of FICA s.43 | **ADD** as `ORG-FC-12` (Domain B — financial crime; new row capturing PA's banks-specific supervisory expectation under the post-greylisting regime) |
| 5 | **Joint Communication 3 of 2025** | 2025 | Determinations notification — IT and cyber | YES — meta-notification under JS 1/2023 + JS 2/2024 | NO | skip — informational notification |
| 6 | **Joint Communication 2 of 2024** | 2024 | Publication of the cybersecurity Joint Standard (JS 2 of 2024) | YES — meta-notification | NO | skip — informational |
| 7 | **Joint Communication 4 of 2023** | 2023 | Publication of the IT-governance Joint Standard (JS 1 of 2023) | YES — meta-notification | NO | skip — informational (the standard itself is the binding instrument; added at `ORG-CY-08`) |

## 4. Applicability filter

**Bank profile (per `project_strategic_foundation.md`).** Hoz Bank Limited is an institutional global-markets dealer: JSE bonds + JSE equities + OTC IRD + FX (institutional-only, single SA branch, ~R300m capital target, indirect NPS / CMI participant per `project_indirect_participant_posture.md`). The applicability filter applied across the survey:

- **Retain.** Every PA / Joint instrument that binds on banks generally (Banks Act § 6(6) directives, FSR Act §107 joint standards) and reaches markets, capital, liquidity, governance, IT, cyber, financial crime, climate, recovery, BA-return reporting.
- **Filter out — direct NPS / CMI participant instruments.** D1/2024 NPS-cyber + D2/2024 NPS-EFT — bound on direct National Payment System participants; the bank uses a sponsor / correspondent (per `project_indirect_participant_posture.md`), so the obligation runs through the correspondent under their NPS-D-series compliance, not on `Hoz Bank Limited` directly.
- **Filter out — retail / SME / payments-bank-specific instruments.** None surfaced in the survey for the wholesale slice; the bank's institutional-only posture excludes the retail-deposit-protection / consumer-credit / financial-inclusion subset of PA communications.
- **Filter out — insurer / fund-only Joint Standards.** JS 1 of 2024 (Outsourcing by Insurers); G2/2024 (insurer climate disclosures).
- **Filter out — meta-instruments.** C1/2024 + G1/2024 + C1/2023 ("Status of previously issued ...") — these reconcile the catalogue but do not impose obligations of their own; tracked as citation sources for the PA's annual catalogue-reset discipline.
- **Filter out — informational PA / Joint Communications.** Communications announcing publication of a standard, supervisory-thematic notes, IT-determination notifications — tracked as supervisory-engagement context, not obligations.

## 5. Per-row addition rationale

Eight new register rows added in v1.14 across four domains:

### Domain A (Prudential)

- **`ORG-PR-27` — D1 of 2025 (Pillar 3 disclosure requirements).** The Banks Act + Regulations Relating to Banks discharge Pillar 3 generally, but PA issues a discrete annual / ad-hoc Directive specifying the disclosure-template form, frequency, and content. D1/2025 is the current instrument (subject to D10/2025 supersession check — see `ORG-PR-28`). The bank's Pillar 3 reporting under Camille (CFO, governance) + Bea (Accounting & financial reporting engineer, engineering — reports to Camille) attaches to this directive; the discharge is the Pillar 3 Disclosure Policy (planned) + Bea's runtime Pillar 3 projection. Status `corporate-bind` (binds at corporate formation as an annual reporting cycle once trading commences; the substrate is built pre-licence). Owner Camille (Bea). Citation pinned (the Directive number is sourced; the precise § references inside the directive carry `[citation: TBC]`).

- **`ORG-PR-28` — D10 of 2025 (Pillar 3 disclosure requirements — subsequent revision).** Per the URL `…/banks-directives/2025/d10-2025/D10-2025 - Directive on Pillar 3 disclosure requirements.pdf` surfaced in the survey, there appears to be a 2025 revision (D10/2025) issued after D1/2025. Whether D10 supersedes D1 or is a parallel topical revision is `[citation: TBC]` — Imani follow-up. We register both and let the supersession chain resolve in a follow-on PR.

- **`ORG-PR-29` — D2 of 2024 (Reporting requirements — Regulation 46, BA returns).** Pinpoints the discrete directive that operationalises the BA-return regime under Reg 46. Existing register has BA-return references in Domain L (regulatory reporting) but no instrument-anchored row. Owner Camille + Bea (BA returns are Bea's projection-substrate). Status `commencement-bind` (BA returns commence at trading, not at corporate formation).

- **`ORG-PR-30` — PA recovery-and-resolution-planning Directive.** The bank's `ORG-BNK-RECOVERY-CONS` (Domain Q) cites the PA recovery-and-resolution-planning guidance as `[citation: TBC]`. This row pins the discrete instrument once Imani identifies the directive number (likely a D-series instrument from 2017 / 2019 — specific identification deferred per the survey's WebFetch limitations on the dynamic PA Directives index). Status `corporate-bind` (recovery planning is a corporate-formation obligation under Banks Act + Joint Standard 1 of 2024 reading). Owner Helena (CRO, governance) + Camille (CFO, governance).

- **`ORG-PR-31` — G3/2023 (Basel implementation dates).** Interpretive guidance setting the SARB-side timeline for Basel III/IV reform implementation (revised SA approach for credit risk, revised operational-risk framework, output floor, FRTB, CVA). The bank's substrate-build sequencing under Camille + Helena reconciles to this timeline; the row anchors the citation. Status `IN FORCE` (live guidance). Owner Camille + Helena.

- **`ORG-PR-32` — G3/2025 (Climate Disclosures for banks).** Replaces G3/2024 + G2/2024 with a four-pillar disclosure framework (governance, strategy, risk-management, metrics-and-targets). Direct supervisory expectation on the bank for climate-related disclosures aligned with IFRS-S standards. Cross-reference to `ORG-PR-22` (the prudential climate-risk framework reading under PA GN 1/2024). Status `IN FORCE` (currently no mandatory disclosure under G3/2025 — supervisory expectation only — but the substrate must be ready). Owner Helena (with future S&E engineer).

- **`ORG-PR-33` — Prudential Communication 18 of 2024 (FRTB + CVA implementation roadmap).** PA-set timeline for FRTB and revised-CVA implementation (1 July 2025 commencement per the cited communication). Affects market-risk capital posture for the bank's bond / equity / IRD trading book. Cross-reference to existing capital rows `ORG-PR-01..05`. Status `corporate-bind` (substrate-build; the obligation crystallises at FRTB-commencement). Owner Camille + Helena.

- **`ORG-PR-34` — Prudential Communication 15 of 2024 (CSRBB Field testing).** Credit-Spread Risk in the Banking Book — IRRBB add-on the PA is field-testing. Affects the bank's IRRBB measurement substrate (Helena + Eitan + Bea projections). Status `corporate-bind` (field-testing phase; obligation crystallises at CSRBB-commencement). Owner Helena + Eitan.

### Domain B (Financial crime)

- **`ORG-FC-12` — AML/CFT/CPF Communication 1 of 2025 (Banks).** PA-issued banks-specific AML/CFT/CPF communication setting supervisory expectations under the post-FATF-greylisting regime. Sits on top of FICA s.43 obligations (already covered in Domain B `ORG-FC-01..11`) but adds proliferation-financing (CPF) explicit expectations and PA-specific inspection topics. Status `IN FORCE`. Owner Zara (CCO, governance) + Mira (Compliance / RegTech engineer) + future MLRO.

### Domain G (Cyber / IT)

- **`ORG-CY-08` — Joint Standard 1 of 2023 (IT Governance — umbrella).** IT governance discipline — board-level IT governance, IT strategy alignment, IT risk-management framework, IT change-management governance. Distinct from cybersecurity (covered in JS 2 of 2024 + the existing `ORG-CY-01..05` reading). Commenced 15 November 2024. Status `IN FORCE`. Owner Devon (COO interim CISO function) + Senna (engineering — IT governance) + Rashida (CISO steady-state).

- **`ORG-CY-09` — Joint Standard 1 of 2023 (IT Risk Management — umbrella).** IT risk-management discipline under the same instrument — IT risk taxonomy, IT-control catalogue, IT third-party risk, IT incident-management. Split from `ORG-CY-08` to reflect that the instrument itself runs governance + risk-management as two parallel discipline-clusters. Status `IN FORCE`. Owner Devon + Senna.

- **`ORG-CY-10` — Joint Standard 2 of 2024 (Cybersecurity and Cyber Resilience — corrective umbrella row).** The register currently cites "Joint Standard 1 of 2024" against `ORG-CY-01..05` and `ORG-BNK-CYBER-CONS`. Per the survey, the cybersecurity Joint Standard is **Joint Standard 2 of 2024** (commenced 1 June 2025); JS 1 of 2024 is the *insurer outsourcing* standard. Rather than re-thread the existing rows mid-flight in this survey-PR (which would touch ~15 rows and conflict with parallel work), we land `ORG-CY-10` as a corrective umbrella row pinning JS 2 of 2024 correctly + register a Vera substrate finding (`WS-JS-NUMBER-RECONCILIATION`) routed via §6 below. Status `IN FORCE`. Owner Rashida (CISO steady-state) + Devon (interim CISO function) + Senna (engineering).

### Domain JS (Joint Standards) — new prefix per the v1.13 prefix taxonomy expansion pattern

- **`ORG-CS-JS1` — Joint Standard 1 of 2020 (Significant Owner).** Reporting and notification obligations triggered when a person becomes / ceases to be a "significant owner" of a bank or financial institution. Binds on `Hoz Group Limited` as the parent (and on any future material shareholder) and on `Hoz Bank Limited` as the financial-institution-side reporting entity. Status `corporate-bind` (binds at corporate formation; reporting cycle activates on equity-event). Owner Owen (Company Secretary, governance) + Camille (CFO, governance — notification mechanics).

(Naming note: the prefix `ORG-CS-JS1` is provisional; per v1.13 prefix-taxonomy discipline, a new prefix `JS1` could be added to the schema. We use `CS-JS1` here to stay within the existing `CS1`/`CS2`/`CS3` Conduct Standards family; if Vera flags this as drift, the row can be renamed to `ORG-JS1-001` in a follow-on PR — the URN form is unaffected.)

## 6. Substrate gaps surfaced

1. **JS 1 vs JS 2 of 2024 mis-citation across `ORG-CY-01..05` + `ORG-BNK-CYBER-CONS`.** The register cites "Joint Standard 1 of 2024" for cybersecurity-and-cyber-resilience; per the 2024 PA + FSCA publication record, the cybersecurity instrument is **Joint Standard 2 of 2024** (published 17 May 2024, commenced 1 June 2025) and JS 1 of 2024 is *Outsourcing by Insurers*. Action: a single-purpose follow-on PR (`WS-JS-NUMBER-RECONCILIATION`) renames the citations across the affected rows; `ORG-CY-10` corrects the reading in v1.14.

2. **PA Banks Circulars index inaccessible via WebFetch.** The PA's Banks Circulars page is JavaScript-rendered; the C1/2024 PDF (the catalogue-reset circular) is binary-only and was not text-extractable through WebFetch. Action: `WS-PA-CIRCULAR-INVENTORY` — Imani identifies the 2020–2025 circular catalogue via either (a) a different rendering path, (b) PDF-text extraction with a binary-handling tool, or (c) the PA Annual Report's published circular list.

3. **D-series Directive supersession chain (D1/2025 ↔ D10/2025).** The Pillar 3 directive sequence appears to have a same-year supersession event; without text access to either Directive PDF, the supersession is `[citation: TBC]`. Action: Imani consultation with the PDFs to clarify supersession-vs-parallel-revision; either `ORG-PR-27` collapses to `ORG-PR-28` or both retain with a `supersedes:` cross-reference.

4. **Recovery-and-resolution-planning Directive identification.** `ORG-BNK-RECOVERY-CONS` carries `[citation: TBC — PA Directive on recovery planning, exact reference]` from v1.10. The current survey did not surface the specific Directive number via WebSearch; the PA publishes recovery-planning expectations through both Directives and Joint Standards. Action: Imani identifies the precise instrument as part of `ORG-PR-30`'s `[citation: TBC]` resolution.

5. **G3/2024 vs PA GN 1/2024 climate-risk reading.** `ORG-PR-22` cites "PA Guidance Note 1 of 2024" against the climate-related risk integration into the risk taxonomy reading; the survey surfaced G3/2024 (climate disclosures for banks, replaced by G3/2025) as a distinct disclosure-side instrument. Whether GN 1/2024 = a **prudential-side framework** GN (taxonomy / scenario analysis) and G3/2024 = a **disclosure-side framework** GN are two separate documents or two readings of the same document is `[citation: TBC]`. Action: Imani follow-up to clarify the GN 1/2024 vs G3/2024 inventory.

6. **JS 1 of 2023 (IT Governance + Risk Management) sub-section coverage.** The standard runs to ~30 sections covering governance, risk-management, IT-strategy, IT-organisation, IT-control-environment, IT-risk-assessment, IT-third-party, IT-incident-management. Two umbrella rows (`ORG-CY-08` + `ORG-CY-09`) land in v1.14; sub-section expansion is a Senna+Rashida workstream at first IT-control attestation under the substrate. Vera's continuous-controls recon will surface gaps as the substrate matures.

## 7. Follow-on workstreams routed

| Workstream | Owner | Trigger | Description |
|---|---|---|---|
| `WS-JS-NUMBER-RECONCILIATION` | Mira (Compliance / RegTech engineer) | this PR | Single-purpose follow-on PR renames "JS 1 of 2024" → "JS 2 of 2024" across `ORG-CY-01..05` + `ORG-BNK-CYBER-CONS` + the Domain N citation-URN inventory + the Entity-scope vocabulary section that cites JS 1 of 2024 for group-level cyber-resilience. |
| `WS-PA-CIRCULAR-INVENTORY` | Imani (Legal-as-code engineer) | this PR | Identifies the 2020–2025 PA Banks Circular catalogue via PDF text-extraction or alternative rendering. Feeds register additions in a future v1.x. |
| `WS-INSTRUMENT-ANALYSES` (continuous; Mira) | Mira | this PR | Resolves the seven `[citation: TBC]` markers added in v1.14 (precise § references inside D1/2025, D10/2025, D2/2024, the recovery-planning Directive, G3/2023, G3/2025, PC 18/2024, PC 15/2024, JS 1/2023, JS 2/2024, JS 1/2020). Standing curator-mandate workstream. |
| `Procedures/by-policy/pillar-3-disclosure.md` | Camille (CFO, governance) + Bea (Accounting & financial reporting engineer) | `ORG-PR-27` / `ORG-PR-28` | Procedure authoring for the Pillar 3 disclosure cycle. |
| `Procedures/by-policy/ba-returns-regulation-46.md` | Bea + Camille | `ORG-PR-29` | Procedure authoring for BA-return filing cadence and content under Reg 46 + D2/2024. |
| `Procedures/by-policy/recovery-resolution-planning.md` | Helena (CRO, governance) + Camille (CFO, governance) | `ORG-PR-30` + `ORG-BNK-RECOVERY-CONS` | Procedure authoring for the consolidated recovery plan under PA Directive (TBC) + Banks Act § 60+. |
| `Procedures/by-policy/climate-related-disclosures.md` | Helena (CRO, governance) + future S&E engineer | `ORG-PR-32` | Procedure authoring for the four-pillar climate-disclosures framework under G3/2025. |
| `Procedures/by-policy/it-governance-jr-1-2023.md` | Devon (COO, governance) + Senna (IT governance engineering) + Rashida (CISO steady-state) | `ORG-CY-08` + `ORG-CY-09` | Procedure authoring for IT-governance + IT-risk-management discipline under JS 1 of 2023. |
| `Procedures/by-policy/aml-cft-cpf-banks-supervisory-engagement.md` | Zara (CCO, governance) + Mira + future MLRO | `ORG-FC-12` | Procedure authoring for the post-greylisting PA supervisory-engagement cycle on AML/CFT/CPF. |
| `Procedures/by-policy/significant-owner-notification.md` | Owen (Company Secretary, governance) + Camille (CFO, governance) | `ORG-CS-JS1` | Procedure authoring for significant-owner notification cycle under JS 1 of 2020. |

## 8. Sources consulted

**Primary (PA / Joint Standard / Communication URLs).**

- D2 of 2024 — Reporting requirements in terms of Regulation 46 — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2024/d2-of-2024/D2%20-%202024%20-%20Directive_Reporting%20requirements%20in%20terms%20of%20regulation%2046.pdf`
- D10 of 2025 — Pillar 3 disclosure requirements — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2025/d10-2025/D10-2025%20-%20Directive%20on%20Pillar%203%20disclosure%20requirements.pdf`
- G3 of 2025 — Guidance Note Climate Disclosures for banks — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-guidance-notes/2025/g3-2025/G3-2025-%20Guidance%20Note%20Climate%20Disclosures%20for%20banks.pdf`
- G3 of 2023 — Proposed implementation dates for specified regulatory reforms — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-guidance-notes/2023/G3-2023%20-%20%20Proposed%20implementation%20dates%20in%20respect%20of%20specified%20regulatory%20reforms.pdf`
- C1 of 2024 — Status of Previously issued circulars — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-circulars/2024/C1-2024%20-%20Status%20of%20Previously%20issues%20circulars.pdf`
- G1 of 2024 — Status of Previously issued guidance notes — `https://www.sarb.co.za/en/home/publications/publication-detail-pages/prudential-authority/pa-deposit-takers/banks-guidance-notes/2024/G1-2024-Status-of-Previously-issued-guidance-notes`
- Joint Standard 1 of 2020 — Significant Owner — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-financial/sector-regulation-joint-standards/2020/9970/1.-Joint-Standard-1-of-2020---Significant-Owner---1-June-2020---signed.pdf`
- Joint Standard 1 of 2024 — Outsourcing by Insurers (NOT the cybersecurity standard) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-public-awareness/covid-19-response/2024/joint-comms-1-of-2024/Joint%20Standard%201%20of%202024%20Outsourcing%20by%20Insurers.pdf`
- Joint Communication 2 of 2024 — Publication of Joint Standard 2 of 2024 (Cybersecurity) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-public-awareness/covid-19-response/2024/joint-comms-2-of-2024/Joint%20Communication%202%20of%202024%20-%20Publication%20of%20the%20Joint%20Standard%20-%20Cybersecurity%20and%20cyber%20resilience.pdf`
- Joint Communication 4 of 2023 — Publication of Joint Standard 1 of 2023 (IT Governance) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-public-awareness/covid-19-response/2023/joint-communication-4-of-2023/Joint%20Communication%204%20of%202023-%20Publication%20of%20the%20Joint%20Standard%20-%20IT%20Gov%20and%20Risk.pdf`
- Joint Communication 3 of 2025 — Determinations notification (IT and cyber) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-public-awareness/covid-19-response/2025/joint-comm3-of-2025/Joint%20Communication%203%20of%202025%20-%20Determinations%20notification%20-%20IT%20and%20cyber.pdf`
- Prudential Communication 18 of 2024 — FRTB and CVA implementation roadmap — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-public-awareness/covid-19-response/2024/Prudential%20Communication%2018%20of%202024-FRTB%20and%20CVA%20implementation%20roadmap.pdf`
- Prudential Communication 15 of 2024 — CSRBB Field testing — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-public-awareness/covid-19-response/2024/prudential-comms-15/Prudential%20Communication%2015%20of%202024-%20CSRBB%20Field%20testing.pdf`
- Prudential Communication 1 of 2025 — Flavour of the year (Banks) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-public-awareness/covid-19-response/2025/Prudential%20Communication%201%20of%202025_%20Flavour%20of%20the%20year_Banks.pdf`
- AML/CFT/CPF Communication 1 of 2025 (Banks) — `https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-public-awareness/financial-sector-awareness/2025/AML_CFT_CPF%20Communication%201%20of%202025%20-%20Banks.pdf`
- PA Regulatory Strategy 2025–2030 — `https://www.resbank.co.za/content/dam/sarb/what-we-do/prudential-regulation/pa-regulatory-strategy/PA%20Regulatory%20Strategy%202025-2030.pdf`
- PA Annual Report 2023/24 — `https://www.resbank.co.za/content/dam/sarb/publications/reports/pa-annual-reports/2024/Prudential%20Authority%20Annual%20Report%202023.24.pdf`
- SARB Annual Report 2024/25 (Prudential Regulation chapter) — `https://www.resbank.co.za/content/dam/sarb/publications/reports/annual-reports/2025/chapters/the-sarb's-performance/prudential-regulation-24-25.pdf`

**Secondary (compliance-firm summaries — used to confirm scope, applicability, commencement dates).**

- Webber Wentzel — JS 2 of 2024 cybersecurity commencement.
- Michalsons — JS 1 of 2023 IT-governance scope.
- Moonstone Information Refinery — cybersecurity Joint Standard commencement-date confirmation.
- Lexology — G3/2025 climate-disclosures supersession of G3/2024 + G2/2024.
- LawLibrary — JS 1 of 2023 published-text reference.

## 9. Per-domain row counts added

| Domain | Rows added | IDs |
|---|---|---|
| A (Prudential) | 8 | `ORG-PR-27`, `ORG-PR-28`, `ORG-PR-29`, `ORG-PR-30`, `ORG-PR-31`, `ORG-PR-32`, `ORG-PR-33`, `ORG-PR-34` |
| B (Financial crime) | 1 | `ORG-FC-12` |
| G (Cyber / IT) | 3 | `ORG-CY-08`, `ORG-CY-09`, `ORG-CY-10` |
| JS (Joint Standards) | 1 | `ORG-CS-JS1` |
| **Total** | **13** | — |

—

**Authority chain.** Standing register-curator mandate (Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO)) under Zara (CCO, governance — reports to CEO) + `WS-INSTRUMENT-ANALYSES` continuous workstream; legal sourcing co-author Imani (Legal-as-code engineer, engineering — reports to Devon COO interim). No new CEO decision authority required; the `D-PA-COMMUNICATIONS-REGISTER-UPDATE` event is a record of the curator action per CLAUDE.md "Operating procedures → Events-first authoring".
