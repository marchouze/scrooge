---
policy-parent: liquidity-risk-management-policy-v1
last-reviewed: 2026-05-21
procedureId: PROC-RISK-LLM-01
title: Liquidity limit management
author: Ravi (Treasury and ALM engineer, engineering)
date: 2026-05-21
owner: Eitan (Treasurer, governance) · Ravi (Treasury and ALM engineer, engineering) · Helena (Chief Risk Officer, governance — RAS calibration)
status: POPULATED
policy-cited: liquidity-risk-management-policy-v1
system-capability: "@platform/risk/liquidity-limit-engine"
---

# Procedure — Liquidity limit management

**Procedure ID:** PROC-RISK-LLM-01
**Owner:** Eitan (Treasurer, governance) — first-line ownership; Ravi (Treasury and ALM engineer, engineering — reports to Eitan) — engineering substrate; Helena (Chief Risk Officer, governance) — RAS calibration and second-line challenge.
**Approval:** ALCO (tier-3 / tier-2 limit setting); BRC (tier-1 RAS recalibration; appetite); CEO (interim Board, exception sign-off above ALCO authority); PA (notification under Reg 26 on LCR / NSFR PA-minimum breach).
**Cadence:** Daily (tier-1 / tier-2 monitoring against LCR + NSFR + intraday); intraday (real-time monitoring under stress conditions per CFP Tier-2 / Tier-3); monthly (ALCO concentration review); on-trigger (`LiquidityLimitBreached` → Step 7 / Step 8); annual (RAS recalibration cycle per LRM Policy §6.3 ILAAP).
**Version:** v0.1 — 2026-05-21
**Status:** POPULATED
**Standing authority:** `D-RAS` (CEO-approved 2026-05-06); Liquidity Risk Management Policy v1 (Camille (Chief Financial Officer, governance) + Eitan + Helena, 2026-05-11); `brief:ravi:liquidity-limit-engine-mirroring-credit-limit-en:2026-05-21`.

## 1. Source policy

- [`archive/owner-inbox/2026-05-11_camille-eitan-helena_liquidity-risk-management-policy-v1.md`](../../archive/owner-inbox/2026-05-11_camille-eitan-helena_liquidity-risk-management-policy-v1.md) — Liquidity Risk Management Policy v1 (IN FORCE 2026-05-11, owners: Camille + Eitan + Helena) — specifically:
  - **§2 (LCR governance)** — PA minimum 100%; internal floor 120% (build-phase planning floor; ILAAP-calibrated value supersedes at W2 Slice 5).
  - **§3 (NSFR governance)** — PA minimum 100%; internal floor 115%.
  - **§4 (Intraday liquidity)** — intraday buffer governance per BCBS 248.
  - **§9.1 (Breach classification)** — Critical / High / Medium / Low taxonomy and escalation matrix.
  - **§9.2 (Typed event patterns)** — `LcrRatioBreach`, `NsfrRatioBreach`, `IntradayStressDetected`, `FundingConcentrationAlertTriggered`, `HqlaConcentrationBreached`. **Note:** this procedure consolidates the five policy-listed event names into the engine's two canonical events `LiquidityLimitBreached` + `LiquidityLimitBreachDisposed`; the prose distinction lives in the breach payload's `line` field. The substrate convention reduces the surface to a single breach lifecycle and keeps the engine schema closed under the LRM Policy's full breach taxonomy.
  - **§9.3 (Restoration and remediation)** — cause analysis, restoration plan, closure rules, post-mortem.
- [`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`](../../archive/owner-inbox/2026-05-06_risk-appetite-statement-and-framework.md) §B3 — RAS liquidity-appetite tiered limits (the engine's tier-1 / tier-2 / tier-3 threshold inputs).

The obligation chain (Principle 2):

```
Regulation (Banks Act §§ 60–72; RRB Reg 26 — LCR + intraday + ILAAP;
            RRB Reg 26A — NSFR; PA D6/2015; PA D1/2023; PA D4/2021;
            BCBS 144; BCBS D295; BCBS D335; BCBS 248)
  → Policy: liquidity-risk-management-policy-v1
    (§2 LCR; §3 NSFR; §4 intraday; §9.1 breach taxonomy; §9.3 restoration)
    → PROC-RISK-LLM-01 (this procedure — tier-by-line threshold matrix,
                       breach detection, escalation matrix, disposal flow)
      → @platform/risk/liquidity-limit-engine
        → @platform/liquidity (LCR / NSFR computation engine — Anya)
        → @platform/alm (ALM positions projection — Ravi parallel brief)
        → @platform/escalation (Amber / Red / Critical-Red routing — existing)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-06` (BCBS D295 / BA 110 — LCR ≥ 100%) | Maintain LCR ≥ 100% at all times under stress assumptions; internal buffer per ILAAP-calibrated floor. |
| `ORG-PR-07` (BCBS D335 / BA 120 — NSFR ≥ 100%) | Maintain NSFR ≥ 100% at all times. |
| `ORG-PR-08` (BCBS 248 — Intraday liquidity monitoring tools) | Seven intraday-monitoring metrics; intraday buffer adequate for peak net debit position. |
| `ORG-PR-14` (Banks Act + PA ILAAP Directive) | Annual ILAAP submission attesting that limits, buffers, and CFP are adequate. |
| `ORG-PR-15` (BCBS 144 — Contingency Funding Plan) | Annual CFP rehearsal; CFP trigger taxonomy aligned with breach severity. |
| `ORG-PR-36` (PA D6/2015 — Revised LCR) | SA-specific LCR calibration; Reg 26(7) HQLA eligibility; Reg 26(11) inflow cap. |
| `ORG-PR-38` (PA D4/2021 — externally-facilitated liquidity stress) | Participation in PA-facilitated stress simulations; findings incorporated into ILAAP. |
| `ORG-PR-43` (PA D1/2023 — Matters related to NSFR) | NSFR calibration; ZAR financial-corporate ASF phase-out tracking. |

## 3. Purpose

This procedure operationalises the tier-by-line limit framework that Liquidity Risk Management Policy v1 §9.1 defers to it. The procedure is the policy input to `@platform/risk/liquidity-limit-engine` and the recon items that Vera (Internal audit engineer, engineering — reports to Thandiwe (Chief Audit Executive, governance)) asserts against the engine's output.

Specifically the procedure governs:

1. The **tier-by-line threshold matrix** — the numeric thresholds at which each liquidity line crosses from green → tier-3 → tier-2 → tier-1 (§5.1 below).
2. The **breach detection cadence** — daily (portfolio ratios); intraday under stress (per CFP activation); monthly (concentration metrics).
3. The **escalation matrix** — which actors are notified at which severity, and within which SLA (§5.2 below).
4. The **disposal flow** — how a breach is closed via `LiquidityLimitBreachDisposed`, including the four sanctioned disposition types (remediated / restored / accepted / recalibrated).
5. The **gateway block rule** — any payment or trade that would worsen a tier-1 line in red is rejected at the pre-flight check (§5.4 below). This mirrors the credit-limit-engine block at PROC-RISK-CLM-01 Step 5.

The procedure assumes the upstream measurement substrate (Anya (Liquidity & projections engineer, engineering)'s `LCRComputed` / `NSFRComputed` events; the ALM-positions projection from Ravi's parallel brief) is in place. The build-phase default for any line without upstream data is `no-positions` — the engine produces no breach event for a line it cannot measure.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| `LCRComputed { lcrRatioPct, status }` daily | Tier-1 / tier-2 / tier-3 LCR threshold check — Steps 1–5 |
| `NSFRComputed { nsfrRatioPct, status }` quarterly | Tier-1 / tier-2 / tier-3 NSFR threshold check — Steps 1–5 |
| `IntradayHQLAStressProjection { peakNetDebitZar, bufferRemainingZar }` intraday | Intraday tier-1 buffer check — Steps 1–4 |
| `ALCOPackGenerated { fundingConcentration*Pct, hqlaConcentrationPct }` monthly | Concentration tier-1 / tier-2 check — Steps 1–5 |
| Payment / trade pre-flight gateway call | Step 5 only — gateway block on tier-1 red |
| `LiquidityLimitBreached { breachId, tier, line, severity }` engine emit | Steps 6 (cause analysis) + 7 (escalation) |
| ALCO / BRC / CEO restoration sign-off | Step 8 disposal — emit `LiquidityLimitBreachDisposed` |
| `RasLineCalibrated { lineRef, threshold }` Helena recalibration | Engine configuration refresh — Step 9 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Observation read.** The engine reads the latest portfolio measurement events per line (`LCRComputed`, `NSFRComputed`, `IntradayHQLAStressProjection`, `ALCOPackGenerated`). For each line the latest non-null observation is the engine's `current` value. Lines without upstream data are recorded as `no-positions`; no breach event is produced. | `system` | `@platform/risk/liquidity-limit-engine` `getPortfolioObservations` + `getConcentrationObservations` | Build-phase reality: with no live balance sheet the engine status is `no-positions` across the board. The substrate is exercised by test fixtures + by the ALM-substrate brief landing in parallel. |
| 2 | **Tier-threshold comparison.** The engine compares each observation against the tier-1 / tier-2 / tier-3 thresholds in §5.1. For floor lines (LCR, NSFR, intraday buffer) a value `< threshold` is a breach; for ceiling lines (concentration) a value `> threshold` is a breach. The **worst tier crossed** (tier-1 > tier-2 > tier-3) is the breach severity. | `system` | `@platform/risk/liquidity-limit-engine` `detectBreaches` | Severity precedence per LRM Policy §9.1: critical (tier-1) > high (tier-2) > medium (tier-3). One `LiquidityLimitBreached` payload per (line, subjectRef) — the worst-tier collapse. |
| 3 | **Breach emission.** For each detected breach, the engine emits `LiquidityLimitBreached { breachId, tier, line, current, threshold, currentUnit, severity, subjectRef?, detectedAt, sourceEventId? }`. `breachId` follows the convention `LL-BREACH-<YYYY>-<seq>`. The `sourceEventId` field traces the breach to its upstream measurement event for full provenance. | `agent` (Ravi) + `system` | `@platform/risk/liquidity-limit-engine` + `@platform/event-store` | Emission is the **caller's** responsibility (Ravi's daily limit-sweep handler wraps the engine output). The engine itself is a pure function over event-store reads. |
| 4 | **Severity routing.** The engine routes each breach to the actor set defined in §5.2 below. Critical breaches additionally fan out to the gateway block (Step 5). | `system` | `@platform/escalation` | Event: `AgentEscalation { escalationId, raisedBy, question, severity: "high"|"critical", routedTo[] }` — one per critical / high breach. Tied to the breach via `breachId` in the `question` field for the unescalated-breach recon. |
| 5 | **Gateway block.** Any payment / trade pre-flight that touches a flow-creating channel calls `checkLiquidityGate`. If any tier-1 liquidity line is in red, the gateway returns `{ ok: false, blockReason: "Tier1LiquidityRed" | "Tier1IntradayBreach" | "Tier1ConcentrationBreach" }` and the gateway emits `GatewayCheckCompleted { outcome: "reject" }` with a rejection citation pointing to LRM Policy §9.1. | `system` | `@platform/risk/liquidity-limit-engine` `checkLiquidityGate` | This mirrors the credit-limit gateway block at PROC-RISK-CLM-01 Step 5 (Kai's pre-trade check). The block is a hard reject — no override; tier-1 red requires a `LiquidityLimitBreachDisposed { disposition: "accepted" }` standing exception before trading resumes. |
| 6 | **Cause analysis.** Eitan documents the root cause of the breach within 1 business day (Critical) or 2 business days (High) of detection per LRM Policy §9.3 step 1. The analysis is filed as an RMS document and cited in the disposal event. | `agent` (Eitan) | `@platform/rms` + `@platform/escalation` | Output: RMS document with hash referenced in the disposal event's `citation` field. |
| 7 | **Restoration plan.** Eitan presents a restoration plan to ALCO within 1 business day (Critical) or 3 business days (High). The plan identifies the specific liquidity action(s) — HQLA top-up, funding-tenor reshape, depositor diversification — and the timeline to restore the ratio / buffer to the internal floor. | `agent` (Eitan) + `human` (ALCO) | `@platform/event-store` (`ALCODecision`) | Output event: `ALCODecision { decisionType: "liquidity-restoration-plan", decisionId, asOf }` recording the ALCO sign-off. |
| 8 | **Disposal.** When the restoration path executes and the line returns to the internal floor (or above) and has remained there for the LRM Policy §9.3 step 3 consecutive-business-day window (3 business days), Eitan emits `LiquidityLimitBreachDisposed { breachId, disposition, citation, finalValue, disposedBy, disposedAt }`. The four sanctioned disposition values are: **remediated** (corrective action restored the line); **restored** (market/organic restoration); **accepted** (CEO-approved standing exception within the 90-day window); **recalibrated** (RAS line recalibrated upward — the prior breach reflected a stale appetite line). | `agent` (Eitan) + `human` (ALCO / CEO) | `@platform/risk/liquidity-limit-engine` + `@platform/event-store` | Disposal closes the breach for the unescalated-breach recon (Step 11 below). Tier-1 disposals require ALCO sign-off; `accepted` dispositions require a co-pointing CEO `Decision` event referenced in the `citation` field. |
| 9 | **RAS recalibration refresh.** When Helena emits `RasLineCalibrated { lineRef, threshold }` updating a tier threshold, the engine refreshes its in-memory configuration on the next run. The prior configuration remains in the event-store as authoritative history; the engine projects the current state from the latest calibration event per line. | `agent` (Helena) + `system` | `@platform/risk/liquidity-limit-engine` `DEFAULT_LIMIT_CONFIGS` override | Recalibration is a substrate gap: in v0 of the engine the configuration is the static `DEFAULT_LIMIT_CONFIGS` array; v1 will fold `RasLineCalibrated` events to produce a live configuration projection. See §10 substrate gaps. |
| 10 | **Post-mortem (Critical only).** For Critical breaches, Eitan and Helena produce a post-mortem brief within 10 business days of disposal. The post-mortem identifies whether the breach reflects a policy gap (requiring LRM Policy amendment), a process failure (requiring procedure update), or a market condition beyond the bank's control. | `agent` (Eitan) + `agent` (Helena) | `@platform/rms` | Output: RMS document; cross-referenced in next ALCO + BRC pack. |
| 11 | **Recon assurance.** Vera (Internal audit engineer, engineering — reports to Thandiwe (Chief Audit Executive, governance)) runs `recon:liquidity-limit-breach-unescalated` daily — every `LiquidityLimitBreached` with severity critical or high must have either a paired `LiquidityLimitBreachDisposed` within the LRM Policy §9.3 SLA, an `AgentEscalation` referencing the breach, or a `PaNotificationSubmitted` for tier-1 PA-minimum breaches. Vera additionally runs `recon:liquidity-limit-coverage` — every RAS liquidity-appetite line has at least one configured tier in the engine's `DEFAULT_LIMIT_CONFIGS`. | `agent` (Vera) | `@platform/recon` | Failure modes: unescalated breach → Critical Vera finding; missing coverage → Critical Vera finding. Both block CI. |

### 5.1 Tier-by-line threshold matrix

The matrix below is the build-phase calibration shipped in `prototype/platform/risk/liquidity-limit-engine/config.ts` (`DEFAULT_LIMIT_CONFIGS`). It encodes LRM Policy v1 §§ 2.1, 2.5, 3.1, 4.3, 9.1 in concrete numbers. The thresholds are recalibrated by Helena at each RAS cycle (per LRM Policy §6.3); the engine reads the latest `RasLineCalibrated` event per line (Step 9 above) in v1.

| Line | Tier-1 (Critical) | Tier-2 (High) | Tier-3 (Medium) | Direction | Unit | Policy reference |
|---|---|---|---|---|---|---|
| `lcr-ratio` | 100 | 120 | 130 | floor (below = breach) | percent | LRM §2.1 (PA min); §2.5 (internal floor) |
| `nsfr-ratio` | 100 | 115 | 125 | floor | percent | LRM §3.1 (PA min); §3.1 (internal floor) |
| `intraday-liquidity-buffer` | 0 (build-phase) | n/a | n/a | floor | ZAR minor units | LRM §4.3 (intraday buffer); BCBS 248 |
| `funding-concentration-counterparty` | 25 | 15 | n/a | ceiling (above = breach) | percent | LRM §9.1 (Single-counterparty 15% High) |
| `funding-concentration-depositor` | n/a | 15 | n/a | ceiling | percent | LRM §9.1 (consistent w/ counterparty) |
| `funding-concentration-tenor` | n/a | 25 | n/a | ceiling | percent | LRM §9.1; ALCO sets tenor limit |
| `hqla-concentration` | 40 | 15 | n/a | ceiling | percent | LRM §2.2 (L2 combined cap 40%; L2B 15%) |
| `contingent-liquidity` | reserved | reserved | reserved | floor | ZAR minor units | LRM §5 (CFP) — engine line reserved; calibration follows Eitan's CFP-trigger work |

Calibration rationale: the LCR ladder (100 / 120 / 130) leaves a +20pp internal management buffer above PA minimum per LRM Policy §2.5 (build-phase planning floor; ILAAP-calibrated value supersedes at W2 Slice 5) and a +10pp early-warning band above the internal floor. The NSFR ladder (100 / 115 / 125) follows the same logic with a +15pp internal floor per LRM Policy §3.1.

### 5.2 Escalation matrix

| Severity | Trigger | Notified within | Forum convened | Notification channel |
|---|---|---|---|---|
| Critical (tier-1) | LCR ≤ 100%, NSFR ≤ 100%, intraday buffer breach, single-counterparty funding ≥ 25%, HQLA combined ≥ 40% | Immediate (≤ 4 hours) | ALCO within 4 hours; BRC notified same day; PA notification under Reg 26 | `AgentEscalation { severity: "critical", routedTo: ["Eitan", "Helena", "Camille", "Devon (COO, governance)", "CEO"] }` + `PaNotificationSubmitted` |
| High (tier-2) | LCR 100-120%, NSFR 100-115%, single-counterparty funding ≥ 15%, HQLA concentration ≥ 15%, tenor concentration ≥ 25% | ≤ 2 hours | ALCO within 24 hours; BRC at next meeting (or earlier if persists ≥ 3 business days) | `AgentEscalation { severity: "high", routedTo: ["Eitan", "Helena"] }` |
| Medium (tier-3) | LCR ≤ 130%, NSFR ≤ 125% (early-warning band) | ≤ 1 business day | Included in next ALCO meeting agenda | First-line documentation; Helena notified |
| Low (sub-tier-3) | Individual category concentration approaching limit; minor intraday metric exceeding normal range | EOD report | ALCO standing-agenda monitoring section | First-line EOD report |

### 5.3 Disposition types

Per LRM Policy v1 §9.3 the engine recognises four disposition types in the `LiquidityLimitBreachDisposed.disposition` field:

| Disposition | Definition | Required co-event |
|---|---|---|
| `remediated` | Corrective action restored the ratio / buffer to the internal floor (HQLA top-up; funding-tenor reshape; depositor diversification). | `ALCODecision { decisionType: "liquidity-restoration-plan" }` cited in `citation` field. |
| `restored` | Market or organic restoration (e.g. counterparty settlement reduces concentration); no explicit action by the bank. | None required; Eitan's first-line attestation suffices. |
| `accepted` | CEO-approved standing exception within the 90-day window per LRM Policy §8 / §9.3 — bank tolerates the breach with risk-mitigant compensating controls. | `Decision { decisionId, phase: "approved", authority: "CEO" }` cited in `citation` field. |
| `recalibrated` | RAS Tier line recalibrated upward — the prior breach reflected a stale appetite line, not a real exposure. | `RasLineCalibrated { lineRef, threshold }` cited in `citation` field. |

### 5.4 Gateway block rule

The engine exposes `checkLiquidityGate(opts)` for pre-flight integration. The contract:

| Caller | Block trigger | Effect |
|---|---|---|
| Payment-out gateway (Tomas — Operations & payments engineer, engineering) | Any tier-1 line in red | Reject payment; emit `GatewayCheckCompleted { outcome: "reject", blockReason }` with citation `LRM-S9.1`. |
| Trade-execution gateway (Kai — Pre-deal-check engineer, engineering — current credit-limit caller) | Any tier-1 line in red | Reject order; emit `GatewayCheckCompleted { outcome: "reject", blockReason }`. |
| FX settlement | Any tier-1 line in red | Treasury / Eitan must explicitly authorise the settlement (CFP Tier-3 activation may already require this). |

The block is a hard reject during tier-1 red: an `accepted` disposition is the only path back to a passing gate; an `accepted` disposition requires CEO sign-off per §5.3 above. This mirrors the credit-limit gateway pattern (PROC-RISK-CLM-01 Step 5, Kai's pre-trade check).

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Eitan (Treasurer, governance) | Procedure owner; first-line ownership of liquidity risk; emits `LiquidityLimitBreachDisposed`; root-cause + restoration-plan author; ALCO chair |
| Ravi (Treasury and ALM engineer, engineering — reports to Eitan) | Engineering substrate ownership (`@platform/risk/liquidity-limit-engine`); daily limit-sweep handler that emits `LiquidityLimitBreached` |
| Anya (Liquidity & projections engineer, engineering) | Upstream LCR / NSFR computation engine (`@platform/liquidity`); `LCRComputed` + `NSFRComputed` emission |
| Helena (Chief Risk Officer, governance) | RAS calibration (`RasLineCalibrated`); second-line oversight; ILAAP risk-narrative review; tier-2 / tier-1 challenge |
| Camille (Chief Financial Officer, governance) | ICAAP/ILAAP process chair; ILAAP liquidity-side governance; ALCO member |
| ALCO (chair: Eitan; members: Camille, Helena, Saskia (Head of Global Markets, governance), Devon (COO, governance), Bea (Accounting engineer), Ravi) | Tier-2 / tier-1 breach handling forum; restoration-plan sign-off; concentration limit setting |
| BRC (interim: CEO under `D-THIN-HUMAN-LAYER-MINIMUM`) | RAS recalibration approval; tier-1 standing exception review; CFP activation oversight |
| CEO (interim Board) | `accepted` disposition approval; CFP Tier-3 activation sign-off; PA-notification approval |
| Tomas (Operations & payments engineer, engineering) | Payment gateway block consumer; `checkLiquidityGate` caller on every payment-out |
| Kai (Pre-deal-check engineer, engineering) | Trade-execution gateway block consumer; `checkLiquidityGate` caller alongside credit-limit and capital checks |
| Vera (Internal audit engineer, engineering — reports to Thandiwe (Chief Audit Executive, governance)) | Third-line recons: `recon:liquidity-limit-breach-unescalated`; `recon:liquidity-limit-coverage` |
| Mira (Compliance / RegTech engineer, engineering) | BA 110 / BA 120 return commentary attaches breach narratives; PA notification timing under Reg 26 |
| PA (Prudential Authority) | Receives notifications on tier-1 LCR / NSFR PA-minimum breaches per Reg 26 |

## 7. Escalation

| Scenario | Severity | Escalation path |
|---|---|---|
| LCR / NSFR ratio falls to ≤ 130% / ≤ 125% (tier-3 early warning) | Medium | Eitan documents and includes in next ALCO agenda; Helena notified |
| LCR / NSFR ratio falls between PA minimum and internal floor (tier-2) | High | ALCO within 24h; Helena + Camille notified; restoration plan within 3 business days |
| LCR / NSFR ratio breaches PA minimum (tier-1) | Critical | Immediate notification (≤ 4h) to Eitan, Helena, Camille, Devon, CEO; ALCO convened within 4h; BRC notified same day; PA notification under Reg 26; CFP Tier-3 activated; **gateway block engaged** |
| Intraday buffer exhausted (tier-1) | Critical | Eitan + Devon + Tomas + Helena + CEO; intraday-stress CFP measures; ALCO convened immediately; gateway block engaged |
| Funding concentration breach (single counterparty ≥ 25%) | Critical | ALCO immediate; restoration plan within 1 business day; gateway block engaged for tier-1 |
| Funding concentration breach (single counterparty / depositor 15-25%) | High | ALCO within 24h; restoration plan within 3 business days; tenor reshape considered |
| HQLA concentration breach (L2 combined ≥ 40% or L2B ≥ 15%) | High → Critical at L2 ≥ 40% | ALCO immediate (L2 combined); within 24h (L2B); HQLA composition review; portfolio reshape |
| Exception expiry without renewal | Medium | Engine auto-lapse; ALCO notified; CEO `accepted` disposition revoked; gateway re-evaluates at next sweep |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/risk/liquidity-limit-engine` | ✓ live (this brief) | Tier-by-line breach detection; gateway block helper; open-breach projection |
| `@platform/liquidity` | ✓ live | LCR + NSFR computation engines (Anya — D-TREASURY-GAPS-WAVE1) |
| `@platform/alm` | PARTIAL — ALCOPackGenerated live; ALM-positions projection in Ravi's parallel brief | Concentration metrics feed; build-phase: no-positions default |
| `@platform/escalation` | ✓ existing | Critical / High routing per Step 4 |
| `@platform/event-store` | ✓ live | `LiquidityLimitBreached` + `LiquidityLimitBreachDisposed` typed registry rows |
| `@platform/recon` | ✓ live (recons in this brief) | `recon:liquidity-limit-breach-unescalated`, `recon:liquidity-limit-coverage` |
| `@platform/payments` (Tomas) | PLANNED | Gateway-block consumer at the payment-out pre-flight |
| `@platform/rms` | ✓ live | Cause-analysis + post-mortem documents; cited in disposal events |

## 9. Quality controls

The recon items below assert this procedure's invariants against the live event-store. Each is wired into CI under the standard recon scaffold.

- **`recon:liquidity-limit-breach-unescalated`** — every `LiquidityLimitBreached` with severity `critical` or `high` has either: (a) a paired `LiquidityLimitBreachDisposed` within the SLA (24h critical; 72h high — calendar-day approximation of business-day per the credit-limit-engine convention); OR (b) an `AgentEscalation` referencing the `breachId` within the same window; OR (c) for tier-1 LCR / NSFR PA-minimum breaches, a `PaNotificationSubmitted` referencing the breach. Unescalated critical / high breach = Critical Vera finding (LRM Policy §9.3 step 1).
- **`recon:liquidity-limit-coverage`** — every line in the RAS B3-family liquidity-appetite set has at least one configured tier in `DEFAULT_LIMIT_CONFIGS`; every line that has upstream measurement data has at least one breach-detection pass. Missing coverage = Critical Vera finding (Principle 2 — no orphan policy line).

## 10. Substrate gaps

- **`RasLineCalibrated` fold.** The engine ships v0 with the static `DEFAULT_LIMIT_CONFIGS` table. v1 will fold `RasLineCalibrated` events per line to produce a live calibration projection (Step 9 above). Gap captured as a follow-on substrate item.
- **ALM-positions projection.** Concentration metrics depend on the ALM-positions projection (Ravi's parallel brief `brief:ravi:alm-position-substrate-and-helena-liquidity-line:2026-05-21`). v0 falls back to ALCO-pack `ALCOPackGenerated` numeric payload fields; v1 reads the ALM projection directly.
- **`contingent-liquidity` line.** The line is reserved in the engine but the calibration follows Eitan's CFP-trigger framework (LRM Policy §5); v1 closes this slice.
- **Gateway wiring.** The engine exposes `checkLiquidityGate`; the production wiring into Tomas's payment-out gateway and Kai's pre-deal check is a follow-on PR. This procedure documents the contract; the call-site integration is the next slice.
- **PA-notification automation.** Tier-1 LCR / NSFR breaches require PA notification under Reg 26 `[citation: TBC — precise Reg 26 notification deadline; Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate]`. v0 escalates to Eitan / Helena who manually file; v1 closes the loop via an automatic `PaNotificationSubmitted` factory call.

## 11. Citations

- `D-RAS` (CEO-approved 2026-05-06); Owner Inbox §B3.
- Liquidity Risk Management Policy v1, `archive/owner-inbox/2026-05-11_camille-eitan-helena_liquidity-risk-management-policy-v1.md`, §§ 2 + 3 + 4 + 9.1 + 9.2 + 9.3.
- Procedures/by-policy/credit-risk-limit-management.md (PROC-RISK-CLM-01) — pattern reference.
- `Principles/1-events-are-truth.md`.
- `Principles/2-single-graph-discipline.md`.
- `Principles/6-autonomous-by-default.md`.
- `brief:ravi:liquidity-limit-engine-mirroring-credit-limit-en:2026-05-21`.

## 12. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-05-21 | Ravi (Treasury and ALM engineer, engineering) | Initial authoring under `brief:ravi:liquidity-limit-engine-mirroring-credit-limit-en:2026-05-21`. Pairs with the engine landing in `prototype/platform/risk/liquidity-limit-engine/`. |
