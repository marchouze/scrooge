---
policy-parent: liquidity-risk-management-policy-v1
last-reviewed: 2026-05-30
procedureId: PROC-ALM-ALCO-01
title: ALCO cycle — monthly asset & liability committee
author: Eitan (Treasurer) · Owen (Company Secretary, governance — secretariat) · Helena (Chief Risk Officer, governance — appetite)
date: 2026-05-30
owner: Eitan (Treasurer) · Owen (Company Secretary, governance — secretariat) · Helena (Chief Risk Officer, governance — appetite)
status: POPULATED
policy-cited: liquidity-risk-management-policy-v1
system-capability: "@platform/alco (LIVE — atlas:alco-pack handler)"
---

# Procedure — ALCO cycle (monthly asset & liability committee)

**Procedure ID:** PROC-ALM-ALCO-01
**Owner:** Eitan (Treasurer — chair) · Owen (Company Secretary, governance — secretariat) · Helena (Chief Risk Officer, governance — appetite)
**Approval:** ALCO (treasury limits within RAS); CEO/Board (escalations crossing RAS thresholds)
**Cadence:** Monthly (full ALCO); ad-hoc (emergency session on a Tier-1 liquidity / IRRBB / FX breach)
**Version:** v0.1 — 2026-05-30
**Status:** POPULATED

## 1. Source policy

- `liquidity-risk-management-policy-v1` — the Liquidity Risk Management Policy heads the ALM governance chain; ALCO is its primary governance forum.
- ALCO Charter v1 (`archive/owner-inbox/2026-05-15_eitan_alco-charter.md`) — committee constitution, quorum, standing agenda.
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` §B5 (liquidity) / §B6 (IRRBB) — the appetite ALCO monitors and operates within.

The obligation chain:
```
Regulation (Banks Act s.72/73; Reg 26/27 LCR/NSFR; Reg 39 IRRBB/ILAAP)
  → Liquidity Risk Management Policy (liquidity-risk-management-policy-v1)
    → PROC-ALM-ALCO-01 (this procedure)
      → @platform/alco (LIVE — atlas:alco-pack)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-07` (BCBS Principles for Sound Management — senior-management oversight) | Senior management must actively manage liquidity, IRRBB, and funding through a standing committee; ALCO is that forum. |
| `ORG-PR-23` (Regulations Relating to Banks — Reg 39 ILAAP) | The bank's ALM governance must feed the ILAAP and be evidenced in a minuted committee. |
| `ORG-PR-11` (Banks Act s.73 / Reg 39 — interest rate risk) | IRRBB limits and positions must be reviewed and controlled by the Board's delegated committee. |

## 3. Purpose

Run the monthly Asset & Liability Committee: assemble a single generated pack from the live treasury projections, table it to a quorate committee chaired by the Treasurer, take decisions on funding, liquidity, IRRBB, FX, and collateral within the RAS, and escalate anything crossing a RAS or Board threshold. The pack is **generated, not assembled by hand** (Principle 6) — it is a render of the underlying projection events.

## 4. Trigger

**Monthly (standing):**
- Monthly scheduler — `atlas:alco-pack` runs and emits `ALCOPackGenerated { packId, overallTreasuryStatus, sectionsWithNoData, documentHash }`. ALCO sits within 5 working days of pack generation.

**Ad-hoc (emergency session):**
- A Tier-1 breach event — `FXPositionBreach`, or an `AgentEscalation` from Eitan on an LCR/NSFR/IRRBB breach — convenes an emergency ALCO regardless of cadence.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Run the ALCO-pack generator: fold the latest liquidity (`LCRComputed`, `NSFRComputed`), IRRBB (`IRRBBChecked`), ALM (`ALMRunCompleted`), collateral (`CollateralInventorySnapshotted`), FX (`FxPositionRevalued`), and ILAAP (`ILAAPSummaryCompleted`) projections into the eight standing pack sections | `system` (`atlas:alco-pack`) | `@platform/alco` (LIVE) | The pack is content-addressed; `documentHash` is the BLAKE3 of the rendered pack. `sectionsWithNoData` flags any section without a backing projection (build-phase zero-position is expected). |
| 2 | Emit `ALCOPackGenerated { packId, overallTreasuryStatus, sectionsWithNoData, documentHash }` | `system` | `@platform/event-store` | `overallTreasuryStatus` ∈ {green, amber, red} is the rolled-up RAS-utilisation status across all sections. |
| 3 | Chair review: Eitan (Treasurer) walks the pack — liquidity ratios vs buffers, IRRBB EVE/NII utilisation, FX NOP vs limit, collateral/HQLA adequacy, funding plan | `agent` (Eitan) | `@platform/alco` | Chair confirms every figure traces to a projection event ID (no authored balances — P1). |
| 4 | Committee decisions: for each agenda item requiring action (approve funding plan, resize repo book, approve a hedge, accept or remediate a limit utilisation), the committee takes a decision within the RAS | `human`/`agent` (ALCO — Eitan chair; Helena appetite) | Governance record | Each material decision is emitted as an `AgentDecision` event (decisionId, what, rationale, citations) — there is no separate `ALCODecision` type; ALCO decisions are typed `AgentDecision` carrying the ALCO pack `documentHash` as source. |
| 5 | Escalation: any item crossing a RAS Tier-1 or Board threshold (LCR/NSFR approaching regulatory minimum; capital action; material funding-base shift) is escalated | `agent` (Eitan) | `@platform/escalation` | Emit `AgentEscalation` (sealed) to Helena + Camille + CEO per §9. |
| 6 | Secretariat: Owen (Company Secretary, governance) records the minutes, decisions, and attendance against the pack `documentHash` | `agent` (Owen) | Governance record (ALCO minutes) | Minutes reference the `ALCOPackGenerated` event ID and each `AgentDecision` ID. |

## 6. Reconciliation

- **Events produced:** `ALCOPackGenerated` (monthly); `AgentDecision` (per material committee decision); `AgentEscalation` (per Tier-1 escalation).
- **Reconciliation checks:**
  - Every calendar month has at least one `ALCOPackGenerated` event (missing pack = Vera finding).
  - Every figure in the pack traces to a backing projection event (`LCRComputed`/`NSFRComputed`/`IRRBBChecked`/`ALMRunCompleted`/`FxPositionRevalued`/`ILAAPSummaryCompleted`).
  - Every `AgentEscalation` raised at ALCO has a disposition (decision or accepted-with-rationale) recorded by the next cycle.
- **Failure mode:** a section reports `sectionsWithNoData` outside build-phase expectation → Eitan investigates the missing upstream projection before the committee sits; the gap is minuted.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `ALCOPackGenerated` events | Event log | Permanent (P1) | Restricted |
| Rendered ALCO pack | Document store (BLAKE3-addressed) | 7 years | Confidential |
| ALCO minutes | Governance record + document store | 7 years | Confidential |
| ALCO `AgentDecision` events | Event log | Permanent (P1) | Restricted |

## 8. Manual steps

- **Step 3–4 — Chair review and committee decisions:** the Treasurer's interpretation of the pack and the committee's funding/hedging/limit decisions are irreducibly judgemental governance acts, even though the pack itself is generated.
- **Step 6 — Minutes:** the Company Secretary's minute is a governance record; the secretariat function is human-overseen.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Monthly ALCO pack not generated | Vera monthly invariant (no `ALCOPackGenerated` for the month) | Eitan + Atlas; manual fallback pack; ALCO delayed |
| `overallTreasuryStatus: red` | Pack rollup | Standing ALCO agenda item; remediation directed; escalate if RAS Tier-1 |
| LCR/NSFR approaching regulatory minimum | Pack liquidity section vs ILAAP early-warning | `AgentEscalation` → Helena + Camille + CEO within 24h; PA path lit by Owen |
| Material funding-base shift | Funding section | `AgentEscalation` → CEO + (when constituted) Board |
| Quorum failure | Secretariat attendance check | Owen reschedules within the charter window; recorded |

## 10. Related procedures

- [`intraday-liquidity-funding.md`](intraday-liquidity-funding.md) (PROC-RISK-ILF-01) — daily funding feeds the ALCO liquidity section.
- [`liquidity-limit-management.md`](liquidity-limit-management.md) (PROC-RISK-LLM-01) — LCR/NSFR limit utilisation is an ALCO standing item.
- [`irrbb-measurement.md`](irrbb-measurement.md) (PROC-RISK-IRRBB-01) — IRRBB scenario results are tabled monthly at ALCO.
- [`ilaap-cycle.md`](ilaap-cycle.md) (PROC-RISK-ILAAP-01) — the ILAAP summary feeds the ALCO pack; ALCO governs the ILAAP narrative.
- [`fx-position-governance.md`](fx-position-governance.md) (PROC-ALM-FXP-01) — FX NOP utilisation is an ALCO standing item.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-30 | Eitan + Owen + Helena (via Scrooge) | Initial authoring — closes the PROC-ALM-ALCO-01 procedure gap; first `ALCOPackGenerated` runs executed 2026-05-30. Authority: D-TREASURER-PROC-COMPLETION-2026-05-30. |

## 12. Audit / assurance

- **Vera monthly:** verify an `ALCOPackGenerated` event exists per month and every pack figure traces to a backing projection; verify each `AgentEscalation` has a disposition.
- **Thandiwe (Chief Audit Executive, governance):** annual internal audit of ALCO governance — quorum, decision quality, escalation discipline; opinion to the Interim Audit Forum.
