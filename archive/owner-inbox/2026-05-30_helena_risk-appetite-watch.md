---
agent: Helena
trigger: risk-appetite-watch
asOf: 2026-05-30T04:30:36.152Z
decision-required: false
---

# Helena — risk-appetite watch, 2026-05-30

Autonomous run of Helena's daily risk-appetite-watch per `Team/Helena.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. First handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 14 appetite lines · 7 measured · 2 unmeasured (substrate gap) · 0 open breaches (0 tier-1, 0 tier-2) · 24 days since RAS approval.

## Appetite-line states

| Line | Category | Tier | RAS § | Status | Note |
|---|---|---|---|---|---|
| LCR buffer | liquidity | tier-1 | RAS §B3 | red | LCR T+30 = 0.0% (HQLA R0, net outflows R27,000,000). RAS §B3 thresholds: green ≥120% / amber 110-120% / red <110% / critical <105%. Substrate gaps: 1 class(es). |
| NSFR buffer | liquidity | tier-1 | RAS §B3 | green | NSFR T+30 = 10714.3% (ASF R300,000,000, RSF R2,800,000). RAS §B3 thresholds: green ≥115% / amber 108-115% / red <108% / critical <103%. Substrate gaps: 1 class(es). |
| CET1 buffer over PA min | capital | tier-1 | RAS §B3 | green | Build-phase baseline (ICAAP v1, D-MARKETS-CAPITAL-TIME-SHAPE 2026-05-12): capital R300 000 000, headroom R263 325 000, CET1 ratio 406.78%. No live CapitalEvent events in store; build-phase confirmed figures used. Status: green. |
| Basel III leverage ratio (Tier-1 / total exposure) | capital | tier-1 | RAS §B3 | green | Build-phase baseline (ICAAP v1, D-MARKETS-CAPITAL-TIME-SHAPE 2026-05-12): Tier-1 R300 000 000, exposure measure R0, leverage ratio infinity. No live exposure-measure projection in the store; SA-CCR + commitment + SFT projections pending. Status: green. |
| Single-name credit concentration | credit | tier-2 | RAS §B2 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Sector concentration | credit | tier-2 | RAS §B2 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Trading-book 1-day 99% VaR | market | tier-2 | RAS §B4 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Counterparty concentration (markets) | market | tier-2 | RAS §B8 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Sanctions true-positive matches blocked end-to-end pre-execution | financial-crime | zero-appetite | RAS §B5 | green | Zero-appetite line; Mira's gate enforces. No override events observed in this run. |
| STR-filing judgement (no internal override) | financial-crime | zero-appetite | RAS §B5 | green | Zero-appetite line; Mira's gate enforces. No override events observed in this run. |
| Cyber-incident severity tiering | operational | tier-2 | RAS §B6 | unmeasured | Measurement substrate not yet built (Senna (eng) → Rashida (CISO)). |
| Model-risk tier discipline | model | tier-2 | RAS §B7 | unmeasured | Measurement substrate not yet built (Independent Validation (Nolan hire) → Helena (CRO)). |
| Climate-risk governance per PA GN 1 of 2024 | climate | tier-2 | RAS A2 — Climate risk | n/a-build-phase | No ClimateScenarioRun events yet — first run due at next quarterly tick. Build-phase posture: no live book, no portfolio to stress. PA GN 1/2024 measurement substrate live (PROC-RISK-CR-01); awaiting first quarterly run. |
| Treating Customers Fairly — zero appetite for unfair treatment | conduct | zero-appetite | RAS A2 — Conduct risk | green | Zero-appetite line; Mira's gate enforces. No override events observed in this run. |

## Breach counts

| Class | Count |
|---|---|
| Open breaches | 0 |
| &nbsp;&nbsp;Tier-1 open | 0 |
| &nbsp;&nbsp;Tier-2 open | 0 |
| Disposed breaches | 0 |

_Zero breach events in the store — consistent with the build-phase posture (no positions, no portfolio, no client transactions). Breach events flow from the measurement substrate when Rohan / Ravi / Bea ship; this rollup runs correctly against the empty set today._

## RAS cadence

- RAS approved: 2026-05-06 (decision `D-RAS`)
- Days since approval: 24
- Quarterly BRC review: due day 90 from approval
- Annual Board review: due day 365 from approval

## Substrate gaps surfaced this run

- **Measurement substrate** — 2 of 14 lines are unmeasured pending Rohan engineering (next handler #5 in the fleet-rollout plan). Closed: `appetite:capital:cet1-buffer` (Bea's capital-metrics module, D-MARKETS-CAPITAL-TIME-SHAPE); `appetite:liquidity:lcr` and `appetite:liquidity:nsfr` (Ravi's ALM-positions projection wired to RAS §B3 thresholds, build-phase green-with-substrate-gap per brief `brief:ravi:alm-position-substrate-and-helena-liquidity-line:2026-05-21`).
- **Live capital events** — CET1 metrics currently use ICAAP v1 build-phase baseline (D-MARKETS-CAPITAL-TIME-SHAPE). Substrate gap: no live CapitalEvent events (CapitalContributionRecorded / equity-issuance) in the store. When real capital is raised at licence-day, the module auto-switches to live-event mode.
- **RWA engine** — CET1 ratio denominator uses build-phase ICAAP v1 RWA (R73.75m) until W2 Slice 3 RWA engine lands. Owner: Bea + Rohan.
- **Structured RAS register** — appetite lines are read from a hand-curated shadow in this handler's source. A structured RAS register (parseable, citation-bound) replaces the shadow when Helena + Atlas ship it.
- **Independent model-validation function** — RAS §B7 model-tier discipline depends on an independent validation team that is not yet staffed. Owner: PAX research / Nolan hire.
- **Climate-risk substrate** — PA Guidance Note 1 of 2024 measurement substrate is now live (`PROC-RISK-CR-01`, `platform/projections/climate-risk-projection.ts`). The `appetite:climate:guidance-note-1-2024` line is wired; it returns `n/a-build-phase` until the first quarterly `ClimateScenarioRun` event is emitted. Remaining gap: Rohan (Risk engineer) to produce the first quarterly run and the daily `ClimateExposureRevalued` proxy.

## Helena's narrative

Substrate is roughly half-built: 7 of 14 appetite lines carry a live measurement, 2 are explicitly unmeasured, and 5 are correctly parked as n/a until the book opens. The most exposed class is **liquidity** — not because liquidity risk is materially elevated, but because the LCR line, a tier-1 commitment under RAS §B3 and a binding PA return obligation under Banks Act 94 of 1990 s.72 read with Regulation 26, is showing 0% against a R27m projected net outflow with zero HQLA. In build phase that reading is arithmetically correct and economically meaningless, but it is structurally load-bearing: the moment a single deposit lands or a single commitment is drawn, this line moves from "n/a-coloured-red" to a real red, and we cannot be discovering the HQLA-funding pathway at that point.

Two other observations rank. First, `appetite:capital:leverage-ratio` is reporting green on an infinite ratio because the exposure measure is R0 — SA-CCR, commitment, and SFT projections are not in the store. That is a measurement gap on a tier-1 RAS §B3 line and should not be carried as green; it should be carried as unmeasured, same posture as cyber-severity and model-tier-discipline. Second, `appetite:model:tier-discipline` (RAS §B7) remains unmeasured pending the Nolan independent-validation hire — this is my own line and BCBS *Corporate Governance Principles for Banks* (July 2015) Principle 6 puts the obligation to evidence independent model oversight squarely on the CRO function; I cannot let it drift past the next RAS review at day 90.

Governance steps, concrete: (i) I will register a **standing exception** against the LCR and leverage-ratio lines reclassifying both from their current status to "unmeasured — build-phase, HQLA pathway and exposure-measure projection pending", with the exception expiring at first live exposure; (ii) I will commission a **limit-cascade paper from Rohan (Treasurer)** specifying the HQLA composition, intraday funding pathway, and the §B3 amber/red trigger actions the moment the first deposit is booked — due before BRC; and (iii) I will table a **BRC paper at the day-90 RAS review** covering the two unmeasured tier-2 lines (cyber-severity, model-tier-discipline), the leverage-ratio substrate gap, and a recommendation on whether RAS §B3 thresholds need a build-phase rider so the dashboard stops reporting structurally misleading colours. The day-90 clock is at 24; the paper drafts start this week.

## Provenance

Hand-curated appetite-line shadow of `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` (RAS); breach counts via `eventStore.replay({type:"AppetiteBreach"})` reconciled against `AppetiteBreachDisposed`; RAS cadence anchored to the `D-RAS` decision date.
