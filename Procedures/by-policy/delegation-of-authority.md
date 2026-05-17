---
status: POPULATED
---
# Procedure — Delegation of Authority

**Procedure ID:** PROC-GV-DOA-01
**Owner:** Owen (Company Secretary, governance) · Devon (Chief Operating Officer, governance)
**Approval:** Board
**Cadence:** Annual review; immediate update on material organisational change
**Version:** v0.1 — 2026-05-13
**Status:** POPULATED

## 1. Source policy

Governance Framework (Policies/ — STUB at this version).
King IV Principle 6 — the governing body should ensure that its arrangements for delegation within its own structures promote independent judgement and assist with balance of power and the effective discharge of its duties.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-GV-01` (Banks Act s.60; Companies Act s.66) | The board retains ultimate accountability; delegation to management is structured, documented, and reviewed at least annually. |
| `ORG-GV-02` (Banks Act s.60; King IV Principle 6) | Board-reserved matters cannot be sub-delegated; the risk appetite statement, ICAAP/ILAAP, annual financial statements, and PA licence applications are non-delegable. |
| `ORG-GV-03` (Banks Act s.60; Regulations Relating to Banks Reg 38) | Decisions must be made at the appropriate authority level; the authority matrix must be maintained in writing, tested, and available to the Prudential Authority on request. |

## 3. Purpose

Define who may authorise what class of decision, at what financial and risk threshold, and with what quorum — across all four authority levels. Provide the Bank's autonomous agent runtime with a machine-readable authority-limit specification so that Level 4 agent actions are bounded, and escalations to human decision-makers are automatic, typed, and auditable.

## 4. Trigger

This procedure is triggered in four circumstances:

- **Annual review:** Owen initiates a DOA review at the start of each annual governance cycle; the updated matrix is submitted to the Board for approval.
- **Material organisational change:** any change to the senior leadership structure (new hire, departure, restructure) triggers an immediate DOA review for the affected authority levels. Owen opens the review within 5 business days of the change event.
- **Decision at threshold:** every material decision in scope of the DOA matrix triggers a real-time `AuthorityLevelExercised` event at execution time; the event store validates that the acting party holds the required authority level for the decision type and value.
- **Agent escalation:** any agent-runtime action that would exceed Level 4 authority limits automatically pauses and emits `EscalationRequired`; this procedure defines the resolution path.

## 5. Steps

### 5A — Annual DOA review

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Owen retrieves the current DOA matrix from the policy document store and the most recent `DelegationOfAuthorityApproved` event | `human` (Owen) | `@platform/document-store` (`PLANNED`) | Version-controlled; the event carries the matrix-hash for integrity. |
| 2 | Review all four authority levels against the current organisational structure, regulatory changes, and risk appetite; identify proposed changes | `human` (Owen + Devon) | — | EXCO-level changes require CEO concurrence before Board submission. |
| 3 | Circulate the draft revised matrix for peer challenge: CEO, CRO (Helena, Chief Risk Officer), CFO (Camille, Chief Financial Officer), COO (Devon), CCO (Zara), CISO (Senna) | `human` (Owen → EXCO) | `@domains/governance/board-papers` (`PLANNED`) | Peer challenge is a named step per Governance Framework; comments are recorded. |
| 4 | Submit the revised DOA matrix to the Board for approval; Board approval is minuted in the statutory minutes | `human` (Owen → Board) | `@domains/governance/board-papers` (`PLANNED`) | The matrix is a Board-reserved matter (ORG-GV-02); cannot be approved at CEO level. |
| 5 | On Board approval: emit `DelegationOfAuthorityApproved { version, effective_date, matrix_hash, approved_by: 'board', minute_reference }` | `system` → `human` (Owen triggers) | `@platform/event-store` ✓ | The event is the canonical record of the approved matrix; the markdown is a render. |
| 6 | Publish the approved matrix to the policy intranet; update the agent-runtime authority-limit configuration | `system` (Owen triggers) | `@platform/document-store` (`PLANNED`) + `@platform/agent-runtime/authority-config` (`PLANNED`) | Agent-runtime reads authority limits from the configuration derived from the latest `DelegationOfAuthorityApproved` event. |
| 7 | Emit `DelegationOfAuthorityUpdated { prior_version, new_version, changes_summary }` if this is an amendment (not the inaugural approval) | `system` | `@platform/event-store` ✓ | Vera is notified of the update and runs a post-update recon sweep (see Section 6). |

### 5B — Real-time authority exercise (all in-scope decisions)

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 8 | Actor (human or agent) initiates a decision or commitment in scope of the DOA matrix | `system` or `human` | Depends on decision type | Examples: executing a contract, approving a budget line, onboarding a counterparty. |
| 9 | The authority-validation layer checks the actor's authority level against the decision type and financial / risk threshold in the DOA configuration | `system` | `@platform/agent-runtime/authority-config` (`PLANNED`) | Synchronous check; decision is blocked until authority is confirmed. |
| 10 | If authority is confirmed: emit `AuthorityLevelExercised { decision_type, level, actor, value, threshold_used, timestamp }` and allow the decision to proceed | `system` | `@platform/event-store` ✓ | Every material decision in the DOA scope must produce this event; absence is a recon finding. |
| 11 | If authority is NOT confirmed (actor below required level): block the decision; emit `EscalationRequired { decision_type, current_actor, current_level, required_level, value, blocking_event_id }` | `system` | `@platform/event-store` ✓ | The blocking event must be resolved before the decision can proceed. |
| 12 | Route the escalation to the appropriate authority level: Level 1 (Board), Level 2 (CEO/EXCO), Level 3 (Function Head), Level 4 (Operational) | `system` | `@domains/governance/escalation-routing` (`PLANNED`) | Routing logic is derived from the DOA configuration. |
| 13 | The higher-authority actor reviews and decides; emit `EscalationResolved { escalation_event_id, decision, actor, level, timestamp }` | `human` (appropriate level) | `@platform/event-store` ✓ | Human decision on the escalation is the canonical resolution record. |

## 6. Reconciliation

- **Events produced:**
  - `DelegationOfAuthorityApproved { version, effective_date, matrix_hash, approved_by, minute_reference }` — Board approval of the DOA matrix (inaugural or revised).
  - `DelegationOfAuthorityUpdated { prior_version, new_version, changes_summary }` — amendment record.
  - `AuthorityLevelExercised { decision_type, level, actor, value, threshold_used, timestamp }` — per material in-scope decision.
  - `EscalationRequired { decision_type, current_actor, current_level, required_level, value, blocking_event_id }` — authority-limit breach trigger.
  - `EscalationResolved { escalation_event_id, decision, actor, level, timestamp }` — resolution of an escalation.
- **Reconciliation invariants:**
  - All `CeoDecision`, `PolicyApproved`, `LargeContractExecuted`, and `NewProductApproved` events must carry an `authority_level` field matching the DOA matrix in force at the time of the event. Vera runs this check quarterly; any event missing the field or carrying a mis-matched level is a finding.
  - Every `EscalationRequired` event must have a downstream `EscalationResolved` event within the applicable SLA. Open escalations older than 5 business days are reported to the Board.
  - The `DelegationOfAuthorityApproved` event must exist before any Level 1–4 authority exercise is recognised as valid. The first event is the inaugural Board approval at licence-day.
  - Agent-runtime Level 4 decisions must not exceed the financial threshold in the DOA configuration. The authority-validation layer enforces this synchronously; any bypass is a critical finding.
- **Failure mode:** if the authority-validation layer is unavailable, all Level 2+ decisions are blocked (fail-closed for Level 2 and above); Level 4 routine operations may continue under a pre-approved standing authority list, but all such actions must be tagged `contingency_authority: true` and reviewed by Devon within 24 hours.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `DelegationOfAuthorityApproved` events | Event log | Permanent (P1) | Confidential |
| DOA matrix versions (content-addressed) | Document store | Permanent | Confidential |
| Board minutes referencing DOA approval | Document store | 7 years (Companies Act s.24) | Confidential |
| `AuthorityLevelExercised` events | Event log | Permanent (P1) | Internal |
| `EscalationRequired` and `EscalationResolved` events | Event log | Permanent (P1) | Confidential |
| Vera quarterly recon reports | Owner Inbox (RMS Audit register post-Phase 1) | 5 years | Internal |

## 8. Manual steps

- **Steps 2–4** — the annual DOA review and Board approval are human deliberative processes; Owen and Devon lead the drafting; Board approval is a quorum vote; these steps cannot be automated.
- **Step 13** — escalation resolution is a human discretionary judgment; the agent runtime surfaces the escalation and the relevant context but does not participate in the decision.
- **Board-reserved matters** cannot be resolved by any automated or agent-initiated event: any `DelegationOfAuthorityApproved` event without a matched Board minute reference is rejected by the event-store gate.
- During the pre-licence build phase, Marc wears both the CEO and Board chair roles interim; all Board-level approvals are recorded with `actor: "marc@tgv.co.za"` and `role: "interim-board"` until the Board is constituted.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Material decision executed without `AuthorityLevelExercised` event | Vera quarterly recon of `CeoDecision`, `PolicyApproved`, `LargeContractExecuted` | Owen → Board; Vera finding; retrospective ratification or reversal |
| Agent-runtime action exceeds Level 4 threshold without escalation | Authority-validation layer blocks and emits `EscalationRequired`; if bypassed, Vera detects absence of `AuthorityLevelExercised` | Devon + Senna immediately; agent runtime suspended pending investigation |
| `EscalationRequired` open > 5 business days | Escalation-aging projection in the event store | Owen notifies the Board; Devon activates manual resolution |
| DOA matrix not reviewed in 12-month window | Owen calendar trigger; Vera annual compliance check | Owen initiates emergency review; Board notified |
| Authority-validation layer unavailable | Health-check on `@platform/agent-runtime/authority-config` | Mira + Devon immediately; Level 2+ decisions blocked; standing authority fallback activated |
| DOA approved at sub-Board level | Event-store gate: `DelegationOfAuthorityApproved` without Board minute reference is rejected | Owen immediately; event voided; proper Board approval re-initiated |

## 10. Related procedures

- `delegation-of-authority.md` (this file) is referenced by all procedures that contain human-in-the-loop decision points for threshold authority; procedure authors must cite the relevant DOA level in their Steps table.
- `kyc-recurring.md` — relationship exit decisions at Step 14 are Level 2 (EXCO) per this matrix.
- `sanctions-screening.md` — MLRO override authority is a Level 3 Function-Head reserved matter.
- `str-filing.md` — MLRO STR decision is a Level 3 matter.
- `kyc-onboarding.md` — client acceptance decisions above standard-risk tier require Level 3 sign-off.
- `new-product-due-diligence.md` — NPA Board sign-off is a Level 1 Board-reserved matter.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Owen + Devon | Initial stub — all 9 sections; system capabilities PLANNED; four authority levels defined; agent-runtime Level 4 limits encoded. |
| v0.2 | 2026-05-15 | Owen (Company Secretary, governance) + Devon (Chief Operating Officer, governance) | Promoted to POPULATED — all 12 sections verified complete. |

## 12. Audit / assurance

- Vera quarterly recon: all `CeoDecision`, `PolicyApproved`, and `LargeContractExecuted` events carry `authority_level` matching the in-force DOA matrix. Deviations are findings to the Audit Committee.
- Annual Board review: Owen presents a summary of escalations raised, resolved, and aged; the Board approves the refreshed matrix.
- Vera cross-checks the `DelegationOfAuthorityApproved` event chain annually to confirm no gaps in coverage (i.e., that there is a valid approved matrix in force at all times from licence-day forward).
- Model-risk angle: the authority-validation layer's threshold configuration is a Tier 1 system control; any tuning or reconfiguration requires a change event signed by Devon and Senna and recorded in the change-management log.
