---
agent: Helena
trigger: risk-appetite-watch
asOf: 2026-06-03T05:44:02.721Z
decision-required: false
---

# Helena — risk-appetite watch, 2026-06-03

Autonomous run of Helena's daily risk-appetite-watch per `Team/Helena.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. First handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 14 appetite lines · 9 measured · 0 unmeasured (substrate gap) · 0 open breaches (0 tier-1, 0 tier-2) · 28 days since RAS approval.

## Appetite-line states

| Line | Category | Tier | RAS § | Status | Note |
|---|---|---|---|---|---|
| LCR buffer | liquidity | tier-1 | RAS §B3 | green | LCR T+30 = 143.0% (HQLA R50,043,950, net outflows R35,000,000). RAS §B3 thresholds: green ≥120% / amber 110-120% / red <110% / critical <105%. Substrate gaps: 1 class(es). |
| NSFR buffer | liquidity | tier-1 | RAS §B3 | green | NSFR T+30 = 5658.0% (ASF R300,000,000, RSF R5,302,197.5). RAS §B3 thresholds: green ≥115% / amber 108-115% / red <108% / critical <103%. Substrate gaps: 1 class(es). |
| CET1 buffer over PA min | capital | tier-1 | RAS §B3 | green | Live capital position derived from CapitalEvent events: capital R300 000 000, headroom R263 325 000, CET1 ratio 406.78%. TICR = R36 675 000. RWA: build-phase constant (no booked trades in store; D-RWA-LIVE-POSITIONS-PROJECTION-V1 fallback). Status: green. |
| Basel III leverage ratio (Tier-1 / total exposure) | capital | tier-1 | RAS §B3 | green | Build-phase baseline (ICAAP v1, D-MARKETS-CAPITAL-TIME-SHAPE 2026-05-12): Tier-1 R300 000 000, exposure measure R0, leverage ratio infinity. No live exposure-measure projection in the store; SA-CCR + commitment + SFT projections pending. Status: green. |
| Single-name credit concentration | credit | tier-2 | RAS §B2 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Sector concentration | credit | tier-2 | RAS §B2 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Trading-book 1-day 99% VaR | market | tier-2 | RAS §B4 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Counterparty concentration (markets) | market | tier-2 | RAS §B8 | n/a-build-phase | No book or portfolio in build phase; line activates at commencement of trading. |
| Sanctions true-positive matches blocked end-to-end pre-execution | financial-crime | zero-appetite | RAS §B5 | green | Zero-appetite line; Mira's gate enforces. No override events observed in this run. |
| STR-filing judgement (no internal override) | financial-crime | zero-appetite | RAS §B5 | green | Zero-appetite line; Mira's gate enforces. No override events observed in this run. |
| Cyber-incident severity tiering | operational | tier-2 | RAS §B6 | green | No incidents in build phase; cyber-severity appetite satisfied by construction. RAS §B6. |
| Model-risk tier discipline | model | tier-2 | RAS §B7 | green | GREEN: 23 model(s) in registry (20 Tier-1, 1 Tier-2, 2 Tier-3); 23 validated. No open Critical or Major findings. RAS §B7 model-tier discipline appetite satisfied. Source: Nadia (Independent model-validation engineer) + Rohan (Risk engineer) registry. |
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
- Days since approval: 28
- Quarterly BRC review: due day 90 from approval
- Annual Board review: due day 365 from approval

## Substrate gaps surfaced this run

- **Measurement substrate** — 0 of 14 lines are unmeasured pending Rohan engineering (next handler #5 in the fleet-rollout plan). Closed: `appetite:capital:cet1-buffer` (Bea's capital-metrics module, D-MARKETS-CAPITAL-TIME-SHAPE); `appetite:liquidity:lcr` and `appetite:liquidity:nsfr` (Ravi's ALM-positions projection wired to RAS §B3 thresholds, build-phase green-with-substrate-gap per brief `brief:ravi:alm-position-substrate-and-helena-liquidity-line:2026-05-21`).
- **Live capital events** — CET1 metrics currently use ICAAP v1 build-phase baseline (D-MARKETS-CAPITAL-TIME-SHAPE). Substrate gap: no live CapitalEvent events (CapitalContributionRecorded / equity-issuance) in the store. When real capital is raised at licence-day, the module auto-switches to live-event mode.
- **RWA engine** — CET1 ratio denominator uses build-phase ICAAP v1 RWA (R73.75m) until W2 Slice 3 RWA engine lands. Owner: Bea + Rohan.
- **Structured RAS register** — appetite lines are read from a hand-curated shadow in this handler's source. A structured RAS register (parseable, citation-bound) replaces the shadow when Helena + Atlas ship it.
- **Independent model-validation function** — RAS §B7 model-tier discipline depends on an independent validation team that is not yet staffed. Owner: PAX research / Nolan hire.
- **Climate-risk substrate** — PA Guidance Note 1 of 2024 measurement substrate is now live (`PROC-RISK-CR-01`, `platform/projections/climate-risk-projection.ts`). The `appetite:climate:guidance-note-1-2024` line is wired; it returns `n/a-build-phase` until the first quarterly `ClimateScenarioRun` event is emitted. Remaining gap: Rohan (Risk engineer) to produce the first quarterly run and the daily `ClimateExposureRevalued` proxy.

## Helena's narrative

Headline: the appetite-monitoring substrate is materially complete for the build phase — 9 of 14 lines measured, 5 dormant pending commencement of trading, zero unmeasured lines and zero open breaches. The most exposed metric class is **capital**: both tier-1 capital lines (CET1 buffer, leverage ratio) are reading green only because they rest on build-phase fallbacks, not on a live exposure-measure projection. That is a defensible posture today and an untenable one the day we book a trade.

The consequential observations, in order. First, `appetite:capital:leverage-ratio` (RAS §B3) is reporting an infinite ratio against a zero exposure measure — a mathematical green that carries no informational content. Under Banks Act 94 of 1990 s 72 and BCBS Corporate Governance Principles for Banks §§23–27 (board oversight of the risk profile), the BRC cannot accept a tier-1 regulator-facing line on a placeholder denominator beyond the immediate build window; the SA-CCR, commitment and SFT projections must land before first trade. Second, CET1 (RAS §B3) carries a flagged substrate gap on RWA — currently a build-phase constant under D-RWA-LIVE-POSITIONS-PROJECTION-V1; same logic applies, the line is load-bearing on our ICAAP commitment and needs a live RWA projection cascaded into it. Third, the climate line (RAS A2, PA GN 1/2024) has its substrate live but no first quarterly run on the clock — defensible at day 28, but the BRC will want a date, not a posture, at the day-90 review.

Next governance steps, concrete. (i) I will commission from Rohan a limit-cascade and substrate-readiness paper covering the leverage-ratio exposure measure (SA-CCR + commitments + SFT) and the live RWA projection, tabled at the next BRC ahead of the day-90 RAS review. (ii) I will register a build-phase exception against `appetite:capital:leverage-ratio` and `appetite:capital:cet1-buffer` noting the fallback denominators, so the green status is read against its qualification and not in isolation. (iii) The day-90 RAS review (T-62) gets an agenda item to confirm activation triggers for the five n/a-build-phase lines — credit, market and climate — so they switch from dormant to measured on the same event that books our first trade, not after it.

## Provenance

Hand-curated appetite-line shadow of `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` (RAS); breach counts via `eventStore.replay({type:"AppetiteBreach"})` reconciled against `AppetiteBreachDisposed`; RAS cadence anchored to the `D-RAS` decision date.
