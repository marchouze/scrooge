---
policy-id: liquidity-risk-management-policy
title: Liquidity Risk Management Policy v1
version: "1"
status: IN FORCE
owner: Helena (Chief Risk Officer, governance)
effective-from: "2026-05-11"
next-review: "2027-05-11"
citations:
  - BCBS D295 (LCR)
  - BCBS D335 (NSFR)
  - BCBS 144 (liquidity risk monitoring tools)
  - PA D6/2015 (LCR)
  - D-POLICY-DOCUMENT-HOME
author: Camille (Chief Financial Officer, governance) + Eitan (Treasurer, governance) + Helena (Chief Risk Officer, governance)
date: 2026-05-11
summary: Standalone Liquidity Risk Management Policy covering LCR, NSFR, intraday liquidity, Contingency Funding Plan, ILAAP governance, and stress-testing. Closes obligations ORG-PR-06 through ORG-PR-08, ORG-PR-14, ORG-PR-15, ORG-PR-36, ORG-PR-38, ORG-PR-43. LICENCE-BIND.
decision-required: false
riskTaxonomy: RT-LQ
---

# Liquidity Risk Management Policy v1

> **Authors.** Camille (Chief Financial Officer, governance) + Eitan (Treasurer, governance) lead; Helena (Chief Risk Officer, governance) co-author.
> **Approval authority.** Board of Directors (BRC review → Board approval). Interim: CEO (Marc) + joint CRO + CFO + Treasurer sign-off under `D-THIN-HUMAN-LAYER-MINIMUM`.
> **Effective date.** 2026-05-11.
> **Licence-bind status.** LICENCE-BIND — obligations activate at commencement of trading. Build-phase substrate must be production-grade by the pre-licence go-live readiness gate.
> **Obligations closed.** `ORG-PR-06` (LCR), `ORG-PR-07` (NSFR), `ORG-PR-08` (intraday liquidity), `ORG-PR-14` (ILAAP), `ORG-PR-15` (CFP), `ORG-PR-36` (PA D6/2015 LCR), `ORG-PR-38` (PA D4/2021 liquidity stress), `ORG-PR-43` (PA D1/2023 NSFR).
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10); W2 Slice 5 of [Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md](2026-05-10_zara-helena_regulatory-readiness-gate-plan.md). Cross-referenced in the ILAAP framework spec at [Owner Inbox/2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md](2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md) §3.2 and §4.3.

---

## Reading order

1. **Section 1** — Policy scope and regulatory hierarchy.
2. **Sections 2–3** — The quantitative ratio framework (LCR, NSFR).
3. **Section 4** — Intraday liquidity discipline.
4. **Section 5** — Contingency Funding Plan.
5. **Section 6** — ILAAP governance — the overarching annual process that synthesises Sections 2–5.
6. **Section 7** — Stress-testing integration.
7. **Sections 8–9** — Roles, escalation, and breach taxonomy.
8. **Sections 10–11** — Obligations closed, citation surface, and change log.

---

## 1. Policy scope, purpose, and regulatory hierarchy

### 1.1 Purpose

This policy sets the framework under which `Hoz Bank Limited` ("the bank") identifies, measures, manages, monitors, and reports **liquidity risk** — the risk that the bank cannot meet its obligations as they fall due without incurring unacceptable costs or threatening its continued viability. The policy covers the full liquidity-risk spectrum: structural liquidity (funding maturity mismatch), tactical liquidity (short-horizon cash-flow management), intraday liquidity (real-time settlement capability), and contingency liquidity (CFP activation under severe stress).

The policy incorporates the bank's **Internal Liquidity Adequacy Assessment Process (ILAAP)** governance framework as its capstone section (Section 6). The ILAAP is the bank's self-assessment, submitted annually to the Prudential Authority (PA), that the bank's liquidity buffers, funding profile, and contingency arrangements are adequate relative to its risk profile. The ILAAP is the regulatory channel through which this policy's provisions are attested to the PA.

This policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2 of the bank's architectural principles). It cites the regulatory authorities that create the obligations; it does not replicate those authorities in full. Procedures that operationalise each section of this policy are linked from the relevant section.

### 1.2 Scope

This policy applies to:

- `Hoz Bank Limited` on a **solo (entity) basis** as the PA-regulated bank.
- `Hoz Bank Limited` on a **consolidated basis** (look-through per `D-REGULATORY-PERIMETER`, CEO-approved 2026-05-09), encompassing `Hoz Securities Limited` for the group liquidity-risk narrative. The consolidated-basis reading follows the framework at [Owner Inbox/2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md](2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md) §2.2.

The policy is **LICENCE-BIND**: the obligations listed herein bind from commencement of trading. Build-phase work is preparation for compliance; the substrate (LCR / NSFR projection engines, intraday-liquidity feed, CFP rehearsal harness, ILAAP authoring workflow) must be production-grade at the pre-licence go-live readiness gate.

Excluded from this policy's direct scope (but cross-referenced):

- **Interest Rate Risk in the Banking Book (IRRBB)** — governed by the IRRBB Policy (per `ORG-PR-11`), which also informs the bank's funding-cost risk narrative within the ILAAP.
- **Capital management** — governed by the Capital Management Policy (per `ORG-PR-01`). The LCR / NSFR buffers are calibrated consistently with the ICAAP capital-buffer framework (same stress scenarios, per the ICAAP/ILAAP triplet coherence requirement at §1.2 of the framework spec).
- **Operational resilience** — governed by the Operational Resilience Policy (per `ORG-PR-24`). CFP activation procedures cross-reference the operational-resilience incident-response workflow.

### 1.3 Regulatory hierarchy

The bank's liquidity-risk framework is grounded in the following regulatory authorities, read in descending order:

| Rank | Instrument | Summary | Obligation rows |
|---|---|---|---|
| 1 | Banks Act 94 of 1990 — §§ 60-72 and the provisions on liquidity management `[citation: TBC — precise § indices on liquidity governance; Imani (Legal-as-code engineer) + external counsel ratify at the licence-application gate]` | Primary statute establishing the PA's supervisory authority and the bank's prudential requirements | `ORG-PR-06`, `ORG-PR-07`, `ORG-PR-08`, `ORG-PR-14`, `ORG-PR-15` |
| 2 | Regulations Relating to Banks 2012 (as amended) — **Regulation 26** (liquidity-risk management) `[citation: TBC — exact sub-clause indices; same ratification pathway]` | Operationalises the Banks Act liquidity requirements; sets the LCR and NSFR ratio requirements, intraday monitoring obligations, and the ILAAP submission framework | `ORG-PR-06`, `ORG-PR-07`, `ORG-PR-08`, `ORG-PR-14` |
| 3 | PA Directive 6 of 2015 — Revised LCR (proposed Government Notice) `[citation: TBC — precise § references inside D6/2015; survey URL: https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2015/6685/02-D6---Directive-revised-LCR-proposed-Government-Notice-Annexure-A.pdf]` | SA-specific LCR calibration instrument; operationalises Reg 26's LCR provisions and the BCBS January 2013 LCR standard | `ORG-PR-36` |
| 4 | PA Directive 4 of 2021 — Externally-facilitated liquidity stress simulation `[citation: TBC — precise § references inside D4/2021; survey URL: https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2021/D4%20-%202021%20-%20Externally-facilitated%20liquidity%20stress%20simulation.pdf]` | Banks must participate in PA-coordinated industry-wide liquidity stress simulations | `ORG-PR-38` |
| 5 | PA Directive 1 of 2023 — Matters related to the NSFR (replaces D8/2017) `[citation: TBC — precise § references inside D1/2023; survey URL: https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2023/D1_2023%20Matters%20related%20to%20the%20NSFR.pdf]` | SA-specific NSFR calibration; phases out the ASF factor for ZAR funding from financial corporates (35% → 0% phased 2023–2028+) | `ORG-PR-43` |
| 6 | BCBS *Principles for Sound Liquidity Risk Management and Supervision* (BCBS 144, September 2008) | 17 principles governing liquidity risk management; the ILAAP, CFP, and governance provisions of this policy derive from these principles | `ORG-PR-15` |
| 7 | BCBS *Basel III: The Liquidity Coverage Ratio and liquidity risk monitoring tools* (BCBS D295, January 2013) | LCR standard and the monitoring-tools framework; the bank's LCR computation follows this standard | `ORG-PR-06` |
| 8 | BCBS *Basel III: The Net Stable Funding Ratio* (BCBS D335, October 2014) | NSFR standard; the bank's NSFR computation follows this standard | `ORG-PR-07` |
| 9 | BCBS *Monitoring tools for intraday liquidity management* (BCBS 248, April 2013) | Seven intraday monitoring metrics; the bank's intraday liquidity discipline follows this framework | `ORG-PR-08` |
| 10 | PA *Directive on the Internal Liquidity Adequacy Assessment Process* `[citation: TBC — Mira (Compliance / RegTech engineer) curatorship route; the precise PA directive title and reference number bind on the ILAAP submission; until ratified, the ILAAP section-set reads against BCBS 144 + BCBS 248 + Reg 26]` | PA-specific ILAAP submission requirements | `ORG-PR-14` |

No citation is invented. Where a precise sub-clause index or directive text has not yet been ratified by Imani (Legal-as-code engineer, engineering — reports to Devon (Chief Operating Officer, governance)) + external counsel, the entry carries `[citation: TBC]` and routes to the `WS-INSTRUMENT-ANALYSES` standing workstream. Per Principle 2, the bank does not claim a citation it has not verified.

### 1.4 Governance framework — approval and ownership

| Dimension | Owner | Authority | Cadence |
|---|---|---|---|
| Policy ownership | Helena (Chief Risk Officer, governance) co-owned with Eitan (Treasurer, governance) | Board approval (BRC review → Board; CEO-interim under `D-THIN-HUMAN-LAYER-MINIMUM`) | Annual review; material-change-triggered |
| LCR computation and governance | Eitan (Treasurer, governance) — methodology; Bea (Accounting & financial reporting engineer, engineering — reports to Camille) — projection engine | ALCO and BRC oversight | Daily computation; monthly limit review; annual policy refresh |
| NSFR computation and governance | Eitan (Treasurer, governance) — methodology; Bea — projection engine | ALCO and BRC oversight | Quarterly computation; annual policy refresh |
| Intraday liquidity monitoring | Eitan (Treasurer, governance) — governance; Ravi (Treasury / ALM engineer, engineering — reports to Eitan) — monitoring tools | ALCO intraday-trigger oversight | Daily (real-time during live operations) |
| CFP ownership | Eitan (Treasurer, governance) — plan owner; Ravi — rehearsal engineering; Helena — stress-framework alignment | ALCO → BRC on trigger activation | Annual rehearsal; trigger-based activation |
| ILAAP process | Camille (Chief Financial Officer, governance) — process chair; Eitan — liquidity-side co-chair; Helena — risk-narrative review | CEO-sign-off → Board attestation → PA submission | Annual cycle; material-change-triggered |
| Independent model validation | Nadia (Independent-validation engineer, engineering — reports to Helena; peer-in-second-line) | Per the Model Risk Policy (`ORG-PR-21`) | Pre-deployment + annual revalidation per Tier classification |
| Internal audit assurance | Vera (internal audit engineer, engineering — reports to Thandiwe (Chief Audit Executive, governance)) | Third-line independence per the Internal Audit Charter | Annual; ad-hoc on findings |

---

## 2. Liquidity Coverage Ratio (LCR) governance

### 2.1 Regulatory framework

The LCR measures the bank's ability to survive a 30-calendar-day severe liquidity stress by holding a sufficient stock of **High Quality Liquid Assets (HQLA)** that can be readily converted to cash to cover net cash outflows over that horizon.

**Regulatory definition:** LCR = Total HQLA Stock (post-haircut, post-cap) / Total Net Cash Outflows over the 30-calendar-day stress period.

**PA minimum requirement:** LCR ≥ 100% at all times per Reg 26(2) and PA D6/2015 (`ORG-PR-36`).

**Internal floor (policy target):** LCR ≥ 120% under normal conditions (PA minimum + 20pp internal management buffer). The +20pp management buffer is the bank's Risk Appetite Statement (RAS) B3 liquidity-floor pending full ILAAP-calibrated recalibration (see §2.5). Per Eitan's Funding Strategy v1 ([Owner Inbox/2026-05-07_eitan_funding-strategy-v1.md](2026-05-07_eitan_funding-strategy-v1.md) §1), the build-phase planning floor is PA-min + 20pp; this is superseded by the ILAAP-calibrated value when the W2 Slice 5 substrate lands.

**Activated obligation status:** `ORG-PR-06` (BCBS D295 / BA 325) — **IN FORCE** from commencement of trading.

**Consolidated obligation:** `ORG-BNK-ILAAP-CONS` (consolidated ILAAP submission) — the bank entity submits a consolidated ILAAP to PA that aggregates liquidity across `Hoz Bank Limited` + `Hoz Securities Limited`. Both the solo and consolidated LCR are produced by the BA 325 projection substrate.

### 2.2 HQLA eligibility and composition

The bank maintains its HQLA stock in accordance with the three-tier classification:

| Tier | Eligible assets | Haircut factor | Cap |
|---|---|---|---|
| Level 1 | Cash; SARB reserve balances; South African Government Bonds (SAGB) rated ≥ sovereign minimum; Level-1-eligible supranational securities | 0% (no haircut) | No cap within HQLA pool |
| Level 2A | 20% risk-weight sovereign / PSE / MDB securities; AA-/higher rated corporate bonds and covered bonds; non-0%-RW SAGB eligible under Reg 26(7)(b) | 15% haircut (factor applied: 85%) | 40% of total HQLA stock post-cap |
| Level 2B | A+/A/A-/BBB- rated eligible corporate bonds; qualifying equities; qualifying RMBS | 25–50% haircut (asset-specific) | 15% of total HQLA stock post-cap |

HQLA eligibility is assessed on the basis of the BCBS D295 §§ 49–66 criteria `[citation: TBC — precise paragraph indices]` and Reg 26(7) `[citation: TBC]`. The BA 325 LCR substrate at `prototype/platform/reporting/ba-325-lcr.ts` implements the closed-form cap arithmetic per BCBS D295 § 47.

**HQLA operational requirements.** The bank holds its HQLA stock:

- In a **dedicated liquidity buffer** separated from assets used for day-to-day operations.
- Unencumbered — free from any legal, regulatory, contractual, or operational impediments to monetisation within the 30-day stress horizon.
- Operationally ready — the Treasury function (Eitan + Ravi) maintains the capability to monetise HQLA immediately under stress, with no dependency on creditworthiness assessments from external parties during the stress window.
- In ZAR, unless a significant-currency LCR is separately maintained for material non-ZAR currency exposures per §2.4 below.

**Concentration limits.** HQLA composition is reviewed quarterly by ALCO. Maximum concentration limits per HQLA category (as a percentage of the total HQLA stock):

| Category | Concentration limit |
|---|---|
| Level 2B assets (total) | ≤ 15% (regulatory cap) |
| Single-issuer Level 2A or Level 2B assets | ≤ 10% per issuer |
| Level 2A and Level 2B combined | ≤ 40% (regulatory cap on combined Level 2 assets) |

Concentration-limit breaches are High-severity liquidity events per §9.2 of this policy.

### 2.3 LCR computation frequency and reporting

| Frequency | Computation | Reporting |
|---|---|---|
| Daily | LCR computed as-of-close-of-business | Internal ALCO dashboard via `LcrComputed { ratio, hqlaAmount, netCashOutflow, asOf }` event |
| Monthly | LCR reported to BRC as part of the standard risk pack | LCR trend + HQLA composition + net cash outflow components |
| Quarterly | LCR projection over the next 3 months under base and adverse scenarios | ALCO forward-looking liquidity review |
| Annual (ILAAP cycle) | Full LCR narrative + 12-month projection under four scenarios | PA ILAAP submission (§6) |
| BA-return cadence | BA 325 submitted to PA per the SARB BA-return schedule (`ORG-PR-29` D2/2024) | Via the BA 325 LCR projection substrate; per [Owner Inbox/2026-05-10_bea-eitan-anya_d-reporting-capability-slice-3-ba-325-lcr.md](2026-05-10_bea-eitan-anya_d-reporting-capability-slice-3-ba-325-lcr.md) |

The BA 325 computation is implemented in `prototype/platform/reporting/ba-325-lcr.ts` (Bea's Reporting Capability Slice 3 substrate). The computation is a pure function over the event-derived trial balance; no parallel manual spreadsheet is maintained. LCR is a **projection** (a query over the event log), not a stored number — per Principle 1 (events are the only source of truth).

### 2.4 Significant-currency LCR monitoring

Per BCBS 144 Principle 6 `[citation: TBC — precise paragraph]`, the bank monitors liquidity positions in each significant currency (a currency in which the bank has aggregate liabilities ≥ 5% of total liabilities). For `Hoz Bank Limited`:

- **ZAR** — the primary and functional currency; the main BA 325 LCR is ZAR-denominated.
- **USD and EUR** — may become significant currencies at M2 (repo book) and as FX-Authorised-Dealer trading commences under `D-FX-AD-STATUS`. Eitan determines the significant-currency threshold quarterly; a separate FX-tenor LCR monitoring report is produced for each currency crossing the 5% threshold.
- FX mismatches between HQLA currency and liability currency are resolved via FX swaps executed within the Treasury mandate; the hedging cost and residual basis risk are reported to ALCO monthly.

### 2.5 LCR internal floor calibration

The +20pp internal management buffer above the PA minimum is a **planning floor** established under Eitan's Funding Strategy v1. It is superseded by the ILAAP-calibrated value when the W2 Slice 5 liquidity-side substrate lands (Ravi engineering; Eitan governance; Helena review). The calibration methodology is:

1. **Stress-shortfall analysis.** The ILAAP adverse scenario (30-day horizon, per §7) is run. The internal LCR floor is set at the level at which the bank's LCR does not breach the PA minimum under that adverse scenario, with a safety margin.
2. **Peer-bank calibration.** Peer-bank BA-return disclosures of LCR management buffers above the 100% regulatory minimum.
3. **Business strategy alignment.** A floor that unduly constrains deployable liquidity for the repo book (Saskia's M2 market-making franchise) is too conservative; the calibration finds the lowest floor consistent with items 1 and 2.

Until the ILAAP-calibrated floor supersedes, the +20pp planning floor is binding. The calibration brief is produced by Eitan, reviewed by Helena, and approved by the CEO as `D-LCR-FLOOR-CALIBRATION` (a downstream dispatch under the no-pause rule once W2 Slice 5 lands).

---

## 3. Net Stable Funding Ratio (NSFR) governance

### 3.1 Regulatory framework

The NSFR measures the structural stability of the bank's funding profile over a 1-year horizon. It ensures the bank carries sufficient stable funding to support its assets and activities beyond a 12-month window.

**Regulatory definition:** NSFR = Available Stable Funding (ASF) / Required Stable Funding (RSF).

**PA minimum requirement:** NSFR ≥ 100% at all times per Reg 26 `[citation: TBC — exact Reg 26 sub-clause on NSFR minimum]` and PA D1/2023 (`ORG-PR-43`).

**Internal floor (policy target):** NSFR ≥ 115% under normal conditions (PA minimum + 15pp internal management buffer). Same calibration posture as LCR: build-phase planning floor, superseded by ILAAP-calibrated value at W2 Slice 5.

**Activated obligation status:** `ORG-PR-07` (BCBS D335 / BA 326) and `ORG-PR-43` (PA D1/2023) — **IN FORCE** from commencement of trading.

### 3.2 ASF and RSF factor framework

**Available Stable Funding (ASF).** ASF is the weighted sum of the bank's funding sources, factored by their assessed stability over a 12-month stressed horizon.

| Funding source | ASF factor | Notes |
|---|---|---|
| Tier 1 and Tier 2 capital instruments | 100% | Permanent capital base |
| Other liabilities with effective remaining maturity ≥ 1 year | 100% | Long-term wholesale funding |
| Stable retail deposits and deposits from SME customers (if applicable) | 95% | Not a strategic funding source for Hoz Bank (institutional-only posture); applicable if institutional deposits meet the stability criteria |
| Less stable retail deposits (if applicable) | 90% | |
| Wholesale funding from non-financial corporates: effective maturity ≥ 6 months and < 1 year | 50% | |
| ZAR-denominated funding from financial corporates: effective maturity ≥ 6 months | Per PA D1/2023 phase-out schedule (see §3.3) | |
| All other liabilities not specified above | 0% | Short-term wholesale funding; effectively counts as zero stable funding |

**Required Stable Funding (RSF).** RSF is the weighted sum of the bank's assets and off-balance-sheet exposures, factored by their liquidity needs over a 12-month stressed horizon.

| Asset class | RSF factor | Notes |
|---|---|---|
| Level 1 HQLA (unencumbered, per NSFR definition) | 5% | Near-zero RSF reflects high liquidity |
| Level 2A assets (unencumbered) | 15% | |
| Level 2B assets and performing loans to financial institutions: < 6-month maturity | 10–15% | Per BCBS D335 `[citation: TBC]` |
| Performing loans to non-financial corporates: < 1-year maturity | 50% | |
| Performing loans to non-financial corporates: ≥ 1-year maturity | 65% | |
| Performing residential mortgage loans: ≥ 1-year maturity | 65% | |
| Other loans and assets | Per BCBS D335 schedule `[citation: TBC]` | |
| Undrawn committed credit and liquidity facilities | 5–10% (per counterparty type) | Per BCBS D335 `[citation: TBC]` |
| Off-balance-sheet exposures (other contingent obligations) | Per BCBS D335 schedule `[citation: TBC]` | |

The detailed factor table is maintained as a living register by Ravi (Treasury / ALM engineer) and reviewed by Eitan at each ALCO meeting.

### 3.3 PA D1/2023 ASF phase-out for ZAR financial-corporate funding

PA Directive 1 of 2023 (`ORG-PR-43`) phases out the ASF factor for ZAR-denominated funding from financial corporates, per the following schedule:

| Period | ASF factor for ZAR funding from financial corporates with effective maturity ≥ 6 months |
|---|---|
| 1 June 2023 – 31 December 2023 | 30% |
| 1 January 2024 – 31 December 2024 | 20% |
| 1 January 2025 – 31 December 2027 | 10% |
| From 1 January 2028 onward | 0% |

**Policy implication:** the bank's NSFR is structurally impacted if a material portion of its funding is ZAR wholesale funding from financial corporates (e.g. interbank deposits, repo book funding). Eitan monitors the phase-out trajectory quarterly and presents a **funding-source diversification analysis** to ALCO at each quarterly funding review. The diversification analysis assesses:

1. The share of total ASF that is ZAR financial-corporate funding.
2. The NSFR impact of each 5pp reduction in that share.
3. Recommended substitution funding sources (e.g. long-tenor non-financial-corporate funding, capital instruments, long-tenor wholesale funding from non-financial-corporate counterparties).

The substitution plan is a standing ALCO agenda item until the bank's NSFR profile is robust to the full phase-out (the 0% floor from 2028).

### 3.4 NSFR computation frequency and reporting

| Frequency | Computation | Reporting |
|---|---|---|
| Quarterly | NSFR computed as-of quarter-end | ALCO review; `NsfrComputed { ratio, asfAmount, rsfAmount, asOf }` event |
| Annual (ILAAP cycle) | Full NSFR narrative + 12-month projection under four scenarios | PA ILAAP submission (§6) |
| BA-return cadence | BA 326 submitted to PA per the SARB BA-return schedule | Via the NSFR projection substrate (W2 Slice 5) |

Under stressed conditions or when the NSFR approaches the internal floor, the computation frequency escalates to monthly.

### 3.5 Funding-profile monitoring between computation dates

Eitan monitors the **funding profile** (the distribution of liabilities by tenor, counterparty type, currency, and product) as a continuous activity — not just at NSFR computation dates. The monitoring framework covers:

- **Tenor concentration.** Maximum % of total liabilities maturing within any rolling 30-day, 90-day, and 1-year window. Limits are set by ALCO and reviewed annually.
- **Counterparty concentration.** Maximum % of total liabilities from any single counterparty or counterparty group. A single-counterparty concentration ≥ 10% of total liabilities triggers an ALCO-level review within 5 business days.
- **Currency concentration.** ZAR as a proportion of total funding vs non-ZAR. Material non-ZAR funding concentration triggers a significant-currency NSFR monitoring obligation (§2.4 cross-reference).
- **Product concentration.** Repo funding, interbank deposits, and wholesale commercial paper as separate categories; aggregate limits per category set by ALCO.

The funding-profile dashboard is produced by Ravi's ALM engine on a daily basis; the ALCO pack includes a funding-profile summary as a standing section.

---

## 4. Intraday liquidity management

### 4.1 Regulatory framework

Per BCBS 248 (*Monitoring tools for intraday liquidity management*, April 2013) and `ORG-PR-08`, the bank maintains the ability to monitor, manage, and report its intraday liquidity position — both under normal conditions and under stress.

`Hoz Bank Limited` operates as an **indirect NPS participant** (per `D-SAMOS-NON-CLEARING`, CEO-approved 2026-05-07). ZAR settlement flows through a sponsor/correspondent bank. The bank's intraday liquidity framework is calibrated against this indirect-participant posture: the relevant intraday exposures are the flows between `Hoz Bank Limited` and its correspondent bank, not direct NPS RTGS exposures.

### 4.2 Intraday liquidity monitoring tools (BCBS 248)

The bank implements the seven BCBS 248 intraday monitoring tools:

| Tool | BCBS 248 Reference | Hoz Bank Application |
|---|---|---|
| 1. Daily maximum intraday liquidity usage | Monitor § 16 `[citation: TBC]` | Peak net cumulative flow to/from the correspondent bank during each business day; reported in the end-of-day liquidity report |
| 2. Available intraday liquidity at the start of day | Monitor § 17 `[citation: TBC]` | Pre-positioned HQLA + undrawn credit lines with the correspondent bank available for intraday use |
| 3. Total payments | Monitor § 18 `[citation: TBC]` | Total value of all outgoing ZAR payments routed via the correspondent bank in the day |
| 4. Time-specific and other critical obligations | Monitor § 19 `[citation: TBC]` | Settlement obligations with defined deadlines (BondservAfrica cut-offs; JSE settlement cycles; SWIFT MT202COV cut-offs) |
| 5. Value of customer payments made on behalf of financial institution customers | Monitor § 20 `[citation: TBC]` | Agency-settlement flows for institutional clients (post-licence-day; nil in build-phase) |
| 6. Intraday credit lines extended to customers | Monitor § 21 `[citation: TBC]` | Intraday credit lines granted to institutional counterparties; tracked as contingent outflows |
| 7. Timing of intraday liquidity flows | Monitor § 22 `[citation: TBC]` | Real-time payment-flow timing map; time-of-day distribution of both incoming and outgoing flows |

The seven tools are implemented in the intraday-liquidity monitoring substrate (Ravi engineering; W2 Slice 5). Each tool produces a timestamped event stream: `IntradayLiquidityReported { measurementId, tool, asOfMinute, value }`. Until the W2 Slice 5 substrate is live, intraday monitoring is performed via the settlement-account watch (partial implementation — §4.5 substrate gaps).

### 4.3 Intraday liquidity buffer

The bank maintains a dedicated **intraday liquidity buffer** — pre-positioned liquidity available to meet intraday settlement obligations without recourse to intraday credit from the correspondent bank.

**Buffer sizing.** The intraday liquidity buffer is sized at:

- **Minimum:** the bank's 99th-percentile peak intraday net payment obligation observed over the prior 30 business days (backward-looking); or a floor of R5m during the build-phase, whichever is greater.
- **Target:** 120% of the backward-looking 99th-percentile peak (the +20% margin provides a stress cushion above the historical peak).

The buffer is held in:
- ZAR cash (SARB reserve balance via the correspondent bank's account); and / or
- Overnight government bonds that can be converted to cash at the start of each business day.

Eitan reviews the buffer size monthly. Buffer-sizing decisions are ALCO-level approvals (Eitan chair).

### 4.4 End-of-day position management

End-of-day targets:

1. **Zero net intraday credit from the correspondent bank.** The bank aims to end each business day with no outstanding intraday credit obligation to its correspondent bank. Any end-of-day net credit position is a High-severity intraday event per §9.2.
2. **Intraday buffer replenishment.** Any drawdown on the intraday buffer during the day is replenished before the start of the following business day. If replenishment is not possible, the deficit is reported to ALCO within 2 hours of end-of-day and a plan for same-day / next-day restoration is presented.
3. **HQLA stock check.** End-of-day HQLA stock is reconciled against the LCR buffer requirement. Any shortfall triggers the LCR breach escalation procedure (§9.3).

The end-of-day position report is produced by Ravi's ALM engine and reviewed by Eitan before 17:30 each business day. The report is an event (`EndOfDayLiquidityPosition { asOf, intradayCreditBalance, hqlaStock, lcrRatioEstimate }`) stored in the event log.

### 4.5 Intraday liquidity stress

Under intraday stress (defined as: peak intraday usage exceeds 80% of the intraday buffer, or a time-specific critical obligation is at risk of missing deadline), the intraday response protocol activates:

1. **30-minute response.** Eitan is notified in real-time via the intraday-liquidity watch (Ravi's substrate). Within 30 minutes Eitan assesses whether the stress is transient (expected to self-correct within the business day) or persistent.
2. **Transient stress.** No additional action beyond monitoring. Reported in the end-of-day position report.
3. **Persistent stress.** Eitan activates the first tier of the CFP intraday-funding escalation (§5.3 — Tier 1, same-day). Helena is notified immediately.
4. **Missed critical obligation.** Any missed time-specific settlement obligation is a Critical-severity event per §9.2, with immediate notification to Eitan, Helena, Devon (Chief Operating Officer, governance), and the CEO.

### 4.6 Substrate gap (build-phase)

Until the W2 Slice 5 intraday-liquidity substrate is live, the following intraday monitoring capabilities are in degraded mode:

- Real-time BCBS 248 tool 7 (timing of flows) — not live; manual end-of-day reconstruction only.
- Automated 30-minute intraday stress alert — not live; Ravi monitors manually during business hours.
- End-of-day automated position report — partial; the settlement-account watch provides balance information but not the full `IntradayLiquidityReported` event stream.

These gaps are surfaced as substrate roadmap items and are resolved by the W2 Slice 5 build. They do not prevent commencement of trading if the manual compensating controls are documented and attested.

---

## 5. Contingency Funding Plan (CFP)

### 5.1 Purpose and regulatory basis

The Contingency Funding Plan (CFP) is the bank's pre-designed, board-approved response to a liquidity stress event that cannot be managed through normal Treasury operations. It provides a structured set of funding-source alternatives, escalation triggers, communication protocols, and governance procedures to protect the bank's viability through a severe funding disruption.

**Regulatory basis:** BCBS 144 Principle 11 `[citation: TBC — precise paragraph]` + `ORG-PR-15`. The PA's ILAAP framework requires the CFP to be documented, tested, and rehearsed annually.

**Owner:** Eitan (Treasurer, governance) — plan maintenance and activation. Helena (Chief Risk Officer, governance) — stress-framework alignment and risk narrative. Devon (Chief Operating Officer, governance) — operational execution under CFP activation.

### 5.2 Trigger events and severity tiers

The CFP is organised in three activation tiers. Triggers are typed events in the event log; activation is automatic at Tier 1 (intraday) and requires ALCO + CRO sign-off at Tiers 2 and 3.

| Tier | Trigger (typed event pattern) | Description | Primary response |
|---|---|---|---|
| **Tier 1 — Intraday stress** | `IntradayStressDetected { severity: "persistent" }` or `CriticalSettlementObligationAtRisk { }` | Intraday liquidity shortfall or at-risk critical settlement obligation | Eitan activates same-day liquidity measures (see §5.3); no formal CFP activation; ALCO notified |
| **Tier 2 — 30-day stress** | `LcrRatioBreach { severity: "warning", threshold: 115 }` (i.e. LCR falls below the internal floor of 120% but remains ≥ 100%) **or** `FundingConcentrationAlertTriggered { }` (single-counterparty ≥ 15% of total liabilities) **or** `ExternalCreditEventDetected { impact: "material" }` | Elevated short-horizon liquidity stress; LCR between internal floor and regulatory minimum, or structural funding stress | ALCO convened within 24 hours; Tier-2 CFP measures activated; BRC notified; PA notified per Reg 26 notification obligations `[citation: TBC]` |
| **Tier 3 — Systemic / survival** | `LcrRatioBreach { severity: "critical", threshold: 100 }` (LCR at or below 100%) **or** `NsfrRatioBreach { severity: "critical" }` (NSFR at or below 100%) **or** `RecoveryEarlyWarningTriggered { }` (Recovery Plan early-warning indicator trip per the ICAAP/ILAAP/Recovery triplet) | Survival stress; bank cannot meet 30-day stress horizon at PA minimum; potential NSFR structural breach | Full CFP activation; CEO and Board notified immediately; PA engaged under the recovery-plan notification protocol; Helena activates the Recovery Plan assessment per [Owner Inbox/2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md](2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md) §3.3.5 |

The trigger thresholds above are the **policy default thresholds**. ALCO may set tighter thresholds in any quarter if market conditions warrant. Any ALCO-approved threshold tightening is an `ALCODecision { type: "cfp-threshold-tighten" }` event in the event log.

### 5.3 Funding-source hierarchy under CFP activation

**Tier 1 (same-day) — Intraday measures:**

1. **HQLA repo.** Repo out Level-1 HQLA (SAGBs) via government-securities repo with the correspondent bank or any BondservAfrica-clearing counterparty to generate same-day ZAR liquidity.
2. **Intraday credit line drawdown.** Draw on the pre-arranged intraday credit line with the correspondent bank (if intraday credit line is in place post-licence-day).
3. **Payment-flow optimisation.** Reschedule non-time-critical outgoing payments to the end of the business day to allow incoming funds to land first. Time-critical payments (BondservAfrica, settlement cut-offs) are never deferred.

**Tier 2 (1–30 days) — Short-term measures:**

1. **Asset-sale or repo of HQLA stock.** Monetise the HQLA buffer through outright sale or repo of Level-1 and Level-2A assets. Level-2B assets are only monetised if Level-1/2A stock is insufficient.
2. **Withdrawal of interbank placements.** Call back any interbank deposits placed with counterparty banks (tenor ≤ 7 days first, then ≤ 30 days).
3. **Curtailment of new lending and investment.** Suspend any new commitments that would reduce the liquidity buffer (new repo positions, new bond purchases, new interbank loans) except those required to manage market-making positions within existing approved limits.
4. **Wholesale funding issuance.** Explore emergency wholesale funding (interbank borrowing; certificate-of-deposit issuance) if the bank retains access to unsecured markets; assess market-access signal as part of the ALCO CFP-review meeting.
5. **Shareholder capital injections.** If the stress is anticipated to extend beyond 30 days, alert the CEO and major shareholder(s) to potential capital-injection or shareholder-loan requirement.

**Tier 3 (systemic) — Survival measures:**

1. All Tier-1 and Tier-2 measures activated at maximum scale.
2. **Recovery Plan activation.** Helena and Camille present the recovery options inventory (per the Recovery Plan, [Owner Inbox/2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md](2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md) §3.3.4) to the CEO and Board.
3. **Regulatory engagement.** CEO and Owen (Company Secretary, governance) engage the PA immediately; disclosure per the bank's regulatory-communication protocol.
4. **Balance-sheet restructuring.** Consider accelerated balance-sheet reduction (trading-book wind-down, loan sales) if liquidity cannot be restored within 5 business days.

The funding-source hierarchy is tested as part of the annual CFP rehearsal (§5.4).

### 5.4 CFP rehearsal cadence and evidence standard

Per BCBS 144 Principle 11 and `ORG-PR-15`, the CFP is **rehearsed annually**. The rehearsal is a formal exercise, not a desktop review.

**Rehearsal scope:**

1. **Scenario coverage.** Each rehearsal covers at least two scenarios: (a) a bank-specific stress (e.g. sudden loss of a major counterparty funding line); and (b) a market-wide stress (e.g. market-wide ZAR liquidity dislocation, analogous to a South African sovereign-spread widening event).
2. **Time horizon.** Each scenario is run over the 30-day stress horizon. The Tier-3 survival scenario is included at least once every three years.
3. **Funding-source availability.** For each scenario, Eitan tests the availability and operationalisation of each Tier-2 funding source: repo capacity (mark-to-market HQLA valuation × available counterparty capacity), interbank withdrawal lead time, wholesale-market access indicator.
4. **Escalation drill.** The ALCO escalation sequence (Tier 2 triggers → ALCO convened → CRO sign-off → BRC notification) is followed in the rehearsal.
5. **PA-participation scenario.** In years when the PA conducts its externally-facilitated liquidity stress simulation (per `ORG-PR-38`), the bank's participation in that PA simulation satisfies the market-wide stress requirement.

**Evidence standard.** The rehearsal is evidenced by:

- `CfpRehearsalCompleted { rehearsalDate, scenariosCovered[], findingCount, remediationItemsRaised }` event in the event log.
- A CFP rehearsal brief filed in [Owner Inbox/](../Owner%20Inbox/) by Eitan within 5 business days of the rehearsal.
- Any remediation items raised in the rehearsal tracked to closure in the risk-management action-item register.

**CFP rehearsal harness (W2 Slice 5).** Ravi builds the CFP rehearsal harness that automates the scenario-run and funding-source-availability computation. Until the harness is live, the rehearsal is conducted manually by Eitan and Ravi, with the evidence standards above satisfied by manual documentation.

### 5.5 PA-facilitated liquidity stress simulation (ORG-PR-38)

PA Directive 4 of 2021 (`ORG-PR-38`) mandates that banks participate in PA-coordinated externally-facilitated liquidity stress simulations on the cadence the PA sets. Eitan (Treasurer, governance) is the primary contact for PA-facilitated simulation coordination. The bank:

1. Registers for each PA-facilitated simulation as notified by the PA.
2. Submits the required data inputs on the schedule the PA specifies.
3. Reviews the PA's findings from the simulation and presents the findings and proposed responses to ALCO within 20 business days of receiving the PA's findings report.
4. Implements any remediation items identified in the PA's findings within the timelines the PA specifies (or within 90 calendar days for internally-prioritised items not given a PA-specified timeline).

Participation in the PA-facilitated simulation is an ALCO-level accountability; Helena reviews the risk implications of the findings; Devon reviews the operational-execution implications.

---

## 6. ILAAP governance

### 6.1 Purpose and structure of the ILAAP

The Internal Liquidity Adequacy Assessment Process (ILAAP) is the bank's annual self-assessment that its liquidity-risk management framework, buffers, and funding profile are adequate for its risk profile. The ILAAP document is submitted to the PA annually (and re-run on any material change) as the bank's primary liquidity Pillar-2 disclosure.

The ILAAP is one of three documents in the regulatory triplet — ICAAP, ILAAP, Recovery Plan — governed as a coherent whole under the framework at [Owner Inbox/2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md](2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md). The coherence requirement (§1.2 of that framework) means the ILAAP's liquidity-stress scenarios must be identical to the ICAAP's capital-stress scenarios — a market-shock scenario is applied consistently across both documents.

**Regulatory basis:** Banks Act 94 of 1990 + Reg 26 `[citation: TBC]` + BCBS 144 + PA *Directive on the Internal Liquidity Adequacy Assessment Process* `[citation: TBC — Mira curatorship route]` + `ORG-PR-14`.

**ILAAP owners:**

- Camille (Chief Financial Officer, governance) — ILAAP process chair.
- Eitan (Treasurer, governance) — ILAAP liquidity-side co-chair; primary author of the liquidity-risk narrative, LCR / NSFR / intraday-liquidity analysis, and CFP section.
- Helena (Chief Risk Officer, governance) — ILAAP risk-narrative review; ensures coherence with ICAAP stress scenarios and the RAS B3-family (liquidity-risk-appetite lines).

### 6.2 ILAAP section-set (as authorised by the framework spec)

The ILAAP document (full authoring under W2 Slice 5) comprises the following sections, each binding a named clause of this policy:

| § | Section | Owner | Policy section cross-reference |
|---|---|---|---|
| §1 | Executive summary + governance attestation (CEO + CFO + CRO + Treasurer sign-off) | Camille + Eitan | This policy §6.5 (governance sign-off) |
| §2 | Funding strategy + funding-source diversification | Eitan | This policy §3 (NSFR); Funding Strategy Policy ([Owner Inbox/2026-05-07_eitan_funding-strategy-v1.md](2026-05-07_eitan_funding-strategy-v1.md)) |
| §3 | Liquidity-risk-appetite framework (RAS B3-family — LCR, NSFR, intraday-liquidity buffer) | Helena (RAS calibration) + Eitan (treasury reading) | This policy §2.1 (LCR floor), §3.1 (NSFR floor), §4.3 (intraday buffer) |
| §4 | Intraday-liquidity monitoring (per BCBS 248 / `ORG-PR-08`) | Ravi + Eitan | This policy §4 (full intraday section) |
| §5 | Liquidity Coverage Ratio — daily projection, 30-day horizon | Ravi + Bea | This policy §2 (full LCR section) |
| §6 | Net Stable Funding Ratio — quarterly projection, 1-year horizon | Ravi + Bea | This policy §3 (full NSFR section) |
| §7 | Liquidity stress-testing (base + adverse + severely-adverse + 30-day / 90-day / 1-year horizons) | Rohan + Eitan | This policy §7 (stress-testing integration) |
| §8 | Contingency Funding Plan — rehearsed annually per BCBS 144 / `ORG-PR-15` | Eitan + Ravi | This policy §5 (full CFP section) |
| §9 | Collateral management — encumbered vs unencumbered HQLA | Ravi | This policy §2.2 (HQLA eligibility + concentration) |
| §10 | Group-consolidated liquidity reading (solo + consolidated per §1.2) | Eitan + Camille | This policy §1.2 (scope) |
| §11 | ILAAP governance — board approval pathway; annual cycle; material-change re-run | Camille + Eitan; Helena | This policy §6.3 – §6.5 |
| §12 | Independent validation of LCR / NSFR / intraday computations | Nadia (Independent-validation engineer) | This policy §8.4 (independent validation) |

This section-set is binding. The ILAAP document submitted to the PA must cover all twelve sections above. Missing or stub sections are a Vera finding.

### 6.3 Annual ILAAP cycle

The ILAAP cycle follows a defined governance sequence:

1. **Cycle initiation.** `IlaapCycleStarted { cycleYear, initiationDate }` event emitted by the ILAAP process chair (Camille) at the start of each annual cycle. Timing: no later than 4 months before the bank's financial year-end.
2. **Data collection.** Eitan collects LCR / NSFR / intraday liquidity / CFP input data from Ravi's ALM engine and Bea's reporting substrate. Data freeze date is documented in the ILAAP.
3. **Stress-scenario runs.** Rohan (Risk engineer, engineering — reports to Helena) runs the liquidity-side stress scenarios (§7) using the shared stress-projection engine (ICAAP/ILAAP coherence per the framework spec §1.2). Output events: `LiquidityStressScenarioRun { scenarioId, horizon, severity }` per scenario.
4. **ILAAP document draft.** Eitan authors the liquidity-side narrative (sections §2–§9 of the ILAAP above); Camille reviews the overall document for internal consistency; Helena reviews for RAS-coherence and stress-scenario alignment with the ICAAP.
5. **Independent validation.** Nadia reviews the LCR / NSFR / intraday computation substrates and the stress scenarios for model risk. `ModelValidationCompleted { modelId: "liquidity-substrate", findings[] }` event emitted.
6. **ILAAP draft reviewed.** `IlaapDraftReviewed { reviewerId, reviewDate, majorFindingsCount }` event. The review includes: (a) Camille's capital-side review for consistency with the ICAAP; (b) Helena's stress-narrative review; (c) Nadia's independent-validation findings.
7. **Board attestation.** ILAAP presented to the Board (BRC review → Board approval in steady state; CEO approval under `D-THIN-HUMAN-LAYER-MINIMUM` interim). `IlaapBoardAttested { attestor, asOf, attestationType }` event emitted.
8. **PA submission.** ILAAP submitted to the PA per the PA's submission schedule. `IlaapDocumentSubmitted { boardAttestation, submissionDate, submissionChannelRef }` event emitted.

The full cycle (initiation to submission) is targeted to complete within 90 calendar days. Material-change-triggered re-runs are targeted to complete within 60 calendar days.

### 6.4 Material-change trigger for ILAAP re-run

A material change in any of the following triggers an out-of-cycle ILAAP re-run:

- **Balance-sheet structure.** A change of ≥ 20% in total assets, total funding, or the HQLA stock, resulting from business events (not market movements) since the last ILAAP.
- **Business model change.** Entry into a new business line (per the New Product Approval process, `ORG-PR-25` / `D-NEW-PRODUCT-APPROVAL-POLICY`), exit from a material business line, or a material change in the product mix that alters the bank's liquidity risk profile.
- **Legal entity perimeter change.** Addition or removal of an entity from the consolidated regulatory perimeter (per `D-REGULATORY-PERIMETER`).
- **Regulatory change.** A material change in Reg 26 LCR / NSFR requirements, or a new PA directive that changes the ILAAP framework.
- **Funding-strategy change.** A CEO or Board decision that materially alters the bank's funding-source mix (e.g. decision to access a new funding market; decision to issue long-term notes).

The material-change trigger is assessed by Camille and Eitan jointly. If either concludes a re-run is required, the re-run is initiated without further approval. If neither concludes a re-run is required but Helena believes one is warranted on risk grounds, Helena escalates to the CEO for a decision.

The trigger event pattern: `MaterialChangeDeclared { changeId, description }` → `IlaapMaterialChangeAssessed { triggerEventId, reRunRequired: true | false, assessorId }`.

### 6.5 ILAAP governance sign-off and PA submission

**Interim governance (build-phase, pre-BRC constitution, per `D-THIN-HUMAN-LAYER-MINIMUM`):**

The ILAAP is attested by: Camille (CFO) + Eitan (Treasurer) + Helena (CRO) + Owen (Company Secretary, governance) joint sign-off → CEO (Marc) approval. The CEO approval is recorded as a `CeoDecision` event with the ILAAP document BLAKE3 hash as a payload field.

**Steady-state governance (post-licence-day, BRC constituted):**

- BRC review (at a dedicated BRC session with the full ILAAP document tabled).
- Board approval at the next Board meeting (ILAAP is a Board-reserved matter per BCBS 144 Principle 14 `[citation: TBC]`).
- CEO sign-off on the final submission package.
- PA submission via the PA's electronic submission channel `[citation: TBC — PA submission portal / BA-returns submission route]`.

**Attestation content.** The governance sign-off attests that:

1. The ILAAP has been prepared in accordance with this Liquidity Risk Management Policy and the ILAAP framework spec.
2. The data inputs are complete, consistent with the event-log state, and subject to the classification-level sign-off described in §6.3 step (3).
3. The stress-scenario coverage is adequate and consistent with the bank's ICAAP stress scenarios.
4. The CFP is current, rehearsed, and reflects the bank's actual funding-source inventory.
5. The board / executive is satisfied that the bank's liquidity position is adequate and that the buffers are maintained above the policy floors set in this policy.
6. Any limitations or estimation uncertainties are disclosed explicitly in the ILAAP document.

---

## 7. Stress-testing integration

### 7.1 Liquidity stress-testing framework

The bank's liquidity stress-testing programme is governed by the Stress Testing Policy (`ORG-PR-12`) and integrated with the ILAAP through the shared stress-projection engine (W2 Slice 4; Rohan engineering; Helena governance). Per the ICAAP/ILAAP/Recovery triplet coherence requirement (framework spec §1.2), **the same stress scenarios are run across both the ICAAP (capital-side) and the ILAAP (liquidity-side)**.

### 7.2 Scenario taxonomy

The bank runs four standard scenarios per the Stress Testing Policy:

| Scenario | Capital-side output | Liquidity-side output | Horizon |
|---|---|---|---|
| **Base** | Capital ratios under business-plan assumptions | LCR, NSFR, intraday liquidity buffer under normal conditions | 1 year (ICAAP); 30 days / 1 year (ILAAP) |
| **Adverse** | Capital ratios under a plausible but severe macro-financial shock | LCR / NSFR under a severe but not tail-risk funding stress (e.g. 50bp SA sovereign spread widening + 20% wholesale funding withdrawal) | 30 days + 90 days + 1 year |
| **Severely adverse** | Capital ratios under a tail-risk macro-financial shock | LCR / NSFR at a combined idiosyncratic (bank-specific) + systemic (market-wide) stress; HQLA fire-sale assumptions; zero new funding access for 30 days | 30 days + 90 days |
| **Reverse stress** | What shock path would reduce CET1 to the PA minimum? | What funding shock + HQLA haircut combination would breach the LCR = 100% floor? | Point-of-failure analysis |

For each scenario, the liquidity-side output is:

1. **LCR** at each horizon: projected HQLA stock (post-stress haircuts) / projected net cash outflows (stress-scenario run-off rates applied to the current funding profile).
2. **NSFR** at each horizon: projected ASF / projected RSF (stress-scenario maturity-shortening applied to the funding profile; stress-ASF factors applied per BCBS D335).
3. **Intraday liquidity** under the adverse and severely-adverse scenarios: peak intraday usage vs intraday buffer; days-to-buffer-exhaustion under the stress assumption.
4. **Survival horizon** under the severely-adverse scenario: number of days the bank can survive with zero new funding access, relying solely on its HQLA stock and available CFP funding sources.

### 7.3 PA-facilitated externally-facilitated liquidity stress simulation (ORG-PR-38)

In addition to the bank's own stress-testing programme, the bank participates in PA-facilitated liquidity stress simulations per `ORG-PR-38` (PA D4/2021). The PA's simulation scenarios are mapped to the bank's internal scenario taxonomy above; any PA scenarios that do not map are treated as additional scenario inputs for that year's ILAAP. Findings from the PA's simulation are incorporated into the ILAAP narrative.

### 7.4 Stress-test output governance

Stress-test outputs are reviewed by ALCO at each quarterly meeting and by the BRC at each BRC meeting. Stress-test results that indicate a breach of the internal LCR or NSFR floors under the adverse scenario trigger a **management action plan** presented to ALCO within 20 business days. Management actions are documented as `ALCODecision { type: "liquidity-stress-management-action" }` events.

Stress-test results that indicate a breach of the regulatory minimum under the adverse scenario are escalated immediately to Helena and Camille, who assess whether a CFP activation or ILAAP re-run is required.

---

## 8. Roles, responsibilities, and governance bodies

### 8.1 First line — Treasury function

**Eitan (Treasurer, governance)** — first-line ownership of liquidity risk. Responsible for:
- Day-to-day liquidity management within policy limits.
- HQLA portfolio management (composition, concentration, monetisation capability).
- LCR and NSFR compliance; daily and quarterly computation.
- Intraday liquidity monitoring (with Ravi).
- CFP plan maintenance and rehearsal (with Ravi).
- ILAAP liquidity-side authoring and ALCO pack production.
- Funding-profile monitoring, counterparty limits, and tenor management.

**Ravi (Treasury / ALM engineer, engineering — reports to Eitan)** — engineering substrate. Responsible for:
- ALM engine: daily LCR / NSFR projections, intraday monitoring tools (BCBS 248), end-of-day position reporting.
- CFP rehearsal harness (W2 Slice 5 substrate).
- Funding-profile dashboard and ALCO pack data feeds.

**Bea (Accounting & financial reporting engineer, engineering — reports to Camille)** — BA-return computation. Responsible for:
- BA 325 (LCR) and BA 326 (NSFR) projection and submission via the reporting substrate.
- Reconciliation between the event-log-derived trial balance and the BA-return computations.

### 8.2 Second line — Risk and Compliance functions

**Helena (Chief Risk Officer, governance)** — second-line oversight and challenge of liquidity risk. Responsible for:
- Setting and maintaining the liquidity-risk-appetite framework (RAS B3-family).
- Reviewing the ILAAP risk narrative for adequacy and coherence with ICAAP.
- Challenging Eitan's first-line liquidity-management decisions where they approach or breach risk-appetite lines.
- Stress-testing programme governance (cross-reference: Stress Testing Policy `ORG-PR-12`).
- ILAAP co-author on the risk-narrative section; ILAAP governance sign-off (§6.5).

**Rohan (Risk engineer, engineering — reports to Helena)** — stress-projection engine. Responsible for:
- Running the shared liquidity-side stress scenarios (W2 Slice 4) via the stress-projection engine.
- Producing `LiquidityStressScenarioRun { }` events per scenario.

**Zara (Chief Compliance Officer, governance)** — compliance-obligation monitoring. Responsible for:
- Obligations-register curation oversight (via Mira).
- Monitoring the bank's compliance with `ORG-PR-06`, `ORG-PR-07`, `ORG-PR-08`, `ORG-PR-14`, `ORG-PR-15`, `ORG-PR-36`, `ORG-PR-38`, `ORG-PR-43`.
- Notifying the CEO and board of any regulatory-change impact on liquidity obligations.

### 8.3 ALCO (Asset-Liability Committee)

ALCO is the bank's standing governance committee for balance-sheet, liquidity, and market-risk management. ALCO meets monthly in normal conditions and within 24 hours on Tier-2 CFP trigger activation.

**Chair:** Eitan (Treasurer, governance). **Members:** Camille (CFO, governance), Helena (CRO, governance), Saskia (Head of Global Markets, governance), Devon (COO, governance), Bea (reporting data), Ravi (ALM data). **Secretary:** Owen (Company Secretary, governance — recording governance events).

**Standing ALCO agenda (liquidity section):**
- LCR status and trend.
- NSFR status and funding-profile review (quarterly).
- Intraday buffer adequacy review.
- HQLA composition and concentration limits.
- CFP trigger status.
- Stress-test liquidity results (quarterly).
- Funding-source diversification (quarterly; PA D1/2023 phase-out tracking).

Every ALCO decision is an `ALCODecision { decisionType, decisionId, asOf }` event in the event log. No liquidity-management decision is made outside the event log.

### 8.4 Independent validation

**Nadia (Independent-validation engineer, engineering — reports to Helena; peer-in-second-line)** validates the liquidity-risk models per the Model Risk Policy (`ORG-PR-21` / `D-MODEL-RISK-POLICY-APPROVED`):

- **LCR computation model (Bea's BA 325 substrate)** — Tier 1 model. Pre-deployment validation + annual revalidation. Validation covers: HQLA cap arithmetic correctness; outflow/inflow rate schedule completeness; 75% inflow cap + 25% floor application; per-entity isolation; schema conformance.
- **NSFR computation model** — Tier 1 model. Same validation standard.
- **Intraday liquidity monitoring tools** — Tier 2 model. Pre-deployment validation + biennial revalidation.
- **Stress-projection engine (liquidity-side scenarios)** — Tier 1 model. Validated in conjunction with the ICAAP stress-projection validation (shared engine; one validation report covers both).

Nadia's validation events (`ModelValidationCompleted { modelId, modelVersion, findings[] }`) are separate from the engineering-side `*Computed` events. Findings with severity "Critical" or "High" suspend production use of the relevant model until resolved.

### 8.5 Third line — Internal audit

**Vera (internal audit engineer, engineering — reports to Thandiwe (Chief Audit Executive, governance))** provides third-line assurance on the operation of the liquidity-risk management framework. Vera's audit programme includes:

- Annual assurance on LCR / NSFR computation accuracy, process completeness, and reporting integrity.
- Annual review of CFP rehearsal evidence (evidence standard per §5.4).
- Annual review of the ILAAP process against the governance sequence in §6.3.
- Reporting to the Audit Forum (chaired by Owen until a Board AC is constituted) per the third-line independence discipline in CLAUDE.md "Top-of-house reporting".

---

## 9. Escalation pathways and breach taxonomy

### 9.1 Breach classification

Liquidity-risk breaches are classified by severity:

| Severity | Definition | Escalation |
|---|---|---|
| **Critical** | LCR ≤ 100% (PA minimum breach) or NSFR ≤ 100% (PA minimum breach) or missed critical settlement obligation | Immediate notification to: Helena (CRO), Camille (CFO), Eitan (Treasurer), Devon (COO), CEO. ALCO convened within 4 hours. BRC notified same day. PA notified per Reg 26 notification obligations `[citation: TBC]`. Tier-3 CFP activated. |
| **High** | LCR between 100% and internal floor (115% / 120% per calibration) or NSFR between 100% and internal floor (115%) or HQLA concentration limit breach or single-counterparty funding concentration ≥ 15% | ALCO notified within 2 hours. Helena notified within 2 hours. ALCO convened within 24 hours. Tier-2 CFP measures reviewed. BRC notified at next meeting (or earlier if the breach persists ≥ 3 business days). |
| **Medium** | LCR at or below 130% (early warning — 10pp above internal floor) or funding-tenor concentration approaching ALCO-set limit | Eitan (first line) self-assesses and documents the cause and projected restoration path. Helena notified within 1 business day. Included in next ALCO meeting agenda. |
| **Low** | Individual HQLA category concentration approaching category limit or minor intraday-tool metric exceeding normal range | Eitan (first line) documents in the end-of-day position report. Included in ALCO standing monitoring section. |

### 9.2 Typed event patterns for breach escalation

Every breach at severity Medium or above is a typed event in the event log:

- `LcrRatioBreach { severity, threshold, actualRatio, asOf, detectedBy }` — LCR breach event.
- `NsfrRatioBreach { severity, threshold, actualRatio, asOf, detectedBy }` — NSFR breach event.
- `IntradayStressDetected { severity, tool, observedValue, threshold, asOf }` — intraday tool breach.
- `FundingConcentrationAlertTriggered { counterpartyId, concentration, threshold, asOf }` — funding concentration alert.
- `HqlaConcentrationBreached { tier, category, concentration, limit, asOf }` — HQLA category concentration breach.

These events feed:
- The ALCO dashboard (Ravi's real-time monitoring).
- Helena's risk-watch dashboard.
- Vera's overnight recon (`recon:liquidity-breach-monitoring` — planned, Vera Wave-4 scope).

### 9.3 Restoration and remediation

For every High or Critical breach:

1. **Cause analysis.** Eitan documents the root cause within 1 business day (Critical) or 2 business days (High) of the breach.
2. **Restoration plan.** Eitan presents a restoration plan to ALCO within 1 business day (Critical) or 3 business days (High). The restoration plan identifies the specific liquidity action(s) and the timeline to restore the ratio to the internal floor.
3. **Closure.** The breach is marked closed only when the ratio returns to the internal floor (not the PA minimum) and has remained there for 3 consecutive business days. Closure is evidenced by `LiquidityBreachResolved { breachEventId, resolutionDate, finalRatio }` event.
4. **Post-mortem.** For Critical breaches, Eitan and Helena produce a post-mortem brief filed in [Owner Inbox/](../Owner%20Inbox/) within 10 business days. The post-mortem identifies whether the breach reflects a policy gap requiring amendment, a process failure requiring procedure update, or a market condition beyond the bank's control.

---

## 10. Obligations closed by this policy

This policy discharges the following obligations from the register at `Regulations/_obligations-register.md`. Each row is cited by its register ID; the discharge mechanism is the policy provision that implements the obligation.

| Obligation ID | Citation | Obligation description | Discharge mechanism in this policy |
|---|---|---|---|
| `ORG-PR-06` | BCBS D295 / BA 325 | Maintain LCR ≥ 100% (PA minimum); buffer to internal floor (B2 / B3 calibration) | Section 2 — LCR governance framework; internal floor §2.1 and §2.5; computation §2.3; BA 325 projection substrate |
| `ORG-PR-07` | BCBS D335 / BA 326 | Maintain NSFR ≥ 100% (PA minimum); buffer to internal floor | Section 3 — NSFR governance framework; internal floor §3.1; computation §3.4; PA D1/2023 phase-out tracking §3.3 |
| `ORG-PR-08` | BCBS 248 | Monitor intraday liquidity per BCBS 248 metrics; report to PA | Section 4 — full intraday liquidity section; seven BCBS 248 tools §4.2; intraday buffer §4.3; end-of-day §4.4; stress response §4.5 |
| `ORG-PR-14` | Banks Act + PA | Submit annual ILAAP to PA | Section 6 — ILAAP governance; annual cycle §6.3; PA submission §6.5; material-change re-run §6.4 |
| `ORG-PR-15` | BCBS 144 | Maintain Contingency Funding Plan; rehearsed annually | Section 5 — full CFP section; annual rehearsal §5.4; evidence standard §5.4 |
| `ORG-PR-36` | PA D6/2015 — Revised LCR | SA-specific LCR calibration; proposed Government Notice | Section 2 — LCR framework reads against D6/2015 SA calibration; Reg 26(7) HQLA eligibility §2.2; Reg 26(11) inflow cap §2.3 |
| `ORG-PR-38` | PA D4/2021 — Externally-facilitated liquidity stress simulation | Banks must participate in PA-facilitated liquidity stress simulations | Section 5.5 — PA-facilitated simulation participation; Section 7.3 — integration with internal stress scenarios; findings incorporated in ILAAP §6.2 §7 |
| `ORG-PR-43` | PA D1/2023 — Matters related to NSFR | NSFR calibration; ZAR financial-corporate ASF phase-out (D1/2023 replaces D8/2017) | Section 3 — NSFR governance; ASF phase-out schedule §3.3; funding-diversification monitoring §3.3; ALCO-level phase-out tracking §8.3 |

**Residual obligations not discharged by this policy:**

- `ORG-BNK-ILAAP-CONS` (consolidated ILAAP submission) — partially discharged by §6.5 (consolidated basis submission); the consolidated LCR / NSFR computation substrate (group perimeter read-through per `D-REGULATORY-PERIMETER`) is a W2 Slice 5 deliverable.
- `ORG-PR-11` (IRRBB EVE / NII) — discharged by the IRRBB Policy (separate policy, `ORG-PR-11` IN FORCE); cross-referenced in the ILAAP §2 (funding-cost risk narrative).
- `ORG-PR-12` (integrated stress testing) — discharged by the Stress Testing Policy; this policy's §7 provides the liquidity-specific integration layer.

---

## 11. Citation surface and change log

### 11.1 Primary citations

| Citation | Instrument | Read by | `[citation: TBC]` status |
|---|---|---|---|
| Banks Act 94 of 1990 | §§ 60-72 + liquidity provisions `[citation: TBC]` | §1.3, §6.1 | Ratified by Imani + external counsel at licence-application gate |
| Regulations Relating to Banks 2012 (as amended) — **Reg 26** | Liquidity-risk management (LCR + NSFR + ILAAP + intraday) `[citation: TBC — sub-clause indices]` | §§ 2.1, 3.1, 4.1, 6.1 | Ratified by Imani + external counsel at licence-application gate |
| PA Directive 6 of 2015 — Revised LCR | `ORG-PR-36` — SA LCR calibration `[citation: TBC — precise § references]` | §2.1, §2.2, §2.3 | WS-INSTRUMENT-ANALYSES (Mira + Imani) |
| PA Directive 4 of 2021 — Externally-facilitated liquidity stress simulation | `ORG-PR-38` `[citation: TBC — precise § references]` | §5.5, §7.3 | WS-INSTRUMENT-ANALYSES |
| PA Directive 1 of 2023 — NSFR | `ORG-PR-43` `[citation: TBC — precise § references]` | §3.1, §3.3 | WS-INSTRUMENT-ANALYSES |
| PA *Directive on the ILAAP* | `ORG-PR-14` `[citation: TBC — directive title + reference number]` | §6.1 | Mira curatorship route |
| BCBS 144 | *Principles for Sound Liquidity Risk Management and Supervision*, September 2008 | §5.1, §6.1 | Standards citation; no sub-clause TBC beyond those explicitly marked |
| BCBS D295 | *Basel III: The LCR and liquidity risk monitoring tools*, January 2013 | §2.1, §2.2, §2.3 | |
| BCBS D335 | *Basel III: The Net Stable Funding Ratio*, October 2014 | §3.1, §3.2 | |
| BCBS 248 | *Monitoring tools for intraday liquidity management*, April 2013 | §4.2 | |

### 11.2 Companion documents cited

- ICAAP / ILAAP / Recovery framework spec — [Owner Inbox/2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md](2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md).
- Funding Strategy v1 — [Owner Inbox/2026-05-07_eitan_funding-strategy-v1.md](2026-05-07_eitan_funding-strategy-v1.md).
- Capital Plan v1 — [Owner Inbox/2026-05-07_camille_capital-plan-v1.md](2026-05-07_camille_capital-plan-v1.md).
- BA 325 LCR substrate spec — [Owner Inbox/2026-05-10_bea-eitan-anya_d-reporting-capability-slice-3-ba-325-lcr.md](2026-05-10_bea-eitan-anya_d-reporting-capability-slice-3-ba-325-lcr.md).
- `D-REGULATORY-PERIMETER` decision record — [Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md](2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md).
- `D-REGULATORY-READINESS-GATE-PLAN` decision record — [Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-regulatory-readiness-gate-plan.md](2026-05-10_scrooge_ceo-decision-record_d-regulatory-readiness-gate-plan.md).
- `D-SAMOS-NON-CLEARING` decision record — [Owner Inbox/2026-05-07_ceo-decision_samos-non-clearing.md](2026-05-07_ceo-decision_samos-non-clearing.md).
- Risk Appetite Statement and Framework — [Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md](2026-05-06_risk-appetite-statement-and-framework.md).
- Stress Testing Policy — within [Owner Inbox/2026-05-06_core-policies-risk.md](2026-05-06_core-policies-risk.md) §8.
- Obligations register — `Regulations/_obligations-register.md`.
- Legal entity tree — `Regulations/_legal-entity-tree.md`.

### 11.3 Cross-reference obligations (not discharged by this policy but material to it)

| Obligation ID | Citation | Relevance |
|---|---|---|
| `ORG-PR-11` | IRRBB EVE / NII | Funding-cost risk narrative in the ILAAP; IRRBB Policy discharges this obligation |
| `ORG-PR-12` | Banks Act + PA stress-testing guidance | ILAAP stress scenarios run against the Stress Testing Policy framework; this policy's §7 is the integration layer |
| `ORG-PR-01` | Capital adequacy | ILAAP and ICAAP share stress scenarios; LCR / NSFR buffers must not threaten capital adequacy |
| `ORG-PR-04` | RAS B2 CET1 management buffer | ILAAP B3-family liquidity buffers calibrated consistently with ICAAP B2 capital buffers |
| `ORG-BNK-ILAAP-CONS` | Consolidated ILAAP | Consolidated ILAAP submission substrate (W2 Slice 5); partially discharged here via §6.5 consolidated-basis submission reference |

### 11.4 Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | 2026-05-11 | Camille (Chief Financial Officer, governance) + Eitan (Treasurer, governance) + Helena (Chief Risk Officer, governance) | Initial policy authored under W2 Slice 5 of `D-REGULATORY-READINESS-GATE-PLAN`. Full standalone policy covering: §1 scope + regulatory hierarchy (Banks Act + Reg 26 + BCBS 144 + BCBS D295 + BCBS D335 + BCBS 248 + PA D6/2015 + PA D4/2021 + PA D1/2023); §2 LCR governance (PA-min ≥ 100%, internal floor ≥ 120%, HQLA eligibility + concentration limits, daily computation, BA 325 substrate cross-reference, significant-currency monitoring, floor calibration methodology); §3 NSFR governance (PA-min ≥ 100%, internal floor ≥ 115%, ASF + RSF factor framework, PA D1/2023 phase-out schedule for ZAR financial-corporate ASF, quarterly computation, funding-profile monitoring); §4 intraday liquidity (BCBS 248 seven monitoring tools, intraday buffer sizing, end-of-day position management, intraday stress response protocol, build-phase substrate gaps); §5 CFP (three activation tiers with typed trigger event patterns, funding-source hierarchy Tiers 1–3, annual rehearsal cadence + evidence standard, PA D4/2021 externally-facilitated simulation participation); §6 ILAAP governance (annual cycle governance sequence with seven typed events, material-change trigger, twelve-section ILAAP section-set, board attestation + PA submission pathway); §7 stress-testing integration (four-scenario taxonomy coherent with ICAAP, liquidity-side output set per scenario, PA-facilitated simulation integration, ALCO governance of outputs); §8 roles and governance bodies (first line Eitan + Ravi + Bea; second line Helena + Rohan + Zara; ALCO composition + standing agenda; Nadia independent validation; Vera third-line assurance); §9 escalation + breach taxonomy (Critical / High / Medium / Low; typed event patterns; restoration + remediation; post-mortem requirement); §10 eight obligations discharged (ORG-PR-06 through ORG-PR-08, ORG-PR-14, ORG-PR-15, ORG-PR-36, ORG-PR-38, ORG-PR-43); §11 citation surface + companion document map + change log. All unresolved sub-clause indices carry `[citation: TBC]` per Principle 2 (no invented citations). Substrate gaps flagged explicitly as build-phase items; none prevents commencement of trading if manual compensating controls are documented. |
