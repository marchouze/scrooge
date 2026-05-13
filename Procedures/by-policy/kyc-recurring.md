# Procedure — KYC Periodic Refresh (Recurring CDD)

**Procedure ID:** PROC-FC-KYC-R-01
**Owner:** Zara (Chief Compliance Officer, governance) · Mira (Regulatory intelligence engineer, compliance)
**Approval:** BRC
**Cadence:** Annual (standard risk); 6-monthly (high risk / PEP); event-triggered (material change)
**Version:** v0.1 — 2026-05-13
**Status:** STUB

## 1. Source policy

`Policies/risk-management-and-compliance-policy-v1.md` (RMCP) — AML/CFT Policy annex.
RAS B3 (CEO approved 2026-05-06): low appetite for financial-crime risk; ongoing CDD is a standing obligation from FIC Act commencement of trading.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FC-02` (FIC Act s.21B — ongoing CDD obligation) | Apply customer due diligence at prescribed intervals; update client information throughout the relationship. |
| `ORG-FC-04` (FIC Act s.21B ongoing monitoring) | Keep client information up to date and accurate; ensure the risk profile reflects current intelligence. |
| `ORG-FC-05` (FIC Act s.21G — EDD for higher-risk) | Apply enhanced due diligence for higher-risk clients including politically exposed persons (PEPs). |

## 3. Purpose

Ensure that every client record in the Bank's KYC register remains current, accurate, and risk-calibrated throughout the life of the relationship. Periodic refresh prevents stale CDD from accumulating risk exposure undetected; event-triggered refresh catches material changes between scheduled review dates.

## 4. Trigger

Two independent trigger types:

- **Calendar trigger** — the KYC register projection emits a `KYCRefreshScheduled` event when a client's `last_kyc_completed` timestamp exceeds the applicable window: 12 months for standard-risk clients, 6 months for high-risk / PEP clients.
- **Event trigger** — any `KYCSignalIngested { signal_type: material_change }` event causes an immediate `KYCRefreshInitiated` for the affected client. Material-change signal types include: ownership or UBO change, adverse media hit, sanctions-list addition or amendment, PEP status change, or a client-initiated notification of a structural change.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | KYC register projection evaluates each client's `last_kyc_completed` against the applicable cadence window; for event-triggered refreshes, the `KYCSignalIngested` event fires the refresh immediately | `system` | `@domains/kyc/refresh-scheduler` (`PLANNED`) | Cadence windows are configuration parameters; changes require MLRO approval event. |
| 2 | Emit `KYCRefreshScheduled` (calendar) or `KYCRefreshInitiated` (event-triggered) for the client | `system` | `@platform/event-store` ✓ | Both event types carry `client_id`, `risk_tier`, `trigger_type`, `due_date`. |
| 3 | Retrieve current client record: entity type, ownership / UBO chain, authorised signatories, business activities, source of funds/wealth, jurisdiction, and the prior risk rating | `system` | `@domains/kyc/client-record-service` (`PLANNED`) | Comparison baseline for refresh scope determination. |
| 4 | Determine refresh scope based on risk tier: standard-risk = document confirmation + screening refresh; high-risk / PEP = full re-verification including EDD step (Step 7) | `system` → `human` (Mira compliance engineer) | `@domains/kyc/scope-engine` (`PLANNED`) | Scope rules are coded; Mira reviews exceptions where automated scope is ambiguous. |
| 5 | For legal-entity clients: re-walk the UBO chain to the 25%-threshold natural person; flag any UBO delta vs. prior record for human review | `system` | `@domains/kyc/ubo-chain-walker` (`PLANNED`) | Cross-reference `Procedures/by-policy/ubo-chain-verification.md`. Any UBO change triggers mandatory EDD (Step 7). |
| 6 | Collect / confirm refresh documents from client: ID documents, certificate of incorporation or equivalent, ownership structure chart, source-of-funds / source-of-wealth declaration (if changed) | `human` (client relationship manager / agent-runtime within authority limits) | `@domains/kyc/document-collection` (`PLANNED`) | Client receives a scoped document-request list generated from the scope engine output. Emit `KYCDocumentCollected` per document received. |
| 7 | **EDD step (high-risk / PEP / UBO-change clients only):** conduct enhanced due diligence — senior management sign-off on the relationship, detailed source-of-wealth verification, assessment of purpose and nature of relationship, corroborating open-source intelligence | `human` (MLRO for sign-off; Mira for intelligence gather) | `@domains/kyc/edd-workflow` (`PLANNED`) | EDD outcome is recorded as a typed event with `signed_by` field; EDD without MLRO signature is rejected. |
| 8 | Run sanctions and PEP re-screen against all current lists (UN, OFAC, EU, UK HMT, DTI / POCDATARA) and licensed PEP database | `system` | `@platform/screening/api` (`PLANNED`) | Invokes `Procedures/by-policy/sanctions-screening.md` inline. Emit `KYCSanctionsPEPRescreened { client_id, lists, list_version_hash, hits }`. Any new hit triggers immediate MLRO escalation — pause refresh. |
| 9 | Assess whether the client's risk rating should be confirmed or revised in light of the refreshed information | `system` → `human` (Mira; MLRO for downgrades from standard to high) | `@domains/kyc/risk-rating-engine` (`PLANNED`) | Automated scoring provides a recommendation; human reviews material changes. |
| 10 | If risk rating is revised downward (standard → high), trigger EDD if not already completed; if revised upward (high → standard), require MLRO written sign-off as a prerequisite before `KYCRiskRatingRevised` can be emitted | `human` (MLRO) | `@platform/event-store` ✓ | A `KYCRiskRatingRevised` event without a matching MLRO-signed EDD or sign-off event is a projection invariant violation. |
| 11 | Emit `KYCRiskRatingConfirmed` or `KYCRiskRatingRevised` with the new rating and all supporting event IDs as citations | `system` | `@platform/event-store` ✓ | Rating is recorded in the KYC register projection. |
| 12 | Update the client record in the KYC register projection; emit `KYCRefreshCompleted { client_id, risk_tier_after, next_due_date }` | `system` | `@domains/kyc/client-record-service` (`PLANNED`) | `next_due_date` is computed from the new risk tier. |
| 13 | **Non-response handling:** if the client has not provided required documents within 30 days of the initial document-request, emit `KYCRefreshOverdue`; notify MLRO; flag the relationship in the register | `system` → `human` (MLRO) | `@domains/kyc/refresh-scheduler` (`PLANNED`) | MLRO decides whether to extend, restrict the relationship, or escalate to exit. |
| 14 | **60-day escalation:** if the client remains non-responsive at 60 days from the document-request date, escalate to MLRO for potential relationship exit decision | `human` (MLRO → EXCO if exit required) | `@domains/kyc/escalation` (`PLANNED`) | Relationship exit is an EXCO-level decision (Level 2, DOA matrix). |

## 6. Reconciliation

- **Events produced (in sequence):**
  - `KYCRefreshScheduled { client_id, risk_tier, cadence_window_months, due_date }` — calendar trigger.
  - `KYCRefreshInitiated { client_id, trigger_type: calendar | material_change, signal_event_id? }` — start of active refresh.
  - `KYCDocumentCollected { client_id, document_type, received_at }` — per document received from client.
  - `KYCSanctionsPEPRescreened { client_id, lists, list_version_hash, hits, hit_ids[] }` — result of re-screen.
  - `KYCRiskRatingConfirmed { client_id, rating }` or `KYCRiskRatingRevised { client_id, prior_rating, new_rating, mlro_sign_off_event_id }` — rating outcome.
  - `KYCRefreshCompleted { client_id, risk_tier_after, next_due_date, refresh_event_ids[] }` — successful completion.
  - `KYCRefreshOverdue { client_id, request_date, overdue_at, days_overdue }` — non-response flag.
- **Reconciliation invariants:**
  - Every client with a `KYCOnboardingCompleted` event must have a `KYCRefreshCompleted` event within the applicable cadence window. Vera runs this check weekly; deviations are reported as findings to Zara and the BRC.
  - Every `KYCRefreshCompleted` event must have an upstream `KYCSanctionsPEPRescreened` event in the same refresh cycle. No refresh can be marked complete without a screening step.
  - Every `KYCRiskRatingRevised` event for a downgrade (to high / PEP) must be preceded by a `KYCEDDCompleted` event carrying an MLRO-signed event ID.
  - Every `KYCRiskRatingRevised` event for an upgrade (to standard) must carry an `mlro_sign_off_event_id` field.
- **Failure mode:** if the refresh scheduler is unavailable, no `KYCRefreshScheduled` events are emitted. The Vera weekly invariant check detects this as a population of clients with stale refresh dates; alert fires to Mira and Zara. Screening-service unavailability follows the fail-closed rule in `sanctions-screening.md` Step 8.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `KYCRefreshCompleted` events | Event log | Permanent (P1) | High |
| `KYCSanctionsPEPRescreened` events | Event log | Permanent (P1) | High |
| Collected documents (ID, ownership charts, SoW declarations) | Document store (content-addressed) | 5 years post-relationship exit (FIC Act s.22) | High (PII) |
| EDD records and MLRO sign-off events | Event log + document store | 5 years post-relationship exit | Critical |
| `KYCRefreshOverdue` events and escalation records | Event log | 5 years post-resolution | High |
| Vera weekly invariant-check reports | Owner Inbox (or RMS Audit register post-Phase 1) | 3 years | Internal |

## 8. Manual steps

- **Step 6** — client document collection involves human interaction with the client contact (relationship manager or compliance analyst); the agent runtime handles scheduling and chasing within Level 4 authority limits; escalation to human relationship management requires a human-in-the-loop event above those limits.
- **Step 7** — EDD is exclusively human: MLRO sign-off is required and cannot be delegated to the agent runtime. The platform enforces this at the event-store layer (MLRO signature required on `KYCEDDCompleted`).
- **Step 10** — MLRO written sign-off for risk-rating revisions in both directions is a manual discretionary judgment that binds the bank.
- **Step 14** — potential relationship exit is an EXCO-level decision; human EXCO quorum is required per the DOA matrix (`delegation-of-authority.md`).
- Tipping-off restrictions (FIC Act s.29(3)): access to refresh records for clients under active STR investigation is restricted to the named MLRO investigation set; standard compliance staff are excluded.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Client in cadence window with no `KYCRefreshCompleted` | Vera weekly invariant check | Zara → BRC; relationship restricted pending resolution |
| Refresh completed without upstream `KYCSanctionsPEPRescreened` | Projection invariant check on `KYCRefreshCompleted` emit | Mira immediately; Zara notified; event rejected |
| `KYCRiskRatingRevised` (downgrade) without EDD | Event-store gate rejects the event | Mira + Zara immediately; MLRO to complete EDD |
| `KYCRiskRatingRevised` (upgrade) without MLRO sign-off | Event-store gate rejects the event | Zara; MLRO sign-off required before event is accepted |
| Screening service unavailable at refresh time | Health-check on `@platform/screening/api` | Mira immediately; refresh blocked until screening restored (fail-closed) |
| Client non-responsive at 30 days | `KYCRefreshOverdue` emitted by scheduler | MLRO notified; MLRO decides restriction or extension |
| Client non-responsive at 60 days | Scheduler 60-day escalation event | MLRO → EXCO; potential exit decision |
| EDD without MLRO signature accepted | Cryptographic gate refuses; Vera audit log | Automatic event to Audit Committee; Vera investigates |

## 10. Related procedures

- `kyc-onboarding.md` — initial CDD; this procedure is the recurring counterpart.
- `sanctions-screening.md` — invoked inline at Step 8.
- `ubo-chain-verification.md` (`PLANNED`) — UBO chain re-walk at Step 5.
- `kyc-continuous.md` (`PLANNED`) — continuous KYC monitoring between scheduled refresh cycles; distinct from this periodic procedure.
- `str-filing.md` — STR filing path if refresh uncovers grounds for suspicion.
- `delegation-of-authority.md` — governs authority levels for relationship exit decisions at Step 14.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Mira + Zara | Initial stub — all 9 sections; system capabilities PLANNED. |

## 12. Audit / assurance

- Vera weekly invariant check: all `KYCOnboardingCompleted` clients have a `KYCRefreshCompleted` within the applicable cadence window. Deviations reported as findings to Zara and BRC.
- Vera quarterly sample: spot-check that `KYCRefreshCompleted` events carry upstream `KYCSanctionsPEPRescreened` and (for high-risk clients) `KYCEDDCompleted` events in the same cycle.
- Annual effectiveness review of the risk-rating engine's scoring calibration (model-risk Tier 2 per Model Risk Policy).
- BRC receives a monthly dashboard tile: percentage of clients by risk tier with current vs. overdue refresh status.
