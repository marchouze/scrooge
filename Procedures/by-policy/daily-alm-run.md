---
policy-parent: asset-liability-management-policy-v1
last-reviewed: 2026-06-11
procedureId: PROC-ALM-DAR-01
title: Daily ALM run — repricing gap, ΔEVE, ΔNII measurement cycle
author: Ravi (Treasury/ALM engineer, engineering)
date: 2026-06-11
owner: Ravi (Treasury/ALM engineer, engineering — run owner) · Eitan (Treasurer, governance — output consumer and sign-off)
status: POPULATED
policy-cited: asset-liability-management-policy-v1
system-capability: "@platform/alm (LIVE — repricing-gap, eve, nii) · prototype/runtime/agents/ravi-alm-run.ts (LIVE — ravi:alm-run, daily) · @platform/liquidity (LIVE — projection status feed)"
---

# Procedure — Daily ALM run

**Procedure ID:** PROC-ALM-DAR-01
**Owner:** Ravi (Treasury/ALM engineer, engineering — reports to Eitan) — run owner; Eitan (Treasurer, governance) — consumer of the run's outputs for the ALM Policy §3.2/§5.1 daily-monitoring obligation.
**Approval:** ALCO (measurement methodology, per ALM Policy §5); Helena (Chief Risk Officer, governance) validates IRRBB methodology annually (per `Policies/irrbb-policy-v1.md`).
**Cadence:** Daily, scheduled (`ravi:alm-run`, cron `50 5 * * *` UTC), after the FTP curve publication (05:45) and before the intraday HQLA-stress projection (05:55).
**Version:** v0.1 — 2026-06-11
**Status:** POPULATED
**Standing authority:** `D-TREASURER-WAVE1-SUBSTRATE` (CEO-approved 2026-06-11); parent `D-TREASURER-ROLE-DEFINITION-REVIEW`; `D-TREASURY-GAPS-WAVE1` (engine build).

## 1. Source policy

- [`Policies/asset-liability-management-policy-v1.md`](../../Policies/asset-liability-management-policy-v1.md) — ALM Policy v1 (IN FORCE 2026-05-22, owner: Eitan (Treasurer, governance)) — specifically:
  - **§3.2 (Asset-liability maturity mismatch)** — "Ravi monitors the contractual cashflow gap daily"; this run is that daily monitoring.
  - **§5.1 (Contractual gap)** — daily contractual gap computation from event-log position data.
  - **§6 (ALM limit framework)** — daily monitoring by Ravi; the run's outputs feed PROC-ALM-LIM-01's utilisation checks.
- [`Policies/irrbb-policy-v1.md`](../../Policies/irrbb-policy-v1.md) — IRRBB Policy v1 (IN FORCE) — the ΔEVE (six BCBS d365 shocks) and ΔNII measurement obligations the run discharges daily; PROC-RISK-IRRBB-01 (`irrbb-measurement.md`) governs the monthly governance cycle that consumes these outputs.

The obligation chain (Principle 2):

```
Regulation (Banks Act 94 of 1990 ss.60–64; Regulations Relating to Banks reg.26 + reg.27;
            BCBS d365 — IRRBB (April 2016); Basel III LCR (2013) + NSFR (2014))
  → Policy: asset-liability-management-policy-v1 (§3.2 + §5.1 daily monitoring; §6 limits)
    → PROC-ALM-DAR-01 (this procedure — the daily measurement run)
      → @platform/alm (repricing-gap.ts BCBS 319 buckets; eve.ts; nii.ts)
      → ALMRunCompleted + IRRBBChecked typed events (event-types/alm.ts)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-11` / BCBS d365 (IRRBB, April 2016) | Measure EVE under the six prescribed shock scenarios and NII under parallel shocks; outlier test at 15% of Tier 1 capital. |
| Regulations Relating to Banks reg.26 | Daily liquidity-risk monitoring; LCR/NSFR status awareness feeds the run's overall status. |
| Regulations Relating to Banks reg.27 | Interest-rate risk measurement and reporting in the banking book. |
| Banks Act 94 of 1990 ss.60–64 | Liquidity and balance-sheet governance underpinning daily measurement discipline. |
| BCBS 319 (repricing-gap bucket convention) | Time-bucket structure for the repricing-gap schedule. |

## 3. Purpose

The handler `ravi:alm-run` has run daily since `D-TREASURY-GAPS-WAVE1` (2026-05-19) without a governing procedure — named as a gap in `Team/Ravi.md` §13 since v1.0 and dispatched as Wave-1 item W1.4 of the Treasurer role-definition review. This procedure is that governing artefact. It defines:

1. **What the run computes** — repricing gap (BCBS 319 buckets), ΔEVE (six BCBS d365 shocks), ΔNII (four parallel shocks, 12-month horizon), plus the LCR/NSFR status read that sets the run's overall RAG status.
2. **What the run emits** — one `ALMRunCompleted` summary event and ten `IRRBBChecked` events (6 EVE + 4 NII) per run, each citation-carrying (Principle 1).
3. **The failure and escalation contract** — what happens when a run is missed, errors, or produces a breach flag.
4. **The build-phase posture** — with no positions until commencement of trading, all sensitivities are zero by construction; the zero posture is explicit and auditable, and the run is structurally complete so non-zero outputs flow the day trades land.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| Daily scheduler — `ravi:alm-run`, cron `50 5 * * *` UTC | Steps 1–7 (full run) |
| Manual re-run on same-day failure (Ravi) | Steps 1–7; idempotent per run-id convention `ALM-RUN-<date>` |
| Breach flag in any `IRRBBChecked` | Escalation per §7 + PROC-ALM-LIM-01 §5.2 step 3 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Liquidity status read.** Run the liquidity projection; extract the 30-day-horizon LCR and NSFR ratios. Overall run status: red if either < 100%, amber if either < 110%, else green. | `system` | `@platform/liquidity` (`projection.ts`, `runLiquidityProjection`) | Status thresholds mirror the LRM Policy floors consumed by PROC-RISK-LLM-01. |
| 2 | **Repricing gap.** Compute the banking-book repricing-gap schedule across the BCBS 319 time buckets from event-log position data. | `system` | `@platform/alm` (`repricing-gap.ts`, `computeRepricingGap`) | Discharges ALM Policy §5.1 daily contractual-gap monitoring. The policy-named `ContractualCashflowGapComputed` event is not yet registered — gap output rides `ALMRunCompleted` (§10). |
| 3 | **ΔEVE.** Compute EVE sensitivity under the six BCBS d365 shock scenarios (parallel up/down, steepener, flattener, short up/down); record worst case against the 15%-of-Tier-1 outlier threshold. | `system` | `@platform/alm` (`eve.ts`, `computeEVE`) | Build phase: Tier 1 not yet measured; 15% placeholder limit per `EVE_OUTLIER_LIMIT_PCT`. |
| 4 | **ΔNII.** Compute NII sensitivity under four parallel shocks over a 12-month horizon against the 5% appetite placeholder (`NII_APPETITE_LIMIT_PCT`; Eitan calibrates when positions land). | `system` | `@platform/alm` (`nii.ts`, `computeNII`) | |
| 5 | **Event emission.** Emit one `ALMRunCompleted { runId: "ALM-RUN-<date>", … }` summarising the run, then one `IRRBBChecked` per metric/shock combination (6 EVE + 4 NII = 10), each carrying `breach` flags and the standing citations (`BANKS-ACT-94-1990`, `BANKS-REG-26`, `BANKS-REG-27`, `BCBS-D365-IRRBB`). | `system` | `@platform/event-store` (`event-types/alm.ts` — `makeALMRunCompleted`, `makeIRRBBChecked`) | Events are the canonical record (Principle 1); the markdown deliverable in step 6 is a render. |
| 6 | **Deliverable render.** Write the daily ALM-run deliverable (RAG summary, sensitivity table, gap schedule) for the Treasurer's consumption and the ALCO pack feed. | `system` | `prototype/runtime/agents/ravi-alm-run.ts` | |
| 7 | **Breach routing.** Any `IRRBBChecked { breach: true }` raises an `AgentEscalation` to Eitan + Helena (Chief Risk Officer, governance); utilisation handling continues under PROC-ALM-LIM-01 §5.2. | `system` → `agent` (Eitan, Helena) | `@platform/escalation` | EVE outlier breach lights the PA-outlier pathway per `Policies/irrbb-policy-v1.md`. |
| 8 | **Run-failure handling.** A failed or missed run surfaces as `SubstrateAgentRunFailed` / absent `ALMRunCompleted`; Ravi re-runs same-day. Two consecutive missed business days escalate to Eitan with a substrate-incident note. | `agent` (Ravi) | scheduler + event-store presence check | The decision-required-first rule (CLAUDE.md) applies: a failed run is surfaced proactively, not buried. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Ravi (Treasury/ALM engineer, engineering — reports to Eitan) | Run owner; engine maintenance; same-day re-run on failure; methodology implementation |
| Eitan (Treasurer, governance) | Consumes daily outputs (ALM Policy §3.2/§5.1 obligation holder); signs monthly IRRBB content to Camille (Chief Financial Officer, governance) via PROC-RISK-IRRBB-01 |
| Helena (Chief Risk Officer, governance) | Second-line: annual methodology validation; breach-flag recipient |
| Rohan (Risk engineer, engineering) | Independent measurement plane — runner/measurer split per `Team/Ravi.md` §15: Ravi runs the book, Rohan measures it; neither mutates the other's event streams |
| Anya (Platform & data engineer, engineering) | Upstream liquidity projection (`anya:liquidity-projection`) the status read consumes |
| Vera (Internal audit engineer, engineering — reports to Thandiwe (Chief Audit Executive, governance)) | Run-presence and breach-disposition assurance (§9) |

## 7. Escalation

| Condition | Action | Timeframe |
|---|---|---|
| `IRRBBChecked { breach: true }` (any metric/shock) | `AgentEscalation` to Eitan + Helena; PROC-ALM-LIM-01 breach flow | Immediate (same run) |
| EVE worst-case > outlier threshold | Eitan + Helena; extraordinary ALCO consideration; PA-outlier pathway per `Policies/irrbb-policy-v1.md` | Same business day |
| Run failed / missing for the day | Ravi re-runs; if unresolved by EOD, Eitan notified | Same business day |
| Two consecutive missed business days | Substrate incident to Eitan + Atlas (Core banking platform architect, engineering) | Next business day |
| Liquidity status red in step 1 | Already escalating via PROC-RISK-LLM-01 tier matrix; the ALM run cross-references, does not duplicate | Per PROC-RISK-LLM-01 |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/alm` | ✓ live | `repricing-gap.ts`, `eve.ts`, `nii.ts` (D-TREASURY-GAPS-WAVE1) |
| `ravi:alm-run` handler | ✓ live | `prototype/runtime/agents/ravi-alm-run.ts`; scheduled daily 05:50 UTC (`runtime/agents/metadata/ravi.ts`) |
| `ALMRunCompleted` / `IRRBBChecked` events | ✓ live | `prototype/platform/event-store/event-types/alm.ts` |
| `@platform/liquidity` | ✓ live | `projection.ts` status feed (Anya) |
| `@platform/escalation` | ✓ live | Breach routing |
| `ContractualCashflowGapComputed` event (ALM Policy §5.1) | PLANNED | See §10 |
| Behavioural-gap monthly computation (ALM Policy §5.2) | PLANNED | Monthly ALCO-pack scope; activates with deposit data at commencement |

## 9. Quality controls

| Control | Frequency | Owner |
|---|---|---|
| Run presence — every business day has exactly one `ALMRunCompleted` | Daily | Vera (Internal audit engineer, engineering) |
| Event-count integrity — each run emits exactly 10 `IRRBBChecked` (6 EVE + 4 NII) | Daily | Vera |
| Breach-flag disposition — every `breach: true` traces to an `AgentEscalation` | Daily | Vera |
| Methodology validation — shock vectors and bucket conventions vs BCBS d365 / BCBS 319 | Annual | Helena (Chief Risk Officer, governance) |
| Zero-posture honesty — build-phase zero outputs explicitly labelled in the deliverable, never presented as measured exposure | Each run | Ravi (Treasury/ALM engineer, engineering) |

## 10. Substrate gaps

- **`ContractualCashflowGapComputed` event.** ALM Policy §5.1 names this typed event as the canonical daily-gap record; it is not in the event-type registry. The gap schedule currently rides the `ALMRunCompleted` summary. Registering the dedicated event (or amending the policy at next review) is a named Wave-2 item, shared with PROC-ALM-LIM-01 §10.
- **Behavioural gap.** ALM Policy §5.2's monthly behavioural-adjusted gap awaits behavioural-assumption data (no deposits in build phase); the monthly ALCO-pack slot is reserved.
- **Run-presence recon.** The §9 run-presence and event-count checks are procedure-level assertions today; a coded `recon:alm-run-presence` pipeline is a candidate Vera Wave-4 item.
- **Tier-1-linked outlier limit.** The 15% EVE outlier test runs against a placeholder until Tier 1 capital is measured (build phase; capital substrate is Camille/Bea-owned).

## 11. Citations

- `Policies/asset-liability-management-policy-v1.md` §§ 3.2, 5.1, 6.
- `Policies/irrbb-policy-v1.md` (ΔEVE/ΔNII obligations); `Procedures/by-policy/irrbb-measurement.md` (PROC-RISK-IRRBB-01 — monthly governance cycle).
- `Procedures/by-policy/alm-limit-monitoring.md` (PROC-ALM-LIM-01 — limit register consuming this run's outputs).
- `docs/2026-06-10_eitan_treasurer-role-definition-and-substrate-plan.md` Parts C.2 + D.1 (PROC-ALM-DAR-01 pipeline row; live-substrate table).
- `D-TREASURER-WAVE1-SUBSTRATE` (CEO-approved 2026-06-11); `D-TREASURER-ROLE-DEFINITION-REVIEW`; `D-TREASURY-GAPS-WAVE1`.
- `Principles/1-events-are-truth.md`; `Principles/2-single-graph-discipline.md`; `Principles/6-autonomous-by-default.md`.
- `brief:ravi:treasury-procedure-tail-3-missing-procedures-6-a:2026-06-11`.

## 12. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-11 | Ravi (Treasury/ALM engineer, engineering) | Initial authoring under `brief:ravi:treasury-procedure-tail-3-missing-procedures-6-a:2026-06-11` (WS-TREASURER-WAVE1-SUBSTRATE, W1.4). Gives the daily `ravi:alm-run` handler its governing procedure (gap named in `Team/Ravi.md` §13 since v1.0). |
