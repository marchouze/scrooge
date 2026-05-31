---
agent: Helena
trigger: risk-appetite-watch
asOf: 2026-05-31T04:30:53.198Z
decision-required: false
---

# Helena — risk-appetite watch, 2026-05-31

Autonomous run of Helena's daily risk-appetite-watch per `Team/Helena.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. First handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 14 appetite lines · 7 measured · 2 unmeasured (substrate gap) · 0 open breaches (0 tier-1, 0 tier-2) · 25 days since RAS approval.

## Appetite-line states

| Line | Category | Tier | RAS § | Status | Note |
|---|---|---|---|---|---|
| LCR buffer | liquidity | tier-1 | RAS §B3 | red | LCR T+30 = 0.0% (HQLA R0, net outflows R27,000,000). RAS §B3 thresholds: green ≥120% / amber 110-120% / red <110% / critical <105%. Substrate gaps: 1 class(es). |
| NSFR buffer | liquidity | tier-1 | RAS §B3 | green | NSFR T+30 = 10714.3% (ASF R300,000,000, RSF R2,800,000). RAS §B3 thresholds: green ≥115% / amber 108-115% / red <108% / critical <103%. Substrate gaps: 1 class(es). |
| CET1 buffer over PA min | capital | tier-1 | RAS §B3 | green | Build-phase baseline (ICAAP v1, D-MARKETS-CAPITAL-TIME-SHAPE 2026-05-12): capital R300 000 000, headroom R263 325 000, CET1 ratio 0.41%. No live CapitalEvent events in store; build-phase confirmed figures used. RWA: live positions (807 trade events; D-RWA-LIVE-POSITIONS-PROJECTION-V1). Status: green. |
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
- Days since approval: 25
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

The appetite-monitoring substrate is roughly half-built: 7 of 14 lines measured, 2 unmeasured with named owners, 5 legitimately dormant until the book opens. The most exposed class is **liquidity**, not because the bank is illiquid but because RAS §B3's LCR line is registering a tier-1 red on a divide-by-near-zero artefact (HQLA R0, net outflows R27m, ratio 0.0%) while the threshold logic treats it as if live. A spurious tier-1 breach in the BRC pack is worse than no metric at all — it trains the committee to discount the indicator. Close behind: **model risk** (RAS §B7) remains unmeasured pending the Nolan validator hire, which is the line I own directly and which BCBS *Corporate Governance Principles for Banks* Principle 6 obliges the CRO to evidence independently of the first line.

Two further observations the BRC will need to confront at the day-90 review. First, **leverage ratio** (RAS §B3) is reporting "infinity" because no exposure-measure projection exists — SA-CCR, commitments, and SFT substrates are absent. That is load-bearing on the Banks Act 94 of 1990 s.70 prudential reporting obligation the moment trading commences; a green status against an undefined denominator is not a control, it is a placeholder. Second, **PA GN 1/2024 climate** (RAS A2) has substrate live but zero runs — acceptable in build phase only if the first quarterly run is calendared, not deferred.

Next governance steps, concrete: (i) I will table a short BRC paper for the day-90 cycle establishing **build-phase measurement conventions** — specifically, when a tier-1 RAS line may legitimately register breach versus when it must be suppressed as an artefact, with the LCR §B3 case as worked example; (ii) commission Rohan to draft the **limit cascade for the leverage exposure measure** (SA-CCR + commitments + SFT) and the **HQLA composition sub-limits under §B3**, both required pre-go-live; (iii) register a standing exception against `appetite:model:tier-discipline` naming the Nolan hire as the closing condition, so the gap is visible on the BRC register rather than buried in the substrate inventory.

## Provenance

Hand-curated appetite-line shadow of `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` (RAS); breach counts via `eventStore.replay({type:"AppetiteBreach"})` reconciled against `AppetiteBreachDisposed`; RAS cadence anchored to the `D-RAS` decision date.
