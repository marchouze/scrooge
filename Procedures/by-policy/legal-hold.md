---
procedureId: PROC-RMS-LH-01
title: Legal hold — preservation of records and evidence
author: Imani (legal-as-code engineer) · Owen (Company Secretary, governance)
date: 2026-05-16
owner: Imani (legal-as-code engineer) · Owen (Company Secretary, governance)
status: POPULATED
policy-cited: Records Management Policy (planned) · Owner Inbox/2026-05-06_core-policies-governance.md
system-capability: "@platform/rms/legal-hold-engine (PLANNED)"
---

# Procedure — Legal hold — preservation of records and evidence

**Procedure ID:** PROC-RMS-LH-01
**Owner:** Imani (legal-as-code engineer) · Owen (Company Secretary, governance)
**Approval:** CEO (for holds relating to regulatory investigations); Owen (for litigation and disciplinary holds)
**Cadence:** On-trigger (per litigation threat, regulatory inquiry, or disciplinary proceeding)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Records Management Policy (planned; Owen to author; load-bearing at pre-licence go-live readiness gate).
- `Owner Inbox/2026-05-06_core-policies-governance.md` — governance and records framework.
- Civil Procedure rules (Uniform Rules of Court, Rule 35) — discovery obligations require preservation of documents from the moment litigation is reasonably anticipated.

The obligation chain:

```
Regulation (Civil Procedure Rules / Banks Act s.64 / POPIA s.14 / FIC Act s.22)
  → Records Management Policy
    → PROC-RMS-LH-01 (this procedure — legal hold)
      → @platform/rms/legal-hold-engine (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CORP-03` (Uniform Rules of Court, Rule 35 — discovery) | Parties must preserve and produce documents relevant to litigation from the moment litigation is reasonably anticipated; destruction of documents after a hold trigger is contempt of court. |
| `ORG-FC-22` (FIC Act s.22 — record keeping) | Records relevant to FIC Act obligations must be retained for 5 years; regulatory investigations may extend this. |
| `ORG-PRIV-05` (POPIA s.14 — purpose limitation and retention) | Legal hold creates a lawful basis for retaining records beyond their normal retention period. |
| `ORG-PR-07` (Banks Act s.64 — reporting to PA) | The bank must cooperate with PA investigations; legal hold ensures records are available for regulatory review. |

## 3. Purpose

Prevent the destruction, alteration, or disposal of records and data that are, or may be, relevant to actual or reasonably anticipated litigation, regulatory investigation, or internal disciplinary proceedings. A legal hold suspends normal record disposal schedules for the scope of records covered. The hold remains in effect until formally released by Imani or Owen on resolution of the matter.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| `LitigationThreatIdentified { matterId, description, anticipatedClaims }` (Imani or Owen) | Litigation hold — Steps 1–6 |
| `RegulatoryInquiryReceived { matterId, regulator, inquiryRef, scope }` (Owen) | Regulatory hold — Steps 1–6 (with CEO notification) |
| `DisciplinaryProceedingOpened { matterId, subjectRef, allegations }` (Owen) | Disciplinary hold — Steps 1–4, 6 |
| Court order or subpoena received | Mandatory hold — Steps 1–4 immediately; Step 5 within 24 hours |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Hold trigger assessment.** Imani and Owen assess the trigger event: (a) is the trigger a hold-qualifying event (litigation, regulatory inquiry, disciplinary, court order)? (b) what is the anticipated scope of relevant records (time range, subjects, record types, systems)? (c) what is the severity and urgency? Emit `LegalHoldTriggerAssessed { matterId, triggerType, scope, urgency }`. | `agent` (Imani) + `agent` (Owen) | `@platform/rms/legal-hold-engine` (`PLANNED`) | For court orders and subpoenas: the hold is mandatory and immediate; assessment still occurs to define scope. For anticipated litigation: the assessment determines whether a reasonable litigation risk exists (a low threshold — when in doubt, hold). |
| 2 | **Hold scope definition.** Imani defines the scope of records subject to the hold: (a) time period (from earliest relevant event to hold release); (b) record types (event log slices, documents in RMS, emails, trading records, communications); (c) custodians (which agents and humans hold or have access to relevant records); (d) systems (event log, RMS document store, board portal, external counsel systems). Emit `LegalHoldScopeDefined { matterId, timePeriod, recordTypes[], custodians[], systems[] }`. | `agent` (Imani) | `@platform/rms/legal-hold-engine` (`PLANNED`) | The scope must be documented with sufficient precision to enable automated preservation. Over-inclusion is preferred over under-inclusion. |
| 3 | **Hold activation.** The legal-hold engine: (a) marks all records within the defined scope as `HOLD: DO NOT DESTROY`; (b) suspends any automated disposal jobs that would affect held records; (c) creates a hold inventory (BLAKE3 hash of each record at time of hold). Emit `LegalHoldActivated { matterId, holdId, activatedAt, recordsAffected, holdInventoryHash }`. | `system` | `@platform/rms/legal-hold-engine` (`PLANNED`) + `@platform/event-store` ✓ | The event log is append-only and immutable by design (Principle 1); the hold engine focuses on the RMS document store and any derived projections. No record within the hold scope may be modified or destroyed from this point. |
| 4 | **Custodian notification.** Owen issues a preservation notice to all custodians identified in Step 2: (a) description of the matter (at appropriate confidentiality level); (b) scope of records to be preserved; (c) prohibition on destruction, alteration, or disclosure of held records; (d) obligation to report any inadvertent destruction or alteration immediately. Emit `CustodianNotificationsIssued { matterId, holdId, custodians[], notifiedAt }`. | `agent` (Owen) | `@platform/governance/notifications` (`PLANNED`) | Agent custodians receive a structured `LegalHoldNotice` event routed to their operating spec. Human custodians (if any at this stage) receive a formal written notice via email. |
| 5 | **Hold register entry.** Owen enters the hold in the legal hold register: matter ID, description, trigger type, scope summary, activation date, hold inventory hash, responsible attorney (Imani), status. The register is a projection derived from `LegalHold*` events. Emit `LegalHoldRegistered { matterId, holdId, registerEntryAt }`. | `agent` (Owen) | `@platform/rms/legal-hold-register` (`PLANNED`) | The hold register is an RMS register (alongside Decisions, Correspondence, etc.). Vera monitors for holds not registered within 24 hours of activation. |
| 6 | **CEO notification (regulatory investigations).** For regulatory inquiry holds: Owen notifies the CEO within 4 hours of hold activation. CEO decides whether external counsel instruction is required (per `litigation-handling.md` PROC-LEG-LH-01). Emit `CEONotifiedOfRegulatoryHold { matterId, holdId, notifiedAt, externalCounselRequired: boolean }`. | `agent` (Owen) + `human` (CEO) | `@platform/governance/notifications` (`PLANNED`) | Regulatory investigation holds always require CEO awareness. Helena (CRO, governance) is also informed if the hold relates to a market, credit, or liquidity matter. |
| 7 | **Ongoing preservation monitoring.** Vera monitors the hold scope daily: (a) confirms no held records have been modified or destroyed; (b) confirms automated disposal jobs remain suspended; (c) adds newly created records within the scope to the hold inventory. Emit `LegalHoldMonitoringRun { matterId, holdId, runDate, newRecordsAdded, integrityBreaches }`. | `system` (Vera) | `@platform/rms/legal-hold-engine` (`PLANNED`) + `@platform/recon` ✓ | Any integrity breach (record modified or destroyed within the hold scope) is a P1 Vera finding; Imani + Owen + CEO notified immediately; potential contempt-of-court risk. |
| 8 | **Hold release.** On resolution of the matter: Imani recommends release; Owen approves; CEO approves for regulatory holds. The hold engine releases the preservation flags on all held records; normal disposal schedules resume (where retention periods have not expired). Emit `LegalHoldReleased { matterId, holdId, releasedAt, releasedBy, dispositionOfHeldRecords }`. | `agent` (Imani) + `agent` (Owen) + `human` (CEO — regulatory holds) | `@platform/rms/legal-hold-engine` (`PLANNED`) | Even after release, records are not destroyed until their normal retention period has expired (the hold extends but does not shorten the retention period). |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Imani (legal-as-code engineer) | Hold scope definition; trigger assessment; hold release recommendation; external counsel coordination |
| Owen (Company Secretary, governance) | Custodian notification; hold register; CEO notification for regulatory holds; co-approver of release |
| CEO | Approves regulatory holds; authorises external counsel engagement |
| Vera (internal audit engineer) | Daily hold integrity monitoring; breach escalation |
| All custodians | Preserve held records; report inadvertent destruction immediately |

## 7. Escalation

| Scenario | Escalation path |
|---|---|
| Record destroyed or modified within hold scope | Imani + Owen + CEO immediately; preserve evidence of the destruction; legal risk assessment; possible court notification |
| Regulatory investigation with potential systemic significance | CEO + BRC within 4 hours; Helena (CRO, governance) informed; external counsel instructed |
| Hold scope materially unclear (cannot identify all custodians or systems) | Imani + Owen; over-include until clarity; document the over-inclusion in the hold register |
| Hold active for > 12 months | Imani reviews continued necessity; Owen confirms; CEO approves extension or release |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/rms/legal-hold-engine` | PLANNED | Preservation flag management; disposal job suspension; hold inventory |
| `@platform/rms/legal-hold-register` | PLANNED | Hold register projection (derived from `LegalHold*` events) |
| `@platform/governance/notifications` | PLANNED | Custodian and CEO notification delivery |
| `@platform/event-store` | ✓ live | Immutable by design; all `LegalHold*` events persist here |

## 9. Quality controls

- Vera recon: every `LegalHoldActivated` has a corresponding `LegalHoldRegistered` within 24 hours.
- Vera recon: every `LegalHoldActivated` has a corresponding `CustodianNotificationsIssued` within 4 hours.
- Vera recon: daily `LegalHoldMonitoringRun` for every active hold.
- Vera recon: no record with `HOLD: DO NOT DESTROY` flag has been disposed of.
- Owen: quarterly review of all active holds; confirm continued necessity; flag stale holds for release assessment.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `LegalHoldTriggerAssessed`, `LegalHoldScopeDefined`, `LegalHoldActivated`, `CustodianNotificationsIssued`, `LegalHoldRegistered`, `LegalHoldMonitoringRun`, `LegalHoldReleased` events | Event log (P1) | Permanent (legal hold records are never destroyed) | Legal-confidential |
| Hold inventory (BLAKE3 hashes at activation) | RMS document store | Permanent | Legal-confidential |
| Custodian preservation notices | RMS document store | Permanent | Confidential |
| Legal hold register | RMS register projection | Permanent | Restricted |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Imani + Owen | Initial draft — PLANNED → POPULATED; full 11-section procedure; automated preservation; custodian notifications via RMS; Vera daily monitoring; CEO notification for regulatory holds. |

## 12. Audit / assurance

- **Vera (daily):** hold integrity monitoring; disposal job suspension confirmation; custodian notification completeness.
- **Thandiwe (CAE, governance):** annual audit of legal hold process; sample testing of hold activations; opinion to BRC.
- **External counsel (when engaged):** may review hold scope and adequacy as part of litigation management.
