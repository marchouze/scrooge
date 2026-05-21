---
policy-id: FIN-ACCT-01
title: Accounting Policies — IFRS v1
version: "1.3"
status: DRAFT
owner: Camille (CFO, governance)
effective-from: 2026-05-13
next-review: "2026-11-13"
citations:
  - "Banks Act 94/1990: s90 (accounting records)"
  - "IAS 1: Presentation of Financial Statements"
  - "IFRS 9: Financial Instruments"
  - "IFRS 13: Fair Value Measurement"
  - "IAS 32: Financial Instruments — Classification"
  - "IFRS 7: Financial Instruments — Disclosures"
  - "IAS 36: Impairment of Assets"
  - "IAS 12: Income Taxes"
  - "IAS 24: Related Party Disclosures"
  - "ISA 700: Forming an Opinion and Reporting on Financial Statements"
author: Owen (Company Secretary, governance)
date: 2026-05-13
summary: Establishes IFRS accounting policies for recognition, measurement, and disclosure of financial instruments, impairment, fair value, income taxes, and related-party transactions.
decision-required: false
riskTaxonomy:
  - "FIN-001"
  - "FIN-002"
  - "FIN-003"
---

# Accounting Policies — IFRS v1

> **Policy** | FIN-ACCT-01 v1.3 | Owner: Camille (CFO, governance) | Status: DRAFT | Effective: 2026-05-13

> **Obligations closed:** [`ORG-AC-01`](../Regulations/_obligations-register.md) through [`ORG-AC-16`](../Regulations/_obligations-register.md) — all 16 IFRS accounting obligation rows.

> **Binding status:** LICENCE-BIND. IFRS accounting obligations under Banks Act 94/1990 s.90 and JSE listing requirements apply from the date of incorporation and banking-licence grant. These accounting policies must be production-grade at licence-day to support the first statutory financial statements, SARB prudential returns, and external audit. The build phase is preparation for compliance, not compliance.

---

## Purpose

This policy establishes the accounting policies of Hoz Bank Limited (the **Bank**) and, where applicable on a consolidated basis, Hoz Group Limited (the **Group**), in accordance with **International Financial Reporting Standards** (**IFRS**) as issued by the International Accounting Standards Board (**IASB**). It governs:

- The classification and measurement of financial instruments under IFRS 9;
- The expected credit loss (ECL) impairment model under IFRS 9;
- Hedge accounting under IFRS 9;
- Fair value measurement under IFRS 13;
- Presentation of financial statements under IAS 1;
- Income tax accounting under IAS 12;
- Related-party disclosure under IAS 24;
- External audit engagement requirements under ISA 700;
- The monthly, quarterly, and annual accounting close cycle.

**Policy owner:** Camille (CFO, governance). **Implementation:** Bea (Finance / treasury engineer, engineering — reports to Camille, CFO, governance). **Assurance:** Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance).

---

## Principles

1. **IFRS compliance.** All financial statements are prepared in accordance with IFRS as issued by the IASB and adopted under South African law, with no IFRS carve-outs unless mandated by SA regulation and explicitly disclosed.
2. **Substance over form.** Accounting reflects the economic substance of transactions, not merely their legal form.
3. **Materiality and aggregation.** Material items are presented separately; immaterial items may be aggregated. Materiality is assessed by reference to the amounts and nature of items relative to the financial statements as a whole.
4. **Events are the primary source.** The event store (Principle 1) is the authoritative source of transaction data; accounting entries are projections derived from events, not independently maintained ledger entries.
5. **No Day-1 P&L from unobservable inputs.** Day-1 profit on Level 3 fair-value instruments is deferred until the instrument is observed at a quoted price or realised (§3.3.4).
6. **Conservative ECL.** In conditions of uncertainty, the Bank applies the more conservative ECL estimate consistent with IFRS 9 paragraph 5.5.17.
7. **Camille reviews; Bea implements.** The CFO (Camille, governance) reviews and approves accounting policy choices; the Finance / treasury engineer (Bea, engineering) implements the substrate and produces draft financial statements.

---

## 1. Scope

### 1.1 Entity scope

These accounting policies apply to:

- **Hoz Bank Limited** — the licensed banking entity; primary IFRS reporting entity.
- **Hoz Group Limited** — consolidated financial statements prepared at Group level; subsidiaries (Hoz Securities Limited, upon FSP authorisation per `D-FSP-LICENCE-NECESSITY`) consolidated under IFRS 10.

### 1.2 Reporting currency

The Bank's functional and presentation currency is **South African Rand (ZAR)**. Foreign-currency monetary items are translated at the closing rate; income-statement items at the transaction-date rate (or average rate as a practical expedient where rates do not fluctuate significantly). Exchange differences are recognised in profit or loss unless designated in a qualifying hedge per §3.4. Per Principle 5 (multi-currency from day one), currency is held at the type level in the event store; presentation currency conversion is a projection.

### 1.3 Reporting periods

- **Annual** — year ending 28 February (or 29 February in a leap year), consistent with SARB prudential reporting convention.
- **Quarterly** — management accounts prepared within 15 business days of quarter end.
- **Monthly** — management pack prepared within 10 business days of month end.

---

## 2. Governance

### 2.1 Approval authority

These accounting policies are approved by the Board Audit Committee (**BAC**) on the recommendation of the CFO (Camille, governance). Material changes to accounting policies require:

1. CFO (Camille) assessment of the IFRS basis for the change and the quantitative impact;
2. External auditor consultation (if the change affects a significant accounting estimate or judgment);
3. BAC approval before application;
4. Disclosure in the financial statements per IAS 8 (accounting policy changes, corrections, and estimates).

### 2.2 Roles and responsibilities

| Role | Holder | Responsibility |
|---|---|---|
| Policy owner | Camille (CFO, governance) | Accounting policy decisions; judgements; estimates; BAC presentations |
| Implementation | Bea (Finance / treasury engineer, engineering) | Event-store projection to financial statements; close-cycle execution; trial balance |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering) | Recon harnesses over accounting controls; accounting-policy compliance assertions |
| External audit | Registered auditor (appointed by BAC at licence-day) | ISA 700 audit opinion; communication of key audit matters to BAC |
| Company Secretary | Owen (Company Secretary, governance) | Statutory filing of annual financial statements; corporate secretarial requirements |

### 2.3 Accounting records — Banks Act s.90

The Bank is required under **Banks Act 94/1990 s.90** to keep proper accounting records at all times that fairly reflect and explain the Bank's transactions and financial position. These records must be retained for a minimum of **five years** after the end of the financial year to which they relate. The event store (Principle 1; D-RMS-PHASE-1) constitutes the accounting records; derived projections (trial balance, general ledger) are rendered from events. Retention class `RETENTION_BANKS_ACT_S90_5Y` is applied to all finance-domain event types.

---

## 3. Standards and limits — accounting policies

### 3.1 IFRS 9 — classification and measurement

#### 3.1.1 Business model test

Financial assets are classified on initial recognition based on the Bank's **business model for managing the financial asset** and the **contractual cash flow characteristics** of the instrument. The Bank operates the following business models:

| Business model | Classification | Measurement |
|---|---|---|
| **Hold to collect** — objective is to collect contractual cash flows | Debt instruments whose cash flows are solely payments of principal and interest (SPPI) | Amortised cost |
| **Hold to collect and sell** — objective is both collecting cash flows and selling | Debt instruments whose cash flows pass the SPPI test | Fair value through other comprehensive income (FVOCI) — with recycling |
| **Other / trading** — residual; instruments not meeting hold-to-collect or hold-to-collect-and-sell, or that fail the SPPI test | Any instrument | Fair value through profit or loss (FVTPL) |

**Equity instruments** are measured at FVTPL by default. An irrevocable election to measure at FVOCI (without recycling) is available for equity instruments not held for trading; any such election is made at initial recognition and approved by Camille (CFO, governance).

**SPPI test.** The contractual cash flows of a debt instrument pass the SPPI test if they consist solely of payments of principal and interest on the principal amount outstanding — where interest represents consideration for the time value of money, credit risk, and other basic lending risks and costs. Instruments with features that modify this relationship (e.g. non-recourse leverage features, contingent cash flows linked to equity indices) fail the SPPI test and are classified at FVTPL.

**Business model reassessment.** Business model reassessment occurs only if the Bank changes its objective for managing a financial asset portfolio — which is expected to be infrequent. Reclassification between categories is applied prospectively from the reclassification date.

Register rows: [`ORG-AC-01`](../Regulations/_obligations-register.md) (classification); [`ORG-AC-02`](../Regulations/_obligations-register.md) (measurement).

#### 3.1.2 Amortised cost measurement

Financial assets and liabilities measured at amortised cost are recognised at **fair value on initial recognition** plus transaction costs directly attributable to the acquisition or issue. Subsequent measurement uses the **effective interest method (EIM)**: the interest income or expense recognised in profit or loss is computed by applying the effective interest rate to the gross carrying amount of the financial asset (or amortised cost of the financial liability).

**Effective interest rate (EIR).** The EIR is the rate that exactly discounts the estimated future cash flows over the expected life of the instrument to the gross carrying amount on initial recognition, including fees, points paid or received, transaction costs, and other premiums or discounts.

**Modified instruments.** Where the contractual cash flows of a financial asset are renegotiated or modified without derecognition, the Bank recalculates the gross carrying amount as the present value of the modified cash flows discounted at the original EIR. The adjustment is recognised in profit or loss as a modification gain or loss.

#### 3.1.3 Fair value through other comprehensive income (FVOCI)

Debt instruments classified at FVOCI are measured at fair value on the balance sheet, with changes in fair value (excluding interest income at EIR, ECL, and exchange differences) recognised in **other comprehensive income (OCI)**. On derecognition, the cumulative OCI amount is reclassified to profit or loss (recycling).

Equity instruments designated at FVOCI (irrevocable election at initial recognition) are measured at fair value; changes in fair value are recognised in OCI without subsequent recycling to profit or loss.

#### 3.1.4 Fair value through profit or loss (FVTPL)

Financial assets and liabilities classified at FVTPL are measured at fair value at each balance-sheet date; all changes in fair value are recognised in profit or loss. Trading assets and liabilities (including OTC derivatives and trading-book bonds and equities) are classified at FVTPL unless designated in a qualifying hedge (§3.4).

**Financial liabilities at FVTPL.** Where the Bank designates financial liabilities at FVTPL (fair value option), the change in fair value attributable to changes in the Bank's own credit risk is recognised in OCI (not reclassified to profit or loss on derecognition) per IFRS 9 paragraph 5.7.7.

Register rows: [`ORG-AC-03`](../Regulations/_obligations-register.md) (FVTPL); [`ORG-AC-04`](../Regulations/_obligations-register.md) (FVOCI).

### 3.2 IFRS 9 — expected credit loss (ECL) impairment

#### 3.2.1 Three-stage model

The Bank applies the IFRS 9 **three-stage ECL impairment model** to financial assets measured at amortised cost and at FVOCI (debt instruments):

| Stage | Trigger | ECL measurement | Interest recognition |
|---|---|---|---|
| **Stage 1** — Performing | No significant increase in credit risk (SICR) since initial recognition | 12-month ECL | Gross carrying amount (EIR) |
| **Stage 2** — Underperforming | SICR since initial recognition; not credit-impaired | Lifetime ECL | Gross carrying amount (EIR) |
| **Stage 3** — Credit-impaired | Credit-impaired (objective evidence of impairment) | Lifetime ECL | Net carrying amount (EIR applied to net carrying amount) |

#### 3.2.2 Significant increase in credit risk (SICR)

A financial instrument is classified as Stage 2 when there has been a **significant increase in credit risk** since initial recognition. The Bank uses the following SICR indicators:

**Quantitative:** The lifetime probability of default (PD) at the reporting date is significantly higher than the PD at initial recognition. The Bank classifies an instrument as Stage 2 when **both**:

- the relative change in lifetime PD is **≥ +100%** since initial recognition, **and**
- the absolute change in lifetime PD is **≥ +50 basis points** since initial recognition.

Either qualitative trigger (watchlist, adverse business / financial / economic condition change, covenant breach, forbearance) or the 30-days-past-due backstop independently triggers Stage 2 regardless of the PD test. The two-leg "both must trigger" rule resolves the ambiguity identified in Bea's v1.2 peer review (rule-vs-rationale contradiction): the absolute-bp leg acts as a de-minimis filter that prevents a doubling of a very small PD (e.g. 5 bp → 10 bp) from over-stating SICR flow, while the relative leg ensures that material proportional moves on larger PDs are caught.

Both PD parameters are reviewed annually by Helena (CRO, governance) and Camille (CFO, governance) in the ICAAP and ratified by the BRC; any change is recorded as a `SicrThresholdApproved` event (planned) before becoming the active threshold. The build-phase initial calibration uses these defaults; live model calibration replaces them at commencement of trading.

**Qualitative:** The instrument is classified as a watchlist item; there is an adverse change in the counterparty's business, financial, or economic conditions; the counterparty is in breach of financial covenants; the Bank has granted a forbearance measure.

**Backstop:** Any instrument with contractual payments more than **30 days past due** is presumed to have experienced a SICR (rebuttable).

**Credit-impaired (Stage 3):** Objective evidence of impairment exists when:
- The counterparty is in default (90 days past due backstop; rebuttable);
- The counterparty is subject to insolvency / bankruptcy proceedings;
- Observable data indicating measurable decrease in the estimated future cash flows exists.

Register rows: [`ORG-AC-05`](../Regulations/_obligations-register.md) (ECL staging); [`ORG-AC-06`](../Regulations/_obligations-register.md) (SICR triggers).

#### 3.2.3 ECL methodology — PD/LGD/EAD

ECL is measured as the probability-weighted estimate of credit losses over the contractual life of the instrument (or 12 months for Stage 1), discounted at the original EIR:

**ECL = PD × LGD × EAD × DF**

where:

- **PD (Probability of Default)** — the probability that the counterparty defaults over the measurement horizon. For Stage 1: 12-month PD. For Stages 2 and 3: lifetime PD (or observed credit-impairment).
- **LGD (Loss Given Default)** — the expected loss per unit of exposure, net of recoveries and collateral. Expressed as a fraction; takes into account the time value of recoveries discounted at the EIR.
- **EAD (Exposure at Default)** — the expected gross carrying amount of the exposure at the time of default, including utilisation of undrawn commitments.
- **DF (Discount Factor)** — discounts future ECL to the reporting date at the original EIR.

**Forward-looking adjustments.** ECL estimates incorporate **forward-looking macroeconomic information** (economic scenarios) per IFRS 9 paragraph 5.5.17. The Bank defines a base, upside, and downside economic scenario and weights each by probability; scenario-weighted ECL is the reported provision. Scenario weights and macroeconomic assumptions are reviewed and approved by Camille (CFO, governance) and Helena (CRO, governance) at least quarterly.

**Low credit risk simplification.** Where an instrument has **low credit risk** at the reporting date (external investment-grade equivalent rating), the Bank may apply the practical expedient of treating it as Stage 1 without performing a SICR assessment (IFRS 9 paragraph 5.5.10).

Register row: [`ORG-AC-07`](../Regulations/_obligations-register.md) (ECL methodology).

### 3.3 IFRS 13 — fair value measurement

#### 3.3.1 Fair value definition

Fair value is the **price that would be received to sell an asset or paid to transfer a liability in an orderly transaction between market participants at the measurement date** (exit price). Fair value assumes the principal (or most advantageous) market for the asset or liability.

#### 3.3.2 Fair value hierarchy

| Level | Input type | Examples in the Bank's portfolio |
|---|---|---|
| **Level 1** | Quoted prices (unadjusted) in active markets for identical assets or liabilities | JSE-listed equities; on-the-run government bonds with active secondary market; listed derivatives (JSE SAFEX) |
| **Level 2** | Observable inputs other than Level 1; quoted prices for similar assets in active markets; inputs that are derived principally from observable market data | OTC interest-rate swaps using observable yield curves (JIBAR, ZAR OIS); bonds priced from observable credit spreads; FX forwards |
| **Level 3** | Unobservable inputs | OTC derivatives with significant unobservable inputs; bespoke structured products |

**Level classification.** The level of the fair value hierarchy in which a fair value measurement falls is determined by the **lowest-level input** that is significant to the measurement as a whole. Classification is assessed at each reporting date.

**Level 3 transfers.** Transfers into and out of Level 3 are recognised at the date of the event that caused the transfer. Camille (CFO, governance) approves all Level 3 classifications and reviews the Level 3 instrument inventory at each quarter end.

Register row: [`ORG-AC-08`](../Regulations/_obligations-register.md) (fair value hierarchy).

#### 3.3.3 Valuation techniques

| Technique | Applicability |
|---|---|
| **Market approach** — uses prices from market transactions for identical or comparable assets | Level 1 and Level 2 instruments with observable market prices |
| **Income approach** — discounted cash flows using observable discount rates | Bond pricing; interest-rate derivative valuation using observable yield curves |
| **Cost approach** | Not applicable for financial instruments |

**Model governance.** All valuation models (including those used for Level 2 and Level 3 instruments) are subject to independent model validation by Helena (CRO, governance) or a designated model-risk agent. No valuation model is used in production without a `ModelValidationApproved` event (planned). Models are reviewed annually or on material change.

**Valuation adjustments.** The Bank applies the following market-standard valuation adjustments to OTC derivative fair values:

- **Credit Valuation Adjustment (CVA)** — adjusts for counterparty credit risk;
- **Debit Valuation Adjustment (DVA)** — adjusts for the Bank's own credit risk (recognised in OCI for FVTPL liabilities per §3.1.4);
- **Funding Valuation Adjustment (FVA)** — adjusts for funding costs associated with uncollateralised OTC derivatives.

The CVA/DVA/FVA methodology is approved by Camille (CFO, governance) and Helena (CRO, governance) and reviewed annually.

#### 3.3.4 Day-1 P&L policy

Where a financial instrument is recognised at fair value on initial recognition and the fair value differs from the transaction price, a **Day-1 difference** arises. If the fair value is evidenced by a **quoted price in an active market** for an identical asset or liability (Level 1), or based wholly on **observable market data** (Level 2 where all inputs are observable), the Day-1 difference is recognised immediately in profit or loss.

If the fair value uses **significant unobservable inputs** (Level 3), the Day-1 difference is **deferred** and recognised in profit or loss only as and when the inputs become observable, or on derecognition of the instrument. The deferred Day-1 P&L balance is disclosed in the notes to the financial statements.

Register row: [`ORG-AC-09`](../Regulations/_obligations-register.md) (Day-1 P&L).

### 3.1A Trade-date accounting election (IFRS 9 B3.1.3)

The Bank **elects trade-date accounting** for all financial instruments. Recognition occurs when the Bank becomes party to the contractual provisions on the **trade date**, not the settlement date. This election applies consistently to all initial recognition and derecognition arising from regular-way purchases or sales.

Instruments in scope:

| Instrument | Trade-date recognition event | Settlement window |
|---|---|---|
| FX spot | `FxTradeExecuted` (T0) | T+2 |
| FX forwards / swaps | `FxTradeExecuted` (T0) | T+N (forward date) |
| FX NDF | `FxTradeExecuted` (T0) | T+N (net cash settlement) |
| JSE bonds | `BondTradeExecuted` (T0) | T+3 (JSE convention) |
| JSE equities | `EquityTradeExecuted` (T0) | T+3 (JSE convention) |

Posting rules PR-FX-001, PR-BOND-001, PR-EQ-001 implement the trade-date bookings. The settlement leg (T+2 / T+3) does not create additional P&L recognition — it is a balance-sheet reclassification from trade receivable/payable to nostro/cash.

Register row: [`ORG-AC-01`](../Regulations/_obligations-register.md) (classification — recognition timing).  
Procedure refs: [`Procedures/markets/fx-forwards-trade-lifecycle.md`](../Procedures/markets/fx-forwards-trade-lifecycle.md); [`Procedures/finance/trade-lifecycle-system-capability-register.md`](../Procedures/finance/trade-lifecycle-system-capability-register.md).

### 3.1B Derecognition (IFRS 9 §3.2)

A **financial asset** is derecognised when:

(a) The contractual rights to receive cash flows from the asset expire; **or**  
(b) The Bank transfers the financial asset and the transfer qualifies for derecognition — i.e. the Bank transfers substantially all the risks and rewards of ownership.

A **financial liability** is derecognised when the obligation is discharged, cancelled, or expires.

The Bank does not employ pass-through arrangements or partial transfers. Derecognition is always whole-instrument.

**Instrument-level derecognition triggers:**

| Instrument | Derecognition trigger | Derecognition event | Posting rule |
|---|---|---|---|
| FX spot / forward (buy leg) | T+2/T+N settlement confirmation | `FxSettlementConfirmed` | PR-FX-003 |
| FX NDF | Net cash settlement on fixing date | `FxSettlementConfirmed` | PR-FX-003 |
| JSE bond (FVTPL / FVOCI) — maturity | Final coupon + principal received | `BondMatured` | PR-BOND-MAT |
| JSE bond (FVTPL / FVOCI) — sale | Sale settlement T+3 | `BondSold` | PR-BOND-SALE |
| JSE equity — sale | Sale settlement T+3 | `EquitySold` | PR-EQ-SALE / PR-EQ-SALE-F |
| OTC IRD swap — termination | Termination payment settled | `IrdSwapTerminated` | PR-IRD-TERM |

**Settlement failure and reversal.** If settlement fails (`SettlementFailed` event), no derecognition occurs — the prior carrying amount is maintained. If a subsequent `SettlementReversed` event is emitted after an incorrect derecognition, posting rule PR-FX-REV reinstates the prior carrying amount per IFRS 9 §3.2.1. The reversal is recognised at the original derecognition date to preserve period accuracy.

**Gains and losses on derecognition.** On derecognition:
- **FVTPL instruments:** the difference between the carrying amount and the sum of consideration received plus any cumulative unrealised P&L is recognised in profit or loss.
- **FVOCI equity instruments (irrevocable election):** the cumulative OCI balance is transferred directly to **retained earnings** (no P&L recycling per IFRS 9 §5.7.5).
- **Amortised-cost instruments:** any gain or loss (carrying amount vs. proceeds net of transaction costs) is recognised in profit or loss.

Register row: [`ORG-AC-02`](../Regulations/_obligations-register.md) (measurement — derecognition).  
Procedure refs: [`Procedures/finance/trade-lifecycle-system-capability-register.md`](../Procedures/finance/trade-lifecycle-system-capability-register.md).

### 3.1C Fair value measurement hierarchy (IFRS 13 §72)

The fair value hierarchy classifies inputs into three levels based on observability. The level assigned is determined by the **lowest-level input that is significant to the measurement as a whole**:

| Level | Input type | Bank instruments at this level | Rate source (build phase) |
|---|---|---|---|
| **Level 1** | Quoted prices in active markets for identical assets or liabilities — no adjustment | JSE-listed equities; JSE-listed on-the-run government bonds with active secondary market | JSE closing price; daily closing price feed |
| **Level 1** | Major FX pairs at closing rates | USD/ZAR, EUR/ZAR, GBP/ZAR, JPY/ZAR | WM-Fix / Bloomberg BFIX closing rates (production); FX sim `FxPositionRevalued.revalRate` (build phase) |
| **Level 2** | Observable inputs other than Level 1; model inputs derived principally from observable market data | FX forward rates from observable yield curves; OTC IRD NPV from JIBAR / SOFR swap curves; off-the-run government bonds from observable credit spreads | Observable forward curve (Rohan's M5 risk substrate); Bloomberg / Reuters JIBAR curve |
| **Level 3** | Significant unobservable inputs — Camille (CFO, governance) approval required | None currently; any Level 3 exposure requires CFO approval and separate IFRS 13 §93 disclosure | N/A |

**Rate source for daily MTM during the build phase:** FX sim (`FxPositionRevalued.revalRate`). This is a synthetic rate injected by the build-phase scenario framework. At commencement of trading, the rate source transitions to WM-Fix / Bloomberg BFIX closing rates (Level 1) or observable curve inputs (Level 2).

**Level 3 governance.** The Bank aims to hold zero Level 3 instruments. Any Level 3 designation:
1. Requires written approval from Camille (CFO, governance);
2. Is subject to enhanced IPV per [`Policies/pricing-policy-v1.md`](pricing-policy-v1.md) §5.3;
3. Requires IFRS 13 §93 disclosure in the annual financial statements (sensitivity analysis; description of unobservable inputs; quantitative range).

**No Day-1 P&L from Level 3 inputs.** Per §3.3.4 (Day-1 P&L policy), any Day-1 difference on a Level 3 instrument is deferred to profit or loss until observable confirmation.

Register row: [`ORG-AC-08`](../Regulations/_obligations-register.md) (fair value hierarchy).  
Procedure ref: [`Procedures/finance/trade-lifecycle-system-capability-register.md`](../Procedures/finance/trade-lifecycle-system-capability-register.md).

### 3.4 IFRS 9 — hedge accounting

#### 3.4.1 Qualifying criteria

The Bank applies IFRS 9 hedge accounting where:

1. The hedging relationship is formally designated and documented at inception (including the risk management objective, the nature of the hedged risk, identification of the hedging instrument and hedged item);
2. The hedging relationship meets the IFRS 9 hedge effectiveness requirements:
   - An economic relationship exists between the hedged item and hedging instrument;
   - The effect of credit risk does not dominate the fair-value changes;
   - The hedge ratio reflects the actual quantities used.

Hedge accounting is voluntary; it is only applied where the designation reduces accounting mismatch.

#### 3.4.2 Fair value hedges

A **fair value hedge** designates a hedging instrument (typically an interest-rate swap) to hedge the fair-value exposure of a recognised financial instrument or a firm commitment attributable to a designated risk (typically interest-rate risk or credit risk). Accounting treatment:

- **Hedging instrument:** measured at FVTPL; fair-value changes recognised in profit or loss.
- **Hedged item:** the carrying amount is adjusted for fair-value changes attributable to the hedged risk (hedge adjustment); these changes are also recognised in profit or loss (offsetting the hedging instrument).

**Discontinuation.** If the hedging relationship no longer meets the qualifying criteria, hedge accounting is discontinued prospectively. For fair-value hedges of financial instruments at amortised cost, the cumulative hedge adjustment is amortised to profit or loss using the EIR from the discontinuation date.

#### 3.4.3 Cash flow hedges

A **cash flow hedge** designates a hedging instrument to hedge the variability in cash flows attributable to a designated risk associated with a recognised financial instrument, a highly probable forecast transaction, or a risk component thereof. Accounting treatment:

- **Effective portion** of the gain or loss on the hedging instrument: recognised in OCI (cash flow hedge reserve).
- **Ineffective portion:** recognised immediately in profit or loss.
- **Reclassification:** the cumulative OCI amount is reclassified to profit or loss in the period when the hedged item affects profit or loss.

Register rows: [`ORG-AC-10`](../Regulations/_obligations-register.md) (fair value hedges); [`ORG-AC-11`](../Regulations/_obligations-register.md) (cash flow hedges).

#### 3.4.4 Documentation requirements

All hedging relationships must be documented at inception and include:

- Risk management objective and strategy;
- Identification of the hedging instrument (ISIN or contract reference);
- Identification of the hedged item and the designated risk;
- Method for assessing hedge effectiveness (quantitative or qualitative as appropriate);
- Method for measuring ineffectiveness.

Documentation is stored in the document-substrate (D-RMS-PHASE-1 Slice 1) referenced by BLAKE3 hash from the `HedgeDesignationApproved` event (planned).

### 3.5 IAS 1 — presentation of financial statements

#### 3.5.1 Going concern

The financial statements are prepared on the **going-concern basis** unless the Board (or management in the build phase) concludes that the Bank intends to, or has no realistic alternative but to, liquidate or cease trading. The going-concern assessment is performed annually by Camille (CFO, governance), reviewed by the BAC, and disclosed in the directors' report per IAS 1 paragraph 25.

#### 3.5.2 Materiality

An item is **material** if omitting, misstating, or obscuring it could reasonably be expected to influence decisions made by primary users of the financial statements on the basis of those statements. Materiality is assessed by reference to both:

- **Quantitative threshold:** materiality is set as the **lowest of**:
  - **0.5% of total assets** (primary benchmark; always defined); and
  - **5% of normalised profit before tax** — where normalised PBT is the 3-year trailing average of PBT computed using only profit-making years (years with PBT ≤ 0 are excluded from the average). This leg is **inactive** during the build phase and for any period before three profit-making years exist in the trailing window; and
  - **1% of CET1 capital** (floor; always defined).

  The threshold is the lowest of the legs whose denominator is **defined and positive** in the reporting period. This three-leg construct (introduced in v1.3 on Bea's peer review of v1.2) replaces an earlier "5% PBT or 0.5% total assets, whichever lower" rule that collapsed to near-zero in the build phase and was mathematically undefined in loss-making years. The benchmark legs and weights are reviewed annually by Camille (CFO, governance) against the Bank's loss-absorbing capacity, risk appetite, and the prior year's external-audit overall materiality benchmark, and are documented in the close-cycle working papers. Any change is recorded as a `MaterialityBenchmarkApproved` event (planned) before becoming the active threshold. The external auditor sets its own audit materiality independently per ISA 320; this policy threshold governs preparation and disclosure, not audit scope.
- **Qualitative factors:** nature of the item (e.g. fraud, regulatory breach, related-party transaction) may make an item material regardless of size.

#### 3.5.3 Comparative periods

Financial statements include **comparative information** for the prior period (annual: prior year; interim: corresponding prior-year period) per IAS 1 paragraph 38. Where a material reclassification occurs, three balance sheets are presented (current period; prior period; beginning of prior period) per IAS 1 paragraph 40A.

Register rows: [`ORG-AC-12`](../Regulations/_obligations-register.md) (going concern); [`ORG-AC-13`](../Regulations/_obligations-register.md) (presentation).

### 3.6 IAS 12 — income taxes

#### 3.6.1 Current tax

Current tax is the expected amount of income tax payable in respect of taxable profit for the current period, calculated using **tax rates enacted or substantively enacted** at the balance-sheet date. Current tax is calculated by Bea (Finance / treasury engineer, engineering) with input from Yael (Tax engineer, engineering — reports to Camille, CFO, governance) and reviewed by Camille (CFO, governance).

**South African corporate income tax rate.** Currently 27% (as enacted by the Rates and Monetary Amounts and Amendment of Revenue Laws Act 2022). Any change enacted before the balance-sheet date is applied from the enactment date.

#### 3.6.2 Deferred tax

Deferred tax is recognised using the **balance-sheet liability method** on all temporary differences between the carrying amounts of assets and liabilities in the financial statements and their corresponding tax bases, **except**:

- Temporary differences arising from the initial recognition of goodwill;
- Temporary differences arising from the initial recognition of an asset or liability in a transaction that is not a business combination and that affects neither accounting nor taxable profit at the time of the transaction;
- Deferred tax liabilities on investments in subsidiaries where the timing of the reversal is controlled by the Group and it is probable that the temporary difference will not reverse in the foreseeable future.

**Deferred tax assets.** A deferred tax asset is recognised for deductible temporary differences and unused tax losses to the extent that it is probable that future taxable profits will be available against which the asset can be utilised. The recoverability assessment is performed by Camille (CFO, governance) at each balance-sheet date.

#### 3.6.3 Effective tax rate reconciliation

The annual financial statements include a **reconciliation of the effective tax rate** to the statutory rate, identifying:

- Non-deductible expenditure;
- Tax-exempt income;
- Rate differences on foreign operations (if any);
- Deferred tax assets not recognised;
- Other material reconciling items.

The reconciliation is prepared by Bea (Finance / treasury engineer, engineering) and reviewed by Camille (CFO, governance) and Yael (Tax engineer, engineering).

Register row: [`ORG-AC-14`](../Regulations/_obligations-register.md) (income tax).

### 3.7 IAS 24 — related-party disclosures

#### 3.7.1 Definition of related parties

Related parties include, per IAS 24 paragraph 9:

- Entities that control, are controlled by, or are under common control with the Bank (Hoz Group Limited; Hoz Securities Limited);
- Key management personnel (KMP) — directors, CEO, CFO, CRO, CCO, CAE, Company Secretary, CISO, Information Officer — and their close family members;
- Entities controlled by or associated with KMP;
- Post-employment benefit plans (none anticipated in the build phase — agent workforce).

At licence-day, the **Party register** (`Regulations/_party-register.md`, per `D-PARTY-REGISTER`) is the canonical source of party identities for related-party analysis.

#### 3.7.2 Transactions

All transactions with related parties are disclosed in the annual financial statements per IAS 24 paragraph 18, including:

- Nature of the related-party relationship;
- Amount of the transactions;
- Outstanding balances (including terms and conditions, security, and settlement method);
- Any provisions for doubtful debts and the expense recognised during the period.

#### 3.7.3 Board approval thresholds

Related-party transactions above the following thresholds require Board approval (in addition to BAC review):

| Category | Threshold | Approver |
|---|---|---|
| Transactions with KMP | Any transaction outside normal remuneration and employment terms | Board (via RemCo) |
| Transactions with Group entities | ≥ DoA threshold per `Governance/_delegation-of-authority-matrix.md` | Board |
| Loans or credit facilities to directors or KMP | Any amount | Board; subject to Companies Act s.45 and Banks Act restrictions |
| Transactions with entities controlled by KMP | ≥ DoA threshold | Board |

**Companies Act s.45 restriction.** The Bank may not provide financial assistance (directly or indirectly) to a director or prescribed officer without Board approval per Companies Act s.45 and compliance with the substantive requirements thereof.

Register rows: [`ORG-AC-15`](../Regulations/_obligations-register.md) (related-party disclosure); [`ORG-AC-16`](../Regulations/_obligations-register.md) (related-party approvals).

---

## 4. Controls and monitoring

### 4.1 Accounting close cycle

| Milestone | Deadline | Owner |
|---|---|---|
| Transaction data reconciled to event store | Business day +1 | Bea (Finance / treasury engineer, engineering) |
| Month-end trial balance | 5 business days after month end | Bea |
| Management accounts pack | 10 business days after month end | Bea; reviewed by Camille (CFO, governance) |
| Quarterly management accounts | 15 business days after quarter end | Bea; reviewed by Camille |
| Annual financial statements — draft | 30 calendar days after year end | Bea; reviewed by Camille |
| Annual financial statements — Board-approved | 60 calendar days after year end | Board; BAC sign-off |
| SARB prudential returns (BA returns) | Per SARB prescribed timetable | Bea; Camille (CFO, governance) signs off |
| External audit completion | Within 3 months of year end (ISA 700 target) | External auditor; BAC oversight |

### 4.2 Accounting controls

| Control | Owner | Mechanism |
|---|---|---|
| Trial balance reconciliation to event store | Bea (Finance / treasury engineer, engineering) | `recon:trial-balance-event-store` (planned) — asserts trial balance derived from events matches posted ledger |
| ECL staging assertion | Vera (Internal audit / continuous-assurance engineer, engineering) | `recon:ecl-staging-completeness` (planned) — asserts every amortised-cost and FVOCI instrument has a current ECL stage |
| Fair value hierarchy classification | Camille (CFO, governance) | Quarterly Level 3 review; `recon:fv-hierarchy-level3-approval` (planned) |
| Hedge documentation currency | Bea | `recon:hedge-documentation-completeness` (planned) — asserts every active hedge has a current `HedgeDesignationApproved` event |
| Related-party approval tracking | Owen (Company Secretary, governance) | `recon:related-party-approvals` (planned) — asserts every above-threshold related-party transaction has a `BoardRelatedPartyApproved` event |
| Deferred tax recoverability | Camille | Annual DTA recoverability memo; BAC presentation |
| Effective tax rate reconciliation | Bea; Yael | Annual reconciliation reviewed by Camille and external auditor |

### 4.3 Vera assurance

Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance) provides recon coverage:

| Recon | What it asserts | Cadence |
|---|---|---|
| `recon:trial-balance-event-store` | Trial balance matches event-store derived positions | Daily |
| `recon:ecl-staging-completeness` | Every eligible instrument has a current ECL stage | Daily |
| `recon:ecl-macro-scenario-currency` | Macroeconomic scenario weights have a current-quarter `EclScenarioApproved` event | Quarterly |
| `recon:fv-hierarchy-level3-approval` | Every Level 3 instrument has a current-quarter `Level3FvApproved` event | Quarterly |
| `recon:hedge-documentation-completeness` | Every active hedge has a current `HedgeDesignationApproved` event | Daily |
| `recon:related-party-approvals` | Every above-threshold related-party transaction has a `BoardRelatedPartyApproved` event | Continuous |
| `recon:accounting-policy-board-approval` | This policy document has a `BoardAccountingPolicyApproved` event within 13 months | Annual |
| `recon:audit-engagement-current` | An `ExternalAuditorAppointed` event exists for the current financial year | Annual |

---

## 5. External audit

### 5.1 External auditor requirements

The Bank's external auditor must:

- Be a **registered auditor** under the Auditing Profession Act 26 of 2005, registered with IRBA;
- Be approved by the **PA** as the Bank's external auditor at licence-day (Banks Act s.90(5));
- Be **independent** of the Bank and the Group per ISA 200 and the IRBA Code of Professional Conduct;
- Issue an audit opinion in accordance with **ISA 700** (forming an opinion on financial statements).

**Appointment.** The external auditor is appointed annually by the Board Audit Committee (BAC) and ratified by the shareholders at the annual general meeting (Companies Act s.94(7)).

**Auditor rotation.** The Bank observes the mandatory audit firm rotation requirement under the Companies Act and IRBA rules. Rotation of the audit partner (individual rotation) occurs every five years consistent with IRBA ethical requirements.

### 5.2 ISA 700 — audit opinion

The external auditor's report on the annual financial statements must cover:

- Whether the financial statements present fairly, in all material respects, the financial position and results of the Bank in accordance with IFRS;
- Key audit matters (ISA 701) — the matters that, in the auditor's professional judgement, were of most significance in the audit (expected to include: ECL estimates; fair value of Level 2/3 instruments; hedge effectiveness assessment);
- Going concern conclusion.

The BAC receives the ISA 700 audit report and the management letter (audit findings) at the completion of each annual audit.

### 5.3 Auditor independence

The BAC oversees auditor independence. The following services are prohibited for the external auditor (to preserve independence):

- Bookkeeping or accounting services;
- Financial information systems design and implementation;
- Valuation or appraisal services;
- Internal audit services;
- Actuarial services;
- Legal services unrelated to the audit.

Non-audit services must be pre-approved by the BAC Chair. A schedule of permitted non-audit fees vs audit fees is tabled at each BAC meeting.

---

## 6. Exceptions and escalation

### 6.1 Policy exceptions

Any departure from these accounting policies (e.g. application of a different IFRS measurement basis, deferral of an impairment recognition) requires:

1. Written justification from Camille (CFO, governance);
2. Consultation with the external auditor;
3. BAC approval;
4. Disclosure in the financial statements per IAS 8.

**No exceptions are permitted to:** the ECL three-stage model; the IFRS 9 business model classification; the Day-1 P&L deferral rule for Level 3 instruments; the Banks Act s.90 accounting records requirement.

### 6.2 Escalation pathway

| Trigger | Escalation | Timeline |
|---|---|---|
| Material misstatement identified post-publication | Vera flags → Camille (CFO, governance) → BAC → Board; external auditor notification | Same business day |
| ECL staging disagreement (management vs model) | Bea flags → Camille (CFO, governance) → Helena (CRO, governance) challenge → BAC as arbiter | Within 5 business days of disagreement |
| Level 3 instrument without approved valuation | Vera flags → Camille → model risk owner; no position held without approved valuation | Pre-trade gate (immediate) |
| Related-party transaction above threshold without Board approval | Vera flags → Owen (Company Secretary, governance) → BAC; transaction suspended | Same business day |
| External auditor qualification risk | BAC Chair → Board Chair | Immediately on auditor notification |
| Tax position — uncertain tax treatment | Yael (Tax engineer, engineering) flags → Camille → external auditor; IAS 12 / IFRIC 23 disclosure | Before annual financial statements sign-off |

---

## 7. Authority and citations

**Statutory instruments:**

- Banks Act 94 of 1990 s.90 (accounting records); s.90(5) (external auditor approval by PA).
- Companies Act 71 of 2008 s.94 (Audit Committee); s.45 (financial assistance to directors).
- International Financial Reporting Standards (IFRS) as issued by the IASB:
  - IAS 1 — Presentation of Financial Statements (paragraphs 25, 38, 40A).
  - IFRS 9 — Financial Instruments (business model; SPPI; ECL three-stage model; hedge accounting; sections 4.1–4.4, 5.4–5.7).
  - IFRS 13 — Fair Value Measurement (fair value hierarchy; valuation techniques; Day-1 P&L).
  - IAS 32 — Financial Instruments: Presentation (classification of financial instruments as equity or liability).
  - IFRS 7 — Financial Instruments: Disclosures (quantitative and qualitative risk disclosures; fair value hierarchy disclosures).
  - IAS 36 — Impairment of Assets (applies to non-financial assets; referenced for impairment framework consistency).
  - IAS 12 — Income Taxes (current and deferred tax; effective tax rate reconciliation; IFRIC 23 uncertain tax treatments).
  - IAS 24 — Related Party Disclosures (definition; disclosure requirements; transactions).
  - IAS 8 — Accounting Policies, Changes in Accounting Estimates and Errors (policy change disclosure).
  - IFRS 10 — Consolidated Financial Statements (consolidation basis).
- International Standards on Auditing (ISA):
  - ISA 700 — Forming an Opinion and Reporting on Financial Statements.
  - ISA 701 — Communicating Key Audit Matters in the Independent Auditor's Report.
  - ISA 200 — Overall Objectives of the Independent Auditor.
- Auditing Profession Act 26 of 2005 (IRBA registration).
- IRBA Code of Professional Conduct (auditor independence; partner rotation).

**Internal canonical sources:**

- [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) — ORG-AC rows cited inline throughout this document.
- [`Team/_team-roster.json`](../Team/_team-roster.json) — canonical source for agent names and reporting lines.
- [`Policies/governance-framework-v1.md`](governance-framework-v1.md) — Board Audit Committee mandate; CFO independence; Board reserved matters.
- [`Policies/risk-management-and-compliance-policy-v1.md`](risk-management-and-compliance-policy-v1.md) — three-lines model cross-reference.
- [`Policies/capital-management-policy-v1.md`](capital-management-policy-v1.md) — ICAAP / capital adequacy cross-reference.
- [`Regulations/_party-register.md`](../Regulations/_party-register.md) — Party register; KMP identification for related-party analysis (per `D-PARTY-REGISTER`).
- **D-RMS-PHASE-1** (CEO-approved 2026-05-09) — event-type registration; document-substrate; accounting records retention.
- **D-FSP-LICENCE-NECESSITY** (CEO-approved 2026-05-09) — Hoz Securities Limited consolidation scope.
- **D-PARTY-REGISTER** (CEO-approved 2026-05-11) — Party register as KMP identity source.
- **CLAUDE.md** — "Operating procedures" (events-first authoring; dispatch discipline); "Architectural principles" 1, 2, 6.
- `project_ai_driven_bank.md` (memory) — build-phase posture; licence-day accounting obligations.
- `project_strategic_foundation.md` (memory) — institutional global-markets dealer; JSE bonds/equities + OTC IRD.
- `feedback_agent_name_with_position.md` (memory) — name + position on first mention.

---

## 8. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1.0 | 2026-05-13 | Owen (Company Secretary, governance) on behalf of Camille (CFO, governance) | Initial IFRS accounting policies. Sections: (3.1) IFRS 9 classification and measurement — business model test, amortised cost, FVOCI, FVTPL; (3.2) IFRS 9 ECL — three-stage model, SICR triggers, PD/LGD/EAD methodology, forward-looking adjustments; (3.3) IFRS 13 fair value — hierarchy Levels 1/2/3, valuation techniques, CVA/DVA/FVA, Day-1 P&L policy; (3.4) IFRS 9 hedge accounting — fair value hedges, cash flow hedges, documentation; (3.5) IAS 1 presentation — going concern, materiality, comparative periods; (3.6) IAS 12 income taxes — current and deferred tax, effective-rate reconciliation; (3.7) IAS 24 related-party disclosures — definitions, transactions, board approval thresholds; (5) External audit engagement — auditor requirements, ISA 700, independence, rotation. Closes obligations ORG-AC-01 through ORG-AC-16. LICENCE-BIND. DRAFT pending BAC constitution at licence-day. |
| v1.1 | 2026-05-18 | Owen (Company Secretary, governance) | Added §3.1A (trade-date accounting election — IFRS 9 B3.1.3; recognition on trade date for FX/bonds/equities; PR-FX-001/PR-BOND-001/PR-EQ-001 mapping); §3.1B (derecognition — IFRS 9 §3.2; instrument-level derecognition triggers; settlement failure/reversal; FVOCI equity no-recycle rule); §3.1C (IFRS 13 §72 fair value measurement hierarchy — Level 1/2/3 for all instrument types; build-phase rate source; Level 3 governance). Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN. |
| v1.2 | 2026-05-21 | Owen (Company Secretary, governance) on behalf of Camille (CFO, governance) | Resolved two `[X]/[Y]` placeholders that blocked DRAFT→IN-FORCE promotion: (a) §3.2.2 SICR quantitative threshold — set at relative 100% increase in lifetime PD **or** absolute 50 bp increase, whichever first; ICAAP reviewed annually; `SicrThresholdApproved` event planned. (b) §3.5.2 materiality quantitative threshold — set at 5% of profit before tax **or** 0.5% of total assets (whichever lower); annual review against external-audit materiality benchmark. No other substantive content change. Authority: brief `brief:owen:complete-top-5-policy-gaps-from-2026-05-21-audit:2026-05-21`; CFO (Camille) ratification expected at next ICAAP review cycle. |
| v1.3 | 2026-05-21 | Bea (Accounting & financial reporting engineer, engineering) on peer review of Owen (Company Secretary, governance) v1.2 | Peer-review amendment of two quantitative thresholds inserted in v1.2: (a) §3.2.2 SICR — replaced "whichever first" OR-rule with "both legs must trigger" AND-rule, resolving internal contradiction with the rationale paragraph (rule and worked-example disagreed for small-PD doublings) and aligning with the conservative end of SA Big-5 peer practice; qualitative and 30-DPD overrides preserved. (b) §3.5.2 materiality — replaced two-leg "whichever lower" with three-leg "lowest of defined positive denominators" (0.5% total assets / 5% normalised PBT / 1% CET1), removing the threshold-collapses-to-zero pathology in build-phase periods and the mathematically-undefined behaviour in loss-making years; introduced normalised-PBT definition (3-year trailing average of profit-making years only); introduced CET1 floor; added `MaterialityBenchmarkApproved` event ref. No other substantive content change; touched only §3.2.2, §3.5.2, change log, version bump (frontmatter + header). Authority: brief `brief:bea:peer-review-ifrs-quantitative-thresholds-drafted:2026-05-21`; full peer-review record at `2026-05-21_bea_ifrs-thresholds-peer-review.md`; CFO (Camille) ratification expected at next ICAAP review cycle. |

---

*Owen (Company Secretary, governance) on behalf of Camille (CFO, governance)*
