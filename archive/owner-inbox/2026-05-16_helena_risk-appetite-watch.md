---
agent: Helena
trigger: risk-appetite-watch
asOf: 2026-05-16T04:45:27.603Z
decision-required: false
---

# Helena — risk-appetite watch, 2026-05-16

Autonomous run of Helena's daily risk-appetite-watch per `Team/Helena.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. First handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 13 appetite lines · 3 measured · 6 unmeasured (substrate gap) · 0 open breaches (0 tier-1, 0 tier-2) · 10 days since RAS approval.

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
- Days since approval: 10
- Quarterly BRC review: due day 90 from approval
- Annual Board review: due day 365 from approval

## Substrate gaps surfaced this run

- **Measurement substrate** — 6 of 13 lines are unmeasured pending Rohan / Bea / Ravi engineering (next handler #5 in the fleet-rollout plan).
- **Structured RAS register** — appetite lines are read from a hand-curated shadow in this handler's source. A structured RAS register (parseable, citation-bound) replaces the shadow when Helena + Atlas ship it.
- **Independent model-validation function** — RAS §B7 model-tier discipline depends on an independent validation team that is not yet staffed. Owner: PAX research / Nolan hire.
- **Climate-risk substrate** — PA Guidance Note 1 of 2024 governance posture is declared but the measurement substrate (climate scenario inputs, transition-risk taxonomy) is not specified. Owner: Helena.

## Helena's narrative

The appetite-monitoring substrate is materially incomplete: 3 of 13 lines are measured, 6 carry no measurement at all, and 4 remain dormant pending trading commencement. The three measured lines are zero-appetite gates (sanctions, STR, TCF) enforced procedurally through Mira — useful, but not the lines that bind us prudentially. The most exposed class is the tier-1 prudential triad — **capital and liquidity** — where all three load-bearing commitments to the PA (LCR and NSFR under RAS §B3, CET1 buffer under RAS §B3) currently have no substrate. In build phase this is expected; what matters is that the gap inventory is named, owned, and on a clock.

The three observations the BRC will need to see plainly. First, the tier-1 prudential lines (LCR, NSFR, CET1) are unmeasured against direct Banks Act 94 of 1990 §72 reporting obligations and the BA returns that will follow licence activation — these cannot be in "substrate not yet built" status when the SARB's pre-commencement readiness review lands, and the build-out owners (Ravi→Eitan; Bea→Camille) need dated deliverables, not just assignments. Second, the **model risk** line (RAS §B7) is unmeasured and the independent validation function is still a Nolan-stage hire — this is a BCBS *Corporate Governance Principles for Banks* Principle 6 weakness (risk management function independence and resourcing) that I will not be able to defend at the BRC if it persists past the next review. Third, the **climate** line (RAS A2) is unmeasured *and* the substrate is not yet specified — I own that gap personally; PA Guidance Note 1/2024 expects a demonstrable approach, not a placeholder.

Next governance step, concrete: I will table a single BRC paper at the next cycle (we are at day 10 of 90) — *"Risk Appetite Measurement Substrate: Build-Phase Gap Inventory and Activation Plan"* — committing dated substrate deliveries for each tier-1 line (LCR, NSFR, CET1) ahead of licence-activation readiness, an interim model-risk attestation regime pending Nolan's arrival, and a climate-substrate specification owned by me with a 60-day deadline. In parallel I will commission from Rohan a limit-cascade design for the four build-phase credit and market lines (RAS §B2, §B4, §B8) so cascades exist *before* the book opens, not after. No exceptions to register this cycle — zero breaches, zero overrides — but I am registering the unmeasured tier-1 lines as a standing build-phase risk on the BRC log until substrate is live.

## Provenance

Hand-curated appetite-line shadow of `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` (RAS); breach counts via `eventStore.replay({type:"AppetiteBreach"})` reconciled against `AppetiteBreachDisposed`; RAS cadence anchored to the `D-RAS` decision date.
