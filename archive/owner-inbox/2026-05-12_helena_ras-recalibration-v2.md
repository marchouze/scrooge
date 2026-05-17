---
title: "Risk Appetite Statement — Recalibration v2"
author: Helena (Chief Risk Officer, governance)
date: 2026-05-12
decision-required: false
supersedes: "Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md — all appetite line figures"
authority: D-MARKETS-CAPITAL-TIME-SHAPE
citations:
  - "[citation: D-MARKETS-CAPITAL-TIME-SHAPE]"
  - "[citation: Owner Inbox/2026-05-12_helena_icaap-ilaap-paper-v1.md]"
  - "[citation: RRTB Regulation 38 — ICAAP]"
  - "[citation: RRTB Chapter 13 — Market Risk Standardised Approach]"
---

# Risk Appetite Statement — Recalibration v2

**Author:** Helena (Chief Risk Officer, governance)
**Date:** 2026-05-12
**Authority:** D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
**Supersedes:** All quantitative appetite-line figures in `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`
**Companion documents:**
- ICAAP/ILAAP Paper v1: `Owner Inbox/2026-05-12_helena_icaap-ilaap-paper-v1.md`
- Capital Plan: `Owner Inbox/2026-05-12_camille_capital-plan-d-markets-capital-time-shape.md`
- Franchise Design v2: `Owner Inbox/2026-05-12_saskia_franchise-design-proposal-update-v2.md`
- RAS/RAF v1: `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`

> **Scope of this document.** This is a **delta document**. It supersedes the quantitative appetite-line figures in the v1 RAS/RAF. The v1 RAS framework — its structure, risk cluster definitions, entity scope (§A4), entity-level vs consolidated-basis framing (§B14), B-cluster FX concentration lines (§B8a), governance arrangements (§B12–§B13), and all qualitative appetite statements in Part A — remains fully in force. Only the quantitative appetite lines that appeared as TBD or working estimates in v1 are replaced here. Every line below is ICAAP-validated against confirmed capital figures locked under D-MARKETS-CAPITAL-TIME-SHAPE (2026-05-12).

---

## Section 1 — Purpose of this recalibration

### 1.1 Why v2 exists

The v1 RAS was authored on 2026-05-06, before two enabling inputs were available: (a) a locked capital time-shape decision, and (b) a completed ICAAP/ILAAP paper run. Consequently, the quantitative appetite lines in v1 were either set as TBD placeholders or calibrated against working estimates that had not been confirmed by the relevant governance process. They were correct as governance structure but incomplete as operational limits.

Two events on 2026-05-12 close that gap:

1. **D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)** locked the capital envelope: R150m trading-book backing, ~R125m ILAAP liquidity buffer, ~R25m operational buffer, total ~R300m at licence-day. Camille (CFO, finance)'s capital plan (`Owner Inbox/2026-05-12_camille_capital-plan-d-markets-capital-time-shape.md`) records the confirmed figures.

2. **ICAAP/ILAAP Paper v1 (Helena, 2026-05-12)** completed the first paper run of the Internal Capital Adequacy Assessment Process and Internal Liquidity Adequacy Assessment Process against the confirmed capital time-shape. Key outputs: Pillar 1 minimum capital R5.9m (RWA R73.75m); total Pillar 2A add-ons R27.825m; Total Internal Capital Requirement R36.675m; capital headroom R263.325m (87.8% of R300m envelope); LCR under 30-day combined stress 357%; NSFR structural check 2,182%.

This recalibration replaces every TBD and working-estimate figure in the v1 RAS with ICAAP-validated numbers. The v1 governance framework, risk cluster structure, and qualitative appetite statements are unchanged and remain in force. `[citation: Owner Inbox/2026-05-12_helena_icaap-ilaap-paper-v1.md]` `[citation: D-MARKETS-CAPITAL-TIME-SHAPE]`

### 1.2 Build-phase provenance note

All figures in this recalibration are **sizing estimates for regulatory preparation**, not figures derived from live portfolio positions or historical observations. No real capital exists in the build phase; no live trading positions exist; no clients are active. The R300m envelope is a target for licence-day (project_ai_driven_bank). The appetite lines are calibrated to the confirmed franchise-design scale and will be re-run in the first annual ICAAP/ILAAP cycle after commencement of trading. `[citation: RRTB Regulation 38 — ICAAP]`

---

## Section 2 — Capital adequacy appetite (replaces v1 §B3 / capital cluster)

*`riskTaxonomy: RT-CR.OB`*

### 2.1 ICAAP-validated capital appetite lines

The following lines replace all capital-adequacy appetite lines in v1 §B3 that were TBD or expressed as "+pp above minimum" without a confirmed denominator.

| Appetite line | v1 (working estimate) | v2 (ICAAP-validated) | Source |
|---|---|---|---|
| Minimum Pillar 1 capital charge | TBD | R5,900,000 (RWA R73,750,000) | ICAAP v1 §2.4 `[citation: Owner Inbox/2026-05-12_helena_icaap-ilaap-paper-v1.md]` |
| Total Pillar 2A add-ons | TBD | R27,825,000 | ICAAP v1 §3.2 `[citation: Owner Inbox/2026-05-12_helena_icaap-ilaap-paper-v1.md]` |
| RAS B2 management buffer (1.5pp × RWA) | 1.5pp above Pillar 1 + buffers | R1,106,250 (1.5% × R73.75m) | ICAAP v1 §3.2 |
| Capital Conservation Buffer | 2.5% × RWA | R1,843,750 (2.5% × R73.75m) | ICAAP v1 §3.2; BCBS Basel III |
| **Total Internal Capital Requirement (Pillar 1 + P2A + B2 buffer + CCB)** | TBD | **R36,675,000** | ICAAP v1 §3.2 |
| Capital headroom (current, build phase) | TBD | R263,325,000 (87.8% of R300m) | ICAAP v1 §3.3 |
| Capital headroom floor (internal tolerance) | TBD | **≥ R100m vs R300m envelope** | Helena judgement — 33% floor |
| CET1 ratio at franchise-design scale | TBD | ~407% (R300m / R73.75m RWA) | ICAAP v1 §3.3 |
| Trigger for CEO escalation (capital) | TBD | Headroom < R100m | Helena judgement |
| Trigger for Board notification (capital) | TBD | Headroom < R50m | Helena judgement |

### 2.2 Escalation logic

The escalation triggers above operate as follows:

- **Headroom ≥ R100m:** Normal operating condition. No escalation. Monthly BRC monitoring.
- **Headroom < R100m (≥ R50m):** Amber — immediate CEO notification. CRO (Helena) and CFO (Camille) present remediation plan to BRC within 5 working days. Capital plan reviewed.
- **Headroom < R50m:** Red — immediate Board notification. CEO and CFO present to Board within 3 working days. Recovery option LA1/LA2 readiness assessed per Recovery Plan §5.3.
- **Headroom < Total Internal Capital Requirement (R36.7m):** Critical — PA consultation initiated. Recovery Plan activated. CEO, CRO, CFO joint escalation.

At franchise-design scale (R263.3m headroom), the bank is in normal operating condition with substantial buffer before any trigger fires. The triggers are set conservatively to allow ample reaction time as the franchise grows and RWA increases.

### 2.3 Forward trajectory

As the trading franchise grows and RWA increases from the initial franchise-design load (R73.75m), the appetite lines will compress. The ICAAP sensitivity analysis (v1 §2.1.3) shows that even under the upside scenario (FX net open position R200m, IRS net notional R200m), total market risk charge reaches approximately R34m — reducing headroom to approximately R229m (76.3% of R300m). This remains above the R100m floor trigger. A new capital time-shape decision will be required only if the franchise grows materially beyond the sensitivity scenario or if product expansion (NPA route) adds new Pillar 1 or Pillar 2A charges. `[citation: RRTB Chapter 13 — Market Risk Standardised Approach]`

---

## Section 3 — Liquidity appetite (replaces v1 §B3 / §B14.2 liquidity cluster)

*`riskTaxonomy: RT-LQ.FN`*

### 3.1 ICAAP/ILAAP-validated liquidity appetite lines

The following lines replace all liquidity appetite lines in v1 §B3 that were expressed as "+pp above PA minimum" without a confirmed denominator, and add the ILAAP-confirmed absolute buffer figure.

| Appetite line | v1 | v2 | Source |
|---|---|---|---|
| LCR minimum (internal buffer) | PA minimum + 20pp (= 120%) | **150%** (PA minimum 100%; internal buffer 50pp) | ICAAP v1 §4.1; Helena judgement — 50pp internal buffer provides resilience above the RAS B3 20pp floor |
| LCR stress floor (30-day combined scenario) | TBD | **120%** (confirmed 357% under combined stress; floor set at 120% to allow operating headroom above PA minimum) | ICAAP v1 §4.1 `[citation: Owner Inbox/2026-05-12_helena_icaap-ilaap-paper-v1.md]` |
| LCR management trigger | PA minimum + 10pp (= 110%) | **130%** (consistent with 50pp internal buffer; trigger at 30pp above PA minimum) | Helena judgement — recalibrated to reflect the higher internal buffer |
| LCR mandatory BRC escalation | PA minimum + 5pp (= 105%) | **110%** (PA minimum + 10pp; below this, the bank is approaching the PA minimum) | Helena judgement |
| ILAAP buffer (absolute) | TBD (working estimate) | **R125,000,000** | D-MARKETS-CAPITAL-TIME-SHAPE; ICAAP v1 §4.3 (confirmed) |
| HQLA composition (Level 1 floor) | TBD | ≥ 80% Level 1 (SA government securities / SARB deposit claims) | ICAAP v1 §4.1; Level 2A capped at 40% per LCR rules |
| LCR under 30-day combined stress (observed) | TBD | 357% (net stressed outflows R34m vs HQLA R121.25m post-haircut) | ICAAP v1 §4.1 |
| NSFR target (internal) | PA minimum + 15pp (= 115%) | **115%** — confirmed appropriate; NSFR structural check 2,182% at franchise-design scale | ICAAP v1 §4.2 |
| NSFR trigger | PA minimum + 8pp (= 108%) | **108%** — unchanged | v1 §B3 |
| NSFR BRC escalation | PA minimum + 3pp (= 103%) | **103%** — unchanged | v1 §B3 |
| Trigger for liquidity alert to ALCO | TBD | LCR < 130% | Helena judgement |
| Trigger for CEO escalation (liquidity) | TBD | LCR < 110% | Helena judgement |

### 3.2 ILAAP buffer confirmation

The R125m ILAAP liquidity buffer confirmed under D-MARKETS-CAPITAL-TIME-SHAPE is validated as sufficient by the ICAAP v1 §4 analysis. The HQLA pool of R121.25m (post-haircut: R100m Level 1 + R21.25m Level 2A post-15% haircut) produces a 30-day combined stress LCR of 357% — well above both the PA minimum (100%) and the internal buffer target (150%). Net liquidity surplus at Day 30 under the combined stress: R87.25m. `[citation: Owner Inbox/2026-05-12_helena_icaap-ilaap-paper-v1.md]`

Under a more severe sensitivity (repo-line collapse plus CCP emergency margin), net outflows at Day 30 would be approximately R68m, leaving residual HQLA of R53.25m (LCR ~178% — still above PA minimum and trigger threshold). Only under an extreme scenario (50% Level 2A haircut, full CCP collateral recall, full repo-line collapse simultaneously) would the buffer approach adequacy; Recovery EWI Q3/Q4 would activate before Day 30 in that scenario.

No adjustment to the R125m ILAAP figure is required. Camille (CFO, finance) may treat R125m as confirmed for capital plan §4 and §7. `[citation: D-MARKETS-CAPITAL-TIME-SHAPE]`

---

## Section 4 — Market risk appetite (replaces v1 §B4 / §A2 market risk cluster)

*`riskTaxonomy: RT-MK`*

### 4.1 ICAAP-calibrated market risk appetite lines

Using the confirmed Standardised Approach Pillar 1 charge (R5.9m) and the approved trading-book capital (R150m) as the sizing basis:

| Appetite line | v2 figure | Rationale |
|---|---|---|
| Maximum Pillar 1 market risk charge (steady-state) | R15,000,000 (10% of R150m trading book) | Leaves R135m headroom vs the R150m envelope; consistent with a new-entrant franchise in early build-up; headroom for RWA growth without approaching the envelope ceiling |
| Maximum Pillar 1 market risk charge (stressed growth) | R34,000,000 (~23% of R150m) | Helena sensitivity scenario upper bound (FX R200m net, IRS R200m net at 5–10yr bucket); still within envelope |
| VaR limit (99% 1-day, when internal model approved) | R500,000 | ~3% of Pillar 1 charge at target franchise scale; sized for early franchise build-up before IMA approval; reviewed monthly until stable |
| Stress VaR trigger | R1,500,000 | 3× VaR; triggers risk-appetite review by Helena + Rohan (Risk engineer) |
| Stress VaR mandatory BRC escalation | R3,000,000 | 6× VaR; mandatory BRC action |
| FX net open position limit (steady-state) | R80,000,000 | 2× the franchise-design sizing (R40m); provides operating room for day-end inventory; calibrated to maintain Pillar 1 FX charge ≤ R6.4m (8% × R80m) |
| IRS net notional limit (5–10yr bucket) | R75,000,000 | 1.5× the franchise-design sizing; calibrated to maintain IRS Pillar 1 charge within Pillar 1 envelope |
| Single-counterparty FX concentration limit | R37,500,000 (30% of ILAAP buffer R125m) | Per D-RAS-B-CLUSTER-CONCENTRATION-LINES framing; limits operational concentration on any single FX counterparty |
| Single-tenor IRS concentration limit | R37,500,000 (25% of trading-book capital R150m) | Helena judgement; prevents single-tenor cliff-risk in the IRS book |

### 4.2 VaR model note

Hoz Bank Limited does not have an approved Internal Models Approach (IMA) at licence-day. The VaR limit above is a **forward-planning appetite line** that will become operational when Rohan (Risk engineer) builds the VaR engine and Nadia's model validation function approves it as a Tier-1 model. Until IMA approval, the Standardised Approach limits (Pillar 1 charge ceiling, FX net open position, IRS net notional) are the binding operational controls. The VaR line is set now so it is codified before the model is live, not calibrated reactively after go-live. Model risk for the VaR engine: Tier-1 per RAS §B7 — independent validation required before the limit becomes binding. `[citation: RRTB Chapter 13 — Market Risk Standardised Approach]`

---

## Section 5 — AI-agent operating risk appetite (new cluster — not in v1)

*`riskTaxonomy: RT-OP` (agent-operations sub-cluster; sub-classification `RT-OP.AG` pending risk taxonomy update by Rohan)*

### 5.1 Rationale for a new cluster

The v1 RAS was authored before the AI-driven operating posture was fully operational. The bank's labour force is autonomous AI agents; every risk governance function, every trade decision pathway, and every regulatory-reporting output involves an agent as the primary actor. This is a qualitatively different risk profile from a conventional bank and requires an explicit appetite cluster. The ICAAP v1 §3.1 (Operational risk — AI-agent operating risk) and §5.1–5.2 (PA supervisory dialogue on model risk and Anthropic API dependency) confirm the materiality of this risk dimension. `[citation: Owner Inbox/2026-05-12_helena_icaap-ilaap-paper-v1.md]`

### 5.2 AI-agent operating risk appetite lines

| Appetite line | v2 figure | Rationale |
|---|---|---|
| Maximum agent dispatches without CEO event-log confirmation | 0 | Principle 1 — every dispatch is a typed event; undocumented dispatches are a control deficiency |
| Maximum open Scrooge escalations unresolved > 24h (agent cadence) | 2 | Beyond 2 unresolved escalations, Scrooge (Chief of Staff) escalates to CEO for direct resolution |
| Maximum Vera P1 findings unresolved > 3 agent runs | 0 | P1 findings are material control deficiencies; zero tolerance is the RAS floor for Vera's highest severity |
| Acceptable substrate-gap count (non-P1) | ≤ 10 | Above 10 open non-P1 substrate gaps, Atlas (Core banking platform architect, engineering) and Anya (Data / analytics engineer) prioritise expedited closure |
| Maximum Anthropic API downtime before manual incident declaration | 4 hours | Per ICAAP v1 §3.1 Scenario S1; trigger for Devon (COO, operations) manual incident playbook |
| Maximum agent decisioning events without event-log write confirmation | 0 | Principle 1 — agent actions that do not produce a typed event are not auditable |
| Maximum model-risk Tier-1 deployments without independent validation sign-off | 0 | RAS §B7 Tier-1 models require independent validation (Nadia) before deployment; zero tolerance for unvalidated Tier-1 deployment |
| Maximum unresolved ICAAP/ILAAP action items (post-SREP) > 60 agent-run days | 0 | Post-SREP follow-ups bind at commencement of trading; all must be closed before the pre-licence readiness gate lights green |

### 5.3 Substrate gap

The `RT-OP.AG` risk taxonomy sub-classification does not yet exist in `Regulations/_risk-taxonomy.md`. Rohan (Risk engineer) to add `RT-OP.AG` (AI-agent operating risk) as a level-3 node under `RT-OP` at the next risk-taxonomy cadence run. Until then, these lines are tagged `RT-OP` at level 1. Vera (Internal audit / continuous-assurance engineer) to flag as an observation (not a P1 finding) until the taxonomy update lands.

---

## Section 6 — Concentration risk — B-cluster review in light of ICAAP headroom

*`riskTaxonomy: RT-OP.PA`*

### 6.1 B-cluster lines confirmed in force

The FX-settlement correspondent-bank concentration lines (L-B8a-1 through L-B8a-5) established under D-RAS-B-CLUSTER-CONCENTRATION-LINES (CEO ratified 2026-05-09; record `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-ras-b-cluster-concentration-lines.md` / PR #67) and recorded in v1 §B8a remain **fully in force**. No change to the numerical lines is required following the ICAAP review.

For reference:

| Line | Threshold (steady-state) | Threshold (switch-test window) | Severity at breach |
|---|---|---|---|
| L-B8a-1: Single-counterparty intraday FX-settlement notional | ≤ 97% | ≤ 99% | Hard |
| L-B8a-2: Top-2 cumulative intraday FX-settlement notional | ≤ 100% by design (observational) | ≤ 100% | Structural (drift below 100% = Critical) |
| L-B8a-3: Switch-test window override | n/a | Window-bounded | n/a |
| L-B8a-4: Backup-readiness (FirstRand-RMB) — last successful switch-test | ≤ 100 days | n/a | Hard |
| L-B8a-5: Reserve-correspondents contract-status | Active-but-dormant | n/a | Soft |

### 6.2 ICAAP headroom context — do lines need tightening or loosening?

The ICAAP v1 §3.1 (Concentration risk — Pillar 2A add-on) sized the FX correspondent concentration risk at R2m (R40m net open FX position × 5% loss-given-failure haircut on un-settled positions). Against the R263.3m capital headroom, this is a small charge. Does this argue for loosening the B-cluster lines?

**Helena's conclusion: No.** The B-cluster lines are not set at the level of expected loss — they are set at the level of the **structural operating-model design**. The 97% single-counterparty cap and 100% top-2 cap codify the named-pair posture (one primary, one backup, two reserves). Loosening these lines would signal a willingness to drift from the named-pair design — which is not the intent. The purpose of the lines is to detect drift, not to constrain it at a level that admits a third unsanctioned correspondent. The capital headroom is generous enough that the small Pillar 2A add-on (R2m) is well within tolerance; this is not an argument for relaxing the operational discipline that the lines enforce.

**Does the headroom argue for tightening?** Also no. The L-B8a-1 line at 97% already reflects the fact that the primary correspondent will carry ~95% of flow in normal operation; a tight line (e.g., 90%) would fire false-positive alerts in normal conditions. The current calibration (97% steady-state / 99% switch-test) is fit for purpose at the named-pair operating scale.

**Confirmation:** The B-cluster lines are confirmed appropriate in light of the R263.3m ICAAP headroom. No numerical changes. Review cadence as per v1 §B8a: at every BRC tick alongside §B8; in-flight after any `SwitchTestReport` Tomas (under Devon) files; and re-calibrated if D-FX-CORRESPONDENT-PAIR-NAMING is revisited. `[citation: D-MARKETS-CAPITAL-TIME-SHAPE]` `[citation: Owner Inbox/2026-05-12_helena_icaap-ilaap-paper-v1.md]`

### 6.3 IRS counterparty concentration — v2 line

The ICAAP v1 §3.1 sized a Pillar 2A add-on of R1.5m for IRS counterparty concentration. This is now expressed as a standing appetite line (not previously in v1):

| Appetite line | v2 figure | Rationale |
|---|---|---|
| Single IRS counterparty as % of net notional book | ≤ 40% of net IRS notional | Prevents cliff-risk if a key institutional counterparty withdraws; consistent with 3–5 institutional counterparties at licence-day scale |
| Trigger for counterparty concentration review | > 35% in any single IRS counterparty | Early-warning trigger; Rohan to monitor; Helena review within 5 working days |

---

## Section 7 — RAS governance (unchanged from v1 — confirmed in force)

*`riskTaxonomy: RT-ST.GV`*

The governance arrangements for the RAS/RAF as set out in v1 §B12 remain fully in force and are confirmed unchanged by this recalibration. Specifically: Helena (Chief Risk Officer, governance) owns the RAS/RAF as a policy artefact; Owen (Company Secretary, governance) runs the Board approval pathway; Mira (Compliance / RegTech engineer) ensures every appetite line and limit is register-linked; Vera (Internal audit / continuous-assurance engineer) audits the framework's effectiveness independently. The RAS/RAF review cadence (§B10) is unchanged: annual board approval; ad-hoc updates on material change (new product, new entity, new jurisdiction, material loss, regulatory change); each update is a versioned event with a register citation. This v2 document is itself such an update — it is triggered by the confirmed capital figures under D-MARKETS-CAPITAL-TIME-SHAPE and the completion of the first ICAAP paper run, both of which constitute "material change" for RAS purposes (capital figures moving from TBD to confirmed).

---

## Section 8 — Pillar 2A add-on summary (cross-reference table)

*`riskTaxonomy: RT-CR` (capital adequacy cross-reference)*

The following table reproduces the Pillar 2A add-on breakdown from ICAAP v1 §3.2 for cross-referencing purposes. The RAS and ICAAP are linked here so readers of either document can navigate to the other without the RAS appetite lines floating free of their derivation. The ICAAP v1 is the authoritative source for the methodology; this table is a reference render. `[citation: Owner Inbox/2026-05-12_helena_icaap-ilaap-paper-v1.md]`

| Risk type | Pillar 2A add-on | Risk taxonomy node | ICAAP v1 reference |
|---|---|---|---|
| Market risk (basis / correlation / SA-to-IMA uplift) | R3,400,000 | `RT-MK` | ICAAP v1 §3.1 Market risk |
| Liquidity risk (distressed HQLA mark-to-market tail) | R3,125,000 | `RT-LQ.FN` | ICAAP v1 §3.1 Liquidity risk |
| Operational risk (scenario-based — AI/API dependency) | R10,200,000 | `RT-OP` | ICAAP v1 §3.1 Operational risk |
| Concentration risk (FX correspondent + IRS counterparty) | R3,500,000 | `RT-OP.PA` + `RT-CR.CC` | ICAAP v1 §3.1 Concentration risk |
| Legal / compliance risk | R2,000,000 | `RT-LR` | ICAAP v1 §3.1 Legal / compliance |
| Reputational risk | R1,000,000 | `RT-RP` | ICAAP v1 §3.1 Reputational risk |
| Cyber / AI risk | R4,600,000 | `RT-OP.CY` | ICAAP v1 §3.1 Cyber / AI risk |
| **Total Pillar 2A add-ons** | **R27,825,000** | | |
| Pillar 1 minimum capital charge | R5,900,000 | | ICAAP v1 §2.4 |
| RAS B2 management buffer (1.5% × RWA R73.75m) | R1,106,250 | | ICAAP v1 §3.2 |
| Capital Conservation Buffer (2.5% × RWA R73.75m) | R1,843,750 | | ICAAP v1 §3.2 |
| **Total Internal Capital Requirement** | **R36,675,000** | | ICAAP v1 §3.2 |
| Capital headroom vs R300m envelope | R263,325,000 (87.8%) | | ICAAP v1 §3.3 |

### 8.1 Operational risk Pillar 2A — build-phase vs licence-day note

The operational risk Pillar 2A add-on (R10.2m) is calibrated on a scenario basis because the BIA produces zero at build phase (nil gross income). This add-on will be reassessed in the first annual ICAAP cycle after commencement of trading, when actual gross income data becomes available. At modest initial revenue levels, the BIA charge will remain below the R10.2m scenario-based add-on, confirming the scenario basis is conservative and appropriate as a Pillar 2A floor. Helena will include this as a proactive disclosure in the PA pre-application dialogue per ICAAP v1 §5.2.

### 8.2 Cyber / AI risk — PA supervisory dialogue flag

The R4.6m cyber/AI Pillar 2A add-on reflects a Tier-3 cyber incident scenario (RAS §B6). Given the PA's expected scrutiny of the AI-driven operating posture, Helena has recommended proactive disclosure of the Anthropic API resilience framework and the model risk governance framework before the SREP (ICAAP v1 §5.1–5.2). The appetite line at Section 5 of this document (AI-agent operating risk cluster) complements the Pillar 2A quantification by setting the governance limits that contain and detect the risk, not merely the capital charge that absorbs it if it fires.

---

## Summary of changes vs v1

| Section | Change type | Change summary |
|---|---|---|
| §B3 capital cluster | Quantitative update | All TBD and "+pp above minimum" lines replaced with ICAAP-validated figures |
| §B3 liquidity cluster | Quantitative update | LCR internal buffer raised to 150% (was 120%); trigger recalibrated to 130%; ILAAP R125m confirmed |
| §B4 market risk cluster | Quantitative update + new lines | Pillar 1 charge ceiling; VaR limit; stress VaR; FX and IRS notional limits; concentration limits |
| §B8a B-cluster concentration | Confirmed unchanged | Lines L-B8a-1..5 confirmed in force; no numerical changes |
| AI-agent operating risk | New cluster | Eight appetite lines for AI-agent operations — not in v1 |
| Pillar 2A cross-reference | New reference table | Section 8 provides a cross-reference table to ICAAP v1 in the RAS artefact |
| Governance (§B12) | Confirmed unchanged | All governance arrangements as per v1 |

---

*Helena (Chief Risk Officer, governance) — 2026-05-12*
*Authority: D-MARKETS-CAPITAL-TIME-SHAPE*
*This document supersedes all quantitative appetite-line figures in `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`. The v1 framework structure remains in force.*
*Build phase: all figures are sizing estimates for regulatory preparation. Obligations bind at commencement of trading.*
