---
agent: Eitan
trigger: liquidity-snapshot
asOf: 2026-05-30T06:53:07.098Z
decision-required: false
---

# Eitan — liquidity snapshot, 2026-05-30

Autonomous run of Eitan's daily liquidity snapshot per `Team/Eitan.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Build-phase degraded-mode digest — substantive LCR / NSFR / IRRBB / FX positions are not yet computed; this run is the daily-funding-event SLA heartbeat (§ 6 inactivity SLA) until the projection engines land.

**Headline:** 39 liquidity-related obligations indexed (0 PARTIAL / deferred) · 0 LCR / 0 NSFR projection events · 0 `SAMOSFundingApproved` events in the last 24h · 0 `ALCODecision` events in the last 7 days.

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
| ORG-PR-RETURNS-003 | `urn:obligation:bank:prudential:pa-d5-2025-returns-ba110-liquidity:v1` | Liquidity Risk Management Policy; Regulatory Reporting Policy | Eitan (Treasurer, governance); Bea (Accounting & financial reporting engineer, engineering) — BA 110 compilation |
| ORG-PR-RETURNS-004 | `urn:obligation:bank:prudential:pa-d5-2025-returns-ba120-nsfr:v1` | Liquidity Risk Management Policy; Regulatory Reporting Policy | Eitan (Treasurer, governance); Bea (Accounting & financial reporting engineer, engineering) — BA 120 compilation |
| ORG-PR-RETURNS-005 | `urn:obligation:bank:prudential:pa-d5-2025-returns-ba125-liquidity-monitoring:v1` | Liquidity Risk Management Policy; Regulatory Reporting Policy | Eitan (Treasurer, governance); Bea (Accounting & financial reporting engineer, engineering) — BA 125 compilation |
| ORG-PR-RETURNS-006 | `urn:obligation:bank:prudential:pa-d5-2025-returns-ba130-liquidity-stress:v1` | Liquidity Risk Management Policy; Stress Testing Policy; Regulatory Reporting Policy | Eitan (Treasurer, governance); Helena (Chief Risk Officer, governance) — stress testing; Bea (Accounting & financial reporting engineer, engineering) — BA 130 compilation |
| ORG-PR-RETURNS-015 | `urn:obligation:bank:prudential:pa-d5-2025-returns-ba340-irrbb:v1` | IRRBB Policy; Capital Management Policy; Regulatory Reporting Policy | Eitan (Treasurer, governance); Helena (Chief Risk Officer, governance) — IRRBB measurement; Bea (Accounting & financial reporting engineer, engineering) — BA 340 compilation |
| ORG-PR-P3-001 | `urn:obligation:bank:prudential:pa-d1-2024-p3-irrbb-application:v1` | IRRBB Policy; Pillar 3 Disclosure Policy; Capital Management Policy; `Procedures/by-policy/pillar-3-disclosure.md` (planned) | Eitan (Treasurer, governance) — IRRBB measurement; Camille (Chief Financial Officer, finance) — Pillar 3 disclosure governance; Bea (Accounting & financial reporting engineer, engineering) — BA 340/BA 410 compilation |
| ORG-PR-P3-002 | `urn:obligation:bank:prudential:pa-d1-2024-p3-irrbb-auditor-availability:v1` | Regulatory Engagement Policy; External Audit Policy | Owen (Company Secretary, governance) — regulatory-correspondence custody; Iris (Regulator-relations engineer, engineering) — acknowledgement submission |
| ORG-PR-P3-003 | `urn:obligation:bank:prudential:pa-d1-2024-p3-irrbb-circular-confirmation:v1` | Regulatory Change Management Policy; IRRBB Policy | Iris (Regulator-relations engineer, engineering) — PA circular monitoring; Camille (Chief Financial Officer, finance) — Pillar 3 IRRBB governance; Eitan (Treasurer, governance) — IRRBB requirements monitoring |
| ORG-PR-LCR-001 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-hqla-maintenance:v1` | Liquidity Risk Management Policy; LCR Policy; HQLA Management Policy | Eitan (Treasurer, governance) — HQLA portfolio management; Helena (Chief Risk Officer, governance) — liquidity risk appetite; Rohan (Market Risk Engineer, risk engineering) — LCR computation |
| ORG-PR-LCR-002 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-disclosure-d1-2019:v1` | Liquidity Risk Management Policy; Pillar 3 Disclosure Policy; Regulatory Reporting Policy | Eitan (Treasurer, governance); Bea (Accounting & financial reporting engineer, engineering) — LCR disclosure compilation; Iris (Regulator-relations engineer, engineering) — public disclosure |
| ORG-PR-LCR-003 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-consolidated-scope:v1` | Liquidity Risk Management Policy; LCR Policy; Consolidated Supervision Policy | Eitan (Treasurer, governance); Bea (Accounting & financial reporting engineer, engineering) — consolidated LCR calculation |
| ORG-PR-LCR-004 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-hqla-summation-cap:v1` | Liquidity Risk Management Policy; LCR Policy; HQLA Management Policy | Eitan (Treasurer, governance) — HQLA transferability assessment; Rohan (Market Risk Engineer, risk engineering) — consolidated LCR computation |
| ORG-PR-LCR-005 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-intragroup-elimination:v1` | Liquidity Risk Management Policy; LCR Policy; Consolidated Supervision Policy | Eitan (Treasurer, governance); Bea (Accounting & financial reporting engineer, engineering) — intragroup elimination methodology |
| ORG-PR-LCR-006 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-inflow-cap-75pct:v1` | Liquidity Risk Management Policy; LCR Policy | Eitan (Treasurer, governance); Rohan (Market Risk Engineer, risk engineering) — inflow-cap computation |
| ORG-PR-LCR-007 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-currency-rand-reporting:v1` | Liquidity Risk Management Policy; LCR Policy; FX Risk Policy | Eitan (Treasurer, governance) — currency liquidity monitoring; Rohan (Market Risk Engineer, risk engineering) — FX conversion for LCR reporting; Bea (Accounting & financial reporting engineer, engineering) — BA 110 Rand-reporting |
| ORG-PR-LCR-008 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-monthly-calculation:v1` | Liquidity Risk Management Policy; LCR Policy; Regulatory Reporting Policy | Eitan (Treasurer, governance); Rohan (Market Risk Engineer, risk engineering) — monthly LCR calculation; Bea (Accounting & financial reporting engineer, engineering) — BA 600 reporting |
| ORG-PR-LCR-009 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-public-disclosure-quarterly:v1` | Liquidity Risk Management Policy; Pillar 3 Disclosure Policy | Eitan (Treasurer, governance); Bea (Accounting & financial reporting engineer, engineering) — quarterly LCR disclosure compilation; Iris (Regulator-relations engineer, engineering) — public disclosure |
| ORG-PR-LCR-010 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-non-compliance-reporting:v1` | Liquidity Risk Management Policy; Regulatory Engagement Policy; Breach and Escalation Procedure | Eitan (Treasurer, governance) — primary reporting obligation; Iris (Regulator-relations engineer, engineering) — written notification to PA; Zara (Chief Compliance Officer, governance) — breach management oversight |
| ORG-PR-NSFR-001 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-calculation-formula:v1` | Liquidity Risk Management Policy; NSFR Policy; `Procedures/by-policy/lcr-nsfr-liquidity-stress.md` (planned) | Eitan (Treasurer, governance) — NSFR calculation; Rohan (Market Risk Engineer, risk engineering) — NSFR computation engine |
| ORG-PR-NSFR-002 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-asf-long-term-stability:v1` | Liquidity Risk Management Policy; NSFR Policy; Capital Management Policy | Eitan (Treasurer, governance) — ASF measurement; Rohan (Market Risk Engineer, risk engineering) — ASF calculation; Camille (Chief Financial Officer, finance) — regulatory capital classification |
| ORG-PR-NSFR-003 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-asf-non-financial-corporate:v1` | Liquidity Risk Management Policy; NSFR Policy | Eitan (Treasurer, governance); Rohan (Market Risk Engineer, risk engineering) — ASF factor application |
| ORG-PR-NSFR-004 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-asf-phase-out-zar-financial-corporate:v1` | Liquidity Risk Management Policy; NSFR Policy | Eitan (Treasurer, governance) — ASF phase-out monitoring; Rohan (Market Risk Engineer, risk engineering) — date-dependent ASF factor computation |
| ORG-PR-NSFR-005 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-factors:v1` | Liquidity Risk Management Policy; NSFR Policy; Asset and Liability Management Policy | Eitan (Treasurer, governance); Rohan (Market Risk Engineer, risk engineering) — RSF calculation; Helena (Chief Risk Officer, governance) — off-balance sheet exposure identification |
| ORG-PR-NSFR-006 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-cash-reserves:v1` | Liquidity Risk Management Policy; NSFR Policy | Eitan (Treasurer, governance); Rohan (Market Risk Engineer, risk engineering) — SARB reserve account RSF classification |
| ORG-PR-NSFR-007 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-derivative-liabilities:v1` | Liquidity Risk Management Policy; NSFR Policy; Derivatives Risk Policy | Eitan (Treasurer, governance) — derivative liability stable funding; Rohan (Market Risk Engineer, risk engineering) — gross derivative liability measurement |
| ORG-PR-NSFR-008 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-interdependent-assets:v1` | Liquidity Risk Management Policy; NSFR Policy; Governance and Internal Controls Policy | Eitan (Treasurer, governance) — supervisory approval request; Devon (Chief Operating Officer, governance) — executive committee approval; Helena (Chief Risk Officer, governance) — governance evaluation |
| ORG-PR-NSFR-009 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-rclf-treatment:v1` | Liquidity Risk Management Policy; NSFR Policy; LCR Policy; HQLA Management Policy | Eitan (Treasurer, governance) — RCLF classification and reporting; Rohan (Market Risk Engineer, risk engineering) — Level 2B HQLA calculation |
| ORG-PR-NSFR-010 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-contingent-facilities:v1` | Liquidity Risk Management Policy; NSFR Policy | Eitan (Treasurer, governance); Rohan (Market Risk Engineer, risk engineering) — contingent obligation RSF calculation |
| ORG-PR-NSFR-011 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-non-contractual-obligations:v1` | Liquidity Risk Management Policy; NSFR Policy | Eitan (Treasurer, governance); Rohan (Market Risk Engineer, risk engineering) — non-contractual obligation RSF classification |
| ORG-PR-NSFR-012 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-auditor-acknowledgement:v1` | Regulatory Engagement Policy; External Audit Policy | Owen (Company Secretary, governance) — regulatory-correspondence custody; Iris (Regulator-relations engineer, engineering) — acknowledgement submission |

## Treasury events (last 24 hours)

| Event | Count |
|---|---|
| `HQLAReported` | 0 |
| `LiquidityReport` | 0 |
| `LCRRatioProjection` | 0 |
| `NSFRRatioProjection` | 0 |
| `IRRBBChecked` | 10 |
| `FXPositionReported` | 0 |
| `CapitalAction` | 0 |
| `SAMOSFundingApproved` | 0 |

_Build-only context: no live treasury position; no real SAMOS account; no live HQLA portfolio. Zero counts on every row are expected and not a substrate alarm. Once Ravi's ALM engine and Anya's liquidity-projection engine land, the daily expectation moves from heartbeat-only to real ratio sign-off._

## Treasury events (last 7 days)

| Event | Count |
|---|---|
| `ALCODecision` | 0 |
| `HedgeProgrammeApproved` | 0 |
| Prior `LiquiditySnapshot` (this agent) | 3 |

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

Register coverage is 39 liquidity-related obligations indexed for the day, none currently flagged PARTIAL on the state axis — but six (`ORG-PR-06`, `-07`, `-08`, `-11`, `-14`, `-15`) still carry `[TBD]` URN bindings against the underlying PA directives, which is the substrate gap doing the real work here. Daily expected event types — `HQLAReported`, `LiquidityReport`, `LCRRatioProjection`, `NSFRRatioProjection`, `FXPositionReported`, `SAMOSFundingApproved` — all landed zero in the last 24h, which is the expected build-phase signature; the daily heartbeat (this is the fourth `LiquiditySnapshot` run on record) is the stand-in for the daily-funding-event SLA and is functioning as designed. No `ALCODecision` or `HedgeProgrammeApproved` over 7d is consistent with pre-engine state, not a § 6 inactivity breach.

The one observation that does merit a flag: `IRRBBChecked` fired 10 times in 24h with no corresponding projection or capital-action events downstream. In target state that asymmetry would be a Helena-and-me conversation under `ORG-PR-11` and `ORG-PR-RETURNS-015` (BA 340); in build-phase it's diagnostic only — Rohan's IRRBB engine is emitting check events ahead of the projection schema that would let me interpret them against EVE / ΔNII appetite. Worth noting that the IRRBB obligation cluster (`ORG-PR-11`, `ORG-PR-P3-001/-002/-003`) is the most cross-cutting unbound block: it gates the Pillar 3 IRRBB application path and the BA 340 compilation that Bea will need. Second-rank concern: `ORG-PR-LCR-010` (non-compliance reporting) and `ORG-PR-NSFR-008` (interdependent-asset supervisory approval) both presuppose a live LCR / NSFR ratio I cannot yet compute — they sit dormant correctly today, but the moment Anya's `LCRRatioProjection` lands, the breach-notification clock under `-LCR-010` becomes live and we need the Iris-side notification path wired before, not after.

Next concrete substrate step, in order: (1) bind URNs to the six `[TBD]` obligations — `ORG-PR-06/-07/-08/-14/-15` against the Liquidity Risk Management / Funding Strategy / ILAAP directive set, `ORG-PR-11` against the IRRBB directive — so the daily slice stops surfacing them as governance-only placeholders; (2) ask Anya to prioritise the `LCRRatioProjection` schema ahead of `NSFRRatioProjection` (LCR is daily-monitored under `ORG-PR-LCR-008`, NSFR is quarterly), with `HQLAReported` as the upstream event contract Ravi needs to emit; (3) ALCO prep item that follows — once the LCR projection lands, the first pack should cover `ORG-PR-LCR-001` HQLA composition, `ORG-PR-LCR-006` inflow-cap, and `ORG-PR-LCR-007` Rand-currency split, since those three are the live-ratio controls I'll be signing against month-end.

## Provenance

Read `Regulations/_obligations-register.md` for liquidity-related rows (ORG-PR-06 / -07 / -08 / -11 / -14 / -15 plus any LCR / NSFR / BCBS 248 / IRRBB / liquidity citations). Replayed `HQLAReported`, `LiquidityReport`, `LCRRatioProjection`, `NSFRRatioProjection`, `IRRBBChecked`, `FXPositionReported`, `CapitalAction`, `SAMOSFundingApproved`, `ALCODecision`, `HedgeProgrammeApproved`, `LiquiditySnapshot` from the host event store.
