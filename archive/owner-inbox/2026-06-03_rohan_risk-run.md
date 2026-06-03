---
agent: Rohan
trigger: risk-run
asOf: 2026-06-03T05:44:50.400Z
decision-required: false
---

# Rohan — daily risk run, 2026-06-03

Autonomous run of Rohan's daily risk run per `Team/Rohan.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Fifth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Closes the engineer-side of Helena's measurement-substrate gap.

**Headline:** 13 appetite lines tracked · measurement readiness 0 ready / 3 drafting / 7 specified / 3 not-yet-specified · 0 position events (last 7d) · 791 RiskRaised events.

## Helena's latest snapshot

Latest `RiskAppetiteSnapshot` event: 2026-06-03T05:44:02.721Z

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
| medium | 565 |
| high | 226 |

## Substrate gaps surfaced this run

- **CDM bindings (Kai)** — pre-condition for any market-risk measurement. M1 is in flight under D-MARKETS-SCHEMA-FOUNDATION.
- **Capital-base projection (Bea + Rohan)** — pre-condition for CET1 buffer measurement (the most load-bearing tier-1 line).
- **HQLA / NSFR projections (Ravi)** — pre-condition for liquidity buffer measurement.
- **Model registry (Rohan)** — substrate exists for zero models today; first model entry blocks on first measurement.
- **Independent-validation function (Nolan hire)** — RAS § B7 model-tier discipline depends on independent-validation capacity.
- **Climate-scenario substrate** — multi-quarter build; defer to 2026 H2 unless PA cadence forces earlier.
- **Structured RAS register** — appetite lines mirrored in two places (Helena's handler + this handler); folds into a single canonical register when authored.

## Rohan's narrative

Headline: zero measurements fired this run — we are squarely in build phase, with 0 position events across 7 days and no Rohan-owned engine in production. Of the 13 appetite lines in Helena's 2026-06-03 snapshot, 8 carry a Rohan-side substrate obligation; of those, only three are specified-and-buildable today against synthetic seeds (LCR, NSFR, CET1 buffer), and the load-bearing block on Helena's first measured RAS run is **appetite:capital:cet1-buffer**. Liquidity (Reg 26 LCR, BCBS NSFR 2014) sits in Ravi's runtime; market/credit appetite lines (FRTB VaR, SA-CCR per BCBS d317, single-name and sector concentration under the BCBS Credit Risk Framework) are correctly deferred to first CDM contract and first counterparty activation; IFRS 9 ECL has no substrate obligation yet because there is no portfolio. That leaves CET1 as the one capital-stack measurement that should fire from day one against Bea's synthetic capital line, and it is the gating input to any ICAAP-shaped RAS pack.

Two further observations worth ranking. First, **791 RiskRaised events in 7 days (226 high, 565 medium) against zero registered appetite-line owners on my side** — none of these are currently routed to an appetite line in the snapshot, which means they are accumulating as un-triaged signal rather than measured breach pressure. This is a substrate gap, not a governance one: I need a RiskRaised → appetite-line mapping table before the next snapshot cycle so Helena sees these inside the RAS frame rather than as a parallel queue. Second, **the model registry itself is unbuilt**, which gates appetite:model:tier-discipline and, transitively, any ICAAP measurement that depends on tiered model output (VaR, SA-CCR, ECL once portfolios activate); under Banks Act 94 of 1990 and the BCBS Credit Risk Framework's model-governance expectations, the registry is substrate even when the model count is zero, and Independent Validation (Nolan hire) is the long-lead dependency.

Next engineering move, in order: (1) draft the **capital-base projection v0** — CET1 numerator, RWA denominator, Pillar 2A and combined-buffer stack per Banks Act Reg 38 — against Bea's synthetic capital seed, so the CET1 buffer line in RAS § capital can fire on the next risk-run; (2) stand up the **model registry skeleton** (tiering schema, validation-state field, production-use flag) with zero rows but a live entry-point, and raise the Independent Validation hire formally to Nolan; (3) build the **RiskRaised → appetite-line classifier** so the 791-event backlog routes into Helena's snapshot rather than around it. LCR/NSFR specs I will hand to Ravi in parallel but they are his runtime, not mine. Climate (PA GN 1 of 2024) and FRTB VaR remain correctly parked behind their respective preconditions.

## Provenance

Helena's latest `RiskAppetiteSnapshot` via `eventStore.replay({type:"RiskAppetiteSnapshot"})` (max as_of); appetite-line shadow mirrored from `runtime/agents/helena-risk-appetite-watch.ts`; readiness map curated by Rohan; position-event count via `eventStore.replay({type:"TradeBooked|PositionAdjusted|CollateralUpdated"})`; RiskRaised counts via `eventStore.replay({type:"RiskRaised"})` filtered to last 7 days.
