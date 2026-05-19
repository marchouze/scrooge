---
policy-id: VALUATION-POLICY-V1
title: Valuation Policy
version: "1.0"
status: ACTIVE
owner: Helena (Chief Risk Officer, governance)
effective-from: "2026-05-19"
citations:
  - "IFRS 13 Fair Value Measurement: §§9–31 (fair value hierarchy; observable vs unobservable inputs)"
  - "FSCA Conduct Standard 3 of 2018 §8: daily valuation methodology for OTC derivative transactions; consistent and documented"
  - "Banks Act 94 of 1990 s90: accounting records — mark-to-market and fair value"
  - "Policies/pricing-policy-v1.md: transaction pricing and IPV process"
  - "Policies/accounting-policies-ifrs-v1.md: IFRS 13 fair value hierarchy codification"
author: Helena (Chief Risk Officer, governance)
reviewed-by: Rohan (Market risk engineer, engineering)
date: 2026-05-19
summary: >
  Valuation Policy governing market data sourcing, staleness thresholds, MTM run frequency,
  and data provenance rules for financial reporting. Applies to OTC FX, OTC IRD, and JSE-listed
  fixed income. Establishes the production-vs-simulated provenance gate and the fallback source
  hierarchy for each instrument class. Partially closes ORG-CS3-006 (daily valuation methodology
  under CS 3/2018 §8) and ORG-AC-08 (fair value hierarchy under IFRS 13).
decision-required: false
riskTaxonomy:
  - RT-MR.GN
  - RT-OP.PR
  - RT-LR.RC
---

# Valuation Policy

> **Author.** Helena (Chief Risk Officer, governance).
> **Reviewer.** Rohan (Market risk engineer, engineering).
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Authored under the events-first authoring rule and the no-pause dispatch rule — CLAUDE.md "Operating procedures".
> **Obligations partially closed.** `ORG-CS3-006` (daily valuation methodology under CS 3/2018 §8); `ORG-AC-08` (fair value hierarchy under IFRS 13 §§9–31).
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Purpose and Scope

This policy governs the selection of market data inputs, staleness thresholds, mark-to-market (MTM) run frequency, and data provenance rules used in the bank's financial reporting, risk measurement, and regulatory returns.

### 1.1 Relationship to other policies

- **Pricing Policy (`pricing-policy-v1.md`)** governs transaction pricing methodology and the Independent Price Verification (IPV) process — the "what price do we trade at?" question. This Valuation Policy governs the data inputs that feed those processes — the "where does the rate data come from, how fresh must it be, and how do we know it is real?" question.
- **Accounting Policies — IFRS (`accounting-policies-ifrs-v1.md`)** codifies the IFRS 13 fair value hierarchy (Levels 1, 2, 3) and measurement rules. This policy operationalises those rules by specifying the concrete market data sources and provenance controls that support each level.

### 1.2 In scope (v1)

- OTC FX instruments: spot, forward, swap, NDF
- OTC IRD instruments: IRS (interest-rate swap), basis swap, FRA
- JSE-listed fixed income: South African government bonds and other JSE-listed bonds

### 1.3 Out of scope (v1)

- Equities (JSE-listed equities — planned for v2; equities are Level 1 per JSE closing price and present lower valuation complexity)
- Retail products (bank is institutional-only; retail activates at licence-day)
- Credit derivatives (covered by the Credit Risk Policy under Camille (CFO, governance) and Helena)

---

## 2. Regulatory Framework

| Authority | Requirement |
|---|---|
| IFRS 13 §§9–31 | Fair value hierarchy (Levels 1–3); principal market; observable vs unobservable inputs; hierarchy classification must be re-assessed at each reporting date |
| FSCA Conduct Standard 3/2018 §8 | Daily valuation methodology for OTC derivatives; the methodology must be consistent and documented; agreed with counterparties in advance where required by the trading-relationship agreement |
| Banks Act 94/1990 s.90 | Proper accounting records at all times that fairly reflect the bank's transactions and financial position; records must be retained for a minimum of five years |
| BCBS 239 (Principle 6 — accuracy) | Risk data, including market inputs, must be accurate and reliable; price-source identification and provenance lineage are explicit BCBS 239 requirements (`BCBS-239-2013` in the obligations register) |

**Obligations register cross-reference.**

- `ORG-CS3-006` — CS 3/2018 §8 daily valuation; owner: Rohan (Market risk engineer, engineering) with Bea (Finance / treasury engineer, engineering). Status: DRAFTING → this policy partially closes it.
- `ORG-AC-08` — IFRS 13 fair value hierarchy; owner: Camille (CFO, governance). Status: IN_FORCE → this policy supplies the operational valuation-input controls.
- `ORG-AC-05` — IFRS 13 fair value measurement framework application; this policy is the operational instrument.

---

## 3. Market Data Source Hierarchy

For each instrument class, the following ordered fallback chains apply. Source 1 is always preferred; subsequent sources are fallbacks applied in order when source 1 is unavailable or breaches the staleness threshold in §5.

### 3.1 FX Spot and Forward Rates

| Priority | Source | Conditions |
|---|---|---|
| 1 | `MarketDataStore` where `provenance = "production"` and `dataType = "fx-quote"` | Intraday: age ≤ 15 minutes; EOD run: age ≤ 1 business day |
| 2 | SARB published daily fixing rate (sarb.org.za) | Available by approximately 15:00 SAST each business day; used as current fallback during build phase (see §4 substrate note) |
| 3 | Reuters / Bloomberg published fixing | Pre-go-live item — applicable once Bloomberg BFIX or Reuters WM-Fix subscription is live |

**Build-phase note.** As of 2026-05-19, `MarketDataSources.FX_SIM` (`"fx-sim"`) produces `provenance = "simulated"` data only. No production FX quote feed is connected. Source 2 (SARB fixing) is the operative fallback for any real trade valuation until a production feed is integrated. See §9 (Substrate Gaps).

### 3.2 Interest Rate Curves (ZAR JIBAR, ZAR Swap Curve)

| Priority | Source | Conditions |
|---|---|---|
| 1 | JSE published end-of-day swap curve (ZARGOV, ZARIRS) | Age ≤ 1 business day |
| 2 | Bloomberg BVAL | Pre-go-live item — once Bloomberg subscription is live |
| 3 | Bootstrapped from liquid market instruments (model fallback) | Requires prior written sign-off from Helena (CRO, governance); triggers a `ModelFallbackUsed` event (planned); all positions valued under this fallback are flagged in the MTM run report |

### 3.3 JSE Bond Clean Prices

| Priority | Source | Conditions |
|---|---|---|
| 1 | JSE end-of-day clean prices | Published by JSE daily after close; age ≤ 1 business day |
| 2 | Matrix pricing from yield curve | Applied where the JSE price is unavailable; method approved by Helena; triggers risk flag in MTM run output |

### 3.4 JSE SENS Announcements (Corporate Action Adjustments)

| Priority | Source | Conditions |
|---|---|---|
| 1 | `MarketDataStore` where `provenance = "production"` and `dataType = "sens-announcement"` | Sharenet 15-minute delay feed (live via `scripts/agents/sens-ingest.ts`); source = `"jse-sens"` |

SENS is the only instrument class for which a production feed (`provenance = "production"`) is currently connected. The ingest agent runs on a 15-minute launchd schedule and stores records with `source: "jse-sens"`, `dataType: "sens-announcement"`, `provenance: "production"`.

---

## 4. Data Provenance Rule

This section is mandatory and non-waivable. No exception process exists; any deviation requires a new CEO decision and a policy amendment.

### 4.1 Production-only gate

Only market data with **`provenance = "production"`** in the `MarketDataStore` (`platform/market-data/store.ts`) may be used for:

- P&L reporting (daily, monthly, or annual)
- Margin call calculations
- Financial statement preparation (IFRS 9 / IFRS 13 measurements)
- SARB prudential regulatory returns (BA returns)
- Independent Price Verification (IPV) runs
- Any client-facing or counterparty-facing valuation

### 4.2 Simulated data — prohibited in production

Data with **`provenance = "simulated"`** is produced exclusively by the EnvSim engine (`platform/simulation/env-sim/`) for build-phase scenario testing and CI. It must **never** enter a production valuation run.

The `MarketDataSources.FX_SIM = "fx-sim"` source in `platform/market-data/types.ts` produces `provenance = "simulated"` data. Any production valuation query that fails to filter by `provenance: "production"` and returns simulated data is a **Principle 1 violation** — the event store would record synthetic inputs as financial facts.

### 4.3 Query discipline

The `MarketDataStore.query()` interface (`platform/market-data/store.ts`) supports `provenance` as an explicit filter in `MarketDataQueryOptions`. All production valuation code must pass:

```ts
store.query({ provenance: "production", dataType: "fx-quote", ... })
```

Omitting the `provenance` filter in any production valuation code path is a finding. Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance) will assert this via `recon:market-data-provenance-gate` (planned).

### 4.4 Build-phase posture

As of the current build phase:

- **FX quote data:** `FX_SIM` source is `provenance = "simulated"`. No production FX quote feed is connected. Valuation runs against real trades must use the SARB daily fixing fallback (§3.1, Source 2) until a production FX feed is integrated — a pre-go-live milestone.
- **SENS data:** `jse-sens` source is `provenance = "production"`. This is the only production market data feed currently live.
- **Bond and rate curve data:** no ingest agent connected; manual or SARB fixing fallback applies.

---

## 5. Staleness Thresholds

A market data tick is considered **stale** if its `asOf` timestamp exceeds the threshold in the table below, measured at the time of the valuation run.

| Instrument / Input | Intraday MTM max age | EOD MTM max age | Action on breach |
|---|---|---|---|
| FX spot (production feed) | 15 minutes | 1 business day | Fall back to next source in §3.1 hierarchy |
| FX forward points | 1 business day | 1 business day | Fall back to interpolation from rate curve |
| ZAR swap curve (JSE) | 1 business day | 1 business day | Fall back to prior-day curve with risk flag in MTM run output |
| JSE bond clean price | 1 business day | 1 business day | Matrix pricing fallback (§3.3 Source 2) |
| SARB fixing rate | 1 business day | 1 business day | Escalate to Helena (CRO, governance) immediately |
| SENS announcements | 15 minutes (intraday) | 1 business day | Re-trigger ingest agent; flag if still unavailable |

**Breach handling — all instrument classes:**

1. Log a `MarketDataStaleAlert` event (planned event type — see §9, Gap 2) identifying the instrument, source, threshold, and actual age.
2. Fall back to the next source in the §3 hierarchy.
3. If no source within threshold is available, the MTM run is **suspended** for that instrument; Helena (CRO, governance) is notified and the run output is flagged as partial.
4. Partial MTM run outputs must not be used for P&L reporting or regulatory returns without Helena's explicit written sign-off.

---

## 6. MTM Run Frequency

### 6.1 Trading book (OTC FX and OTC IRD)

- **Minimum:** end-of-day MTM run, every business day
- **Intraday:** available on demand via `bun run mtm:run` (planned — see §9, Gap 3); used for intraday risk monitoring and margin call calculations
- **Trigger events:** any `FxTradeExecuted` or `IrdSwapExecuted` event triggers an incremental position update; the EOD run performs a full portfolio revaluation

### 6.2 Banking book (JSE bonds at amortised cost — hold-to-collect)

- **EIR accrual:** daily; performed by Bea (Finance / treasury engineer, engineering) via the accrual engine
- **Fair value disclosure (IFRS 13 §93):** quarterly; for IFRS 7 disclosure purposes only — no P&L impact under amortised cost measurement
- **Impairment (ECL):** per `Policies/ifrs9-ecl-provisioning-policy-v1.md` (if published); at minimum quarterly

### 6.3 FVOCI instruments

- **Fair value measurement:** daily; OCI movement computed daily and posted to the OCI reserve per `accounting-policies-ifrs-v1.md §3.1.3`
- **Reclassification:** on derecognition, cumulative OCI transferred to retained earnings (equity instruments) or P&L (debt instruments) per IFRS 9 §5.7.5

### 6.4 Run authorisation

All EOD MTM runs are owned by Rohan (Market risk engineer, engineering) with outputs reviewed by Helena (CRO, governance). Any deviation from the scheduled EOD run requires Helena's written approval and is recorded as a `MtmRunException` event (planned).

---

## 7. Independent Price Verification (IPV)

### 7.1 Reference to Pricing Policy

The IPV process, frequency, tolerance thresholds, and exception resolution workflow are defined in `Policies/pricing-policy-v1.md §5`. This section adds valuation-data-specific rules that govern the inputs to any IPV run.

### 7.2 Provenance gate for IPV

IPV must source prices **exclusively** from `provenance = "production"` data in the `MarketDataStore`. Any IPV run that used simulated data (even partially) is invalid and must be rerun against production sources before its results may be used for P&L reporting, margin calls, or regulatory returns.

### 7.3 IPV frequency by IFRS 13 level

| IFRS 13 Level | Instruments | IPV frequency |
|---|---|---|
| Level 1 | JSE-listed on-the-run government bonds; major FX pairs (USD/ZAR, EUR/ZAR) with observable closing rates | Daily |
| Level 2 | OTC FX forwards / swaps; OTC IRD (IRS, basis swap, FRA) from observable yield curves; off-the-run bonds | Daily |
| Level 3 | Bespoke structured products; instruments with significant unobservable inputs | Weekly; enhanced IPV per `pricing-policy-v1.md §5.3` |

Level 3 instruments additionally require a `Level3FvApproved` event (planned) from Camille (CFO, governance) each quarter per `accounting-policies-ifrs-v1.md §3.3.2`.

### 7.4 Secondary source independence

The IPV secondary source must be independent of the primary valuation source (i.e. not the same `MarketDataStore` tick). Acceptable secondary sources in priority order:

1. SARB published fixing (for FX)
2. Bloomberg BVAL (once subscribed)
3. Dealer quotes (minimum 2 dealers; midpoint used)

---

## 8. Governance

| Decision | Authority | Notes |
|---|---|---|
| Approve new valuation model | Helena (CRO, governance) | Requires Rohan (Market risk engineer, engineering) model validation gate first; `ModelValidationApproved` event required before production use |
| Approve change to market data source hierarchy (§3) | Helena (CRO, governance) | With Rohan impact assessment; policy amendment required |
| Approve use of Level 3 model for a new instrument | Helena (CRO, governance) + CEO | Material decision; CEO escalation per decision authority routing table in CLAUDE.md |
| Connect a new production data feed | Devon (Chief Operating Officer, engineering) + Helena sign-off | Infrastructure + governance dual sign; `ProductionFeedConnected` event (planned) required |
| Declare MTM run suspended | Helena (CRO, governance) | Notifies Devon and Camille (CFO, governance) same business day; `MtmRunSuspended` event (planned) |
| Approve bootstrap curve as rate fallback (§3.2 Source 3) | Helena (CRO, governance) | Written sign-off; time-limited; triggers `ModelFallbackUsed` event (planned) |
| Approve partial MTM run output for P&L or regulatory use | Helena (CRO, governance) | Required where any instrument's MTM is missing or estimated |

### 8.1 Recon coverage (planned)

Vera (Internal audit / continuous-assurance engineer, engineering) will assert the following recon pipelines:

| Recon pipeline | What it asserts | Cadence |
|---|---|---|
| `recon:market-data-provenance-gate` | Every production valuation query passes `provenance: "production"` filter | Daily |
| `recon:mtm-run-completeness` | An EOD MTM run record exists for every business day with a non-empty trading book | Daily |
| `recon:ipv-secondary-source-independence` | IPV secondary source is not the same tick as primary source | Daily |
| `recon:staleness-threshold-compliance` | No tick older than the §5 thresholds was used in any MTM run | Daily |

---

## 9. Substrate Gaps

The following gaps exist in the current build phase. Each is a pre-go-live roadmap item.

| Gap | Description | Owner | Priority |
|---|---|---|---|
| Gap 1 — No production FX quote feed | `MarketDataSources.FX_SIM` is the only FX source; it produces `provenance = "simulated"`. SARB daily fixing is the current fallback for real trade valuation. A real-time or end-of-day production FX feed (Bloomberg BFIX, Reuters WM-Fix, or direct SARB API) must be connected before commencement of trading. | Devon (COO, engineering) + Helena sign-off | Pre-go-live gate |
| Gap 2 — `MarketDataStaleAlert` event type | The `MarketDataStaleAlert` event type is referenced in §5 but not yet defined in the event store. Until defined, stale-data breaches are logged as console warnings only. | Atlas (Data infrastructure engineer, engineering) | Next compliance-substrate slice |
| Gap 3 — `bun run mtm:run` command | Intraday and EOD MTM run command not yet built. Manual revaluation via `bun run fx:revalue` covers FX positions; a unified MTM orchestrator covering all instrument classes is needed. | Rohan (Market risk engineer, engineering) | Markets substrate sprint |
| Gap 4 — JSE bond price ingest agent | Analogous to `scripts/agents/sens-ingest.ts` for SENS, a JSE bond end-of-day clean price ingest agent is needed. JSE publishes EOD prices via the JSE Data Portal. | Devon (COO, engineering) | Pre-go-live gate |
| Gap 5 — Interest rate curve ingest agent | ZAR JIBAR swap curve and ZARGOV / ZARIRS data must be ingested from JSE end-of-day publications. No ingest agent exists; until live, the SARB fixing or manual override is used. | Rohan (Market risk engineer, engineering) | Pre-go-live gate |
| Gap 6 — `recon:market-data-provenance-gate` pipeline | Vera recon harness asserting provenance filter discipline on all production valuation code paths; not yet implemented. | Vera (Internal audit / continuous-assurance engineer, engineering) | Next Vera Wave sprint |
| Gap 7 — `ModelValidationApproved` event type | Model validation approval event referenced in §8 and `accounting-policies-ifrs-v1.md §3.3.3` but not yet defined in the event store. | Atlas (Data infrastructure engineer, engineering) | Next compliance-substrate slice |

---

## 10. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-05-19 | Helena (Chief Risk Officer, governance) | Initial draft — market data source hierarchy, staleness thresholds, provenance rules, MTM run frequency, IPV data requirements, governance table, substrate gaps. Partially closes ORG-CS3-006 and ORG-AC-08. |
