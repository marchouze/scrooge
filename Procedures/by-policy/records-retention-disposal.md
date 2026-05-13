# Procedure — Records retention and disposal

**Procedure ID:** PROC-RM-RD-01
**Owner:** Owen (Company Secretary, governance) · Devon (Chief Operating Officer, governance)
**Approval:** Board
**Cadence:** Annual retention-schedule review; quarterly disposal run (expired records); ad-hoc on legal-hold trigger
**Version:** v0.1 — 2026-05-13
**Status:** STUB

## 1. Source policy

`Policies/records-management-policy-v1.md` — Records Management Policy.

The four record classes and their minimum retention floors are authoritative in the policy. This procedure operationalises the policy's disposal lifecycle, legal-hold override, and POPIA purpose-limitation requirements. Changes to the retention schedule require Board approval before they become operative.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-RM-02` (Companies Act s.24–26) | Retain accounting records and statutory registers for a minimum of 7 years. |
| `ORG-RM-03` (Companies Act s.28) | Accounting records must be accessible on demand by authorised officers, auditors, and regulators. |
| `ORG-RM-04` (POPIA s.14) | Personal information must not be retained beyond its retention period; destroy or de-identify at expiry. |
| `ORG-RM-05` (FAIS General Code s.18) | Retain FAIS records for a minimum of 5 years after the last transaction or advice event. |
| `ORG-RM-06` (ECTA ss.11–16) | Electronic records that satisfy ECTA integrity requirements are equivalent to originals. |

## 3. Purpose

Ensure that records are retained for the minimum period required by law or operational need, then securely disposed of — so that the bank is neither non-compliant through premature disposal nor exposed through indefinite retention of personal information beyond its purpose. The procedure also guarantees that no record subject to a legal hold is disposed of under any automated path.

## 4. Trigger

| Trigger | Sub-flow activated |
|---|---|
| Annual calendar event (scheduled agent tick) | Retention schedule review |
| Quarterly calendar event (scheduled agent tick) | Disposal candidate identification and execution |
| `LegalHoldAsserted { record_class, scope, authority }` event | Legal-hold extension — suspend disposal for in-scope records |
| `LegalHoldLifted { hold_id }` event | Re-admit records to disposal queue on next quarterly run |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Annual — retention schedule review.** Owen retrieves the current retention schedule and cross-checks it against the obligations register for any regulatory changes since last review. Propose amendments if needed. | Owen (agent) | `@platform/records/retention-schedule` (`PLANNED`) | Any amendment requires Board approval before taking effect; approved change emits `RetentionScheduleApproved` event. |
| 2 | **Quarterly — identify expired records.** The system scans the record store for records whose retention period has elapsed and for which no `LegalHoldActive` event chain is open. Generates a `RecordsDisposalCandidateList` event with record class, count, identifiers, and proposed disposal method. | `system` | `@platform/records/expiry-scan` (`PLANNED`) | Records with multiple applicable classes use the longest floor. Records in the Operational class are escalated to the appropriate class if a higher floor applies. |
| 3 | **Legal-hold check.** For each candidate record, confirm no active legal hold covers it. A legal hold is active when a `LegalHoldAsserted` event exists with no subsequent `LegalHoldLifted` event for the same `hold_id`. | `system` | `@platform/records/hold-check` (`PLANNED`) | If a hold is active, remove the record from the disposal candidate list, emit `LegalHoldExtensionRecorded { record_id, hold_id, reason: 'active-hold' }`, and log the extension for the next quarterly review. |
| 4 | **Disposal authorisation — governance-class records.** Records in the Governance class (board minutes, statutory registers, director filings) require a Director-level authorisation before disposal. Owen prepares a disposal schedule; a Director countersigns. Authorisation is recorded as a `DisposalAuthorised { class: 'governance', record_ids, authorised_by, timestamp }` event. | Owen (agent) + Director (human — licence-day) | `@platform/event-store` ✓ | Board minutes are never deleted without explicit Board resolution. During the build phase, this step is simulated; at licence-day a human Director signs. |
| 5 | **Disposal authorisation — non-governance classes.** Financial, client/conduct, and operational records require Owner-level authorisation (Owen or Devon). Authorisation emits `DisposalAuthorised { class, record_ids, authorised_by, timestamp }`. | Owen (agent) or Devon (agent) | `@platform/event-store` ✓ | Batch authorisation is acceptable where record class and disposal method are uniform. |
| 6 | **Disposal execution — electronic records.** Apply cryptographic erasure (key destruction for encrypted records) or secure deletion per NIST 800-88. For personal information where deletion is not technically feasible (e.g., embedded in an immutable log segment), apply de-identification. | `system` | `@platform/records/secure-deletion` (`PLANNED`) | ECTA s.11–16 requires integrity of retained records; erasure of expired records is the complement of that duty, not a violation. |
| 7 | **Disposal execution — paper records.** Cross-cut shredding or certified destruction by an approved vendor. Vendor issues a destruction certificate. | Devon (agent — procurement) + approved vendor | External vendor + `@platform/records/vendor-destruction-cert` (`PLANNED`) | Destruction certificate is scanned and stored as a permanent record. |
| 8 | **Disposal record.** For each disposal batch, emit `RecordsDisposed { class, count, record_ids_hash, method, authorised_by, disposal_timestamp }`. This event is permanent — the record of disposal outlives the records themselves and is never subject to disposal. | `system` | `@platform/event-store` ✓ | `record_ids_hash` is a BLAKE3 hash of the full identifier list; full list is stored in the document store at the disposal event reference. |
| 9 | **POPIA purpose-limitation review.** After disposal of personal information, confirm that no residual processing is occurring for the now-disposed data subjects. Iris (Information Officer, privacy) reviews the data-flow map quarterly to verify purpose-limitation compliance. | Iris (agent) | `@platform/privacy/purpose-register` (`PLANNED`) | Data subjects may exercise POPIA s.14 rights (deletion on request) independently of the scheduled disposal cycle — that path runs through `popia-dsar.md` and `popia-dsar-correction.md`. |
| 10 | **Quarterly summary report.** Owen produces a `RetentionDisposalQuarterlySummary` event summarising records reviewed, disposed, held, and any exceptions. Report surfaces in the CEO dashboard and is filed in the Owner Inbox for Board visibility. | Owen (agent) | `@platform/records/reporting` (`PLANNED`) | Board receives an annual roll-up; exceptions (failed disposals, unapproved extensions) escalate immediately per Section 9. |

## 6. Reconciliation

**Events produced:**

- `RetentionScheduleReviewed { version, reviewer, changes_proposed }` — annual, by Owen.
- `RetentionScheduleApproved { version, approved_by, effective_date }` — on Board approval of any amendment.
- `RecordsDisposalCandidateList { run_id, class, count, proposed_method }` — quarterly, by system.
- `LegalHoldChecked { run_id, records_checked, holds_active, records_excluded }` — per quarterly run.
- `LegalHoldExtensionRecorded { record_id, hold_id, reason, extended_until }` — per hold-blocked disposal.
- `DisposalAuthorised { class, record_ids_hash, authorised_by, timestamp }` — per authorisation batch.
- `RecordsDisposed { class, count, record_ids_hash, method, authorised_by, disposal_timestamp }` — per disposal batch.
- `LegalHoldAsserted { hold_id, record_class, scope, authority, asserted_by }` — when a hold is raised (typically by Imani or Owen on litigation signal).
- `LegalHoldLifted { hold_id, lifted_by, lifted_at }` — when hold is released.

**Invariants:**

- No `RecordsDisposed` event exists for a record that has an active `LegalHoldAsserted` without a subsequent `LegalHoldLifted`.
- Every `RecordsDisposed` event has a corresponding `DisposalAuthorised` event with a matching `record_ids_hash`.
- No record in the Governance class has a `RecordsDisposed` event without a preceding `DisposalAuthorised` event where `authorised_by` is a Director-level principal.
- The `RecordsDisposed` event itself is never listed in any disposal candidate list (disposal records are permanent).

**Failure mode:** If the expiry-scan system capability is unavailable, the quarterly run is deferred to the next agent tick after service recovery. Records are not disposed of without a completed `RecordsDisposalCandidateList` event in the current run cycle.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Retention schedule (current version) | `Policies/records-management-policy-v1.md` appendix + event store | Permanent (superseded versions retained) | Internal |
| `RetentionScheduleReviewed` / `RetentionScheduleApproved` events | Event log | Permanent | Internal |
| `RecordsDisposalCandidateList` events | Event log | Permanent | Internal |
| `LegalHoldAsserted` / `LegalHoldLifted` events | Event log | Permanent | High |
| `DisposalAuthorised` events | Event log | Permanent | High |
| `RecordsDisposed` events | Event log | Permanent (immutable) | High |
| Paper destruction certificates | Document store (scanned) | Permanent | Internal |
| Quarterly summary reports | Owner Inbox + event log | 7 years (governance record) | Internal |

## 8. Manual steps

- **Step 4** (Director sign-off for governance-class disposal) is a human-in-the-loop step at licence-day. During the build phase, Owen simulates this step; the gap is tracked as a substrate item.
- **Step 7** (paper destruction) requires engagement with an external vendor. Paper records are minimal in the build phase; this step activates materially at licence-day.
- **Legal-hold assertion** is initiated by Imani (legal, governance) or Owen on receipt of litigation signal, court order, or regulator request. The assertion itself is a typed event; no manual workaround exists.
- **POPIA s.14 requests** (deletion on request from a data subject) are handled via `popia-dsar.md` and `popia-dsar-correction.md`; those procedures may trigger out-of-cycle disposal and must be coordinated with Iris.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Disposal executed without `DisposalAuthorised` event | Invariant check in projection runtime; Vera periodic audit | Devon + Owen immediately; Board notification if governance-class affected |
| Active legal hold missed; record disposed | Invariant check (`LegalHoldAsserted` vs `RecordsDisposed`) | Imani + Owen immediately; litigation counsel engaged; regulator notified if required |
| Retention schedule not reviewed in >13 months | Cadence monitor (agent scheduler) | Owen escalates to Board; schedule review re-queued as urgent |
| Expiry-scan system unavailable at quarterly trigger | Health-check on `@platform/records/expiry-scan` | Devon + Atlas; disposal run deferred; no records disposed until capability restored |
| De-identified personal information re-identified | Iris periodic data-flow audit | Iris + Senna immediately; POPIA s.22 incident assessment; potential breach notification per `popia-breach-notification.md` |
| Vendor destruction certificate not received | Devon post-disposal follow-up (7-day SLA) | Devon escalates to vendor; no further destruction assignments until certificate received |

## 10. Related procedures

- `legal-hold.md` — Imani-owned procedure for asserting and lifting litigation holds; interacts with this procedure at Steps 3 and 9.
- `popia-dsar.md` — data subject access requests, including deletion requests that may trigger out-of-cycle disposal.
- `popia-dsar-correction.md` — correction / deletion sub-procedure.
- `popia-breach-notification.md` — if a disposal failure results in a privacy breach.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Owen (Company Secretary, governance) + Devon (Chief Operating Officer, governance) | Initial stub; all 9 sections populated; system capabilities `PLANNED`. |
