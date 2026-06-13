---
agent: Helena
trigger: risk-appetite-watch
asOf: 2026-06-13T04:47:07.938Z
decision-required: false
---

# Helena — risk-appetite watch, 2026-06-13

Autonomous run of Helena's daily risk-appetite-watch per `Team/Helena.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. First handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 17 appetite lines · 11 measured · 0 unmeasured (substrate gap) · 0 open breaches (0 tier-1, 0 tier-2) · 38 days since RAS approval.

## Appetite-line states

| Line | Category | Tier | RAS § | Status | Note |
|---|---|---|---|---|---|
| LCR buffer | liquidity | tier-1 | RAS §B3 | green | LCR T+30 = 22475.6% (HQLA R2,247,559,845.178, net outflows R10,000,000). RAS §B3 thresholds: green ≥120% / amber 110-120% / red <110% / critical <105%. Substrate gaps: 1 class(es). |
| NSFR buffer | liquidity | tier-1 | RAS §B3 | green | NSFR T+30 = 260.5% (ASF R300,000,000, RSF R115,177,992.259). RAS §B3 thresholds: green ≥115% / amber 108-115% / red <108% / critical <103%. Substrate gaps: 1 class(es). |
| CET1 buffer over PA min | capital | tier-1 | RAS §B3 | green | Live capital position derived from CapitalEvent events: capital R300 000 000, headroom R263 325 000, CET1 ratio 364.66%. TICR = R36 675 000. RWA: live positions (84 trade events; D-RWA-LIVE-POSITIONS-PROJECTION-V1). Status: green. |
| Basel III leverage ratio (Tier-1 / total exposure) | capital | tier-1 | RAS §B3 | green | Build-phase baseline (ICAAP v1, D-MARKETS-CAPITAL-TIME-SHAPE 2026-05-12): Tier-1 R300 000 000, exposure measure R0, leverage ratio infinity. No live exposure-measure projection in the store; SA-CCR + commitment + SFT projections pending. Status: green. |
| Single-name credit concentration | credit | tier-2 | RAS §B2 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Sector concentration | credit | tier-2 | RAS §B2 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Trading-book 1-day 99% VaR | market | tier-2 | RAS §B4 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Counterparty concentration (markets) | market | tier-2 | RAS §B8 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Sanctions true-positive matches blocked end-to-end pre-execution | financial-crime | zero-appetite | RAS §B5 | green | Zero-appetite line; Mira's gate enforces. No override events observed in this run. |
| STR-filing judgement (no internal override) | financial-crime | zero-appetite | RAS §B5 | green | Zero-appetite line; Mira's gate enforces. No override events observed in this run. |
| Cyber-incident severity tiering | operational | tier-2 | RAS §B6 | green | No incidents in build phase; cyber-severity appetite satisfied by construction. RAS §B6. |
| Model-risk tier discipline | model | tier-2 | RAS §B7 | green | GREEN: 26 model(s) in registry (23 Tier-1, 1 Tier-2, 2 Tier-3); 26 validated. No open Critical or Major findings. RAS §B7 model-tier discipline appetite satisfied. Source: Nadia (Independent model-validation engineer) + Rohan (Risk engineer) registry. |
| Climate-risk governance per PA GN 1 of 2024 | climate | tier-2 | RAS A2 — Climate risk | n/a-build-phase | No ClimateScenarioRun events yet — first run due at next quarterly tick. Build-phase posture: no live book, no portfolio to stress. PA GN 1/2024 measurement substrate live (PROC-RISK-CR-01); awaiting first quarterly run. |
| Treating Customers Fairly — zero appetite for unfair treatment | conduct | zero-appetite | RAS A2 — Conduct risk | green | Zero-appetite line; Mira's gate enforces. No override events observed in this run. |
| Gross long bond inventory cap — trading book face value | market | tier-2 | RAS §B4 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| IRRBB δEVE outlier threshold — BCBS d365 §A-3.4 supervisory test | irrbb | tier-1 | RAS §B4 | green | IRRBB ΔEVE supervisory-outlier test: worst-case |ΔEVE| = 0.00% of Tier-1 (worst shock: short-down; 6 BCBS d365 scenario(s); latest ALM run as-of 2026-06-12T05:50:51.053Z). RAS §B4 thresholds: green <10% Tier-1 / amber 10-15% Tier-1 / red ≥15% Tier-1. Source: Ravi (Treasury and ALM engineer, engineering)'s ALM run IRRBBChecked events of record (BCBS d365 §A-3.4). |
| Intraday liquidity usage — BCBS 248 peak usage vs available | liquidity | tier-1 | RAS §B3 | green | Build-phase: zero start-of-day intraday liquidity → zero usage by construction; RAS §B3 intraday appetite line resolves to green-with-substrate-gap. Governed floor R50,000,000 (register floorZar; D-INTRADAY-RAS-APPETITE). Source: Ravi (Treasury and ALM engineer, engineering) BCBS 248 metrics (computeIntradayLiquidityMetrics). |

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
- Days since approval: 38
- Quarterly BRC review: due day 90 from approval
- Annual Board review: due day 365 from approval

## Substrate gaps surfaced this run

- **Climate-risk substrate** — PA Guidance Note 1 of 2024 measurement substrate is now live (`PROC-RISK-CR-01`, `platform/projections/climate-risk-projection.ts`). The `appetite:climate:guidance-note-1-2024` line is wired; it returns `n/a-build-phase` until the first quarterly `ClimateScenarioRun` event is emitted. Remaining gap: Rohan (Risk engineer) to produce the first quarterly run and the daily `ClimateExposureRevalued` proxy.

## Helena's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CbzepSXUzyEcpvP89uVQw"})._

## Provenance

Appetite lines sourced from the typed citation-bound register `platform/risk/ras-appetite-register.ts` (canonical mirror of the RAS, `D-RAS` / `D-RAS-STRUCTURED-REGISTER`); breach counts via `eventStore.replay({type:"AppetiteBreach"})` reconciled against `AppetiteBreachDisposed`; RAS cadence anchored to the `D-RAS` decision date.
