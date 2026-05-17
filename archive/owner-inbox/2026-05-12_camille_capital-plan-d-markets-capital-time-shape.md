---
author: Camille
date: 2026-05-12
decision-required: false
authority: D-MARKETS-CAPITAL-TIME-SHAPE
title: CFO Capital Plan — Approved Capital Time-Shape
---

# CFO Capital Plan — Approved Capital Time-Shape

**Author:** Camille (CFO, finance)
**Date:** 2026-05-12
**Authority:** D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
**Routing brief:** `Team Inbox/2026-05-12_scrooge_camille_capital-time-shape-approved.md`

---

## 1. Approved Capital Time-Shape

The following figures are approved under CEO Decision D-MARKETS-CAPITAL-TIME-SHAPE (2026-05-12).
These supersede all prior working estimates.

| Bucket | Approved Amount | Phase |
|---|---|---|
| Build CapEx | R5m total over build phase | Build phase |
| OpEx — people | R20m / year run-rate | Build phase → ongoing |
| Capital backing trading book at go-live | R150m | Licence-day |
| Liquidity buffer / ILAAP (balance) | ~R125m | Licence-day |
| **Total capital envelope (target at licence-day)** | **~R300m** | Licence-day |

The R300m total capital envelope is the sum of the trading-book backing (R150m) plus the ILAAP liquidity buffer (~R125m) plus a residual operational capital buffer (~R25m). The build-phase CapEx and OpEx draws are funded from founder / pre-licence capital facilities and do not reduce the licence-day target — the R300m is a raise-at-licence-day target, not a present balance.

---

## 2. Build-Phase Cash-Flow Projection

### 2.1 Assumptions

| Parameter | Value | Basis |
|---|---|---|
| Build CapEx envelope | R5,000,000 | D-MARKETS-CAPITAL-TIME-SHAPE |
| OpEx people run-rate | R20,000,000 / year | D-MARKETS-CAPITAL-TIME-SHAPE |
| OpEx per month | R1,666,667 | R20m ÷ 12 |
| Build-phase start | 2026-05-12 (this run) | Operational |
| Primary cost: Anthropic API | Real, billed monthly | project_ai_driven_bank |
| Capital already deployed | R0 (build phase) | No real capital pre-licence |
| CapEx draw-down profile | Ratable over build phase | Conservative |

### 2.2 CapEx Draw-Down Schedule (R5m envelope)

CapEx covers engineering infrastructure, tooling licences, Azure local-dev spend, and compliance tooling procured before licence-day. Draw-down is projected on a ratable basis across the build phase; actual draw-down will accelerate if Azure migration commences early.

| Build Month | Cumulative CapEx Drawn | Balance Remaining |
|---|---|---|
| Month 1  | R208,333  | R4,791,667 |
| Month 3  | R625,000  | R4,375,000 |
| Month 6  | R1,250,000 | R3,750,000 |
| Month 12 | R2,500,000 | R2,500,000 |
| Month 18 | R3,750,000 | R1,250,000 |
| Month 24 | R5,000,000 | R0 (envelope exhausted) |

Monthly CapEx rate: R5,000,000 ÷ 24 months = **R208,333 / month** (ratable basis).

### 2.3 OpEx Burn (People) — Monthly Profile

| Build Month | Monthly OpEx | Cumulative OpEx | Combined Burn (CapEx + OpEx) |
|---|---|---|---|
| Month 1  | R1,666,667 | R1,666,667  | R1,875,000 |
| Month 3  | R1,666,667 | R5,000,000  | R5,625,000 |
| Month 6  | R1,666,667 | R10,000,000 | R11,250,000 |
| Month 12 | R1,666,667 | R20,000,000 | R22,500,000 |
| Month 18 | R1,666,667 | R30,000,000 | R33,750,000 |
| Month 24 | R1,666,667 | R40,000,000 | R45,000,000 |

**Combined monthly burn rate: R1,875,000 / month** (CapEx R208,333 + OpEx R1,666,667).

**Annual combined burn: R22,500,000 / year.**

---

## 3. Runway Calculation

### 3.1 Definition

"Runway to licence-application" is the point at which a licence application is ready to be submitted to SARB/PA. This is driven by the pre-licence go-live readiness gate (Saskia's substrate) reaching green — not by capital exhaustion. The capital runway calculation below is therefore a constraint check, not a planning driver.

### 3.2 Pre-Licence Facility Assumption

Build-phase funding (CapEx + OpEx) is drawn from a pre-licence capital facility. Assumed facility size: **R50m** (working assumption; Marc to confirm at licence-application financing round). This is separate from the R300m licence-day capital raise.

| Metric | Value |
|---|---|
| Pre-licence facility (assumed) | R50,000,000 |
| Combined monthly burn | R1,875,000 |
| **Runway (months to facility exhaustion)** | **~26.7 months** |
| **Runway (years)** | **~2.2 years** |

### 3.3 Capital Position at Licence-Application

Assuming licence-application targets **month 18** of the build phase (working estimate; substrate-gate-driven):

| Item | Amount |
|---|---|
| Pre-licence facility drawn (month 18) | (R33,750,000) |
| Facility balance remaining | R16,250,000 |
| Licence-day capital raise target | R300,000,000 |
| Less: trading-book backing (D-MARKETS-CAPITAL-TIME-SHAPE) | R150,000,000 |
| Less: ILAAP liquidity buffer (D-MARKETS-CAPITAL-TIME-SHAPE) | ~R125,000,000 |
| Less: operational buffer (residual) | ~R25,000,000 |
| **Expected capital position post-raise (at licence-application)** | **R300,000,000** |

The pre-licence facility draw is a short-duration liability retired from the licence-day raise proceeds. It does not reduce the R300m licence-day capital envelope — the raise is sized gross.

---

## 4. Go-Live Capital Inputs for ICAAP Co-Ordination

The following approved figures are ready for Helena (CRO, governance) to use as inputs to the ICAAP RWA sizing under the Standardised Approach:

| Input | Approved Amount | Purpose |
|---|---|---|
| Trading-book capital backing | R150,000,000 | Market risk RWA coverage at go-live |
| Liquidity buffer / ILAAP balance | ~R125,000,000 | Liquidity Coverage Ratio (LCR) base; ILAAP stress sizing |
| Total capital envelope | ~R300,000,000 | Pillar 1 + Pillar 2A sizing reference |

Helena (CRO, governance) is being briefed via `Team Inbox/2026-05-12_camille_helena-icaap-coordination.md`. These inputs feed:
- Market risk capital charge sizing (Standardised Approach per Regulations Relating to Banks Chapter 13)
- ILAAP liquidity stress scenarios (30-day survival horizon per LCR)
- Pillar 2A internal capital assessment for the licence application

---

## 5. Dashboard Capital Tile Update

The approved time-shape should be reflected in the dashboard capital tile at the next CFO substrate snapshot. The canonical source for these figures is this document (cited by hash via `AgentRunCompleted` event, see §6). Dashboard derives from canonical sources; no hand-edit of `seeds/dashboard-state.json`.

Substrate gap flagged: there is no `CfoSnapshotProduced` or `CapitalPlanUpdated` event type in `prototype/platform/event-store/event-types/`. The capital plan is recorded via `AgentRunCompleted` (see §6). A `CapitalPlanProduced` typed event is noted as a **substrate gap** — to be raised with Atlas (Core banking platform architect, engineering) for inclusion in the finance event-types module.

---

## 6. Events-First Authoring Note

**Principle 1 compliance:** this document is the markdown render of an `AgentRunCompleted` event emitted at run close-out via `prototype/scripts/emit-camille-capital-plan-2026-05-12.ts`. The event cites `D-MARKETS-CAPITAL-TIME-SHAPE` and references this document by BLAKE3 hash via the RMS document store.

**Substrate gap:** no `FinancialPlanProduced` or `CapitalPlanProduced` event type exists in `prototype/platform/event-store/event-types/`. The `AgentRunCompleted` event (RMS-3) is used as the closest available typed record. The gap is noted here and will be raised as a roadmap item with Atlas.

---

## 7. Assumptions and Caveats

1. **No real capital exists.** These are target figures for licence-day. No R300m sits anywhere today (project_ai_driven_bank memory).
2. **Build-phase funding facility.** The R50m pre-licence facility is a working assumption. Marc must confirm at the licence-application financing round.
3. **Licence-application timing.** Month 18 is a working estimate; the actual date is gated on Saskia's go-live readiness substrate reaching green.
4. **OpEx composition.** "People" OpEx in the build phase is agent-run cost (Anthropic API) + minimal statutory-minimum human costs at licence-day. No PAYE/EMP201 applies pre-licence (project_ai_driven_bank).
5. **CapEx composition.** Covers Azure dev spend, tooling, licences. Major Azure migration spend accelerates post-licence-application and is covered by the R5m envelope.
6. **R300m raise timing.** Capital raise executes at or just before licence-day; pre-licence draw-down is a bridging facility only.
7. **ILAAP ~R125m.** The tilde denotes working precision; Helena (CRO) will size the exact ILAAP requirement as part of the ICAAP cycle. Camille (CFO) will update this plan once Helena's sizing is confirmed.

---

*Camille (CFO, finance) — 2026-05-12*
*Authority: D-MARKETS-CAPITAL-TIME-SHAPE*
*Event: AgentRunCompleted — see `prototype/scripts/emit-camille-capital-plan-2026-05-12.ts`*
