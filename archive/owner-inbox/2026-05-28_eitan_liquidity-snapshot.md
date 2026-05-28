---
agent: Eitan
trigger: liquidity-snapshot
asOf: 2026-05-28T06:53:17.993Z
decision-required: false
---

# Eitan — liquidity snapshot, 2026-05-28

Autonomous run of Eitan's daily liquidity snapshot per `Team/Eitan.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Build-phase degraded-mode digest — substantive LCR / NSFR / IRRBB / FX positions are not yet computed; this run is the daily-funding-event SLA heartbeat (§ 6 inactivity SLA) until the projection engines land.

**Headline:** 9 liquidity-related obligations indexed (0 PARTIAL / deferred) · 3 LCR / 0 NSFR projection events · 0 `SAMOSFundingApproved` events in the last 24h · 0 `ALCODecision` events in the last 7 days.

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
| `LCRRatioProjection` | 3 |
| `NSFRRatioProjection` | 0 |
| `IRRBBChecked` | 30 |
| `FXPositionReported` | 0 |
| `CapitalAction` | 0 |
| `SAMOSFundingApproved` | 0 |

_Build-only context: no live treasury position; no real SAMOS account; no live HQLA portfolio. Zero counts on every row are expected and not a substrate alarm. Once Ravi's ALM engine and Anya's liquidity-projection engine land, the daily expectation moves from heartbeat-only to real ratio sign-off._

## Treasury events (last 7 days)

| Event | Count |
|---|---|
| `ALCODecision` | 0 |
| `HedgeProgrammeApproved` | 0 |
| Prior `LiquiditySnapshot` (this agent) | 0 |

## Substrate gaps (build-phase)

- **Liquidity projection engine** — ✅ closed 2026-05-19. `runLiquidityProjection` live at `platform/liquidity/projection.ts`; event-store-backed provider defaults to the composition store; all five horizons (T+0, T+7, T+14, T+30, T+90) computed. `anya:liquidity-projection` handler uses it. Authority: D-TREASURY-GAPS-WAVE1.
- **ALM engine** — ✅ closed 2026-05-19. Repricing gap, ΔEVE, ΔNII engines live; `ravi:alm-run` handler emits `ALMRunCompleted` + `IRRBBChecked` events daily. Authority: D-TREASURY-GAPS-WAVE1.
- **Intraday liquidity watch** — ✅ closed 2026-05-19. Intraday HQLA-stress projection live in `platform/alm/intraday-stress.ts`; `ravi:intraday-stress` handler runs BAU + stress scenarios across 4 SAMOS windows. Authority: D-TREASURY-GAPS-WAVE1.
- **Auto-generated ALCO pack** — ✅ closed 2026-05-19. ALCO pack generator live at `platform/alco/`; `atlas:alco-pack` handler assembles all sections from live projection events; `ALCOPackGenerated` event registered. Authority: D-TREASURY-GAPS-WAVE1.
- **Collateral inventory substrate** — ✅ closed 2026-05-19. HQLA classifier + inventory projection + `atlas:collateral-snapshot` handler live (`platform/collateral/`). Authority: D-TREASURY-GAPS-WAVE1.
- **ILAAP engine** — ✅ closed 2026-05-19. Four stress scenarios; `ILAAPSummaryCompleted` events; `atlas:ilaap-run` handler registered. Authority: D-TREASURY-GAPS-WAVE1.
- **Settlement outflows (BA 325 §23)** — partially closed 2026-05-25. `buildSettlementOutflows` folds `TradeBooked` buy-side events with explicit `settlementDate` into the LCR denominator. Remaining gap: `SettlementInstructionIssued` event class for non-trade contractual outflows. Owner: Ravi + Atlas.
- **FTP curve generator (live market data)** — open. `ravi:ftp-curve-publish` runs with indicative ZAR rates (SARB repo + spreads). Live ZARONIA / JIBAR / SAGB feed deferred to vendor-selection. Owner: Ravi + Anya.

## Eitan's narrative

Register coverage stands at 9 liquidity-related obligations indexed, none yet at FULL: ORG-PR-06/07/08/11/14/15 carry `[TBD]` URNs against their owning policies, and the three prudential directives that *are* cited — ORG-PR-36 (PA D6/2015 revised LCR), ORG-PR-38 (PA D4/2021 externally-facilitated stress) and ORG-PR-43 (PA D1/2023 NSFR) — all point at the same not-yet-existing procedure `Procedures/by-policy/lcr-nsfr-liquidity-stress.md`. Degraded-mode is functioning as the daily-funding-event SLA stand-in: this is the first `LiquiditySnapshot` heartbeat (7-day prior count = 0), Anya's projection lane fired three `LCRRatioProjection` events in 24h, and `IRRBBChecked` posted 30 against ORG-PR-11. The remaining zeros — `HQLAReported`, `LiquidityReport`, `NSFRRatioProjection`, `FXPositionReported`, `SAMOSFundingApproved`, `CapitalAction` — are expected nulls in build-phase, not § 6 inactivity breaches; that clock starts the moment Ravi's engine lands.

The load-bearing observation is procedural: one planned file (`lcr-nsfr-liquidity-stress.md`) is the procedural home for *three* SARB directives simultaneously, and until it exists ORG-PR-36, -38 and -43 cannot move off PARTIAL. Second, the projection asymmetry — LCR live, NSFR silent — means BA 325 has a synthetic feed but BA 326 does not; that mismatch will become visible the first time ALCO asks for a paired LCR/NSFR view. Third, no `FXPositionReported` and no `ALCODecision` in 7 days is fine today, but it does mean ORG-PR-08/15 (Funding Strategy Policy) currently has no event-log footprint at all — when the SAMOS lane comes up, we will need a pre-positioned decision schema or the first live week will look inactive against its own obligations.

Next, concretely: (1) land the `lcr-nsfr-liquidity-stress.md` skeleton this week so ORG-PR-36/-38/-43 can resolve their `[TBD]` ownership lines against a real procedure path; (2) ask Anya to add `NSFRRatioProjection` as the next projection schema, paired to ORG-PR-43, so the LCR/NSFR view is symmetric before the first synthetic ALCO pack; (3) ALCO prep item — assemble a degraded-mode ALCO pack from the three `LCRRatioProjection` events and the 30 `IRRBBChecked` heartbeats, explicitly flagged as build-phase, so Camille and I have a co-chair artefact to iterate on before the engine lands and the SLA clocks turn on.

## Provenance

Read `Regulations/_obligations-register.md` for liquidity-related rows (ORG-PR-06 / -07 / -08 / -11 / -14 / -15 plus any LCR / NSFR / BCBS 248 / IRRBB / liquidity citations). Replayed `HQLAReported`, `LiquidityReport`, `LCRRatioProjection`, `NSFRRatioProjection`, `IRRBBChecked`, `FXPositionReported`, `CapitalAction`, `SAMOSFundingApproved`, `ALCODecision`, `HedgeProgrammeApproved`, `LiquiditySnapshot` from the host event store.
