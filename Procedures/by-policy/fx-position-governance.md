---
policy-parent: market-risk-policy-v1
last-reviewed: 2026-05-30
procedureId: PROC-ALM-FXP-01
title: FX position governance — net open position and Excon
author: Eitan (Treasurer) · Saskia (Head of Global Markets, governance — execution) · Helena (Chief Risk Officer, governance — appetite)
date: 2026-05-30
owner: Eitan (Treasurer) · Saskia (Head of Global Markets, governance — execution) · Helena (Chief Risk Officer, governance — appetite)
status: POPULATED
policy-cited: market-risk-policy-v1
system-capability: "@platform/market-risk (LIVE — FX revaluation / NOP)"
---

# Procedure — FX position governance (net open position and Exchange Control)

**Procedure ID:** PROC-ALM-FXP-01
**Owner:** Eitan (Treasurer) · Saskia (Head of Global Markets, governance — execution) · Helena (Chief Risk Officer, governance — NOP appetite)
**Approval:** ALCO (NOP limits within RAS); Eitan (Treasurer — daily position plan); Mira (Compliance / RegTech engineer — Excon reporting)
**Cadence:** Continuous (real-time revaluation); daily (NOP review + position plan); monthly (ALCO standing item)
**Version:** v0.1 — 2026-05-30
**Status:** POPULATED

## 1. Source policy

- `market-risk-policy-v1` — the Market Risk Policy heads the FX market-risk chain; FX net open position (NOP) sits under market-risk appetite.
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` §B (market risk) — the NOP appetite limit Eitan operates within.
- Exchange Control Regulations (Currency and Exchanges Act 9 of 1933) — the Excon authority within which any FX position is held.

The obligation chain:
```
Regulation (Banks Act Reg 28 — market risk / NOP; Currency & Exchanges Act — Excon)
  → Market Risk Policy (market-risk-policy-v1)
    → PROC-ALM-FXP-01 (this procedure)
      → @platform/market-risk (LIVE — FX revaluation / NOP)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-14` (Banks Act Reg 28 — market risk / net open position) | The bank must measure, limit, and hold capital against its aggregate net open foreign-currency position; the NOP must be monitored against Board-approved limits. |
| `ORG-PR-15` (Currency & Exchanges Act / Excon Rulings) | Any foreign-currency position must be held within the bank's Exchange Control authority; positions outside authority require SARB FinSurv approval. |
| `ORG-PR-16` (PA market-risk directive) | Daily NOP reporting; breach escalation; capital charge under the standardised market-risk approach. |

## 3. Purpose

Govern the bank's foreign-currency net open position end to end: revalue FX positions in real time, monitor the aggregate NOP against the RAS limit, instruct execution to bring the position within limit when it breaches, and keep every position within the bank's Exchange Control authority. The bank is an indirect participant — FX settlement runs through its correspondent (see PROC-PAY-SCO-01) — and this procedure governs the position, not the settlement rail.

## 4. Trigger

**Continuous (real-time):**
- On each FX trade or rate move — `FxPositionRevalued { pair, positionZar, ... }` is emitted; the aggregate NOP is recomputed.

**On breach:**
- `FXPositionBreach { metric, limit, actual }` — the NOP has crossed the RAS limit; triggers the bring-within-limit pathway.

**Daily / monthly (standing):**
- Daily NOP review and position plan (Eitan); monthly ALCO standing item.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Revalue every FX position on each trade and rate move; recompute the aggregate net open position in ZAR | `system` | `@platform/market-risk` (LIVE) | Emit `FxPositionRevalued { pair, positionZar }` per pair; the canonical NOP is the aggregate across pairs (long/short netted per the bank's quoting convention). |
| 2 | Compare the aggregate NOP against the RAS NOP limit | `system` | `@platform/market-risk` (LIVE) | Limit is Helena's RAS market-risk calibration; the B3 regulatory return consumes the same NOP. |
| 3 | **If NOP breaches the limit:** emit `FXPositionBreach { metric, limit, actual }` | `system` | `@platform/event-store` | Breach severity bands per the RAS (amber/red). |
| 4 | Daily position plan: Eitan (Treasurer) reviews the NOP, sets the target position, and — where a breach or a near-limit utilisation exists — instructs Saskia (Head of Global Markets, governance) to reduce the position | `agent` (Eitan) | `@platform/market-risk` | The instruction is emitted as an `AgentDecision` (decisionId, target NOP, rationale, citation to the RAS limit). |
| 5 | Execution: Saskia executes the FX trades to bring the NOP within limit; the revaluation re-runs and confirms the position is within limit | `agent` (Saskia) | `@platform/markets` | Post-execution `FxPositionRevalued` confirms remediation; effectiveness recorded against the originating `AgentDecision`. |
| 6 | Excon check: every position is confirmed within the bank's Exchange Control authority; any position requiring new Excon authority is escalated before it is taken | `agent` (Eitan) + `agent` (Mira — Excon reporting) | `@platform/compliance` | A position needing new authority is escalated per §9; Mira files the Excon report. |
| 7 | Book the FX market risk into Helena's taxonomy where the position carries residual risk | `system`/`agent` (Eitan) | `@platform/risk` | Emit `RiskRaised` (FX market risk) into the CRO taxonomy. |

## 6. Reconciliation

- **Events produced:** `FxPositionRevalued` (continuous); `FXPositionBreach` (on breach); `AgentDecision` (position plan / reduce instruction); `RiskRaised` (FX risk); `AgentEscalation` (Excon-affecting).
- **Reconciliation checks:**
  - The aggregate NOP from `FxPositionRevalued` reconciles to the NOP cell in the B3 market-risk return for the same as-of date.
  - Every `FXPositionBreach` traces to a subsequent `AgentDecision` (reduce instruction) and a confirming post-execution `FxPositionRevalued`, or an `AgentDecision` accepting the breach with documented rationale.
  - No FX position is held outside the recorded Excon authority (Excon check, step 6).
- **Failure mode:** FX revaluation stale (no `FxPositionRevalued` on a rate move) → Eitan's daily data-quality check flags it; `SubstrateAlert` raised; fallback to last-good mark with a stale-mark flag.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `FxPositionRevalued` / `FXPositionBreach` events | Event log | Permanent (P1) | Restricted |
| Position-plan `AgentDecision` events | Event log | Permanent (P1) | Restricted |
| Excon authority record + Excon reports (Mira) | Document store + Excon submission record | 7 years | Confidential |
| Daily NOP review note | Document store | 7 years | Restricted |

## 8. Manual steps

- **Step 4 — Daily position plan:** the Treasurer's target-NOP judgement and reduce instruction require market judgement.
- **Step 6 — Excon authority:** confirming a position sits within Exchange Control authority, and any FinSurv engagement, is a human-overseen compliance act (Mira + Eitan).

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| NOP breach with no remediation | `FXPositionBreach` + no subsequent reduce `AgentDecision` | Helena + Eitan; directed remediation with timeframe |
| Position outside Excon authority | Step 6 Excon check | `AgentEscalation` → CEO + Imani (legal) + Mira (Excon) pre-decision; SARB FinSurv approval if required |
| Stale FX revaluation | Eitan daily data-quality check | Atlas + Eitan; `SubstrateAlert`; stale-mark fallback |
| Persistent near-limit utilisation | Daily NOP review trend | ALCO standing item; RAS recalibration discussion with Helena |
| NOP ≠ B3 return cell | Reconciliation check | Bea + Eitan; resolve before the B3 return is filed |

## 10. Related procedures

- [`alco-cycle.md`](alco-cycle.md) (PROC-ALM-ALCO-01) — FX NOP utilisation is an ALCO standing item.
- [`excon-otc-derivatives.md`](excon-otc-derivatives.md) — Exchange Control treatment of OTC FX derivatives.
- [`intraday-liquidity-funding.md`](intraday-liquidity-funding.md) (PROC-RISK-ILF-01) — FX settlement funds the correspondent nostro; liquidity and FX position interact.
- [`hedge-designation-test.md`](hedge-designation-test.md) (PROC-ALM-HDT-01) — FX hedges require hedge-accounting designation.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-30 | Eitan + Saskia + Helena (via Scrooge) | Initial authoring — closes the PROC-ALM-FXP-01 procedure gap. FX is revalued daily (`FxPositionRevalued`) and a breach pathway (`FXPositionBreach`) is live; this procedure governs the previously-unprocedured daily flow. Authority: D-TREASURER-PROC-COMPLETION-2026-05-30. |

## 12. Audit / assurance

- **Vera daily/monthly:** verify the aggregate NOP reconciles to the B3 cell; verify every `FXPositionBreach` has a disposition; verify no position sits outside Excon authority.
- **Thandiwe (Chief Audit Executive, governance):** annual internal audit of FX position governance and Excon compliance; opinion to the Interim Audit Forum.
