---
policy-id: funds-transfer-pricing-policy
title: Funds Transfer Pricing Policy v1
version: "1"
status: IN FORCE
owner: Eitan (Treasurer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - BCBS Principles for sound liquidity risk management and supervision (September 2008)
  - Basel III LCR framework (January 2013)
  - Basel III NSFR framework (October 2014)
  - Banks Act 94 of 1990
  - Regulations Relating to Banks reg.26 (liquidity risk management)
  - SARB Guidance Note on IRRBB (aligned to BCBS IRRBB April 2016)
  - existing Policies/irrbb-policy-v1.md (IRRBB sub-component)
  - existing Policies/liquidity-risk-management-policy-v1.md (LRM sub-component)
author: Eitan (Treasurer, governance) + Camille (Chief Financial Officer, governance)
date: 2026-05-22
summary: Funds Transfer Pricing Policy covering matched-maturity FTP methodology, product-level FTP curve construction, liquidity premium components, optionality adjustment, basis risk allocation, FTP event emission on product origination, governance of curve parameter changes, and monthly recalibration cadence. COMMENCEMENT-BIND.
decision-required: false
riskTaxonomy:
  - RT-LR
  - RT-IR
  - RT-FR
---

# Funds Transfer Pricing Policy v1

> **Authors.** Eitan (Treasurer, governance) — lead; Camille (Chief Financial Officer, governance) — co-author.
> **Status.** COMMENCEMENT-BIND. The FTP framework becomes operative when the Bank begins booking assets and liabilities (commencement of trading). The build-phase work is the substrate construction and curve calibration preparatory to the first transaction.
> **Identity discipline.** Every agent reference pairs name + position on first mention.

---

## 1. Funds Transfer Pricing Policy — Overarching

**Owner:** Eitan (Treasurer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) on initial methodology; ALCO (Eitan chair) on recalibration within approved parameters · **Cadence:** Monthly recalibration of FTP curves; annual policy review; triggered on material change to the Bank's funding structure or product mix · **Citation:** BCBS Principles for sound liquidity risk management (September 2008) + Basel III LCR (January 2013) + Basel III NSFR (October 2014) + Banks Act 94 of 1990 + Regulations Relating to Banks reg.26

### Purpose

This policy establishes the Funds Transfer Pricing (FTP) framework for Hoz Bank Limited. FTP is the internal pricing mechanism by which the Treasury charges business units for the liquidity, interest rate risk, and funding costs embedded in the products they originate. Its purpose is to ensure that: (i) every product originated by the Bank carries the true economic cost of the liquidity and interest rate risk it creates; (ii) the Treasury is compensated for managing the structural interest rate and liquidity risks of the balance sheet; (iii) business unit profitability is measured after the full funding cost is allocated — so that trading and banking book decisions are made on economically sound foundations; and (iv) the FTP framework supports the Bank's LCR, NSFR, and IRRBB management objectives by signalling the cost of maturity transformation and liquidity buffers at the product level.

The FTP framework is a sub-component of the ALM framework (`Policies/asset-liability-management-policy-v1.md`). The IRRBB policy (`Policies/irrbb-policy-v1.md`) governs the measurement and management of interest rate risk in the banking book; this policy governs how that risk cost is allocated to originating business units through internal pricing. The liquidity risk management policy (`Policies/liquidity-risk-management-policy-v1.md`) governs the external liquidity requirements; this policy governs how the cost of maintaining the liquidity buffer is distributed internally.

### Principles

- **Matched-maturity transfer pricing.** The FTP rate for each product is based on a matched-maturity funding curve — the rate at which the Bank could fund an instrument of the same maturity in the market. Mismatched-maturity pricing (e.g., using an overnight rate for a 5-year fixed-rate loan) is not permitted; it would distort business unit P&L and obscure the true cost of maturity transformation.
- **Complete cost recovery.** The FTP rate must cover all three components of funding cost: (i) the risk-free rate (interpolated from the SARB repo rate curve and ZAR swap curve); (ii) the liquidity premium (the cost of maintaining HQLA buffers sufficient to meet the LCR/NSFR requirements arising from the product); and (iii) optionality adjustments (for products with embedded optionality — e.g., prepayable loans, demand deposits). No component may be omitted without Eitan's written approval.
- **Events-first FTP accounting.** Every FTP rate attachment is a typed event — `FtpAttachedToProduct { productId, transactionId, ftpRate, curveVersion, liquidityPremium, optionalityAdjustment, basisRiskAdjustment, effectiveDate }`. The event log is the canonical record of every FTP charge; no FTP allocation proceeds without this event. Camille integrates FTP events into the management P&L attribution.
- **Curve integrity is ALCO-governed.** FTP curve parameters (benchmark curve selection, liquidity premium add-ons, optionality adjustment methodology) may only be changed by Eitan following ALCO review. Unauthorised curve modifications are a Principle 1 violation; Ravi (Treasury/ALM engineer, engineering) implements curve parameter changes only after an `FtpCurveParameterChanged { parameter, priorValue, newValue, alcoApprovalRef, effectiveDate }` event is on record.
- **Basis risk is explicitly allocated.** The FTP framework does not assume perfect hedge efficiency. Basis risk arising from mismatches between the FTP benchmark curve and the actual funding instruments used by Treasury is measured and allocated as a separate FTP component. The basis risk residual — the P&L impact of imperfect hedging — sits in the Treasury book, not in the business unit books, until Eitan resets the FTP curves to reflect actual funding costs.

### Roles

Eitan (Treasurer, governance) is the policy owner and chairs ALCO. Eitan is responsible for: maintaining the FTP curve methodology; approving curve parameter changes; presenting the FTP framework to ALCO and the Board; ensuring FTP rates are applied consistently across all products. Ravi (Treasury/ALM engineer, engineering — reports to Eitan) builds and operates the FTP engine, the curve construction tooling, and the FTP event emission infrastructure. Camille (Chief Financial Officer, governance) integrates FTP charges into the management accounts and the divisional P&L reporting. Helena (Chief Risk Officer, governance) provides independent review of the FTP framework's interaction with the IRRBB measurement framework (to ensure double-counting of rate risk costs is avoided). Vera (internal audit engineer) assesses the FTP framework's adherence to this policy at the annual audit cycle.

---

## 2. FTP Methodology — Matched Maturity Transfer Pricing

**Owner:** Eitan (Treasurer, governance) · **Approval:** Board (CEO interim) for initial methodology; ALCO for recalibration · **Cadence:** Monthly curve recalibration; ad hoc on material market dislocation · **Citation:** BCBS Principles for sound liquidity risk management (2008) — Principle 4 (internal FTP); Basel III LCR (January 2013) — liquidity cost allocation

### 2.1 Benchmark Curve Construction

The FTP benchmark curve is the primary rate reference for matched-maturity pricing. It is constructed by Ravi as a single ZAR curve covering tenors from overnight to 30 years, using:

- **Short end (0–1 year):** SARB repo rate and JIBAR (Johannesburg Interbank Average Rate) fixing for the 1-month, 3-month, and 6-month tenors.
- **Mid curve (1–10 years):** ZAR interest rate swap curve (fixed vs 3M JIBAR) as the primary benchmark, sourced from the market data feed.
- **Long end (10–30 years):** South African Government Bond (SAGB) yield curve, adjusted for the credit differential between the Bank's own funding cost and the sovereign, using observed senior unsecured bank funding spreads.

The benchmark curve is reconstructed monthly as part of the regular recalibration cycle (§5) and on any business day when the SARB repo rate changes. A `FtpBenchmarkCurveUpdated { curveVersion, constructionDate, tenorPoints[], dataSource }` event is emitted on each update.

### 2.2 Product-Level FTP Rate Calculation

For each product originated (asset or liability), the FTP rate is calculated as:

```
FTP Rate = Benchmark Rate(maturity) + Liquidity Premium(maturity) + Optionality Adjustment + Basis Risk Adjustment
```

Where:
- **Benchmark Rate(maturity):** interpolated from the FTP benchmark curve at the product's contractual maturity (or behavioural maturity for non-maturing products — see §3).
- **Liquidity Premium(maturity):** the add-on for the liquidity cost of the product, calibrated to the LCR/NSFR impact (see §2.3).
- **Optionality Adjustment:** positive (increases cost) for embedded optionality that reduces the Bank's certainty of cashflow timing (see §2.4).
- **Basis Risk Adjustment:** the current basis between the benchmark curve and the Bank's actual marginal funding cost at the relevant tenor (Eitan-approved; updated monthly).

---

## 3. Liquidity Premium Components

**Owner:** Eitan (Treasurer, governance) · **Approval:** ALCO · **Cadence:** Monthly recalibration · **Citation:** Basel III LCR (January 2013) — HQLA cost; BCBS Principles for sound liquidity risk management (2008) — Principle 4

The liquidity premium component of the FTP rate reflects the Bank's cost of maintaining HQLA buffers to meet the LCR and NSFR requirements attributable to each product originated. The liquidity premium is structured in three layers:

### 3.1 LCR Liquidity Buffer Cost

Every product that creates a net cash outflow under the LCR stress scenario (per reg.26 and the Basel III LCR standard) requires the Bank to hold an equivalent amount of HQLA. The cost of holding HQLA (the yield drag from holding liquid HQLA rather than higher-yielding illiquid assets) is the LCR liquidity premium. It is calculated as:

```
LCR Premium = LCR Stress Outflow Rate × (HQLA Benchmark Yield - Opportunity Cost of HQLA)
```

The LCR stress outflow rates for each product type (retail deposits, institutional deposits, committed facilities, OTC derivative margin calls) are sourced from the Basel III LCR standard and reg.26. Ravi maintains the product-to-outflow-rate mapping; ALCO approves changes.

### 3.2 NSFR Stable Funding Cost

Every product that requires stable funding under the NSFR (per the Basel III NSFR and reg.26) requires an NSFR premium allocation. The NSFR premium reflects the incremental cost of raising long-term stable funding (term deposits, long-term wholesale funding) rather than short-term wholesale funding. It is calculated as:

```
NSFR Premium = Required Stable Funding Factor × (Stable Funding Cost - Short-term Funding Cost)
```

Required Stable Funding (RSF) factors for each asset type are sourced from the Basel III NSFR standard and reg.26.

### 3.3 Contingency Liquidity Reserve Cost

The Bank maintains a contingency liquidity reserve above the regulatory LCR minimum (per `Policies/liquidity-risk-management-policy-v1.md`). The cost of this buffer above the regulatory floor is allocated to products pro-rata to their stress outflow contribution. ALCO sets the contingency buffer size and the allocation basis quarterly.

---

## 4. Optionality Adjustment and Basis Risk Allocation

**Owner:** Eitan (Treasurer, governance) · **Approval:** ALCO · **Cadence:** Reviewed on any new product type introduction; monthly for parameter values · **Citation:** BCBS Principles for sound liquidity risk management (2008) — Principle 4; SARB Guidance Note on IRRBB

### 4.1 Optionality Adjustment

Products with embedded optionality create uncertainty in the Bank's cashflow profile and therefore in the effectiveness of the matched-maturity hedge. The optionality adjustment compensates Treasury for managing this uncertainty. Key optionality types and their FTP treatment:

| Optionality type | FTP treatment |
|---|---|
| Prepayable fixed-rate instruments (e.g., fixed-rate bonds with call features) | Add-on for the cost of swaption hedge to manage prepayment risk; calibrated by Ravi using market swaption volatility |
| Demand deposits and non-maturing deposits (NMDs) | Behavioural maturity applied (§4 of `Policies/asset-liability-management-policy-v1.md`); optionality adjustment for the difference between contractual (overnight) and behavioural maturity |
| Committed undrawn facilities | Add-on for the liquidity option value; linked to the LCR committed facility outflow rate |
| OTC derivative early termination rights | Adjustment for the mark-to-market exposure optionality on close-out; estimated using scenario analysis |

The optionality adjustment for each product type is set in `Procedures/by-policy/ftp-curve-calibration.md` and updated monthly by Ravi under Eitan's direction.

### 4.2 Basis Risk Allocation

Basis risk arises when the actual funding cost incurred by Treasury differs from the FTP benchmark curve used to price products. Treasury absorbs the basis risk residual as a Treasury book P&L item; it is not allocated back to business units unless a structural basis (e.g., a persistent JIBAR–repo basis) justifies a recalibration of the FTP curve. Eitan reviews the Treasury basis P&L monthly at ALCO; if the basis P&L exceeds the threshold set in `Procedures/by-policy/ftp-curve-calibration.md` for two consecutive months, the FTP curve is recalibrated to reflect the actual funding basis.

---

## 5. FTP Event Emission and Governance

**Owner:** Eitan (Treasurer, governance) · **Approval:** ALCO for curve changes; Eitan for product-level FTP rate applications · **Cadence:** Per-transaction FTP attachment; monthly curve recalibration; annual policy review · **Citation:** Principle 1 (events-first)

### 5.1 FTP Event Emission on Product Origination

Every product origination event (`TradeBooked`, `LoanOriginated`, `DepositReceived`, or equivalent) triggers an `FtpAttachedToProduct` event within the same processing day. Ravi's FTP engine reads the product attributes (maturity, notional, currency, optionality flags) from the origination event and emits:

```
FtpAttachedToProduct {
  productId,
  transactionId,
  ftpRate,
  curveVersion,
  benchmarkRate,
  liquidityPremium,
  optionalityAdjustment,
  basisRiskAdjustment,
  effectiveDate,
  expiryDate (= product maturity or next repricing date)
}
```

No product is included in business unit P&L reporting without a corresponding `FtpAttachedToProduct` event. Camille's management accounts engine rejects any position-level P&L that lacks an FTP attachment event.

### 5.2 Monthly Recalibration

On the first business day of each month, Ravi recalibrates the FTP benchmark curve and the liquidity premium components using the prior month-end market data. The recalibration covers:

1. Reconstruction of the ZAR benchmark curve from updated JIBAR, swap, and SAGB data.
2. Recalculation of LCR and NSFR liquidity premium inputs using the most recent LCR/NSFR ratio and buffer cost.
3. Review of optionality adjustments against current market volatility levels.
4. Review of the basis risk adjustment against the prior month's Treasury basis P&L.

The recalibrated curve parameters are reviewed by Eitan before approval. An `FtpCurveRecalibrated { curveVersion, effectiveDate, keyChanges[] }` event is emitted after Eitan's approval. The recalibrated curve applies to all new product originations from the effective date; existing products are repriced at their next contractual repricing date (no retrospective repricing of fixed-rate instruments).

### 5.3 ALCO Oversight

Eitan presents the FTP framework operation to ALCO monthly, including: the FTP benchmark curve and any changes since the prior month; the liquidity premium components and LCR/NSFR inputs; the basis risk residual in the Treasury P&L; any products where the FTP framework produced anomalous results. ALCO reviews and approves all curve parameter changes.

---

## 6. Substrate Dependencies and Gaps

- **FTP engine (Ravi).** Automated FTP rate calculation and `FtpAttachedToProduct` event emission per transaction. Currently in build phase; initial implementation targets the first product origination at commencement of trading.
- **FTP curve construction tooling (Ravi).** ZAR curve construction from JIBAR, swap, and SAGB market data feeds. Discharge exit signal: `FtpBenchmarkCurveUpdated` event on first monthly recalibration.
- **Management accounts P&L integration (Bea + Ravi).** Business unit P&L reporting that consumes `FtpAttachedToProduct` events. Currently manual; substrate build formalises the event-driven P&L attribution.
- **Optionality adjustment calibration (Ravi + Helena).** Swaption-based prepayment adjustment and demand deposit behavioural maturity modelling. Helena provides independent review of the methodology alignment with the IRRBB framework.

---

## 7. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Eitan (Treasurer, governance) + Camille (Chief Financial Officer, governance) | Initial policy authored. Six sections: (1) Overarching — matched-maturity principle, complete cost recovery, events-first FTP, curve integrity governance, basis risk allocation; (2) FTP Methodology — benchmark curve construction (JIBAR, ZAR swap, SAGB); (3) Liquidity Premium Components — LCR buffer cost, NSFR stable funding cost, contingency reserve cost; (4) Optionality Adjustment and Basis Risk Allocation — product optionality taxonomy, basis risk Treasury P&L; (5) FTP Event Emission and Governance — FtpAttachedToProduct event, monthly recalibration, ALCO oversight; (6) Substrate dependencies. COMMENCEMENT-BIND. |
