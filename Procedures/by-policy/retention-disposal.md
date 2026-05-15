---
procedureId: PROC-PRIV-RD-01
title: Data retention and disposal schedule (privacy lens)
author: Iris (Information Officer, governance) · Owen (Company Secretary, governance)
date: 2026-05-15
owner: Iris (Information Officer, governance) · Owen (Company Secretary, governance)
status: POPULATED
policy-cited: Owner Inbox/2026-05-06_core-policies-compliance-privacy.md §4 — Data Governance / Retention Policy
system-capability: prototype/domains/privacy/retention-disposal (PLANNED)
---

# Procedure — Data retention and disposal schedule (privacy lens)

**Procedure ID:** PROC-PRIV-RD-01
**Owner:** Iris (Information Officer, governance) · Owen (Company Secretary, governance)
**Approval:** BRC
**Cadence:** Annual schedule review; on-trigger for individual disposal events
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §4 — Data Governance / Retention Policy.

This procedure governs the **privacy lens** of data retention and disposal: ensuring personal information is not retained beyond its lawful retention period (POPIA s.14), and is disposed of by a secure method that renders it irrecoverable. The counterpart operations procedure (`records-retention-disposal.md`, PROC-RM-RD-01) covers the broader records management view (non-personal records, physical media, regulatory minimums). Both procedures share the retention schedule as a canonical source; this procedure adds the POPIA-specific de-identification and cryptographic erasure mechanics.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-RM-04` (POPIA s.14) | Personal information must not be retained beyond the purpose for which it was collected. Responsible party must destroy or de-identify PI once retention period expires. |
| `ORG-FC-22` (FIC Act s.22) | Transaction / identity records for FICA purposes must be retained for at least 5 years after the relationship ends or transaction is concluded. |
| `ORG-RM-05` (Banks Act Reg 39) | Bank must retain prescribed records for prescribed periods; Registrar may direct extended retention. |
| `ORG-PR(IV)-11` (PAIA s.51) | PAIA manual must disclose the categories of records and their retention periods; disposal of records subject to a pending PAIA request is prohibited. |
| `ORG-PR(IV)-09` (POPIA s.24) | Data subject has a right to request deletion; deletion (or de-identification) is the standard disposal method for personal information. |

## 3. Purpose

Maintain a canonical retention schedule for all categories of personal information held by the bank, trigger automated disposal at schedule expiry (subject to legal-hold and mandatory-minimum exceptions), and record each disposal event in the event store. The procedure ensures the bank can demonstrate to the Information Regulator and SARB that personal information is not held longer than necessary and that disposal is cryptographically evidenced.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| Scheduled retention-expiry timer fires (agent tick checking retention register) | Disposal candidate identification — Steps 1–5 |
| `DSARCorrectionApproved { resolution: "deletion" }` event (from `popia-dsar-correction.md`) | Expedited disposal — Steps 2–5 |
| Annual retention schedule review (calendar: 1 March annually) | Schedule review sub-flow — Steps 1 and 6–7 |
| `LegalHoldReleased` event | Re-evaluate all records previously on hold — Steps 1–5 for released scope |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Run the retention register scan.** At each scheduled tick, query the retention register for all personal-information cohorts whose `retentionExpiresAt` has passed or is within 30 days. Exclude any cohort with an active `LegalHoldAsserted` event. | `system` | `@domains/privacy/retention-disposal` (`PLANNED`) + `@platform/records/hold-check` (`PLANNED`) | Event: `RetentionExpiryCandidatesIdentified { scanAt, cohortCount, holdExclusions }`. |
| 2 | **Apply mandatory-minimum check.** For each candidate cohort, verify that all mandatory-minimum periods have elapsed: FIC Act s.22 (5 years from transaction / relationship end), Banks Act Reg 39 (per prescribed table), ECTA s.11 (5 years for electronic communications relating to financial transactions). | `system` + Iris (agent) | `@domains/privacy/retention-disposal` (`PLANNED`) | Event: `RetentionMandatoryMinimumChecked { cohortId, earliestLegalDisposalDate, mandatoryMinimumBasis }`. Where the mandatory-minimum period has not yet expired, disposal is deferred and a new `retentionExpiresAt` is set accordingly. |
| 3 | **Confirm no pending PAIA request.** Check for any open `PAIARequestReceived` event whose `recordsSought` intersects the disposal candidate cohort. If an active PAIA request covers the records, disposal is suspended until the PAIA request closes. | `system` | `@domains/privacy/paia-request` (`PLANNED`) | Event: `DisposalPAIACheckPassed { cohortId, checkedAt }` or `DisposalSuspendedPAIAPending { cohortId, requestId }`. |
| 4 | **Execute disposal.** Two methods, applied by record category: (a) **Cryptographic erasure** — destroy the encryption key protecting the data segment; the ciphertext is irrecoverable without the key. (b) **Secure deletion** — overwrite the storage sector per NIST SP 800-88 Rev.1; applicable where cryptographic erasure is not feasible (unencrypted legacy records). All disposal events are emitted to the event log before destruction is finalised. | `system` | `@platform/records/secure-deletion` (`PLANNED`) + `@platform/key-store` (`PLANNED`) | Events per record/segment: `PersonalInformationDeleted { subjectId, cohortRef, deletedAt, deletionMethod, deletedBy }` or `PersonalInformationDeidentified { subjectId, cohortRef, deidentifiedAt }` (where full deletion is not possible under Principle 1 event-log immutability). |
| 5 | **Record the disposal in the disposal register.** Update the disposal register with: cohort ID, deletion method, date, operator, and the hash of the deletion-event payload. Iris reviews and countersigns each disposal batch. | Iris (agent) + `system` | `@domains/privacy/retention-disposal` (`PLANNED`) | Event: `DisposalBatchCompleted { batchId, cohortIds, disposedAt, method, irisApprovalRef }`. The disposal register is available to the Information Regulator on demand. |
| 6 | **Annual schedule review.** Iris and Owen review the retention schedule against: (a) changes to FIC / Banks Act / PAIA mandatory minimums; (b) new data categories introduced since last review; (c) any outstanding PAIA request patterns that suggest missing categories. Amended schedule is approved by BRC. | Iris (agent) + Owen (agent) | `@domains/privacy/retention-schedule` (`PLANNED`) | Event: `RetentionScheduleReviewed { reviewedAt, changesApplied, approvedAt, approvedBy: "BRC" }`. |
| 7 | **Publish the updated retention schedule.** Revised schedule is embedded in the PAIA manual (Owen action under `paia-request-handling.md`) and the Privacy Notice (Iris action). | Owen (agent) + Iris (agent) | `@platform/documents/publish` (`PLANNED`) | Event: `RetentionSchedulePublished { version, publishedAt, documentRef }`. |

## 6. Reconciliation

- **Events produced:** `RetentionExpiryCandidatesIdentified`, `RetentionMandatoryMinimumChecked`, `DisposalPAIACheckPassed` / `DisposalSuspendedPAIAPending`, `PersonalInformationDeleted` / `PersonalInformationDeidentified`, `DisposalBatchCompleted`, `RetentionScheduleReviewed`, `RetentionSchedulePublished`.
- **Reconciliation checks:**
  - No personal information cohort is held beyond `retentionExpiresAt` unless an active `LegalHoldAsserted` or mandatory-minimum deferral is in force.
  - Every `PersonalInformationDeleted` is preceded by a `DisposalPAIACheckPassed` in the same batch.
  - Every `DisposalBatchCompleted` has a corresponding Iris approval reference.
  - Annual schedule review is completed by 31 March each year.
- **Failure mode:** disposal of records subject to a live `LegalHoldAsserted` → emergency hold-restoration, Vera finding, Imani notification, potential regulatory consequence.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Disposal register (`DisposalBatchCompleted` events) | Event log (P1) | Permanent | High |
| `PersonalInformationDeleted` / `PersonalInformationDeidentified` events | Event log (P1) | Permanent | Critical (PII meta) |
| Retention schedule (current and all versions) | Document store; hash in `RetentionSchedulePublished` | Permanent | Internal |
| BRC approval of retention schedule | Event log (`RetentionScheduleReviewed.approvedAt`) | Permanent | Internal |
| PAIA suspension notices | Event log (`DisposalSuspendedPAIAPending`) | 5 years post-PAIA closure | High |

## 8. Manual steps

- **Step 2** (mandatory-minimum assessment for novel record categories) — Iris with Imani; legal judgement on applicable statutory floor.
- **Step 5** (Iris countersignature of disposal batch) — Iris's signature is required before batch is finalised; POPIA accountability.
- **Step 6** (annual schedule review) — Iris and Owen; BRC approval required for any change to mandatory-minimum period or new category.
- **Step 7** (PAIA manual update) — Owen's action; content reviewed by Iris before publication.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Retention-expiry timer fires but scan produces zero candidates (misconfiguration) | Vera recon | Atlas + Anya; retention-register diagnostic |
| Disposal executed on data subject to active LegalHold | Recon: `PersonalInformationDeleted` vs `LegalHoldAsserted` | Iris + Imani + CEO; potential POPIA violation; emergency de-escalation |
| Mandatory-minimum floor missed (disposal too early) | Vera audit | Iris + Owen + Imani; if FIC records, potential FIC non-compliance; notify FIC if necessary |
| Cryptographic erasure fails (key deletion error) | HSM error event | Senna (CISO) + Devon; fallback to secure overwrite; incident log opened |
| Annual schedule not reviewed by 31 March | Calendar trigger | Iris + Owen; immediate review; Vera finding |

## 10. Related procedures

- `records-retention-disposal.md` (PROC-RM-RD-01) — the records-management view; shares the canonical retention schedule; this procedure adds the POPIA disposal mechanics.
- `popia-dsar-correction.md` (PROC-PRIV-DSAR-COR-01) — deletion requests from data subjects route through this procedure for Step 4 disposal execution.
- `paia-request-handling.md` (PROC-PAIA-RH-01) — PAIA requests may suspend disposal at Step 3.
- `key-rotation.md` (PROC-IS-KR-01) — cryptographic key management; key-destruction at Step 4 must be coordinated with the key-rotation lifecycle.
- `s72-transfer-assessment.md` (PROC-PRIV-CBT-01) — deletion of personal information transferred cross-border must propagate to the recipient (SCC / DPA obligation); deletion event triggers a cross-border deletion notice.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-15 | Iris (Information Officer, governance) · Owen (Company Secretary, governance) | Initial POPULATED draft. Full 12-section body; POPIA s.14 lens; cryptographic erasure and NIST SP 800-88 secure deletion; legal-hold and PAIA-suspension gate; annual schedule review cycle. |

## 12. Audit / assurance

Vera (Internal-audit / continuous-assurance engineer) asserts annually:
- No personal information category is held beyond its `retentionExpiresAt` without a documented exception.
- Every disposal batch has an Iris approval reference.
- Mandatory-minimum floors are correctly parameterised against FIC Act s.22 and Banks Act Reg 39 current text.
- Annual retention schedule review is documented and BRC-approved.

Iris reports the disposal register summary to BRC quarterly. The Information Regulator may inspect the disposal register on demand; it is available from the event store within 24 hours of a regulatory request.
