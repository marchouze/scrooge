---
policy-parent: market-risk-policy-v1
last-reviewed: 2026-05-20
procedureId: PROC-RISK-MRL-01
title: Market risk limit monitoring — MR-1 to MR-6 daily limit register, breach escalation, and no-prop attribution
author: Rohan (Market risk quantitative engineer, engineering)
date: 2026-05-20
owner: Helena (Chief Risk Officer, governance) · Rohan (Market risk quantitative engineer, engineering)
status: POPULATED
policy-cited: market-risk-policy-v1
parent-policy: Policies/market-risk-policy-v1.md
citationOwner: Mira (Regulatory intelligence engineer, compliance)
version: v1.1 — 2026-05-20
last-updated: 2026-05-20
system-capability: "@platform/risk-engine/limit-comparator (PLANNED)"
change-log:
  - v1.1 — 2026-05-20 — Rohan + Helena — v1.1 amendment per Bea (Independent Validation engineer, engineering) review on PR #610 ([comment 4497901020](https://github.com/marchouze/scrooge/pull/610#issuecomment-4497901020)); authoring brief `brief:rohan:amend-frtb-sa-mrl-procedures-per-bea-v1-0-review:2026-05-20`. **Path A chosen** for the MR-5 / MR-5-NPA naming reconciliation against Market Risk Policy v1 §3. **Rationale:** policy §3 names MR-5 as "No-prop rule enforcement" (singular qualitative line). v1.0 of this procedure forked from that by splitting MR-5 into MR-5 (stress scenario loss; quantitative) + MR-5-NPA (no-prop attribution; qualitative), which is a policy-level reinterpretation rather than a procedure-internal choice. Path A restructures the procedure to **MR-5 = no-prop attribution** (matches policy §3 verbatim) and **MR-6 = stress scenario loss** (the bank-wide stress-loss ceiling line, retained because the stress ceiling is operationally load-bearing even though policy §3 does not name it). Path B (propose Market Risk Policy v1.2 to rename §3 MR-5 to "no-prop attribution + stress-loss ceiling") was rejected because (i) it triggers a policy amendment for what is essentially a procedure-side naming discipline; (ii) the stress-loss ceiling is also reachable as a quantitative limit *below* the §3 register without re-opening §3; (iii) the policy already references PROC-RISK-ST-01 (stress test cycle), so the stress ceiling can be sourced there rather than under §3 MR-5. **Substrate gap surfaced:** `Policies/market-risk-policy-v1.md` line 266 (v1 change-log + §8.2 procedures-planned summary) still refers to "MR-5 (stress) + MR-5-NPA"; that line is a render of the procedure structure and is now stale. Helena to update in the next policy-housekeeping pass (no Decision required — single-line render correction). Cross-cutting changes: (1) §1.1 + Step 1 register restructured (MR-5 = no-prop attribution; MR-6 = stress; MR-5-NPA naming retired). (2) Step 8 retitled "MR-5 daily attribution". (3) Outputs / Controls / Escalation tables re-keyed. (4) `NoPropAttributionFlagged.missingAttribution` extended to include `stale_reference` (programme expired) as a third state per Bea's hedge-programme-expiry observation. (5) Desk-level aggregation diversification factor source named (Helena's recalibration brief; cross-reference added in Step 1 final paragraph). (6) `MarketRiskHardBreachExemptionGranted` schema constraint clarified: `expiryDate` ≤ 5bd from emission is a schema-level invariant (PLANNED in `@platform/events/market-risk-limit`), not procedure prose. Citations unchanged.
  - v1 — 2026-05-20 — Rohan + Helena — Initial POPULATED procedure per `brief:rohan:draft-four-market-risk-procedures-policy-v1-8-2:2026-05-20` (Market Risk Policy v1 §8.2; CEO authorisation 2026-05-20).
---

# Procedure — Market risk limit monitoring

**Procedure ID:** PROC-RISK-MRL-01
**Owner:** Helena (Chief Risk Officer, governance) — governance · Rohan (Market risk quantitative engineer, engineering) — daily monitoring
**Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) approves every RAS market risk line (MR-1 through MR-6) at calibration and on every recalibration; Helena recommends; CEO authorises. The Market Risk Committee (MRC — Helena chair) governs day-to-day breach management within the approved limits.
**Cadence:** Continuous intraday monitoring on every `TradeBooked` / `PositionUpdated`; full daily limit-utilisation snapshot at end-of-day; weekly Helena review; monthly MRC reporting; quarterly BRC trend reporting; annual recalibration cycle.
**Version:** v1.1 — 2026-05-20
**Status:** POPULATED

---

## 1. Source policy

- `Policies/market-risk-policy-v1.md` — Market Risk Policy v1, §3 (Market Risk Appetite — MR-1 through MR-5), §1.4 (Breach taxonomy — Alert / Hard Breach / Critical), §5 (CVA hedge limit per MR-4), §6 (Market Risk Governance — MRC and BRC), §8.1 (Substrate dependencies — ES, sensitivities, limit-comparator), §8.2 (Procedures planned — this procedure).
- `Policies/trading-mandate-v1.md` — business-side franchise constraints; no-prop principle realised here as MR-5 attribution.

The obligation chain (Principle 2):

```
Regulation (Banks Act 94/1990 + Reg 32; BCBS FRTB; ORG-PR-19, ORG-PR-20)
  → Policy (Market Risk Policy v1 §3, §1.4, §5)
    → PROC-RISK-MRL-01 (this procedure)
      → @platform/risk-engine/limit-comparator (PLANNED)
      → @platform/events/market-risk-limit-breached (PLANNED)
```

The procedure operationalises Market Risk Policy v1 §3 — the five RAS market risk lines (MR-1 1-day 99% VaR, MR-2 10-day 97.5% Expected Shortfall, MR-3 sensitivity per risk class, MR-4 CVA sensitivity, **MR-5 no-prop rule enforcement** — per policy §3 verbatim) plus the CVA hedge limit referenced in §5 and a procedure-side stress-loss ceiling line (**MR-6 stress scenario loss**). v1.1 retired the prior MR-5 / MR-5-NPA naming split: policy §3 names MR-5 as a single qualitative no-prop line; this procedure now realises that one-to-one (MR-5 = no-prop attribution) and adds a separate MR-6 stress ceiling sourced from PROC-RISK-ST-01 rather than under §3 (see change-log v1.1 for Path A rationale). It defines the daily run discipline, the warning / amber / hard-breach thresholds (50% / 80% / 100%), the desk-level → bank-wide aggregation, and the escalation chain on breach (1bd MRC convene; 5bd remediation plan; PA notification per Imani's ratification).

**No numerical calibration values are invented in this procedure.** Every limit numeric is marked `[calibration: pending RAS-calibration by Rohan under Helena's direction]`. The procedure defines *how* the limits operate; the *values* enter via Helena's calibration cycle and a separate Decision event under CEO authority.

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-19` | Measure trading-book market risk per FRTB; capital under SA or IMA. MR-1 / MR-2 / MR-3 are the daily risk-measure equivalents of the SA / IMA capital floor; this procedure ensures the Bank operates within them. |
| `ORG-PR-20` | No proprietary risk-taking outside warehoused franchise hedge positions. MR-5 is the operational realisation; every trading-book position must attribute to a client flow OR a named franchise hedge programme. |
| `ORG-PR-33` | Revised CVA framework (BCBS July 2020; PA D/2025). MR-4 monitors CVA sensitivity daily; the CVA hedge limit (§5 of Market Risk Policy v1) is operationalised here. |
| BCBS FRTB (January 2019) — ES (97.5%, 10-day) and sensitivity-based measures `[citation: TBC — precise paragraph indices; Imani (Legal-as-code engineer, engineering) + external counsel ratify]` | ES is the primary FRTB risk measure; the sensitivity-based measures are the SBM inputs. |
| Regulations Relating to Banks 2012 — Reg 32 (market risk capital requirement) `[citation: TBC]` | Statutory market risk capital floor; limits here are within the capital headroom. |
| PA notification obligation on Hard Breach (where material) | `[citation: TBC — confirmation pending Imani's regulatory-text walk]` |

---

## 3. Purpose

Maintain, monitor, and enforce the Bank's market risk limit register on a continuous-intraday + daily-EOD cadence; classify every measurement against the warning (50% of limit) / amber alert (80%) / hard-breach (100%) thresholds; emit the canonical event signal; trigger the policy-mandated escalation chain on amber and hard-breach. Ensure that every trading-book position carries a no-prop attribution to either a client facilitation flow OR a named franchise hedge programme (MR-5). The procedure is the operational realisation of Market Risk Policy v1 §3 and the day-to-day enforcement of the no-prop principle (`ORG-PR-20`).

---

## 4. Trigger

- **Continuous intraday** (on every `TradeBooked` / `PositionUpdated` / `MarketDataIntradaySnapshotted`): the engine recomputes the affected risk measures (delta-VaR, sensitivity per risk class) and re-checks against limits. Used for intraday alerting before market close.
- **Daily** (every business day at 17:30 SAST, after market close): the full daily limit-utilisation snapshot is computed against the canonical EOD VaR / ES / sensitivity / CVA-sensitivity / no-prop attribution outputs. Emits the canonical event population for the day.
- **On `FrtbSaCapitalComputed`** (from PROC-RISK-FRTB-SA-01): the daily SA capital figure is cross-checked against the capital-headroom dimension of MR-1 / MR-2.
- **Limit-register update** (on `MarketRiskLimitCalibrated` event — Helena recommends, CEO approves): the engine refreshes the limit register; effective from the next business day forward.
- **Ad-hoc** (Helena's instruction): out-of-cycle limit-utilisation snapshot for ad-hoc analysis or PA request.

---

## 5. Steps

Default actor is the limit-comparator engine agent (`@platform/risk-engine/limit-comparator`) unless a step is explicitly marked as a human-approval step.

### 5.1 Limit register (Step 1)

**Step 1 — Limit register structure.**

The Bank maintains a limit register keyed by `(limitId, scope, riskClass?, deskId?, calibration_effective_from)`. Numerical values are calibrated by Rohan under Helena's direction and approved by CEO (Board interim); they are not authored in this procedure. The register structure:

| Limit ID | Description | Scope | Risk class | Warning (50%) | Amber (80%) | Hard breach (100%) |
|---|---|---|---|---|---|---|
| MR-1 | 1-day 99% VaR | Bank-wide (trading book aggregate) | All | `[calibration: pending RAS-calibration by Rohan under Helena's direction]` ZAR | `[calibration: pending]` ZAR | `[calibration: pending]` ZAR |
| MR-1-GIRR | 1-day 99% VaR — GIRR desk | Desk | GIRR | `[calibration: pending]` ZAR | `[calibration: pending]` ZAR | `[calibration: pending]` ZAR |
| MR-1-EQ | 1-day 99% VaR — Equities desk | Desk | Equity | `[calibration: pending]` ZAR | `[calibration: pending]` ZAR | `[calibration: pending]` ZAR |
| MR-1-FX | 1-day 99% VaR — FX desk | Desk | FX | `[calibration: pending]` ZAR | `[calibration: pending]` ZAR | `[calibration: pending]` ZAR |
| MR-2 | 10-day 97.5% Expected Shortfall (FRTB-aligned) | Bank-wide | All | `[calibration: pending]` ZAR | `[calibration: pending]` ZAR | `[calibration: pending]` ZAR |
| MR-3-GIRR | Sensitivity (delta) — GIRR risk class | Bank-wide | GIRR | `[calibration: pending]` ZAR per bp | `[calibration: pending]` ZAR per bp | `[calibration: pending]` ZAR per bp |
| MR-3-FX | Sensitivity (delta) — FX risk class | Bank-wide | FX | `[calibration: pending]` ZAR per 1% | `[calibration: pending]` ZAR per 1% | `[calibration: pending]` ZAR per 1% |
| MR-3-EQ | Sensitivity (delta) — Equity risk class | Bank-wide | Equity | `[calibration: pending]` ZAR per 1% | `[calibration: pending]` ZAR per 1% | `[calibration: pending]` ZAR per 1% |
| MR-3-CSR-corp | Sensitivity (delta) — CSR non-securitisation, corporate | Bank-wide | CSR | `[calibration: pending]` ZAR per bp | `[calibration: pending]` ZAR per bp | `[calibration: pending]` ZAR per bp |
| MR-3-CSR-cva | Sensitivity (delta) — CSR non-securitisation, OTC IRD counterparty CVA | Bank-wide | CSR | `[calibration: pending]` ZAR per bp | `[calibration: pending]` ZAR per bp | `[calibration: pending]` ZAR per bp |
| MR-3-COM | Sensitivity (delta) — Commodity risk class (lower bound — non-primary franchise scope per Market Risk Policy v1 §3) | Bank-wide | Commodity | `[calibration: pending — set to a low bound consistent with non-primary-franchise scope]` ZAR per 1% | `[calibration: pending — low bound]` ZAR per 1% | `[calibration: pending — low bound]` ZAR per 1% |
| MR-4 | CVA sensitivity to counterparty credit spread | Bank-wide | CVA | `[calibration: pending]` ZAR per bp | `[calibration: pending]` ZAR per bp | `[calibration: pending]` ZAR per bp |
| MR-4-HEDGE | CVA hedge programme limit — notional outstanding eligible CVA hedges (per Market Risk Policy v1 §5) | Bank-wide | CVA hedge | `[calibration: pending]` ZAR notional | `[calibration: pending]` ZAR notional | `[calibration: pending]` ZAR notional |
| MR-5 | No-prop attribution: fraction of trading-book positions with a valid client-flow OR named-hedge attribution (per Market Risk Policy v1 §3 MR-5 "No-prop rule enforcement"; `ORG-PR-20`) | Bank-wide | All | 100% (informational only; any deviation is a Hard Breach) | n/a | < 100% |
| MR-6 | Stress: scenario loss under the bank-wide adverse stress scenario (per PROC-RISK-ST-01) | Bank-wide | All | `[calibration: pending]` ZAR loss | `[calibration: pending]` ZAR loss | `[calibration: pending]` ZAR loss |

**Important — naming reconciliation (Path A applied at v1.1):** Market Risk Policy v1 §3 names MR-5 as **"No-prop rule enforcement"** (a single qualitative line). v1.0 of this procedure forked from that by splitting MR-5 into MR-5 (stress; quantitative) + MR-5-NPA (no-prop; qualitative), creating a policy-procedure naming mismatch. v1.1 restructures to **MR-5 = no-prop attribution** (matches policy verbatim) and **MR-6 = stress scenario loss** (a new procedure-side line sourced from PROC-RISK-ST-01 rather than under §3, because stress-loss is operationally load-bearing but is not the §3 no-prop line). The Path A choice avoids a Market Risk Policy v1.2 amendment (Path B was rejected — see change-log v1.1 rationale). The MR-4 CVA hedge limit referenced in §5 is realised as MR-4-HEDGE alongside the MR-4 sensitivity line.

Desk-level sub-limits (MR-1-GIRR, MR-1-EQ, MR-1-FX) aggregate to MR-1 per Market Risk Policy v1 §3 "Principles — Desk-level limits aggregate to the bank-wide limit". Helena ensures the sum of desk limits does not exceed the bank-wide limit accounting for realistic correlation. The diversification factor is calibrated at each recalibration cycle and documented in **Helena's calibration brief** (the artefact filed under the annual recalibration cadence per §7 controls — not duplicated in this procedure per single-graph discipline). Formally: `Σ_desks desk_limit_i ≤ bank_wide_limit × diversification_factor`, where `diversification_factor ≤ 1` reflects correlation-adjusted aggregation; if the calibration-effective sum exceeds the bank-wide limit, the bank-wide limit is the binding constraint and the desk-level limits are management ceilings within the bank-wide budget.

### 5.2 Daily limit-utilisation snapshot (Steps 2–4)

**Step 2 — Risk-measure retrieval.**

The engine retrieves the day's EOD risk measures: VaR (from `MarketRiskMeasureComputed` per PROC-RISK-MRM-01); ES (same); sensitivities per risk class (from PROC-RISK-FRTB-SA-01 Step 4); CVA sensitivity (from `@platform/risk-engine/cva-sensitivities`); stress scenario loss for MR-6 (from PROC-RISK-ST-01 daily sensitivity-update output, where computed); no-prop attribution per position for MR-5 (from `@platform/risk-engine/trade-origin-check`).

**Step 3 — Limit comparison.**

For each limit in the register, the engine computes `utilisation = current_measure / hardBreachThreshold`. Classification:

- **Within budget:** `utilisation < 0.50` → no flag.
- **Warning:** `0.50 ≤ utilisation < 0.80` → soft flag; informational on Helena's daily report; no escalation.
- **Amber Alert:** `0.80 ≤ utilisation < 1.00` → amber alert; emits `MarketRiskLimitAmberAlert` event.
- **Hard Breach:** `utilisation ≥ 1.00` → hard breach; emits `MarketRiskLimitBreached` event; triggers the breach-management chain (Step 5 below).

**Step 4 — Emit canonical events.**

For each (limit, scope, riskClass?) tuple, the engine emits one event per day per state — coalesced if the state is unchanged from yesterday and the utilisation has not crossed a threshold. The event population per day:

- `MarketRiskMeasureComputed { date, limitId, scope, riskClass?, currentMeasure, hardBreachThreshold, utilisation, state: within | warning | amber | breach, citations[] }` — the canonical daily limit-utilisation event (one per limit-row per day).
- `MarketRiskLimitAmberAlert { date, limitId, scope, riskClass?, currentMeasure, hardBreachThreshold, utilisation, citations[] }` — emitted only when the state is Amber and is a deterioration from the prior day.
- `MarketRiskLimitBreached { date, limitId, scope, riskClass?, currentMeasure, hardBreachThreshold, utilisation, citations[] }` — emitted on Hard Breach.

### 5.3 Breach management (Steps 5–7)

**Step 5 — Amber Alert response.**

On `MarketRiskLimitAmberAlert`:

1. Within 24 hours of event emission: Helena (Chief Risk Officer, governance) and the affected desk head are notified by automated alert. Desk head reviews intraday position and confirms whether the alert is due to a position increase (controllable) or a market move (less controllable in the short run).
2. The desk head provides a management action plan within 2 business days (per Market Risk Policy v1 §1.4 Alert taxonomy): position reduction, hedge addition, or a documented decision to hold (with rationale).
3. If the Amber Alert persists for 2 consecutive business days (per Market Risk Policy v1 §1.4 Alert escalation): Helena escalates to the Market Risk Committee at the next meeting; the CEO is informed.

**Step 6 — Hard Breach response.**

On `MarketRiskLimitBreached`:

1. Within 15 minutes (intraday) or by 09:00 next business day (EOD breach): Helena, Camille (Chief Financial Officer, governance), and the CEO are notified by automated alert.
2. **Position freeze:** the order-management layer (per PROC-MK-MA-01 — Trading Mandate Attestation) automatically blocks new risk-increasing trades on the affected desk / risk class. Exemptions require Helena's signed event (`MarketRiskHardBreachExemptionGranted { breachEventId, scope, expiryDate, rationale, citations[] }`).
3. **Market Risk Committee convene:** MRC convenes within 1 business day per the brief (also per Market Risk Policy v1 §1.4 Hard Breach taxonomy). Helena chairs; the desk head presents; Rohan provides quantitative attribution.
4. **Remediation plan:** a written remediation plan is filed within 5 business days (per the brief and Market Risk Policy v1 §1.4). The plan is one of: (i) position reduction to within the limit by a target date; (ii) Helena proposes a limit-recalibration to CEO (Board interim), with a documented business rationale; (iii) Market Risk Committee approves a short-term exemption (≤ 5 business days) with a resolution deadline (Market Risk Policy v1 §3 "There are no standing limit exceptions").
5. **PA notification:** for material Hard Breaches (materiality defined by Imani's ratification — `[citation: TBC — typically tied to a fraction of the regulatory capital base or to a triggering event reportable under Regulations Relating to Banks; Imani + external counsel ratify the threshold]`), Owen (Company Secretary, governance) drafts a PA notification within `[calibration: pending — typically 5 business days for non-critical Hard Breaches]`. Helena signs; Imani ratifies the legal obligation.

**Step 7 — Critical event response.**

On a Critical event per Market Risk Policy v1 §1.4 (back-testing Red zone — see PROC-RISK-BACKTEST-01 Step 10; or capital-headroom exhaustion under SA per the ICAAP trajectory; or unvaluable position):

1. Within 24 hours: CEO and BRC notified. PA notification per Imani's ratification.
2. The Critical event is recorded as `MarketRiskCriticalEventRecorded { eventType, date, scope, narrative, citations[] }` — a distinct event from `MarketRiskLimitBreached`, so the audit chain distinguishes severity.
3. Crisis management protocol (per PROC-OR-CMA-01) may activate if the Critical event has institutional materiality.

### 5.4 No-prop attribution — MR-5 (Step 8)

**Step 8 — MR-5 daily no-prop attribution sweep.**

Per Market Risk Policy v1 §3 MR-5 ("No-prop rule enforcement") and `ORG-PR-20`:

1. The engine runs the no-prop attribution sweep: for every trading-book position at EOD, verify that it carries a valid attribution to a client-flow OR a named-franchise-hedge-programme. Attribution metadata is captured at trade booking (per PROC-MK-MA-01 — Trading Mandate Attestation Step 1) and persisted on the position record.
2. **Valid client-flow attribution:** the position arose from a client-facilitation trade (institutional client; market-making; execution; hedging of client flow). The attribution carries the originating client trade-ID.
3. **Valid named-hedge attribution:** the position is part of a named warehoused franchise hedge programme (e.g. "ZAR-IRD warehouse hedge programme #001"). Named programmes are pre-approved by Helena and recorded in the hedge-programme register (`@platform/markets/hedge-programme-register`, PLANNED). Programmes carry an `expiryDate` so that expired programmes do not silently continue to absorb attribution.
4. **Invalid / missing attribution:** any position without a valid attribution is flagged as a potential no-prop violation. The engine emits `NoPropAttributionFlagged { date, positionId, deskId, attributionState, currentExposure, citations[] }` where `attributionState` is one of:
    - `missing` — no attribution metadata exists on the position record (data gap).
    - `invalid_reference` — the attribution references a client trade-ID or hedge programme that does not exist in the upstream register (referential-integrity failure).
    - `stale_reference` — the attribution references a hedge programme whose `expiryDate` has passed (programme expired but position remains attributed to it). Added at v1.1 per Bea's review; relevant once warehoused hedge programmes have expiry dates.
5. Helena reviews flagged positions within 1 business day per Market Risk Policy v1 §3 MR-5. If a position is confirmed as proprietary risk-taking, the Market Risk Committee convenes within 24 hours (per §3); the position is reduced or hedged to zero within the timeframe set in the remediation plan (typically same day or next business day). The confirmation is recorded as `NoPropViolationConfirmed { flagEventId, decisionRationale, remediationTargetDate, citations[] }`.
6. If a position is confirmed as a misclassified-attribution case (e.g. the attribution metadata was missing at booking but the position is genuinely client-flow; or the position should be re-attached to a successor hedge programme replacing the expired one), the attribution is corrected via `NoPropAttributionCorrected { flagEventId, correctedAttribution, rationale, citations[] }` and the flag is closed.

The MR-5 attribution "limit" is binary: 100% of trading-book positions must have valid attribution. Any non-100% is a Hard Breach (Step 6 above) — the no-prop principle is absolute and non-negotiable per Market Risk Policy v1 §1 Principles.

---

## 6. Outputs (events)

**Emitted by this procedure:**

- `MarketRiskMeasureComputed { date, limitId, scope, riskClass?, currentMeasure, hardBreachThreshold, utilisation, state, citations[] }` — daily, per limit-row.
- `MarketRiskLimitAmberAlert { date, limitId, scope, riskClass?, currentMeasure, hardBreachThreshold, utilisation, citations[] }` — on Amber-state deterioration.
- `MarketRiskLimitBreached { date, limitId, scope, riskClass?, currentMeasure, hardBreachThreshold, utilisation, citations[] }` — on Hard Breach.
- `MarketRiskHardBreachExemptionGranted { breachEventId, scope, expiryDate, rationale, citations[] }` — Helena-signed exemption. **Schema invariant** (enforced in `@platform/events/market-risk-limit` PLANNED, not procedure prose): `expiryDate ≤ emission_date + 5 business days`. The 5bd cap is a schema-level constraint per Market Risk Policy v1 §3 ("there are no standing limit exceptions"); rejected at event-validation if violated.
- `MarketRiskBreachRemediationPlanFiled { breachEventId, planSummary, targetResolutionDate, citations[] }` — 5bd filing per Market Risk Policy v1 §1.4 + brief.
- `MarketRiskBreachRemediated { breachEventId, planEventId, resolutionDate, citations[] }` — on resolution.
- `MarketRiskCriticalEventRecorded { eventType, date, scope, narrative, citations[] }` — Critical event (back-testing Red, capital-headroom exhaustion, unvaluable position).
- `NoPropAttributionFlagged { date, positionId, deskId, attributionState: 'missing' | 'invalid_reference' | 'stale_reference', currentExposure, citations[] }` — per flagged position. `attributionState` is the v1.1 enum replacing the v1.0 `missingAttribution: true | invalid_reference` field; the new `stale_reference` value covers expired hedge programmes.
- `NoPropViolationConfirmed { flagEventId, decisionRationale, remediationTargetDate, citations[] }` — Helena's confirmation.
- `NoPropAttributionCorrected { flagEventId, correctedAttribution, rationale, citations[] }` — misclassification resolution.
- `MarketRiskLimitCalibrated { limitId, scope, riskClass?, oldThreshold, newThreshold, effectiveFrom, ceoApprovalRef, citations[] }` — limit-register update on recalibration cycle.

**Consumed by this procedure (read dependencies):**

- `MarketRiskMeasureComputed { ... }` (per PROC-RISK-MRM-01 — VaR / ES) — daily aggregate measures.
- `FrtbSaCapitalComputed` (per PROC-RISK-FRTB-SA-01) — capital headroom dimension of MR-1 / MR-2.
- Sensitivity events (per PROC-RISK-FRTB-SA-01 Step 4) — MR-3 inputs.
- CVA sensitivity events — MR-4 input.
- `StressScenarioRun { ... }` (per PROC-RISK-ST-01) — MR-6 input (sensitivity-update cadence; full cycle quarterly).
- Position-attribution metadata at trade booking (per PROC-MK-MA-01) — MR-5 input.
- `BacktestingZoneEntered { toZone: red }` (per PROC-RISK-BACKTEST-01) — Critical event trigger.

---

## 7. Controls / approvers

| Control | Frequency | Owner |
|---|---|---|
| Daily completeness check: `MarketRiskMeasureComputed` event for every limit-row per business day | Daily | Rohan (first line); Vera (third line) via `recon:market-risk-limit-daily-completeness` (PLANNED) |
| Day-on-day utilisation delta attribution | Daily | Rohan |
| Amber Alert response within 2 business days | Per Amber | Helena (CRO); desk head |
| Hard Breach MRC convene within 1 business day | Per Hard Breach | Helena (chair MRC) |
| Hard Breach remediation plan filed within 5 business days | Per Hard Breach | Helena |
| Hard Breach PA notification per Imani's ratification | Per material Hard Breach | Helena (signs); Owen (drafts); Imani (ratifies legal obligation) |
| No-prop attribution sweep — 100% of positions attributed | Daily | Rohan; Helena reviews flagged positions within 1bd |
| Annual limit-register recalibration | Annual + ad-hoc on material change | Helena (recommends); CEO (Board interim) approves |
| Desk-level → bank-wide aggregation correctness (sum of desk limits ≤ bank-wide ceiling accounting for correlation) | Per recalibration | Helena |
| Independent validation of limit-comparator engine | Annual + ad-hoc on methodology change | Nadia (Independent-validation engineer, engineering) per PROC-RSK-MV-01 |
| Monthly MRC limit-utilisation review (90-day rolling trend per desk and risk class) | Monthly | Helena (chair); Rohan (technical secretary) |
| Quarterly BRC trend reporting | Quarterly | Helena |
| External audit review of limit framework | Annual (at year-end audit) | Camille co-ordinates; external auditor opines |

---

## 8. Escalation

| Condition | Action | Timeframe |
|---|---|---|
| **No `MarketRiskMeasureComputed` events by 09:00 next business day** | Rohan investigates immediately; Helena notified by 10:00; positions treated as if in Amber until events available; Vera opens incident if cause is process-level | 4h to first event; 24h to remediation |
| **Warning state (50% ≤ utilisation < 80%)** | Informational on Helena's daily report; no escalation | n/a |
| **Amber Alert (80% ≤ utilisation < 100%)** | Helena + desk head notified; management action plan within 2 business days; MRC at next meeting if Amber persists for 2 consecutive business days | 2bd plan |
| **Hard Breach (utilisation ≥ 100%)** | Helena + Camille + CEO notified within 15 min (intraday) or 09:00 next bd (EOD); position freeze (per PROC-MK-MA-01); MRC convene within 1 business day; remediation plan within 5 business days; PA notification for material breach per Imani's ratification (within `[calibration: pending — typically 5bd]`) | 15 min notification; 1bd MRC; 5bd plan |
| **Standing limit exception** | Prohibited per Market Risk Policy v1 §3 — every Hard Breach must be resolved (position reduction or limit recalibration); short-term exemptions ≤ 5bd require MRC approval and signed exemption event | n/a |
| **MR-5 flagged position (missing, invalid, or stale attribution)** | Helena reviews within 1 business day; confirm-prop → MRC convene within 24h + position reduction within remediation-plan timeframe (typically same/next bd); misclassification or stale-reference re-attachment → attribution correction event | 1bd review; 24h MRC on confirmed-prop |
| **Critical event** (back-testing Red entry on IMA-approved desk per PROC-RISK-BACKTEST-01; capital-headroom exhaustion under SA; unvaluable position) | CEO + BRC notified within 24h; PA notification per Imani's ratification; crisis-management protocol activates if institutionally material | 24h notification |
| **CVA hedge limit (MR-4-HEDGE) Hard Breach** | Same as MR-1 to MR-5 Hard Breach; additionally Helena reviews counterparty exposure concentration and may instruct CVA-hedge unwind or counterparty-limit reduction | 1bd MRC; 5bd plan |
| **Calibration drift: sum of desk limits > bank-wide ceiling at recalibration** | Helena reconciles before CEO approval; the bank-wide ceiling is the binding constraint; desk limits are management ceilings within the bank-wide budget | Per recalibration cycle |

---

## 9. Substrate dependencies

| Capability | Status | Description |
|---|---|---|
| `@platform/risk-engine/limit-comparator` | PLANNED | Limit-comparison engine: consumes risk measures + limit register; classifies state (within / warning / amber / breach); emits events |
| `@platform/risk-engine/limit-register` | PLANNED | Versioned limit register keyed by `(limitId, scope, riskClass?, effective_from)`; refreshed on `MarketRiskLimitCalibrated` events |
| `@platform/risk-engine/var` | PLANNED | MR-1 input |
| `@platform/risk-engine/expected-shortfall` | PLANNED | MR-2 input |
| `@platform/risk-engine/sensitivities` | PLANNED | MR-3 inputs (per risk class) |
| `@platform/risk-engine/cva-sensitivities` | PLANNED | MR-4 input |
| `@platform/risk-engine/cva-hedge-register` | PLANNED | MR-4-HEDGE input (notional outstanding eligible CVA hedges) |
| `@platform/stress-test/sensitivity-update` | PLANNED | MR-6 input (stress sensitivity-update output; full stress cycle per PROC-RISK-ST-01) |
| `@platform/risk-engine/trade-origin-check` | PLANNED | MR-5 input (no-prop attribution sweep per position) |
| `@platform/markets/hedge-programme-register` | PLANNED | Named franchise hedge programmes; pre-approved by Helena; valid attribution targets for MR-5; carries `expiryDate` to enable `stale_reference` detection |
| `@platform/risk-engine/position-freeze` | PLANNED | Hard-breach order-management block (per PROC-MK-MA-01) |
| `@platform/events/market-risk-limit` | PLANNED | Typed event schema: `MarketRiskMeasureComputed`, `MarketRiskLimitAmberAlert`, `MarketRiskLimitBreached`, `MarketRiskHardBreachExemptionGranted`, `MarketRiskBreachRemediationPlanFiled`, `MarketRiskBreachRemediated`, `MarketRiskCriticalEventRecorded`, `NoPropAttributionFlagged`, `NoPropViolationConfirmed`, `NoPropAttributionCorrected`, `MarketRiskLimitCalibrated` |
| `@platform/recon/market-risk-limit-daily-completeness` | PLANNED | Daily completeness recon; desk → bank-wide aggregation correctness check |
| `@platform/notifications/alert` | PLANNED | Helena / desk-head / Camille / CEO alerts |
| `@platform/pa-submission/material-breach-notification` | PLANNED | PA notification packaging for material Hard Breach events |

---

## 10. Citations

- **Policy:** `Policies/market-risk-policy-v1.md` §3 (Market Risk Appetite — MR-1 through MR-5), §1.4 (Breach taxonomy — Alert / Hard Breach / Critical), §5 (CVA Capital — CVA hedge limit), §6.1 (Market Risk Committee), §6.2 (Reporting), §8.1 (Substrate dependencies — ES, sensitivities), §8.2 (Procedures planned — this procedure).
- **Business policy:** `Policies/trading-mandate-v1.md` — franchise scope and no-prop principle.
- **Regulation:** `ORG-PR-19`, `ORG-PR-20`, `ORG-PR-33`; BCBS *Minimum capital requirements for market risk* (January 2019) — ES + sensitivity-based measures `[citation: TBC]`; Regulations Relating to Banks 2012 Reg 32 `[citation: TBC]`; PA D/2025 `[citation: TBC]`.
- **Related procedures:** `PROC-RISK-FRTB-SA-01` (`frtb-sa-capital-computation.md`) — SA capital feeds capital-headroom dimension of MR-1 / MR-2 + sensitivity inputs to MR-3; `PROC-RISK-MRM-01` (`market-risk-monitoring.md`) — daily VaR / ES inputs; `PROC-RISK-BACKTEST-01` (`backtesting-governance.md`) — Red-zone entry on IMA-approved desk = Critical event; `PROC-RISK-PLA-01` (`pla-test-governance.md`) — PLA Fail reverts (desk, risk class) to SA, affecting MR-1 / MR-2 / MR-3 budget; `PROC-RISK-ST-01` (`stress-test-cycle.md`) — MR-6 stress input (sensitivity-update daily / full cycle annual + quarterly); `PROC-MK-MA-01` (`mandate-attestation.md`) — order-management position-freeze on Hard Breach; trading mandate attestation upstream; `PROC-RSK-MV-01` (`model-validation.md`) — Nadia's limit-engine validation; `PROC-OR-CMA-01` (`crisis-management-activation.md`) — Critical-event crisis-management protocol; `PROC-FIN-BA-01` (`ba-return-generation.md`) — capital-headroom integration.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1 | 2026-05-20 | Rohan (Market risk quantitative engineer, engineering) + Helena (Chief Risk Officer, governance) — via Scrooge dispatch `brief:rohan:draft-four-market-risk-procedures-policy-v1-8-2:2026-05-20` | Initial POPULATED procedure. Authors the market risk limit monitoring discipline per Market Risk Policy v1 §3 and §8.2. Eleven sections per agent-spec template. Limit register: MR-1 (bank-wide + desk-level GIRR/EQ/FX 1d 99% VaR), MR-2 (bank-wide 10d 97.5% ES), MR-3 (sensitivity per risk class — GIRR / FX / equity / CSR-corp / CSR-CVA / commodity at low bound for non-primary-franchise scope), MR-4 (CVA sensitivity) + MR-4-HEDGE (CVA hedge programme limit per Market Risk Policy v1 §5), MR-5 (stress) + MR-5-NPA (no-prop attribution — binary 100% requirement). Thresholds: warning 50%, amber 80%, hard breach 100%. Hard Breach: 15-min notification, 1bd MRC convene, 5bd remediation plan, PA notification per Imani's ratification. No-prop attribution: every position attributes to a client flow OR named franchise hedge programme; Helena reviews flagged positions within 1bd; confirmed prop = position to zero within remediation timeframe. Numerical values marked `[calibration: pending RAS-calibration by Rohan under Helena's direction]` per the brief's no-invented-numerics rule; commodity limit specifically marked as lower bound consistent with non-primary-franchise scope. Identity discipline per CLAUDE.md. Citation gaps `[citation: TBC]` per Principle 2. |
