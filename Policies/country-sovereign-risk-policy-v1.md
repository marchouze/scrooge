---
policy-id: country-sovereign-risk-policy
title: Country and Sovereign Risk Policy v1
version: "1"
status: IN FORCE
owner: Helena (Chief Risk Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - Regulations Relating to Banks reg.32 (sovereign risk weight)
  - Basel III risk weights — 0% SA sovereign in ZAR; ECAI-based for others
  - Exchange Control Regulations (Currency and Exchanges Act 9 of 1933)
  - BCBS Principles for the Management and Supervision of Interest Rate Risk
  - BCBS Basel III standardised approach for credit risk — sovereign risk weights
  - existing Policies/concentration-risk-policy-v1.md (geographic concentration sub-component)
author: Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering)
date: 2026-05-22
summary: Country and Sovereign Risk Policy covering country risk taxonomy, approved country list, SA sovereign vs foreign sovereign risk-weight treatment, ECAI mapping, non-SA MTM hard cap, Excon FX net open position constraint, country limit governance, and quarterly review of approved country list. COMMENCEMENT-BIND.
decision-required: false
riskTaxonomy:
  - RT-CR
  - RT-SR
---

# Country and Sovereign Risk Policy v1

> **Authors.** Helena (Chief Risk Officer, governance) — lead; Rohan (Market risk quantitative engineer, engineering) — co-author.
> **Status.** COMMENCEMENT-BIND. Country and sovereign risk exposure arises from the first transaction with a non-SA counterparty or the first holding of a non-SA instrument. The framework is required from commencement of trading.
> **Identity discipline.** Every agent reference pairs name + position on first mention.

---

## 1. Country and Sovereign Risk Policy — Overarching

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) for approved country list; CEO for any new country addition; ALCO for limit calibrations · **Cadence:** Annual policy review; quarterly review of the approved country list; triggered on material change in a country's risk profile · **Citation:** Regulations Relating to Banks reg.32 + BCBS Basel III standardised approach + Exchange Control Regulations

### Purpose

This policy governs how Hoz Bank Limited identifies, measures, monitors, and manages country risk and sovereign risk. Country risk is the risk that a counterparty or issuer in a foreign jurisdiction fails to meet its obligations because of conditions in that country (transfer risk, convertibility risk, political risk). Sovereign risk is the risk that a sovereign borrower or guarantor (including the Government of South Africa) defaults on its debt obligations.

Given the Bank's mandate as a JSE-focused domestic institutional trading bank with limited cross-border activity (per `Policies/trading-mandate-v1.md`), country risk is primarily a constraint framework rather than a primary revenue driver. The approved country list is deliberately narrow; cross-border exposures arise mainly from OTC derivative clearing arrangements with CCPs in approved jurisdictions and from hard-currency liquidity management.

### Principles

- **South Africa is the domestic jurisdiction; all others are foreign.** The Bank treats SA as the home jurisdiction with the lowest country risk. All other jurisdictions are foreign and subject to country risk limits. This is not a commentary on SA sovereign creditworthiness; it reflects the Bank's regulatory domicile and operating mandate.
- **Approved country list governs entry.** No new country exposure is taken unless the country is on the approved country list. New country additions require Helena's recommendation and CEO approval; a `CountryAddedToApprovedList { country, iso2, risk Tier, alcoApprovalRef, ceoApprovalRef }` event is required before the first transaction.
- **ECAI ratings drive risk weights for non-SA sovereign exposures.** Risk weights for non-SA sovereign exposures in the SARB standardised approach follow the ECAI rating mapping table (§3) per reg.32 and BCBS Basel III. Where no ECAI rating exists, the 100% risk weight applies.
- **Excon compliance as a hard constraint.** The Exchange Control Regulations impose hard limits on the Bank's net foreign currency exposures. These constraints bind on all cross-border transactions, including OTC derivative transactions with non-SA counterparties and any hard-currency investment portfolio holdings. Owen manages the Excon compliance reporting.
- **Events-first country risk.** Every approved country list change and every country limit breach is a typed event in the event log. Country exposure metrics are queries over position events filtered by counterparty jurisdiction.

### Roles

Helena (Chief Risk Officer, governance) is the policy owner. She is responsible for: maintaining the approved country list and country limits; quarterly review of country risk profiles; recommending new country additions to the CEO. Rohan (Market risk quantitative engineer, engineering — reports to Helena) builds and operates the country exposure monitoring system. Owen (Company Secretary, governance) manages Exchange Control reporting and compliance with Excon limits. Imani (Legal-as-code engineer, engineering) provides legal opinions on close-out netting enforceability for non-SA jurisdictions. Camille (Chief Financial Officer, governance) integrates country risk-weighted assets into the BA-return suite.

---

## 2. Country Risk Taxonomy

**Owner:** Helena (Chief Risk Officer, governance) · **Cadence:** Taxonomy is stable; examples updated on material country events · **Citation:** BCBS Basel III (2010) — country risk classification; SARB supervisory guidance on country risk

### 2.1 Transfer Risk

Transfer risk is the risk that, even if a foreign counterparty or issuer is solvent and willing to pay, the foreign government imposes restrictions on the transfer of funds out of the jurisdiction. Transfer risk materialises as a technical default even when the counterparty is creditworthy. Helena assesses transfer risk for all non-SA jurisdictions on the approved country list, using current ECAI country risk assessments and OECD country risk classifications.

### 2.2 Convertibility Risk

Convertibility risk is the risk that the foreign government restricts the conversion of local currency into foreign currency (or vice versa), preventing the Bank from realising the value of a foreign-currency-denominated claim. For the Bank's OTC derivative book, convertibility risk affects cross-currency swap positions and any hard-currency MTM claims on foreign counterparties.

### 2.3 Political Risk

Political risk is the risk that political instability, expropriation, sanctions, or regulatory change in a foreign jurisdiction adversely affects the Bank's ability to collect on its claims. For the Bank's narrow cross-border mandate, political risk applies primarily to CCP jurisdictions (UK, EU, US) and to any non-SA counterparty.

---

## 3. Approved Country List and Risk-Weight Treatment

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Helena recommendation + CEO approval for each country addition · **Cadence:** Quarterly review; triggered on ECAI rating change or material political event · **Citation:** Regulations Relating to Banks reg.32 + BCBS Basel III standardised approach — sovereign risk weights + Exchange Control Regulations

### 3.1 Approved Country List

The initial approved country list at commencement of trading:

| Country | ISO 2 | Permitted purposes | Risk tier |
|---|---|---|---|
| South Africa | ZA | All purposes (domestic) | Domestic |
| United Kingdom | GB | CCP clearing via LCH (OTC IRD clearing only); no funded credit | Tier 1 — low country risk |
| United States of America | US | CCP clearing via CME (if required); USD hard currency liquidity | Tier 1 — low country risk |
| European Union (Eurozone) | EU | CCP clearing via Eurex (if applicable); EUR hard currency liquidity | Tier 1 — low country risk |

Any country not on this list is not an approved jurisdiction. Any new counterparty domiciled in a non-approved jurisdiction requires: (i) Helena's country risk assessment; (ii) CEO approval; (iii) an updated approved country list event.

### 3.2 SA Sovereign Risk-Weight Treatment

South African sovereign exposure denominated in ZAR receives a 0% risk weight under reg.32 and the BCBS Basel III standardised approach `[citation: TBC — precise reg.32 sub-clause for SA sovereign ZAR treatment; Imani confirms]`. This treatment applies to:
- SA Government Bonds (SAGBs) held in the banking book or HQLA portfolio.
- ZAR-denominated loans to the SA Government.
- Exposures to the SARB denominated in ZAR.

SA sovereign exposure in hard currency (e.g., SA Government USD Eurobonds) does not receive the 0% domestic risk weight; it receives the ECAI-based risk weight per the South Africa ECAI long-term foreign currency rating.

### 3.3 ECAI Rating Mapping to Risk Weights (Non-SA Sovereigns)

For non-SA sovereign exposures, the risk weight is determined by the ECAI long-term sovereign rating, per the BCBS Basel III standardised approach and reg.32:

| ECAI rating range | Risk weight |
|---|---|
| AAA to AA- | 0% |
| A+ to A- | 20% |
| BBB+ to BBB- | 50% |
| BB+ to B- | 100% |
| Below B- | 150% |
| Unrated | 100% |

Approved ECAIs for the Bank's risk-weight mapping: S&P, Moody's, Fitch. Where ratings differ across ECAIs, the second-highest risk weight applies (per the BCBS standardised approach `[citation: TBC — BCBS Basel III para on multiple ECAIs]`).

---

## 4. Non-SA Counterparty Gross Mark-to-Market Hard Cap

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** CEO for any increase above the initial cap · **Cadence:** Daily monitoring by Rohan; monthly ALCO · **Citation:** `Policies/concentration-risk-policy-v1.md` §6 (geographic concentration); Exchange Control Regulations

The Bank maintains a hard cap on the aggregate gross mark-to-market exposure to non-SA counterparties (all foreign jurisdictions combined). This cap is expressed as a percentage of the Bank's total credit-bearing exposures and is calibrated conservatively given the Bank's domestic mandate:

- **Non-SA counterparty gross MTM hard cap:** 15% of total credit-bearing exposures (same as the geographic concentration limit in `Policies/concentration-risk-policy-v1.md` §6).
- **Single non-SA counterparty hard cap:** 5% of total credit-bearing exposures (also aligned with the geographic sub-concentration limit).

The gross MTM exposure includes the full mark-to-market value of OTC derivative positions with foreign counterparties before netting. Breaches of the non-SA MTM cap trigger immediate Helena notification and ALCO review within 5 business days. A `CountryExposureLimitBreached { countryOrRegion, currentExposure, cap, pct }` event is the canonical record.

---

## 5. Excon Net Open Position Constraint

**Owner:** Owen (Company Secretary, governance) — Excon reporting; Helena — risk monitoring · **Approval:** SARB Forex Department for any increase in foreign asset holdings above Excon limits · **Cadence:** Daily monitoring by Rohan; monthly Excon reporting by Owen · **Citation:** Exchange Control Regulations (Currency and Exchanges Act 9 of 1933) — foreign asset limits for authorised dealers; SARB Currency and Exchanges Manual for Authorised Dealers

The Exchange Control Regulations impose a hard limit on the Bank's aggregate net foreign currency open position and on the total foreign assets the Bank may hold as a proportion of its capital. The Bank's Excon limits are established by the SARB at the time of banking licence registration. Specific limit values are not reproduced in this policy (they are set by the SARB in the Bank's Excon approval letter); they are maintained in `Procedures/by-policy/excon-monitoring.md`.

Key constraints:
- **Net foreign currency open position:** The Bank's aggregate net open position in all foreign currencies combined must not exceed the limit in the Excon approval (expressed as a % of the Bank's free reserves or regulatory capital).
- **Foreign assets:** Total foreign assets (hard-currency denominated claims on non-SA entities, including OTC derivative MTM claims) must not exceed the Excon foreign asset limit.
- **Monitoring and reporting:** Rohan monitors the net open position and foreign asset position daily. Owen files the required Excon reporting to the SARB (Form F-2 or equivalent) per the reporting schedule in the SARB Currency and Exchanges Manual. A `ExconLimitApproachingThreshold { limitType, currentValue, limit, pct }` event is emitted when utilisation exceeds 80%; a `ExconLimitBreached { limitType, currentValue, limit }` event triggers immediate CEO and Owen notification.

---

## 6. Country Limit Governance

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Helena recommendation + CEO approval for country limits · **Cadence:** Quarterly review of approved country list and limits; annual policy review · **Citation:** BCBS large exposures framework (April 2014)

### 6.1 Country Limit Setting

Country limits are set per approved country (excluding SA domestic) and expressed as a maximum aggregate exposure (funded credit + CCR EAD + off-balance sheet) to counterparties domiciled in that country. Initial limits at commencement of trading:

| Country | Purpose limit | Exposure limit |
|---|---|---|
| United Kingdom | CCP clearing exposures only | CCP initial margin posting only; no funded credit |
| United States of America | USD hard-currency liquidity + CCP | 5% of total credit-bearing exposures |
| European Union | EUR hard-currency liquidity + CCP | 5% of total credit-bearing exposures |

Country limits are maintained in `Procedures/by-policy/country-limit-register.md`.

### 6.2 Quarterly Review

Helena reviews the approved country list and country risk profiles quarterly, using current ECAI ratings, OECD country risk classifications, and any material political or economic events. The review covers:
1. Any change to an approved country's ECAI rating or Excon treatment.
2. Any sanctions designation affecting an approved counterparty domicile.
3. Any material change in the enforceability of close-out netting in an approved jurisdiction (Imani provides input).
4. Any new CCP jurisdiction that the Bank wishes to access.

The quarterly review outcome is a `CountryRiskQuarterlyReviewCompleted { quarter, reviewedCountries[], changes[], alcoRef }` event. Any change to the approved country list requires CEO approval.

---

## 7. Substrate Dependencies and Gaps

- **Country exposure aggregation (Rohan).** Automated daily aggregation of all exposures by counterparty jurisdiction, cross-referenced with the approved country list. Discharge exit signal: `CountryExposureRegisterUpdated { date, byCountry[] }` event.
- **ECAI rating feed (Rohan).** Automated ECAI rating updates for non-SA sovereign counterparties; risk weight recalculation on rating change. Currently manual; substrate build formalises the feed.
- **Excon monitoring (Owen + Rohan).** Automated daily net open position and foreign asset calculation; Excon reporting automation. Currently manual; substrate build target.

---

## 8. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering) | Initial policy authored. Six sections: (1) Overarching — SA domestic, approved country list, ECAI risk weights, Excon constraint, events-first; (2) Country Risk Taxonomy — transfer risk, convertibility risk, political risk; (3) Approved Country List and Risk-Weight Treatment — initial four-country list, SA sovereign 0% ZAR treatment, ECAI table; (4) Non-SA MTM Hard Cap — 15% aggregate and 5% single-country caps; (5) Excon Net Open Position Constraint — foreign asset limits, Owen reporting, event triggers; (6) Country Limit Governance — per-country limits table, quarterly review process. COMMENCEMENT-BIND. |
