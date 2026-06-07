---
policy-id: concentration-risk-policy
title: Concentration Risk Policy v1
version: "1"
status: IN FORCE
owner: Helena (Chief Risk Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - Banks Act 94 of 1990 s.73B–73C (large exposures)
  - Regulations Relating to Banks reg.38 (large exposures limit — 25% of qualifying capital)
  - BCBS large exposures framework (April 2014)
  - SARB Guidance Note on connected exposures
  - Basel III capital framework (June 2011; as revised)
author: Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering)
date: 2026-05-22
summary: Concentration Risk Policy covering single-counterparty limit (25% regulatory cap; 20% management trigger), connected-party aggregation, sector concentration, product concentration, geographic concentration, concentration reporting to ALCO, near-breach escalation, and reg.38 notification thresholds. COMMENCEMENT-BIND.
decision-required: false
riskTaxonomy:
  - RT-CR
  - RT-CCR
---

# Concentration Risk Policy v1

> **Authors.** Helena (Chief Risk Officer, governance) — lead; Rohan (Market risk quantitative engineer, engineering) — co-author.
> **Status.** COMMENCEMENT-BIND. Concentration risk management binds from the first asset originated; the large exposure regulatory limits under reg.38 are statutory obligations from the date of banking licence registration.
> **Identity discipline.** Every agent reference pairs name + position on first mention.

---

## 1. Concentration Risk Policy — Overarching

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) for concentration limits; ALCO for monitoring · **Cadence:** Annual policy review; monthly reporting to ALCO; triggered on any large exposure near-breach · **Citation:** Banks Act 94 of 1990 s.73B–73C + Regulations Relating to Banks reg.38 + BCBS large exposures framework (April 2014)

### Purpose

This policy governs how Hoz Bank Limited identifies, measures, monitors, and manages concentration risk — the risk that the Bank's exposures are concentrated in a single counterparty, connected group of counterparties, sector, product type, or geography, such that a stress event in that concentrated area causes disproportionate losses. It ensures compliance with the statutory large exposure limits under reg.38 and the Banks Act, and establishes internal management triggers that provide early warning before regulatory limits are breached.

The concentration risk framework applies to all credit-bearing exposures: funded loans and advances, OTC derivative counterparty credit risk (CCR EAD per `Policies/counterparty-credit-risk-policy-v1.md`), debt securities held in the banking book, equity exposures, and off-balance sheet exposures (committed facilities, letters of credit). It does not duplicate the market risk limits in `Policies/market-risk-policy-v1.md`, which govern position-level market risk exposures; however, CCR EAD is included in the concentration calculation as it represents a credit-bearing exposure.

### Principles

- **Regulatory hard cap is non-negotiable.** The large exposure limit of 25% of the Bank's qualifying capital (per reg.38 and the BCBS large exposures framework) is an absolute regulatory cap. No exception to this cap is possible; it is not subject to Board or CEO override. Internal limits are calibrated below this cap to provide a management warning buffer.
- **Connected parties are aggregated.** Connected counterparties (entities that are economically interdependent or under common control per the SARB Guidance Note on connected exposures) are treated as a single counterparty for concentration purposes. The net exposure to a connected group must not exceed the single-counterparty 25% cap. Imani (Legal-as-code engineer, engineering) maintains the connected-party mapping; Helena reviews the mappings quarterly.
- **Sector and product concentrations are active management levers.** In addition to single-counterparty limits, the Bank manages concentration at the sector and product level. High sector concentration reduces portfolio diversification and amplifies losses in sector-wide stress events.
- **Events-first concentration management.** Every large exposure near-breach and every reg.38 regulatory notification is a typed event in the event log. Concentration metrics are queries over exposure events; no manual spreadsheet is the canonical concentration record.
- **Transparency to ALCO.** The concentration risk report is a standing ALCO agenda item. Helena presents the full large exposure register, sector concentration heatmap, and product concentration metrics to ALCO monthly.

### Roles

Helena (Chief Risk Officer, governance) is the policy owner. She is responsible for: maintaining the concentration limit framework; reviewing the large exposure register; approving or declining large exposure requests approaching the hard regulatory cap; notifying the SARB of large exposures per Reg 24(6)–(8) read with Directive 3 of 2022. Rohan (Market risk quantitative engineer, engineering — reports to Helena) builds and operates the concentration monitoring system: the large exposure aggregation engine, the connected-party algorithm, and the concentration reporting dashboard. Imani (Legal-as-code engineer, engineering) maintains the legal entity hierarchy and connected-party mappings. Camille (Chief Financial Officer, governance) integrates the large exposure register into the large-exposures regulatory return (BA 200-series credit-risk return family — NOT BA 330, which is the IRRBB repricing-gap return; corrected per D-BA-330-REATTRIBUTION-IRRBB). Owen (Company Secretary, governance) manages the SARB notification filings for large exposures.

---

## 2. Single-Counterparty Exposure Limits

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Helena and CEO for any exposure approaching the 20% management trigger; Board (CEO interim) for the limit framework · **Cadence:** Daily monitoring by Rohan; monthly reporting to ALCO · **Citation:** Regulations Relating to Banks reg.38 (25% of qualifying capital hard cap) + BCBS large exposures framework (April 2014) + Banks Act 94 of 1990 s.73B–73C

### 2.1 Exposure Definitions

For the purpose of this policy, "exposure" to a counterparty means the sum of all credit-bearing claims on that counterparty, including:
- Funded credit exposures (loans, advances, bonds held in the banking book).
- OTC derivative CCR EAD (per `Policies/counterparty-credit-risk-policy-v1.md` §2) — the full EAD before any netting benefit, unless a legally enforceable ISDA netting agreement is in place.
- Equity exposures (fair-value of equity holdings).
- Off-balance sheet commitments (committed facilities — drawn exposure + undrawn portion at the applicable credit conversion factor per reg.32).
- Guarantees and letters of credit (the nominal amount of the guarantee obligation).

All exposures to a counterparty's connected parties (§3) are aggregated into a single group exposure.

### 2.2 Limit Structure

| Limit tier | Threshold | Consequence |
|---|---|---|
| Internal management trigger | 20% of qualifying capital | Helena notified; ALCO discussion at next meeting; no new exposure increase without Helena's approval |
| Regulatory hard cap | 25% of qualifying capital | Absolute regulatory maximum under reg.38; any exposure at or above this level is a regulatory breach reportable to the SARB under reg.38 |
| Near-breach monitoring trigger | 18% of qualifying capital | Early warning; Rohan flags in daily concentration report; Helena reviews within 2 business days |

A `LargeExposureNearBreachFlagged { counterpartyId, currentExposure, qualifyingCapital, pct, trigger }` event is emitted at each threshold crossing. A `LargeExposureRegulatoryBreachDetected { counterpartyId, exposure, regulatoryLimit, excessAmount }` event triggers immediate notification protocols (§6).

---

## 3. Connected-Party Exposure Aggregation

**Owner:** Helena (Chief Risk Officer, governance) · **Imani (Legal-as-code engineer, engineering)** — legal entity hierarchy · **Approval:** Helena approves connected-party classifications; ALCO ratifies quarterly · **Cadence:** Connected-party register reviewed quarterly; updated on any new counterparty onboarding or corporate event · **Citation:** SARB Guidance Note on connected exposures + Banks Act 94 of 1990 s.73B (definition of connected persons) + BCBS large exposures framework (April 2014) — groups of connected counterparties

### Definition of Connected Parties

Counterparties are treated as a connected group for concentration purposes where:
1. **Control:** One entity holds a majority of voting rights in another, or has the right to appoint a majority of the board of another, or can exercise dominant influence over another.
2. **Economic interdependence:** One entity's financial soundness is materially dependent on another's — e.g., a subsidiary whose primary revenue stream is from the parent, or two entities that share the same key funding source and whose combined failure would be likely if the funding source were stressed.
3. **Common ownership:** Two or more entities are owned by the same ultimate beneficial owner above a 20% threshold.

Imani maintains the connected-party mapping as a typed registry (`ConnectedPartyGroupRegistered { groupId, members[], basis, effectiveDate }`). Every new counterparty onboarded by Niko (Lifecycle & onboarding engineer, engineering) is cross-checked against the connected-party register before the first exposure is originated.

---

## 4. Sector Concentration Limits

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** ALCO · **Cadence:** Monthly sector concentration report at ALCO · **Citation:** BCBS large exposures framework (April 2014) — portfolio concentration add-ons

Sector concentration is monitored using the following sector classifications and limits, expressed as a maximum percentage of total credit-bearing exposures:

| Sector | Limit (% of total credit-bearing exposures) |
|---|---|
| South African Financial Institutions (banks, insurers, asset managers) | 60% (inherent in the Bank's institutional mandate — accepted with ALCO oversight) |
| SA Sovereign and parastatal | 30% |
| Listed SA corporates | 20% |
| Non-SA counterparties | 15% (also subject to Excon and country risk limits) |
| Single sector sub-concentration (e.g., SA banks only within the FI sector) | 35% |

These limits are calibrated to the Bank's institutional trading mandate (primary franchise is FI counterparties for OTC IRD). Sector concentration limits are reviewed by ALCO annually. Breaches trigger an ALCO review and a rebalancing plan within 10 business days. A `SectorConcentrationLimitBreached { sector, currentPct, limit }` event is the canonical record.

---

## 5. Product Concentration

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** ALCO · **Cadence:** Monthly product concentration report at ALCO · **Citation:** BCBS large exposures framework (April 2014); `Policies/counterparty-credit-risk-policy-v1.md`

Product concentration is monitored to ensure the Bank's credit-bearing exposures are not unduly concentrated in a single instrument type:

| Product type | Limit (% of total credit-bearing exposures) |
|---|---|
| OTC IRD (IRS, cross-currency swaps) | 70% (primary franchise product — accepted with ALCO oversight) |
| OTC FX derivatives | 20% |
| JSE bond holdings (banking book) | 40% |
| JSE equity positions (trading book — CCR is minimal; market risk governs) | Per `Policies/market-risk-policy-v1.md` RAS lines |
| Any single OTC derivative asset class not in the primary franchise | 10% |

Product concentration limits are reviewed at the New Product Approval gate for any new product type; the NPA must include a concentration impact assessment (per `Policies/new-product-approval-policy-v1.md`).

---

## 6. Geographic Concentration

**Owner:** Helena (Chief Risk Officer, governance) + Owen (Company Secretary, governance) for Excon compliance · **Approval:** ALCO for geographic concentration targets; Excon authorities for cross-border exposure approvals · **Cadence:** Monthly geographic concentration report at ALCO · **Citation:** Exchange Control Regulations (Currency and Exchanges Act 9 of 1933) + `Policies/country-sovereign-risk-policy-v1.md`

Geographic concentration is managed as part of the country risk framework (`Policies/country-sovereign-risk-policy-v1.md`). Key concentration constraints:

- **Domestic (SA) concentration target:** ≥ 85% of total credit-bearing exposures are SA-domiciled counterparties and SA-domiciled instruments.
- **Non-SA exposure hard cap:** ≤ 15% of total credit-bearing exposures, subject to Excon limits and country risk limits in `Policies/country-sovereign-risk-policy-v1.md`.
- **Single non-SA country hard cap:** ≤ 5% of total credit-bearing exposures.

Geographic concentration is reported to ALCO monthly; any breach of the non-SA caps triggers an ALCO review and Helena's escalation to the CEO.

---

## 7. Concentration Reporting to ALCO

**Owner:** Helena (Chief Risk Officer, governance) · **Cadence:** Monthly ALCO agenda item; quarterly Board report · **Citation:** Regulations Relating to Banks reg.38 + Banks Act 94 of 1990 s.73B–73C

### Monthly ALCO Report

Rohan produces the monthly concentration risk report as a standard ALCO pack section, including:
1. Large exposure register — all counterparty group exposures > 10% of qualifying capital with utilisation vs. limits.
2. Sector concentration heatmap — current sector percentages vs. limits.
3. Product concentration breakdown — current product exposure percentages vs. limits.
4. Geographic concentration — SA vs. non-SA split.
5. Near-breach flags — any counterparty approaching the 18% early warning trigger.
6. Connected-party register changes since prior ALCO.

The concentration report is a `ConcentrationRiskReportProduced { period, topExposures[], sectorBreakdown, nearBreaches[], alcoMeetingRef }` event.

### Reg.38 SARB Notification

The Bank must notify the SARB when any single counterparty exposure exceeds 10% of qualifying capital (reg.38 notification threshold) `[citation: TBC — precise reg.38 sub-clause for reporting threshold; Imani confirms]`. The notification is filed by Owen within the prescribed timeframe. A `LargeExposureSarbNotified { counterpartyId, exposureAmount, qualifyingCapital, pct, notificationDate }` event is the canonical record.

---

## 8. Substrate Dependencies and Gaps

- **Concentration aggregation engine (Rohan).** Automated daily aggregation of all credit-bearing exposures per counterparty group (including CCR EAD from the SA-CCR engine, funded credit exposures, off-balance sheet). Discharge exit signal: `LargeExposureRegisterUpdated { date, topExposures[] }` event.
- **Connected-party algorithm (Imani + Rohan).** Legal entity hierarchy + economic interdependence model producing connected-party group assignments. Currently manual; substrate build formalises the classification.
- **Large-exposures regulatory return integration (Camille + Rohan).** Large exposure data fed into the SARB large-exposures return (BA 200-series credit-risk return family — NOT BA 330, which is the IRRBB repricing-gap return; corrected per D-BA-330-REATTRIBUTION-IRRBB); currently in build phase.

---

## 9. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering) | Initial policy authored. Seven sections: (1) Overarching — regulatory hard cap, connected-party aggregation, sector/product concentration, events-first, ALCO transparency; (2) Single-Counterparty Limits — exposure definition, limit table (18%/20%/25%); (3) Connected-Party Aggregation — control, economic interdependence, common ownership criteria, Imani registry; (4) Sector Concentration — FI/sovereign/corporate/non-SA limits table; (5) Product Concentration — OTC IRD/FX/bond limits; (6) Geographic Concentration — 85% domestic target, 15%/5% non-SA caps; (7) Concentration Reporting — monthly ALCO pack, reg.38 SARB notification. COMMENCEMENT-BIND. |
