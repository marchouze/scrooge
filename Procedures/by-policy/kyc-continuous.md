# Procedure — KYC continuous monitoring (event-triggered CDD)

**Procedure ID:** PROC-FC-KYC-C-01
**Owner:** Zara (Chief Compliance Officer, governance) · Mira (Regulatory intelligence engineer, compliance)
**Approval:** BRC
**Cadence:** Continuous (event-triggered; runs on every KYC signal ingestion)
**Version:** v0.1 — 2026-05-13
**Status:** STUB

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §4 — KYC / CDD / EDD Policy.
`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §3 — RMCP (Risk Management and Compliance Programme).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FC-04` (FIC Act s.21B + FATF Rec. 10 + FATF Rec. 22) | Keep client information current; monitor the business relationship on an ongoing basis throughout its life. |
| `ORG-FC-05` (FIC Act s.21G + FATF Rec. 12) | Apply EDD to higher-risk clients and PEPs; monitor PEP relationships on an enhanced, continuous cadence; apply 12-month cooling-off for former PEPs. |
| `ORG-FC-03` (FIC Act s.28 read with RMCP obligations + FATF Rec. 10) | Monitor transactions for patterns inconsistent with the client's risk profile; escalate anomalies to the MLRO for STR consideration. |
| `ORG-FC-13` (UN/OFAC/EU/UK HMT/POCDATARA + RAS B4) | Re-screen existing clients against sanctions-list deltas; block any newly designated client relationship pre-further-action. |
| `ORG-FC-02` (FIC Act ss.21–21H) | When CDD cannot be completed or refreshed to the required standard, the accountable institution must terminate or not establish the relationship. |

## 3. Purpose

Detect and act on KYC-relevant signals that arise between scheduled periodic refresh cycles. While `kyc-recurring.md` (PROC-FC-KYC-R-01) governs calendar-driven full CDD refresh, this procedure covers the complementary real-time signal-processing path: any event that changes the risk profile of an existing client — a sanctions-list delta, a PEP status change, an ownership change, or a transaction-pattern anomaly — must be ingested, severity-classified, and actioned within defined SLAs, without waiting for the next scheduled refresh.

The two procedures are complementary and both required under FIC Act s.21B ongoing-monitoring obligations. Continuous monitoring catches intra-cycle risk; recurring refresh validates the entire CDD record comprehensively.

## 4. Trigger

Any of the following events triggers this procedure:

| Signal type | Source | Event emitted |
|---|---|---|
| Sanctions list delta (new or updated designation) | Licensed sanctions data provider; UNSCR; OFAC; EU OJ; UK HMT; DTI / POCDATARA | `KYCSignalIngested { signal_type: sanctions_list_delta }` |
| Adverse media hit | Licensed adverse media feed (keyword or entity match) | `KYCSignalIngested { signal_type: adverse_media }` |
| PEP status change | Licensed PEP database; client self-notification; third-party intelligence | `KYCSignalIngested { signal_type: pep_status_change }` |
| UBO / ownership change | CIPC registry delta; client-submitted UBO declaration; third-party corporate intelligence | `KYCSignalIngested { signal_type: ubo_ownership_change }` |
| Transaction pattern anomaly | Transaction monitoring engine (`TransactionMonitoringAlert { signal_type: pattern_anomaly }`) | `KYCSignalIngested { signal_type: transaction_pattern_anomaly }` |
| Regulatory / legal event | Court orders, regulatory sanctions, insolvency filings involving the client or a UBO | `KYCSignalIngested { signal_type: regulatory_legal_event }` |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Ingest signal and emit `KYCSignalIngested` with `client_id`, `signal_type`, `signal_source`, `raw_signal_reference`, `ingestion_timestamp` | `system` (signal-ingest adapter) | `@platform/kyc/signal-ingestor` (`PLANNED`) | Each signal type has a dedicated adapter. Duplicate-suppression prevents the same signal from opening multiple cases for the same client within a 24-hour window. |
| 2 | Classify severity: Low / Medium / High / Critical | `system` (risk-rating engine) | `@platform/risk-rating` (`PLANNED`) | Classification rules: see severity matrix in §5 notes below. Critical = confirmed sanctions hit or confirmed PEP designation. High = unconfirmed sanctions near-match, adverse media with material risk indicators, UBO change that may affect control structure. Medium = adverse media with limited indicators, PEP cooling-off period change, minor UBO change. Low = routine monitoring update with no adverse indicators. |
| 3a | **Low severity:** log signal; tag for incorporation at next scheduled refresh; no immediate restriction | `system` | `@platform/kyc/signal-ingestor` (`PLANNED`) | Emit `KYCContinuousReviewTriggered { severity: low }`. No further steps in this run; absorbed into `kyc-recurring.md` at next cycle. |
| 3b | **Medium severity:** flag for analyst review within 5 business days; emit `KYCContinuousReviewTriggered { severity: medium }`; open case in case-management | `system` → `human` (Mira analyst) | `@domains/screening/case-mgmt` (`PLANNED`) | Pending analyst review, no immediate restriction on the relationship. SLA: analyst decision within 5 business days. Breached SLA auto-escalates to Zara. |
| 3c | **High severity:** notify MLRO within 24 hours; flag relationship `KYCEnhancedReview`; initiate EDD steps (Step 4) | `system` (notification) → `human` (Zara, MLRO) | `@platform/kyc/edd-workflow` (`PLANNED`) | Emit `KYCContinuousReviewTriggered { severity: high }` and `KYCEnhancedReviewOpened`. Relationship may continue pending EDD unless Zara restricts it. |
| 3d | **Critical severity (sanctions hit or confirmed PEP designation):** immediate escalation to MLRO; relationship flagged `FROZEN`; STR/TPR consideration triggered; no further transactions pending determination | `system` (immediate freeze) → `human` (Zara, MLRO) | `@platform/screening` (`PLANNED`) + `@platform/event-store` ✓ | Emit `KYCContinuousReviewTriggered { severity: critical }` and `KYCEnhancedReviewOpened`. Invoke `sanctions-screening.md` inline for the sanctions-hit sub-path. Route to `str-filing.md` if MLRO determines STR is required. |
| 4 | EDD steps (High / Critical): re-verify identity documents; re-walk UBO chain to natural persons; obtain source-of-funds / source-of-wealth explanation; obtain senior-management approval to continue the relationship | `human` (Mira analyst + Zara/MLRO) | `@domains/onboarding/edd` (`PLANNED`) | Each EDD step is a typed event (e.g. `EDDDocumentRequested`, `EDDDocumentReceived`, `EDDReviewCompleted`). Senior-management approval is a `SeniorManagementApprovalGranted` event; required by FIC Act for high-risk continuation. |
| 5 | MLRO / analyst determines outcome: continue relationship unchanged; continue with enhanced restrictions; exit relationship | `human` (Zara, MLRO; or Mira analyst for Medium under delegation) | `@domains/screening/case-mgmt` (`PLANNED`) | Emit `KYCEnhancedReviewCompleted { outcome: continue | restrict | exit }`. If `exit`: proceed to Step 6. |
| 6 | Controlled exit: MLRO authorises wind-down plan; notify FIC/DPCI if exit is a consequence of a sanctions designation (see `sanctions-override.md` for the controlled-exit override sub-path); close out open positions; emit `KYCRelationshipExitTriggered` | `human` (Zara, MLRO) → `system` | `@domains/client/lifecycle` (`PLANNED`) | Exit timeline must be documented. For TFS-related exits the controlled-exit path in `sanctions-override.md` (PROC-FC-SO-01) governs permissible exit transactions. |
| 7 | Close case; update CDD record with signal, severity, outcome, and reviewer identity; tag for next recurring refresh | `system` | `@platform/kyc/signal-ingestor` (`PLANNED`) + `@platform/event-store` ✓ | Emit `KYCContinuousReviewClosed { case_id, signal_type, severity, outcome }`. The CDD record in the client-master projection is updated with the signal and outcome. |

### Severity classification matrix

| Signal type | Default severity | Escalation trigger |
|---|---|---|
| Sanctions list delta — exact/strong match | Critical | Immediate |
| Sanctions list delta — weak/near match | High | MLRO 24h |
| PEP designation — new (client or UBO) | Critical | Immediate |
| PEP — former PEP entering 12-month cooling-off | Medium | Analyst 5 BD |
| Adverse media — material (e.g., fraud, money laundering allegations) | High | MLRO 24h |
| Adverse media — limited indicators | Medium | Analyst 5 BD |
| UBO / ownership change — change of control | High | MLRO 24h |
| UBO / ownership change — minor restructure, no control change | Medium | Analyst 5 BD |
| Transaction pattern anomaly — severe (threshold breach, unusual counterparty) | High | MLRO 24h |
| Transaction pattern anomaly — routine (statistical flag, no primary indicator) | Low | Next refresh |
| Regulatory / legal event — insolvency, court order, regulatory sanction | High | MLRO 24h |

## 6. Reconciliation

- **Events produced (in-order per case):**
  1. `KYCSignalIngested { client_id, signal_type, signal_source, severity, ingestion_timestamp }` — input to this procedure
  2. `KYCContinuousReviewTriggered { case_id, client_id, signal_type, severity }` — classifies and opens the case
  3. `KYCEnhancedReviewOpened { case_id, client_id, reason }` — emitted for High / Critical only
  4. (If EDD) `EDDDocumentRequested`, `EDDDocumentReceived`, `EDDReviewCompleted` — EDD sub-chain
  5. `KYCEnhancedReviewCompleted { case_id, outcome: continue | restrict | exit }` — MLRO/analyst decision
  6. (If exit) `KYCRelationshipExitTriggered { case_id, client_id, reason }`
  7. `KYCContinuousReviewClosed { case_id, signal_type, severity, outcome }` — closes the case
- **Reconciliation invariants:**
  - Every `KYCSignalIngested` is followed by exactly one `KYCContinuousReviewTriggered` within **15 minutes** of ingestion. Signals without a triggered review within 15 minutes fire a health-check alert.
  - Every High or Critical `KYCContinuousReviewTriggered` is followed by a `KYCEnhancedReviewOpened` within **1 hour**.
  - Every `KYCEnhancedReviewOpened` is followed by a `KYCEnhancedReviewCompleted` within the SLA thresholds: High = 10 business days; Critical = 2 business days (or relationship freeze applies).
  - Every `KYCEnhancedReviewCompleted { outcome: exit }` is followed by a `KYCRelationshipExitTriggered`.
  - Every `KYCContinuousReviewTriggered` is followed by a `KYCContinuousReviewClosed` (no open-ended cases).
  - A client may not appear in the active-client projection with a `FROZEN` flag and a terminal-success transaction event in the same time window.
- **Failure mode:** signal ingestor unavailable → upstream trigger (sanctions feed, transaction-monitoring engine) re-queues signal; ingestor has a dead-letter queue; Mira notified if DLQ depth > 0.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `KYCSignalIngested` events (all) | Event log | Permanent (Principle 1) | High |
| `KYCContinuousReviewTriggered` / `KYCContinuousReviewClosed` events | Event log | Permanent | High |
| `KYCEnhancedReviewOpened` / `KYCEnhancedReviewCompleted` events | Event log | Permanent | High |
| EDD documents (re-verified identity, source-of-funds/wealth) | Document store; field-level encrypted | 5 years post-relationship end (FIC s.22) | High (PII) |
| Senior-management approval events for high-risk continuation | Event log | Permanent | High |
| Adverse media reports (licensed feed extracts) | Document store | 5 years post-relationship end | High |
| Relationship-exit records | Event log + document store | 5 years post-exit (FIC s.22) | High (PII) |
| Signal-ingestor health-check logs | Operational log | 3 years | Internal |

## 8. Manual steps

- **Steps 3b / 4 / 5 (Medium/High analyst review):** human analyst judgement is required to assess whether the adverse media, ownership, or pattern signal is material. Automation routes, classifies, and pre-fills the case; the risk determination and continuation/exit decision for Medium cases are human under delegation from Zara.
- **Step 3c / 3d (MLRO notification and determination for High/Critical):** the MLRO (Zara) must personally review and sign off on the outcome for High and Critical cases. The platform may not auto-clear a High/Critical case without a `KYCEnhancedReviewCompleted` event bearing Zara's agent identity. This is a statutory non-delegable responsibility under FIC Act.
- **Step 4 (EDD execution):** source-of-funds/wealth interviews and document review require human discretion. The EDD workflow tool pre-fills; the human reviews and approves each document with a typed event.
- **Step 6 (controlled exit):** the wind-down plan and authorisation of exit transactions are human discretion (MLRO); the platform executes within the authorised perimeter.

These manual steps are tracked exceptions under Principle 2; each produces a typed event with the actor's identity (Principle 6).

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Signal ingestor unavailable (DLQ > 0) | Health-check alert; DLQ depth monitor | Mira immediately; signals re-queued; if ingestor down > 30 min, Zara notified |
| High/Critical case not opened within 1 hour of trigger | Projection SLA monitor | Auto-alert to Zara (MLRO); case pulled into manual triage |
| MLRO review SLA breach (High: 10 BD; Critical: 2 BD) | Projection SLA monitor | Zara → BRC if systemic; individual breach logged as Vera finding |
| EDD cannot be completed (client non-responsive, documents unavailable) | Case age + document-request events | Zara determines whether to restrict or exit; FIC Act s.21C termination path if required |
| Sanctions feed delta ingestion fails | Health-check on ingestion cadence; see `sanctions-screening.md` §9 | Senna + Mira immediately; fail-closed if stale > 24 hours (no re-screening without a current list version) |
| PEP database unavailable for status check | Health-check on PEP feed | Mira immediately; manual PEP check on open cases; Zara informed |
| Pattern of signals for same client not producing escalation | Vera quarterly sample | Vera finding → Zara → BRC |

## 10. Related procedures

- `kyc-onboarding.md` (PROC-FC-01) — initial CDD gate; continuous monitoring picks up where onboarding's snapshot ends.
- `kyc-recurring.md` (PROC-FC-KYC-R-01) — calendar-driven full CDD refresh; Low-severity signals from this procedure are absorbed at the next recurring cycle.
- `sanctions-screening.md` (PROC-FC-02) — invoked inline at Step 3d for sanctions-hit sub-path; owns the screening engine and list-integrity attestation.
- `sanctions-override.md` (PROC-FC-SO-01) — controlled-exit override sub-path for TFS-designated clients exiting the relationship.
- `str-filing.md` (PROC-FC-STR-01) — MLRO STR/TPR determination path from Critical signals; escalates from Step 3d.
- `transaction-monitoring.md` (PROC-FC-TM-01) — upstream producer of `TransactionMonitoringAlert { signal_type: pattern_anomaly }` events consumed here.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Mira (Regulatory intelligence engineer, compliance) · Zara (Chief Compliance Officer, governance) | Initial stub. All 9 sections drafted; system capabilities `PLANNED`; pending BRC review and approval. |

## 12. Audit / assurance

Vera (Internal audit engineer, engineering) consumes `KYCSignalIngested`, `KYCContinuousReviewTriggered`, `KYCEnhancedReviewOpened`, and `KYCEnhancedReviewCompleted` events as continuous-controls evidence.

Quarterly sample test by Vera: 20 randomly selected High/Critical cases from the event log; trace through the full event chain to verify:
1. Signal ingest → trigger within 15 minutes.
2. Trigger → enhanced review open within 1 hour (High/Critical).
3. EDD steps each carry a typed event with non-empty actor identity.
4. MLRO sign-off event is present and carries Zara's agent identity.
5. Case closed with outcome event.

Deviations reported to BRC as compliance findings. Pattern of SLA breaches is a Tier 1 finding. Any case where a client remained active after a Critical trigger without a `KYCEnhancedReviewCompleted` event is an immediate Vera escalation to BRC and the MLRO.
