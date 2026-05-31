---
agent: Rohan
trigger: risk-run
asOf: 2026-05-31T09:30:51.155Z
decision-required: false
---

# Rohan — daily risk run, 2026-05-31

Autonomous run of Rohan's daily risk run per `Team/Rohan.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Fifth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Closes the engineer-side of Helena's measurement-substrate gap.

**Headline:** 13 appetite lines tracked · measurement readiness 0 ready / 3 drafting / 7 specified / 3 not-yet-specified · 0 position events (last 7d) · 693 RiskRaised events.

## Helena's latest snapshot

Latest `RiskAppetiteSnapshot` event: 2026-05-31T04:30:53.198Z

Rohan's daily run pairs with Helena's daily run: Helena reports the appetite side; Rohan reports the engineer side. Together they close the read-side ↔ build-side loop on the RAS measurement substrate.

## Measurement readiness by appetite line

| Appetite line | Engineer-side state | Substrate required | Next engineering step |
|---|---|---|---|
| `appetite:liquidity:lcr` | specified | Liquidity coverage ratio projection — HQLA inventory + 30-day net cash outflow model. Owner: Ravi (treasury eng). | Specify HQLA classification rules per Banks Act Reg 26; build first-cut projection against synthetic balance. |
| `appetite:liquidity:nsfr` | specified | Net stable funding ratio projection — available stable funding vs required stable funding model. Owner: Ravi. | Specify ASF / RSF factor table per BCBS NSFR (2014); same projection-runtime as LCR. |
| `appetite:capital:cet1-buffer` | specified | Capital-base projection — CET1 numerator + RWA denominator + Pillar 2A + buffers. Owner: Bea (acc eng) joint with Rohan. | Specify capital-base derivation per Banks Act Reg 38; build against the synthetic capital line in seeds. |
| `appetite:credit:single-name-concentration` | not-yet-specified | Single-name exposure projection — credit RWA with obligor aggregation. Owner: Rohan. | Defer to first-portfolio activation; specify cascade alongside Saskia's first counterparty. |
| `appetite:credit:sector-concentration` | not-yet-specified | Sector concentration projection — credit RWA aggregated by sector code. Owner: Rohan. | Defer; first portfolio defines the sector taxonomy. |
| `appetite:market:trading-var` | specified | Trading-book 1-day 99% VaR engine — historical-simulation v0 against CDM positions. Owner: Rohan. | Wait for Kai's M1 CDM TypeScript bindings (in flight under D-MARKETS-SCHEMA-FOUNDATION); first VaR fires when first CDM contract booked. |
| `appetite:market:counterparty-concentration` | specified | Counterparty PFE projection — SA-CCR per BCBS d317. Owner: Rohan joint with Kai. | Specify SA-CCR table at first counterparty onboarding (Niko activation). |
| `appetite:financial-crime:sanctions-match` | drafting | Mira's screening pipeline — gate enforces; no Rohan substrate required. Measurement is pass/fail event count. | Out of Rohan's scope; Mira owns. |
| `appetite:financial-crime:str-filing-judgement` | drafting | Mira's transaction-monitoring pipeline + Zara's MLRO judgement. No Rohan substrate. | Out of Rohan's scope. |
| `appetite:operational:cyber-severity-tiers` | specified | Senna's incident-severity classification + RAS § B6 tier mapping. Operational-risk projection consumes downstream. | Out of Rohan's primary scope; co-consumer of Senna's outputs for op-risk taxonomy. |
| `appetite:model:tier-discipline` | specified | Model registry + independent-validation function. Owner: Rohan (registry); independent-validation team (Nolan hire). | Build model registry (no models in build phase, but registry is substrate); flag Independent Validation hire to Nolan. |
| `appetite:climate:guidance-note-1-2024` | not-yet-specified | Climate-scenario substrate — transition-risk taxonomy + physical-risk geocoding + scenario engine. Owner: Helena (governance) joint with Rohan (eng). | Specify per PA GN 1 of 2024; multi-quarter build; defer until 2026 H2 unless PA cadence forces earlier. |
| `appetite:conduct:tcf` | drafting | Niko's advice-record pipeline + Mira's conduct-monitoring + Zara's FAIS supervision. No Rohan substrate. | Out of Rohan's scope; activates with Niko at commencement of trading. |

## Position events (last 7 days)

| Event class | Count |
|---|---|
| `TradeBooked` + `PositionAdjusted` + `CollateralUpdated` | 0 |

_Build-phase posture: zero position events. Kai's M1 CDM TypeScript bindings (in flight under D-MARKETS-SCHEMA-FOUNDATION) are the precondition; the first `TradeBooked` event activates the position-incremental risk-update path._

## RiskRaised events (last 7 days)

| Severity | Count |
|---|---|
| medium | 495 |
| high | 198 |

## Substrate gaps surfaced this run

- **CDM bindings (Kai)** — pre-condition for any market-risk measurement. M1 is in flight under D-MARKETS-SCHEMA-FOUNDATION.
- **Capital-base projection (Bea + Rohan)** — pre-condition for CET1 buffer measurement (the most load-bearing tier-1 line).
- **HQLA / NSFR projections (Ravi)** — pre-condition for liquidity buffer measurement.
- **Model registry (Rohan)** — substrate exists for zero models today; first model entry blocks on first measurement.
- **Independent-validation function (Nolan hire)** — RAS § B7 model-tier discipline depends on independent-validation capacity.
- **Climate-scenario substrate** — multi-quarter build; defer to 2026 H2 unless PA cadence forces earlier.
- **Structured RAS register** — appetite lines mirrored in two places (Helena's handler + this handler); folds into a single canonical register when authored.

## Rohan's narrative

Headline: the risk-measurement substrate is at zero measurements fired — build phase, no TradeBooked / PositionAdjusted events in the last seven days, no VaR run, no LCR run, no CET1 walk. Eleven of thirteen appetite lines have substrate either specified or drafting; two (credit single-name and sector concentration) are correctly deferred until Saskia's first portfolio defines obligor and sector taxonomy. The load-bearing block on Helena's first end-to-end measured RAS run is **appetite:capital:cet1-buffer** — it is the one line that can fire against the synthetic seed today (no portfolio activation, no CDM binding, no counterparty onboarding required), and until it fires Helena has no quantitative anchor for the ICAAP measurement loop required under Banks Act 94 of 1990 Reg 38 and RAS § B3.

Three consequential observations. (1) **CET1 buffer is one engineering ticket from green**: capital-base derivation per Reg 38 against the synthetic capital line is specified, owner is joint with Bea, no upstream dependency — this should be the next projection built, not deferred behind market-risk substrate. (2) **693 RiskRaised events in seven days (198 high, 495 medium) with no appetite-line-owner mapping visible in the readiness view** — I cannot attest that every raised risk routes to an inventoried appetite line until the RiskRaised → appetite-line cascade is wired; this is an engineering ticket on me, not a governance gap for Helena. (3) **Model registry is substrate, not optional**: appetite:model:tier-discipline gates ICAAP per RAS § B5, and even with zero models in production the registry shell + tier-classification schema must exist before the first model (HS-VaR v0, SA-CCR, LCR projection, capital-base projection) is admitted — otherwise the first model goes in unregistered and we breach our own tier-discipline line on day one. Independent-validation hire flagged to Nolan; the registry itself is mine.

Next engineering move, in order: (a) draft capital-base projection v0 per Reg 38 against synthetic seed, joint with Bea, target first CET1 measurement this cycle; (b) stand up the model registry shell with tier-classification fields per SARB Directive 4/2018 lineage and BCBS BCBS239 traceability so HS-VaR v0, SA-CCR (BCBS d317), the LCR projection (BCBS LCR 2013 / Reg 26), and the capital-base projection can be admitted as production-use vs validation-pending; (c) wire the RiskRaised → appetite-line owner mapping so the 693-event backlog is attributable. FRTB-IMA, IFRS 9 ECL staging, and PA GN 1 of 2024 climate scenarios all remain correctly out of scope this cycle — they are multi-quarter builds and not load-bearing on the first measured run.

## Provenance

Helena's latest `RiskAppetiteSnapshot` via `eventStore.replay({type:"RiskAppetiteSnapshot"})` (max as_of); appetite-line shadow mirrored from `runtime/agents/helena-risk-appetite-watch.ts`; readiness map curated by Rohan; position-event count via `eventStore.replay({type:"TradeBooked|PositionAdjusted|CollateralUpdated"})`; RiskRaised counts via `eventStore.replay({type:"RiskRaised"})` filtered to last 7 days.
