---
policy-id: asset-liability-management-policy
title: Asset and Liability Management Policy v1
version: "1"
status: IN FORCE
owner: Eitan (Treasurer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - Banks Act 94 of 1990 s.60–64 (liquidity)
  - Regulations Relating to Banks reg.26 (liquidity risk management)
  - Basel III LCR framework (January 2013)
  - Basel III NSFR framework (October 2014)
  - SARB Guidance Note on IRRBB (aligned to BCBS IRRBB April 2016)
  - BCBS Interest Rate Risk in the Banking Book (April 2016)
  - existing Policies/irrbb-policy-v1.md (IRRBB sub-component)
  - existing Policies/liquidity-risk-management-policy-v1.md (LRM sub-component)
author: Eitan (Treasurer, governance) + Ravi (Treasury/ALM engineer, engineering)
date: 2026-05-22
summary: Asset and Liability Management Policy covering ALCO mandate and quorum, balance sheet structure management, structural interest rate risk (delegates to IRRBB policy), liquidity buffer management, deposit/funding mix targets, behavioural assumptions, contractual vs behavioural cashflow gap analysis, ALM limit framework, and internal stress scenarios. COMMENCEMENT-BIND.
decision-required: false
riskTaxonomy:
  - RT-LR
  - RT-IR
  - RT-BR
---

# Asset and Liability Management Policy v1

> **Authors.** Eitan (Treasurer, governance) — lead; Ravi (Treasury/ALM engineer, engineering) — co-author.
> **Status.** COMMENCEMENT-BIND. ALM obligations bind from commencement of trading. Build-phase work is the infrastructure and governance preparation. The IRRBB policy (`Policies/irrbb-policy-v1.md`) is a sub-component of this framework governing the interest rate risk dimension in detail.
> **Identity discipline.** Every agent reference pairs name + position on first mention.

---

## 1. Asset and Liability Management Policy — Overarching

**Owner:** Eitan (Treasurer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) for ALM policy; ALCO for limit calibrations within approved parameters · **Cadence:** Annual policy review; monthly ALCO; triggered on material change to balance sheet structure, funding strategy, or regulatory requirement · **Citation:** Banks Act 94 of 1990 s.60–64 + Regulations Relating to Banks reg.26 + Basel III LCR (January 2013) + Basel III NSFR (October 2014) + BCBS IRRBB (April 2016)

### Purpose

This policy establishes the Asset and Liability Management (ALM) framework for Hoz Bank Limited. ALM governs the structural management of the Bank's balance sheet to ensure that: (i) the Bank maintains adequate liquidity at all times, meeting or exceeding the LCR and NSFR regulatory minimums; (ii) structural interest rate risk (the mismatch between asset and liability repricing) is managed within the limits set in `Policies/irrbb-policy-v1.md`; (iii) the funding mix supports stable, diversified funding sources aligned to the Bank's institutional trading mandate; (iv) the maturity transformation embedded in the balance sheet is a deliberate, ALCO-governed choice rather than an unmanaged risk; and (v) behavioural assumptions for non-maturing and optionable instruments are calibrated and consistently applied.

The ALM framework sits above two sub-policies that govern specific risk dimensions in detail:
- **`Policies/irrbb-policy-v1.md`** — interest rate risk in the banking book (IRRBB): EVE sensitivity, NII sensitivity, CSRBB, and the IRRBB limit framework.
- **`Policies/liquidity-risk-management-policy-v1.md`** — liquidity risk: LCR, NSFR, intraday liquidity, contingency funding plan.

This ALM policy is the integration layer above those sub-policies; it governs the ALCO structure, the holistic balance sheet view, the limit framework that aggregates IRRBB and liquidity risks, and the internal stress testing for the balance sheet.

### Principles

- **ALCO as the sovereign governance body for ALM.** The Asset and Liability Committee (ALCO) is the primary governance body for balance sheet structural risk. All material ALM decisions (limit changes, funding strategy, behavioural assumption updates) are made by ALCO or by Eitan within ALCO-approved parameters.
- **Maturity transformation is a deliberate risk, not an accident.** The Bank accepts maturity transformation risk (funding long-dated assets with shorter-dated liabilities) only where ALCO has explicitly calibrated the limit, the FTP mechanism correctly prices the cost of the transformation (per `Policies/funds-transfer-pricing-policy-v1.md`), and the resulting IRRBB exposure is within the IRRBB policy limits.
- **Contractual and behavioural cashflows are both modelled.** The cashflow gap analysis includes both contractual cashflows (based on contractual maturities) and behavioural cashflows (based on modelled customer behaviour for non-maturing products). The difference between the two creates basis risk; Eitan owns this basis and manages it in the Treasury book.
- **Liquidity and interest rate risk are managed in an integrated framework.** The ALM limit framework sets consolidated limits that reflect both dimensions; breach of either the IRRBB limits or the liquidity limits triggers ALCO review of the balance sheet strategy, not just the individual risk dimension in isolation.
- **Events-first ALM.** Every ALM decision — limit setting, behavioural assumption change, stress scenario activation — is a typed event in the event log (Principle 1). ALCO minutes, limit approvals, and behavioural assumption updates are `AlcoDecisionRecorded`, `AlmLimitSet`, and `BehaviouralAssumptionUpdated` events respectively.

### Roles

Eitan (Treasurer, governance) is the policy owner and ALCO chair. Ravi (Treasury/ALM engineer, engineering — reports to Eitan) builds and operates the ALM measurement infrastructure: the cashflow gap model, the EVE/NII sensitivity engine (per `Policies/irrbb-policy-v1.md`), the LCR/NSFR computation, and the internal stress testing harness. Helena (Chief Risk Officer, governance) provides second-line oversight of the ALM framework and attends ALCO as a standing member. Camille (Chief Financial Officer, governance) attends ALCO for the capital and funding cost integration. Owen (Company Secretary, governance) manages ALCO secretarially. Vera (internal audit engineer) audits the ALM framework at the annual cycle.

---

## 2. ALCO Mandate and Governance

**Owner:** Eitan (Treasurer, governance) · **Approval:** Board (CEO interim) constitutes ALCO; approves ALCO ToR · **Cadence:** ALCO convenes monthly; extraordinary ALCO on material limit breach or funding stress event · **Citation:** Banks Act 94 of 1990 s.60 (liquidity governance), Regulations Relating to Banks reg.26 (risk management committee)

### 2.1 ALCO Membership and Quorum

ALCO membership:
- **Eitan (Treasurer, governance)** — chair
- **Camille (Chief Financial Officer, governance)** — CFO and capital integration
- **Helena (Chief Risk Officer, governance)** — second-line risk oversight
- **Saskia (Head of Global Markets, governance)** — trading book liquidity user
- **CEO** — strategic alignment

Quorum: Eitan (or appointed deputy) + at least two other members. Minutes are filed as `AlcoMeetingMinutes { meetingDate, quorum, decisionEvents[] }` events by Owen.

### 2.2 ALCO Standing Agenda

Monthly ALCO standing agenda:
1. Balance sheet structure summary — assets, liabilities, off-balance sheet commitments by maturity bucket.
2. LCR and NSFR vs. limits (per `Policies/liquidity-risk-management-policy-v1.md`).
3. IRRBB metrics — EVE sensitivity and NII sensitivity vs. IRRBB limits (per `Policies/irrbb-policy-v1.md`).
4. Funding strategy update — tenor profile, concentration, upcoming maturities.
5. FTP curve status — Ravi presents current FTP curve, any recalibrations since prior ALCO (per `Policies/funds-transfer-pricing-policy-v1.md`).
6. Behavioural assumption review — any model updates since prior ALCO.
7. Internal ALM stress test results — scenarios and headroom to limits.
8. New product ALM impact — pre-trade ALM assessment of any products in the NPA pipeline.
9. Limit utilisation trends — 3-month rolling utilisation for all ALM limits.

### 2.3 Escalation

ALCO escalates to the Board (CEO interim):
- Any ALM limit breach that is not resolved within the timeframe in §6.
- Approval of material changes to the ALM limit framework or behavioural assumptions.
- Approval of any new funding instrument type (e.g., first issuance of covered bonds, first use of repo funding from a new counterparty class).
- The annual ALM framework review.

---

## 3. Balance Sheet Structure Management

**Owner:** Eitan (Treasurer, governance) · **Approval:** ALCO · **Cadence:** Monitored daily by Ravi; reviewed monthly at ALCO · **Citation:** Basel III NSFR (October 2014) — stable funding structure; BCBS IRRBB (April 2016) — balance sheet repricing structure

### 3.1 Funding Mix Targets

ALCO sets funding mix targets to ensure adequate diversification of funding sources and alignment with the Bank's institutional trading mandate. The funding mix targets cover:

| Funding source | Target range | Rationale |
|---|---|---|
| Wholesale term deposits (> 1 year) | ≥ 40% of total funding | NSFR stable funding; reduces roll-risk |
| Wholesale term deposits (1 month–1 year) | ≤ 40% of total funding | Limits concentration in short-tenor wholesale |
| Repo and secured funding | ≤ 20% of total funding | Secured funding reliance constraint |
| Equity and subordinated debt | ≥ 15% of total funding | Capital and regulatory capital targets |

These targets are initial calibrations; Eitan recalibrates at each annual ALM review and after material balance sheet events. Breaches of the funding mix targets trigger an ALCO review within 5 business days.

### 3.2 Asset-Liability Maturity Mismatch

The Bank accepts a degree of maturity mismatch (funding longer-dated assets with shorter-dated liabilities) as a normal feature of banking, within ALCO-approved limits. The maturity mismatch limit framework (§6) constrains the maximum cumulative cashflow gap in each maturity bucket. Ravi monitors the contractual cashflow gap daily; the behavioural-adjusted gap is computed monthly as part of the ALCO pack.

---

## 4. Behavioural Assumptions

**Owner:** Eitan (Treasurer, governance) · **Approval:** ALCO · **Cadence:** Reviewed at least annually; triggered on significant change in market conditions or customer behaviour data · **Citation:** BCBS IRRBB (April 2016) — behavioural assumptions for NMDs; SARB Guidance Note on IRRBB

### Purpose

Non-maturing products (demand deposits, savings accounts, certain committed credit facilities) have no defined contractual maturity. Their effective maturity for ALM purposes is determined by behavioural assumptions — estimates of when the Bank will actually need to repay or redraw these instruments based on historical customer behaviour patterns and market analysis. Given that the Bank is in the build phase with no historical deposit data, initial behavioural assumptions are set using industry benchmarks and BCBS IRRBB guidance; they are updated as actual data accumulates post-commencement of trading.

### 4.1 Demand Deposit Behavioural Assumptions

At commencement of trading, demand deposits from institutional counterparties (the Bank's only client type per the trading mandate) are treated conservatively:
- **Operational deposits** (deposits arising from clearing and settlement relationships with the Bank's institutional clients): modelled with a weighted average maturity of 6 months, consistent with Basel III LCR operational deposit treatment.
- **Non-operational institutional deposits:** modelled with a weighted average maturity of 1 month (conservative; consistent with LCR unstable wholesale deposit treatment).

Behavioural assumptions are stored as `BehaviouralAssumptionSet { productType, contractualMaturity, behaviouralMaturity, calibrationBasis, effectiveDate }` events. Eitan reviews assumptions annually; any material revision requires ALCO approval and a new event.

### 4.2 Core Deposit Model (Post-Commencement)

Once the Bank has 12 months of deposit behaviour data, Ravi builds a statistical core deposit model using historical run-off rates, rate sensitivity, and maturity distribution. The model is validated by Helena before adoption; an `AlmModelValidated { modelId, modelVersion, scope, validationDate }` event is required before the model is adopted in the ALM framework.

---

## 5. Contractual vs Behavioural Cashflow Gap Analysis

**Owner:** Eitan (Treasurer, governance) · **Approval:** ALCO for methodology; Eitan for daily monitoring · **Cadence:** Contractual gap daily; behavioural gap monthly · **Citation:** BCBS IRRBB (April 2016); Basel III LCR (January 2013)

### 5.1 Contractual Gap

The contractual cashflow gap schedule presents all contractual asset and liability cashflows in time buckets from overnight to 30 years, based on contractual maturity dates. The contractual gap is computed daily by Ravi using position data from the event log; a `ContractualCashflowGapComputed { date, buckets[] }` event is the canonical record.

### 5.2 Behavioural Gap

The behavioural cashflow gap schedule adjusts the contractual schedule for behavioural assumptions (§4) and for modelled early prepayments, extensions, and exercise of embedded options. The behavioural gap is computed monthly as part of the ALCO pack. A `BehaviouralCashflowGapComputed { month, buckets[], keyAssumptions[] }` event is the canonical record. Helena reviews the behavioural gap for reasonableness quarterly.

### 5.3 Basis

The gap between the contractual and behavioural schedules is the behavioural assumption basis. This basis represents the risk to the Bank if actual customer behaviour deviates from the model. Eitan monitors this basis and calibrates the FTP optionality adjustment (per `Policies/funds-transfer-pricing-policy-v1.md` §4.1) to reflect it.

---

## 6. ALM Limit Framework

**Owner:** Eitan (Treasurer, governance) · **Approval:** Board (CEO interim) for limits; ALCO for monitoring · **Cadence:** Limits reviewed annually; daily monitoring by Ravi · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks reg.26; BCBS IRRBB (April 2016)

The ALM limit framework sets consolidated limits that integrate the IRRBB and liquidity risk dimensions. The limit register is maintained in `Procedures/by-policy/alm-limit-monitoring.md` with the specific calibrated values. Limit types:

| Limit type | Governance level | Escalation trigger |
|---|---|---|
| Maximum cumulative cashflow gap per maturity bucket (contractual) | ALCO | > 80% utilisation in any bucket |
| Minimum liquidity buffer (HQLA, above LCR floor) | ALCO | < 10% headroom above regulatory minimum |
| Maximum NSFR-required stable funding shortfall | ALCO | Any shortfall vs. NSFR ≥ 100% |
| Maximum EVE sensitivity to parallel +200bp shock | Board (per IRRBB policy) | Breach of IRRBB EVE limit |
| Maximum NII sensitivity to parallel +200bp shock | Board (per IRRBB policy) | Breach of IRRBB NII limit |
| Maximum interest rate risk in the banking book (CSRBB) | ALCO | > 80% utilisation |
| Maximum funding concentration — single counterparty | ALCO | > 15% of total liabilities |

Limit breaches trigger the escalation path in §2.3. All limit breach events are recorded as `AlmLimitBreached { limitType, currentValue, limit, breach Percentage, escalationPath }` events.

---

## 7. Internal Stress Scenarios

**Owner:** Eitan (Treasurer, governance) · **Approval:** Board (CEO interim) approves stress scenario set annually · **Cadence:** Monthly standard scenarios; quarterly severe scenarios; ad hoc on market stress events · **Citation:** BCBS Principles for sound liquidity risk management (2008) — liquidity stress testing; BCBS IRRBB (April 2016) — IRRBB stress scenarios; Banks Act 94 of 1990 s.60

### Scenario Set

The Bank maintains an internal set of stress scenarios for the balance sheet, separate from and supplementary to the regulatory LCR and NSFR metrics:

| Scenario | Description | Frequency |
|---|---|---|
| Name + idiosyncratic stress | 30-day institutional funding withdrawal of 30%; simultaneous market-risk MTM losses of 10% | Monthly |
| Market-wide liquidity stress | 20% increase in repo haircuts; 15% reduction in credit lines from wholesale counterparties | Monthly |
| Interest rate shock (parallel +300bp) | Balance sheet repricing impact on EVE and NII beyond the regulatory +200bp IRRBB shock | Monthly |
| Combined stress | Name + idiosyncratic + market-wide simultaneous; extended to 90 days | Quarterly |
| Reverse stress test | What funding outflow or rate shock would exhaust the liquidity buffer? | Quarterly |

Stress scenario results are presented at ALCO monthly. A scenario result that breaches the internal survival horizon (minimum 30 days liquidity runway under base stress) triggers Eitan's escalation to Helena and the CEO within 1 business day. A `BalanceSheetStressTestCompleted { date, scenario, survivalHorizon, keyFindingsEvents[] }` typed event is the canonical record of each stress test run.

---

## 8. Substrate Dependencies and Gaps

- **Cashflow gap engine (Ravi).** Automated contractual and behavioural cashflow gap schedule from event log position data. Discharge exit signal: `ContractualCashflowGapComputed` event on daily schedule.
- **Behavioural assumption model (Ravi + Helena).** Statistical core deposit model awaiting 12 months of post-commencement data; initial assumptions are deterministic estimates per §4.1.
- **ALM stress testing harness (Ravi).** Automated scenario runner producing `BalanceSheetStressTestCompleted` events. Currently in build phase.
- **ALCO reporting pack (Ravi + Bea).** Integrated monthly ALCO dashboard consuming IRRBB, LCR/NSFR, gap, and stress outputs. Currently in build phase.

---

## 9. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Eitan (Treasurer, governance) + Ravi (Treasury/ALM engineer, engineering) | Initial policy authored. Seven sections: (1) Overarching — ALCO as sovereign governance, maturity transformation as deliberate risk, integrated IRRBB+liquidity framework, events-first ALM; (2) ALCO Mandate — membership, quorum, monthly agenda, escalation; (3) Balance Sheet Structure — funding mix targets, maturity mismatch governance; (4) Behavioural Assumptions — demand deposit treatment, core deposit model pathway; (5) Contractual vs Behavioural Gap Analysis — daily contractual, monthly behavioural, basis monitoring; (6) ALM Limit Framework — integrated IRRBB + liquidity limit table; (7) Internal Stress Scenarios — scenario set, survival horizon, quarterly reverse stress test. COMMENCEMENT-BIND. |
