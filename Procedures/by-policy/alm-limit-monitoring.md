---
policy-parent: asset-liability-management-policy-v1
last-reviewed: 2026-06-11
procedureId: PROC-ALM-LIM-01
title: ALM limit monitoring — integrated limit register and breach handling
author: Ravi (Treasury/ALM engineer, engineering)
date: 2026-06-11
owner: Ravi (Treasury/ALM engineer, engineering — monitoring substrate) · Helena (Chief Risk Officer, governance — second-line calibration challenge) · Eitan (Treasurer, governance — first-line owner, ALCO chair)
status: POPULATED
policy-cited: asset-liability-management-policy-v1
system-capability: "@platform/alm (LIVE — repricing-gap, eve, nii via ravi:alm-run) · @platform/risk/liquidity-limit-engine (LIVE) · @platform/risk/ras-appetite-register (LIVE)"
---

# Procedure — ALM limit monitoring

**Procedure ID:** PROC-ALM-LIM-01
**Owner:** Ravi (Treasury/ALM engineer, engineering — reports to Eitan) — monitoring substrate; Helena (Chief Risk Officer, governance) — second-line challenge and RAS coherence; Eitan (Treasurer, governance) — first-line limit ownership and ALCO chair.
**Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) for limits (ALM Policy §6); ALCO for monitoring framework and within-parameter recalibration.
**Cadence:** Daily (gap, EVE, NII, liquidity metrics via `ravi:alm-run`); monthly (full ALCO limit-utilisation review, ALM Policy §2.2 item 9); annual (limit recalibration, ALM Policy §6).
**Version:** v0.1 — 2026-06-11
**Status:** POPULATED
**Standing authority:** `D-TREASURER-WAVE1-SUBSTRATE` (CEO-approved 2026-06-11); parent `D-TREASURER-ROLE-DEFINITION-REVIEW`; `D-TREASURY-GAPS-WAVE1` (ALM engine).

## 1. Source policy

- [`Policies/asset-liability-management-policy-v1.md`](../../Policies/asset-liability-management-policy-v1.md) — Asset and Liability Management Policy v1 (IN FORCE 2026-05-22, owner: Eitan (Treasurer, governance)) — specifically:
  - **§6 (ALM limit framework)** — "The limit register is maintained in `Procedures/by-policy/alm-limit-monitoring.md` with the specific calibrated values." This procedure §5.1 is that register.
  - **§2.3 (Escalation)** — ALCO-to-Board escalation triggers; unresolved limit breaches escalate.
  - **§3.1 (Funding mix targets)** — funding-mix breach triggers ALCO review within 5 business days.
  - **§5.1 (Contractual gap)** — daily contractual cashflow gap is the primary gap-limit input.
- [`Policies/irrbb-policy-v1.md`](../../Policies/irrbb-policy-v1.md) — IRRBB Policy v1 (IN FORCE) — EVE/NII limit definitions the ALM framework aggregates (ALM Policy §6 rows 4–5 defer to it).
- [`Policies/liquidity-risk-management-policy-v1.md`](../../Policies/liquidity-risk-management-policy-v1.md) — LRM Policy v1 (IN FORCE) — LCR/NSFR/intraday floors and the §9 breach taxonomy; the liquidity dimension of the integrated framework is operationalised by PROC-RISK-LLM-01 (`liquidity-limit-management.md`) and consumed here, not duplicated.

The obligation chain (Principle 2):

```
Regulation (Banks Act 94 of 1990 ss.60–64; Regulations Relating to Banks reg.26;
            BCBS IRRBB (April 2016); Basel III LCR (2013) + NSFR (2014))
  → Policy: asset-liability-management-policy-v1 (§6 limit framework; §2.3 escalation)
    → PROC-ALM-LIM-01 (this procedure — calibrated limit register,
                       integrated monitoring, breach escalation)
      → @platform/alm (repricing gap, ΔEVE, ΔNII — ravi:alm-run daily)
      → @platform/risk/liquidity-limit-engine (liquidity-dimension breach lifecycle)
      → @platform/risk/ras-appetite-register (appetite:irrbb:delta-eve-outlier;
        appetite:liquidity:lcr; appetite:liquidity:nsfr)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Banks Act 94 of 1990 ss.60–64 | Liquidity and balance-sheet governance; board-approved limit frameworks. |
| Regulations Relating to Banks reg.26 | Liquidity risk management — limit structures, monitoring, and escalation for LCR/NSFR/intraday. |
| BCBS IRRBB (April 2016) / `ORG-PR-11` | EVE and NII sensitivity limits; 15%-of-Tier-1 outlier test; board approval of IRRBB limits. |
| Basel III LCR framework (January 2013) / `ORG-PR-06` | LCR ≥ 100% floor; internal buffer governance. |
| Basel III NSFR framework (October 2014) / `ORG-PR-07` | NSFR ≥ 100%; no required-stable-funding shortfall. |
| BCBS Principles for sound liquidity risk management (2008) | Limits consistent with the bank's liquidity risk tolerance; integrated with stress testing. |

## 3. Purpose

ALM Policy §6 defines the limit *types* and governance levels but defers the **calibrated values** to this procedure. This procedure:

1. Carries the **calibrated ALM limit register** (§5.1) — the integrated table spanning the cashflow-gap, liquidity, IRRBB, and funding-concentration dimensions.
2. Defines the **monitoring binding** for each limit — which live engine measures it, which event carries the observation, and at what cadence.
3. Defines the **breach flow** — detection, escalation per ALM Policy §2.3, and disposal — without duplicating the liquidity-dimension lifecycle already governed by PROC-RISK-LLM-01.
4. Honours the integrated-framework principle (ALM Policy §1): breach of either dimension triggers ALCO review of balance-sheet strategy, not just the single metric.

Build-phase posture: the bank holds no positions until commencement of trading, so all utilisations are zero and the register below is the initial calibration the Board (CEO interim) approved with the ALM policy. First post-commencement ALCO re-ratifies.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| `ALMRunCompleted` (daily, from `ravi:alm-run`) | Steps 1–3 — gap/EVE/NII utilisation check |
| `IRRBBChecked { metric, shock, breach }` (10 per daily run) | Step 3 — IRRBB limit comparison |
| `LiquidityLimitBreached` (from `@platform/risk/liquidity-limit-engine`) | Step 4 — integrated-review trigger (lifecycle owned by PROC-RISK-LLM-01) |
| Monthly ALCO cycle (ALM Policy §2.2 item 9) | Step 5 — 3-month rolling utilisation review |
| Funding-mix target breach (ALM Policy §3.1) | Step 6 — ALCO review within 5 business days |
| Annual limit review (ALM Policy §6) | Step 7 — recalibration |

## 5. Steps

### 5.1 Calibrated ALM limit register (ALM Policy §6)

| # | Limit | Calibrated value (build-phase) | Governance level | Measurement binding | Escalation trigger |
|---|---|---|---|---|---|
| L1 | Maximum cumulative contractual cashflow gap per maturity bucket | ≤ 25% of total assets cumulative outflow in any bucket ≤ 1Y; ≤ 40% cumulative ≤ 5Y | ALCO | Repricing-gap output of `ravi:alm-run` (`@platform/alm/repricing-gap`, BCBS 319 buckets), summarised in `ALMRunCompleted` | > 80% utilisation in any bucket |
| L2 | Minimum liquidity buffer above LCR floor | LCR internal floor 120% (LRM Policy §2.5); headroom ≥ 10% above the 100% regulatory minimum at all times | ALCO | `@platform/liquidity` (`lcr.ts`) via daily liquidity projection folded into `ALMRunCompleted`; breach lifecycle per PROC-RISK-LLM-01 tier matrix | < 10% headroom above regulatory minimum |
| L3 | Maximum NSFR required-stable-funding shortfall | Zero shortfall — NSFR ≥ 100% (internal floor 115%, LRM Policy §3.1) | ALCO | `@platform/liquidity` (`nsfr.ts`); breach lifecycle per PROC-RISK-LLM-01 | Any shortfall vs NSFR ≥ 100% |
| L4 | Maximum EVE sensitivity (worst of six BCBS d365 shocks) | ≤ 15% of Tier 1 capital (build-phase placeholder pending Tier-1 measurement; outlier threshold per BCBS d365) | Board (per IRRBB policy) | `IRRBBChecked { metric: "EVE" }` — six shock scenarios per daily `ravi:alm-run`; RAS line `appetite:irrbb:delta-eve-outlier` | Breach of IRRBB EVE limit |
| L5 | Maximum NII sensitivity (parallel shocks, 12-month horizon) | ≤ 5% of projected 12-month NII (build-phase placeholder; Eitan calibrates when positions land) | Board (per IRRBB policy) | `IRRBBChecked { metric: "NII" }` — four parallel shocks per daily run | Breach of IRRBB NII limit |
| L6 | Maximum CSRBB exposure | Monitoring-only — no quantitative limit until CSRBB field-testing concludes (deferred per the 2026-06-08 bond-trading review) | ALCO | PLANNED — CSRBB measure not yet computed (see §10) | > 80% utilisation once calibrated |
| L7 | Maximum funding concentration — single counterparty | ≤ 15% of total liabilities | ALCO | `@platform/risk/liquidity-limit-engine` line `funding-concentration-counterparty` (tier-2 at 15%, tier-1 at 25% per PROC-RISK-LLM-01 §5.1) | > 15% of total liabilities |
| L8 | Funding mix targets (term-deposit shares, secured-funding cap, equity floor) | Per ALM Policy §3.1 table (≥ 40% wholesale > 1Y; ≤ 40% wholesale 1M–1Y; ≤ 20% repo/secured; ≥ 15% equity + sub-debt) | ALCO | Monthly behavioural-gap/ALCO-pack computation (build phase: zero funding base) | Breach → ALCO review within 5 business days (ALM Policy §3.1) |

### 5.2 Monitoring and breach flow

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Daily observation read.** Consume the day's `ALMRunCompleted` (gap + liquidity status) and the ten `IRRBBChecked` events (6 EVE + 4 NII). | `system` | `@platform/alm` via `ravi:alm-run` (daily 05:50 UTC) | Build phase: zero-position posture; the run is structurally complete and ready for non-zero outputs (PROC-ALM-DAR-01 governs the run itself). |
| 2 | **Utilisation computation.** For each register row L1–L7 with live measurement, compute utilisation = observation / calibrated limit. Lines without upstream data record `no-positions` (no breach event from an unmeasurable line — same convention as PROC-RISK-LLM-01 Step 1). | `system` | `@platform/alm` + `@platform/risk/liquidity-limit-engine` | |
| 3 | **IRRBB limit comparison.** `IRRBBChecked` events carry `breach` flags against L4/L5. A breach routes to Eitan + Helena immediately and to ALCO per the IRRBB policy escalation ladder. | `system` → `agent` (Eitan, Helena) | `@platform/event-store` + `@platform/escalation` | EVE outlier breach (L4) additionally lights the PA-outlier pathway per `Policies/irrbb-policy-v1.md`. |
| 4 | **Liquidity-dimension breach (L2/L3/L7).** Detection, tiering, escalation, and disposal run under PROC-RISK-LLM-01 (`LiquidityLimitBreached` / `LiquidityLimitBreachDisposed`). This procedure adds the *integrated* obligation: any liquidity tier-1/tier-2 breach is also tabled as an ALM balance-sheet-strategy item at the next (or extraordinary) ALCO — not handled as a ratio fix in isolation (ALM Policy §1 integrated-framework principle). | `system` + `agent` (Eitan) | `@platform/risk/liquidity-limit-engine` | No duplicate breach events are emitted here. |
| 5 | **Monthly ALCO utilisation review.** Eitan presents 3-month rolling utilisation for all register rows (ALM Policy §2.2 item 9); ALCO minutes record the review. | `agent` (Eitan) | `@platform/alco` (`atlas:alco-pack`) | ALCO pack consumes live projection events. |
| 6 | **Funding-mix monitoring (L8).** Monthly computation against ALM Policy §3.1 targets; a breach triggers ALCO review within 5 business days. | `system` + `agent` (Eitan) | monthly ALCO pack computation | Build phase: zero funding base; activates at commencement of trading. |
| 7 | **Annual recalibration.** Eitan proposes, Helena challenges (second line), Board (CEO interim) approves changed limits; ALCO ratifies within-parameter recalibrations. Register rows in §5.1 are updated in the same change. | `agent` (Eitan) + `agent` (Helena) → `human` (CEO) | `@platform/decisions` (`Decision` event) | P2 citation: ALM Policy §6 — Board approval for limits; §2.3 — material framework changes escalate to Board. |
| 8 | **Unresolved-breach escalation.** Any register-row breach not resolved within its policy timeframe escalates ALCO → Board per ALM Policy §2.3. | `agent` (Eitan) → `human` (CEO) | `@platform/escalation` | P2 citation: ALM Policy §2.3 (board escalation is policy-mandated human oversight). |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Eitan (Treasurer, governance) | First-line limit owner; ALCO chair; presents utilisation monthly; proposes recalibrations; escalates per §5.2 step 8 |
| Ravi (Treasury/ALM engineer, engineering — reports to Eitan) | Monitoring substrate (`ravi:alm-run`, gap/EVE/NII engines); register maintenance in this file; utilisation computation |
| Helena (Chief Risk Officer, governance) | Second-line challenge; RAS coherence (`appetite:irrbb:delta-eve-outlier`, liquidity lines); attends ALCO |
| Anya (Platform & data engineer, engineering) | Upstream LCR/NSFR computation (`@platform/liquidity`, `anya:liquidity-projection`) |
| Camille (Chief Financial Officer, governance) | Capital and funding-cost integration at ALCO |
| ALCO (chair: Eitan; members per ALM Policy §2.1) | Limit-utilisation review; within-parameter recalibration; breach-response forum |
| Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) | Limit approval (L4/L5 and framework changes); unresolved-breach escalation point |
| Vera (Internal audit engineer, engineering — reports to Thandiwe (Chief Audit Executive, governance)) | Third-line assurance over register completeness and breach disposition |

## 7. Escalation

| Scenario | Severity | Escalation path |
|---|---|---|
| Any register row > 80% utilisation (L1, L6 trigger convention) | Medium | Eitan documents; next ALCO agenda |
| L2/L3/L7 liquidity-dimension breach | Per PROC-RISK-LLM-01 tier | PROC-RISK-LLM-01 escalation matrix + integrated ALCO balance-sheet review (§5.2 step 4) |
| L4 EVE limit breach / BCBS d365 outlier | Critical | Eitan + Helena immediate; ALCO extraordinary session; PA-outlier pathway per `Policies/irrbb-policy-v1.md`; Board notified |
| L5 NII limit breach | High | Eitan + Helena within 1 business day; ALCO within 24h |
| L8 funding-mix target breach | Medium | ALCO review within 5 business days (ALM Policy §3.1) |
| Breach unresolved within policy timeframe | Critical | ALCO → Board (CEO interim) per ALM Policy §2.3 |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/alm` | ✓ live | `repricing-gap.ts` (BCBS 319 buckets), `eve.ts` (6 BCBS d365 shocks), `nii.ts` (4 parallel shocks) — exercised daily by `ravi:alm-run` |
| `ravi:alm-run` handler | ✓ live | `prototype/runtime/agents/ravi-alm-run.ts`, scheduled daily 05:50 UTC; emits `ALMRunCompleted` + 10 `IRRBBChecked` (PROC-ALM-DAR-01 governs) |
| `@platform/risk/liquidity-limit-engine` | ✓ live | Tier-by-line liquidity breach detection + gateway block (PROC-RISK-LLM-01 governs) |
| `@platform/risk/ras-appetite-register` | ✓ live | `appetite:irrbb:delta-eve-outlier`, `appetite:liquidity:lcr`, `appetite:liquidity:nsfr` structured lines |
| `@platform/liquidity` | ✓ live | LCR/NSFR computation (Anya) |
| `@platform/alco` | ✓ live | ALCO pack generation (`atlas:alco-pack`) |
| Policy-named events `AlmLimitSet` / `AlmLimitBreached` | PLANNED | See §10 — not in the event-type registry; current breach surface is `IRRBBChecked{breach}` + `LiquidityLimitBreached` |
| CSRBB measure (L6) | PLANNED | Deferred to field-testing (2026-06-08 bond-trading review) |

## 9. Quality controls

| Control | Frequency | Owner |
|---|---|---|
| Register completeness — every ALM Policy §6 limit type has a §5.1 row with calibrated value + measurement binding | At every register change | Ravi (Treasury/ALM engineer, engineering) |
| Daily-run presence — every business day has `ALMRunCompleted` + 10 `IRRBBChecked` | Daily | Vera (Internal audit engineer, engineering) via PROC-ALM-DAR-01 §9 |
| Breach-disposition completeness — every L4/L5 breach traces to remediation or documented ALCO acceptance | Monthly | Helena (Chief Risk Officer, governance) |
| Liquidity-line coverage — `recon:liquidity-limit-coverage` (PROC-RISK-LLM-01 §9) covers L2/L3/L7 | Daily (CI) | Vera |
| Annual limit-recalibration discipline — Board approval on record for any L4/L5 change | Annual | Eitan (Treasurer, governance) |

## 10. Substrate gaps

- **`AlmLimitSet` / `AlmLimitBreached` events.** ALM Policy §1/§6 name these typed events; neither is in the event-type registry. The implemented breach surface is `IRRBBChecked { breach }` (IRRBB dimension) and `LiquidityLimitBreached` (liquidity dimension); the gap-limit dimension (L1) is summarised inside `ALMRunCompleted` without a dedicated breach event. Registering the consolidated ALM-limit events (or amending the policy to the implemented names at next review) is a named Wave-2 item.
- **Contractual-gap limit automation (L1).** The repricing-gap engine computes bucket exposures daily, but the ≤ 25%/≤ 40% cumulative-gap comparison is not yet a coded check with its own breach emission; build-phase utilisation is zero. Wave-2 item alongside the event registration above.
- **CSRBB measure (L6).** No computed CSRBB metric; monitoring-only row until field-testing concludes.
- **Funding-mix computation (L8).** Activates at commencement of trading; no funding base exists in build phase.

## 11. Citations

- `Policies/asset-liability-management-policy-v1.md` §§ 1, 2.2, 2.3, 3.1, 5.1, 6.
- `Policies/irrbb-policy-v1.md` (EVE/NII limit definitions); `Policies/liquidity-risk-management-policy-v1.md` §§ 2, 3, 9.
- `Procedures/by-policy/liquidity-limit-management.md` (PROC-RISK-LLM-01) — liquidity-dimension lifecycle owner.
- `Procedures/by-policy/daily-alm-run.md` (PROC-ALM-DAR-01) — measurement-run governance.
- `docs/2026-06-10_eitan_treasurer-role-definition-and-substrate-plan.md` Part C.2 (PROC-ALM-LIM-01 pipeline row).
- `D-TREASURER-WAVE1-SUBSTRATE` (CEO-approved 2026-06-11); `D-TREASURER-ROLE-DEFINITION-REVIEW`; `D-TREASURY-GAPS-WAVE1`.
- `Principles/1-events-are-truth.md`; `Principles/2-single-graph-discipline.md`; `Principles/6-autonomous-by-default.md`.
- `brief:ravi:treasury-procedure-tail-3-missing-procedures-6-a:2026-06-11`.

## 12. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-11 | Ravi (Treasury/ALM engineer, engineering) | Initial authoring under `brief:ravi:treasury-procedure-tail-3-missing-procedures-6-a:2026-06-11` (WS-TREASURER-WAVE1-SUBSTRATE, W1.4). Closes the dangling ALM Policy §6 citation; carries the calibrated integrated limit register the policy defers to this file. |
