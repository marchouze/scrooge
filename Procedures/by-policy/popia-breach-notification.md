# Procedure — POPIA breach notification

**Procedure ID:** PROC-PRIV-01
**Owner:** Iris (Information Officer) · Senna (engineering of the IR pipeline) · Zara (compliance dimension)
**Approval:** BRC + S&E
**Cadence:** On-trigger (breach detected)
**Version:** v1.0 — 2026-05-06
**Status:** Approved (post Round 2; system capability `PLANNED`)

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §6 — POPIA / Privacy Policy.
`Owner Inbox/2026-05-06_core-policies-infosec-ops.md` §3 — Incident Response Policy.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR(IV)-06` (POPIA ss.19–22) | Security safeguards; integrity and confidentiality of personal information. |
| `ORG-PR(IV)-07` (POPIA s.22) | Notify Information Regulator and data subjects of compromise as soon as reasonably possible. |
| `ORG-CY-04` (Joint Standard 1 of 2024) | Incident reporting to PA / FSCA per stipulated timelines. |
| `ORG-CY-11` (RAS B6) | Cyber severity tier model T1–T4 with Regulator-notification thresholds at T3 / T4. |

## 3. Purpose

When the bank suffers a security compromise affecting personal information, ensure the Information Regulator and affected data subjects are notified as required by POPIA s.22 — promptly, accurately, and completely — while preserving evidence and managing the bank's regulatory exposure.

## 4. Trigger

- **Internal:** Senna's IR pipeline classifies an incident at severity tier ≥ T2 (Iris pre-screen) or ≥ T3 (Regulator pre-notification).
- **External:** Operator (processor) notifies the bank under POPIA s.21.
- **Data-subject:** Data subject reports unauthorised access via the data-subject-rights workflow.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Incident raised to Iris by Senna's IR command | `service` (IR pipeline) → `human` (Iris) | `@platform/ir/escalation` (`PLANNED`) | Event: `IncidentEscalatedToIO`. |
| 2 | Iris assesses materiality: is personal information involved? Is confidentiality, integrity or availability breached? | `human` (Iris) | `@domains/privacy/breach-assessment` (`PLANNED`) | Decision typed event with reasoning. |
| 3 | If material: classify under POPIA s.22 (notifiable). If non-material: log and close. | `human` (Iris) | (decision event) | Threshold reasoning recorded. |
| 4 | Preserve evidence; freeze relevant logs and artefacts | `system` (IR pipeline) | `@platform/ir/evidence-vault` (`PLANNED`) | Forensic chain of custody is itself a typed event. |
| 5 | Identify affected data subjects (scope, count, categories) | `system` query + `human` Iris validation | `@domains/privacy/affected-cohort` (`PLANNED`) | Lawful-processing register cross-referenced. |
| 6 | Draft Regulator notification per POPIA s.22(3) form | `human` (Iris) with Senna technical detail | `@domains/privacy/regulator-notice-template` (`PLANNED`) | Generated from incident events (P6) with narrative wrapper. |
| 7 | CEO sign-off if T3 / T4; Helena (CRO) concurrence; Owen runs Board pathway | `human` | Multi-actor sign-off events | Per interim governance arrangement (A3). |
| 8 | Submit to Information Regulator within statutory timeline | `human` (Iris) via Regulator portal | `@domains/privacy/regulator-submission` (`PLANNED`) | Out-of-system submission today; portal integration future-state. Submission timestamp recorded. |
| 9 | Notify affected data subjects per POPIA s.22(4) — content tailored, channel chosen by Iris | `system` + `human` (Iris approves content) | `@domains/notification/data-subjects` (`PLANNED`) | Channels: email, SMS, postal, public notice (per Regulator direction). Each notification is a typed event. |
| 10 | Maintain ongoing communication with Regulator until matter is closed | `human` (Iris, Zara) | (correspondence log as events) | Closure event: `IRCaseClosed`. |
| 11 | Post-incident review (PIR) within 14 days; lessons feed Information Security Policy + procedures | `human` (Senna chairs; Iris contributes) | `@domains/ir/pir` (`PLANNED`) | PIR report is itself a typed artefact reviewed by AC. |

## 6. Reconciliation

- **Events produced:**
  - `IncidentEscalatedToIO`, `BreachAssessment`, `BreachClassified` (notifiable / non-notifiable).
  - `RegulatorNotificationDrafted`, `RegulatorNotificationSubmitted { submitted_at, ref_no }`.
  - `DataSubjectsNotified { cohort_id, count, channels }`.
  - `IRCaseClosed { closure_reasons, lessons }`.
- **Reconciliation check:**
  - Every `BreachClassified { notifiable: true }` is followed by a `RegulatorNotificationSubmitted` event within statutory timing (the statutory timer is a typed event with a deadline).
  - Every `BreachClassified { notifiable: true }` produces `DataSubjectsNotified` covering the affected cohort within Regulator-directed timing.
  - PIR is held within 14 days of `BreachClassified`.
- **Failure mode:** Regulator submission fails → escalate to CEO; backup channel (registered post / hand delivery) used.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Incident events + IR command log | Event log + IR vault | Permanent (P1) | Critical |
| Regulator notification (sent) | Document store + event hash | Permanent | Critical |
| Data-subject notification cohort + channels | Event log | 5 years post-closure | High (PII) |
| PIR report | Document store + event log | Permanent | High |
| Forensic evidence | IR vault (chain of custody) | Per legal hold | Critical |

## 8. Manual steps

- **Step 2** (materiality assessment) — Iris's judgement; documented with reasoning.
- **Step 6** (Regulator notification drafting) — generated framework + human narrative.
- **Step 7** (sign-off) — CEO + CRO concurrence per interim governance.
- **Step 8** (Regulator submission) — out-of-system today; future-state portal integration.
- **Step 11** (PIR chair) — Senna; lessons captured as policy / procedure changes.

These manual steps are tracked exceptions under P2 with their own justification.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Materiality assessment delayed | Iris's pre-screen SLA timer | Zara + Helena; default to "notifiable" if uncertain |
| Regulator timing missed | Statutory deadline event | CEO + Board (interim Risk Forum) immediate; Regulator engagement on overrun |
| Affected-cohort identification incomplete | Iris validation | Anya + Senna; cohort over-scoping if uncertain |
| Forensic chain broken | Evidence-vault integrity check | Senna immediately; legal hold |
| Tipping-off concerns (overlap with FIC matters) | Zara's case-routing | Tipping-off prevention applied; communications restricted to MLRO investigation set |

## 10. Related procedures

- `incident-response.md` (`PLANNED`) — IR command (Senna).
- `cyber-incident-classification.md` (`PLANNED`) — severity-tiering procedure.
- `data-subject-rights.md` / `popia-dsar.md` (`PLANNED`) — DSAR procedure when subjects ask about a breach.
- `str-filing.md` — if breach has financial-crime indicators.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-06 | Iris + Senna + Zara | Initial draft, pre-board reviewed under POPIA / Privacy Policy + Incident Response Policy. |

## 12. Audit / assurance

- Vera reviews PIR reports for procedural compliance; deviation reported to AC.
- Annual rehearsal of the breach-notification workflow (table-top exercise); rehearsal events captured.
- Continuous-controls projection: time-from-detection-to-Regulator-notification reported to BRC quarterly.
