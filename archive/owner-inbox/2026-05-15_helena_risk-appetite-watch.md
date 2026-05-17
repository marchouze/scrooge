---
agent: Helena
trigger: risk-appetite-watch
asOf: 2026-05-15T05:19:02.225Z
decision-required: false
---

# Helena — risk-appetite watch, 2026-05-15

Autonomous run of Helena's daily risk-appetite-watch per `Team/Helena.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. First handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 13 appetite lines · 3 measured · 6 unmeasured (substrate gap) · 0 open breaches (0 tier-1, 0 tier-2) · 9 days since RAS approval.

## Appetite-line states

| Line | Category | Tier | RAS § | Status | Note |
|---|---|---|---|---|---|
| LCR buffer | liquidity | tier-1 | RAS §B3 | unmeasured | Measurement substrate not yet built (Ravi (eng) → Eitan (Treasurer)). |
| NSFR buffer | liquidity | tier-1 | RAS §B3 | unmeasured | Measurement substrate not yet built (Ravi (eng) → Eitan (Treasurer)). |
| CET1 buffer over PA min | capital | tier-1 | RAS §B3 | unmeasured | Measurement substrate not yet built (Bea (eng) → Camille (CFO) joint with Helena (CRO)). |
| Single-name credit concentration | credit | tier-2 | RAS §B2 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Sector concentration | credit | tier-2 | RAS §B2 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Trading-book 1-day 99% VaR | market | tier-2 | RAS §B4 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Counterparty concentration (markets) | market | tier-2 | RAS §B8 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Sanctions true-positive matches blocked end-to-end pre-execution | financial-crime | zero-appetite | RAS §B5 | green | Zero-appetite line; Mira's gate enforces. No override events observed in this run. |
| STR-filing judgement (no internal override) | financial-crime | zero-appetite | RAS §B5 | green | Zero-appetite line; Mira's gate enforces. No override events observed in this run. |
| Cyber-incident severity tiering | operational | tier-2 | RAS §B6 | unmeasured | Measurement substrate not yet built (Senna (eng) → Rashida (CISO)). |
| Model-risk tier discipline | model | tier-2 | RAS §B7 | unmeasured | Measurement substrate not yet built (Independent Validation (Nolan hire) → Helena (CRO)). |
| Climate-risk governance per PA GN 1 of 2024 | climate | tier-2 | RAS A2 — Climate risk | unmeasured | Measurement substrate not yet built (Helena (CRO) — substrate not yet specified). |
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
- Days since approval: 9
- Quarterly BRC review: due day 90 from approval
- Annual Board review: due day 365 from approval

## Substrate gaps surfaced this run

- **Measurement substrate** — 6 of 13 lines are unmeasured pending Rohan / Bea / Ravi engineering (next handler #5 in the fleet-rollout plan).
- **Structured RAS register** — appetite lines are read from a hand-curated shadow in this handler's source. A structured RAS register (parseable, citation-bound) replaces the shadow when Helena + Atlas ship it.
- **Independent model-validation function** — RAS §B7 model-tier discipline depends on an independent validation team that is not yet staffed. Owner: PAX research / Nolan hire.
- **Climate-risk substrate** — PA Guidance Note 1 of 2024 governance posture is declared but the measurement substrate (climate scenario inputs, transition-risk taxonomy) is not specified. Owner: Helena.

## Helena's narrative

Substrate is thin: of 13 appetite lines, only 3 are measured (all zero-appetite conduct/financial-crime gates enforced by Mira), 6 sit unmeasured, and 4 are dormant pending book opening. The exposed class is **capital and liquidity** — every tier-1 line in RAS §B3 (LCR, NSFR, CET1 buffer) is currently unmeasured. In build phase that is tolerable; at Section 60B authorisation it is not. Banks Act 94 of 1990 and BCBS Corporate Governance Principles for Banks (Principle 6) both presume the board can see, in numbers, the appetite it has set — today it cannot, for the three lines that matter most to the PA.

The most consequential observation is the asymmetry between governance maturity (RAS drafted, taxonomy stable, zero-appetite gates live) and measurement maturity (no LCR, no NSFR, no CET1 telemetry). The second is RAS §A2 climate — substrate is not merely unbuilt, it is *unspecified*, and that one sits on my desk, not engineering's. The third is the tier-2 model-risk line (RAS §B7), which cannot be measured until Nolan's independent validation hire lands; until then model-risk appetite is aspirational. Open breach count is zero, but that is a substrate artefact, not a comfort — you cannot breach a limit you cannot measure.

Next governance steps, concrete: (i) I will table a BRC paper for the next cycle titled *"Appetite Measurement Readiness — Tier-1 Substrate Gap"* mapping each unmeasured tier-1 line to its owner, target instrumentation date, and the authorisation milestone it gates; (ii) I will commission from Rohan a limit-cascade specification for §B3 (LCR/NSFR/CET1) — board appetite → management limits → desk/treasury triggers — so that when Ravi and Bea deliver telemetry the thresholds are already ratified, not retrofitted; (iii) I will register the climate §A2 substrate gap as a named CRO exception against myself, with a 30-day commitment to specify the measurement approach (Prudential Authority Guidance Note 1/2024 alignment) before the next RAS quarterly review at day 90.

## Provenance

Hand-curated appetite-line shadow of `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` (RAS); breach counts via `eventStore.replay({type:"AppetiteBreach"})` reconciled against `AppetiteBreachDisposed`; RAS cadence anchored to the `D-RAS` decision date.
