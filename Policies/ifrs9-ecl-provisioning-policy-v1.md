---
policy-id: ifrs9-ecl-provisioning-policy
title: IFRS 9 Expected Credit Loss (ECL) Provisioning Policy
version: 1.0.0
status: ACTIVE
owner: Helena (Chief Risk Officer) + Bea (Finance / accounting engineer)
effective-from: 2026-05-17
next-review: "2026-11-17"
citations:
  - "IFRS 9 Financial Instruments (2014) — §5.5 Impairment"
  - "BCBS 239 — Principles for Effective Risk Data Aggregation and Risk Reporting (2013)"
  - "BA 340 — Credit Risk Returns (Regulations Relating to Banks)"
  - "IAS 37 — Provisions, Contingent Liabilities and Contingent Assets (for comparison)"
author: Helena (Chief Risk Officer, governance)
date: 2026-05-17
summary: >
  Governs the bank's recognition and measurement of expected credit losses under IFRS 9,
  including the three-stage ECL model, SICR triggers, PD/LGD/EAD methodology,
  forward-looking overlays, and governance of model approval and provisioning entries.
decision-required: false
riskTaxonomy: RT-CR
---

# IFRS 9 Expected Credit Loss (ECL) Provisioning Policy v1.0.0

> **Author.** Helena (Chief Risk Officer, governance) — lead; Bea (Finance / accounting engineer, engineering) — co-author (provisioning journal entries and GL integration).
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10); Credit Risk Policy `credit-risk-policy-v1.md` (parent policy). Closes obligation `ORG-AC-02` (IFRS 9 ECL provisioning governance).
> **Obligation closed.** `ORG-AC-02` — IFRS 9 impairment requirements: bank must measure and recognise expected credit losses on financial assets held at amortised cost or fair value through other comprehensive income, using the three-stage ECL model with SICR triggers, forward-looking information, and quarterly governance.
> **Build-phase status.** COMMENCEMENT-BIND. The ECL model framework and governance structure are active now; live provisioning journal entries activate at commencement-of-trading when a real loan book or credit exposure portfolio exists. No real ECL is booked in the build phase.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Purpose and Scope

### 1.1 Purpose

This policy governs Hoz Bank Limited's (the "Bank") recognition, measurement, and governance of Expected Credit Losses (ECL) under IFRS 9 *Financial Instruments* §5.5 (Impairment). It establishes:

- The three-stage ECL model and the criteria for staging financial assets;
- The definition and quantitative / qualitative triggers for Significant Increase in Credit Risk (SICR);
- The methodology for computing Probability of Default (PD), Loss Given Default (LGD), and Exposure at Default (EAD);
- The framework for forward-looking macroeconomic overlays and management overlays;
- Data requirements aligned with BCBS 239 principles for risk data aggregation;
- The governance structure for model approval, provisioning journal entries, and sign-off on reported ECL in financial statements;
- Regulatory reporting obligations under BA 340 (Credit Risk Returns) and IFRS 7 (Financial Instruments: Disclosures).

The policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). It cites the regulatory obligations above it; procedures under this policy operationalise the ECL measurement process; and the ECL computation engine, PD/LGD/EAD parameterisation substrate, and GL provisioning module are the system capabilities that execute those procedures.

### 1.2 Scope

This policy applies to all financial assets held by the Bank that are within the scope of the IFRS 9 impairment requirements:

**In-scope instruments (upon commencement-of-trading):**
- Financial assets measured at amortised cost (AC) — including trade receivables, reverse-repo receivables, and any loan-equivalent exposures;
- Financial assets measured at fair value through other comprehensive income (FVOCI) — primarily fixed-income securities classified as FVOCI where the cash flow characteristics test (SPPI) is satisfied;
- Loan commitments not measured at fair value through profit or loss (FVTPL);
- Financial guarantee contracts not measured at FVTPL.

**Out-of-scope instruments:**
- Financial assets measured at FVTPL — ECL is not applied; fair value changes absorb credit risk;
- Equity instruments at FVOCI — the IFRS 9 impairment model does not apply to equity;
- Intragroup exposures subject to consolidation elimination;
- Physical commodity positions.

The Bank is an institutional-only, global-markets trading bank. The primary credit exposures arising in scope are: (i) reverse-repo receivables from institutional counterparties under GMRA; (ii) OTC derivative receivable positions where, in limited circumstances, the instrument may require an ECL estimate separate from the SA-CCR capital treatment; and (iii) any fixed-income securities classified at FVOCI. Retail and commercial lending books do not exist.

### 1.3 Policy hierarchy

This policy implements:
- **IFRS 9 Financial Instruments (2014) §5.5** — mandatory international accounting standard, COMMENCEMENT-BIND for financial reporting;
- **BA 340** — Credit Risk Returns under the Regulations Relating to Banks — COMMENCEMENT-BIND for SARB regulatory reporting;
- **BCBS 239** — Principles for Effective Risk Data Aggregation and Risk Reporting — incorporated as data quality standards.

The Credit Risk Policy (`credit-risk-policy-v1.md`) is the parent policy governing all credit-risk exposures; this policy specialises the IFRS 9 ECL treatment thereof. In case of conflict, the Credit Risk Policy governs for prudential capital matters; this policy governs for accounting provisioning matters.

---

## 2. Three-Stage ECL Model

IFRS 9 §5.5 requires an entity to recognise and measure an allowance for expected credit losses using a three-stage approach. The Bank adopts the general approach (not the simplified approach) for all in-scope instruments given the institutional nature of counterparties and the need for granular SICR assessment.

### 2.1 Stage 1 — 12-Month ECL (Performing; No SICR)

**Classification criteria:**
- The instrument has not experienced a Significant Increase in Credit Risk since initial recognition;
- The counterparty is not credit-impaired;
- There are no overdue payments and no qualitative SICR indicators present.

**ECL measurement:**
- ECL is computed as the portion of lifetime expected credit losses that result from default events possible within 12 months of the reporting date;
- Formally: ECL₁₂ = PD₁₂ × LGD × EAD;
- PD₁₂ is the point-in-time 12-month probability of default for the counterparty or cohort;
- Interest revenue is recognised at the effective interest rate on the gross carrying amount.

**Transition trigger:**
- Automatic reclassification to Stage 2 when any quantitative or qualitative SICR trigger defined in §3 is met;
- Automatic reclassification to Stage 3 when the instrument meets the credit-impairment definition in §2.3.

**Typical portfolio in Stage 1:**
- Performing reverse-repo receivables from investment-grade institutional counterparties;
- FVOCI fixed-income securities without evidence of credit deterioration;
- Undrawn loan commitments where no SICR has occurred.

### 2.2 Stage 2 — Lifetime ECL (SICR but Not Credit-Impaired)

**Classification criteria:**
- The instrument has experienced a Significant Increase in Credit Risk since initial recognition (per §3 SICR triggers);
- But the instrument is not yet credit-impaired (no objective evidence of credit loss event per §2.3).

**ECL measurement:**
- ECL is computed as the full lifetime expected credit losses — the present value of all cash shortfalls over the expected life of the instrument;
- Formally: ECL_Lifetime = Σₜ [PDₜ × LGDₜ × EADₜ × DFₜ] summed over all periods t in the expected instrument life;
- PDₜ is the conditional marginal PD for period t (i.e., probability of default in period t given survival to t);
- The discount rate used is the effective interest rate at initial recognition (or an approximation for floating-rate instruments);
- Interest revenue continues to be recognised at the effective interest rate on the gross carrying amount (not net of ECL allowance).

**Transition triggers:**
- Reclassification back to Stage 1 if SICR triggers are no longer met and the cure period (minimum 3 months of performing behaviour post-SICR resolution) has elapsed;
- Reclassification to Stage 3 if credit-impairment criteria are met.

**Monitoring:**
- Stage 2 assets are subject to enhanced monitoring: monthly PD refresh; quarterly review by Helena and the Credit Risk Committee (CRC); inclusion in the watchlist.

### 2.3 Stage 3 — Lifetime ECL (Credit-Impaired / Defaulted)

**Classification criteria (objective evidence of credit loss — IFRS 9 §B5.5.22):**
- Counterparty is 90+ days past due (DPD) on a contractual payment obligation;
- Counterparty has filed for, or is the subject of, insolvency or bankruptcy proceedings;
- Counterparty has been granted a distressed restructuring (including modification that results in a loss to the Bank);
- Observable evidence of significant financial difficulty: rating downgrade to sub-CCC equivalent; suspension of trading on a recognised exchange; cross-default under an ISDA CSA or GMRA;
- The Bank has sold or written off the asset at a significant credit-related discount.

**ECL measurement:**
- ECL is computed as full lifetime expected credit losses as in Stage 2;
- However, interest revenue is recognised at the effective interest rate applied to the **net** carrying amount (gross carrying amount less the ECL allowance) — the "credit-adjusted" basis;
- Write-offs are applied when the Bank has no reasonable expectation of recovering the financial asset or a portion thereof.

**Recovery:**
- Stage 3 instruments are subject to quarterly individual assessment by Helena and Bea;
- Reclassification back to Stage 2 or Stage 1 (cure) requires: (i) all overdue amounts paid; (ii) no remaining impairment triggers; (iii) a cure period of minimum 6 months of continuous performing behaviour.

---

## 3. SICR Definition and Triggers

### 3.1 Definition

A Significant Increase in Credit Risk (SICR) has occurred since initial recognition when the counterparty's credit risk has increased to a degree that the Bank determines it is appropriate to recognise a lifetime ECL allowance. The determination is based on a combination of quantitative PD-movement thresholds and qualitative indicators.

IFRS 9 §5.5.9 establishes a rebuttable presumption that SICR occurs when a payment is 30+ days past due. The Bank does not rely solely on the 30 DPD backstop; the Bank's quantitative PD-movement threshold and qualitative indicators are designed to identify SICR before the 30 DPD backstop is reached.

### 3.2 Quantitative Triggers

**Primary quantitative trigger — PD movement:**
- SICR is triggered when the current point-in-time 12-month PD exceeds the PD at initial recognition by more than **+150 basis points (bps)** in absolute terms, **or** when the relative increase in PD exceeds **100%** (i.e., PD has doubled), whichever threshold is breached first;
- Both the absolute and relative thresholds must be calibrated: Rohan (Market risk quantitative engineer, engineering) reviews thresholds annually and proposes adjustments to Helena based on portfolio composition and credit-cycle dynamics;
- PD is measured on a point-in-time (PIT) basis, not through-the-cycle (TTC). TTC PD may be used for capital purposes (IRB); PIT PD is required for IFRS 9 ECL.

**Credit rating migration:**
- Where external ratings are available (for sovereign counterparties, supranationals, or rated corporates), a downgrade of 3+ notches from initial recognition on a linear 22-notch scale (AAA to D, S&P equivalent) constitutes a quantitative SICR trigger;
- Where only the Bank's internal rating is available, an equivalent internal-scale migration applies.

**Credit Spread Widening:**
- Where liquid credit default swap (CDS) or bond spread data is available, a spread widening of +200 bps from the spread at initial recognition is a supplementary quantitative indicator. This indicator is confirmatory rather than standalone; it must be evaluated alongside the PD-movement trigger.

### 3.3 Qualitative Triggers

**Days Past Due (DPD) backstop:**
- Any payment obligation 30+ days past due constitutes SICR, per the IFRS 9 §5.5.11 rebuttable presumption. The Bank does not rebut this presumption.

**Forbearance:**
- Any modification of contractual terms granted as a result of the counterparty's financial difficulty (a "concession") constitutes SICR. This includes: payment deferrals; interest rate reductions; principal forgiveness; maturity extensions granted at below-market terms. The modification is assessed against IFRS 9 §B5.4.6 (significant modification vs. derecognition).

**Watchlist placement:**
- Placement of a counterparty on the Bank's internal credit watchlist (governed by the Credit Risk Policy §3.4) constitutes a qualitative SICR trigger. The watchlist is maintained by Helena and refreshed quarterly.

**Regulatory or legal events:**
- Regulatory enforcement action, licence revocation, or cross-default under a material financing arrangement constitutes SICR.

**Financial difficulty indicators:**
- Significant deterioration in the counterparty's liquidity ratios, leverage ratios, or interest-coverage ratios beyond the credit-quality floor thresholds set in the Credit Risk Policy;
- Loss of material business lines or assets without replacement;
- Departure of senior management under adverse circumstances without credible succession.

### 3.4 SICR Assessment Process

**Assessment frequency:** Monthly for all Stage 1 instruments; monthly for Stage 2 instruments (enhanced monitoring). Triggered intra-month by material credit events.

**Assessment responsibility:** Rohan (quantitative triggers — automated PD-movement computation); Helena (qualitative triggers — judgement-based; CRC escalation for new Stage 2 classifications above defined exposure thresholds).

**Documentation:** Every SICR determination is recorded as a typed `SicrAssessmentCompleted { instrumentId, counterpartyId, stage, triggers[], rationale }` event in the event log (Principle 1). No SICR determination is valid unless the event is present.

**Override of quantitative trigger:** A quantitative trigger may be overridden (i.e., SICR not declared despite threshold breach) only if: (i) the PD movement is assessed as transient and noise-driven rather than reflecting genuine credit deterioration; (ii) the override is documented with written rationale signed off by Helena; (iii) the override is logged as a `SicrOverrideApplied` event and reviewed by Vera (internal audit engineer) at the next quarterly review.

---

## 4. ECL Measurement Methodology

### 4.1 Probability of Default (PD)

**Point-in-Time PD:**
All ECL calculations use point-in-time (PIT) PD estimates, calibrated to current economic conditions and forward-looking information. TTC PD (used under the IRB capital framework) is not an acceptable proxy for IFRS 9 ECL computation without PIT adjustment.

**PD estimation sources (by counterparty type):**
- **Rated financial institutions and corporates:** PD derived from external credit ratings mapped to historical default rates using a rating-to-PD mapping table maintained by Rohan. The mapping is updated annually using Moody's, S&P, or Fitch published historical default-rate studies.
- **Sovereign counterparties:** PD derived from CDS-implied default probabilities where liquid CDS markets exist; supplemented by IMF/World Bank macroeconomic indicators and credit agency sovereign ratings.
- **Counterparties without external rating:** PD estimated using the Bank's internal credit scoring model, calibrated on a proxy portfolio of rated entities with similar characteristics. The internal scoring model is a Tier 1 model subject to Nadia (Independent-validation engineer, engineering) validation.

**Term structure of PD:**
- For Stage 1 (12-month ECL): 1-year PD only;
- For Stage 2 and Stage 3 (lifetime ECL): a full PD term structure is constructed from the annual conditional marginal PD series, reflecting the probability of default in each future period conditional on survival;
- The term structure is calibrated quarterly by Rohan, incorporating macroeconomic scenarios per §5 of this policy.

**PD floors:**
- A minimum PD floor of 3 bps (0.03%) is applied to all exposures regardless of rating quality. This prevents ECL from being recorded as exactly zero and reflects the irreducible uncertainty in any credit exposure.

### 4.2 Loss Given Default (LGD)

**Definition:** LGD is the proportion of the EAD that would not be recovered following a counterparty default, expressed as a percentage. LGD = 1 − Recovery Rate.

**LGD components:**
- **Collateral value:** Where the exposure is secured by financial collateral (cash margin, eligible securities under a CSA or GMRA), the realised collateral value — after applying IFRS 9-appropriate haircuts — reduces LGD. Haircuts are based on asset type, liquidity, and stressed market conditions (not just current market prices);
- **Seniority:** Senior unsecured exposures carry a higher LGD than secured or super-senior exposures. The Bank's institutional exposures are predominantly senior unsecured (OTC derivatives) or secured (repo / reverse-repo under GMRA). A senior unsecured baseline LGD of **45%** is applied unless collateral or contractual seniority reduces this;
- **Recovery rates:** Historical recovery rates from ISDA and market studies are applied. For institutional OTC derivatives, the Bank uses recovery rates consistent with BCBS SA-CCR guidance and ISDA close-out netting studies; for repo / reverse-repo, recovery rates reflect the value of underlying collateral in a stressed repo-market scenario.

**LGD parameter table (baseline):**

| Instrument type | Baseline LGD |
|---|---|
| Senior unsecured OTC derivative (ISDA CSA, no initial margin) | 55% |
| Senior unsecured OTC derivative (ISDA CSA, IM posted) | 35% |
| Reverse repo (GMRA, eligible collateral, standard haircut) | 10% |
| Reverse repo (GMRA, low-liquidity collateral) | 25% |
| FVOCI fixed-income security (issuer risk) | 40% |

These are baselines. Rohan calibrates them annually using published loss-given-default studies and presents updates to Helena for approval. Nadia validates all LGD parameters before production use.

**Downturn LGD:**
IFRS 9 does not mandate a downturn LGD adjustment (that is an IRB capital requirement), but the Bank applies forward-looking scenario adjustments to LGD through the macroeconomic overlay mechanism in §5. Under a downside scenario, LGD inputs are stressed to reflect lower collateral recoveries and wider bid-ask spreads in distressed markets.

### 4.3 Exposure at Default (EAD)

**Definition:** EAD is the Bank's estimated gross exposure to a counterparty at the time of default, before the application of collateral or recovery.

**EAD for funded instruments (reverse repo, FVOCI securities):**
- EAD equals the outstanding principal (gross carrying amount) plus accrued interest not yet due. For FVOCI securities, EAD is the amortised cost carrying amount (not the fair value, since the fair value already reflects market movements independent of credit risk).

**EAD for unfunded commitments and OTC derivatives:**
- Committed undrawn lines: EAD = drawn amount + (Credit Conversion Factor × undrawn committed amount). The CCF applied is 75% for unconditionally cancellable commitments and 100% for irrevocably committed but undrawn facilities, consistent with the Basel III standardised approach;
- OTC derivatives: EAD is computed using the Current Exposure Method (CEM) or, once the SA-CCR engine is live, using SA-CCR replacement cost + potential future exposure (PFE). For ECL purposes, the Bank uses the SA-CCR EAD output (where available) or the IFRS 9 §B5.5.32 approximation (present value of contractual cash flows plus current mark-to-market value) for smaller or simpler derivative exposures.

**Uncommitted facilities:**
- Facilities that are unconditionally cancellable at the Bank's sole discretion (no contractual commitment) carry a CCF of 0% for ECL purposes, meaning no EAD is attributed to the undrawn portion. The Bank's institutional trading mandate does not include retail committed facilities; this primarily affects any standby liquidity lines.

**EAD computation responsibility:**
Rohan computes EAD inputs for derivative and structured exposures. Bea (Finance / accounting engineer, engineering) computes EAD for funded instruments from the GL and position records. Both streams are reconciled monthly to produce a unified EAD register that feeds the ECL computation engine.

---

## 5. Forward-Looking Macroeconomic Overlays

### 5.1 Requirement

IFRS 9 §5.5.17(c) requires ECL estimates to reflect "reasonable and supportable information that is available without undue cost or effort at the reporting date about past events, current conditions and forecasts of future economic conditions." This requirement cannot be satisfied by using historical-average PD and LGD parameters alone; forward-looking adjustments are mandatory.

### 5.2 Scenario Framework

The Bank uses a three-scenario probability-weighted ECL framework:

**Scenario 1 — Base case (weight: 60%):**
- Consensus macroeconomic forecast for South Africa (GDP growth, CPI, ZAR/USD, JSE All Share, policy rate trajectory), sourced quarterly from the South African Reserve Bank (SARB) Monetary Policy Committee statements, National Treasury budget projections, and IMF Article IV consultations;
- Global macro assumptions sourced from IMF World Economic Outlook and relevant central bank forecasts (US Fed, ECB, BoE) for the Bank's counterparty exposure geographies;
- PD and LGD parameters applied at their base-calibrated values.

**Scenario 2 — Upside case (weight: 15%):**
- Improved macro environment: GDP growth 1.5× base; policy rate normalising faster; commodity (SA platinum, gold) price uplift supporting ZAR;
- PD parameters reduced by a scenario-adjustment factor calibrated by Rohan (typically −20% on base PD for investment-grade counterparties);
- LGD reduced by 5–10 percentage points reflecting improved collateral values and lower bid-ask spreads.

**Scenario 3 — Downside case (weight: 25%):**
- Adverse macro shock: global risk-off; ZAR depreciation of 20%+; SA GDP contraction; credit spread widening of 150–300 bps across counterparty segments; sovereign rating downgrade scenario;
- PD parameters increased by a downside-adjustment factor (typically +50% on base PD for investment-grade; +100% for sub-investment-grade or watchlist counterparties);
- Downturn LGD applied per §4.2.

**Scenario weights review:**
Weights are reviewed quarterly by Helena in consultation with Rohan. Weight changes require Helena sign-off with CRC notification. A weight shift exceeding 10 percentage points on any scenario requires a brief to Camille (CFO, governance) before the next reporting period closes.

### 5.3 Macroeconomic Variable Linkages

The following macroeconomic variables are incorporated into the ECL model as overlay drivers:

| Variable | Source | Update frequency | PD / LGD impact |
|---|---|---|---|
| SA real GDP growth rate | SARB / National Treasury | Quarterly | PD: inverse relationship; 1pp GDP decline → ~15 bps PD uplift (institutional) |
| SA policy rate (repo rate) | SARB MPC | Quarterly | LGD: higher rates → lower bond prices → higher LGD on fixed-income collateral |
| ZAR/USD exchange rate | SARB daily fix | Monthly | PD: FX stress affects USD-denominated exposures; LGD: FX-collateral haircuts |
| JSE All Share Index | JSE | Monthly | LGD: equity collateral haircuts; early-warning for financial-sector counterparty stress |
| SA credit spreads (iTraxx equivalent or SARB proxy) | Bloomberg / SARB | Monthly | PD: spread-to-PD mapping; SICR confirmatory |
| Global risk sentiment (VIX) | CBOE | Monthly | Downside scenario trigger; supplementary |

### 5.4 Management Overlay Governance

**Purpose of management overlays:**
Model-derived ECL may not capture emerging risks not yet visible in macroeconomic data or historical default rates (e.g., a geopolitical event, a sector-specific shock, a regulatory change). Management overlays allow the Bank to add a qualitative top-up to model ECL.

**Governance requirements for overlays:**
- An overlay may only be applied if supported by documented rationale identifying the specific risk not captured by the model;
- All overlays require approval by Helena and Camille before they are included in reported ECL;
- Overlays are time-bounded: each overlay has an agreed review date, at which it is either removed, adjusted, or substantiated by updated model parameters;
- Every overlay is recorded as a `ManagementOverlayApplied { date, amount, rationale, approver, reviewDate }` event in the event log and is disclosed in IFRS 7 disclosures as required;
- Vera reviews all active overlays at each quarterly internal audit of the ECL process.

**Overlay limits:**
- Individual overlays may not exceed 20% of the model-derived ECL for the affected portfolio segment without CRC approval;
- Aggregate overlays across all segments may not exceed 15% of total model-derived ECL without escalation to the Board Risk Committee.

---

## 6. Data Requirements

### 6.1 BCBS 239 Alignment

The Bank's ECL data infrastructure is designed to satisfy BCBS 239 *Principles for Effective Risk Data Aggregation and Risk Reporting* (2013). The relevant principles and their ECL-specific implementation are:

**Principle 1 — Governance:** The ECL data framework is owned jointly by Helena (model methodology and risk data) and Bea (accounting data and GL). Data quality incidents that affect ECL accuracy are escalated to the CRC within 24 hours.

**Principle 2 — Data architecture and IT infrastructure:** All ECL inputs (PD, LGD, EAD, staging decisions) originate from typed events in the Bank's event store (Principle 1 of the Bank's architectural principles). No ECL parameter is stored as a standalone balance that is not derivable from its originating event chain.

**Principle 3 — Accuracy and integrity:** ECL inputs must be reconciled to source systems (counterparty master, trade register, collateral register, rating feed) monthly. Reconciliation breaks exceeding a materiality threshold of ZAR 100,000 in ECL impact must be resolved before the quarterly ECL close.

**Principle 4 — Completeness:** The ECL computation covers 100% of in-scope instruments. No instrument is excluded without a documented and approved scoping decision logged as a typed event.

**Principle 6 — Adaptability:** The ECL model and data pipeline must be capable of producing ad-hoc ECL estimates (e.g., for stress testing, ICAAP, or SARB inquiry) within one business day of request.

**Principle 11 — Comprehensiveness:** ECL reporting covers all material risk concentrations — by counterparty, sector, geography, and instrument type — and is presented in a format suitable for CRC, EXCO, and Board oversight.

### 6.2 Credit Data Aggregation

**Counterparty master:** The central counterparty master (Party register, per `D-PARTY-REGISTER`) is the single source of truth for counterparty identity, legal entity structure, group membership (for LEX connected-counterparty purposes), and internal credit rating. No ECL computation references a counterparty not registered in the Party register.

**Trade register:** All in-scope financial instruments are registered in the Bank's trade event store (Principle 1). The trade register provides the instrument type, notional, maturity, contractual cash flows, and initial recognition date needed for EAD and ECL term-structure computation.

**Collateral register:** The collateral management platform (per the Collateral Management Policy, `collateral-management-policy-v1.md`) provides real-time collateral positions, haircuts, and collateral eligibility classifications. The ECL computation engine consumes collateral data to adjust LGD for secured instruments.

**Rating feed:** External ratings are sourced from at least two of Moody's, S&P Global Ratings, and Fitch Ratings. The rating feed is ingested daily and validated for staleness (any rating not updated within 12 months is flagged for manual review). Internal ratings are maintained by Rohan in the internal credit-scoring platform.

**Macroeconomic data:** Macro inputs per §5.3 are sourced from official public sources (SARB, National Treasury, IMF, JSE). Each data series has a named data custodian (Rohan for risk inputs; Bea for accounting-related macro series) and a documented update cadence. Stale macro data (beyond the specified update frequency) triggers a data quality alert to Helena.

### 6.3 Source Systems and Data Lineage

Every ECL parameter and its derivation path must be auditable from the reported ECL amount back to source system events. The data lineage is documented in the ECL computation engine's run-log, which is retained for a minimum of 7 years consistent with the Bank's records retention schedule. Vera has read access to all data lineage logs for audit purposes.

---

## 7. Governance

### 7.1 Model Methodology Approval — Helena (Chief Risk Officer, governance)

Helena (Chief Risk Officer, governance) is the policy owner and the final approver of all ECL model methodology decisions. Helena's governance responsibilities include:

- Approving the PD/LGD/EAD parameter tables and the calibration methodology used by Rohan;
- Approving SICR thresholds (quantitative and qualitative) and any threshold amendments;
- Approving the macroeconomic scenario framework, scenario weights, and variable linkages;
- Approving management overlays (jointly with Camille per §5.4);
- Approving SICR overrides per §3.4;
- Chairing the Credit Risk Committee (CRC) at which quarterly ECL results are reviewed before sign-off;
- Escalating material ECL movements (>10% quarter-on-quarter change in total ECL allowance) to the Board Risk Committee with a written explanation;
- Signing off on the ECL model validation report produced by Nadia (Independent-validation engineer, engineering) before any model is used in production or after any material model change.

**Authority matrix:**
- ECL methodology changes (minor — e.g., data source updates, PD recalibration within ±30 bps): Helena approval, CRC notification;
- ECL methodology changes (major — e.g., change to staging model, new instrument class, fundamental LGD methodology revision): Helena approval + CRC approval;
- Management overlays: Helena + Camille joint approval per §5.4;
- Write-offs: Helena + Camille approval for amounts above ZAR 500,000; CRC ratification at next meeting.

### 7.2 Provisioning Journal Entries — Bea (Finance / Accounting Engineer, engineering)

Bea (Finance / accounting engineer, engineering) is responsible for translating the ECL model output into provisioning journal entries in the General Ledger (GL). Bea's responsibilities include:

- Running the ECL computation engine at the end of each quarterly reporting period to produce the ECL allowance amounts by instrument and stage;
- Preparing and posting the provisioning journal entries:
  - **Stage 1 / 2 provision recognised:** Dr. Impairment Loss (P&L) / Cr. Loss Allowance (Balance Sheet);
  - **Reversal of provision (cure):** Dr. Loss Allowance / Cr. Impairment Loss;
  - **Write-off:** Dr. Loss Allowance / Cr. Gross Carrying Amount (reduces both the allowance and the asset);
  - **Recovery post-write-off:** Dr. Cash or Receivable / Cr. Recovery Income (P&L);
- Reconciling the ECL movement (opening balance + new provisions − reversals − write-offs = closing balance) and presenting the reconciliation in the IFRS 7 disclosure schedule;
- Maintaining the EAD data for funded instruments and providing it to the ECL computation engine monthly;
- Supporting Camille in preparing IFRS 7 disclosures for the annual financial statements.

All provisioning journal entries are posted as typed events (`EclProvisionPosted { instrumentId, stage, amount, movement, reportingDate }`) in the event log and reconcile to the GL before the books are closed for the quarter.

### 7.3 CFO Sign-Off — Camille (CFO, governance)

Camille (CFO, governance) holds the financial statement sign-off authority for reported ECL:

- Reviewing the quarterly ECL allowance report prepared by Helena and Bea before it is included in the Management Accounts;
- Reviewing and approving IFRS 7 disclosures in the annual financial statements, including the ECL movement table, staging analysis, sensitivity disclosures, and macroeconomic scenario descriptions;
- Joint approval with Helena on management overlays per §5.4;
- Joint approval with Helena on write-offs above ZAR 500,000;
- Escalating to the Board (CEO interim) where total ECL allowance exceeds a Board-defined materiality threshold or where a single stage-3 classification is individually material (>ZAR 1,000,000 or >5% of eligible capital, whichever is lower).

### 7.4 Internal Audit — Vera (Internal Audit Engineer, engineering)

Vera (internal audit engineer, engineering — functionally reports to Thandiwe (Chief Audit Executive, governance)) provides third-line assurance over the ECL process:

- Annual end-to-end audit of the ECL framework: SICR assessment completeness; model governance (approval events present; Nadia validation current); macroeconomic overlay governance; provisioning journal entry accuracy; data lineage completeness;
- Quarterly review of: Stage 2 and Stage 3 populations (are instruments correctly classified?); SICR overrides (are they documented and rationale sound?); management overlays (are they time-bounded and approved?);
- Reporting ECL audit findings to the Interim Audit Forum (chaired by Owen (Company Secretary, governance)) and to Thandiwe;
- Raising any Principle 1 violations (ECL parameters stored as balances rather than derivable from events) as Critical findings.

**Audit independence:** Vera operates independently of Helena and Bea. Vera does not participate in the design of the ECL model or the selection of macroeconomic scenarios. Vera's access to all event logs, computation engine run-logs, and provisioning journals is unconditional.

### 7.5 Model Validation — Nadia (Independent-Validation Engineer, engineering)

Nadia (Independent-validation engineer, engineering — peer-in-second-line under Helena) validates all Tier 1 ECL models:

- Initial validation before first production use: conceptual soundness review; data quality assessment; back-testing against historical defaults (where data available); sensitivity analysis on PD, LGD, and EAD inputs;
- Annual re-validation: back-test update; model drift detection; review of any management overlays against model performance;
- Triggered re-validation: any material model change (new instrument type, fundamental methodology change, change in PD data source);
- Validation outcome is recorded as a `ModelValidationCompleted { modelId, version, outcome, conditions[] }` event. No ECL model is used in production without a current `ModelValidationCompleted` event with `outcome: "validated"` or `outcome: "conditionally-validated"`.

---

## 8. Build-Phase Posture

### 8.1 Current Status

The Bank is in the build phase — the pre-licence-go-live readiness gate has not yet been reached. Accordingly:

- **No real loan book or credit exposure portfolio exists** subject to IFRS 9 ECL provisioning. No real ECL amounts are booked in the GL. No real provisioning journal entries have been posted.
- **No real financial statements are prepared.** IFRS 9 and IFRS 7 obligations activate at the commencement of financial reporting under IFRS (typically the first statutory financial year-end following commencement-of-trading).
- **The BA 340 return** (SARB credit-risk return) is a regulatory report that activates at commencement-of-trading.

### 8.2 What Is Real and Load-Bearing Now

The following elements of this policy are real, active, and load-bearing in the build phase:

- **Model framework design:** The PD/LGD/EAD methodology documented in §4 is being designed and coded by Rohan. The ECL computation engine is under construction per the W-phase roadmap. Design decisions are binding; the methodology chosen now will be the methodology validated by Nadia and reported to SARB.
- **SICR trigger calibration:** The quantitative thresholds in §3.2 (150 bps absolute / 100% relative PD movement; 3-notch rating migration) are management decisions binding the Bank from commencement-of-trading. They are subject to model validation before production use.
- **Data architecture:** The requirement that all ECL inputs flow from the event log (Principle 1) and satisfy BCBS 239 data quality standards (§6) is an engineering constraint active now. Systems that fail this constraint are findings, not a post-launch fix.
- **Governance structure:** The roles assigned in §7 (Helena, Bea, Camille, Vera, Nadia) are active governance accountabilities. They are exercised against the model framework in the build phase even where no real provisioning exists.
- **Typed events:** The event types referenced in this policy (`SicrAssessmentCompleted`, `EclProvisionPosted`, `ModelValidationCompleted`, `ManagementOverlayApplied`, etc.) must be defined in the event registry and implemented in the event store before the pre-licence go-live readiness gate lights green.

### 8.3 Commencement-of-Trading Activation

At commencement-of-trading, the following activate simultaneously:

1. The ECL computation engine runs its first production cycle against the live trade and collateral registers;
2. The first `EclProvisionPosted` events are emitted for all in-scope instruments;
3. Bea posts the opening ECL allowance journal entries in the GL;
4. The BA 340 return cycle begins;
5. IFRS 7 disclosure preparation begins for the first annual financial statements.

Camille co-ordinates the financial reporting activation with Helena. Vera performs a readiness audit before activation, assessing that: all models have current `ModelValidationCompleted` events; SICR triggers are calibrated; data pipelines are reconciled; and provisioning journal entry templates are tested end-to-end.

---

## 9. Regulatory Reporting

### 9.1 BA 340 — Credit Risk Returns

BA 340 under the Regulations Relating to Banks is the SARB credit-risk return that captures the Bank's credit risk exposures, risk-weighted assets, and ECL allowances under the standardised approach. Key ECL-related elements of BA 340:

- **ECL allowance by stage:** BA 340 requires disclosure of the total ECL allowance disaggregated by Stage 1, Stage 2, and Stage 3. The Bank's ECL computation engine produces this breakdown as a standard output of each quarterly run.
- **Specific and general provisions:** Under the SARB Prudential Standard framework, the BA 340 return maps IFRS 9 ECL stages to the prudential categories: Stage 3 ECL maps to specific provisions; Stage 1 and Stage 2 ECL maps to general provisions (subject to SARB regulatory adjustment factors). The mapping is documented in a standing procedure maintained by Bea.
- **Reconciliation to financial statements:** The ECL allowance reported in BA 340 must reconcile to the impairment allowance in the Bank's IFRS financial statements. Bea produces a formal reconciliation at each quarter-end as part of the BA 340 submission package.
- **Submission deadline:** BA 340 is submitted to SARB within 20 business days of the quarter-end. Camille is responsible for sign-off on the submission; Helena signs the credit risk section. Vera reviews the submission for completeness before sign-off.

### 9.2 IFRS 7 Disclosures

IFRS 7 *Financial Instruments: Disclosures* requires extensive qualitative and quantitative disclosures about the Bank's credit risk and ECL. At the annual financial statements, the Bank must disclose:

**Qualitative disclosures:**
- Description of the ECL model (three-stage approach, SICR criteria, PD/LGD/EAD methodology);
- Description of the macroeconomic scenarios, their weights, and the key variables;
- Description of the governance framework (policy ownership, model validation, audit);
- Any management overlays applied, their rationale, and amounts.

**Quantitative disclosures:**
- Gross carrying amounts by stage (Stage 1, Stage 2, Stage 3) and by instrument class;
- ECL allowance by stage and by instrument class;
- Movement table: opening ECL + new provisions + reversals + write-offs = closing ECL;
- Gross amounts written off during the year;
- Staging migration table (transfers in / out of each stage);
- Collateral and other credit enhancements by stage;
- Sensitivity disclosures: impact of moving to 100% downside or 100% upside scenario on total ECL;
- Credit risk concentration analysis by geography, industry, and counterparty credit quality.

Bea prepares the IFRS 7 quantitative disclosure schedules from the ECL computation engine output. Helena prepares the qualitative descriptions. Camille reviews and approves the complete IFRS 7 package before inclusion in the annual financial statements.

### 9.3 ICAAP Integration

The IFRS 9 ECL allowance feeds into the Bank's Internal Capital Adequacy Assessment Process (ICAAP) as a key input to credit risk stress testing. The downside ECL scenario (§5.2) provides the stressed ECL estimate that Helena uses in the ICAAP credit risk stress scenario. Devon (Capital adequacy and stress testing engineer, engineering) consumes the ECL model output in the ICAAP module.

---

## 10. Review Cadence

**Standard review:** Quarterly (agent-time — aligned with the quarterly credit-risk reporting cycle and the SARB BA 340 submission schedule).

**Quarterly review agenda (CRC):**
1. ECL allowance summary — by stage, by instrument class, by counterparty segment;
2. Stage 2 and Stage 3 population — new entries, cures, and write-offs since last review;
3. SICR override review — any active overrides; rationale review; continuation or removal decision;
4. Management overlay review — active overlays; time-bounded review date compliance;
5. Macroeconomic scenario weight review — any proposed weight changes for the next quarter;
6. Model performance monitoring — back-test update from Rohan; any model drift findings;
7. Data quality report — reconciliation breaks; data staleness alerts; BCBS 239 compliance status;
8. Vera findings — any audit findings since the last CRC meeting; management responses.

**Triggered review:** Any of the following triggers an out-of-cycle CRC meeting:
- Total ECL allowance moves by more than 20% in one month;
- A new Stage 3 classification with individual ECL > ZAR 500,000;
- A counterparty default or near-default event;
- A material model change or model validation finding with `outcome: "failed"`;
- A macroeconomic shock outside the downside scenario parameters (e.g., ZAR depreciation > 30%, SA sovereign rating moved to sub-investment-grade).

**Annual policy review:** Helena reviews and re-approves this policy annually. Material changes — including changes to SICR thresholds, PD/LGD/EAD methodology, or scenario framework — are documented as a new version (e.g., v1.1.0, v2.0.0) with a change log entry below.

---

## 11. Change Control

All changes to this policy require:
1. **Draft change:** Helena or Bea prepares the proposed amendment;
2. **Quantitative impact assessment:** Rohan estimates the ECL impact of any methodology change;
3. **Independent validation:** For changes to PD/LGD/EAD methodology or SICR thresholds, Nadia performs a targeted re-validation;
4. **CRC approval:** Major changes (see §7.1 authority matrix) require CRC approval;
5. **CEO / Board approval:** Where a change materially alters the Bank's provisioning levels or accounting policy (a change in accounting policy under IAS 8), Camille escalates to CEO (Board interim) for approval;
6. **Version increment:** The policy version is incremented (minor: x.y → x.(y+1); major: x → (x+1).0.0);
7. **Event:** A `PolicyAmended { policyId, previousVersion, newVersion, changeType, approvedBy }` event is emitted in the event log;
8. **Notification:** SARB is notified of material changes to the ECL methodology where required under the Prudential Standard or as a condition of the Bank's licence.

**Emergency amendments:** In a credit market stress event requiring immediate ECL methodology adjustment, Helena may authorise an emergency amendment with retrospective CRC ratification within 5 business days. Emergency amendments are flagged as such in the version change log and are subject to Vera review.

---

## Change Log

| Version | Date | Author | Summary of changes |
|---|---|---|---|
| 1.0.0 | 2026-05-17 | Helena (Chief Risk Officer, governance) | Initial policy — closes ORG-AC-02. Three-stage ECL model, SICR triggers, PD/LGD/EAD methodology, forward-looking overlays, BCBS 239 data requirements, governance roles, build-phase posture, BA 340 / IFRS 7 reporting obligations. |
