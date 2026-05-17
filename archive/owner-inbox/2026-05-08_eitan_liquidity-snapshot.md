---
agent: Eitan
trigger: liquidity-snapshot
asOf: 2026-05-08T08:14:24.850Z
decision-required: false
---

# Eitan — liquidity snapshot, 2026-05-08

Autonomous run of Eitan's daily liquidity snapshot per `Team/Eitan.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Build-phase degraded-mode digest — substantive LCR / NSFR / IRRBB / FX positions are not yet computed; this run is the daily-funding-event SLA heartbeat (§ 6 inactivity SLA) until the projection engines land.

**Headline:** 6 liquidity-related obligations indexed (0 PARTIAL / deferred) · 0 LCR / 0 NSFR projection events · 0 `SAMOSFundingApproved` events in the last 24h · 0 `ALCODecision` events in the last 7 days.

## Liquidity-related obligations slice

| Obligation | Citation | Owner | Status |
|---|---|---|---|
| ORG-PR-06 | BCBS D295 / BA 325 | Helena + Eitan | **IN FORCE** |
| ORG-PR-07 | BCBS D335 / BA 326 | Helena + Eitan | **IN FORCE** |
| ORG-PR-08 | BCBS 248 | Eitan | **IN FORCE** |
| ORG-PR-11 | BCBS D368 (IRRBB) | Helena + Eitan | **IN FORCE** |
| ORG-PR-14 | Banks Act + PA | Eitan + Helena | **IN FORCE** (annual cycle) |
| ORG-PR-15 | BCBS Sound Liquidity Risk Management (BCBS 144) | Eitan | **IN FORCE** |

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
| Prior `LiquiditySnapshot` (this agent) | 0 |

## Substrate gaps (build-phase)

- **Liquidity projection engine** — under build (Anya) per `Team/Eitan.md` § 16. Until live, LCR / NSFR are not query-able from the event log.
- **ALM engine** — under build (Ravi) per § 16. Daily ALM run is a manually-orchestrated query today.
- **FTP curve generator** — not yet built (§ 16). Quarterly FTP review degraded.
- **Auto-generated ALCO pack** — not yet built (§ 16). Pack authored against the cycle template; gap is the load-bearing P6-downward seam (Eitan does not assemble; he generates).
- **Intraday liquidity watch (live)** — partial; settlement-account watch exists, intraday HQLA-stress projection is not live (§ 16). Intraday-stress trigger SLA (§ 7, 30-min response) is dormant in build-phase.
- **Collateral inventory substrate** — not yet built (§ 16). Treasury collateral-move sign-offs operate on registered limits without live inventory.
- **ILAAP engine** — not yet built (Helena's gap, Eitan co-owns liquidity slice).

## Eitan's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Snapshot above stands on its own._

## Provenance

Read `Regulations/_obligations-register.md` for liquidity-related rows (ORG-PR-06 / -07 / -08 / -11 / -14 / -15 plus any LCR / NSFR / BCBS 248 / IRRBB / liquidity citations). Replayed `HQLAReported`, `LiquidityReport`, `LCRRatioProjection`, `NSFRRatioProjection`, `IRRBBChecked`, `FXPositionReported`, `CapitalAction`, `SAMOSFundingApproved`, `ALCODecision`, `HedgeProgrammeApproved`, `LiquiditySnapshot` from the host event store.
