---
agent: Eitan
trigger: liquidity-snapshot
asOf: 2026-05-14T06:53:57.623Z
decision-required: false
---

# Eitan — liquidity snapshot, 2026-05-14

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
| Prior `LiquiditySnapshot` (this agent) | 7 |

## Substrate gaps (build-phase)

- **Liquidity projection engine** — under build (Anya) per `Team/Eitan.md` § 16. Until live, LCR / NSFR are not query-able from the event log.
- **ALM engine** — under build (Ravi) per § 16. Daily ALM run is a manually-orchestrated query today.
- **FTP curve generator** — not yet built (§ 16). Quarterly FTP review degraded.
- **Auto-generated ALCO pack** — not yet built (§ 16). Pack authored against the cycle template; gap is the load-bearing P6-downward seam (Eitan does not assemble; he generates).
- **Intraday liquidity watch (live)** — partial; settlement-account watch exists, intraday HQLA-stress projection is not live (§ 16). Intraday-stress trigger SLA (§ 7, 30-min response) is dormant in build-phase.
- **Collateral inventory substrate** — not yet built (§ 16). Treasury collateral-move sign-offs operate on registered limits without live inventory.
- **ILAAP engine** — not yet built (Helena's gap, Eitan co-owns liquidity slice).

## Eitan's narrative

Headline: register coverage holds at nine liquidity-adjacent obligations indexed (ORG-PR-06/07/08/11/14/15 plus the three prudential anchors ORG-PR-36 LCR, ORG-PR-38 externally-facilitated stress, ORG-PR-43 NSFR), and zero treasury events landed in the last 24h across every channel — HQLA, LiquidityReport, LCR/NSFR projections, IRRBB, FX, SAMOS. This is the seventh consecutive LiquiditySnapshot run with the engine dark, so degraded-mode is doing exactly the work it was designed to do: the daily heartbeat is standing in as the § 6 inactivity-SLA placeholder for the funding-event channel, and so long as that heartbeat lands it is not itself a breach. Once Ravi's engine cuts over, the same zero-row pattern on `SAMOSFundingApproved` or `HQLAReported` flips to a control failure.

The load-bearing observations: ORG-PR-36 (LCR, PA D6/2015 revised) and ORG-PR-43 (NSFR, PA D1/2023) are the two obligations where degraded-mode is most exposed — both require daily (LCR) and quarterly (NSFR) ratio computation that I cannot evidence without `LCRRatioProjection` / `NSFRRatioProjection` rows, and both have Bea on the engineering hook for the BA 325/300 reporting tie-out. ORG-PR-38 (externally-facilitated stress) sits behind those: no stress engine, no projection, no ALCO-grade scenario pack, and Rohan's runtime is upstream of any meaningful read on ORG-PR-14 (ILAAP). ORG-PR-08 and ORG-PR-15 (funding strategy / concentration) remain governance-only until SAMOS and counterparty-funding events start flowing. No IRRBB or FX excursion to flag — but equally, no `IRRBBChecked` or `FXPositionReported` for seven days running, which means ORG-PR-11 is presently evidenced only by the obligations register, not by behaviour.

Next substrate step, in order: (1) land the `LCRRatioProjection` schema first — it is the highest-frequency control surface (daily under PA D6) and the cleanest event shape, and it unblocks the ALCO liquidity tile; (2) `HQLAReported` immediately after, since the LCR numerator is unauditable without it; (3) `NSFRRatioProjection` can follow on a quarterly cadence. ALCO prep item that follows from this snapshot: a one-page note to Camille flagging that until those three event types are emitting, the ALCO liquidity section will continue to read "degraded-mode, heartbeat-only" and we should agree the cut-over date at which zero-row days start counting as § 6 breaches rather than build-phase artefacts.

## Provenance

Read `Regulations/_obligations-register.md` for liquidity-related rows (ORG-PR-06 / -07 / -08 / -11 / -14 / -15 plus any LCR / NSFR / BCBS 248 / IRRBB / liquidity citations). Replayed `HQLAReported`, `LiquidityReport`, `LCRRatioProjection`, `NSFRRatioProjection`, `IRRBBChecked`, `FXPositionReported`, `CapitalAction`, `SAMOSFundingApproved`, `ALCODecision`, `HedgeProgrammeApproved`, `LiquiditySnapshot` from the host event store.
