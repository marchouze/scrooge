---
policy-parent: Owner Inbox/2026-05-06_core-policies-compliance-privacy.md §7 — PAIA Manual / Access to Information
last-reviewed: 2026-05-15
procedureId: PROC-PAIA-RH-01
title: PAIA manual and request handling
author: Iris (Information Officer, governance) · Owen (Company Secretary, governance)
date: 2026-05-15
owner: Iris (Information Officer, governance) · Owen (Company Secretary, governance)
status: POPULATED
policy-cited: Owner Inbox/2026-05-06_core-policies-compliance-privacy.md §7 — PAIA Manual / Access to Information
system-capability: prototype/domains/privacy/paia-request (PLANNED)
---

# Procedure — PAIA manual and request handling

**Procedure ID:** PROC-PAIA-RH-01
**Owner:** Iris (Information Officer, governance) · Owen (Company Secretary, governance)
**Approval:** BRC
**Cadence:** On-trigger (per request); manual updated annually
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §7 — PAIA Manual / Access to Information Policy.

The Promotion of Access to Information Act 2 of 2000 (PAIA) grants any person (not only customers) the right to request access to records held by a private body. As a private body (and future SARB-licensed bank), the bank must maintain a PAIA manual (PAIA s.51) and respond to requests within statutory deadlines. Iris is the designated Information Officer; Owen ensures corporate-law compliance of the manual and request-handling mechanics.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR(IV)-11` (PAIA s.51) | Private body must compile a manual listing available records, how to request them, and the grounds for refusal. IO is responsible for the manual. |
| `ORG-PR(IV)-12` (PAIA s.52–55) | Requestor must submit Form C; request must be acknowledged within 30 days (or 14 days for human-rights matters); response within 30 days (extendable to 60 days). |
| `ORG-PR(IV)-14` (PAIA s.7) | Third-party notification: if a record contains third-party information, the third party must be notified and given an opportunity to make representations before access is granted. |
| `ORG-PR(IV)-10` (PAIA s.34–46) | Grounds for refusal: unreasonable disclosure of third-party private information; commercial interests; research information; safety of individuals; etc. |
| `ORG-PR(IV)-13` (PAIA Reg 4) | IO must submit annual PAIA report to South African Human Rights Commission (SAHRC). |

## 3. Purpose

Ensure every request for access to bank records under PAIA is received, authenticated, assessed, decided, and responded to within statutory timeframes. The procedure covers both the maintenance of the PAIA manual (annual review cycle) and the operational flow for individual PAIA requests (Form C receipt to decision).

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| PAIA Form C request received (any channel) | Request-handling flow — Steps 1–10 |
| Annual cadence (agent tick) | Manual review and resubmission — Steps 1–3 of annual sub-flow |
| Material change to record categories, retention periods, or bank structure | Out-of-cycle manual update — Steps 1–3 of annual sub-flow |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Receive and log the request.** A PAIA Form C request arrives via post, email, or secure portal. Register the request: requestor identity, date received, records sought, stated purpose. | Iris (agent) + `system` | `@domains/privacy/paia-request` (`PLANNED`) | Event: `PAIARequestReceived { requestId, requestorId, recordsSought, receivedAt, channel }`. Acknowledge receipt to the requestor within 2 business days. |
| 2 | **Verify Form C completeness.** Confirm the request uses Form C (or substantially equivalent form), includes adequate description of records sought, and contains requestor contact details. If incomplete, notify the requestor of deficiencies within 5 business days. | `system` + Iris (agent) | `@domains/privacy/paia-request` (`PLANNED`) | Event: `PAIAFormVerified { requestId, complete: boolean, deficienciesIdentified }`. Deficiency notice resets the 30-day clock. |
| 3 | **Authenticate the requestor.** Confirm the requestor's identity if the request relates to personal information about themselves. Public-interest requests do not require identity verification but must state the public interest. | Iris (agent) | `@domains/privacy/paia-request` (`PLANNED`) | Event: `PAIARequestorAuthenticated { requestId, authenticatedAt, method }`. |
| 4 | **Locate and retrieve the records.** Identify which records exist that match the description in Form C. Cross-reference the records-retention-disposal register and event store. Records must exist in the PAIA manual as a category of available record. | `system` + Iris (agent) | `@platform/records/retrieval` (`PLANNED`) | Event: `PAIARecordsLocated { requestId, recordsFound, locationSummary }`. If no matching records exist, a nil-return response is prepared (Step 8). |
| 5 | **Third-party notification.** If any located record contains personal information about a third party (not the requestor), notify the third party in writing, provide a summary of the request, and allow 21 days for representations. | Iris (agent) + `system` | `@platform/notification/third-party` (`PLANNED`) | Event: `PAIAThirdPartyNotified { requestId, thirdPartyRef, notifiedAt, representationDeadline }`. Third-party representations are considered in Step 6. The 30-day response clock is suspended during the 21-day third-party window. |
| 6 | **Grounds-for-refusal assessment.** Assess whether any statutory ground for refusal applies (PAIA s.34–46): third-party privacy, commercial-in-confidence, operational security, safety, research confidentiality. Document the assessment with specific PAIA section citations. | Iris (agent) + Owen (agent) | `@domains/privacy/paia-request` (`PLANNED`) | Event: `PAIARefusalAssessed { requestId, groundsIdentified, citationsApplied, partialAccessPossible }`. Partial access (redaction of exempt portions) is preferred over full refusal where feasible. |
| 7 | **Decision.** Iris decides to grant access (full or partial) or refuse. Decision must be in writing, cite the specific records to be provided or the specific PAIA section for each refusal ground. | Iris (agent) | `@domains/privacy/paia-request` (`PLANNED`) | Event: `PAIADecisionMade { requestId, decision: "grant" | "partial" | "refuse", grounds, decidedAt }`. Decision must be made within 30 days of valid request (extendable to 60 days with notice). |
| 8 | **Deliver the records or refusal notice.** If granted: provide access in the format requested (where reasonable) or the format in which the records exist. If refused: provide a written refusal notice with the applicable PAIA section and appeal rights. | `system` + Iris (agent) | `@platform/notification/requestor` (`PLANNED`) | Event: `PAIAResponseDelivered { requestId, deliveredAt, format, recordsProvided, refusalGrounds }`. Notify requestor of right to apply to court under PAIA s.78 if dissatisfied. |
| 9 | **Fee collection (if applicable).** PAIA s.54 permits fees for reproduction costs (not search fees for first 6 hours). Issue fee schedule if access is granted and reproduction costs are applicable. | `system` | `@platform/billing/paia-fees` (`PLANNED`) | Event: `PAIAFeeCharged { requestId, amount, feeScheduleRef }`. Fee schedule published in the PAIA manual. Requestors who cannot afford fees may apply for an exemption on grounds of public interest. |
| 10 | **Close the request and update the register.** Close the request in the PAIA request register. Update the annual SAHRC report dataset with request outcome. | `system` + Iris (agent) | (closure event) | Event: `PAIARequestClosed { requestId, outcome, closedAt }`. The PAIA request register feeds the SAHRC annual report (PAIA s.32). |

## 6. Reconciliation

- **Events produced:** `PAIARequestReceived`, `PAIAFormVerified`, `PAIARequestorAuthenticated`, `PAIARecordsLocated`, `PAIAThirdPartyNotified` (where applicable), `PAIARefusalAssessed`, `PAIADecisionMade`, `PAIAResponseDelivered`, `PAIAFeeCharged` (where applicable), `PAIARequestClosed`.
- **Reconciliation checks:**
  - Every `PAIARequestReceived` resolves to `PAIARequestClosed` within 60 days.
  - Every `PAIADecisionMade { decision: "refuse" }` cites a specific PAIA section in the refusal grounds.
  - Every `PAIAThirdPartyNotified` is followed by either a third-party representation event or the expiry of the 21-day window before `PAIADecisionMade` fires.
  - SAHRC annual-report dataset is complete by 31 May each year (PAIA s.32).
- **Failure mode:** 30-day clock missed → Iris + Owen + CEO; late response triggers Vera finding and potential SAHRC complaint.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| PAIA request event chain (`PAIARequestReceived` → `PAIARequestClosed`) | Event log (P1) | 5 years post-closure | High |
| PAIA Form C (original) | Document store; hash in `PAIARequestReceived` | 5 years | High |
| Third-party representations | Document store + event log | 5 years | High |
| Refusal-grounds assessment | Event log + document store | 5 years | Internal |
| Records provided | Document store; access logged | 5 years | High |
| PAIA manual (current and historical versions) | Document store | Permanent | Public |
| SAHRC annual report | Document store | Permanent | Public |

## 8. Manual steps

- **Step 5** (third-party correspondence) — requires human review of third-party representations; Iris makes final judgement on whether third-party interest outweighs access right.
- **Step 6** (grounds-for-refusal assessment) — PAIA s.36/37 commercial interests and s.40 safety require human legal judgement; Owen and Imani (Legal-as-code engineer) support.
- **Step 7** (Iris decision on refusal) — every refusal is Iris's accountable decision; must be signed by the IO.
- **SAHRC annual report** — Iris signs and submits the annual report to the SAHRC; regulatory filing.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| 30-day decision deadline missed | Timer event on `PAIARequestReceived` | Iris + Owen + CEO; treat as deemed refusal; requestor notified; Vera finding opened |
| Requestor applies to High Court | Legal correspondence | Imani + Owen + Iris; external legal counsel engaged; CEO informed |
| PAIA manual out of date (records category created but not listed) | Annual review; Vera audit | Owen + Iris; out-of-cycle manual update; republish |
| Third-party notification missed | Vera recon on `PAIADecisionMade` vs `PAIAThirdPartyNotified` | Iris; consider whether decision must be set aside; legal advice |
| SAHRC annual report not filed by 31 May | Calendar trigger | Iris + Owen; immediate filing; brief SAHRC of late submission |

## 10. Related procedures

- `popia-dsar.md` (PROC-PRIV-DSAR-01) — DSAR is the POPIA equivalent of PAIA; both Iris-owned; the request-intake and authentication steps are analogous.
- `popia-io-designation.md` (PROC-PRIV-IO-DSG-01) — Iris's IO designation is the legal prerequisite for this procedure.
- `records-retention-disposal.md` (PROC-RM-RD-01) — PAIA requests can only be satisfied if records are retained; disposal prior to a valid request triggers PAIA liability.
- `retention-disposal.md` — companion procedure governing the lifecycle of records that PAIA requests will target.
- `popia-dsar-correction.md` (PROC-PRIV-DSAR-COR-01) — correction and deletion requests are a related right under POPIA s.24.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-15 | Iris (Information Officer, governance) · Owen (Company Secretary, governance) | Initial POPULATED draft. Full 12-section body; covers Form C receipt to SAHRC annual report; PAIA s.34–46 refusal-grounds assessment; third-party notification mechanics. |

## 12. Audit / assurance

Vera (Internal-audit / continuous-assurance engineer) asserts annually:
- Every PAIA request within the period closed within 60 days.
- Every refusal cites a valid PAIA ground with adequate documentation.
- PAIA manual is current and published on the bank's public website.
- SAHRC annual report filed within 5 months of financial year-end.

Iris presents the PAIA request log to BRC semi-annually. Any court application under PAIA s.78 is a BRC-notifiable event and triggers a Vera findings review.
