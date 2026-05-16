---
title: "M3 Slice 7 — Climate-Risk Future-Tranche: Delivery Brief"
date: "2026-05-16"
author: "Rohan (Risk Engineer, engineering)"
co-author: "Helena (Chief Risk Officer, governance)"
authority: "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"
decision-required: false
tags: [climate-risk, tcfd, sarb-gn5, pillar-2, m3-slice7, returns]
status: rehearsal
---

# M3 Slice 7 — Climate-Risk Future-Tranche: Delivery Brief

**Authors:** Rohan (Risk Engineer, engineering) + Helena (Chief Risk Officer, governance)
**Authority:** D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
**Reporting frameworks:** TCFD 2017; SARB Guidance Note 5/2023

---

## Summary

M3 Slice 7 delivers the climate-risk data layer scaffold — a production-grade structure for TCFD-aligned climate risk disclosures and SARB Guidance Note 5 (Pillar 2 ICAAP add-on). Computed values are rehearsal-grade placeholders; the scaffold is ready for the climate-data-provider feed.

Four files added at `prototype/platform/returns/climate/`:

| File | Description |
|------|-------------|
| `types.ts` | `ClimateScenario`, `ClimateRiskExposure`, `ClimateRiskDisclosure` types |
| `generator.ts` | `generateClimateRiskDisclosure` + `SARB_STANDARD_SCENARIOS` catalogue |
| `period-close-subscriber.ts` | `climateRiskPeriodCloseSubscriber` — `AccountingPeriodClosed` hook |
| `climate.test.ts` | 14 scenario tests; all pass |

---

## What was built

### Types (`types.ts`)

- `ScenarioType`: `"transition" | "physical"`
- `HorizonType`: `"short" | "medium" | "long"` (TCFD §C.5 / SARB GN5 §3.2)
- `DisclosureFramework`: `"TCFD" | "SARB-GN5"`
- `DisclosureStatus`: `"rehearsal" | "compliant" | "insufficient-data"`
- `ClimateScenario` — scenario definition with `scenarioId`, `type`, `horizon`, `description`, `temperaturePathway`
- `ClimateRiskExposure` — per-counterparty scores + estimated Pillar 2 add-on (ZAR minor)
- `ClimateRiskDisclosure` — aggregate disclosure record (entity, reporting date, framework, scenarios, exposures, aggregate scores, pillar2AddOn, status)

### Generator (`generator.ts`)

- `SARB_STANDARD_SCENARIOS` — three NGFS-aligned pathways (Citation: SARB GN5/2023 §3.3):
  1. `SARB-GN5-1.5C-ORDERLY` — Paris-aligned orderly transition
  2. `SARB-GN5-3C-DISORDERLY` — delayed/abrupt transition
  3. `SARB-GN5-4C-HOTHOUSE` — hot-house world (severe physical risk)
- `generateClimateRiskDisclosure` — replays `TradeBooked` and `CollateralUpdated` events to enumerate counterparty IDs/sector codes; assigns placeholder scores; returns `status: "rehearsal"`
- Counterparties deduplicated across events; events after `reportingDate` excluded (Principle 1 compliance)

### Subscriber (`period-close-subscriber.ts`)

- `climateRiskPeriodCloseSubscriber` — guards on `CLIMATE_RISK_BANK_ENTITIES`; no-ops for `LE-ZA-HOZ-SECURITIES`/non-bank entities (`skipped: true` with reason); calls generator on `AccountingPeriodClosed` for `LE-ZA-HOZ-BANK`

### Tests (`climate.test.ts`) — 14 tests, all pass

1. Three standard SARB scenarios present in output
2. Each scenario has `temperaturePathway`
3. Scenarios cover both transition and physical types
4. Caller-supplied scenarios override defaults
5. Aggregate numeric cells non-NaN
6. Per-exposure numeric fields non-NaN
7. `status === "rehearsal"` for placeholder data
8. Subscriber skips non-bank entity
9. Subscriber generates disclosure for bank entity
10. Disclosure framework defaults to `SARB-GN5`
11. Counterparties enumerated from `TradeBooked` events
12. Counterparties deduplicated
13. Events after `reportingDate` excluded
14. `CollateralUpdated` events also populate exposures

---

## Package.json + permission gate

- `"returns:climate:smoke"` script added to `package.json`
- `"platform/returns/climate/"` added to `CONSTRUCTION_CARVE_OUT_DIRS` in `platform/recon/permission-gate-default.ts`

---

## CI status

`bun run ci` from `prototype/` — passes with zero errors. All 14 new tests pass alongside the full existing suite.

---

## Substrate gaps / TODOs (future-tranche roadmap items)

These are explicitly marked in source code with `// TODO:` and are expected gaps at rehearsal grade:

| Gap | Location | Notes |
|-----|----------|-------|
| Climate-data-provider feed | `generator.ts` — `transitionRiskScore` | MSCI Climate Risk or equivalent |
| Climate-data-provider feed | `generator.ts` — `physicalRiskScore` | Bloomberg Physical Hazard Score or equivalent |
| SARB GN5 §5 add-on formula | `generator.ts` — `estimatedCapitalAddOn` | Calibrate once GN5 methodology confirmed |
| Aggregate score computation | `generator.ts` — `aggregateTransitionRisk/Physical` | Exposure-weighted average post score-feed |
| Pillar 2 add-on aggregation | `generator.ts` — `pillar2AddOn` | Sum across exposures post calibration |
| Party register sector field | `generator.ts` — `sectorCode` | Map from Party master data when field lands |

---

## Citations

- `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (CEO-approved 2026-05-10)
- `Principles/1-events-are-truth.md`
- `Principles/2-single-graph-discipline.md`
- SARB Guidance Note 5/2023 (Climate-risk supervisory requirements)
- TCFD 2017 (Task Force on Climate-related Financial Disclosures)
- NGFS Climate Scenarios Phase 4 (2023)
