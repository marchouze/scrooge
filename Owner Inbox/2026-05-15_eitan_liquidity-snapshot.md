---
agent: Eitan
trigger: liquidity-snapshot
asOf: 2026-05-15T06:53:41.845Z
decision-required: false
---

# Eitan — liquidity snapshot, 2026-05-15

Autonomous run of Eitan's daily liquidity snapshot per `Team/Eitan.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Build-phase degraded-mode digest — substantive LCR / NSFR / IRRBB / FX positions are not yet computed; this run is the daily-funding-event SLA heartbeat (§ 6 inactivity SLA) until the projection engines land.

**Headline:** 9 liquidity-related obligations indexed (0 PARTIAL / deferred) · 0 LCR / 0 NSFR projection events · 0 `SAMOSFundingApproved` events in the last 24h · 0 `ALCODecision` events in the last 7 days.

## Liquidity-related obligations slice

| Obligation | Citation | Owner | Status |
|---|---|---|---|
| ORG-PR-06 | [TBD] | Liquidity Risk Management Policy | Helena + Eitan |
| ORG-PR-07 | [TBD] | Liquidity Risk Management Policy | Helena + Eitan |
| ORG-PR-08 | [TBD] | Liquidity Risk Management Policy; Funding Strategy Policy | Eitan |
| ORG-PR-11 | [TBD] | IRRBB Policy (within Risk Management Framework) | Helena + Eitan |
| ORG-PR-14 | [TBD] | Liquidity Risk Management Policy; ILAAP | Eitan + Helena |
| ORG-PR-15 | [TBD] | Liquidity Risk Management Policy; Funding Strategy Policy | Eitan |
| ORG-PR-36 | `urn:obligation:bank:prudential:pa-d6-2015-revised-lcr:v1` | Liquidity Risk Management Policy; Funding Strategy Policy; `Procedures/by-policy/lcr-nsfr-liquidity-stress.md` (planned per research-findings doc §7) | Eitan (Treasurer, governance) + Helena (CRO, governance); Bea (Accounting & financial reporting engineer, engineering) |
| ORG-PR-38 | `urn:obligation:bank:prudential:pa-d4-2021-externally-facilitated-liquidity-stress-simulation:v1` | Liquidity Risk Management Policy; Stress Testing Policy; Risk Management Framework; `Procedures/by-policy/lcr-nsfr-liquidity-stress.md` (planned) | Helena (CRO, governance) + Eitan (Treasurer, governance); Rohan (Risk engineer, engineering — runtime stress-engine) |
| ORG-PR-43 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr:v1` | Liquidity Risk Management Policy; Funding Strategy Policy; `Procedures/by-policy/lcr-nsfr-liquidity-stress.md` (planned per research-findings doc §7) | Eitan (Treasurer, governance) + Helena (CRO, governance); Bea (Accounting & financial reporting engineer, engineering) |

## Treasury events (last 24 hours)

| Event | Count |
|---|---|
| `HQLAReported` | 0 |
| `LiquidityReport` | 0 |
| `LCRRatioProjection` | 0 |
| `NSFRRatioProjection` | 0 |
| `IRRBBChecked` | 0 |
| `FXPositionReported` | 0 |
| `CapitalAction` | 0 |
| `SAMOSFundingApproved` | 0 |

_Build-only context: no live treasury position; no real SAMOS account; no live HQLA portfolio. Zero counts on every row are expected and not a substrate alarm. Once Ravi's ALM engine and Anya's liquidity-projection engine land, the daily expectation moves from heartbeat-only to real ratio sign-off._

## Treasury events (last 7 days)

| Event | Count |
|---|---|
| `ALCODecision` | 0 |
| `HedgeProgrammeApproved` | 0 |
| Prior `LiquiditySnapshot` (this agent) | 8 |

## Substrate gaps (build-phase)

- **Liquidity projection engine** — under build (Anya) per `Team/Eitan.md` § 16. Until live, LCR / NSFR are not query-able from the event log.
- **ALM engine** — under build (Ravi) per § 16. Daily ALM run is a manually-orchestrated query today.
- **FTP curve generator** — not yet built (§ 16). Quarterly FTP review degraded.
- **Auto-generated ALCO pack** — not yet built (§ 16). Pack authored against the cycle template; gap is the load-bearing P6-downward seam (Eitan does not assemble; he generates).
- **Intraday liquidity watch (live)** — partial; settlement-account watch exists, intraday HQLA-stress projection is not live (§ 16). Intraday-stress trigger SLA (§ 7, 30-min response) is dormant in build-phase.
- **Collateral inventory substrate** — not yet built (§ 16). Treasury collateral-move sign-offs operate on registered limits without live inventory.
- **ILAAP engine** — not yet built (Helena's gap, Eitan co-owns liquidity slice).

## Eitan's narrative

Headline: nine liquidity-adjacent obligations indexed, none yet in PARTIAL/deferred — they sit upstream of that state, in `[TBD]` authoring or planned-procedure status against `Procedures/by-policy/lcr-nsfr-liquidity-stress.md`. Zero treasury events landed in the last 24h across every channel (HQLA, LiquidityReport, LCR/NSFR projections, IRRBB, FX, SAMOS, CapitalAction); this is the eighth consecutive LiquiditySnapshot run, so degraded-mode is functioning as designed — the daily heartbeat is standing in for the live engine, and under build-phase rules a zero-projection day is not a § 6 inactivity-SLA breach. Once Ravi's engine lands, the same zero on `SAMOSFundingApproved` or `LCRRatioProjection` becomes a breach; I want that line drawn now so the cutover isn't ambiguous.

Most consequential observations, ranked by where degraded-mode is load-bearing: (1) ORG-PR-36 (PA D6/2015 revised LCR) and ORG-PR-43 (PA D1/2023 NSFR) both gate on the planned `lcr-nsfr-liquidity-stress.md` procedure and on a `LCRRatioProjection` / `NSFRRatioProjection` schema that doesn't yet exist — until Bea and I land those, the daily snapshot cannot evidence BCBS 238 / D6 numerator-denominator construction, and I am signing nothing on LCR adequacy. (2) ORG-PR-38 (PA D4/2021 externally-facilitated stress simulation) is the next live regulatory exercise on the horizon and depends on Rohan's runtime stress-engine plus the same procedure file — it cannot be exercised cold. (3) ORG-PR-08 / -15 (Funding Strategy) and ORG-PR-11 (IRRBB) remain `[TBD]` on policy text; zero `IRRBBChecked` and zero `FXPositionReported` are tolerable today but become ALCO-chair escalations the moment the engine is live.

What's needed next, concretely: land the `LCRRatioProjection` schema first — it is the single projection that unlocks ORG-PR-36 evidence, feeds ORG-PR-43 once NSFR follows, and sets the shape for `SAMOSFundingApproved` and `HQLAReported` to slot beside it. I'll draft the field list (HQLA stock by Level 1 / 2A / 2B, net cash outflows over 30 days, ratio, as-of, source-snapshot ref) against Ravi this week and pair it with a stub `Procedures/by-policy/lcr-nsfr-liquidity-stress.md` so ORG-PR-36, -38 and -43 move from `[TBD]` to PARTIAL with a named gap rather than an empty pointer. Next ALCO prep item: a one-page cutover note defining when zero-projection days flip from "degraded-mode expected" to "§ 6 inactivity breach," co-signed with Helena, tabled at the next ALCO.

## Provenance

Read `Regulations/_obligations-register.md` for liquidity-related rows (ORG-PR-06 / -07 / -08 / -11 / -14 / -15 plus any LCR / NSFR / BCBS 248 / IRRBB / liquidity citations). Replayed `HQLAReported`, `LiquidityReport`, `LCRRatioProjection`, `NSFRRatioProjection`, `IRRBBChecked`, `FXPositionReported`, `CapitalAction`, `SAMOSFundingApproved`, `ALCODecision`, `HedgeProgrammeApproved`, `LiquiditySnapshot` from the host event store.
