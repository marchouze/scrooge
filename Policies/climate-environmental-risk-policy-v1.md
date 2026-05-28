---
policy-id: climate-environmental-risk-policy
title: Climate and Environmental Risk Policy v1
version: "1"
status: IN FORCE
owner: Helena (Chief Risk Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - SARB/PA Guidance Note 5 of 2022 (Managing Climate-Related Financial Risks)
  - TCFD recommendations (June 2017) — Task Force on Climate-related Financial Disclosures
  - NGFS scenarios (Network for Greening the Financial System)
  - Banks Act 94 of 1990 s.60 (risk management)
  - Regulations Relating to Banks reg.39 (internal control framework)
  - SARB Prudential Standard MPS-1 (climate risk integration, where applicable)
author: Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering)
date: 2026-05-22
summary: Climate and Environmental Risk Policy covering climate risk taxonomy (physical, transition, liability), TCFD disclosure alignment, NGFS scenario analysis, climate risk in ICAAP and stress testing, transition risk exposure identification, climate risk in credit origination, financed emissions baseline, annual climate risk report, and PA supervisory engagement. CORPORATE-BIND — PA expects climate-risk governance from early formation stage.
decision-required: false
riskTaxonomy:
  - RT-CR
  - RT-OR
  - RT-ESG
obligations:
  - ORG-PR-22
  - ORG-PR-61
  - ORG-PR-62
---

# Climate and Environmental Risk Policy v1

> **Authors.** Helena (Chief Risk Officer, governance) — lead; Rohan (Market risk quantitative engineer, engineering) — co-author.
> **Status.** CORPORATE-BIND. The PA's Guidance Note 5 of 2022 and the TCFD recommendations apply to all institutions under PA supervision, with the expectation that climate risk governance frameworks are in place during the formation and licensing stage, not only at commencement of trading. Climate risk governance is therefore a build-phase obligation.
> **Identity discipline.** Every agent reference pairs name + position on first mention.

---

## 1. Climate and Environmental Risk Policy — Overarching

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual policy review; annual climate risk report to CEO; quarterly TCFD monitoring · **Citation:** SARB/PA Guidance Note 5 of 2022 + TCFD (June 2017) + Banks Act 94 of 1990 s.60 + Regulations Relating to Banks reg.39

### Purpose

This policy establishes Hoz Bank Limited's framework for identifying, assessing, managing, and disclosing climate-related financial risks. The purpose is to ensure that: (i) climate risk is integrated into the Bank's risk management framework as a material and cross-cutting risk type; (ii) the Bank's governance, strategy, risk management, and metrics and targets are aligned with the TCFD recommendations, as expected by the PA per Guidance Note 5 of 2022; (iii) climate scenario analysis using NGFS scenarios informs the Bank's ICAAP and stress testing; (iv) climate risk in the Bank's counterparty exposures (transition risk from carbon-intensive counterparties) is assessed in credit origination; and (v) the Bank discloses its climate risk posture to the PA and, in due course, publicly.

The Bank's climate risk exposure at commencement of trading is limited by its institutional mandate (JSE bonds/equities + OTC IRD with institutional counterparties) — it does not originate retail mortgages or corporate loans to fossil-fuel sectors directly. However, the Bank's counterparty exposures include SA listed companies and financial institutions whose underlying businesses may carry transition risk; and the Bank's own operations (cloud infrastructure, data centres) have a direct carbon footprint, however small.

### Principles

- **Climate risk is a cross-cutting risk driver, not a standalone risk type.** Climate risk manifests through existing risk categories: credit risk (counterparty transition risk), market risk (asset price volatility from climate repricing), liquidity risk (stranded asset scenarios), and operational risk (physical damage to infrastructure). Helena integrates climate risk drivers into each risk category rather than managing it in isolation.
- **TCFD four-pillar structure as the governance framework.** The Bank's climate risk governance is structured around the four TCFD pillars: (i) governance (Board and management oversight); (ii) strategy (climate risk integration into the business plan); (iii) risk management (identification, assessment, management processes); and (iv) metrics and targets (climate KPIs and targets). Annual reporting against this structure is required by PA Guidance Note 5 of 2022.
- **NGFS scenarios for scenario analysis.** The Bank uses NGFS scenarios (orderly, disorderly, hot-house world) for climate scenario analysis in the ICAAP and stress testing, per the PA's recommendation in Guidance Note 5.
- **Build-phase materiality.** In the build phase, the Bank does not originate significant credit exposures. Climate risk materiality is therefore currently low in absolute terms. The framework is built now so that it scales as the balance sheet grows at commencement of trading. This position is transparent in the annual climate risk report.
- **Events-first climate risk.** Every climate scenario analysis run, every counterparty climate risk assessment in credit origination, and every financed emissions calculation is a typed event in the event log (Principle 1).

### Roles

Helena (Chief Risk Officer, governance) is the policy owner. She is responsible for: integrating climate risk into the risk framework; co-authoring the TCFD disclosure section of the AFS; presenting the annual climate risk report to the CEO. Rohan (Market risk quantitative engineer, engineering — reports to Helena) builds the climate scenario analysis tooling and the financed emissions baseline model. Camille (Chief Financial Officer, governance) co-authors the TCFD disclosure section of the AFS (metrics and targets; financed emissions). The CEO is the ultimate TCFD governance accountability holder at the Board level. Vera (internal audit engineer) includes climate risk governance assurance in the annual audit cycle.

---

## 2. Climate Risk Taxonomy

**Owner:** Helena (Chief Risk Officer, governance) · **Cadence:** Taxonomy is stable; materialisation assessment updated quarterly · **Citation:** TCFD (June 2017) — climate risk classification; PA Guidance Note 5 of 2022 — risk taxonomy

### 2.1 Physical Risk

Physical risk arises from the increasing severity and frequency of climate-related physical events (acute: storms, floods, wildfires; chronic: rising temperatures, sea-level rise, changing rainfall patterns). Physical risk affects the Bank through:
- Counterparty physical risk: a Bank counterparty's assets are located in a climate-vulnerable area; physical damage reduces their creditworthiness.
- Operational physical risk: the Bank's own infrastructure (data centres, office premises) is affected by physical climate events. Given the Bank's cloud-native infrastructure (Principle 3), direct physical risk is primarily the data centre's climate resilience.

### 2.2 Transition Risk

Transition risk arises from the transition to a lower-carbon economy: policy changes (carbon taxes, emissions regulations), technological changes (renewable energy disruption), market sentiment changes, and reputational changes. Transition risk affects the Bank through:
- Counterparty transition risk: a counterparty in a carbon-intensive sector faces stranded assets, higher operating costs, or regulatory penalties from the carbon transition. This affects their creditworthiness and the value of financial instruments they have issued.
- Investment portfolio transition risk: the Bank's HQLA portfolio (SA Government Bonds) has minimal transition risk; SAGBs are sovereign instruments and not carbon-exposed. Transition risk in the investment portfolio is assessed as low.
- Market risk from transition: repricing of climate-exposed assets in financial markets may affect the mark-to-market value of the Bank's trading book positions (e.g., JSE-listed equities in carbon-intensive sectors).

### 2.3 Liability Risk

Liability risk arises from litigation or regulatory action against parties that have contributed to climate change or failed to manage or disclose climate risks appropriately. For the Bank, liability risk is primarily a governance risk: failure to implement TCFD-aligned governance and disclosures as required by the PA creates regulatory risk.

---

## 3. TCFD Disclosure Alignment

**Owner:** Helena (Chief Risk Officer, governance) + Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim) approves TCFD disclosure in AFS · **Cadence:** Annual TCFD disclosure in AFS · **Citation:** TCFD recommendations (June 2017); PA Guidance Note 5 of 2022

The Bank's TCFD disclosure is structured across four pillars:

### 3.1 Governance

The Board (CEO interim) has oversight of climate-related risks and opportunities. Helena reports to the CEO on climate risk at least annually. The annual climate risk report (§7) is the primary governance document. Climate risk is a standing agenda item on the ALCO agenda (as a cross-cutting risk category) and is covered in the annual ICAAP submission.

### 3.2 Strategy

The Bank's strategy acknowledges climate risk as a material factor that may affect the Bank's business model and financial performance over the medium and long term. The Bank's institutional trading mandate (JSE bonds/equities + OTC IRD) limits direct climate-exposed credit origination. The NGFS scenario analysis (§4) informs the Board's view of potential climate-related strategic risks.

### 3.3 Risk Management

Climate risk identification, assessment, and management processes are described in this policy. Climate risk is integrated into the credit origination assessment (§5), ICAAP (§4), and stress testing (§4).

### 3.4 Metrics and Targets

The Bank tracks the following climate metrics and discloses them in the annual TCFD section of the AFS:
1. **Financed emissions baseline** (§6) — absolute CO2e and CO2e intensity per unit of credit-bearing exposure.
2. **Transition risk exposure concentration** — percentage of total credit-bearing exposures classified as carbon-intensive (Scope 1 emissions > threshold, per TCFD counterparty taxonomy).
3. **Physical risk exposure** — percentage of credit-bearing exposures to counterparties with assets in high physical risk geographies (SA coastal zones, water-stressed regions).
4. **HQLA portfolio climate footprint** — estimated financed emissions from the HQLA bond portfolio (SA Government Bonds carry sovereign-level emissions attribution).

Climate targets for the Bank are deferred to the post-commencement operating period when the balance sheet is populated; build-phase targets are limited to governance completeness (TCFD framework in place by commencement of trading, annual climate risk report produced annually).

---

## 4. Climate Scenario Analysis

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim) approves ICAAP stress scenario set including climate scenarios · **Cadence:** Annual as part of ICAAP; ad hoc when material new NGFS scenarios are published · **Citation:** NGFS scenarios; PA Guidance Note 5 of 2022; BCBS Principles for SREP (climate scenario integration)

### NGFS Scenario Set

The Bank uses the three primary NGFS scenario families for climate scenario analysis:

| Scenario | Description | Key transmission channels |
|---|---|---|
| Orderly (e.g., Net Zero 2050) | Early, gradual policy action to limit warming to 1.5°C | Transition risk moderate; physical risk low; policy carbon price rises gradually |
| Disorderly (e.g., Delayed Transition) | Late, abrupt policy action; higher transition risk | Transition risk high from sudden policy shock; physical risk moderate |
| Hot-house world (e.g., Current Policies) | No additional policy action; physical risk dominates | Physical risk high from 3°C+ warming; transition risk low |

Rohan runs the NGFS scenarios through the Bank's portfolio using the following transmission channels:
1. **Credit risk:** counterparty PD and LGD adjustments based on sector-level carbon price sensitivities and physical risk exposure.
2. **Market risk:** asset price shock to JSE-listed equities in carbon-intensive sectors under each scenario.
3. **Liquidity risk:** fire-sale impact on HQLA if climate-related sovereign risk repricing occurs.

Scenario analysis results are included in the annual ICAAP submission and presented to the CEO in the annual climate risk report. A `ClimateScenarioAnalysisCompleted { scenarioSet, analysisDate, keyFindings[], icaapRef }` event is the canonical record.

---

## 5. Climate Risk in Credit Origination

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Helena approves the climate risk gate criteria · **Cadence:** Per credit origination request (at commencement of trading) · **Citation:** PA Guidance Note 5 of 2022; TCFD; `Policies/credit-risk-policy-v1.md`

At commencement of trading, the credit origination assessment (per `Policies/credit-risk-policy-v1.md`) includes a climate risk assessment gate:

1. **Sector classification:** The counterparty's primary sector is classified using the TCFD sector taxonomy (carbon-intensive: energy, mining, utilities; carbon-transitioning: transport, materials; low-carbon: financial services, tech).
2. **Transition risk score:** For counterparties in carbon-intensive or carbon-transitioning sectors, Rohan computes a transition risk score based on the counterparty's Scope 1 + Scope 2 emissions intensity (if publicly disclosed), their exposure to regulatory carbon price risk, and the stranded asset risk in their asset base.
3. **Physical risk flag:** Counterparties with significant physical assets in climate-vulnerable SA geographies (coastal flood zones, water-stressed regions per CSIR maps) are flagged for physical risk.
4. **Origination gate decision:** The credit origination request for a counterparty with high transition or physical risk scores is referred to Helena for a climate risk overlay assessment before approval. No automatic rejection; the climate risk is an input to the credit decision, not a standalone veto.

A `ClimateRiskOriginationAssessmentCompleted { counterpartyId, transitionRiskScore, physicalRiskFlag, sectorClass, gateOutcome }` event is the canonical record of each origination gate assessment.

---

## 6. Financed Emissions Baseline

**Owner:** Helena (Chief Risk Officer, governance) + Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim) approves baseline methodology · **Cadence:** Annual baseline calculation; updated at each AFS · **Citation:** PCAF (Partnership for Carbon Accounting Financials) standard — financed emissions methodology; TCFD (June 2017) — Scope 3 Category 15 (investments)

The Bank tracks financed emissions as its contribution to climate impact through its investment and credit activities. The methodology follows the PCAF standard for financed emissions:

```
Financed Emissions (tCO2e) = Σ [ (Bank Exposure / Total Enterprise Value) × Counterparty Emissions ]
```

For the build phase (no balance sheet), the financed emissions baseline is zero. At commencement of trading, Rohan builds the financed emissions calculator consuming:
- Position data from the event log (credit-bearing exposures per counterparty).
- Counterparty emissions data (from public disclosures, CDP, MSCI ESG, or estimated using SA-sector average emissions intensities where direct data is unavailable).
- HQLA portfolio: SA Government Bond financed emissions are attributed at the sovereign-level Scope 1+2 emissions intensity, per the PCAF sovereign methodology.

The annual financed emissions calculation is filed as a `FinancedEmissionsBaselineCalculated { year, totalTco2e, byScope, byAssetClass, methodology, dataQualityScore }` event. Camille includes the summary in the AFS TCFD disclosure section.

---

## 7. Annual Climate Risk Report

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** CEO · **Cadence:** Annual; filed within 3 months of year-end · **Citation:** PA Guidance Note 5 of 2022 — supervisory expectation for climate risk reporting

The annual climate risk report covers:
1. **Climate risk governance:** TCFD four-pillar status update.
2. **Materiality assessment:** current assessment of physical, transition, and liability risk materiality to the Bank.
3. **NGFS scenario analysis results:** key findings from the annual climate scenario analysis.
4. **Metrics and targets:** financed emissions, transition risk concentration, physical risk exposure.
5. **Credit origination climate gate:** statistics on the year's origination assessments, including any counterparties with high transition or physical risk scores.
6. **PA engagement:** summary of any climate risk supervisory engagement with the PA during the year.
7. **Planned enhancements:** the following year's climate risk framework improvements.

The report is filed as a `RecordFiled` event (`document kind: "climate-risk-report"`) and presented to the CEO. The PA supervisor receives a copy as part of the Bank's regular supervisory correspondence.

---

## 8. Substrate Dependencies and Gaps

- **Climate scenario analysis engine (Rohan).** NGFS scenario runner applying climate transmission channels to the Bank's portfolio. Currently in build phase; required before the first ICAAP submission.
- **Financed emissions calculator (Rohan + Camille).** PCAF-methodology emissions calculation consuming counterparty emissions data. Currently in build phase; first calculation after the first year-end with a material balance sheet.
- **Counterparty emissions data sourcing.** Public emissions data for SA-listed counterparties is limited; Rohan builds an estimated emissions model using SA sector average intensities as a fallback.

---

## 9. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering) | Initial policy authored. Seven sections: (1) Overarching — TCFD four pillars, NGFS scenarios, cross-cutting risk driver, events-first; (2) Climate Risk Taxonomy — physical risk (acute/chronic), transition risk (counterparty/portfolio/market), liability risk; (3) TCFD Disclosure — governance/strategy/risk management/metrics four pillars; (4) Climate Scenario Analysis — orderly/disorderly/hot-house NGFS scenarios, transmission channels, ICAAP integration; (5) Credit Origination Gate — sector classification, transition risk score, physical risk flag; (6) Financed Emissions Baseline — PCAF methodology, sovereign portfolio treatment; (7) Annual Climate Risk Report — PA Guidance Note 5 required sections. CORPORATE-BIND. |
