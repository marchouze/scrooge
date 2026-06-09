---
policy-id: market-risk-policy
title: Market Risk Policy v1
version: "1"
status: IN FORCE
owner: Helena (Chief Risk Officer, governance)
effective-from: "2026-05-13"
next-review: "2027-05-13"
citations:
  - Banks Act 94 of 1990
  - Regulations Relating to Banks 2012 (as amended)
  - BCBS FRTB (January 2019) — Minimum capital requirements for market risk
  - BCBS Basel III/IV
  - PA Directive D/2025 (FRTB + revised CVA implementation timeline)
  - D-REGULATORY-READINESS-GATE-PLAN
author: Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering)
date: 2026-05-13
summary: Standalone Market Risk Policy covering FRTB standardised approach as baseline, IMA desk-approval pathway, trading book / banking book boundary, VaR / ES / sensitivity-based risk appetite limits, NMRF / SES treatment, back-testing and PLA test governance, revised CVA capital, no-proprietary-trading principle, and Market Risk Committee governance. Closes obligations ORG-PR-19, ORG-PR-20, ORG-PR-33, ORG-PR-56, ORG-PR-57, ORG-PR-58, ORG-PR-59, ORG-PR-60. COMMENCEMENT-BIND.
decision-required: false
riskTaxonomy:
  - RT-MR
  - RT-CR
---

# Market Risk Policy v1

> **Authors.** Helena (Chief Risk Officer, governance) — lead; Rohan (Market risk quantitative engineer, engineering) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Implements the market-risk framework obligations mandated by the PA's FRTB implementation timeline (PA D/2025, effective 1 July 2025) and the BCBS *Minimum capital requirements for market risk* (January 2019 — the FRTB standard). Complements `Policies/trading-mandate-v1.md`; this policy is the risk-measurement layer sitting beneath the trading mandate's business constraints.
> **Obligations closed.** `ORG-PR-19` (measure trading-book market risk per FRTB; capital under SA or IMA), `ORG-PR-20` (no proprietary risk-taking outside warehoused franchise hedge positions), `ORG-PR-33` (implement FRTB + revised CVA per PA timeline — 1 July 2025), `ORG-PR-56` (IMA trading-desk approval process), `ORG-PR-57` (PLA test — Profit & Loss Attribution), `ORG-PR-58` (back-testing of internal models), `ORG-PR-59` (NMRF / SES treatment), `ORG-PR-60` (SA/IMA capital reporting to PA).
> **Status.** COMMENCEMENT-BIND. The trading book is only active at commencement of trading. FRTB capital calculation, PA model-approval processes (IMA desks), and market risk reporting are required from the first trade date. Build-phase operationalisation is preparation for compliance, not compliance itself (per `project_rules_bind_at_commencement.md` memory, 2026-05-07). The quantitative infrastructure (FRTB SA engine, ES/VaR computation, sensitivities feed, back-testing harness) is under construction per `D-REGULATORY-READINESS-GATE-PLAN`.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Market Risk Policy — Overarching

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual; triggered on material change to the trading book, business model, or PA direction · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks 2012 (as amended) — Reg 32 (market risk capital requirement) `[citation: TBC — precise Reg 32 sub-clause indices; Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate]` + BCBS *Minimum capital requirements for market risk* (January 2019 — FRTB; `ORG-PR-19`, `ORG-PR-33`) + PA implementation directive D/2025 (1 July 2025 effective date for FRTB + revised CVA; `ORG-PR-33`) + BCBS *Minimum capital requirements for CVA risk* (July 2020) + `Policies/trading-mandate-v1.md`

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") identifies, measures, manages, and capitalises market risk across the trading book. Its purpose is to ensure that: (i) all trading-book positions are measured under the FRTB framework from the first trade date; (ii) capital held for market risk meets or exceeds the PA's requirements at all times; (iii) the Market Risk Appetite is calibrated to the Bank's franchise-only institutional trading mandate; and (iv) governance structures are sufficient for the PA's IMA trading-desk approval process where the Bank pursues it.

The policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). It cites the regulatory obligations above it; procedures under this policy (including `Procedures/by-policy/frtb-sa-capital-computation.md`, `Procedures/by-policy/backtesting-governance.md`, `Procedures/by-policy/pla-test-governance.md`, and `Procedures/by-policy/market-risk-limit-monitoring.md`) operationalise it; the FRTB SA engine, ES computation module, sensitivities feed, and back-testing harness are the system capabilities that execute those procedures. The policy does not reproduce regulatory text; it anchors management choices above the regulatory floor.

This policy and `Policies/trading-mandate-v1.md` are read together. The trading mandate defines the *business* constraints — what the Bank may trade, for what purpose, with what counterparties, at what franchise scale. This policy defines the *risk-measurement and capital* constraints — how those trading activities are measured, limited, capitalised, and reported. The two are hierarchically aligned: market risk appetite limits in §3 of this policy cannot be more permissive than the business constraints in the trading mandate.

The FRTB framework (BCBS January 2019) introduces two capital approaches: the Standardised Approach (SA) — the default, formula-based regulatory method — and the Internal Models Approach (IMA) — a desk-level, PA-approved method based on the bank's own risk models. The SA is the baseline for every desk from the first trade date. IMA is aspirational: the Bank will seek PA desk-level approval (per `ORG-PR-56`) once the quantitative infrastructure, back-testing history, and PLA test performance meet the PA's eligibility criteria. Until IMA is PA-approved for a given desk, SA capital governs; dual-running (computing both SA and IMA for reporting and internal validation) is the pre-approval operational mode.

The FRTB also introduces the revised CVA (Credit Valuation Adjustment) capital framework. The revised CVA framework (BCBS July 2020; PA D/2025) applies from the same 1 July 2025 implementation date as the FRTB (`ORG-PR-33`). The CVA capital charge covers the risk of mark-to-market losses on bilateral OTC derivatives from counterparty credit quality deterioration. The CVA framework is integrated into this policy because CVA risk is a market risk at the measurement layer; it is separately governed from credit risk in the obligations register but is managed under this policy's framework.

### Principles

- **FRTB framework as the governing standard.** The Bank implements the FRTB (BCBS January 2019) as its market risk capital framework from the first trade date, per PA D/2025 (`ORG-PR-33`). No prior internal VaR approach (pre-FRTB) is used as the primary capital measure; the FRTB SA is the regulatory capital baseline from commencement of trading.
- **SA is the default; IMA is aspirational and desk-level.** The Standardised Approach (SA) governs all desks from commencement of trading. The IMA may be applied only to desks that have received PA desk-level approval (`ORG-PR-56`), passed the back-testing and PLA tests for the preceding period, and satisfy the NMRF/SES eligibility criteria. SA capital governs for all other desks. There is no bank-wide IMA election; desk-level approval is the unit.
- **No proprietary trading.** The Bank does not engage in proprietary risk-taking. All trading activity is franchise-originated: client facilitation (market-making, execution, hedging of client flows) and warehoused hedge positions that arise from legitimate client facilitation activities (`ORG-PR-20`). Intraday positions that exceed defined limit parameters are not franchise hedging; they are referred to the Market Risk Committee immediately. The no-prop rule is absolute and non-negotiable.
- **Trading book / banking book boundary is regulatory.** The boundary between the trading book and the banking book is defined per BCBS FRTB (January 2019), Chapter 2 (paragraphs 3–17 of the FRTB standard `[citation: TBC — precise paragraph indices]`). The presumptive banking-book list and presumptive trading-book list in the FRTB standard are applied without override. Any boundary reclassification requires prior PA consent and a typed event in the event log.
- **Risk appetite is RAS-anchored.** Market risk appetite lines in the RAS (MR-1 through MR-5, defined in §3 of this policy) are the governing limits. The RAS market risk lines are calibrated to the franchise scale at commencement of trading; recalibration requires Helena's recommendation and CEO (Board interim) approval. All limit breaches are escalated per §5 of this policy.
- **Events-first market risk accounting.** Market risk positions, risk measures (VaR, ES, sensitivities), back-testing outcomes, and PLA test results are computed as queries over the event log, not stored balances (Principle 1). The FRTB SA engine, ES computation module, and sensitivities feed produce typed events (`MarketRiskMeasureComputed`, `BacktestingOutcomeRecorded`, `PlaTestResultRecorded`) that are the canonical artefacts; the daily risk report is a render of those events.
- **CVA is integrated into the market risk framework.** CVA capital (`ORG-PR-33`) is computed under the same governance structure as trading-book market risk — owned by Helena, computed by Rohan, reported to the Market Risk Committee. The CVA Standardised Approach (CVA-SA) is the default; CVA-BA (Basic Approach) is permissible for the initial period per the BCBS CVA framework `[citation: TBC — CVA-BA eligibility conditions]`.
- **Governance is event-driven.** Limit breaches, model approvals, back-testing zone transitions, PLA test failures, and IMA approval events are typed events in the event log, not prose records. No limit breach proceeds without a `MarketRiskLimitBreached { deskId, limitType, amount, escalationPath }` event; no desk IMA approval proceeds without a `ImaDesklApprovalGranted { deskId, paApprovalRef, effectiveDate }` event.

### Roles

Helena (Chief Risk Officer, governance) is the policy owner and chairs the Market Risk Committee (sub-committee of the Board Risk Committee). Helena's responsibilities include: owning the market risk framework and capital methodology; co-chairing limit design with the risk appetite framework; reviewing daily breach reports; escalating material breaches to the BRC and CEO; presenting market risk capital to the PA. Rohan (Market risk quantitative engineer, engineering — reports to Helena) builds and operates the FRTB SA engine, ES computation module, sensitivities feed, back-testing harness, and PLA test infrastructure. Rohan produces the daily `MarketRiskMeasureComputed` events and the monthly market risk capital report. Nadia (Independent-validation engineer, peer-in-second-line under Helena) validates the FRTB SA engine, ES model, and IMA models before any PA submission and at least annually thereafter. The desk heads of the client-facing trading desks own the day-to-day limit compliance obligation as the first line of defence. Camille (Chief Financial Officer, governance) integrates the market risk RWA output into the BA-return suite — the **BA 320** market-risk return (with the BA 325 selected trading-and-treasury-risk return), flowing into the BA 700 capital-adequacy summary. Owen (Company Secretary, governance) manages the Market Risk Committee secretarially and files the typed governance events. Vera (internal audit engineer — reports functionally to Thandiwe (Chief Audit Executive, governance)) provides third-line assurance over the market risk framework.

### Breach

Breach taxonomy is three-severity:

- **Alert (Amber).** Any sensitivity-based limit or VaR/ES limit is within 80–100% of the approved limit. Immediate notification to Helena and the desk head. Intraday position review required. No mandatory escalation above Helena unless the Alert persists for two consecutive business days.
- **Hard Breach (Red).** Any sensitivity-based limit or VaR/ES limit is exceeded. Immediate notification to Helena, Camille, and the CEO. The Market Risk Committee convenes within one business day. A remediation plan (position reduction or limit increase request) is required within the timeframe set in `Procedures/by-policy/market-risk-limit-monitoring.md`. PA notification may be required depending on materiality.
- **Critical (Critical-Red).** A desk's back-testing breach count enters the Red zone (more than 12 exceptions in 250 trading days per the BCBS back-testing framework `[citation: TBC]`); or the market risk capital requirement under SA exceeds the available capital headroom per the ICAAP trajectory; or a position cannot be valued at a sufficiently reliable level to support FRTB SA capital computation. Immediate CEO and BRC notification; PA notification under the applicable regulatory provision `[citation: TBC — Imani + external counsel ratify]`.

---

## 2. Trading Book / Banking Book Boundary

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim) for any boundary reclassification; standing boundary maintained by Helena · **Cadence:** Reviewed quarterly and on any new product approval; reclassification by prior PA consent only · **Citation:** BCBS FRTB (January 2019) — boundary definitions, presumptive lists, and reclassification conditions `[citation: TBC — precise FRTB chapter and paragraph references]` + Regulations Relating to Banks `[citation: TBC — Reg 32 boundary provisions]` + `ORG-PR-19` (FRTB capital from first trade date)

### Purpose

The FRTB framework introduced a clear and largely-fixed regulatory boundary between the trading book and the banking book. The boundary matters because the two books attract different capital frameworks: the trading book is capitalised under FRTB market risk rules (this policy); the banking book is capitalised under credit risk rules (credit risk policy), IRRBB rules (interest rate risk in the banking book policy, per BCBS D335), and credit valuation rules. The regulatory boundary defines which instruments must, or presumptively should, sit in which book; reclassification across the boundary requires prior PA consent and is a significant governance event.

At commencement of trading, Hoz Bank Limited's trading book will consist of JSE-listed bonds and equities and OTC interest-rate derivatives (`Policies/trading-mandate-v1.md`, §2). All positions in these instruments held for client facilitation, market-making, or warehoused franchise hedging sit in the trading book. Banking-book instruments (own-account bond portfolio held for liquidity purposes, interbank deposits) are capitalised separately.

### Principles

- **Presumptive trading-book instruments.** Per BCBS FRTB (January 2019), instruments that are presumptively in the trading book include: instruments held with trading intent (short-term, profit-from-market-movements), instruments held as part of a market-making business, instruments from underwriting, and instruments from hedging other trading-book positions. JSE bonds and equities held for client facilitation and OTC IRD warehoused hedge positions fall within this presumption for the Bank's mandate.
- **Presumptive banking-book instruments.** Per BCBS FRTB, instruments that are presumptively in the banking book include: instruments managed in the banking book, unlisted equities, real-estate holdings, retail and SME credit exposures, and equity investments in funds where the Bank does not look through to the underlying. These are not part of the Bank's institutional trading mandate at v0; any instrument of this type that arises through client activity is reviewed by Helena for proper boundary placement before settlement.
- **Reclassification requires prior PA consent.** Any instrument transfer from the banking book to the trading book (or vice versa) requires prior PA consent per the FRTB reclassification rules `[citation: TBC — FRTB paragraph on prior consent for reclassifications]`. No reclassification proceeds on Helena's authority alone; the CEO (Board interim) approves the reclassification request; Owen manages the PA communication; a `TradingBookReclassificationApproved { instrument, direction, paConsentRef, effectiveDate }` typed event is the canonical record.
- **No regulatory arbitrage.** The Bank does not transfer instruments between books to achieve a lower capital requirement. Helena's quarterly boundary review includes a check that the prevailing boundary classification is consistent with the FRTB presumptive lists and the Bank's actual management intent. Any discrepancy is a Vera finding if unreported by Helena.
- **New product boundary determination.** Every instrument type entering the trading book for the first time (including through the New Product Approval gate per `Policies/trading-mandate-v1.md` §NPA) is assessed for boundary placement by Rohan before the first trade. Rohan files a `TradingBookBoundaryAssessed { productType, classification, rationale }` event; Helena reviews. Novel instruments with boundary ambiguity are referred to Imani (Legal-as-code engineer, engineering) for regulatory-text confirmation before trading begins.

---

## 3. Market Risk Appetite

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim) for all RAS market risk lines; recalibration on material change or annual ICAAP cycle · **Cadence:** Limit review at least annually; intraday monitoring by Rohan; daily reporting to Helena · **Citation:** BCBS FRTB (January 2019) — ES and sensitivity-based measures + `ORG-PR-19` (FRTB capital obligation) + `ORG-PR-20` (no proprietary risk) + `Policies/trading-mandate-v1.md`

### Purpose

The Market Risk Appetite defines the level of market risk the Bank is willing to accept in pursuit of its franchise trading mandate. It is expressed through a set of RAS market risk lines (MR-1 through MR-5) that translate the qualitative no-proprietary-trading principle into quantitative limits on VaR, Expected Shortfall, sensitivity-based measures, and CVA sensitivity. These limits constrain the Bank's market risk within the trading mandate's business scope and within the capital headroom set by the Capital Management Policy.

The market risk appetite is calibrated to the Bank's institutional client franchise and the expected scale of client-driven activity at commencement of trading. The limits are intentionally conservative at v0 to reflect the Bank's build-phase capital base and the operational readiness level of the FRTB SA engine. Recalibration post-commencement of trading follows the ICAAP annual cycle.

### RAS Market Risk Lines

**MR-1 — Daily 1-day 99% VaR limit (trading book aggregate).** The aggregate 1-day 99% VaR across the trading book shall not exceed the limit set in the Market Risk Appetite register (calibrated by Rohan under Helena's direction; specific numerical values in `Procedures/by-policy/market-risk-limit-monitoring.md` — not reproduced in this policy layer, which sets the governance structure only). VaR is computed daily by Rohan using the FRTB-compliant historical simulation approach. MR-1 is an amber alert at 80% of limit; breach of limit is a Hard Breach.

**MR-2 — 10-day 97.5% Expected Shortfall (ES) limit.** ES is the primary FRTB risk measure (replacing VaR in the IMA framework per BCBS FRTB). The Bank computes ES for internal limit governance even under the SA framework, as a forward-readiness measure for IMA aspirations. The 10-day 97.5% ES limit across the trading book is set in `Procedures/by-policy/market-risk-limit-monitoring.md`. ES is computed over the reduced set of risk factors (R) eligible for modelling, per BCBS FRTB `[citation: TBC — FRTB paragraph defining the R set]`. MR-2 is an amber alert at 80%; breach is a Hard Breach.

**MR-3 — Sensitivity-based risk limits per risk class.** The FRTB SA uses sensitivity-based measures (delta, vega, curvature) aggregated across risk classes (general interest rate risk — GIRR; foreign exchange risk — FX; credit spread risk — CSR non-securitisation; equity risk; commodity risk; CSR securitisation). Desk-level and risk-class-level sensitivity-based limits are set in `Procedures/by-policy/market-risk-limit-monitoring.md` consistent with the SA risk class structure. Per risk class, sensitivity limits reflect the expected scale of client facilitation at commencement of trading; limits are lower for risk classes not within the primary franchise scope (e.g., commodity risk is not a primary mandate risk class for an institutional rates-and-equities bank).

**MR-4 — CVA sensitivity limit.** CVA sensitivity to credit spread movements on reference counterparties is limited per the CVA risk appetite. Given the Bank's OTC IRD franchise with institutional counterparties, the CVA CVA sensitivity is monitored daily by Rohan using the revised CVA framework (BCBS July 2020; `ORG-PR-33`). The CVA-SA capital charge is computed monthly for BA-return inclusion; daily monitoring is against a CVA sensitivity limit. Breach triggers immediate review of counterparty exposure and, if material, a CVA hedging decision by Helena.

**MR-5 — No-prop rule enforcement.** Any position that is not explainable by a client facilitation flow or an approved warehoused franchise hedge is prohibited. Rohan monitors the attribution of every trading-book position to a client flow or a named hedge programme. Any unexplained position is flagged immediately as a potential no-prop breach; Helena reviews within one business day. If a position is confirmed as proprietary risk-taking, the Market Risk Committee is convened within 24 hours; the position is reduced or hedged to zero within the timeframe set in `Procedures/by-policy/market-risk-limit-monitoring.md`.

### Principles

- **Limits are calibrated to the franchise, not to capital capacity.** The Bank does not use the maximum capital headroom as the limit; limits are sized to the realistic institutional client franchise volumes at commencement of trading. Limit expansion requires a demonstrated client-driven need and Helena's approval; limit expansion beyond a defined increase threshold requires CEO (Board interim) approval.
- **Desk-level limits aggregate to the bank-wide limit.** Individual desk limits (GIRR desk, equities desk, FX desk) aggregate to the bank-wide RAS market risk lines. The desk-level limit structure is the primary operating constraint; the bank-wide limit is the consolidated governance view. Helena ensures that the sum of desk-level limits does not exceed the bank-wide limit accounting for realistic correlation and diversification.
- **All positions are measured daily.** There is no weekly or end-of-month measurement cycle. Every trading day's close-of-business position is measured by the FRTB SA engine; the `MarketRiskMeasureComputed` event for the prior day is in the event log by the next business morning. Positions in instruments not yet fully onboarded to the FRTB SA engine are held to zero; no trading in instruments outside the measurement perimeter.
- **Breaches are resolved, not carried.** A Hard Breach of a sensitivity-based or VaR/ES limit is not a limit exception to be approved and carried forward. It is a breach that requires resolution: either the position is reduced to within the limit, or Helena proposes a limit increase to the CEO (Board interim) and the Market Risk Committee approves a short-term exemption with a resolution deadline. There are no standing limit exceptions.

---

## 4. FRTB Capital Framework

**Owner:** Helena (Chief Risk Officer, governance) — methodology; Rohan (Market risk quantitative engineer, engineering) — computation; Camille (Chief Financial Officer, governance) — BA-return integration · **Approval:** Board (CEO interim) for capital methodology elections; PA approval required for IMA desk elections · **Cadence:** Daily SA computation; monthly BA-return generation; quarterly ICAAP integration · **Citation:** BCBS FRTB (January 2019) — SA and IMA methodologies + PA D/2025 (1 July 2025 effective date; `ORG-PR-33`) + `ORG-PR-19` (FRTB capital) + `ORG-PR-56` (IMA desk approval) + `ORG-PR-60` (SA/IMA capital reporting to PA)

### Purpose

This section governs the capital computation framework for market risk. The FRTB introduces three capital approaches: SA (Standardised Approach, the regulatory minimum), IMA (Internal Models Approach, desk-level PA-approved), and the simplified SA for smaller banks. Hoz Bank Limited uses SA from commencement of trading as the default. IMA is the aspirational approach for desks meeting the eligibility criteria; the Bank will seek PA desk-level approval once the quantitative requirements are demonstrably met. This section defines the SA computation methodology, the IMA eligibility pathway, and the capital reporting obligations (`ORG-PR-60`).

### 4.1 SA Capital Computation

The FRTB SA capital charge is the sum of three components: (i) the sensitivity-based method (SBM) — delta, vega, and curvature sensitivities aggregated across risk classes per the BCBS FRTB SA correlation and aggregation rules; (ii) the default risk charge (DRC) — jump-to-default risk for credit and equity instruments, computed using the specified risk weights per the FRTB SA; and (iii) the residual risk add-on (RRAO) — a flat capital add-on for instruments with complex residual risks not captured by SBM or DRC.

The SA capital is computed by Rohan's FRTB SA engine. The engine consumes end-of-day position data from the front-office system and market data from the market data feed; it applies the BCBS FRTB SA formulas and produces a `FrtbSaCapitalComputed { date, totalSaCapital, sbmComponent, drcComponent, rraoComponent, deskBreakdown[] }` typed event. Camille integrates the `totalSaCapital` output (SA approach, or the IMA figure once an Internal Models Approach is PA-approved) into the **BA 320** market-risk return per the SARB reporting schema, flowing into the BA 700 capital-adequacy summary.

### 4.2 IMA Eligibility and Desk Approval

The Bank may apply IMA capital only for desks that: (i) have received PA desk-level approval (`ORG-PR-56`); (ii) have passed back-testing for the preceding 250 trading days (§4.3); (iii) have passed the PLA test for the preceding period (§4.4); (iv) have treated all NMRF risk factors under the SES charge (§4.5); and (v) have satisfied the PA's qualitative standards for model governance and independent validation (Nadia's validation as a precondition).

Pre-approval, the Bank runs IMA models in dual-run mode alongside SA, for the purpose of model development and pre-submission validation. IMA dual-run results are not used for regulatory capital; SA capital governs until PA approval is confirmed. A `ImaDesklApprovalGranted { deskId, paApprovalRef, effectiveDate }` event in the event log is the required trigger for switching the regulatory capital computation from SA to IMA for that desk.

If a desk's back-testing breach count enters the Red zone (> 12 exceptions in 250 days) after PA IMA approval, the desk reverts to SA capital per the BCBS FRTB back-testing capitalisation add-on rules until the breach count improves. Reversion to SA is automatic and immediate; no governance decision is required to apply the SA capital — it applies by regulatory rule.

### 4.3 Back-Testing (`ORG-PR-58`)

FRTB requires back-testing of IMA models against the 250-day daily P&L history. Two P&L series are tested: the actual P&L (HPL — Hypothetical P&L, calculated by re-pricing the portfolio using the prior day's risk sensitivities with updated market data) and the risk-theoretical P&L (RTPL, calculated using the IMA model's sensitivities). Back-testing counts the number of days in the 250-day window on which the actual 1-day loss exceeds the 1-day 99% VaR estimate from the model.

Zone thresholds (per BCBS FRTB `[citation: TBC — FRTB table specifying green/amber/red thresholds]`):
- **Green zone:** 0–4 exceptions in 250 days. IMA capital applies without add-on.
- **Amber zone:** 5–9 exceptions in 250 days. IMA capital applies with a scaling add-on that increases with the exception count, per the FRTB table. Helena reports the amber zone status to the Market Risk Committee and BRC.
- **Red zone:** 10 or more exceptions in 250 days. The desk reverts to SA capital (1.5× the IMA-based ES charge, or the SA charge, whichever is higher, per FRTB `[citation: TBC — FRTB paragraph on red-zone capital floor]`). Red-zone entry is a Critical event under this policy (§1.4). The desk must remain on SA until the 250-day rolling window clears the red-zone threshold.

Back-testing is performed daily by Rohan; the `BacktestingOutcomeRecorded { deskId, date, exceptionCount250d, zone }` event is the canonical record. Helena reviews the zone status weekly; a zone transition is reported to the Market Risk Committee at the next meeting and immediately if the transition is to Red.

### 4.4 PLA Test (`ORG-PR-57`)

The Profit & Loss Attribution (PLA) test is a FRTB prerequisite for IMA desk eligibility. It compares, for each desk, the risk-theoretical P&L (RTPL, generated by the IMA risk model) with the hypothetical P&L (HPL, generated by full revaluation) on a day-by-day basis over the preceding 12 months. The PLA test measures whether the IMA model adequately captures the drivers of the desk's P&L. If the model is missing material risk factors, the RTPL and HPL will diverge, and the desk fails the PLA test.

PLA test metrics (per BCBS FRTB): the Spearman correlation of RTPL and HPL, and the ratio of the variance of (RTPL − HPL) to the variance of HPL. A desk passes the PLA test if: Spearman correlation ≥ 0.80 and variance ratio ≤ 0.20. A desk in the amber zone (correlation between 0.70–0.80 and/or variance ratio 0.20–0.30) may still use IMA but incurs an additional capital surcharge. A desk that fails (correlation < 0.70 or variance ratio > 0.30) must use SA capital for that desk.

The PLA test is computed monthly by Rohan; the `PlaTestResultRecorded { deskId, month, spearmanCorrelation, varianceRatio, passFail, zone }` event is the canonical record. A PLA test failure is reported to Helena immediately and to the Market Risk Committee at the next meeting. A consecutive quarterly PLA failure triggers a model review by Nadia and may require PA notification if the desk was IMA-approved; Imani confirms the notification obligation `[citation: TBC]`.

### 4.5 NMRF and SES Treatment (`ORG-PR-59`)

Non-Modellable Risk Factors (NMRFs) are risk factors that fail the FRTB modellability test — defined as risk factors for which there are fewer than 24 verifiable price observations per year (or fewer than 100 observations per year for certain risk factor categories, per the BCBS FRTB modellability criteria `[citation: TBC — FRTB modellability test paragraphs]`). NMRFs cannot be included in the IMA ES model; they attract a separate capital charge called the Stress Scenario Charge (SES).

For each NMRF, the SES is computed as the maximum loss from a stress scenario applied specifically to that risk factor, per the BCBS FRTB SES methodology. SES charges are aggregated across NMRFs using a partial-aggregation rule (full aggregation across NMRFs in the same risk class, zero correlation across risk classes, per FRTB `[citation: TBC]`). The total SES charge is added to the IMA ES charge to give the total IMA capital charge.

Rohan is responsible for: (i) running the FRTB modellability test for every risk factor in the IMA perimeter at least monthly; (ii) computing SES for each identified NMRF; (iii) filing `NmrfIdentified { riskFactor, testDate, observationCount, sesCharge }` and `SesChargeComputed { date, totalSes, nmrfList[] }` events. Helena reviews the NMRF inventory quarterly; a material increase in the NMRF count (more than 20% increase from prior quarter) is reported to the Market Risk Committee and triggers a review of the Bank's data sourcing for the affected risk factors.

---

## 5. CVA Capital (`ORG-PR-33`)

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim) for CVA hedging decisions above the approved limit · **Cadence:** Daily CVA sensitivity monitoring; monthly CVA capital computation for BA-return; quarterly ICAAP integration · **Citation:** BCBS *Minimum capital requirements for CVA risk* (July 2020) + PA D/2025 (`ORG-PR-33`) + `ORG-PR-19` (FRTB capital obligation)

### Purpose

Credit Valuation Adjustment (CVA) represents the market value of counterparty credit risk in bilateral OTC derivatives. The revised CVA framework (BCBS July 2020) introduces a capital charge for the risk of mark-to-market losses on derivatives portfolios from deterioration in counterparty credit quality (spread risk) — distinct from the Expected Positive Exposure (EPE) credit risk capital charge for actual default. The PA has mandated implementation from 1 July 2025 (PA D/2025; `ORG-PR-33`). The Bank's OTC IRD franchise with institutional counterparties makes CVA capital a material component of market risk capital.

### Principles

- **CVA-SA as the default.** The CVA Standardised Approach (CVA-SA) is the default capital approach. CVA-SA uses regulatory-prescribed sensitivity parameters and counterparty credit quality weights. The Bank computes CVA-SA capital for all netting sets with OTC derivative exposures. CVA-BA (Basic Approach) is available as a fallback for netting sets below the BCBS materiality threshold `[citation: TBC — CVA-BA eligibility threshold under BCBS CVA framework]`; Helena determines applicability on a netting-set basis.
- **CVA hedges reduce the capital charge.** Eligible CVA hedges (CDS referencing the counterparty or index hedges on correlated counterparties) reduce the CVA-SA capital charge under the BCBS offset rules. Hedging decisions above the approved CVA hedge limit (set in `Procedures/by-policy/market-risk-limit-monitoring.md`) require Helena's approval. All CVA hedges are documented as `CvaHedgeExecuted { nettingSetId, hedgeType, notional, effectiveDate }` events.
- **CVA capital is integrated into the total market risk capital.** The CVA capital charge is reported alongside the FRTB SA capital charge in the BA-return suite. Camille integrates both into the total market risk capital as a single line in the monthly capital report to the Market Risk Committee and ALCO.
- **CVA sensitivity monitoring aligns with MR-4.** The MR-4 risk appetite line (CVA sensitivity limit, §3) is the primary daily monitoring tool. Exceedance of the MR-4 limit triggers the same escalation path as other market risk limit breaches (§1.4 of this policy).

---

## 6. Market Risk Governance

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim) constitutes the Market Risk Committee; BRC is the Board-level governance layer · **Cadence:** Market Risk Committee meets monthly; daily limit monitoring is continuous · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks + `ORG-PR-19` + `ORG-PR-60` + `Policies/trading-mandate-v1.md`

### Purpose

The market risk governance structure ensures that the Bank's market risk exposure is managed within the approved appetite at all times, that limit breaches are escalated and resolved promptly, and that market risk capital is accurately computed and reported to the PA. The Market Risk Committee (MRC) is the primary governance body for market risk.

### 6.1 Market Risk Committee

The Market Risk Committee is a sub-committee of the Board Risk Committee (BRC). Its membership includes: Helena (chair), the desk heads of each client-facing trading desk (first line, non-voting on limit decisions), Camille (capital integration), Eitan (Treasurer, governance — ALCO linkage). Rohan attends as technical secretary and produces the committee pack. Owen manages the committee secretarially and files the meeting minutes as typed events (`MarketRiskCommitteeMeetingMinutes { meetingDate, decisionEvents[] }`).

The MRC's standing agenda items:
1. Daily VaR / ES vs. limit review (Rohan's daily market risk report).
2. Back-testing zone status (§4.3) — amber zone items require remediation update.
3. PLA test monthly results (§4.4) — amber/fail items require remediation plan.
4. NMRF inventory quarterly update (§4.5) — material increases tabled for discussion.
5. CVA capital and CVA sensitivity vs. MR-4 limit (§5).
6. New products in the market risk measurement perimeter (§2 boundary assessments).
7. IMA desk approval progress (§4.2) — for each desk pursuing IMA, status of quantitative prerequisites.
8. Limit utilisation trends — the 90-day rolling limit utilisation for each desk and risk class.
9. Regulatory developments — Rohan and Helena table any PA or BCBS publications affecting the framework.

The MRC escalates to the BRC: monthly capital position; any back-testing Red zone entry; any PLA test failure for an IMA-approved desk; any material change to the market risk methodology; any limit breach that is not resolved within the deadline set in the breach procedures.

### 6.2 Reporting

- **Daily:** Rohan produces the daily market risk report — VaR, ES, sensitivity-based measures, back-testing exception count, limit utilisation per desk and risk class. Report is a render of the `MarketRiskMeasureComputed` events from the prior close-of-business. Helena reviews by 09:00 each business day.
- **Monthly:** Rohan produces the market risk capital report — FRTB SA capital breakdown (SBM / DRC / RRAO per risk class), CVA capital, total market risk RWA, contribution to the Bank's Total capital ratio. Report is tabled at the MRC and included in the ALCO pack (Eitan, chair).
- **Quarterly:** Helena presents the market risk capital and limit utilisation trends to the BRC. Includes back-testing zone history, PLA test results, NMRF inventory trend, IMA desk approval progress.
- **PA regulatory returns (`ORG-PR-60`):** Camille files the **BA 320** market-risk return (SA capital, or IMA capital once a PA-approved Internal Models Approach is in force) as part of the BA-return suite, per the SARB reporting calendar. The BA-return filing is a `RegulatoryReturnFiled { returnType, period, amount }` event.

### 6.3 Independent Validation

Nadia (Independent-validation engineer, peer-in-second-line under Helena) validates the market risk models and the FRTB SA engine at least annually and before any PA submission (IMA desk approval application, ICAAP). The validation scope includes: model documentation completeness; SA engine correctness against BCBS FRTB formulas; IMA model performance (back-testing, PLA); NMRF identification methodology; CVA model. A `ModelValidationCompleted { modelId, modelVersion, scope[], findings[] }` event is the canonical validation record; Nadia's findings are tabled at the MRC and reviewed by Vera at the next audit cycle.

---

## 7. Obligations Closure Table

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-PR-19` | Measure trading-book market risk per FRTB; capital under SA or IMA | **IN FORCE** (COMMENCEMENT-BIND) — closed | §1 (Overarching), §4 (FRTB Capital Framework) |
| `ORG-PR-20` | No proprietary risk-taking outside warehoused franchise hedge positions | **IN FORCE** (COMMENCEMENT-BIND) — closed | §1 (no-prop principle), §3 (MR-5 RAS line), `Policies/trading-mandate-v1.md` cross-ref |
| `ORG-PR-33` | Implement FRTB + revised CVA per PA D/2025 timeline (1 July 2025) | **IN FORCE** (COMMENCEMENT-BIND) — closed | §1 (FRTB framework principle), §4 (SA + IMA), §5 (CVA capital) |
| `ORG-PR-56` | IMA trading-desk approval process | **IN FORCE** (COMMENCEMENT-BIND, process framework) — closed | §4.2 (IMA Eligibility and Desk Approval) |
| `ORG-PR-57` | PLA (Profit & Loss Attribution) test | **IN FORCE** (COMMENCEMENT-BIND) — closed | §4.4 (PLA Test) |
| `ORG-PR-58` | Back-testing of internal models | **IN FORCE** (COMMENCEMENT-BIND) — closed | §4.3 (Back-Testing) |
| `ORG-PR-59` | NMRF (Non-Modellable Risk Factors) / SES treatment | **IN FORCE** (COMMENCEMENT-BIND) — closed | §4.5 (NMRF and SES Treatment) |
| `ORG-PR-60` | SA/IMA capital reporting to PA | **IN FORCE** (COMMENCEMENT-BIND) — closed | §4 (FRTB Capital Framework), §6.2 (Reporting) |

---

## 8. Substrate Dependencies and Gaps

Per the events-first authoring rule (Principle 1), gaps are not hidden; they are work for downstream substrate build.

### 8.1 Substrate currently under construction

- **FRTB SA engine (Rohan, under Helena).** Produces daily FRTB SA capital (SBM / DRC / RRAO) from position data and market data feeds. Discharge exit signal: `FrtbSaCapitalComputed { date, totalSaCapital, sbmComponent, drcComponent, rraoComponent }` event on synthetic fixture; `recon:frtb-sa-validation` green against BCBS FRTB sample portfolios.
- **ES computation module (Rohan).** Produces daily 10-day 97.5% ES and 1-day 99% VaR for internal risk governance (MR-1 / MR-2 limits). Discharge exit signal: `MarketRiskMeasureComputed { date, es10d97p5, var1d99, deskBreakdown[] }` event.
- **Back-testing harness (Rohan).** Daily HPL / RTPL comparison and exception count against 250-day rolling window. Discharge exit signal: `BacktestingOutcomeRecorded { deskId, date, exceptionCount250d, zone }` event; first 250 trading days of data available at commencement of trading (pre-seeded from back-data where available).
- **PLA test infrastructure (Rohan).** Monthly Spearman correlation and variance ratio for each IMA-candidate desk. Discharge exit signal: `PlaTestResultRecorded { deskId, month, spearmanCorrelation, varianceRatio, passFail, zone }` event.
- **CVA-SA computation module (Rohan).** Produces monthly CVA capital charge per netting set. Discharge exit signal: `CvaCapitalComputed { month, totalCva, nettingSetBreakdown[] }` event.

### 8.2 Procedures — authored 2026-05-20

All four procedures contemplated by this section are now authored (POPULATED) by Rohan (Market risk quantitative engineer, engineering) under Helena (Chief Risk Officer, governance) via Scrooge dispatch `brief:rohan:draft-four-market-risk-procedures-policy-v1-8-2:2026-05-20`. CEO authorisation given by Marc in-session 2026-05-20:

- `Procedures/by-policy/frtb-sa-capital-computation.md` (PROC-RISK-FRTB-SA-01) — daily FRTB SA capital: SBM across seven risk classes (GIRR delta/vega/curvature; FX delta/vega/curvature; equity; CSR non-securitisation including OTC-IRD-counterparty CVA; CSR securitisation out-of-scope; commodity; equity), DRC jump-to-default, RRAO residual add-on, CVA-SA. Includes FX product → SA risk class mapping (spot, forward, swap, NDF, vanilla option, exotic option). Emits `FrtbSaCapitalComputed`.
- `Procedures/by-policy/backtesting-governance.md` (PROC-RISK-BACKTEST-01) — daily HPL / RTPL / VaR back-test; 250-day rolling exception count; Green (0–4) / Amber (5–9, scaling add-on) / Red (≥ 10, SA-fallback) zones; 24h notification on Amber and Red; 5bd remediation; PA notification on Red-zone entry for IMA-approved desks. Emits `BacktestingOutcomeRecorded`, `BacktestingZoneEntered`.
- `Procedures/by-policy/pla-test-governance.md` (PROC-RISK-PLA-01) — monthly Spearman correlation + variance ratio per (desk, risk class) over 12-month window; Green / Amber / Red; SA-fallback per risk class on Red; consecutive-quarterly-failure model review by Nadia per §4.4. Emits `PlaTestResultRecorded`.
- `Procedures/by-policy/market-risk-limit-monitoring.md` (PROC-RISK-MRL-01) — limit register for MR-1 (1d 99% VaR), MR-2 (10d 97.5% ES), MR-3 (sensitivity per risk class — GIRR/FX/equity/CSR×2/commodity-at-low-bound), MR-4 (CVA sensitivity) + MR-4-HEDGE (CVA hedge programme limit per §5), MR-5 (stress) + MR-5-NPA (no-prop attribution — binary 100% requirement); warning 50% / amber 80% / hard breach 100%; desk-level (GIRR/EQ/FX) → bank-wide aggregation; 15-min notification, 1bd MRC convene, 5bd remediation plan, PA notification on material breach. Numerical values are marked `[calibration: pending RAS-calibration by Rohan under Helena's direction]` — the procedure operationalises the governance; the values enter via Helena's recalibration cycle + CEO approval per §3. Emits `MarketRiskMeasureComputed`, `MarketRiskLimitBreached`, `NoPropAttributionFlagged`.

### 8.3 Citation gaps (TBC)

Per Principle 2, no sub-clause indices are invented. The following are `[citation: TBC]` until Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate:

1. FRTB (January 2019) — precise chapter, paragraph references for: (a) boundary definitions and presumptive lists; (b) back-testing green/amber/red zone threshold table; (c) PLA test Spearman/variance-ratio thresholds; (d) NMRF modellability test observation-count criteria; (e) SES partial-aggregation rules; (f) reclassification prior-consent rule.
2. Regulations Relating to Banks — Reg 32 sub-clause indices for market risk capital requirement and boundary provisions.
3. PA D/2025 — full directive reference; exact FRTB + CVA implementation date confirmation.
4. BCBS CVA framework (July 2020) — CVA-BA eligibility threshold and hedge offset rules.
5. PA notification obligation on Red-zone back-testing entry and PLA test failure post-IMA approval.

---

## 9. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1.1 | 2026-05-20 | Rohan (Market risk quantitative engineer, engineering) under Helena (Chief Risk Officer, governance) — via Scrooge dispatch `brief:rohan:draft-four-market-risk-procedures-policy-v1-8-2:2026-05-20`; CEO authorisation by Marc 2026-05-20 in-session | §8.2 updated — all four contemplated procedures authored (POPULATED): `PROC-RISK-FRTB-SA-01` (FRTB SA capital computation; SBM/DRC/RRAO/CVA; FX product → risk class mapping); `PROC-RISK-BACKTEST-01` (daily HPL/RTPL back-testing; 250-day rolling exception count; Green/Amber/Red with SA-fallback); `PROC-RISK-PLA-01` (monthly Spearman correlation + variance ratio per desk × risk class; SA-fallback per risk class on Red; consecutive-quarterly-failure review); `PROC-RISK-MRL-01` (limit register MR-1 to MR-5 + MR-4-HEDGE + MR-5-NPA; warning 50% / amber 80% / hard breach 100%; 15-min notification + 1bd MRC + 5bd remediation; no-prop attribution daily sweep). Calibration values in PROC-RISK-MRL-01 marked `[calibration: pending RAS-calibration by Rohan under Helena's direction]`; commodity sub-limit marked as lower bound consistent with non-primary-franchise scope per §3. No other changes to the policy. |
| v1 | 2026-05-13 | Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering) | Initial policy authored. Eight sections: (1) Overarching — FRTB framework as governing standard, SA default, IMA aspirational, no-prop principle, events-first accounting, three-severity breach taxonomy; (2) Trading Book / Banking Book Boundary — FRTB presumptive lists, reclassification by prior PA consent, new-product boundary assessment; (3) Market Risk Appetite — five RAS market risk lines (MR-1 VaR, MR-2 ES, MR-3 sensitivities, MR-4 CVA, MR-5 no-prop enforcement), calibration principles; (4) FRTB Capital Framework — SA computation, IMA desk approval pathway, back-testing (ORG-PR-58), PLA test (ORG-PR-57), NMRF/SES (ORG-PR-59); (5) CVA Capital (ORG-PR-33) — CVA-SA default, hedge reduction, integration into total market risk capital; (6) Market Risk Governance — Market Risk Committee composition and agenda, daily/monthly/quarterly/PA reporting cadence (ORG-PR-60), independent validation pre-conditions; (7) Obligations closure table: ORG-PR-19, ORG-PR-20, ORG-PR-33, ORG-PR-56, ORG-PR-57, ORG-PR-58, ORG-PR-59, ORG-PR-60. Substrate and citation gaps explicitly named per Principle 2. Identity discipline per CLAUDE.md. |
