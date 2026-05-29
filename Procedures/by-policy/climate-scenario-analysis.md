---
policy-parent: Climate-Related Risk Policy (planned) · Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md §B8
last-reviewed: 2026-05-15
procedureId: PROC-RISK-CSA-01
title: Climate scenario analysis cycle
author: Helena (Chief Risk Officer, governance) · Devon (Chief Operating Officer, governance)
date: 2026-05-15
owner: Helena (Chief Risk Officer, governance) · Devon (Chief Operating Officer, governance)
status: POPULATED
policy-cited: Climate-Related Risk Policy (planned) · Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md §B8
system-capability: "@platform/risk/climate-scenario-engine (PLANNED)"
---

# Procedure — Climate scenario analysis cycle

**Procedure ID:** PROC-RISK-CSA-01
**Owner:** Helena (Chief Risk Officer, governance) · Devon (Chief Operating Officer, governance)
**Approval:** BRC (risk appetite integration); ALCO (market/credit risk overlay); CEO (TCFD disclosure sign-off)
**Cadence:** Annual (full scenario analysis + TCFD disclosure); quarterly (monitoring update); ad-hoc (material climate event)
**Version:** v0.1 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

- Climate-Related Risk Policy (planned; to be authored by Helena with Devon; pending at licence-day pre-go-live readiness gate).
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` §B8 — Climate risk appetite: physical risk monitoring; transition risk monitoring; TCFD alignment.
- PA Guidance Note 3 of 2022 — Climate Risk Management for banks and insurers: scenario analysis requirements, TCFD alignment, ILAAP/ICAAP climate integration.
- NGFS Climate Scenarios v4 (Network for Greening the Financial System) — the four standard scenarios: Orderly Transition, Disorderly Transition, Hot House World, Too Little Too Late.
- TCFD Recommendations (2017) and 2021 supplemental guidance — four pillars: Governance, Strategy, Risk Management, Metrics & Targets.

The obligation chain:
```
Regulation (PA Guidance Note 3/2022 / TCFD / NGFS / Banks Act Reg 39 ICAAP/ILAAP)
  → Climate-Related Risk Policy
    → PROC-RISK-CSA-01 (this procedure)
      → @platform/risk/climate-scenario-engine (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-11` (Banks Act s.73 / Reg 39 — risk governance) | Bank must identify, measure, monitor, and control all material risks; climate risk is an emerging category that falls within the risk management framework under Reg 39. |
| `ORG-PR-23` (Reg 39 — ICAAP/ILAAP) | Climate risk must be addressed in the ICAAP (physical and transition risk impacts on capital) and ILAAP (liquidity impacts); PA SREP reviews climate risk integration. |
| PA Guidance Note 3 of 2022 | Scenario analysis is a supervisory expectation; banks must run at least two climate scenarios; TCFD-aligned disclosure is required; PA may include climate risk in SREP. |
| TCFD Recommendations | Voluntary standard adopted as a supervisory expectation by the PA; four-pillar structure (Governance, Strategy, Risk Management, Metrics & Targets); forward-looking scenario analysis is a cornerstone of the Strategy pillar. |
| `ORG-PS-02` (Sustainable Finance) | SARB's commitment to sustainable finance principles creates a supervisory expectation for climate risk integration in banking sector. |

## 3. Purpose

Assess the bank's exposure to climate-related financial risks — physical risks (acute and chronic) and transition risks (policy, technology, market, reputational) — through structured scenario analysis. The procedure:

1. Runs the bank's counterparty and asset portfolio through the four NGFS climate scenarios to assess credit, market, and operational risk impacts.
2. Produces quantitative risk estimates (credit loss uplift, market value impact, operational cost uplift) for each scenario and time horizon (2030, 2040, 2050).
3. Integrates climate risk findings into the ICAAP capital adequacy assessment and ILAAP liquidity stress testing.
4. Produces the annual TCFD-aligned climate disclosure for inclusion in the Annual Report / CEO Sign-off.
5. Feeds BRC with climate risk appetite monitoring metrics.

## 4. Trigger

**Annual full cycle:**
- Annual scheduler (Q2 — aligned to ICAAP/ILAAP cycle): `ClimateScenarioAnalysisCycleStarted { year }` — Helena leads; Devon co-owns operational resilience dimension.

**Quarterly monitoring update:**
- Quarterly scheduler: `ClimateMonitoringUpdateStarted { period }` — mid-cycle monitoring; update of key climate metrics; early-warning flag if thresholds approached.

**Ad-hoc — material climate event:**
- `ExternalClimateEventFlagged { event_id, event_type: physical | transition, severity }` — PA regulatory communication, significant climate event, or major policy announcement triggers an unscheduled analysis.

**TCFD disclosure:**
- Annual: TCFD draft disclosure circulated to CEO and Board for sign-off, timed to the annual reporting cycle.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Scenario calibration.** Confirm the four NGFS scenario pathways for the analysis year; update scenario parameters (carbon price trajectories, physical hazard intensities, sector transition paths) from the latest NGFS release | `agent` (Helena + Devon research) | `@platform/risk/climate-scenario-engine` (`PLANNED`) | NGFS releases updated scenario sets annually; Helena is responsible for confirming the applicable version and any PA-specific adjustments. |
| 2 | **Counterparty and portfolio mapping.** Map the bank's counterparty portfolio (institutional clients, sovereign/corporate bond holdings) to NACE sector codes and geographic climate-hazard zones; produce the climate-exposure matrix | `system` | `@platform/risk/climate-scenario-engine` (`PLANNED`) + `@platform/data/counterparty-registry` | For the bank's current institutional-markets-only model, the primary exposure is via OTC derivative counterparties and fixed-income holdings; credit exposure at default (EAD) and replacement cost are the primary risk quantities. |
| 3 | Emit `ClimateExposureMappingCompleted { year, counterparty_count, sector_distribution, geographic_distribution }` | `system` | `@platform/event-store` ✓ | This is the input dataset for the scenario runs. |
| 4 | **Scenario run — Orderly Transition.** Apply the Orderly Transition (Net Zero 2050) scenario: phased carbon price increases, smooth technology substitution, managed policy transition; estimate credit loss uplift, market value impact, and operational cost changes per sector | `system` (Helena's scenario engine) | `@platform/risk/climate-scenario-engine` (`PLANNED`) | Time horizons: 2030 (short), 2040 (medium), 2050 (long). Credit loss uplift = PD/LGD uplift for carbon-intensive counterparties under the scenario. |
| 5 | **Scenario run — Disorderly Transition.** Apply the Disorderly Transition (Divergent Net Zero / Below 2°C) scenario: abrupt carbon policy changes, stranded asset risk, higher near-term transition costs | `system` | `@platform/risk/climate-scenario-engine` (`PLANNED`) | The disorderly scenario typically generates higher transition risk losses than orderly; stranded-asset haircuts are the primary driver for institutional counterparties in carbon-intensive sectors. |
| 6 | **Scenario run — Hot House World.** Apply the Hot House World (Current Policies / NDCs) scenario: limited transition action, severe physical risk by 2050; assess chronic physical risk (rising temperatures, sea-level rise) and acute physical risk (extreme weather events) impacts on counterparty creditworthiness | `system` | `@platform/risk/climate-scenario-engine` (`PLANNED`) | Physical risk predominates in this scenario for long-horizon (2050) analysis. Acute event risk (flooding, storms) impacts operational resilience and is co-owned with Devon. |
| 7 | **Scenario run — Too Little Too Late.** Apply the Too Little Too Late scenario: delayed policy action followed by abrupt transition; combines elevated physical risk (near-term inaction) with severe transition risk (late policy shock) | `system` | `@platform/risk/climate-scenario-engine` (`PLANNED`) | This scenario typically produces the worst-case combination of both risk types; most adverse scenario for ICAAP capital stress. |
| 8 | For each scenario, emit `ClimateScenarioRunCompleted { year, scenario, horizon, credit_loss_uplift_bps, market_value_impact_pct, operational_cost_uplift_pct, key_sector_drivers }` | `system` | `@platform/event-store` ✓ | Four events per cycle (one per scenario); forms the canonical annual dataset. |
| 9 | **Materiality assessment.** Helena assesses which scenarios and time horizons are material for the bank's current portfolio and business model; identifies sectors and counterparties of elevated concern; flags any RAS threshold approach | `agent` (Helena) | `@platform/reporting/climate-dashboard` (`PLANNED`) | Materiality threshold: credit loss uplift > RAS B8 ceiling, or market value impact > BRC-approved sensitivity limit; BRC notification required. |
| 10 | **ICAAP integration.** Feed the worst-case credit loss uplift and market value impact into the ICAAP severe-but-plausible scenario suite; Camille and Helena co-assess Pillar 2 capital add-on for climate risk | `agent` (Helena + Camille) | `@platform/reporting/icaap-chapters` (`PLANNED`) | Climate risk Pillar 2 is emerging practice; the PA has not yet prescribed a formal add-on methodology. Helena uses a top-down haircut approach pending PA guidance; methodology is disclosed in the TCFD report. |
| 11 | **ILAAP integration.** Feed physical-risk scenarios (particularly acute events and operational disruption) into the ILAAP stress suite; Eitan assesses liquidity implications of a severe acute physical event that disrupts the correspondent bank channel | `agent` (Helena + Eitan) | `@platform/reporting/ilaap-chapters` (`PLANNED`) | Physical risk → operational disruption → liquidity stress is the key ILAAP pathway for a markets-only bank with limited physical asset exposure. |
| 12 | **TCFD disclosure drafting.** Helena drafts the four-pillar TCFD disclosure; Devon reviews the operational resilience section; Camille reviews metrics and targets; CEO reviews and signs; included in Annual Report | `agent` (Helena) + `human` (CEO — sign) | `@platform/reporting/tcfd-report` (`PLANNED`) | TCFD disclosure is the external-facing artefact; it references the scenario analysis results (`ClimateScenarioRunCompleted` event IDs as data source) and the NGFS scenario versions used. |

## 6. Reconciliation

- **Events produced:**
  - `ClimateScenarioAnalysisCycleStarted { year }` — annual
  - `ClimateExposureMappingCompleted { year, sector_distribution }` — annual
  - `ClimateScenarioRunCompleted { year, scenario, horizon, credit_loss_uplift_bps }` — four per annual cycle
  - `ClimateMonitoringUpdateCompleted { period, key_metrics_delta }` — quarterly
  - `ClimateMaterialityFlagged { year, scenario, threshold_breached }` — on materiality trigger
- **Reconciliation checks:**
  - Every year has four `ClimateScenarioRunCompleted` events (one per NGFS scenario) — Vera annual invariant.
  - Every `ClimateMaterialityFlagged` traces to either a BRC notification event or a documented Helena assessment that the threshold approach is transient.
  - TCFD disclosure references the correct `ClimateScenarioRunCompleted` event IDs for the relevant year (Vera citation check).
  - ICAAP severe-but-plausible scenario suite includes at least one climate-pathway scenario (Vera cross-domain check against `stress-test-cycle.md`).
- **Failure mode:** climate scenario engine unavailable for the annual cycle → Helena falls back to a manual top-down approach using prior-year results + NGFS narrative update; emits `ClimateScenarioManual { year, reason, validated_by: helena }`. Manual results must be validated by Devon before BRC presentation.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| All `Climate*` events | Event log | Permanent (P1) | Restricted |
| NGFS scenario parameter sets (annual) | Document store (BLAKE3-addressed) | 7 years | Internal |
| Climate-exposure matrix (counterparty × sector × geography) | Document store | 7 years | Restricted |
| Scenario run workbooks (methodology evidence) | Document store | 7 years | Restricted |
| ICAAP climate section | Document store | Permanent (ICAAP retention) | Confidential |
| ILAAP climate section | Document store | Permanent (ILAAP retention) | Confidential |
| TCFD disclosure (annual) | Document store + Annual Report | 7 years | Public (after publication) |
| BRC climate risk report | Governance record + document store | 7 years | Confidential |

## 8. Manual steps

- **Step 1 — Scenario calibration:** Until the climate scenario engine is built, Helena manually downloads NGFS scenario data and adapts parameters to the SA context; this is a named substrate gap (engine PLANNED).
- **Step 2 — Portfolio mapping:** Sector and geographic mapping of counterparties requires Helena's interpretation of NACE codes and SA climate-hazard geography; partially automatable but expert overlay required.
- **Step 9 — Materiality assessment:** Helena's judgement on which sectors and counterparties carry elevated climate risk requires CRO expertise; not fully automatable.
- **Step 12 — TCFD disclosure:** CEO sign-off on the TCFD disclosure is a governance act; CEO review of the four-pillar narrative is irreducibly human; cannot be automated.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Annual scenario analysis not completed | Vera annual invariant: missing `ClimateScenarioRunCompleted` events for the year | Helena + CEO; PA notification risk if SREP climate component requested; BRC informed |
| Climate risk metrics exceed RAS B8 threshold | `ClimateMaterialityFlagged { threshold_breached: true }` | Helena + BRC within 5 business days; RAS review if thresholds persistently approached |
| PA requests climate scenario results under SREP | PA supervisory query received | Helena + Owen (CoSec); response within PA-specified timeline; Camden (once Head of Regulatory Affairs) to coordinate |
| TCFD disclosure not ready for Annual Report publication | Helena's TCFD schedule | Helena + Camille + CEO; escalate; PA / investor expectation risk managed by Owen |
| Significant external climate event (e.g. SA severe drought, major flood event, carbon-tax step-change) | `ExternalClimateEventFlagged` | Ad-hoc analysis cycle started within 10 business days; BRC briefed by Helena |
| Climate scenario engine fails during annual run | System error event | Atlas + Devon; fallback to manual approach; Helena notified; BRC timeline re-assessed |

## 10. Related procedures

- [`stress-test-cycle.md`](stress-test-cycle.md) (PROC-RISK-ST-01) — climate pathway scenarios are integrated as one scenario type in the annual stress-test suite; severe-but-plausible physical and transition scenarios co-developed with the climate analysis cycle.
- [`capital-ratio-monitoring.md`](capital-ratio-monitoring.md) — ICAAP climate Pillar 2 feeds the capital adequacy framework; capital ratio monitoring is the upstream consumer of the climate risk capital add-on.
- [`rcsa-cycle.md`](rcsa-cycle.md) (PROC-RISK-RCSA-01) — physical risk to operational processes (acute weather events, chronic temperature changes affecting infrastructure) are captured in the RCSA as operational risk sub-categories; climate risk feeds the RCSA operational risk heat map.
- [`irrbb-measurement.md`](irrbb-measurement.md) (PROC-RISK-IRRBB-01) — transition risk (e.g. carbon-tax-driven interest rate changes, central bank green-finance policy) creates banking-book interest rate risk; ALCO monitors the interaction.
- [`intraday-liquidity-funding.md`](intraday-liquidity-funding.md) (PROC-RISK-ILF-01) — acute physical events affecting the correspondent bank or market infrastructure create intraday liquidity stress; climate physical risk feeds the ILAAP intraday stress scenario.
- [`dr-test-execution.md`](dr-test-execution.md) (PROC-OR-DR-01) — physical risk impacts on technology infrastructure are tested in the DR programme; Devon ensures climate-event scenarios are included in DR test scope.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-15 | Helena + Devon | Initial draft — PLANNED → POPULATED; full 12-section procedure; four NGFS scenarios; TCFD four-pillar structure; ICAAP/ILAAP integration; PA Guidance Note 3/2022 alignment. |

## 12. Audit / assurance

- **Vera annual:** verify four `ClimateScenarioRunCompleted` events exist for the year; verify all `ClimateMaterialityFlagged` events have a disposition record; cross-domain check that ICAAP stress suite includes a climate scenario (per `stress-test-cycle.md` integration); verify TCFD disclosure references correct event IDs.
- **Vera quarterly:** monitoring update completeness check; flag if quarterly `ClimateMonitoringUpdateCompleted` event is missing.
- **Thandiwe (CAE, governance):** annual audit of the climate scenario analysis methodology; opinion on adequacy of NGFS scenario selection and materiality assessment; sample-test of credit loss uplift calculations against independent recalculation; report to AC.
- **PA SREP:** the PA reviews climate risk management as part of the SREP; TCFD disclosure and scenario results are the primary SREP artefacts; adverse findings (e.g. incomplete scenario coverage, materially inadequate Pillar 2 climate add-on) trigger a supervisory engagement managed by Helena and Camden.
- **CEO / Board:** TCFD disclosure sign-off is the annual governance act; CEO reviews the four-pillar narrative; Board AC reviews climate risk reporting as part of the annual assurance cycle.
