---
agent: Rohan
trigger: risk-run
asOf: 2026-06-13T06:17:33.192Z
decision-required: false
---

# Rohan — daily risk run, 2026-06-13

Autonomous run of Rohan's daily risk run per `Team/Rohan.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Fifth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Closes the engineer-side of Helena's measurement-substrate gap.

**Headline:** 17 appetite lines tracked · measurement readiness 1 ready / 3 drafting / 6 specified / 3 not-yet-specified · 0 position events (last 7d) · 0 RiskRaised events.

## Helena's latest snapshot

Latest `RiskAppetiteSnapshot` event: 2026-06-13T04:47:07.938Z

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
| `appetite:model:tier-discipline` | ready | Model registry + independent-validation function. Owner: Rohan (Risk engineer, registry); Nadia (Independent-validation engineer) holds the validation function. | Independent-validation function staffed (Nadia); model registry live. Keep tier classifications + validation approvals current as models enter the registry. |
| `appetite:climate:guidance-note-1-2024` | not-yet-specified | Climate-scenario substrate — transition-risk taxonomy + physical-risk geocoding + scenario engine. Owner: Helena (governance) joint with Rohan (eng). | Specify per PA GN 1 of 2024; multi-quarter build; defer until 2026 H2 unless PA cadence forces earlier. |
| `appetite:conduct:tcf` | drafting | Niko's advice-record pipeline + Mira's conduct-monitoring + Zara's FAIS supervision. No Rohan substrate. | Out of Rohan's scope; activates with Niko at commencement of trading. |

## Position events (last 7 days)

| Event class | Count |
|---|---|
| `TradeBooked` + `PositionAdjusted` + `CollateralUpdated` | 0 |

_Build-phase posture: zero position events. Kai's M1 CDM TypeScript bindings (in flight under D-MARKETS-SCHEMA-FOUNDATION) are the precondition; the first `TradeBooked` event activates the position-incremental risk-update path._

## RiskRaised events (last 7 days)

_No `RiskRaised` events in the last 7 days._

## Substrate gaps surfaced this run

- **CDM bindings (Kai)** — pre-condition for any market-risk measurement. M1 is in flight under D-MARKETS-SCHEMA-FOUNDATION.
- **Capital-base projection (Bea + Rohan)** — pre-condition for CET1 buffer measurement (the most load-bearing tier-1 line).
- **HQLA / NSFR projections (Ravi)** — pre-condition for liquidity buffer measurement.
- **Model registry (Rohan)** — substrate exists for zero models today; first model entry blocks on first measurement.
- **Climate-scenario substrate** — multi-quarter build; defer to 2026 H2 unless PA cadence forces earlier.

## Rohan's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CbzmiCMbUCaXYuQg98znA"})._

## Provenance

Helena's latest `RiskAppetiteSnapshot` via `eventStore.replay({type:"RiskAppetiteSnapshot"})` (max as_of); appetite-line inventory + per-line status read directly from that event's `lineStatuses` payload (no local shadow); readiness map curated by Rohan, with the model-tier-discipline line's state derived from the presence of `ModelValidationApproved` events; position-event count via `eventStore.replay({type:"TradeBooked|PositionAdjusted|CollateralUpdated"})`; RiskRaised counts via `eventStore.replay({type:"RiskRaised"})` filtered to last 7 days.
