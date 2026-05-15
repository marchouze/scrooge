---
procedureId: PROC-COMP-TCF-01
title: TCF/conduct complaints handling
author: Zara (Chief Compliance Officer, governance) · Niko (client relationship manager, markets — activates licence-day)
date: 2026-05-15
owner: Zara (Chief Compliance Officer, governance) · Niko (client relationship manager, markets)
status: POPULATED
policy-cited: Customer Treatment (TCF) Policy v0.1 · FAIS General Code of Conduct (FAIS Act 37/2002)
system-capability: "@platform/compliance/complaints-management (PLANNED)"
---

# Procedure — TCF/conduct complaints handling

**Procedure ID:** PROC-COMP-TCF-01
**Owner:** Zara (Chief Compliance Officer, governance) · Niko (client relationship manager, markets — paused build-phase; activates licence-day)
**Approval:** BRC (conduct reporting); Board AC (policy sign-off)
**Cadence:** Per-complaint (continuous); quarterly trend reporting; annual FAIS complaints report
**Version:** v0.1 — 2026-05-15
**Status:** POPULATED

> **Build-phase note:** Niko's lifecycle substrate is paused and activates at licence-day (first client onboarding). This procedure is drafted now so the substrate is production-grade before commencement-of-trading. All steps naming Niko as actor activate at licence-day; in the build phase, Zara operates both roles for testing purposes.

## 1. Source policy

- Customer Treatment (TCF) Policy v0.1 — TCF Outcome 6 (complaints handled fairly and promptly); Outcome 1 (fair corporate culture).
- FAIS General Code of Conduct (Board Notice 80 of 2003, as amended) — complaint-handling obligations for FSPs; records of complaints; annual reporting.
- `Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §5 — TCF / Conduct Policy.
- RAS B3 (CEO approved 2026-05-06): zero appetite for TCF non-compliance.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CD-01` (TCF — FSCA Guidance Note 1 of 2014) | Six TCF outcomes; Outcome 6: complaints handled fairly and timeously; root causes identified and addressed. |
| `ORG-CD-04` (FAIS General Code of Conduct — Board Notice 80 of 2003) | FSP must have a complaints-handling procedure; acknowledge complaints within 7 days; resolve or advise of further steps within 6 weeks; maintain a complaints register. |
| `ORG-CD-05` (FAIS Act s.17 — FSCA Ombud referral) | Client may refer unresolved complaints to the FAIS Ombud after 6 weeks. |
| `ORG-CD-06` (FSB/FSCA Conduct of Business Return) | Annual FAIS complaints report to the FSCA as part of the annual Conduct of Business Return. |

## 3. Purpose

Ensure every conduct complaint from an institutional client is acknowledged, investigated, and resolved fairly and promptly in accordance with TCF Outcome 6 and the FAIS General Code of Conduct. The procedure:

1. Provides a consistent, auditable intake and triage pathway for all complaints.
2. Establishes a clear timeline: 7-day acknowledgement; 6-week resolution target; FAIS Ombud referral right at 6 weeks.
3. Produces a typed event record of every complaint, its investigation, and its resolution — feeding the RMCP effectiveness review and the annual FAIS complaints report.
4. Identifies systemic root causes through quarterly trend analysis and directs remediation through the RMCP cycle.

## 4. Trigger

- **Complaint received:** any written or verbal expression of dissatisfaction from an institutional client (or former client) about the bank's conduct, products, advice, or services. The complaint is recorded by Niko (at licence-day) or Zara regardless of channel (email, phone, face-to-face, regulatory).
- **Regulatory complaint forwarded:** FSCA / FAIS Ombud forwards a complaint — immediate priority; treated as a regulatory inquiry with the same investigative pathway but escalated SLAs.
- **Quarterly review trigger:** `QuarterlyComplaintsTrendReview` scheduler event — Zara reviews aggregate complaint trends; identifies systemic root causes.
- **Annual FAIS report trigger:** 31 March each year — Mira compiles the annual FAIS complaints report from the complaints register for inclusion in the Conduct of Business Return.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive complaint (any channel); record the complaint details: date received, complainant ID, product/service in scope, nature of the complaint, description of the conduct at issue | `agent` (Niko at licence-day; Zara in build-phase) | `@platform/compliance/complaints-management` (`PLANNED`) | Complaints must be recorded even if the complaint is informal or oral; the intake record is the canonical artefact. |
| 2 | Emit `ComplaintReceived { complaint_id, received_date, complainant_id, product_id, nature, channel }`; assign triage category: **Conduct** (TCF / FAIS scope) or **Non-conduct** (service or operational — route outside this procedure) | `system` | `@platform/event-store` ✓ | Non-conduct complaints route to Devon (COO, governance) operations-handling; this procedure governs conduct complaints only. |
| 3 | Send written acknowledgement to the complainant within **7 calendar days** of receipt; include: reference number, summary of complaint as understood, expected timeline, right of referral to FAIS Ombud | `agent` (Niko / Zara) | `@platform/compliance/complaints-management` (`PLANNED`) | Acknowledgement is mandatory per FAIS General Code. Failure triggers Vera finding + client notification of right of referral. |
| 4 | Emit `ComplaintAcknowledged { complaint_id, acknowledgement_date, acknowledgement_ref }` | `system` | `@platform/event-store` ✓ | Must be within 7 days of `ComplaintReceived`; Vera checks this invariant. |
| 5 | Investigate the complaint: review relevant trade records, advice records (`fais-advice-record-capture.md`), eligibility screening records (`counterparty-institutional-eligibility-screening.md`), communications; identify the conduct at issue and assess whether TCF outcomes were met | `agent` (Zara — conduct lead; Niko for client-relationship context) | `@platform/compliance/complaints-management` (`PLANNED`) + `@platform/event-store` ✓ (read) | Investigation must be objective; if the complaint involves Zara's own conduct, Helena (CRO, governance) or Owen (Company Secretary, governance) leads. |
| 6 | Draft investigation finding and proposed resolution: **uphold** (complaint is justified; remedy offered), **partially uphold**, or **not uphold** (complaint not justified); record the rationale and evidence | `agent` (Zara) | `@platform/compliance/complaints-management` (`PLANNED`) | Where the complaint is upheld or partially upheld, the remedy must be proportionate and fair (TCF Outcome 6). Financial remedies must not be punitive or excessive. |
| 7 | Emit `ComplaintInvestigated { complaint_id, finding: uphold | partial | not-uphold, remedy_offered, rationale_ref }` | `system` | `@platform/event-store` ✓ | Rationale is stored as a document-store reference; not embedded in the event. |
| 8 | Communicate resolution to the complainant in writing within **6 weeks** of the original complaint; include: finding, remedy offered (if any), right to refer to the FAIS Ombud if dissatisfied | `agent` (Niko / Zara) | `@platform/compliance/complaints-management` (`PLANNED`) | The 6-week window is the FAIS General Code requirement; the FAIS Ombud referral right activates at 6 weeks regardless of outcome. |
| 9 | Emit `ComplaintResolved { complaint_id, resolution_date, finding, remedy_accepted: true/false, ombud_referral_right_communicated: true }`; update the complaints register | `system` | `@platform/event-store` ✓ | If the complainant rejects the resolution, the complaint remains open for FAIS Ombud referral; Vera tracks unaccepted resolutions. |
| 10 | **If FAIS Ombud referral received:** treat as a regulatory inquiry; Zara and Imani (legal-as-code engineer) respond within the Ombud's prescribed timeframe; all materials submitted to the Ombud are recorded in the event log | `agent` (Zara) + `human` (Imani) | `@platform/compliance/complaints-management` (`PLANNED`) + `@platform/event-store` ✓ | Ombud referrals are a named escalation path; Vera tracks open Ombud matters. Imani's legal engineering scope covers regulatory submissions. |
| 11 | **Quarterly root-cause analysis:** Zara reviews complaint trends; identifies systemic patterns (product suitability, advice quality, process gaps); emits `ComplaintsTrendReview { quarter, complaints_received, uphold_rate, systemic_themes, remediation_actions }` | `agent` (Zara) | `@platform/reporting/complaints-dashboard` (`PLANNED`) | Systemic themes feed the RMCP effectiveness review (`rmcp-annual-attestation.md`) and the TCF fair-corporate-culture assessment. |
| 12 | **Annual FAIS complaints report:** Mira compiles the statutory complaints return from the complaints register; Zara reviews and signs; submitted as part of the Conduct of Business Return by 31 March | `agent` (Mira — compile) + `human` (Zara — sign) | `@platform/compliance/fic-portal` (`PLANNED`) | The annual report is a statutory obligation under FAIS; failure to submit is a regulatory breach. |

## 6. Reconciliation

- **Events produced:**
  - `ComplaintReceived { complaint_id, received_date, complainant_id, product_id, nature, channel }`
  - `ComplaintAcknowledged { complaint_id, acknowledgement_date }` — must be ≤ 7 days after `ComplaintReceived`
  - `ComplaintInvestigated { complaint_id, finding, remedy_offered }`
  - `ComplaintResolved { complaint_id, resolution_date, finding, remedy_accepted, ombud_referral_right_communicated }`
  - `ComplaintsTrendReview { quarter, complaints_received, uphold_rate, systemic_themes }`
- **Reconciliation checks:**
  - Every `ComplaintReceived` → `ComplaintAcknowledged` within 7 days (Vera invariant).
  - Every `ComplaintReceived` → `ComplaintResolved` within 6 weeks, or `ComplaintResolved` with `ombud_referral_right_communicated: true` and an explanation-of-delay event (Vera invariant).
  - Every `ComplaintResolved { finding: uphold | partial }` → a remedy event or explanation (TCF Outcome 6 check).
  - All annual `ComplaintsTrendReview` events complete by 31 March (FAIS annual report gate).
- **Failure mode:** complaint unacknowledged past 7 days → Vera emits `ComplaintSLABreached { complaint_id, breach_type: "acknowledgement" }` → Zara escalation. Complaint unresolved past 6 weeks → `ComplaintSLABreached { breach_type: "resolution" }` → Zara + BRC.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| All `Complaint*` events | Event log | Minimum 5 years post-resolution (FAIS record-keeping) | High (client-confidential) |
| Investigation file (rationale, evidence, correspondence) | Document store (BLAKE3-addressed, per-complaint) | 5 years post-resolution | High (client-confidential + legal privilege) |
| Acknowledgement and resolution letters | Document store | 5 years post-resolution | High (client-confidential) |
| Annual FAIS complaints report | Document store + FSCA submission record | 5 years post-submission | Restricted |
| Complaints register (derived projection) | RMCP attestation projection | Live; events permanent | Restricted |
| Quarterly trend-review reports | Document store | 5 years | Restricted |

## 8. Manual steps

- **Step 1 — Complaint intake:** Complaints arriving via phone or face-to-face must be manually transcribed to the intake record by Niko or Zara. Until the complaints-management substrate is built, intake is via a structured template.
- **Step 3 — Acknowledgement letter:** The acknowledgement must be individually reviewed for tone and accuracy (TCF Outcome 6 requires the client to feel heard). Not fully automatable.
- **Step 5 — Investigation:** Zara's assessment of whether TCF outcomes were met is a compliance judgement call requiring review of product design, advice records, and conduct context. Not automatable.
- **Step 6 — Finding and remedy:** The proportionality and fairness of any remedy is a judgement call; Zara makes the determination with BRC oversight for systemic or high-value complaints.
- **Step 10 — Ombud referral response:** Legal and regulatory submissions to the FAIS Ombud require Imani's legal engineering input and Zara's CCO sign-off.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Complaint not acknowledged within 7 days | `ComplaintSLABreached { breach_type: "acknowledgement" }` — Vera | Zara immediate; client notified of right of referral; Vera finding |
| Complaint not resolved within 6 weeks | `ComplaintSLABreached { breach_type: "resolution" }` | Zara + BRC; FAIS Ombud referral right automatically communicated to client |
| High uphold rate (> 20% of complaints upheld) | Quarterly trend review threshold | Zara root-cause analysis; systemic remediation plan; BRC reporting; RMCP effectiveness gap |
| FAIS Ombud adverse determination | Ombud notification received | Zara + Imani + CEO; implement determination; BRC notification; regulatory disclosure if required |
| Annual FAIS complaints report not submitted by 31 March | Mira calendar check | Zara + CEO; emergency submission; potential FSCA notification |
| Complaint involving Zara's conduct | Complaint intake triage | Helena (CRO, governance) or Owen (Company Secretary, governance) leads; Zara recused |
| Regulatory complaint forwarded by FSCA / Ombud | Receipt of forwarded complaint | Immediate priority; Zara + Imani; 24-hour preliminary response; BRC notification |

## 10. Related procedures

- [`fais-advice-record-capture.md`](fais-advice-record-capture.md) — advice records are primary evidence in complaint investigations.
- [`counterparty-institutional-eligibility-screening.md`](counterparty-institutional-eligibility-screening.md) (PROC-CRM-CIE-01) — eligibility screening records are relevant to product-suitability complaints.
- [`rmcp-annual-attestation.md`](rmcp-annual-attestation.md) (PROC-COMP-RMCP-01) — complaints uphold rate and systemic themes are primary RMCP effectiveness metrics.
- [`sanctions-override.md`](sanctions-override.md) (PROC-FC-SO-01) — sanctions-related complaints have a separate escalation path under Zara's MLRO remit.
- `client-categorisation.md` (STUB) — client categorisation is relevant to product-suitability complaints under FAIS.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-15 | Zara + Niko | Initial draft — PLANNED → POPULATED; full 12-section procedure; TCF Outcome 6 + FAIS General Code anchoring; Niko build-phase pause noted; FAIS Ombud referral path included. |

## 12. Audit / assurance

- **Vera continuous:** SLA monitoring — every `ComplaintReceived` traces to `ComplaintAcknowledged` (≤ 7 days) and `ComplaintResolved` (≤ 6 weeks). Breaches surfaced as findings to Zara and BRC.
- **Vera quarterly:** complaints register completeness check; all entries have a `ComplaintResolved` event or an open-matter justification.
- **Thandiwe (CAE, governance):** annual audit of a sample of complaints files; assesses whether the investigation methodology is objective and the resolution is proportionate (TCF Outcome 6); reports to Audit Committee.
- **FSCA supervisory review:** the Conduct of Business Return (including FAIS complaints report) is reviewed by the FSCA annually; any material adverse findings trigger a supervisory engagement handled by Zara.
