---
policy-parent: Owner Inbox/2026-05-06_core-policies-compliance-privacy.md §6 — POPIA / Privacy Policy
last-reviewed: 2026-05-15
procedureId: PROC-PRIV-IO-DSG-01
title: POPIA Information Officer designation (per entity)
author: Iris (Information Officer, governance) · Owen (Company Secretary, governance)
date: 2026-05-15
owner: Iris (Information Officer, governance) · Owen (Company Secretary, governance)
status: POPULATED
policy-cited: Owner Inbox/2026-05-06_core-policies-compliance-privacy.md §6 — POPIA / Privacy Policy
system-capability: prototype/domains/privacy/io-designation (PLANNED)
---

# Procedure — POPIA Information Officer designation (per entity)

**Procedure ID:** PROC-PRIV-IO-DSG-01
**Owner:** Iris (Information Officer, governance) · Owen (Company Secretary, governance) for designation-letter issuance · Marc (CEO, sole-director interim) until licence-day
**Approval:** CEO (build-phase); Board (post licence-day)
**Cadence:** On-trigger (entity registration; annual refresh; designation change)
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §6 — POPIA / Privacy Policy.
`Owner Inbox/2026-05-09_iris_per-entity-popia-io-designation-scoping.md` — per-entity scoping deliverable establishing which Hoz entities are POPIA responsible parties.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR(IV)-13` (POPIA s.56(1)) | Each responsible party must designate an Information Officer. |
| `ORG-PR(IV)-13-GLOSS-DEPUTY-IO` (POPIA s.56(a)) | Responsible party may designate one or more Deputy Information Officers. |
| `ORG-PR(IV)-13` (POPIA s.56(2) read with Reg 4) | IO must be registered with the Information Regulator before commencing duties. |
| `ORG-PR(IV)-08` (POPIA s.23) | Data-subject right of access — IO is the named point of accountability. |
| `ORG-PR(IV)-07` (POPIA s.22) | IO is accountable for breach notification to Information Regulator and data subjects. |

PAIA s.1 (head of private body), POPA s.55 (PAIA / POPIA interface): each Hoz entity that is a private body has a "head of private body" for PAIA s.51 manual purposes; this role overlaps with the IO.

> *Citation resolution to ORG-CORP-* pending Mira's Domain — Corporate designation registration in the obligations register; ORG-PR(IV) IDs above cover the substantive obligations.*

## 3. Purpose

Ensure every Hoz entity that is a POPIA responsible party (per the scoping deliverable: Group, Bank, Securities) has a current, registered IO and Deputy IO designation, a published PAIA s.51 manual, and a per-entity request-handling pipeline — all in place before commencing processing of personal information at scale. The procedure also governs designation changes and annual refreshes to maintain registration currency with the Information Regulator.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| `LegalEntityRegistered` event for an entity classified as a POPIA responsible party | Initial designation — run Steps 1–4 |
| Annual cadence — 12 months from prior `IODesignationFiled` event for the entity | Annual refresh — run Steps 1–3; step 4 only if person changes |
| IO or Deputy IO resignation, role change, or incapacity | Designation change — run Steps 1–4 |
| Capacity / conflict finding by Helena (Chief Risk Officer, governance) or Thandiwe (Chief Audit Executive, governance) | Designation change — run Steps 1–4 |
| Information Regulator direction | Directed change — run Steps 1–4 with expedited timeline |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Determine nominee for IO and Deputy IO roles for the entity; confirm nominee's fit (capacity, independence, no disqualifying conflicts per POPIA Reg 4). Iris nominates; Owen records the nomination in the entity's company records. | Iris (agent) + Owen (agent) | `@domains/privacy/io-designation` (`PLANNED`) | During build-phase: Marc as sole director is the confirming authority. Post licence-day: Board confirms. Event: `IONomineeIdentified { entityId, ioNominee, deputyIoNominee, confirmingAuthority }`. |
| 2 | Entity board / sole director designates IO + Deputy IO via signed appointment letter, citing POPIA s.56(1) and s.56(a). Letter specifies entity, effective date, scope of duties per Reg 4. | `human` (entity board / sole director — Marc interim) | `@domains/privacy/io-designation` (`PLANNED`) | Emits `IODesignationFiled { entityId, ioId, deputyIoId, effectiveAt, designationLetterRef, citations }`. Letter is stored in the document store; hash in the event payload. |
| 3 | Iris registers the IO designation with the Information Regulator per POPIA s.56(2) read with Reg 4. Submission made via Regulator portal or written filing. | Iris (agent) — manual Regulator portal today | `@platform/regulator/info-regulator-integration` (`PLANNED`) | Out-of-system today; portal integration is a substrate gap. Submission timestamp and acknowledgement reference recorded as event: `IORegistrationSubmitted { entityId, submittedAt, refNo }`. |
| 4 | PAIA s.51 manual published at entity level. The manual describes how to make POPIA / PAIA requests to the entity; lists processing categories per the lawful-processing register; names the IO and the request channel. | `system` (generator) + Iris (approves) | `@domains/privacy/paia-manual-generator` (`PLANNED`) | Generated from event log and lawful-processing register per Principle 1. Iris approves before publication. Emits `PAIAManualPublished { entityId, version, publishedAt, manualRef }`. Manual is accessible on the bank's public-facing channel. |
| 5 | On designation change: fire `IODesignationChanged { entityId, prior, current, effectiveAt, reason }` event; re-run Step 3 to update the Regulator registration; re-publish the PAIA s.51 manual with updated IO details (Step 4). | Iris (agent) + Owen (agent) | as above | Prior designation record remains in the event log for audit continuity. |
| 6 | Annual check: Owen confirms all entities have a current `IODesignationFiled` event within the prior 12 months and that the registered IO is still in post. Owen escalates gaps immediately to Marc / Board. | Owen (agent) | `@platform/records/cadence-monitor` (`PLANNED`) | Agent scheduler fires annually; Owen reviews the projection output. |

## 6. Reconciliation

- **Events produced:**
  - `IONomineeIdentified { entityId, ioNominee, deputyIoNominee, confirmingAuthority }`
  - `IODesignationFiled { entityId, ioId, deputyIoId, effectiveAt, designationLetterRef, citations[] }`
  - `IODesignationChanged { entityId, prior, current, effectiveAt, reason }`
  - `IORegistrationSubmitted { entityId, submittedAt, refNo }`
  - `PAIAManualPublished { entityId, version, publishedAt, manualRef }`
- **Reconciliation checks (Vera, Internal-audit / continuous-assurance engineer):**
  - For every `LegalEntityRegistered` event marked as a POPIA responsible party, a current `IODesignationFiled` event exists with no gap > 12 months since last filing.
  - For every `IODesignationFiled`, a corresponding `IORegistrationSubmitted` event exists with a non-null `refNo`.
  - For every responsible-party entity, a current `PAIAManualPublished` event exists and the manual is reachable on the published channel.
  - No entity has an `IODesignationFiled` older than 12 months without a successor filing or an `IODesignationChanged` event.
- **Failure mode:** gap between `LegalEntityRegistered` and `IODesignationFiled` — entity may not process personal information until designation is complete; Iris escalates to Marc immediately.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Designation appointment letter | Document store (scanned PDF); hash in `IODesignationFiled` event | Permanent | Internal |
| `IODesignationFiled` / `IODesignationChanged` events | Event log (P1) | Permanent | Internal |
| `IORegistrationSubmitted` event + Regulator acknowledgement | Event log + document store | Permanent | High |
| PAIA s.51 manual (per entity, per version) | Published channel + document store; `PAIAManualPublished` event hash | Permanent (each version) | Public |
| Annual check output | Event log (`IOAnnualCheckCompleted { entitiesChecked, gapsFound }`) | 7 years | Internal |

## 8. Manual steps

- **Step 2** (designation letter signing) — requires a human signatory (Marc as sole director, or Board post licence-day); automated drafting is possible but wet/digital signature is a human step. Tracked exception: regulatory requirement for responsible-party designation.
- **Step 3** (Regulator registration) — Information Regulator portal requires manual account login today. Substrate gap: `@platform/regulator/info-regulator-integration` when portal API is available.
- **Step 4** (Iris approval) — Iris reviews PAIA manual content before publication; judgement on accuracy and completeness. Automated generation is possible; final approval is human.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Entity registered as responsible party but no `IODesignationFiled` within 30 days | Vera continuous-recon assertion on entity-to-designation gap | Iris + Marc immediately; processing of personal information halted for that entity until designation is filed |
| IO registration with Information Regulator not acknowledged within 14 days of `IORegistrationSubmitted` | Iris follow-up cadence | Iris re-submits; if no acknowledgement in 30 days, Zara (CCO) + Owen engage the Regulator directly |
| Annual refresh missed (> 13 months since last `IODesignationFiled`) | Cadence monitor agent tick | Owen escalates to Board; re-queued as urgent |
| IO vacates post without successor designated | HR / designation-change trigger | Iris nominates interim immediately; Deputy IO assumes duties pending new designation; Marc informed same-day |
| PAIA manual not updated after IO change | `IODesignationChanged` without subsequent `PAIAManualPublished` within 14 days | Iris + Owen; manual re-published; Regulator notified if the manual was publicly accessed in the interim with stale information |

## 10. Related procedures

- `popia-breach-notification.md` (PROC-PRIV-01) — IO is the named accountability for breach notification.
- `popia-dsar.md` (PROC-PRIV-DSAR-01) — IO handles data-subject access requests.
- `popia-dsar-correction.md` — correction / deletion requests routed to IO.
- `paia-request-handling.md` — PAIA s.51 manual governs the request pathway; IO is the designated point of contact.
- `records-retention-disposal.md` (PROC-RM-RD-01) — Iris reviews POPIA purpose-limitation compliance in Step 9 of that procedure.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 stub | 2026-05-09 | Atlas (Core banking platform architect, via Scrooge) | Initial STUB; scoping anchored to `Owner Inbox/2026-05-09_iris_per-entity-popia-io-designation-scoping.md`; five substrate gaps named. |
| v1.0 | 2026-05-15 | Iris (Information Officer, governance) · Owen (Company Secretary, governance) | Promoted to POPULATED: full 12-section body; steps, reconciliation, evidence, failure modes, manual steps completed; substrate gaps retained as PLANNED. |

## 12. Audit / assurance

Vera (Internal-audit / continuous-assurance engineer) asserts the IO-designation coverage projection quarterly:
- Every responsible-party entity has a current designation (no gap > 12 months).
- Every designation has a corresponding Regulator-registration event with an acknowledgement reference.
- Every PAIA s.51 manual is current and resolves to the correct IO.

Annual rehearsal of a designation-change cycle (IO resignation / successor appointment) as part of business-continuity testing. Findings reported to Owen and escalated to Board at next quarterly governance meeting.
