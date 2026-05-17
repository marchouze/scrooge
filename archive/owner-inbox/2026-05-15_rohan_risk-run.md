---
agent: Rohan
trigger: risk-run
asOf: 2026-05-15T05:19:21.825Z
decision-required: false
---

# Rohan — daily risk run, 2026-05-15

Autonomous run of Rohan's daily risk run per `Team/Rohan.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Fifth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Closes the engineer-side of Helena's measurement-substrate gap.

**Headline:** 13 appetite lines tracked · measurement readiness 0 ready / 3 drafting / 7 specified / 3 not-yet-specified · 0 position events (last 7d) · 7 RiskRaised events.

## Helena's latest snapshot

Latest `RiskAppetiteSnapshot` event: 2026-05-15T05:19:02.225Z

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
| medium | 5 |
| high | 2 |

## Substrate gaps surfaced this run

- **CDM bindings (Kai)** — pre-condition for any market-risk measurement. M1 is in flight under D-MARKETS-SCHEMA-FOUNDATION.
- **Capital-base projection (Bea + Rohan)** — pre-condition for CET1 buffer measurement (the most load-bearing tier-1 line).
- **HQLA / NSFR projections (Ravi)** — pre-condition for liquidity buffer measurement.
- **Model registry (Rohan)** — substrate exists for zero models today; first model entry blocks on first measurement.
- **Independent-validation function (Nolan hire)** — RAS § B7 model-tier discipline depends on independent-validation capacity.
- **Climate-scenario substrate** — multi-quarter build; defer to 2026 H2 unless PA cadence forces earlier.
- **Structured RAS register** — appetite lines mirrored in two places (Helena's handler + this handler); folds into a single canonical register when authored.

## Rohan's narrative

Substrate is at zero measurements — no TradeBooked, PositionAdjusted, or CollateralUpdated events in the last seven days, so every risk engine is specification-and-seed, not back-tested production. Of the 13 appetite lines in Helena's 2026-05-15 snapshot, six sit in Rohan-owned engineering (LCR, NSFR, CET1 buffer, trading VaR, counterparty PFE, model tier-discipline) and the rest are either Mira/Senna/Niko-owned or deferred. The load-bearing block on Helena's first end-to-end measured RAS run is **appetite:capital:cet1-buffer** — Banks Act Reg 38 capital-base derivation, joint with Bea. Without a CET1 numerator and RWA denominator projection running against the synthetic seed, RAS § on capital is unmeasured by definition, and ICAAP measurement cannot fire even in dry-run; trading VaR (FRTB-adjacent, currently historical-sim v0) and SA-CCR PFE (BCBS d317) are correctly gated on Kai's CDM bindings and Niko's first counterparty, so they are not the binding constraint today.

Two other observations rank. First, **appetite:liquidity:lcr** is one engineering ticket from green: Ravi owns the substrate, the HQLA classification per Banks Act Reg 26 is a finite specification, and a first projection against the synthetic balance is achievable inside this sprint — NSFR (BCBS NSFR 2014 ASF/RSF table) rides the same projection runtime and falls out cheaply once LCR lands. Second, **7 RiskRaised events (2 high, 5 medium) in the last 7d against 13 inventoried appetite lines** — I have not yet confirmed each event walks to a registered owner on a specified line; any high-severity event landing on a `not-yet-specified` line (single-name concentration, sector concentration, climate GN 1/2024) is a measurement orphan and needs to be surfaced to Helena before the next snapshot rather than absorbed silently. Separately, **appetite:model:tier-discipline** has no substrate yet — the model registry itself is the substrate, independent of whether any model is live, and without it the IFRS 9 ECL methodology and any VaR v0 we ship have no registered tier, no validation status, and no production-use flag distinct from validation-pending.

Next engineering moves, in order: (1) draft `capital-base-projection v0` per Banks Act Reg 38 against the synthetic capital seed, joint ticket with Bea, target this sprint — this is the single move that converts Helena's first RAS run from un-measured to partially-measured; (2) stand up the **model registry skeleton** now (entity: model_id, tier, owner, validation_status, production_use_flag, last_validated_at) even with zero models registered, so that LCR projection, capital-base projection, and the eventual VaR v0 land into a governed substrate from first commit, and flag the Independent Validation hire to Nolan against BCBS SRP / model-risk expectations; (3) once (1) ships, walk the 7 RiskRaised events against the appetite-line owner map and report orphans to Helena ahead of her next snapshot. Climate (PA GN 1 of 2024) and the two credit-concentration lines remain correctly deferred — they are not on the critical path to first measured RAS run.

## Provenance

Helena's latest `RiskAppetiteSnapshot` via `eventStore.replay({type:"RiskAppetiteSnapshot"})` (max as_of); appetite-line shadow mirrored from `runtime/agents/helena-risk-appetite-watch.ts`; readiness map curated by Rohan; position-event count via `eventStore.replay({type:"TradeBooked|PositionAdjusted|CollateralUpdated"})`; RiskRaised counts via `eventStore.replay({type:"RiskRaised"})` filtered to last 7 days.
