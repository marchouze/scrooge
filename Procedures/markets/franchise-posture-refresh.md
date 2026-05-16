---
procedureId: PROC-MK-FPR-01
title: Quarterly markets franchise posture refresh
author: Saskia (Chief Markets Officer, governance)
date: 2026-05-16
owner: Saskia (Chief Markets Officer, governance)
status: POPULATED
version: "0.1"
last-updated: "2026-05-16"
policy-cited: D-MARKETS-SCHEMA-FOUNDATION
system-capability: "@platform/markets/franchise-posture (PLANNED)"
citations:
  - D-MARKETS-SCHEMA-FOUNDATION
  - D-RMS-PHASE-1
---

# Procedure — Quarterly markets franchise posture refresh

**Procedure ID:** PROC-MK-FPR-01
**Owner:** Saskia (Chief Markets Officer, governance)
**Approval:** CEO (D-MARKETS-SCHEMA-FOUNDATION) for scope changes; Saskia for quarterly operational refresh
**Cadence:** Quarterly at agent's scheduled governance-cycle run
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- D-MARKETS-SCHEMA-FOUNDATION (CEO-approved) — establishes the markets franchise scope and requires periodic posture reviews to ensure the franchise remains aligned with market conditions, regulatory environment, and capital allocation.

The obligation chain:

```
Decision (D-MARKETS-SCHEMA-FOUNDATION — markets franchise scope)
  → PROC-MK-FPR-01 (this procedure — quarterly posture review)
    → @platform/markets/franchise-posture (PLANNED)
      → FranchisePostureRefreshed event (or FranchiseScopeChangeProposed → Decision event)
```

**Build-phase posture:** Franchise posture reviews during the build phase focus on: substrate readiness tracking, pipeline health (PROC-MK-SFP-01 output), regulatory development monitoring, and capital target tracking. Live trading metrics are absent; they become available at commencement of trading.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Banks Act 94 (general) | SARB expects that a licensed bank's trading activities are conducted within a regularly reviewed and documented franchise scope; ad-hoc scope expansion without governance review is a supervisory risk. |
| PA Guidance Note 2/2024 | Board/senior management must demonstrate periodic strategic oversight of trading activities and capital allocation. |
| D-MARKETS-SCHEMA-FOUNDATION | CEO decision mandating the bank's initial franchise scope (FX spot, OTC vanilla IRS, JSE government bonds, JSE corporate bonds, structured notes); material scope changes require a new CEO/Board decision. |

## 3. Purpose

1. Provide Saskia with a structured quarterly opportunity to review the bank's markets franchise against actual performance (at commencement) or substrate readiness (during build phase), market conditions, pipeline health, and capital allocation.
2. Surface any franchise scope changes (product additions, product withdrawals, capital reallocation) as formal Decision events rather than informal adjustments.
3. Keep the CEO and Helena (CRO) informed of franchise health and any emerging risks or opportunities.
4. Maintain an immutable quarterly franchise posture record that demonstrates ongoing senior management oversight of the trading business.

## 4. Trigger

- **Quarterly cadence:** `QuarterlyGovernanceCycleDue { quarter, year, cycle: 'FranchisePostureRefresh' }` — emitted by the governance scheduler at the agent's scheduled quarterly tick.
- **Ad-hoc trigger:** `FranchisePostureAdHocReviewRequested { reason, requestedBy, requestedAt }` — emitted when a material market event, capital event, or regulatory change warrants an out-of-cycle review.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Saskia drafts posture update:** Saskia (Chief Markets Officer, governance) reviews the current franchise against: (a) active products — operational status vs. planned; (b) pipeline health — number of institutions by stage (PROC-MK-SFP-01 quarterly output); (c) capital allocation — current RWA consumption vs. approved envelope; (d) market conditions — spread environment, liquidity conditions, competitive landscape; (e) substrate completeness — which system capabilities are PLANNED vs. LIVE | `human` (Saskia — Chief Markets Officer, governance) | `@platform/markets/franchise-posture` (PLANNED) | Posture draft is structured as a markdown document with five sections (one per review dimension). At commencement of trading, trading P&L and volume metrics replace substrate readiness metrics. |
| 2 | **Helena risk overlay:** Helena (Chief Risk Officer, governance) reviews the posture draft from a risk perspective: RAS alignment, current portfolio risk vs. capital, emerging market risks that should constrain franchise scope, and any concentration concerns; Helena adds a risk overlay section to the posture document | `human` (Helena — Chief Risk Officer, governance) | None — risk judgment | Helena's risk overlay is required before the posture document is finalised. If Helena identifies RAS-level concerns, the posture review triggers an immediate RAS review (PROC-RISK-RAS-01). |
| 3 | **Atlas substrate gap delta:** Atlas (Platform Engineer) provides a substrate gap delta: which capabilities moved from PLANNED to LIVE this quarter; which remain PLANNED; revised estimate for capability completion; blockers; Atlas emits `SubstrateGapDeltaProvided { quarter, year, capsCompleted, capsRemaining, blockers, providedAt }` | `agent` (Atlas — Platform Engineer) | `@platform/recon/substrate-gap` (PLANNED) | Substrate gap delta is a build-phase-specific input; it transitions to a technology-investment review at commencement of trading. |
| 4 | **Franchise posture document finalised:** Saskia incorporates Helena's risk overlay and Atlas's substrate gap delta; finalises the posture document; stores it in the doc store (BLAKE3-addressed) | `human` (Saskia) | `@platform/doc-store` | Finalisation event: `FranchisePostureDocumentFinalised { quarter, year, documentHash, finalisedAt }`. |
| 5 | **CEO briefing:** Saskia presents the posture document to Marc (CEO); for operational refreshes (no scope changes): Marc acknowledges via `FranchisePostureRefreshed { quarter, year, documentHash, acknowledgedBy: CEO, acknowledgedAt }` | `human` (Saskia → Marc — CEO) | `@platform/decisions` | CEO acknowledgement closes the quarterly cycle. It is not a Decision event unless scope changes are proposed (step 6). |
| 6 | **Scope change path:** If the posture review identifies material scope changes (new product, product withdrawal, capital reallocation > 20 % of current envelope, new jurisdiction): Saskia drafts a formal recommendation; Marc approves via `recordDecision` with `category: 'FranchiseScope'`; the new Decision ID supersedes the relevant section of D-MARKETS-SCHEMA-FOUNDATION | `human` (Saskia → Marc) | `@platform/decisions` | Scope changes are Decision events; they do not take effect until the decision is approved and confirmed. Intra-quarter scope changes may trigger an ad-hoc PROC-MK-FPR-01 run. |
| 7 | **Emit FranchisePostureRefreshed:** On CEO acknowledgement (step 5) or scope-change decision approval (step 6): emit `FranchisePostureRefreshed { quarter, year, documentHash, scopeChanges: [], acknowledgedBy: CEO, refreshedAt }` | `agent` | `@platform/event-store` | This event closes the quarterly cycle and is the canonical posture refresh record. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Saskia (Chief Markets Officer, governance) | Posture draft; document finalisation; CEO briefing; scope-change recommendations |
| Helena (Chief Risk Officer, governance) | Risk overlay; RAS alignment check |
| Atlas (Platform Engineer) | Substrate gap delta provision |
| Marc (CEO) | Quarterly acknowledgement; scope-change Decision approval |
| Vera (internal audit engineer, governance) | Asserts quarterly cycle completes within 20 business days of trigger |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| RAS concern identified by Helena | Immediate RAS review; posture cycle paused pending RAS outcome | Immediate |
| Significant market dislocation | Ad-hoc posture review triggered; Saskia + Helena + CEO | Within 2 business days of event |
| Capital envelope breach | Helena + CFO (Bea) + CEO; capital action plan before posture is finalised | Before step 4 |
| Quarterly cycle not completed in time | Vera finding → Saskia → CEO | Day 21 |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/markets/franchise-posture` | PLANNED | Posture document workflow; five-dimension template |
| `@platform/recon/substrate-gap` | PLANNED | Substrate gap delta automation |
| `@platform/doc-store` | Live | BLAKE3-addressed posture document storage |
| `@platform/decisions` | Live | Scope-change decision workflow via `recordDecision` |
| `@platform/event-store` | Live | `FranchisePostureRefreshed` and related events |

## 9. Quality controls

- Every quarter must produce a `FranchisePostureRefreshed` event within 20 business days of `QuarterlyGovernanceCycleDue`. Vera monitors this.
- Every posture document must include Helena's risk overlay section. Missing overlay is a Vera finding.
- Scope changes must be Decision events; informal scope adjustments are a Principle 2 violation reportable by Vera.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `QuarterlyGovernanceCycleDue` | Event log | 7 years | Trigger record |
| `SubstrateGapDeltaProvided` | Event log | 7 years | Build-phase substrate tracking |
| `FranchisePostureDocumentFinalised` | Event log | 7 years | Document finalisation record |
| Posture document | Doc store (BLAKE3) | 7 years | Full narrative record |
| `FranchisePostureRefreshed` | Event log | 7 years | Quarterly cycle closure |
| Scope-change Decision event | Event log | Permanent | Franchise scope changes |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Devon (Chief Operating Officer, governance) | Initial POPULATED — Saskia posture draft (5 dimensions), Helena risk overlay, Atlas substrate gap delta, CEO briefing, scope-change Decision path; quarterly cadence; build-phase posture (substrate readiness); D-MARKETS-SCHEMA-FOUNDATION compliance. |
