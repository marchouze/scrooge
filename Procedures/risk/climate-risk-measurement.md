---
procedureId: PROC-RISK-CR-01
title: Climate-risk measurement
author: Helena (Chief Risk Officer, governance)
date: 2026-05-19
owner: Helena (Chief Risk Officer, governance)
status: POPULATED
authority: D-RAS-CLIMATE-SCENARIO-FRAMEWORK
policy-cited: Policies/risk-management-policy-v1.md
regulation-cited: PA-GN1-2024
system-capability: prototype/platform/projections/climate-risk-projection.ts
---

# Procedure — Climate-Risk Measurement

**Procedure ID:** PROC-RISK-CR-01
**Owner:** Helena (Chief Risk Officer, governance)
**Approval:** Board Risk Committee (BRC)
**Cadence:** Quarterly scenario run; daily proxy VaR when market data is available
**Version:** v0.1 — 2026-05-19
**Status:** POPULATED
**Authority:** D-RAS-CLIMATE-SCENARIO-FRAMEWORK (CEO-approved)

---

## 1. Source policy

- `Policies/risk-management-policy-v1.md` — Risk Management Policy (primary)

The obligation chain is:

```
Regulation (Banks Act 94 of 1990; PA Guidance Note 1 of 2024)
  → Risk Appetite Statement (RAS §A2 — Climate risk)
    → D-RAS-CLIMATE-SCENARIO-FRAMEWORK (CEO-approved decision)
      → PROC-RISK-CR-01 (this procedure)
        → prototype/platform/projections/climate-risk-projection.ts
```

The RAS line `appetite:climate:guidance-note-1-2024` (RAS §A2) is the demand-side input.
This procedure is the supply-side response: it specifies *how* climate risk is measured so that
the appetite line moves from `unmeasured` to `measured`.

---

## 2. Source regulation

| ID | Instrument | Requirement |
|---|---|---|
| `PA-GN1-2024` | PA Guidance Note 1 of 2024 — Climate-Related Financial Disclosures | Banks must identify, measure, monitor, and disclose climate-related financial risks across physical and transition risk dimensions. Scenario analysis is the recommended methodology. |
| `BANKS-ACT-94-1990 §73` | Banks Act 94 of 1990 | Adequate risk management systems and controls commensurate with the nature and scale of operations. |
| `BCBS-CG-PRINCIPLE-6` | BCBS Corporate Governance Principles for Banks | Board-level responsibility for risk appetite and risk management framework; climate risk is within scope of credit, market, and operational risk. |

---

## 3. Purpose

Specify the methodology for measuring and monitoring climate-related financial risks during the
build phase and at commencement of trading, consistent with PA Guidance Note 1 of 2024.

The bank's RAS §A2 declares a governance posture for climate risk per PA GN 1 of 2024. This
procedure operationalises that posture by defining:

1. **What is measured** — physical risk and transition risk across the trading book and counterparty
   book, with build-phase proxies until the full portfolio exists.
2. **How it is measured** — three PA scenarios (Orderly, Disorderly, Hot house world), stress-loss
   computation, and a daily proxy climate VaR.
3. **What events are emitted** — `ClimateScenarioRun` (quarterly) and `ClimateExposureRevalued`
   (daily proxy, when market data is available).
4. **How the results feed governance** — Helena's risk-appetite-watch handler reads the latest
   `ClimateScenarioRun` events; worst-case stress loss / total exposure populates the RAS
   `appetite:climate:guidance-note-1-2024` line.

---

## 4. Trigger

| Trigger | Handler / Output |
|---|---|
| Quarterly (first business day of each quarter) | Helena (CRO) commissions a full `ClimateScenarioRun` across all three PA scenarios. |
| Daily (EOD, when trading book market data is available) | Rohan (Risk engineer) produces a `ClimateExposureRevalued` event with the proxy climate VaR. |
| Ad hoc (material portfolio change, new PA guidance, significant physical event) | Helena commissions an unscheduled `ClimateScenarioRun`. |

---

## 5. What is measured

### 5.1 Physical risk

Physical risk is the financial impact on the bank's exposures from acute and chronic climate hazards:

- **Acute physical events** — extreme weather (storms, floods, droughts) causing sudden asset
  impairment or counterparty default.
- **Chronic physical risk** — long-term shifts (rising sea levels, mean temperature change, water
  stress) that erode asset values or sector viability.

**Build-phase proxy for physical risk:** Since the bank's trading book (JSE bonds/equities, OTC IRD)
is the primary asset base in the build phase, physical risk is proxied by the carbon-intensity of
the bond and equity counterparty set. High-carbon-intensity counterparties face greater physical
and regulatory risk. Metric: `carbonIntensiveExposurePct` of total trading-book notional.

### 5.2 Transition risk

Transition risk is the financial impact from the policy, technology, and market shifts associated
with the move to a lower-carbon economy:

- **Policy transition** — carbon taxes, emissions regulations, stranded-asset risk.
- **Technology transition** — cost shifts from renewable energy, EV adoption, and industrial
  decarbonisation.
- **Market and reputational transition** — repricing of carbon-intensive assets, investor pressure.

**Build-phase proxy for transition risk:** Sector concentration in carbon-intensive counterparties
(energy, mining, heavy industry, aviation, shipping) as a % of total trading-book exposure.

### 5.3 Climate VaR (daily proxy)

Climate VaR is a forward-looking estimate of potential portfolio loss attributable to climate
transition and physical shocks, expressed at the 99th percentile over a 1-day horizon. During the
build phase, this is computed using publicly available sector-level climate VaR estimates (MSCI,
TCFD-aligned models) applied to the bank's sector-concentration vector. Once a live trading book
exists, the bank migrates to a bottom-up instrument-level climate VaR.

---

## 6. Scenario framework (PA GN 1 of 2024 alignment)

PA Guidance Note 1 of 2024 mandates scenario analysis covering at least three temperature
pathways. The bank adopts the following mapping:

| PA scenario | NGFS / IPCC basis | Temperature outcome | Key assumption |
|---|---|---|---|
| **Orderly transition** (`PA-GN1-2024-ORDERLY`) | NGFS "Net Zero 2050" | 1.5°C by 2100 | Early, coordinated policy action; high but manageable transition costs; physical risks contained. |
| **Disorderly transition** (`PA-GN1-2024-DISORDERLY`) | NGFS "Delayed Transition" | ~2°C by 2100 | Late, disruptive policy action; high stranded-asset risk; abrupt repricing. |
| **Hot house world** (`PA-GN1-2024-HOT-HOUSE`) | NGFS "Current Policies" | ~4°C by 2100 | Insufficient policy action; severe physical risk; systemic asset impairment. |

### 6.1 Scenario horizon

- **Short-term:** 1–3 years (within the ICAAP / ILAAP planning horizon). Captures near-term
  regulatory and market transition shocks.
- **Medium-term:** 10 years. Primary calibration horizon for stress-loss estimation.
- **Long-term:** 30 years. Indicative only; used for strategic risk identification, not capital
  quantification.

The quarterly `ClimateScenarioRun` event records the `scenarioHorizonYears` for each run.
The default is 10 years for capital measurement purposes.

### 6.2 Stress-loss estimation methodology

For each scenario, stress loss is estimated as follows:

1. Identify the bank's total trading-book exposure (ZAR) at the run date.
2. Identify the subset of that exposure that is carbon-intensive (energy, mining, heavy industry).
3. Apply a scenario-specific stress multiplier to the carbon-intensive exposure:
   - Orderly (1.5°C): 5% stress loss on carbon-intensive exposure.
   - Disorderly (2°C): 15% stress loss on carbon-intensive exposure.
   - Hot house world (4°C): 35% stress loss on carbon-intensive exposure.

   These multipliers are derived from PA GN 1 of 2024 indicative ranges and NGFS sector
   vulnerability analysis. They will be recalibrated when the bank builds a live trading book and
   can access instrument-level scenario data. Helena (CRO) owns the calibration; the BRC approves
   revisions.

4. `stressLossZAR` = carbon-intensive exposure × scenario stress multiplier.
5. `worstCaseStressLossPct` = max(`stressLossZAR` across scenarios) / `totalExposureZAR`.

### 6.3 RAS appetite threshold (build phase)

During the build phase (no live portfolio), the climate RAS line is `no-data`. This is the correct
posture: there is nothing to breach if there is no book.

At commencement of trading, the BRC will calibrate thresholds for `worstCaseStressLossPct`:
- Green: < 5% worst-case stress loss / total exposure.
- Amber: 5–10%.
- Red: > 10%.

---

## 7. Measurement frequency

| Metric | Frequency | Event type |
|---|---|---|
| Full scenario run (all three PA scenarios) | Quarterly | `ClimateScenarioRun` |
| Proxy climate VaR (99th pct, 1-day) | Daily (when market data available) | `ClimateExposureRevalued` |
| Ad hoc scenario run | On Helena's direction | `ClimateScenarioRun` |

---

## 8. Event types emitted

### 8.1 ClimateScenarioRun

Emitted once per scenario per quarterly run. Three events per run (one per PA scenario).

```
scenarioId:                   string    — e.g. "PA-GN1-2024-ORDERLY"
scenarioName:                 string    — e.g. "Orderly transition (1.5°C)"
runDate:                      string    — ISO date
portfolioSnapshot:
  totalExposureZAR:           number    — total trading-book notional
  carbonIntensiveExposureZAR: number    — subset in carbon-intensive sectors
  carbonIntensivePct:         number    — 0–100
stressLossZAR:                number    — estimated stress loss under this scenario
scenarioHorizonYears:         number    — typically 10
authority:                    "D-RAS-CLIMATE-SCENARIO-FRAMEWORK"
```

### 8.2 ClimateExposureRevalued (optional daily proxy)

```
asOf:                         string    — ISO date
climateVaR99pct:              number    — ZAR, 99th pct 1-day climate VaR proxy
carbonIntensiveExposurePct:   number    — % of total exposure in carbon-intensive sectors
```

---

## 9. Governance outputs

| Output | Frequency | Routed to |
|---|---|---|
| Climate section of risk-appetite-watch report | Daily | Helena (CRO); BRC at quarterly cycle |
| BRC climate-risk paper | Quarterly (at each BRC meeting) | Board Risk Committee |
| ICAAP climate annex | Annual | Prudential Authority (from commencement) |
| PA GN 1 disclosures | Annual (from commencement of trading) | Public; PA |

---

## 10. Substrate gaps

| Gap | Owner | Priority |
|---|---|---|
| Live trading-book instrument-level climate data feed | Rohan (Risk engineer) | At commencement of trading |
| Bottom-up instrument-level climate VaR model | Rohan (Risk engineer) | At commencement of trading |
| Stress multiplier recalibration (post-live-book) | Helena (CRO) with BRC sign-off | At commencement of trading |
| NGFS scenario data integration | Rohan (Risk engineer) | Medium-term |

---

## 11. Provenance

**Citation chain:**
`PA-GN1-2024` → `RAS §A2` → `D-RAS-CLIMATE-SCENARIO-FRAMEWORK` → `PROC-RISK-CR-01` →
`prototype/platform/projections/climate-risk-projection.ts`

**Authority:** D-RAS-CLIMATE-SCENARIO-FRAMEWORK (CEO-approved)
**Author:** Helena (Chief Risk Officer, governance)
