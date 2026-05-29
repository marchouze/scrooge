---
policy-parent: Owner Inbox/2026-05-06_core-policies-compliance-privacy.md §6 — POPIA / Privacy Policy (Cross-Border Transfer Policy)
last-reviewed: 2026-05-15
procedureId: PROC-PRIV-CBT-01
title: POPIA s.72 cross-border transfer assessment
author: Iris (Information Officer, governance) · Devon (Chief Operating Officer, governance)
date: 2026-05-15
owner: Iris (Information Officer, governance) · Devon (Chief Operating Officer, governance)
status: POPULATED
policy-cited: Owner Inbox/2026-05-06_core-policies-compliance-privacy.md §6 — POPIA / Privacy Policy (Cross-Border Transfer Policy)
system-capability: prototype/domains/privacy/cross-border-transfer (PLANNED)
---

# Procedure — POPIA s.72 cross-border transfer assessment

**Procedure ID:** PROC-PRIV-CBT-01
**Owner:** Iris (Information Officer, governance) · Devon (Chief Operating Officer, governance)
**Approval:** BRC
**Cadence:** On-trigger (per new cross-border transfer relationship); annual review of existing relationships
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §6 — POPIA / Privacy Policy, Cross-Border Transfer provisions.

> The bank operates in a multi-jurisdictional environment (Principle 5). Every time personal information about SA data subjects is transferred to a recipient outside SA, a transfer assessment must be conducted and evidenced before the transfer occurs.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR(IV)-06` (POPIA s.72) | Personal information may only be transferred to a recipient in a foreign country if the receiving country has adequate protection, the data subject has consented, the transfer is necessary for the performance of a contract, or the transfer is in the data subject's interest. |
| `ORG-PR(IV)-05` (POPIA s.18) | Data subjects must be notified of cross-border transfers and the basis for the transfer at the time of collection (or as soon as reasonably practical). |
| `ORG-PR(IV)-03` (POPIA s.11) | Lawful processing basis — cross-border transfers must rest on a lawful basis. |
| `ORG-PR(IV)-13` (POPIA Reg 4) | IO is responsible for POPIA compliance framework, including cross-border transfer controls. |
| GDPR Chapter V (where data subjects are EEA residents) | Standard Contractual Clauses or adequacy decision required for transfers of EEA personal data outside the EEA. |

## 3. Purpose

Govern every proposed and existing cross-border transfer of personal information about South African data subjects (and, where applicable, EEA residents) to recipients in foreign jurisdictions. The procedure ensures each transfer rests on a documented lawful basis under POPIA s.72, is recorded as a typed transfer event, and is reviewed annually so that changes in the receiving jurisdiction's adequacy status are caught and actioned.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| New third-party engagement (`ThirdPartyEngagementProposed` event) that includes a cross-border flow of personal information | New transfer assessment — Steps 1–7 |
| New data flow identified in the data-flow mapping cycle (Iris periodic review) | New transfer assessment — Steps 1–7 |
| Annual cadence (scheduled agent tick) | Existing-transfer review — Steps 5–7 |
| Adequacy decision revoked or downgraded for a jurisdiction where the bank transfers data | Emergency review — Steps 5–7 with expedited timeline |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Identify the transfer.** Document the personal information category (PII type, sensitivity tier), the purpose, the recipient entity and jurisdiction, the volume and frequency, and whether the transfer is a controller-to-processor or controller-to-controller relationship. | Iris (agent) + Devon (agent — if transfer involves third-party operations) | `@domains/privacy/cross-border-transfer` (`PLANNED`) | Emits `CrossBorderTransferProposed { transferId, recipients, jurisdictions, piCategories, purpose, controllerProcessorRelationship }`. |
| 2 | **Adequacy check.** Determine whether the recipient jurisdiction has been declared adequate by the Information Regulator (POPIA s.72(1)(a)) or, for EEA residents, the European Commission (GDPR Chapter V). | Iris (agent) | `@domains/privacy/adequacy-register` (`PLANNED`) | Adequacy register is maintained by Mira (Regulatory intelligence engineer) from Regulator publications. Event: `AdequacyStatusChecked { jurisdiction, adequate, source, checkedAt }`. |
| 3 | **Lawful-basis determination.** Where adequacy is not established, determine the applicable transfer mechanism: (a) data subject consent per POPIA s.72(1)(b) and s.11(1)(a); (b) contractual necessity per s.72(1)(c); (c) transfer in the data subject's interest per s.72(1)(d); (d) standard contractual clauses (SCCs) for transfers covered by GDPR; or (e) binding corporate rules (intra-group). | Iris (agent) + Imani (Legal-as-code engineer) | `@domains/privacy/cross-border-transfer` (`PLANNED`) | Emits `TransferLawfulBasisDetermined { transferId, mechanism, conditions, citations }`. If no lawful basis is available, transfer is blocked (emits `CrossBorderTransferBlocked { transferId, reason }`). |
| 4 | **Contractual safeguard execution (where required).** If SCCs or a data processing agreement (DPA) are required, Imani prepares the contractual instrument; both parties sign; signed instrument stored in the document store. | Imani (Legal-as-code engineer) + `human` (external counterpart) | `@domains/legal/contract-execution` (`PLANNED`) | Emits `TransferSafeguardExecuted { transferId, instrumentType, signedAt, documentRef }`. Transfer may not commence until this event fires. |
| 5 | **Data-subject notification.** Data subjects whose personal information will be transferred cross-border are notified of the transfer, the receiving jurisdiction, the lawful basis, and the protection mechanism. For existing customers, notification is included in privacy notice updates. | `system` | `@platform/notification/data-subject` (`PLANNED`) | Emits `TransferNotificationSent { transferId, subjectIds, notificationAt, channel }`. Not required if transfer is an operational necessity under a contract to which the data subject is a party and notification at time of collection was sufficient. |
| 6 | **Transfer authorisation.** Iris authorises the transfer after confirming Steps 1–5 are complete. Transfer is recorded as approved. | Iris (agent) | `@domains/privacy/cross-border-transfer` (`PLANNED`) | Emits `CrossBorderTransferAuthorised { transferId, authorisedBy, authorisedAt, lawfulBasis, expiresAt }`. Transfer authority expires at the earlier of: the next annual review date, any specified consent withdrawal, or the contractual period. |
| 7 | **Annual review.** For each existing `CrossBorderTransferAuthorised` event, Iris reviews: (a) is the adequacy status of the jurisdiction unchanged? (b) are the SCCs / DPA current? (c) is the data subject notification current? (d) is the transfer still necessary for the stated purpose? If any element has changed, Steps 2–6 are re-run. | Iris (agent) | `@domains/privacy/cross-border-transfer` (`PLANNED`) | Emits `CrossBorderTransferReviewed { transferId, reviewedAt, outcome: "current" | "requires-update" | "withdrawn" }`. |

## 6. Reconciliation

- **Events produced:**
  - `CrossBorderTransferProposed`, `AdequacyStatusChecked`, `TransferLawfulBasisDetermined`.
  - `TransferSafeguardExecuted` (where contractual safeguard required).
  - `TransferNotificationSent`.
  - `CrossBorderTransferAuthorised`.
  - `CrossBorderTransferReviewed` (annual).
  - `CrossBorderTransferBlocked` (where no lawful basis found).
- **Reconciliation checks:**
  - Every active cross-border data flow has a current `CrossBorderTransferAuthorised` event that has not expired.
  - Every `CrossBorderTransferAuthorised` has a corresponding `TransferLawfulBasisDetermined` event.
  - Every transfer requiring contractual safeguards has a `TransferSafeguardExecuted` event predating the first `CrossBorderTransferAuthorised`.
  - Annual review: all `CrossBorderTransferAuthorised` events are reviewed within 12 months of authorisation.
- **Failure mode:** active transfer without a current `CrossBorderTransferAuthorised` event → transfer is suspended pending a new assessment; Iris and Devon are notified immediately.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `CrossBorderTransferProposed` → `CrossBorderTransferAuthorised` event chain | Event log (P1) | Permanent | High |
| Data processing agreement / SCCs | Document store; hash in `TransferSafeguardExecuted` event | 7 years post contract end | Legal-confidential |
| `TransferNotificationSent` events and notification content | Event log + document store | 5 years | High (PII) |
| `CrossBorderTransferReviewed` events | Event log | Permanent | Internal |
| Adequacy register (maintained by Mira) | `@domains/privacy/adequacy-register` (`PLANNED`) | Current version permanent; historical versions retained | Internal |

## 8. Manual steps

- **Step 3** (lawful-basis determination where adequacy is not established) — Iris with Imani; legal analysis; human judgement.
- **Step 4** (SCC / DPA negotiation and execution) — requires external counterpart signatures; Imani leads; human correspondence.
- **Step 5** (data-subject notification updates) — notification content requires human review for accuracy before publication.
- **Step 7** (annual review) — Iris's judgement on adequacy status changes; adequacy register inputs from Mira.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Active transfer discovered without `CrossBorderTransferAuthorised` | Iris data-flow mapping; Vera periodic audit | Transfer suspended immediately; Iris + Devon + Owen; assessment re-run urgently |
| Adequacy status revoked for a jurisdiction mid-transfer | Mira adequacy register update; Iris monitoring | Immediate review (Steps 2–6); transfer suspended if alternative basis not available within 14 days |
| SCC / DPA expired without renewal | Imani contract-expiry monitor | Imani + Iris; renewal initiated before expiry; transfer suspended at expiry if renewal not in place |
| Data subject withdraws consent for transfer | Consent-withdrawal event via DSAR flow | Iris — `CrossBorderTransferBlocked` emitted; downstream processing updated |
| POPIA s.72 violation alleged by Information Regulator | Regulator correspondence | Iris + Zara (CCO) + Imani + Owen; formal response; potential remediation and notification |

## 10. Related procedures

- `popia-dsar.md` (PROC-PRIV-DSAR-01) — data subject consent withdrawal may affect transfer authorisation.
- `popia-io-designation.md` (PROC-PRIV-IO-DSG-01) — IO is accountable for cross-border transfer compliance.
- `outsourcing-due-diligence.md` — third-party engagements that include cross-border personal-information flows trigger this procedure.
- `retention-disposal.md` — data subjects may request deletion of personal information transferred cross-border; deletion events must propagate to the recipient (SCC / DPA obligation).

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-15 | Iris (Information Officer, governance) · Devon (Chief Operating Officer, governance) | Initial POPULATED draft. Full 12-section body; POPIA s.72 four-gate model; annual review cycle; GDPR coverage where applicable. |

## 12. Audit / assurance

Vera (Internal-audit / continuous-assurance engineer) asserts annually:
- Every active cross-border data flow has a current `CrossBorderTransferAuthorised` event.
- Every transfer is backed by an adequate basis (adequacy decision or contractual safeguard).
- Annual reviews are complete within 12 months of prior authorisation.

Iris reports the cross-border transfer register to BRC quarterly. The Information Regulator may request the transfer register at any time; it is available on demand from the event store.
