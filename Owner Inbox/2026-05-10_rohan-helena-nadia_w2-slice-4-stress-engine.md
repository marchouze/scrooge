---
title: W2 Slice 4 — Stress-projection engine + Pillar-2 add-on + ICAAP narrative-data feed
author: Rohan (Risk engineer, engineering — reports to Helena CRO), Helena (Chief Risk Officer, governance — reports to CEO), Nadia (Independent-validation engineer, engineering — peer-in-second-line under Helena CRO)
date: 2026-05-10
summary: Stress-projection engine projects CET1 / Tier1 / Total / Leverage / LCR / NSFR over 3-year horizon × 4 scenarios (base + adverse + severely-adverse + reverse-stress). Pillar-2 add-on = max(stress-deficit, risk-bucket sum). ICAAP narrative-data feed lands typed shape for Helena's narrative author. Nadia's independent validation report accepts engine for build-phase rehearsal use.
decision-required: false
---

# W2 Slice 4 — Stress-projection engine + Pillar-2 add-on + ICAAP narrative-data feed

**Authority.** Standing CEO decision **`D-REGULATORY-READINESS-GATE-PLAN`** (CEO-approved 2026-05-10), pack §3 W2 Slice 4. Recorded as `D-REGULATORY-READINESS-W2-SLICE-4` per the no-pause rule (CLAUDE.md "Operating procedures") — downstream slices of an approved decision dispatch without per-item CEO confirmation.

**Pack reference.** [`Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md`](2026-05-10_zara-helena_regulatory-readiness-gate-plan.md) §3 W2 Slice 4.

**Source-spec ancestor.** [`Owner Inbox/2026-05-10_bea-camille_w2-slice-3-rwa-engine.md`](2026-05-10_bea-camille_w2-slice-3-rwa-engine.md) §7 (Slice-4 forward-link); [`Owner Inbox/2026-05-10_helena-rohan-bea_w2-slice-2-ras-b2-calibration.md`](2026-05-10_helena-rohan-bea_w2-slice-2-ras-b2-calibration.md) (RAS B2 +1.5pp management buffer informing Pillar-2 floor).

**Independent validation.** [`Owner Inbox/2026-05-10_nadia_w2-slice-4-stress-engine-validation-report.md`](2026-05-10_nadia_w2-slice-4-stress-engine-validation-report.md) — Nadia (Independent-validation engineer, engineering — peer-in-second-line under Helena CRO) accepts the engine for build-phase rehearsal use; production sign-off deferred to post-licence-day after **N-V0.1-01** (RWA / capital coupling) and **N-V0.1-02** (real PA-published macro paths) remediations land.

## 1. Scope

Build the **stress-projection engine** that projects:

- CET1 ratio
- Tier 1 ratio
- Total capital ratio
- Leverage ratio
- LCR (Liquidity Coverage Ratio)
- NSFR (Net Stable Funding Ratio)

over a 3-year quarterly horizon (12 quarters) under **four stress scenarios** required by Reg 38 + Reg 39 + BCBS Basel III ICAAP guidance + `ORG-PR-12`:

1. **Base** — central forecast (PA-published macro path; build-phase fixture in use).
2. **Adverse** — moderate downturn (credit deterioration, vol expansion, single-digit revenue compression).
3. **Severely-adverse** — severe downturn (sharp credit losses, vol explosion, double-digit revenue compression, deposit-flight liquidity stress).
4. **Reverse-stress** — search backwards: specify the breach (CET1 ratio = PA min 4.5%), the engine computes the shock multiplier required to bind.

Plus the **Pillar-2 add-on** computation and the **ICAAP narrative-data feed** consumed by Helena (Chief Risk Officer, governance) for narrative authoring.

**In scope at v0.1:**
- 4-scenario × 13-quarter projection (q0 base + q1..q12).
- Pure-function projection (no event side-effects).
- Per-entity scope guard (Hoz Bank only at v0.1).
- Reverse-stress bisection on a single scaling parameter `k`.
- Pillar-2 add-on = `max(stress-deficit, risk-bucket sum)`.
- ICAAP narrative-data feed (4 sections: capitalAdequacy, stressTesting, pillar2, capitalPlanning).
- Independent validation by Nadia per RAS B7 model-risk discipline.

**Out of scope (deferred per dispatch brief; named in module headers):**
- **Recovery Plan** — Slice 6 territory (Helena + Owen + Rohan).
- **ILAAP liquidity-side substrate** (intraday + CFP rehearsal) — Slice 5 territory (Ravi + Eitan).
- **Real PA-published macro paths** — Mira's `WS-INSTRUMENT-ANALYSES` resolves the stress-test framework substream.
- **Multi-dimensional reverse-stress** (search over independent shock dimensions) — v1.0 enhancement (Nadia finding **N-V0.1-03**).
- **Linear-multiplicative RWA / capital coupling upgrade** to a real P&L projection — v1.0 enhancement (Nadia finding **N-V0.1-01**).
- **FX-translation overlay** — multi-currency stress arrives with M-phase markets-substrate.
- **Tax overlay** on stressed P&L — Yael's PAYE / EMP201 / IRP5 slice paused build-phase.
- **CVA stress** — held flat; Reporting Slice 4 BA 600 owns CVA stress.

## 2. Files landed

| Path | Role |
|---|---|
| `prototype/platform/risk/stress-scenarios.ts` | 4 typed scenario definitions (base / adverse / severely-adverse / reverse-stress) with per-quarter shocks; 12-quarter horizon constant; citation chain. |
| `prototype/platform/risk/stress-engine.ts` | Pure projection: `projectStress(input): StressEngineOutput` over current-state RWA + capital + liquidity + leverage. Per-entity guard on Hoz Bank; reverse-stress bisection on scalar `k`. |
| `prototype/platform/risk/pillar-2-addon.ts` | `computePillar2AddOn(input): Pillar2AddOnOutput` — `max(stress-deficit, risk-bucket sum)`. |
| `prototype/platform/risk/icaap-narrative-data.ts` | `buildIcaapNarrativeData(input): IcaapNarrativeDataFeed` — typed 4-section feed for Helena's narrative author. |
| `prototype/platform/risk/index.ts` | Public surface re-export of all four new modules. |
| `prototype/tests/stress-engine.test.ts` | 33 tests across 9 describes — per-scenario round-trip, reverse-stress invariants, Pillar-2 correctness, ICAAP feed shape, per-entity isolation, determinism, boundary errors, citations + placeholders, scenario-bundle invariants. |
| `prototype/scripts/record-d-regulatory-readiness-w2-slice-4.ts` | Idempotent `CeoDecision` emitter for `D-REGULATORY-READINESS-W2-SLICE-4`. |
| `Owner Inbox/2026-05-10_nadia_w2-slice-4-stress-engine-validation-report.md` | Nadia's independent model-validation report; accepts engine for build-phase rehearsal use; lists 5 findings (2 Major, 2 Minor, 1 Observation). |

**Files explicitly NOT touched** (respect parallel work per dispatch brief):
- `prototype/platform/risk/rwa-engine.ts` — Slice 3 substrate consumed as-is.
- `prototype/platform/risk/ras-b2-calibration.ts` — Slice 2 substrate consumed via fixture posture.
- `prototype/platform/event-store/event-types.ts` — no `StressTestRunCompleted` event needed at v0.1; engine is on-demand.
- `prototype/scripts/handlers-metadata.ts` / `handler-callables.ts` / `package.json` — known three-way collision (per `feedback_handlers_metadata_three_way_clash`).
- `prototype/platform/reporting/ba-700-capital.ts` — Reporting Slice 4 substrate; consumed as-is for current-state ratios.
- `prototype/platform/semantic/*` — Slice-1 + Slice-3 + Slice-4 RWA semantic entries; no new entries authored at this slice.

## 3. Engine API

```typescript
import {
  stressEngine,
  computePillar2AddOn,
  buildIcaapNarrativeData,
  STANDARD_STRESS_SCENARIO_BUNDLE,
  type StressEngineInput,
  type StressEngineOutput,
} from "@platform/risk";

// Step 1 — project ratios across scenarios
const stress: StressEngineOutput = stressEngine.project({
  entityId: "LE-ZA-HOZ-BANK",
  asOf: "2026-05-31T23:59:59.999Z",
  functionalCurrency: "ZAR",
  rwa: rwaEngine.compute(rwaInput),                 // Slice-3 RWA-engine output
  capital: { cet1Minor, at1Minor, t2Minor },        // BA 700 net-of-deductions
  liquidity: { hqlaMinor, netCashOutflows30dMinor, asfMinor, rsfMinor },
  leverage: { leverageExposureMinor },
  scenarios: STANDARD_STRESS_SCENARIO_BUNDLE,       // 4 standard scenarios
  sourceEventIds: ["evt-rwa-...", "evt-ba700-..."], // Principle 1 chain-back
});

// Step 2 — compute Pillar-2 add-on
const pillar2 = computePillar2AddOn({
  stress,
  riskBuckets: [
    { category: "concentration", label: "Single-name", addOnMinor: 12_000_000_00, rationale: "Top-10 names exceed 25% of CET1." },
    { category: "irrbb", label: "IRRBB", addOnMinor: 8_000_000_00, rationale: "EVE sensitivity to ±200bp parallel shift." },
  ],
  paCet1MinimumRatio: 0.045,           // PA min CET1
  managementBufferRatio: 0.015,        // RAS B2 +1.5pp (default if omitted)
});

// Step 3 — build the ICAAP narrative-data feed
const feed = buildIcaapNarrativeData({
  entityId: "LE-ZA-HOZ-BANK",
  asOf: "2026-05-31T23:59:59.999Z",
  functionalCurrency: "ZAR",
  rwa: rwaInput,
  stress,
  pillar2,
  currentCapital: { cet1Minor, at1Minor, t2Minor },
  currentLeverageExposureMinor: leverageExposureMinor,
});

// Helena's narrative author reads:
feed.capitalAdequacy.currentCet1RatioPct;
feed.stressTesting.scenarios;                       // 4 scenario summary lines
feed.stressTesting.cet1RatioPathByScenario;         // 4 × 13-quarter ratio paths
feed.pillar2.pillar2AddOnMinor;
feed.capitalPlanning.recommendedHeadroomMinor;
```

## 4. The four scenarios + shock magnitudes

| Scenario | 3-year cumulative posture (build-phase fixture) |
|---|---|
| **Base** | Credit RWA +10%, Market RWA +5%, Op RWA +8%, CET1 stock +12%, Lev exp +10%, HQLA +8%, Net outflows +5%, ASF +10%, RSF +8% |
| **Adverse** | Credit RWA +15%, Market RWA +20%, Op RWA +5%, CET1 stock +2%, Lev exp +8%, HQLA −5%, Net outflows +15%, ASF −3%, RSF +5% |
| **Severely-adverse** | Credit RWA +25%, Market RWA +35%, Op RWA +12%, CET1 stock −10%, Lev exp +5%, HQLA −15%, Net outflows +30%, ASF −10%, RSF +12% |
| **Reverse-stress** | Direction unit (cumulative shape that erodes CET1 ratio); engine bisects on scalar `k` to bind CET1 ratio at PA min (4.5%) |

Per-quarter shocks distribute the cumulative magnitude evenly via geometric mean (`cumulative^(1/12)` per quarter).

**Build-phase posture per `project_rules_bind_at_commencement`:** these are fixture-grade placeholder shocks calibrated to BCBS reference shapes, not the SARB PA-published macroprudential paths. Real paths arrive when Mira's `WS-INSTRUMENT-ANALYSES` resolves the stress-test framework substream. Engine input shape is forward-compatible.

## 5. Sample stressed CET1 ratio path (severely-adverse, build-phase synthetic)

End-to-end on the synthetic fixture (R250m total RWA, R45m CET1, R5m AT1, R10m T2):

| Quarter | CET1 ratio (%) |
|---:|---:|
| 0 (as-of) | 18.00 |
| 1 | 17.58 |
| 2 | 17.17 |
| 3 | 16.78 |
| 4 | 16.38 |
| 5 | 16.00 |
| 6 | 15.63 |
| 7 | 15.26 |
| 8 | 14.91 |
| 9 | 14.56 |
| 10 | 14.22 |
| 11 | 13.88 |
| 12 (terminal) | 13.56 |

**Reverse-stress** binds at `k = 7.251` (terminal CET1 ratio = 4.504% vs target 4.500%) — the synthetic-fixture bank has substantial headroom; reverse-stress requires a 7×-amplified shock to drive CET1 ratio to PA min.

**Pillar-2 add-on** on the synthetic fixture with the two illustrative risk buckets (`concentration` R12m + `irrbb` R8m):
- Stress-deficit: R0 (severely-adverse worst CET1 ratio 13.56% > floor 6.0%).
- Risk-bucket sum: R20m.
- **Pillar-2 add-on**: R20m (≈ 6.7% of worst-quarter RWA).

## 6. Pillar-2 add-on methodology

Per BCBS Basel III ICAAP guidance + Reg 39 (SREP equivalent):

```
pillar2AddOn = max(
  stressDeficit,            // capital required to keep CET1 above (PA min + management buffer) through severely-adverse stress
  riskBucketAddOnSum,       // sum of self-assessed bucket add-ons
)
```

Where:
- `stressDeficit = max(0, floorRatio × worstTotalRwa − worstCet1Stock)`
- `floorRatio = paCet1MinimumRatio + managementBufferRatio` (default 4.5% + 1.5% = 6.0%)
- Risk buckets: concentration / IRRBB / model-risk / business-strategic / conduct / pension-obligations / reputational / other.

**Build-phase posture:** PA has not issued an SREP / Pillar-2A letter for Hoz Bank. The engine computes a *self-assessed* Pillar-2 add-on; the SARB-issued figure replaces the self-assessment when the SREP letter arrives.

## 7. ICAAP narrative-data feed shape

Four sections, all derived from upstream substrate (no re-derivation in the narrative author):

- **`capitalAdequacy`** — current-state ratios (CET1 / Tier1 / Total / Leverage) + RWA decomposition (credit / market / operational / CVA).
- **`stressTesting`** — per-scenario summary lines (worst CET1, terminal ratios, reverse-stress scale + convergence) + per-scenario per-quarter CET1 ratio path (for chart rendering).
- **`pillar2`** — stress-deficit decomposition + per-bucket add-on lines + total Pillar-2 add-on (minor units + pp of RWA).
- **`capitalPlanning`** — RAS B2 floor ratio + base-scenario surplus + severely-adverse worst surplus + recommended headroom (Pillar-2 + management-buffer × RWA).

Helena's narrative author renders the feed into prose / markdown / docx separately. The feed shape is v0.1-stable; additive extensions in v0.x are non-breaking.

## 8. Validation independence (per RAS B7)

**Independence boundary:**
- Nadia (Independent-validation engineer, engineering — peer-in-second-line under Helena CRO) does **not** author the engine, does **not** co-author the engine specs, does **not** own remediation of findings.
- Nadia reports to Helena (Chief Risk Officer, governance) — *peer* of Rohan (Risk engineer, engineering — also under Helena CRO; engine author).
- Helena's reporting line through to the CEO is independent of the model-build line.
- Thandiwe (Chief Audit Engineer) holds third-line independent assurance over the entire model-risk discipline.

**Validation outcome:** Engine **accepted for build-phase rehearsal use**; production sign-off deferred to post-licence-day after the two Major findings remediate. Full report at [`Owner Inbox/2026-05-10_nadia_w2-slice-4-stress-engine-validation-report.md`](2026-05-10_nadia_w2-slice-4-stress-engine-validation-report.md).

## 9. Coordination with parallel work

Per CLAUDE.md "Concurrency on shared files" + dispatch brief:

- **Phase D scenario extension (Bea+Tomas).** Different code area (scenarios + accounting). No collision.
- **Reporting Slice 6 IFRS statement renderer (Bea+Atlas).** Different code area (IFRS statements). No collision.
- **W2 Slice 3 RWA engine (Bea+Camille — PR #177).** Consumed as-is; no changes to `rwa-engine.ts`.
- **W2 Slice 2 RAS B2 calibration (Helena+Rohan+Bea — PR #179).** Consumed as-is; pillar-2 add-on inherits +1.5pp management buffer.
- **D-BANK-ACCOUNT-SUBSTRATE (PR #164).** Balance projections consumed via current-state inputs.
- **Reporting Slice 1 semantic-layer registry (PR #156).** Capital classifications consumed via BA 700 generator.
- **Reporting Slice 4 BA 700 (PR #176).** Current-state ratios consumed via BA 700 output.
- **Provenance substrate.** Stress-engine output is an in-memory object; provenance tagging happens at the consumer (e.g. when Helena's narrative author writes ICAAP draft to RMS doc store).

**No dual dispatch path:** this dispatch is the single owner of `prototype/platform/risk/stress-engine.ts` + `stress-scenarios.ts` + `pillar-2-addon.ts` + `icaap-narrative-data.ts`. No `spawn_task` chip + background `Agent` duplication per `feedback_chip_vs_background_agent_duplication`.

## 10. Substrate gaps remaining

Forward-link these to the substrate roadmap:

1. **Slice 5 — ILAAP liquidity-side substrate (intraday + CFP rehearsal)** — Ravi + Eitan; lands `CfpRehearsalCompleted` event-pattern + LCR / NSFR daily projection.
2. **Slice 6 — Recovery Plan authoring (early-warning + options + governance triggers)** — Helena + Owen + Rohan; lands `RecoveryEarlyWarningTriggered` events.
3. **Real PA-published macro paths** — Mira's `WS-INSTRUMENT-ANALYSES` (Nadia finding **N-V0.1-02**).
4. **v1.0 RWA / capital coupling upgrade** — couple stressed RWA → P&L projection → retained earnings → CET1 stock (Nadia finding **N-V0.1-01**).
5. **Multi-dimensional reverse-stress** — search over independent shock dimensions (Nadia finding **N-V0.1-03**).
6. **Pillar-2 risk-bucket inventory** — first post-licence-day ICAAP run populates (Nadia finding **N-V0.1-04**).
7. **FX-translation overlay** under stress — multi-currency stress arrives with M-phase markets-substrate.
8. **Tax overlay** on stressed P&L — Yael's PAYE / EMP201 / IRP5 slice paused build-phase.
9. **CVA stress** — held flat; Reporting Slice 4 BA 600 owns.
10. **Optional `StressTestRunCompleted` event** for replay — deferred at v0.1 (compute on demand chosen to avoid `event-types.ts` collision with parallel work).

## 11. Citations

**Standing authority (Principle 2):**
- `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10).
- `D-REGULATORY-READINESS-W2-SLICE-4` (this slice — emitted by `record-d-regulatory-readiness-w2-slice-4.ts`).

**Regulatory anchors:**
- Banks Act 94 of 1990 §70 + §72 (capital adequacy + ICAAP — empowering provisions).
- Regulations Relating to Banks Reg 38 (capital adequacy) + Reg 39 (SREP equivalent — stress-testing requirement).
- BCBS Basel III ICAAP guidance + §122–§148 (buffers).
- BCBS 2018 stress-testing principles + BCBS BCBS-365 (stress testing principles).
- US Fed SR 11-7 (Model Risk Management — informs Nadia's IMVP framework).
- `ORG-PR-04` (RAS B2 — CET1 management buffer ≥ +1.5pp).
- `ORG-PR-12` (Stress-testing framework — Reg 39 + BCBS).
- `ORG-PR-17` (BCBS Operational Risk rev. 2021 — informs op-RWA stress shape).
- `ORG-PR-31` (SARB PA Guidance Note 3/2023 — Basel III/IV implementation dates).

**Operational discipline:**
- CLAUDE.md "Operating procedures" — events-first authoring + dispatch discipline (no-pause rule; worktree isolation; scaffold-commit early; identity discipline; one dispatch path per scope).
- `D-REGULATORY-PERIMETER` (per-entity isolation — Hoz Bank licence-bound; Hoz Securities + Hoz Group out of scope).
- RAS §B7 — model-risk discipline + independent-validation requirement (per Nadia's report § "Independence attestation").

## 12. Tests + recons

- `prototype/tests/stress-engine.test.ts` — 33 tests, 83 expects, all passing.
- Full prototype suite: 1054 / 1054 pass after this slice lands.
- `bun run citation-gate` — 0 violations.
- `bun run typecheck` — pre-existing baseline only (bun-types + baseUrl deprecation warning); no new errors.

## 13. Forward links

- **Reporting Slice 4 (BA 700)** — current-state ratios consumed.
- **W2 Slice 5 (ILAAP)** — Ravi + Eitan ship intraday + CFP rehearsal harness; consumes stress-engine for narrative-data crosswalk.
- **W2 Slice 6 (Recovery Plan)** — Helena + Owen + Rohan; uses early-warning indicators tied to RAS lines + recovery options; consumes stress-engine output for plan-activation calibration.
- **W2 Slice 7 (First end-to-end ICAAP / ILAAP / Recovery dry-run)** — Helena + Eitan + Mira; uses this engine end-to-end against the synthetic fixture.
- **Future `D-REGULATORY-READINESS-W2-SLICE-4-V1.0`** — couples RWA / capital via P&L projection (Nadia **N-V0.1-01**); replaces fixture shocks with real PA-published macro paths (Nadia **N-V0.1-02**); promotes reverse-stress to multi-dimensional search (Nadia **N-V0.1-03**).
