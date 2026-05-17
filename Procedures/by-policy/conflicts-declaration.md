---
status: POPULATED
---
# Procedure — Conflicts of interest declaration

**Procedure ID:** PROC-WB-01
**Owner:** Owen (CoSec) · Helena (oversight from a risk dimension) · Zara (FAIS-conflict overlap)
**Approval:** Board
**Cadence:** On-arising (within 5 business days) + pre-meeting (every Board / committee meeting) + annual attestation
**Version:** v1.0 — 2026-05-06
**Status:** Approved (post Round 2; system capability `PLANNED`)

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-conduct-hr.md` §2 — Conflicts of Interest Policy.
`Owner Inbox/2026-05-06_core-policies-conduct-hr.md` §1 — Code of Conduct.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-GV-02` (Companies Act ss.75–77) | Director duties; declare conflicts; conflicted directors recuse. |
| `ORG-CD-05` (FAIS Conflict of Interest Code) | Manage conflicts; disclose; avoid where unmanageable. |
| `ORG-WB-04` (King IV + Companies Act) | Conflicts of interest declared and managed. |
| `ORG-GV-12` (Companies Act + IAS 24) | Disclose related-party transactions. |

## 3. Purpose

Ensure every director and material employee maintains an accurate, current conflicts declaration; that conflicts which arise are declared promptly; that conflicted parties recuse from relevant decisions; and that the board / committees have the conflicts position before every meeting.

## 4. Trigger

Three triggers — each is a typed event.

- **Pre-meeting** — every Board, committee, and ALCO meeting begins with conflicts disclosure (system-prompted).
- **On-arising** — within 5 business days of a conflict arising or becoming known.
- **Annual** — full re-attestation of the standing register at year-start (and at any director appointment / executive promotion).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Identify the universe of declarants — directors + Material Risk Takers (MRTs) + designated executives | `system` | `@domains/governance/declarant-cohort` (`PLANNED`) | Cohort sourced from HCM events + fit-and-proper register. |
| 2 | Issue declaration prompts: pre-meeting (1 hour pre-start), on-arising (within 5 business days of new fact), annual | `system` (scheduler + notifier) | `@platform/scheduler` + `@platform/notification` (`PLANNED`) | Each prompt is a typed event with deadline. |
| 3 | Declarant submits declaration (or "no change") | `human` | `@domains/governance/conflicts-portal` (`PLANNED`) | Event: `ConflictDeclared { declarant, conflict_type, parties, materiality, action_proposed }` or `ConflictAttested { declarant, "no change" }`. |
| 4 | Owen reviews the declaration; classifies (registrable / requires action / disqualifying) | `human` (Owen, with Helena and Zara on FAIS overlap) | (decision events) | Event: `ConflictClassified { declaration_id, classification }`. |
| 5 | Action management — recusal recorded; remediation (divestment, role change) tracked through to closure | `system` + `human` | `@domains/governance/conflicts-register` (`PLANNED`) | Every action is a typed event: `RecusalRecorded`, `RemediationStarted`, `ConflictResolved`. |
| 6 | Pre-meeting projection of the standing register fed into the meeting pack | `system` | `@domains/governance/board-pack-generator` (`PLANNED`) | Generated, not assembled (P6). |
| 7 | At the meeting: chair confirms declarations on file are current; new declarations from the chair invited | `human` (chair) | (in-meeting event) | Event: `ConflictsConfirmedAtMeeting`. |
| 8 | Conflicted decisions: recused parties leave the meeting (or relevant agenda item); minutes record recusal | `human` (chair) + `system` (minutes) | `@domains/governance/minutes` (`PLANNED`) | Recusal is a typed minute item. |
| 9 | Annual attestation — every declarant confirms (or updates) the standing register | `system` (campaign) + `human` (declarants) | `@domains/governance/conflicts-portal` (`PLANNED`) | Event: `ConflictsAnnualAttested`. |
| 10 | Director-level disqualifying conflicts (unmanageable) → removal pathway | `human` (Board, with Owen) | `@domains/governance/director-removal` (`PLANNED`) | Triggers fit-and-proper review. |

## 6. Reconciliation

- **Events produced:**
  - `ConflictDeclared`, `ConflictAttested`, `ConflictClassified`, `ConflictResolved`.
  - `RecusalRecorded`, `RemediationStarted`, `RemediationCompleted`.
  - `ConflictsConfirmedAtMeeting` (one per Board / committee meeting).
  - `ConflictsAnnualAttested` (per declarant per year).
- **Reconciliation check:**
  - Every Board / committee meeting has exactly one `ConflictsConfirmedAtMeeting` event in its minutes; absence = procedural breach.
  - Every active `ConflictDeclared` (status: open) has a corresponding action (recusal / remediation / resolution) within tier-appropriate SLA.
  - Every declarant in the cohort has either an annual `ConflictsAnnualAttested` event or is in arrears (alerted to Owen).
  - Decisions taken on items where a conflicted declarant did not recuse are flagged by Vera as procedural breaches.
- **Failure mode:** declaration overdue → escalation cadence (5d → manager; 10d → Owen; 15d → CEO; 20d → Board; for directors, 5d → Chair).

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Standing conflicts register | Event-log projection | Permanent (P1) | High |
| Declaration submissions | Event log + portal artefacts | 5 years post-departure (or longer per Companies Act) | High |
| Meeting minutes with recusal records | Document store + event log | Permanent | High |
| Annual attestation records | Event log | Permanent | High |
| Remediation evidence (divestments, role changes) | Document store + event log | 7 years | High |

## 8. Manual steps

- **Step 3** (declaration submission) — declarant judgement on what constitutes a conflict.
- **Step 4** (classification) — Owen's judgement, with Helena / Zara consultation.
- **Step 5** (action management) — recusal and remediation are human acts, captured as events.
- **Step 7** (chair confirmation) — chair's judgement at the meeting.
- **Step 10** (disqualifying-conflict pathway) — Board decision.

These manual steps reflect the inherent judgement nature of conflicts; the platform supports rather than replaces the judgement.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Declaration overdue | SLA timer | 5d / 10d / 15d / 20d ladder |
| Non-disclosed conflict materialised | External signal (regulator complaint, audit, whistleblowing) | Disciplinary; for directors, fiduciary-duty breach |
| Recusal not recorded in minutes | Minutes-projection cross-check | Owen → Chair; corrective minute issued |
| Annual attestation incomplete | Year-end campaign | Chair + Owen escalation; remuneration impact possible |
| Material divestment not completed | Remediation tracker | Owen → Chair; potential fit-and-proper review |

## 10. Related procedures

- `code-attestation.md` (`PLANNED`) — annual Code-of-Conduct attestation overlaps.
- `pa-dealing-pre-clearance.md` (`PLANNED`) — personal account dealing.
- `gift-registration.md` (`PLANNED`) — gifts and hospitality.
- `whistleblowing-case.md` (`PLANNED`) — concealed conflicts surfaced via whistleblowing.
- `fit-and-proper-attestation.md` (`PLANNED`) — fit-and-proper at appointment / continuously.
- `related-party-transactions.md` (`PLANNED`) — material related-party flow.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-06 | Owen (with Helena, Zara) | Initial draft, pre-board reviewed under Conflicts of Interest Policy. |

## 12. Audit / assurance

- Vera reviews the standing register quarterly; cross-checks that decisions taken at meetings are consistent with the conflicts position at that time.
- Annual external review (when external auditor is appointed) of the conflicts register and meeting minutes.
- Continuous-controls projection: declarant-attestation completeness reported to AC quarterly.
