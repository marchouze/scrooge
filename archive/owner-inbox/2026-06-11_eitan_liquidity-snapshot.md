---
agent: Eitan
trigger: liquidity-snapshot
asOf: 2026-06-11T06:53:07.212Z
decision-required: false
---

# Eitan — liquidity snapshot, 2026-06-11

Autonomous run of Eitan's daily liquidity snapshot per `Team/Eitan.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Build-phase degraded-mode digest — substantive LCR / NSFR / IRRBB / FX positions are not yet computed; this run is the daily-funding-event SLA heartbeat (§ 6 inactivity SLA) until the projection engines land.

**Headline:** 39 liquidity-related obligations indexed (0 PARTIAL / deferred) · 0 LCR / 0 NSFR projection events · 0 `NostroFundingApproved` events in the last 24h · 0 `ALCODecision` events in the last 7 days.

## Liquidity-related obligations slice

| Obligation | Citation | Owner | Status |
|---|---|---|---|
| ORG-PR-06 | [TBD] | Liquidity Risk Management Policy | cro |
| ORG-PR-07 | [TBD] | Liquidity Risk Management Policy | cro |
| ORG-PR-08 | [TBD] | Liquidity Risk Management Policy; Funding Strategy Policy | treasurer |
| ORG-PR-11 | [TBD] | IRRBB Policy (within Risk Management Framework) | cro |
| ORG-PR-14 | [TBD] | Liquidity Risk Management Policy; ILAAP | treasurer |
| ORG-PR-15 | [TBD] | Liquidity Risk Management Policy; Funding Strategy Policy | treasurer |
| ORG-PR-36 | `urn:obligation:bank:prudential:pa-d6-2015-revised-lcr:v1` | Liquidity Risk Management Policy; Funding Strategy Policy; `Procedures/by-policy/lcr-nsfr-liquidity-stress.md` (planned per research-findings doc §7) | treasurer |
| ORG-PR-38 | `urn:obligation:bank:prudential:pa-d4-2021-externally-facilitated-liquidity-stress-simulation:v1` | Liquidity Risk Management Policy; Stress Testing Policy; Risk Management Framework; `Procedures/by-policy/lcr-nsfr-liquidity-stress.md` (planned) | cro |
| ORG-PR-43 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr:v1` | Liquidity Risk Management Policy; Funding Strategy Policy; `Procedures/by-policy/lcr-nsfr-liquidity-stress.md` (planned per research-findings doc §7) | treasurer |
| ORG-PR-RETURNS-003 | `urn:obligation:bank:prudential:pa-d5-2025-returns-ba110-liquidity:v1` | Regulatory Reporting Policy; Off-Balance-Sheet Policy | treasurer |
| ORG-PR-RETURNS-004 | `urn:obligation:bank:prudential:pa-d5-2025-returns-ba120-nsfr:v1` | Financial Reporting Policy; Regulatory Reporting Policy | cfo |
| ORG-PR-RETURNS-005 | `urn:obligation:bank:prudential:pa-d5-2025-returns-ba125-liquidity-monitoring:v1` | Liquidity Risk Management Policy; Regulatory Reporting Policy | treasurer |
| ORG-PR-RETURNS-006 | `urn:obligation:bank:prudential:pa-d5-2025-returns-ba130-liquidity-stress:v1` | Liquidity Risk Management Policy; Stress Testing Policy; Regulatory Reporting Policy | treasurer |
| ORG-PR-RETURNS-015 | `urn:obligation:bank:prudential:pa-d5-2025-returns-ba340-irrbb:v1` | Equity Risk Policy; Capital Management Policy; Regulatory Reporting Policy | cro |
| ORG-PR-P3-001 | `urn:obligation:bank:prudential:pa-d1-2024-p3-irrbb-application:v1` | IRRBB Policy; Pillar 3 Disclosure Policy; Capital Management Policy; `Procedures/by-policy/pillar-3-disclosure.md` (planned) | treasurer |
| ORG-PR-P3-002 | `urn:obligation:bank:prudential:pa-d1-2024-p3-irrbb-auditor-availability:v1` | Regulatory Engagement Policy; External Audit Policy | company-secretary |
| ORG-PR-P3-003 | `urn:obligation:bank:prudential:pa-d1-2024-p3-irrbb-circular-confirmation:v1` | Regulatory Change Management Policy; IRRBB Policy | information-officer |
| ORG-PR-LCR-001 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-hqla-maintenance:v1` | Liquidity Risk Management Policy; LCR Policy; HQLA Management Policy | treasurer |
| ORG-PR-LCR-002 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-disclosure-d1-2019:v1` | Liquidity Risk Management Policy; Pillar 3 Disclosure Policy; Regulatory Reporting Policy | treasurer |
| ORG-PR-LCR-003 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-consolidated-scope:v1` | Liquidity Risk Management Policy; LCR Policy; Consolidated Supervision Policy | treasurer |
| ORG-PR-LCR-004 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-hqla-summation-cap:v1` | Liquidity Risk Management Policy; LCR Policy; HQLA Management Policy | treasurer |
| ORG-PR-LCR-005 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-intragroup-elimination:v1` | Liquidity Risk Management Policy; LCR Policy; Consolidated Supervision Policy | treasurer |
| ORG-PR-LCR-006 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-inflow-cap-75pct:v1` | Liquidity Risk Management Policy; LCR Policy | treasurer |
| ORG-PR-LCR-007 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-currency-rand-reporting:v1` | Liquidity Risk Management Policy; LCR Policy; FX Risk Policy | treasurer |
| ORG-PR-LCR-008 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-monthly-calculation:v1` | Liquidity Risk Management Policy; LCR Policy; Regulatory Reporting Policy | treasurer |
| ORG-PR-LCR-009 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-public-disclosure-quarterly:v1` | Liquidity Risk Management Policy; Pillar 3 Disclosure Policy | treasurer |
| ORG-PR-LCR-010 | `urn:obligation:bank:prudential:pa-d1-2022-lcr-non-compliance-reporting:v1` | Liquidity Risk Management Policy; Regulatory Engagement Policy; Breach and Escalation Procedure | treasurer |
| ORG-PR-NSFR-001 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-calculation-formula:v1` | Liquidity Risk Management Policy; NSFR Policy; `Procedures/by-policy/lcr-nsfr-liquidity-stress.md` (planned) | treasurer |
| ORG-PR-NSFR-002 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-asf-long-term-stability:v1` | Liquidity Risk Management Policy; NSFR Policy; Capital Management Policy | treasurer |
| ORG-PR-NSFR-003 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-asf-non-financial-corporate:v1` | Liquidity Risk Management Policy; NSFR Policy | treasurer |
| ORG-PR-NSFR-004 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-asf-phase-out-zar-financial-corporate:v1` | Liquidity Risk Management Policy; NSFR Policy | treasurer |
| ORG-PR-NSFR-005 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-factors:v1` | Liquidity Risk Management Policy; NSFR Policy; Asset and Liability Management Policy | treasurer |
| ORG-PR-NSFR-006 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-cash-reserves:v1` | Liquidity Risk Management Policy; NSFR Policy | treasurer |
| ORG-PR-NSFR-007 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-derivative-liabilities:v1` | Liquidity Risk Management Policy; NSFR Policy; Derivatives Risk Policy | treasurer |
| ORG-PR-NSFR-008 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-interdependent-assets:v1` | Liquidity Risk Management Policy; NSFR Policy; Governance and Internal Controls Policy | treasurer |
| ORG-PR-NSFR-009 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-rclf-treatment:v1` | Liquidity Risk Management Policy; NSFR Policy; LCR Policy; HQLA Management Policy | treasurer |
| ORG-PR-NSFR-010 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-contingent-facilities:v1` | Liquidity Risk Management Policy; NSFR Policy | treasurer |
| ORG-PR-NSFR-011 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-rsf-non-contractual-obligations:v1` | Liquidity Risk Management Policy; NSFR Policy | treasurer |
| ORG-PR-NSFR-012 | `urn:obligation:bank:prudential:pa-d1-2023-nsfr-auditor-acknowledgement:v1` | Regulatory Engagement Policy; External Audit Policy | company-secretary |

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
| `NostroFundingApproved` | 0 |

_Build-only context: no live treasury position; no real SAMOS account; no live HQLA portfolio. Zero counts on every row are expected and not a substrate alarm. Once Ravi's ALM engine and Anya's liquidity-projection engine land, the daily expectation moves from heartbeat-only to real ratio sign-off._

## Treasury events (last 7 days)

| Event | Count |
|---|---|
| `ALCODecision` | 0 |
| `HedgeProgrammeApproved` | 0 |
| Prior `LiquiditySnapshot` (this agent) | 14 |

## Substrate gaps (build-phase)

- **Liquidity projection engine** — ✅ closed 2026-05-19. `runLiquidityProjection` live at `platform/liquidity/projection.ts`; event-store-backed provider defaults to the composition store; all five horizons (T+0, T+7, T+14, T+30, T+90) computed. `anya:liquidity-projection` handler uses it. Authority: D-TREASURY-GAPS-WAVE1.
- **ALM engine** — ✅ closed 2026-05-19. Repricing gap, ΔEVE, ΔNII engines live; `ravi:alm-run` handler emits `ALMRunCompleted` + `IRRBBChecked` events daily. Authority: D-TREASURY-GAPS-WAVE1.
- **Intraday liquidity watch** — ✅ closed 2026-05-19. Intraday HQLA-stress projection live in `platform/alm/intraday-stress.ts`; `ravi:intraday-stress` handler runs BAU + stress scenarios across 4 SAMOS windows. Authority: D-TREASURY-GAPS-WAVE1.
- **Auto-generated ALCO pack** — ✅ closed 2026-05-19. ALCO pack generator live at `platform/alco/`; `atlas:alco-pack` handler assembles all sections from live projection events; `ALCOPackGenerated` event registered. Authority: D-TREASURY-GAPS-WAVE1.
- **Collateral inventory substrate** — ✅ closed 2026-05-19. HQLA classifier + inventory projection + `atlas:collateral-snapshot` handler live (`platform/collateral/`). Authority: D-TREASURY-GAPS-WAVE1.
- **ILAAP engine** — ✅ closed 2026-05-19. Four stress scenarios; `ILAAPSummaryCompleted` events; `atlas:ilaap-run` handler registered. Authority: D-TREASURY-GAPS-WAVE1.
- **Settlement outflows (BA 110 §23)** — closed 2026-06-02 for correspondent-bank obligations. `buildSettlementOutflows` folds `TradeBooked` buy-side events (explicit `settlementDate`) AND `SettlementInstructionIssued` events into the LCR denominator. The correspondent-nostro connector now emits a paired `SettlementInstructionIssued` repayment leg for each intraday `FundingDrawnDown` — putting correspondent funding into LCR with no double-count (`FundingDrawnDown` is not folded by `buildFundingPositions`). Remaining scope: maturing own-issued debt / other non-trade outflows. Owner: Ravi + Atlas.
- **FTP curve generator (live market data)** — open. `ravi:ftp-curve-publish` runs with indicative ZAR rates (SARB repo + spreads). Live ZARONIA / JIBAR / SAGB feed deferred to vendor-selection. Owner: Ravi + Anya.

## Eitan's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011Cbw2nmuJNRHy3W8dpcvAC"})._

## Provenance

Read `Regulations/_obligations-register.md` for liquidity-related rows (ORG-PR-06 / -07 / -08 / -11 / -14 / -15 plus any LCR / NSFR / BCBS 248 / IRRBB / liquidity citations). Replayed `HQLAReported`, `LiquidityReport`, `LCRRatioProjection`, `NSFRRatioProjection`, `IRRBBChecked`, `FXPositionReported`, `CapitalAction`, `NostroFundingApproved`, `ALCODecision`, `HedgeProgrammeApproved`, `LiquiditySnapshot` from the host event store.
