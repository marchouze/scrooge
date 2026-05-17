---
status: POPULATED
---
# Procedure — Terrorist Property Report (TPR) Filing

**Procedure ID:** PROC-FC-TPR-01
**Owner:** Zara (Chief Compliance Officer, governance) — MLRO
**Approval:** Board (MLRO accountability is statutory under FIC Act s.43; Board reserves this approval)
**Cadence:** Event-triggered (per MLRO determination)
**Version:** v0.2 — 2026-05-15
**Status:** POPULATED

---

## 1. Source policy

`Policies/aml-cft-policy-v1.md` — AML/CFT Policy §7 (Terrorist Property Reporting obligations).
RMCP — overarching obligation to have a documented TPR procedure and to ensure the MLRO can exercise independent statutory judgment on filing; TPR is a separate and distinct obligation from the STR requirement.
`Policies/sanctions-policy-v1.md` — Sanctions Policy §4: targeted financial sanctions (TFS) obligations under POCDATARA and the DTI list; a TFS freeze may trigger a concurrent TPR obligation.
RAS B1–B3 (CEO approved 2026-05-06): zero appetite for wilful non-reporting; filing is mandatory when the MLRO has knowledge or reasonable suspicion that property is linked to terrorism or proliferation financing.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FC-08` | File a Terrorist Property Report (TPR) where the bank has property in its possession, custody or control that is known or suspected to be the proceeds of terrorism, intended for use in terrorism, or linked to a proliferation financing entity (FIC Act s.28A). |
| `ORG-FC-14` | Comply with Targeted Financial Sanctions (TFS) obligations: freeze property associated with persons or entities on the DTI / UN / POCDATARA designated lists without delay; report to the FIC via the TFS reporting channel (FIC Act s.26B). |
| `ORG-FC-15` | Freeze obligation: on knowledge or reasonable suspicion that property is terrorist or proliferation-financing property, the bank must immediately freeze that property pending FIC and DPCI instruction; no transaction may proceed against frozen property (POCDATARA s.4; FIC Act s.28A(4)). |
| `ORG-FC-16` | Tipping-off prohibition: FIC s.29(3) applies to TPR filings; the bank may not disclose to the subject or any associated party that a TPR has been filed, is being considered, or that an investigation is underway. Breach is a criminal offence. |
| `ORG-FC-17` | Retain TPR records and case files for a minimum of 5 years (FIC Act s.22; FICA Regulation 24). |

## 3. Purpose

Ensure that whenever the MLRO determines that property in the bank's possession, custody, or control is known or suspected to be linked to terrorism, terrorist financing, or proliferation financing, the bank: (a) immediately freezes the property; (b) files a Terrorist Property Report with the FIC via the goAML portal within the statutory target of < 24 hours from the MLRO's determination; and (c) where required under POCDATARA, notifies the Directorate for Priority Crime Investigation (DPCI). The procedure records every step as a typed event, enforces the tipping-off prohibition at the platform layer, and coordinates with the STR filing procedure and the sanctions-screening procedure where those obligations run concurrently. A TPR may be filed independently of, or concurrently with, an STR; the two are distinct statutory instruments under different provisions of the FIC Act.

## 4. Trigger

Any of the following initiates the TPR filing procedure:

- `ScreeningHit { list: POCDATARA | UN_designated | DTI_TFS, action: BLOCK }` — a confirmed true-positive sanctions match on a terrorism or proliferation financing designation; Zara coordinates between `sanctions-screening.md` Step 6 and this procedure.
- `MLROCaseOpened { source: transaction_monitoring | direct_referral }` followed by the MLRO determining during STR review that the property under review is linked to terrorism or proliferation financing (i.e., the STR basis includes a terrorism nexus); per `str-filing.md` Step 6, the MLRO opens a TPR workflow concurrently.
- Direct intelligence received by the MLRO from DPCI, FIC, SAPS, or a correspondent bank indicating that property held by the bank is or may be terrorist/proliferation property; received as a `ExternalIntelligenceReceived { source, reference, property_description }` event.
- Internal discovery by the bank (e.g., post-onboarding transaction that reveals a previously undetected terrorism nexus); reported by any staff member as a `ComplianceReferralReceived { referral_type: terrorist_property }` event.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive trigger event; open MLRO workspace with restricted access (MLRO + named deputies only); record `TPRCaseOpened { case_id, trigger_event, property_description, trigger_source }` | `system` | `@domains/compliance/mlro-workspace` (`PLANNED`) | Access control is enforced at the platform layer. The tipping-off clock starts from the moment the case is opened. No other role may view MLRO deliberations. |
| 2 | Immediately identify all property (accounts, balances, securities positions, pending transactions) in the bank's possession, custody or control linked to the subject party or the designated entity | `system` | `@domains/compliance/property-locator` (`PLANNED`) | Property locator queries the event store across all domains: `AccountOpened`, `TransactionInitiated` (pending), `PositionOpened`, `CollateralReceived`. The output is a property inventory emitted as `PropertyInventoryGenerated { case_id, property_ids, estimated_value, currency }`. |
| 3 | Execute an immediate freeze on all identified property; emit `PropertyFreezeExecuted { case_id, property_ids, authorised_by: mlro_zara, freeze_basis: s28a_fic_act | s4_pocdatara, timestamp }` | `human` (Zara — MLRO) + `system` | `@domains/payments/freeze-engine` (`PLANNED`) + `@platform/event-store` ✓ | The freeze is executed at the system layer; the MLRO's authorisation is the statutory act. No transaction may proceed against frozen property from the moment of the `PropertyFreezeExecuted` event. Fail-closed: if the freeze engine is unavailable, all pending transactions for the subject party are rejected until the freeze is confirmed. |
| 4 | Assemble TPR case file from the event store: FIC-prescribed fields — property description, estimated value, basis for suspicion or knowledge (terrorism / proliferation financing nexus), parties involved (full identity including SA ID / passport / LEI, nationality, address), chronology of events, steps taken by the bank, prior related STR references (if any) | `system` | `@domains/compliance/tpr-assembler` (`PLANNED`) | All fields are derived from event-store queries; no manual data entry. If the case originated from a `ScreeningHit`, the sanctions list designation details (list name, designation date, designation authority) are included in the basis-for-suspicion field. |
| 5 | MLRO reviews the assembled case file; forms judgment: (a) is this a TPR filing scenario (terrorist / proliferation property) or a pure STR scenario (proceeds of crime, not terrorism)? (b) what is the basis — knowledge or reasonable suspicion? (c) is DPCI notification required under POCDATARA? | `human` (Zara — MLRO) | `@domains/compliance/mlro-workspace` (`PLANNED`) | The MLRO's determination is a professional and legal judgment that cannot be delegated to an automated system. FIC Act s.43 makes the MLRO personally accountable. Target review: < 6 hours from case opening (accelerated timeline given the terrorism nexus and 24-hour filing target). |
| 6 | Record `TPRDeterminationMade { case_id, basis: knowledge | reasonable_suspicion, nexus_type: terrorism | proliferation_financing, dpci_notification_required: true | false, mlro: zara, timestamp }` | `human` (Zara — MLRO) | `@platform/event-store` ✓ | This event is the canonical record of the MLRO's determination. It is required regardless of whether a TPR is filed — a no-file determination also requires a record. |
| 7 | **No-file branch:** if the MLRO determines the terrorism nexus is not established, record the no-file rationale; revert the property freeze if applicable (emitting `PropertyFreezeLifted { case_id, authorised_by: mlro_zara, rationale }`); redirect to `str-filing.md` if the STR obligation remains; close TPR case | `human` (Zara — MLRO) | `@platform/event-store` ✓ | No-file decisions are subject to Vera periodic sampling to ensure the reasoning meets the FIC reasonable-grounds standard. A freeze lifted by the MLRO without filing requires Board-level rationale on record. |
| 8 | **File branch:** prepare TPR using the FIC goAML report form; populate all mandatory fields from the assembled case file; the system pre-populates; MLRO reviews and approves the draft | `system` (assisted) + `human` (Zara — MLRO) | `@domains/compliance/goaml-form-builder` (`PLANNED`) | TPR uses the FIC s.28A form on the goAML portal — distinct from the STR form. If a concurrent STR is being filed, both forms are prepared; they share the case_id but receive separate FIC reference numbers. |
| 9 | Submit TPR to FIC via goAML portal; receive FIC reference number; emit `TPRFiled { case_id, fic_reference, timestamp, mlro: zara, concurrent_str_reference: <str_ref | null> }` | `human` (Zara — MLRO) | `@domains/compliance/goaml-submission` (`PLANNED`) | Target: < 24 hours from `TPRDeterminationMade`. The MLRO (or named deputy under written authorisation) performs the submission. Manual fallback: secure email to goAML support + FIC emergency contact if portal is unavailable; record `TPRFiledManual { case_id, method, timestamp }` pending portal re-submission. |
| 10 | If DPCI notification is required (per Step 5 determination): prepare and dispatch notification to DPCI under POCDATARA; record `DPCINotified { case_id, reference, timestamp, notification_method }` | `human` (Zara — MLRO, with Imani — General Counsel) | `@domains/compliance/dpci-liaison` (`PLANNED`) | POCDATARA notification is a concurrent statutory obligation where property is known or suspected to be used for or proceeds of a terrorist act. Imani reviews the notification content; Zara dispatches. Timeline: simultaneous with or immediately following the TPR filing. |
| 11 | Maintain property freeze pending FIC / DPCI instruction; monitor for FIC freeze orders under FIC s.34A or court orders; any instruction to lift or vary the freeze is recorded as `FreezeMandateUpdated { case_id, instruction_source, new_status, reference }` | `human` (Zara — MLRO) + `system` | `@platform/event-store` ✓ | The bank may not lift the freeze unilaterally once a TPR has been filed — only an FIC / DPCI / court instruction authorises the freeze to be varied. Vera monitors open freezes; any freeze open > 30 days without an external instruction prompts an escalation to Zara for follow-up with FIC. |
| 12 | Seal case file; apply `classification: restricted` tag; archive to document store with 5-year retention marker; grant access only to MLRO, named deputies, and future regulatory inspectors under lawful production order | `system` | `@platform/document-store` (`PLANNED`) | Case file includes: the assembled TPR payload, the `TPRDeterminationMade` event, the FIC reference, the `PropertyFreezeExecuted` event chain, and all FIC / DPCI correspondence. |
| 13 | If FIC issues a production order, information request, or follow-up enquiry: route to Zara and Imani; respond within the FIC's stated deadline; record `FICCorrespondenceReceived` and `FICCorrespondenceDispatched` events | `human` (Zara + Imani) | `@domains/compliance/fic-liaison` (`PLANNED`) | All FIC / DPCI correspondence is a typed event. TPR case files are accessible within < 5-business-day retrieval SLA from the document store. |

## 6. Reconciliation

- **Events produced:**
  - `TPRCaseOpened { case_id, trigger_event, property_description, trigger_source }` — case initiation.
  - `PropertyInventoryGenerated { case_id, property_ids, estimated_value, currency }` — identified property.
  - `PropertyFreezeExecuted { case_id, property_ids, authorised_by, freeze_basis, timestamp }` — immediate freeze.
  - `TPRDeterminationMade { case_id, basis, nexus_type, dpci_notification_required, mlro, timestamp }` — MLRO determination (both branches).
  - `PropertyFreezeLifted { case_id, authorised_by, rationale }` — freeze reversal on no-file determination.
  - `TPRFiled { case_id, fic_reference, timestamp, mlro, concurrent_str_reference }` — filing confirmation.
  - `TPRFiledManual { case_id, method, timestamp }` — manual-channel fallback.
  - `DPCINotified { case_id, reference, timestamp, notification_method }` — DPCI notification (where required).
  - `FreezeMandateUpdated { case_id, instruction_source, new_status, reference }` — freeze status change per external mandate.
  - `FICCorrespondenceReceived` / `FICCorrespondenceDispatched` — regulatory correspondence.

- **Reconciliation invariants:**
  1. Every `PropertyFreezeExecuted` must have a downstream `TPRFiled` or `PropertyFreezeLifted` within 24 hours of the `TPRCaseOpened` timestamp. Vera monitors this invariant with a 30-minute check cadence; breach is an immediate escalation.
  2. Every `ScreeningHit { list: POCDATARA | UN_designated }` (confirmed true-positive) must have a downstream `TPRCaseOpened` within 1 hour. Vera's cross-procedure invariant links `sanctions-screening.md` events to this procedure.
  3. Every `TPRFiled` event must have a prior `TPRDeterminationMade { basis: knowledge | reasonable_suspicion }` for the same `case_id`. Orphan `TPRFiled` events are a data-integrity finding.
  4. Every open `PropertyFreezeExecuted` with no downstream `FreezeMandateUpdated` older than 30 days triggers a Vera escalation to Zara for FIC follow-up.
  5. Where `dpci_notification_required: true` in the `TPRDeterminationMade` event: a `DPCINotified` event must follow within 24 hours of `TPRFiled`. Vera monitors this invariant daily.

- **Failure mode:** goAML portal unavailable → MLRO files via FIC emergency channel (secure email or FIC direct-line); platform records `TPRFiledManual`; re-submission via portal is required once restored; portal unavailability does not extend the 24-hour target — the emergency channel IS the fallback. Vera confirms portal re-submission within 24 hours of portal restoration.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `TPRCaseOpened` events | Event log | 5 years | Restricted (MLRO + deputies only) |
| `PropertyInventoryGenerated` events and underlying property data | Event log + document store | 5 years | Restricted |
| `PropertyFreezeExecuted` / `PropertyFreezeLifted` / `FreezeMandateUpdated` events | Event log | 5 years | Restricted |
| Assembled TPR case files (event-store pull + MLRO notes) | Document store | 5 years post-case closure | Restricted |
| `TPRDeterminationMade` events (file and no-file branches) | Event log | 5 years | Restricted |
| TPR draft submissions (goAML form) | Document store | 5 years | Restricted |
| `TPRFiled` / `TPRFiledManual` events (incl. FIC reference numbers) | Event log | 5 years | Restricted |
| `DPCINotified` events and notification content | Event log + document store | Permanent | Restricted |
| FIC correspondence (`FICCorrespondenceReceived` / `FICCorrespondenceDispatched`) | Event log + document store | Permanent | Restricted |

## 8. Manual steps

- **Steps 5–6** (MLRO determination): the judgment that property is known or suspected to be linked to terrorism or proliferation financing is a professional and legal determination that cannot be automated. The MLRO carries personal statutory accountability under FIC Act s.43. The system can surface signals and assemble case data; only the MLRO can certify the terrorism or proliferation nexus.
- **Step 3** (freeze authorisation): the freeze is executed at the system layer, but the MLRO's authorisation is the statutory act that gives legal force to the freeze under FIC s.28A(4) and POCDATARA s.4. The MLRO must authenticate the freeze instruction in the system; this cannot be pre-authorised or automated.
- **Steps 8–9** (form preparation and goAML submission): the MLRO must review and approve the TPR draft before submission; the MLRO's authentication on the goAML portal is the statutory submission act. The system pre-populates all fields from the assembled case file, but the MLRO's sign-off is required.
- **Step 10** (DPCI notification): Imani reviews the notification content for legal precision; Zara dispatches as the accountable MLRO. The notification must not inadvertently disclose information beyond what POCDATARA requires — Imani's review is a legal risk control.
- **Tipping-off control (FIC s.29(3)):** the tipping-off prohibition is more acute in TPR cases than in CTR cases — disclosure to a terrorism or proliferation financing suspect could compromise law enforcement operations and constitutes a criminal offence. The platform enforces access controls at the cryptographic layer; human actors (including Imani on DPCI notifications) must exercise extreme discipline in all communications.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| TPR case not opened within 1 hour of confirmed TFS screening hit | Vera cross-procedure invariant (invariant 2; 30-minute cadence) | Auto-alert to Zara; if Zara unavailable, named deputy MLRO + BRC chair notified immediately |
| Property freeze not executed within 1 hour of `TPRCaseOpened` | Vera 30-minute cadence monitor | Auto-alert to Zara + Devon (freeze engine owner); escalate to BRC if not resolved within 2 hours |
| TPR not filed within 24 hours of determination | Vera 30-minute cadence invariant 1 | Zara → Board (immediate notification given statutory severity); FIC voluntary disclosure if deadline missed; legal hold on all related records |
| goAML portal unavailable at filing time | Submission failure event; health-check | MLRO activates FIC emergency channel immediately; `TPRFiledManual` records the filing; Vera confirms re-submission within 24 hours of portal restoration |
| DPCI notification overdue (> 24 hours post-TPR where required) | Vera daily recon (invariant 5) | Zara + Imani immediately; DPCI notified with explanation for delay; Board informed |
| Tipping-off breach | Human report or access-log anomaly (Senna audit logs) | Zara → Board immediately; FIC notification (potential criminal offence); legal hold; law enforcement engagement through Imani |
| Open freeze > 30 days without external mandate | Vera daily recon (invariant 4) | Zara escalation to FIC for status update on case; Board briefing on frozen assets |
| No `TPRDeterminationMade` prior to `TPRFiled` (orphan filing) | Vera recon (invariant 3) | Immediate Vera finding; Zara investigates; potential data-integrity audit; regulatory disclosure assessment |
| Freeze engine unavailable | Health-check failure; transaction rejection log | Atlas + Devon immediately; all pending transactions for subject party rejected pending freeze confirmation; SLA: restore < 30 minutes |
| FIC production order deadline missed | Calendar + event-based deadline tracking | Imani + Zara immediately; formal response-deadline extension request to FIC |

## 10. Related procedures

- `str-filing.md` (PROC-FC-STR-01) — TPR and STR may be filed concurrently; `str-filing.md` Step 6 is the handoff point. STR relates to proceeds of crime generally; TPR relates specifically to terrorist or proliferation property. The MLRO makes both determinations in the same case review.
- `sanctions-screening.md` (PROC-FC-02) — confirmed TFS screening hits are the primary automated trigger for this procedure; `sanctions-screening.md` Step 6 routes to this procedure.
- `ctr-filing.md` (PROC-FC-CTR-01) — if a CTR-qualifying transaction is also linked to terrorist property, both obligations run concurrently; CTR filing is not suspended pending the TPR outcome.
- `kyc-onboarding.md` — party identity data used in the TPR case file (Step 4) is sourced from the KYC/CDD record; a TPR may also trigger an enhanced retrospective KYC review of the subject.
- `fic-submission-cycle.md` — governs the broader FIC reporting obligations; TPR is one of the reporting streams managed under that procedure.
- `transaction-monitoring.md` (PROC-FC-TM-01) — transaction monitoring may surface a terrorism-nexus indicator that triggers a TPR case outside of the sanctions screening path.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Zara | Initial STUB — all 9 sections; system capabilities all PLANNED; Board approval pathway noted. |
| v0.2 | 2026-05-15 | Zara (Chief Compliance Officer, governance) + Mira (Regulatory intelligence engineer, compliance) | Promoted to POPULATED — all 12 sections verified complete. |

## 12. Audit / assurance

- Vera 30-minute cadence invariant checks (freeze execution + filing timeline); daily cross-procedure and DPCI notification recona.
- Board receives immediate notification of any TPR filing (given the severity of the terrorism nexus and the MLRO's statutory personal accountability).
- BRC receives quarterly TPR summary: cases opened, determined (file/no-file), filed, timeliness compliance, open freezes and their FIC/DPCI status.
- Annual independent effectiveness review by Vera + external auditor covering: MLRO determination quality, freeze execution speed, DPCI coordination, and integration with sanctions-screening and STR workflows.
- MLRO annual report to Board: aggregate TPR statistics, typology trends, freeze outcomes, law enforcement engagement.
- FIC inspection readiness: all TPR records accessible via document store within < 5-business-day retrieval SLA; MLRO maintains an annual inspection-readiness attestation covering TPR, STR, and CTR stores jointly.
