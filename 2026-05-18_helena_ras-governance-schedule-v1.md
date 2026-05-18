---
title: "RAS Governance Schedule v1"
author: Helena (Chief Risk Officer, governance)
date: 2026-05-18
authority: D-RAS, D-MARKETS-CAPITAL-TIME-SHAPE
citations:
  - "D-RAS"
  - "D-MARKETS-CAPITAL-TIME-SHAPE"
  - "RRTB Regulation 38 — ICAAP"
  - "BCBS Corporate Governance Principles for Banks (2015) — Principle 6 (risk management)"
  - "PA Guidance Note 1 of 2024 — Climate risk governance"
record-kind: governance-schedule
version: v1
asOf: 2026-05-18
---

# RAS Governance Schedule v1

**Author:** Helena (Chief Risk Officer, governance)  
**Date:** 2026-05-18  
**Authority:** D-RAS (CEO-approved 2026-05-06) · D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)  
**Brief:** `brief:helena:formal-ras-governance-schedule-v1:2026-05-18`  
**Status:** Filed (RMS Phase 3)

---

## Purpose

This document establishes the formal governance schedule for the bank's Risk Appetite Statement and Framework (RAS/RAF). It covers the standing autonomous cadence, dated horizon items, measurement-substrate milestones, BRC pre-read workflow, annual ICAAP/ILAAP cycle, escalation triggers, and substrate gaps blocking the schedule.

The schedule binds from the date of the D-RAS approval (2026-05-06) and is refreshed at each quarterly BRC cycle and on any out-of-cycle trigger. It is the single reference point for RAS governance obligations until superseded.

Citations bind as follows: `[citation: D-RAS]` `[citation: D-MARKETS-CAPITAL-TIME-SHAPE]` `[citation: RRTB Regulation 38 — ICAAP]` `[citation: BCBS Corporate Governance Principles for Banks (2015)]` `[citation: PA Guidance Note 1 of 2024]`

---

## Section 1 — Standing Autonomous Cadence

### 1.1 Daily risk-appetite-watch handler

Helena's autonomous daily run is implemented at `prototype/runtime/agents/helena-risk-appetite-watch.ts`. This handler:

1. Walks the 13-line appetite shadow set (mirror of RAS §§B1–B8 as of D-RAS approval).
2. Computes measurement status for each line against the event store.
3. Reads open `AppetiteBreach` and `AppetiteBreachDisposed` events; derives net open-breach count and tier breakdown.
4. Emits one `RiskAppetiteSnapshot` event per run carrying the full inventory.
5. If any Tier-1 breach is open past its disposition SLA, emits a typed `AgentEscalation` routed to the CEO (marc@tgv.co.za).

The handler degrades gracefully in build phase: zero-appetite lines (sanctions-match, STR-filing judgement, TCF) report `green` if no override events are observed; all other non-credit/non-market lines report `unmeasured` pending the measurement substrate; market and credit lines report `n/a-build-phase` until commencement of trading.

### 1.2 Inactivity SLA

Per Helena's operating spec (`Team/Helena.md`) §6 (Cadence): the daily appetite-monitoring rollup **must** produce a `RiskAppetiteSnapshot` event; a gap exceeding 24 hours triggers a substrate alert. This SLA is enforced by the agent runtime's heartbeat monitor. Any gap > 24h is a finding routed to Atlas (Core banking platform architect, engineering) for substrate investigation.

### 1.3 Autonomous vs coordinated run distinction

During the build phase the full autonomous-agent substrate (M8 event-store federation; launchd-triggered agent fleet) is present but event federation across worktrees is not yet unified. Runs dispatched from isolated worktrees land events in the worktree-local store. Until the M8 gap closes, Helena's daily runs must be re-invoked from the main worktree to land events in the canonical store. This is a Tier-2 substrate gap tracked in Section 7.

---

## Section 2 — Dated Horizon Table

All dates are authoritative as of 2026-05-18. Items marked `PENDING-SUBSTRATE` cannot be completed until the substrate gap identified in Section 7 is closed.

| # | Item | Due date | Authority | Owner | Status |
|---|---|---|---|---|---|
| H-01 | RAS v1 approved | 2026-05-06 | D-RAS | Helena (CRO, governance) | **Done** |
| H-02 | RAS v2 filed (ICAAP-validated figures) | 2026-05-12 | D-MARKETS-CAPITAL-TIME-SHAPE | Helena (CRO, governance) | **Done** |
| H-03 | Climate-risk substrate specification | 2026-07-15 | RAS §A2; PA GN 1 of 2024 | Helena (CRO, governance) | In progress |
| H-04 | BRC pre-read papers distributed to members | 2026-07-14 | D-RAS §B12; BCBS CG Principle 6 | Helena (CRO, governance) | Not started |
| H-05 | BRC pre-read papers approved by Helena | 2026-07-28 | D-RAS §B12 | Helena (CRO, governance) | Not started |
| H-06 | Quarterly BRC review — Cycle 1 | **2026-08-04** | D-RAS §B12 (day 90 from D-RAS) | Helena (CRO, governance) | Not started |
| H-07 | LCR/NSFR measurement substrate live (Ravi) | Before H-06 | RAS §B3; RRTB Reg 38 | Ravi (Treasury / ALM engineer) | PENDING-SUBSTRATE |
| H-08 | CET1 measurement substrate live (Bea) | Before H-06 | RAS §B3; RRTB Reg 38 | Bea (Accounting & financial reporting engineer) | PENDING-SUBSTRATE |
| H-09 | RAS v3 calibration (post first live-run ICAAP inputs, if required) | Q4 2026 (to be confirmed at H-06) | D-RAS §B10; RRTB Reg 38 | Helena (CRO, governance) | Deferred to H-06 |
| H-10 | Annual Board RAS review | **2027-05-06** | D-RAS §B12; Banks Act 94 §60A | Helena (CRO, governance) · CEO | Not started |
| H-11 | Annual ICAAP/ILAAP sign-off (first annual cycle) | **Q3 2027** | RRTB Regulation 38; PA GN on ICAAP | Helena (CRO, governance) · Camille (CFO, finance) | Not started |
| H-12 | PA ICAAP/ILAAP submission | Within 4 weeks of H-11 | RRTB Regulation 38 §38(4) | Helena (CRO, governance) | Not started |
| H-13 | Model-risk tier validation function — independent validator hire | To be confirmed at H-06 | RAS §B7 | Nolan (Head of talent & operations, operations) | Not started |
| H-14 | RAS structured register (replacing hand-curated shadow) | Before H-06 | RAS §B1–B13; Principle 1 | Helena (CRO, governance) · Atlas (Core banking platform architect, engineering) | Not started |
| H-15 | BRC Cycle 2 (day 180) | 2026-11-01 (est.) | D-RAS §B12 | Helena (CRO, governance) | Provisional |
| H-16 | BRC Cycle 3 (day 270) | 2027-02-01 (est.) | D-RAS §B12 | Helena (CRO, governance) | Provisional |

> Notes: (1) Items H-15 and H-16 are provisional pending confirmation of exact BRC meeting schedule at H-06. (2) The Interim Audit Forum (Owen (Company Secretary, governance) as chair) is the audit oversight body until a Board Audit Committee is constituted; BRC items escalating to Board level route through the CEO and the Interim Audit Forum until a formal Board is constituted.

---

## Section 3 — Measurement-Substrate Milestones

### 3.1 Current measurement status

Of the 13 appetite lines in the RAS shadow set (`runtime/agents/helena-risk-appetite-watch.ts` — `APPETITE_LINES` array), 6 are currently **unmeasured** pending engineering substrate. An additional 4 are **n/a-build-phase** (market and credit lines that activate at commencement of trading). The remaining 3 (zero-appetite lines) report **green** because posture is the appetite and no override events have been observed.

| Appetite line | RAS § | Category | Tier | Measurement owner | Target |
|---|---|---|---|---|---|
| LCR buffer | §B3 | liquidity | tier-1 | Ravi (Treasury / ALM engineer) → Eitan (Treasurer, finance) | Before H-06 (2026-08-04) |
| NSFR buffer | §B3 | liquidity | tier-1 | Ravi (Treasury / ALM engineer) → Eitan (Treasurer, finance) | Before H-06 (2026-08-04) |
| CET1 buffer over PA min | §B3 | capital | tier-1 | Bea (Accounting & financial reporting engineer) → Camille (CFO, finance) joint with Helena | Before H-06 (2026-08-04) |
| Cyber-incident severity tiering | §B6 | operational | tier-2 | Senna (Security engineer) → Rashida (CISO, governance) | Before H-06 (2026-08-04) |
| Model-risk tier discipline | §B7 | model | tier-2 | Independent validation function (Nolan hire) → Helena (CRO, governance) | Post-hire; to confirm at H-06 |
| Climate-risk governance per PA GN 1 of 2024 | §A2 | climate | tier-2 | Helena (CRO, governance) — substrate not yet specified | H-03 deadline 2026-07-15 |

### 3.2 BRC-pack completeness condition

The 2026-08-04 BRC pack (H-06) is complete only if:

- Tier-1 lines (LCR, NSFR, CET1) are measurable with actual or rehearsal-mode figures, **or** the BRC pack includes a formal exception note with a confirmed measurement-readiness date. The PA expects quantitative ICAAP/ILAAP inputs (`[citation: RRTB Regulation 38]`); a BRC pack missing all three Tier-1 numbers requires an explanatory exception section.
- The climate-risk substrate specification (H-03) is either complete or an interim posture statement accompanies the pack per PA Guidance Note 1 of 2024. `[citation: PA Guidance Note 1 of 2024]`
- The model-risk independent validation function status is reported (even if the hire is deferred).

### 3.3 Measurement-substrate dispatch status

Ravi (Treasury / ALM engineer) and Bea (Accounting & financial reporting engineer) have been dispatched concurrently for the LCR/NSFR and CET1 substrates respectively. Progress is tracked against their worktree deliverables. Helena reviews outputs before they are cited in the BRC pack.

---

## Section 4 — BRC Pre-read Workflow (Cycle 1: 2026-08-04)

The Board Risk Committee (BRC) is the primary governance forum for the RAS. Until a formal Board is constituted, the BRC operates with the CEO as chair in dual-hat capacity, with Helena as CRO and secretary. `[citation: BCBS Corporate Governance Principles for Banks (2015) — Principle 6]`

### 4.1 Pre-read timeline

| Step | Action | Produced by | Due |
|---|---|---|---|
| P-1 | Appetite-line measurement run + breach inventory | Helena (autonomous handler) | Rolling daily until 2026-07-28 |
| P-2 | Draft BRC pack — appetite-line status, breach summary, substrate gap register, material findings | Helena (CRO, governance) | 2026-07-14 (3 weeks before BRC) |
| P-3 | Capital adequacy section review | Camille (CFO, finance) joint with Helena (CRO, governance) | 2026-07-21 |
| P-4 | Liquidity section review | Eitan (Treasurer, finance) joint with Helena (CRO, governance) | 2026-07-21 |
| P-5 | Cyber / operational risk section review | Rashida (CISO, governance) | 2026-07-21 |
| P-6 | Compliance section review | Zara (CCO, governance) | 2026-07-21 |
| P-7 | Final BRC pack approved by Helena | Helena (CRO, governance) | **2026-07-28** (7 days before BRC) |
| P-8 | BRC pack distributed to members | Helena (CRO, governance) | **2026-07-28** |
| P-9 | Board Risk Committee meeting — Cycle 1 | CEO (chair dual-hat) + Helena (secretary) | **2026-08-04** |

### 4.2 BRC pack structure

The Cycle 1 BRC pack must contain the following sections:

1. **Executive summary** — headline RAS compliance posture, open Tier-1 / Tier-2 breaches.
2. **Appetite-line status table** — all 13 lines, status (measured / unmeasured / n/a), trend where measurable.
3. **Capital adequacy section** — CET1 ratio vs RAS §B3 calibration; Pillar 1 + Pillar 2A vs ICAAP/ILAAP v1 baseline (`[citation: D-MARKETS-CAPITAL-TIME-SHAPE]`).
4. **Liquidity section** — LCR and NSFR vs RAS §B3 calibration.
5. **Market risk section** — VaR and concentration lines (n/a-build-phase until commencement of trading; report posture).
6. **Credit risk section** — single-name and sector concentration (n/a-build-phase; report posture).
7. **Financial crime / conduct section** — zero-appetite posture; Zara (CCO, governance) attestation.
8. **Climate-risk section** — governance posture vs PA GN 1 of 2024; substrate specification progress.
9. **Model-risk section** — tier discipline posture; validation function status.
10. **Substrate gap register** — honest inventory of unmeasured lines with owners and target dates.
11. **Escalations outstanding** — any unresolved Tier-1 escalations.
12. **Proposed actions for BRC resolution** — appetite line changes, limit cascades, exception approvals.

### 4.3 Resolution outputs

At Cycle 1 the BRC must:

- Accept or direct amendment to each appetite line.
- Note any exception where a line is unmeasured and the measurement date is post-BRC.
- Approve or reject the climate-risk substrate specification (H-03) if complete.
- Direct any limit-cascade commissions.
- Record decisions as `Decision` events via `recordDecision` per the governance-seat authority table in CLAUDE.md.

---

## Section 5 — Annual ICAAP/ILAAP Cycle

### 5.1 Cycle definition

The bank runs a full Internal Capital Adequacy Assessment Process (ICAAP) and Internal Liquidity Adequacy Assessment Process (ILAAP) annually, aligned to the financial year end. The first annual cycle is Q3 2027 (item H-11). `[citation: RRTB Regulation 38]`

Prior to the first annual cycle, an ICAAP/ILAAP Paper v1 was completed on 2026-05-12 by Helena as a build-phase sizing exercise (archived at `archive/owner-inbox/2026-05-12_helena_ras-recalibration-v2.md` companion). That paper is a preparatory run, not a regulatory submission; it locks no filed obligation but validates the capital time-shape and feeds the RAS v2 calibration.

### 5.2 Annual cycle inputs

| Input | Source | Due to Helena by |
|---|---|---|
| CET1 ratio and Pillar 1 RWA | Bea (Accounting & financial reporting engineer) | 6 weeks before ICAAP deadline |
| Pillar 2A add-ons (credit, market, IRRBB, operational) | Helena (CRO, governance) — self-produced using measurement substrate | 6 weeks before ICAAP deadline |
| Liquidity stress test results (LCR / NSFR 30/90 day) | Ravi (Treasury / ALM engineer) → Eitan (Treasurer, finance) | 6 weeks before ICAAP deadline |
| Internal model review outputs | Independent validation function | 8 weeks before ICAAP deadline |
| Climate stress scenario inputs | Helena (CRO, governance) — requires substrate (H-03) | 8 weeks before ICAAP deadline |
| FAIS / TCF / conduct-risk metrics | Zara (CCO, governance) | 6 weeks before ICAAP deadline |

### 5.3 Sign-off chain

1. **Helena** (CRO, governance) — owns the ICAAP/ILAAP document; assembles inputs; authors Pillar 2A narrative; signs off the aggregate assessment.
2. **Camille** (CFO, finance) — co-signs the capital section; confirms balance sheet sourcing.
3. **Eitan** (Treasurer, finance) — co-signs the liquidity section.
4. **CEO** — approves the final ICAAP/ILAAP as a `Decision` event (`category: risk-appetite-calibration`) per the CLAUDE.md authority table.
5. **Interim Audit Forum** (Owen (Company Secretary, governance) as chair) — notes the ICAAP/ILAAP as a third-line review item; Thandiwe (CAE, governance) may commission a targeted audit of ICAAP model assumptions.

### 5.4 PA submission timeline

Under RRTB Regulation 38 §38(4), the bank must submit the ICAAP/ILAAP assessment to the PA within the prescribed period after financial year end. `[citation: RRTB Regulation 38]`

Timeline (Q3 2027 annual cycle):

- ICAAP/ILAAP document finalized: Q3 2027 (H-11).
- CEO sign-off Decision event: within 2 weeks of H-11.
- PA submission: within 4 weeks of H-11 (H-12).
- BRC briefed on submission: at the next BRC cycle after submission.

---

## Section 6 — Escalation Triggers for Out-of-Cycle RAS Updates

The following events trigger an out-of-cycle RAS review outside the quarterly BRC cadence. Helena raises the review within the SLA stated; the CEO decides on scope and authority within the CEO seat's authority table.

| Trigger | SLA for Helena to raise | Escalation route | Decision authority |
|---|---|---|---|
| **Material loss event** — single-day P&L loss exceeding 20% of CET1 buffer over PA minimum | Same business day | Helena → CEO (direct escalation event) | CEO; BRC notified at next session |
| **NPA gate reached** — New Product Approval for any product approaching commencement-of-trading requiring RAS calibration confirmation | Before NPA approval date | Helena → CEO + relevant governance seats | CEO (NPA sign-off) per CLAUDE.md NPA posture |
| **Regulatory change** — new PA / SARB / FSCA rule materially affecting any existing appetite line (LCR floor, CET1 floor, climate-risk mandate) | Within 5 business days of rule publication | Helena → Owen (Company Secretary, governance) + CEO | CEO with CoSec note |
| **Tier-1 appetite breach** — any `AppetiteBreach` event with `tier: "tier-1"` in the event store | Same business day | Automated `AgentEscalation` event → CEO; Helena provides narrative within 24h | CEO; Board notification if breach persists >5 days |
| **ICAAP/ILAAP material restatement** — restatement of any Pillar 2A add-on exceeding 10% | Within 5 business days | Helena → CFO + CEO | CEO; PA notification if restatement crosses PA-filed threshold |
| **Model governance failure** — production use of a model that has not completed tier-appropriate independent validation | Immediate | Helena → CEO (`AgentEscalation`, severity: blocking) | CEO; usage suspended pending validation sign-off |
| **Sanctions true-positive override** — any `ProductionSanctionsOverride` event (zero-appetite line) | Immediate | Zara (CCO, governance) triggers; Helena is co-notified | CEO + CCO; PA/FIC notification if required by FICA §29 |

### 6.1 Out-of-cycle process

1. Helena emits a `DecisionRequested` event referencing the triggering event (e.g., `AppetiteBreach` event ID).
2. Helena authors a concise out-of-cycle brief (≤ 2 pages) covering: trigger, impacted lines, proposed RAS delta, and duration (temporary exception vs permanent revision).
3. Brief routed via `dispatch:open-brief` → CEO inbox.
4. CEO decision recorded as `Decision` event (`category: risk-appetite-calibration`).
5. If RAS revision approved: Helena issues RAS v{n+1} as a delta document, cites the new Decision event, files via RMS Phase 3.

---

## Section 7 — Substrate Gaps Blocking the Schedule

This section is the honest gap inventory per the dispatch brief instruction. Each gap is actionable — it has an owner and a target date. These are standing findings until closed.

| Gap ID | Description | Impact on schedule | Owner | Target |
|---|---|---|---|---|
| G-01 | **LCR/NSFR measurement substrate not yet live** | Blocks H-07; risks BRC pack incompleteness (Tier-1 lines unmeasured at H-06) | Ravi (Treasury / ALM engineer) | Before H-06 (2026-08-04) |
| G-02 | **CET1 measurement substrate not yet live** | Blocks H-08; risks BRC pack incompleteness (Tier-1 capital line unmeasured at H-06) | Bea (Accounting & financial reporting engineer) | Before H-06 (2026-08-04) |
| G-03 | **Climate-risk substrate not yet specified** | Blocks H-03 (specification due 2026-07-15); PA GN 1 of 2024 compliance posture remains qualitative only | Helena (CRO, governance) | H-03: 2026-07-15 |
| G-04 | **Structured RAS register absent** — appetite lines held as hand-curated shadow in `helena-risk-appetite-watch.ts` | Daily watch handler reads stale bytes; no machine-parseable register for recon pipelines; citation graph incomplete | Helena (CRO, governance) · Atlas (Core banking platform architect, engineering) | Before H-06 |
| G-05 | **Independent model validation function not staffed** | RAS §B7 model-tier discipline is ungoverned; tier-2 appetite line `appetite:model:tier-discipline` permanently `unmeasured` | Nolan (Head of talent & operations, operations) | To confirm at H-06 |
| G-06 | **Worktree event-store federation gap (M8)** | Helena daily-run events dispatched from isolated worktrees land in worktree-local store, not canonical store; `RiskAppetiteSnapshot` events may be missing from production projection | Atlas (Core banking platform architect, engineering) | M8 milestone |
| G-07 | **Cyber-incident severity tiering measurement not yet wired** | `appetite:operational:cyber-severity-tiers` (tier-2) reports `unmeasured`; operational risk section of BRC pack will be qualitative until Senna (Security engineer) wires the tiering substrate | Senna (Security engineer) → Rashida (CISO, governance) | Before H-06 |
| G-08 | **Interim Audit Forum cadence not formalised** — Thandiwe (CAE, governance) / Owen (Company Secretary, governance) oversight of ICAAP assumptions | Third-line review of ICAAP/ILAAP inputs is not yet scheduled; Vera's `recon:agent-spec` will surface this at next wave-5 recon run | Thandiwe (CAE, governance) · Owen (Company Secretary, governance) | Before H-11 |
| G-09 | **BRC membership not formally constituted** — CEO holds the chair in dual-hat capacity | Structural weakness; BCBS CG Principle 6 requires independent risk oversight; interim posture is defensible in build phase but should resolve before first licence-application submission | Owen (Company Secretary, governance) · CEO | Pre-licence readiness gate |

### 7.1 Gap register maintenance

Helena's autonomous daily handler surfaces any new substrate gap it observes as a finding note in the `RiskAppetiteSnapshot` event payload. The structured gap register above is updated at each BRC cycle (next: H-06 2026-08-04) and on any out-of-cycle RAS update.

---

## Provenance

- RAS v1 approved: 2026-05-06, decision `D-RAS`.
- RAS v2 filed: 2026-05-12, authority `D-MARKETS-CAPITAL-TIME-SHAPE`; archived at `archive/owner-inbox/2026-05-12_helena_ras-recalibration-v2.md`.
- ICAAP/ILAAP Paper v1: 2026-05-12, Helena (CRO, governance); companion to RAS v2.
- Daily watch handler: `prototype/runtime/agents/helena-risk-appetite-watch.ts` (live).
- 13 appetite lines across 10 categories: 3 measured (zero-appetite posture), 4 n/a-build-phase, 6 unmeasured (substrate gaps G-01 through G-03 and G-05 through G-07).
- Schedule authored: 2026-05-18, brief `brief:helena:formal-ras-governance-schedule-v1:2026-05-18`.
- Filed via RMS Phase 3 (RecordFiled event; D-RMS-PHASE-3 active).

`[citation: D-RAS]` `[citation: D-MARKETS-CAPITAL-TIME-SHAPE]` `[citation: RRTB Regulation 38 — ICAAP]` `[citation: BCBS Corporate Governance Principles for Banks (2015)]` `[citation: PA Guidance Note 1 of 2024]`
