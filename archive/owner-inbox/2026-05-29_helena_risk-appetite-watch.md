---
agent: Helena
trigger: risk-appetite-watch
asOf: 2026-05-29T05:01:22.519Z
decision-required: false
---

# Helena — risk-appetite watch, 2026-05-29

Autonomous run of Helena's daily risk-appetite-watch per `Team/Helena.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. First handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 14 appetite lines · 7 measured · 2 unmeasured (substrate gap) · 0 open breaches (0 tier-1, 0 tier-2) · 23 days since RAS approval.

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
- Days since approval: 23
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

The appetite-monitoring substrate is partially live: 7 of 14 lines measured, 2 lines unmeasured, 5 dormant pending commencement of trading. The class most exposed is **liquidity** — specifically the LCR line, which is reporting red on a synthetic denominator (R27m net outflow against zero HQLA) and which I am not prepared to treat as a true breach until the substrate is corrected. The NSFR figure (10,714%) is, on its face, evidence of the same substrate problem from the other direction: ratios that round to absurdities are not measurements, they are placeholders dressed as measurements, and the BRC will not accept them as RAS §B3 attestations.

Three observations the Board needs to hear. First: the LCR/NSFR substrate for RAS §B3 is not fit for regulator-facing use — the inputs are build-phase stubs, not a calibrated HQLA / outflow / ASF / RSF projection — and until Rohan commissions a proper liquidity projection the red on LCR must be registered as a *measurement exception*, not a tier-1 appetite breach. This matters because LCR and NSFR are the two lines on which the PA will expect demonstrable governance under Banks Act 94 of 1990 s 60B and the ICAAP/ILAAP discipline. Second: the **model-risk** appetite line (RAS §B7) is unmeasured and will remain so until the independent-validation hire (Nolan) lands — this is a direct gap against BCBS Corporate Governance Principles for Banks Principle 6 (risk management function) and Principle 8 (risk communication), and the BRC needs to see it on the gap inventory, not buried in an ops note. Third: the **cyber-severity** line (RAS §B6) is unmeasured pending Senna→Rashida substrate work; tolerable for now, but it cannot still be unmeasured at the day-90 RAS review.

Next governance step, concrete: (i) I will commission a BRC paper for the next cycle — *"Liquidity appetite substrate: measurement exception on LCR/NSFR and remediation plan"* — registering the LCR red as a substrate exception under the RAS exception register, not a tier-1 breach, with Rohan named as the substrate owner and a commitment to a calibrated ILAAP-grade liquidity projection before day 90. (ii) I will write to Rohan to commission the limit cascade for RAS §B3 (LCR/NSFR component limits and the leverage-ratio exposure-measure projection — SA-CCR, commitments, SFTs) so that the day-90 RAS review has real numbers to govern. (iii) The model-risk and cyber-severity unmeasured lines go on the BRC gap inventory as standing items until substrate is delivered. Day-23 of 90; we have time, but only if the substrate work starts now.

## Provenance

Hand-curated appetite-line shadow of `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` (RAS); breach counts via `eventStore.replay({type:"AppetiteBreach"})` reconciled against `AppetiteBreachDisposed`; RAS cadence anchored to the `D-RAS` decision date.
