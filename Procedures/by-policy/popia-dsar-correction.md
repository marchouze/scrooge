---
procedureId: PROC-PRIV-DSAR-COR-01
title: POPIA data subject correction and deletion
author: Iris (Information Officer, governance) · Anya (Dashboard & projection engineer)
date: 2026-05-15
owner: Iris (Information Officer, governance) · Anya (Dashboard & projection engineer)
status: POPULATED
policy-cited: Owner Inbox/2026-05-06_core-policies-compliance-privacy.md §6 — POPIA / Privacy Policy
system-capability: prototype/domains/privacy/dsar-correction (PLANNED)
---

# Procedure — POPIA data subject correction and deletion

**Procedure ID:** PROC-PRIV-DSAR-COR-01
**Owner:** Iris (Information Officer, governance) · Anya (Dashboard & projection engineer)
**Approval:** BRC
**Cadence:** On-trigger (per request)
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §6 — POPIA / Privacy Policy.

Correction and deletion requests are a specialised sub-path of the DSAR procedure (`popia-dsar.md`, PROC-PRIV-DSAR-01). This procedure governs the mechanics of applying corrections and deletions to the event store and downstream projections, respecting lawful retention exceptions and Principle 1 (events are the source of truth).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR(IV)-09` (POPIA s.24) | Data subject right to request correction or deletion of personal information that is inaccurate, irrelevant, excessive, out of date, incomplete, misleading, or unlawfully obtained. |
| `ORG-PR(IV)-08` (POPIA s.23) | Data subject right of access — correction / deletion is the downstream right. |
| `ORG-PR(IV)-04` (POPIA s.15) | Further-processing limitation context — deletion resolves unlawful further processing. |
| `ORG-RM-04` (POPIA s.14) | Personal information must not be retained beyond its retention period; destroy or de-identify at expiry. |
| `ORG-FC-22` (FIC Act s.22) | FIC retention obligation — deletion does not override the minimum 5-year record retention for transaction / identity records. |

## 3. Purpose

Receive, authenticate, assess, and fulfil data-subject requests for correction or deletion of personal information under POPIA s.24, within statutory timing. The procedure produces typed correction or deletion events that propagate through the event store and downstream projections, while respecting lawful retention exceptions (FIC, Banks Act, ECTA) and Principle 1 — events are the canonical source of truth, so correction and deletion are expressed as new events, not edits to existing records.

## 4. Trigger

A `DataSubjectRequestReceived { requestType: "correction" | "deletion", subjectId, channel, receivedAt }` event, flowing from `popia-dsar.md` Step 4 (compile response) when the request type is correction or deletion.

Also triggered directly when:
- Self-service portal correction form submitted post-onboarding.
- Information Regulator forwards a correction / deletion direction.
- Iris identifies a data quality issue affecting personal information (proactive correction).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive and classify the request: correction (specific field(s) to be corrected) or deletion (subject requests erasure of specific records or all personal information). Confirm authentication already completed via `popia-dsar.md` Step 2; if not, authenticate first. | Iris (agent) + `system` | `@domains/privacy/dsar-intake` (`PLANNED`) | Event: `DSARCorrectionClassified { requestId, requestType, subjectId, fieldsAffected, authenticatedAt }`. |
| 2 | Identify the full cohort of personal information records affected by the correction or deletion request. Cross-reference all event store domains (client master, KYC, transactions, communications recordings, marketing logs). | `system` query | `@domains/privacy/affected-cohort` (`PLANNED`) | Event: `DSARCorrectionCohortIdentified { requestId, domainsCovered, recordCount }`. |
| 3 | Apply lawful exemption check before proceeding. FIC Act s.22 records, Banks Act records, and records subject to a `LegalHoldAsserted` event cannot be deleted; they may be corrected but not erased. ECTA s.11–16 integrity requirements apply to accounting records. | Iris (agent) with Imani (Legal-as-code engineer) | `@platform/records/hold-check` (`PLANNED`) | Events: `DSARExemptionApplied { requestId, basis, citation, recordsExempted }` for each exemption. Correction is always permitted (inaccuracy is corrected forward via a new event); deletion of exempt records is refused, with reasoning communicated to the data subject. |
| 4 | **Correction path:** Emit a typed correction event for each affected field: `PersonalInformationCorrected { subjectId, fieldPath, priorValue, correctedValue, correctedAt, requestRef, correctedBy }`. The correction event is the authoritative fact; projections rebuild from the correction event forward. | `system` | `@platform/event-store` ✓ + `@domains/privacy/dsar-correction` (`PLANNED`) | Prior value is retained in the event payload for audit continuity (Principle 1). The corrected-forward projection replaces the stale value in all read-side views. |
| 5 | **Deletion path:** For records eligible for deletion (not exempt under Step 3), emit `PersonalInformationDeleted { subjectId, recordScope, deletedAt, requestRef, deletionMethod, deletedBy }`. Apply cryptographic erasure or secure deletion per the disposal mechanism in `records-retention-disposal.md`. | `system` | `@platform/records/secure-deletion` (`PLANNED`) | Deletion is forward-looking: projections stop surfacing deleted data; existing event payloads that are not deletable (immutable log segments) are de-identified (`PersonalInformationDeidentified { subjectId, segmentRef, deidentifiedAt }`). |
| 6 | **Propagation.** Downstream projections, dashboards, and any cached read-side views are invalidated and rebuilt from the corrected / deleted event stream. Anya confirms projection state is consistent with the correction / deletion events. | `system` + Anya (agent) | `@platform/event-store` ✓ + `@domains/privacy/propagation` (`PLANNED`) | CI invariant: at any as-of timestamp after the correction / deletion event, the projection state matches the event state. |
| 7 | Iris reviews and approves the correction or deletion as applied. Emits `DSARCorrectionApproved { requestId, outcome, correctedFields, deletedRecords, exemptedRecords }`. | Iris (agent) | (approval event) | Iris's sign-off is required for every correction / deletion (Regulator credibility and POPIA s.24 accountability). |
| 8 | Notify the data subject of the outcome: what was corrected / deleted, what was exempt and why. If the data subject is dissatisfied, escalation pathway opens per `popia-dsar.md` Step 11. | `system` | `@platform/notification/data-subject` (`PLANNED`) | Event: `DSARCorrectionResponseDelivered { requestId, deliveredAt, channel }`. |
| 9 | Close the request. Emit `DSARClosed { requestId, resolution: "correction" | "deletion" | "partial-exemption", satisfactionSignal }`. | `system` | (closure event) | Statutory timing: "as soon as reasonably possible" — typically 30 days from receipt per Regulator guidance. |

## 6. Reconciliation

- **Events produced:**
  - `DSARCorrectionClassified`, `DSARCorrectionCohortIdentified`.
  - `DSARExemptionApplied` (per exemption).
  - `PersonalInformationCorrected` (per field corrected) or `PersonalInformationDeleted` / `PersonalInformationDeidentified` (per scope deleted).
  - `DSARCorrectionApproved`, `DSARCorrectionResponseDelivered`, `DSARClosed`.
- **Reconciliation checks:**
  - Every `DataSubjectRequestReceived { requestType: "correction" | "deletion" }` resolves to a `DSARClosed` within 30 days.
  - Every `PersonalInformationCorrected` event is reflected in the read-side projection at any as-of date after the event (CI invariant).
  - No `PersonalInformationDeleted` event exists for a record covered by an active `LegalHoldAsserted` or FIC/Banks Act exemption.
  - Every `DSARCorrectionApproved` is preceded by a `DSARCorrectionCohortIdentified` in the same request chain.
- **Failure mode:** projection propagation fails → Anya + Atlas engineering escalation; correction / deletion event exists but read-side view is stale — must be remediated before response is delivered to data subject.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `DataSubjectRequestReceived` → `DSARClosed` event chain | Event log (P1) | Permanent | High (PII) |
| `PersonalInformationCorrected` events (with prior value) | Event log (P1) | Permanent | Critical (PII) |
| `PersonalInformationDeleted` / `PersonalInformationDeidentified` events | Event log (P1) | Permanent | Critical (PII) |
| `DSARExemptionApplied` events and reasoning | Event log (P1) | Permanent | High |
| `DSARCorrectionApproved` event (Iris sign-off) | Event log (P1) | Permanent | High |
| Response notification to data subject | Document store + event log | 5 years post-closure | High (PII) |

## 8. Manual steps

- **Step 3** (exemption assessment) — Iris with Imani; legal judgement on applicability of FIC / Banks Act / ECTA exemptions. Human discretion required.
- **Step 7** (Iris approval) — every correction / deletion requires Iris sign-off; POPIA s.24 accountability.
- **Regulator engagement** (if dissatisfied data subject escalates) — human diplomatic engagement; routed via `popia-dsar.md` Step 11.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Cohort identification incomplete | Iris review of Step 2 output | Anya engineering escalation; over-scope-and-redact the response |
| Exemption mis-applied | Vera review or Regulator complaint | Iris + Imani + Zara (CCO); potential remediation event |
| Projection propagation fails after correction / deletion | CI invariant; Anya monitoring | Atlas + Anya; replay from corrected event stream; re-test before response delivery |
| Statutory deadline missed (> 30 days) | Timer event | Iris + CEO; Regulator engagement; corrective action plan |
| Deletion refused on exemption grounds; data subject escalates to Information Regulator | Escalation event | Iris + Zara + Imani; formal Regulator engagement; response must be well-documented |

## 10. Related procedures

- `popia-dsar.md` (PROC-PRIV-DSAR-01) — parent procedure; correction / deletion is Steps 4 and 9 of that procedure; this procedure is the detailed mechanics.
- `records-retention-disposal.md` (PROC-RM-RD-01) — exemption check at Step 3 references retention floors and legal-hold state managed by that procedure.
- `popia-breach-notification.md` — if a correction / deletion failure results in ongoing unlawful processing, it may constitute a POPIA s.22 breach.
- `retention-disposal.md` — data retention and disposal (privacy lens; interacts with Step 5 deletion mechanics).

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-15 | Iris (Information Officer, governance) · Anya (Dashboard & projection engineer) | Initial POPULATED draft. Full 12-section body; events-first correction/deletion model per Principle 1; FIC / Banks Act exemption handling; propagation mechanics. |

## 12. Audit / assurance

Vera (Internal-audit / continuous-assurance engineer) samples correction / deletion requests quarterly:
- Cohort completeness (were all domains covered?).
- Exemption discipline (are exemptions correctly cited and evidenced?).
- Propagation correctness (do projections reflect the correction at the expected as-of date?).
- Timing (within 30-day statutory window?).

Annual rehearsal of a correction-and-deletion DSAR, including a partial-exemption case (FIC records exempt from deletion). Continuous-controls projection: median time-to-respond and exemption-invocation rate reported to BRC and Information Regulator annually.
