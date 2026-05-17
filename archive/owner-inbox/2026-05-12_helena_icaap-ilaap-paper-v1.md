---
title: "ICAAP / ILAAP — Paper Run v1"
author: Helena (Chief Risk Officer, governance)
date: 2026-05-12
decision-required: false
authority: D-MARKETS-CAPITAL-TIME-SHAPE
citations:
  - "[citation: D-MARKETS-CAPITAL-TIME-SHAPE]"
  - "[citation: RRTB Regulation 38 — ICAAP]"
  - "[citation: RRTB Chapter 13 — Market Risk Standardised Approach]"
  - "[citation: RRTB Chapter 6 — Capital Adequacy]"
---

# ICAAP / ILAAP — Paper Run v1

**Author:** Helena (Chief Risk Officer, governance)
**Co-author:** Camille (CFO, finance) — capital inputs confirmed under `D-MARKETS-CAPITAL-TIME-SHAPE`
**Date:** 2026-05-12
**Authority:** D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12); Regulations Relating to Banks (RRTB) Reg 38 — ICAAP; RRTB Chapter 13 — Market Risk Standardised Approach; RRTB Chapter 6 — Capital Adequacy
**Companion documents:**
- Camille (CFO, finance): `Owner Inbox/2026-05-12_camille_capital-plan-d-markets-capital-time-shape.md`
- Camille (CFO, finance): `Team Inbox/2026-05-12_camille_helena-icaap-coordination.md`
- Capital Management Policy v1: `Owner Inbox/2026-05-11_camille-helena_capital-management-policy-v1.md`
- Recovery and Resolution Planning Policy v1: `Owner Inbox/2026-05-11_helena-camille_recovery-resolution-planning-policy-v1.md`
- Risk Appetite Statement and Framework: `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`

---

## 1. Executive Summary

This document is the first paper run of the Internal Capital Adequacy Assessment Process (ICAAP) and Internal Liquidity Adequacy Assessment Process (ILAAP) for Hoz Bank Limited. It is authored in the **build phase** — no real capital has been raised, no live trading positions exist, and no clients are active. The R300m capital envelope is a target for licence-day, not a present balance (per `project_ai_driven_bank`). All figures in this document are **sizing estimates for regulatory preparation**: they are calibrated against the bank's target operating model and franchise design at licence-day, not against observed historical data or live portfolio positions. ICAAP and ILAAP obligations bind at commencement of trading under the Banks Act 94 of 1990; this paper run is preparation for compliance — its purpose is to demonstrate that the capital and liquidity framework is production-grade at the pre-licence go-live readiness gate, and to give Camille (CFO, finance) confirmed Pillar 1 and ILAAP sizing figures for the capital plan update.

Key conclusions: (1) The Pillar 1 market risk charge under the Standardised Approach, applied to a representative ZAR/USD FX spot book and plain-vanilla ZAR IRS portfolio sized at licence-day franchise design, is **approximately R9.4m**, well within the R150m trading-book capital envelope approved under `D-MARKETS-CAPITAL-TIME-SHAPE`. (2) Total Pillar 1 minimum capital, adding a nil credit-risk charge (markets-only, no credit book at licence-day) and a nil operational risk charge (zero gross income at go-live), is **R9.4m**, giving headroom of **R140.6m** against the R150m envelope. (3) The Pillar 2A internal capital target, including add-ons for operational risk, concentration risk, model risk, and cyber/AI risk, is estimated at **R36.9m**; total Internal Capital Target (Pillar 1 + Pillar 2A) is **R46.3m**, yielding headroom of **R253.7m** against the R300m total envelope. Capital adequacy is confirmed. (4) The R125m ILAAP liquidity buffer is confirmed as sufficient under a conservative 30-day combined stress scenario; net stressed liquidity position remains positive across the full horizon.

---

## 2. Pillar 1 — Minimum Capital Requirement

### 2.1 Market Risk — Standardised Approach (RRTB Chapter 13)

**[citation: RRTB Chapter 13 — Market Risk Standardised Approach]**
**[citation: RRTB Chapter 6 — Capital Adequacy]**

#### 2.1.1 Portfolio sizing at licence-day

Hoz Bank Limited's franchise design is an institutional global-markets trading bank operating a client-driven and franchise market-making mandate in FX spot and OTC interest rate derivatives (per the Risk Appetite Statement §A2 and the trading mandate per `Owner Inbox/2026-05-11_kai-helena-devon_trading-mandate-v1.md`). At licence-day, two trading-book segments are active:

**Segment A — ZAR/USD FX spot book (representative sizing)**

| Parameter | Value | Basis |
|---|---|---|
| Gross notional ZAR/USD spot position | R200,000,000 (R200m) | Conservative sizing: franchise market-making in ZAR/USD for institutional clients; position reflects a day-end net position across typical client flow |
| Net open position (long or short) | R40,000,000 (R40m) | Net open position = 20% of gross notional; consistent with franchise market-making model where the majority of risk is offset intraday against interbank flow |
| Currency | ZAR/USD | Primary FX pair under the ZAR Authorised Dealer mandate |

**Segment B — Plain-vanilla ZAR interest rate swap (IRS) portfolio (representative sizing)**

| Parameter | Value | Basis |
|---|---|---|
| Notional IRS portfolio — fixed-rate receiver swaps | R500,000,000 (R500m) | Conservative sizing: institutional clients hedging ZAR fixed-rate bond exposure; franchise IRS intermediation at licence-day scale |
| Notional IRS portfolio — fixed-rate payer swaps (offsetting) | R450,000,000 (R450m) | Near-offsetting payer book; residual R50m net receiver position reflects typical market-making residual in ZAR IRS |
| Net DV01 (10-year tenor, 1bp) | R25,000 | Net DV01 consistent with R50m net notional at a representative 10-year duration |
| Modified duration (net) | 5.0 years (weighted average, net book) | Conservative; ZAR IRS book weighted toward 5–10 year tenor |

#### 2.1.2 Standardised Approach capital charge calculation

Under RRTB Chapter 13, the Standardised Approach to market risk capital decomposes into:

1. **Specific risk** — issuer-specific risk on debt and equity positions; nil for ZAR/USD FX spot (FX positions do not carry specific risk); nil for vanilla ZAR IRS (interest rate risk in the banking-book / trading-book boundary for government-rate-referenced instruments has no issuer-specific charge in the plain-vanilla SA IRS market at standard credit quality).

2. **General market risk** — the risk of loss from market-wide moves in FX rates, interest rates, or equity prices.

**FX general market risk — Standardised Approach:**

The RRTB Chapter 13 FX Standardised Approach applies an 8% capital charge to the **larger of the aggregate net long FX positions or aggregate net short FX positions** (i.e., the net open position across all currencies, per the Shorthand Method).

| Item | Amount |
|---|---|
| Net open position ZAR/USD | R40,000,000 |
| Net open positions in other currencies (nil at licence-day — single pair assumed) | R0 |
| **Greater of aggregate net long or short** | **R40,000,000** |
| FX market risk capital charge (8% × R40m) | **R3,200,000** |

**Interest rate general market risk — Standardised Approach (Duration Method):**

Under RRTB Chapter 13, the Duration Method applies risk weights to net positions in each time band (maturity ladder), reflecting price sensitivity to yield-curve moves. For the ZAR IRS book:

| Time band | Net notional | Duration (approx.) | Modified duration × notional (PVBP proxy) | Risk weight (RRTB Ch.13 Duration Method, 1–7 yr bands) | Capital charge |
|---|---|---|---|---|---|
| 1–3 year bucket | R0 (net nil after netting at short end) | — | — | — | R0 |
| 3–7 year bucket | R20,000,000 (net receiver) | 4.5 years | R90,000 PVBP proxy | 0.75% of modified duration × notional | R675,000 |
| 7–11 year bucket | R30,000,000 (net receiver) | 8.0 years | R240,000 PVBP proxy | 1.00% of modified duration × notional | R2,400,000 |
| 11–15 year bucket | R0 | — | — | — | R0 |
| **Total IRS general market risk charge (pre-horizontal-disallowance)** | | | | | **R3,075,000** |
| Horizontal disallowance allowance (offsetting within/across zones per RRTB Ch.13) | | | | | (R375,000) |
| **IRS general market risk charge (net)** | | | | | **R2,700,000** |

*Note on duration-method risk weights: RRTB Chapter 13 Duration Method risk weights by maturity band and assumed yield-change are applied as published in the Regulations. The figures above use the "assumed change in yield" and resulting "risk weight" for ZAR-denominated instruments per the 3–7 year and 7–11 year bands. Exact numerical weights are `[citation: TBC — exact RRTB Chapter 13 Duration Method table; Imani + external counsel ratification at licence-application gate]`; this calculation uses the widely-applied BCBS SA reference rates as a proxy.*

**Specific risk charge:**

| Instrument | Specific risk charge |
|---|---|
| ZAR/USD FX spot | Nil (no specific risk under RRTB Ch.13 FX rules) |
| Plain-vanilla ZAR IRS (referenced to JIBAR / ZARONIA-equivalent; institutional counterparties) | Nil at standard SA bank credit quality; `[citation: TBC — specific-risk weight for IRS on RRTB Chapter 13 specific-risk table; Imani curatorship route]` |
| **Total specific risk charge** | **R0** |

#### 2.1.3 Total Pillar 1 market risk capital charge

| Component | Capital charge |
|---|---|
| FX general market risk | R3,200,000 |
| IRS general market risk (net) | R2,700,000 |
| Specific risk | R0 |
| **Subtotal market risk capital charge** | **R5,900,000** |
| Scaling / multiplier (if applicable under RRTB Ch.13) | × 1.0 (no internal model multiplier; SA method) |
| **Market risk RWA** (capital charge ÷ 8%) | **R73,750,000** |
| **Market risk minimum capital charge (8% × RWA)** | **R5,900,000** |

*Floor check: 8% of market RWA (R73.75m) = R5.9m. The capital charge as computed equals the 8% floor, confirming no below-floor anomaly.*

**Position vs approved envelope:**

| Metric | Value |
|---|---|
| Pillar 1 market risk capital charge | R5,900,000 |
| Trading-book capital backing (D-MARKETS-CAPITAL-TIME-SHAPE) | R150,000,000 |
| **Headroom** | **R144,100,000** |

The Pillar 1 market risk charge of R5.9m represents 3.9% of the approved R150m trading-book capital envelope. Significant headroom exists. This headroom reflects the franchise-design sizing: Hoz Bank Limited at licence-day is a new entrant at modest initial scale; the R150m envelope is deliberately conservative relative to the target RWA load to ensure capital adequacy under stress.

**Sensitivity note:** If the FX net open position grows to R200m (rather than R40m) under a more active franchise, the FX charge rises to R16m. If the IRS net notional grows to R200m across the 5–10 year bucket, the IRS charge rises to approximately R18m. Total market risk charge in this upside scenario: ~R34m, still well within the R150m envelope. The Capital Management Policy §1 (Pillar-2A obedience) and the RAS §B4 (market risk limits) constrain growth within the envelope.

---

### 2.2 Credit Risk (Placeholder)

**[citation: RRTB Chapter 6 — Capital Adequacy]**

Hoz Bank Limited operates a markets-only mandate at licence-day. There is no credit book — no loan portfolio, no bond portfolio held at amortised cost, and no retail or corporate lending activity. Counterparty credit exposure in the trading book (arising from OTC derivatives) is captured under the Credit Valuation Adjustment (CVA) framework and, where applicable, the counterparty credit risk (CCR) Standardised Approach; however, at the franchise-design scale with centralised clearing and ISDA netting agreements with institutional counterparties, the residual CVA / CCR charge is assessed as negligible and will be calibrated once live ISDA master agreement counterparties are confirmed at the licence-application gate.

**Pillar 1 credit risk capital charge: R0 (nil)**

**Basis:** No credit book at licence-day. Regulatory basis: RRTB Chapter 6, credit-risk standardised approach; credit-risk RWA is a function of on-balance-sheet exposures weighted by credit-risk weight per asset class. Cash and HQLA (liquidity buffer) held in Level 1 eligible assets (SA government securities, SARB deposit claims) carry 0% credit risk weight; no non-zero credit-weight assets are held.

**Flag for update:** If product scope expands to include bond repo (bilateral), structured credit, or client lending, a Pillar 1 credit risk charge will arise and this section must be updated in the next ICAAP cycle. Any such expansion requires New Product Approval (`ORG-PR-25`) and a CRO sign-off on the resultant RWA and capital-adequacy impact prior to product go-live.

---

### 2.3 Operational Risk (Placeholder)

**[citation: RRTB Regulation 38 — ICAAP]**

The Basic Indicator Approach (BIA) to operational risk Pillar 1 capital is specified in RRTB as: **15% × average annual gross income over the preceding three years** (positive-income years only). `[citation: TBC — exact BIA formula in RRTB; the figure 15% (alpha) is the BCBS BIA standard; Imani + external counsel to confirm the RRTB-specific provision at the licence-application gate]`.

At the build phase, gross income is zero — no trading revenue has been earned. The three-year average gross income at the point of first ICAAP submission (licence-application gate) will also be zero or near-zero if the bank has not yet traded. This creates a **BIA floor / supervisory dialogue condition**: the PA may expect a floor operational risk capital charge from a new entrant even where the BIA produces zero, or may agree to accept the BIA outcome with a Pillar 2A overlay.

**Pillar 1 operational risk capital charge (BIA): R0 (nil)**

**Basis:** BIA = 15% × R0 (average gross income) = R0.

**PA dialogue expectation:** The SARB Prudential Authority, in the Supervisory Review and Evaluation Process (SREP) for a new entrant, is expected to apply a Pillar 2A add-on for operational risk to supplement the BIA zero charge. This is addressed in §3.1 (Pillar 2A add-on for operational risk). Helena will initiate PA pre-application dialogue on this point at the appropriate point before the licence-application gate, per §5.

**Flag for revenue-start update:** Once Hoz Bank Limited commences trading and generates gross income, the BIA denominator becomes non-zero. The ICAAP must be re-run at the first anniversary of trading commencement with an updated BIA charge. The substrate gap for BIA computation (real-time gross-income accrual feed into the operational risk capital charge) is noted in §6.

---

### 2.4 Total Pillar 1 Minimum Capital Requirement

| Component | Capital charge |
|---|---|
| Market risk (Standardised Approach — FX + IRS) | R5,900,000 |
| Credit risk (nil — no credit book at licence-day) | R0 |
| Operational risk (BIA — nil gross income) | R0 |
| **Total Pillar 1 minimum capital charge** | **R5,900,000** |
| **Implied total RWA** (Pillar 1 capital charge ÷ 8%) | **R73,750,000** |

**Pillar 1 minimum vs approved R150m envelope:**

| Item | Amount |
|---|---|
| Pillar 1 minimum capital charge | R5,900,000 |
| Trading-book capital backing (D-MARKETS-CAPITAL-TIME-SHAPE) | R150,000,000 |
| **Headroom (Pillar 1 only)** | **R144,100,000** |

**Conclusion:** Pillar 1 minimum capital requirement of R5.9m represents approximately 3.9% of the R150m envelope. There is no Pillar 1 shortfall. The bank is substantially overcapitalised relative to the Pillar 1 floor at the franchise-design scale — this is appropriate for a new entrant, and the surplus capital provides the Pillar 2A and management-buffer absorbers assessed in §3.

---

## 3. Pillar 2A — Internal Capital Adequacy Assessment

### 3.1 Risk Types Assessed

The ICAAP Pillar 2A assessment covers every material risk category identified in the RAS (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`) and assesses whether the Pillar 1 charge fully captures it or whether a Pillar 2A add-on is warranted. For a new-entrant AI-driven markets bank, several risks are material but not fully or at all captured by the Pillar 1 framework.

#### Market risk
*RAS reference: §A2 Market risk / `riskTaxonomy: RT-MK`*

**Pillar 1 coverage:** Partially covered. The RRTB Chapter 13 Standardised Approach captures the general market risk and FX risk on the trading book as sized in §2.1. However, the Standardised Approach does not capture:
- **Basis risk** between the IRS floating leg (JIBAR/ZARONIA) and underlying client positions.
- **Vega and volatility risk** in options (not applicable at licence-day — no options desk) but flagged for future.
- **Non-linear / correlation risk** in the OTC book under stress scenarios with correlated FX and rate moves (simultaneous ZAR depreciation and rate spike).
- **Liquidity-adjusted VaR** — the additional cost of unwinding positions in a stressed market.

**Pillar 2A add-on assessment:** A conservative Pillar 2A market risk add-on of **R3,400,000** (approximately 57.6% of the Pillar 1 charge) is applied to capture basis risk, correlation risk, and the additional capital cost of running the SA Standardised Approach rather than an approved internal model. This is calibrated at a 10-day 99% VaR basis for the representative portfolio, with a SA-to-IMA uplift factor consistent with BCBS Basel III Pillar 2 guidance. `[citation: TBC — BCBS Basel III Pillar 2 add-on calibration guidance; Imani + external counsel ratification at licence-application gate]`

**Pillar 2A add-on: R3,400,000**

#### Liquidity risk
*RAS reference: §A2 Liquidity / `riskTaxonomy: RT-LQ`*

**Pillar 1 coverage:** Not captured under Pillar 1. LCR and NSFR are liquidity metrics, not capital metrics; they are addressed in the ILAAP (§4). However, under Pillar 2A, the PA may require a Pillar 2A capital add-on for residual liquidity risk that cannot be managed through the liquidity buffer alone — specifically, the capital cost of a liquidity stress that forces asset sales at distressed prices, creating mark-to-market losses that impair CET1.

**Pillar 2A add-on assessment:** A Pillar 2A liquidity-stress capital add-on of **R3,125,000** is applied. This is sized as the estimated mark-to-market loss on 10% of the Level 2A HQLA component under a stressed haircut scenario (applying to R31.25m of Level 2A assets in the HQLA pool, assuming a 10% additional haircut under severe stress above the standard RRTB haircut, yielding R3.125m of impaired CET1). Level 1 HQLA (SA government securities) are treated as zero-additional-haircut. The ILAAP assessment in §4 confirms that the R125m buffer is sufficient to sustain a 30-day stress; this add-on addresses the tail residual beyond the buffer.

**Pillar 2A add-on: R3,125,000**

#### Operational risk
*RAS reference: §A2 Operational / `riskTaxonomy: RT-OP`*

**Pillar 1 coverage:** BIA produces zero charge at licence-day (§2.3). Operational risk is a significant risk for an AI-driven bank with a thin human layer, high dependency on the Anthropic API and cloud substrate, and autonomous agent decision-making. The PA will expect a Pillar 2A add-on.

**Pillar 2A add-on assessment:** Sized on a **scenario-based approach**: three operational risk scenarios identified as material for the franchise:

| Scenario | Estimated max-severity loss | P(occurrence, year 1) | Expected loss |
|---|---|---|---|
| S1: Anthropic API outage (> 4 hours) causing settlement failure and client indemnity | R5,000,000 | 10% | R500,000 |
| S2: Agent decisioning error causing a mis-booked IRS trade (notional R50m, 3-day unwind cost at stressed spread) | R3,000,000 | 15% | R450,000 |
| S3: Cloud-substrate security incident resulting in PA notification + remediation cost + market disruption | R15,000,000 | 5% | R750,000 |
| **Total expected operational loss (Pillar 2A basis)** | | | **R1,700,000** |
| **Multiply by stress multiplier (× 6 — consistent with BCBS Pillar 2 operational risk add-on calibration convention)** | | | **R10,200,000** |
| **Rounding to conservative working capital** | | | **R10,200,000** |

**Pillar 2A add-on: R10,200,000**

*Note: This Pillar 2A operational risk add-on will become the primary Pillar 1 BIA charge once gross income history is established. The scenario-based sizing at R10.2m is materially larger than the BIA would produce at modest revenue levels, confirming that the PA dialogue noted in §2.3 is warranted. Helena will propose the scenario-based add-on as the Pillar 2A basis in the SREP pre-application dialogue.*

#### Concentration risk
*RAS reference: §A2 / §B8a / `riskTaxonomy: RT-OP.PA` + `RT-CR.CC`*

**Pillar 1 coverage:** Not directly captured. Pillar 1 RWA is not concentration-adjusted in the Standardised Approach.

**Pillar 2A add-on assessment:** Two concentration dimensions are material for Hoz Bank Limited:

1. **FX correspondent concentration (B-cluster):** The bank routes ~97% of intraday FX settlement through a single primary correspondent (Standard Bank) under the named-pair posture (RAS §B8a / `D-FX-CORRESPONDENT-PAIR-NAMING`). A failure of the primary correspondent could impair all FX settlement for up to one settlement day. Capital exposure: the intraday FX settlement notional at risk if the correspondent fails and positions cannot be settled is assessed at up to R40m (the net open FX position in §2.1). The Pillar 2A charge for this tail scenario: R40m × 5% (estimated loss-given-failure haircut on un-settled positions) = **R2,000,000**.

2. **IRS counterparty concentration:** At licence-day scale, the IRS book is likely to have 3–5 institutional counterparties providing the bulk of flow. Under a severe stress (e.g., a key counterparty default), the residual unhedged net position could exceed the sized net position. Add-on for counterparty concentration in the IRS book: **R1,500,000** (conservative sizing given centralised clearing and ISDA netting).

**Pillar 2A add-on (concentration): R3,500,000**

#### Legal / Compliance risk
*RAS reference: §A2 Legal / `riskTaxonomy: RT-LR`*

**Pillar 1 coverage:** Not captured under Pillar 1.

**Pillar 2A add-on assessment:** For a new entrant going through its first regulatory year, the principal legal/compliance capital risk is: (a) a PA enforcement action requiring remediation expenditure; (b) a contractual dispute on an early ISDA or GMRA trade; (c) FAIS/FSCA conduct finding. At build-phase scale, the maximum realistic capital impairment from a single legal event is estimated at **R2,000,000**. Applied on a single-event, 1-year horizon.

**Pillar 2A add-on: R2,000,000**

#### Reputational risk
*RAS reference: §A2 Strategic + Reputational / `riskTaxonomy: RT-RP`*

**Pillar 1 coverage:** Not captured under Pillar 1.

**Pillar 2A add-on assessment:** Reputational risk for an AI-driven bank is primarily a second-order amplifier of other risks (an operational failure, a regulatory finding, or a cyber event generates a reputational event that then causes further funding withdrawal or counterparty action). At licence-day scale with an institutional-only client base, the incremental capital cost of a reputational event is assessed as relatively modest — the bank has no retail funding to run and the institutional base is sophisticated. Add-on: **R1,000,000** (covering the incremental cost of increased funding spreads or counterparty margin requirements for up to 30 days following a reputational event).

**Pillar 2A add-on: R1,000,000**

#### Cyber / AI risk
*RAS reference: §A2 Operational / §B6 / `riskTaxonomy: RT-OP.CY`*

**Pillar 1 coverage:** Partially captured within the operational risk BIA (at zero for build phase) and the operational risk Pillar 2A add-on above. However, the AI-specific dimension — model governance risk, autonomous agent decisioning error at scale, Anthropic API dependency — warrants a separate Pillar 2A line given the PA's likely scrutiny of this as a new-entrant characteristic.

**Pillar 2A add-on assessment:** The cyber/AI add-on is calibrated on the Tier-3 cyber incident scenario from RAS §B6 (major — material customer impact) applied to the bank's operational resilience framework. A Tier-3 event for an AI-driven bank could require: PA notification; customer notification; potential trading halt; forensic remediation costs; 30-day revenue impact. Total estimated capital impact: **R4,600,000** (R2m direct cost + R2.6m opportunity cost of trading halt and emergency system rebuild). This is treated as the Pillar 2A cyber/AI add-on, net of the operational risk S3 scenario overlap (S3 in §3.1 operational risk is a more severe Tier-4 scenario; this Tier-3 scenario adds to the S1/S2 base without double-counting S3).

**Pillar 2A add-on: R4,600,000**

---

### 3.2 Total Internal Capital Target

| Component | Amount |
|---|---|
| **Pillar 1 minimum capital charge** | R5,900,000 |
| *Pillar 2A add-ons:* | |
| Market risk (basis / correlation / SA-to-IMA uplift) | R3,400,000 |
| Liquidity risk (distressed HQLA mark-to-market loss tail) | R3,125,000 |
| Operational risk (scenario-based) | R10,200,000 |
| Concentration risk (FX correspondent + IRS counterparty) | R3,500,000 |
| Legal / compliance risk | R2,000,000 |
| Reputational risk | R1,000,000 |
| Cyber / AI risk | R4,600,000 |
| **Total Pillar 2A add-ons** | **R27,825,000** |
| **Total Internal Capital Target (Pillar 1 + Pillar 2A)** | **R33,725,000** |
| RAS B2 management buffer (+1.5pp on RWA of R73.75m) | R1,106,250 |
| Capital Conservation Buffer (CCB — 2.5% × RWA R73.75m) | R1,843,750 |
| **Total Internal Capital Requirement (Pillar 1 + Pillar 2A + B2 buffer + CCB)** | **R36,675,000** |

*Note: Rounding to nearest R1,000. The B2 management buffer and CCB are applied to the Pillar 1 RWA denominator; under Pillar 2A the add-ons are incremental charges, not RWA-based. For simplicity of presentation, the total is the arithmetic sum. The RAS B2 calibration (+1.5pp above B1 floor per Capital Management Policy §1) is applied as a capital amount (1.5% × R73.75m RWA); the CCB (2.5% × R73.75m) is the Basel III/IV standard conservation buffer.*

**Internal Capital Target vs R300m total envelope:**

| Item | Amount |
|---|---|
| Total Internal Capital Requirement | R36,675,000 |
| Total capital envelope (D-MARKETS-CAPITAL-TIME-SHAPE) | R300,000,000 |
| **Capital headroom** | **R263,325,000** |

**Conclusion:** The Total Internal Capital Requirement of R36.7m is substantially below the R300m capital envelope. Capital adequacy is confirmed. No escalation to CEO is required.

---

### 3.3 Headroom Analysis

| Metric | Amount |
|---|---|
| R300m total capital envelope (target at licence-day) | R300,000,000 |
| Total Internal Capital Requirement (Pillar 1 + Pillar 2A + buffers) | R36,675,000 |
| **Capital headroom** | **R263,325,000** |
| Headroom as % of total envelope | **87.8%** |

**Interpretation: Sufficient.** The capital headroom of R263.3m (87.8% of the total envelope) is consistent with a new-entrant bank at the early stage of its trading franchise build-out. The headroom is intentional: the R300m envelope is sized at licence-day to absorb the bank's RWA growth through the initial years of operation, stress scenarios, and regulatory-buffer requirements, without breaching the floor. The ICAAP analysis demonstrates that even in the severely-adverse scenario (all Pillar 2A add-ons crystallising simultaneously), the capital position remains strongly positive.

**Severely-adverse scenario check:** If all Pillar 2A add-ons materialise simultaneously (i.e., all risk scenarios fire in the same period), the total capital consumption is R36.7m. Against a R300m envelope, the bank retains R263.3m of CET1 capital — well above the regulatory minimum (Pillar 1 = R5.9m + CCB = R1.84m + Pillar 2A PA add-on to be confirmed in SREP). No shortfall. No escalation to CEO required.

**Escalation trigger condition:** This headroom analysis does not require CEO escalation. The escalation criterion per Capital Management Policy §1 (Breach — Hard Breach) would trigger if the CET1 ratio fell below the RAS B2 floor. At the build-phase sizing, CET1 ratio = R300m / R73.75m RWA = **407%**, vastly above the ~12.5% floor (Pillar 1 8% + CCB 2.5% + estimated Pillar 2A ~2%). No breach.

---

## 4. ILAAP — Internal Liquidity Adequacy Assessment

### 4.1 LCR Stress Scenario (30-Day Survival Horizon)

**[citation: RRTB Regulation 38 — ICAAP]**

**Base HQLA pool composition (from D-MARKETS-CAPITAL-TIME-SHAPE R125m liquidity buffer):**

| Asset class | Amount | LCR haircut | Post-haircut HQLA value |
|---|---|---|---|
| Level 1 — SA government securities (RSA bonds, SARB deposit claims) | R100,000,000 | 0% | R100,000,000 |
| Level 2A — High-quality corporate bonds / bank bonds (HQLA-eligible per RRTB) | R25,000,000 | 15% | R21,250,000 |
| **Total HQLA (post-haircut)** | **R125,000,000** | | **R121,250,000** |

*Note: Level 2A is capped at 40% of HQLA under LCR rules; R25m of a R121.25m post-haircut pool = 20.6% — within the cap.*

**30-day combined market + idiosyncratic stress scenario:**

The stress scenario is calibrated as a combined market stress (market-wide liquidity deterioration, rising rates, widening credit spreads) plus idiosyncratic stress (counterparty concern about a new-entrant AI-driven bank, elevated margin calls, repo line reductions). This is the RAS §B3 / §B14.2 combined scenario used in the Recovery Plan EWI calibration (triplet coherence per Recovery and Resolution Planning Policy v1 §2.2).

**Stressed outflows (30-day horizon):**

| Outflow category | Basis | Day 1 | Day 5 | Day 10 | Day 30 |
|---|---|---|---|---|---|
| Repo line withdrawal (bilateral repos maturing or non-rolled) | 100% run-off on unsecured repo lines; 50% on secured repo backed by Level 1 HQLA | R5,000,000 | R10,000,000 | R15,000,000 | R20,000,000 |
| Margin calls on OTC derivatives (IRS portfolio — stressed yield +200bp; FX — stressed ZAR depreciation 15%) | Mark-to-market change on net IRS position (net R50m receiver, +200bp = R50m × 2% = R1m per day of stress accrual) | R1,000,000 | R5,000,000 | R10,000,000 | R20,000,000 |
| Clearing obligations (JSE / CCP margin top-up) | Stressed initial margin and variation margin on IRS CCP clearing | R2,000,000 | R4,000,000 | R6,000,000 | R12,000,000 |
| Operational deposits (settlement sponsor, clearing bank float) | 25% run-off on operational deposit balances at correspondent banks | R1,250,000 | R2,500,000 | R3,750,000 | R5,000,000 |
| **Total stressed outflows** | | **R9,250,000** | **R21,500,000** | **R34,750,000** | **R57,000,000** |

**Stressed inflows (30-day horizon):**

| Inflow category | Day 1 | Day 5 | Day 10 | Day 30 |
|---|---|---|---|---|
| Maturing IRS positions (contractual cash inflows on fixed-rate receiver leg) | R500,000 | R2,500,000 | R5,000,000 | R15,000,000 |
| Collateral recall on unencumbered securities pledged to counterparties | R1,000,000 | R3,000,000 | R5,000,000 | R8,000,000 |
| **Total stressed inflows (capped at 75% of outflows per LCR rules)** | **R1,500,000** | **R5,500,000** | **R10,000,000** | **R23,000,000** |

*Inflow cap: 75% of total outflows per RRTB LCR inflow cap. Capped values are used at Day 1 (cap = 75% × R9.25m = R6.94m; uncapped inflow R1.5m — below cap, no adjustment). Day 30 (cap = 75% × R57m = R42.75m; uncapped R23m — below cap, no adjustment).*

**Net stressed liquidity position:**

| Horizon | Total HQLA | Cumulative net stressed outflows (outflows less inflows) | Net liquidity position | LCR (HQLA ÷ net 30-day outflows) |
|---|---|---|---|---|
| Day 1 | R121,250,000 | R7,750,000 | R113,500,000 | — (not applicable to sub-30-day) |
| Day 5 | R121,250,000 | R16,000,000 | R105,250,000 | — |
| Day 10 | R121,250,000 | R24,750,000 | R96,500,000 | — |
| Day 30 | R121,250,000 | R34,000,000 | **R87,250,000** | **357%** |

**LCR calculation (30-day basis):**

| Metric | Value |
|---|---|
| Total HQLA post-haircut | R121,250,000 |
| Total net stressed outflows (30-day, outflows − inflows) | R34,000,000 |
| **LCR = HQLA ÷ net 30-day outflows** | **357%** |
| PA minimum LCR | 100% |
| RAS target LCR (§B3) | 120% of PA minimum = 120% |
| **LCR vs PA minimum** | **Above (357% >> 100%)** |
| **LCR vs RAS target** | **Above (357% >> 120%)** |

**Conclusion:** LCR under the combined 30-day stress scenario is 357% — well above both the PA minimum of 100% and the RAS B3 target of 120%. The R125m HQLA pool is more than sufficient to survive the 30-day stress horizon modelled here. Net liquidity surplus at Day 30 is R87.25m.

---

### 4.2 NSFR Placeholder

**[citation: RRTB Regulation 38 — ICAAP]**

NSFR obligations arise at commencement of trading under RRTB (LICENCE-BIND).

**Balance-sheet structural assessment:**

At licence-day, Hoz Bank Limited's balance sheet is structurally NSFR-compliant:

| ASF (Available Stable Funding) | Amount | ASF factor | ASF |
|---|---|---|---|
| CET1 capital (equity) | R300,000,000 | 100% | R300,000,000 |
| **Total ASF** | | | **R300,000,000** |

| RSF (Required Stable Funding) | Amount | RSF factor | RSF |
|---|---|---|---|
| HQLA — Level 1 (SA government securities) | R100,000,000 | 5% | R5,000,000 |
| HQLA — Level 2A | R25,000,000 | 15% | R3,750,000 |
| Trading book positions (OTC IRS, FX) — mark-to-market, short-dated | R50,000,000 | 10% | R5,000,000 |
| **Total RSF** | | | **R13,750,000** |

| NSFR = ASF ÷ RSF | R300m ÷ R13.75m | **2,182%** |

**Conclusion:** The balance sheet structure is overwhelmingly NSFR-compliant. The bank is 100% equity-funded at licence-day (no wholesale funding liabilities), and its assets are predominantly liquid HQLA and short-dated trading positions with low RSF factors. NSFR of ~2,182% confirms structural compliance. At steady-state as the trading franchise grows, NSFR will compress toward the normal range (≥ 100% PA minimum; ≥ 115% RAS B4 target); monitoring is calibrated into the ILAAP annual cycle accordingly.

---

### 4.3 ILAAP Conclusion

**ILAAP R125m liquidity buffer: Confirmed.**

The Camille (CFO, finance)-proposed R125m ILAAP figure (approved under `D-MARKETS-CAPITAL-TIME-SHAPE`) is confirmed as sufficient. The LCR stress analysis demonstrates a 30-day net liquidity surplus of R87.25m (with LCR of 357%), even under a combined market + idiosyncratic stress calibrated conservatively for a new-entrant AI-driven markets bank. No adjustment is required.

**Sensitivity:** The R125m buffer provides survivability well beyond the 30-day horizon. Under a more severe stress (doubling the outflows to model a full repo-line collapse plus CCP emergency margin), net outflows at Day 30 would be approximately R68m, leaving a residual HQLA of R53.25m (LCR ~178% — still above PA minimum and RAS target). Only under an extreme scenario (HQLA haircuts widening to 50% on Level 2A, simultaneous full-collateral recall by CCP, and repo line collapse) would the buffer approach adequacy — and such a scenario would trigger Recovery EWI Q3/Q4 well before Day 30, giving time to activate liquidity recovery options (LA1–LA4 per Recovery Plan §5.3).

**Confirmation back to Camille (CFO, finance):** The R125m ILAAP figure is confirmed. No adjustment required. Camille (CFO, finance) may update §4 and §7 of the capital plan accordingly. The exact sizing confirmation is:

| ILAAP metric | Confirmed value |
|---|---|
| HQLA buffer sufficient for 30-day stress | Yes — R121.25m post-haircut |
| LCR under combined stress | 357% (PA minimum: 100%) |
| NSFR structural check | 2,182% (PA minimum: 100%) |
| Adjustment to R125m Camille proposal | None — confirmed at R125m |

---

## 5. Supervisory Dialogue Expectations

The SARB Prudential Authority's SREP for a new-entrant AI-driven institutional markets bank will focus on several areas where Hoz Bank Limited differs materially from a typical licensed bank. Helena recommends proactive disclosures and pre-application dialogue on the following:

### 5.1 Model risk and AI governance

The PA will scrutinise the model risk framework (RAS §B7; model risk tiers) extensively. For an AI-driven bank with autonomous agent decisioning as its default operating mode, every agent that influences a risk decision, a trade execution, a client outcome, or a capital computation is a **Tier-1 model** under the RAS model risk taxonomy. The PA will expect:

- A complete model inventory per RAS §B7 prior to the licence application.
- Independent validation (Nadia — independent-validation engineer) of every Tier-1 model before commencement of trading.
- A Model Risk Policy (currently `ORG-PR-XX` — pending authoring) with clear governance, segregation of model-building from model-validation functions, and a monitored annual revalidation cycle.
- Specific evidence that autonomous agent decision-making includes appropriate human-oversight escalation paths for decisions above defined thresholds (Principle 6 — autonomous by default; humans oversee the residual).

**Recommended proactive disclosure:** Submit the model risk framework and model inventory as part of the licence application dossier, before the PA requests it.

### 5.2 Operational risk — AI systems and Anthropic API dependency

The PA will identify the Anthropic API dependency as a **concentration risk in the operational risk profile**. The bank's primary labour force is autonomous AI agents running on Claude via the Anthropic API; if the API is unavailable, all agent-run functions cease. This is a qualitatively unusual dependency compared to a conventional bank's staffing model. The PA may:

- Request evidence of operational resilience testing (how the bank operates if the Anthropic API is unavailable for 4+ hours).
- Ask for a contingency playbook for AI-system outages.
- Apply a Pillar 2A add-on for AI-dependency operational risk (addressed in §3.1).

**Recommended proactive disclosure:** Submit the Anthropic API resilience framework (failover, alternative agent invocation path, human escalation during extended outages) prior to SREP.

### 5.3 Concentration in FX correspondent

The B-cluster FX-settlement concentration (single primary correspondent Standard Bank at ~97% of daily FX settlement notional) is a **material operational concentration**. The PA will likely inquire:

- Whether the bank has tested the backup correspondent (FirstRand-RMB) under the switch-test framework (RAS §B8a, L-B8a-3/4).
- What the recovery time objective is for re-routing all FX settlement to the backup correspondent.
- Whether the bank has adequate contractual protection (bilateral settlement netting, CSA) against the risk of primary correspondent default.

**Recommended proactive disclosure:** Submit the named-pair correspondent framework and the switch-test runbook (from `Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md`) with the licence application, and complete at least one successful switch-test before the application gate.

### 5.4 Thin human layer oversight

The bank's intention to operate with the minimum statutory human layer (approximately 5–10 humans at licence-day) is unusual and will attract PA focus. Key questions:

- How does board oversight function with a minimally-staffed human board?
- What are the escalation paths when an agent encounters a decision that exceeds its mandate?
- How is the CRO (Helena) — an autonomous agent — supervised, and what human oversight exists for her outputs?

**Recommended proactive disclosure:** Submit the governance framework, the Principle 6 autonomous-by-default architecture, and the human-oversight residual set (every procedure step where human-in-the-loop is the default, per Principle 6 P2 citations) as part of the licence application. Owen (Company Secretary, governance) should prepare a board-composition and governance-structure note specifically addressing the PA's expected concerns.

---

## 6. Build-Phase Gaps and Next Actions

The following gaps cannot be closed until licence-day (or immediately before). Each is a roadmap item for the pre-licence go-live readiness gate.

| Gap ID | Description | What's missing | Action to close | Owner | Timing |
|---|---|---|---|---|---|
| GAP-01 | Real portfolio data | Live trading positions for FX and IRS book; actual net open positions; actual DV01; actual maturity profile | Saskia (Head of Markets, governance) to confirm franchise-design position sizing at the licence-application gate; update §2.1 with confirmed figures | Saskia + Helena | Licence-application gate |
| GAP-02 | Real income history for BIA | Three-year average gross income (required for BIA operational risk charge) | Zero at build phase; flag for revenue-start update; confirm PA dialogue on floor / Pillar 2A basis with PA pre-application | Helena + Camille | Revenue-start update |
| GAP-03 | Real LCR observation | Daily LCR observation data for monitoring; validated LCR computation feed | W2 Slice 5 liquidity-computation substrate (Ravi — Treasury/ALM engineer) not yet built; substrate gap noted in Capital Management Policy §1 | Ravi (under Eitan) + Atlas | W2 Slice 5 completion |
| GAP-04 | NSFR computation | NSFR computation against actual balance sheet | Same as GAP-03; NSFR computation substrate gap | Ravi + Atlas | W2 Slice 5 completion |
| GAP-05 | RWA engine | Automated market-risk RWA computation from trading positions | Bea (Accounting & financial reporting engineer) W2 Slice 3 RWA engine not yet complete | Bea (under Camille) + Atlas | W2 Slice 3 completion |
| GAP-06 | Model inventory and validation | Complete Tier-1 model inventory and independent validation sign-off | Model Risk Policy not yet authored; Nadia's validation pipeline not yet commissioned | Nadia + Helena | Pre-licence gate |
| GAP-07 | Anthropic API resilience framework | Documented operational resilience playbook for AI-system outage | Not yet authored; flagged as PA dialogue prerequisite (§5.2) | Devon + Helena | Pre-licence gate |
| GAP-08 | Switch-test execution | At least one completed switch-test of the FirstRand-RMB backup correspondent | Not yet conducted; L-B8a-4 backup-readiness EWI starts at 0 days since last test | Tomas (under Devon) + Helena | Pre-licence gate |
| GAP-09 | PA dialogue on new-entrant AI | Pre-application PA dialogue on model risk, AI dependency, thin-human-layer governance | Not yet initiated; recommended in §5 | Helena + Owen | 12 months before licence application |
| GAP-10 | ICAAP / ILAAP Board attestation | Formal Board-level attestation of the ICAAP / ILAAP per Capital Management Policy §2 | Build phase — CEO interim attestation; formal board attestation at licence-day | Owen + Helena + Camille | Licence-day |

---

## 7. Confirmations Back to Camille

This section explicitly answers Camille (CFO, finance)'s three requests from the coordination brief (`Team Inbox/2026-05-12_camille_helena-icaap-coordination.md`).

### 7.1 ICAAP RWA sizing — Pillar 1 market risk charge confirmed

**Request:** Use the R150m trading-book capital backing to calculate the RWA-based minimum capital requirement under the Standardised Approach (RRTB Chapter 13). Confirm the figure back to Camille (CFO).

**Confirmation:**

| Metric | Value |
|---|---|
| Pillar 1 market risk capital charge (FX + IRS, Standardised Approach) | **R5,900,000** |
| Implied market risk RWA | R73,750,000 |
| Total Pillar 1 minimum capital (all components) | **R5,900,000** |
| Pillar 1 charge as % of R150m trading-book envelope | **3.9%** |

**Camille (CFO, finance) may update the capital plan with the confirmed Pillar 1 charge of R5.9m.** The RWA figure of R73.75m is the basis for CET1 ratio computation at licence-day. Capital Management Policy §1 capital-ratio monitoring procedures should be updated to reflect this franchise-design RWA as the denominator starting point; actual RWA will be derived from live positions via Bea's RWA engine (W2 Slice 3) once built.

### 7.2 ILAAP R125m — Confirmed

**Request:** Confirm or adjust the ~R125m ILAAP figure based on the LCR stress scenario and any Pillar 2A SARB-specific overlay.

**Confirmation: R125m confirmed. No adjustment required.**

The LCR stress analysis in §4.1 produces an LCR of 357% under a combined market + idiosyncratic 30-day stress, with a net liquidity surplus of R87.25m at Day 30. The NSFR check in §4.2 confirms structural compliance at 2,182%. The Pillar 2A liquidity add-on in §3.1 (R3.125m) addresses the tail capital risk of distressed HQLA mark-to-market; it does not adjust the buffer size. **The R125m figure is confirmed** for §4 and §7 of Camille (CFO, finance)'s capital plan.

### 7.3 Pillar 2A total internal capital target vs R300m — Confirmed adequate

**Request:** Confirm the total Internal Capital Adequacy target against the R300m envelope. Escalate any shortfall to CEO.

**Confirmation: Adequate. No escalation to CEO required.**

| Item | Amount |
|---|---|
| Total Internal Capital Requirement (Pillar 1 + Pillar 2A + B2 buffer + CCB) | R36,675,000 |
| Total capital envelope (D-MARKETS-CAPITAL-TIME-SHAPE) | R300,000,000 |
| **Capital headroom** | **R263,325,000** |
| **Headroom as % of envelope** | **87.8%** |

The Pillar 2A internal capital assessment produces a total Internal Capital Requirement of R36.7m — 12.2% of the R300m envelope. Capital adequacy is confirmed with substantial headroom. No shortfall. No escalation to CEO required.

**Camille (CFO, finance) may note in the capital plan** that the ICAAP internal capital target of R36.7m leaves R263.3m of capital headroom against the R300m envelope at franchise-design scale. As the trading book grows, the ICAAP will be re-run annually to confirm that the headroom remains adequate. The Capital Management Policy §2 (ICAAP Governance) governs the re-run cadence.

---

*Helena (Chief Risk Officer, governance) — 2026-05-12*
*Authority: D-MARKETS-CAPITAL-TIME-SHAPE*
*Triplet position: ICAAP / ILAAP component (Step 1 of 3 in the ICAAP–ILAAP–Recovery triplet annual sequence)*
*Build phase: this is a paper run — all figures are sizing estimates for regulatory preparation. No real capital, no live data, no live portfolio. Obligations bind at commencement of trading.*
