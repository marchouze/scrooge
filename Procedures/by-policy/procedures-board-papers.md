---
procedureId: PROC-GOV-BP-01
title: Board paper preparation and circulation — governance framework
author: Owen (Company Secretary, governance)
date: 2026-05-16
owner: Owen (Company Secretary, governance)
status: POPULATED
policy-cited: Governance Framework Policy (planned)
system-capability: "@platform/governance/board-portal (PLANNED)"
---

# Procedure — Board paper preparation and circulation — governance framework

**Procedure ID:** PROC-GOV-BP-01
**Owner:** Owen (Company Secretary, governance)
**Approval:** CEO (procedure approval) · Interim Audit Forum (paper standards adoption)
**Cadence:** Per-meeting (each Interim Audit Forum / future Board session); annual (standards review)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Governance Framework Policy (planned; Owen to author; load-bearing at pre-licence go-live readiness gate).
- Companies Act 71 of 2008 s.73–75 — director duties; directors must receive papers in sufficient time to discharge their duties.
- Banks Act 94 of 1990 s.60 — board responsibility for risk management; board must receive adequate information.

The obligation chain:

```
Regulation (Companies Act s.73–75 / Banks Act s.60 / King IV principles)
  → Governance Framework Policy
    → PROC-GOV-BP-01 (this procedure — board paper preparation and circulation)
      → @platform/governance/board-portal (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CORP-03` (Companies Act s.73–75 — director duties and board meetings) | Directors must receive papers sufficiently in advance to perform their duties; minutes must be kept and approved. |
| `ORG-PR-10` (Banks Act s.60 — risk management) | Board is responsible for risk management; the board must receive adequate, timely, and accurate information to discharge that responsibility. |
| `ORG-CORP-05` (King IV Report — Apply and Explain) | Governing body should receive papers that are accurate, timely, relevant, and complete; a board charter and terms of reference are required. |
| `ORG-FC-15` (FICA — governance and compliance obligations) | Board must satisfy itself that the bank's RMCP and compliance frameworks are adequate; papers tabling compliance information must meet a minimum standard. |

## 3. Purpose

Ensure the Interim Audit Forum (and, at incorporation, the full Board of Directors) receives papers that are accurate, complete, well-structured, and distributed with sufficient notice to enable meaningful deliberation. The procedure governs: (a) the paper template and format standard; (b) submission deadlines (papers due 5 business days before the meeting date); (c) Owen's review and upload to the board portal; (d) confidentiality classification (board papers are classified Restricted); (e) minutes preparation and sign-off cycle.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| Meeting scheduled event (Owen's governance calendar, at least 30 days notice) | Paper preparation cycle — Steps 1–6 |
| `CeoDecision` event tabled at a meeting (for board awareness or ratification) | Decision paper sub-flow — Steps 2–4 |
| Regulatory notification (PA directive, FSCA circular) tabled for board awareness | Information paper sub-flow — Steps 2–4 |
| Request from Audit Forum member for a specific agenda item | Ad-hoc paper sub-flow — Steps 2–4 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Meeting notice.** Owen issues formal notice of the meeting (date, time, venue/video-link, proposed agenda) to all board/forum members at least 30 calendar days in advance. Emit `BoardMeetingScheduled { meetingId, date, agenda[], distributionList }`. | `agent` (Owen) | `@platform/governance/board-portal` (`PLANNED`) | Companies Act s.62 prescribes notice requirements; at least 5 business days' notice for directors; Owen targets 30 days for substantive meetings. |
| 2 | **Paper drafting.** Each paper author (Helena, Camille, Thandiwe, Devon, Zara, or any team member presenting to the board) drafts their paper using the standard template: (a) cover sheet (title, author, classification, action required — for decision / for noting / for approval); (b) executive summary (max 2 paragraphs); (c) background and context; (d) analysis; (e) recommendation / proposed decision; (f) appendices. | `agent` (per author) | `@platform/governance/board-portal` (`PLANNED`) | Papers must be classified: Public / Internal / Confidential / Restricted. Board papers are classified Restricted by default unless Owen approves a lower classification. |
| 3 | **Submission to Owen (5 business days before meeting).** Authors submit final draft papers to Owen electronically (via board portal) by close of business 5 business days before the meeting. Late papers require Owen's written approval; approval is logged in `BoardPaperLateSubmissionApproved { meetingId, paperId, author, approvedAt }`. | `agent` (per author) | `@platform/governance/board-portal` (`PLANNED`) | Owen tracks the submission deadline via an automated portal reminder sent to authors 10 and 5 business days before the deadline. |
| 4 | **Owen's review.** Owen reviews each paper for: (a) template compliance; (b) accuracy of regulatory citations; (c) consistency with prior meeting decisions and minutes; (d) appropriate classification; (e) conflicts of interest disclosures. Owen returns papers requiring correction to the author with comments; corrected versions must be re-submitted within 24 hours. Emit `BoardPaperReviewed { meetingId, paperId, status: "approved" | "returned", commentsCount }`. | `agent` (Owen) | `@platform/governance/board-portal` (`PLANNED`) | Owen is not responsible for the substantive accuracy of technical papers (e.g. ICAAP, RMF) — that is the author's accountability. Owen's review is a governance and format review. |
| 5 | **Pack compilation and distribution.** Owen compiles the board pack (agenda + all approved papers + prior meeting minutes for approval + supporting documents); uploads to the board portal; sends distribution notification to all members. Each document is content-addressed (BLAKE3 hash). Emit `BoardPackDistributed { meetingId, packHash, distributedAt, distributionList }`. | `agent` (Owen) | `@platform/governance/board-portal` (`PLANNED`) + `@platform/rms/document-store` (`PLANNED`) | Distribution is electronic via board portal only; no paper copies. Members confirm receipt via portal acknowledgement. |
| 6 | **Meeting and minutes.** Owen takes minutes of the meeting: (a) attendees and apologies; (b) quorum confirmation; (c) decisions taken (each decision cited with a `CeoDecision` or `BoardDecision` event ID); (d) matters arising from prior minutes; (e) action items with owner and due date. Draft minutes circulated within 5 business days of the meeting. | `agent` (Owen) + `human` (Chair — confirm quorum, chair meeting) | `@platform/governance/board-portal` (`PLANNED`) | Event: `BoardMeetingHeld { meetingId, attendees[], quorumMet, decisionsRef[] }`. |
| 7 | **Minutes approval.** Draft minutes sent to all attendees for comment within 5 business days. Comments reconciled by Owen. Final minutes tabled for approval at the next meeting. Chair signs (wet or advanced electronic signature). Owen emits `BoardMinutesApproved { meetingId, approvedAt, chairSignatureRef, minutesHash }` and archives in the RMS document store. | `agent` (Owen) + `human` (Chair — sign) | `@platform/governance/board-portal` (`PLANNED`) + `@platform/rms/document-store` (`PLANNED`) | Companies Act s.69(8): minutes signed by the chair are evidence of the proceedings at the meeting. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Owen (Company Secretary, governance) | Owns the full cycle; issues notice; reviews papers; compiles and distributes pack; takes minutes; drives approval |
| Each paper author | Drafts paper to template; submits on time; responds to Owen's review comments within 24 hours |
| CEO | Approves agenda; confirms meeting decisions; signs minutes as Chair (interim) |
| All Forum / Board members | Acknowledge receipt; attend or submit apologies; confirm accuracy of minutes |

## 7. Escalation

| Scenario | Escalation path |
|---|---|
| Paper not submitted by deadline and late approval not sought | Owen marks paper as deferred; agenda adjusted; author informed; noted in minutes |
| Member disputes accuracy of draft minutes | Owen adjudicates; if unresolved, dispute noted in the following meeting's minutes |
| Quorum not met at meeting | Meeting deferred; Owen re-schedules within 10 business days; noted in `BoardMeetingHeld` |
| Confidential paper inadvertently distributed to unauthorised party | Owen + CEO immediately; information security incident raised (`cyber-incident-classification.md`); affected members informed |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/governance/board-portal` | PLANNED | Paper submission, review, pack distribution, acknowledgement tracking, minutes management |
| `@platform/rms/document-store` | PLANNED | Content-addressed archive of all board papers and minutes |
| `@platform/event-store` | ✓ live | All `Board*` events persist here |

## 9. Quality controls

- Vera recon: every meeting in the governance calendar has a `BoardPackDistributed` event within 5 business days before the meeting date.
- Vera recon: every `BoardMeetingHeld` has a corresponding `BoardMinutesApproved` within 60 days.
- Vera recon: every `CeoDecision` event raised at a meeting is cited in the corresponding meeting's minutes (`decisionsRef` field).
- Owen: annual review of the board paper template against King IV and Companies Act requirements; updated template versioned in document store.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `BoardMeetingScheduled`, `BoardPaperReviewed`, `BoardPackDistributed`, `BoardMeetingHeld`, `BoardMinutesApproved` events | Event log (P1) | Permanent | Restricted |
| All board papers (all versions) | RMS document store (content-addressed) | Permanent | Restricted |
| Approved minutes | RMS document store | Permanent | Restricted |
| Late submission approvals | Event log | 7 years | Internal |
| Chair signature artefacts | RMS document store | Permanent | Legal-confidential |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Owen | Initial draft — PLANNED → POPULATED; full 11-section procedure; 5-business-day submission window; confidentiality classification; minutes approval cycle. |

## 12. Audit / assurance

- **Vera (ongoing):** board-pack and minutes completeness recon; decision-event citation audit.
- **Thandiwe (CAE, governance):** annual governance audit; assesses adequacy of board paper standards and Owen's review quality; opinion to Audit Forum.
- **PA (SREP):** the PA may request board minutes and papers as part of SREP; their adequacy is assessed against s.60 obligations.
