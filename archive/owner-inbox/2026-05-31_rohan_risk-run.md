---
agent: Rohan
trigger: risk-run
asOf: 2026-05-31T03:43:00.736Z
decision-required: false
---

# Rohan — daily risk run, 2026-05-31

Autonomous run of Rohan's daily risk run per `Team/Rohan.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Fifth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Closes the engineer-side of Helena's measurement-substrate gap.

**Headline:** 13 appetite lines tracked · measurement readiness 0 ready / 3 drafting / 7 specified / 3 not-yet-specified · 0 position events (last 7d) · 651 RiskRaised events.

## Helena's latest snapshot

Latest `RiskAppetiteSnapshot` event: 2026-05-30T04:30:36.152Z

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
| medium | 465 |
| high | 186 |

## Substrate gaps surfaced this run

- **CDM bindings (Kai)** — pre-condition for any market-risk measurement. M1 is in flight under D-MARKETS-SCHEMA-FOUNDATION.
- **Capital-base projection (Bea + Rohan)** — pre-condition for CET1 buffer measurement (the most load-bearing tier-1 line).
- **HQLA / NSFR projections (Ravi)** — pre-condition for liquidity buffer measurement.
- **Model registry (Rohan)** — substrate exists for zero models today; first model entry blocks on first measurement.
- **Independent-validation function (Nolan hire)** — RAS § B7 model-tier discipline depends on independent-validation capacity.
- **Climate-scenario substrate** — multi-quarter build; defer to 2026 H2 unless PA cadence forces earlier.
- **Structured RAS register** — appetite lines mirrored in two places (Helena's handler + this handler); folds into a single canonical register when authored.

## Rohan's narrative

Substrate is pre-measurement: zero position events in the last 7 days, zero measurements firing, 13 appetite lines inventoried against Helena's 2026-05-30 snapshot but none yet producing a number. Of the 13 lines, only four can fire without portfolio activation — LCR, NSFR, CET1 buffer, and model tier-discipline — and these define the critical path to Helena's first end-to-end measured RAS run. The load-bearing block is **appetite:capital:cet1-buffer**: the capital-base projection (Banks Act Reg 38, RAS § capital) is joint with Bea, requires CET1 numerator + RWA denominator + Pillar 2A + combined buffer derivation, and gates the ICAAP measurement spine. LCR/NSFR are Ravi-owned and unblocked against synthetic balance (Banks Act Reg 26 for LCR HQLA classification, BCBS NSFR 2014 for ASF/RSF factors); they are one Ravi-ticket away from green. Everything market/credit/counterparty (trading VaR under FRTB, SA-CCR PFE per BCBS d317, single-name and sector concentration under the BCBS Credit Risk Framework, IFRS 9 ECL staging) is correctly deferred to Kai's M1 CDM bindings and Niko's first counterparty — not a block today.

Two observations worth surfacing. First, **651 RiskRaised events in 7 days (186 high, 465 medium) with zero positions on book** — these are substrate-gap risks, not portfolio risks, and I have not yet mapped each to an owning appetite line. I cannot rule out that a fraction of the high-severity bucket lacks a registered appetite-line owner under the RAS, which would be a governance hole Helena needs to see before next snapshot; I will produce an owner-coverage walk against the 13 lines this week. Second, **appetite:model:tier-discipline** has substrate (model registry) but no registry instance stood up — even in build phase, an empty registry is the correct measurement object for the tier-discipline line, and the Independent Validation hire (flagged to Nolan) is the longer-lead item that gates any ICAAP model-risk attestation.

Next engineering move, ranked: (1) draft the **capital-base projection v0** against the synthetic capital seed line — CET1 numerator, RWA denominator stub, Pillar 2A + capital conservation + D-SIB + countercyclical buffer slots per Banks Act Reg 38 — so Helena's first measured RAS run has a CET1 number to read; (2) stand up the **model registry skeleton** (entity + tier field + validation-status field) so the tier-discipline line fires `empty-but-compliant` rather than `unmeasured`; (3) publish the **RiskRaised → appetite-line owner-coverage walk** so any unmapped events are visible before the next snapshot. The trading-book VaR v0 (historical-simulation, FRTB-aligned) stays queued behind Kai's CDM bindings — drafting it now would be modelled-but-not-bookable and I won't ship that.

## Provenance

Helena's latest `RiskAppetiteSnapshot` via `eventStore.replay({type:"RiskAppetiteSnapshot"})` (max as_of); appetite-line shadow mirrored from `runtime/agents/helena-risk-appetite-watch.ts`; readiness map curated by Rohan; position-event count via `eventStore.replay({type:"TradeBooked|PositionAdjusted|CollateralUpdated"})`; RiskRaised counts via `eventStore.replay({type:"RiskRaised"})` filtered to last 7 days.
