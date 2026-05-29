---
agent: Eitan
trigger: liquidity-snapshot
asOf: 2026-05-29T06:53:50.096Z
decision-required: false
---

# Eitan — liquidity snapshot, 2026-05-29

Autonomous run of Eitan's daily liquidity snapshot per `Team/Eitan.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Build-phase degraded-mode digest — substantive LCR / NSFR / IRRBB / FX positions are not yet computed; this run is the daily-funding-event SLA heartbeat (§ 6 inactivity SLA) until the projection engines land.

**Headline:** 39 liquidity-related obligations indexed (0 PARTIAL / deferred) · 1 LCR / 0 NSFR projection events · 0 `SAMOSFundingApproved` events in the last 24h · 0 `ALCODecision` events in the last 7 days.

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
| `LCRRatioProjection` | 1 |
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
| Prior `LiquiditySnapshot` (this agent) | 1 |

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

Register coverage on the liquidity-related slice stands at 39 obligations indexed against me as Treasurer (sole or joint owner on all but the auditor-acknowledgement and circular-confirmation lines, which sit with Owen / Iris). None are flagged PARTIAL in today's snapshot — the register has them all, but every one of `ORG-PR-06/-07/-08/-11/-14/-15` is still carrying a `[TBD]` URN against the underlying policy obligations (Liquidity Risk Management, Funding Strategy, IRRBB), which means the pre-PA-directive policy spine that the post-2022 LCR/NSFR/IRRBB obligations bolt onto is not yet citation-grade. Degraded-mode is functioning as the daily-funding-event SLA stand-in: this is the second `LiquiditySnapshot` run in seven days, and the heartbeat is doing what § 6 expects of it while the engine is being built. Zero `HQLAReported`, zero `LiquidityReport`, zero `NSFRRatioProjection`, zero `FXPositionReported`, zero `SAMOSFundingApproved` over 24h are all build-phase-acceptable today — none of those event-types have a live producer yet — but they convert to § 6 inactivity-SLA breaches the moment Rohan's LCR/NSFR engine and the SAMOS-funding event emitter land. I am writing that conversion date into the ALCO pack now so it is not a surprise.

The one consequential reading: ten `IRRBBChecked` events landed in the window against one `LCRRatioProjection` and zero of everything else. That is the wrong shape — IRRBB is firing hot relative to the rest of the treasury surface, and with `ORG-PR-11` still `[TBD]` on the IRRBB Policy URN and `ORG-PR-P3-001` (Pillar 3 IRRBB application, `pa-d1-2024`) sitting downstream of it, I cannot yet tell from the snapshot whether those ten checks represent a genuine duration / EVE excursion or just an over-eager projection schema. Until the IRRBB obligation has a real URN and Anya's projection emits a delta-EVE / delta-NII figure with each check, I am treating this as a *watch* item for Helena rather than an ALCO-chair escalation — but if next week's snapshot shows the same ratio I will raise it formally. The single `LCRRatioProjection` against zero `HQLAReported` is also worth flagging: an LCR projection without a paired HQLA report is structurally incomplete, and `ORG-PR-LCR-001` (HQLA maintenance) and `ORG-PR-LCR-004` (HQLA summation cap) both expect the HQLA event to be the upstream input, not an afterthought.

Next substrate step, in order: (1) close the `[TBD]` URNs on `ORG-PR-06/-07/-08/-11/-14/-15` — these are my and Helena's policy obligations and they are gating the citation chain for every downstream PA-directive obligation in this slice; without them, `ORG-PR-36` (revised LCR), `ORG-PR-43` (NSFR), and `ORG-PR-NSFR-001..012` are anchored to placeholders. (2) Land the `HQLAReported` projection schema before the `LCRRatioProjection` schema is hardened, so the LCR projection has a real upstream rather than a synthetic one — Ravi and Rohan know the shape I need (Level 1 / Level 2A / Level 2B with the `ORG-PR-LCR-004` cap pre-applied). (3) For the next ALCO pack: a one-page note that enumerates which treasury event-types will flip from "build-phase-acceptable zero" to "§ 6 inactivity-SLA breach" on engine cutover, with `SAMOSFundingApproved` named explicitly as the daily-cadence one. That is the prep item I want sitting in front of Camille and Helena before we co-chair the next session.

## Provenance

Read `Regulations/_obligations-register.md` for liquidity-related rows (ORG-PR-06 / -07 / -08 / -11 / -14 / -15 plus any LCR / NSFR / BCBS 248 / IRRBB / liquidity citations). Replayed `HQLAReported`, `LiquidityReport`, `LCRRatioProjection`, `NSFRRatioProjection`, `IRRBBChecked`, `FXPositionReported`, `CapitalAction`, `SAMOSFundingApproved`, `ALCODecision`, `HedgeProgrammeApproved`, `LiquiditySnapshot` from the host event store.
