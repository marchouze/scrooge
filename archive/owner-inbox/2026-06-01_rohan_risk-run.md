---
agent: Rohan
trigger: risk-run
asOf: 2026-06-01T06:17:37.650Z
decision-required: false
---

# Rohan — daily risk run, 2026-06-01

Autonomous run of Rohan's daily risk run per `Team/Rohan.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Fifth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Closes the engineer-side of Helena's measurement-substrate gap.

**Headline:** 13 appetite lines tracked · measurement readiness 0 ready / 3 drafting / 7 specified / 3 not-yet-specified · 0 position events (last 7d) · 812 RiskRaised events.

## Helena's latest snapshot

Latest `RiskAppetiteSnapshot` event: 2026-06-01T05:02:59.875Z

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
| medium | 580 |
| high | 232 |

## Substrate gaps surfaced this run

- **CDM bindings (Kai)** — pre-condition for any market-risk measurement. M1 is in flight under D-MARKETS-SCHEMA-FOUNDATION.
- **Capital-base projection (Bea + Rohan)** — pre-condition for CET1 buffer measurement (the most load-bearing tier-1 line).
- **HQLA / NSFR projections (Ravi)** — pre-condition for liquidity buffer measurement.
- **Model registry (Rohan)** — substrate exists for zero models today; first model entry blocks on first measurement.
- **Independent-validation function (Nolan hire)** — RAS § B7 model-tier discipline depends on independent-validation capacity.
- **Climate-scenario substrate** — multi-quarter build; defer to 2026 H2 unless PA cadence forces earlier.
- **Structured RAS register** — appetite lines mirrored in two places (Helena's handler + this handler); folds into a single canonical register when authored.

## Rohan's narrative

Measurement substrate is in build phase: zero position events in the last 7 days, zero measurements firing, and of 13 appetite lines inventoried in Helena's 2026-06-01 snapshot, none are running end-to-end against real data. The load-bearing block on Helena's first measured RAS run is **appetite:capital:cet1-buffer**: the capital-base projection per Banks Act 94 of 1990 Reg 38 sits at the intersection of Bea's accounting substrate (CET1 numerator) and my RWA engines (denominator), and until it exists no Pillar 1 / Pillar 2A / buffer line in RAS § B3 can be quantified. LCR and NSFR (Ravi-owned, Reg 26 and BCBS NSFR 2014) are one classification-table ticket plus a projection-runtime away from green against the synthetic balance — closer to firing than CET1, but they don't on their own constitute a measured RAS pack.

Two secondary observations worth flagging. First, 812 RiskRaised events in seven days with no mapping from event taxonomy to appetite-line owner — that is an orphan-event problem, not a measurement problem, and it needs a router from RiskRaised → appetite-line key before Helena's pack can walk them. Second, the **model registry itself does not yet exist**, which gates appetite:model:tier-discipline (RAS § B5) and means trading-VaR v0, when Kai's CDM bindings land under D-MARKETS-SCHEMA-FOUNDATION, will be *modelled* but neither *registered* nor *independently validated* — and therefore not production-eligible for ICAAP measurement under the spirit of BCBS Market Risk Framework / FRTB internal-models approval. Independent Validation is a Nolan hire, not an engineering ticket, but the registry substrate is mine and is blocking.

Next engineering moves, in order: (1) draft `capital-base-projection v0` against the synthetic seed — CET1 derivation per Reg 38, RWA stubs for credit (BCBS Credit Risk Framework SA) and market (FRTB SA) returning zero until portfolios activate, IFRS 9 ECL deduction stubbed at zero, so the line can fire end-to-end and CET1-buffer measurement turns green the moment Bea's capital line is real; (2) stand up `model-registry v0` as empty substrate with tier / owner / validation-state fields, so trading-VaR v0 and SA-CCR have a registration target on arrival and the tier-discipline appetite line has something to measure against; (3) build the RiskRaised → appetite-line router so the 812-event backlog stops being orphaned in Helena's pack. Climate (PA GN 1 of 2024) and the two concentration lines remain correctly deferred — no engineering action this cycle.

## Provenance

Helena's latest `RiskAppetiteSnapshot` via `eventStore.replay({type:"RiskAppetiteSnapshot"})` (max as_of); appetite-line shadow mirrored from `runtime/agents/helena-risk-appetite-watch.ts`; readiness map curated by Rohan; position-event count via `eventStore.replay({type:"TradeBooked|PositionAdjusted|CollateralUpdated"})`; RiskRaised counts via `eventStore.replay({type:"RiskRaised"})` filtered to last 7 days.
