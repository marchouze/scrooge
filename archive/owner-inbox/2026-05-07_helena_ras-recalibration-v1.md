---
title: RAS recalibration v1 — AI-driven bank reframe + substrate / coherence / supply-chain risks
author: Helena
date: 2026-05-07
summary: Recalibration delta against the 2026-05-06 RAS framework, anchored on (i) the AI-driven bank operating model (CLAUDE.md Principle 7, set 2026-05-07), (ii) the just-published Camille capital plan v1, and (iii) the materially expanded markets posture from D-MARKETS-SCHEMA-FOUNDATION. Adds three new appetite envelopes (B14 AI-supply-chain dependency, B15 substrate-coherence, B16 multi-agent decision-loop) and confirms calibration of B2 management buffer.
decision-required: false
---

# RAS recalibration v1 — AI-driven bank reframe + substrate / coherence / supply-chain risks

**From:** Helena (CRO) — autonomous run per `Team/Helena.md` § 6 (RAS / RAF cadence).
**To:** Marc (CEO) for awareness; Camille (CFO), Eitan (Treasurer), Saskia (Head of Global Markets), Owen (CoSec), Devon (COO), Zara (CCO), Iris (IO), Rashida (CISO), Thandiwe (CAE) as primary consumers.
**Date:** 2026-05-07
**Authority:**
- 2026-05-06 RAS Framework (CEO + CRO + CFO concurrence under interim governance) — `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`.
- AI-driven bank operating-model rule (CLAUDE.md Principle 7, set 2026-05-07).
- Camille capital plan v1 (`Owner Inbox/2026-05-07_camille_capital-plan-v1.md`) as the binding capital input.
- D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07).
- D-MARKETS-CAPITAL-TIME-SHAPE (CEO approved 2026-05-07).

**Citations:**
- `BANKS-ACT-94-1990` (RAS / RAF mandate).
- `BCBS-CG-PRINCIPLES` (Risk Governance Principles).
- `JOINT-STANDARD-1-2024` (cyber resilience appetite).
- `ORG-PR-04` (CET1 management buffer); `ORG-PR-21` (model risk three-tier); `ORG-PR-22` (climate); `ORG-CY-11` (cyber tier model B6).
- `ORG-PR-23` (BCBS SA-CCR — newly registered today, M1 URN tranche).
- `POPIA-S71` / `ORG-PR(IV)-10` (automated decisioning).

> v1 is a **recalibration delta**, not a full RAS rewrite. The 2026-05-06 RAS Framework remains the canonical base; this document changes-tracks what the AI-driven bank reframe + capital-plan v1 + markets-foundation approval shift.

---

## 0. Recalibration-on-a-page

| Item | Disposition | Reason |
|---|---|---|
| **A1 — Overarching statement** | Restate to bind explicitly to Principle 7 (AI-driven bank); existing language otherwise unchanged | Operating-model reframe |
| **A2 — Appetite by risk category** | No category shift; magnitude unchanged | Capital plan v1 carries forward Saskia working split |
| **B1 — Operational limits / KRIs** | Add three KRIs for agent-runtime substrate health | New domain under P7 |
| **B2 — Capital management buffer** | **Confirm** at +1.5pp above PA minima + Pillar 2A + capital conservation buffer; remove "deferred" caveat at v1 (carry over from `ORG-PR-04`); revisit at paper ICAAP | Capital plan v1 binds it |
| **B3 — Liquidity buffers** | Confirm; LCR / NSFR floors unchanged. Eitan's funding strategy v1 calibrates the *operational* floor inside the regulatory buffer | Capital plan v1 reserves residual ~R30m to liquidity |
| **B4 — Market risk (markets opening)** | **Re-baseline** against Saskia §2.2 envelopes; binding for FRTB-SA / Standardised market-risk RWA | M1 markets posture activated |
| **B5 — Financial crime / sanctions** | No change | Already operational |
| **B6 — Cyber tier model** | No change | Already in force per JS1/2024 |
| **B7 — Model risk three-tier** | **Extend**: agents-as-decision-makers under P7 are themselves Tier 1 / 2 models per the bank's model-risk policy (`ORG-PR-21`). Adds explicit pre-deployment validation requirement for any new agent operating-spec. | P7 implication |
| **B8 — Concentration / counterparty (markets)** | Confirm 25% sector cap; binding for Saskia counterparty-set ambition under §2.3 | Markets-foundation activated |
| **B9–B13** | No change | Procedural / governance — unchanged by recalibration |
| **B14 — AI-supply-chain dependency (NEW)** | Set boundary on single-vendor concentration for the agent fleet's foundation-model substrate | P7 + build-phase Anthropic-only posture |
| **B15 — Substrate-coherence (NEW)** | Set boundary on tolerable drift between event log and projections / dashboard | Substrate is the binding constraint |
| **B16 — Multi-agent decision-loop (NEW)** | Set boundary on autonomous-decision chains executing without human checkpoint | P7 escalation discipline |

---

## 1. A1 — Overarching statement (recalibrated)

The bank pursues its franchise — institutional global-markets trading, single SA branch, ~R300m capital — within an **autonomous-by-default operating model** (CLAUDE.md Principle 7). The bank's labour force is autonomous AI agents; statutory humans are the minimum the law requires; risk taxonomy includes substrate, coherence, and supply-chain risks intrinsic to that operating model.

Risk appetite is set such that:
- The bank does not operate in modes that require a human in a step the law does not require one in.
- The bank does not accept substrate gaps that defeat the citation graph (Principle 6) or break the event log as source of truth (Principle 1).
- The bank does not accept supply-chain dependencies on a single foundation-model vendor (B14) past build-phase.
- The bank does not allow autonomous-decision chains to execute against the CEO-reserved decision set (governance framework reserved matters) — escalation discipline is a hard limit, not a judgement.

Existing A1 language on regulatory minima, operating principles, and franchise scope is unchanged.

## 2. A3 — Appetite multipliers (no change)

Multipliers across Principles P1–P7 are unchanged. P7 is now the operating norm; multiplier "AI-driven mode" is now the default rather than an upward modifier.

---

## 3. New appetite envelopes (B14 / B15 / B16)

### B14 — AI-supply-chain dependency

**Concern.** The bank's agent fleet today runs on a single foundation-model vendor (Anthropic) for narrative output and decision-shaping. The current opex register lists `OPEX-COMPUTE-01` as the largest live cost line. A single-vendor outage, policy change, pricing change, or capability regression is currently a single-point-of-failure on the bank's ability to operate at all.

**Boundary at v1 (build-phase):**
- Acceptable for build-phase: single-vendor (Anthropic) foundation-model dependency.
- Required at licence-day: **secondary-vendor failover capability provisioned and rehearsed** for at least the third-line agents (Vera, Thandiwe-when-hired) and the regulator-facing pathways (Mira citation gate, Iris breach-notification, Owen reserved-matters escalation channel). Not required for first-line / second-line operational agents at licence-day; provisioned at year-2 review.
- Acceptable: foundation-model upgrade cadence within a vendor (e.g. Sonnet → Opus). Not in scope for B14 single-vendor concern.

**KRI:** vendor-API-availability over rolling 30 days; foundation-model-rev-stability over rolling 90 days.

**Owner:** Atlas (engineering substrate); Helena (appetite custody); Rashida (cyber resilience overlay per JS1/2024).

### B15 — Substrate-coherence

**Concern.** Per Principle 1, the event log is the single source of truth; everything else is a query / projection. Drift between the event log and projections (dashboard cache, derived registers, generated reports) is a direct integrity attack on Principle 1. Vera's overnight recon flags drift as `AuditFinding` events (`source: agent:vera:overnight-recon`).

**Boundary at v1:**
- Tolerable: drift on derived projections that is detected within 24 hours by Vera's overnight recon and re-derived within the next agent cycle.
- Tolerable on `decisionsResolved` and `decisionsOpen`: temporary drift between dashboard refresh windows.
- Not tolerable: drift on the event log itself (event-log integrity is non-negotiable).
- Not tolerable: drift on the **obligations register** (Mira's canonical) when consumed by `mira:citation-gate`; that breaks the Principle 6 citation graph.

**KRI:** count of `AuditFinding` events with `principle ∈ {decisionsOpen, decisionsResolved, inFlight}` per overnight-recon run; trend over 7 / 30 days.

**Owner:** Anya (projection engineering); Atlas (event-log substrate); Helena (appetite custody); Vera (audit signal).

### B16 — Multi-agent decision-loop

**Concern.** Under Principle 7, agents make decisions autonomously within their declared scope (`/Team/<Name>.md` § 9). When an autonomous decision triggers a follow-on (`scrooge:follow-on-router`) that triggers another, chains can execute without a human checkpoint until escalation is forced. CEO-reserved matters (governance framework) must never execute autonomously regardless of how the chain composed.

**Boundary at v1:**
- Acceptable: chain depth ≤ 3 within a single trigger-fan-out cycle (today the runtime explicitly avoids re-entering event-driven dispatch from event-driven dispatch — A0 §6 anti-loop rule limits effective depth to 1).
- Acceptable: autonomous sub-decisions (`AgentDecision` events) at any depth so long as in-scope per agent operating spec.
- Not acceptable: any chain that crosses a CEO-reserved matter without triggering `AgentEscalation` to the human channel.

**KRI:** count of `AgentDecision` events per agent per week classified out-of-scope by Vera pipeline #15 (planned); count of `AgentEscalation` deferrals where the deferral was operationally avoided.

**Owner:** Scrooge (router custody); Helena (appetite custody); Owen (governance framework custodianship).

---

## 4. Recalibrated KRI additions to B1

Three KRIs are added to the operational-limits set in §B1:

| KRI | Threshold | Tier | Action on breach |
|---|---|---|---|
| Foundation-model API availability (rolling 30 days) | < 99.0% | Amber | Atlas: provision secondary-vendor capability for third-line agents. |
| Foundation-model API availability (rolling 30 days) | < 95.0% | Red | Helena escalation to CEO; B14 boundary breach. |
| Vera overnight-recon `AuditFinding` count, principle ∈ substrate set | > 5 in any single run | Amber | Anya: targeted projection-refresh; Atlas: substrate-state report next cycle. |
| Agent-decision-out-of-scope count per week | > 0 (any breach is a fail) | Red | Owen: governance-framework review; Vera: investigation. |

---

## 5. RAS B2 — capital management buffer (confirmed)

Capital plan v1 binds the working +1.5pp CET1 management buffer over PA minima + Pillar 2A + capital conservation buffer. v1 confirms this calibration. The "deferred" caveat on `ORG-PR-04` is removed at v1 of this RAS recalibration; the obligation moves from PARTIAL to **IN FORCE** in Mira's next register snapshot.

Paper ICAAP run (Helena + Camille + Bea + Atlas's capital engine, deferred substrate) is the next opportunity to refine this calibration; v2 of this RAS lands alongside paper ICAAP v1.

---

## 6. RAS B5 — trading mandate (still deferred; explicit deadline)

`ORG-MK-04` / `ORG-PR-20` — RAS B5 (trading mandate boundary between client-driven, franchise market-making, proprietary risk-taking) was previously marked "deferred — under refinement". v1 confirms B5 stays deferred but **anchors a deadline**: B5 must land before M1 trading goes live (engineering: ~4 weeks after substrate gate per the markets-foundation decision). Saskia + Helena + Camille produce v0.1 of B5 in the next agent cycle; binding for the trading-book RWA generation under FRTB-SA.

---

## 7. Cadence

- **Refresh cadence:** quarterly minimum, anchored on the BRC cycle (interim Risk Forum until Board constituted). Triggered refresh on capital-plan refresh events from Camille; on threat-model gate events from Senna; on substantive `AgentEscalation` patterns from Vera.
- **v2:** lands with paper ICAAP v1 (Helena + Camille + Bea + Atlas), expected on the next-cycle anchor. v2 reshape is numerical; v1 is structural (recalibration delta).

---

## 8. Substrate gaps surfaced by this recalibration

1. **B7 model-risk three-tier policy** — does not currently classify agent operating specs as models. v1 RAS recalibration extends scope; the model-risk-policy file needs a corresponding update (planned procedure: `Procedures/by-policy/agent-operating-spec-validation.md`).
2. **B14 KRI substrate** — no instrumentation today reads vendor API availability into the event log. Atlas substrate-state report could add a `FoundationModelAvailability` snapshot type.
3. **B15 KRI** — Vera already emits `AuditFinding` events with the right shape; the KRI threshold is computable from existing data. No substrate gap.
4. **B16 KRI** — Vera pipeline #15 (`AgentDecision` out-of-scope detection) is planned but not yet built. Recalibration depends on that pipeline landing for full instrumentation.

---

## 9. Decision provenance (audit trail)

- **Source decision:** `D-MARKETS-CAPITAL-TIME-SHAPE` (CeoDecision approve, 2026-05-07T18:19:29.676Z); `D-MARKETS-SCHEMA-FOUNDATION` (CeoDecision approve, 2026-05-07T13:53:44.555Z); P7 introduction (CeoDecision D10 autonomous-agents, 2026-05-07).
- **Source proposal:** `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` (canonical RAS); `Owner Inbox/2026-05-07_camille_capital-plan-v1.md` (binding capital input); `Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md` §2.2 (binding markets envelope).
- **Recalibration event:** `AgentDecision` with `decisionId: decision:helena:ras-recalibration-v1`, `decidedBy: Helena`, `chosen: "Recalibration delta v1 published; B14/B15/B16 added; B2 confirmed; B5 deadline-anchored"`.

## 10. Provenance

Walked the 2026-05-06 RAS framework file end-to-end and identified what the AI-driven bank reframe (Principle 7, set 2026-05-07) and the just-published capital plan v1 shift; cross-referenced Saskia §2.2 envelopes for B4 / B8 magnitude; cross-referenced Mira's M1 URN tranche additions (ORG-MK-09 through ORG-MK-13, ORG-PR-23/24) for citation completeness; cross-referenced Helena spec § 6 (cadence), § 9 (decisions in scope: appetite-line operationalisation), § 13 (procedures owned: Risk Management Framework + Stress Testing + Op Risk Policy + Market Risk Policy), § 16 (substrate gaps); cross-referenced JS1/2024 for B14 cyber-resilience overlay.
