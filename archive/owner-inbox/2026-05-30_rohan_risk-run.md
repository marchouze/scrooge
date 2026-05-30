---
agent: Rohan
trigger: risk-run
asOf: 2026-05-30T03:43:59.321Z
decision-required: false
---

# Rohan — daily risk run, 2026-05-30

Autonomous run of Rohan's daily risk run per `Team/Rohan.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Fifth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Closes the engineer-side of Helena's measurement-substrate gap.

**Headline:** 13 appetite lines tracked · measurement readiness 0 ready / 3 drafting / 7 specified / 3 not-yet-specified · 0 position events (last 7d) · 483 RiskRaised events.

## Helena's latest snapshot

Latest `RiskAppetiteSnapshot` event: 2026-05-29T09:52:49.783Z

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
| medium | 345 |
| high | 138 |

## Substrate gaps surfaced this run

- **CDM bindings (Kai)** — pre-condition for any market-risk measurement. M1 is in flight under D-MARKETS-SCHEMA-FOUNDATION.
- **Capital-base projection (Bea + Rohan)** — pre-condition for CET1 buffer measurement (the most load-bearing tier-1 line).
- **HQLA / NSFR projections (Ravi)** — pre-condition for liquidity buffer measurement.
- **Model registry (Rohan)** — substrate exists for zero models today; first model entry blocks on first measurement.
- **Independent-validation function (Nolan hire)** — RAS § B7 model-tier discipline depends on independent-validation capacity.
- **Climate-scenario substrate** — multi-quarter build; defer to 2026 H2 unless PA cadence forces earlier.
- **Structured RAS register** — appetite lines mirrored in two places (Helena's handler + this handler); folds into a single canonical register when authored.

## Rohan's narrative

Headline: measurement substrate is in build phase — zero position events, zero VaR/LCR/NSFR/CET1 projections firing, thirteen appetite lines inventoried in Helena's snapshot of which only four sit on my engineering surface as specified-but-unbuilt (LCR, NSFR, CET1 buffer, trading VaR). The load-bearing block on Helena's first end-to-end measured RAS run is the **capital-base projection backing `appetite:capital:cet1-buffer`** (RAS § on capital adequacy, Banks Act 94 of 1990 Reg 38, Basel III CET1 stack). LCR/NSFR sit with Ravi and have a clearer runtime path; trading VaR is correctly blocked on Kai's CDM bindings and on the first booked contract — there is nothing to measure until there is a position. CET1 is the only line where the projection is mine-and-Bea's, the synthetic capital seed is already in place, and no upstream dependency is missing — i.e. it is one engineering ticket away from a first numerical reading against synthetic balance.

Two further observations worth flagging. First, 483 RiskRaised events in seven days (138 high) against zero registered appetite-line owners on the engineering side: I cannot route these to a measurement until each event class is mapped to an appetite line in Helena's snapshot — most are presumably operational/cyber feeding Senna's tier mapping (RAS § B6), but without that mapping the engineering substrate cannot produce an attributable measurement and these events sit in an unowned queue. Second, `appetite:model:tier-discipline` is specified but the model registry itself does not yet exist as substrate; this gates ICAAP measurement irrespective of how few models are in production today, because ICAAP requires evidence of independent validation coverage (Banks Act Reg 39; BCBS Credit Risk Framework on IRB model governance; BCBS FRTB on internal-model approval). The Independent Validation hire needs to be raised to Nolan now, not when the first model goes live.

Next engineering move, in order: (1) draft the capital-base projection v0 — CET1 numerator, RWA denominator (credit SA per BCBS CRE, market SA per FRTB SA), Pillar 2A, combined buffer — against the synthetic capital line per Reg 38, so Helena's first RAS run has at least one measured appetite line; (2) stand up the model registry shell (entity, tier, validation-state, last-backtest fields) even with zero models loaded, so `model:tier-discipline` has substrate to read against and the IFRS 9 ECL model — when drafted — has a registry slot waiting; (3) raise a ticket back to Helena to map the 483 RiskRaised event taxonomy onto appetite-line owners before next week's risk-run, so the event walk produces attributable readings rather than an unowned queue.

## Provenance

Helena's latest `RiskAppetiteSnapshot` via `eventStore.replay({type:"RiskAppetiteSnapshot"})` (max as_of); appetite-line shadow mirrored from `runtime/agents/helena-risk-appetite-watch.ts`; readiness map curated by Rohan; position-event count via `eventStore.replay({type:"TradeBooked|PositionAdjusted|CollateralUpdated"})`; RiskRaised counts via `eventStore.replay({type:"RiskRaised"})` filtered to last 7 days.
