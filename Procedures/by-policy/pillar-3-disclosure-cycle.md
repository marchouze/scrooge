---
policy-parent: Policies/pillar-3-disclosure-policy-v1.md · Policies/regulatory-reporting-policy-v1.md · Policies/financial-reporting-policy-v1.md
last-reviewed: 2026-05-22
procedureId: PROC-P3-01
title: Pillar 3 public disclosure cycle
author: Camille (Chief Financial Officer, governance)
date: 2026-05-22
owner: Camille (Chief Financial Officer, governance) · Owen (Company Secretary, governance)
status: POPULATED
policy-cited: Policies/pillar-3-disclosure-policy-v1.md · Policies/regulatory-reporting-policy-v1.md · Policies/financial-reporting-policy-v1.md
system-capability: prototype/platform/reporting/pillar3-disclosure-engine (PLANNED) · prototype/platform/reporting/ba-return-engine (PLANNED) · prototype/platform/document-store ✓
---

# Procedure — Pillar 3 Public Disclosure Cycle

**Procedure ID:** PROC-P3-01  
**Owner:** Camille (Chief Financial Officer, governance) · Owen (Company Secretary, governance)  
**Approval:** Board Audit Committee  
**Cadence:** Semi-annual (30 June + 31 December); full annual package at 31 December  
**Version:** v1.0 — 2026-05-22  
**Status:** POPULATED

---

## 1. Source policy

- `Policies/pillar-3-disclosure-policy-v1.md` — Pillar 3 Disclosure Policy (primary, if enacted; see substrate gap note)
- `Policies/regulatory-reporting-policy-v1.md` — Regulatory Reporting Policy (co-source; governs all prudential disclosures)
- `Policies/financial-reporting-policy-v1.md` — Financial Reporting & Disclosure Policy (co-source; governs public financial reporting standards and publication controls)

The obligation chain is:

```
Regulation (Reg 43 / Banks Act s.90 / BCBS Pillar 3 framework)
  → Regulatory Reporting Policy + Financial Reporting Policy
    → PROC-P3-01 (this procedure)
      → @platform/reporting/pillar3-disclosure-engine (PLANNED)
        → @platform/projections/capital-ratio-monitoring ✓
        → @platform/projections/liquidity ✓ (partial)
        → @platform/reporting/ba-return-engine (PLANNED)
        → @platform/document-store ✓
```

---

## 2. Source regulation(s)

| ID | Instrument | Requirement |
|---|---|---|
| `ORG-PR-43` | Regulation 43 of the Regulations Relating to Banks | Public disclosure requirements: banks must publish semi-annual Pillar 3 disclosures covering capital adequacy, risk profile, leverage, liquidity, and remuneration. Templates aligned to BCBS format are prescribed by the Prudential Authority. |
| `ORG-BA-90` | Banks Act 94 of 1990, s.90 | Disclosure obligations: every bank must publish information as required or directed by the PA; the form, frequency, and medium of disclosure are subject to PA direction. |
| `ORG-BCBS-P3-2019` | BCBS Pillar 3 Disclosure Requirements — Consolidated Framework (December 2019) | Basel III consolidated Pillar 3 disclosure framework: mandatory templates CCA, CC1, CC2, OV1, LR1, LIQA, CR1, CR2, MR1 and supporting narrative sections. |
| `ORG-BCBS-P3-2022` | BCBS Pillar 3 Disclosure Requirements — January 2022 updates | Updates to climate-related financial risk disclosures and revised templates for credit risk and market risk under the revised Basel III standardised approach. |
| `ORG-BCBS-LR-2014` | Basel III Leverage Ratio Framework — January 2014 (as updated) | Leverage ratio disclosure: LR1 template; Tier 1 capital divided by total exposure measure; minimum 3%; granular breakdown of on/off-balance-sheet components. |

---

## 3. Purpose

This procedure fulfils the bank's public disclosure obligations under Regulation 43 and Basel III Pillar 3. It enables market participants — counterparties, investors, creditors, and the public — to assess the bank's risk profile, capital adequacy, liquidity position, leverage ratio, and governance arrangements. Its secondary purposes are:

1. To maintain the bank's regulatory credibility with the Prudential Authority by demonstrating transparent, timely, and reconciled public disclosures.
2. To ensure that every Pillar 3 number is traceable to the canonical event log (Principle 1) and reconciles to the corresponding BA-return line item — zero tolerance for unexplained discrepancies between the bank's regulatory returns and its public disclosures.
3. To document a structured board-approval and publication pathway that satisfies the mandatory human sign-off requirements under Reg 43.
4. To produce a complete audit trail (BLAKE3-hashed document, SARB submission receipt, board minutes, per-table working papers) that supports PA examination, internal audit, and third-party assurance.

---

## 4. Trigger

**Primary trigger — semi-annual calendar:**
- **30 June (interim period-end):** Semi-annual disclosure covering H1 capital, risk, leverage, and liquidity. Publication target: within 60 calendar days of period-end (T+60), i.e. by 29 August.
- **31 December (annual period-end):** Full annual Pillar 3 package, including the complete template suite and extended narrative sections. Publication target: T+60, i.e. by 28 February of the following year.

**First-disclosure trigger:**
- Pillar 3 disclosures commence at the end of the first full reporting period post-licence. Prior to licence commencement, no Pillar 3 publication is required; the substrate is built and tested in parallel.

**Ad-hoc trigger — SARB request:**
- The PA may request an interim or supplementary Pillar 3 disclosure at any time under Banks Act s.90. On receipt of a PA request, this procedure is triggered immediately; publication timeline is per PA instruction.

**Ad-hoc trigger — material capital event:**
- A material capital event (CET1 breach, capital instrument write-down, or activation of PONV clause per `PROC-CAP-CII-01`) triggers an ad-hoc supplementary disclosure within 5 business days of the event, unless the PA directs otherwise.

---

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Pre-work gate — balance sheet substantiation.** Confirm that a `BalanceSheetSubstantiationCompleted { period }` event exists in the event store for the disclosure period. If the event is absent, publication is blocked pending completion of `PROC-FIN-BSS-01`. | `system` (gate check) | `@platform/event-store` ✓ | The balance sheet substantiation is the prerequisite upstream artefact. No Pillar 3 data assembly begins until this event is present. |
| 2 | **Pre-work gate — BA-return reconciliation.** Confirm that `BAReturnFiled` events exist for all BA-series forms in scope for the disclosure period (BA 100, BA 120, BA 300, BA 700 at minimum; BA 200 / BA 320 / BA 400 as applicable) and that no `BAReturnRestatementTriggered` event for the same period is unresolved. | `system` (gate check) | `@platform/event-store` ✓ | A pending BA-return restatement blocks Pillar 3 publication. The Pillar 3 capital figures must match the figures as filed with the PA. |
| 3 | **Emit `Pillar3DisclosureInitiated { period, trigger_type, disclosure_scope }`.** Once both pre-work gates pass, the disclosure engine emits the initiation event to record the start of the cycle. `trigger_type` is one of: `semi-annual`, `annual`, `sarb-request`, `material-capital-event`. | `system` | `@platform/event-store` ✓ | This event is the canonical start of the Pillar 3 cycle for the period. All subsequent steps must follow this event in the event log. |
| 4 | **Gather capital adequacy data.** The disclosure engine reads the capital-ratio-monitoring projection output for the period: RWA by risk type (credit risk RWA from BA 200, market risk RWA from BA 320, operational risk RWA from BA 400, CCR RWA from BA 200 counterparty credit risk sub-forms), CET1 capital amount and ratio, AT1 capital, Tier 2 capital, Total Capital ratio, and capital buffer breakdown (CCB, D-SIB surcharge if applicable, Pillar 2A add-on). | `system` | `@platform/projections/capital-ratio-monitoring` ✓ | Source events: `CapitalRatioComputed`, `RWABreakdownProduced`. All figures must match the BA 700 filed figures; any discrepancy blocks the table assembly step. |
| 5 | **Gather liquidity data.** The disclosure engine reads the liquidity projection for the disclosure period: LCR numerator (HQLA Level 1 + Level 2A + Level 2B with applicable haircuts) and denominator (30-day net stressed cash outflows), LCR ratio; NSFR available stable funding, required stable funding, NSFR ratio; intraday liquidity metrics summary from `PROC-RISK-ILF-01`. | `system` | `@platform/projections/liquidity` ✓ (partial) | NSFR projection is PLANNED; if unavailable at first publication, narrative disclosure substitutes per Reg 43 transitional guidance. |
| 6 | **Gather leverage ratio data.** The disclosure engine reads the leverage ratio calculation: Tier 1 capital (CET1 + AT1), total leverage exposure measure (on-balance-sheet + off-balance-sheet + SFT + derivative exposures per Basel III 2014 standard), leverage ratio percentage. | `system` | `@platform/projections/capital-ratio-monitoring` ✓ | Leverage ratio is derived from the same projection as the BA 700 capital-adequacy-and-leverage return. Cross-check: the Pillar 3 LR1 leverage ratio must equal the BA 700 leverage ratio. |
| 7 | **Gather remuneration governance summary.** Owen (Company Secretary, governance) provides the governance-section input: board composition, remuneration policy summary, total remuneration by senior management band, variable-pay structure, deferral arrangements, and malus/clawback provisions. This input is structured per BCBS Pillar 3 requirements for remuneration disclosures. | `human` (Owen) | `@platform/document-store` ✓ | Owen's input must be received at least 10 business days before the publication target date. The remuneration section is governance-originated and cannot be auto-generated from the event log. |
| 8 | **Assemble Pillar 3 disclosure tables.** Bea (Accounting & financial reporting engineer, engineering) assembles the required disclosure tables per Reg 43 / BCBS template guidance, using data gathered in Steps 4–7: **CCA** (capital instruments and their features), **CC1** (composition of regulatory capital — full own-funds template), **CC2** (reconciliation of regulatory capital to balance sheet), **OV1** (overview of RWA by risk type: credit / market / operational / CCR), **LR1** (leverage ratio common disclosure template), **LIQA** (qualitative disclosure on liquidity risk management approach), **CR1** (credit quality of assets — performing vs non-performing), **CR2** (changes in stock of non-performing exposures), **MR1** (market risk under standardised approach — capital requirement by risk class per FRTB-SA). | `system` + `human` (Bea) | `@platform/reporting/pillar3-disclosure-engine` (PLANNED) | Until the disclosure engine is built, Bea assembles tables manually using the event-log projection outputs. Template formats follow the PA's prescribed Reg 43 templates (or BCBS templates where the PA has not prescribed a local variant). |
| 9 | **Draft narrative sections.** Bea and Camille jointly draft the narrative Pillar 3 sections: risk governance overview (board and committee structure, risk appetite framework summary); capital management approach (target capitalisation, capital plan, ICAAP summary reference); link to RAS (summary of key risk limits and utilisation at period-end); qualitative disclosures per applicable BCBS template requirements (liquidity risk management approach, credit risk management approach, market risk framework overview). | `human` (Bea + Camille) | n/a | Narrative sections must be consistent with the qualitative disclosures in the annual financial statements and ICAAP. Camille reviews all narrative sections before the numerical consistency check. |
| 10 | **Numerical consistency check.** All Pillar 3 numbers must reconcile to the corresponding BA-return line items. Bea performs a line-by-line reconciliation: CCA / CC1 own-funds total → BA 700 eligible capital; OV1 RWA total → sum of BA 200 (credit) + BA 320 (market) + op-risk RWA; LR1 leverage ratio → BA 700 leverage ratio; LIQA LCR / NSFR → BA 300 LCR / NSFR. Bea documents each reconciliation link in the per-table working papers and stores them in the document store. | `human` (Bea) | `@platform/document-store` ✓ | **Any discrepancy between a Pillar 3 figure and the corresponding BA-return line blocks publication.** Bea investigates and resolves the discrepancy with Atlas (Core banking platform architect, engineering) or Helena (Chief Risk Officer, governance) as appropriate; see Exception Handling (Section 7). |
| 11 | **Emit `Pillar3ReconciliationCompleted { period, discrepanciesFound: 0, workersPaperUri }`.** Bea emits this event once all reconciliations are clean. `workersPaperUri` is the BLAKE3-addressed URI of the per-table working papers in the document store. A `Pillar3DisclosurePublished` event cannot be emitted without a preceding `Pillar3ReconciliationCompleted` with `discrepanciesFound: 0` for the same period. | `system` (on Bea action) | `@platform/event-store` ✓ | This event is the control gate that certifies numerical consistency. Vera asserts this gate nightly during the disclosure preparation window. |
| 12 | **Board review and CEO + CFO sign-off.** The assembled disclosure document (tables + narrative) is tabled to the Board Audit Committee meeting or CEO/CFO for sign-off. CEO Marc and Camille sign the disclosure as required by Reg 43. The sign-off constitutes the mandatory human attestation that the disclosure is complete, accurate, and consistent with the bank's books and records. | `human` (Marc as CEO, Camille as CFO) | n/a | **CEO and CFO sign-off is a mandatory human step and cannot be delegated to an automated agent.** Where the full Board AC cannot convene in time, a CFO + CEO sign-off is the minimum; full Board AC notation follows at the next scheduled meeting. |
| 13 | **Emit `Pillar3DisclosureApprovedByBoard { period, approvedAt, signatories }`.** After board review and sign-off, the event is emitted. `signatories` lists the principals who signed (minimum: marc@ceo + camille@cfo). Owen (Company Secretary) files the board resolution in the corporate secretarial records. | `system` (on Owen action post-meeting) | `@platform/event-store` ✓ | Owen's board-resolution filing precedes the `Pillar3DisclosurePublished` event. No publication occurs before this event is in the log. |
| 14 | **Publication — post to bank website.** The signed and approved disclosure document is published on the bank's website in the Pillar 3 / Investor Relations section. The URL is captured. Publication is a human-triggered action; the content-addressed BLAKE3 hash of the published document is recorded. | `human` (Camille / Owen) | `@platform/document-store` ✓ | Website publication is a human-controlled step. The published document hash must match the hash of the board-approved document in the document store; any difference indicates tampering and blocks the SARB submission. |
| 15 | **Publication — submit to SARB.** The approved disclosure is submitted to the PA via the SARB supervisory portal (or the PA's prescribed channel). The SARB submission reference number is captured. SARB submission is a named human responsibility; until portal automation is built, this is a manual upload by Camille or a designated alternate. | `human` (Camille) + `system` | `@platform/reporting/pa-portal-client` (PLANNED) | SARB submission must occur within the T+60 publication window. If the portal is unavailable, the submission is made via email to the PA with an explanatory cover note; Camille notifies the PA of the delay and the expected submission date. |
| 16 | **Emit `Pillar3DisclosurePublished { period, reportHash, publishedAt, sarbSubmissionRef }`.** This is the canonical event confirming the full disclosure cycle is complete. `reportHash` is the BLAKE3 hash of the published document; `publishedAt` is the website publication timestamp; `sarbSubmissionRef` is the PA portal reference number. | `system` (on Camille action) | `@platform/event-store` ✓ | This event closes the Pillar 3 cycle for the period. Vera asserts that this event exists for each semi-annual period within 3 months of period-end; absence is a P1 finding. |

---

## 6. Reconciliation

### Events produced

| Event | Trigger | Key fields |
|---|---|---|
| `Pillar3DisclosureInitiated` | Step 3 — once per period on both gates passing | `period`, `trigger_type`, `disclosure_scope` |
| `Pillar3ReconciliationCompleted` | Step 11 — once per period after clean numerical reconciliation | `period`, `discrepanciesFound` (must be 0), `workersPaperUri` (BLAKE3) |
| `Pillar3DisclosureApprovedByBoard` | Step 13 — once per period after board/CEO/CFO sign-off | `period`, `approvedAt`, `signatories` |
| `Pillar3DisclosurePublished` | Step 16 — once per period on website publication + SARB submission | `period`, `reportHash` (BLAKE3), `publishedAt`, `sarbSubmissionRef` |

### Invariants (CI-tested)

1. **Reconciliation gate:** `∀ Pillar3DisclosurePublished(period) → ∃ Pillar3ReconciliationCompleted(period, discrepanciesFound=0)` with `reconciliationAt < publishedAt`. No publication event without a clean reconciliation event. Enforced by the disclosure engine; audited by Vera nightly during the disclosure window.
2. **Board-approval gate:** `∀ Pillar3DisclosurePublished(period) → ∃ Pillar3DisclosureApprovedByBoard(period)` with `approvedAt < publishedAt`. No publication without board/CEO/CFO sign-off.
3. **BA-return consistency:** The capital figures in the `Pillar3ReconciliationCompleted` working papers must reconcile to the `BAReturnFiled` events for the same period. Vera asserts this on a per-period basis.
4. **Timeliness:** `Pillar3DisclosurePublished` must exist for each semi-annual period within 3 months of period-end (Reg 43 target). Absence or lateness is a Vera P1 finding escalated to Camille and the Board AC.
5. **Document integrity:** `reportHash` in `Pillar3DisclosurePublished` must equal the hash of the document stored in the BLAKE3 document store. Post-publication hash mismatches trigger an immediate `Pillar3RestatementTriggered` event and a restatement investigation.

---

## 7. Exception handling

### Numerical discrepancy with BA returns (Step 10)

If Bea identifies a discrepancy between a Pillar 3 table figure and the corresponding BA-return line item, publication is immediately blocked. Bea investigates the source of the discrepancy with support from Atlas (Core banking platform architect, engineering) for event-log trace issues, or Helena (Chief Risk Officer, governance) for RWA computation differences. The disclosure date may be extended by a maximum of 5 business days from the original publication target before SARB notification is required. If the discrepancy cannot be resolved within 5 business days, Camille notifies the PA in writing, explains the nature of the discrepancy, and provides a revised publication date.

### Restatement of a published disclosure

If a material error in a published Pillar 3 disclosure is identified post-publication — by internal review, Vera recon, external audit, or PA examination — the following path applies:

1. Camille determines materiality. Materiality threshold: any error that changes a capital ratio, LCR, NSFR, or leverage ratio figure by ≥ 0.1 percentage points, or changes any monetary figure by ≥ ZAR 1 million.
2. Camille notifies the PA in writing within 3 business days of the determination of materiality.
3. An amended Pillar 3 disclosure is prepared following the same pre-work gates, reconciliation, and board-approval steps as a standard disclosure (Steps 1–16 above), with the following additions: a clearly labelled comparison table (restated vs. originally published figures), a narrative explanation of the error and its cause, and a statement on whether BA returns have been restated.
4. The amended disclosure is published on the bank's website alongside the original, clearly identified as the restated version.
5. `Pillar3RestatementPublished { period, amendedReportHash, originalReportHash, publishedAt, sarbSubmissionRef, materiality_basis }` is emitted.
6. A restatement entry is added to the restatement history register.

### SARB submission overdue

If the `Pillar3DisclosurePublished` event has not been emitted by T+60 from the relevant period-end, Vera raises a P1 finding. Camille must notify the PA of the delay and provide a revised publication date. Devon (Chief Operating Officer, governance) escalates if the delay persists beyond T+75.

---

## 8. Reporting / MI

- **Pillar 3 publication log:** Dashboard tile showing the most recent `Pillar3DisclosurePublished` event for each semi-annual period, publication date, SARB submission reference, and document hash.
- **SARB acknowledgement tracker:** Once the PA portal acknowledgement is received, it is stored in the document store linked from the `Pillar3DisclosurePublished` event; the tracker shows acknowledgement status.
- **Restatement history register:** A running log of all `Pillar3RestatementPublished` events, accessible to Thandiwe (Chief Audit Executive, governance) for audit programme purposes.
- **Reconciliation working papers:** Per-table BLAKE3-addressed documents stored for each period, showing the BA-return cross-reference for every material Pillar 3 figure.

---

## 9. Change control

- **Methodology changes** (e.g. change in RWA computation approach, change in the definition of eligible capital instruments included in CC1): Camille is the approval authority. Changes must be disclosed in the next Pillar 3 publication with a description of the change and its impact.
- **Material scope changes** (e.g. addition of a new required template, change to the publication frequency, extension of the disclosure scope to cover a new entity): Board Audit Committee approval required.
- **Mandatory regulatory updates:** BCBS Pillar 3 framework updates, Reg 43 amendments, or PA directives that change the required disclosure content trigger a mandatory review of this procedure within 60 days of the effective date of the update. Owen (Company Secretary, governance) maintains the obligation register entry for this procedure and flags regulatory updates to Camille.

---

## 10. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Pillar 3 disclosure document (BLAKE3-hashed) | Document store (linked from `Pillar3DisclosurePublished`) | 7 years post-period (Reg 90) | Public (post-publication); Restricted (pre-publication) |
| `Pillar3DisclosureInitiated` event | Event log | 7 years | Restricted |
| Per-table working papers (reconciliation to BA returns) | Document store (BLAKE3 URI in `Pillar3ReconciliationCompleted`) | 7 years | Restricted |
| `Pillar3ReconciliationCompleted` event | Event log | 7 years | Restricted |
| `Pillar3DisclosureApprovedByBoard` event + board resolution | Event log + corporate secretarial records (Owen) | 7 years | Restricted |
| `Pillar3DisclosurePublished` event | Event log | 7 years | Restricted |
| SARB portal acknowledgement / submission receipt | Document store (linked from `Pillar3DisclosurePublished`) | 7 years | Restricted |
| `Pillar3RestatementPublished` event + amended disclosure + PA correspondence | Event log + document store | 7 years | Confidential |
| Restatement history register | Document store (Vera-managed) | 7 years | Restricted |

---

## 11. Manual steps

The following steps require human judgement or human authority and cannot be delegated to automated agents:

- **Step 7 — Remuneration governance input (Owen):** The remuneration disclosure section requires Owen (Company Secretary, governance) to provide structured governance data. This involves legal and regulatory judgements on categorisation of remuneration components that are not automatable.
- **Steps 8–9 — Table assembly and narrative drafting (Bea + Camille):** Until the Pillar 3 disclosure engine is built, table assembly and narrative drafting require human financial expertise. Even once the engine is built, Camille reviews the narrative sections and the LIQA qualitative disclosure as a mandatory human step.
- **Step 10 — Numerical consistency check (Bea):** The reconciliation between Pillar 3 tables and BA-return line items requires professional accounting judgement to interpret and resolve any rounding, scope, or timing differences. This cannot be fully automated without model-risk implications.
- **Step 12 — Board review and CEO + CFO sign-off (Marc, Camille):** This is a mandatory regulatory human step under Reg 43. No automated agent may sign the Pillar 3 disclosure. Where Camille is unavailable, a formally designated Acting CFO must sign (via a `DelegatedSignatoryAppointed` event); the CEO cannot sign alone.
- **Step 13 — Board resolution filing (Owen):** The filing of the board resolution in the corporate secretarial records is Owen's (Company Secretary, governance) responsibility. This records the human governance approval for future audit and regulatory inspection.
- **Step 14 — Website publication (Camille / Owen):** The act of publishing the disclosure to the bank's website is a human-triggered action to prevent automated publication of an unapproved document.
- **Step 15 — SARB portal submission (Camille):** Submission to the PA's supervisory portal is a named human responsibility until portal automation is built. Camille is accountable for timely submission; she may delegate the physical upload to Bea via a logged instruction.

---

## 12. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| `BalanceSheetSubstantiationCompleted` event absent for period | Step 1 gate check fails | Bea + Camille; complete PROC-FIN-BSS-01; Pillar 3 cycle paused until gate passes |
| Unresolved BA-return restatement for the period | Step 2 gate check: `BAReturnRestatementTriggered` unresolved | Camille; resolve restatement first; SARB notified if Pillar 3 publication will be delayed |
| Numerical discrepancy between Pillar 3 table and BA return (Step 10) | Bea reconciliation check | Publication blocked; Bea + Atlas/Helena investigate; Camille notifies PA if >5 BD delay |
| Board / CEO / CFO sign-off not obtained within T+50 | Internal deadline monitor | Devon (COO) escalates to Marc and Camille; if T+55 and still unsigned, CEO notified formally |
| SARB submission portal unavailable | Manual check by Camille at submission | Camille contacts PA by email; manual submission with cover note; portal reference obtained retrospectively |
| Pillar 3 disclosure overdue (T+60 missed) | Vera P1 finding; `Pillar3DisclosurePublished` absent | Camille notifies PA; Devon escalates; Board AC informed at next meeting |
| Material error identified post-publication | Internal review / Vera recon / external audit / PA examination | Restatement path per Section 7; PA notified within 3 business days; Board AC informed |
| Hash mismatch between published document and document store | Vera post-publication integrity check | Immediate escalation to Rashida (Chief Information Security Officer, governance) and Camille; document store audit; potential regulatory notification if tampering confirmed |

---

## 13. Cross-references

- [`Procedures/by-policy/ba-return-generation.md`](ba-return-generation.md) — PROC-FIN-BA-01: BA-return generation is the upstream reconciliation anchor for all Pillar 3 capital and risk figures.
- [`Procedures/by-policy/balance-sheet-substantiation.md`](balance-sheet-substantiation.md) — PROC-FIN-BSS-01: balance sheet substantiation is the required pre-work gate (Step 1).
- [`Procedures/by-policy/capital-ratio-monitoring.md`](capital-ratio-monitoring.md) — source of the capital adequacy projection data (Steps 4, 6).
- [`Procedures/by-policy/capital-instrument-issuance.md`](capital-instrument-issuance.md) — PROC-CAP-CII-01: CCA and CC1 disclosures depend on the capital instruments issuance register.
- [`Procedures/by-policy/pr-icaap-governance.md`](pr-icaap-governance.md) — ICAAP governance (if enacted): the ICAAP capital assessment is referenced in the Pillar 3 capital management narrative (Step 9).
- [`Procedures/by-policy/pr-capital-adequacy-governance.md`](pr-capital-adequacy-governance.md) — capital adequacy governance procedure (cross-reference for RWA computation and capital position).
- [`Procedures/by-policy/pr-own-funds-calculation.md`](pr-own-funds-calculation.md) — own funds calculation (cross-reference for CC1 and CC2 table construction).
- [`Procedures/by-policy/stress-test-cycle.md`](stress-test-cycle.md) — PROC-RISK-ST-01: stress-test results feed the capital management narrative in Pillar 3.
- [`Procedures/by-policy/intraday-liquidity-funding.md`](intraday-liquidity-funding.md) — PROC-RISK-ILF-01: intraday liquidity metrics are referenced in the LIQA qualitative disclosure.

---

## 14. Substrate gaps

| Gap | Status | Target |
|---|---|---|
| Pillar 3 table-generation engine (`@platform/reporting/pillar3-disclosure-engine`) — automated assembly of the full BCBS / Reg 43 template suite from event-log projections | PLANNED | Close Engine M3 |
| SARB Pillar 3 portal integration (`@platform/reporting/pa-portal-client`) — automated submission to the PA supervisory portal with reference-number capture | PLANNED | Post-licence pre-commencement |
| Automated BA-return-to-Pillar-3 reconciliation pipeline — line-by-line automated cross-check between BA-return filed figures and Pillar 3 table outputs; replaces manual Step 10 | PLANNED | Close Engine M3 |
| NSFR projection (`@platform/projections/liquidity` — NSFR component) — required for LIQA quantitative disclosure of NSFR ratio | PLANNED | Liquidity Engine M2 |
| Website publication automation — content-addressed publication pipeline that publishes the board-approved document to the bank website and captures the BLAKE3 hash | PLANNED | Infrastructure milestone pre-licence |

---

## 15. Audit / assurance

- **Vera nightly recon (disclosure window):** During the 60-day window following each semi-annual period-end, Vera checks daily that the `Pillar3DisclosurePublished` event exists for the period. Absence by T+65 triggers a P1 finding escalated to Camille and Thandiwe (Chief Audit Executive, governance).
- **Vera numerical consistency assertion:** On each `Pillar3DisclosurePublished` event, Vera runs a cross-check between the `reportHash`-linked working papers and the `BAReturnFiled` events for the same period. Any capital, leverage, or liquidity figure discrepancy exceeding ZAR 1 million or 0.1 percentage points is a P1 finding.
- **Thandiwe (CAE) annual review:** Thandiwe (Chief Audit Executive, governance) includes the Pillar 3 disclosure cycle in the annual internal audit plan. The review covers: completeness of event-log evidence, integrity of the BA-return reconciliation, timeliness of publication, and adequacy of the board-approval record.
- **External audit:** The external auditor reviews the Pillar 3 disclosure as part of the annual audit of the financial statements. The reconciliation working papers (Step 10) are provided as supporting evidence.
- **Recon gate:** `recon:pillar3-disclosure-timeliness` — Vera pipeline asserting `Pillar3DisclosurePublished` exists for each required period within 90 days of period-end.

---

## 16. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-22 | Camille (Chief Financial Officer, governance) | Initial POPULATED — full 16-section procedure; all steps and invariants documented; system capabilities marked PLANNED pending Atlas build; board-approval and CEO/CFO sign-off steps included as mandatory human controls; restatement path documented. |
