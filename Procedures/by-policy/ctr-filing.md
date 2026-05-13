# Procedure — Cash Threshold Report (CTR) Filing

**Procedure ID:** PROC-FC-CTR-01
**Owner:** Zara (Chief Compliance Officer, governance) — MLRO · Mira (Regulatory intelligence engineer, compliance)
**Approval:** BRC
**Cadence:** Continuous (per qualifying transaction); monthly submission cycle to FIC
**Version:** v0.1 — 2026-05-13
**Status:** STUB

---

## 1. Source policy

`Policies/aml-cft-policy-v1.md` — AML/CFT Policy §6 (Cash Threshold Reporting obligations).
RMCP — overarching obligation to have a documented CTR procedure and to ensure all qualifying transactions are captured and reported within the statutory timeline.
`Policies/sanctions-policy-v1.md` — cross-reference: structuring patterns detected during CTR aggregation may simultaneously trigger an STR filing obligation.
RAS B1–B3 (CEO approved 2026-05-06): zero appetite for wilful non-reporting; CTR filing is mandatory for all qualifying transactions; structuring avoidance is itself reportable.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FC-09` | Report cash transactions ≥ R49,999 to the FIC within the prescribed period (FIC Act s.28 Cash Threshold Reports). |
| `ORG-FC-10` | Report electronic fund transfers ≥ R24,999 to the FIC where required under FIC Act s.28B. |
| `ORG-FC-11` | Retain CTR records and supporting transaction data for a minimum of 5 years (FIC Act s.22; FICA Regulation 24). |
| `ORG-FC-12` | Structuring to avoid threshold reporting is prohibited; the bank must detect and aggregate structured transactions and treat confirmed structuring as a suspicious activity triggering STR consideration (FIC Act s.28(3)). |

## 3. Purpose

Ensure that every transaction (or structured series of transactions) meeting the FIC Act s.28 cash threshold or the FIC Act s.28B EFT threshold is detected automatically from the event store, assembled into a FIC-prescribed Cash Threshold Report, and submitted to the Financial Intelligence Centre via the goAML portal within the statutory 15-day submission window. The procedure also governs structuring detection — where multiple sub-threshold transactions by the same party within a 24-hour window collectively exceed the threshold — and routes confirmed structuring patterns to the STR filing procedure. All detection, assembly, and submission steps are driven by typed events (Principle 1); no manual data entry is required for the standard path.

## 4. Trigger

Any of the following initiates the CTR filing procedure:

- `TransactionInitiated` event where the transaction involves cash (currency code `CASH`) in a single amount ≥ R49,999.
- `TransactionInitiated` event representing an electronic fund transfer meeting the FIC s.28B criteria in a single amount ≥ R24,999.
- `StructuringCheckCompleted { outcome: threshold_crossed }` — emitted by the 24-hour aggregation engine when multiple sub-threshold transactions by the same `party_id` collectively breach the R49,999 cash threshold within a rolling 24-hour window.
- Manual referral from Tomas (Head of Payments) or Saskia (Chief Markets Officer) where a business-unit team member identifies a potential qualifying transaction outside the automated pipeline; the referral is recorded as a `ComplianceReferralReceived` event before this procedure begins.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Ingest `TransactionInitiated` event; classify transaction type (cash / EFT / other) and extract amount, currency, party identifiers | `system` | `@domains/compliance/ctr-classifier` (`PLANNED`) | Classifier runs inline on every `TransactionInitiated` event. Non-qualifying transactions are passed through without generating any CTR state. Fail-closed: if the classifier is unavailable, the transaction is held pending classification. |
| 2 | Apply threshold check: (a) single-transaction amount ≥ R49,999 (cash) or ≥ R24,999 (EFT s.28B); (b) 24-hour aggregation check for the same `party_id` across multiple sub-threshold cash transactions | `system` | `@domains/compliance/ctr-threshold-engine` (`PLANNED`) | Threshold engine queries the event store for all `TransactionInitiated` events for the same party within the prior 24 hours. Aggregated amount is the sum of transaction amounts in the same currency. |
| 3 | If threshold crossed: emit `CTRThresholdTriggered { transaction_id, party_id, amount, threshold_type: cash | eft_s28b | structured_series, window_start, window_end }` | `system` | `@platform/event-store` ✓ | This event is the canonical trigger for all downstream CTR workflow steps. One `CTRThresholdTriggered` event per qualifying transaction or structured series. |
| 4 | If structured series detected (threshold_type = `structured_series`): additionally emit `StructuringPatternDetected { party_id, transaction_ids, aggregated_amount, window_start, window_end }` and route to `str-filing.md` for STR consideration | `system` → `human` (Zara — MLRO) | `@platform/event-store` ✓ + `@domains/compliance/mlro-workspace` (`PLANNED`) | Structuring is itself a suspicious activity. The CTR is still filed for the aggregate; the STR decision is separate and managed under `str-filing.md`. The two obligations are parallel and independent. |
| 5 | Assemble CTR payload from the event store: FIC-prescribed fields — accountable institution details (LEI, registration number, FIC registration number), transaction date/time, transaction type, amount, currency, originator details (full name, SA ID or passport number, address), beneficiary details, nature of transaction; pull `PartyRegistered` and `KYCProfileCompleted` events for party fields | `system` | `@domains/compliance/ctr-assembler` (`PLANNED`) | All fields are derived from event-store queries; no manual data entry. If party data is incomplete (e.g., CDD not yet complete), the system flags for manual review before submission. |
| 6 | Validate CTR payload against FIC goAML schema; flag any missing mandatory fields for manual completion by Mira | `system` | `@domains/compliance/goaml-validator` (`PLANNED`) | Validation is schema-based; the FIC goAML XSD / JSON schema is the authoritative source. Missing fields block submission and create a `CTRDataGap { field, transaction_id }` event for manual remediation. |
| 7 | Accumulate validated CTRs into the FIC batch for the current reporting period (monthly cycle for the bank as a non-cash-intensive institutional trading bank) | `system` | `@domains/compliance/ctr-batch-manager` (`PLANNED`) | Each validated CTR is added to the open batch. The batch manager tracks: transaction_ids included, period start/end, cumulative count. Batch is sealed at period-end trigger or when the 15-day per-transaction deadline approaches for the earliest transaction in the batch. |
| 8 | Batch deadline check: if any transaction in the batch is approaching day 13 (2-day buffer before the 15-day statutory deadline), escalate to Mira for immediate submission of the batch | `system` | `@domains/compliance/ctr-deadline-monitor` (`PLANNED`) | Deadline monitor runs every 4 hours. Escalation is a `CTRDeadlineAlert { transaction_id, days_remaining }` event + notification to Mira. |
| 9 | Submit CTR batch to FIC via the goAML portal; receive FIC reference number; emit `CTRSubmitted { fic_reference, period_start, period_end, transaction_count, submitted_by: mira }` | `human` (Mira, supervised by Zara) | `@domains/compliance/goaml-submission` (`PLANNED`) | Mira performs the goAML portal submission; Zara reviews and countersigns the submission record. Manual fallback: if the goAML portal is unavailable, contact FIC via emergency channel and record `CTRSubmittedManual { method: email, timestamp }` pending portal re-submission. |
| 10 | Emit `CTRReportGenerated { fic_batch_id, period, transaction_ids }` to seal the batch and create the canonical reference linking all included CTR transactions to the FIC batch reference | `system` | `@platform/event-store` ✓ | This event is the post-submission canonical record. The FIC reference number is the external acknowledgement; the `fic_batch_id` is the internal tracking key. |
| 11 | Archive the CTR batch file and all supporting transaction event chains to the document store with a 5-year retention marker; apply `classification: high` | `system` | `@platform/document-store` (`PLANNED`) | Retention obligation: FIC Act s.22 + FICA Regulation 24 — 5 years from date of report. The document store retains both the submitted goAML file and the event-store query results used to assemble the payload. |
| 12 | If FIC issues a production order or follow-up enquiry on a filed CTR: route to Zara and Mira; respond within the FIC's stated deadline; record `FICCorrespondenceReceived` and `FICCorrespondenceDispatched` events | `human` (Zara + Mira) | `@domains/compliance/fic-liaison` (`PLANNED`) | FIC Act s.22 requires the bank to produce CTR records on request. All FIC correspondence is a typed event. |

## 6. Reconciliation

- **Events produced:**
  - `CTRThresholdTriggered { transaction_id, party_id, amount, threshold_type, window_start, window_end }` — threshold detection.
  - `StructuringPatternDetected { party_id, transaction_ids, aggregated_amount, window_start, window_end }` — structuring flag (routes to STR consideration).
  - `CTRDataGap { field, transaction_id }` — missing mandatory field flag (blocks submission).
  - `CTRDeadlineAlert { transaction_id, days_remaining }` — deadline proximity warning.
  - `CTRReportGenerated { fic_batch_id, period, transaction_ids }` — batch sealed post-submission.
  - `CTRSubmitted { fic_reference, period_start, period_end, transaction_count, submitted_by }` — goAML submission confirmation.
  - `CTRSubmittedManual { method, timestamp }` — manual-channel fallback.
  - `FICCorrespondenceReceived` / `FICCorrespondenceDispatched` — regulatory correspondence.

- **Reconciliation invariants:**
  1. Every `CTRThresholdTriggered` must have a downstream `CTRReportGenerated` within 13 calendar days of the triggering transaction date (2-day buffer before the 15-day statutory deadline). Vera runs this recon daily.
  2. No `CTRSubmitted` event may exist without a prior `CTRReportGenerated` for the same `fic_batch_id`. Orphan submission events are a data-integrity finding.
  3. Every `StructuringPatternDetected` must have a downstream `MLROCaseOpened` (from `str-filing.md`) within 4 business hours. Vera monitors this cross-procedure invariant.
  4. Every transaction in the event store with `transaction_type: cash` and `amount ≥ 49999` must appear in a `CTRThresholdTriggered` event. Vera's nightly full-scan recon compares raw transaction events against CTR trigger events; gaps are findings.

- **Failure mode:** goAML portal unavailable → Mira files via manual channel (secure FIC email / emergency contact); platform records `CTRSubmittedManual`; re-submission via portal is required once restored; Vera confirms re-submission within 48 hours of portal restoration. Portal unavailability does not suspend the 15-day deadline — manual filing is the fallback, not a deadline extension.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `CTRThresholdTriggered` events | Event log | 5 years | High |
| `StructuringPatternDetected` events | Event log | 5 years | Restricted (MLRO + deputies) |
| Assembled CTR payloads (pre-submission) | Document store | 5 years | High |
| CTR batch files (goAML format) | Document store | 5 years | High |
| `CTRSubmitted` / `CTRReportGenerated` events (incl. FIC reference numbers) | Event log | 5 years | High |
| `CTRSubmittedManual` records | Event log + temporary log | 5 years | High |
| `CTRDataGap` events and remediation records | Event log | 5 years | High |
| FIC correspondence (`FICCorrespondenceReceived` / `FICCorrespondenceDispatched`) | Event log + document store | Permanent | Restricted |

## 8. Manual steps

- **Step 9** (goAML submission): Mira performs the portal submission; the bank's FIC registration credentials are used to authenticate on the goAML portal. The submission act is human-performed to maintain accountability and portal-access discipline. Zara reviews the batch before submission; her countersignature is recorded as a typed event. The system cannot self-submit to the goAML portal in the current substrate (capability: `PLANNED`).
- **Step 6 / CTRDataGap remediation:** where the automated assembler cannot resolve a mandatory FIC field (e.g., incomplete CDD data for a transaction party), Mira manually sources the data from the compliance team or requests it from the counterparty under FIC Act s.21 obligations. All manual data additions are recorded as `CTRDataGapRemediated { field, source, remediated_by: mira }` events before the CTR is re-queued for the batch.
- **Structuring review (Step 4):** the MLRO must review `StructuringPatternDetected` events and determine whether the pattern constitutes wilful structuring (criminal intent) or coincidental sub-threshold activity. This determination requires human judgment on the facts and is not automatable. The decision is captured under `str-filing.md` Step 4.
- **Tipping-off:** CTR filing does not carry the same tipping-off prohibition as STR filing (FIC s.29(3) applies specifically to STRs and TPRs); however, the bank does not notify clients that a CTR has been filed, and staff must exercise discretion in all communications with the reported party.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| `CTRThresholdTriggered` not generated for a qualifying cash transaction | Vera nightly full-scan recon (invariant 4) | Vera finding → Mira investigates root cause; if systemic, Zara + BRC; potential backdated CTR filing |
| CTR not submitted within 15 days of transaction | Vera daily timeliness recon (invariant 1) | `CTRDeadlineAlert` → Mira (auto-notification); if breach imminent, Zara + BRC chair; FIC voluntary disclosure if deadline missed |
| goAML portal unavailable at batch submission time | Submission failure event; health-check | Mira activates manual-channel fallback; Zara notified; `CTRSubmittedManual` records the event |
| Mandatory CTR field missing (CDD gap) | `CTRDataGap` event; validator block | Mira remediates within 5 business days; if party data unobtainable, Zara determines alternative approach (may require STR referral if CDD failure is itself suspicious) |
| Structuring pattern not routed to MLRO within 4 hours | Vera cross-procedure recon (invariant 3) | Auto-alert to Zara; Vera finding; potential STR filing obligation review |
| FIC production order deadline missed | Calendar + event-based deadline tracking | Imani + Zara immediately; formal response-deadline extension request to FIC |
| Classifier or threshold engine unavailable | Health-check failure; transaction hold | `CTRClassifierDown` event → Mira + Atlas immediately; transactions held; SLA: restore < 1 hour |
| FIC rejects submitted CTR (validation error) | goAML rejection event / FIC communication | Mira resolves field error; re-submits corrected CTR within 3 business days of rejection; `CTRRejected` + `CTRResubmitted` events |

## 10. Related procedures

- `transaction-monitoring.md` (PROC-FC-TM-01) — upstream procedure; all `TransactionInitiated` events flow through transaction monitoring; the CTR classifier runs as a parallel gate, not a downstream of TM.
- `str-filing.md` (PROC-FC-STR-01) — structuring patterns detected during CTR aggregation trigger STR consideration; a CTR and STR may co-exist for the same transaction or series.
- `tpr-filing.md` (PROC-FC-TPR-01) — if a CTR-triggering transaction also involves property linked to terrorism or proliferation financing, `tpr-filing.md` is invoked concurrently.
- `kyc-onboarding.md` — originator and beneficiary party data (used in CTR payload assembly at Step 5) is sourced from the KYC/CDD record built at onboarding.
- `fic-submission-cycle.md` — governs the broader FIC reporting obligations; the CTR batch is one of the submission streams managed under that procedure.
- `sanctions-screening.md` — sanctions screening runs on every `TransactionInitiated` event; a CTR-qualifying transaction that also triggers a sanctions hit generates parallel workflows.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Zara + Mira | Initial STUB — all 9 sections; system capabilities all PLANNED. |

## 12. Audit / assurance

- Vera daily CTR-timeliness recon (invariant 1); nightly full-scan transaction-vs-trigger recon (invariant 4).
- Vera monthly structuring-pattern routing recon: every `StructuringPatternDetected` traced to an `MLROCaseOpened` within SLA.
- BRC receives monthly CTR dashboard: transactions qualifying, reports generated, timeliness compliance, FIC rejections and resubmissions.
- Annual independent effectiveness review of the CTR classification engine and the structuring detection algorithm (model-risk Tier 2; no active model — rule-based threshold; review is a logic/parameter audit rather than statistical revalidation).
- FIC inspection readiness: all CTR records accessible via document store within < 5-business-day retrieval SLA; Mira prepares an annual inspection-readiness attestation covering CTR, STR, and TPR stores.
