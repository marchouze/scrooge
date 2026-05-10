---
title: ICAAP / ILAAP / Recovery framework spec — W2 Slice 1
author: Helena (Chief Risk Officer, governance) + Camille (Chief Financial Officer, governance)
date: 2026-05-10
summary: Single readable framework specifying the three-document scope (ICAAP, ILAAP, Recovery), consolidated-basis reading per D-REGULATORY-PERIMETER, RAS B2 ratify-pathway (+1.5pp CET1 management buffer), data-substrate dependencies (RWA engine, stress-projection engine, BA-form generator, intraday-liquidity feed, CFP rehearsal harness), and governance pathway (Helena ICAAP/ILAAP narrative; Camille Capital + BA returns; Eitan ILAAP liquidity-side; Owen secretarial on Recovery-Plan governance triggers). Discharges W2 Slice 1 of D-REGULATORY-READINESS-GATE-PLAN. Folds S5 (Capital-management policy + first BA-returns dry-run) and H7 (Recovery-and-Resolution preparation pack). Each binding clause names owner, substrate dependency, and exit signal — attestable.
decision-required: false
---

# ICAAP / ILAAP / Recovery framework spec — W2 Slice 1

> **Authors.** Helena (Chief Risk Officer, governance) + Camille (Chief Financial Officer, governance).
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10); §3 W2 Slice 1 of [Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md](2026-05-10_zara-helena_regulatory-readiness-gate-plan.md).
> **Decision recorded.** `D-REGULATORY-READINESS-W2-SLICE-1` (downstream dispatch from D-REGULATORY-READINESS-GATE-PLAN per the no-pause rule; CLAUDE.md "Operating procedures").
> **Status.** Framework specification only. No policy is authored here; no obligation row is added; no procedure is bound. The framework names the documents that **will** be produced through W2 Slices 2-7, the substrate that supports them, and the governance pathway under which they are signed.

---

## 0. Reading order

This document is read in three layers:

1. **Sections 1-3** — the framework triplet (ICAAP, ILAAP, Recovery): scope, consolidated-basis reading, governance pathway, and the per-document section-set.
2. **Sections 4-5** — the substrate dependencies (which W2 slice builds what) and the RAS B2 ratify-pathway.
3. **Sections 6-9** — attestation table (every binding clause → owner + substrate + exit signal), citation surface, gap log, and the change log.

The recon `recon:icaap-section-coverage` (planned — Vera follow-on, Wave-4 scope; not built in this slice) will assert that every Banks Act §§ 60-72 + Reg 38 sub-clause has a section in this framework. Section IDs (e.g. `§3.1.4`) are stable and the recon's lookup table.

---

## 1. The three-document scope

The Internal Capital Adequacy Assessment Process (ICAAP), the Internal Liquidity Adequacy Assessment Process (ILAAP), and the Recovery Plan are a **single coherent triplet** for `Hoz Bank Limited`. They share inputs (the same balance-sheet substrate, the same stress engine, the same RAS calibration), they share governance (the same CRO + CFO + Treasurer + Company Secretary), and they share the same regulatory audience (the Prudential Authority — PA — at SARB, with FSB Key Attributes informing the recovery side and read-across by the FSCA on the conduct dimension). They are *authored separately* because the binding regulation differs, but they are **submitted as a triplet** at the licence-application moment and **maintained as a triplet** post-licence-day.

### 1.1 Document identity

| Document | Primary binding regulation | Annual / Triggered cadence | Primary owner | Primary engineering substrate |
|---|---|---|---|---|
| **ICAAP** — Internal Capital Adequacy Assessment Process | Banks Act 94 of 1990 + *Regulations Relating to Banks* — **Reg 38** (Pillar 2 supervisory review process) `[citation: TBC — exact Reg 38 sub-clause indices on capital-adequacy assessment, stress-testing integration, internal capital target, governance documentation; Imani (Legal-as-code engineer) + external counsel ratify at the licence-application gate]` + BCBS Basel III/IV (the *International Convergence of Capital Measurement and Capital Standards*, rev. 2017) | Annual; re-run on material change | Helena (CRO, governance) — narrative; Camille (CFO, governance) — Capital + BA returns | RWA engine + stress-projection engine + BA-form generator (W2 Slices 3-4) |
| **ILAAP** — Internal Liquidity Adequacy Assessment Process | Banks Act 94 of 1990 + *Regulations Relating to Banks* — Reg 26 (liquidity-risk management) read with **BCBS 144** *Principles for Sound Liquidity Risk Management and Supervision* (Sept 2008) + **BCBS 248** *Monitoring tools for intraday liquidity management* (Apr 2013) `[citation: TBC — exact Reg 26 sub-clause indices on the liquidity-adequacy assessment process; PA *Directive on the Internal Liquidity Adequacy Assessment Process* — title `[citation: TBC]`; Imani + external counsel ratify at the licence-application gate]` | Annual; re-run on material change | Camille (CFO, governance) co-chair with Eitan (Treasurer, governance) — liquidity-side; Helena (CRO, governance) — risk-narrative review | Intraday-liquidity feed + CFP rehearsal harness + LCR / NSFR daily projection (W2 Slice 5) |
| **Recovery Plan** | Banks Act 94 of 1990 — **§§ 60-72** (recovery and resolution planning) `[citation: TBC — exact section indices; Helena's reading is that §§ 60-72 cover the recovery framework, with the resolution-side reserved to the SARB Financial Sector Resolution Authority under the Financial Sector Regulation Act; Imani + external counsel ratify at the licence-application gate]` read with **FSB Key Attributes of Effective Resolution Regimes for Financial Institutions** (Oct 2014) + **BCBS D295** *Stress testing principles* (Oct 2018) + **BCBS D335** *Standards: Interest rate risk in the banking book* (Apr 2016, where IRRBB feeds early-warning indicators) + the SARB recovery-planning directive `[citation: TBC — Mira (Compliance / RegTech engineer) curatorship route; no SARB recovery-planning directive currently appears as a discrete row in the obligations register; per Principle 2, no invented citation]` | Annual; re-run on material change; activation-triggered re-assessment under early-warning indicators | Helena (CRO, governance) — primary; Owen (Company Secretary, governance) — secretarial / governance-trigger framework; Camille (CFO, governance) — capital-side options | Indicator-monitoring substrate emitting `RecoveryEarlyWarningTriggered` events (W2 Slice 6) |

### 1.2 Why a triplet, not three independent documents

The PA's supervisory-review reading expects coherence across the three. The capital-stress scenarios in the ICAAP must reconcile with the liquidity-stress scenarios in the ILAAP (a market-shock that hits CET1 also hits LCR — the projections must be the *same scenario*, not independently authored ones). The Recovery Plan's early-warning indicators must trip on the same metrics the ICAAP and the ILAAP use as their target ratios — RAS B1 (CET1) and RAS B2 (CET1 management buffer) for the ICAAP-side; LCR / NSFR / intraday liquidity for the ILAAP-side. A divergent triplet is a Pillar-2 add-on risk in itself; coherent authoring eliminates the divergence at source.

The substrate-side discipline this requires:

- **One stress-projection engine** (W2 Slice 4 — Rohan, Risk engineer under Helena) feeds both the ICAAP narrative and the ILAAP narrative; the same `StressScenarioRun { scenarioId, horizon, severity }` event projects into both downstream registers.
- **One RAS line-set** (the post-Slice-2 calibrated RAS) anchors all three documents. RAS B1 (CET1 ≥ regulatory minimum + Pillar 2A + capital conservation buffer) and RAS B2 (CET1 management buffer ≥ +1.5pp above the B1 floor) are ICAAP-side. RAS B3-family (LCR ≥ 100%, NSFR ≥ 100%, intraday-liquidity buffer) is ILAAP-side. RAS-line breaches feed Recovery-Plan early-warning indicators directly.
- **One legal-entity perimeter reading** (per `D-REGULATORY-PERIMETER`, see §2 below) — the consolidated-basis reading is identical across all three documents.

---

## 2. Consolidated-basis reading per `D-REGULATORY-PERIMETER`

Per `D-REGULATORY-PERIMETER` (CEO-approved 2026-05-09; record at [Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md](2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md)) and the canonical legal-entity tree at [Regulations/_legal-entity-tree.md](../Regulations/_legal-entity-tree.md), the regulatory perimeter for the ICAAP / ILAAP / Recovery triplet is read as follows.

### 2.1 Group structure (as in scope of ICAAP / ILAAP / Recovery)

```
Hoz Group Limited (top-of-tree; non-operating holding company; Companies Act only)
│
├── Hoz Bank Limited (operating bank; PA-supervised under Banks Act 94 of 1990)
│   └── *primary entity in scope of ICAAP / ILAAP / Recovery*
│
└── Hoz Securities Limited (non-bank; FSCA-licensed under FMA 19 of 2012 + ODP under FAIS)
    └── *consolidated-supervision look-through for capital + liquidity per Reg 38 / BCBS Basel III group treatment*
```

### 2.2 Per-document consolidated-basis reading

| Document | Solo basis (`Hoz Bank Limited` only) | Sub-consolidated basis (`Hoz Bank Limited` + subsidiaries within bank perimeter) | Consolidated basis (`Hoz Group Limited` group level — look-through) |
|---|---|---|---|
| **ICAAP** | RWA + capital ratios computed on the bank entity's books | n/a (no bank subsidiaries at v0 entity-tree) | Group-level capital-adequacy reading per Reg 38 group-supervision; Hoz Securities Limited's market-conduct exposures contribute to the group operational-risk RWA add-on per BCBS group-supervision principles |
| **ILAAP** | LCR, NSFR, intraday-liquidity buffer on the bank entity | n/a | Group-funding-strategy narrative covers Hoz Securities Limited's funding profile (no banking-book liquidity, but conduct-side liquidity for client-money / segregated-account discipline reads here) |
| **Recovery Plan** | Recovery options for Hoz Bank Limited | n/a | Group-level resolvability assessment per FSB Key Attributes — group structure simplicity (two operating subsidiaries, no cross-jurisdictional complexity) is itself a recovery-positive feature documented here |

The framework spec **commits** to authoring all three documents at **both** the solo (`Hoz Bank Limited` standalone) and the consolidated (`Hoz Group Limited` group) basis. No look-through dimension is omitted; gaps where a dimension does not bind (e.g. sub-consolidated basis at v0) are documented as such with the regulatory citation explaining why.

### 2.3 Legal-entity event-substrate dependency

The legal-entity tree is materialised through the `LegalEntityRegistered` / `LegalEntityRelationshipDeclared` / `LegalEntityRetired` event family per [Owner Inbox/2026-05-09_atlas_legal-entity-event-family-v0.md](2026-05-09_atlas_legal-entity-event-family-v0.md). The ICAAP / ILAAP / Recovery authoring substrate (W2 Slices 3-6) reads the entity tree from the event log — never from a hand-authored spreadsheet. Drift between the tree-as-authored and the tree-as-cited in the framework triplet is a Vera finding.

---

## 3. Per-document section-set (binding-clause map)

This section names every binding clause and identifies, per clause, the owner + the substrate dependency + the exit signal that demonstrates the clause is discharged. Section IDs are stable for the planned `recon:icaap-section-coverage`.

### 3.1 ICAAP section-set (Banks Act + Reg 38 + BCBS Basel III/IV)

| § | Clause | Owner | Substrate dependency | Exit signal |
|---|---|---|---|---|
| §3.1.1 | Executive summary + governance attestation (CEO + CRO + CFO sign-off) | Helena + Camille | Manual narrative authoring on event-substrate Pillar-1 ratios | `IcaapDocumentSubmitted { boardAttestation }` event emitted |
| §3.1.2 | Business model + strategic plan summary (per Reg 38 Pillar-2 expectation) | Camille | Capital Plan v1 ([Owner Inbox/2026-05-07_camille_capital-plan-v1.md](2026-05-07_camille_capital-plan-v1.md)) — the strategic-foundation reading | Capital Plan v1 referenced + cited in §3.1.2 with hash-pinned reference |
| §3.1.3 | Risk-appetite framework + RAS calibration (RAS B1 + B2) | Helena | RAS register projection + RAS-event `RasLineCalibrated { lineId: "B1" \| "B2" }` (W2 Slice 2 lifts B2 from `PARTIAL` to `IN FORCE` per `ORG-PR-04`) | `RasLineCalibrated { lineId: "B2" }` event in log; recon `recon:ras-b2-calibration-coverage` (planned) green |
| §3.1.4 | Pillar-1 capital requirement (credit + market + operational RWA) | Bea (Accounting & financial reporting engineer under Camille) | RWA engine (W2 Slice 3) producing BA-700-equivalent outputs from event substrate; per `ORG-PR-01` (capital adequacy obligation, IN FORCE) | `RwaComputed { creditRwa, marketRwa, operationalRwa }` event emitted on synthetic Q4 fixture |
| §3.1.5 | Pillar-2 add-on computation (concentration, IRRBB, model risk, residual op-risk) | Rohan (Risk engineer under Helena) | Stress-projection engine (W2 Slice 4); BCBS D335 IRRBB read | `Pillar2AddonComputed { components[], totalAddon }` event emitted |
| §3.1.6 | Stress-testing integration (base + adverse + severely-adverse + reverse — per `ORG-PR-12`) | Rohan + Helena (governance) + Nadia (Independent-validation engineer under Helena) — independent-validation review per RAS B7 | Stress-projection engine (W2 Slice 4); BCBS D295 stress-testing-principles read | `StressScenarioRun { scenarioId, horizon: 3y, severity }` event for each of the four scenarios; Nadia's `ModelValidationCompleted { modelId: "stress-projection-engine" }` event |
| §3.1.7 | Forward-looking capital trajectory (3-year base + adverse projection of CET1 / Tier 1 / Total / leverage) | Bea + Rohan | Stress-projection engine output projected through RWA engine over 3y horizon | `CapitalProjectionGenerated { horizonYears: 3, scenarios[] }` event |
| §3.1.8 | CET1 management buffer (RAS B2: +1.5pp above PA minima + Pillar 2A + capital-conservation buffer) — see §5 below for the full ratify-pathway | Helena + Camille | RAS B2 calibration (W2 Slice 2) | RAS B2 row in obligations register lifted from `PARTIAL (B2 deferred)` → `IN FORCE` per `ORG-PR-04`; `RasLineCalibrated { lineId: "B2", calibrationCitation }` event emitted |
| §3.1.9 | Internal capital target (the management-derived target above the regulatory minimum + buffer) | Camille | Capital Plan v1 strategic-foundation; B2 buffer calibration | Internal capital target documented in §3.1.9; Camille's CFO sign-off event |
| §3.1.10 | Capital-management actions (when ratios approach RAS thresholds) — capital-issuance / capital-distribution discipline | Camille | Capital Management Policy (per `ORG-PR-01` IN FORCE) | Capital Management Policy v1 referenced; capital-action playbook in §3.1.10 |
| §3.1.11 | Group-consolidated capital adequacy reading (per §2.2 above) | Bea + Camille | IFRS 10 consolidation substrate ([Owner Inbox/2026-05-09_bea_ifrs10-consolidation-substrate-v0.md](2026-05-09_bea_ifrs10-consolidation-substrate-v0.md)) + group-perimeter event-substrate per `D-REGULATORY-PERIMETER` | Group-consolidated CET1 / Tier 1 / Total / leverage projected via consolidation substrate; `ConsolidatedCapitalReported` event |
| §3.1.12 | Reg 39 operational-risk reading + new-product-approval discipline (`ORG-PR-25`) — cross-link to NPA gate-set per the *Reg 39 ↔ NPA gate-dimension cross-link* in `ORG-PR-25`; the NPA dimension #7 "Capital impact" is the per-product RWA-delta engine that feeds the operational-risk RWA computation in §3.1.4 | Camille (capital-impact gate, NPA dimension #7) + Helena (operational-risk gate, NPA dimension #4) | NPA gate-set under D-NEW-PRODUCT-APPROVAL-POLICY + product-construction substrate D-PRODUCT-CONSTRUCTION-SUBSTRATE; per-product RWA-delta engine (W2 Slice 3 cross-link) | `ProductDimensionAttested { dimension: "capital-impact", result: "approve" }` events per product; aggregated operational-risk RWA add-on flows to §3.1.4 |
| §3.1.13 | ICAAP governance — board (BRC steady-state; CEO-interim under `D-THIN-HUMAN-LAYER-MINIMUM`) approval pathway; annual cycle; material-change re-run trigger | Helena (CRO, governance) chair; Camille co-chair on capital | Governance event-pattern: `IcaapCycleStarted` → `IcaapDraftReviewed` → `IcaapBoardAttested` → `IcaapDocumentSubmitted` | `IcaapBoardAttested { attestor, asOf }` event emitted per cycle |
| §3.1.14 | Independent-validation — Nadia's model-risk validation of the stress-projection engine + the RWA engine (per RAS B7 model-risk discipline) | Nadia (Independent-validation engineer under Helena, peer-in-second-line) | Validation harness over W2 Slice 3 + Slice 4 substrates | `ModelValidationCompleted { modelId, modelVersion, findings[] }` event |

> **`recon:icaap-section-coverage` (planned).** Asserts that every Reg 38 sub-clause `[citation: TBC]` has a §3.1.x section above. Until external counsel ratifies the Reg 38 sub-clause indices, the recon reads against the BCBS Basel III/IV section-set as a proxy. Owner: Vera (internal audit engineer under Thandiwe (Chief Audit Executive, governance)) — Wave-4 follow-on; not built in this slice.

### 3.2 ILAAP section-set (Banks Act + Reg 26 + BCBS 144 + BCBS 248)

| § | Clause | Owner | Substrate dependency | Exit signal |
|---|---|---|---|---|
| §3.2.1 | Executive summary + governance attestation (CEO + CFO + CRO + Treasurer sign-off) | Camille + Eitan | Narrative on intraday-liquidity feed + LCR / NSFR daily projection | `IlaapDocumentSubmitted { boardAttestation }` event |
| §3.2.2 | Funding strategy + funding-source diversification | Eitan | Funding Strategy Policy (per existing IN FORCE policy stack) | Funding Strategy Policy v1 referenced; funding-mix diagnostic in §3.2.2 |
| §3.2.3 | Liquidity-risk-appetite framework (RAS B3-family — LCR, NSFR, intraday-liquidity buffer) | Helena (RAS calibration discipline) + Eitan (treasury reading) | RAS register projection | RAS B3-family lines `IN FORCE` per existing `ORG-PR-08` (intraday liquidity per BCBS 248) |
| §3.2.4 | Intraday-liquidity monitoring (per BCBS 248 / `ORG-PR-08`) | Ravi (Treasury / ALM engineer under Eitan) | Intraday-liquidity feed (W2 Slice 5) | `IntradayLiquidityReported { measurementId, asOfMinute }` event-stream populated |
| §3.2.5 | Liquidity Coverage Ratio (LCR) — daily projection, 30-day horizon | Ravi + Bea | LCR computation feed (W2 Slice 5) | `LcrComputed { ratio, hqlaAmount, netCashOutflow }` daily event emitted |
| §3.2.6 | Net Stable Funding Ratio (NSFR) — quarterly projection, 1-year horizon | Ravi + Bea | NSFR computation feed (W2 Slice 5) | `NsfrComputed { ratio, asfAmount, rsfAmount }` quarterly event emitted |
| §3.2.7 | Liquidity stress-testing (base + adverse + severely-adverse over 30-day + 90-day + 1-year horizons) | Rohan + Eitan | Stress-projection engine (W2 Slice 4) feeding liquidity-side projections | `LiquidityStressScenarioRun { scenarioId, horizon, severity }` event per scenario |
| §3.2.8 | Contingency Funding Plan (CFP) — rehearsed annually per BCBS 144 / `ORG-PR-15` | Eitan (governance) + Ravi (engineering) | CFP rehearsal harness (W2 Slice 5) | `CfpRehearsalCompleted { rehearsalDate, scenariosCovered[] }` event annually |
| §3.2.9 | Collateral-management reading (encumbered vs unencumbered HQLA) | Ravi | Collateral-position event-stream from M-phase markets-substrate | `CollateralPositionAttested` event |
| §3.2.10 | Group-consolidated liquidity reading (per §2.2 above) | Eitan + Camille | Group-perimeter event-substrate per `D-REGULATORY-PERIMETER` | `ConsolidatedLiquidityReported` event |
| §3.2.11 | ILAAP governance — board approval pathway; annual cycle; material-change re-run trigger | Camille (chair) + Eitan (co-chair on liquidity-side); Helena (review) | Governance event-pattern: `IlaapCycleStarted` → `IlaapDraftReviewed` → `IlaapBoardAttested` → `IlaapDocumentSubmitted` | `IlaapBoardAttested { attestor, asOf }` event |
| §3.2.12 | Independent-validation — Nadia's model-risk validation of the LCR / NSFR / intraday-liquidity computations | Nadia (Independent-validation engineer) | Validation harness over W2 Slice 5 substrate | `ModelValidationCompleted { modelId: "liquidity-substrate", ... }` event |

> **PA *Directive on the Internal Liquidity Adequacy Assessment Process* `[citation: TBC]`.** Mira's curatorship route — the precise PA directive title and reference number bind here; until ratified, the section-set above reads against BCBS 144 + BCBS 248 + the Banks Act Reg 26 obligation.

### 3.3 Recovery Plan section-set (Banks Act §§ 60-72 + FSB Key Attributes)

| § | Clause | Owner | Substrate dependency | Exit signal |
|---|---|---|---|---|
| §3.3.1 | Executive summary + governance attestation | Helena + Owen (secretarial) | Narrative on indicator-monitoring substrate | `RecoveryPlanSubmitted { boardAttestation }` event |
| §3.3.2 | Strategic analysis — business model, critical economic functions, group structure (per FSB Key Attributes "resolvability assessment") | Helena + Camille | Capital Plan v1 + legal-entity tree per `D-REGULATORY-PERIMETER` | Strategic-analysis section authored; references to Capital Plan v1 + entity tree |
| §3.3.3 | Early-warning indicator framework (RAS-line-derived; capital + liquidity + market + operational + reputational) | Helena + Rohan | Indicator-monitoring substrate (W2 Slice 6) — `RecoveryEarlyWarningTriggered` event-pattern | Indicator-set documented; `RecoveryEarlyWarningTriggered { indicatorId, threshold, actualValue }` event-pattern live |
| §3.3.4 | Recovery options inventory (capital actions; liquidity actions; business-line divestiture; balance-sheet management) | Camille (capital-side) + Eitan (liquidity-side) + Helena (overall) | Per-option playbook (manual narrative; no substrate dependency at Slice-6) | Options inventory enumerated; per-option capacity + execution-time + dependencies documented |
| §3.3.5 | Governance-trigger framework — Board Risk Committee (BRC) chair → CEO escalation → recovery-plan-activation | Owen (Company Secretary, governance) — secretarial framework on the governance triggers; Helena chairs the substantive activation decision | Governance event-pattern: `RecoveryEarlyWarningTriggered` → `BrcEscalationConvened` → `RecoveryPlanActivated` | `BrcEscalationConvened { triggerEventId }` and `RecoveryPlanActivated { activationDecisionId }` event types live in the governance-event family |
| §3.3.6 | Communication strategy — internal (board, staff), external (PA, FSCA, FSB, depositors-when-relevant, market) | Owen + Helena + Iris (Information Officer, governance) | Communication-event pattern (manual at Slice-6; substrate is `D-RMS-PHASE-1` Slice 2 correspondence-type) | Communication playbook documented; per-audience template attached |
| §3.3.7 | Operational-readiness for recovery execution — playbooks, key-person dependencies, IT/data-feed availability under stress | Devon (COO, governance) + Helena | Operational-readiness substrate (cross-link to W4 Operational Resilience workstream — deferred per §5 of parent plan) | Operational-readiness checklist authored; gaps named as W4-side substrate deliverables |
| §3.3.8 | Resolvability assessment — group simplicity, separability of critical functions, intra-group dependencies | Helena + Owen + Imani (Legal-as-code engineer) | Legal-entity tree + group-perimeter event-substrate per `D-REGULATORY-PERIMETER` | Resolvability-assessment section authored; cross-reference to FSB Key Attributes resolvability-assessment criteria |
| §3.3.9 | Annual cycle + material-change re-run trigger; recovery-indicator-trip re-assessment trigger | Helena (CRO, governance) chair; Owen (CoSec) cycle-secretarial | Governance event-pattern: `RecoveryPlanCycleStarted` → `RecoveryPlanReviewed` → `RecoveryPlanBoardAttested` → `RecoveryPlanSubmitted` | `RecoveryPlanBoardAttested { attestor, asOf }` event per cycle |
| §3.3.10 | SARB recovery-planning directive `[citation: TBC]` reading — Mira's curatorship route | Mira (Compliance / RegTech engineer, under Zara (Chief Compliance Officer, governance)) | Obligations-register row addition (Mira's Domain A curatorship) — currently no SARB recovery-planning directive appears as a discrete row | Mira's curatorship deliverable: new obligations-register row `ORG-PR-XX` for the SARB recovery directive; Imani + external counsel ratify the citation at the licence-application gate |

> **No invented citations.** Per Principle 2, the Banks Act §§ 60-72 paragraph indices, the Reg 38 sub-clause indices, the Reg 26 sub-clause indices, the PA *Directive on the ILAAP* title, and the SARB recovery-planning directive title are all `[citation: TBC]` until Imani (Legal-as-code engineer) + external counsel ratify them at the licence-application moment. The framework spec marks each unknown explicitly; downstream slice authors **inherit the unknown markers** rather than invent values.

---

## 4. Substrate dependencies — the W2 Slices 2-7 build map

The framework above names what each ICAAP / ILAAP / Recovery section *depends on*. This section names what each W2 slice *builds* in support. The mapping is the build-side counterpart of §3's authoring-side mapping — same substrate, two readings.

### 4.1 Slice-by-slice substrate ownership

| W2 Slice | Title | Owner pair | Substrate built | Discharges (in §3) |
|---|---|---|---|---|
| Slice 1 (this) | ICAAP / ILAAP / Recovery framework spec | Helena + Camille | This document | All — names the per-clause substrate dependency |
| Slice 2 | RAS B2 calibration + CET1 management buffer ratification (pre-M2) | Helena (governance) · Rohan + Bea (engineering) | `RasLineCalibrated { lineId: "B2", calibrationCitation }` event emitted; `ORG-PR-04` lifted `PARTIAL` → `IN FORCE` | §3.1.3 + §3.1.8 + §5 (the ratify-pathway) |
| Slice 3 | RWA engine + BA-form generator (pre-M2) | Bea (engineering) · Camille (governance) | RWA engine producing credit + market + operational RWAs from event substrate; BA-form generator emitting BA 100-series + BA 300-series + BA 325 + BA 326 in published SARB schema | §3.1.4 + §3.1.7 + §3.1.11 + §3.1.12 (NPA dim #7 cross-link) — and **discharges S5 Capital management policy + first BA-returns dry-run** (S5 was folded into W2 per §5 of parent plan) |
| Slice 4 | Stress-projection engine + ICAAP narrative-data (M3) | Rohan (engineering) · Helena (governance) · Nadia (independent validation) | 3-year projected ratios under base / adverse / severely-adverse / reverse scenarios; Pillar-2 add-on computation; narrative-data feed for ICAAP authoring | §3.1.5 + §3.1.6 + §3.1.7 + §3.2.7 (the cross-document stress-coherence requirement of §1.2) |
| Slice 5 | ILAAP liquidity-side substrate (intraday + CFP rehearsal) (M3) | Ravi (engineering) · Eitan (governance) · Helena (review) | Intraday-liquidity feed per BCBS 248; CFP rehearsal harness per BCBS 144; LCR / NSFR daily / quarterly computation feed | §3.2.4 + §3.2.5 + §3.2.6 + §3.2.7 + §3.2.8 + §3.2.10 |
| Slice 6 | Recovery Plan authoring (early-warning + options + governance triggers) (M3-M4) | Helena (governance) · Owen (governance — secretarial) · Rohan (engineering for indicator-monitoring) | Recovery Plan document per Banks Act §§ 60-72 + FSB Key Attributes; indicator-monitoring substrate emitting `RecoveryEarlyWarningTriggered` events; governance-trigger event-pattern; **discharges H7 Recovery-and-Resolution preparation pack** (H7 was folded into W2 per §5 of parent plan) | §3.3.1 — §3.3.10 |
| Slice 7 | First end-to-end ICAAP / ILAAP / Recovery dry-run (pre-licence-day) | Helena + Camille + Eitan + Rohan + Bea + Nadia · Vera (assurance) | Three-document dry-run package from synthetic data via the substrates landed in Slices 2-6 | All sections — assertion-test that the framework produces a coherent triplet end-to-end |

### 4.2 Cross-cutting substrate dependencies (shared with W1 + W3)

Per §6 of the parent plan, the W2 substrate-side reads against the cross-cutting substrate built by other workstreams.

- **`D-RMS-PHASE-1` Slice 2 (event-type registration — landed at PR #144).** The seven RMS event types include `AgentRunStarted` / `AgentRunCompleted` / `RecordFiled` — the runtime substrate for the W2 deliverables themselves (each of the W2 Slices 2-7 emits an `AgentRunStarted`/`AgentRunCompleted` pair when its authoring agent runs). Slices 3-6 will additionally emit domain-specific event types (`RwaComputed`, `Pillar2AddonComputed`, `StressScenarioRun`, `LcrComputed`, `NsfrComputed`, `CfpRehearsalCompleted`, `RecoveryEarlyWarningTriggered`) registered through the `RMS_EVENT_TYPES` extension pattern.
- **`D-RMS-PHASE-1` Slice 1 (BLAKE3 content-addressed document store — landed at PR #142).** The ICAAP, ILAAP, and Recovery Plan documents themselves are stored in `prototype/data/documents/` as BLAKE3-hashed artefacts; the Decisions register references them by hash. The framework spec (this document) will itself land in the document store when Phase 1 register-projection lands (post-W2 Slice 1).
- **`D-EVENT-STORE-SCALING` Slice 2 (snapshot substrate — landed) + Slice 3 (snapshot adoption).** The stress-projection engine in W2 Slice 4 re-runs scenarios at scale; snapshot acceleration on the read-amplified replay is a substrate-load mitigation for Slice 4's event-volume.
- **Markets-substrate (M-phase).** Trading-book RWA inputs (FRTB market-risk RWA) come from the markets-substrate; W2 Slice 3's RWA engine reads `BondTradeBooked`, `EquityTradeBooked`, `IrdTradeBooked` events and projects market-risk capital. Liquidity-side collateral positions in §3.2.9 read from the same.
- **Treasury substrate (Eitan's seat).** Liquidity-side ILAAP substrate (intraday, LCR, NSFR, CFP) reads Treasury event-streams that are themselves under construction; W2 Slice 5 specifies the dependent event types as part of its acceptance.

### 4.3 Cross-cutting policy dependencies (already IN FORCE)

The framework reads against existing IN FORCE policies; W2 does not re-author these:

- **Capital Management Policy** (per `ORG-PR-01` IN FORCE) — discharges §3.1.10 capital-management-actions; §3.1.9 internal-capital-target.
- **Stress Testing Policy** (per `ORG-PR-12` IN FORCE) — discharges §3.1.6 + §3.2.7 stress-testing.
- **Liquidity Risk Management Policy** + **Funding Strategy Policy** (per `ORG-PR-08` + `ORG-PR-15` IN FORCE) — discharges §3.2.2 + §3.2.4 + §3.2.8.
- **Operational Risk Policy** + **Risk Management Framework** + **Outsourcing & Third-Party Risk Policy** + **Business Continuity / Disaster Recovery Policy** (per `ORG-PR-24` IN FORCE umbrella) — discharges §3.1.5 op-risk RWA reading + §3.3.7 operational-readiness.
- **New Product Approval Policy v1.0** (per `ORG-PR-25` IN FORCE; `D-NEW-PRODUCT-APPROVAL-POLICY` approved 2026-05-10) — discharges §3.1.12 NPA dimension #7 capital-impact + dimension #4 operational-risk cross-link.

---

## 5. RAS B2 ratify-pathway — the +1.5pp CET1 management buffer

RAS B2 is the line: "CET1 management buffer ≥ +1.5pp above all PA minima + Pillar 2A + capital conservation buffer", per `ORG-PR-04` (currently `PARTIAL (B2 deferred)`). The framework spec **commits** the ratify-pathway as follows.

### 5.1 Substrate-side

W2 Slice 2 owns the calibration. Helena + Rohan author the calibration brief; the engineering work computes the buffer against synthetic Pillar-1 ratios from Bea's reporting-capability spec ([Owner Inbox/2026-05-06_reporting-capability-spec.md](2026-05-06_reporting-capability-spec.md)) + Rohan's stress-projection engine (W2 Slice 4 — partial dependency; Slice 2 uses an engine-precursor or synthetic stress fixture if Slice 4 hasn't landed).

### 5.2 Governance-side

The calibration brief is authored by Helena (CRO), reviewed by Camille (CFO) on the capital-side reasonableness, and approved by the CEO under the no-pause rule — this is a within-RAS-discipline calibration, not a new policy decision; the standing policy authority for the RAS B-family lines was given when the RAS framework was approved. The CEO-approval is recorded as a follow-on `D-RAS-B2-CALIBRATION` decision event (downstream of D-REGULATORY-READINESS-GATE-PLAN per the no-pause rule); the calibration citation accompanies the event.

### 5.3 Substrate exit signal

The exit signal is two events in the log:

1. `RasLineCalibrated { lineId: "B2", calibrationValue: 1.5, calibrationUnit: "percentage_points", calibrationCitation: "..." }` — the calibration substrate event.
2. `CeoDecision { decisionId: "D-RAS-B2-CALIBRATION", action: "approve", ... }` — the governance ratification.

Once both events are in the log, `ORG-PR-04` is lifted from `PARTIAL (B2 deferred)` → `IN FORCE`, and the recon `recon:ras-b2-calibration-coverage` (planned, Vera Wave-4 follow-on) green-lights the closure.

### 5.4 Why +1.5pp (not +1.0pp or +2.0pp)

The +1.5pp figure is the **target** carried in the RAS register; the calibration brief in Slice 2 will defend the figure against:

- Peer-bank disclosure (SA-domestic mid-cap-and-small-cap bank ICAAP disclosures of management buffers above PA minima — typical range +1.0pp to +2.5pp at the management-buffer level above CET1 minima + 2A + CCB).
- Stress-shortfall analysis (the +1.5pp must be sufficient to absorb the Slice-4 severely-adverse scenario without breaching the CET1 + 2A + CCB floor; if the severely-adverse projection breaches at +1.5pp, Slice 2's recommendation is to recalibrate up).
- Capital-issuance optionality (a buffer narrower than +1.5pp constrains capital-distribution discretion to a degree the CFO-side regards as commercially restrictive given Hoz Bank's ramp profile).

The Slice-2 brief presents the three readings; the CEO-approval ratifies the final figure (which may be the target +1.5pp, or a different value if the substrate-side analysis surfaces a shortfall).

---

## 6. Governance pathway

This section names every binding accountability — owner, decision authority, escalation pathway. The framework triplet is governed coherently across the three documents.

### 6.1 Per-document chair table

| Document | Chair | Co-chair | Secretarial | Independent validation |
|---|---|---|---|---|
| ICAAP narrative | Helena (CRO, governance) | Camille (CFO, governance) on capital-side | Owen (Company Secretary, governance) on cycle + attestation framework | Nadia (Independent-validation engineer, peer-in-second-line under Helena) on stress-engine + RWA model-risk |
| ILAAP — capital-side / governance | Camille (CFO, governance) | Helena (CRO, governance) on risk-narrative | Owen (CoSec) on cycle + attestation framework | Nadia on liquidity-substrate model-risk |
| ILAAP — liquidity-side substrate | Eitan (Treasurer, governance) | Camille (chair of overall ILAAP) | Owen (CoSec) | Nadia on intraday-liquidity + LCR / NSFR computation |
| Capital management policy + BA returns | Camille (CFO, governance) | Helena on RAS-side (B1, B2 lines) | Owen (CoSec) | Vera (internal audit engineer under Thandiwe (Chief Audit Executive, governance)) on BA-form generator outputs |
| Recovery Plan | Helena (CRO, governance) | Camille on capital-recovery options; Eitan on liquidity-recovery options | Owen (Company Secretary, governance) — secretarial on the governance-trigger framework (BRC chair → CEO escalation → recovery-plan-activation) | Nadia on early-warning indicator-model risk |

### 6.2 Approval pathway

Steady-state (post-licence-day, BRC constituted):

- ICAAP / ILAAP / Recovery: **BRC review → Board approval → CEO sign-off → Submission to PA**.
- Material-change re-run: BRC convened on early-warning indicator trip; activates per §3.3.5.

Interim (build-phase, pre-licence-day, BRC not yet constituted per `D-THIN-HUMAN-LAYER-MINIMUM`):

- ICAAP / ILAAP / Recovery: **CRO + CFO + Treasurer + CoSec joint sign-off → CEO approval (Marc) → file in Decisions register**.
- Material-change re-run: CRO escalates to CEO directly; recovery-plan-activation pathway pre-pre-licence-day not relevant (no live position).

### 6.3 Cycle cadence

- **Annual.** Each of the three documents is re-authored annually (calendar-aligned with the bank's financial year end). Annual cycle event: `IcaapCycleStarted` → ... → `IcaapDocumentSubmitted` (one cycle per document; the three cycles are sequenced — ICAAP then ILAAP then Recovery — to allow ILAAP to consume ICAAP stress-data and Recovery to consume both).
- **Material-change-triggered.** A material change in business model, RWA composition, balance-sheet structure, or the entity perimeter (per `D-REGULATORY-PERIMETER`) triggers a re-run. The trigger pattern is `MaterialChangeDeclared` → `IcaapMaterialChangeAssessed { triggerEventId, reRunRequired: true | false }`.
- **Recovery-indicator-trip-triggered.** Per §3.3.9 — a Recovery Plan early-warning indicator trip triggers a re-assessment of the recovery options against the new state.

### 6.4 Independence discipline

- **Nadia** sits in the second line as peer-in-second-line, validating the engineering-side substrates (RWA engine, stress-projection engine, liquidity-substrate, indicator-monitoring) without authoring them. Her validation events (`ModelValidationCompleted`) are separate from the engineering-side `*Computed` events.
- **Vera** sits in the third line under Thandiwe (Chief Audit Executive, governance) — internal audit assurance on the framework's operation across all three documents. Vera's findings feed into the Audit Forum (chaired by Owen until a Board AC is constituted) per the third-line independence discipline named in CLAUDE.md "Top-of-house reporting".

---

## 7. Citation surface (registered obligations + standards cited)

This section lists every citation the framework reads against. Per Principle 2, only register-row IDs and external-standard names are listed; precise sub-clause indices that are not in-register carry `[citation: TBC]` until ratified by Imani (Legal-as-code engineer) + external counsel at the licence-application gate.

### 7.1 In-register obligations cited (by row ID + URN)

| Obligation | Source | URN | Discharge anchor |
|---|---|---|---|
| `ORG-PR-01` | Banks Act 94/1990 + *Regs Relating to Banks* — capital adequacy at not less than the regulatory minimum | `[TBD]` | §3.1.4 + §3.1.10 + §3.1.11 |
| `ORG-PR-04` | Internal RAS / RAF — CET1 management buffer ≥ +1.5pp above PA minima + Pillar 2A + CCB (RAS B2 — calibration pending) | `[TBD]` | §3.1.3 + §3.1.8 + §5 (the ratify-pathway) |
| `ORG-PR-08` | BCBS 248 — monitor intraday liquidity per BCBS metrics | `[TBD]` | §3.2.4 + §3.2.5 |
| `ORG-PR-12` | Banks Act + PA stress-testing guidance — integrated stress testing | `[TBD]` | §3.1.6 + §3.2.7 |
| `ORG-PR-15` | BCBS 144 — Contingency Funding Plan; rehearsed annually | `[TBD]` | §3.2.8 |
| `ORG-PR-24` | Banks Act 94/1990 + Reg 39 (operational-risk management umbrella) + BCBS *Sound Practices for the Management of Operational Risk* (rev. 2021) | `urn:obligation:bank:m1:operational-cyber:banks-act-reg-39:v1` | §3.1.5 + §3.3.7 |
| `ORG-PR-25` | Banks Act 94/1990 + Reg 39 — new-product-approval-process sub-clauses + BCBS *Sound Practices* §27 | `urn:obligation:bank:m1:operational-cyber:banks-act-reg-39-product-approval:v1` | §3.1.12 (Reg 39 ↔ NPA gate-dimension cross-link per `ORG-PR-25`) |

### 7.2 External standards cited (no register row at v0)

- **Banks Act 94 of 1990 §§ 60-72** — recovery and resolution planning. `[citation: TBC — exact section indices; Imani + external counsel ratify at the licence-application gate]`.
- **Regulations Relating to Banks 2012 (as amended) — Reg 38** (Pillar 2 supervisory review process). `[citation: TBC — exact sub-clause indices; same ratification pathway]`.
- **Regulations Relating to Banks 2012 (as amended) — Reg 26** (liquidity-risk management). `[citation: TBC — exact sub-clause indices on the ILAAP discipline; same ratification pathway]`.
- **Regulations Relating to Banks 2012 (as amended) — Reg 39** (operational-risk management; new-product-approval sub-clauses). `[citation: TBC — exact paragraph indices per `ORG-PR-24` + `ORG-PR-25`]`.
- **BCBS Basel III/IV** — *International Convergence of Capital Measurement and Capital Standards* (rev. 2017) — Pillar 1 capital framework + Pillar 2 supervisory review process + Pillar 3 disclosure.
- **BCBS 144** — *Principles for Sound Liquidity Risk Management and Supervision* (Sept 2008) — discharged by `ORG-PR-15` (CFP rehearsal) and reads across §3.2.2 + §3.2.3 + §3.2.8.
- **BCBS 248** — *Monitoring tools for intraday liquidity management* (Apr 2013) — discharged by `ORG-PR-08`; reads across §3.2.4.
- **BCBS D295** — *Stress testing principles* (Oct 2018) — reads across §3.1.6 + §3.2.7 (and §3.3.3 for early-warning calibration).
- **BCBS D335** — *Standards: Interest rate risk in the banking book* (Apr 2016) — reads across §3.1.5 (Pillar-2 IRRBB add-on) + §3.3.3 (IRRBB-derived early-warning indicator).
- **FSB Key Attributes of Effective Resolution Regimes for Financial Institutions** (Oct 2014) — reads across §3.3.2 + §3.3.8.
- **PA *Directive on the Internal Liquidity Adequacy Assessment Process*** — `[citation: TBC — Mira's curatorship route; the directive title and reference number bind on §3.2; until ratified, the section-set reads against BCBS 144 + BCBS 248 + Reg 26]`.
- **SARB recovery-planning directive** — `[citation: TBC — Mira's curatorship route; no SARB recovery-planning directive currently appears as a discrete row in the obligations register; per Principle 2, no invented citation. Slice 6 authoring routes the question to Mira if unresolved by then.]`

### 7.3 Cross-references to companion decision records + specs

- `D-REGULATORY-PERIMETER` — record at [Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md](2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md). Anchors §2 consolidated-basis reading.
- `D-LEGAL-ENTITY-TREE-V0` — record at the same date. Anchors the entity-tree event substrate per §2.3.
- `D-NEW-PRODUCT-APPROVAL-POLICY` — record at [Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-new-product-approval-policy.md](2026-05-10_scrooge_ceo-decision-record_d-new-product-approval-policy.md). Anchors §3.1.12 NPA cross-link.
- `D-PRODUCT-CONSTRUCTION-SUBSTRATE` — record at [Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-product-construction-substrate.md](2026-05-10_scrooge_ceo-decision-record_d-product-construction-substrate.md). Anchors §3.1.12 capital-impact engine substrate.
- `D-RMS-PHASE-1` — record at [Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md](2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md). Anchors document-substrate dependency in §4.2.
- `D-EVENT-STORE-SCALING` — anchors snapshot acceleration in §4.2.
- Bea's reporting-capability spec — [Owner Inbox/2026-05-06_reporting-capability-spec.md](2026-05-06_reporting-capability-spec.md). Anchors §3.1.4 RWA engine + §3.1.7 capital-projection.
- Camille's Capital Plan v1 — [Owner Inbox/2026-05-07_camille_capital-plan-v1.md](2026-05-07_camille_capital-plan-v1.md). Anchors §3.1.2 + §3.1.9 + §3.3.2.
- Bea's IFRS 10 consolidation substrate v0 — [Owner Inbox/2026-05-09_bea_ifrs10-consolidation-substrate-v0.md](2026-05-09_bea_ifrs10-consolidation-substrate-v0.md). Anchors §3.1.11 group-consolidated reading.

---

## 8. S5 + H7 fold-in attestation

Per §5 of the parent regulatory-readiness-gate plan, two adjacent candidates were folded into W2 rather than carried as separate workstreams. This framework carries the attestation that they are addressed.

### 8.1 S5 — Capital management policy + first BA returns dry-run

- **Capital Management Policy.** IN FORCE per `ORG-PR-01` (referenced in §3.1.10 + §3.1.11 + §4.3). The framework reads against the existing policy; W2 does not re-author.
- **First BA returns dry-run.** Discharged by **W2 Slice 3** — RWA engine + BA-form generator. The Slice-3 exit criterion is "BA-form generator produces XML / CSV in the published SARB schema; recon `recon:ba-form-schema-validation` (planned) green". The dry-run is end-to-end through Slice 3's substrate on synthetic data per Bea's reporting-capability spec.
- **ICAAP linkage.** Discharged by §3.1.4 (RWA → BA-700-equivalent outputs) + §3.1.7 (capital projection feeding the BA returns).

S5 has no separate workstream; this framework + Slice 3 substrate discharge it.

### 8.2 H7 — Recovery-and-Resolution preparation pack (Banks Act §§ 60+ + FSB Key Attributes)

- **Recovery framework.** §3.3 of this document (the Recovery Plan section-set per Banks Act §§ 60-72 + FSB Key Attributes).
- **Recovery Plan authoring.** Discharged by **W2 Slice 6** — Helena (governance) + Owen (governance — secretarial / governance-trigger framework) + Rohan (engineering for indicator-monitoring).
- **Resolution-side.** Per §1.1 above, Helena's reading is that Banks Act §§ 60-72 cover the recovery framework, with the resolution-side reserved to the SARB Financial Sector Resolution Authority under the Financial Sector Regulation Act. The bank's resolution-side obligations bind through (a) the recovery-plan resolvability-assessment in §3.3.8 (group structure simplicity, separability of critical functions, intra-group dependencies — feeds the resolution authority's resolvability reading at the group level), and (b) any SA-resolution-regime-specific data-disclosure obligations the SARB Financial Sector Resolution Authority may impose post-licence-day (`[citation: TBC]` — Mira's curatorship route; not in scope for build-phase).

H7 has no separate workstream; this framework + Slice 6 substrate discharge it.

---

## 9. Gap log + open dependencies

Tracked openly per the events-first authoring rule (gaps are not hidden — they are the work for downstream slices).

### 9.1 Citation gaps (`[citation: TBC]`)

Each is named explicitly above; here is the consolidated list:

1. Banks Act §§ 60-72 — exact paragraph indices for the recovery framework. Imani + external counsel route, licence-application gate.
2. Regulations Relating to Banks — Reg 38 sub-clause indices for the ICAAP discipline. Same route.
3. Regulations Relating to Banks — Reg 26 sub-clause indices for the ILAAP discipline. Same route.
4. PA *Directive on the Internal Liquidity Adequacy Assessment Process* — title + reference number. Mira curatorship route.
5. SARB recovery-planning directive — title + reference number; not currently in obligations register. Mira curatorship route; if unresolved at Slice 6, route the question explicitly.

### 9.2 Substrate gaps surfaced by this framework

- **`recon:icaap-section-coverage` (planned).** Vera Wave-4 follow-on. Asserts every Banks Act § 60+ + Reg 38 sub-clause has a §3.x section. Not built in this slice; filed as a Vera follow-on per the brief.
- **`recon:ras-b2-calibration-coverage` (planned).** Triggered by W2 Slice 2; asserts the `RasLineCalibrated { lineId: "B2" }` event is in the log and `ORG-PR-04` is `IN FORCE`.
- **`recon:ba-form-schema-validation` (planned).** Triggered by W2 Slice 3; asserts BA-form generator output validates against the published SARB schema.
- **Domain-specific event types** (`RwaComputed`, `Pillar2AddonComputed`, `StressScenarioRun`, `LiquidityStressScenarioRun`, `LcrComputed`, `NsfrComputed`, `IntradayLiquidityReported`, `CollateralPositionAttested`, `CapitalProjectionGenerated`, `ConsolidatedCapitalReported`, `ConsolidatedLiquidityReported`, `CfpRehearsalCompleted`, `RecoveryEarlyWarningTriggered`, `BrcEscalationConvened`, `RecoveryPlanActivated`, plus the `Icaap*` / `Ilaap*` / `RecoveryPlan*` cycle event family). Each is registered through the `RMS_EVENT_TYPES` extension pattern in subsequent W2 slices.
- **PA / FSCA submission-channel substrate** for the eventual ICAAP / ILAAP / Recovery package submission — not in scope for build-phase; activates at licence-application moment.

### 9.3 Cross-slice dependencies (the ordering W2 must respect)

```
Slice 1 (this) ──┬── Slice 2 (RAS B2 calibration)
                 │       └── unblocks §3.1.3, §3.1.8, §5
                 ├── Slice 3 (RWA + BA-form)
                 │       └── unblocks §3.1.4, §3.1.7, §3.1.11, §3.1.12, S5
                 ├── Slice 4 (Stress engine) ── depends on Slice 3
                 │       └── unblocks §3.1.5, §3.1.6, §3.2.7
                 ├── Slice 5 (ILAAP liquidity substrate)
                 │       └── unblocks §3.2.4 — §3.2.10
                 ├── Slice 6 (Recovery Plan) ── depends on Slices 4 + 5
                 │       └── unblocks §3.3 entirely; discharges H7
                 └── Slice 7 (End-to-end dry-run) ── depends on Slices 1-6
                         └── pre-licence-day end-to-end attestation
```

Slice 2 and Slices 3 + 5 are independent of each other; Slice 4 depends on Slice 3; Slice 6 depends on Slices 4 + 5; Slice 7 depends on all preceding. Parallel-dispatch opportunities exist between Slice 2 and Slice 3, and between Slice 4 and Slice 5 once Slice 3 lands.

---

## 10. Authority + change log

### 10.1 Authority

- Standing decision: `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10).
- Slice-1 sub-authorisation: `D-REGULATORY-READINESS-W2-SLICE-1` (this deliverable; downstream dispatch from D-REGULATORY-READINESS-GATE-PLAN per the no-pause rule, CLAUDE.md "Operating procedures"). Recorded by `prototype/scripts/record-d-regulatory-readiness-w2-slice-1.ts`.
- Identity discipline (CLAUDE.md "Dispatch discipline") observed throughout: every agent reference pairs name + position on first mention.

### 10.2 Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-05-10 | Helena (Chief Risk Officer, governance) + Camille (Chief Financial Officer, governance) | Initial framework spec authored under W2 Slice 1 of D-REGULATORY-READINESS-GATE-PLAN. Three-document scope (ICAAP + ILAAP + Recovery); consolidated-basis reading per D-REGULATORY-PERIMETER; per-document section-set with owner + substrate dependency + exit signal per binding clause; substrate-dependency map across W2 Slices 2-7; RAS B2 ratify-pathway; governance pathway (Helena ICAAP/ILAAP narrative; Camille Capital + BA returns; Eitan ILAAP liquidity-side; Owen secretarial on Recovery-Plan governance triggers); citation surface (in-register `ORG-PR-01`, `ORG-PR-04`, `ORG-PR-08`, `ORG-PR-12`, `ORG-PR-15`, `ORG-PR-24`, `ORG-PR-25`; external standards Banks Act §§ 60-72 + Reg 38 + Reg 26 + Reg 39 + BCBS Basel III/IV + BCBS 144 + BCBS 248 + BCBS D295 + BCBS D335 + FSB Key Attributes — all unresolved sub-clause indices marked `[citation: TBC]` per Principle 2); S5 + H7 fold-in attestation; gap log + cross-slice dependency map. Recon `recon:icaap-section-coverage` filed as a Vera follow-on (not built in this slice). |
