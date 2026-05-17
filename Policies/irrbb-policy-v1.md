---
policy-id: irrbb-policy
title: Interest Rate Risk in the Banking Book (IRRBB) Policy v1
version: "1"
status: IN FORCE
owner: Helena (Chief Risk Officer, governance) + Eitan (ALM / interest-rate-risk engineer, engineering — reports to Helena)
effective-from: "2026-05-17"
citations:
  - BCBS D368 (April 2016, updated 2022) — Standards for Interest Rate Risk in the Banking Book
  - Basel III capital framework — Pillar 2 ICAAP capital add-on for IRRBB
  - SARB BA 330 — IRRBB disclosure return
  - SARB BA 700 — ICAAP capital adequacy return (Pillar 2 add-on)
  - D-POLICY-DOCUMENT-HOME
author: Helena (Chief Risk Officer, governance) + Eitan (ALM / interest-rate-risk engineer, engineering — reports to Helena)
date: 2026-05-17
summary: >
  Establishes Hoz Bank Limited's governance framework for identifying, measuring, monitoring, and managing interest rate
  risk in the banking book (IRRBB) through Economic Value of Equity (EVE) and Net Interest Income (NII) metrics, using the
  six BCBS D368 standardised shock scenarios. Closes obligation ORG-PR-11. LICENCE-BIND.
decision-required: false
riskTaxonomy:
  - RT-IRRBB
---

# Interest Rate Risk in the Banking Book (IRRBB) Policy v1

> **Status:** IN FORCE (policy layer). ALM engine substrate (EVE/NII calculation, shock scenarios, ALCO reporting) tracked under Eitan's workstream; ICAAP capital add-on disclosure tracked under Helena's ICAAP programme.
>
> **Authors:** Helena (Chief Risk Officer, governance) leads policy governance; Eitan (ALM / interest-rate-risk engineer, engineering — reports to Helena) leads substrate engineering and measurement methodology.
>
> **LICENCE-BIND:** IRRBB measurement and management obligations are Pillar 2 supervisory expectations that bind from commencement of banking operations. The substrate is built and calibrated during the build phase; disclosures (BA 330) and the ICAAP capital add-on (BA 700) activate at licence-day.

---

## 0. Policy overview

| Attribute | Value |
|---|---|
| Policy name | IRRBB Policy |
| Version | v1 |
| Effective date | 2026-05-17 |
| Approval authority | Board Risk Committee (BRC) |
| Policy owner | Helena (Chief Risk Officer, governance) |
| Engineering owner | Eitan (ALM / interest-rate-risk engineer, engineering — reports to Helena) |
| Review cadence | Annual; triggered by material change in balance sheet composition, interest rate regime, or SARB supervisory guidance |
| Risk appetite anchor | EVE impact ≤ 15% of Tier 1 capital (BCBS outlier threshold); internal ALCO limit TBD at first ALCO calibration run |
| LICENCE-BIND | Yes — IRRBB measurement activates at commencement of banking operations; substrate built and tested in build phase |
| Obligations closed | [`ORG-PR-11`](../Regulations/_obligations-register.md) (BCBS D368 — measure and manage IRRBB through EVE and NII metrics) |

---

## 1. IRRBB Governance and Authority

### 1.1 Purpose

This policy establishes Hoz Bank Limited's framework for identifying, measuring, monitoring, and managing interest rate risk in the banking book (IRRBB). It gives effect to the BCBS D368 Standards for Interest Rate Risk in the Banking Book and the SARB Prudential Authority's adoption of those standards as Pillar 2 supervisory guidance.

IRRBB is the risk to the bank's economic value and earnings arising from movements in interest rates that affect banking-book positions — primarily the fixed-income securities portfolio, any lending/deposit positions held to maturity, and interest-sensitive derivative hedges not held in the trading book. Given the bank's strategic focus as an institutional global-markets dealer, the banking book primarily includes funding instruments, liquidity buffers (South African government bonds held for liquidity), and any structural interest rate positions arising from the bank's own balance sheet management. Trading-book interest rate risk (the market-making book) is governed by the Market Risk Policy.

### 1.2 Statutory and supervisory authority

This policy is adopted under and gives effect to:

- **BCBS D368** (April 2016, updated 2022) — *Standards for Interest Rate Risk in the Banking Book* — the Basel Committee's Pillar 2 standard; adopted by the SARB Prudential Authority as supervisory expectation under the Banks Act 94 of 1990 and the Regulations Relating to Banks.
- **Basel III capital framework** — Pillar 2 / Internal Capital Adequacy Assessment Process (ICAAP) — IRRBB is a Pillar 2 risk type; material IRRBB exposure translates to a capital add-on under the ICAAP (BA 700 return).
- **SARB BA 330** — *Banking Book Interest Rate Risk Return* — mandatory SARB supervisory disclosure; quarterly submission; populated from Eitan's EVE/NII calculations.
- **SARB BA 700** — *ICAAP capital adequacy return* — Pillar 2 capital add-on for IRRBB included in the annual ICAAP submission.
- **SARB Guidance Note on ICAAP** — mandates that the ICAAP addresses all Pillar 2 risk types including IRRBB; the IRRBB capital add-on methodology must be documented and defensible.

Register row: [`ORG-PR-11`](../Regulations/_obligations-register.md).

### 1.3 Entity scope

This policy applies to:

- **Hoz Bank Limited** — primary scope; all banking-book positions including the liquidity portfolio, funding instruments, and structural balance sheet exposures.
- **Hoz Group Limited** — group-level IRRBB reporting to the extent the group holds material banking-book positions distinct from Hoz Bank Limited (immaterial in the build phase; reviewed at licence-day).

Trading-book positions are excluded from IRRBB scope; they are subject to the Market Risk Policy.

### 1.4 Governance and roles

| Role | Holder | Authority |
|---|---|---|
| Policy owner / ALCO chair | Helena (Chief Risk Officer, governance) | Pillar 2 IRRBB oversight; ALCO chairperson; ICAAP sign-off |
| Engineering owner / measurement | Eitan (ALM / interest-rate-risk engineer, engineering — reports to Helena) | EVE/NII calculation engine; shock-scenario pipeline; BA 330 population |
| Board oversight | BRC (Board Risk Committee) | Approves risk appetite; receives quarterly ALCO IRRBB report; approves ICAAP IRRBB section |
| ALCO membership | Helena (chair), Eitan, Saskia (Head of Global Markets, governance), Devon (CFO, governance), Rashida (COO, governance) | Monthly IRRBB review; limit calibration |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, CAE, governance) | Annual IRRBB methodology review; measurement-accuracy recon |

### 1.5 Policy hierarchy

```
BCBS D368 / Basel III Pillar 2
    └── IRRBB Policy (this document)
        ├── ALCO Terms of Reference (Eitan + Helena; planned)
        ├── BA 330 Preparation Procedure (Procedures/by-policy/irrbb-ba330-*.md)
        └── ICAAP IRRBB chapter (co-owned with Devon, CFO)
```

Every node cites upward per Principle 2 (single-graph discipline). No orphan policies; no orphan procedures.

### 1.6 Approval, review, and amendment

- **Initial approval:** Board Risk Committee, 2026-05-17.
- **Annual review:** Helena-led, no later than 12 months after the preceding approval date. Triggered by: material balance sheet restructuring; change in interest rate regime; revised SARB supervisory guidance on IRRBB; ICAAP submission outcome.
- **Amendment discipline:** all policy changes are typed `PolicyAmended` events per Principle 1. The markdown file is a render of the event; the event is canonical.

---

## 2. IRRBB Measurement Framework

### 2.1 Two measurement dimensions

The bank measures IRRBB under two complementary dimensions, both required by BCBS D368 and the SARB's supervisory expectations:

**Economic Value of Equity (EVE)**
- EVE measures the net present value (PV) change of all banking-book cash flows (assets minus liabilities plus off-balance-sheet instruments) under an interest rate shock scenario.
- EVE represents the long-run, structural interest rate sensitivity of the bank's balance sheet. A large negative EVE change indicates that a rate move would significantly erode the bank's economic net worth even if near-term income is unaffected.
- BCBS D368 risk appetite threshold (outlier criterion): if EVE declines by more than **15% of Tier 1 capital** under any of the six standardised shock scenarios (§2.3), the bank is classified as an IRRBB outlier — triggering mandatory supervisory dialogue and potential capital add-on.
- Internal appetite: EVE impact ≤ 15% of Tier 1 capital (BCBS outlier threshold). Helena and the ALCO will set a tighter internal limit (e.g. 10–12%) at the first post-licence ALCO calibration run; the limit is documented in the ALCO Terms of Reference.

**Net Interest Income (NII)**
- NII measures the projected 12-month impact on net interest income under interest rate shift scenarios.
- NII captures the near-term earnings sensitivity: a rate move may be EVE-neutral (e.g. a parallel shift in a well-matched book) but still generate meaningful NII volatility in the short run.
- Internal NII appetite: TBD at ALCO calibration. Guidance: NII variance ≤ X% of projected annual NII (Helena to set X at first ALCO calibration run).

Both EVE and NII are calculated by Eitan's ALM engine on end-of-day positions and fed into the monthly ALCO report and the quarterly BA 330.

### 2.2 Cash flow mapping and repricing schedule

The IRRBB calculation begins with a **repricing schedule** — a term-structured map of the timing and amount of interest rate cash flows for all banking-book instruments:

| Category | Treatment |
|---|---|
| Fixed-rate instruments | Cash flows mapped at contractual maturity / coupon dates |
| Floating-rate instruments | Cash flows mapped at next repricing date |
| Non-maturity instruments (call accounts, overdrafts) | Behavioural model applied; management assumptions documented and reviewed by Helena |
| OTC derivatives (banking-book hedges) | Mapped at fixed-leg payment dates vs floating-leg repricing dates |
| Embedded optionality (prepayment, early termination) | Behavioural model; assumptions documented, stress-tested, and reviewed by ALCO |

The repricing schedule is produced by Eitan's ALM engine from the event store (positions derived from trading events — see Market Risk Policy for trading-book boundary). The repricing schedule is the input to both EVE and NII calculations.

### 2.3 Six standardised shock scenarios (BCBS D368)

The BCBS D368 standard mandates six interest rate shock scenarios. The bank applies all six to both EVE and NII:

| Scenario | Description | Direction |
|---|---|---|
| 1. Parallel up | Parallel shift upward across all tenors | Rates rise across the curve |
| 2. Parallel down | Parallel shift downward across all tenors | Rates fall across the curve |
| 3. Short rates up | Short end shifts up; long end less affected | Yield curve flattens (from the short end) |
| 4. Short rates down | Short end shifts down; long end less affected | Yield curve steepens (from the short end) |
| 5. Steepener | Long rates rise relative to short rates | Curve steepens |
| 6. Flattener | Long rates fall relative to short rates | Curve flattens |

The shock magnitudes follow the BCBS D368 prescribed shock sizes by currency. For ZAR, the prescribed shocks are applied; for any foreign-currency banking-book position, the BCBS D368 prescribed foreign-currency shocks apply.

The scenario framework is hardcoded in Eitan's ALM engine (`prototype/platform/alm/irrbb-scenarios.ts`). Changes to shock magnitudes (e.g. following updated BCBS guidance or SARB supervisory instruction) require a `PolicyAmended` event and an ALCO resolution.

### 2.4 Calculation cadence

| Calculation | Frequency | Output | Consumer |
|---|---|---|---|
| EVE under 6 BCBS shocks | End-of-day (from daily position events) | `IrrbbEveCalculated` event; scalar EVE-change per scenario | ALCO monthly report; BA 330 quarterly |
| NII under 6 BCBS shocks | End-of-day | `IrrbbNiiCalculated` event; scalar NII-impact per scenario | ALCO monthly report |
| Repricing gap report | End-of-day | `IrrbbRepricingGapCalculated` event; time-bucket gap schedule | ALCO monthly report |
| Outlier-criterion check | Daily | Automated flag if any EVE scenario > 15% Tier 1 capital | Immediate ALCO alert; Helena notified |
| BA 330 population | Quarterly | BA 330 data cells populated from `IrrbbEveCalculated` events | SARB submission (Anya, data reporting engineer) |

### 2.5 Assumptions and behavioural models

Where contractual terms do not fully determine cash flow timing (non-maturity deposits, instruments with embedded options, etc.), the ALM engine uses documented behavioural assumptions. All assumptions:

- Are proposed by Eitan.
- Are reviewed and approved by Helena (CRO) and the ALCO.
- Are documented in the ALCO Terms of Reference and the BA 330 preparation procedure.
- Are stress-tested annually: the sensitivity of EVE/NII results to key behavioural assumptions is modelled and presented to the ALCO.
- Are updated when the underlying balance sheet behaviour materially changes.

Given the bank's build-phase status and institutional-only product set, behavioural modelling complexity is low in the initial years. The assumptions register is built and calibrated during the build phase.

---

## 3. Risk Appetite, Limits, and Controls

### 3.1 IRRBB risk appetite

The bank's IRRBB risk appetite is set by the Board Risk Committee on the recommendation of Helena (CRO) and the ALCO. The risk appetite is expressed through two primary limits:

**EVE outlier limit (BCBS D368 threshold):**
- Mandatory regulatory threshold: EVE impact ≤ **15% of Tier 1 capital** under any single BCBS shock scenario.
- Breach of this threshold triggers mandatory notification to the SARB PA and supervisory dialogue.
- Internal early-warning limit: to be set at ≤ 10–12% of Tier 1 capital at the first ALCO calibration run (Helena and ALCO to confirm; the tighter limit is an ALCO resolution documented in the ALCO Terms of Reference).

**NII volatility limit:**
- To be set at the first ALCO calibration run. Expressed as a percentage of projected 12-month NII.

### 3.2 Limit monitoring and breach protocol

Eitan's ALM engine checks IRRBB limits daily against end-of-day positions. The monitoring emits typed events:

- `IrrbbLimitBreachDetected` — if any EVE scenario exceeds the internal early-warning limit (but not yet the regulatory outlier threshold).
- `IrrbbOutlierThresholdBreached` — if any EVE scenario exceeds 15% of Tier 1 capital (regulatory outlier threshold).

**Breach escalation:**

| Breach type | Immediate action | Escalation path |
|---|---|---|
| Internal early-warning breach | Eitan alerts Helena within 2 hours | Helena escalates to ALCO at next meeting; management action plan within 5 business days |
| Regulatory outlier threshold breach | Helena notified within 1 hour; ALCO emergency convening within 24 hours | Helena notifies BRC; PA notification per SARB supervisory expectation within defined timeline; capital add-on assessed |

All breach events are logged in the event store and referenced in the next BA 330 submission.

### 3.3 Hedging and balance sheet management

Where IRRBB exposures exceed risk appetite, the ALCO authorises hedging actions or balance sheet restructuring:

- **Interest rate swaps (IRS):** the primary hedging instrument; converts fixed-rate exposure to floating or vice versa. IRS designated as banking-book hedges are subject to this policy (not Market Risk Policy). Hedge accounting eligibility is assessed per the Hedge Accounting Policy (IN FORCE).
- **Asset-liability maturity matching:** structural repricing-gap management; ALCO reviews the repricing gap schedule monthly.
- **Duration management:** target duration ranges for the liquidity portfolio (SAGB holdings) are set by ALCO.

All hedging transactions are approved by Helena (CRO) and executed by Saskia (Head of Global Markets, governance) / the trading desk. Every hedging decision is a typed `IrrbbHedgeDecisionApproved` event.

### 3.4 Controls

| Control | Description | Owner | Frequency |
|---|---|---|---|
| EVE/NII calculation | Daily EVE and NII calculation under 6 BCBS shocks | Eitan | Daily (automated) |
| Repricing gap report | Time-bucket repricing gap schedule | Eitan | Daily (automated) |
| Outlier-criterion check | Automated flag if EVE > 15% Tier 1 | Eitan (automated) + Helena (review) | Daily |
| Behavioural-assumption review | ALCO review of non-maturity and optionality assumptions | Helena (chair) + Eitan | Annual; triggered on material balance sheet change |
| BA 330 submission | SARB supervisory return on IRRBB | Anya (data reporting engineer) + Eitan (data) + Helena (sign-off) | Quarterly |
| ICAAP IRRBB section | Pillar 2 capital add-on documentation | Helena + Devon (CFO, governance) + Eitan | Annual ICAAP cycle |
| Vera effectiveness review | Independent review of EVE/NII methodology and limit-breach protocol | Vera (Internal audit / continuous-assurance engineer) | Annual |
| Stress testing | Sensitivity of EVE/NII to behavioural assumptions; additional ad hoc stress scenarios | Eitan + Helena | Annual; ad hoc on ALCO request |

---

## 4. Governance, Monitoring, and Escalation

### 4.1 Asset and Liability Committee (ALCO)

The ALCO is the primary governance forum for IRRBB. Helena (CRO) chairs the ALCO.

**ALCO monthly agenda (IRRBB items):**
1. EVE results under 6 BCBS shocks — current vs prior month; trend analysis.
2. NII sensitivity — current 12-month projection vs prior month.
3. Repricing gap report — structural gaps by time bucket.
4. Limit utilisation — EVE and NII limits vs appetite; any breaches since prior ALCO.
5. Hedging activity — review of any hedging trades approved since prior ALCO.
6. Assumption review — any proposed changes to behavioural assumptions.
7. Forward-looking rate sensitivity — Eitan's assessment of the bank's exposure to anticipated rate moves (informational; not a forecast).

**ALCO resolution record:** every material decision (limit change, hedge approval, assumption change, outlier-breach response) is a typed `AlcoResolutionRecord` event. The ALCO minutes are a document-substrate artefact referenced from that event.

### 4.2 Board Risk Committee oversight

The BRC receives:
- **Quarterly IRRBB report** (from Helena) — EVE/NII results; limit utilisation; any outlier-threshold events; BA 330 status; ICAAP IRRBB section update.
- **Annual review** — IRRBB policy review and re-approval; ALCO effectiveness assessment; Vera's independent review findings.
- **Immediate notification** on any `IrrbbOutlierThresholdBreached` event — Helena notifies the BRC chair within 24 hours; emergency BRC session convened if required.

### 4.3 SARB Prudential Authority reporting

| Return | Content | Frequency | Preparer | Approver |
|---|---|---|---|---|
| BA 330 | Banking-book IRRBB disclosure; EVE under 6 shocks by currency | Quarterly | Anya (data reporting engineer) + Eitan (calculations) | Helena (CRO) |
| BA 700 (ICAAP) | Pillar 2 IRRBB capital add-on | Annual | Devon (CFO, governance) + Helena + Eitan | Helena + Devon |
| Ad hoc supervisory data requests | SARB PA IRRBB data requests | On request | Anya + Eitan | Helena |

All submitted data is traceable to `IrrbbEveCalculated` and `IrrbbNiiCalculated` events in the event store per Principle 1.

### 4.4 Escalation pathway

| Trigger | Escalation path |
|---|---|
| EVE outlier criterion breach (> 15% Tier 1) | Eitan → Helena (1 hour) → BRC chair (24 hours) → SARB PA notification (per supervisory timeline) |
| NII limit breach | Eitan → Helena (2 hours) → ALCO meeting within 5 business days |
| ALCO limit breach (internal early-warning) | Helena → ALCO emergency item within 24 hours |
| BA 330 data quality issue | Anya → Eitan → Helena → rectification before submission |
| ICAAP IRRBB section — PA challenge | Helena → Devon → BRC; response within PA-stipulated timeline |

---

## 5. ICAAP and Capital Add-on

### 5.1 Pillar 2 IRRBB capital add-on

IRRBB is a Pillar 2 risk type. The bank's annual ICAAP (co-owned by Helena (CRO) and Devon (CFO, governance)) must:

1. Document the bank's IRRBB exposure (maximum EVE impact across the 6 BCBS shocks).
2. Assess whether the EVE impact is adequately covered by existing Pillar 1 capital or requires a Pillar 2 add-on.
3. Document the methodology for calculating the add-on (or the rationale for no add-on where EVE is below the outlier threshold with material headroom).
4. Disclose the IRRBB capital add-on in the BA 700 submission.

**BCBS outlier-criterion interaction:** where the bank breaches the 15% outlier threshold, the SARB PA may mandate a capital add-on independent of the bank's own ICAAP assessment. Helena and Devon (CFO) calibrate the internal ICAAP capital add-on to be defensible before any PA challenge.

### 5.2 Capital add-on methodology

The IRRBB Pillar 2 capital add-on methodology (detailed in the ICAAP document):
- Basis: the worst-case EVE decline across the 6 BCBS standardised shocks, under the current balance sheet.
- Offset: the bank may apply the Present Value of a Basis Point (PVBP) methodology or the BCBS standardised approach formula — Eitan documents the methodology choice and rationale.
- Floor: capital add-on is non-negative (the worst-case scenario result cannot reduce required capital below the Pillar 1 minimum).

All methodology decisions are `AlcoResolutionRecord` events or ICAAP document artefacts.

---

## 6. Related Documents

| Document | Location | Relationship |
|---|---|---|
| Market Risk Policy | [`Policies/market-risk-policy-v1.md`](market-risk-policy-v1.md) | Trading-book boundary; trading-book IR risk governed there |
| Hedge Accounting Policy | [`Policies/hedge-accounting-policy-v1.md`](hedge-accounting-policy-v1.md) | Banking-book hedge accounting eligibility; IRS designation |
| Liquidity Risk Management Policy | [`Policies/liquidity-risk-management-policy-v1.md`](liquidity-risk-management-policy-v1.md) | SAGB liquidity buffer duration; ALCO overlap |
| Capital Management Policy | [`Policies/capital-management-policy-v1.md`](capital-management-policy-v1.md) | ICAAP; Pillar 2 capital add-on; BA 700 |
| Pillar 3 Disclosure Policy | [`Policies/pillar-3-disclosure-policy-v1.md`](pillar-3-disclosure-policy-v1.md) | Pillar 3 IRRBB quantitative disclosure requirements |
| BA 330 Preparation Procedure | Procedures/by-policy/irrbb-ba330-preparation.md (planned) | Procedure-level instruction for BA 330 population |
| ALCO Terms of Reference | Owner Inbox / planned | ALCO mandate, membership, quorum, decision log |
| Obligations register | [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) | Row ORG-PR-11 |

---

## 7. Obligations closed by this policy

| Obligation ID | Obligation description | Policy section |
|---|---|---|
| [`ORG-PR-11`](../Regulations/_obligations-register.md) | Measure and manage IRRBB through EVE and NII metrics (BCBS D368) | §2 (measurement), §3 (risk appetite and controls), §4 (governance) |

---

## 8. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1 | 2026-05-17 | Helena (Chief Risk Officer, governance) + Eitan (ALM / interest-rate-risk engineer, engineering — reports to Helena) | Initial version. Establishes IRRBB governance framework, EVE/NII measurement under 6 BCBS D368 shocks, risk appetite (15% Tier 1 outlier threshold), ALCO governance, BA 330 disclosure, and ICAAP Pillar 2 capital add-on. Closes ORG-PR-11. LICENCE-BIND. |

---

*Helena (Chief Risk Officer, governance) + Eitan (ALM / interest-rate-risk engineer, engineering — reports to Helena)*
