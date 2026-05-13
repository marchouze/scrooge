# Procedure — Suspicious Transaction Report (STR) filing

**Procedure ID:** PROC-FC-STR-01
**Owner:** Zara (Chief Compliance Officer, governance) — acting MLRO
**Approval:** Board (MLRO accountability is statutory under FIC Act s.43; Board reserves this approval)
**Cadence:** Event-triggered (per MLRO decision to file following a case escalation or direct referral)
**Version:** v0.1 — 2026-05-13
**Status:** STUB

---

## 1. Source policy

`Policies/aml-cft-policy-v1.md` — AML/CFT Policy §5 (STR obligations).
RMCP — overarching obligation to have a documented STR procedure and to ensure the MLRO can exercise independent judgment on filing.
`Policies/sanctions-policy-v1.md` — STR / TPR cross-reference (FIC Act s.28A Terrorist Property Reports share the same goAML filing channel).
RAS B1–B3 (CEO approved 2026-05-06): zero appetite for wilful non-reporting; filing is mandatory when reasonable grounds exist.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FC-06` | Report suspicious transactions to the FIC as soon as reasonably possible after grounds for suspicion arise (FIC Act s.29). |
| `ORG-FC-07` | Retain STR records and supporting case files for a minimum of 5 years (FIC Act s.22; FICA Regulation 24). |
| `ORG-FC-08` | File a Terrorist Property Report (TPR) where property is known or suspected to be linked to terrorism or proliferation financing (FIC Act s.28A). |
| `ORG-FC-09` | Tipping-off prohibition: do not disclose to the subject or any associated party that a report has been made, is being considered, or that an investigation is underway (FIC Act s.29(3)). |
| `ORG-FC-13` | No obligation to terminate the business relationship solely because an STR has been filed (FIC Act s.29(4)); normal service continues unless a freeze order is received. |

## 3. Purpose

Ensure that when the MLRO determines reasonable grounds exist to suspect that a transaction or attempted transaction involves the proceeds of crime, terrorist financing, or proliferation financing, a Suspicious Transaction Report (and, where applicable, a Terrorist Property Report) is filed with the Financial Intelligence Centre (FIC) via the goAML portal within the statutory timeline. The procedure records every step as a typed event, enforces tipping-off controls at the platform layer, and provides the evidence chain needed to satisfy FIC inspection requests. It also governs the no-file decision pathway so that MLRO reasoning is captured whether or not a report is filed.

## 4. Trigger

Any of the following initiates the STR filing procedure:

- `TransactionMonitoringCaseDecided { outcome: escalated_to_mlro }` — primary trigger; routed from `transaction-monitoring.md` Step 9.
- Direct referral from a business unit (e.g., Saskia's markets desk, Tomas's payments team) where a staff member has identified a red flag outside the automated monitoring pipeline; referral is recorded as a `ComplianceReferralReceived` event before this procedure begins.
- `ScreeningCaseDecided { outcome: true_positive_sanctions }` — a confirmed sanctions hit may require both a block and a TPR filing under FIC s.28A; Zara coordinates with `sanctions-screening.md` Step 6.
- Regulatory or law-enforcement production order that surfaces a previously undetected suspicious pattern; Imani (legal) routes to MLRO.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive escalated case or direct referral; open MLRO workspace with restricted access (MLRO + named deputies only); record `MLROCaseOpened { case_id, source, transaction_ids, referral_type }` | `system` | `@domains/compliance/mlro-workspace` (`PLANNED`) | Access control is enforced at the platform layer. No other role — including the analyst who escalated — may view MLRO deliberations. Tipping-off clock starts. |
| 2 | Assemble case file: pull `TransactionRiskScored`, `TransactionMonitoringAlert`, `TransactionMonitoringCaseOpened`, KYC profile, account history, counterparty data, sanctions-screening results, and any analyst notes from the event store | `system` | `@domains/compliance/case-assembly` (`PLANNED`) | Case file must include all information the accountable institution has about the transaction and the parties (FIC Act s.29 requirement). Mira's data contracts define the assembly schema. |
| 3 | MLRO reviews case file and forms judgment on reasonable grounds for suspicion | `human` (Zara — MLRO) | `@domains/compliance/mlro-workspace` (`PLANNED`) | MLRO may request additional information from business units via the restricted channel only; no disclosure to the client. Target review: < 2 business days of case receipt. |
| 4 | MLRO decides: file STR or no-file | `human` (Zara — MLRO) | `@platform/event-store` ✓ | Record `STRDecisionMade { decision: file | no-file, rationale, mlro: zara, timestamp }`. Rationale is mandatory in both branches. |
| 5 | **No-file branch:** record decision with full rationale; close case; release any settlement hold (if transaction was pending); case is closed | `human` (Zara — MLRO) | `@platform/event-store` ✓ | No-file decisions are subject to Vera periodic sampling to ensure the reasoning meets the FIC's reasonable-grounds standard. |
| 6 | **File branch:** determine whether the transaction also involves property linked to terrorism or proliferation financing; if yes, a TPR under FIC s.28A is filed concurrently with the STR | `human` (Zara — MLRO) | `@domains/compliance/fic-reporting` (`PLANNED`) | TPR uses a different form on the goAML portal but follows the same filing workflow. |
| 7 | Prepare STR (and TPR if applicable) using the FIC goAML report form; populate all mandatory fields from the assembled case file | `system` (assisted) | `@domains/compliance/goaml-form-builder` (`PLANNED`) | System pre-populates fields from the event-store case assembly; MLRO reviews and approves the draft before submission. |
| 8 | Submit STR (and TPR if applicable) to FIC via goAML portal; receive FIC reference number(s) | `human` (Zara — MLRO) | `@domains/compliance/goaml-submission` (`PLANNED`) | Submission is performed by the MLRO (or named deputy under written authorisation); the system records the FIC reference number as a typed event. Manual fallback: secure email to goAML support if portal is unavailable — must be followed by portal re-submission once available. |
| 9 | Record `STRFiled { case_id, fic_reference, timestamp, mlro: zara }` (and `TPRFiled { case_id, fic_reference, timestamp }` if applicable) | `system` | `@platform/event-store` ✓ | The `STRFiled` event is the canonical confirmation. The FIC reference number is the external acknowledgement. |
| 10 | Post-filing: release or maintain settlement hold per MLRO instruction; continue normal client servicing unless a freeze order is received; record `ClientServicingDecision { case_id, action: continue | hold_pending_freeze, rationale }` | `human` (Zara — MLRO) | `@platform/event-store` ✓ | FIC Act s.29(4): the bank must NOT terminate the relationship or freeze assets solely on the basis of an STR filing. Only a FIC/court freeze order under s.34A or s.35 authorises a freeze. |
| 11 | Seal case file; apply `classification: restricted` tag; archive to document store with 5-year retention marker | `system` | `@platform/document-store` (`PLANNED`) | Case file is accessible only to MLRO, named deputies, and future regulatory inspectors under lawful production order. No other internal access. |
| 12 | If FIC issues a production order, information request, or follow-up enquiry: route to MLRO and Imani; respond within the FIC's stated deadline | `human` (Zara + Imani) | `@domains/compliance/fic-liaison` (`PLANNED`) | All FIC correspondence is itself a typed event (`FICCorrespondenceReceived`, `FICCorrespondenceDispatched`). |

## 6. Reconciliation

- **Events produced:**
  - `MLROCaseOpened { case_id, source, transaction_ids, referral_type }` — case initiation.
  - `STRDecisionMade { decision: file | no-file, rationale, mlro, timestamp }` — MLRO decision (both branches).
  - `STRFiled { case_id, fic_reference, timestamp, mlro }` — filing confirmation.
  - `TPRFiled { case_id, fic_reference, timestamp }` — if terrorism/PF link present.
  - `ClientServicingDecision { case_id, action, rationale }` — post-filing servicing instruction.
  - `FICCorrespondenceReceived` / `FICCorrespondenceDispatched` — regulatory correspondence.

- **Reconciliation invariants:**
  1. Every `TransactionMonitoringCaseDecided { outcome: escalated_to_mlro }` must have a downstream `MLROCaseOpened` within 4 business hours. Vera monitors this.
  2. Every `STRDecisionMade { decision: file }` must have a downstream `STRFiled` event within 5 business days of the `MLROCaseOpened` timestamp. Vera runs a weekly timeliness recon; breaches are escalated to Zara and reported to BRC.
  3. No `STRFiled` event may exist without a prior `STRDecisionMade { decision: file }` for the same case ID. Orphan STR events are a data-integrity finding.
  4. Every `ClientServicingDecision` for a filed case must follow a `STRFiled`; it must not precede the filing event (filing must happen before the servicing decision is recorded).

- **Failure mode:** goAML portal unavailable → MLRO files via manual channel (secure email, FIC emergency contact); platform records `STRFiledManual { case_id, method: email, timestamp }` pending portal re-submission; re-submission event replaces the manual record once the portal restores. Manual filings are tracked in a temporary log and Vera confirms re-submission within 48 hours of portal restoration.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `MLROCaseOpened` events | Event log | 5 years | Restricted (MLRO + deputies only) |
| Assembled case files (event-store pull + analyst notes) | Document store | 5 years post-case closure | Restricted |
| `STRDecisionMade` events (file and no-file) | Event log | 5 years | Restricted |
| STR / TPR draft submissions (goAML form) | Document store | 5 years | Restricted |
| `STRFiled` / `TPRFiled` events (incl. FIC reference numbers) | Event log | 5 years | Restricted |
| `ClientServicingDecision` events | Event log | 5 years | High |
| FIC correspondence (`FICCorrespondenceReceived` / `FICCorrespondenceDispatched`) | Event log + document store | Permanent | Restricted |
| Manual-filing records (`STRFiledManual`) | Event log + temporary log | 5 years | Restricted |

## 8. Manual steps

- **Steps 3–4** (MLRO review and filing decision) are irreducibly human. The determination of "reasonable grounds to suspect" is a professional and legal judgment that cannot be delegated to an automated system; under FIC Act s.43, the MLRO carries personal accountability for this decision.
- **Step 6** (TPR determination) requires MLRO judgment on whether the transaction involves property linked to terrorism or proliferation financing — a factual and legal assessment that the rule engine can flag but cannot certify.
- **Steps 7–8** (form preparation and submission): while the system pre-populates fields, the MLRO must review and approve the draft before submission; the MLRO's authentication on the goAML portal is the statutory submission act.
- **Step 10** (post-filing servicing decision): the MLRO must assess whether a freeze is warranted pending a FIC s.34A order, balancing the tipping-off risk against the risk of asset dissipation. This requires human judgment on the specific facts.
- **Tipping-off control (FIC s.29(3)):** no information about the STR, the investigation, or the case may be communicated to the subject or associated parties at any step. The platform enforces access controls, but human actors must exercise discipline in all verbal and written communications. Breach of s.29(3) is a criminal offence.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| MLRO case not opened within 4 h of escalation | Vera hourly lag monitor | Zara (auto-notification); if Zara is the subject, named deputy takes over |
| STR not filed within 5 business days of case opening | Vera weekly timeliness recon | Zara (self-escalation to BRC); if Zara is the subject, Deputy MLRO + BRC chair |
| goAML portal unavailable | Submission failure event; health-check failure | Manual filing via FIC emergency channel; Mira notified for re-submission tracking |
| Tipping-off breach | Human report or access-log anomaly detected by Senna | Zara → BRC immediately; FIC notification (potential criminal offence); legal hold |
| STR filed without prior `STRDecisionMade` event | Vera recon (orphan event check) | Immediate Vera finding; Zara investigates; potential data-integrity audit |
| No-file decision with inadequate rationale | Vera no-file sampling | Mira flags to Zara; if pattern detected, BRC; potential retrospective filing |
| FIC production order deadline missed | Calendar + event-based deadline tracking | Imani + Zara immediately; formal response-deadline extension request to FIC |
| Freeze order received post-filing | `FICCorrespondenceReceived` with type `freeze_order` | MLRO + Imani immediately; asset freeze executed per FIC s.34A; no client notification |

## 10. Related procedures

- `transaction-monitoring.md` (PROC-FC-TM-01) — primary feeder; provides the escalation that triggers this procedure.
- `ctr-filing.md` (`PLANNED`) — parallel obligation for cash transactions ≥ R49,999; a CTR and an STR may co-exist for the same transaction.
- `tpr-filing.md` (`PLANNED`) — Terrorist Property Report; where TPR applies, this procedure coordinates with tpr-filing.md or handles concurrently (Step 6).
- `sanctions-screening.md` — a confirmed sanctions hit may generate both a block and a TPR/STR referral.
- `kyc-onboarding.md` — client KYC file is a key input to the assembled case file (Step 2).
- `fic-submission-cycle.md` — governs the broader FIC reporting obligations of which STR and TPR filing are a subset.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Zara + Mira | Initial STUB — all 9 sections; system capabilities all PLANNED. |

## 12. Audit / assurance

- Vera weekly STR-timeliness recon (invariant 2 above); monthly no-file sampling (random 10 % of no-file decisions reviewed against reasonable-grounds standard).
- BRC receives monthly STR dashboard: cases opened, decided (file/no-file rate), filed, timeliness compliance.
- Annual independent effectiveness review by Vera + external auditor (statutory obligation under FIC Act s.45A readiness programme).
- MLRO annual report to Board: aggregate STR/TPR statistics, typology trends, rule-library changes, staff training completion.
- FIC inspection readiness: all records accessible via document store within < 5-business-day retrieval SLA; MLRO prepares an annual inspection-readiness attestation.
