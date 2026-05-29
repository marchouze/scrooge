---
policy-parent: Policies/records-management-policy-v1.md — Records Management Policy
last-reviewed: 2026-05-15
procedureId: PROC-RM-RD-01
title: Records retention and disposal
author: Owen (Company Secretary, governance) · Devon (Chief Operating Officer, governance)
date: 2026-05-15
owner: Owen (Company Secretary, governance) · Devon (Chief Operating Officer, governance)
status: POPULATED
policy-cited: Policies/records-management-policy-v1.md — Records Management Policy
system-capability: prototype/platform/records/expiry-scan (PLANNED)
---

# Procedure — Records retention and disposal

**Procedure ID:** PROC-RM-RD-01
**Owner:** Owen (Company Secretary, governance) · Devon (Chief Operating Officer, governance)
**Approval:** Board
**Cadence:** Annual retention-schedule review; quarterly disposal run (expired records); ad-hoc on legal-hold trigger
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

`Policies/records-management-policy-v1.md` — Records Management Policy.

The four record classes (Governance, Financial, Client/Conduct, Operational) and their minimum retention floors are authoritative in the policy. This procedure operationalises the policy's disposal lifecycle, legal-hold override, and POPIA purpose-limitation requirements. Changes to the retention schedule require Board approval before they become operative.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-RM-02` (Companies Act s.24–26) | Retain accounting records and statutory registers for a minimum of 7 years. |
| `ORG-RM-03` (Companies Act s.28) | Accounting records must be accessible on demand by authorised officers, auditors, and regulators. |
| `ORG-RM-04` (POPIA s.14) | Personal information must not be retained beyond its retention period; destroy or de-identify at expiry. |
| `ORG-RM-05` (FAIS General Code s.18) | Retain FAIS records for a minimum of 5 years after the last transaction or advice event. |
| `ORG-RM-06` (ECTA ss.11–16) | Electronic records that satisfy ECTA integrity requirements are equivalent to originals. |
| `ORG-FC-22` (FIC Act s.22 + GN 1) | Retain records of transactions and client identification for a minimum of 5 years after end of relationship. |

## 3. Purpose

Ensure that records are retained for the minimum period required by law or operational need, then securely disposed of — so that the bank is neither non-compliant through premature disposal nor exposed through indefinite retention of personal information beyond its purpose. The procedure also guarantees that no record subject to a legal hold is disposed of under any automated path, and that every disposal is authorised and evidenced by a permanent disposal record.

## 4. Trigger

| Trigger | Sub-flow activated |
|---|---|
| Annual calendar event (scheduled agent tick) | Retention schedule review (Step 1) |
| Quarterly calendar event (scheduled agent tick) | Disposal candidate identification and execution (Steps 2–8) |
| `LegalHoldAsserted { record_class, scope, authority }` event | Legal-hold extension — suspend disposal for in-scope records (Step 3) |
| `LegalHoldLifted { hold_id }` event | Re-admit records to disposal queue on next quarterly run (Step 3) |
| `DataSubjectRequestReceived { requestType: "deletion" }` | Out-of-cycle disposal for personal information where POPIA s.14 applies — coordinates with `popia-dsar-correction.md` |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Annual — retention schedule review.** Owen retrieves the current retention schedule and cross-checks it against the obligations register for any regulatory changes since last review. Proposes amendments if needed. Board approves any amendment before it takes effect. | Owen (agent) | `@platform/records/retention-schedule` (`PLANNED`) | Approved change emits `RetentionScheduleApproved { version, approvedBy, effectiveDate }`. |
| 2 | **Quarterly — identify expired records.** System scans the record store for records whose retention period has elapsed and for which no `LegalHoldActive` event chain is open. Generates `RecordsDisposalCandidateList { runId, class, count, identifiers, proposedMethod }`. | `system` | `@platform/records/expiry-scan` (`PLANNED`) | Records with multiple applicable classes use the longest floor. Records in the Operational class are escalated to a higher class if a higher floor applies. |
| 3 | **Legal-hold check.** For each candidate record, confirm no active legal hold covers it. A hold is active when a `LegalHoldAsserted` event exists with no subsequent `LegalHoldLifted` for the same `hold_id`. | `system` | `@platform/records/hold-check` (`PLANNED`) | If a hold is active, remove the record from the candidate list and emit `LegalHoldExtensionRecorded { recordId, holdId, reason: "active-hold" }`. |
| 4 | **Disposal authorisation — governance-class records.** Records in the Governance class (board minutes, statutory registers, director filings) require Director-level authorisation before disposal. Owen prepares a disposal schedule; a Director countersigns. | Owen (agent) + Director (`human` — Marc interim; Board-appointed director post licence-day) | `@platform/event-store` ✓ | Emits `DisposalAuthorised { class: "governance", recordIdsHash, authorisedBy, timestamp }`. Board minutes are never deleted without explicit Board resolution. |
| 5 | **Disposal authorisation — non-governance classes.** Financial, Client/Conduct, and Operational records require Owner-level authorisation (Owen or Devon). Batch authorisation acceptable where class and disposal method are uniform. | Owen (agent) or Devon (agent) | `@platform/event-store` ✓ | Emits `DisposalAuthorised { class, recordIdsHash, authorisedBy, timestamp }`. |
| 6 | **Disposal execution — electronic records.** Apply cryptographic erasure (key destruction for encrypted records) or secure deletion per NIST 800-88. For personal information where deletion is not technically feasible (e.g. embedded in immutable log segment), apply de-identification. | `system` | `@platform/records/secure-deletion` (`PLANNED`) | ECTA s.11–16 requires integrity of retained records; erasure of expired records is the complement of that duty. |
| 7 | **Disposal execution — paper records.** Cross-cut shredding or certified destruction by an approved vendor. Vendor issues a destruction certificate. | Devon (agent — procurement) + approved vendor | External vendor + `@platform/records/vendor-destruction-cert` (`PLANNED`) | Destruction certificate is scanned and stored as a permanent record in the document store. |
| 8 | **Disposal record.** Emit `RecordsDisposed { class, count, recordIdsHash, method, authorisedBy, disposalTimestamp }` for each disposal batch. This event is permanent — the record of disposal outlives the records themselves and is never subject to disposal. | `system` | `@platform/event-store` ✓ | `recordIdsHash` is a BLAKE3 hash of the full identifier list; full list is stored in the document store at the disposal event reference. |
| 9 | **POPIA purpose-limitation review.** After disposal of personal information, confirm no residual processing is occurring for the now-disposed data subjects. Iris (Information Officer, governance) reviews the data-flow map quarterly to verify purpose-limitation compliance. | Iris (agent) | `@platform/privacy/purpose-register` (`PLANNED`) | Data subjects may exercise POPIA s.14 rights (deletion on request) independently of the scheduled disposal cycle — that path runs through `popia-dsar.md` and `popia-dsar-correction.md`. |
| 10 | **Quarterly summary report.** Owen produces a `RetentionDisposalQuarterlySummary { runId, disposed, held, exceptions }` event. Report surfaces in the CEO dashboard and is filed in Owner Inbox for Board visibility. | Owen (agent) | `@platform/records/reporting` (`PLANNED`) | Board receives annual roll-up; exceptions (failed disposals, unapproved extensions) escalate immediately per Section 9. |

## 6. Reconciliation

**Events produced:**

- `RetentionScheduleReviewed { version, reviewer, changesProposed }` — annual, by Owen.
- `RetentionScheduleApproved { version, approvedBy, effectiveDate }` — on Board approval of any amendment.
- `RecordsDisposalCandidateList { runId, class, count, proposedMethod }` — quarterly, by system.
- `LegalHoldChecked { runId, recordsChecked, holdsActive, recordsExcluded }` — per quarterly run.
- `LegalHoldExtensionRecorded { recordId, holdId, reason, extendedUntil }` — per hold-blocked disposal.
- `DisposalAuthorised { class, recordIdsHash, authorisedBy, timestamp }` — per authorisation batch.
- `RecordsDisposed { class, count, recordIdsHash, method, authorisedBy, disposalTimestamp }` — per disposal batch.
- `LegalHoldAsserted { holdId, recordClass, scope, authority, assertedBy }` — when hold is raised.
- `LegalHoldLifted { holdId, liftedBy, liftedAt }` — when hold is released.
- `RetentionDisposalQuarterlySummary { runId, disposed, held, exceptions }` — quarterly report event.

**Invariants:**

- No `RecordsDisposed` event exists for a record that has an active `LegalHoldAsserted` without a subsequent `LegalHoldLifted`.
- Every `RecordsDisposed` event has a corresponding `DisposalAuthorised` event with a matching `recordIdsHash`.
- No Governance-class record has a `RecordsDisposed` event without a preceding `DisposalAuthorised` where `authorisedBy` is a Director-level principal.
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

- **Step 1** (Board approval of retention-schedule amendments) — Board resolution required; Owen prepares the resolution; manual approval by directors until BRC / Board governance substrate is built.
- **Step 4** (Director sign-off for Governance-class disposal) — human-in-the-loop at licence-day; during build phase, Marc as sole director is the confirming authority.
- **Step 7** (paper destruction) — external vendor engagement; paper records are minimal in the build phase; this step activates materially at licence-day.
- **Legal-hold assertion** — Imani (Legal-as-code engineer) or Owen raises holds on litigation / regulator signal; assertion is a typed event, no manual workaround.
- **POPIA s.14 requests** (deletion on request) — coordinated via `popia-dsar.md` and `popia-dsar-correction.md`; out-of-cycle disposal coordinated with Iris.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Disposal executed without `DisposalAuthorised` event | Invariant check in projection runtime; Vera periodic audit | Devon + Owen immediately; Board notification if Governance-class affected |
| Active legal hold missed; record disposed | Invariant check (`LegalHoldAsserted` vs `RecordsDisposed`) | Imani + Owen immediately; litigation counsel engaged; regulator notified if required |
| Retention schedule not reviewed in > 13 months | Cadence monitor (agent scheduler) | Owen escalates to Board; review re-queued as urgent |
| Expiry-scan system unavailable at quarterly trigger | Health-check on `@platform/records/expiry-scan` | Devon + Atlas; disposal run deferred; no records disposed until capability restored |
| De-identified personal information re-identified | Iris periodic data-flow audit | Iris + Senna immediately; POPIA s.22 incident assessment; potential breach notification per `popia-breach-notification.md` |
| Vendor destruction certificate not received within 7 days | Devon post-disposal follow-up | Devon escalates to vendor; no further destruction assignments until certificate received |

## 10. Related procedures

- `legal-hold.md` (`PLANNED`) — Imani-owned procedure for asserting and lifting litigation holds; interacts with this procedure at Steps 3 and 9.
- `popia-dsar.md` (PROC-PRIV-DSAR-01) — data subject access requests, including deletion requests that may trigger out-of-cycle disposal.
- `popia-dsar-correction.md` — correction / deletion sub-procedure; out-of-cycle disposal path.
- `popia-breach-notification.md` — if a disposal failure results in a privacy breach.
- `retention-disposal.md` — data retention and disposal procedure (privacy lens; Iris-owned complement to this Owen / Devon-owned records-management lens).

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Owen (Company Secretary, governance) + Devon (Chief Operating Officer, governance) | Initial STUB; all 9 sections populated; system capabilities `PLANNED`. |
| v1.0 | 2026-05-15 | Owen (Company Secretary, governance) · Devon (Chief Operating Officer, governance) | Promoted to POPULATED: full 12-section body; added FIC Act citation `ORG-FC-22`; completed Section 12 audit / assurance. |

## 12. Audit / assurance

Vera (Internal-audit / continuous-assurance engineer) asserts the following continuous-controls projection quarterly:
- No `RecordsDisposed` event exists without a preceding `DisposalAuthorised` (invariant 1).
- No `RecordsDisposed` against a record with an active hold (invariant 2).
- The Governance-class Director-authorisation constraint is met for every disposal batch in that class (invariant 3).
- Retention schedule reviewed within the prior 13 months.

Annual Board-level review of the retention schedule (aligns with the annual retention-schedule review at Step 1). BRC receives the quarterly summary event for oversight. A biennial full audit of the disposal records, including paper-destruction certificates, is performed by Thandiwe (Chief Audit Executive, governance).
