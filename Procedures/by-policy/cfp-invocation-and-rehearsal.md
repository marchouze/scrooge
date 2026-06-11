---
policy-parent: liquidity-risk-management-policy-v1
last-reviewed: 2026-06-11
procedureId: PROC-RISK-CFP-01
title: CFP invocation and annual rehearsal
author: Eitan (Treasurer, governance) + Ravi (Treasury and ALM engineer, engineering)
date: 2026-06-11
owner: Eitan (Treasurer, governance) · Ravi (Treasury and ALM engineer, engineering)
status: POPULATED
policy-cited: liquidity-risk-management-policy-v1
system-capability: "@platform/alm/cfp-ewi (LIVE — ravi:cfp-ewi-monitor handler) + @platform/alm/cfp-rehearsal-harness (LIVE)"
---

# Procedure — CFP invocation and annual rehearsal

**Procedure ID:** PROC-RISK-CFP-01
**Owner:** Eitan (Treasurer, governance) — plan owner and activation authority; Ravi (Treasury and ALM engineer, engineering — reports to Eitan) — engineering substrate.
**Approval:** ALCO quorum (Tier 2 activation); CEO (Tier 3 activation); Board (Tier 3 notification within 24 hours).
**Cadence:** Event-driven (trigger-based activation for Tiers 1–3); annual (rehearsal at Eitan's next scheduled ALM tick after year-end).
**Version:** v1.0 — 2026-06-11
**Status:** POPULATED
**Standing authority:** `D-TREASURER-WAVE2-SUBSTRATE` (CEO-approved 2026-06-11); parent `D-TREASURER-ROLE-DEFINITION-REVIEW`.

---

## 1. Source Policy

- [`Policies/liquidity-risk-management-policy-v1.md`](../../Policies/liquidity-risk-management-policy-v1.md) — Liquidity Risk Management Policy v1 (IN FORCE; owners: Camille (Chief Financial Officer, governance) + Eitan + Helena (Chief Risk Officer, governance)), specifically:
  - **§5.1** (CFP purpose and regulatory basis)
  - **§5.2** (Trigger events and severity tiers — the seven typed trigger events and tier mapping)
  - **§5.3** (Funding-source hierarchy under CFP activation — Tiers 1, 2, 3)
  - **§5.4** (CFP rehearsal cadence and evidence standard)
  - **§9.1** (Breach classification — Critical / High taxonomy)
  - **§9.4** (Non-compliance written-notification to the PA)

The obligation chain (Principle 2):

```
Regulation (Banks Act 94 of 1990 Reg 26 + BCBS 144 Principle 11 + ORG-PR-15)
  → Policy: liquidity-risk-management-policy-v1 §5
    → PROC-RISK-CFP-01 (this procedure — tier invocation + annual rehearsal)
      → @platform/alm/cfp-ewi (LIVE — ravi:cfp-ewi-monitor)
      → @platform/alm/cfp-rehearsal-harness (LIVE — bun run cfp:rehearse)
      → docs/treasurer/cfp-funding-source-inventory.md
```

---

## 2. Source Regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-15` (BCBS 144 Principle 11) | Maintain a Contingency Funding Plan; rehearse annually; document; submit in the ILAAP. |
| Banks Act 94 of 1990 Reg 26 | Liquidity-risk management framework; PA notification on ratio breach. |
| `ORG-PR-38` (PA D4/2021) | Participation in PA-facilitated externally-facilitated liquidity stress simulations. |
| PA Directive 1 of 2022 §4.1.6 | Written notification to the PA if unable to comply with any D1/2022 LCR requirement. |

---

## 3. Purpose

Govern the **activation** of the Contingency Funding Plan across its three severity tiers in response to typed liquidity-stress trigger events, and govern the **annual rehearsal** of the CFP to satisfy BCBS 144 Principle 11 / `ORG-PR-15`. This procedure is the executable form of LRM Policy v1 §5.2–§5.4.

---

## 4. Trigger

**Tier 1 (automatic):** Any of the following events emitted by `ravi:cfp-ewi-monitor`:
- `IntradayStressDetected { severity: "persistent" }`
- `CriticalSettlementObligationAtRisk {}`

**Tier 2 (governance):** Any of:
- `LcrRatioBreach { severity: "warning" }` (LCR below 120% internal floor but ≥ 100%)
- `FundingConcentrationAlertTriggered {}` (single-counterparty ≥ 15% of total liabilities)
- `ExternalCreditEventDetected { impact: "material" }`

**Tier 3 (escalation):** Any of:
- `LcrRatioBreach { severity: "critical" }` (LCR ≤ 100%)
- `NsfrRatioBreach { severity: "critical" }` (NSFR ≤ 100%)
- `RecoveryEarlyWarningTriggered {}`

**Annual rehearsal:** Eitan's scheduled ALM tick after year-end — cadence: annual. Trigger: `ScheduledWakeUp { trigger: "cfp-annual-rehearsal" }` emitted by the runtime scheduler.

---

## 5. Inputs

- **Event store:** live CFP trigger events (from `ravi:cfp-ewi-monitor`) and ratio-measurement events (`LCRComputed`, `NSFRComputed`, `IntradayLiquidityMetricsComputed`) from Ravi's ALM engine.
- **Funding-source inventory:** `docs/treasurer/cfp-funding-source-inventory.md` — Tier 1/2/3 source list, capacity estimates, status (operational / blocked), and owner contacts.
- **RAS appetite register:** `prototype/platform/risk/ras-appetite-register.ts` — particularly `appetite:liquidity:intraday` (red threshold ≥ 80% peak usage) and `appetite:liquidity:lcr` / `appetite:liquidity:nsfr`.
- **ALCO contact list:** Eitan (chair), Helena (CRO), Camille (CFO), Devon (COO), Saskia (Head of Global Markets, governance).

---

## 6. Steps — Tier 1: Automatic Activation (Intraday Stress)

**Step 1 — Automatic EWI trigger.** `ravi:cfp-ewi-monitor` detects that `IntradayStressDetected { severity: "persistent" }` or `CriticalSettlementObligationAtRisk {}` threshold has been crossed. The handler emits the typed trigger event to the event store.

**Step 2 — Eitan notification.** The platform routes the trigger event to Eitan (Treasurer, governance) within **1 hour** of emission. No manual decision is required for Tier 1 activation — the plan is already active.

**Step 3 — Tier 1 activation.** Eitan executes the Tier 1 funding-source sequence from `docs/treasurer/cfp-funding-source-inventory.md`:
1. T1.1 — HQLA buffer liquidation (Level 1 SAGB repo via BondservAfrica).
2. T1.2 — SARB Intraday Repo standing facility (via ZAR correspondent bank — **W2.1 blocked if no correspondent in place**).
3. T1.3 — Payment-flow optimisation (Tomas defers non-time-critical outgoing payments).

**Step 4 — ALCO briefing.** Eitan briefs ALCO within **2 hours** of the trigger event. The briefing is an `ALCODecision { decisionType: "cfp-tier-1-briefed", asOf }` event.

**Step 5 — End-of-day position report.** If the Tier 1 measures resolved the intraday stress, Ravi's ALM engine emits a reconciling `EndOfDayLiquidityPosition` event. Eitan confirms closure in the ALCO standing reporting.

**Step 6 — Post-incident review.** If the stress was resolved by end-of-day: no further escalation. If not resolved by end-of-day: Eitan escalates to Tier 2 governance within 30 minutes of end-of-day cut-off.

---

## 7. Steps — Tier 2: Governance Activation (30-day Stress)

**Step 1 — Trigger event.** `ravi:cfp-ewi-monitor` emits one of the Tier-2 triggers. The trigger event routes to Eitan within **2 hours**.

**Step 2 — ALCO convened.** Eitan convenes ALCO within **4 hours** of the trigger event. Quorum: Eitan (chair), Helena (Chief Risk Officer, governance), Camille (Chief Financial Officer, governance), Devon (Chief Operating Officer, governance). Saskia (Head of Global Markets, governance) attends for trading-book decisions. Owen (Company Secretary, governance) records the meeting (`ALCODecision` event).

**Step 3 — Tier 2 plan activation.** On ALCO quorum, Eitan activates the Tier 2 CFP. Activation is an `ALCODecision { decisionType: "cfp-tier-2-activated", cfpTier: "tier-2", triggerId }` event. Eitan and Saskia execute the Tier 2 funding-source sequence from `docs/treasurer/cfp-funding-source-inventory.md`:
1. T2.1 — Asset-sale or HQLA repo (ordered: Level 1 → Level 2A → Level 2B).
2. T2.2 — Correspondent facility drawdown (**W2.1 blocked if no correspondent in place**).
3. T2.3 — Withdrawal of interbank placements (shortest tenor first).
4. T2.4 — Term repo against bond collateral (overnight).
5. T2.5 — Curtailment of new lending and investment.

Helena (CRO) must sign off on any ALCO decision that operates outside the standing RAS liquidity appetite (`D-RAS`). Helena's sign-off is an `AgentDecision { decisionType: "cfp-tier-2-cro-signoff" }` event.

**Step 4 — CEO notification.** Eitan notifies CEO (Marc) within the same business day as Tier 2 activation. The CEO notification is a typed event (`AgentEscalation { tier: "tier-2", to: "CEO" }`).

**Step 5 — BRC / PA notification.** Owen (Company Secretary, governance) notifies the BRC at the next meeting (or same day if the breach persists ≥ 3 business days). PA notification follows Reg 26 notification obligations if the LCR or NSFR is at the Warning breach level per §9.1.

**Step 6 — Daily monitoring.** While Tier 2 is active, Ravi runs the EWI monitor twice daily (09:00 and 14:00 SA time). ALCO is updated with the daily ratio position. Helena monitors the RAS appetite status.

**Step 7 — Closure or escalation.** If the LCR / NSFR restores above the internal floor for 3 consecutive business days (`LiquidityBreachResolved` event), Eitan declares Tier 2 closed to ALCO. If the stress deepens and any Tier 3 trigger fires, proceed immediately to Step 8 (Tier 3).

---

## 8. Steps — Tier 3: Escalation (Survival / Systemic Stress)

**Step 1 — Trigger event.** `ravi:cfp-ewi-monitor` emits one of the Tier-3 triggers. All Tier 3 triggers bypass the 4-hour ALCO window — **CEO is activated immediately**.

**Step 2 — CEO activation.** Eitan escalates to CEO (Marc) within **30 minutes** of the trigger event. The CEO activation is a typed `AgentEscalation { tier: "tier-3", to: "CEO", urgency: "immediate" }` event. CEO may override or augment the Tier 3 response — this is a Board-reserved and PA-notification-level event.

**Step 3 — Board notification.** Owen (Company Secretary, governance) notifies the Board (or Interim Board / BRC) within **24 hours** of Tier 3 activation.

**Step 4 — PA notification.** Owen and Zara (Chief Compliance Officer, governance) prepare and dispatch the PA written notification under LRM Policy v1 §9.4 (PA Directive 1 of 2022 §4.1.6 + Reg 5) if the LCR or NSFR has breached the PA regulatory minimum (100%). Notification must be sent "as soon as practicable" — same day as breach detection. A `LcrDirectiveNonCompliance { requirementRef, description, asOf, detectedBy }` event is raised.

**Step 5 — Recovery Plan.** Helena (Chief Risk Officer, governance) activates the Recovery Plan assessment per the ICAAP/ILAAP/Recovery framework §3.3.5. Helena and Camille (CFO) present the recovery options inventory to CEO and Board.

**Step 6 — Tier 3 funding-source execution.** Eitan and CEO execute the Tier 3 CFP from `docs/treasurer/cfp-funding-source-inventory.md`:
- All Tier 1 and Tier 2 measures at maximum scale.
- T3.1 — Emergency SARB liquidity support (CEO engages PA).
- T3.2 — Capital raise / subordinated debt (Board authority required).
- T3.3 — Balance-sheet restructuring / accelerated wind-down (CEO + Board approval).

**Step 7 — Post-mortem.** For every Tier 3 activation, Eitan and Helena produce a post-mortem brief filed as a `RecordFiled` event within 10 business days. The post-mortem identifies whether the breach reflects a policy gap, a process failure, or an external market condition.

---

## 9. Annual CFP Rehearsal

Per LRM Policy v1 §5.4, the CFP is rehearsed annually. The rehearsal is executed by Ravi using the CFP rehearsal harness (`prototype/platform/alm/cfp-rehearsal-harness.ts`).

### 9.1 Rehearsal Scope

1. **Scenario coverage.** Each rehearsal covers at minimum:
   - (a) A bank-specific stress (e.g. sudden loss of major counterparty funding line).
   - (b) A market-wide stress (e.g. ZAR liquidity dislocation / SA sovereign-spread widening event).
2. **Time horizon.** 30-day stress horizon; Tier 3 survival scenario at least once every three years.
3. **Funding-source availability check.** For each Tier 2 source, confirm: repo capacity, interbank withdrawal lead time, wholesale-market access signal. W2.1 blocker status assessed and documented.
4. **Escalation drill.** ALCO escalation sequence simulated through the rehearsal.

### 9.2 Harness Execution

```bash
# From prototype/
bun run cfp:rehearse --dry-run
```

The harness:
1. Validates `docs/treasurer/cfp-funding-source-inventory.md` exists.
2. Fires all 7 typed CFP trigger events in sequence (dry-run mode — no real store writes).
3. Logs the trigger sequence, tiers exercised, and inventory coverage (TBD entries = open findings).
4. Emits a `RehearsalEvidenceCollected` event with the rehearsal summary.

### 9.3 Evidence Standard

Per LRM Policy v1 §5.4, the rehearsal is evidenced by:

1. **`RehearsalEvidenceCollected`** event in the event store — emitted by the rehearsal harness with payload: `{ rehearsalDate, tiersExercised, triggersFired, inventoryCoveragePct, openFindings, dryRun }`.
2. **Rehearsal brief** filed as a `RecordFiled` event by Eitan within 5 business days of the rehearsal — the brief documents scenario coverage, funding-source availability findings, escalation-drill results, and any remediation items.
3. **Remediation items** tracked to closure in the risk-management action-item register.

### 9.4 PA Participation Year

In years when the PA conducts its externally-facilitated liquidity stress simulation (PA D4/2021 / `ORG-PR-38`), Hoz Bank's participation satisfies the market-wide stress requirement. Eitan registers for the PA simulation; simulation findings are incorporated into the ILAAP narrative.

---

## 10. System Capabilities

| Capability | Module | Status |
|---|---|---|
| CFP EWI engine | `prototype/platform/alm/cfp-ewi.ts` | LIVE — `ravi:cfp-ewi-monitor` handler |
| CFP trigger event types | `prototype/platform/event-store/event-types/cfp-triggers.ts` | LIVE — 7 trigger types + `RehearsalEvidenceCollected` |
| CFP rehearsal harness | `prototype/platform/alm/cfp-rehearsal-harness.ts` | LIVE — `bun run cfp:rehearse` |
| Funding-source inventory | `docs/treasurer/cfp-funding-source-inventory.md` | LIVE |
| RAS appetite register | `prototype/platform/risk/ras-appetite-register.ts` | LIVE — `appetite:liquidity:intraday` line |
| LCR/NSFR projection | `prototype/platform/liquidity/` | LIVE — `anya:liquidity-projection` handler |
| Intraday metrics | `prototype/platform/alm/intraday-liquidity-metrics.ts` | LIVE — `ravi:intraday-liquidity-metrics` handler |

---

## 11. Substrate Gaps

| Gap | Description | Status |
|---|---|---|
| External credit-event live feed | `ExternalCreditEventDetected` — licence-day feed wiring (rating-agency / market-spread watch). Currently injectable input only; no live external feed. | OPEN — licence-day |
| Recovery Plan EWI substrate | `RecoveryEarlyWarningTriggered` — Helena's Recovery Plan indicator substrate not yet live. Currently injectable. | OPEN — W2 scope |
| Correspondent facility | T2.2 in the funding-source inventory — W2.1 externally blocked; counterparty TBD. | OPEN — externally blocked |

---

## 12. Change Log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-06-11 | Eitan (Treasurer, governance) | Initial procedure. Three tier sections (automatic / governance / escalation); annual rehearsal standard (harness, evidence pack, PA participation); system-capabilities table; substrate-gaps section. Authority: D-TREASURER-WAVE2-SUBSTRATE. |
